import { describe, expect, it } from 'vitest'

import { plural, shorten } from './text'

describe('shorten', () => {
  it('cuts long text with an ellipsis and keeps emoji whole', () => {
    expect(shorten('Add more fun, please!!🎉 and make it lively', 24)).toBe('Add more fun, please!!🎉…')
    expect(shorten('short', 24)).toBe('short')
  })
})

describe('plural', () => {
  it('adds an s except for one', () => {
    expect(plural(1, 'suggestion')).toBe('1 suggestion')
    expect(plural(3, 'suggestion')).toBe('3 suggestions')
  })
})