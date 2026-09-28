/**
 * The brainstorm page's pictures: every option at the same headcounts, from the
 * built demo, in one headless Chrome. Testing / docs only.
 *
 *   node tools/gallery.mjs <outDir>
 */
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
mkdirSync(out, { recursive: true })
/** `G2G_ONLY=net-find,proxima` re-shoots just those. */
const only = process.env.G2G_ONLY ? new Set(process.env.G2G_ONLY.split(',')) : null
const shots = [
  ['near-40', 'o=monitor&n=40', '', 2500],
  ['near-2000', 'o=planet&n=2000', 'g.lens.dist = 150', 2500],
  ['a-city', 'o=monitor&n=60000', 'g.lens.dist = 900', 3000],
  ['a-planet', 'o=monitor&n=30000000', 'g.lens.dist = 14000', 3000],
  // The colony network, on the monitor.
  ['a-network', 'o=monitor&n=1000000000', '', 2500],
  ['net-streams', 'o=monitor&n=1000000000', "g.action('auto')", 1600],
  ['net-start', 'o=monitor&n=1', "g.action('goto:network')", 6000],
  ['net-launch', 'o=monitor&n=100000000', "g.action('launch'); await new Promise((r) => setTimeout(r, 16000)); g.action('goto:network')", 5000],
  ['net-full', 'o=monitor&n=10000000000', '', 2500],
  ['net-card', 'o=monitor&n=1000000000', 'g.systemCard(g.net.order[4])', 1200],
  ['net-descend', 'o=monitor&n=1000000000', 'const p = g.netView.position(g.net.order[5]); g.lens.offset.set(p.x, 0, p.z); for (let i = 0; i < 70; i++) { g.lens.zoomAt(0.9, g.camera, null); await new Promise((r) => requestAnimationFrame(r)) }', 2500],
  ['net-find', 'o=monitor&n=1000000000', 'g.findSeat(677144012)', 7000],
  ['b-city', 'o=planet&n=60000', 'g.lens.dist = 1600', 2500],
  ['b-planet', 'o=planet&n=30000000', 'g.lens.dist = 14000', 2500],
  ['b-full', 'o=planet&n=100000000', 'g.lens.dist = 14000', 2500],
  ['c-city', 'o=swarm&n=2000000', 'g.lens.dist = 380', 3500],
  ['c-planet', 'o=swarm&n=30000000', 'g.lens.dist = 14000', 3500],
  ['d-block', 'o=dioramas&n=3000', "g.action('rung:block')", 3000],
  ['d-district', 'o=dioramas&n=3000000', "g.action('rung:district')", 3000],
  ['d-city', 'o=dioramas&n=3000000', "g.action('rung:city')", 3000],
  ['find', 'o=planet&n=30000000', "g.action('find')", 7000],
  ['crossing', 'o=planet&n=100000000', "g.action('launch')", 10500],
  ['proxima', 'o=planet&n=100000000', "g.action('launch')", 21000],
]
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })
for (const [name, query, script, wait] of shots) {
  if (only && !only.has(name)) continue
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(`http://127.0.0.1:5173/docs/demos/garage-to-galaxy-2026-09-27/${process.env.G2G_PAGE || 'play.html'}?${query}`)
  await page.waitForFunction(() => globalThis.__g2g, null, { timeout: 90_000 })
  await page.waitForTimeout(1200)
  if (script) await page.evaluate(`(async () => { const g = window.__g2g; ${script} })()`)
  await page.waitForTimeout(wait)
  const png = await page.screenshot()
  await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(join(out, `${name}.jpg`))
  console.log(name)
  await page.close()
}
await browser.close()
