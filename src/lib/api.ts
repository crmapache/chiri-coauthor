import type {
  ApiErrorBody,
  ApiErrorCode,
  SuggestRequest,
  SuggestResponse,
} from '../../shared/contract'

export type ClientErrorCode = ApiErrorCode | 'network' | 'aborted'

/** A failed request, with a message that can be shown to the writer as is. */
export class SuggestError extends Error {
  readonly code: ClientErrorCode

  constructor(code: ClientErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SuggestError'
    this.code = code
  }
}

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  return typeof body === 'object' && body !== null && 'error' in body
}

export async function requestSuggestions(
  request: SuggestRequest,
  signal: AbortSignal,
): Promise<SuggestResponse> {
  let response: Response

  try {
    response = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw new SuggestError('aborted', 'Cancelled.')

    throw new SuggestError('network', 'Could not reach the server. Check your connection.', {
      cause: error,
    })
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (isApiErrorBody(body)) throw new SuggestError(body.error.code, body.error.message)

    throw new SuggestError('upstream', `The server answered with ${response.status}.`)
  }

  return body as SuggestResponse
}
