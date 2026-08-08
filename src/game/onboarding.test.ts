import { describe, expect, it } from 'vitest'
import {
  ACT1_POKES_REQUIRED,
  ACT2A_ENDS_AT,
  DESPERATE_TAPS_BEFORE_REBUKE,
  MASS_HIRE_COUNT,
  PHASE_COPY,
  PHASE_ORDER,
  advanceOnboarding,
  shouldRebuke,
  type OnboardingSnapshot,
  type Phase,
} from './onboarding.ts'
import { efficiency, passiveVelocity } from '../sim/entropy.ts'

const base: OnboardingSnapshot = {
  pokeCount: 0,
  devs: 1,
  projectsShipped: 0,
  cash: 0,
  entropy: 0,
  bankrupt: false,
}

const at = (p: Partial<OnboardingSnapshot>) => ({ ...base, ...p })

describe('the funnel only moves forward', () => {
  it('never skips a beat', () => {
    // Even a snapshot satisfying every condition at once advances one step.
    //
    // `bankrupt` is deliberately false here, and that is a correction rather
    // than a convenience: bankruptcy is an **exit** from the funnel, not a
    // step along it, so it has no business in an assertion about the forward
    // path. The version of this test that set it true was pinning the bug
    // below — a studio that had run out of money being told to keep poking.
    const everything = at({
      pokeCount: 999,
      devs: 5000,
      projectsShipped: 9,
      entropy: 1,
    })
    expect(advanceOnboarding('act1_poke', everything)).toBe('act2_offer_hire')
  })

  it('ends the run from any act once the money is gone', () => {
    // Bankruptcy used to be checked only in `act5_bleeding`, on the assumption
    // that it could only follow the Mass Hire. Payroll does not know that. A
    // player who overhired during Act IIa, or who sat in Act III unable to
    // afford the offer, dropped past -$1,000,000 and stayed there for ever:
    // no ending, no prestige screen, and the only control on the beat dead
    // because they could not pay for it. **A run has to be able to end.**
    const broke = at({ bankrupt: true })
    for (const phase of PHASE_ORDER) {
      expect(advanceOnboarding(phase, broke)).toBe('bankrupt')
    }
  })

  it('does not end a run that still has money', () => {
    for (const phase of PHASE_ORDER.filter((p) => p !== 'bankrupt')) {
      expect(advanceOnboarding(phase, base)).not.toBe('bankrupt')
    }
  })

  it('never runs backwards', () => {
    for (const phase of PHASE_ORDER) {
      const next = advanceOnboarding(phase, base)
      expect(PHASE_ORDER.indexOf(next)).toBeGreaterThanOrEqual(PHASE_ORDER.indexOf(phase))
    }
  })

  it('terminates at bankruptcy', () => {
    expect(advanceOnboarding('bankrupt', at({ bankrupt: true }))).toBe('bankrupt')
  })
})

describe('Act I — the clicker layer sells itself first', () => {
  it('holds until the player has actually poked', () => {
    expect(advanceOnboarding('act1_poke', at({ pokeCount: ACT1_POKES_REQUIRED - 1 }))).toBe(
      'act1_poke',
    )
  })

  it('opens hiring only once poking has landed', () => {
    expect(advanceOnboarding('act1_poke', at({ pokeCount: ACT1_POKES_REQUIRED }))).toBe(
      'act2_offer_hire',
    )
  })

  it('is short enough not to outstay the joke', () => {
    // ~3 seconds at the 3-5 taps/sec §21 predicts.
    expect(ACT1_POKES_REQUIRED).toBeLessThanOrEqual(20)
  })
})

describe('Act II — James', () => {
  it('waits for the player to hire, not for a timer', () => {
    expect(advanceOnboarding('act2_offer_hire', at({ devs: 1 }))).toBe('act2_offer_hire')
    expect(advanceOnboarding('act2_offer_hire', at({ devs: 2 }))).toBe('act2_ship')
  })

  it('waits for the project to actually ship', () => {
    expect(advanceOnboarding('act2_ship', at({ devs: 2 }))).toBe('act2_ship')
    expect(advanceOnboarding('act2_ship', at({ devs: 2, projectsShipped: 1 }))).toBe('act2a_loop')
  })

  it('does not hand over the bait until Act IIa has been played', () => {
    // §21.0: "An earlier draft of this script went 1 dev -> 2 devs -> 1,000
    // devs. That is too fast, and it breaks the trap it exists to set." The
    // loop between shipping and the offer is the whole reason the collapse
    // lands as a betrayal, so the jump straight from act2_ship to act3_bait
    // is pinned shut here rather than left to a reading of the phase list.
    expect(advanceOnboarding('act2a_loop', at({ devs: 2, projectsShipped: 1 }))).toBe('act2a_loop')
    expect(advanceOnboarding('act2a_loop', at({ devs: 39, projectsShipped: 4 }))).toBe('act2a_loop')
  })

  it('ends Act IIa on the first twitch of the readout, not on a round number', () => {
    // 40 is where E first reads as something other than IN SYNC. The player
    // must get exactly one hint and wave it away.
    expect(advanceOnboarding('act2a_loop', at({ devs: ACT2A_ENDS_AT }))).toBe('act3_bait')
  })

  it('really is twice as fast with James — the premise has to be true', () => {
    // "More people = faster games!" is sincere here, and the simulation must
    // agree, or the reversal in Act IV lands as a cheat rather than a lesson.
    expect(passiveVelocity(2, 100) / passiveVelocity(1, 100)).toBeCloseTo(2, 3)
  })
})

describe('Act III — the player has to spring the trap themselves', () => {
  it('does not advance on its own', () => {
    expect(advanceOnboarding('act3_bait', at({ devs: 2, projectsShipped: 1 }))).toBe('act3_bait')
  })

  it('advances once the swarm lands', () => {
    const after = at({ devs: 2 + MASS_HIRE_COUNT, projectsShipped: 1 })
    expect(advanceOnboarding('act3_bait', after)).toBe('act4_collapse')
  })
})

describe('Act IV — the collapse is real, not scripted', () => {
  it('holds the beat until the studio has genuinely seized', () => {
    expect(advanceOnboarding('act4_collapse', at({ devs: 1002, entropy: 0.5 }))).toBe(
      'act4_collapse',
    )
  })

  it('advances on a real entropy reading', () => {
    // The reading it waits on is the one the simulation produces unprompted.
    const real = 1 - efficiency(2 + MASS_HIRE_COUNT, 100)
    expect(real).toBeGreaterThanOrEqual(0.99)
    expect(advanceOnboarding('act4_collapse', at({ entropy: real }))).toBe('act5_bleeding')
  })

  it('delivers the §6.2 figure: production drops to 0.01x', () => {
    expect(passiveVelocity(1000, 100)).toBeCloseTo(0.01, 6)
  })
})

describe('Act V — bankruptcy', () => {
  it('waits for cash to actually run out', () => {
    expect(advanceOnboarding('act5_bleeding', at({ cash: -500_000 }))).toBe('act5_bleeding')
    expect(advanceOnboarding('act5_bleeding', at({ bankrupt: true }))).toBe('bankrupt')
  })
})

describe('the §6.3 rebuke', () => {
  it('only fires once the studio is locked', () => {
    expect(shouldRebuke(100, 0)).toBe(false)
    expect(shouldRebuke(100, 0.5)).toBe(false)
    expect(shouldRebuke(100, 0.995)).toBe(true)
  })

  it('waits for the player to get genuinely desperate', () => {
    expect(shouldRebuke(DESPERATE_TAPS_BEFORE_REBUKE - 1, 1)).toBe(false)
    expect(shouldRebuke(DESPERATE_TAPS_BEFORE_REBUKE, 1)).toBe(true)
  })

  it('lands around the twentieth tap, as §6.3 specifies', () => {
    expect(DESPERATE_TAPS_BEFORE_REBUKE).toBe(20)
  })
})

describe('every phase has something to say', () => {
  it.each(PHASE_ORDER)('%s has copy', (phase: Phase) => {
    const copy = PHASE_COPY[phase]
    expect(copy.terminal || copy.bubble || copy.advisor).toBeTruthy()
  })

  it('gives the player-gated phases a button label', () => {
    expect(PHASE_COPY.act2_offer_hire.action).toBeTruthy()
    expect(PHASE_COPY.act3_bait.action).toBeTruthy()
    expect(PHASE_COPY.bankrupt.action).toBeTruthy()
  })
})
