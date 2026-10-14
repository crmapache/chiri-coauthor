import type { EditorView } from '@codemirror/view'
import { useCallback, useRef, useState } from 'react'

import { clampReason } from '../../shared/anchor'
import {
  MAX_DOCUMENT_LENGTH,
  MAX_REFINE_TURNS,
  MAX_SELECTION_LENGTH,
  type SuggestRequest,
  type SuggestResponse,
  type TextRange,
} from '../../shared/contract'
import { askLabel, REVIEW_LABEL } from '../constants/actions'
import { endPending, getPending, startPending, type PendingRequest } from '../editor/pendingState'
import { describeOutcome, placeEdits } from '../editor/placeEdits'
import {
  addSuggestions,
  addTurn,
  findSuggestion,
  revealEffects,
  suggestionAtCursor,
} from '../editor/suggestionState'
import { requestSuggestions, SuggestError } from '../lib/api'
import { documentWindow, expandToWords, isBlank } from '../lib/requestText'
import type { CoauthorStatus, NoticeMessage } from '../types/coauthor'
import type { Suggestion } from '../types/suggestion'

type RunOptions = {
  message: string
  highlight: TextRange | null
  suggestionId: string | null
  onResponse: (response: SuggestResponse, pending: PendingRequest) => void
}

const IDLE: CoauthorStatus = { kind: 'idle' }

/**
 * After an answer the keyboard belongs to the text again, so Tab and Mod-Z work at once. The only
 * exception is a field the writer is in the middle of filling, which keeps its focus.
 */
function returnFocus(view: EditorView): void {
  const active = document.activeElement

  if (active instanceof HTMLInputElement && active.value.trim()) return

  view.focus()
}

/**
 * Makes `candidate` the active suggestion and brings it into view, unless the writer has meanwhile
 * put the cursor into a different suggestion: Tab must act on what is under the cursor.
 */
function activateUnlessBusyElsewhere(view: EditorView, candidate: Suggestion) {
  const underCursor = suggestionAtCursor(view.state)

  return underCursor && underCursor.id !== candidate.id ? [] : revealEffects(candidate)
}

/**
 * Everything that talks to the model. One request at a time: starting a new one cancels the one
 * in flight, so the writer never gets answers to a question they have moved on from.
 */
export function useCoauthor(view: EditorView | null) {
  const [status, setStatus] = useState<CoauthorStatus>(IDLE)
  const [notice, setNotice] = useState<NoticeMessage | null>(null)
  const [modelName, setModelName] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const showNotice = useCallback((tone: NoticeMessage['tone'], text: string) => {
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
        returnFocus(editor)
      } catch (error) {
        if (error instanceof SuggestError && error.code === 'aborted') return

        showNotice(
          'error',
          error instanceof SuggestError ? error.message : 'Something went wrong. Try again.',
        )
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
    (
      editor: EditorView,
      response: SuggestResponse,
      pending: PendingRequest,
      origin: { label: string; instruction: string; offset: number },
    ) => {
      const { suggestions, stale } = placeEdits(editor.state, pending, response.edits, origin)
      const [first] = suggestions

      if (first) {
        editor.dispatch({
          effects: [addSuggestions.of(suggestions), ...activateUnlessBusyElsewhere(editor, first)],
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
    (instruction: string, label = askLabel(instruction)) => {
      if (!view) return

      const text = view.state.doc.toString()
      const { from, to } = expandToWords(text, view.state.selection.main)

      if (isBlank(text.slice(from, to))) return

      if (to - from > MAX_SELECTION_LENGTH) {
        showNotice(
          'error',
          `That selection is too long for one pass (${(to - from).toLocaleString('en')} characters, the limit is ${MAX_SELECTION_LENGTH.toLocaleString('en')}). Select less.`,
        )
        return
      }

      const context = documentWindow(text, { from, to })

      // Collapse the selection: its shimmer marks what is being worked on, and the menu goes away.
      view.dispatch({ selection: { anchor: to } })

      void run(
        view,
        {
          mode: 'selection',
          document: context.text,
          selection: { from: from - context.offset, to: to - context.offset },
          instruction,
        },
        {
          message: `${label}…`,
          highlight: { from, to },
          suggestionId: null,
          onResponse: (response, pending) =>
            showEdits(view, response, pending, { label, instruction, offset: context.offset }),
        },
      )
    },
    [view, run, showEdits, showNotice],
  )

  const reviewDocument = useCallback(
    (instruction?: string) => {
      if (!view) return

      const text = view.state.doc.toString()

      if (isBlank(text)) {
        showNotice('info', 'Write something first, then ask for a review.')
        return
      }

      if (text.length > MAX_DOCUMENT_LENGTH) {
        showNotice(
          'error',
          `The document is too long to review at once (the limit is ${MAX_DOCUMENT_LENGTH.toLocaleString('en')} characters). Select a part and ask about it instead.`,
        )
        return
      }

      const label = instruction ? askLabel(instruction) : REVIEW_LABEL

      void run(
        view,
        { mode: 'document', document: text, instruction },
        {
          message: instruction ? 'Working through the document…' : 'Reviewing the document…',
          highlight: null,
          suggestionId: null,
          onResponse: (response, pending) =>
            showEdits(view, response, pending, {
              label,
              instruction: instruction ?? 'Review the document.',
              offset: 0,
            }),
        },
      )
    },
    [view, run, showEdits, showNotice],
  )

  const refine = useCallback(
    (id: string, feedback: string) => {
      if (!view) return

      const item = findSuggestion(view.state, id)

      if (!item) return

      const context = documentWindow(view.state.doc.toString(), item)
      const turns = item.turns
        .slice(0, item.shownTurn + 1)
        .slice(-MAX_REFINE_TURNS)
        .map((turn) => ({ ...turn, reason: clampReason(turn.reason) }))

      void run(
        view,
        {
          mode: 'refine',
          document: context.text,
          target: { from: item.from - context.offset, to: item.to - context.offset },
          turns,
          feedback,
        },
        {
          message: 'Rewriting the suggestion…',
          highlight: null,
          suggestionId: id,
          onResponse: (response) => {
            const current = findSuggestion(view.state, id)
            const [edit] = response.edits

            if (!current) {
              showNotice(
                'info',
                'The text changed while the co-author was rewriting, so the suggestion was dropped.',
              )
              return
            }

            if (!edit) {
              showNotice('info', response.note || 'The co-author kept the current version.')
              return
            }

            view.dispatch({
              effects: [
                addTurn.of({
                  id,
                  turn: {
                    instruction: feedback,
                    replacement: edit.replacement,
                    reason: edit.reason,
                  },
                }),
                ...activateUnlessBusyElsewhere(view, current),
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
