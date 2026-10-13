import clsx from 'clsx'
import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'

import { MAX_INSTRUCTION_LENGTH } from '../../../../shared/contract'
import { ArrowUpIcon } from '../../icons/icons'
import { IconButton } from '../IconButton/IconButton'
import styles from './InstructionForm.module.scss'
import type { InstructionFormProps } from './InstructionForm.types'

/**
 * One-line field for telling the co-author what to do, with a send button. The length limit comes
 * from the shared contract, so the field and the server can never disagree about it.
 */
export const InstructionForm = ({
  placeholder,
  onSubmit,
  onEscape,
  autoFocus,
  iconStart,
  className,
}: InstructionFormProps) => {
  const [instruction, setInstruction] = useState('')

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => setInstruction(event.target.value)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const text = instruction.trim()

    if (!text) return

    onSubmit(text)
    setInstruction('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || !onEscape) return

    event.preventDefault()
    onEscape()
  }

  return (
    <form className={clsx(styles.form, className)} onSubmit={handleSubmit}>
      {iconStart}
      <input
        className={styles.input}
        value={instruction}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={MAX_INSTRUCTION_LENGTH}
        autoFocus={autoFocus}
      />
      <IconButton type="submit" title="Send (Enter)" disabled={!instruction.trim()}>
        <ArrowUpIcon />
      </IconButton>
    </form>
  )
}