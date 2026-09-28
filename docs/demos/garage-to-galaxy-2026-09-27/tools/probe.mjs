/**
 * Evaluate an expression in the running demo and print it. Testing only.
 *
 *   node tools/probe.mjs "<query>" "<async js body with g = window.__g2g, returning a value>"
 */
import { chromium } from 'playwright-core'

const [query = 'o=monitor', body = 'return g.N'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] })
const page = await browser.newPage({ viewport: { width: 900, height: 506 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`http://127.0.0.1:5173/docs/demos/garage-to-galaxy-2026-09-27/play.html?${query}`)
await page.waitForFunction(() => globalThis.__g2g, null, { timeout: 60_000 })
await page.waitForTimeout(800)
const out = await page.evaluate(`(async () => { const g = window.__g2g; ${body} })()`)
console.log(JSON.stringify({ out, errors }))
await browser.close()
