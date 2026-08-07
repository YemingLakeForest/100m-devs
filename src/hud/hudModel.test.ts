import { describe, expect, it } from 'vitest'
import { entropyLabel, entropyReadout } from '../game/vocabulary.ts'
import { PHASE_ORDER, type Phase } from '../game/onboarding.ts'
import { BANKRUPTCY_THRESHOLD, secondsUntilBankrupt } from '../sim/economy.ts'
import {
  RUNWAY_WARN_SECONDS,
  actionFor,
  burnReadout,
  entropyPercent,
  formatMoney,
  formatVelocity,
  runwayReadout,
} from './hudModel.ts'

describe('formatMoney', () => {
  it('short-forms up the magnitudes', () => {
    expect(formatMoney(0)).toBe('$0')
    expect(formatMoney(50)).toBe('$50')
    expect(formatMoney(1200)).toBe('$1.2K')
    expect(formatMoney(1.5e6)).toBe('$1.50M')
    expect(formatMoney(1.5e9)).toBe('$1.50B')
    expect(formatMoney(1.2e12)).toBe('$1.20T')
  })

  it('uses a true minus rather than a hyphen, so the column does not shift', () => {
    // ART_DIRECTION §3 rule 3: numerals beside a monospace face must not
    // change width. U+2212 is digit-width; U+002D is not.
    expect(formatMoney(-1000)).toBe('−$1.0K')
    expect(formatMoney(-1000).charCodeAt(0)).toBe(0x2212)
  })
})

describe('formatVelocity', () => {
  it('stays readable across the whole range the simulation produces', () => {
    expect(formatVelocity(0)).toBe('0')
    // A seized studio produces numbers no fixed format survives.
    expect(formatVelocity(1e-6)).toBe('1.00e-6')
    expect(formatVelocity(4.5)).toBe('4.50')
    expect(formatVelocity(4120)).toBe('4,120')
  })
})

describe('the burn line — §21 Act V', () => {
  it('is silent while nobody is being paid', () => {
    // The founders are in a garage; payroll begins with the Mass Hire. A burn
    // readout that is always there is furniture, and one that arrives is an event.
    expect(burnReadout(0)).toBeNull()
    expect(burnReadout(-1)).toBeNull()
  })

  it('reads as an outflow once it starts', () => {
    expect(burnReadout(50_000)).toBe('−$50.0K/SEC')
  })
})

describe('the runway clock', () => {
  it('does not exist while there is no burn', () => {
    expect(runwayReadout(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('stays hidden until the runway is short enough to be a threat', () => {
    expect(runwayReadout(RUNWAY_WARN_SECONDS)).toBeNull()
    expect(runwayReadout(RUNWAY_WARN_SECONDS + 1)).toBeNull()
    expect(runwayReadout(RUNWAY_WARN_SECONDS - 1)).toBe('89s TO BANKRUPTCY')
  })

  it('bottoms out at zero rather than counting into negative seconds', () => {
    expect(runwayReadout(-5)).toBe('0s TO BANKRUPTCY')
  })

  it('lands inside the warning window on the real Act V numbers', () => {
    // 1,002 devs, cash at zero: 1,000 paid heads at $50/sec against a
    // −$1,000,000 threshold. The clock has to be showing by then or the panic
    // §21 Act V is built around has no clock.
    const seconds = secondsUntilBankrupt(0, 1002)
    expect(seconds).toBe(-BANKRUPTCY_THRESHOLD / 50_000)
    expect(runwayReadout(seconds)).not.toBeNull()
  })
})

describe('the speedometer numeral — GDD §4.3a', () => {
  it('agrees with the vocabulary module across the whole curve', () => {
    // The label and the number are set in different phosphor values so they
    // have to be two elements, which means restating the number's rule here.
    // This is what stops the two statements of it drifting apart.
    for (let i = 0; i <= 200; i++) {
      const e = i / 200
      expect(`${entropyLabel(e)} ${entropyPercent(e)}`).toBe(entropyReadout(e))
    }
  })

  it('gains a decimal only in the last stretch, where 99.0 and 99.9 differ', () => {
    expect(entropyPercent(0.6)).toBe('60%')
    expect(entropyPercent(0.99)).toBe('99.0%')
    expect(entropyPercent(0.999)).toBe('99.9%')
    // Never 100%: a studio at 100% has no honest reading left to give.
    expect(entropyPercent(1)).toBe('99.9%')
  })

  it('never says the word the player is not allowed to read', () => {
    for (let i = 0; i <= 100; i++) {
      const readout = `${entropyLabel(i / 100)} ${entropyPercent(i / 100)}`
      expect(readout.toLowerCase()).not.toContain('entropy')
    }
  })
})

describe('the action bar — §21 is a funnel', () => {
  it('offers exactly the two beats that wait on a player decision', () => {
    const offered = PHASE_ORDER.filter((p) => actionFor(p) !== null)
    expect(offered).toEqual<Phase[]>(['act2_offer_hire', 'act3_bait'])
  })

  it('makes the mousetrap the one control permitted to beg', () => {
    expect(actionFor('act2_offer_hire')?.variant).toBe('default')
    expect(actionFor('act3_bait')?.variant).toBe('bait')
    expect(actionFor('act3_bait')?.note).toContain('FREE')
  })

  it('leaves the bankruptcy decision to the bankruptcy panel', () => {
    // Two surfaces competing for one decision, one sliding up underneath the
    // other, is not a choice — it is a collision.
    expect(actionFor('bankrupt')).toBeNull()
  })

  it('returns a stable object, because the F1 exit latch compares identity', () => {
    expect(actionFor('act3_bait')).toBe(actionFor('act3_bait'))
  })
})
