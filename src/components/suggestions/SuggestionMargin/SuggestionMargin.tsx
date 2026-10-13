import { useCallback, useLayoutEffect, useRef } from 'react'

import { CARD_GAP, layoutCards } from '../../../lib/cardLayout'
import { SuggestionCard } from '../SuggestionCard/SuggestionCard'
import styles from './SuggestionMargin.module.scss'
import type { SuggestionMarginProps } from './SuggestionMargin.types'
import { topOfPosition } from './SuggestionMargin.utils'

/**
 * The right-hand margin with one card per suggestion, each kept level with its text. Positions are
 * written straight to the DOM after layout: they depend on measured heights, and routing them
 * through React state would cost an extra render per keystroke.
 */
export const SuggestionMargin = ({
  view,
  suggestions,
  activeId,
  layoutVersion,
  busyId,
  ...handlers
}: SuggestionMarginProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardElements = useRef(new Map<string, HTMLDivElement>())

  const registerCard = useCallback(
    (id: string) => (element: HTMLDivElement | null) => {
      if (element) cardElements.current.set(id, element)
      else cardElements.current.delete(id)
    },
    [],
  )

  useLayoutEffect(() => {
    const container = containerRef.current

    if (!view || !container) return

    const marginTop = container.getBoundingClientRect().top
    const boxes = suggestions.map((suggestion) => ({
      id: suggestion.id,
      desiredTop: topOfPosition(view, suggestion.from, marginTop),
      height: cardElements.current.get(suggestion.id)?.offsetHeight ?? 0,
    }))
    const tops = layoutCards(boxes, activeId)

    let bottom = 0

    for (const box of boxes) {
      const top = tops.get(box.id) ?? box.desiredTop

      cardElements.current.get(box.id)?.style.setProperty('--card-top', `${top}px`)
      bottom = Math.max(bottom, top + box.height + CARD_GAP)
    }

    container.style.setProperty('--margin-height', `${bottom}px`)
  }, [view, suggestions, activeId, layoutVersion, busyId])

  return (
    <div ref={containerRef} className={styles.margin}>
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          active={suggestion.id === activeId}
          busy={suggestion.id === busyId}
          cardRef={registerCard(suggestion.id)}
          {...handlers}
        />
      ))}
    </div>
  )
}