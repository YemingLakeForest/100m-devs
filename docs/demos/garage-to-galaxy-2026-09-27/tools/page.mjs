/** One look at the brief page, full length. Testing only. */
import { chromium } from 'playwright-core'
const [out, w = '1280'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: Number(w), height: 900 } })
await page.goto('http://127.0.0.1:5173/docs/demos/garage-to-galaxy-2026-09-27/dist/index.html')
await page.waitForTimeout(1500)
await page.screenshot({ path: out, fullPage: true })
console.log(JSON.stringify(await page.evaluate(() => ({ h: document.body.scrollHeight, overflowX: document.documentElement.scrollWidth > innerWidth, font: document.fonts.check('11px "Departure Mono"') }))))
await browser.close()
