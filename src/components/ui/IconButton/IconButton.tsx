import clsx from 'clsx'

import styles from './IconButton.module.scss'
import type { IconButtonProps } from './IconButton.types'

/** Square icon-only button with a tooltip. `accept` and `reject` tint it on hover. */
export const IconButton = ({ tone = 'neutral', className, type = 'button', ...rest }: IconButtonProps) => (
  <button type={type} className={clsx(styles.iconButton, styles[tone], className)} {...rest} />
)