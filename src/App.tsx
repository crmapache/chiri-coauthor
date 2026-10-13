import { useLayoutEffect, useRef, useState } from 'react'

import type { TextRange } from '../shared/contract'
import { NO_COMMANDS } from './App.constants'
import styles from './App.module.scss'
import { SelectionMenu } from './components/editor/SelectionMenu/SelectionMenu'
import { Notice } from './components/layout/Notice/Notice'
import { TopBar } from './components/layout/TopBar/TopBar'
import { SuggestionMargin } from './components/suggestions/SuggestionMargin/SuggestionMargin'
import { Kbd } from './components/ui/Kbd/Kbd'
import type { CoauthorCommands } from './editor/coauthorKeymap'
import { useCoauthor } from './hooks/useCoauthor'
import { useCoauthorEditor } from './hooks/useCoauthorEditor'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { usePointerSelecting } from './hooks/usePointerSelecting'
import { useSuggestionActions } from './hooks/useSuggestionActions'
import { MOD_KEY_LABEL } from './lib/platform'
import { isBlank } from './lib/requestText'
import { SAMPLE_DOCUMENT } from './sample/sampleDocument'
import type { QuickAction } from './types/coauthor'

/** The whole app: top bar, the document, its margin of suggestions, and the selection menu. */
export const App = () => {
  const commandsRef = useRef<CoauthorCommands>(NO_COMMANDS)
  const askInputRef = useRef<HTMLInputElement>(null)
  const { parentRef, snapshot } = useCoauthorEditor(commandsRef)
  const { view, suggestions, selection, hasFocus, layoutVersion } = snapshot
  const coauthor = useCoauthor(view)
  const actions = useSuggestionActions(view)
  const { selecting, handlePointerDown } = usePointerSelecting()
  const [askRange, setAskRange] = useState<TextRange | null>(null)

  useGlobalShortcuts(commandsRef)

  const busyId = coauthor.status.kind === 'working' ? coauthor.status.suggestionId : null

  // The keymap lives inside CodeMirror; it reaches React through this ref.
  useLayoutEffect(() => {
    commandsRef.current = {
      openAsk: () => {
        const main = view?.state.selection.main

        if (main && !main.empty) setAskRange({ from: main.from, to: main.to })
        else askInputRef.current?.focus()
      },
      cancelRequest: coauthor.cancel,
      isBusy: (id) => id === busyId,
    }
  })

  const selectedText = view ? view.state.sliceDoc(selection.from, selection.to) : ''
  const hasSelection = !isBlank(selectedText)

  // The ask box belongs to the selection it was opened for; once that selection is gone, so is it.
  if (askRange && !hasSelection) setAskRange(null)

  const askOpen = askRange?.from === selection.from && askRange.to === selection.to
  const menuVisible = Boolean(view) && hasSelection && !selecting && (hasFocus || askOpen)

  const handleAction = (action: QuickAction) => coauthor.askAboutSelection(action.instruction, action.label)

  const handleAsk = (instruction: string) => {
    setAskRange(null)
    coauthor.askAboutSelection(instruction)
  }

  const handleOpenAsk = () => setAskRange(selection)
  const handleCloseAsk = () => setAskRange(null)

  const handleResetSample = () => {
    view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: SAMPLE_DOCUMENT } })
    view?.focus()
  }

  return (
    <div className={styles.app}>
      <TopBar
        status={coauthor.status}
        suggestionCount={suggestions.items.length}
        askInputRef={askInputRef}
        onReview={coauthor.reviewDocument}
        onCancel={coauthor.cancel}
        onAcceptAll={actions.acceptAll}
        onRejectAll={actions.rejectAll}
      />

      <main className={styles.workspace}>
        <p className={styles.hint}>
          Select text for suggestions, or press <Kbd>{MOD_KEY_LABEL}K</Kbd> to ask. Accept with <Kbd>Tab</Kbd>,
          reject with <Kbd>⇧ Tab</Kbd>, undo with <Kbd>{MOD_KEY_LABEL}Z</Kbd>.
        </p>

        <article className={styles.paper} onPointerDown={handlePointerDown}>
          <div ref={parentRef} className={styles.editor} />
        </article>

        <aside className={styles.marginColumn}>
          <SuggestionMargin
            view={view}
            suggestions={suggestions.items}
            activeId={suggestions.activeId}
            layoutVersion={layoutVersion}
            busyId={busyId}
            onActivate={actions.activate}
            onHover={actions.hover}
            onAccept={actions.accept}
            onReject={actions.reject}
            onRefine={coauthor.refine}
            onShowTurn={actions.showTurn}
          />
        </aside>

        {menuVisible && view && (
          <SelectionMenu
            view={view}
            selection={selection}
            layoutVersion={layoutVersion}
            askOpen={askOpen}
            onOpenAsk={handleOpenAsk}
            onCloseAsk={handleCloseAsk}
            onAction={handleAction}
            onAsk={handleAsk}
          />
        )}

        <footer className={styles.footer}>
          <span>
            {coauthor.modelName ? `${coauthor.modelName} via OpenRouter` : 'AI via OpenRouter'}. Your draft is
            saved in this browser.
          </span>
          <button type="button" className={styles.reset} onClick={handleResetSample}>
            Restore the sample draft
          </button>
        </footer>
      </main>

      <Notice notice={coauthor.notice} onDismiss={coauthor.dismissNotice} />
    </div>
  )
}