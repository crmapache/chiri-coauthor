import type { Suggestion } from '../../../types/suggestion'

export type SuggestionCardProps = {
  suggestion: Suggestion
  active: boolean
  /** A refinement of this very card is in flight. */
  busy: boolean
  cardRef: (element: HTMLDivElement | null) => void
  onActivate: (id: string) => void
  onHover: (id: string | null) => void
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onRefine: (id: string, feedback: string) => void
  onShowTurn: (id: string, index: number) => void
}