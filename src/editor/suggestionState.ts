import { invertedEffects } from '@codemirror/commands'
import {
  EditorSelection,
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Text,
  type Transaction,
} from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import { shownTurnOf, type Suggestion, type SuggestionTurn } from '../types/suggestion'

export type SuggestionsState = {
  items: Suggestion[]
  /** The suggestion the writer is working with: cursor inside it, or its card clicked. */
  activeId: string | null
  /** The suggestion whose card is under the mouse; highlighted in the text, nothing more. */
  hoveredId: string | null
}

const EMPTY: SuggestionsState = { items: [], activeId: null, hoveredId: null }

/**
 * Moves a suggestion through a document change. Text typed right at its edges stays outside it.
 * An unmoved suggestion keeps its identity, so its card does not re-render on every keystroke.
 */
function mapRange(suggestion: Suggestion, mapping: ChangeDesc): Suggestion {
  const from = mapping.mapPos(suggestion.from, 1)
  const to = Math.max(from, mapping.mapPos(suggestion.to, -1))

  return from === suggestion.from && to === suggestion.to ? suggestion : { ...suggestion, from, to }
}

/**
 * A suggestion only makes sense while the text it was written for is still there. Checking the
 * text itself, instead of reasoning about which change touched which range, also covers paste,
 * undo and anything else that rewrites the span.
 */
function stillMatches(suggestion: Suggestion, doc: Text): boolean {
  return (
    suggestion.to <= doc.length &&
    doc.sliceString(suggestion.from, suggestion.to) === suggestion.original
  )
}

function overlaps(left: Suggestion, right: Suggestion): boolean {
  return left.from < right.to && left.to > right.from
}

function mapSuggestions(list: Suggestion[], mapping: ChangeDesc): Suggestion[] {
  return list.map((suggestion) => mapRange(suggestion, mapping))
}

/** New edits from the AI. They replace older suggestions they overlap: the latest ask wins. */
export const addSuggestions = StateEffect.define<Suggestion[]>({ map: mapSuggestions })

/** Rejection, acceptance or redo. Recorded in history, so undo brings the suggestions back. */
export const removeSuggestions = StateEffect.define<string[]>()

/** Undo of a removal. Positions are in the document the undo restores. */
export const restoreSuggestions = StateEffect.define<Suggestion[]>({ map: mapSuggestions })

/** A refinement: append a new version and show it. */
export const addTurn = StateEffect.define<{ id: string; turn: SuggestionTurn }>()

/** Flip between versions on the card. */
export const showTurn = StateEffect.define<{ id: string; index: number }>()

export const setActiveSuggestion = StateEffect.define<string | null>()
export const setHoveredSuggestion = StateEffect.define<string | null>()

function contains(item: Suggestion, position: number): boolean {
  return position >= item.from && position <= item.to
}

function suggestionAt(items: Suggestion[], position: number): Suggestion | undefined {
  return items.find((item) => contains(item, position))
}

function withNewItems(state: SuggestionsState, items: Suggestion[]): SuggestionsState {
  const ids = new Set(items.map((item) => item.id))

  return {
    items,
    activeId: state.activeId && ids.has(state.activeId) ? state.activeId : null,
    hoveredId: state.hoveredId && ids.has(state.hoveredId) ? state.hoveredId : null,
  }
}

function applyEffect(
  state: SuggestionsState,
  effect: StateEffect<unknown>,
  doc: Text,
): SuggestionsState {
  if (effect.is(addSuggestions)) {
    const incoming = effect.value.filter((item) => stillMatches(item, doc))
    const kept = state.items.filter((item) => !incoming.some((next) => overlaps(item, next)))

    return withNewItems(
      state,
      [...kept, ...incoming].sort((left, right) => left.from - right.from),
    )
  }

  if (effect.is(restoreSuggestions)) {
    const restorable = effect.value.filter(
      (item) =>
        stillMatches(item, doc) &&
        !state.items.some((existing) => existing.id === item.id || overlaps(existing, item)),
    )

    return withNewItems(
      state,
      [...state.items, ...restorable].sort((left, right) => left.from - right.from),
    )
  }

  if (effect.is(removeSuggestions)) {
    return withNewItems(
      state,
      state.items.filter((item) => !effect.value.includes(item.id)),
    )
  }

  if (effect.is(addTurn)) {
    const items = state.items.map((item) =>
      item.id === effect.value.id
        ? {
            ...item,
            turns: [...item.turns.slice(0, item.shownTurn + 1), effect.value.turn],
            shownTurn: item.shownTurn + 1,
          }
        : item,
    )

    return { ...state, items }
  }

  if (effect.is(showTurn)) {
    const items = state.items.map((item) =>
      item.id === effect.value.id
        ? { ...item, shownTurn: Math.min(Math.max(effect.value.index, 0), item.turns.length - 1) }
        : item,
    )

    return { ...state, items }
  }

  if (effect.is(setActiveSuggestion)) return { ...state, activeId: effect.value }

  if (effect.is(setHoveredSuggestion)) return { ...state, hoveredId: effect.value }

  return state
}

export const suggestionsField = StateField.define<SuggestionsState>({
  create: () => EMPTY,

  update(value, tr) {
    let state = value

    if (tr.docChanged) {
      const items = mapSuggestions(state.items, tr.changes).filter((item) =>
        stillMatches(item, tr.newDoc),
      )

      state = withNewItems(state, items)
    }

    for (const effect of tr.effects) state = applyEffect(state, effect, tr.newDoc)

    const choseActive = tr.effects.some((effect) => effect.is(setActiveSuggestion))

    if (tr.selection && !choseActive) {
      const head = tr.selection.main.head
      const current = state.items.find((item) => item.id === state.activeId)

      // Two suggestions can touch end to start; the one chosen on purpose wins at the seam.
      if (!current || !contains(current, head)) {
        state = { ...state, activeId: suggestionAt(state.items, head)?.id ?? null }
      }
    }

    return state
  },
})

/**
 * Teaches undo about suggestions. Undoing an accept, a reject, or typing that wiped out a
 * suggestion puts the suggestion back; redo removes it again. Positions are expressed in the
 * document as it was before the transaction, which is the document the undo returns to.
 */
const suggestionHistory = invertedEffects.of((tr: Transaction) => {
  const before = tr.startState.field(suggestionsField, false)

  if (!before) return []

  const inverted: StateEffect<unknown>[] = []
  const removedIds = new Set<string>()

  for (const effect of tr.effects) {
    if (effect.is(removeSuggestions)) {
      const removed = before.items.filter((item) => effect.value.includes(item.id))

      removed.forEach((item) => removedIds.add(item.id))

      if (removed.length > 0) inverted.push(restoreSuggestions.of(removed))
    }

    if (effect.is(restoreSuggestions)) {
      inverted.push(removeSuggestions.of(effect.value.map((item) => item.id)))
    }
  }

  if (tr.docChanged) {
    const wipedOut = before.items.filter(
      (item) => !removedIds.has(item.id) && !stillMatches(mapRange(item, tr.changes), tr.newDoc),
    )

    if (wipedOut.length > 0) inverted.push(restoreSuggestions.of(wipedOut))
  }

  return inverted
})

export const suggestionExtensions = [suggestionsField, suggestionHistory]

export function getSuggestions(state: EditorState): SuggestionsState {
  return state.field(suggestionsField, false) ?? EMPTY
}

export function findSuggestion(state: EditorState, id: string): Suggestion | undefined {
  return getSuggestions(state).items.find((item) => item.id === id)
}

/** The suggestion the cursor is in, if any: the one the writer is working with. */
export function suggestionAtCursor(state: EditorState): Suggestion | undefined {
  return suggestionAt(getSuggestions(state).items, state.selection.main.head)
}

/** Scroll margin that keeps a revealed suggestion clear of the sticky top bar. */
const REVEAL_MARGIN = 120

/** Effects that make a suggestion active and bring it into view. */
export function revealEffects(item: Suggestion): StateEffect<unknown>[] {
  return [
    setActiveSuggestion.of(item.id),
    EditorView.scrollIntoView(item.from, { y: 'nearest', yMargin: REVEAL_MARGIN }),
  ]
}

/** After acting on one suggestion, put the cursor on the next one so Tab can keep going. */
function nextAfter(items: Suggestion[], handled: Suggestion[]): Suggestion | undefined {
  const lastHandled = Math.max(...handled.map((item) => item.from))
  const remaining = items.filter((item) => !handled.some((done) => done.id === item.id))

  return remaining.find((item) => item.from > lastHandled) ?? remaining[0]
}

function cursorOnNext(state: EditorState, handled: Suggestion[], insertedDelta: number) {
  const next = nextAfter(getSuggestions(state).items, handled)

  if (!next) return {}

  // `next.from` is in the old document; it moves by the length change of edits before it.
  const shift = next.from > Math.max(...handled.map((item) => item.from)) ? insertedDelta : 0

  return {
    selection: EditorSelection.cursor(next.from + shift),
    effects: [setActiveSuggestion.of(next.id)],
  }
}

/**
 * Applies suggestions to the text in one transaction, so one undo reverts them all and brings the
 * suggestions back.
 */
export function acceptSuggestions(
  view: EditorView,
  ids: string[],
  options = { advance: false },
): boolean {
  const items = getSuggestions(view.state).items.filter((item) => ids.includes(item.id))

  if (items.length === 0) return false

  const changes = items.map((item) => ({
    from: item.from,
    to: item.to,
    insert: shownTurnOf(item).replacement,
  }))
  const delta = changes.reduce(
    (total, change) => total + change.insert.length - (change.to - change.from),
    0,
  )
  const advance = options.advance ? cursorOnNext(view.state, items, delta) : {}

  view.dispatch({
    changes,
    selection: advance.selection,
    effects: [removeSuggestions.of(ids), ...(advance.effects ?? [])],
    userEvent: 'input.suggestion.accept',
    scrollIntoView: Boolean(advance.selection),
  })

  return true
}

export function rejectSuggestions(
  view: EditorView,
  ids: string[],
  options = { advance: false },
): boolean {
  const items = getSuggestions(view.state).items.filter((item) => ids.includes(item.id))

  if (items.length === 0) return false

  const advance = options.advance ? cursorOnNext(view.state, items, 0) : {}

  view.dispatch({
    selection: advance.selection,
    effects: [removeSuggestions.of(ids), ...(advance.effects ?? [])],
    userEvent: 'suggestion.reject',
    scrollIntoView: Boolean(advance.selection),
  })

  return true
}
