import { EditorView } from '@codemirror/view'
import { useMemo } from 'react'

import {
  acceptSuggestions,
  getSuggestions,
  rejectSuggestions,
  setActiveSuggestion,
  setHoveredSuggestion,
  showTurn,
} from '../editor/suggestionState'

/** What the margin and the top bar can do to suggestions. All of it goes through the editor state. */
export function useSuggestionActions(view: EditorView | null) {
  return useMemo(() => {
    const allIds = () => (view ? getSuggestions(view.state).items.map((item) => item.id) : [])

    return {
      accept: (id: string) => view && acceptSuggestions(view, [id], { advance: true }),
      reject: (id: string) => view && rejectSuggestions(view, [id], { advance: true }),
      acceptAll: () => view && acceptSuggestions(view, allIds()),
      rejectAll: () => view && rejectSuggestions(view, allIds()),
      hover: (id: string | null) => view?.dispatch({ effects: setHoveredSuggestion.of(id) }),
      showTurn: (id: string, index: number) => view?.dispatch({ effects: showTurn.of({ id, index }) }),

      /** Put the cursor on the suggestion and focus the text, so Tab acts on it right away. */
      activate: (id: string) => {
        const item = view && getSuggestions(view.state).items.find((suggestion) => suggestion.id === id)

        if (!view || !item) return

        view.dispatch({
          selection: { anchor: item.from },
          effects: [setActiveSuggestion.of(id), EditorView.scrollIntoView(item.from, { y: 'nearest', yMargin: 120 })],
        })
        view.focus()
      },
    }
  }, [view])
}