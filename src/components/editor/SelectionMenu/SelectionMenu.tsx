import { useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'

import { SELECTION_ACTIONS } from '../../../constants/actions'
import { MOD_KEY_LABEL } from '../../../lib/platform'
import { ArrowUpIcon, SparkleIcon } from '../../icons/icons'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Kbd } from '../../ui/Kbd/Kbd'
import styles from './SelectionMenu.module.scss'
import type { SelectionMenuProps } from './SelectionMenu.types'
import { menuPosition } from './SelectionMenu.utils'

/**
 * Floating menu next to selected text: one-click asks, or a free-form instruction. Clicking a quick
 * action must not take focus from the editor, otherwise the selection it acts on would vanish.
 */
export const SelectionMenu = ({
  view,
  selection,
  askOpen,
  onOpenAsk,
  onCloseAsk,
  onAction,
  onAsk,
}: SelectionMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [instruction, setInstruction] = useState('')

  useLayoutEffect(() => {
    const menu = menuRef.current
    const parent = menu?.offsetParent

    if (!menu || !(parent instanceof HTMLElement)) return

    const position = menuPosition(view, selection, menu, parent)

    menu.style.visibility = position ? 'visible' : 'hidden'

    if (position) {
      menu.style.setProperty('--menu-top', `${position.top}px`)
      menu.style.setProperty('--menu-left', `${position.left}px`)
    }
  })

  const handleKeepFocus = (event: MouseEvent) => event.preventDefault()

  const handleInstructionChange = (event: ChangeEvent<HTMLInputElement>) => setInstruction(event.target.value)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const text = instruction.trim()

    if (!text) return

    onAsk(text)
    setInstruction('')
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return

    event.preventDefault()
    onCloseAsk()
    view.focus()
  }

  return (
    <div ref={menuRef} className={styles.menu} data-testid="selection-menu">
      {askOpen ? (
        <form className={styles.askForm} onSubmit={handleSubmit}>
          <SparkleIcon className={styles.sparkle} />
          <input
            className={styles.askInput}
            value={instruction}
            onChange={handleInstructionChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Tell your co-author what to do with this text…"
            maxLength={500}
            autoFocus
          />
          <IconButton type="submit" title="Send (Enter)" disabled={!instruction.trim()}>
            <ArrowUpIcon />
          </IconButton>
        </form>
      ) : (
        <div className={styles.actions} onMouseDown={handleKeepFocus}>
          {SELECTION_ACTIONS.map((action) => (
            <button key={action.id} type="button" className={styles.action} onClick={() => onAction(action)}>
              {action.label}
            </button>
          ))}
          <span className={styles.divider} />
          <button type="button" className={styles.ask} onClick={onOpenAsk}>
            <SparkleIcon width={14} height={14} />
            Ask
            <Kbd>{MOD_KEY_LABEL}K</Kbd>
          </button>
        </div>
      )}
    </div>
  )
}