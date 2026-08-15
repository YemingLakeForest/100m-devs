/**
 * How long a run actually takes — GDD §13.12, §26.1.1.
 *
 * §13.12 states a target and §13.12.2 says out loud that **Run 2's length has
 * never been measured**. This is the instrument that measures it, and it is the
 * first thing in Phase 1 because §26.1.1 is right that everything else is sized
 * by it: a hero ladder that has to breathe across ninety minutes is a different
 * piece of work from one that has to fit in four, and an upgrade tree is a
 * different tree if its second node is reachable in a run or in fifty days.
 *
 * ## Why a simulated player rather than arithmetic
 *
 * `runOne.test.ts` already makes the case for simulating over asserting —
 * *"every constant can be individually defensible and the loop still not
 * close"* — and pacing is the same problem one level up. The velocity equation,
 * the hire curve, the revenue ladder, the wage and the BP yield are each
 * defensible, and what they do **together over an hour** is not visible in any
 * of them.
 *
 * ## The policy, and why it is a floor rather than a prediction
 *
 * {@link playRun} is a competent, patient player who is *always present*: they
 * poke continuously, hire whenever the treasury can stand it, buy the cheapest
 * affordable node, and take the shift when growth stalls. A real player is not
 * always present, so **every number this file reports is a lower bound on the
 * wall-clock a real player would spend.** If a run measures at three hours of
 * continuous attention, it is at least three hours.
 *
 * The numbers are *printed* rather than only asserted. A pacing test that fails
 * silently at "expected 1200 to be less than 900" tells the next reader nothing
 * about which curve bent; the table does.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  buyFounderNode,
  buyParadigmNode,
  buyTech,
  currentEntropy,
  dismissScene,
  effectiveDevCap,
  founderOf,
  getState,
  hireDeveloper,
  nextHireCost,
  poke,
  takeSeedRound,
  tick,
  triggerParadigmShift,
} from './store.ts'
import { emptyPermanent, getPermanent, setPermanent } from './save.ts'
import { PARADIGM_TREE, bpFor, nodeCost } from '../sim/prestige.ts'
import { TECH_TREE, boardCost, canBuyTech, techLevel } from '../sim/techTree.ts'
import { payrollPerSecond } from '../sim/economy.ts'
import { FOUNDER_TREE, founderCost, hireGrowthFor } from '../sim/founder.ts'
import { quote } from '../sim/hireDial.ts'

/** §7.8.7's shares are seeded; a pacing measurement must not roll dice. */
const FIXED_SEED = 0x5eed

/**
 * Simulated seconds per step.
 *
 * A quarter second rather than a frame: these runs are hours long, and the
 * simulation integrates rather than counting frames, so the step only has to be
 * short against the fastest thing that matters — §4.5a's fifteen-second buff.
 * Verified against a 1/30 step in {@link stepSizeIsHonest}.
 */
const STEP = 0.25

/**
 * The measurement horizon.
 *
 * Two hours of *simulated, attended* play. A run that reaches it has not failed
 * — §13.12.1 puts mid-game runs at two to eight hours — it has simply outgrown
 * what this file can watch in a test suite, and the table says `horizon` rather
 * than pretending to a number.
 */
const MAX_RUN_SECONDS = 2 * 3600

/** Growth this stale means the studio has hit its wall — §13.12's "first real wall". */
const STALL_SECONDS = 180

/**
 * Seconds of payroll a cautious player keeps standing.
 *
 * Probed at 1, 5 and 30 while diagnosing the plateau: headcount came out at
 * ~185 at all three, which is what ruled the harness's own caution out as the
 * cause and sent the search back into the game.
 */
const BUFFER_SECONDS = 30

interface RunReport {
  run: number
  /** Simulated seconds of continuous, attended play. */
  seconds: number
  peakDevs: number
  shipped: number
  revenue: number
  /** BP the shift paid out. */
  bp: number
  /** What stopped the studio growing. */
  wall: 'hire-cost' | 'entropy' | 'horizon'
  /** Cap at the end, and the headcount actually reached. */
  cap: number
  devs: number
  /** §13.7.1 levels held at the end of the run, for reading the lever. */
  founder: string
  hireGrowth: number
}

/**
 * Spend cash on the cheapest founder node that still leaves the payroll buffer.
 *
 * §13.7.1's tree is `meta` and therefore permanent, so this is the one purchase
 * in the harness whose effect survives the shift at the end of the run.
 */
function buyCheapestFounderNode(buffer: number): void {
  const levels = getPermanent().meta.founderLevels ?? {}
  const cash = getState().cash
  let best: { id: string; cost: number } | null = null
  for (const node of FOUNDER_TREE) {
    const level = levels[node.id] ?? 0
    if (level >= node.maxLevel) continue
    const cost = founderCost(node, level)
    if (cost > cash - buffer) continue
    if (!best || cost < best.cost) best = { id: node.id, cost }
  }
  if (best) buyFounderNode(best.id)
}

/** The cheapest tech node this studio could buy right now, or null. */
function cheapestTech(): string | null {
  const s = getState()
  const shifts = getPermanent().meta.paradigmShifts
  let best: { id: string; cost: number } | null = null
  for (const node of TECH_TREE) {
    if (!canBuyTech(node, s.tech, s.cash, shifts)) continue
    const cost = boardCost(node, techLevel(s.tech, node.id), shifts)
    if (!best || cost < best.cost) best = { id: node.id, cost }
  }
  return best?.id ?? null
}

/**
 * Spend BP greedily on the cheapest affordable node, deepest-first among ties.
 *
 * A real player would not do this — they would save for Telepathic Compression
 * — but greedy is the *generous* policy for a pacing floor: it never leaves BP
 * unspent, so it cannot make the tree look slower than it is.
 */
function spendBp(): void {
  for (let guard = 0; guard < 50; guard++) {
    const p = getPermanent()
    let bought = false
    const affordable = PARADIGM_TREE.map((n) => ({
      n,
      cost: nodeCost(n, p.layer1.paradigmLevels[n.id] ?? 0),
      level: p.layer1.paradigmLevels[n.id] ?? 0,
    }))
      .filter((c) => c.level < c.n.maxLevel && c.cost <= p.layer1.bp)
      .sort((a, b) => a.cost - b.cost)
    if (affordable.length > 0) bought = buyParadigmNode(affordable[0].n.id)
    if (!bought) return
  }
}

/**
 * Play one run to its wall, with a player who never leaves.
 *
 * `pokesPerSecond` is §21's own figure for sustained play. Hiring keeps a
 * thirty-second payroll buffer, which is the least a player can hold without
 * §4.10d's bankruptcy being a coin flip.
 */
function playRun(run: number, pokesPerSecond = 3): RunReport {
  // §7.8.7's seed is re-rolled by every Paradigm Shift, and §4.9a's output
  // shares are drawn from it — so without this each run measures a different
  // studio and the table stops being comparable to itself. Pinned per run
  // rather than once, because the shift is what re-rolls it.
  __setState({ runSeed: FIXED_SEED })
  const startRevenue = getState().lifetimeRevenue
  let t = 0
  let owedPokes = 0
  let lastGrowthAt = 0
  let peakSeen = getState().devs
  let wall: RunReport['wall'] = 'horizon'

  while (t < MAX_RUN_SECONDS) {
    const s = getState()
    if (s.scene !== null) dismissScene()

    // §21.0a — the term sheet is free money and a player takes it on sight.
    if (!s.seedTaken) takeSeedRound()

    owedPokes += pokesPerSecond * STEP
    while (owedPokes >= 1) {
      poke(0, 0, { rung: 0, index: 0 })
      owedPokes -= 1
    }

    // Hire while it leaves thirty seconds of payroll standing, and while the
    // next head is still worth having — §4.1 turns down past the optimum, so a
    // player who keeps hiring past it is playing Run 1's mistake on purpose.
    // §4.10a — payroll starts at the *third* head, so a buffer measured off raw
    // headcount charges a two-person studio for wages it does not pay and
    // freezes the opening of every run after a prestige. Measured off the real
    // payroll instead.
    const buffer = BUFFER_SECONDS * payrollPerSecond(getState().devs + 1)
    while (
      getState().cash - nextHireCost() > buffer &&
      getState().devs < effectiveDevCap() * 0.758 &&
      hireDeveloper()
    ) {
      /* keep hiring */
    }

    const node = cheapestTech()
    if (node) buyTech(node)

    // §13.7.1's Recruiting, bought whenever it is affordable and still leaves a
    // buffer. A player who never buys it is playing the pre-node game, so a
    // pacing floor has to include somebody who does.
    buyCheapestFounderNode(buffer)

    tick(STEP)
    t += STEP

    const now = getState()
    if (now.devs > peakSeen) {
      peakSeen = now.devs
      lastGrowthAt = t
    }
    if (t - lastGrowthAt > STALL_SECONDS) {
      // Which wall? If the studio is nowhere near its cap, the thing stopping it
      // is the price of the next head, not §4.1.
      wall = now.devs < effectiveDevCap() * 0.7 ? 'hire-cost' : 'entropy'
      break
    }
  }

  const end = getState()
  const bp = bpFor(end.lifetimeRevenue, end.peakDevs)
  const report: RunReport = {
    run,
    seconds: t,
    peakDevs: end.peakDevs,
    shipped: end.projectsShipped,
    revenue: end.lifetimeRevenue - startRevenue,
    bp,
    wall,
    cap: effectiveDevCap(),
    devs: end.devs,
    founder: Object.entries(getPermanent().meta.founderLevels ?? {})
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k.replace('M-', '')}${v}`)
      .join(' '),
    hireGrowth: founderOf().hireGrowth,
  }

  triggerParadigmShift()
  spendBp()
  return report
}

function hms(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function table(rows: RunReport[]): string {
  const head = 'run |    length | devs / cap        | shipped |    revenue |   BP | wall      | founder'
  const line = rows.map(
    (r) =>
      `${String(r.run).padStart(3)} | ${hms(r.seconds).padStart(9)} | ` +
      `${String(Math.floor(r.devs)).padStart(6)} / ${String(Math.floor(r.cap)).padEnd(10)}| ` +
      `${String(r.shipped).padStart(7)} | ${money(r.revenue).padStart(10)} | ` +
      `${String(r.bp).padStart(4)} | ${r.wall.padEnd(10)}| g=${r.hireGrowth.toFixed(4)} ${r.founder}`,
  )
  return [head, ...line].join('\n')
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  __setState({ runSeed: FIXED_SEED })
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§13.12 — how long a run actually takes', () => {
  // Eight runs of up to two simulated hours each. Slow for a unit test and
  // cheap for the thing it replaces, which is playing the game for a day.
  it('measures the first eight runs and prints what stopped each one', { timeout: 120_000 }, () => {
    const rows: RunReport[] = []
    for (let run = 1; run <= 8; run++) rows.push(playRun(run))

    // eslint-disable-next-line no-console
    console.log(`\n§13.12 — measured run pacing, attended play at 3 pokes/sec\n${table(rows)}\n`)

    const last = rows[rows.length - 1]

    // **Run 1 ends on §4.1.** It is the trap, and the trap is entropy.
    expect(rows[0].wall).toBe('entropy')

    // **The loop keeps moving.** Before §13.7.1's Recruiting node was wired
    // through `quote`, every run from the third onward returned 29 BP and ~180
    // developers for ever — the plateau this file was built to find. The
    // assertion is deliberately about the *later* run beating the early one
    // rather than about monotonicity: a greedy spend policy can trade a run's
    // yield for a permanent node and come out behind on the run and ahead on
    // the game, which is a decision the player is allowed to make.
    expect(last.bp).toBeGreaterThan(rows[2].bp * 2)
    expect(last.devs).toBeGreaterThan(rows[0].devs * 5)

    // **The cap stops being decorative.** It used to climb past a million while
    // headcount sat at 180; the studio now uses a real share of what it is
    // allowed.
    expect(last.devs / rows[0].devs).toBeGreaterThan(10)
  })

  /**
   * §4.2's cap is meant to be the wall — it is the whole thesis of the game.
   * **If the studio stalls well short of its own cap, the price of a developer
   * has become a second and harder wall**, and §6's lesson is being taught by
   * the wrong system.
   */
  it('puts §13.7.1’s lever on the transaction, not just the readout', { timeout: 120_000 }, () => {
    const rows: RunReport[] = []
    for (let run = 1; run <= 4; run++) rows.push(playRun(run))

    // eslint-disable-next-line no-console
    console.log(`\nwhat stopped each run\n${table(rows)}\n`)

    // §13.7.1's lever has to reach the *transaction*, not just the readout.
    // `nextHireCost` is what the HUD shows and `quote` is what the game charges,
    // and for one commit the node moved only the first: the harness bought four
    // levels, printed a growth base of 1.005, and measured a studio still
    // stalled at 185 developers.
    const withNode = quote(500, 1e12, 1, hireGrowthFor(4)).cost
    const without = quote(500, 1e12, 1, hireGrowthFor(0)).cost
    expect(withNode).toBeLessThan(without)
  })
})

describe('the step size is honest', () => {
  it('agrees with a frame-rate step over a short window', () => {
    const coarse = (() => {
      __resetStore()
      __setState({ runSeed: FIXED_SEED, devs: 40, cash: 1e6 })
      for (let t = 0; t < 120; t += 0.25) tick(0.25)
      return getState().lifetimeRevenue
    })()
    const fine = (() => {
      __resetStore()
      __setState({ runSeed: FIXED_SEED, devs: 40, cash: 1e6 })
      for (let t = 0; t < 120; t += 1 / 30) tick(1 / 30)
      return getState().lifetimeRevenue
    })()
    // Within a percent over two minutes: the integrator is not step-sensitive
    // at the scale this file measures.
    expect(Math.abs(coarse - fine) / Math.max(1, fine)).toBeLessThan(0.01)
  })
})

describe('§4.1 — where the studio actually tops out', () => {
  /**
   * The optimum headcount is `D* = C·(1/4)^(1/5) ≈ 0.758C` at RHO 5, and peak
   * output is `0.606·C`. **Output is linear in the cap**, which is what makes
   * the cap the only lever that matters — and what makes any cost curve that
   * grows faster than linearly in headcount a wall the cap cannot answer.
   */
  it('peaks at about three quarters of the cap, and the peak is linear in it', () => {
    const peakFor = (cap: number) => {
      let best = 0
      let at = 0
      for (let d = 1; d <= cap * 1.5; d = Math.max(d + 1, Math.floor(d * 1.02))) {
        __resetStore()
        __setState({ runSeed: FIXED_SEED, devs: d, devCap: cap })
        const v = d * (1 - currentEntropy())
        if (v > best) {
          best = v
          at = d
        }
      }
      return { best, at }
    }

    const small = peakFor(100)
    const large = peakFor(1000)
    expect(small.at / 100).toBeCloseTo(0.758, 1)
    expect(small.best / 100).toBeCloseTo(0.606, 1)
    // Ten times the cap is ten times the output — no more, no less.
    expect(large.best / small.best).toBeCloseTo(10, 0)
  })
})
