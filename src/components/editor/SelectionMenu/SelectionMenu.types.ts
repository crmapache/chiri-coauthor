import type { EditorView } from '@codemirror/view'

import type { TextRange } from '../../../../shared/contract'
import type { QuickAction } from '../../../constants/actions'

export type SelectionMenuProps = {
  view: EditorView
  selection: TextRange
  /** Show the free-form input instead of the quick actions. */
  askOpen: boolean
  onOpenAsk: () => void
  onCloseAsk: () => void
  onAction: (action: QuickAction) => void
  onAsk: (instruction: string) => void
}