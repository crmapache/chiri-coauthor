import type { EditorView } from '@codemirror/view'

import type { Suggestion } from '../../../types/suggestion'

export type SuggestionMarginProps = {
  view: EditorView | null
  suggestions: Suggestion[]
  activeId: string | null
  /** Changes whenever the text may have moved, so cards are re-aligned. */
  layoutVersion: number
  busyId: string | null
  onActivate: (id: string) => void
  onHover: (id: string | null) => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onRefine: (id: string, feedback: string) => void
  onShowTurn: (id: string, index: number) => void
}
