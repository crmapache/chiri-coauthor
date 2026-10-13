import { describe, expect, it } from 'vitest'

import { documentWindow, expandToWords, isBlank } from './requestText'

describe('documentWindow', () => {
  it('sends a short document whole', () => {
    expect(documentWindow('short text', { from: 0, to: 5 })).toEqual({ text: 'short text', offset: 0 })
  })

  it('sends a window around the passage of a long document, starting on a line', () => {
    const lines = Array.from({ length: 200 }, (_, index) => `Line ${index} ${'x'.repeat(40)}`)
    const document = lines.join('\n')
    const from = document.indexOf('Line 120 ')
    const range = { from, to: from + 10 }

    const window = documentWindow(document, range, 2000)

    expect(window.text.length).toBeLessThanOrEqual(2000)
    expect(window.text.slice(range.from - window.offset, range.to - window.offset)).toBe(document.slice(range.from, range.to))
    expect(window.offset === 0 || document[window.offset - 1] === '\n').toBe(true)
  })
})

describe('expandToWords', () => {
  it('grows a selection that clips words to whole words', () => {
    const document = 'The quick brown fox jumps.'

    expect(expandToWords(document, { from: 6, to: 17 })).toEqual({ from: 4, to: 19 })
  })

  it('leaves a selection on word boundaries alone', () => {
    expect(expandToWords('one two three', { from: 4, to: 7 })).toEqual({ from: 4, to: 7 })
  })
})

describe('isBlank', () => {
  it('treats spaces and line breaks as nothing', () => {
    expect(isBlank(' \n\t ')).toBe(true)
    expect(isBlank(' a ')).toBe(false)
  })
})