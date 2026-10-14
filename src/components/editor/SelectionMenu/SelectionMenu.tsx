import { useLayoutEffect, useRef, type MouseEvent } from 'react'

import { SELECTION_ACTIONS } from '../../../constants/actions'
import { MOD_KEY_LABEL } from '../../../lib/platform'
import { SparkleIcon } from '../../icons/icons'
import { Button } from '../../ui/Button/Button'
import { InstructionForm } from '../../ui/InstructionForm/InstructionForm'
import { Kbd } from '../../ui/Kbd/Kbd'
import { MEASURE_KEY } from './SelectionMenu.constants'
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
  layoutVersion,
  askOpen,
  onOpenAsk,
  onCloseAsk,
  onAction,
  onAsk,
}: SelectionMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const { from, to } = selection

  // Position is read inside CodeMirror's measure cycle, together with its own layout reads, so the
  // page is laid out once per frame instead of being forced mid-update.
  useLayoutEffect(() => {
    view.requestMeasure({
      key: MEASURE_KEY,
      read: () => {
        const menu = menuRef.current
        const parent = menu?.offsetParent

        if (!menu || !(parent instanceof HTMLElement)) return null

        return { menu, position: menuPosition(view, { from, to }, menu, parent) }
      },
      write: (measured) => {
        if (!measured) return

        const { menu, position } = measured

        menu.style.visibility = position ? 'visible' : 'hidden'

        if (!position) return

        menu.style.setProperty('--menu-top', `${position.top}px`)
        menu.style.setProperty('--menu-left', `${position.left}px`)
      },
    })
  }, [view, from, to, layoutVersion, askOpen])

  const handleKeepFocus = (event: MouseEvent) => event.preventDefault()

  const handleEscape = () => {
    onCloseAsk()
    view.focus()
  }

  return (
    <div ref={menuRef} className={styles.menu} data-testid="selection-menu">
      {askOpen ? (
        <InstructionForm
          className={styles.askForm}
          placeholder="Tell your co-author what to do with this text…"
          onSubmit={onAsk}
          onEscape={handleEscape}
          iconStart={<SparkleIcon className={styles.sparkle} />}
          autoFocus
        />
      ) : (
        <div className={styles.actions} onMouseDown={handleKeepFocus}>
          {SELECTION_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="ghost"
              size="sm"
              className={styles.action}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
          <span className={styles.divider} />
          <Button
            variant="accent"
            size="sm"
            iconStart={<SparkleIcon width={14} height={14} />}
            onClick={onOpenAsk}
          >
            Ask <Kbd>{MOD_KEY_LABEL}K</Kbd>
          </Button>
        </div>
      )}
    </div>
  )
}
