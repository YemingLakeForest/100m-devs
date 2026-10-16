/**
 * Money always has a job — plan 2026-10-16, phase 3 (findings 02, 09, 10).
 *
 * The audit's careful player had bought everything era 1 sells about twenty
 * minutes into Run 2 and banked money for the rest of the hour with the studio
 * standing still, because nodes open by `eraIndex(peakDevs)` and era 1's whole
 * catalogue topped the cap out near 150 — short of the thousand heads era 2
 * waits for. Its greedy player hired past §4.1's peak and was paid for it,
 * because §11.2 B2's floor was a share per head.
 *
 * These play the probe's own scripted player (`src/test/pacingProbe.ts`) through
 * Run 1 and into Run 2, and pin the claims the phase makes. They pin orders and
 * thresholds the plan states, not the table's numbers, which every later phase
 * is expected to move (§25.3.2).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  catalogueRate,
  effectiveDevCap,
  getState,
  shiftPaysNow,
  structuralVelocity,
  treePriceOf,
  treeRefusalOf,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { PROBE_SEED, createPlayer, pinClocks, playRunOneAndShift, playStep, type ProbePolicy } from '../test/pacingProbe.ts'
import { TREE_HEROES, TREES, isBuilt } from '../sim/upgradeTrees.ts'
import { eraIndex } from '../sim/eras.ts'
import { peakHeads } from '../sim/entropy.ts'
import { payrollPerSecond } from '../sim/economy.ts'

let unpin: () => void = () => {}

beforeEach(() => {
  unpin = pinClocks()
  __resetStore()
  setPermanent(emptyPermanent())
  __setState({ runSeed: PROBE_SEED })
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  unpin()
})

/** Play Run 1 and the shift, then Run 2 up to each of `minutes`, calling `at` there. */
function playRunTwo(policy: ProbePolicy, minutes: number[], at: (minute: number) => void): void {
  const p = createPlayer({ policy, shipLatency: 8 })
  playRunOneAndShift(p)
  const start = p.t
  for (const minute of minutes) {
    while (p.t - start < minute * 60) playStep(p)
    at(minute)
  }
}

/** The cheapest node the studio could buy if it had the cash, ignoring the cash. */
function cheapestOnSale(): number {
  let best = Number.POSITIVE_INFINITY
  for (const hero of TREE_HEROES) {
    for (const node of TREES[hero]) {
      if (!isBuilt(node)) continue
      const why = treeRefusalOf(hero, node.id)
      if (why !== null && why !== 'cash') continue
      const price = treePriceOf(hero, node.id)
      if (price !== null && price < best) best = price
    }
  }
  return best
}

describe('the careful player always has something worth buying', () => {
  it('has a node on sale within ten minutes of income at minutes 20, 40 and 60, and reaches era 2 within the hour', { timeout: 120_000 }, () => {
    const seen: { minute: number; minutesOfIncome: number }[] = []
    playRunTwo('careful', [20, 40, 60], (minute) => {
      const perMinute = catalogueRate() * 60
      seen.push({ minute, minutesOfIncome: cheapestOnSale() / perMinute })
    })
    for (const s of seen) expect(s.minutesOfIncome, `minute ${s.minute}`).toBeLessThanOrEqual(10)
    // Era 2 waits for more than a thousand heads; era 1 alone tops out near 150.
    expect(eraIndex(getState().peakDevs)).toBeGreaterThanOrEqual(2)
  })
})

describe('the greedy player is no longer paid for hiring past the peak', () => {
  it('past the peak, more heads add payroll and no work — the cash slope only falls', { timeout: 120_000 }, () => {
    playRunTwo('greedy', [30], () => {})
    const s = getState()
    const cap = effectiveDevCap()
    expect(s.devs).toBeGreaterThan(peakHeads(cap))
    let lastWork = structuralVelocity()
    let lastPayroll = payrollPerSecond(s.devs)
    for (const extra of [10, 50, 200, 1_000]) {
      const at = { ...s, devs: s.devs + extra }
      const work = structuralVelocity(at)
      const payroll = payrollPerSecond(at.devs)
      expect(work).toBeLessThanOrEqual(lastWork + 1e-9)
      expect(payroll).toBeGreaterThan(lastPayroll)
      lastWork = work
      lastPayroll = payroll
    }
  })

  it('is told to shift: a minute past the peak lights the PARADIGM door (§13.2, phase 3.3)', { timeout: 120_000 }, () => {
    playRunTwo('greedy', [30], () => {})
    expect(getState().stalledFor).toBeGreaterThanOrEqual(60)
    expect(shiftPaysNow()).toBe(true)
  })
})

describe('the stall clock is Run 2’s, not Run 1’s', () => {
  it('stays at zero through Run 1, which has one way out and it is not this door', { timeout: 120_000 }, () => {
    const p = createPlayer({ policy: 'greedy', shipLatency: 8 })
    let most = 0
    for (let t = 0; t < 3 * 3600 && getState().phase !== 'bankrupt'; t += 0.25) {
      playStep(p)
      most = Math.max(most, getState().stalledFor)
    }
    expect(most).toBe(0)
  })
})
