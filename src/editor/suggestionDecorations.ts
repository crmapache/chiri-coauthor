import type { Range } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'

import { diffForDisplay, type DiffSegment } from '../lib/wordDiff'
import { shownTurnOf, type Suggestion } from '../types/suggestion'
import { pendingField } from './pendingState'
import { setActiveSuggestion, suggestionsField } from './suggestionState'

export const SUGGESTION_ID_ATTRIBUTE = 'data-suggestion-id'

type Emphasis = 'active' | 'hovered' | 'idle'

/** Diffs are recomputed only when a suggestion's text changes, not on every keystroke elsewhere. */
const diffCache = new Map<string, DiffSegment[]>()

function segmentsFor(original: string, replacement: string): DiffSegment[] {
  const key = `${original}\u0000${replacement}`
  const cached = diffCache.get(key)

  if (cached) return cached

  const segments = diffForDisplay(original, replacement)

  diffCache.set(key, segments)

  if (diffCache.size > 200) diffCache.delete(diffCache.keys().next().value as string)

  return segments
}

/** The inserted text of a suggestion, drawn inline. It is not part of the document until accepted. */
class InsertionWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly suggestionId: string,
    readonly emphasis: Emphasis,
  ) {
    super()
  }

  eq(other: InsertionWidget): boolean {
    return (
      other.text === this.text &&
      other.suggestionId === this.suggestionId &&
      other.emphasis === this.emphasis
    )
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')

    element.className = `cm-suggestion-added cm-suggestion-${this.emphasis}`
    element.textContent = this.text
    element.setAttribute(SUGGESTION_ID_ATTRIBUTE, this.suggestionId)

    return element
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * A removed line break has nothing to strike through, so a writer would not see that accepting
 * joins two lines. A struck pilcrow at the end of the line makes it visible.
 */
class RemovedLineBreakWidget extends WidgetType {
  constructor(
    readonly suggestionId: string,
    readonly emphasis: Emphasis,
  ) {
    super()
  }

  eq(other: RemovedLineBreakWidget): boolean {
    return other.suggestionId === this.suggestionId && other.emphasis === this.emphasis
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')

    element.className = `cm-suggestion-removed cm-suggestion-${this.emphasis}`
    element.textContent = '¶'
    element.setAttribute(SUGGESTION_ID_ATTRIBUTE, this.suggestionId)

    return element
  }

  ignoreEvent(): boolean {
    return false
  }
}

function markFor(kind: 'same' | 'removed', suggestionId: string, emphasis: Emphasis) {
  const role = kind === 'removed' ? 'cm-suggestion-removed' : 'cm-suggestion-kept'

  return Decoration.mark({
    class: `${role} cm-suggestion-${emphasis}`,
    attributes: { [SUGGESTION_ID_ATTRIBUTE]: suggestionId },
  })
}

function decorateSuggestion(suggestion: Suggestion, emphasis: Emphasis): Range<Decoration>[] {
  const { replacement } = shownTurnOf(suggestion)
  const ranges: Range<Decoration>[] = []

  let position = suggestion.from

  for (const segment of segmentsFor(suggestion.original, replacement)) {
    if (segment.kind === 'added') {
      const widget = Decoration.widget({
        widget: new InsertionWidget(segment.text, suggestion.id, emphasis),
        side: -1,
      })

      ranges.push(widget.range(position))
      continue
    }

    const end = position + segment.text.length

    if (end === position) continue

    ranges.push(markFor(segment.kind, suggestion.id, emphasis).range(position, end))

    if (segment.kind === 'removed') {
      for (let index = segment.text.indexOf('\n'); index !== -1; index = segment.text.indexOf('\n', index + 1)) {
        const lineBreak = new RemovedLineBreakWidget(suggestion.id, emphasis)

        ranges.push(Decoration.widget({ widget: lineBreak, side: -1 }).range(position + index))
      }
    }

    position = end
  }

  return ranges
}

const pendingMark = Decoration.mark({ class: 'cm-pending' })

export const suggestionDecorations = EditorView.decorations.compute(
  [suggestionsField, pendingField],
  (state): DecorationSet => {
    const { items, activeId, hoveredId } = state.field(suggestionsField)
    const pending = state.field(pendingField)

    const ranges = items.flatMap((item) => {
      const emphasis: Emphasis =
        item.id === activeId ? 'active' : item.id === hoveredId ? 'hovered' : 'idle'

      return decorateSuggestion(item, emphasis)
    })

    if (pending?.highlight) {
      ranges.push(pendingMark.range(pending.highlight.from, pending.highlight.to))
    }

    return Decoration.set(ranges, true)
  },
)

/** Clicking anywhere on a suggestion, including its inserted text, makes it the active one. */
export const suggestionClicks = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = (event.target as HTMLElement | null)?.closest(`[${SUGGESTION_ID_ATTRIBUTE}]`)
    const id = target?.getAttribute(SUGGESTION_ID_ATTRIBUTE)

    if (id) view.dispatch({ effects: setActiveSuggestion.of(id) })

    return false
  },
})
