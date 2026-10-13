import type { EditorView } from '@codemirror/view'

import type { TextRange } from '../../../../shared/contract'
import { MENU_OFFSET, TOP_CLEARANCE } from './SelectionMenu.constants'

/**
 * Where the menu goes: above the start of the selection, or below its end when there is no room
 * above. Coordinates are relative to the menu's positioned parent. Null when the selection is
 * scrolled out of the rendered range.
 */
export function menuPosition(
  view: EditorView,
  selection: TextRange,
  menu: HTMLElement,
  parent: HTMLElement,
): { top: number; left: number } | null {
  const start = view.coordsAtPos(selection.from, 1)
  const end = view.coordsAtPos(selection.to, -1)

  if (!start || !end) return null

  const parentRect = parent.getBoundingClientRect()
  const fitsAbove = start.top - menu.offsetHeight - MENU_OFFSET > TOP_CLEARANCE

  const top = fitsAbove
    ? start.top - parentRect.top - menu.offsetHeight - MENU_OFFSET
    : end.bottom - parentRect.top + MENU_OFFSET

  const anchorLeft = (fitsAbove ? start.left : end.left) - parentRect.left
  const left = Math.min(Math.max(anchorLeft - 12, 0), parent.clientWidth - menu.offsetWidth)

  return { top, left }
}