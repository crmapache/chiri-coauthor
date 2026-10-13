import type { Page, Route } from '@playwright/test'

import type { SuggestRequest, SuggestResponse } from '../../shared/contract'

export type MockEdit = { quote: string; replacement: string; reason: string }

/** Selects one whole line of the document, the way a writer would by triple-clicking it. */
export async function selectLine(page: Page, startsWith: string) {
  await page.evaluate((prefix) => {
    const line = [...document.querySelectorAll('.cm-line')].find((element) =>
      element.textContent?.startsWith(prefix),
    )

    if (!line) throw new Error(`No line starts with "${prefix}"`)

    const content = document.querySelector<HTMLElement>('.cm-content')
    const range = document.createRange()

    content?.focus()
    range.selectNodeContents(line)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  }, startsWith)
}

export function editorText(page: Page) {
  return page.locator('.cm-content').evaluate((element) =>
    [...element.querySelectorAll('.cm-line')]
      .map((line) => {
        const clone = line.cloneNode(true) as HTMLElement

        // Inserted text of a suggestion is drawn in the line but is not part of the document.
        clone.querySelectorAll('.cm-suggestion-added').forEach((widget) => widget.remove())

        return clone.textContent
      })
      .join('\n'),
  )
}

/**
 * Answers `/api/suggest` like the real server would: quotes are located in the document the
 * request carried, so positions match what the client sent.
 */
export async function mockSuggest(
  page: Page,
  edits: MockEdit[] | ((request: SuggestRequest) => MockEdit[]),
  options: { delayMs?: number; note?: string } = {},
) {
  const requests: SuggestRequest[] = []

  await page.route('**/api/suggest', async (route: Route) => {
    const request = route.request().postDataJSON() as SuggestRequest

    requests.push(request)

    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs))

    const chosen = typeof edits === 'function' ? edits(request) : edits
    const body: SuggestResponse = {
      edits: chosen.map((edit) => {
        const from = request.document.indexOf(edit.quote)

        return { ...edit, from, to: from + edit.quote.length }
      }),
      note: options.note ?? '',
      skipped: 0,
      model: 'mock/model',
    }

    await route.fulfill({ json: body }).catch(() => {
      // The page cancelled the request while we were "thinking".
    })
  })

  return requests
}