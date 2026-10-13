/**
 * Model bake-off. Runs every case against every model through the real `suggest()` pipeline
 * (prompt, structured output, anchoring, retry) and reports quality, placement accuracy,
 * latency and cost. Usage: `pnpm eval` (REPEATS=2 by default, MODELS=id,id to narrow down).
 */
import { mkdir, writeFile } from 'node:fs/promises'

import type { AnchoredEdit, SuggestRequest } from '../shared/contract.js'
import { MODEL_PROFILES, type ModelProfile } from '../server/models.js'
import { suggest } from '../server/suggest.js'
import { CASES, type EvalCase, type EvalResult } from './cases.js'

type Run = {
  model: string
  caseId: string
  repeat: number
  latencyMs: number
  costUsd: number
  attempts: number
  proposed: number
  placed: number
  checksPassed: number
  checksTotal: number
  failedChecks: string[]
  error?: string
  edits: AnchoredEdit[]
  note: string
}

const REPEATS = Number(process.env.REPEATS ?? 2)

/** The prompt asks for 12 words; a little slack so one long word or a dash does not count against. */
const MAX_REASON_WORDS = 14
const apiKey = process.env.OPENROUTER_API_KEY

if (!apiKey) throw new Error('Set OPENROUTER_API_KEY (see .env.example)')

const wanted = process.env.MODELS?.split(',').map((id) => id.trim())
const models = wanted ? MODEL_PROFILES.filter((profile) => wanted.includes(profile.id)) : MODEL_PROFILES

function editableRange(request: SuggestRequest) {
  if (request.mode === 'selection') return request.selection

  if (request.mode === 'refine') return request.target

  return { from: 0, to: request.document.length }
}

/** Applies edits back to front so earlier positions stay valid. */
function applyEdits(request: SuggestRequest, edits: AnchoredEdit[]): EvalResult {
  const range = editableRange(request)
  const sorted = [...edits].sort((left, right) => right.from - left.from)

  let document = request.document
  let delta = 0

  for (const edit of sorted) {
    document = document.slice(0, edit.from) + edit.replacement + document.slice(edit.to)
    delta += edit.replacement.length - (edit.to - edit.from)
  }

  return { document, passage: document.slice(range.from, range.to + delta), editCount: edits.length }
}

async function runOne(model: ModelProfile, evalCase: EvalCase, repeat: number): Promise<Run> {
  const started = performance.now()
  const base = { model: model.id, caseId: evalCase.id, repeat }

  try {
    const { response, stats } = await suggest(evalCase.request, { apiKey: apiKey as string, model })
    const result = applyEdits(evalCase.request, response.edits)
    const failedChecks = evalCase.checks.filter((check) => !check.passes(result)).map((check) => check.name)

    return {
      ...base,
      latencyMs: Math.round(performance.now() - started),
      costUsd: stats.costUsd,
      attempts: stats.attempts,
      proposed: stats.proposed,
      placed: response.edits.length,
      checksPassed: evalCase.checks.length - failedChecks.length,
      checksTotal: evalCase.checks.length,
      failedChecks,
      edits: response.edits,
      note: response.note,
    }
  } catch (error) {
    return {
      ...base,
      latencyMs: Math.round(performance.now() - started),
      costUsd: 0,
      attempts: 0,
      proposed: 0,
      placed: 0,
      checksPassed: 0,
      checksTotal: evalCase.checks.length,
      failedChecks: evalCase.checks.map((check) => check.name),
      error: error instanceof Error ? error.message : String(error),
      edits: [],
      note: '',
    }
  }
}

function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((left, right) => left - right)

  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0
}

function summarize(runs: Run[]) {
  const checks = runs.reduce((total, run) => total + run.checksPassed, 0)
  const checksTotal = runs.reduce((total, run) => total + run.checksTotal, 0)
  const placementRuns = runs.filter((run) => !run.caseId.startsWith('refine'))
  const proposed = placementRuns.reduce((total, run) => total + run.proposed, 0)
  const placed = placementRuns.reduce((total, run) => total + run.placed, 0)
  const latencies = runs.map((run) => run.latencyMs)
  const cost = runs.reduce((total, run) => total + run.costUsd, 0)
  const allEdits = runs.flatMap((run) => run.edits)
  const shortReasons = allEdits.filter((edit) => edit.reason.split(/\s+/).length <= MAX_REASON_WORDS).length

  return {
    checks: `${checks}/${checksTotal}`,
    checkRate: checks / checksTotal,
    casesClean: runs.filter((run) => run.checksPassed === run.checksTotal).length / runs.length,
    placementRate: proposed ? placed / proposed : 1,
    shortReasonRate: allEdits.length ? shortReasons / allEdits.length : 1,
    retries: runs.filter((run) => run.attempts > 1).length,
    errors: runs.filter((run) => run.error).length,
    medianMs: percentile(latencies, 0.5),
    p90Ms: percentile(latencies, 0.9),
    costPerRequest: cost / runs.length,
    totalCost: cost,
  }
}

const percent = (value: number) => `${Math.round(value * 100)}%`

async function main() {
  const startedAt = new Date().toISOString()

  console.log(`Running ${CASES.length} cases × ${REPEATS} repeats on ${models.length} models…`)

  // Models run side by side; within a model, requests go one at a time so latencies stay honest.
  const perModel = await Promise.all(
    models.map(async (model) => {
      const runs: Run[] = []

      for (const evalCase of CASES) {
        for (let repeat = 1; repeat <= REPEATS; repeat++) {
          const run = await runOne(model, evalCase, repeat)

          runs.push(run)
          console.log(
            `${model.id.padEnd(30)} ${evalCase.id.padEnd(24)} #${repeat} ${run.checksPassed}/${run.checksTotal} ${run.latencyMs}ms${run.error ? ` ERROR ${run.error}` : ''}`,
          )
        }
      }

      return { model, runs, summary: summarize(runs) }
    }),
  )

  const table = [
    '| Model | Checks passed | Cases fully right | Edits placed | Short reasons | Retries | Errors | Median | p90 | Cost / request |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...perModel.map(
      ({ model, summary }) =>
        `| ${model.label} | ${summary.checks} (${percent(summary.checkRate)}) | ${percent(summary.casesClean)} | ${percent(summary.placementRate)} | ${percent(summary.shortReasonRate)} | ${summary.retries} | ${summary.errors} | ${(summary.medianMs / 1000).toFixed(1)} s | ${(summary.p90Ms / 1000).toFixed(1)} s | $${summary.costPerRequest.toFixed(5)} |`,
    ),
  ].join('\n')

  const matrixHeader = `| Case | ${perModel.map(({ model }) => model.label).join(' | ')} |`
  const matrix = [
    matrixHeader,
    `|---|${perModel.map(() => '---').join('|')}|`,
    ...CASES.map((evalCase) => {
      const cells = perModel.map(({ runs }) => {
        const caseRuns = runs.filter((run) => run.caseId === evalCase.id)
        const passed = caseRuns.reduce((total, run) => total + run.checksPassed, 0)
        const total = caseRuns.reduce((sum, run) => sum + run.checksTotal, 0)

        return `${passed}/${total}`
      })

      return `| ${evalCase.description} | ${cells.join(' | ')} |`
    }),
  ].join('\n')

  await mkdir('evals/results', { recursive: true })

  const file = `evals/results/${startedAt.replace(/[:.]/g, '-')}.json`

  await writeFile(file, JSON.stringify({ startedAt, repeats: REPEATS, results: perModel }, null, 2))

  console.log(`\n${table}\n\n${matrix}\n\nFull results: ${file}`)
}

await main()
