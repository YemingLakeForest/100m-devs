/**
 * One tap of MAX is not the end of the run — GDD §10.10.3 rule 2 [amended 2026-10-15].
 *
 * Found by playing: from a studio of 5,000 on $50M, a single press of MAX hired
 * 31,000 developers and the run was over 1.25 seconds later. The dial's own
 * property tests (`sim/hireDial.test.ts`) say what MAX is allowed to buy; this is
 * the same claim through the transaction and the clock, because the bug was the
 * two never having been put in a room together — each was individually
 * defensible, and the *pair* was a one-click liquidation.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_RUNWAY_SECONDS } from '../sim/hireDial.ts'
import { secondsUntilBankrupt } from '../sim/economy.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import {
  __resetStore,
  __setState,
  dismissScene,
  getState,
  hireDeveloper,
  setHireMultiplier,
  tick,
  triggerParadigmShift,
} from './store.ts'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  triggerParadigmShift()
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

/** Run 2 or later, at scale, with a treasury that is comfortably solvent. */
function atScale(devs: number, cap: number, cash: number) {
  __setState({ devs, devCap: cap, cash, dialUnlocked: true, peakDevs: devs, scene: null })
}

describe('MAX, through the store and the clock', () => {
  it.each([
    [1_000, 5_000, 1.2e7],
    [5_000, 50_000, 2e8],
    [50_000, 1e6, 4e9],
  ])('leaves %i developers a full runway after one tap', (devs, cap, cash) => {
    atScale(devs, cap, cash)
    setHireMultiplier('max')
    expect(hireDeveloper()).toBe(true)
    const s = getState()
    expect(s.devs).toBeGreaterThan(devs)
    expect(secondsUntilBankrupt(s.cash, s.devs)).toBeGreaterThanOrEqual(MAX_RUNWAY_SECONDS)
  })

  it('survives the runway it promised, with no income at all', () => {
    // The strictest reading: nothing ships, nothing is paid, and the studio sits
    // exactly where one tap left it. It must outlast the runway the button
    // promised, not merely the first frame.
    atScale(5_000, 50_000, 2e8)
    setHireMultiplier('max')
    hireDeveloper()
    // Every scene answered as it comes: THE THREAD is handed to any studio past
    // twelve with an empty board, and a scene halts `tick` — without this the
    // loop simulates nothing and "survives" because time has stopped. The
    // control below is what proves the clock is really running.
    for (let t = 0; t < MAX_RUNWAY_SECONDS - 5; t += 0.5) {
      if (getState().scene !== null) dismissScene()
      tick(0.5)
    }
    expect(getState().phase).not.toBe('bankrupt')
  })

  it('and the clock really runs: the same studio, past the runway, is bankrupt', () => {
    // The control for the test above. A "survives" assertion is only worth
    // anything next to one that shows the thing it survived would have killed.
    atScale(5_000, 50_000, 2e8)
    setHireMultiplier('max')
    hireDeveloper()
    for (let t = 0; t < MAX_RUNWAY_SECONDS + 30; t += 0.5) {
      if (getState().scene !== null) dismissScene()
      tick(0.5)
    }
    expect(getState().phase).toBe('bankrupt')
  })

  it('does not stack — a second tap into the same runway buys nobody', () => {
    // Spamming MAX is what an aggressive player does. The first press spends the
    // headroom; the second must not dig into it, or the guard is a speed bump.
    atScale(5_000, 50_000, 2e8)
    setHireMultiplier('max')
    hireDeveloper()
    const after = getState().devs
    hireDeveloper()
    hireDeveloper()
    expect(getState().devs).toBe(after)
  })
})
