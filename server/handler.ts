import { suggestRequestSchema } from '../shared/contract.js'
import { ApiError } from './errors.js'
import { resolveModel } from './models.js'
import { suggest } from './suggest.js'

export type ServerEnv = {
  OPENROUTER_API_KEY?: string
  OPENROUTER_MODEL?: string
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/**
 * `POST /api/suggest`. Web-standard Request in, Response out, so the same function runs as a
 * Vercel function in production and as Vite middleware in development.
 */
export async function handleSuggest(
  request: Request,
  env: ServerEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(new ApiError('invalid-request', 'Use POST.').toBody(), 405)
  }

  try {
    const payload: unknown = await request.json().catch(() => {
      throw new ApiError('invalid-request', 'The request body is not valid JSON.')
    })

    const parsed = suggestRequestSchema.safeParse(payload)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const where = issue?.path.join('.') || 'body'

      throw new ApiError('invalid-request', `Invalid ${where}: ${issue?.message ?? 'bad shape'}.`)
    }

    if (!env.OPENROUTER_API_KEY) {
      throw new ApiError('misconfigured', 'The server has no OpenRouter key configured.')
    }

    const { response } = await suggest(parsed.data, {
      apiKey: env.OPENROUTER_API_KEY,
      model: resolveModel(env.OPENROUTER_MODEL),
      signal: request.signal,
      fetchImpl,
    })

    return json(response, 200)
  } catch (error) {
    if (error instanceof ApiError) return json(error.toBody(), error.status)

    // The writer cancelled or started a new request; nobody is waiting for this answer.
    if (isAbort(error)) return new Response(null, { status: 499 })

    console.error('[suggest] unexpected failure', error)

    return json(new ApiError('upstream', 'Something went wrong on our side.').toBody(), 500)
  }
}
