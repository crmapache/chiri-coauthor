import type { EditorState } from '@codemirror/state'

import type { AnchoredEdit } from '../../shared/contract'
import { mapFromRequest, type PendingRequest } from '../editor/pendingState'
import type { Suggestion } from '../types/suggestion'

export type PlacedEdits = { suggestions: Suggestion[]; stale: number }

/**
 * Turns edits from the server (positioned in the text as it was when the request left) into
 * suggestions positioned in the text as it is now. Edits whose text the writer changed meanwhile
 * are counted, not shown.
 */
export function placeEdits(
  state: EditorState,
  pending: PendingRequest,
  edits: AnchoredEdit[],
  origin: { label: string; instruction: string },
  createId: () => string = () => crypto.randomUUID(),
): PlacedEdits {
  const suggestions: Suggestion[] = []

  let stale = 0

  for (const edit of edits) {
    const range = mapFromRequest(state, pending, edit, edit.quote)

    if (!range) {
      stale++
      continue
    }

    suggestions.push({
      id: createId(),
      ...range,
      original: edit.quote,
      turns: [{ instruction: origin.instruction, replacement: edit.replacement, reason: edit.reason }],
      shownTurn: 0,
      label: origin.label,
    })
  }

  return { suggestions, stale }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** The one line the writer sees after a request: the model's note plus what we had to drop. */
export function describeOutcome(input: { shown: number; note: string; dropped: number }): string | null {
  const parts: string[] = []

  if (input.note) parts.push(input.note)
  else if (input.shown === 0) parts.push('No changes suggested.')

  if (input.dropped > 0) {
    parts.push(`${plural(input.dropped, 'suggestion')} skipped because the text changed or could not be matched.`)
  }

  return parts.length > 0 ? parts.join(' ') : null
}

export function shorten(text: string, limit = 32): string {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat
}
