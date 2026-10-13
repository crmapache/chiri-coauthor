import { diffWordsWithSpace } from 'diff'

export type DiffSegment = { kind: 'same' | 'removed' | 'added'; text: string }

/**
 * Past this share of changed characters a word diff turns into confetti. Showing the old and the
 * new text as two blocks reads better for a real rewrite.
 */
const REWRITE_THRESHOLD = 0.6

function isWhitespace(text: string): boolean {
  return /^\s+$/.test(text)
}

function sharedTrailingWhitespace(left: string, right: string): string {
  const leftTail = left.match(/\s*$/)?.[0] ?? ''
  const rightTail = right.match(/\s*$/)?.[0] ?? ''

  return leftTail === rightTail ? leftTail : ''
}

/**
 * Word-level diff shaped for reading. Neighbouring changes separated only by a space are merged
 * into one "old phrase → new phrase" pair, and heavy rewrites become a single pair.
 */
export function diffForDisplay(original: string, replacement: string): DiffSegment[] {
  const changes = diffWordsWithSpace(original, replacement)

  const changedLength = changes
    .filter((change) => change.added || change.removed)
    .reduce((total, change) => total + change.value.length, 0)
  const totalLength = Math.max(original.length + replacement.length, 1)

  if (changedLength / totalLength > REWRITE_THRESHOLD) {
    return [
      ...(original ? [{ kind: 'removed' as const, text: original }] : []),
      ...(replacement ? [{ kind: 'added' as const, text: replacement }] : []),
    ]
  }

  const segments: DiffSegment[] = []

  let removed = ''
  let added = ''

  // A space both sides end with belongs to the unchanged text, not to the change.
  const flush = () => {
    const shared = removed && added ? sharedTrailingWhitespace(removed, added) : ''

    const removedText = removed.slice(0, removed.length - shared.length)
    const addedText = added.slice(0, added.length - shared.length)

    if (removedText) segments.push({ kind: 'removed', text: removedText })

    if (addedText) segments.push({ kind: 'added', text: addedText })

    if (shared) segments.push({ kind: 'same', text: shared })

    removed = ''
    added = ''
  }

  changes.forEach((change, index) => {
    if (change.removed) {
      removed += change.value
      return
    }

    if (change.added) {
      added += change.value
      return
    }

    const previous = changes[index - 1]
    const next = changes[index + 1]
    const betweenChanges =
      Boolean(previous && (previous.added || previous.removed)) &&
      Boolean(next && (next.added || next.removed))

    if (betweenChanges && isWhitespace(change.value)) {
      removed += change.value
      added += change.value
      return
    }

    flush()
    segments.push({ kind: 'same', text: change.value })
  })

  flush()

  return segments
}
