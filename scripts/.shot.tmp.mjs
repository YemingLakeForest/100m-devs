import { chromium } from 'playwright-core'
const [url, out, clip] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 997, height: 448 }, deviceScaleFactor: 3 })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)))
await page.goto(`http://localhost:5173/${url}`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__stage !== undefined, { timeout: 30000 })
await page.waitForTimeout(3200)
const clearModals = async () => {
  for (let i = 0; i < 5; i += 1) {
    const c = page.locator('.release__catch')
    if (await c.count()) { await c.first().click({ force: true }).catch(() => {}); await page.waitForTimeout(350) }
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        const t = (b.textContent || '').trim()
        if (/^\[?\s*(RELEASE|CLOSE|OK|CONTINUE|DISMISS)/i.test(t)) b.click()
      }
    })
    await page.waitForTimeout(200)
  }
}
await clearModals()
if (!process.env.NOTEAM) {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if ((b.textContent || '').trim().includes('TEAM')) { b.click(); return }
  })
  await page.waitForTimeout(2400)
}
await clearModals()
const opts = { path: out }
if (clip) { const [x, y, w, h] = clip.split(',').map(Number); opts.clip = { x, y, width: w, height: h } }
await page.screenshot(opts)
await browser.close()
console.log(out)
