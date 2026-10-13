import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'

import { MOD_KEY_LABEL } from '../../../lib/platform'
import { SparkleIcon } from '../../icons/icons'
import { Button } from '../../ui/Button/Button'
import { Kbd } from '../../ui/Kbd/Kbd'
import styles from './TopBar.module.scss'
import type { TopBarProps } from './TopBar.types'

/**
 * Document-level controls: ask about or review the whole text, see what the co-author is doing,
 * and settle all open suggestions at once.
 */
export const TopBar = ({
  status,
  suggestionCount,
  askInputRef,
  onReview,
  onCancel,
  onAcceptAll,
  onRejectAll,
}: TopBarProps) => {
  const [instruction, setInstruction] = useState('')

  const working = status.kind === 'working'
  const hasInstruction = instruction.trim().length > 0

  const handleInstructionChange = (event: ChangeEvent<HTMLInputElement>) => setInstruction(event.target.value)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onReview(instruction.trim() || undefined)
    setInstruction('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') event.currentTarget.blur()
  }

  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <SparkleIcon width={14} height={14} />
        </span>
        Co-author
      </div>

      <form className={styles.ask} onSubmit={handleSubmit}>
        <input
          ref={askInputRef}
          className={styles.askInput}
          value={instruction}
          onChange={handleInstructionChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the whole document…"
          maxLength={500}
        />
        {!hasInstruction && <Kbd>{MOD_KEY_LABEL}K</Kbd>}
        <Button type="submit" variant="primary" size="sm" disabled={working}>
          {hasInstruction ? 'Ask' : 'Review document'}
        </Button>
      </form>

      <div className={styles.status} aria-live="polite">
        {working ? (
          <>
            <span className={styles.spinner} />
            <span className={styles.message}>{status.message}</span>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel <Kbd>Esc</Kbd>
            </Button>
          </>
        ) : (
          suggestionCount > 0 && (
            <>
              <span className={styles.count}>
                {suggestionCount} suggestion{suggestionCount === 1 ? '' : 's'}
              </span>
              <Button variant="ghost" size="sm" onClick={onRejectAll}>
                Reject all
              </Button>
              <Button variant="secondary" size="sm" onClick={onAcceptAll}>
                Accept all
              </Button>
            </>
          )
        )}
      </div>
    </header>
  )
}