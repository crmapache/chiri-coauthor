import { useCallback, useLayoutEffect, useRef } from 'react'

import { CARD_GAP, layoutCards } from '../../../lib/cardLayout'
import { SuggestionCard } from '../SuggestionCard/SuggestionCard'
import { MEASURE_KEY } from './SuggestionMargin.constants'
import styles from './SuggestionMargin.module.scss'
import type { SuggestionMarginProps } from './SuggestionMargin.types'
import { topOfPosition } from './SuggestionMargin.utils'

/**
 * The right-hand margin with one card per suggestion, each kept level with its text. Card
 * positions depend on measured heights and on where CodeMirror has laid out the text, so they are
 * computed in CodeMirror's own measure cycle (all reads first, then all writes) and written to the
 * DOM directly instead of going through React state.
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

  // One stable callback for every card, so memoised cards are not re-rendered for a new ref.
  const registerCard = useCallback((element: HTMLDivElement | null) => {
    const id = element?.dataset.suggestionId

    if (!element || !id) return

    cardElements.current.set(id, element)

    return () => {
      cardElements.current.delete(id)
    }
  }, [])

  useLayoutEffect(() => {
    if (!view) return

    view.requestMeasure({
      key: MEASURE_KEY,
      read: () => {
        const container = containerRef.current

        if (!container) return null

        const marginTop = container.getBoundingClientRect().top
        const boxes = suggestions.map((suggestion) => ({
          id: suggestion.id,
          desiredTop: topOfPosition(view, suggestion.from, marginTop),
          height: cardElements.current.get(suggestion.id)?.offsetHeight ?? 0,
        }))

        return { container, boxes, tops: layoutCards(boxes, activeId) }
      },
      write: (measured) => {
        if (!measured) return

        let bottom = 0

        for (const box of measured.boxes) {
          const top = measured.tops.get(box.id) ?? box.desiredTop

          cardElements.current.get(box.id)?.style.setProperty('--card-top', `${top}px`)
          bottom = Math.max(bottom, top + box.height + CARD_GAP)
        }

        measured.container.style.setProperty('--margin-height', `${bottom}px`)
      },
    })
  }, [view, suggestions, activeId, layoutVersion, busyId])

  return (
    <div ref={containerRef} className={styles.margin}>
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          id={suggestion.id}
          label={suggestion.label}
          turns={suggestion.turns}
          shownTurn={suggestion.shownTurn}
          active={suggestion.id === activeId}
          busy={suggestion.id === busyId}
          cardRef={registerCard}
          {...handlers}
        />
      ))}
    </div>
  )
}