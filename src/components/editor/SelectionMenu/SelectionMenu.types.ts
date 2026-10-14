import type { EditorView } from '@codemirror/view'

import type { TextRange } from '../../../../shared/contract'
import type { QuickAction } from '../../../types/coauthor'

export type SelectionMenuProps = {
  view: EditorView
  selection: TextRange
  /** Changes whenever the text may have moved, so the menu is re-positioned. */
  layoutVersion: number
  /** Show the free-form input instead of the quick actions. */
  askOpen: boolean
  onOpenAsk: () => void
  onCloseAsk: () => void
  onAction: (action: QuickAction) => void
  onAsk: (instruction: string) => void
}
