import type { ButtonHTMLAttributes } from 'react'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Shown as a tooltip; an icon alone does not say what the button does. */
  title: string
  tone?: 'neutral' | 'accept' | 'reject'
}