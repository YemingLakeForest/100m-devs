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
  return `run=${JSON.stringify(run)} career=${JSON.stringify(career)}`
}

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

/**
 * §10.7a.3 — a conversation interrupts, you tap through it, you carry on.
 *
 * Called from every wait, because that is what a scene is: the game speaking
 * over whatever the player was doing. It also has to be called from every wait
 * for a duller reason — `tick` returns early while a scene is up, so a leg that
 * waited on the simulation without clearing one would wait for ever.
 */
async function pumpScene(page) {
  const id = await page.evaluate(() => globalThis.__store?.scene ?? null)
  if (!id) return false
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
 * calls `focusFounderCamera`, so **the first tap moves the target** — the lens
 * walks the corner desk toward the middle of the frame and the fixed point is
 * then over empty floor. §21.0b's fifty pokes never arrived, Act I never ended,
 * and the run sat in `act1_poke` with four games shipped and fifty thousand
 * dollars in the bank, which is a perfectly reasonable studio and not the one
 * the script is about.
 *
 * That is worth keeping in the file rather than in a commit message: **a gate
 * that aims at a fixed screen point is aiming at a camera that has moved**, and
 * every canvas sweep below re-finds rather than remembers for the same reason.
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

/** What the studio's phase is, for waiting on §21's script. */
const phase = (page) => page.evaluate(() => globalThis.__store?.phase ?? null)
const devs = (page) => page.evaluate(() => globalThis.__store?.devs ?? 0)

/**
 * Hire, the way a player does: wait for the button to go live, press it, repeat.
 *
 * Never `hireDeveloper()` — the whole argument of this file is that the join
 * between a control and a verb is the thing that goes wrong.
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
  await pokeAt(page, SIZE, point, 52)
  await until(page, 'James at the door', async (p) => (await phase(p)) !== 'act1_poke')
  await playScenes(page)
  if (!played('scene.act1.james-arrives')) {
    fail(`fifty pokes did not bring James — played ${JSON.stringify(beats.map((b) => b.id))}`)
  }
  await until(page, 'James at a desk', async (p) => (await devs(p)) >= 1)
  saw('fifty pokes brought James, and he sat down (§21.7.1)')

  // §21 — the pitch waits on income, so the only job is to finish the sprint.
  await until(page, 'the first game to ship', async (p) => (await phase(p)) === 'act2_offer_hire')
  saw('shipped the garage’s first game and Act II opened its hire')

  // The first paid head. Act II holds until the whole garage catalogue is out
  // (§4.10f), so this is a hire and then three more ships.
  await press(page, /HIRE DEVELOPER/)
  await until(page, 'the second employee', async (p) => (await devs(p)) >= 2)
  await until(page, 'the garage catalogue', async (p) => (await phase(p)) === 'act2a_loop')
  saw('bought the first paid employee, then shipped out of the garage (§4.10f)')

  // §21.0a — the loop, until somebody with money believes in you.
  await hireUpTo(page, 10)
  await until(page, 'the term sheet', async (p) => (await phase(p)) === 'act2a_seed')
  await press(page, /ACCEPT TERM SHEET/)
  await until(page, 'Act IIb', async (p) => (await phase(p)) === 'act2b_loop')
  saw('hired to ten and took §21.0a’s term sheet')

  // §21.0 — Act II ends at the first headcount whose readout is not IN SYNC.
  await hireUpTo(page, 40)
  await until(page, 'the mousetrap', async (p) => (await phase(p)) === 'act3_bait')
  await playScenes(page)
  if (!played('scene.act3.mass-hire')) {
    fail(`Act III did not open on §21.0d’s scene — played ${JSON.stringify(beats.map((b) => b.id))}`)
  }
  saw('hired to forty and James signed the mass hire — it cannot be declined (§21.0d)')

  // §21 Acts IV and V. Nothing to press: the studio seizes and payroll finishes it.
  await until(page, 'the collapse', async (p) => (await devs(p)) > 500)
  await until(page, 'bankruptcy', async (p) => (await phase(p)) === 'bankrupt')
  await page.locator('.bankruptcy').waitFor()
  saw('the swarm landed, the studio seized, and payroll ended the run')

  await press(page, 'TRIGGER PARADIGM SHIFT')
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
/** §11.4's node box, in CSS px. `UpgradeBoard`'s own `NODE`, restated here. */
const NODE_PX = 66

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

  await press(page, 'UPGRADES')
  await page.locator('.upgrade-board').waitFor()
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
  const half = NODE_PX / 2
  const detached = before.nodes.filter(
    (n) => !before.ends.includes(`${Math.round(n.left + half)},${Math.round(n.top + half)}`),
  )
  if (detached.length > 0) {
    fail(`${detached.length} node(s) are not on a connector endpoint: ${detached.map((n) => n.name ?? 'dark').join(', ')}`)
  }

  const offWorld = before.nodes.filter(
    (n) =>
      n.left < 0 ||
      n.top < 0 ||
      n.left + NODE_PX > before.world.w ||
      n.top + NODE_PX > before.world.h,
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
  const reachable = (n) => n.state !== 'dark' && !n.owned
  await until(
    page,
    'a ring-1 node the studio can afford',
    async (p) => {
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

  await press(page, 'BACK')
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

  item('item 8 — the cap with cash spare brings Melany; past CHATTY brings Billy')
  // Both of these are §21.7.6's counter-example and worth saying out loud: they
  // hand over nothing, because the cap and the speedometer have been on screen
  // since Run 1's first minute. A person only brings what was not already there.
  await meets(page, {
    who: 'Melany',
    scene: 'scene.run2.melany-arrives',
    label: 'hit the developer cap with money still in the bank, and met Melany',
  })
  await meets(page, {
    who: 'Billy',
    scene: 'scene.run2.billy-arrives',
    label: 'read the speedometer past CHATTY, and met Billy',
  })
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
  await tapControl(page, page.locator('.touch__latch', { hasText: 'INFO' }), 'the INFO latch')
  await page.waitForTimeout(250)
  const panel = page.locator('.founder-profile[data-phase="in"]')

  /*
   * The step is the founder's own hit box, not a fine grid. `founderHit` gives
   * the avatar about 24 screen px either side and 50 tall at the scale a
   * hundred-developer room is drawn at, so 20 x 28 cannot miss it and a
   * finer sweep is ten thousand taps nobody has time for.
   */
  for (let pull = 0; pull <= 3; pull++) {
    for (let y = 24; y <= size.height - 60; y += 28) {
      for (let x = 180; x <= size.width - 200; x += 20) {
        await refuseBankruptcy(page)
        await tapWorld(page, x, y)
        if (await panel.count()) {
          await page.waitForTimeout(350)
          if (pull > 0) {
            saw(`the founder was not in the resting frame — it took ${pull} drag(s) on the floor to bring the corner desk back (§13.7.1a)`)
          }
          return
        }
      }
    }
    // §7.7.6 — drag the world. Downward, because the corner the room grew away
    // from is its north one, and north is up the frame.
    await dragWorld(page, { x: Math.round(size.width / 2), y: 110 }, { x: Math.round(size.width / 2), y: 400 })
  }
  fail(`no drag and no tap reached the founder — ${await where(page)}`)
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
  saw(
    boardAlready
      ? `hired a ${specialist}; §21.7.7's board had already come through its **other** door — the founder's share of the output fell past a twentieth first, which is the guarantee rather than the beat`
      : `hired the first ${specialist}, and §21.7.7's founder board arrived on it`,
  )

  // And the board is really there, on the screen the scene was about.
  await openFounderScreen(page, size)
  if (!(await page.locator('.founder-profile__tree').count())) {
    fail('the founder’s screen has no board on it after §21.7.7’s scene')
  }
  await press(page, 'BACK')
  // Back to the primary verb, so the rest of the walk taps the way Act I taught.
  await tapControl(page, page.locator('.touch__latch', { hasText: 'CODE' }), 'the CODE latch')
  saw('opened the founder’s screen from the floor and found §13.7.1’s Management tree on it')

  item('item 10 — a hero’s second level brings the shared board, and an off-branch point lands')

  await placeAHero(page, size)
  await play(page, 'somebody’s second level', () => played('scene.run2.hero-board'), { hire: false })
  saw('a placed hero earned a second level, and §13.9’s board arrived with the first point there was to spend')

  await spendOffBranch(page)
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
    await press(page, 'TEAM')
    await tapControl(page, page.locator('.roster__card'), 'the first card on the roster strip')
    await press(page, 'POST')
    await page.locator('.posting').waitFor()
  }
  await arm()

  for (let y = 40; y <= size.height - 80; y += 16) {
    for (let x = 200; x <= size.width - 220; x += 16) {
      await refuseBankruptcy(page)
      await tapWorld(page, x, y)
      await page.waitForTimeout(60)
      const s = await runState(page)
      if (s.placements.length > 0) {
        saw(`posted ${s.placements.join(', ')} onto the floor with §13.8a’s gesture`)
        return
      }
      // Open ground disarms, which is the cheap way out — re-arm and carry on.
      if (!s.posting) await arm()
    }
  }
  fail(`nowhere on the floor took a placement — ${await where(page)}`)
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
  await press(page, 'TEAM')
  await tapControl(page, page.locator('.roster__card'), 'the first card on the roster strip')
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
    if (await off.count()) {
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
  // BACK closes the board and leaves §22.9's card underneath it — the strip is
  // already gone, because opening somebody hides it.
  await press(page, 'BACK')
  await page.locator('.herocard[data-phase="in"]').waitFor()
  await page.waitForTimeout(400)
  const card = await governed(page)
  if (card.pips <= before.pips) {
    fail(`the card did not record the purchase: ${before.pips} pips before, ${card.pips} after`)
  }
  saw(`the card’s depth row went from ${before.pips} pips to ${card.pips} — an off-branch level still lands on the person`)
  await press(page, 'CLOSE')
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
  await playScenes(page)
  if (!played('scene.run2.instant-messenger')) {
    fail(`this career did not reach Run 2 — ${await where(page)}`)
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
  await press(page, 'BACK')
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
  await page.locator('.event-card[data-phase="in"]').waitFor({ timeout: 30_000 })
  if (!played('scene.run2.the-thread')) {
    fail(`THE THREAD fired without §18.0a’s scene — ${await where(page)}`)
  }
  // §10.7a.3 — James has to finish explaining it before the card is a control
  // rather than a picture behind a scrim.
  await playScenes(page)
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
    await press(page, 'BACK')
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
  for (; taps < CLEAR_TAPS + 10; taps++) {
    // The same rule as everywhere else: whatever the game is saying goes first,
    // because the scrim owns the tap while it is saying it. Leaving this out is
    // how thirty taps landed on §18.0a's scene and none on its button.
    await pumpScene(page)
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
