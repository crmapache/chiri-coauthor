import type { ApiErrorBody, ApiErrorCode } from '../shared/contract.js'

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  'invalid-request': 400,
  'budget-exhausted': 402,
  'rate-limited': 429,
  timeout: 504,
  'model-output': 502,
  upstream: 502,
  misconfigured: 500,
}

/**
 * A failure we expect and can explain to the writer. Its message is shown in the UI as is,
 * so it is written for a person, not for a log.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }

  get status(): number {
    return STATUS_BY_CODE[this.code]
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } }
  }
}
