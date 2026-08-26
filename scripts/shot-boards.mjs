/**
 * Screenshot the three screens this batch rebuilt.
 *
 *   node scripts/shot-boards.mjs <base-url> <out-dir> [width] [height]
 *
 * The gallery, the hero capability model and the Management board, each opened
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

await tap(page.getByRole('button', { name: 'BACK', exact: true }), 'the gallery BACK')

// --- the hero capability model --------------------------------------------
await tap(page.getByRole('button', { name: 'HERO', exact: true }), 'the HERO door')
await tap(page.locator('.roster__card'), 'the first hero on the strip')
await tap(page.getByRole('button', { name: /^SPEND \d+$/ }), 'SPEND')
await page.locator('.herotree__frame').waitFor()
await page.waitForTimeout(700)
await shot('hero-board')

// The node inspector, which is where the UML box is drawn at full size.
const live = page.locator('.herotree__node[data-state="live"]')
if (await live.count()) {
  await tap(live.first(), 'a live node')
  await page.locator('.herotree__guide-card').waitFor()
  await page.waitForTimeout(300)
  await shot('hero-node')
  await page.locator('.herotree__guide').click({ position: { x: 6, y: 6 } })
  await page.waitForTimeout(300)
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

/*
 * §13.7.1a's known trade: §7.8.10's corner desk starts just above the frame at
 * the opening lens, so the founder cannot be tapped until the room is panned.
 * §7.7.6b's DRAG latch is what a player uses to do it, so it is what this uses
 * — the point of the shot is the screen, but the way in has to be the real one
 * or the shot is not evidence of anything.
 */
await tap(page.locator('.touch__latch', { hasText: 'DRAG' }), 'the DRAG latch')
await page.mouse.move(700, 300)
await page.mouse.down()
for (let i = 1; i <= 12; i += 1) {
  await page.mouse.move(700, 300 + i * 25)
  await page.waitForTimeout(30)
}
await page.mouse.up()
await page.waitForTimeout(900)

// §13.7.1's screen is opened by tapping the founder in the room, which is the
// whole of §4.5d's placement rule — so the shot uses the same door.
await tap(page.locator('.touch__latch', { hasText: 'INFO' }), 'the INFO latch')
const at = await page.evaluate(() => globalThis.__founderAt?.() ?? null)
if (at && at.y > 0) {
  await page.mouse.click(at.x, at.y)
  await page.waitForTimeout(900)
}
if (await page.locator('.founder-profile__tree').count()) {
  await page.waitForTimeout(400)
  await shot('founder-board')
} else {
  console.error('founder board did not open — the lens was not on the floor')
}

await browser.close()
console.log(`\n${shots.length} shots written to ${outDir}`)
