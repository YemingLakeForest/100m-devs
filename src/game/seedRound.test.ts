/**
 * §21.0a — the Seed Round.
 *
 * §21.0e re-hung it: it fires when the garage catalogue is out rather than at a
 * headcount, it is signed on its own modal rather than in the action bar, and
 * what it leads to is the mousetrap rather than another lap of a hiring loop.
 * The money is the same money and it still has to be taken.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { SEED_ROUND_CASH, TERM_SHEET_AFTER_SHIPS } from './onboarding.ts'
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
    jumpToPhase('act2_termsheet')
    const before = getState().cash
    expect(takeSeedRound()).toBe(true)
    expect(getState().cash).toBe(before + SEED_ROUND_CASH)
    // A second signature is not a second cheque.
    expect(takeSeedRound()).toBe(false)
    expect(getState().cash).toBe(before + SEED_ROUND_CASH)
  })

  it('cannot be signed on a beat where nothing is on the table', () => {
    // The modal is the only surface that draws this, and it only draws it on
    // `act2_termsheet`. The store has to say the same thing, or a `?act=` seam
    // or a dev-bar jump can cash a cheque nobody has offered.
    jumpToPhase('act1_ship')
    const before = getState().cash
    expect(takeSeedRound()).toBe(false)
    expect(getState().cash).toBe(before)
  })

  it('unlocks the hire dial', () => {
    jumpToPhase('act2_termsheet')
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
    // §21.6 — and one person survives it, not two.
    expect(getState().devs).toBe(1)
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
  it('reaches the term sheet by shipping, and leaves it by signing', () => {
    jumpToPhase('act1_ship')
    __setState({ projectsShipped: TERM_SHEET_AFTER_SHIPS })
    tick(0.05)
    expect(getState().phase).toBe('act2_termsheet')

    // It waits. Nothing the simulation does on its own gets the player past
    // this beat — §21.0e leaves them no other control while it is up.
    __setState({ projectsShipped: 500 })
    tick(0.05)
    expect(getState().phase).toBe('act2_termsheet')

    takeSeedRound()
    tick(0.05)
    // §21.0e — straight to the mousetrap. There is nothing in between.
    expect(getState().phase).toBe('act3_bait')
  })

  it('does not fire the round again after a Paradigm Shift resets the run', () => {
    // `seedTaken` is run state, so a fresh run must offer it again — the
    // opposite of the bug above, and just as wrong if it goes the other way.
    jumpToPhase('act2_termsheet')
    takeSeedRound()
    expect(getState().seedTaken).toBe(true)
    __resetStore()
    expect(getState().seedTaken).toBe(false)
    expect(getState().dialUnlocked).toBe(false)
  })
})
