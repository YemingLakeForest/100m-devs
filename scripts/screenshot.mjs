/**
 * Take a full-frame screenshot of the running game.
 *
 *   node scripts/screenshot.mjs <url> <out.png> [width] [height] [script]
 *   WAIT=9000 node scripts/screenshot.mjs http://localhost:5180/ shot.png 1280 620
 *
 * Exists because the browser-extension capture silently clipped the right ~7%
 * of the viewport, which is where the CASH / DEVS / SHIPPED rail lives — so
 * every screenshot taken for review was missing a readout, and it took a while
 * to notice that was the tool rather than the layout.
 *
 * Uses the installed Chrome via playwright-core's `channel`, so there is no
 * browser binary to download. `deviceScaleFactor: 2` because the art is pixel
 * work and a 1x capture of it is a smear.
 *
 * `WAIT` matters more than it looks. §10.7's typewriter runs at 28 characters a
 * second and Act III's advisor line is about 150 characters, so a capture at
 * 2.5s shows half a sentence and reads exactly like clipped copy. It is not.
 * Give any screen with script on it ten seconds.
 */
import { chromium } from 'playwright-core'

const [url, out, w, h, script] = process.argv.slice(2)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
})

await page.goto(url, { waitUntil: 'load' })
// The title screen boots, the stage builds, the room lays out. Generous, because
// this runs once and a blank frame is worse than a slow one.
await page.waitForTimeout(Number(process.env.WAIT ?? 2500))
if (script) {
  await page.evaluate(script)
  await page.waitForTimeout(1400)
}
await page.screenshot({ path: out })
await browser.close()
console.log(out)
