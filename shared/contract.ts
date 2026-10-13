import { z } from 'zod'

/**
 * The wire contract between the browser and `/api/suggest`.
 * Both sides import these schemas, so a shape change breaks the type check on both ends at once.
 */

/** Roughly ten thousand tokens: enough for a long memo, small enough to keep requests fast. */
export const MAX_DOCUMENT_LENGTH = 40_000
export const MAX_INSTRUCTION_LENGTH = 500

/** Refinements are a conversation about one edit; after this many the writer should start over. */
export const MAX_REFINE_TURNS = 8

const documentText = z.string().max(MAX_DOCUMENT_LENGTH)
const instruction = z.string().trim().min(1).max(MAX_INSTRUCTION_LENGTH)

const range = z
  .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
  .refine(({ from, to }) => from < to, 'Range must not be empty')

/** One step in the life of an edit: what was asked and what the model answered. */
export const turnSchema = z.object({
  instruction,
  replacement: z.string().max(MAX_DOCUMENT_LENGTH),
  reason: z.string().max(400),
})

export const suggestRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('selection'),
    document: documentText,
    selection: range,
    instruction,
  }),
  z.object({
    mode: z.literal('document'),
    document: documentText,
    instruction: instruction.optional(),
  }),
  z.object({
    mode: z.literal('refine'),
    document: documentText,
    target: range,
    turns: z.array(turnSchema).min(1).max(MAX_REFINE_TURNS),
    feedback: instruction,
  }),
])

export type SuggestRequest = z.infer<typeof suggestRequestSchema>
export type SuggestMode = SuggestRequest['mode']
export type Turn = z.infer<typeof turnSchema>
export type TextRange = { from: number; to: number }

/** An edit already located in the document the request was made against. */
export type AnchoredEdit = TextRange & {
  quote: string
  replacement: string
  reason: string
}

export type SuggestResponse = {
  edits: AnchoredEdit[]
  /** One-line summary from the model, shown to the writer when there is something to say. */
  note: string
  /** Edits the model proposed that we could not place in the text and therefore dropped. */
  skipped: number
  model: string
}

export const API_ERROR_CODES = [
  'invalid-request',
  'budget-exhausted',
  'rate-limited',
  'timeout',
  'model-output',
  'upstream',
  'misconfigured',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export type ApiErrorBody = {
  error: { code: ApiErrorCode; message: string }
}
