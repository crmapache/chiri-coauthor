import clsx from 'clsx'

import styles from './Button.module.scss'
import type { ButtonProps } from './Button.types'

/**
 * Text button. `primary` for the main action of a surface, `secondary` for actions next to it,
 * `ghost` for quiet inline actions, `accent` for a quiet action that opens the AI. For icon-only
 * controls use IconButton.
 */
export const Button = ({
  variant = 'secondary',
  size = 'md',
  iconStart,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={clsx(styles.button, styles[variant], styles[size], className)}
    {...rest}
  >
    {iconStart}
    {children}
  </button>
)
