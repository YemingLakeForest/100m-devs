/**
 * What the build actually does at a hundred million developers — GDD §26.2.
 *
 * **An instrument, not a gate.** It is not in `npm run check` and it must not
 * be: it reports numbers rather than asserting them, in the same family as
 * `?bench`, and its whole value is that somebody can re-measure in one command
 * instead of rebuilding the harness from scratch. That is not a hypothetical —
 * the measurement this file automates was built by hand on 2026-08-18 to write
 * `docs/PLAN-2026-08-18-phase2.md`, and finding 2.1 of that plan is what
 * happens when a section describing the build is four days older than the
 * build.
 *
 *   node scripts/scale.probe.mjs            # both sweeps
 *   node scripts/scale.probe.mjs headcount  # just the decades
 *   node scripts/scale.probe.mjs ladder     # just the rungs, at the gate
 *
 * ## Read the caveat before the numbers
 *
 * This is headless Chrome on whatever machine ran it, **vsync-capped at 60**.
 * A median of 59.9 everywhere means *no case is stressed*; it does not mean
 * there is headroom, and it cannot tell comfortable from marginal. §23.3's own
 * status table already records criteria 3 and 4 as "measured on a flagship only
 * — effectively unmeasured for the target audience", and nothing here changes
 * that. **What this can prove is the absence of a cliff**: that nothing between
 * 10³ and 10⁸ throws, stalls, NaNs, or fails to draw.
 *
 * ## Two things it learned the hard way, both worth keeping
 *
 * **1. `?z` loses a race with the boot scene.** `App.tsx` applies it after
 * `createStage` resolves, and §10.7a's dialogue camera then dollies to rung 0
 * and restores the z it saved on the way in. So the lens is driven by wheeling,
 * not by the flag.
 *
 * **2. A real `page.mouse.wheel` does not reach the canvas while anything is
 * talking.** §10.7a.3's scrim owns the pointer, and §18.0a's bait scene re-arms
 * itself in a synthetic state — so a wheel aimed at the middle of the screen
 * lands on a `div` and the camera never moves, silently, exactly like trap 44.
 * The wheel is dispatched on the canvas element and {@link wheelTo} **fails
 * loudly** if the rung did not change.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'

const only = process.argv[2] ?? 'both'
const port = Number(process.env.PROBE_PORT ?? 5211)
const origin = `http://127.0.0.1:${port}`
/** §23.4.2's largest frame — the one §13.7.1a was measured at. */
const VIEWPORT = { width: 997, height: 448 }
/** §13.5's gate, and the number the game is named after. */
const GATE = 100_000_000

const vite = path.resolve('node_modules/vite/bin/vite.js')
const server = spawn(
  process.execPath,
  [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
)
let serverLog = ''
server.stdout.on('data', (chunk) => { serverLog += String(chunk) })
server.stderr.on('data', (chunk) => { serverLog += String(chunk) })

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Vite did not start.\n${serverLog}`)
}

/** Frame times over `ms`, as the two percentiles §23.3 criteria 3–5 speak in. */
function sampleFrames(page, ms = 2500) {
  return page.evaluate(
    (window) =>
      new Promise((resolve) => {
        const gaps = []
        let last = performance.now()
        const t0 = last
        const step = (now) => {
          gaps.push(now - last)
          last = now
          if (now - t0 < window) requestAnimationFrame(step)
          else {
            const sorted = gaps.sort((a, b) => a - b)
            const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
            resolve({ median: 1000 / at(50), low: 1000 / at(95), samples: sorted.length })
          }
        }
        requestAnimationFrame(step)
      }),
    ms,
  )
}

/** Play out whatever the game is saying, so the scrim stops owning the pointer. */
async function settle(page) {
  for (let i = 0; i < 60; i += 1) {
    const scene = await page.evaluate(() => window.__store?.scene?.id ?? null)
    if (scene === null) return
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(350)
  }
}

/**
 * Wheel the lens and **assert it moved**.
 *
 * The assertion is the point — see the header. A loop that presses something
 * must check the pressing worked, not that it finished.
 */
async function wheelTo(page, ticks) {
  const before = await page.evaluate(() => window.__stage?.z ?? 0)
  await page.evaluate((n) => {
    const canvas = document.querySelector('canvas')
    for (let i = 0; i < n; i += 1) {
      canvas.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 40, clientX: 500, clientY: 240, bubbles: true, cancelable: true }),
      )
    }
  }, ticks)
  await page.waitForTimeout(1100)
  const after = await page.evaluate(() => window.__stage?.z ?? 0)
  return { before, after, moved: Math.abs(after - before) > 1e-6 }
}

async function openPage(browser, query) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`))
  await page.goto(`${origin}/?${query}`, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__stage !== undefined, { timeout: 30_000 })
  await page.waitForTimeout(2000)
  return { context, page, errors }
}

function print(title, rows) {
  console.log(`\n=== ${title} ===`)
  console.table(rows)
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ channel: 'chrome', headless: true })

  if (only === 'both' || only === 'headcount') {
    const rows = []
    for (const devs of [1e3, 1e4, 1e5, 1e6, 1e7, GATE]) {
      const { context, page, errors } = await openPage(browser, `devs=${devs}`)
      const frames = await sampleFrames(page)
      const stage = await page.evaluate(() => window.__stage)
      rows.push({
        devs,
        ceilingRung: stage?.ceilingRung,
        view: stage?.view,
        medianFps: +frames.median.toFixed(1),
        lowFps: +frames.low.toFixed(1),
        errors: errors.length,
      })
      await context.close()
    }
    print('the room, at every decade', rows)
  }

  if (only === 'both' || only === 'ladder') {
    const { context, page, errors } = await openPage(browser, `act=act2_loop&devs=${GATE}`)
    await settle(page)
    const rows = []
    const record = async (label) => {
      const frames = await sampleFrames(page)
      const stage = await page.evaluate(() => window.__stage)
      rows.push({
        label,
        z: stage?.z,
        rung: stage?.rung,
        view: stage?.view,
        tierPx: stage?.tierPx,
        medianFps: +frames.median.toFixed(1),
        lowFps: +frames.low.toFixed(1),
      })
    }
    await record('room')
    for (let step = 1; step <= 6; step += 1) {
      const { moved, before, after } = await wheelTo(page, 6)
      if (!moved) {
        // Not a warning. Every line of §26.2.5 begins by moving the lens, so a
        // lens that did not move makes every number below it a lie about a
        // picture nobody changed.
        console.error(`\nFAILED: the lens did not move at step ${step} (z ${before} -> ${after}).`)
        console.error('Something is over the canvas, or the ceiling has been reached early.')
        break
      }
      await record(`out ${step}`)
    }
    print(`the ladder, at ${GATE.toLocaleString()} developers`, rows)
    if (errors.length > 0) console.log('errors:', [...new Set(errors)].slice(0, 8))
    await context.close()
  }

  console.log(
    '\nHeadless Chrome, vsync-capped at 60. A median of 59.9 means nothing is stressed;',
  )
  console.log('it does not mean there is headroom. See this file’s header, and GDD §23.3.\n')
} finally {
  if (browser) await browser.close()
  server.kill()
}
