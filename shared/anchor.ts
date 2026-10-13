import type { AnchoredEdit, TextRange } from './contract.js'

/** An edit as the model wrote it: a quote it wants to change, before we know where it is. */
export type RawEdit = { quote: string; replacement: string; reason: string }

export type AnchorFailureReason = 'empty' | 'not-found' | 'ambiguous' | 'no-change' | 'overlap'

export type AnchorFailure = { quote: string; reason: AnchorFailureReason }

type Located = { ok: true; from: number; to: number } | { ok: false; reason: AnchorFailureReason }

const SINGLE_QUOTES = /[‘’‚‛]/
const DOUBLE_QUOTES = /[“”„‟]/

/**
 * Text with whitespace runs collapsed and typographic quotes straightened, plus a map back to the
 * original offsets. Models copy text faithfully but not always byte for byte: a double space or a
 * curly apostrophe is enough to miss an exact match.
 */
type NormalizedText = { text: string; starts: number[]; ends: number[] }

function normalize(source: string): NormalizedText {
  let text = ''
  const starts: number[] = []
  const ends: number[] = []

  let index = 0

  while (index < source.length) {
    const char = source[index] as string

    if (/\s/.test(char)) {
      let end = index + 1

      while (end < source.length && /\s/.test(source[end] as string)) end++

      text += ' '
      starts.push(index)
      ends.push(end)
      index = end
      continue
    }

    text += SINGLE_QUOTES.test(char) ? "'" : DOUBLE_QUOTES.test(char) ? '"' : char
    starts.push(index)
    ends.push(index + 1)
    index++
  }

  return { text, starts, ends }
}

function findAll(haystack: string, needle: string): number[] {
  const positions: number[] = []
  let position = haystack.indexOf(needle)

  while (position !== -1) {
    positions.push(position)
    position = haystack.indexOf(needle, position + 1)
  }

  return positions
}

function insideRange(from: number, to: number, within?: TextRange): boolean {
  return !within || (from >= within.from && to <= within.to)
}

function pickSingle(candidates: TextRange[]): Located {
  if (candidates.length === 0) return { ok: false, reason: 'not-found' }

  if (candidates.length > 1) return { ok: false, reason: 'ambiguous' }

  const [only] = candidates as [TextRange]

  return { ok: true, ...only }
}

/**
 * Finds where a quote sits in the document. Exact match first; if that fails, a match that ignores
 * whitespace and quote style. A quote that occurs more than once is ambiguous and is rejected rather
 * than guessed, because applying an edit to the wrong occurrence is worse than skipping it.
 */
export function locateQuote(document: string, quote: string, within?: TextRange): Located {
  if (quote.trim().length === 0) return { ok: false, reason: 'empty' }

  const exact = findAll(document, quote)
    .map((from) => ({ from, to: from + quote.length }))
    .filter(({ from, to }) => insideRange(from, to, within))

  if (exact.length > 0) return pickSingle(exact)

  const normalizedDocument = normalize(document)
  const normalizedQuote = normalize(quote.trim()).text

  const loose = findAll(normalizedDocument.text, normalizedQuote)
    .map((start) => ({
      from: normalizedDocument.starts[start] as number,
      to: normalizedDocument.ends[start + normalizedQuote.length - 1] as number,
    }))
    .filter(({ from, to }) => insideRange(from, to, within))

  return pickSingle(loose)
}

/**
 * When a quote only matched after trimming, its replacement usually carries the same stray
 * whitespace at the edges. Dropping it keeps the edit from adding blank lines nobody asked for.
 */
function alignReplacement(quote: string, matched: string, replacement: string): string {
  if (quote === matched) return replacement

  const leading = quote.match(/^\s*/)?.[0] ?? ''
  const trailing = quote.match(/\s*$/)?.[0] ?? ''

  let aligned = replacement

  if (leading && aligned.startsWith(leading)) aligned = aligned.slice(leading.length)

  if (trailing && aligned.endsWith(trailing)) aligned = aligned.slice(0, -trailing.length)

  return aligned
}

/**
 * Turns the model's quoted edits into positioned edits. Anything we cannot place with certainty is
 * reported as a failure instead: the writer only ever sees edits that land exactly where intended.
 */
export function anchorEdits(
  document: string,
  rawEdits: RawEdit[],
  within?: TextRange,
): { edits: AnchoredEdit[]; failures: AnchorFailure[] } {
  const edits: AnchoredEdit[] = []
  const failures: AnchorFailure[] = []

  for (const raw of rawEdits) {
    const located = locateQuote(document, raw.quote, within)

    if (!located.ok) {
      failures.push({ quote: raw.quote, reason: located.reason })
      continue
    }

    const matched = document.slice(located.from, located.to)
    const replacement = alignReplacement(raw.quote, matched, raw.replacement)

    if (replacement === matched) {
      failures.push({ quote: raw.quote, reason: 'no-change' })
      continue
    }

    const overlaps = edits.some((edit) => located.from < edit.to && located.to > edit.from)

    if (overlaps) {
      failures.push({ quote: raw.quote, reason: 'overlap' })
      continue
    }

    edits.push({
      from: located.from,
      to: located.to,
      quote: matched,
      replacement,
      reason: raw.reason.trim(),
    })
  }

  edits.sort((left, right) => left.from - right.from)

  return { edits, failures }
}
