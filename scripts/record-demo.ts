/**
 * Records the README demo against the running dev server with the real model.
 * Start `pnpm dev`, then run `npx tsx scripts/record-demo.ts`. It writes docs/demo.webm;
 * docs/demo.gif is made from it with ffmpeg (see the command at the bottom).
 */
import { rename } from 'node:fs/promises'

import { chromium, type Page } from '@playwright/test'

const URL = process.env.DEMO_URL ?? 'http://localhost:3020'

/** Draws the mouse pointer and pressed keys, which a headless recording otherwise does not show. */
const OVERLAY = `
  window.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style')
    style.textContent = \`
      #demo-cursor { position: fixed; z-index: 99999; width: 18px; height: 18px; margin: -9px 0 0 -9px;
        border-radius: 50%; background: rgba(47,63,209,.35); border: 2px solid #2f3fd1; pointer-events: none;
        transition: transform .08s; }
      #demo-cursor.down { transform: scale(.7); }
      #demo-key { position: fixed; z-index: 99999; right: 24px; bottom: 24px; padding: 6px 12px; border-radius: 8px;
        background: #1d1b18; color: #fff; font: 600 15px Inter, system-ui; opacity: 0; transition: opacity .2s; }
      #demo-key.on { opacity: .9; }\`
    document.head.append(style)
    const cursor = Object.assign(document.createElement('div'), { id: 'demo-cursor' })
    const key = Object.assign(document.createElement('div'), { id: 'demo-key' })
    document.body.append(cursor, key)
    let timer
    addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => cursor.classList.add('down'), true)
    addEventListener('mouseup', () => cursor.classList.remove('down'), true)
    addEventListener('keydown', (e) => {
      if (!['Tab', 'Escape'].includes(e.key) && !e.metaKey) return
      key.textContent = (e.shiftKey ? '⇧ ' : '') + (e.metaKey ? '⌘ ' : '') + (e.key === 'Meta' ? '' : e.key.toUpperCase().length === 1 ? e.key.toUpperCase() : e.key)
      key.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => key.classList.remove('on'), 700)
    }, true)
  })
`

const pause = (page: Page, ms: number) => page.waitForTimeout(ms)

async function selectLine(page: Page, prefix: string) {
  const line = page.locator('.cm-line', { hasText: prefix }).first()
  const box = await line.boundingBox()

  if (!box) throw new Error(`Line "${prefix}" is not visible`)

  // Drag across the paragraph like a person would, so the pointer shows what happens.
  await page.mouse.move(box.x + 2, box.y + 12, { steps: 12 })
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 4, box.y + box.height - 10, { steps: 25 })
  await page.mouse.up()
}

async function clickSlowly(page: Page, selector: string) {
  const target = page.locator(selector).first()
  const box = await target.boundingBox()

  if (!box) throw new Error(`${selector} is not visible`)

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 })
  await pause(page, 250)
  await target.click()
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
    recordVideo: { dir: 'docs/.video', size: { width: 1280, height: 760 } },
  })

  await context.addInitScript(OVERLAY)

  const page = await context.newPage()

  await page.goto(URL)
  await page.locator('.cm-content').waitFor()
  await pause(page, 1200)

  await selectLine(page, 'Our customers')
  await pause(page, 700)
  await clickSlowly(page, 'button:has-text("Fix grammar")')
  await page.getByTestId('suggestion-card').first().waitFor({ timeout: 30_000 })
  await pause(page, 2200)

  await page.keyboard.press('Tab')
  await pause(page, 1200)
  await page.keyboard.press('Tab')
  await pause(page, 1200)

  await clickSlowly(page, 'button:has-text("Review document")')
  await page.getByTestId('suggestion-card').first().waitFor({ timeout: 30_000 })
  await pause(page, 2500)

  await clickSlowly(page, '[data-testid="suggestion-card"]')
  await pause(page, 600)
  await clickSlowly(page, 'button:has-text("Shorter")')
  await page.getByText(/2\/2/).first().waitFor({ timeout: 30_000 })
  await pause(page, 2200)

  await clickSlowly(page, 'button:has-text("Accept all")')
  await pause(page, 1500)

  await page.keyboard.press('Meta+z')
  await pause(page, 1800)

  const video = page.video()

  await context.close()
  await browser.close()

  await rename((await video?.path()) as string, 'docs/demo.webm')
}

await main()

// ffmpeg -y -i docs/demo.webm -vf "fps=12,scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" docs/demo.gif
