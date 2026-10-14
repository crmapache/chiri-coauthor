# Co-author: spec

The brief we were given, restated as decisions. This file came first; the code follows it.

## The product in one sentence

A Markdown editor where the AI behaves like a good human editor in "suggesting" mode: its edits land
in the text as tracked changes with a one-line reason, and the writer keeps typing, accepting,
rejecting or pushing back on each one.

## Core loop (everything else is secondary)

1. The page opens with a rough draft already in the editor, so there is something to try without
   writing first.
2. Select text: a small menu appears next to it with quick actions (Improve, Shorten, Fix grammar,
   More formal, Friendlier) and "Ask" for a free-form instruction. `Mod-K` opens the same input.
3. The AI answers with edits, not with a new text. Each edit appears inline: removed words struck
   through, inserted words highlighted, diffed word by word. A card in the right margin, Google Docs
   style, holds the reason and the Accept / Reject buttons.
4. On any card the writer can ask for a refinement ("shorter", "keep the numbers", "try another
   angle"). The same edit is rebuilt in place; the card keeps a short trail of the refinements.
5. "Review document" asks the AI to act as a reviewer: a handful of the most valuable targeted
   edits across the whole text, each with its reason. Never a rewrite of the whole thing.
6. Accepting is a normal edit: `Mod-Z` undoes it and brings the suggestion back. Rejecting can be
   undone the same way.

## Rules the AI integration must obey

- The model returns a list of edits: an exact quote from the document, its replacement, a reason.
  The diff is computed on our side, so the model cannot silently change text it was not asked to
  touch.
- Quotes are checked strictly. A quote that is not found, is ambiguous, or falls outside the
  selection is dropped. If every quote fails, the server retries once and tells the model which
  quotes did not match.
- The writer stays in charge. Typing into the text an edit refers to removes that edit, because it
  is now about text that no longer exists. Typing elsewhere just moves edits along.
- One request at a time. A new request cancels the one in flight; `Esc` cancels too.
- Every failure (network, budget cap, unusable model output) ends in a short message at the bottom
  of the screen, never in a broken editor.
- The API key lives on the server. The browser talks to our own `/api/suggest`, which talks to
  OpenRouter.

## Stack and shape

- Vite + React + TypeScript single page app. CodeMirror 6 for the editor: the user writes Markdown,
  and CodeMirror gives us position mapping through edits, decorations and an undo history we can
  extend. A WYSIWYG editor (TipTap/ProseMirror) would look closer to Google Docs, but tracked
  changes there are a project of their own.
- One serverless function (`api/suggest.ts`) for Vercel. In development the same handler runs as
  Vite middleware, so there is one command to start everything.
- No database, no auth, no Docker. The document autosaves to `localStorage`.
- The default model is picked by a small bake-off over OpenRouter (`evals/`), not by taste.

## Deliberately out of scope

Real-time multi-user editing, accounts and storage, version history beyond undo, a WYSIWYG
surface, a chat sidebar, mobile layout. Each is noted in the README with what it would take.
