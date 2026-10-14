import type { ReactNode } from 'react'

export type InstructionFormProps = {
  placeholder: string
  onSubmit: (instruction: string) => void
  /** Called on Escape inside the field, before it loses focus. */
  onEscape?: () => void
  autoFocus?: boolean
  /** Shown before the field, e.g. a sparkle marking it as an AI prompt. */
  iconStart?: ReactNode
  className?: string
}
