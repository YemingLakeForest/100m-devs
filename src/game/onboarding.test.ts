import { describe, expect, it } from 'vitest'
import {
  ACT1_POKES_REQUIRED,
  MOUSETRAP_AT,
  TERM_SHEET_AFTER_SHIPS,
  DESPERATE_TAPS_BEFORE_REBUKE,
  MASS_HIRE_COUNT,
  PHASE_COPY,
  PHASE_ORDER,
  SCENE_PHASES,
  advanceOnboarding,
  shouldRebuke,
  type OnboardingSnapshot,
  type Phase,
} from './onboarding.ts'
import { efficiency, passiveVelocity } from '../sim/entropy.ts'
import { FIRST_PAID_RUNG } from '../sim/economy.ts'

const base: OnboardingSnapshot = {
  pokeCount: 0,
  devs: 0,
  projectsShipped: 0,
  cash: 0,
  entropy: 0,
  bankrupt: false,
  seedTaken: false,
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
    expect(advanceOnboarding('act1_poke', everything)).toBe('act1_james')
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

  it('sends James in once poking has landed', () => {
    expect(advanceOnboarding('act1_poke', at({ pokeCount: ACT1_POKES_REQUIRED }))).toBe(
      'act1_james',
    )
  })

  /**
   * §21.0b, R41. Fifty taps is ~15 seconds at the 3–5 a second §21 predicts:
   * **long enough that the player has felt the size of the sprint, and
   * short enough that they have not yet decided the game is a grind.**
   *
   * The old bound was twenty, and it was measuring the wrong thing — at twelve
   * pokes the script offered a hire button costing a dollar against a treasury
   * of nothing, so the *real* gate on the first help was shipping the whole
   * project alone. Both ends are pinned now, because this number is only
   * correct between them.
   */
  it('gives the player time to feel the size of it, and no more', () => {
    expect(ACT1_POKES_REQUIRED).toBeGreaterThanOrEqual(30)
    expect(ACT1_POKES_REQUIRED).toBeLessThanOrEqual(80)
  })

  /**
   * §21.0b — **he is not hired, he turns up.** The beat waits on him being at a
   * desk rather than on the player pressing anything, because there is nothing
   * to press: the store grants him free on entry to the phase.
   */
  it('waits for James to sit down, and there is no button to press', () => {
    expect(advanceOnboarding('act1_james', at({ devs: 0, cash: 0 }))).toBe('act1_james')
    expect(advanceOnboarding('act1_james', at({ devs: 1, cash: 0 }))).toBe('act1_ship')
    expect(PHASE_COPY.act1_james.action).toBeUndefined()
  })

  it('holds the garage open until the whole catalogue is out — §21.0e', () => {
    // §4.10f, §21.0e. Two unpaid founders ship all three garage games with no
    // hire button anywhere on screen, which is what makes Act III's arithmetic
    // ("two of us shipped three games") a thing the player can count rather
    // than a claim they can disprove by looking at their own floor.
    for (let shipped = 0; shipped < TERM_SHEET_AFTER_SHIPS; shipped++) {
      expect(advanceOnboarding('act1_ship', at({ devs: 1, projectsShipped: shipped }))).toBe(
        'act1_ship',
      )
    }
    expect(PHASE_COPY.act1_ship.action).toBeUndefined()
    expect(
      advanceOnboarding('act1_ship', at({ devs: 1, projectsShipped: TERM_SHEET_AFTER_SHIPS })),
    ).toBe('act2_termsheet')
  })

  it('hangs the term sheet on the catalogue, not on a headcount — §21.0a', () => {
    // It used to fire at ten developers. §21.0e deletes the hiring that number
    // was about, so the beat is re-hung on the verb the player has actually been
    // doing, and `FIRST_PAID_RUNG` is the whole garage by definition.
    expect(TERM_SHEET_AFTER_SHIPS).toBe(FIRST_PAID_RUNG)
  })
})

describe('Act II — the term sheet, and nothing else to spend it on', () => {
  it('waits for the player to actually sign', () => {
    // The one beat in Run 1 that is pure upside, and it still has to be taken:
    // §6's lesson needs every step into the trap to have been a decision,
    // including the ones that felt like good news.
    expect(advanceOnboarding('act2_termsheet', at({ devs: 200 }))).toBe('act2_termsheet')
    expect(advanceOnboarding('act2_termsheet', at({ seedTaken: true }))).toBe('act3_bait')
  })

  it('goes straight from the money to the mousetrap — §21.0e', () => {
    // There is nothing between the cash injection and the only thing in the game
    // that cash can buy, and that is the design rather than a missing beat: the
    // player is handed fifty thousand dollars marked USE OF FUNDS — HEADCOUNT
    // and one control that spends it on headcount.
    expect(advanceOnboarding('act2_termsheet', at({ seedTaken: true }))).not.toBe('act2_loop')
  })

  it('never re-runs Act III’s copy over a studio that learned the lesson', () => {
    // `act2_loop` is runs 2+ and it is where they end. It used to hand over to
    // `act3_bait` at MOUSETRAP_AT, so measured (`pacing.test.ts`) run 6 spent
    // from its third minute onward showing `LIMITED OFFER: MASS HIRING PACKAGE
    // UNLOCKED` and "Onboarding 1,000 developers. This is fine." over a healthy
    // studio of fifteen hundred people. Acts III to V are Run 1's script.
    for (const devs of [MOUSETRAP_AT - 1, MOUSETRAP_AT, 5_000]) {
      expect(advanceOnboarding('act2_loop', at({ devs }))).toBe('act2_loop')
    }
    // The run can still end, because the bankruptcy guard is not keyed to a
    // phase — that is the property that makes the above safe.
    expect(advanceOnboarding('act2_loop', at({ devs: 5_000, bankrupt: true }))).toBe('bankrupt')
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
    // §21.7 — a beat carried by a scene is exempt, and only those. A phase the
    // game passes through in silence is a beat the player experiences as the
    // game having stopped.
    if (SCENE_PHASES.has(phase)) return
    const copy = PHASE_COPY[phase]
    expect(copy.terminal || copy.bubble || copy.advisor).toBeTruthy()
  })

  it('keeps the scene exemption to beats that actually have one', () => {
    // The exemption is a stated design fact, so it is pinned: adding a phase to
    // SCENE_PHASES without writing it a scene is how a silent beat gets in.
    // act1_james now carries its own mechanic hint, so nothing is scene-only.
    expect([...SCENE_PHASES]).toEqual([])
  })

  it('gives the player-gated phases their own surface', () => {
    // `act3_bait` and `bankrupt` are action-bar beats and carry a label.
    expect(PHASE_COPY.act3_bait.action).toBeTruthy()
    expect(PHASE_COPY.bankrupt.action).toBeTruthy()
    // §21.0a — the term sheet is the exception, and deliberately: its control is
    // a modal (`TermSheet.tsx`), so a label here would draw a *second* button
    // for a decision that already has one.
    expect(PHASE_COPY.act2_termsheet.action).toBeUndefined()
    expect(PHASE_COPY.act2_termsheet.advisor).toBeTruthy()
  })
})
