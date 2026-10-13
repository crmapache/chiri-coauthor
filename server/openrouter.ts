import { ApiError } from './errors.js'
import type { ModelProfile } from './models.js'
import { MODEL_OUTPUT_JSON_SCHEMA, type ChatMessage } from './prompts.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

/** Long enough for a full review of a long document, short enough that a hung request ends. */
const TIMEOUT_MS = 60_000

export type Completion = {
  content: string
  model: string
  promptTokens: number
  completionTokens: number
  /** Dollars, as reported by OpenRouter. Used by the bake-off to compare models. */
  costUsd: number
}

type CompletionBody = {
  model?: string
  choices?: { message?: { content?: string | null } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  error?: { code?: number | string; message?: string }
}

export type CompleteOptions = {
  apiKey: string
  model: ModelProfile
  messages: ChatMessage[]
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

function errorForStatus(status: number, detail: string): ApiError {
  if (status === 402) {
    return new ApiError('budget-exhausted', 'The AI budget for this demo is used up.')
  }

  if (status === 429) {
    return new ApiError('rate-limited', 'The model is busy right now. Try again in a moment.')
  }

  if (status === 401 || status === 403) {
    return new ApiError('misconfigured', 'The server has no valid OpenRouter key.')
  }

  if (status === 408 || status === 504) {
    return new ApiError('timeout', 'The model took too long to answer. Try again.')
  }

  return new ApiError('upstream', `The model provider failed (${status}). ${detail}`.trim())
}

/**
 * One chat completion with structured JSON output. `require_parameters` makes OpenRouter route
 * only to providers that honour the schema, instead of silently dropping it. No temperature:
 * the current Anthropic and OpenAI models reject it, and the defaults edit well.
 */
export async function complete({
  apiKey,
  model,
  messages,
  signal,
  fetchImpl = fetch,
}: CompleteOptions): Promise<Completion> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response

  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: combined,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Co-author',
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        max_tokens: 4000,
        ...(model.reasoning ? { reasoning: model.reasoning } : {}),
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'edits', strict: true, schema: MODEL_OUTPUT_JSON_SCHEMA },
        },
        provider: { require_parameters: true },
        usage: { include: true },
      }),
    })
  } catch (error) {
    if (timeout.aborted) throw errorForStatus(504, '')

    throw error
  }

  const body = (await response.json().catch(() => ({}))) as CompletionBody

  if (!response.ok || body.error) {
    const status = response.ok ? Number(body.error?.code) || 502 : response.status

    throw errorForStatus(status, body.error?.message ?? '')
  }

  const content = body.choices?.[0]?.message?.content

  if (!content) {
    throw new ApiError('model-output', 'The model returned an empty answer. Try again.')
  }

  return {
    content,
    model: body.model ?? model.id,
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
    costUsd: body.usage?.cost ?? 0,
  }
}
