import { describe, expect, it } from 'vitest'

import { diffForDisplay } from './wordDiff'

function render(original: string, replacement: string): string {
  return diffForDisplay(original, replacement)
    .map((segment) =>
      segment.kind === 'same' ? segment.text : segment.kind === 'removed' ? `[-${segment.text}-]` : `{+${segment.text}+}`,
    )
    .join('')
}

describe('diffForDisplay', () => {
  it('marks single word changes in place', () => {
    expect(render('We have recieved feedback.', 'We have received feedback.')).toBe(
      'We have [-recieved-]{+received+} feedback.',
    )
  })

  it('merges neighbouring changes into one phrase pair', () => {
    expect(render('The team is going to be working on it.', 'The team will work on it.')).toBe(
      'The team [-is going to be working-]{+will work+} on it.',
    )
  })

  it('shows a heavy rewrite as old block and new block', () => {
    const segments = diffForDisplay('Things are fine.', 'Revenue grew 12% in Q3.')

    expect(segments.map((segment) => segment.kind)).toEqual(['removed', 'added'])
  })

  it('handles pure deletion and pure insertion', () => {
    expect(render('Very very good.', 'Very good.')).toBe('Very [-very -]good.')
    expect(render('Good.', '')).toBe('[-Good.-]')
  })
})
