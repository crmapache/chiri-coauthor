import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import type { Extension } from '@codemirror/state'
import { drawSelection, EditorView, keymap, placeholder } from '@codemirror/view'

import { coauthorKeymap, type CoauthorCommands } from './coauthorKeymap'
import { editorTheme } from './editorTheme'
import { pendingField } from './pendingState'
import { suggestionClicks, suggestionDecorations } from './suggestionDecorations'
import { suggestionExtensions } from './suggestionState'

/** Everything the editor needs, in one list. The React side only adds its update listener. */
export function createExtensions(commands: { current: CoauthorCommands }): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    markdown(),
    placeholder('Start writing, or paste a draft. Select any text to ask your co-author for help.'),
    coauthorKeymap(commands),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    suggestionExtensions,
    pendingField,
    suggestionDecorations,
    suggestionClicks,
    editorTheme,
  ]
}
