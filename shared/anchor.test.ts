import { describe, expect, it } from 'vitest'

import { anchorEdits, locateQuote } from './anchor'
import { MAX_REASON_LENGTH } from './contract'

const DOC = `# Launch notes

We’re  shipping offline mode on Monday.
Offline mode lets field teams keep working.

- Sync runs every 5 minutes.`

describe('locateQuote', () => {
  it('finds an exact quote', () => {
    const result = locateQuote(DOC, 'field teams')

    expect(result).toEqual({ ok: true, from: DOC.indexOf('field teams'), to: DOC.indexOf('field teams') + 11 })
  })

  it('tolerates collapsed whitespace and straight quotes, mapping back to the real text', () => {
    const result = locateQuote(DOC, "We're shipping offline")

    expect(result.ok).toBe(true)

    if (result.ok) expect(DOC.slice(result.from, result.to)).toBe('We’re  shipping offline')
  })

  it('rejects a quote that appears more than once', () => {
    expect(locateQuote(DOC, 'ffline mode')).toEqual({ ok: false, reason: 'ambiguous' })
  })

  it('treats a quote as unique when only one occurrence is inside the allowed range', () => {
    const start = DOC.indexOf('Offline mode lets')
    const result = locateQuote(DOC, 'ffline mode', { from: start, to: start + 30 })

    expect(result).toEqual({ ok: true, from: start + 1, to: start + 12 })
  })

  it('rejects quotes outside the allowed range and empty quotes', () => {
    expect(locateQuote(DOC, 'Launch', { from: 20, to: 40 })).toEqual({ ok: false, reason: 'not-found' })
    expect(locateQuote(DOC, '   ')).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('anchorEdits', () => {
  it('places edits, sorts them, and reports the ones it could not place', () => {
    const { edits, failures } = anchorEdits(DOC, [
      { quote: 'every 5 minutes', replacement: 'every five minutes', reason: 'Spell out small numbers.' },
      { quote: 'Launch notes', replacement: 'Release notes', reason: 'Matches the product term.' },
      { quote: 'not in the text', replacement: 'x', reason: 'r' },
      { quote: 'field teams', replacement: 'field teams', reason: 'no-op' },
    ])

    expect(edits.map((edit) => edit.quote)).toEqual(['Launch notes', 'every 5 minutes'])
    expect(failures.map((failure) => failure.reason)).toEqual(['not-found', 'no-change'])
  })

  it('drops an edit that overlaps an earlier one', () => {
    const { edits, failures } = anchorEdits(DOC, [
      { quote: 'keep working', replacement: 'stay productive', reason: 'r' },
      { quote: 'teams keep', replacement: 'crews keep', reason: 'r' },
    ])

    expect(edits).toHaveLength(1)
    expect(failures).toEqual([{ quote: 'teams keep', reason: 'overlap' }])
  })

  it('trims edge whitespace from the replacement when the quote only matched trimmed', () => {
    const { edits } = anchorEdits(DOC, [
      { quote: 'field  teams\n', replacement: 'field crews\n', reason: 'r' },
    ])

    expect(edits[0]).toMatchObject({ quote: 'field teams', replacement: 'field crews' })
  })

  it('keeps the line breaks of the real text when the quote only matched loosely', () => {
    const { edits } = anchorEdits('- one\n- two\n', [{ quote: '- one - two', replacement: '- One - two', reason: 'r' }])

    expect(edits[0]).toMatchObject({ quote: '- one\n- two', replacement: '- One\n- two' })
  })

  it('cuts an over-long reason so it can be sent back when refining', () => {
    const { edits } = anchorEdits(DOC, [{ quote: 'field teams', replacement: 'field crews', reason: 'x'.repeat(1000) }])

    expect(edits[0]?.reason.length).toBeLessThanOrEqual(MAX_REASON_LENGTH)
  })

  it('applies a limit in the order the model ranked its edits, not in text order', () => {
    const { edits } = anchorEdits(
      DOC,
      [
        { quote: 'every 5 minutes', replacement: 'every five minutes', reason: 'most valuable' },
        { quote: 'Launch notes', replacement: 'Release notes', reason: 'less valuable' },
      ],
      undefined,
      1,
    )

    expect(edits.map((edit) => edit.reason)).toEqual(['most valuable'])
  })
})
