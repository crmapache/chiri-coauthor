import { EditorState } from '@codemirror/state'
import { EditorView, type ViewUpdate } from '@codemirror/view'

import type { TextRange } from '../../shared/contract'
import { loadDocument, saveDocument } from '../lib/documentStorage'
import { SAMPLE_DOCUMENT } from '../sample/sampleDocument'
import type { CoauthorCommands } from './coauthorKeymap'
import { createExtensions } from './createExtensions'
import { getPending, type PendingRequest } from './pendingState'
import { getSuggestions, type SuggestionsState } from './suggestionState'

/** What React renders from. A new object only when something on screen may have changed. */
export type EditorSnapshot = {
  view: EditorView | null
  suggestions: SuggestionsState
  pending: PendingRequest | null
  selection: TextRange
  hasFocus: boolean
  /** Bumps whenever text may have moved on screen, so the margin cards re-measure. */
  layoutVersion: number
}

const SAVE_DELAY_MS = 400

const EMPTY_SNAPSHOT: EditorSnapshot = {
  view: null,
  suggestions: { items: [], activeId: null, hoveredId: null },
  pending: null,
  selection: { from: 0, to: 0 },
  hasFocus: false,
  layoutVersion: 0,
}

/**
 * Owns the CodeMirror view and exposes it to React through `useSyncExternalStore`. CodeMirror stays
 * the single source of truth for text and suggestions; React only reads snapshots of it.
 */
export class EditorStore {
  private view: EditorView | null = null
  private snapshot: EditorSnapshot = EMPTY_SNAPSHOT
  private listeners = new Set<() => void>()
  private saveTimer: number | undefined

  constructor(private readonly commands: { current: CoauthorCommands }) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): EditorSnapshot => this.snapshot

  mount(parent: HTMLElement): void {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: loadDocument() ?? SAMPLE_DOCUMENT,
        extensions: [createExtensions(this.commands), EditorView.updateListener.of(this.handleUpdate)],
      }),
    })

    this.publish(this.view, 1)
  }

  unmount(): void {
    window.clearTimeout(this.saveTimer)
    this.view?.destroy()
    this.view = null
    this.snapshot = EMPTY_SNAPSHOT
    this.notify()
  }

  private handleUpdate = (update: ViewUpdate): void => {
    if (update.docChanged) {
      window.clearTimeout(this.saveTimer)
      this.saveTimer = window.setTimeout(() => saveDocument(update.state.doc.toString()), SAVE_DELAY_MS)
    }

    const moved = update.docChanged || update.geometryChanged || update.viewportChanged || update.heightChanged
    const changed =
      moved ||
      update.selectionSet ||
      update.focusChanged ||
      update.transactions.some((tr) => tr.effects.length > 0)

    if (changed) this.publish(update.view, this.snapshot.layoutVersion + (moved ? 1 : 0))
  }

  private publish(view: EditorView, layoutVersion: number): void {
    const { main } = view.state.selection

    this.snapshot = {
      view,
      suggestions: getSuggestions(view.state),
      pending: getPending(view.state),
      selection: { from: main.from, to: main.to },
      hasFocus: view.hasFocus,
      layoutVersion,
    }

    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}
