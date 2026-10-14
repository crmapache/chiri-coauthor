# Model bake-off

Every request in the app goes to one model, so I picked it by running the same editing tasks through four OpenRouter models and comparing the results. The script calls the real server pipeline (prompt, structured output, quote anchoring, retry), so it measures what the app would actually show a writer.

```
pnpm eval                      # needs OPENROUTER_API_KEY
REPEATS=3 pnpm eval            # runs per case, default 2
MODELS=openai/gpt-6-luna pnpm eval
```

Raw output, including every edit and reason, is saved to `evals/results/`.

## The cases

There are 15 cases in `cases.ts`, each with checks a script can decide on the text after all edits are applied. Grammar fixes have to fix the seeded errors and change at most 12% of the passage. Shortening, improving and changing tone have to keep the dates and the 40% figure and must not introduce numbers that were not in the source. A list item has to stay a list item, a link has to keep its URL, and a Spanish paragraph has to stay in Spanish. A sentence with nothing wrong in it should get no edits. A review of the sample draft should catch at least three of its four seeded errors in two to six edits, and a review of a document that is already fine should make at most two. There is also a document-wide rename and a refinement that has to bring back a figure the first version dropped.

My first set of cases was too easy: three models scored 100% and the run showed nothing. The harder cases (minimal grammar edits, invented numbers, restraint on good text, the rename) were added after that.

## Results

13 October 2026, two runs per case, 30 requests per model.

| Model             | Checks passed | Cases fully right | Edits placed | Median | p90   | Cost per request | Mean quote |
| ----------------- | ------------- | ----------------- | ------------ | ------ | ----- | ---------------- | ---------- |
| Claude Haiku 5.5  | 78/82 (95%)   | 87%               | 96%          | 2.6 s  | 4.0 s | $0.00028         | 93 chars   |
| Claude Sonnet 5.5 | 82/82 (100%)  | 100%              | 100%         | 2.9 s  | 4.6 s | $0.00497         | 89 chars   |
| GPT-6 Luna        | 82/82 (100%)  | 100%              | 100%         | 3.6 s  | 4.8 s | $0.00018         | 115 chars  |
| Gemini 3.8 Flash  | 82/82 (100%)  | 100%              | 100%         | 3.9 s  | 6.8 s | $0.00152         | 130 chars  |

"Edits placed" is the share of proposed edits whose quote was found exactly once in the allowed text. "Mean quote" is the average length of the source span attached to an edit. It does not measure how much text changed or how much is marked in red and green. No model needed a retry and none returned an error.

For small edits, the word-level diff keeps unchanged words unchanged and marks additions and deletions. The display switches to full old/new blocks only when added and removed characters together exceed 60% of the combined source and replacement length (`src/lib/wordDiff.ts`). A long quote alone does not trigger that display.

Haiku lost points on two cases. It edited a document that was already good in one of two runs, and in one run it left a "technicians" in place during the rename.

## What the checks did not show

Three models passed everything, so the decision came from reading their edits side by side.

Gemini 3.8 Flash changes meaning while it edits. In the review of the sample draft, "our customers in the field" became "our field technicians", and "for a really long time" became "for months", which nobody wrote. In the formal-tone case, the frustrated technicians turned into "impacts user productivity and team bandwidth".

GPT-6 Luna is accurate and the cheapest. It often quotes a whole paragraph to change a few words; the unchanged words still remain unchanged in the diff. Its reasons tend to be generic: "Corrects errors and replaces informal wording."

Sonnet 5.5 used shorter source quotes on average and wrote more specific reasons, such as "Cuts filler and the repeated 'frustrating'" or "Removes repetition and fixes grammar; states the two conditions once."

## Decision

The default is Claude Sonnet 5.5. It passed every check and had the fastest median answer among the models that passed every check (2.9 s vs 2.6 s for Haiku, which failed on complex cases). I preferred its wording and more specific reasons when reading the outputs. Shorter quotes were an observation, not evidence of less red-and-green highlighting. It costs about half a cent per request, roughly 28 times more than Luna, so the $5 key covers about 950 requests. For a demo that is enough. If cost matters more than taste, `OPENROUTER_MODEL=openai/gpt-6-luna` switches to the budget option without a code change.

Sonnet 5.5 rejects requests with reasoning switched off, which made it fail every request in the first run. It now runs with low reasoning effort; the other models run with reasoning off or low.

After a code review I changed how refinements are placed and how many tokens a long selection may use, then ran Sonnet alone through all 15 cases again: 41 of 41 checks passed, with a median of 2.8 s.

The whole bake-off, including the discarded first run and the re-check, cost about $0.32.
