/**
 * The scripted player, in one place — plan 2026-10-16, phase 1.
 *
 * Three files used to carry their own copy of the same player: `pacing.test.ts`
 * (always present, three pokes a second, hires to §4.1's optimum),
 * `arrivalOrder.test.ts` (the same, pressing SHIP! by hand a few seconds late)
 * and the throwaway vitest the fun-killers audit was measured with
 * (`docs/AUDIT-2026-10-16-fun-killers.html`), which added the careful / greedy /
 * manual-only split. Every phase of that plan re-prints the audit's table to
 * show what moved, and a table printed by a player that drifted between
 * phases measures the drift. So the player lives here, and the tests ask it.
 *
 * It flatters the game on purpose: it never misses a SHIP! and never misreads
 * the speedometer, so every timing it reports is a best case, and a stretch
 * that is dull for it is duller for a person.
 *
 * Not a test file — it holds no assertions — and not app code: nothing under
 * `src/` outside a test may import it.
 */

import {
  __setState,
  buyTreeNode,
  currentEntropy,
  dismissScene,
  effectiveDevCap,
  getState,
  hireDeveloper,
  launchRelease,
  launchView,
  massHire,
  nextHireCost,
  poke,
  pressShip,
  projectOrdinal,
  setHolding,
  shelfBlocked,
  takeSeedRound,
  tick,
  treePriceOf,
  treeRefusalOf,
  triggerParadigmShift,
} from '../game/store.ts'
import { payrollPerSecond } from '../sim/economy.ts'
import { TRAIN_LAUNCH } from '../sim/release.ts'
import { TREE_HEROES, TREES, isBuilt, type TreeHero } from '../sim/upgradeTrees.ts'

/**
 * Simulated seconds per step. `pacing.test.ts` verifies a quarter second
 * against a 1/30 step; it only has to be short against §4.5a's fifteen-second
 * buff, the fastest thing that matters.
 */
export const PROBE_STEP = 0.25

/** §7.8.7's shares are seeded; a measurement must not roll dice. */
export const PROBE_SEED = 0x5eed

/** The probe's own clock, in the milliseconds `performance.now` reports. */
let simulatedMs = 0

/**
 * Make two prints of the same table the same table.
 *
 * Pinning the run seed was not enough: measured, two back-to-back prints of the
 * careful player differed by an order of magnitude in cash at minute 10. The
 * store still reads two clocks a simulation does not own — `performance.now`
 * ages bubbles and floaters, and a bubble on screen is a gate some story beats
 * wait behind — and `Math.random` picks the slacker James lifts. Both are
 * swapped for the probe's own for as long as it runs. Returns the undo.
 */
export function pinClocks(): () => void {
  const now = performance.now
  const random = Math.random
  let a = PROBE_SEED
  simulatedMs = 0
  performance.now = () => simulatedMs
  // mulberry32 — small, seeded, and good enough to pick a desk.
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => {
    performance.now = now
    Math.random = random
  }
}

/**
 * §4.1's output optimum as a share of the cap. A careful player stops hiring
 * here because the next head past it costs output; the greedy one does not.
 */
export const OPTIMUM_SHARE = 0.758

/**
 * Seconds of payroll a cautious player keeps standing, measured at the
 * headcount they are hiring *to* (`pacing.test.ts` records the frame where a
 * stale buffer hired 1,330 people on a few thousand dollars).
 */
export const BUFFER_SECONDS = 30

/**
 * - `careful` hires to {@link OPTIMUM_SHARE} and buys the cheapest wired upgrade
 *   the buffer allows — the audit's "the game's own best-output point".
 * - `greedy` hires whenever the buffer stands, past the optimum, and buys the
 *   same upgrades. It is the player Billy's lesson is written for.
 * - `manualOnly` hires as `careful` does and never opens a tree.
 */
export type ProbePolicy = 'careful' | 'greedy' | 'manualOnly'

export interface ProbeSettings {
  policy: ProbePolicy
  /**
   * Seconds between a build reaching the shelf and the thumb reaching SHIP!.
   * The audit pressed it at eight, so SHIP! is a chore and not a test seam.
   */
  shipLatency: number
  pokesPerSecond?: number
}

/** Running totals a probe reads deltas from. Mutated by {@link playStep}. */
export interface ProbeCounters {
  /** SHIP! presses that opened the ring. */
  rings: number
  /** Seconds the floor stood still behind a full buffer (§10.7). */
  blocked: number
  /** Builds that reached the shelf, and when the last one did. */
  builds: number
  lastBuildAt: number | null
  /** Seconds between the last two builds — the studio's actual cadence. */
  lastBuildSeconds: number | null
  /** Sum and count of build intervals since the last read, for a mean. */
  intervalSum: number
  intervalCount: number
}

export interface ProbePlayer {
  readonly settings: Required<ProbeSettings>
  readonly counters: ProbeCounters
  /** Simulated seconds this player has played, across runs. */
  t: number
  owedPokes: number
  shelfWait: number
  ordinal: number
  /** Called with each scene id as it opens, before the player dismisses it. */
  onScene?: (id: string) => void
}

export function createPlayer(settings: ProbeSettings, onScene?: (id: string) => void): ProbePlayer {
  return {
    settings: { pokesPerSecond: 3, ...settings },
    counters: {
      rings: 0, blocked: 0, builds: 0, lastBuildAt: null, lastBuildSeconds: null, intervalSum: 0, intervalCount: 0,
    },
    t: 0,
    owedPokes: 0,
    shelfWait: 0,
    ordinal: projectOrdinal(),
    onScene,
  }
}

/** Poke at `rate` a second for `dt`, carrying the fraction between steps. */
export function pokeFor(owed: number, rate: number, dt: number): number {
  owed += rate * dt
  while (owed >= 1) {
    poke(0, 0, { rung: 0, index: 0 })
    owed -= 1
  }
  return owed
}

/**
 * Hire while the buffer stands, recomputed every hire, and — unless greedy —
 * while the next head is still under the optimum.
 */
export function hireWhileAffordable(stopAtOptimum: boolean): void {
  for (;;) {
    const s = getState()
    if (s.cash - nextHireCost() <= BUFFER_SECONDS * payrollPerSecond(s.devs + 1)) break
    if (stopAtOptimum && s.devs >= effectiveDevCap() * OPTIMUM_SHARE) break
    if (!hireDeveloper()) break
  }
}

/**
 * The cheapest node that does something (`isBuilt`), in any tree, that the
 * buffer can stand — or null.
 */
export function cheapestBuiltNode(): { hero: TreeHero; id: string } | null {
  const s = getState()
  const spare = s.cash - BUFFER_SECONDS * payrollPerSecond(s.devs + 1)
  let best: { hero: TreeHero; id: string; cost: number } | null = null
  for (const hero of TREE_HEROES) {
    for (const node of TREES[hero]) {
      if (!isBuilt(node) || treeRefusalOf(hero, node.id) !== null) continue
      const cost = treePriceOf(hero, node.id)
      if (cost === null || cost > spare) continue
      if (!best || cost < best.cost) best = { hero, id: node.id, cost }
    }
  }
  return best
}

/**
 * One step of attended play: answer any scene, take the free money, take the
 * bait on sight (§21.0d), poke, hire, maybe buy, tick, and press SHIP! once the
 * latency has passed.
 */
export function playStep(p: ProbePlayer, dt = PROBE_STEP): void {
  const s = getState()
  if (s.scene !== null) {
    p.onScene?.(s.scene)
    dismissScene()
  }
  if (!s.seedTaken) takeSeedRound()
  // `s` is the frame before the dismiss, as a thumb would see it: the scrim
  // refuses the tap on the frame a scene closes (§10.7a.3).
  if (s.phase === 'act3_bait' && s.scene === null) massHire()

  p.owedPokes = pokeFor(p.owedPokes, p.settings.pokesPerSecond, dt)
  hireWhileAffordable(p.settings.policy !== 'greedy')
  if (p.settings.policy !== 'manualOnly') {
    const node = cheapestBuiltNode()
    if (node) buyTreeNode(node.hero, node.id)
  }

  if (shelfBlocked()) p.counters.blocked += dt
  tick(dt)
  p.t += dt
  simulatedMs += dt * 1000

  // A build landing claims the next ordinal (`projectOrdinal`); a release moves
  // it from the buffer into the history and leaves the ordinal where it was.
  const ordinal = projectOrdinal()
  if (ordinal > p.ordinal) {
    const c = p.counters
    c.builds += ordinal - p.ordinal
    if (c.lastBuildAt !== null) {
      c.lastBuildSeconds = p.t - c.lastBuildAt
      c.intervalSum += c.lastBuildSeconds
      c.intervalCount += 1
    }
    c.lastBuildAt = p.t
  }
  p.ordinal = ordinal

  /*
   * [plan 2026-10-16, phase 4.5] SHIP!, as a player who has read the button
   * would press it. Before Serena: every build is a ring, pressed after the
   * latency. With Serena: pressing gains nothing over her (she ships at her
   * terms, a few seconds later), so the player leaves it to her — unless Launch
   * Day is owned and the queue can hold a launch, when they HOLD and launch the
   * batch as soon as it is big enough. The ring is answered at the train, as it
   * always was here: this player measures time, not aim.
   */
  const launch = launchView()
  if (launch.mode !== 'ring') {
    const wantHold = launch.canHold && launch.reachable
    if (getState().holding !== wantHold) setHolding(wantHold)
    if (getState().holding && launchView().ready && pressShip() === 'ring') {
      p.counters.rings += 1
      launchRelease(TRAIN_LAUNCH)
    }
    p.shelfWait = 0
    return
  }
  if (getState().shelf.length > 0) {
    p.shelfWait += dt
    if (p.shelfWait >= p.settings.shipLatency && pressShip() === 'ring') {
      p.counters.rings += 1
      launchRelease(TRAIN_LAUNCH)
      p.shelfWait = 0
    }
  } else p.shelfWait = 0
}

/**
 * Run 1, played to its end: the trap is taken and §4.10d's payroll finishes
 * it. Then the shift. Three simulated hours is a bound, not an expectation —
 * Run 1 is about four minutes.
 */
export function playRunOneAndShift(p: ProbePlayer): void {
  __setState({ runSeed: PROBE_SEED })
  const start = p.t
  while (p.t - start < 3 * 3600) {
    playStep(p)
    if (getState().phase === 'bankrupt') break
  }
  triggerParadigmShift()
  // §7.8.7's seed is re-rolled by the shift from the wall clock, so without
  // this two prints of the same table measure two different studios.
  __setState({ runSeed: PROBE_SEED })
  // The shift rebuilt the run; the ordinal and the build clock start again.
  p.ordinal = projectOrdinal()
  p.counters.lastBuildAt = null
  p.shelfWait = 0
}

/** What one simulated minute looked like. */
export interface ProbeMinute {
  minute: number
  scenes: string[]
  devs: number
  cap: number
  entropy: number
  cash: number
  /** Mean seconds between builds landing this minute, else the last one seen. */
  buildSeconds: number | null
  handShips: number
  autoShips: number
  rings: number
  blocked: number
  incidents: number
  tickets: number
  /** Dollars refunded this minute. Zero until phase 5 gives releases a `refunded` field. */
  refunds: number
}

/**
 * Sum of every refund the catalogue has logged. Read structurally so the probe
 * can print the column before phase 5 adds the field, and keeps printing it
 * after without an edit here.
 */
function refundedSoFar(): number {
  let sum = 0
  for (const r of getState().releases) {
    const v = (r as { refunded?: unknown }).refunded
    if (typeof v === 'number' && Number.isFinite(v)) sum += v
  }
  return sum
}

/**
 * Play Run 1 and the shift, then `minutes` of Run 2, and report each minute of
 * Run 2. `onScene` sees every scene id in either run.
 */
export function probeRunTwo(settings: ProbeSettings, minutes: number): ProbeMinute[] {
  let scenes: string[] = []
  let inRunTwo = false
  const p = createPlayer(settings, (id) => {
    if (inRunTwo) scenes.push(id)
  })
  playRunOneAndShift(p)
  inRunTwo = true

  const rows: ProbeMinute[] = []
  const c = p.counters
  let shipped = getState().projectsShipped
  let hand = getState().handReleases
  let rings = c.rings
  let blocked = c.blocked
  let refunded = refundedSoFar()
  let beatsSeen = getState().beatsSaid.length
  c.intervalSum = 0
  c.intervalCount = 0

  for (let minute = 1; minute <= minutes; minute++) {
    const until = minute * 60
    let elapsed = (minute - 1) * 60
    while (elapsed < until) {
      playStep(p)
      elapsed += PROBE_STEP
    }
    const s = getState()
    // §21.7.8's milestone lines share the column: the probe's question is what
    // the player was told, and when, and a line is something they were told.
    for (const beat of s.beatsSaid.slice(beatsSeen)) scenes.push(`beat:${beat}`)
    beatsSeen = s.beatsSaid.length
    const refundNow = refundedSoFar()
    const handNow = s.handReleases - hand
    rows.push({
      minute,
      scenes,
      devs: s.devs,
      cap: effectiveDevCap(),
      entropy: currentEntropy(),
      cash: s.cash,
      buildSeconds: c.intervalCount > 0 ? c.intervalSum / c.intervalCount : c.lastBuildSeconds,
      handShips: handNow,
      autoShips: Math.max(0, s.projectsShipped - shipped - handNow),
      rings: c.rings - rings,
      blocked: c.blocked - blocked,
      incidents: s.incidents.length,
      tickets: s.tickets,
      // A refund that retires with its release leaves the sum; never print a
      // negative refund for it.
      refunds: Math.max(0, refundNow - refunded),
    })
    scenes = []
    shipped = s.projectsShipped
    hand = s.handReleases
    rings = c.rings
    blocked = c.blocked
    refunded = refundNow
    c.intervalSum = 0
    c.intervalCount = 0
  }
  return rows
}

function money(n: number): string {
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`
  return `${sign}$${a.toFixed(0)}`
}

/** The audit's table, one row per minute. */
export function probeTable(label: string, rows: ProbeMinute[]): string {
  const head =
    'min |  devs |    cap | entropy |     cash | build | hand | auto | rings | blocked | inc | tickets |  refunds | scenes'
  const lines = rows.map(
    (r) =>
      `${String(r.minute).padStart(3)} | ${String(Math.floor(r.devs)).padStart(5)} | ` +
      `${String(Math.floor(r.cap)).padStart(6)} | ${r.entropy.toFixed(2).padStart(7)} | ` +
      `${money(r.cash).padStart(8)} | ${(r.buildSeconds === null ? '—' : `${r.buildSeconds.toFixed(0)}s`).padStart(5)} | ` +
      `${String(r.handShips).padStart(4)} | ${String(r.autoShips).padStart(4)} | ${String(r.rings).padStart(5)} | ` +
      `${`${r.blocked.toFixed(0)}s`.padStart(7)} | ${String(r.incidents).padStart(3)} | ` +
      `${String(Math.round(r.tickets)).padStart(7)} | ${money(r.refunds).padStart(8)} | ${r.scenes.join(', ')}`,
  )
  return [`${label}`, head, ...lines].join('\n')
}
