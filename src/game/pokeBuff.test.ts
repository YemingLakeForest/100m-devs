/**
 * The poke as a buff, in the store — GDD §4.5a and §4.5b, R14 and R15.
 *
 * `sim/buffs.ts` proves the overlay arithmetic; this proves the thing the
 * player actually experiences. Two claims matter more than the rest and both
 * are here:
 *
 * 1. **A poke is worth exactly what §4.5 always said it was**, and only its
 *    arrival moved. §4.10's Run 1 economy is calibrated on that number.
 * 2. **The per-developer velocities still sum to the studio's.** §8.2b draws one
 *    numeral per head and §10.1 draws the total above them, and R14 is the first
 *    thing in the game that can make those two disagree.
 */

import Decimal from 'break_infinity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { BUFF_TAU } from '../sim/buffs.ts'
import { emptySlack } from '../sim/slackOff.ts'
import {
  __resetStore,
  __setState,
  baseVelocity,
  currentVelocity,
  developerShare,
  developerVelocity,
  getState,
  poke,
  POKE_PAYOUT_SHARE,
  releaseNow,
  tick,
} from './store.ts'

beforeEach(() => {
  __resetStore()
})

/** A studio big enough to have neighbours, and healthy enough to produce. */
function studio(devs = 40) {
  __setState({ devs, devCap: devs * 2, peakDevs: devs })
}

/** Run the clock for `seconds`, at frame rate, poking nothing. */
function idle(seconds: number) {
  const step = 1 / 60
  for (let t = 0; t < seconds; t += step) {
    tick(step)
    // §10.8b — a studio of forty people finishes a project inside these loops,
    // and the launch window halts `tick` until somebody answers it. The neutral
    // date pays ×1, so nothing this file measures moves.
    if (getState().pendingRelease !== null) releaseNow()
  }
}

describe('a poke buffs the individual (GDD §4.5a, R14)', () => {
  it('raises the output of the developer it landed on', () => {
    studio()
    const before = developerVelocity(7)
    poke(0, 0, { rung: 2, index: 7 })
    expect(developerVelocity(7)).toBeGreaterThan(before)
  })

  it('leaves the developer beside them alone — who you poke matters', () => {
    // Measured against the same instant with the overlay removed, not against
    // the instant before the tap. §4.9 charges local Entropy for the
    // interruption and that lands on everybody, so "before and after" would be
    // testing the context-switch penalty rather than the buff.
    studio()
    poke(0, 0, { rung: 2, index: 7 })
    const unbuffed = { ...getState(), buffs: [] }
    expect(developerVelocity(8)).toBeCloseTo(developerVelocity(8, unbuffed), 10)
    expect(developerVelocity(7)).toBeGreaterThan(developerVelocity(7, unbuffed))
  })

  it('raises the studio above its own passive rate', () => {
    studio()
    poke(0, 0, { rung: 2, index: 7 })
    expect(currentVelocity()).toBeGreaterThan(baseVelocity())
  })

  it('fades, so the loop is maintenance rather than mashing', () => {
    studio()
    poke(0, 0, { rung: 2, index: 7 })
    expect(currentVelocity()).toBeGreaterThan(baseVelocity())

    idle(BUFF_TAU * 8)
    expect(currentVelocity()).toBeCloseTo(baseVelocity(), 8)
    expect(getState().buffs).toHaveLength(0)
  })

  it('stacks on the same developer when they are poked again', () => {
    studio()
    poke(0, 0, { rung: 2, index: 7 })
    const once = getState().buffs[0].strength
    poke(0, 0, { rung: 2, index: 7 })
    expect(getState().buffs).toHaveLength(1)
    expect(getState().buffs[0].strength).toBeGreaterThan(once)
  })
})

describe('the poke is worth what §4.5 says, only later (GDD §4.5a)', () => {
  it('banks the same total whether it arrives at once or over the buff’s life', () => {
    // **The claim that stops R14 being a silent rebalance of §4.10.** §4.5a:
    // "What changes is the *destination* of the number, not the formula that
    // produces it." Measured end to end: one poke, then long enough for the buff
    // to expire and settle, against the same stretch of time with no poke in it.
    //
    // Local Entropy is held at zero throughout because §4.9's context-switch
    // penalty is a *separate* pre-existing mechanic — a poke has always cost the
    // studio efficiency, whatever its Story Points then did — and leaving it in
    // would make this a test of that instead. It is pinned on its own below.
    //
    // **§7.8.9's away roster is held empty for the same reason, and a sharper
    // one.** Since 2026-08-26 a developer away from their desk produces nothing,
    // which makes the passive rate *stochastic*: this test differences a poked
    // run against a quiet one, and two runs that happened to send different
    // numbers of people to the cooler differ by far more than the integration
    // residue being measured. A poke also sends its target back to their desk
    // (§7.8.6 rule 5), so the poked run would be systematically richer — which
    // is the mechanic working, and is emphatically not §4.5a's formula.
    const window = BUFF_TAU * 20

    const run = (withPoke: boolean, step: number) => {
      __resetStore()
      studio()
      // A commitment nothing can burn down and a treasury nothing can exhaust.
      // A ship resets `burned` and a bankruptcy stops `tick` outright, and
      // either one inside the window would be measuring the wrong thing —
      // silently, because both leave a plausible-looking number behind.
      __setState({ commitment: new Decimal(1e12), cash: 1e12 })
      const sp = withPoke ? poke(0, 0, { rung: 2, index: 7 }).sp : 0
      __setState({ localEntropy: 0, slack: emptySlack() })
      for (let t = 0; t < window; t += step) {
        tick(step)
        __setState({ localEntropy: 0, slack: emptySlack() })
      }
      return { sp, burned: getState().burned.toNumber() }
    }

    /** Relative shortfall between what the poke was worth and what landed. */
    const missing = (step: number) => {
      const poked = run(true, step)
      const quiet = run(false, step)
      expect(poked.sp).toBeGreaterThan(0)
      return Math.abs(poked.burned - quiet.burned - poked.sp) / poked.sp
    }

    // A tick integrates an exponential in rectangles, so it under-reads by
    // O(dt/tau) whatever the code does — about a tenth of a per cent at 120 Hz.
    const coarse = missing(1 / 120)
    expect(coarse).toBeLessThan(0.002)

    // And that residue is the *integration*, not a leak: halving the step has
    // to halve it. A constant fraction going missing would survive this, which
    // is the whole reason to measure twice — the first assertion alone would
    // pass just as happily on a quiet 0.1% leak.
    expect(missing(1 / 240)).toBeLessThan(coarse * 0.6)
  })

  it('costs the studio Entropy for the interruption, exactly as it always did', () => {
    // §4.9 — "Every poke adds local Entropy to the developer you poked. You
    // interrupted them; that is what an interruption does." R14 moved where a
    // poke's Story Points go and deliberately left this alone, which is why the
    // test above has to hold it at zero to see anything else.
    studio()
    const before = baseVelocity()
    poke(0, 0, { rung: 2, index: 7 })
    expect(baseVelocity()).toBeLessThan(before)
  })

  it('pays out only the smaller half on the frame of the tap', () => {
    // §4.5a: "The one-off payout does not vanish entirely, because instant
    // feedback on a tap is non-negotiable (10.8 F2). It is now the *smaller*
    // half of what a poke does, and the buff is the larger."
    expect(POKE_PAYOUT_SHARE).toBeLessThan(0.5)

    studio()
    const before = getState().burned.toNumber()
    const result = poke(0, 0, { rung: 2, index: 7 })
    const banked = getState().burned.toNumber() - before

    expect(banked).toBeCloseTo(result.sp * POKE_PAYOUT_SHARE, 8)
    expect(banked).toBeGreaterThan(0)
  })

  it('still cannot be tapped out of Entropy Lock (GDD §6.3)', () => {
    // A seized studio produces nothing, so there is no rate for a percentage to
    // raise. The points fall back to §4.5's one-off — which §4.1 has already
    // taxed to almost nothing. The escape hatch stays shut.
    __setState({ devs: 10_000, devCap: 100, peakDevs: 10_000 })
    const before = currentVelocity()
    poke(0, 0, { rung: 2, index: 7 })
    expect(currentVelocity() - before).toBeLessThan(1e-6)
  })
})

describe('the numerals still add up to the readout (GDD §8.2b, §10.1)', () => {
  it('sums per-developer velocities to the studio’s velocity, buffed or not', () => {
    studio()
    const sum = () => {
      let total = 0
      for (let i = 0; i < getState().devs; i++) total += developerVelocity(i)
      return total
    }

    expect(sum()).toBeCloseTo(currentVelocity(), 8)

    poke(0, 0, { rung: 2, index: 7 })
    poke(0, 0, { rung: 2, index: 22 })
    expect(sum()).toBeCloseTo(currentVelocity(), 8)

    idle(2)
    expect(sum()).toBeCloseTo(currentVelocity(), 8)
  })
})

describe('the shortcut for a seat’s rate stops working once anyone is buffed', () => {
  it('is not velocity-over-headcount times the share, and must not be written as one', () => {
    // A guard against re-deriving §8.2b's per-head rate by hand. Before R14 the
    // two were identical — `currentVelocity / devs * developerShare(i)` — and
    // `render/stage.ts` fed the tallies exactly that. A buff makes them differ
    // in the one way that matters: the hand-rolled version pushes the studio's
    // whole lift through *every* seat evenly, so poking one developer would
    // raise the numeral over all forty heads by a fortieth each.
    //
    // That is §4.5c's requirement inverted — "modifiers must be legible on the
    // target" — and it would read as the buff doing nothing in particular.
    studio()
    poke(0, 0, { rung: 2, index: 7 })
    const s = getState()

    const shortcut = (i: number) => (currentVelocity(s) / s.devs) * developerShare(i, s)

    expect(developerVelocity(7, s)).toBeGreaterThan(shortcut(7))
    expect(developerVelocity(8, s)).toBeLessThan(shortcut(8))
  })
})

describe('any unit is pokeable (GDD §4.5b, R15)', () => {
  it('lands on a floor rather than on nobody, above the room', () => {
    // The gap R15 fills: `pickDeveloper` returns −1 above rung 2, so a tap at
    // rung 4 used to do nothing at all.
    __setState({ devs: 40_000, devCap: 80_000, peakDevs: 40_000 })
    poke(0, 0, { rung: 4, index: 1 })
    expect(getState().buffs).toHaveLength(1)
    expect(currentVelocity()).toBeGreaterThan(baseVelocity())
  })

  it('reaches everybody inside the unit, and nobody outside it', () => {
    // §4.5b — "the buff applies to everything inside it". Each seat is measured
    // against *itself* unbuffed rather than against its neighbour: §4.9a gives
    // every developer a different roll, so comparing two seats would be reading
    // the roster rather than the buff.
    __setState({ devs: 40_000, devCap: 80_000, peakDevs: 40_000 })
    poke(0, 0, { rung: 4, index: 1 })
    const unbuffed = { ...getState(), buffs: [] }

    // Rung 4's unit is a building of 10,000, so unit 1 is seats 10,000–19,999.
    for (const seat of [10_000, 15_000, 19_999]) {
      expect(developerVelocity(seat)).toBeGreaterThan(developerVelocity(seat, unbuffed))
    }
    for (const seat of [9_999, 20_000]) {
      expect(developerVelocity(seat)).toBeCloseTo(developerVelocity(seat, unbuffed), 12)
    }
  })

  it('buffs a big unit by a smaller percentage than a small one', () => {
    // §4.5b's load-bearing rule: "Without that rule the game has one strategy:
    // always poke the biggest thing. Any tuning that makes the largest unit the
    // best target has deleted the zoom."
    __setState({ devs: 100_000, devCap: 200_000, peakDevs: 100_000 })

    poke(0, 0, { rung: 2, index: 5 })
    const person = getState().buffs[0].strength

    __resetStore()
    __setState({ devs: 100_000, devCap: 200_000, peakDevs: 100_000 })
    poke(0, 0, { rung: 5, index: 0 })
    const campus = getState().buffs[0].strength

    expect(campus).toBeLessThan(person)
  })

  it('treats a poke with no named unit as a poke on one developer', () => {
    // What `poke(x, y)` means for the §23.3 bench and for Run 1's simulation:
    // the founder's own desk, one person, §4.8's L1 yield.
    studio()
    poke(0, 0)
    expect(getState().buffs).toEqual([expect.objectContaining({ rung: 0, index: 0 })])
  })
})

describe('a buff belongs to the moment, not to the run (GDD §24.2)', () => {
  it('is not extrapolated across an offline gap', () => {
    // §24's offline resolution multiplies a velocity by hours. A player who was
    // mid-buff when they closed the tab must not earn eight hours of it — and
    // the buff would have decayed in fifteen seconds of real time anyway.
    studio()
    poke(0, 0, { rung: 2, index: 7 })
    expect(baseVelocity()).toBeLessThan(currentVelocity())
    expect(baseVelocity()).toBe(baseVelocity({ ...getState(), buffs: [] }))
  })
})
