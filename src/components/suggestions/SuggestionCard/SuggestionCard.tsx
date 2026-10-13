import clsx from 'clsx'
import { useState, type ChangeEvent, type FormEvent, type MouseEvent } from 'react'

import { REFINE_ACTIONS } from '../../../constants/actions'
import { shownTurnOf } from '../../../types/suggestion'
import { ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../../icons/icons'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Kbd } from '../../ui/Kbd/Kbd'
import styles from './SuggestionCard.module.scss'
import type { SuggestionCardProps } from './SuggestionCard.types'

/**
 * A suggestion in the right margin: why the edit helps, accept and reject, and, when active, a way
 * to push back on it. Versions from earlier refinements stay one click away.
 */
export const SuggestionCard = ({
  suggestion,
  active,
  busy,
  cardRef,
  onActivate,
  onHover,
  onAccept,
  onReject,
  onRefine,
  onShowTurn,
}: SuggestionCardProps) => {
  const [feedback, setFeedback] = useState('')

  const turn = shownTurnOf(suggestion)
  const versions = suggestion.turns.length
  const { id, shownTurn } = suggestion

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    // Controls inside the card do their own thing; only a click on the card itself activates it.
    if ((event.target as HTMLElement).closest('button, input, form')) return

    onActivate(id)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const text = feedback.trim()

    if (!text) return

    onRefine(id, text)
    setFeedback('')
  }

  const handleFeedbackChange = (event: ChangeEvent<HTMLInputElement>) => setFeedback(event.target.value)
  const handleMouseEnter = () => onHover(id)
  const handleMouseLeave = () => onHover(null)
  const handleAccept = () => onAccept(id)
  const handleReject = () => onReject(id)
  const handlePrevious = () => onShowTurn(id, shownTurn - 1)
  const handleNext = () => onShowTurn(id, shownTurn + 1)

  return (
    <div
      ref={cardRef}
      className={clsx(styles.card, active && styles.active, busy && styles.busy)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="suggestion-card"
    >
      <header className={styles.header}>
        <span className={styles.label}>{suggestion.label}</span>

        {versions > 1 && (
          <span className={styles.versions}>
            <IconButton title="Previous version" onClick={handlePrevious} disabled={shownTurn === 0 || busy}>
              <ChevronLeftIcon width={14} height={14} />
            </IconButton>
            {shownTurn + 1}/{versions}
            <IconButton title="Next version" onClick={handleNext} disabled={shownTurn === versions - 1 || busy}>
              <ChevronRightIcon width={14} height={14} />
            </IconButton>
          </span>
        )}

        <span className={styles.actions}>
          <IconButton tone="accept" title="Accept (Tab)" onClick={handleAccept} disabled={busy}>
            <CheckIcon />
          </IconButton>
          <IconButton tone="reject" title="Reject (Shift+Tab)" onClick={handleReject} disabled={busy}>
            <CloseIcon />
          </IconButton>
        </span>
      </header>

      <p className={styles.reason}>{busy ? 'Rewriting…' : turn.reason || 'Suggested edit.'}</p>

      {active && !busy && (
        <div className={styles.refine}>
          <div className={styles.chips}>
            {REFINE_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className={styles.chip}
                onClick={() => onRefine(id, action.instruction)}
              >
                {action.label}
              </button>
            ))}
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              className={styles.input}
              value={feedback}
              onChange={handleFeedbackChange}
              placeholder="Ask for a change…"
              maxLength={500}
            />
            <IconButton type="submit" title="Send" disabled={!feedback.trim()}>
              <ArrowUpIcon />
            </IconButton>
          </form>

          <p className={styles.hint}>
            <Kbd>Tab</Kbd> accept <Kbd>⇧ Tab</Kbd> reject
          </p>
        </div>
      )}
    </div>
  )
}