import type { EditorView } from '@codemirror/view'
import { useMemo } from 'react'

import {
  acceptSuggestions,
  findSuggestion,
  getSuggestions,
  rejectSuggestions,
  revealEffects,
  setHoveredSuggestion,
  showTurn,
} from '../editor/suggestionState'

/**
 * What the margin and the top bar can do to suggestions. All of it goes through the editor state,
 * and every action hands the keyboard back to the text: otherwise the clicked button keeps focus
 * and Mod-Z or Tab right after it would do nothing.
 */
export function useSuggestionActions(view: EditorView | null) {
  return useMemo(() => {
    const allIds = () => (view ? getSuggestions(view.state).items.map((item) => item.id) : [])

    const thenFocus = (done: boolean | undefined) => {
      if (done) view?.focus()
    }

    return {
      accept: (id: string) => thenFocus(view ? acceptSuggestions(view, [id], { advance: true }) : false),
      reject: (id: string) => thenFocus(view ? rejectSuggestions(view, [id], { advance: true }) : false),
      acceptAll: () => thenFocus(view ? acceptSuggestions(view, allIds()) : false),
      rejectAll: () => thenFocus(view ? rejectSuggestions(view, allIds()) : false),
      hover: (id: string | null) => view?.dispatch({ effects: setHoveredSuggestion.of(id) }),
      showTurn: (id: string, index: number) => view?.dispatch({ effects: showTurn.of({ id, index }) }),

      /** Put the cursor on the suggestion and focus the text, so Tab acts on it right away. */
      activate: (id: string) => {
        const item = view && findSuggestion(view.state, id)

        if (!view || !item) return

        view.dispatch({ selection: { anchor: item.from }, effects: revealEffects(item) })
        view.focus()
      },
    }
  }, [view])
}
