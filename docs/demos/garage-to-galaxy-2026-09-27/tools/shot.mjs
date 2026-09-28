/**
 * Look at the demo without a visible window: a headless Chrome (the same
 * launch the repo's frame gate uses), a scenario, a frame-rate reading and a
 * screenshot. Testing only.
 *
 *   node tools/shot.mjs <out.png> "<query>" "<js with g = window.__g2g>" [waitMs] [w] [h]
 */
import { chromium } from 'playwright-core'

const [out, query = 'o=monitor', script = '', wait = '1500', w = '1500', h = '844'] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`http://127.0.0.1:5173/docs/demos/garage-to-galaxy-2026-09-27/${process.env.G2G_PAGE || 'play.html'}?${query}`)
await page.waitForFunction(() => globalThis.__g2g, null, { timeout: 60_000 })
await page.waitForTimeout(1200)
if (script) await page.evaluate(`(async () => { const g = window.__g2g; ${script} })()`)
await page.waitForTimeout(Number(wait))
const info = await page.evaluate(async () => {
  const gl = document.querySelector('canvas').getContext('webgl2')
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
  let frames = 0
  const t0 = performance.now()
  await new Promise((r) => { const f = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r() }; requestAnimationFrame(f) })
  const g = window.__g2g
  return { fps: +(frames / 2).toFixed(1), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?', N: g.N, dist: Math.round(g.lens.dist) }
})
await page.screenshot({ path: out })
console.log(JSON.stringify({ ...info, errors: errors.slice(0, 5) }))
await browser.close()
