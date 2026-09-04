import { chromium } from 'playwright-core'
const [url, out, w = '1673', h = '939'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)))
await page.goto(`http://localhost:5173/${url}`, { waitUntil: 'load' })
await page.waitForFunction(() => window.__stage !== undefined, { timeout: 30000 })
await page.waitForTimeout(3400)
for (let i = 0; i < 5; i += 1) {
  const cc = page.locator('.release__catch')
  if (await cc.count()) { await cc.first().click({ force: true }).catch(() => {}); await page.waitForTimeout(300) }
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || '').trim()
      if (/^\[?\s*(RELEASE|CLOSE|OK|CONTINUE|DISMISS)/i.test(t)) b.click()
    }
  })
  await page.waitForTimeout(150)
}
await page.screenshot({ path: out })
await browser.close()
console.log(out)
