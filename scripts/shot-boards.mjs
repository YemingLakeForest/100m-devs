/**
 * Screenshot the three screens this batch rebuilt.
 *
 *   node scripts/shot-boards.mjs <base-url> <out-dir> [width] [height]
 *
 * The gallery, the hero card (and its tree) and the Management board, each opened
 * the way a player opens it rather than by being rendered in isolation — a
 * board screenshotted out of the HUD is a picture of a component, and every
 * layout defect this project has shipped lived in the gap between the two.
 *
 * ## Why it drives the speed dial
 *
 * The gallery door does not exist until something has shipped, and §21 paces a
 * project in minutes. Rather than seeding a save — which would be a picture of
 * a fixture — this runs the studio at `?speed=60` and waits: one simulated
 * minute a wall second, so a back catalogue of real releases, with real §4.14
 * ratings and real §4.10e tails still paying out, exists inside half a minute.
 * The running lifetime revenue in the shot is therefore genuinely running.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const [base, outDir, w = '1440', h = '900'] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
})

const shots = []
async function shot(name) {
  const path = join(outDir, `${name}.png`)
  await page.screenshot({ path })
  shots.push(path)
  console.log(path)
}

/** A tap that goes through the same pointer path a finger does. */
async function tap(locator, what) {
  if (!(await locator.count())) throw new Error(`nothing to tap: ${what}`)
  await locator.first().click({ timeout: 8000 })
  await page.waitForTimeout(450)
}

/**
 * A scene halts the tick, and `?full` walks straight into one.
 *
 * §10.7's box eats every tap while it is up, so a run that waited on the
 * simulation without clearing a scene would wait for ever — the same trap the
 * §26.1.8 walk documents at `pumpScene`. Tapping the scrim is what a player
 * does, so it is what this does.
 */
async function pumpScenes(page, rounds = 40) {
  for (let i = 0; i < rounds; i += 1) {
    const scene = await page.evaluate(() => globalThis.__store?.scene ?? null)
    if (!scene) return
    const scrim = page.locator('.ui-dialogue__scrim')
    if (!(await scrim.count())) return
    await page.mouse.click(320, 200)
    await page.waitForTimeout(320)
  }
}

/** Let the studio run, clearing anything it says, until `predicate` holds. */
async function until(page, label, predicate, budget = 90_000) {
  const deadline = Date.now() + budget
  for (;;) {
    await pumpScenes(page)
    if (await page.evaluate(predicate)) return
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`)
    await page.waitForTimeout(250)
  }
}

// `?full` is a prestiged studio with the heroes and both boards handed over;
// `?speed=60` is the dial this batch put on the scenario bar, driven from its
// query-string seed so the run does not need a hand on it. `?devs` gives it a
// floor big enough to burn a Run 2 commitment down inside a screenshot run.
await page.goto(`${base}/?notitle&full&speed=60&devs=900&nopost`, { waitUntil: 'load' })
await page.waitForTimeout(2500)

// Ship a back catalogue, so the gallery has §4.10e tails still paying out and
// §4.14 ratings that came from a simulation rather than from a fixture.
await until(page, 'a back catalogue', () => (globalThis.__store?.releases?.length ?? 0) >= 3)
await page.waitForTimeout(1200)

// --- the gallery -----------------------------------------------------------
await tap(page.getByRole('button', { name: 'GALLERY', exact: true }), 'the GALLERY door')
await page.locator('.gallery').waitFor()
// Long enough that the running totals in the shot have visibly moved off the
// figures they were opened on.
await page.waitForTimeout(1200)
await shot('gallery')

// And again part-way back through the career, which is the state the wall is
// actually for: covers fanning away on both sides, and the laurels on whichever
// release earned them.
for (let i = 0; i < 4; i += 1) {
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(220)
}
await page.waitForTimeout(500)
await shot('gallery-slid')

await tap(page.locator('.hud__gallery .os-window__close'), 'the gallery close box')

// --- the hero card ---------------------------------------------------------
// TEAM opens the first card [2026-09-26] — the roster strip went with
// placement — and the card's UPGRADES opens that person's tree once the first
// Paradigm Shift has opened the trees.
await tap(page.getByRole('button', { name: 'TEAM', exact: true }), 'the TEAM anchor')
await page.locator('.herocard__pass').waitFor()
await page.waitForTimeout(700)
await shot('hero-card')
// The tree is on the hero's own screen now [2026-10-13].
if (await page.locator('.herocard .trees__canvas').count()) {
  await page.waitForTimeout(700)
  await shot('hero-tree')
}

// --- the Management board --------------------------------------------------
/*
 * A fresh load rather than closing three panels.
 *
 * §22.9's card stays on screen *behind* the board it opened, deliberately — the
 * board is a thing you do to somebody and losing their face would make the six
 * interchangeable. That is correct and it means the room underneath is covered,
 * so the founder cannot be tapped from here. Reloading is the honest way out:
 * §13.7.1's screen needs no catalogue, so nothing is lost by starting clean.
 */
await page.goto(`${base}/?notitle&full&nopost`, { waitUntil: 'load' })
await page.waitForTimeout(2500)
await pumpScenes(page)
await page.waitForTimeout(600)

// §13.7.1's screen opens from YOU on the rail [2026-10-13]: the touch switch and
// the tap-the-founder door it belonged to are gone.
await tap(page.getByRole('button', { name: 'YOU', exact: true }), 'the YOU door')
await page.waitForTimeout(900)
if (await page.locator('.founder-profile__tree').count()) {
  await page.waitForTimeout(400)
  await shot('founder-board')
} else {
  console.error('founder board did not open')
}

await browser.close()
console.log(`\n${shots.length} shots written to ${outDir}`)
