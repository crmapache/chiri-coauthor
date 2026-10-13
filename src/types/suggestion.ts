/** One version of an edit: the instruction that produced it and what the model answered. */
export type SuggestionTurn = {
  instruction: string
  replacement: string
  reason: string
}

/**
 * A proposed edit living in the document as a tracked change. It is never applied until the
 * writer accepts it; until then `from`/`to` point at the untouched `original` text.
 */
export type Suggestion = {
  id: string
  from: number
  to: number
  original: string
  /** Every version of this edit, oldest first. Refining appends; never empty. */
  turns: SuggestionTurn[]
  /** Which version is shown and would be accepted. Usually the last one. */
  shownTurn: number
  /** The action that produced it, shown on the card: "Shorten", "Review", "Ask: …". */
  label: string
}

export function shownTurnOf(suggestion: Suggestion): SuggestionTurn {
  return suggestion.turns[suggestion.shownTurn] ?? (suggestion.turns.at(-1) as SuggestionTurn)
}
