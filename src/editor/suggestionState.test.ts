import { history, redo, undo } from '@codemirror/commands'
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import type { Suggestion } from '../types/suggestion'
import { getPending, mapFromRequest, pendingField, startPending } from './pendingState'
import {
  acceptSuggestions,
  addSuggestions,
  getSuggestions,
  rejectSuggestions,
  suggestionExtensions,
} from './suggestionState'

const DOC = 'The quick brown fox jumps over the lazy dog.'

/** Just enough of EditorView for the commands under test. */
function createHarness(doc = DOC) {
  const harness = {
    state: EditorState.create({ doc, extensions: [history(), suggestionExtensions, pendingField] }),
    dispatch(spec: TransactionSpec) {
      harness.state = harness.state.update(spec).state
    },
    get view() {
      return harness as unknown as EditorView
    },
    undo() {
      undo({ state: harness.state, dispatch: (tr) => (harness.state = tr.state) })
    },
    redo() {
      redo({ state: harness.state, dispatch: (tr) => (harness.state = tr.state) })
    },
    text() {
      return harness.state.doc.toString()
    },
    items() {
      return getSuggestions(harness.state).items
    },
  }

  return harness
}

function suggestion(id: string, original: string, replacement: string, doc = DOC): Suggestion {
  const from = doc.indexOf(original)

  return {
    id,
    from,
    to: from + original.length,
    original,
    turns: [{ instruction: 'test', replacement, reason: 'because' }],
    shownTurn: 0,
    label: 'Test',
  }
}

describe('suggestion state', () => {
  it('moves suggestions along when the writer types before them', () => {
    const harness = createHarness()

    harness.dispatch({ effects: addSuggestions.of([suggestion('a', 'lazy', 'sleepy')]) })
    harness.dispatch({ changes: { from: 0, insert: 'Look: ' } })

    const [item] = harness.items()

    expect(harness.state.doc.sliceString(item!.from, item!.to)).toBe('lazy')
  })

  it('keeps a suggestion when text is typed right at its edge', () => {
    const harness = createHarness()
    const lazy = suggestion('a', 'lazy', 'sleepy')

    harness.dispatch({ effects: addSuggestions.of([lazy]) })
    harness.dispatch({ changes: { from: lazy.to, insert: ' old' } })

    expect(harness.items()).toHaveLength(1)
    expect(harness.text()).toContain('lazy old dog')
  })

  it('drops a suggestion when its text is edited, and undo brings both back', () => {
    const harness = createHarness()
    const quick = suggestion('a', 'quick', 'fast')

    harness.dispatch({ effects: addSuggestions.of([quick]) })
    harness.dispatch({ changes: { from: quick.from + 2, to: quick.from + 3, insert: 'a' } })

    expect(harness.items()).toHaveLength(0)

    harness.undo()

    expect(harness.text()).toBe(DOC)
    expect(harness.items().map((item) => item.id)).toEqual(['a'])
  })

  it('accepts by replacing the text; undo restores the original and the suggestion; redo reapplies', () => {
    const harness = createHarness()

    harness.dispatch({ effects: addSuggestions.of([suggestion('a', 'quick brown', 'swift')]) })
    acceptSuggestions(harness.view, ['a'])

    expect(harness.text()).toBe('The swift fox jumps over the lazy dog.')
    expect(harness.items()).toHaveLength(0)

    harness.undo()

    expect(harness.text()).toBe(DOC)
    expect(harness.items().map((item) => item.id)).toEqual(['a'])

    harness.redo()

    expect(harness.text()).toBe('The swift fox jumps over the lazy dog.')
    expect(harness.items()).toHaveLength(0)
  })

  it('rejects without touching the text, and undo restores the suggestion', () => {
    const harness = createHarness()

    harness.dispatch({ effects: addSuggestions.of([suggestion('a', 'lazy', 'sleepy')]) })
    rejectSuggestions(harness.view, ['a'])

    expect(harness.items()).toHaveLength(0)
    expect(harness.text()).toBe(DOC)

    harness.undo()

    expect(harness.items().map((item) => item.id)).toEqual(['a'])
  })

  it('accepts several at once and undoes them as one step', () => {
    const harness = createHarness()

    harness.dispatch({
      effects: addSuggestions.of([
        suggestion('a', 'quick', 'fast'),
        suggestion('b', 'lazy', 'sleepy'),
      ]),
    })
    acceptSuggestions(harness.view, ['a', 'b'])

    expect(harness.text()).toBe('The fast brown fox jumps over the sleepy dog.')

    harness.undo()

    expect(harness.text()).toBe(DOC)
    expect(harness.items().map((item) => item.id).sort()).toEqual(['a', 'b'])
  })

  it('lets a newer suggestion replace an older one on the same text', () => {
    const harness = createHarness()

    harness.dispatch({ effects: addSuggestions.of([suggestion('old', 'quick brown', 'swift')]) })
    harness.dispatch({ effects: addSuggestions.of([suggestion('new', 'brown fox', 'red fox')]) })

    expect(harness.items().map((item) => item.id)).toEqual(['new'])
  })

  it('moves the cursor to the next suggestion after accepting, so Tab can keep going', () => {
    const harness = createHarness()

    harness.dispatch({
      effects: addSuggestions.of([
        suggestion('a', 'quick', 'very fast'),
        suggestion('b', 'lazy', 'sleepy'),
      ]),
    })
    harness.dispatch({ selection: EditorSelection.cursor(5) })
    acceptSuggestions(harness.view, ['a'], { advance: true })

    const state = getSuggestions(harness.state)
    const next = harness.items()[0]!

    expect(state.activeId).toBe('b')
    expect(harness.state.selection.main.head).toBe(next.from)
    expect(harness.state.doc.sliceString(next.from, next.to)).toBe('lazy')
  })
})

describe('pending request mapping', () => {
  it('carries edit positions from the requested text into the current text', () => {
    const harness = createHarness()
    const lazyAt = DOC.indexOf('lazy')

    harness.dispatch({ effects: startPending.of({ id: 'r1', highlight: null }) })
    harness.dispatch({ changes: { from: 0, insert: 'Note. ' } })

    const pending = getPending(harness.state)!
    const mapped = mapFromRequest(harness.state, pending, { from: lazyAt, to: lazyAt + 4 }, 'lazy')

    expect(mapped).toEqual({ from: lazyAt + 6, to: lazyAt + 10 })
  })

  it('refuses to place an edit whose text was changed while waiting', () => {
    const harness = createHarness()
    const lazyAt = DOC.indexOf('lazy')

    harness.dispatch({ effects: startPending.of({ id: 'r1', highlight: null }) })
    harness.dispatch({ changes: { from: lazyAt, to: lazyAt + 4, insert: 'sleepy' } })

    const pending = getPending(harness.state)!

    expect(mapFromRequest(harness.state, pending, { from: lazyAt, to: lazyAt + 4 }, 'lazy')).toBeNull()
  })
})
