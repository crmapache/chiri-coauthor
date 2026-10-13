import { MAX_DOCUMENT_LENGTH, type TextRange } from '../../shared/contract'

/** Part of the document sent with a request, and where it starts in the full text. */
export type DocumentWindow = { text: string; offset: number }

/**
 * For a selection or a refinement in a long document, the model needs the passage and enough
 * text around it for tone and terms, not every page. The window is centred on the passage and
 * snapped to line starts and ends, so the context never begins mid-sentence.
 */
export function documentWindow(document: string, range: TextRange, maxLength = MAX_DOCUMENT_LENGTH): DocumentWindow {
  if (document.length <= maxLength) return { text: document, offset: 0 }

  const radius = Math.max(0, Math.floor((maxLength - (range.to - range.from)) / 2))

  let start = Math.max(0, range.from - radius)
  let end = Math.min(document.length, range.to + radius)

  if (start === 0) end = Math.min(document.length, maxLength)

  if (end === document.length) start = Math.max(0, document.length - maxLength)

  if (start > 0) {
    const nextLine = document.indexOf('\n', start)

    if (nextLine !== -1 && nextLine < range.from) start = nextLine + 1
  }

  if (end < document.length) {
    const lineEnd = document.lastIndexOf('\n', end)

    if (lineEnd >= range.to) end = lineEnd
  }

  return { text: document.slice(start, end), offset: start }
}

const WORD_CHARACTER = /[\p{L}\p{N}'’_-]/u

/**
 * A mouse selection often clips a word ("ick brown f"). The model quotes whole words, and a
 * quote reaching past the selection cannot be placed, so the selection grows to whole words first.
 */
export function expandToWords(document: string, range: TextRange): TextRange {
  let { from, to } = range

  while (from > 0 && WORD_CHARACTER.test(document[from - 1] as string) && WORD_CHARACTER.test(document[from] as string)) {
    from--
  }

  while (to < document.length && WORD_CHARACTER.test(document[to - 1] as string) && WORD_CHARACTER.test(document[to] as string)) {
    to++
  }

  return { from, to }
}

/** True for a selection of nothing but spaces and line breaks: there is nothing to ask about. */
export function isBlank(text: string): boolean {
  return text.trim().length === 0
}