import type { NoticeMessage } from '../../../types/coauthor'

export type NoticeProps = {
  notice: NoticeMessage | null
  onDismiss: () => void
}
