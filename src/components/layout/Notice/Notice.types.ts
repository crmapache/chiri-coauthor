import type { Notice as NoticeData } from '../../../hooks/useCoauthor'

export type NoticeProps = {
  notice: NoticeData | null
  onDismiss: () => void
}