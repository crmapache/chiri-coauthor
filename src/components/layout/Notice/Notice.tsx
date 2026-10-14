import clsx from 'clsx'
import { useEffect } from 'react'

import { CloseIcon } from '../../icons/icons'
import { IconButton } from '../../ui/IconButton/IconButton'
import { NOTICE_DURATION_MS } from './Notice.constants'
import styles from './Notice.module.scss'
import type { NoticeProps } from './Notice.types'

/** A short message from the co-author or about a failure, at the bottom of the screen. */
export const Notice = ({ notice, onDismiss }: NoticeProps) => {
  useEffect(() => {
    if (!notice) return

    const timer = window.setTimeout(onDismiss, NOTICE_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [notice, onDismiss])

  if (!notice) return null

  return (
    <div
      key={notice.id}
      className={clsx(styles.notice, styles[notice.tone])}
      role="status"
      data-testid="notice"
    >
      <span>{notice.text}</span>
      <IconButton title="Dismiss" onClick={onDismiss}>
        <CloseIcon width={14} height={14} />
      </IconButton>
    </div>
  )
}
