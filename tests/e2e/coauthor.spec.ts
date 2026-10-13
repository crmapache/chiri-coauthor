import { expect, test } from '@playwright/test'

import { editorText, mockSuggest, selectLine } from './helpers'

const LOOSE = {
  quote: 'they loose whatever',
  replacement: 'they lose whatever',
  reason: '"Loose" is not a verb.',
}
const HAS = { quote: 'field has been', replacement: 'field have been', reason: 'Plural subject.' }

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cm-content')).toContainText('Offline mode: launch plan')
})

test('a quick action turns into tracked changes that can be accepted and undone', async ({
  page,
}) => {
  const requests = await mockSuggest(page, [HAS, LOOSE])

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()

  await expect(page.getByTestId('suggestion-card')).toHaveCount(2)
  expect(requests[0]).toMatchObject({
    mode: 'selection',
    instruction: expect.stringContaining('grammar'),
  })
  await expect(page.locator('.cm-suggestion-removed', { hasText: 'loose' })).toBeVisible()

  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')

  await expect(page.getByTestId('suggestion-card')).toHaveCount(0)
  expect(await editorText(page)).toContain('field have been asking')
  expect(await editorText(page)).toContain('they lose whatever')

  await page.keyboard.press('ControlOrMeta+z')

  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)
  expect(await editorText(page)).toContain('they loose whatever')
})

test('rejecting leaves the text alone', async ({ page }) => {
  await mockSuggest(page, [LOOSE])

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await page.getByTitle('Reject (Shift+Tab)').click()

  await expect(page.getByTestId('suggestion-card')).toHaveCount(0)
  expect(await editorText(page)).toContain('they loose whatever')
})

test('typing inside a suggested span withdraws the suggestion', async ({ page }) => {
  await mockSuggest(page, [LOOSE])

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)

  await page.locator('.cm-suggestion-removed', { hasText: 'loose' }).click()
  await page.keyboard.type('x')

  await expect(page.getByTestId('suggestion-card')).toHaveCount(0)
})

test('edits land in the right place even if the writer typed while waiting', async ({ page }) => {
  await mockSuggest(page, [LOOSE], { delayMs: 800 })

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()

  // Type at the very top of the document while the model is "thinking".
  await page.keyboard.press('ControlOrMeta+Home')
  await page.keyboard.type('Draft: ')

  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)
  await page.getByTitle('Accept (Tab)').click()

  const text = await editorText(page)

  expect(text.startsWith('# Draft: ') || text.startsWith('Draft: ')).toBe(true)
  expect(text).toContain('they lose whatever')
})

test('Escape cancels the request in flight', async ({ page }) => {
  await mockSuggest(page, [LOOSE], { delayMs: 1500 })

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await expect(page.getByText('Fix grammar…')).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByText('Fix grammar…')).toBeHidden()
  await page.waitForTimeout(1800)
  await expect(page.getByTestId('suggestion-card')).toHaveCount(0)
})

test('a refinement adds a version that can be flipped back', async ({ page }) => {
  await mockSuggest(page, (request) =>
    request.mode === 'refine'
      ? [{ quote: LOOSE.quote, replacement: 'they lose everything', reason: 'Shorter.' }]
      : [LOOSE],
  )

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await page.getByRole('button', { name: 'Shorter' }).click()

  await expect(page.getByTestId('suggestion-card')).toContainText('2/2')
  await expect(page.locator('.cm-suggestion-added', { hasText: 'everything' })).toBeVisible()

  await page.getByTitle('Previous version').click()

  await expect(page.getByTestId('suggestion-card')).toContainText('1/2')
  await expect(page.locator('.cm-suggestion-added', { hasText: 'lose' })).toBeVisible()
})

test('review of the whole document and accept all', async ({ page }) => {
  const requests = await mockSuggest(page, [HAS, LOOSE], { note: 'Two fixes.' })

  await page.getByRole('button', { name: 'Review document' }).click()

  await expect(page.getByTestId('suggestion-card')).toHaveCount(2)
  await expect(page.getByTestId('notice')).toContainText('Two fixes.')
  expect(requests[0]).toMatchObject({ mode: 'document' })

  await page.getByRole('button', { name: 'Accept all' }).click()

  expect(await editorText(page)).toContain('field have been asking')
  expect(await editorText(page)).toContain('they lose whatever')
})

test('a server error is shown and the editor keeps working', async ({ page }) => {
  await page.route('**/api/suggest', (route) =>
    route.fulfill({
      status: 402,
      json: {
        error: { code: 'budget-exhausted', message: 'The AI budget for this demo is used up.' },
      },
    }),
  )

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Improve' }).click()

  await expect(page.getByTestId('notice')).toContainText('budget for this demo is used up')

  await page.locator('.cm-content').click()
  await page.keyboard.type('still typing')

  expect(await editorText(page)).toContain('still typing')
})

test('Accept and Reject buttons on a card leave Mod-Z working', async ({ page }) => {
  await mockSuggest(page, [HAS, LOOSE])

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await page.getByTitle('Accept (Tab)').first().click()
  await page.getByTitle('Reject (Shift+Tab)').first().click()

  await expect(page.getByTestId('suggestion-card')).toHaveCount(0)
  expect(await editorText(page)).toContain('field have been asking')

  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)

  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByTestId('suggestion-card')).toHaveCount(2)
  expect(await editorText(page)).toContain('field has been asking')
})

test('after a review, Tab accepts straight away', async ({ page }) => {
  await mockSuggest(page, [HAS, LOOSE])

  await page.getByRole('button', { name: 'Review document' }).click()
  await expect(page.getByTestId('suggestion-card')).toHaveCount(2)

  await page.keyboard.press('Tab')

  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)
  expect(await editorText(page)).toContain('field have been asking')
})

test('Mod-K on a selection asks a free-form question about it', async ({ page }) => {
  const requests = await mockSuggest(page, [LOOSE])

  await selectLine(page, 'Our customers')
  await page.keyboard.press('ControlOrMeta+k')
  await page
    .getByPlaceholder('Tell your co-author what to do with this text…')
    .fill('Fix the spelling')
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('suggestion-card')).toContainText('Ask: Fix the spelling')
  expect(requests[0]).toMatchObject({ mode: 'selection', instruction: 'Fix the spelling' })
})

test('Mod-K with nothing selected goes to the whole-document question', async ({ page }) => {
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.press('ControlOrMeta+k')

  await expect(page.getByPlaceholder('Ask about the whole document…')).toBeFocused()
})

test('a new request replaces the one in flight', async ({ page }) => {
  const requests = await mockSuggest(
    page,
    (request) => (request.mode === 'document' ? [HAS] : [LOOSE]),
    { delayMs: 700 },
  )

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await page.getByRole('button', { name: 'Review document' }).click()

  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)
  await page.waitForTimeout(900)

  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)
  await expect(page.locator('.cm-suggestion-added', { hasText: 'have' })).toBeVisible()
  expect(requests.map((request) => request.mode)).toEqual(['selection', 'document'])
})

test('a selection of blank lines gets no menu', async ({ page }) => {
  await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.cm-line')]
    const blank = lines.find((line) => line.textContent === '')

    if (!blank) throw new Error('No blank line')

    document.querySelector<HTMLElement>('.cm-content')?.focus()

    const range = document.createRange()

    range.setStart(blank, 0)
    range.setEnd(blank, 0)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
  })
  await page.keyboard.press('Shift+ArrowDown')

  await expect(page.getByTestId('selection-menu')).toHaveCount(0)
})

test('edits the server could not place are reported, not shown', async ({ page }) => {
  await mockSuggest(page, [LOOSE], { skipped: 2 })

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Improve' }).click()

  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)
  await expect(page.getByTestId('notice')).toContainText('2 suggestions skipped')
})

test('Tab does nothing to a suggestion while it is being rewritten', async ({ page }) => {
  await mockSuggest(
    page,
    (request) =>
      request.mode === 'refine'
        ? [{ quote: LOOSE.quote, replacement: 'they lose it all', reason: 'Shorter.' }]
        : [LOOSE],
    { delayMs: 300 },
  )

  await selectLine(page, 'Our customers')
  await page.getByRole('button', { name: 'Fix grammar' }).click()
  await expect(page.getByTestId('suggestion-card')).toHaveCount(1)

  await page.getByTestId('suggestion-card').click({ position: { x: 20, y: 60 } })
  await page.getByRole('button', { name: 'Shorter' }).click()
  await page.locator('.cm-content').focus()
  await page.keyboard.press('Tab')

  await expect(page.getByTestId('suggestion-card')).toContainText('2/2')
  expect(await editorText(page)).toContain('they loose whatever')
})
