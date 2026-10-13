import type { SuggestionTurn } from '../../../types/suggestion'

/**
 * Only the fields a card shows. Positions are left out on purpose: they change on every keystroke
 * above the suggestion, and the card does not depend on them.
 */
export type SuggestionCardProps = {
  id: string
  label: string
  turns: SuggestionTurn[]
  shownTurn: number
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