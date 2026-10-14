import { Prec } from '@codemirror/state'
import { keymap, type EditorView } from '@codemirror/view'

import { acceptSuggestions, getSuggestions, rejectSuggestions } from './suggestionState'

/** Things the editor asks the React layer to do. Read through a ref, so they are always current. */
export type CoauthorCommands = {
  /** `Mod-K`: open the ask box for the selection, or for the whole document without one. */
  openAsk: () => void
  /** `Escape`: stop the request in flight. Returns false when there was nothing to stop. */
  cancelRequest: () => boolean
  /** A suggestion being rewritten right now must not be accepted or rejected mid-flight. */
  isBusy: (id: string) => boolean
}

function withActive(
  view: EditorView,
  commands: { current: CoauthorCommands },
  run: (id: string) => boolean,
): boolean {
  const { activeId } = getSuggestions(view.state)

  if (!activeId) return false

  // Swallow the key while the card is rewriting, so it neither acts nor moves focus away.
  if (commands.current.isBusy(activeId)) return true

  return run(activeId)
}

/**
 * Tab and Shift-Tab act on the suggestion under the cursor and then jump to the next one, so a
 * whole review can be walked through from the keyboard. Outside a suggestion they do nothing
 * special and the browser keeps its usual focus behaviour.
 */
export function coauthorKeymap(commands: { current: CoauthorCommands }) {
  return Prec.highest(
    keymap.of([
      {
        key: 'Tab',
        run: (view) =>
          withActive(view, commands, (id) => acceptSuggestions(view, [id], { advance: true })),
      },
      {
        key: 'Shift-Tab',
        run: (view) =>
          withActive(view, commands, (id) => rejectSuggestions(view, [id], { advance: true })),
      },
      {
        key: 'Mod-k',
        preventDefault: true,
        run: () => {
          commands.current.openAsk()
          return true
        },
      },
      { key: 'Escape', run: () => commands.current.cancelRequest() },
    ]),
  )
}
