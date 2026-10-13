import { EditorView } from '@codemirror/view'
import { useCallback, useRef, useState } from 'react'

import { MAX_REFINE_TURNS, type SuggestRequest, type SuggestResponse, type TextRange } from '../../shared/contract'
import { REVIEW_LABEL } from '../constants/actions'
import { endPending, getPending, startPending, type PendingRequest } from '../editor/pendingState'
import { addSuggestions, addTurn, getSuggestions, setActiveSuggestion } from '../editor/suggestionState'
import { requestSuggestions, SuggestError } from '../lib/api'
import { describeOutcome, placeEdits, shorten } from '../lib/placeEdits'

export type CoauthorStatus =
  | { kind: 'idle' }
  | { kind: 'working'; message: string; suggestionId: string | null }

export type Notice = { id: number; tone: 'info' | 'error'; text: string }

type RunOptions = {
  message: string
  highlight: TextRange | null
  suggestionId: string | null
  onResponse: (response: SuggestResponse, pending: PendingRequest) => void
}

const IDLE: CoauthorStatus = { kind: 'idle' }

/**
 * Everything that talks to the model. One request at a time: starting a new one cancels the one
 * in flight, so the writer never gets answers to a question they have moved on from.
 */
export function useCoauthor(view: EditorView | null) {
  const [status, setStatus] = useState<CoauthorStatus>(IDLE)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [modelName, setModelName] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const showNotice = useCallback((tone: Notice['tone'], text: string) => {
    setNotice({ id: Date.now(), tone, text })
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const cancel = useCallback((): boolean => {
    const controller = controllerRef.current

    if (!controller) return false

    controller.abort()

    return true
  }, [])

  const run = useCallback(
    async (editor: EditorView, request: SuggestRequest, options: RunOptions) => {
      controllerRef.current?.abort()

      const controller = new AbortController()
      const requestId = crypto.randomUUID()

      controllerRef.current = controller
      editor.dispatch({ effects: startPending.of({ id: requestId, highlight: options.highlight }) })
      setStatus({ kind: 'working', message: options.message, suggestionId: options.suggestionId })
      setNotice(null)

      try {
        const response = await requestSuggestions(request, controller.signal)
        const pending = getPending(editor.state)

        if (controller.signal.aborted || pending?.id !== requestId) return

        setModelName(response.model)
        options.onResponse(response, pending)
      } catch (error) {
        if (error instanceof SuggestError && error.code === 'aborted') return

        showNotice('error', error instanceof SuggestError ? error.message : 'Something went wrong. Try again.')
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null
          setStatus(IDLE)
        }

        // The view may be gone if the page is being torn down; nothing left to clean then.
        if (editor.dom.isConnected) editor.dispatch({ effects: endPending.of(requestId) })
      }
    },
    [showNotice],
  )

  /** Shows new suggestions and makes the first one active, so Tab works straight away. */
  const showEdits = useCallback(
    (editor: EditorView, response: SuggestResponse, pending: PendingRequest, origin: { label: string; instruction: string }) => {
      const { suggestions, stale } = placeEdits(editor.state, pending, response.edits, origin)
      const [first] = suggestions

      if (first) {
        editor.dispatch({
          effects: [
            addSuggestions.of(suggestions),
            setActiveSuggestion.of(first.id),
            EditorView.scrollIntoView(first.from, { y: 'nearest', yMargin: 120 }),
          ],
        })
      }

      const text = describeOutcome({
        shown: suggestions.length,
        note: response.note,
        dropped: response.skipped + stale,
      })

      if (text) showNotice('info', text)
    },
    [showNotice],
  )

  const askAboutSelection = useCallback(
    (instruction: string, label: string) => {
      if (!view) return

      const { from, to } = view.state.selection.main

      if (from === to) return

      // Collapse the selection: its shimmer marks what is being worked on, and the menu goes away.
      view.dispatch({ selection: { anchor: to } })

      void run(
        view,
        { mode: 'selection', document: view.state.doc.toString(), selection: { from, to }, instruction },
        {
          message: `${label}…`,
          highlight: { from, to },
          suggestionId: null,
          onResponse: (response, pending) => showEdits(view, response, pending, { label, instruction }),
        },
      )
    },
    [view, run, showEdits],
  )

  const reviewDocument = useCallback(
    (instruction?: string) => {
      if (!view) return

      const label = instruction ? `Ask: ${shorten(instruction, 24)}` : REVIEW_LABEL

      void run(
        view,
        { mode: 'document', document: view.state.doc.toString(), instruction },
        {
          message: instruction ? 'Working through the document…' : 'Reviewing the document…',
          highlight: null,
          suggestionId: null,
          onResponse: (response, pending) =>
            showEdits(view, response, pending, {
              label,
              instruction: instruction ?? 'Review the document.',
            }),
        },
      )
    },
    [view, run, showEdits],
  )

  const refine = useCallback(
    (id: string, feedback: string) => {
      if (!view) return

      const item = getSuggestions(view.state).items.find((suggestion) => suggestion.id === id)

      if (!item) return

      const turns = item.turns.slice(0, item.shownTurn + 1).slice(-MAX_REFINE_TURNS)

      void run(
        view,
        {
          mode: 'refine',
          document: view.state.doc.toString(),
          target: { from: item.from, to: item.to },
          turns,
          feedback,
        },
        {
          message: 'Rewriting the suggestion…',
          highlight: null,
          suggestionId: id,
          onResponse: (response) => {
            const stillThere = getSuggestions(view.state).items.some((suggestion) => suggestion.id === id)
            const [edit] = response.edits

            if (!stillThere) {
              showNotice('info', 'The text changed while the co-author was rewriting, so the suggestion was dropped.')
              return
            }

            if (!edit) {
              showNotice('info', response.note || 'The co-author kept the current version.')
              return
            }

            view.dispatch({
              effects: [
                addTurn.of({ id, turn: { instruction: feedback, replacement: edit.replacement, reason: edit.reason } }),
                setActiveSuggestion.of(id),
              ],
            })
          },
        },
      )
    },
    [view, run, showNotice],
  )

  return {
    status,
    notice,
    dismissNotice,
    modelName,
    askAboutSelection,
    reviewDocument,
    refine,
    cancel,
  }
}
