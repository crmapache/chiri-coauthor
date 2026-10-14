import { diffChars } from 'diff'

import type { SuggestRequest, TextRange } from '../shared/contract.js'
import { SAMPLE_DOCUMENT } from '../src/sample/sampleDocument.js'

/**
 * What a case checks, given the text after applying every returned edit. Each check is something
 * a writer would notice, written so a script can decide it: a typo still there, a date lost.
 */
export type Check = { name: string; passes: (result: EvalResult) => boolean }

export type EvalResult = {
  /** The whole document with all edits applied. */
  document: string
  /** Just the part that was allowed to change, after edits (the whole document for reviews). */
  passage: string
  editCount: number
}

export type EvalCase = { id: string; description: string; request: SuggestRequest; checks: Check[] }

function rangeOf(document: string, text: string): TextRange {
  const from = document.indexOf(text)

  if (from === -1) throw new Error(`Case setup: "${text.slice(0, 30)}…" not found`)

  return { from, to: from + text.length }
}

function lineStartingWith(document: string, prefix: string): string {
  const line = document.split('\n').find((candidate) => candidate.startsWith(prefix))

  if (!line) throw new Error(`Case setup: no line starts with "${prefix}"`)

  return line
}

const contains = (text: string) => ({
  name: `keeps or adds "${text}"`,
  passes: (result: EvalResult) => result.passage.includes(text),
})

const lacks = (text: string) => ({
  name: `removes "${text}"`,
  passes: (result: EvalResult) => !result.passage.includes(text),
})

/** Share of characters that changed between two texts, 0 to 1. */
function changedShare(before: string, after: string): number {
  const changed = diffChars(before, after)
    .filter((part) => part.added || part.removed)
    .reduce((total, part) => total + part.value.length, 0)

  return changed / Math.max(before.length, 1)
}

const minimal = (original: string, limit: number) => ({
  name: `changes at most ${Math.round(limit * 100)}% of the text`,
  passes: (result: EvalResult) => changedShare(original, result.passage) <= limit,
})

/** Numbers in the result that the source never had: the model made a fact up. */
const inventsNoNumbers = (source: string) => ({
  name: 'invents no numbers',
  passes: (result: EvalResult) => {
    const known = new Set(source.match(/\d+(?:[.,]\d+)?%?/g) ?? [])

    return (result.passage.match(/\d+(?:[.,]\d+)?%?/g) ?? []).every((number) => known.has(number))
  },
})

const WHY = lineStartingWith(SAMPLE_DOCUMENT, 'Our customers')
const TIMELINE = lineStartingWith(SAMPLE_DOCUMENT, 'Beta starts')
const LIST_ITEM = lineStartingWith(SAMPLE_DOCUMENT, '- have there')
const OPEN_QUESTIONS = lineStartingWith(SAMPLE_DOCUMENT, 'We still need')
const CLEAN = 'The first version will let technicians:'

const PARTIAL =
  "basically non-existent, and when the app can't connect they loose whatever they were typing"

const CLEAN_DOCUMENT = `# Weekly update

Support volume fell 12% this week after we fixed the login loop on Android. The fix shipped on Tuesday, and the related tickets stopped within a day.

Next week we start the billing migration. Finance has signed off on the plan, and we will move the first 50 accounts on Wednesday.`

const SPANISH = `# Resumen de la reunión

Ayer habían muchas personas en la reunión y nadie sabia que hacer con el presupuesto. Al final decidimos que el equipo de ventas va a presentar una propuesta nueva el lunes.`

const SPANISH_PARAGRAPH = lineStartingWith(SPANISH, 'Ayer')

function selection(document: string, passage: string, instruction: string): SuggestRequest {
  return { mode: 'selection', document, selection: rangeOf(document, passage), instruction }
}

export const CASES: EvalCase[] = [
  {
    id: 'grammar-paragraph',
    description: 'Fix grammar in a paragraph with two seeded errors',
    request: selection(
      SAMPLE_DOCUMENT,
      WHY,
      'Fix spelling, grammar and punctuation only. Change nothing else.',
    ),
    checks: [lacks('they loose'), lacks('field has been'), contains('40%'), minimal(WHY, 0.12)],
  },
  {
    id: 'partial-selection',
    description: 'Fix grammar in half a sentence without touching the rest',
    request: selection(
      SAMPLE_DOCUMENT,
      PARTIAL,
      'Fix spelling, grammar and punctuation only. Change nothing else.',
    ),
    checks: [lacks('they loose'), contains('basically'), minimal(PARTIAL, 0.12)],
  },
  {
    id: 'add-without-inventing',
    description: 'Add a sentence about impact without making up numbers',
    request: selection(
      SAMPLE_DOCUMENT,
      WHY,
      'Add one sentence about the impact we expect from this launch.',
    ),
    checks: [inventsNoNumbers(SAMPLE_DOCUMENT), contains('40%')],
  },
  {
    id: 'improve-keeps-facts',
    description: 'Improve a paragraph, keep every fact',
    request: selection(
      SAMPLE_DOCUMENT,
      TIMELINE,
      'Improve this passage: make it clearer and more direct without changing its meaning.',
    ),
    checks: [
      contains('March 3'),
      contains('three customers'),
      contains('April'),
      inventsNoNumbers(SAMPLE_DOCUMENT),
    ],
  },
  {
    id: 'shorten-keeps-facts',
    description: 'Shorten a paragraph without losing its dates',
    request: selection(
      SAMPLE_DOCUMENT,
      TIMELINE,
      'Make this passage noticeably shorter. Keep every fact and the main point.',
    ),
    checks: [
      {
        name: 'at most 85% of the original length',
        passes: (result) => result.passage.length <= TIMELINE.length * 0.85,
      },
      contains('March 3'),
      contains('April'),
    ],
  },
  {
    id: 'formal-tone',
    description: 'Make a casual paragraph formal, keep the number',
    request: selection(SAMPLE_DOCUMENT, WHY, 'Make the tone more formal and professional.'),
    checks: [lacks('super frustrating'), lacks('honestly'), contains('40%')],
  },
  {
    id: 'list-item-markdown',
    description: 'Fix a list item and keep its Markdown marker',
    request: selection(
      SAMPLE_DOCUMENT,
      LIST_ITEM,
      'Fix spelling, grammar and punctuation only. Change nothing else.',
    ),
    checks: [
      contains('their changes'),
      { name: 'still a list item', passes: (result) => result.passage.startsWith('- ') },
    ],
  },
  {
    id: 'link-preserved',
    description: 'Rewrite a sentence that contains a link without breaking it',
    request: selection(
      SAMPLE_DOCUMENT,
      OPEN_QUESTIONS,
      'Make the tone warmer and more conversational.',
    ),
    checks: [contains('(https://example.com/offline-design)'), contains('Android')],
  },
  {
    id: 'clean-sentence',
    description: 'Ask to fix grammar where there is nothing to fix',
    request: selection(
      SAMPLE_DOCUMENT,
      CLEAN,
      'Fix spelling, grammar and punctuation only. Change nothing else.',
    ),
    checks: [{ name: 'proposes nothing', passes: (result) => result.editCount === 0 }],
  },
  {
    id: 'spanish-stays-spanish',
    description: 'Fix grammar in Spanish without switching language',
    request: selection(
      SPANISH,
      SPANISH_PARAGRAPH,
      'Fix spelling, grammar and punctuation only. Change nothing else.',
    ),
    checks: [lacks('habían muchas'), lacks('nadie sabia'), contains('presupuesto'), lacks(' the ')],
  },
  {
    id: 'review-document',
    description: 'Review the sample draft and catch the seeded errors',
    request: { mode: 'document', document: SAMPLE_DOCUMENT },
    checks: [
      {
        name: 'fixes at least 3 of the 4 seeded errors',
        passes: (result) =>
          ['they loose', 'field has been', 'have there changes', 'bugs that was'].filter(
            (error) => !result.document.includes(error),
          ).length >= 3,
      },
      {
        name: 'between 2 and 6 edits',
        passes: (result) => result.editCount >= 2 && result.editCount <= 6,
      },
      contains('March 3'),
    ],
  },
  {
    id: 'review-restraint',
    description: 'Review a document that is already good: leave it mostly alone',
    request: { mode: 'document', document: CLEAN_DOCUMENT },
    checks: [
      { name: 'at most 2 edits', passes: (result) => result.editCount <= 2 },
      contains('12%'),
      contains('first 50 accounts'),
    ],
  },
  {
    id: 'rename-term-everywhere',
    description: 'Whole-document instruction to rename a term everywhere',
    request: {
      mode: 'document',
      document: SAMPLE_DOCUMENT,
      instruction:
        "Say 'field engineers' instead of 'technicians' everywhere. Change nothing else.",
    },
    checks: [
      { name: 'no "technician" left', passes: (result) => !/technician/i.test(result.document) },
      { name: 'only the renames (at most 3 edits)', passes: (result) => result.editCount <= 3 },
    ],
  },
  {
    id: 'review-with-instruction',
    description: 'Whole-document instruction still yields targeted edits',
    request: {
      mode: 'document',
      document: SAMPLE_DOCUMENT,
      instruction: 'Make it read more confidently.',
    },
    checks: [
      {
        name: 'between 1 and 6 edits',
        passes: (result) => result.editCount >= 1 && result.editCount <= 6,
      },
      contains('40%'),
      contains('March 3'),
    ],
  },
  {
    id: 'refine-keeps-figure',
    description: 'Refine a shortened version, keeping a figure the first version dropped',
    request: {
      mode: 'refine',
      document: SAMPLE_DOCUMENT,
      target: rangeOf(SAMPLE_DOCUMENT, WHY),
      turns: [
        {
          instruction: 'Make this passage noticeably shorter.',
          replacement:
            'Field technicians have long asked for offline mode: in basements and rural sites the app loses their work when it cannot connect.',
          reason: 'Cuts filler and keeps the core problem.',
        },
      ],
      feedback: 'Keep the 40% support-ticket number, it is the strongest argument.',
    },
    checks: [
      contains('40%'),
      {
        name: 'still shorter than the original',
        passes: (result) => result.passage.length < WHY.length,
      },
    ],
  },
]
