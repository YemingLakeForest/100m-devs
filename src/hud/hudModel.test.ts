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
  offerFor,
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
  it('offers exactly the beats that wait on a player decision', () => {
    // §21 is a funnel; a second choice anywhere in it would let the player
    // sidestep the trap. Act IIa joins the list because §21.0 makes hiring the
    // whole interface of that beat -- but it is the *same* control as Act II's,
    // not a second one, which is why the funnel is still a funnel.
    const offered = PHASE_ORDER.filter((p) => actionFor(p) !== null)
    expect(offered).toEqual<Phase[]>([
      'act2_offer_hire',
      'act2a_loop',
      'act2a_seed',
      'act2b_loop',
      'act3_bait',
    ])
  })

  it('offers the temptation on exactly one beat, and never as the only option', () => {
    // §21.0a — the mousetrap no longer *replaces* the hire control. Act III
    // used to swap one for the other, which turns a trap into a corridor: a
    // player left no alternative has not chosen anything, and §6's lesson only
    // lands if the decision was theirs. So wherever an offer exists, an
    // ordinary action must exist beside it.
    const tempted = PHASE_ORDER.filter((p) => offerFor(p) !== null)
    expect(tempted).toEqual<Phase[]>(['act3_bait'])
    for (const p of tempted) {
      expect(actionFor(p)).not.toBeNull()
      expect(actionFor(p)?.action).toBe('hire')
    }
  })

  it('gives Act IIa the ordinary hire control, not a second flavour of it', () => {
    // If these ever diverge, the game has two hire buttons and the player has
    // to learn which one they are looking at.
    expect(actionFor('act2a_loop')).toBe(actionFor('act2_offer_hire'))
  })

  it('makes the mousetrap the one control permitted to beg', () => {
    expect(actionFor('act2_offer_hire')?.variant).toBe('default')
    expect(offerFor('act3_bait')?.variant).toBe('bait')
    expect(offerFor('act3_bait')?.note).toContain('TREASURY')
    // And the ordinary control beside it does not beg.
    expect(actionFor('act3_bait')?.variant).toBe('default')
  })

  it('prices every action it offers', () => {
    // The gap the mousetrap fell through. `disabled` was gated on
    // `showsHireCost`, which MASS_HIRE does not set, so the bait button was
    // live at every cash level -- including zero, where it charged $50 the
    // player did not have. Any action that costs money must say how it is
    // priced, or the action bar has no way to know when it is dead.
    for (const phase of PHASE_ORDER) {
      const spec = actionFor(phase)
      if (spec && spec.action !== 'paradigmShift' && spec.action !== 'takeSeed') {
        expect(spec.priced).toBeDefined()
      }
    }
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
