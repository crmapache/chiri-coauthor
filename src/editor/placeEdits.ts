import type { EditorState } from '@codemirror/state'

import type { AnchoredEdit } from '../../shared/contract'
import { plural } from '../lib/text'
import type { Suggestion } from '../types/suggestion'
import { mapFromRequest, type PendingRequest } from './pendingState'

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
  origin: { label: string; instruction: string; offset: number },
  createId: () => string = () => crypto.randomUUID(),
): PlacedEdits {
  const suggestions: Suggestion[] = []

  let stale = 0

  for (const edit of edits) {
    // Positions come back relative to the part of the document that was sent.
    const sent = { from: edit.from + origin.offset, to: edit.to + origin.offset }
    const range = mapFromRequest(state, pending, sent, edit.quote)

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
