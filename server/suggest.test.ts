import { describe, expect, it } from 'vitest'

import type { SuggestRequest } from '../shared/contract'
import { ApiError } from './errors'
import { handleSuggest } from './handler'
import type { ModelProfile } from './models'
import { suggest } from './suggest'

const DOC = 'Our customers has been asking. They loose their work. They loose patience too.'
const MODEL: ModelProfile = { id: 'test/model', label: 'Test' }

type FakeReply = { status?: number; content?: string; body?: unknown }

/** A fetch that answers with the given replies in order and records what was sent. */
function fakeOpenRouter(...replies: FakeReply[]) {
  const sent: { messages: { role: string; content: string }[] }[] = []

  const fetchImpl = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)))

    const reply = replies[Math.min(sent.length - 1, replies.length - 1)] as FakeReply
    const body = reply.body ?? {
      model: 'test/model',
      choices: [{ message: { content: reply.content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.001 },
    }

    return new Response(JSON.stringify(body), { status: reply.status ?? 200 })
  }) as typeof fetch

  return { fetchImpl, sent }
}

const edits = (...items: { quote: string; replacement: string; reason?: string }[]) =>
  JSON.stringify({ edits: items.map((item) => ({ reason: 'r', ...item })), note: 'ok' })

const selectionOf = (text: string, instruction = 'Fix grammar'): SuggestRequest => {
  const from = DOC.indexOf(text)

  return { mode: 'selection', document: DOC, selection: { from, to: from + text.length }, instruction }
}

describe('suggest', () => {
  it('places edits at the exact position of their quote', async () => {
    const { fetchImpl } = fakeOpenRouter({ content: edits({ quote: 'customers has', replacement: 'customers have' }) })

    const { response } = await suggest({ mode: 'document', document: DOC }, { apiKey: 'k', model: MODEL, fetchImpl })

    expect(response.edits).toEqual([
      { from: 4, to: 17, quote: 'customers has', replacement: 'customers have', reason: 'r' },
    ])
    expect(response).toMatchObject({ note: 'ok', skipped: 0 })
  })

  it('retries once, naming the quotes that missed, when no edit could be placed', async () => {
    const { fetchImpl, sent } = fakeOpenRouter(
      { content: edits({ quote: 'They loose', replacement: 'They lose' }) },
      { content: edits({ quote: 'They loose their work', replacement: 'They lose their work' }) },
    )

    const { response, stats } = await suggest({ mode: 'document', document: DOC }, { apiKey: 'k', model: MODEL, fetchImpl })

    expect(stats.attempts).toBe(2)
    expect(sent[1]?.messages.at(-1)?.content).toContain('"They loose"')
    expect(response.edits[0]?.quote).toBe('They loose their work')
  })

  it('accepts JSON wrapped in a code fence and retries on output that is not JSON', async () => {
    const fenced = '```json\n' + edits({ quote: 'customers has', replacement: 'customers have' }) + '\n```'
    const { fetchImpl, sent } = fakeOpenRouter({ content: 'Sure! Here are my edits.' }, { content: fenced })

    const { response } = await suggest({ mode: 'document', document: DOC }, { apiKey: 'k', model: MODEL, fetchImpl })

    expect(sent).toHaveLength(2)
    expect(response.edits).toHaveLength(1)
  })

  it('drops edits outside the selection and reports them as skipped', async () => {
    const { fetchImpl } = fakeOpenRouter({
      content: edits(
        { quote: 'customers has', replacement: 'customers have' },
        { quote: 'patience', replacement: 'their patience' },
      ),
    })

    const { response } = await suggest(selectionOf('Our customers has been asking.'), {
      apiKey: 'k',
      model: MODEL,
      fetchImpl,
    })

    expect(response.edits.map((edit) => edit.quote)).toEqual(['customers has'])
    expect(response.skipped).toBe(1)
  })

  const refineRequest = (target: { from: number; to: number }): SuggestRequest => ({
    mode: 'refine',
    document: DOC,
    target,
    turns: [{ instruction: 'Fix', replacement: 'x', reason: 'r' }],
    feedback: 'Shorter',
  })

  it('uses a whole-passage answer to a refinement as the new version', async () => {
    const target = { from: DOC.indexOf('They loose their'), to: DOC.indexOf('They loose their') + 21 }
    const { fetchImpl } = fakeOpenRouter({ content: edits({ quote: 'They loose their work', replacement: 'They lose work' }) })

    const { response } = await suggest(refineRequest(target), { apiKey: 'k', model: MODEL, fetchImpl })

    expect(response.edits).toEqual([{ ...target, quote: 'They loose their work', replacement: 'They lose work', reason: 'r' }])
  })

  it('keeps the rest of the passage when a refinement quotes only part of it', async () => {
    const passage = 'They loose their work. They loose patience too.'
    const target = { from: DOC.indexOf(passage), to: DOC.indexOf(passage) + passage.length }
    const { fetchImpl } = fakeOpenRouter({ content: edits({ quote: 'They loose patience too.', replacement: 'And patience.' }) })

    const { response } = await suggest(refineRequest(target), { apiKey: 'k', model: MODEL, fetchImpl })

    expect(response.edits[0]?.replacement).toBe('They loose their work. And patience.')
    expect(response.edits[0]).toMatchObject(target)
  })

  it('does not paste a refinement whose quote is not in the passage', async () => {
    const target = { from: DOC.indexOf('They loose their'), to: DOC.indexOf('They loose their') + 21 }
    const { fetchImpl, sent } = fakeOpenRouter({ content: edits({ quote: 'something else', replacement: 'Oops' }) })

    const { response } = await suggest(refineRequest(target), { apiKey: 'k', model: MODEL, fetchImpl })

    expect(sent).toHaveLength(2)
    expect(response.edits).toEqual([])
    expect(response.skipped).toBe(1)
  })

  it('stops at once with a clear message when the answer was cut off at the token limit', async () => {
    const cutOff = {
      model: 'test/model',
      choices: [{ message: { content: '{"edits":[{"quote":"Our cust' }, finish_reason: 'length' }],
    }
    const { fetchImpl, sent } = fakeOpenRouter({ body: cutOff })

    const failure = await suggest({ mode: 'document', document: DOC }, { apiKey: 'k', model: MODEL, fetchImpl }).catch(
      (error: unknown) => error,
    )

    expect(sent).toHaveLength(1)
    expect(failure).toMatchObject({ code: 'model-output', message: expect.stringContaining('shorter selection') })
  })

  it('gives long selections a bigger answer budget', async () => {
    const long = `${'word '.repeat(2000)}end.`
    const { fetchImpl, sent } = fakeOpenRouter({ content: edits({ quote: 'end.', replacement: 'the end.' }) })

    await suggest(
      { mode: 'selection', document: long, selection: { from: 0, to: long.length }, instruction: 'Polish' },
      { apiKey: 'k', model: MODEL, fetchImpl },
    )

    expect((sent[0] as unknown as { max_tokens: number }).max_tokens).toBe(2000 + Math.ceil(long.length / 2))
  })

  it('turns a 402 from OpenRouter into a budget error the writer can understand', async () => {
    const { fetchImpl } = fakeOpenRouter({ status: 402, body: { error: { message: 'Insufficient credits' } } })

    const failure = await suggest({ mode: 'document', document: DOC }, { apiKey: 'k', model: MODEL, fetchImpl }).catch(
      (error: unknown) => error,
    )

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ code: 'budget-exhausted', status: 402 })
  })
})

describe('handleSuggest', () => {
  const post = (body: unknown) =>
    new Request('http://localhost/api/suggest', { method: 'POST', body: JSON.stringify(body) })

  it('rejects a malformed request with a readable message', async () => {
    const response = await handleSuggest(post({ mode: 'selection', document: DOC }), { OPENROUTER_API_KEY: 'k' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'invalid-request' } })
  })

  it('rejects a selection that points past the end of the document', async () => {
    const response = await handleSuggest(
      post({ mode: 'selection', document: 'short', selection: { from: 0, to: 50 }, instruction: 'x' }),
      { OPENROUTER_API_KEY: 'k' },
    )

    expect(response.status).toBe(400)
  })

  it('reports a missing key as a server configuration problem', async () => {
    const response = await handleSuggest(post({ mode: 'document', document: DOC }), {})

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ error: { code: 'misconfigured' } })
  })

  it('answers a valid request with placed edits', async () => {
    const { fetchImpl } = fakeOpenRouter({ content: edits({ quote: 'customers has', replacement: 'customers have' }) })

    const response = await handleSuggest(post({ mode: 'document', document: DOC }), { OPENROUTER_API_KEY: 'k' }, fetchImpl)

    expect(response.status).toBe(200)
    expect((await response.json()).edits).toHaveLength(1)
  })
})
