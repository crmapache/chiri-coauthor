import type { EditorView } from '@codemirror/view'

/** Nudge so the card's first line sits level with the text line, not with its ascender. */
const OPTICAL_OFFSET = 6

/**
 * Vertical position of a document position relative to the margin column. Both are measured in
 * viewport coordinates and scroll together, so the difference is stable while the page scrolls.
 * Positions outside the rendered viewport have no screen coordinates; the height map still knows
 * roughly where their line is.
 */
export function topOfPosition(view: EditorView, position: number, marginTop: number): number {
  const coords = view.coordsAtPos(position, 1)
  const lineTop = coords ? coords.top : view.documentTop + view.lineBlockAt(position).top

  return lineTop - marginTop - OPTICAL_OFFSET
}
