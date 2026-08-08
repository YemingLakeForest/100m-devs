/**
 * The Act III mousetrap, as a transaction — GDD §21.0, §4.10a.
 *
 * This file exists because of a bug that reached a player: the offer stayed on
 * screen, live and pressable, with nothing in the bank. Pressing it at $0
 * charged the $50 floor and took the studio to -$50. A control labelled "Cost:
 * YOUR ENTIRE TREASURY" completing successfully against an empty treasury is
 * the interface telling the player the price is fiction, on the one beat the
 * whole run is built around.
 *
 * §4.10a's claim that the Mass Hire is "always affordable and always ruinous"
 * is true of the price and **not of the player**: payroll runs continuously and
 * empties the treasury faster than shipping refills it, so a studio can sit in
 * Act III below the floor for minutes at a time.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { MASS_HIRE_MIN_COST } from '../sim/economy.ts'
import { MASS_HIRE_COUNT } from './onboarding.ts'
import {
  __resetStore,
  __setState as setState,
  canMassHire,
  currentMassHireCost,
  getState,
  jumpToPhase,
  massHire,
} from './store.ts'

/** Whatever headcount Act III starts from. Read, never hard-coded — §21.0a
 *  moved it from 2 to 40 and three assertions here silently became about the
 *  debug seam's numbers rather than about the refusal they were checking. */
let startDevs = 0

beforeEach(() => {
  __resetStore()
  jumpToPhase('act3_bait')
  startDevs = getState().devs
})

describe('affordability', () => {
  it('refuses when the treasury is empty', () => {
    setState({ cash: 0 })
    expect(canMassHire()).toBe(false)
    expect(massHire()).toBe(false)
    // And, crucially, changed nothing. A refused purchase that still moves the
    // headcount or the money is worse than one that succeeds.
    expect(getState().cash).toBe(0)
    expect(getState().devs).toBe(startDevs)
    expect(getState().massHired).toBe(false)
  })

  it('refuses rather than pushing the player into the red', () => {
    setState({ cash: MASS_HIRE_MIN_COST - 1 })
    expect(massHire()).toBe(false)
    expect(getState().cash).toBe(MASS_HIRE_MIN_COST - 1)
  })

  it('refuses when the studio is already underwater', () => {
    setState({ cash: -5_000 })
    expect(canMassHire()).toBe(false)
    expect(massHire()).toBe(false)
    expect(getState().devs).toBe(startDevs)
  })

  it('takes the whole treasury when there is one', () => {
    // The beat still works exactly as §21.0 designs it: affordable, and only
    // just, leaving no buffer at all for payroll.
    setState({ cash: 12_345 })
    expect(canMassHire()).toBe(true)
    expect(massHire()).toBe(true)
    expect(getState().cash).toBe(0)
    expect(getState().devs).toBe(startDevs + MASS_HIRE_COUNT)
  })

  it('is affordable exactly at the floor and not a penny below', () => {
    setState({ cash: MASS_HIRE_MIN_COST })
    expect(canMassHire()).toBe(true)
    setState({ cash: MASS_HIRE_MIN_COST - 0.01 })
    expect(canMassHire()).toBe(false)
  })

  it('never offers itself twice', () => {
    setState({ cash: 5_000 })
    expect(massHire()).toBe(true)
    setState({ cash: 5_000 })
    expect(canMassHire()).toBe(false)
    expect(massHire()).toBe(false)
  })

  it('quotes a price a broke player can read', () => {
    // A disabled button still has to say what it is waiting for, or the player
    // has no idea whether they need fifty dollars or fifty thousand.
    setState({ cash: 0 })
    expect(currentMassHireCost()).toBe(MASS_HIRE_MIN_COST)
  })
})
