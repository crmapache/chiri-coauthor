import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { getPending, pendingField, startPending } from '../editor/pendingState'
import { describeOutcome, placeEdits } from './placeEdits'

describe('placeEdits', () => {
  it('moves edits into the current text and counts the ones that went stale', () => {
    let state = EditorState.create({ doc: 'one two three', extensions: [pendingField] })

    state = state.update({ effects: startPending.of({ id: 'r', highlight: null }) }).state
    state = state.update({ changes: [{ from: 0, insert: '> ' }, { from: 4, to: 7, insert: '2' }] }).state

    const { suggestions, stale } = placeEdits(
      state,
      getPending(state)!,
      [
        { from: 8, to: 13, quote: 'three', replacement: 'THREE', reason: 'r' },
        { from: 4, to: 7, quote: 'two', replacement: 'TWO', reason: 'r' },
      ],
      { label: 'Test', instruction: 'Shout' },
      () => 'id',
    )

    expect(stale).toBe(1)
    expect(suggestions).toEqual([
      {
        id: 'id',
        from: 8,
        to: 13,
        original: 'three',
        turns: [{ instruction: 'Shout', replacement: 'THREE', reason: 'r' }],
        shownTurn: 0,
        label: 'Test',
      },
    ])
  })
})

describe('describeOutcome', () => {
  it('prefers the model note and mentions dropped edits', () => {
    expect(describeOutcome({ shown: 2, note: 'Tightened it.', dropped: 1 })).toBe(
      'Tightened it. 1 suggestion skipped because the text changed or could not be matched.',
    )
  })

  it('says so when nothing came back and stays quiet when there is nothing to say', () => {
    expect(describeOutcome({ shown: 0, note: '', dropped: 0 })).toBe('No changes suggested.')
    expect(describeOutcome({ shown: 3, note: '', dropped: 0 })).toBeNull()
  })
})
