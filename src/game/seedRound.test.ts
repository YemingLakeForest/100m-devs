/**
 * §21.0a — the Seed Round.
 *
 * The beat that fixes two pacing problems at once: Act IIa was a four-minute
 * stretch with no events in it, and the exit from it *replaced* the ordinary
 * hire control with the mousetrap. A trap the player is manoeuvred into is not
 * a trap, it is a corridor.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { SEED_ROUND_AT, SEED_ROUND_CASH } from './onboarding.ts'
import { segmentsFor } from '../sim/hireDial.ts'
import { actionFor, offerFor } from '../hud/hudModel.ts'
import {
  __resetStore,
  __setState,
  getState,
  hireQuote,
  jumpToPhase,
  setHireMultiplier,
  takeSeedRound,
  tick,
  triggerParadigmShift,
} from './store.ts'

beforeEach(() => {
  __resetStore()
})

describe('taking the round', () => {
  it('pays out once and only once', () => {
    const before = getState().cash
    expect(takeSeedRound()).toBe(true)
    expect(getState().cash).toBe(before + SEED_ROUND_CASH)
    // A second signature is not a second cheque.
    expect(takeSeedRound()).toBe(false)
    expect(getState().cash).toBe(before + SEED_ROUND_CASH)
  })

  it('unlocks the hire dial', () => {
    expect(getState().dialUnlocked).toBe(false)
    takeSeedRound()
    expect(getState().dialUnlocked).toBe(true)
  })
})

describe('the dial is gated on the round, not on a headcount — §10.10.2', () => {
  it('stays at one at a time until the term sheet is signed', () => {
    // The failure this prevents is subtle: `hireMultiplier` persists across a
    // Paradigm Shift, so a returning player's stored `max` would otherwise hand
    // a fresh Act I studio a batch button before the funnel had taught hiring.
    __setState({ devs: 60, cash: 500_000, dialUnlocked: false })
    setHireMultiplier('max')
    expect(hireQuote().count).toBe(1)

    __setState({ dialUnlocked: true })
    expect(hireQuote().count).toBeGreaterThan(1)
  })

  it('still respects §10.10.2’s own headcount bands once unlocked', () => {
    // Unlocking is a gate on the control existing, not a licence to ignore the
    // window: an x1M segment at twelve developers would be absurd.
    expect(segmentsFor(12)).toEqual([])
    expect(segmentsFor(60)).toHaveLength(4)
  })
})

describe('Run 2 opens on the loop, not on the trap — §21.6', () => {
  it('does not drop a prestiged player at Act III with two developers', () => {
    // The bug this pins was reported three times as "the HIRE 1,000 DEVS button
    // is always there", and it was: a Paradigm Shift set the phase to
    // `act3_bait` with two developers and no money, so the mousetrap sat on
    // screen priced at a treasury the player did not have — and the only exit
    // from that phase is `devs > 502`, which is unreachable on nothing.
    // **The run could not advance.**
    __setState({ lifetimeRevenue: 1_000_000, peakDevs: 1_042, devs: 1_042 })
    triggerParadigmShift()
    tick(0.05)
    expect(getState().phase).not.toBe('act3_bait')
    expect(offerFor(getState().phase, getState().massHired)).toBeNull()
    expect(actionFor(getState().phase)?.action).toBe('hire')
  })

  it('does not re-teach the funnel', () => {
    // §10.10.2 — "outside Run 1 the dial is simply present from the first
    // frame. The funnel is a first-run device and re-teaching it is an insult."
    // The seed round is the same: a story beat that has already happened.
    triggerParadigmShift()
    expect(getState().dialUnlocked).toBe(true)
    expect(getState().seedTaken).toBe(true)
  })
})

describe('the phase machine — §21.0a', () => {
  it('reaches the term sheet by hiring, and leaves it by signing', () => {
    jumpToPhase('act2a_loop')
    __setState({ devs: SEED_ROUND_AT })
    tick(0.05)
    expect(getState().phase).toBe('act2a_seed')

    // It waits. Headcount alone does not get the player past this beat.
    __setState({ devs: 500 })
    tick(0.05)
    expect(getState().phase).toBe('act2a_seed')

    takeSeedRound()
    tick(0.05)
    expect(getState().phase).toBe('act2b_loop')
  })

  it('does not fire the round again after a Paradigm Shift resets the run', () => {
    // `seedTaken` is run state, so a fresh run must offer it again — the
    // opposite of the bug above, and just as wrong if it goes the other way.
    takeSeedRound()
    expect(getState().seedTaken).toBe(true)
    __resetStore()
    expect(getState().seedTaken).toBe(false)
    expect(getState().dialUnlocked).toBe(false)
  })
})
