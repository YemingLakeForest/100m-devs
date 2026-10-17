/**
 * Letting people go, through the store — GDD §10.10.5 [CANON - added 2026-10-15].
 *
 * `sim/layoff.test.ts` says what a layoff costs and who can go; this is the
 * transaction: what it does to a running studio, what it refuses to do, and the
 * one scenario the verb exists for — a studio that hired itself into the red and
 * has to be able to get out.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Decimal from 'break_infinity.js'
import { MAX_RUNWAY_SECONDS } from '../sim/hireDial.ts'
import { SEVERANCE_PER_HEAD } from '../sim/layoff.ts'
import { BANKRUPTCY_THRESHOLD, UNPAID_FOUNDERS, secondsUntilBankrupt } from '../sim/economy.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import {
  __resetStore,
  __setState,
  dismissScene,
  getState,
  hireDeveloper,
  jumpToPhase,
  layOff,
  layoffQuoteNow,
  setHireMultiplier,
  tick,
  triggerParadigmShift,
} from './store.ts'

function prestigedRun() {
  __resetStore()
  setPermanent(emptyPermanent())
  triggerParadigmShift()
}

/** A Run 2 studio of this size and treasury, with the dial open and nothing in the way. */
function studio(devs: number, cash: number, cap = 5_000) {
  // "No income at all" is held by a project nobody finishes. It used to be held
  // by nobody pressing SHIP!, until Serena — who walks in on a studio this size
  // within two minutes — started shipping on arrival (plan 2026-10-16, D4).
  __setState({ devs, devCap: cap, cash, dialUnlocked: true, peakDevs: devs, scene: null, commitment: new Decimal(1e300) })
}

/**
 * Simulated time, with every scene answered.
 *
 * **Not `tick` alone, and the first draft of this file got that wrong in the way
 * that matters.** A Run 2 studio this size is handed a scene on its first tick
 * (it was §18.0a's THE THREAD, since retired), a scene halts `tick` entirely, and a
 * test that "survived two minutes" was therefore simulating nothing — it passed
 * because time had stopped. The control below (the same studio, unrescued, must
 * die) is what caught it, and is why it exists.
 */
function run(seconds: number) {
  for (let t = 0; t < seconds; t += 0.5) {
    if (getState().scene !== null) dismissScene()
    tick(0.5)
  }
}

beforeEach(() => prestigedRun())

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('Run 1 has no way out of its trap', () => {
  it('refuses, and changes nothing', () => {
    // §21.0e: no manual hire in Run 1, and the thousand who arrive are the trap.
    // A layoff would be the way out of it.
    __resetStore()
    setPermanent(emptyPermanent())
    jumpToPhase('act4_collapse')
    const before = getState()
    expect(layOff()).toBe(false)
    expect(getState().devs).toBe(before.devs)
    expect(getState().cash).toBe(before.cash)
  })
})

describe('the transaction', () => {
  it('lets the newest paid heads go, for severance, and refunds nothing', () => {
    studio(201, 5e6)
    setHireMultiplier(10)
    expect(layOff()).toBe(true)
    const s = getState()
    expect(s.devs).toBe(191)
    expect(s.cash).toBe(5e6 - 10 * SEVERANCE_PER_HEAD)
  })

  it('keeps peakDevs — §14.1 pays a run for the studio it built', () => {
    // Letting people go must not be a way to lose Blueprint Points.
    studio(201, 5e6)
    setHireMultiplier(100)
    layOff()
    expect(getState().devs).toBe(101)
    expect(getState().peakDevs).toBe(201)
  })

  it('never takes the unpaid founder — nobody lays off James', () => {
    studio(5, 5e6)
    setHireMultiplier(100)
    expect(layOff()).toBe(true)
    expect(getState().devs).toBe(UNPAID_FOUNDERS)
    // And there is nobody left to cut: the second press does nothing.
    expect(layOff()).toBe(false)
    expect(getState().devs).toBe(UNPAID_FOUNDERS)
  })

  it('puts down a card that was open on a seat that no longer exists', () => {
    studio(50, 5e6)
    __setState({ selected: 45 })
    setHireMultiplier(10)
    layOff()
    expect(getState().selected).toBeNull()
  })

  it('leaves a card open on somebody who stayed', () => {
    studio(50, 5e6)
    __setState({ selected: 3 })
    setHireMultiplier(10)
    layOff()
    expect(getState().selected).toBe(3)
  })

  it('refuses while a scene is up, and once the run has ended', () => {
    studio(50, 5e6)
    __setState({ scene: 'scene.run2.founder-board' })
    expect(layOff()).toBe(false)
    __setState({ scene: null, phase: 'bankrupt' })
    expect(layOff()).toBe(false)
    expect(getState().devs).toBe(50)
  })

  it('refuses a layoff whose severance would itself end the run, and changes nothing', () => {
    studio(500, BANKRUPTCY_THRESHOLD + SEVERANCE_PER_HEAD * 3)
    setHireMultiplier(100)
    expect(layoffQuoteNow().affordable).toBe(false)
    expect(layOff()).toBe(false)
    expect(getState().devs).toBe(500)
    expect(getState().cash).toBe(BANKRUPTCY_THRESHOLD + SEVERANCE_PER_HEAD * 3)
  })

  it('is not a way to dodge the price of hiring: a hire then a layoff is a loss', () => {
    // The reason it costs anything. If this ever came out even, hiring would be
    // risk-free and §4.10a's "the price is the decision" would be gone.
    studio(100, 1e7, 1_000)
    const before = getState().cash
    setHireMultiplier(10)
    expect(hireDeveloper()).toBe(true)
    expect(layOff()).toBe(true)
    expect(getState().devs).toBe(100)
    expect(getState().cash).toBeLessThan(before)
  })
})

describe('the rescue it exists for', () => {
  it('gets a studio out of the bankruptcy clock, and it lives', () => {
    // Hired into the window: ninety seconds from the line and no income.
    const heads = 4_000
    const devs = heads + UNPAID_FOUNDERS
    studio(devs, BANKRUPTCY_THRESHOLD + 80 * heads * 50, 50_000)
    expect(secondsUntilBankrupt(getState().cash, getState().devs)).toBeLessThan(90)

    setHireMultiplier('max')
    expect(layOff()).toBe(true)
    const s = getState()
    expect(s.devs).toBeLessThan(devs)
    expect(secondsUntilBankrupt(s.cash, s.devs)).toBeGreaterThanOrEqual(MAX_RUNWAY_SECONDS)

    // With no income at all it outlasts the runway it was promised.
    run(MAX_RUNWAY_SECONDS - 5)
    expect(getState().phase).not.toBe('bankrupt')
  })

  it('is exactly what an unrescued studio does not get: the same studio dies without it', () => {
    const heads = 4_000
    studio(heads + UNPAID_FOUNDERS, BANKRUPTCY_THRESHOLD + 80 * heads * 50, 50_000)
    run(120)
    expect(getState().phase).toBe('bankrupt')
  })
})
