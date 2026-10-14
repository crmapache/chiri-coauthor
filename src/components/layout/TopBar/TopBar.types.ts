import type { RefObject } from 'react'

import type { CoauthorStatus } from '../../../types/coauthor'

export type TopBarProps = {
  status: CoauthorStatus
  suggestionCount: number
  askInputRef: RefObject<HTMLInputElement | null>
  onReview: (instruction?: string) => void
  onCancel: () => void
  onAcceptAll: () => void
  onRejectAll: () => void
}
