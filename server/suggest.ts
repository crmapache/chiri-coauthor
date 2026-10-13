import { z } from 'zod'

import { anchorEdits, clampReason, type AnchorFailure, type RawEdit } from '../shared/anchor.js'
import type { AnchoredEdit, SuggestRequest, SuggestResponse, TextRange } from '../shared/contract.js'
import { ApiError } from './errors.js'
import type { ModelProfile } from './models.js'
import { complete, type Completion } from './openrouter.js'
import {
  anchorRetryPrompt,
  buildMessages,
  INVALID_JSON_RETRY_PROMPT,
  MAX_REVIEW_EDITS,
  type ChatMessage,
} from './prompts.js'

const modelOutputSchema = z.object({
  edits: z.array(
    z.object({
      quote: z.string(),
      replacement: z.string(),
      reason: z.string(),
    }),
  ),
  note: z.string().default(''),
})

type ModelOutput = z.infer<typeof modelOutputSchema>

/** One retry covers the usual slips (a mangled quote, a stray code fence) without doubling cost. */
const MAX_ATTEMPTS = 2

export type SuggestDeps = {
  apiKey: string
  model: ModelProfile
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

/** What happened inside one request. The handler ignores it; the bake-off is built on it. */
export type SuggestStats = {
  attempts: number
  proposed: number
  failures: AnchorFailure[]
  costUsd: number
  promptTokens: number
  completionTokens: number
}

export type SuggestOutcome = { response: SuggestResponse; stats: SuggestStats }

/** Some providers wrap JSON in a Markdown fence even when asked not to. */
function stripCodeFence(content: string): string {
  const fenced = content.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)

  return fenced?.[1] ?? content.trim()
}

function parseModelOutput(content: string): ModelOutput | null {
  try {
    const parsed = modelOutputSchema.safeParse(JSON.parse(stripCodeFence(content)))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function assertRangeInside(range: TextRange, document: string): void {
  if (range.to > document.length) {
    throw new ApiError('invalid-request', 'The selected range is outside the document.')
  }
}

/** The part of the document the model may change, or undefined for the whole document. */
function editableRange(request: SuggestRequest): TextRange | undefined {
  if (request.mode === 'selection') return request.selection

  if (request.mode === 'refine') return request.target

  return undefined
}

/**
 * A refinement is about one known span. The model is asked to quote all of it, but it sometimes
 * quotes only the sentences it changed. Either way its edits are placed inside the span and folded
 * into one new version of the whole span, so text it did not mention is kept, not dropped.
 */
function placeRefinement(request: SuggestRequest & { mode: 'refine' }, output: ModelOutput) {
  const { target, document } = request
  const passage = document.slice(target.from, target.to)
  const placed = anchorEdits(document, output.edits as RawEdit[], target)

  if (placed.edits.length === 0) return placed

  let replacement = passage

  for (const edit of [...placed.edits].reverse()) {
    replacement =
      replacement.slice(0, edit.from - target.from) + edit.replacement + replacement.slice(edit.to - target.from)
  }

  if (replacement === passage) {
    return { edits: [], failures: [{ quote: passage, reason: 'no-change' as const }] }
  }

  const reason = clampReason(placed.edits.map((edit) => edit.reason).join(' '))
  const edit: AnchoredEdit = { ...target, quote: passage, replacement, reason }

  return { edits: [edit], failures: placed.failures }
}

function placeEdits(request: SuggestRequest, output: ModelOutput) {
  if (request.mode === 'refine') return placeRefinement(request, output)

  if (request.mode === 'document') {
    return anchorEdits(request.document, output.edits as RawEdit[], undefined, MAX_REVIEW_EDITS)
  }

  return anchorEdits(request.document, output.edits as RawEdit[], request.selection)
}

/** Reviews return a handful of short edits. Selections are quoted and rewritten, so the answer
 * grows with them; the fixed part covers reasoning and JSON overhead. */
function tokenBudget(request: SuggestRequest): number {
  const range = editableRange(request)

  if (!range) return 4000

  return Math.min(16_000, 2000 + Math.ceil((range.to - range.from) / 2))
}

/**
 * Asks the model for edits and places them in the document. Retries once when the answer is not
 * usable: invalid JSON, or edits that all failed to anchor. Partial success is returned as is,
 * with the number of dropped edits, because a good edit should not wait for a bad one.
 */
export async function suggest(request: SuggestRequest, deps: SuggestDeps): Promise<SuggestOutcome> {
  const range = editableRange(request)

  if (range) assertRangeInside(range, request.document)

  const messages: ChatMessage[] = buildMessages(request)
  const stats: SuggestStats = {
    attempts: 0,
    proposed: 0,
    failures: [],
    costUsd: 0,
    promptTokens: 0,
    completionTokens: 0,
  }

  let lastCompletion: Completion | null = null

  while (stats.attempts < MAX_ATTEMPTS) {
    stats.attempts++

    const completion = await complete({ ...deps, messages, maxTokens: tokenBudget(request) })

    lastCompletion = completion
    stats.costUsd += completion.costUsd
    stats.promptTokens += completion.promptTokens
    stats.completionTokens += completion.completionTokens

    // A cut-off answer would be cut off again on retry; say what to do instead of paying twice.
    if (completion.finishReason === 'length') {
      throw new ApiError('model-output', 'That was too much text for one answer. Try a shorter selection.')
    }

    const output = parseModelOutput(completion.content)

    if (!output) {
      messages.push({ role: 'assistant', content: completion.content })
      messages.push({ role: 'user', content: INVALID_JSON_RETRY_PROMPT })
      continue
    }

    const { edits, failures } = placeEdits(request, output)

    stats.proposed = output.edits.length
    stats.failures = failures

    const everyEditMissed = output.edits.length > 0 && edits.length === 0
    const canRetry = stats.attempts < MAX_ATTEMPTS
    const missedQuotes = failures
      .filter((failure) => failure.reason === 'not-found' || failure.reason === 'ambiguous')
      .map((failure) => failure.quote)

    if (everyEditMissed && canRetry && missedQuotes.length > 0) {
      messages.push({ role: 'assistant', content: completion.content })
      messages.push({ role: 'user', content: anchorRetryPrompt(missedQuotes) })
      continue
    }

    return {
      response: {
        edits,
        note: output.note.trim(),
        skipped: failures.filter((failure) => failure.reason !== 'no-change').length,
        model: completion.model,
      },
      stats,
    }
  }

  throw new ApiError(
    'model-output',
    lastCompletion
      ? 'The model answered in a shape we could not use. Try again.'
      : 'The model did not answer. Try again.',
  )
}
