/**
 * §7.8.0 Loop 8 — **is every developer still individually reachable?**
 *
 *   node scripts/reach.probe.mjs [devs] [width] [height]
 *
 * The implementation brief asks this by name, and it is not a question the unit
 * tests can answer: seat positions being distinct in the plan says nothing about
 * whether a finger can land on each of them once they are drawn, scaled by the
 * camera and half-covered by the desk in front. §7.8.0c's facing pods made that
 * a live question rather than a formality — half of every pod now sits behind a
 * monitor drawn *in front of* it.
 *
 * So this sweeps the canvas the way a player's thumb would, asks `__pick` at
 * every point, and counts how many distinct seats answer. It also reads the
 * frame rate the room is holding, because the brief asks for that at a hundred
 * and the same page visit can supply both.
 *
 * Same family as `__room` and `__pick`: a question about the drawn result, asked
 * of the drawn result.
 */
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const devs = Number(process.argv[2] ?? 101)
const width = Number(process.argv[3] ?? 1280)
const height = Number(process.argv[4] ?? 720)
const port = Number(process.env.REACH_PORT ?? 5183)
const origin = `http://localhost:${port}`

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(origin)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('dev server did not start')
}

const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
  shell: true,
})

try {
  await waitForServer()
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(`${origin}/?notitle&full&nopost&devs=${devs}`, { waitUntil: 'load' })
  await page.waitForFunction(() => globalThis.__pick != null, { timeout: 30_000 })
  // Long enough for the arrival cascade to finish and every seat to be drawn.
  await page.waitForTimeout(6000)

  const seen = await page.evaluate(() => {
    const found = new Set()
    // Four-pixel step: finer than a fingertip, so a seat this misses is a seat
    // no thumb could find either.
    for (let y = 4; y < window.innerHeight - 4; y += 4) {
      for (let x = 4; x < window.innerWidth - 4; x += 4) {
        const hit = globalThis.__pick?.(x, y)
        if (hit && hit.rung <= 2) found.add(`${hit.rung}:${hit.index}`)
      }
    }
    return [...found]
  })

  const fps = await page.evaluate(async () => {
    let frames = 0
    const start = performance.now()
    await new Promise((done) => {
      const tick = () => {
        frames += 1
        if (performance.now() - start > 2000) done()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    return Math.round((frames * 1000) / (performance.now() - start))
  })

  await browser.close()
  console.log(`reach at ${devs} devs, ${width}x${height}: ${seen.length} distinct units pickable`)
  console.log(`frame rate: ${fps} fps`)
} finally {
  server.kill()
}
