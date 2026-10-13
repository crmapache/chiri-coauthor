import { ChangeSet, StateEffect, StateField, type EditorState } from '@codemirror/state'

import type { TextRange } from '../../shared/contract'

/**
 * The request in flight. The writer keeps typing while the model thinks, so we record every change
 * made since the request started: the edits come back with positions in the old text, and this
 * change set carries them into the current one.
 */
export type PendingRequest = {
  id: string
  /** Everything typed since the request was sent, as one change set. */
  changes: ChangeSet
  /** The text the request is about, shimmering while we wait. Null for whole-document requests. */
  highlight: TextRange | null
}

export const startPending = StateEffect.define<{ id: string; highlight: TextRange | null }>()
export const endPending = StateEffect.define<string>()

export const pendingField = StateField.define<PendingRequest | null>({
  create: () => null,

  update(value, tr) {
    let pending = value

    if (pending && tr.docChanged) {
      const highlight = pending.highlight
        ? {
            from: tr.changes.mapPos(pending.highlight.from, 1),
            to: tr.changes.mapPos(pending.highlight.to, -1),
          }
        : null

      pending = {
        ...pending,
        changes: pending.changes.compose(tr.changes),
        highlight: highlight && highlight.from < highlight.to ? highlight : null,
      }
    }

    for (const effect of tr.effects) {
      if (effect.is(startPending)) {
        pending = {
          id: effect.value.id,
          changes: ChangeSet.empty(tr.newDoc.length),
          highlight: effect.value.highlight,
        }
      }

      if (effect.is(endPending) && pending?.id === effect.value) pending = null
    }

    return pending
  },
})

export function getPending(state: EditorState): PendingRequest | null {
  return state.field(pendingField, false) ?? null
}

/**
 * Carries a range from the text the request was made against into the current text. Returns null
 * when the writer has since changed that text, because an edit for words that no longer exist
 * would be wrong to show.
 */
export function mapFromRequest(
  state: EditorState,
  pending: PendingRequest,
  range: TextRange,
  expectedText: string,
): TextRange | null {
  const from = pending.changes.mapPos(range.from, 1)
  const to = pending.changes.mapPos(range.to, -1)

  if (to < from || state.doc.sliceString(from, to) !== expectedText) return null

  return { from, to }
}
