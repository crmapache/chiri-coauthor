import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/**
 * Markdown that reads like a document: headings sized like headings, emphasis rendered, and the
 * syntax characters (#, *, >, -) kept visible but quiet, since the writer still edits them.
 */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.9em', fontWeight: '650', lineHeight: '1.3' },
  { tag: tags.heading2, fontSize: '1.45em', fontWeight: '650', lineHeight: '1.35' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: '650' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '650' },
  { tag: tags.strong, fontWeight: '650' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--link)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.88em' },
  { tag: tags.quote, color: 'var(--ink-muted)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--ink-faint)' },
])

const editorChrome = EditorView.theme({
  '&': {
    fontFamily: 'var(--font-document)',
    fontSize: 'var(--document-size)',
    color: 'var(--ink)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7', overflow: 'visible' },
  '.cm-content': { padding: '0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection) !important',
  },
  '.cm-placeholder': { color: 'var(--ink-faint)', fontStyle: 'italic' },

  '.cm-suggestion-removed': {
    color: 'var(--removed-ink)',
    textDecoration: 'line-through',
    textDecorationColor: 'var(--removed-line)',
    textDecorationThickness: '1.5px',
    backgroundColor: 'var(--removed-bg)',
    borderRadius: '2px',
  },
  '.cm-suggestion-added': {
    color: 'var(--added-ink)',
    backgroundColor: 'var(--added-bg)',
    borderBottom: '1.5px solid var(--added-line)',
    borderRadius: '2px',
    whiteSpace: 'pre-wrap',
    cursor: 'pointer',
  },
  '.cm-suggestion-kept.cm-suggestion-active, .cm-suggestion-kept.cm-suggestion-hovered': {
    backgroundColor: 'var(--suggestion-span)',
  },
  '.cm-suggestion-active.cm-suggestion-removed, .cm-suggestion-active.cm-suggestion-added': {
    boxShadow: '0 0 0 1px var(--accent-soft)',
  },

  '@keyframes cm-pending-shimmer': {
    '0%': { backgroundPosition: '100% 0' },
    '100%': { backgroundPosition: '-100% 0' },
  },
  '.cm-pending': {
    backgroundImage:
      'linear-gradient(90deg, var(--pending-a) 0%, var(--pending-b) 50%, var(--pending-a) 100%)',
    backgroundSize: '200% 100%',
    animation: 'cm-pending-shimmer 1.4s linear infinite',
    borderRadius: '2px',
  },
})

export const editorTheme = [editorChrome, syntaxHighlighting(markdownHighlight)]
