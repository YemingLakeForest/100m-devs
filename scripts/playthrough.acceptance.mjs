/**
 * §26.1.8's closing gate, walked — the middle of the list, in a real browser.
 *
 * ## Why this file exists
 *
 * §26.1.8 is written as *things a player does, in order, without leaving the
 * game*, and §25.9.4 says why: **a system is not done when its module is done,
 * it is done when a player can reach it.** Two systems in this build were
 * finished, unit-tested and completely unreachable — §13.2's Paradigm Tree
 * behind a dead button, §13.8's placement with no caller — and both passed
 * every test they had, because *a join is invisible to a test that supplies its
 * own left-hand side.*
 *
 * So this is the other kind of test. Nothing here calls a store verb. Every
 * step is a real tap on a real control or on the canvas, every trigger fires
 * off state the walk actually produced, and every assertion is about something
 * that is on screen. Where the run state is read at all it is for the failure
 * message, never for the verdict.
 *
 * `ui-frame.acceptance.mjs` is the geometry gate and this is the reachability
 * gate. Between them: that file owns *is it drawn correctly*, this one owns
 * *can you get to it*, and vitest owns *does it compute the right number*.
 *
 * ## The clock
 *
 * `?speed=N` (see `render/stage.ts`) runs N whole simulation ticks per frame.
 * It is the one accommodation in here and it supplies no left-hand side to
 * anything — it is arithmetically the same as N frames, so the walk passes
 * through every state real play does, in the same order. Without it the walk is
 * half an hour long, and a gate nobody can afford to run is a gate that goes
 * stale, which is exactly how items 2a and 11 sat false for weeks.
 *
 * ## Careers
 *
 * `store.ts` calls `initPersistence()` at module scope, so **a reload continues
 * the career** — the save is read before the first render, by design, because it
 * has to be. Nor can a page end its own career: §24.9's `pagehide` handler saves
 * on the way out, so clearing the storage and reloading restores what was just
 * deleted. A new career is a **new browser context**, and the walk opens three,
 * because item 5's *"buy a node on one career, tap twenty replies on another"*
 * cannot be said on one.
 *
 * The first draft of this file had that backwards, on the authority of a comment
 * in `ui-frame.acceptance.mjs` which said nothing loaded the save at boot. It
 * was wrong when it was written and it is corrected there now. **A note that
 * says a wire is not connected is worth checking before you build on it**, which
 * is trap 37 arriving from the opposite direction: the deferral comment was
 * about a thing that had since been done.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'

const port = Number(process.env.WALK_TEST_PORT ?? 5198)
const origin = `http://127.0.0.1:${port}`
const vite = path.resolve('node_modules/vite/bin/vite.js')

/** Simulation ticks per frame. See the header. */
const SPEED = Number(process.env.WALK_SPEED ?? 40)

/** How long any one "wait until the studio does X" leg may take, in ms. */
const LEG_MS = Number(process.env.WALK_LEG_MS ?? 180_000)

const server = spawn(
  process.execPath,
  [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
)

let serverLog = ''
server.stdout.on('data', (chunk) => { serverLog += String(chunk) })
server.stderr.on('data', (chunk) => { serverLog += String(chunk) })

async function waitForServer() {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {
      // still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Vite did not start.\n${serverLog}`)
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const notes = []
let currentItem = 'setup'

function item(name) {
  currentItem = name
  process.stdout.write(`\n  ${name}\n`)
}

/** A thing the walk saw. Printed under its item, and kept for the summary. */
function saw(text) {
  notes.push(`${currentItem}: ${text}`)
  process.stdout.write(`    - ${text}\n`)
}

function fail(text) {
  throw new Error(`${currentItem} — ${text}`)
}

// ---------------------------------------------------------------------------
// The player's hands
// ---------------------------------------------------------------------------

/** The live run state, for failure messages. Never for a verdict. */
const runState = (page) =>
  page.evaluate(() => {
    const s = globalThis.__store
    if (!s) return null
    return {
      phase: s.phase,
      devs: s.devs,
      cash: Math.round(s.cash),
      shipped: s.projectsShipped,
      pokes: s.pokeCount,
      scene: s.scene,
      defects: Math.round(s.defects),
      incidents: s.incidents.length,
      tickets: Math.round(s.tickets),
      event: s.event ? `${s.event.id}/${s.event.remaining}${s.event.routed ? '/routed' : ''}` : null,
      posting: s.posting,
      postingTarget: s.postingTarget,
      placements: Object.keys(s.heroPlacements ?? {}),
      // §4.11 — everybody on the floor whose job is not "developer". The first
      // one of those is item 9's front door.
      massHired: s.massHired,
      dial: `${s.hireRole} x${s.hireMultiplier}`,
      specialists: (s.roster ?? [])
        .filter((r) => r.role !== 'dev')
        .reduce((n, r) => n + r.count, 0),
    }
  })

/** The career state. Diagnosis only — see the header. */
const careerState = (page) =>
  page.evaluate(() => {
    const p = globalThis.__permanent
    if (!p) return null
    return {
      shifts: p.meta.paradigmShifts,
      bp: p.layer1.bp,
      milestones: p.meta.milestones,
      heroXp: p.meta.heroXp ?? {},
      heroNodes: p.meta.heroNodes ?? {},
    }
  })

async function where(page) {
  const run = await runState(page)
  const career = await careerState(page)
  return `run=${JSON.stringify(run)} career=${JSON.stringify(career)} lens=${JSON.stringify(await lens(page))}`
}

/**
 * Where the *camera* is — §7.4's level, the address, and whether the room is
 * being drawn at all.
 *
 * Added because a leg that fails on a tap has two suspects and `where` only
 * ever named one of them. Item 9 hunts for a person on a floor; "no tap reached
 * the founder" with the lens standing outside the building and the room not
 * drawn is a different finding from the same words with the lens on the floor,
 * and the walk could not tell them apart.
 */
const lens = (page) =>
  page.evaluate(() => {
    const s = window.__stage
    if (!s) return null
    return { at: s.at, level: s.level, roomIsUp: s.roomIsUp, storey: s.storey, seat: s.focusSeat }
  })

/**
 * §4.15 — which of the three backlogs are on the rail right now.
 *
 * The instrument, not the mechanism. §21.7.6's whole argument is that the two
 * are gated separately, so this is the half items 6, 7 and 8 are about.
 */
const railBacklogs = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.backlog')]
      .map((b) => [...b.classList].find((c) => c.startsWith('backlog--'))?.slice(9))
      .filter(Boolean),
  )

/**
 * Every scene this career has played, in order, with what the rail looked like
 * **on the frame it opened**.
 *
 * The rail snapshot is the whole point. *"Watch the defect backlog appear with
 * her and not before"* is a claim about an instant, and the instant is the one
 * where Mo is on screen and her bar is not yet — the unlock lands when the
 * scene is dismissed, so a walk that only looked afterwards could not tell
 * "arrived with her" from "was there all along".
 */
const beats = []
/** First-use boards completed through §21.7.7e's guided purchase. */
const guidedBoards = new Set()

/**
 * §21.7.7e — a character has finished speaking and put one valid action in
 * front of the player. Complete that action like a player, and prove the board
 * closes back to the floor. The tech-board hand-off is exercised separately by
 * the event careers below, so only the two auto-opened personal boards live in
 * this general interruption pump.
 */
async function pumpGuidedBoard(page) {
  const teaching = page.locator('.board-teaching')
  if (!(await teaching.count())) return false

  const founder = page.locator('.founder-profile[data-phase="in"]')
  if (await founder.count()) {
    const buy = founder.locator('.founder__node[data-guide="true"] button:not([disabled])')
    if (!(await buy.count())) fail(`the founder hand-off offered no valid purchase — ${await where(page)}`)
    await buy.first().click({ timeout: 3_000 })
    await founder.waitFor({ state: 'hidden', timeout: 5_000 })
    guidedBoards.add('founder')
    return true
  }

  const hero = page.locator('.herotree[data-phase="in"]')
  if (await hero.count()) {
    const node = hero.locator('.herotree__node[data-guide="true"]')
    if (!(await node.count())) fail(`the hero hand-off offered no marked valid node — ${await where(page)}`)
    await node.first().click({ timeout: 3_000 })
    const buy = page.locator('.herotree__guide-card button:not([disabled])')
    await buy.waitFor({ timeout: 3_000 })
    await buy.click({ timeout: 3_000 })
    await hero.waitFor({ state: 'hidden', timeout: 5_000 })
    guidedBoards.add('hero')
    return true
  }

  return false
}

/**
 * §10.7a.3 — a conversation interrupts, you tap through it, you carry on.
 *
 * Called from every wait, because that is what a scene is: the game speaking
 * over whatever the player was doing. It also has to be called from every wait
 * for a duller reason — `tick` returns early while a scene is up, so a leg that
 * waited on the simulation without clearing one would wait for ever.
 */
async function pumpScene(page) {
  // §10.8b — a finished build stops the studio until somebody picks a release
  // date, exactly the way a scene does, and for the same reason it has to be
  // pumped here: `tick` returns early while the shelf is full, so a leg that
  // waited on the simulation without attending the launch would wait for ever.
  await pumpRelease(page)
  const id = await page.evaluate(() => globalThis.__store?.scene ?? null)
  if (!id) return pumpGuidedBoard(page)
  if (!beats.some((b) => b.id === id)) {
    beats.push({ id, rail: await railBacklogs(page) })
  }
  const scrim = page.locator('.ui-dialogue__scrim')
  if (await scrim.count()) {
    await page.mouse.click(320, 200)
    await page.waitForTimeout(400)
  }
  return true
}

/**
 * §10.8b — press the launch, and remember what the studio got for it.
 *
 * The walk plays this like a player rather than reaching into the store: it
 * presses the window's own surface and reads the band off the verdict line, so
 * a bar that stops sweeping, a press that scores nothing, or a window that will
 * not close all show up here as a leg that stalls rather than as a silent pass.
 *
 * The needle is not aimed. That is the point of the reading: a walk that
 * happened to hit the centre would be evidence about luck, and what item 0
 * wants to know is that *some* band came out and the release carried it.
 */
async function pumpRelease(page) {
  const catcher = page.locator('.release__catch')
  if (!(await catcher.count())) return false

  await catcher.first().click({ timeout: 2_000, force: true }).catch(() => {})
  const verdict = await page
    .locator('.release__verdict[data-locked="true"]')
    .first()
    .textContent()
    .catch(() => null)
  if (verdict) launches.push(verdict.trim())

  // The window holds its verdict, then hands over to the review reel. Waiting
  // it out here keeps every caller's poll from racing the hand-off.
  await page.waitForFunction(() => !globalThis.__store?.pendingRelease, null, { timeout: 8_000 })
  return true
}

/** Every launch band this career landed on, in order. */
const launches = []

/** Has this scene played at any point in this career? */
const played = (id) => beats.some((b) => b.id === id)

/** What the rail held the frame this scene opened, or null if it never did. */
const railWhen = (id) => beats.find((b) => b.id === id)?.rail ?? null

/**
 * Wait for something to become true of the screen, letting the studio run and
 * playing out anything it says on the way.
 *
 * Polls rather than waiting on a selector because most of these are questions
 * about a *number* the simulation is moving, not about an element arriving.
 */
async function until(page, label, predicate, budget = LEG_MS) {
  const deadline = Date.now() + budget
  for (;;) {
    await pumpScene(page)
    if (await predicate(page)) return
    if (Date.now() > deadline) fail(`timed out waiting for ${label} — ${await where(page)}`)
    await page.waitForTimeout(120)
  }
}

/**
 * Play out whatever is being said, and stop when the glass has stayed clear —
 * because dismissing one scene can raise the next on the following tick.
 */
async function playScenes(page, { quiet = 700 } = {}) {
  for (let i = 0; i < 400; i++) {
    if (!(await pumpScene(page))) {
      await page.waitForTimeout(quiet)
      if (!(await pumpScene(page))) return
    }
  }
  fail(`a scene would not clear — ${await where(page)}`)
}

/**
 * §10.9.3's boot, read at the player's own speed — it is a scene, not a wait.
 *
 * One tap completes the page being typed, the next turns it, and the tap on the
 * last page lifts the overlay. Exactly the same shape as {@link playScenes},
 * and a separate function because it is a different surface with a different
 * way out.
 */
async function playBoot(page) {
  // `data-phase="in"`, not merely present: the overlay stays mounted through its
  // own exit so it has something to animate, and a click on a fading pane is a
  // click Playwright waits thirty seconds to land.
  const boot = page.locator('.studio-boot[data-phase="in"]')
  for (let i = 0; i < 60; i++) {
    if (!(await boot.count())) return
    await boot.first().click({ position: { x: 20, y: 20 }, timeout: 2_000 }).catch(() => {})
    await page.waitForTimeout(320)
  }
  fail('the studio boot would not lift')
}

/** A real tap on the canvas: down and up, no travel, so §7.7.6 reads it as a tap. */
async function tapWorld(page, x, y) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.up()
}

/** How many times the player has coded. The one counter Act I is gated on. */
const pokeCount = (page) => page.evaluate(() => globalThis.__store?.pokeCount ?? 0)

/**
 * Find a point on the canvas that codes.
 *
 * Swept rather than computed, because the only honest way to know a tap lands
 * on somebody is to tap and watch the counter. The founder's corner desk is
 * what Act I's advisor tells the player to aim at, and before James drops in it
 * is the only body on the floor.
 */
async function findPokePoint(page, size, from = null) {
  const tryAt = async (x, y) => {
    if (x < 8 || y < 8 || x > size.width - 8 || y > size.height - 8) return false
    const was = await pokeCount(page)
    await tapWorld(page, Math.round(x), Math.round(y))
    await page.waitForTimeout(40)
    return (await pokeCount(page)) > was
  }

  // Near where they were a moment ago, first. See {@link pokeAt} for why they
  // move at all — it is the camera, and it moves them by tens of pixels rather
  // than across the room.
  if (from) {
    for (let r = 16; r <= 96; r += 16) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (await tryAt(from.x + dx * r, from.y + dy * r)) {
          return { x: Math.round(from.x + dx * r), y: Math.round(from.y + dy * r) }
        }
      }
    }
  }

  for (let fy = 0.16; fy <= 0.84; fy += 0.05) {
    for (let fx = 0.20; fx <= 0.80; fx += 0.04) {
      const x = Math.round(size.width * fx)
      const y = Math.round(size.height * fy)
      if (await tryAt(x, y)) return { x, y }
    }
  }
  fail(`no point on the canvas codes — ${await where(page)}`)
}

/**
 * Code `times` times, **checking that each tap landed**.
 *
 * A thumb follows the person it is tapping and this had to learn to. The first
 * version tapped a fixed point fifty times and got seven: `codeAtFounderDesk`
 * called `focusFounderCamera`, so **the first tap moved the target** — the lens
 * walked the corner desk toward the middle of the frame and the fixed point was
 * then over empty floor. §21.0b's fifty pokes never arrived, Act I never ended,
 * and the run sat in `act1_poke` with four games shipped and fifty thousand
 * dollars in the bank, which is a perfectly reasonable studio and not the one
 * the script is about.
 *
 * **That was a defect and this file treated it as weather.** A tap on somebody
 * already under the finger has nowhere to fly to, and a code tap does not move
 * the camera any more; the check in item 3 holds it. The story stays because
 * the shape of the mistake outlives it — a gate that works around what it trips
 * over stops being able to report it, and this one hid a broken primary verb
 * for as long as it took a player to notice.
 *
 * The re-find stays and earns its keep for the honest reason: §7.8.6's
 * developers get up and walk to the cooler, so the body under a remembered
 * point really can leave. Every canvas sweep below re-finds for that reason.
 */
async function pokeAt(page, size, point, times) {
  let at = point
  for (let i = 0; i < times; i++) {
    // §10.7a.3 — the game has started talking, so the player has stopped
    // tapping. `pokeFounder` refuses while a scene is up, so carrying on here
    // would be a sweep of the whole canvas looking for a body that is not
    // taking taps from anybody.
    if (await page.evaluate(() => globalThis.__store?.scene ?? null)) return at
    const was = await pokeCount(page)
    await tapWorld(page, at.x, at.y)
    await page.waitForTimeout(28)
    if ((await pokeCount(page)) > was) continue
    at = await findPokePoint(page, size, at)
  }
  return at
}

/**
 * A HUD button.
 *
 * A string matches exactly and a regular expression does not, because §10.8's
 * priced controls put the figure inside the button — `HIRE DEVELOPER` and its
 * `$50` are one accessible name — and the walk should be pressing the control
 * a player sees rather than a label a test invented.
 */
const btn = (page, name) =>
  typeof name === 'string'
    ? page.getByRole('button', { name, exact: true })
    : page.getByRole('button', { name })

const nameOf = (name) => (typeof name === 'string' ? name : String(name))

/**
 * **Press a control, the way a player can.**
 *
 * Every HUD press in the walk goes through here, and the reason is §10.7a.3:
 * while a scene is up the interface is genuinely inert and the scrim owns the
 * tap. A direct `.click()` on a button behind that glass is not a thing a
 * player can do — it is thirty seconds of Playwright waiting for a control it
 * can see and cannot reach, and then a timeout that reads like a missing
 * button. So this plays out whatever is being said first, then presses, then
 * tries again if the frame moved underneath it.
 */
async function tapControl(page, locator, label, budget = LEG_MS) {
  const deadline = Date.now() + budget
  for (;;) {
    await pumpScene(page)
    if (
      (await locator.count()) &&
      (await locator.first().isVisible().catch(() => false)) &&
      (await locator.first().isEnabled().catch(() => false))
    ) {
      const pressed = await locator
        .first()
        .click({ timeout: 3_000 })
        .then(() => true)
        .catch(() => false)
      if (pressed) {
        await page.waitForTimeout(180)
        return
      }
    }
    if (Date.now() > deadline) fail(`could not press ${label} — ${await where(page)}`)
    await page.waitForTimeout(150)
  }
}

/** Press a HUD button by its label, once it is there and enabled. */
async function press(page, name, budget = LEG_MS) {
  await tapControl(page, btn(page, name), `the ${nameOf(name)} button`, budget)
}

/**
 * Close one §10.6a window by its close box.
 *
 * Every window in the product now carries a box named `CLOSE` in the corner of
 * its title bar, which is the whole point of the shared chrome — and which
 * means `press(page, 'CLOSE')` is ambiguous the moment two of them are stacked.
 * §13.9's board opens *over* §22.9's card on purpose, so the walk addresses the
 * box by the window it belongs to rather than by its name.
 */
async function closeWindow(page, selector, label, budget = LEG_MS) {
  // §10.6b — a scene closes every window on its way in, so by the time the walk
  // reaches for the close box the window may already be gone. Closing what is
  // not open is not a failure; failing to close what is, still is.
  if (!(await page.locator(`${selector}[data-phase="in"]`).count())) return
  await tapControl(page, page.locator(`${selector} .os-window__close`), `the close box on ${label}`, budget)
}

/**
 * Put a window back if §10.6b took it away.
 *
 * Deliberately not `press`: this runs inside a poll, where a door that is not
 * on the rail this instant is a thing to try again for rather than a failure.
 */
async function reopen(page, selector, door) {
  if (await page.locator(`${selector}[data-phase="in"]`).count()) return true
  const control = btn(page, door)
  if (await control.count()) {
    await control.first().click({ timeout: 2_000 }).catch(() => {})
    await page.waitForTimeout(250)
  }
  return (await page.locator(`${selector}[data-phase="in"]`).count()) > 0
}

/** What the studio's phase is, for waiting on §21's script. */
const phase = (page) => page.evaluate(() => globalThis.__store?.phase ?? null)
const devs = (page) => page.evaluate(() => globalThis.__store?.devs ?? 0)

/**
 * Hire, the way a player does: wait for the button to go live, press it, repeat.
 *
 * Never `hireDeveloper()` — the whole argument of this file is that the join
 * between a control and a verb is the thing that goes wrong.
 */
/**
 * §21.0e — used from Run 2 on. Run 1 has no hire control at all, so the only
 * callers left are the legs that run after the first Paradigm Shift.
 */
async function hireUpTo(page, target, budget = LEG_MS) {
  const deadline = Date.now() + budget
  while ((await devs(page)) < target) {
    if (Date.now() > deadline) fail(`could not reach ${target} developers — ${await where(page)}`)
    if (await pumpScene(page)) continue
    await refuseBankruptcy(page)
    const control = btn(page, /HIRE DEVELOPER/)
    if ((await control.count()) && (await control.first().isEnabled())) {
      await control.first().click({ timeout: 2_000 }).catch(() => {})
      await page.waitForTimeout(60)
    } else {
      await page.waitForTimeout(200)
    }
  }
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

const SIZE = { width: 997, height: 448 }

/**
 * Career 1 — items 3, 4, 6, 7, 8, 9 and 10, in one unbroken session.
 *
 * One session on purpose. The whole point of the list is that a player reaches
 * all of this **without leaving the game**, so a walk that reloaded between
 * items would be proving something weaker than the line it is checking.
 */
async function walkCareerOne(page) {
  item('item 3 — the founder, the prologue, and the first Paradigm Shift')

  await page.goto(`${origin}/?speed=${SPEED}&nopost`, { waitUntil: 'load' })
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload({ waitUntil: 'load' })
  await page.locator('.app').waitFor()
  await page.waitForTimeout(1_400)

  // The title, then the creator. A first launch has no profile, so NEW GAME is
  // not strictly needed — but it is what a player presses, and the ERASE
  // confirmation is part of the beat when there is anything to erase.
  await press(page, 'NEW GAME')
  const erase = btn(page, 'ERASE & START')
  if (await erase.count()) await tapControl(page, erase, 'ERASE & START')
  await page.getByRole('dialog', { name: 'WHO ARE YOU?' }).waitFor()
  await page.getByLabel('YOUR NAME').fill('ADA')
  await press(page, 'ENTER THE STUDIO')
  saw('created a founder from the title screen')

  // §10.9.3's boot plays over the running stage; the HUD arrives behind it.
  await playBoot(page)
  await page.locator('.hud').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1_200)
  saw('the studio booted into Act I')

  const point = await findPokePoint(page, SIZE)
  saw(`the canvas takes a code tap at ${point.x},${point.y}`)

  // §21.0b — fifty pokes, and then somebody turns up.
  await until(page, 'Act I to open on the poke', async (p) => (await phase(p)) === 'act1_poke', 20_000)

  /*
   * **The primary verb does not move the camera**, and this is here because it
   * used to and this file hid it.
   *
   * §7.7.6b boots Act I with POKE latched over a script that reads TAP TO CODE,
   * so ten taps on one spot is not a stress test, it is the game. Two things
   * broke it: a tap on the founder called `focusFounderCamera`, which walked
   * their desk toward the middle of the frame and out from under the thumb; and
   * any two taps inside 300 ms descended a level, which both flew the lens onto
   * the person being coded at and *ate the second tap*.
   *
   * `pokeAt` below already knew — it re-finds its target after every miss, and
   * its note says exactly why. That is the trap: **a gate that accommodates a
   * defect stops reporting it.** It stayed accommodated until a player said
   * "when there's only James and us, clicking one of us to code, it should not
   * zoom to the person".
   */
  const beforeCode = await lens(page)
  const codedBefore = await pokeCount(page)
  for (let i = 0; i < 10; i++) {
    await tapWorld(page, point.x, point.y)
    await page.waitForTimeout(28)
  }
  const landed = (await pokeCount(page)) - codedBefore
  const afterCode = await lens(page)
  if (landed < 10) {
    fail(`ten taps on one spot coded ${landed} times — ${await where(page)}`)
  }
  if (afterCode.at !== beforeCode.at || Math.abs(afterCode.level - beforeCode.level) > 0.02) {
    fail(
      `coding moved the lens from ${beforeCode.at} (${beforeCode.level}) to ${afterCode.at} (${afterCode.level}) — ${await where(page)}`,
    )
  }
  saw(`ten fast taps on one spot all coded, and the lens stayed at ${afterCode.at}`)

  await pokeAt(page, SIZE, point, 52)
  await until(page, 'James at the door', async (p) => (await phase(p)) !== 'act1_poke')
  await playScenes(page)
  if (!played('scene.act1.james-arrives')) {
    fail(`fifty pokes did not bring James — played ${JSON.stringify(beats.map((b) => b.id))}`)
  }
  await until(page, 'James at a desk', async (p) => (await devs(p)) >= 1)
  saw('fifty pokes brought James, and he sat down (§21.7.1)')

  /*
   * §21.0e — **Run 1 does not hire, so there is nothing to press here.**
   *
   * This leg used to buy the second employee and then hire to forty, which is
   * the beat §21.0's Act IIa scripted. There is no hire control anywhere in Run
   * 1 now: the two of them ship the whole garage catalogue, an investor turns
   * up, and the only thing the money can buy is a thousand developers. The walk
   * says so out loud below, because "no button appeared" is the kind of thing a
   * gate has to assert rather than merely not notice.
   */
  await until(
    page,
    'the garage catalogue to ship',
    async (p) => (await phase(p)) === 'act2_termsheet',
    LEG_MS,
  )
  if (await btn(page, /HIRE DEVELOPER/).count()) {
    fail(`Run 1 offered a hire button — ${await where(page)}`)
  }
  if ((await devs(page)) !== 1) {
    fail(`Run 1 reached the term sheet with ${await devs(page)} developers, not just James`)
  }
  saw('shipped the whole garage catalogue with two people and no hire button (§21.0e)')

  /*
   * §10.8b — **and every one of those releases had a launch date on it.**
   *
   * The garage ships three games at a minute apiece, which is outside the
   * window's cooldown every time, so a Run 1 that reached the term sheet
   * without a single band is a Run 1 where the minigame never opened — the
   * failure this whole item cannot otherwise see, because the catalogue still
   * ships either way.
   */
  if (launches.length === 0) {
    fail(`the garage shipped its catalogue and never once picked a release date — ${await where(page)}`)
  }
  saw(`picked a release date on every garage launch — ${launches.join(', ')}`)

  // §21.0a — the term sheet, on its own modal now rather than in the action bar.
  await page.locator('.term-sheet').waitFor({ timeout: 10_000 })
  await press(page, /SIGN IT/)
  await until(page, 'the mousetrap', async (p) => (await phase(p)) === 'act3_bait')
  saw('signed §21.0a’s term sheet on its own surface')

  await playScenes(page)
  if (!played('scene.act3.mass-hire')) {
    fail(`Act III did not open on §21.0d’s scene — played ${JSON.stringify(beats.map((b) => b.id))}`)
  }
  saw('James made his pitch — and the scene signed nothing (§21.0d amended)')

  /*
   * §21.0d [amended 2026-08-27] — **the button is the transaction.** The scene
   * ends on "It's fine. It's a one-off." and the offer on the rail is what
   * hires the thousand people, on the player's tap. The walk asserts the trap
   * did *not* spring from the scene before it presses the button: the treasury
   * and the headcount have to still be standing when the offer is read.
   */
  const beforeSpring = await devs(page)
  if (beforeSpring !== 1) {
    fail(`the pitch scene moved the headcount to ${beforeSpring} by itself — ${await where(page)}`)
  }
  await press(page, /HIRE 1,000 DEVS NOW/)
  await until(page, 'the swarm', async (p) => (await devs(p)) > 500)
  saw('the player pressed the offer, and only then did the swarm land')

  // §21 Acts IV and V. Nothing to press: the studio seizes and payroll finishes it.
  await until(page, 'bankruptcy', async (p) => (await phase(p)) === 'bankrupt')
  await page.locator('.bankruptcy').waitFor()
  saw('the swarm landed, the studio seized, and payroll ended the run')

  await press(page, 'TRIGGER PARADIGM SHIFT')
  /*
   * §15.1a — the reboot between two realities, and it is *between*: the receipt
   * and the boot are on screen before §21.6's James scene can start, so a walk
   * that went straight to `playScenes` would sit on a black screen for thirty
   * seconds and report a missing scene.
   *
   * Same surface as §10.9.3's boot, so it is tapped through by the same helper.
   * That is the whole design of the beat and the reason this line is one call.
   */
  await playBoot(page)
  if (!(await page.locator('.hud').count())) {
    fail(`the shift's cut scene did not lift into the studio — ${await where(page)}`)
  }
  saw('read the shift’s receipt and rebooted into the next reality (§15.1a)')
  await playScenes(page)
  if (!played('scene.run2.instant-messenger')) {
    fail(`the shift did not open Run 2 on §21.6 — played ${JSON.stringify(beats.map((b) => b.id))}`)
  }
  const career = await careerState(page)
  if (!career || career.shifts !== 1) fail(`the shift did not land — ${await where(page)}`)
  saw(`took the first Paradigm Shift — ${career.bp} BP, and James brought Instant Messenger`)

  await walkItem4(page)
  await walkItems6to8(page)
  await walkItems9and10(page, SIZE)

  /*
   * §21.7.3's arrivals fire on a *feeling*, so the order they land in is the
   * simulation's and not this list's. Printed rather than asserted for exactly
   * that reason — the run that produced it is one run, and a gate that pinned
   * the order would be pinning an accident.
   */
  saw(`the career’s beats, in the order this run produced them: ${beats.map((b) => b.id.replace(/^scene\./, '')).join(' → ')}`)

  return { point }
}

/**
 * The §11.4 board, as the DOM has it.
 *
 * Read rather than asserted here so the walk can say what it saw. The nodes'
 * boxes and the connectors' endpoints are both in world coordinates, which is
 * the whole subject of item 4.
 */
/** §11.4's UML class box, in CSS px. `UpgradeBoard`'s dimensions, restated here. */
const NODE_W_PX = 168
const NODE_H_PX = 104

const readBoard = (page) =>
  page.evaluate(() => {
    const scroll = document.querySelector('.upgrade-board__scroll')
    const world = document.querySelector('.upgrade-board__world')
    if (!scroll || !world) return null
    const nodes = [...document.querySelectorAll('.upgrade-board__node')].map((n) => ({
      name: n.getAttribute('aria-label'),
      state: n.dataset.state,
      owned: n.dataset.owned === 'true',
      left: Number.parseFloat(n.style.left),
      top: Number.parseFloat(n.style.top),
      // What the player can actually put a thumb on: the box, as laid out,
      // against the scroller's own box.
      rect: n.getBoundingClientRect().toJSON(),
    }))
    const ends = new Set()
    for (const line of document.querySelectorAll('.upgrade-board__links line')) {
      ends.add(`${Math.round(+line.getAttribute('x1'))},${Math.round(+line.getAttribute('y1'))}`)
      ends.add(`${Math.round(+line.getAttribute('x2'))},${Math.round(+line.getAttribute('y2'))}`)
    }
    return {
      nodes,
      ends: [...ends],
      world: { w: Number.parseFloat(world.style.width), h: Number.parseFloat(world.style.height) },
      viewport: scroll.getBoundingClientRect().toJSON(),
      scroll: { left: scroll.scrollLeft, top: scroll.scrollTop },
    }
  })

async function walkItem4(page) {
  item('item 4 — UPGRADES, Instant Messenger at the centre, and a board that grows')

  const upgradeBoard = page.locator('.upgrade-board')
  // §21.7.7e: James now puts the instrument in the player's hand himself.
  // Keep the manual route here as a fallback for careers that already consumed
  // the introduction before this acceptance chapter began.
  if (!(await upgradeBoard.isVisible().catch(() => false))) await press(page, 'UPGRADES')
  await upgradeBoard.waitFor()
  await page.waitForTimeout(400)

  const before = await readBoard(page)
  if (!before) fail('the upgrade board did not open')

  const centre = before.nodes.find((n) => n.owned)
  if (!centre) fail('no node on the board is owned — James did not bring Instant Messenger')
  if (centre.name !== 'Instant Messenger') fail(`the owned node is ${centre.name}`)

  // At the centre, in the two senses the section means it. §11.4.1: a branch is
  // a compass heading, so somebody is on each side of it...
  const sides = {
    west: before.nodes.some((n) => n.left < centre.left),
    east: before.nodes.some((n) => n.left > centre.left),
    north: before.nodes.some((n) => n.top < centre.top),
    south: before.nodes.some((n) => n.top > centre.top),
  }
  for (const [side, ok] of Object.entries(sides)) {
    if (!ok) fail(`nothing is drawn ${side} of Instant Messenger`)
  }

  // ...and it is the point the connectors run out of, which is the join the
  // component had wrong: the node layer was translated three cells off the link
  // layer, so every line missed the node it was drawn to.
  const halfX = NODE_W_PX / 2
  const halfY = NODE_H_PX / 2
  const detached = before.nodes.filter(
    (n) => !before.ends.includes(`${Math.round(n.left + halfX)},${Math.round(n.top + halfY)}`),
  )
  if (detached.length > 0) {
    fail(`${detached.length} node(s) are not on a connector endpoint: ${detached.map((n) => n.name ?? 'dark').join(', ')}`)
  }

  const offWorld = before.nodes.filter(
    (n) =>
      n.left < 0 ||
      n.top < 0 ||
      n.left + NODE_W_PX > before.world.w ||
      n.top + NODE_H_PX > before.world.h,
  )
  if (offWorld.length > 0) {
    fail(`${offWorld.length} node(s) sit outside the world box and no scroll reaches them`)
  }

  // And the board opens looking at it, rather than at the empty corner of a
  // world three cells bigger than its contents.
  const v = before.viewport
  const inView =
    centre.rect.left >= v.left - 1 &&
    centre.rect.right <= v.right + 1 &&
    centre.rect.top >= v.top - 1 &&
    centre.rect.bottom <= v.bottom + 1
  if (!inView) fail('the board does not open on Instant Messenger')
  saw('Instant Messenger is owned, centred, in view, and every node sits on its own connector')

  // §11.4.3 — tap a ring-1 node, read it, then buy it on the guide's one button.
  //
  // The wait runs long enough for Mo and Matt to walk in, and §10.6b closes
  // every window when somebody starts talking — so the board has to be put back
  // between polls. That is what a player does, and the thing being waited for
  // is the board's *state*, not its having stayed on screen through a scene.
  const reachable = (n) => n.state !== 'dark' && !n.owned
  await until(
    page,
    'a ring-1 node the studio can afford',
    async (p) => {
      if (!(await reopen(p, '.hud__upgrades', 'UPGRADES'))) return false
      const now = await readBoard(p)
      return (now?.nodes ?? []).some((n) => reachable(n) && n.state === 'live')
    },
  )
  const board = await readBoard(page)
  const target = board.nodes.find((n) => reachable(n) && n.state === 'live')
  const openBefore = board.nodes.filter((n) => n.state !== 'dark').length

  await tapControl(page, page.getByRole('button', { name: target.name, exact: true }), target.name)
  await page.locator('.upgrade-board__guide-card').waitFor()
  const buy = page.locator('.upgrade-board__guide-card button')
  if (!(await buy.count())) fail(`${target.name} opened with no way to buy it`)
  const price = (await buy.first().textContent())?.trim()
  await tapControl(page, buy, `the price on ${target.name}`)
  await page.waitForTimeout(500)

  const after = await readBoard(page)
  const bought = after.nodes.find((n) => n.name === target.name)
  if (!bought?.owned) fail(`${target.name} did not become owned`)
  const openAfter = after.nodes.filter((n) => n.state !== 'dark').length
  if (openAfter <= openBefore) {
    fail(`the board did not grow — ${openBefore} nodes were open before and ${openAfter} after`)
  }
  saw(`bought ${target.name} for ${price}; the board grew from ${openBefore} open nodes to ${openAfter}`)

  await closeWindow(page, '.hud__upgrades', 'the upgrade board')
  await playScenes(page)
}

/**
 * §21.7.6 — one arrival, and the instrument that arrives with them.
 *
 * The whole of items 6, 7 and 8 is the *and not before*: the mechanism has been
 * running since the first frame of the run and the readout has not existed, so
 * the check is a claim about two instants rather than about an end state.
 */
async function meets(page, { who, scene, brings, label }) {
  // Not a live reading of the rail: by the time an item is reached its hero may
  // already have walked in during an earlier leg, because §21.7.3's arrivals
  // fire when the player feels the problem and not when a list gets to them.
  // The snapshot `pumpScene` took on the frame the scene opened is the one that
  // can answer "and not before", whenever that frame happened to be.
  await play(page, `${who} at the door`, () => played(scene))
  if (brings) {
    const rail = railWhen(scene)
    if (rail.includes(brings)) {
      fail(`the ${brings} backlog was already drawn on the frame ${who} walked in — ${JSON.stringify(rail)}`)
    }
    await play(page, `${who}'s ${brings} backlog`, async (p) =>
      (await railBacklogs(p)).includes(brings),
    )
  }
  saw(label)
}

async function walkItems6to8(page) {
  item('item 6 — a release bad enough to bring Mo, and the defect bench with her')
  await meets(page, {
    who: 'Mo',
    scene: 'scene.run2.mo-arrives',
    brings: 'defects',
    label: 'shipped past §4.14.1’s defect anchor; Mo arrived to a rail with no defect bench on it, and it appeared as she sat down',
  })

  item('item 7 — the same for Serena and for Matt')
  await meets(page, {
    who: 'Serena',
    scene: 'scene.run2.serena-arrives',
    brings: 'incidents',
    label: 'a release went down; Serena arrived and §4.12a’s incident list came with her',
  })
  await meets(page, {
    who: 'Matt',
    scene: 'scene.run2.matt-arrives',
    brings: 'tickets',
    label: 'the queue outran the studio for §21.7.3’s sustained period; Matt arrived and §4.13’s bar came with him',
  })

  item('item 8 — the cap brings Melany; the collapse that follows brings Billy')
  // Melany is §21.7.6's counter-example and it is worth saying out loud: she
  // hands over nothing, because §4.2's cap has been on screen since Run 1's
  // first minute. A person only brings what was not already there.
  await meets(page, {
    who: 'Melany',
    scene: 'scene.run2.melany-arrives',
    label: 'hit the developer cap with money still in the bank, and met Melany',
  })
  /*
   * **Billy is the other kind, and this leg is the one that proves the walk can
   * still get to him.**
   *
   * His trigger is sync at or below half, *held* for `BILLY_SUSTAINED_S` — and
   * half sync is exactly `devs === devCap`, so it is the same instant Melany
   * arrives on and the clock is the only thing separating the two legs.
   *
   * The part worth watching: `play` stops hiring the moment the gauge reads
   * under 50, on §4.1's "a player who is paying attention stops at the top of
   * the curve". That is precisely the state Billy's trigger wants — a studio
   * sitting at its own capacity and not recovering — so the walk reaches him by
   * playing *correctly* rather than by playing past the lesson. If this leg ever
   * times out, the first thing to check is whether the hire rule and the trigger
   * have drifted onto opposite sides of the same threshold.
   */
  await meets(page, {
    who: 'Billy',
    scene: 'scene.run2.billy-arrives',
    label: 'sat at the cap with sync halved until James sent for Billy',
  })
  // §21.7.6 — and the scene is a hand-over rather than a handshake: the man who
  // handed the floor over is standing on it before the box has closed.
  await playScenes(page)
  if (!(await runState(page)).placements.includes('billy')) {
    fail(`Billy's scene ended without him on the floor — ${await where(page)}`)
  }
  saw('Billy took a rung as his own scene ended, which is what §13.8’s hand-over looks like')
}

/**
 * §4.5d — tap yourself, which first means finding yourself.
 *
 * §13.6.6 forbids a management screen and §13.6.7 says the door has to be a
 * person, so the founder's screen has no HUD button: you put the finger in INFO
 * mode and tap your own avatar. What the walk found is that **the avatar leaves
 * the resting frame at about a dozen developers** — §7.8.10 pins the corner
 * workstation to a fixed point and the room grows away from it — so above that
 * headcount the gesture can start with a drag. It usually does not, because
 * poking yourself parks the lens on your own desk and it stays parked; it does
 * for a player who has panned away. §13.7.1a records both, and what a real fix
 * would cost.
 *
 * The walk therefore does what a player would have to: look, and if you are not
 * there, pull the floor down until you are.
 */
async function openFounderScreen(page, size) {
  await refuseBankruptcy(page)

  /*
   * **You cannot tap a person from outside the building.**
   *
   * This leg used to open with the INFO latch and start sweeping, on the
   * premise recorded above — that an earlier poke had left the lens parked on
   * the founder's own desk. The one-camera rebuild ended that: past a thousand
   * developers the studio has a second storey, and a lens standing at Building
   * is looking at a tower with the room not drawn at all, so every tap in the
   * sweep is a floor *selection* and no number of them will ever reach a
   * person. Five hundred taps found nothing, and on the way they entered a
   * floor by accident and descended, which is correct behaviour making a stale
   * test look like a broken game.
   *
   * So the walk does what §7.7.4 promises a player can always do: go into a
   * floor with people on it, using a control the HUD already offers — which
   * makes this leg a test of the door as well as of the screen behind it.
   */

  /*
   * **Stand on the floor before looking for a person on it.**
   *
   * With one camera the address can be anywhere, and two separate runs proved
   * how little that leaves for a blind sweep: one failed with the lens at
   * Building, where the room is not drawn at all and every tap is a floor
   * *selection*; another with the lens at Squad on seat 400, four squads from
   * the corner workstation, where three vertical drags were never going to
   * bring it back. §4.5d's own answer — the rail's CODE button, which codes at
   * your desk and flies the lens there — is `display: none` below 470 px of
   * frame by a decision §13.7.1a records and leaves to a human, and the walk
   * runs at 448.
   *
   * So it uses §10's address ladder, which is on screen whenever the studio has
   * a second storey: the floor list when the lens is outside the building, and
   * the FLOOR rung when it is somewhere inside. Both are controls a player has;
   * neither is a debug hook; and either one lands the lens on the floor with
   * the corner desk in frame. On a run where the lens is already there both are
   * skipped and the sweep runs exactly as it always did.
   */
  const homed = async (locator, label, note) => {
    if (!(await locator.count())) return false
    if (!(await locator.first().isVisible().catch(() => false))) return false
    await tapControl(page, locator, label)
    // The flight, plus the settle.
    await page.waitForTimeout(1_200)
    saw(note)
    return true
  }
  const lensAt = await lens(page)
  if (lensAt && lensAt.at === 'BUILDING') {
    // Outside the building the ladder is the floor list — the rungs below
    // BUILDING name where you were last, not where you are, so they are not
    // shown and the doors are.
    await homed(
      page.locator('.hud__floor').last(),
      'FLOOR 01 in the lift panel',
      'the lens was outside the building, so the walk took the lift down to a floor',
    )
  } else if (lensAt && lensAt.at !== 'FLOOR') {
    await homed(
      page.locator('.hud__crumb', { hasText: 'FLOOR' }),
      'the FLOOR rung of the address ladder',
      `the lens was at ${lensAt.at}, so the walk stepped out to the floor before looking for the founder`,
    )
  }

  await tapControl(page, page.locator('.touch__latch', { hasText: 'INFO' }), 'the INFO latch')
  await page.waitForTimeout(250)
  const panel = page.locator('.founder-profile[data-phase="in"]')

  /*
   * **Aimed, not hunted.**
   *
   * This swept a 20x28 grid over the whole frame until something opened, which
   * was fine while a tap did nothing but select. It is not now: a tap
   * navigates, so five hundred of them walk the camera down the ladder and away
   * from the thing being hunted — a run ended this leg at Desk on somebody
   * else's squad, having driven itself there. It also cost twenty seconds of
   * wall clock against §4.1's payroll, which is how the same leg kept ending in
   * the bankruptcy modal instead.
   *
   * `__founderAt` is the §7.8.10 corner in screen pixels, the same sanctioned
   * kind of hook as `__pick` and there for the same reason. Aiming keeps every
   * bit of what this leg proves — the door is a person and tapping that person
   * opens the screen — and splits a failure the sweep conflated: *the avatar is
   * not in the frame* is §13.7.1a's known trade, *the avatar is in the frame
   * and tapping it does nothing* is a bug, and only the second should stop the
   * walk.
   */
  for (let pull = 0; pull <= 3; pull++) {
    await refuseBankruptcy(page)
    /*
     * §10.7a.3 — **and tap through anything that opened since the last leg.**
     *
     * The world is genuinely inert while a scene is up: the dialogue scrim eats
     * the tap, so aiming at the founder and pressing him is a correct tap that
     * correctly does nothing, and the leg then reported the one failure it is
     * supposed to reserve for a real bug — *the avatar is in the frame and
     * tapping it does nothing*.
     *
     * It started happening when §21.7.3's Billy began taking a rung as his own
     * scene ends: a placed hero earns XP, XP is levels, and §21.7.7c's hero
     * board arrives on the first earned level — which now lands somewhere in the
     * middle of this leg rather than in item 10 where the walk went looking for
     * it. That is the systems working. What was wrong is that this leg assumed
     * nothing could interrupt it, which is the assumption §21.7.3 exists to
     * break: an arrival fires when the player feels the problem, and never when
     * a list gets to it.
     */
    await playScenes(page)
    const at = await page.evaluate(() => window.__founderAt?.() ?? null)
    const onFrame =
      at && at.x > 4 && at.y > 4 && at.x < size.width - 4 && at.y < size.height - 4
    if (onFrame) {
      await tapWorld(page, at.x, at.y)
      await page.waitForTimeout(350)
      if (await panel.count()) {
        if (pull > 0) {
          saw(
            `the founder was not in the resting frame — it took ${pull} drag(s) on the floor to bring the corner desk back (§13.7.1a)`,
          )
        }
        return
      }
      fail(
        `the founder's own workstation is at ${at.x},${at.y} and tapping it did not open the screen — ${await where(page)}`,
      )
    }
    // §7.7.6 — drag the world. Downward, because the corner the room grew away
    // from is its north one, and north is up the frame.
    await dragWorld(page, { x: Math.round(size.width / 2), y: 110 }, { x: Math.round(size.width / 2), y: 400 })
  }
  fail(
    `the founder's workstation never came into the frame — ${await where(page)}`,
  )
}

/** A pan: press, travel, release. §7.7.6 tells a drag from a tap by the travel. */
async function dragWorld(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  await page.waitForTimeout(500)
}

async function walkItems9and10(page, size) {
  item('item 9 — the first specialist brings the founder’s own board')

  // §4.11 — the dial only offers a job once the hero who makes it legible has
  // arrived, so by now there is more than one row on it and one of them is not
  // DEVELOPER. That row is the specialist hire.
  const roleRow = page.locator('.hire-dial--role button')
  await until(page, 'the role dial to offer a specialist', async () => (await roleRow.count()) > 1)
  const roles = (await roleRow.allTextContents()).map((r) => r.trim())
  const specialist = roles.find((r) => r && r !== 'DEVELOPER')
  if (!specialist) fail(`the dial offers nothing but developers: ${JSON.stringify(roles)}`)

  const boardAlready = played('scene.run2.founder-board')
  await tapControl(page, page.getByRole('button', { name: specialist, exact: true }), `the ${specialist} row of the dial`)
  // Pressed once, by hand, rather than left to {@link play}'s hiring: by now the
  // studio is at §4.1's optimum and the walk has stopped hiring on purpose. A
  // specialist is not another developer — §4.11's whole joke is that it is a
  // different job — so this is a deliberate press against a chosen row of the
  // dial, which is exactly the gesture item 9 names.
  await press(page, /HIRE DEVELOPER/)
  await play(
    page,
    `a ${specialist} on the floor`,
    async (p) => (await runState(p)).specialists > 0,
    { hire: false },
  )
  await play(page, 'the founder’s board', () => played('scene.run2.founder-board'), { hire: false })
  await playScenes(page)
  saw(
    boardAlready
      ? `hired a ${specialist}; §21.7.7's board had already come through its **other** door — the founder's share of the output fell past a twentieth first, which is the guarantee rather than the beat`
      : `hired the first ${specialist}, and §21.7.7's founder board arrived on it`,
  )

  if (!guidedBoards.has('founder')) {
    fail('the founder scene did not hand directly into one valid Management purchase')
  }

  // And the board is really there, on the screen the scene was about.
  await openFounderScreen(page, size)
  if (!(await page.locator('.founder-profile__tree').count())) {
    fail('the founder’s screen has no board on it after §21.7.7’s scene')
  }
  await closeWindow(page, '.founder-profile', 'the founder’s screen')
  // Back to the primary verb, so the rest of the walk taps the way Act I taught.
  await tapControl(page, page.locator('.touch__latch', { hasText: 'CODE' }), 'the CODE latch')
  saw('opened the founder’s screen from the floor and found §13.7.1’s Management tree on it')

  item('item 10 — a hero’s second level brings the shared board, and an off-branch point lands')

  await placeAHero(page, size)
  await play(page, 'somebody’s second level', () => played('scene.run2.hero-board'), { hire: false })
  saw('a placed hero earned a second level, and §13.9’s board arrived with the first point there was to spend')

  await spendOffBranch(page)
  if (!guidedBoards.has('hero')) {
    fail('the hero-board scene did not hand directly into one valid point purchase')
  }
}

/**
 * §13.8a — arm on the card, tap the world.
 *
 * Items 11 and 12's gesture, used here because §13.10 only pays XP for work done
 * under coverage: a hero on the bench never reaches a second level, so item 10
 * cannot start until somebody is standing somewhere.
 */
async function placeAHero(page, size) {
  const arm = async () => {
    await press(page, 'HERO')
    /*
     * §21.7.6 — **the strip is only called `HERO PLACEMENT` once Billy has
     * handed the floor over**, and before that `PLACE HERO` is not on the card
     * at all. Named here rather than discovered as a thirty-second Playwright
     * timeout on a missing button: if the arrival ladder is ever reordered so
     * that this leg runs before item 8, this says so in one line.
     */
    const bar = (await page.locator('.roster .os-window__bar').textContent()) ?? ''
    if (!bar.includes('HERO PLACEMENT')) {
      fail(`the floor is not placeable yet — Billy has not handed it over ("${bar.trim()}")`)
    }
    await tapControl(page, page.locator('.roster__card'), 'the first card on the roster strip')
    await press(page, 'PLACE HERO')
    await page.locator('.posting').waitFor()
  }
  await arm()

  /*
   * **Aim, do not hunt** — the same correction `openFounderScreen` got, for the
   * same reason and then one more.
   *
   * This used to sweep a grid of about nine hundred taps, each one a real tap
   * plus a full round trip to read the run state, and each miss on open ground
   * disarming and costing three more control presses to re-arm. That is minutes
   * of wall time, and item 10 runs it over a Run 2 that is already in §21's
   * collapse — so the leg was racing payroll and lost about half the time,
   * reported as "the studio went bankrupt mid-run" with nothing wrong except
   * the clock. Trap 41, arriving from a third direction.
   *
   * `__pick` is the same sanctioned hook the founder leg aims with, and asking
   * it inside the page finds the point in one round trip instead of nine
   * hundred. Nothing is weakened: the tap is still a real tap on a real person,
   * §13.8a still has to accept it, and the failure now says which of the two
   * things went wrong.
   */
  const spot = await page.evaluate(
    ({ w, h }) => {
      for (let y = 40; y <= h - 80; y += 8) {
        for (let x = 200; x <= w - 220; x += 8) {
          if (globalThis.__pick?.(x, y)) return { x, y }
        }
      }
      return null
    },
    { w: size.width, h: size.height },
  )
  if (!spot) fail(`nobody on the floor is under any point the finger can reach — ${await where(page)}`)

  for (let i = 0; i < 8; i++) {
    await refuseBankruptcy(page)
    // Open ground disarms, which is the cheap way out — re-arm and carry on.
    if (!(await runState(page)).posting) await arm()
    await tapWorld(page, spot.x, spot.y)
    await page.waitForTimeout(120)
    const s = await runState(page)
    if (s.postingTarget) {
      /*
       * The receipt is split across two surfaces on purpose now. The strip says
       * *where* and what the move is worth to the hero; the plate at the anchor
       * says what it is worth to the studio — because the four-line block this
       * replaced sat across the middle of the floor it was asking the player to
       * tap, and because one row cannot hold both between a name and two
       * buttons (§23.4.2 measured exactly that). Both are read together here: a
       * change that moves a number from one to the other is fine, and a change
       * that loses it from both is what this line catches.
       */
      const receipt =
        `${(await page.locator('.posting').textContent()) ?? ''} ` +
        `${(await page.locator('.world-hero-pin[data-state="preview"]').textContent()) ?? ''}`
      const branchEffect = /VELOCITY|DEFECT RATE|INCIDENT RATE|ENTROPY|DEVELOPER CAP|TICKET HEADS/.test(receipt)
      if (!receipt.includes('XP SHARE') || !branchEffect) {
        fail(`the candidate target had no exact placement receipt — ${receipt}`)
      }
      await press(page, /CONFIRM (PLACE|MOVE)/)
      await page.waitForTimeout(120)
    }
    const confirmed = await runState(page)
    if (confirmed.placements.length > 0) {
      saw(`previewed exact coverage/effect/XP, then posted ${confirmed.placements.join(', ')} onto the floor with §13.8c’s confirmation`)
      return
    }
  }
  fail(`somebody is standing at ${spot.x},${spot.y} and §13.8a’s tap would not place on them — ${await where(page)}`)
}

/** Every number on screen that a §22.8 branch bends, as the player reads it. */
const governed = (page) =>
  page.evaluate(() => {
    const blockNum = (label) =>
      [...document.querySelectorAll('.hud__block')]
        .find((b) => b.querySelector('.hud__label')?.textContent?.includes(label))
        ?.querySelector('.hud__num')
        ?.textContent?.trim() ?? null
    return {
      sync: document.querySelector('.hud__gauge .hud__num--major')?.textContent?.trim() ?? null,
      velocity: blockNum('VELOCITY'),
      defects: document.querySelector('.backlog--defects .backlog__count')?.textContent?.trim() ?? null,
      tickets:
        document.querySelector('.backlog--tickets .backlog__bar-fill')?.getAttribute('style') ?? null,
      pips: document.querySelectorAll('.herocard__pip[data-on="true"]').length,
      points: document.querySelector('.herotree__points')?.textContent?.trim() ?? null,
    }
  })

/**
 * §13.9.1 — *"nothing stops Mo going down Cloud."*
 *
 * Item 10's second half: the board offers the purchase, prices the dilution
 * rather than refusing the sale, takes the point, and the node lights up.
 */
async function spendOffBranch(page) {
  await press(page, 'HERO')
  /*
   * **A specialist, not James** — §13.9.1 amended 2026-08-27.
   *
   * This used to tap the first card on the strip, which is James, and that is
   * now precisely the one hero for whom the thing being gated *correctly does
   * not appear*: he has no home branch, so he pays no off-branch rate, so the
   * board prints no dilution note anywhere on it. `jamesPaysNoHandicap` below
   * gates that half; this half needs somebody who has actually specialised.
   *
   * Every story hire arrives holding a point (§13.13), so any of the five will
   * do — the walk takes the first card that offers one and is not his.
   */
  const cards = page.locator('.roster__card')
  const cardCount = await cards.count()
  let opened = null
  for (let i = 0; i < cardCount; i++) {
    const name = (await cards.nth(i).locator('.roster__name').textContent())?.trim()
    if (!name || name.toLowerCase() === 'james') continue
    await tapControl(page, cards.nth(i), `${name}'s card on the roster strip`)
    if (await page.getByRole('button', { name: /^SPEND \d+$/ }).count()) {
      opened = name
      break
    }
    await closeWindow(page, '.herocard', `${name}'s card`)
    await page.waitForTimeout(150)
    await press(page, 'HERO')
  }
  if (!opened) {
    fail('no specialist on the roster had a point to spend — §13.13 gives every arrival one')
  }
  const spend = page.getByRole('button', { name: /^SPEND \d+$/ })
  if (!(await spend.count())) {
    fail('the card offers no way to spend the point §21.7.7 has just announced')
  }
  await tapControl(page, spend, 'SPEND')
  await page.locator('.herotree__frame').waitFor()
  await page.waitForTimeout(400)

  // A live node in a branch that is not this hero's — which the board says out
  // loud, because §13.9.1's guide prints the dilution instead of refusing.
  const live = page.locator('.herotree__node[data-state="live"]')
  const count = await live.count()
  let chosen = null
  for (let i = 0; i < count; i++) {
    await tapControl(page, live.nth(i), `hero node ${i}`)
    await page.locator('.herotree__guide-card').waitFor()
    const off = page.locator('.herotree__guide-off')
    // Off this hero's branch **and** affordable. A REACH node costs three points
    // against a DEPTH node's one, and this walk arrives with two — so half the
    // boards offered a live node it could not buy, the button did nothing, and
    // this read as a flake twice before anybody looked at the button.
    const buyable = (await page.locator('.herotree__guide-card button:not([disabled])').count()) > 0
    if ((await off.count()) && buyable) {
      chosen = {
        name: (await page.locator('.herotree__guide-name').textContent())?.trim(),
        note: (await off.textContent())?.trim(),
      }
      break
    }
    await page.locator('.herotree__guide').click({ position: { x: 4, y: 4 } })
    await page.waitForTimeout(150)
  }
  if (!chosen) fail('the board offered no live node outside this hero’s branch')

  const before = await governed(page)
  await tapControl(page, page.locator('.herotree__guide-card button'), 'the point on the guide')
  await page.waitForTimeout(900)
  const after = await governed(page)

  if (before.points === after.points) {
    fail(`the point was not spent — the board still reads ${after.points}`)
  }
  saw(`bought ${chosen.name} — the board said "${chosen.note}" and sold it anyway — and ${before.points} became ${after.points}`)

  // §22.9.2 — the pips count every DEPTH node owned **anywhere on the board**,
  // which is the one number on the card that an off-branch purchase is
  // guaranteed to move. What the branch itself governs is a studio multiplier
  // scaled by this hero's share of the floor, and at a hundred developers a
  // hero reaching one row moves the speedometer by well under the whole per
  // cent it prints — see the note under item 10 in §26.1.8.
  // The board's own close box, addressed by window: §22.9's card is underneath
  // it and now carries a close box of its own, so "the CLOSE button" is two
  // buttons on this frame. The strip is already gone — opening somebody hides
  // it — and closing the board leaves the card.
  await closeWindow(page, '.herotree', 'the hero board')
  await page.locator('.herocard[data-phase="in"]').waitFor()
  await page.waitForTimeout(400)
  const card = await governed(page)
  if (card.pips <= before.pips) {
    fail(`the card did not record the purchase: ${before.pips} pips before, ${card.pips} after`)
  }
  saw(`the card’s depth row went from ${before.pips} pips to ${card.pips} — an off-branch level still lands on the person`)
  await closeWindow(page, '.herocard', 'the hero’s card')
}

/**
 * Run the studio until something is true of it

/**
 * Run the studio until something is true of it — *"ship it, hire, ship it
 * again"*, which is the only instruction Act IIa ever gives.
 *
 * The difference from {@link until} is that this one **plays**. Items 6 to 10
 * are all waiting on a *feeling* — a release that shipped badly, a queue nobody
 * answered, the cap with money still in the bank — and none of those feelings
 * arrive at a studio of two people that nobody is running. The first draft of
 * this file waited instead of playing and sat at two developers for three
 * minutes watching a catalogue of five games fail to page anybody, which is
 * correct behaviour by the simulation and a walk that had stopped walking.
 */
async function play(page, label, predicate, { hire = true, budget = LEG_MS } = {}) {
  const deadline = Date.now() + budget
  for (;;) {
    const talking = await pumpScene(page)
    if (await predicate(page)) return
    await refuseBankruptcy(page)
    if (Date.now() > deadline) fail(`timed out waiting for ${label} — ${await where(page)}`)
    // §10.7a.3 — while a scene is up the HUD is genuinely inert, and the scrim
    // eats the tap. Pressing anything here is not a thing a player can do, and
    // it is also thirty seconds of Playwright waiting for a button that is
    // behind glass.
    //
    // §4.10d — **and the walk reads its own runway before it hires.** The first
    // version pressed HIRE whenever the button was live, which is exactly what
    // `affordable` means (`cash >= cost`, no payroll buffer) and exactly what
    // §6 punishes: it took the studio to the cap, hired a specialist on top,
    // and bankrupted Run 2 four items later. That is the simulation being
    // right. A walk is supposed to be a player who is paying attention, and the
    // thing a player pays attention to is the NET line under the cash.
    //
    // §4.1 — **and it stops at the top of the curve.** The speedometer is the
    // whole readout: at the cap it reads 50% sync, past it the studio is on the
    // falling half and every extra head is worth less than the last. A player
    // who keeps pressing through that is playing Run 1 again, which is a lesson
    // rather than a walk — the first version did exactly that, took Run 2 to
    // 1,160 developers on a cap of 100, and bankrupted itself at item 9.
    if (
      hire &&
      !talking &&
      (await cashFlow(page)) !== 'bad' &&
      (await syncReading(page)) >= 50
    ) {
      const control = btn(page, /HIRE DEVELOPER/)
      if ((await control.count()) && (await control.first().isEnabled())) {
        await control.first().click({ timeout: 2_000 }).catch(() => {})
      }
    }
    await page.waitForTimeout(120)
  }
}

/**
 * §4.3 — the speedometer, as a number. 100 is in sync; 50 is exactly the cap.
 *
 * Read off the gauge rather than out of the store, because it is the one figure
 * the whole of §4.1 exists to put in front of the player, and a walk that
 * decided when to stop hiring from a private field would be a walk that could
 * not notice the gauge lying.
 */
async function syncReading(page) {
  const gauge = page.locator('.hud__gauge .hud__num--major')
  if (!(await gauge.count())) return 100
  return Number.parseFloat((await gauge.first().textContent())?.replace('%', '') ?? '100')
}

/**
 * §10.1 — which way the money is going, read off the readout the player reads.
 *
 * `is-bad` is the class the HUD puts on a negative net flow, so this is
 * literally the red number under CASH rather than a second opinion about it.
 */
async function cashFlow(page) {
  const flow = page.locator('.hud__cash-flow')
  if (!(await flow.count())) return 'flat'
  const cls = (await flow.first().getAttribute('class')) ?? ''
  if (cls.includes('is-bad')) return 'bad'
  if (cls.includes('is-good')) return 'good'
  return 'flat'
}

/**
 * **A run that ends is a finding, not a step.**
 *
 * Run 1 is supposed to end in bankruptcy and every run after it is supposed to
 * end on §4.1 (§26.1.8 item 1). If the modal turns up in the middle of Run 2
 * the walk has either played badly or found something, and either way it must
 * stop rather than press the one button on the screen — which the first version
 * did, blind, in the middle of a canvas sweep, and quietly prestiged into a
 * third career while reporting on the second.
 */
async function refuseBankruptcy(page) {
  if (await page.locator('.bankruptcy[data-phase="in"]').count()) {
    fail(`the studio went bankrupt mid-run — ${await where(page)}`)
  }
}

// ---------------------------------------------------------------------------
// The other careers
//
// A reload is a new career (see the header), which is what makes item 5's
// *"buy a node on one career, tap twenty replies on another"* a thing a walk
// can do at all. Item 9's second half needs a third: **a fresh Run 1**, which
// is by definition a career that has not prestiged.
//
// These start from `?act` rather than from the title. §21's prologue is walked
// in full on career 1 and item 3 is the line that owns it; what these need is
// the *state after* it, which is exactly the argument `?full` already makes —
// the frame is real, the way of getting to it is not.
// ---------------------------------------------------------------------------

/**
 * Start a career from nothing, in a page of its own.
 *
 * **A new browser context, and it has to be** — clearing the save and reloading
 * does not work, which took a run to work out and is §24.9 doing exactly its
 * job: `installAutoSave` writes on `pagehide`, so the reload's own unload puts
 * the career straight back into the storage it was just deleted from, and the
 * next load reads it. A career cannot be ended from inside the page that is
 * living it.
 *
 * The founder's identity and §10.9.3's boot flag are seeded, because this is the
 * same person starting again rather than a new install — and because §26.1.8
 * item 3 owns the creator and these careers should not re-walk it.
 */
async function openCareer(browser, url) {
  const context = await browser.newContext({ viewport: SIZE })
  await context.addInitScript(() => {
    localStorage.setItem('m100devs.booted', '1')
    localStorage.setItem(
      'm100devs_founder_profile',
      JSON.stringify({ name: 'ADA', head: 'wave', body: 'jacket' }),
    )
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(url, { waitUntil: 'load' })
  await page.locator('.app').waitFor()
  beats.length = 0
  return page
}

/** Open a career that has never prestiged, at the top of Run 1. */
async function freshRunOne(browser) {
  const page = await openCareer(browser, `${origin}/?notitle&speed=${SPEED}&nopost`)
  await page.locator('.hud').waitFor()
  await page.waitForTimeout(1_200)
  const career = await careerState(page)
  if (career && career.shifts !== 0) fail(`this career has already prestiged — ${await where(page)}`)
  return page
}

/** Open a career that has just taken its first Paradigm Shift. */
async function freshRunTwo(browser) {
  const page = await openCareer(browser, `${origin}/?act=bankrupt&speed=${SPEED}&nopost`)
  await page.locator('.bankruptcy[data-phase="in"]').waitFor()
  await press(page, 'TRIGGER PARADIGM SHIFT')
  // §15.1a — the cut scene stands between the shift and Run 2, here too.
  await playBoot(page)
  await playScenes(page)
  if (!played('scene.run2.instant-messenger')) {
    fail(`this career did not reach Run 2 — ${await where(page)}`)
  }
  // §21.7.7e leaves James's new capability board in the player's hand. These
  // helper careers are about later systems, so return them to the running floor
  // after proving that the hand-off happened; item 4 owns the board walkthrough.
  const upgradeBoard = page.locator('.upgrade-board')
  if (await upgradeBoard.isVisible().catch(() => false)) {
    await closeWindow(page, '.hud__upgrades', 'the upgrade board')
  }
  return page
}

/**
 * Item 9's second half — *"open the founder's screen on a fresh Run 1 and find
 * no board there at all."*
 *
 * §21.7.7 gates the **board** and never the desk: §4.5d's corner seat is yours
 * from the garage and it is the whole clicker layer of Run 1. So the screen
 * opens and the tree is simply absent — no placeholder and no greyed rows,
 * because §21.7.6b says a silent row is the loudest kind of furniture.
 */
async function walkFreshRunOne(browser, size) {
  item('item 9, second half — the same screen on a fresh Run 1, with no board on it')
  const page = await freshRunOne(browser)

  await openFounderScreen(page, size)
  if (await page.locator('.founder-profile__tree').count()) {
    fail('a fresh Run 1 founder screen is already showing §13.7.1’s board')
  }
  // The screen itself is there, which is the half that must *not* be gated:
  // this is a person, and a person exists before their skill tree does.
  if (!(await page.locator('.founder-profile__identity').count())) {
    fail('the founder’s screen did not open at all on Run 1')
  }
  saw('the founder’s screen opens on Run 1 and carries no board — not a greyed one, none')
  await closeWindow(page, '.founder-profile', 'the founder’s screen')
  await page.context().close()
}

/**
 * Item 5 — §18.0a's THE THREAD, and both ways out of it.
 *
 * Two careers, because the two exits are mutually exclusive on one: the
 * purchase **retires** the event for the whole career and the twenty taps do
 * not. That difference is the entire design of §18.0's two exits and it is the
 * one thing this line asks the player to see.
 */
async function walkTheThread(browser, exit) {
  const page = await freshRunTwo(browser)

  // §18.0 — "its trigger is an empty board, not a headcount". Nothing is bought
  // on either of these careers before the modal, which is the precondition the
  // line states out loud.
  await play(page, 'twelve developers', async (p) => (await devs(p)) >= 12)

  /*
   * The event and its scene arrive on the same tick, and §10.6b holds the card
   * back until the box is gone: James explains the thread *before* the thread
   * is a control rather than from behind it. So the walk waits on the event in
   * the store, plays the scene out, and only then looks for the card.
   *
   * This used to wait on the card first, which worked when the card was drawn
   * as a picture behind the scrim. It is not drawn at all now, which is the
   * better realisation of the same sentence.
   */
  await until(page, 'THE THREAD to fire', async (p) =>
    Boolean(await p.evaluate(() => globalThis.__store?.event ?? null)),
  )
  if (!played('scene.run2.the-thread')) {
    fail(`THE THREAD fired without §18.0a’s scene — ${await where(page)}`)
  }
  await playScenes(page)
  await page.locator('.event-card[data-phase="in"]').waitFor({ timeout: 30_000 })
  const exits = (await page.locator('.event-card[data-phase="in"] button').allTextContents()).map(
    (t) => t.trim(),
  )
  if (exits.length !== 2) fail(`the modal offers ${exits.length} exits: ${JSON.stringify(exits)}`)

  if (exit === 'purchase') {
    item('item 5a — twelve developers, THE THREAD, and out through the board')
    saw(`reached twelve on an empty board and THE THREAD stopped the studio; its exits are ${JSON.stringify(exits)}`)
    await press(page, 'OPEN UPGRADES')
    await page.locator('.upgrade-board').waitFor()
    await page.waitForTimeout(400)
    const board = await readBoard(page)
    const target = board.nodes.find((n) => n.state === 'live' && !n.owned)
    if (!target) fail('the routed board offered nothing to buy — §25.3.2’s wall')
    await tapControl(page, page.getByRole('button', { name: target.name, exact: true }), target.name)
    await tapControl(page, page.locator('.upgrade-board__guide-card button'), `the price on ${target.name}`)
    await page.waitForTimeout(600)
    // §21.7.7e closes a guided first-use board on the purchase. A later visit
    // remains open and is closed by hand; both are valid returns to the floor.
    if (await page.locator('.hud__upgrades[data-phase="in"]').count()) {
      await closeWindow(page, '.hud__upgrades', 'the upgrade board')
    }
    await playScenes(page)

    if (!played('scene.run2.thread-cleared')) {
      fail('the purchase ended the thread without §18.0a’s payoff scene')
    }
    await mustStayGone(page, 'the purchase')
    saw(`bought ${target.name}; the thread archived itself, played §18.0a’s payoff, and stayed gone`)
    await page.context().close()
    return
  }

  item('item 5b — the same thread on another career, out of it by hand')

  /*
   * **The live surface only, and that is the whole of why this was wrong twice.**
   *
   * §18.0 has two faces for one event: the modal until the player chooses an
   * exit, then the banner. The first reply *is* that choice, so the card starts
   * leaving on the same tap — and a `Panel` stays mounted through its exit so it
   * has something to animate. `getByRole('button', …)` therefore matches the
   * dying card's button as well as the live banner's, `.first()` picks the dead
   * one, and every subsequent click lands on a pane that is on its way out. The
   * counter never moved, the loop ran to its cap, and the assertion that
   * followed passed on a thread nobody had touched.
   *
   * `[data-phase="in"]` is the difference between the two, and it is the same
   * distinction `ui-frame.acceptance.mjs` uses to decide what is on screen.
   */
  const reply = page
    .locator('.event-card[data-phase="in"] button, .event-banner button')
    .filter({ hasText: 'REPLY TO ALL' })

  /*
   * How many replies the control still says it owes.
   *
   * §18.0 puts the count inside the button, so the label is the readout. Zero
   * means the thread has gone; a number **larger than the last** means it has
   * come back, which at speed 40 happens on the tick after the twentieth tap and
   * is the thing item 5 asks the player to see.
   */
  const owed = async () => {
    if (!(await reply.count())) return 0
    const label = (await reply.first().textContent()) ?? ''
    const n = Number.parseInt(label.replace(/\D+/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  }

  const CLEAR_TAPS = 20
  let taps = 0
  let last = Number.POSITIVE_INFINITY
  let returned = false
  let cleared = false
  for (let round = 0; round < CLEAR_TAPS + 40; round++) {
    /*
     * The same rule as everywhere else: whatever the game is saying goes first,
     * because the scrim owns the tap while it is saying it. Leaving this out is
     * how thirty taps landed on §18.0a's scene and none on its button.
     *
     * **Drained rather than pumped, and `taps` counts button presses rather than
     * loop passes** [amended 2026-08-29]. Those were the same thing while every
     * scene in the game was short: one `pumpScene` per pass turned one page, and
     * a five-line arrival cost five of a budget of thirty. §21.7.3's Billy is
     * twenty-two lines — he is a hand-over as well as an introduction — and he
     * now arrives *inside* this leg, because a placed hero earns XP and the
     * §21.7.7c board follows. Seventeen taps landed, thirteen went on turning
     * his pages, and the leg reported "30 taps did not end a thread" about a
     * thread it had barely touched.
     *
     * A player taps through the box and then goes back to the button, which is
     * what this now does. The assertion is unchanged and is now measuring the
     * thing it names: presses on `REPLY TO ALL`, against §18.2's twenty.
     */
    await playScenes(page)
    const n = await owed()
    if (n === 0) {
      cleared = true
      break
    }
    if (n > last) {
      returned = true
      cleared = true
      break
    }
    last = n
    await reply.first().click({ timeout: 3_000 }).catch(() => {})
    taps++
    await page.waitForTimeout(60)
  }
  // Loud, because the failure this replaces was a *silent* one: a loop whose
  // taps all missed leaves the thread up, and everything below it then passes
  // by describing an event the walk never touched.
  if (!cleared) {
    fail(`${taps} taps did not end a thread §18.2 prices at ${CLEAR_TAPS} — ${await where(page)}`)
  }
  saw(`answered every one of them by hand — ${taps} taps against §18.2’s ${CLEAR_TAPS} — and the studio came back up`)

  if (played('scene.run2.thread-cleared')) {
    fail('the hand-clear played the purchase exit’s payoff; §18.0a gives it to one exit only')
  }

  // §18.0 — "it ends *this* instance and leaves the cause in place", so a
  // studio still over twelve with an empty board meets it again. That is the
  // whole of "only the first one retires it", and it is a thing you can watch.
  if (!returned) {
    await play(
      page,
      'the thread again',
      async (p) => (await p.locator('.event-card[data-phase="in"]').count()) > 0,
      { hire: false, budget: 60_000 },
    )
  }
  saw('twenty taps ended a thread and did not end threads — it came straight back, with no payoff scene')
  await page.context().close()
}

/**
 * The purchase exit's other half: it stays gone.
 *
 * Held against the same empty-board studio that raised it in the first place —
 * which is the condition the hand-cleared career re-triggers on within seconds.
 */
async function mustStayGone(page, how) {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    await pumpScene(page)
    if (await page.locator('.event-card[data-phase="in"]').count()) {
      fail(`THE THREAD came back after ${how} — §18.0 retires it for the whole career`)
    }
    await page.waitForTimeout(250)
  }
}

// ---------------------------------------------------------------------------
// Drive
//
// Last in the file, after every helper, because the walk is written as a
// sequence of named legs and a top-level `await` before their declarations
// reaches into the temporal dead zone.
// ---------------------------------------------------------------------------

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: SIZE })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await walkCareerOne(page)
  await context.close()
  await walkFreshRunOne(browser, SIZE)
  await walkTheThread(browser, 'purchase')
  await walkTheThread(browser, 'hand')

  process.stdout.write(`\n§26.1.8's walk passed (${notes.length} observations).\n`)
} finally {
  await browser?.close()
  server.kill()
}
