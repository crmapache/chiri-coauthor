# Co-author

A Markdown editor where the AI works like a human editor in suggesting mode. Its edits appear in your text as tracked changes, each with a one-line reason in the margin, and you accept, reject or push back on them one at a time while you keep writing.

![Selecting a paragraph, fixing its grammar, accepting edits with Tab, reviewing the whole document and refining a suggestion](docs/demo.gif)

## Running it

```
pnpm install
cp .env.example .env    # put the OpenRouter key into OPENROUTER_API_KEY
pnpm dev                # http://localhost:3020
```

You need Node 22 or newer. The page opens with a rough draft already in it, so everything can be tried without writing first.

`pnpm test` runs the unit tests, `pnpm test:e2e` runs the browser tests with the AI mocked, and `pnpm eval` runs the model bake-off described in [evals/README.md](evals/README.md).

## What you can do

Select some text and a small menu appears next to it: Improve, Shorten, Fix grammar, More formal, Friendlier, or Ask, where you type your own instruction. Cmd+K opens Ask directly. The answer comes back as edits inside the text, with removed words struck through in red and new words in green, compared word by word. Each edit gets a card in the right margin with its reason and Accept and Reject buttons. Tab accepts the edit under the cursor and moves to the next one, and Shift+Tab rejects it, so a whole batch can be handled from the keyboard.

On the active card you can push back with Shorter, Simpler, Closer to mine, Another take, or your own words. The edit is rewritten in place, and the card keeps the earlier versions, each with what you asked for it, so you can flip back to the one you liked.

Review document (or Cmd+K with nothing selected) sends the whole text. The AI answers like a reviewer with up to six edits it thinks matter most, never a rewrite of everything. The whole document can also get an instruction, such as "say 'field engineers' instead of 'technicians' everywhere".

Accepting is a normal edit: Cmd+Z undoes it and brings the suggestion back. Undoing a rejection brings it back too. You can keep typing while the AI is thinking, and Escape cancels the request.

## How it works

The model never returns a new version of the text. It returns a list of edits as structured JSON, each with an exact quote from the document, its replacement and a reason. The server finds every quote in the text (`shared/anchor.ts`), first as an exact match and then ignoring whitespace and curly quotes. A quote that appears twice, or falls outside the selection, is dropped rather than guessed, because an edit applied in the wrong place is worse than a missing one. If no quote could be placed at all, the server retries once and tells the model which quotes missed. The diff is computed in the browser from the quote and the replacement, so the model has no way to change text it was not asked about.

When the model only matched a quote after ignoring whitespace, its replacement is not taken as is. The parts of the quote it kept are copied from the real text and only its actual changes are applied, so a quote with a space where the document has a line break cannot glue two list items together. A refinement works the same way: if the model quotes only the sentence it changed, the rest of the passage is kept. A selection that cuts a word in half is widened to whole words before it is sent, because the model always quotes whole words.

While a request is in flight, the editor records every change the writer makes (`src/editor/pendingState.ts`). When the answer arrives, each edit's position is carried through those changes. If the writer has rewritten the very words an edit is about, that edit is dropped and the message at the bottom says so.

Suggestions live in CodeMirror state (`src/editor/suggestionState.ts`), not in React. After every change each suggestion checks that its original text is still there, and disappears if it is not. Undo knows about suggestions through CodeMirror's `invertedEffects`: accepting, rejecting or typing over a suggestion records how to bring it back.

The margin cards are laid out like comments in Google Docs (`src/lib/cardLayout.ts`). The active card sits level with its text, the cards below it move down and the cards above it move up.

Long documents are handled in two ways. A review sends the whole text, up to 40,000 characters. A selection or a refinement sends only a window of the text around the passage, so asking about one sentence works in a document of any length. The answer budget grows with the selection, and an answer cut off at the limit ends in a message asking for a shorter selection instead of a silent retry.

The server side is one function that takes a Web `Request` and returns a `Response` (`server/handler.ts`). In development it runs as Vite middleware, so `pnpm dev` starts everything; on Vercel the same function is served from `api/suggest.ts`. The OpenRouter key never reaches the browser.

## Choosing the model

I ran 15 editing tasks through four models on OpenRouter: Claude Haiku 5.5, Claude Sonnet 5.5, GPT-6 Luna and Gemini 3.8 Flash. Sonnet 5.5 passed every check and had the fastest median answer among the models that passed every check (2.9 s vs 2.6 s for Haiku, which failed on complex cases), at about half a cent per request. I preferred Sonnet's wording and more specific reasons. GPT-6 Luna also passed every check at a fraction of the cost. It often quotes more surrounding text, but a long quote does not turn a small edit into a red-and-green paragraph: the word-level diff keeps unchanged words unchanged. Quote length measures the span of a suggestion, not how much text changed. Setting `OPENROUTER_MODEL=openai/gpt-6-luna` switches to Luna. The numbers and examples are in [evals/README.md](evals/README.md).

## Trade-offs

I chose CodeMirror over TipTap. The brief says the user writes Markdown, and CodeMirror covers what the hard parts need: positions that follow edits, decorations, and an undo history that can be extended. A WYSIWYG editor would look closer to Google Docs, but tracked changes in ProseMirror are a project of their own, and converting to and from Markdown adds another source of bugs.

There is no streaming. A typical answer takes about three seconds, and streaming structured JSON means parsing partial output and placing edits that may still change. Instead, the text being worked on shimmers and the top bar shows what the AI is doing, with a Cancel button.

Only one request runs at a time. A new request cancels the one in flight, so the writer never gets an answer to a question they have already moved on from.

There is no chat. The brief warns against a chatbot in a sidebar, and every interaction here happens on the text itself or on the card of one edit.

The document is saved to the browser's localStorage, also when the tab is closed mid-sentence. Suggestions are not saved and do not survive a reload.

One known gap: arriving suggestions are not part of the undo history. If you reject a suggestion and then ask about the same words again, Cmd+Z cannot bring the rejected one back, because the new suggestion now covers its text.

## What I would do with more time

- Stream edits as the model produces them, so cards appear one by one.
- Real-time collaboration with Yjs, where suggestions are shared state that other people see and resolve.
- A WYSIWYG mode built on ProseMirror.
- Keep suggestions and their versions across reloads, and show how the document changed with AI help over time.
- A proper layout for narrow screens. Below 1100 px the cards just stack under the text.
- A larger eval set with a model grading style, and rate limiting on the hosted demo, where the $5 key cap is the only guard today.

## Where things are

- `src/editor/`: the CodeMirror side, with suggestion state, the pending request, decorations, keymap and theme
- `src/components/`: React UI (top bar, selection menu, margin cards)
- `src/hooks/useCoauthor.ts`: everything that talks to the AI
- `shared/`: the request and response contract and quote anchoring, used by both browser and server
- `server/`: prompts, the OpenRouter call, the HTTP handler
- `evals/`: the model bake-off
- `tests/e2e/`: Playwright tests of the main flows
- `SPEC.md`: the decisions made before writing code
