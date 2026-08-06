import { describe, expect, it } from 'vitest'
import {
  ACT1_POKES_REQUIRED,
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
    const everything = at({
      pokeCount: 999,
      devs: 5000,
      projectsShipped: 9,
      entropy: 1,
      bankrupt: true,
    })
    expect(advanceOnboarding('act1_poke', everything)).toBe('act2_offer_hire')
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
    expect(advanceOnboarding('act2_ship', at({ devs: 2, projectsShipped: 1 }))).toBe('act3_bait')
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
