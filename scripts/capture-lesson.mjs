/**
 * Screenshot a real KnowledgeLab lesson in desktop and phone sizes.
 * Run after starting the local Vite server.
 *
 * Screenshots are artifacts for HUMAN/independent visual reading: the script
 * never claims to have inspected them or evaluated learning outcomes.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

function parseArgs(args) {
  const [target, ...rest] = args
  const outIdx = rest.indexOf('--out')
  const out = outIdx === -1 ? '.tutorial-review/latest' : rest[outIdx + 1]
  if (!target || !out || (outIdx !== -1 && !rest[outIdx + 1])) {
    throw new Error('Usage: node scripts/capture-lesson.mjs http://127.0.0.1:5173/courses/<course>/<chapter> --out .tutorial-review/topic')
  }
  const url = new URL(target)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Capture only local development URLs; do not send lesson evidence to external hosts.')
  }
  return { url: url.href, out: path.resolve(out) }
}

const { url, out } = parseArgs(process.argv.slice(2))
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = { url, time: new Date().toISOString(), screenshotsCreated: [], manuallyInspected: false, devices: [] }
let hasFailure = false

try {
  for (const [name, size] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['phone', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', err => errors.push(String(err)))
    // External web fonts should not block offline/local lesson reviews.
    await page.route('https://fonts.googleapis.com/**', route => route.abort())
    await page.route('https://fonts.gstatic.com/**', route => route.abort())
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.locator('.lesson-article h1').waitFor({ state: 'visible', timeout: 45_000 })
      await page.locator('.lesson-article').scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(out, name + '-full.png'), fullPage: true, animations: 'disabled', timeout: 45_000 })
      report.screenshotsCreated.push(name + '-full.png')

      const figures = page.locator('.lesson-article [data-concept-figure]')
      const count = await figures.count()
      for (let i = 0; i < count; i++) {
        const figure = figures.nth(i)
        const slug = String(await figure.getAttribute('data-concept-figure') || 'figure')
          .replace(/[^a-z0-9_-]/gi, '-').slice(0, 50)
        const file = name + '-figure-' + String(i + 1).padStart(2, '0') + '-' + slug + '.png'
        await figure.scrollIntoViewIfNeeded()
        await figure.screenshot({ path: path.join(out, file), animations: 'disabled', timeout: 30_000 })
        report.screenshotsCreated.push(file)
      }
      const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth))
      report.devices.push({ name, viewport: size, figures: count, overflowPx, errors })
      if (overflowPx > 1 || errors.length > 0) hasFailure = true
      console.log(name + ': ' + count + ' figures; horizontal overflow ' + overflowPx + 'px; page errors ' + errors.length)
    } catch (error) {
      report.devices.push({ name, error: String(error), errors })
      hasFailure = true
      console.error(name + ' capture failed:', error)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  await fs.writeFile(path.join(out, 'capture-report.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log('Screenshots: ' + out)
console.log('WARNING: images were captured but not visually inspected. Open the PNG files and review their meaning, layout and labels.')
if (hasFailure) process.exitCode = 1
