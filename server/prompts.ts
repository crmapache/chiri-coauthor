import type { SuggestRequest, Turn } from '../shared/contract.js'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** A review that returns twenty nitpicks is noise. A handful of strong edits reads like an editor. */
export const MAX_REVIEW_EDITS = 6

export const DEFAULT_REVIEW_FOCUS =
  'errors, unclear or bloated sentences, weak openings, and inconsistent terms'

export const SYSTEM_PROMPT = `You are Co-author, an editor working inside a Markdown document alongside its writer.
You propose precise edits that the writer accepts or rejects one at a time. You never rewrite the whole document, and you never reply with anything but the JSON object.

How to write an edit:
- "quote" is the exact text you want to change, copied character for character from the document, Markdown syntax included. Keep it short but unique in the document: usually one sentence, sometimes a phrase.
- "replacement" is the new text for exactly that span. Keep the surrounding Markdown intact: list markers, heading hashes, emphasis, links, line breaks.
- "reason" tells the writer why, in at most 12 words, plain and specific. Good: "Passive voice hides who shipped it." Bad: "Improved clarity."
- To add text, quote the sentence next to where it belongs and return that sentence with the addition.
- To delete text, return an empty replacement.
- Edits must not overlap. Skip edits that change nothing or only swap a word for a synonym.
- Prefer several sentence-sized edits over one large edit, so each can be judged on its own. Use one large edit only when sentences have to be merged or reordered.

What to protect:
- The writer's voice, language and point of view. A Spanish document gets Spanish edits.
- Facts. Never invent numbers, names, dates, quotes or links. If a sentence needs a fact you do not have, leave it alone and mention it in the note.

"note" is one short sentence for the writer: what you changed overall, or why you changed nothing. It may be empty.`

/** JSON Schema for OpenRouter structured outputs. Mirrors `modelOutputSchema` in `suggest.ts`. */
export const MODEL_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['edits', 'note'],
  properties: {
    edits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quote', 'replacement', 'reason'],
        properties: {
          quote: { type: 'string' },
          replacement: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    note: { type: 'string' },
  },
} as const

function documentBlock(document: string): string {
  return `<document>\n${document}\n</document>`
}

function describeTurns(turns: Turn[]): string {
  return turns
    .map(
      (turn, index) =>
        `${index + 1}. Asked: ${JSON.stringify(turn.instruction)}\n   You proposed: ${JSON.stringify(turn.replacement)}\n   Your reason: ${JSON.stringify(turn.reason)}`,
    )
    .join('\n')
}

function userPrompt(request: SuggestRequest): string {
  switch (request.mode) {
    case 'selection': {
      const passage = request.document.slice(request.selection.from, request.selection.to)

      return [
        `Instruction: ${request.instruction}`,
        'Edit only text inside <passage>. The <document> around it is context: use it for tone, terminology and facts, but never quote text from outside the passage.',
        documentBlock(request.document),
        `<passage>\n${passage}\n</passage>`,
      ].join('\n\n')
    }

    case 'document': {
      const focus = request.instruction
        ? `Follow this instruction from the writer: ${request.instruction}`
        : `Focus on ${DEFAULT_REVIEW_FOCUS}.`

      return [
        `Review the whole document like a sharp, kind editor and propose at most ${MAX_REVIEW_EDITS} edits, the most valuable ones first.`,
        `${focus} Leave anything that already works alone: fewer, better edits beat many small ones.`,
        documentBlock(request.document),
      ].join('\n\n')
    }

    case 'refine': {
      const passage = request.document.slice(request.target.from, request.target.to)

      return [
        'You proposed an edit for the passage below and the writer wants it changed.',
        documentBlock(request.document),
        `<passage>\n${passage}\n</passage>`,
        `History of this edit, oldest first:\n${describeTurns(request.turns)}`,
        `The writer's feedback on your latest version: ${request.feedback}`,
        'Return exactly one edit. Its quote is the whole passage, unchanged. Its replacement is your new version of the passage: start from your latest version and apply the feedback. Its reason explains the new version.',
      ].join('\n\n')
    }
  }
}

export function buildMessages(request: SuggestRequest): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt(request) },
  ]
}

/** Sent when every quote missed: tell the model exactly which ones, so the second try can fix them. */
export function anchorRetryPrompt(failedQuotes: string[]): string {
  const list = failedQuotes.map((quote) => `- ${JSON.stringify(quote)}`).join('\n')

  return `None of these quotes appear in the text exactly once, so the edits could not be placed:\n${list}\n\nReturn the edits again, copying each quote character for character from the text you were allowed to edit.`
}

export const INVALID_JSON_RETRY_PROMPT =
  'That reply was not a valid JSON object with "edits" and "note". Reply again with only that JSON object.'
