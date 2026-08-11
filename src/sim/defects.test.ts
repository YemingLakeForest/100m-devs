import { describe, expect, it } from 'vitest'
import {
  BETA,
  GARAGE_DENSITY,
  POKE_BETA,
  advanceDefects,
  defectDensity,
  defectRate,
  defectsFromPoke,
  densityLine,
  shipDefects,
} from './defects.ts'
import { DEFECT_DENSITY_ANCHOR, defectScore, rateRelease, BASELINE_RATING } from './rating.ts'
import { CONTEXT_SWITCH_COEFFICIENT } from './entropy.ts'
import { DEFECT_HALVING_QA_SHARE } from './roles.ts'

/**
 * §4.14.1's load-bearing claim, asserted rather than commented.
 *
 * "A studio with no QA therefore always scores exactly half on defects
 * *whatever β is*, so retuning how fast bugs arrive changes how quickly a studio
 * reaches §4.12a's incident threshold and changes nothing about what a shipped
 * game is worth."
 *
 * These tests are the only thing standing between that sentence and a future
 * commit that gives this module a constant of its own.
 */
describe('§4.12 / §4.14.1 — β is the rating anchor, not a coefficient anybody picked', () => {
  it('is the anchor itself, by identity', () => {
    expect(BETA).toBe(DEFECT_DENSITY_ANCHOR)
  })

  it('ships a garage studio at exactly the anchor density, at every velocity', () => {
    for (const velocity of [0.5, 1, 40, 1_000, 1e9]) {
      // One second of work with nobody checking.
      const backlog = defectRate(velocity, 0)
      expect(defectDensity(backlog, velocity)).toBeCloseTo(DEFECT_DENSITY_ANCHOR, 12)
    }
  })

  it('scores that studio at exactly half on defects — the whole point', () => {
    expect(defectScore(GARAGE_DENSITY)).toBeCloseTo(0.5, 12)
  })

  /**
   * The end-to-end version, and the one that would actually catch the mistake.
   * A garage release is exactly {@link BASELINE_RATING} — every downstream
   * multiplier is ×1 — so a player who ignores this entire batch earns what they
   * earned before it existed.
   */
  it('rates a garage release at exactly the baseline', () => {
    const sp = 1_000
    const backlog = defectRate(sp, 0) // one second at V = sp, i.e. sp points of work
    const rating = rateRelease({
      defects: backlog,
      storyPoints: sp,
      heroCoverage: 0,
      craft: 1,
    })
    expect(rating).toBeCloseTo(BASELINE_RATING, 10)
  })
})

describe('§4.12 — the faster you go, the more you break', () => {
  it('is linear in velocity', () => {
    expect(defectRate(20, 0)).toBeCloseTo(2 * defectRate(10, 0), 12)
  })

  it('produces nothing when the studio produces nothing', () => {
    // §6.3's lock is the game's one seizure and must not also write bugs.
    expect(defectRate(0, 0)).toBe(0)
  })

  it('halves at the QA halving share, and never reaches zero', () => {
    expect(defectRate(100, DEFECT_HALVING_QA_SHARE)).toBeCloseTo(defectRate(100, 0) / 2, 12)
    expect(defectRate(100, 1)).toBeGreaterThan(0)
    expect(defectRate(100, 1e6)).toBeGreaterThan(0)
  })
})

describe('§4.12 — poking is how defects get written', () => {
  it('charges a poke at β + ε, the same ε §4.9 uses for Entropy', () => {
    expect(POKE_BETA).toBe(CONTEXT_SWITCH_COEFFICIENT)
    expect(defectsFromPoke(1, 0)).toBeCloseTo(BETA + CONTEXT_SWITCH_COEFFICIENT, 12)
  })

  /**
   * The sentence a player would say out loud. It is true at today's values
   * because ε and β happen to be equal; the test states the *relationship* it
   * depends on so that if either moves, this reads as a design change rather
   * than as a broken assertion.
   */
  it('makes a poked point cost more than a passive one', () => {
    expect(defectsFromPoke(1, 0)).toBeGreaterThan(defectRate(1, 0))
  })

  it('is suppressed by QA on the same curve — they read it either way', () => {
    expect(defectsFromPoke(10, DEFECT_HALVING_QA_SHARE)).toBeCloseTo(
      defectsFromPoke(10, 0) / 2,
      12,
    )
  })
})

describe('advanceDefects', () => {
  it('accumulates, and a zero step changes nothing', () => {
    expect(advanceDefects(5, 100, 0, 0)).toBe(5)
    expect(advanceDefects(5, 100, 0, 2)).toBeCloseTo(5 + defectRate(100, 0) * 2, 12)
  })

  it('survives a corrupt backlog rather than propagating it', () => {
    expect(advanceDefects(Number.NaN, 10, 0, 1)).toBeCloseTo(defectRate(10, 0), 12)
    expect(advanceDefects(-50, 10, 0, 1)).toBeCloseTo(defectRate(10, 0), 12)
  })
})

describe('density, and how it reads', () => {
  it('is unrated rather than infinite when nobody built anything', () => {
    expect(defectDensity(10, 0)).toBe(0)
    expect(densityLine(10, 0)).toBeNull()
  })

  it('says "1 per N SP" rather than a number nobody can hold', () => {
    expect(densityLine(1, 21)).toBe('1 per 21 SP')
    expect(densityLine(2, 100)).toBe('1 per 50 SP')
  })

  /**
   * §4.12a's entire relationship with this module: shipping does not forgive the
   * backlog, it **transfers** it. The bench goes to zero and the density goes
   * with the release, where it is charged forever.
   */
  it('hands the density to the release and clears the bench', () => {
    const { density, remaining } = shipDefects(40, 1_000)
    expect(density).toBeCloseTo(0.04, 12)
    expect(remaining).toBe(0)
  })
})
