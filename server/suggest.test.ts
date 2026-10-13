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

  it('pins a refinement to the target range whatever the model quotes', async () => {
    const target = { from: DOC.indexOf('They loose their'), to: DOC.indexOf('They loose their') + 21 }
    const { fetchImpl } = fakeOpenRouter({ content: edits({ quote: 'something else', replacement: 'They lose work.' }) })

    const { response } = await suggest(
      {
        mode: 'refine',
        document: DOC,
        target,
        turns: [{ instruction: 'Fix', replacement: 'They lose their work', reason: 'r' }],
        feedback: 'Shorter',
      },
      { apiKey: 'k', model: MODEL, fetchImpl },
    )

    expect(response.edits).toEqual([{ ...target, quote: 'They loose their work', replacement: 'They lose work.', reason: 'r' }])
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
