import { describe, expect, it } from 'vitest'
import {
  BASELINE_RATING,
  DEFECT_DENSITY_ANCHOR,
  RATING_WEIGHTS,
  REPUTATION_MEMORY,
  advanceReputation,
  craftScore,
  defectScore,
  prestigeMultiplier,
  rateRelease,
  ratingBand,
  reputationMultiplier,
  revenueMultiplier,
} from './rating.ts'

/** The release a garage ships: no QA, no heroes, an average team. */
const GARAGE = { defects: 0.02 * 1000, storyPoints: 1000, heroCoverage: 0, craft: 1 }

describe('§4.14 — the weights', () => {
  it('puts defects first, heroes second and craft third', () => {
    // §4.14 fixes the *order* and explicitly not the values. This is the part
    // that is canon, so this is the part that is pinned.
    expect(RATING_WEIGHTS.defects).toBeGreaterThan(RATING_WEIGHTS.heroes)
    expect(RATING_WEIGHTS.heroes).toBeGreaterThan(RATING_WEIGHTS.craft)
  })

  it('spends the whole hundred, so a perfect release scores 100', () => {
    const sum = RATING_WEIGHTS.defects + RATING_WEIGHTS.heroes + RATING_WEIGHTS.craft
    expect(sum).toBeCloseTo(1, 12)
    expect(
      rateRelease({ defects: 0, storyPoints: 1000, heroCoverage: 1, craft: 1e9 }),
    ).toBeCloseTo(100, 6)
  })
})

describe('§4.14 — the defect term', () => {
  it('is perfect when nothing is broken', () => {
    expect(defectScore(0)).toBe(1)
  })

  it('scores exactly a half at the anchor density', () => {
    // The anchor is not a tuning value pulled out of the air — it is the
    // density a studio ships at with nobody checking, and `defects.ts` takes
    // its coefficient *from here*. See the note on DEFECT_DENSITY_ANCHOR.
    expect(defectScore(DEFECT_DENSITY_ANCHOR)).toBeCloseTo(0.5, 12)
  })

  it('falls without ever reaching zero, however broken the game is', () => {
    expect(defectScore(DEFECT_DENSITY_ANCHOR * 100)).toBeGreaterThan(0)
    expect(defectScore(DEFECT_DENSITY_ANCHOR * 100)).toBeLessThan(0.02)
  })

  it('reads a release with no story points as unrated rather than NaN', () => {
    expect(rateRelease({ defects: 5, storyPoints: 0, heroCoverage: 0, craft: 1 })).toBe(
      BASELINE_RATING,
    )
  })
})

describe('§4.14 — the craft term', () => {
  it('sits at a half for a team of exactly average developers', () => {
    // §4.9a pins the roster mean at 1.0 twice over, so "average" is an exact
    // number here rather than an approximation.
    expect(craftScore(1)).toBeCloseTo(0.5, 12)
  })

  it('rises with the realised output of whoever built it, and is bounded', () => {
    expect(craftScore(2)).toBeGreaterThan(craftScore(1))
    expect(craftScore(0.5)).toBeLessThan(craftScore(1))
    expect(craftScore(1e12)).toBeLessThanOrEqual(1)
    expect(craftScore(0)).toBe(0)
  })
})

describe('§4.14 — the baseline, and why the existing economy does not move', () => {
  /**
   * The load-bearing property of this whole file.
   *
   * §4.10's economy is calibrated against §21's two stated figures — *Flappy
   * Square* pays exactly +$50 — and a rating that multiplies revenue could
   * silently rebalance every number in the game. It does not, because the
   * neutral point is **derived from the garage** rather than picked at 50: the
   * release a studio with no QA, no heroes and an average team ships is worth
   * exactly ×1, so a player who ignores this entire batch earns what they
   * always earned.
   */
  it('rates the garage release at exactly the baseline', () => {
    expect(rateRelease(GARAGE)).toBeCloseTo(BASELINE_RATING, 9)
  })

  it('pays the garage release exactly what it paid before the rating existed', () => {
    expect(revenueMultiplier(rateRelease(GARAGE))).toBeCloseTo(1, 12)
    expect(reputationMultiplier(BASELINE_RATING)).toBeCloseTo(1, 12)
    expect(prestigeMultiplier(BASELINE_RATING)).toBeCloseTo(1, 12)
  })

  it('starts a run at the garage reputation, not at zero and not at fifty', () => {
    // A studio that has shipped nothing has a garage's reputation. Starting at
    // zero would tax the first project for the crime of being first.
    expect(advanceReputation(BASELINE_RATING, BASELINE_RATING)).toBeCloseTo(BASELINE_RATING, 12)
  })
})

describe('§4.14 — what the rating is for', () => {
  it('goes down while everything else goes up', () => {
    // The sentence the whole requirement exists for: a studio that grows and
    // ships faster, and lets its defect density climb, scores worse.
    const careful = rateRelease({ ...GARAGE, defects: 5 })
    const fast = rateRelease({ ...GARAGE, defects: 200 })
    expect(fast).toBeLessThan(careful)
  })

  it('is dominated by defects — the other two cannot rescue a broken game', () => {
    // §4.14: "Defects dominate deliberately. The other two are things the
    // player arranges in advance; defects are the thing they are choosing to
    // ignore right now in exchange for going faster."
    const broken = rateRelease({
      defects: DEFECT_DENSITY_ANCHOR * 1000 * 20,
      storyPoints: 1000,
      heroCoverage: 1,
      craft: 100,
    })
    expect(broken).toBeLessThan(55)
  })

  it('lets a studio ship a 12 out of 100', () => {
    // §4.14 is explicit that this must stay possible, and §10.11.5 requires the
    // gallery to keep showing it.
    const shovelware = rateRelease({
      defects: DEFECT_DENSITY_ANCHOR * 1000 * 30,
      storyPoints: 1000,
      heroCoverage: 0,
      craft: 0.35,
    })
    expect(shovelware).toBeLessThan(20)
    expect(shovelware).toBeGreaterThan(0)
  })

  it('stays inside 0..100 for every input anyone could hand it', () => {
    const wild = [
      { defects: -5, storyPoints: -1, heroCoverage: -2, craft: -3 },
      { defects: 1e18, storyPoints: 1, heroCoverage: 9, craft: 1e18 },
      { defects: NaN, storyPoints: NaN, heroCoverage: NaN, craft: NaN },
      { defects: Infinity, storyPoints: Infinity, heroCoverage: Infinity, craft: Infinity },
    ]
    for (const input of wild) {
      const r = rateRelease(input)
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(100)
    }
  })
})

describe('§4.14 — reputation is a slow average', () => {
  it('moves towards the newest rating without reaching it', () => {
    const rep = advanceReputation(BASELINE_RATING, 100)
    expect(rep).toBeGreaterThan(BASELINE_RATING)
    expect(rep).toBeLessThan(100)
  })

  it('takes several releases to turn a studio around', () => {
    // "Reputation decays slowly enough to be outrun by volume for a while."
    let rep = BASELINE_RATING
    for (let i = 0; i < REPUTATION_MEMORY - 1; i++) rep = advanceReputation(rep, 100)
    expect(rep).toBeLessThan(85)
  })

  it('converges on a studio that ships the same rating over and over', () => {
    let rep = BASELINE_RATING
    for (let i = 0; i < 200; i++) rep = advanceReputation(rep, 80)
    expect(rep).toBeCloseTo(80, 4)
  })

  it('stays inside 0..100 under any rating', () => {
    expect(advanceReputation(0, 0)).toBeGreaterThanOrEqual(0)
    expect(advanceReputation(100, 100)).toBeLessThanOrEqual(100)
    expect(Number.isFinite(advanceReputation(NaN, NaN))).toBe(true)
  })
})

describe('§4.14 — what ratings feed', () => {
  it('pays more for a better game and less for a worse one', () => {
    expect(revenueMultiplier(100)).toBeGreaterThan(1)
    expect(revenueMultiplier(0)).toBeLessThan(1)
    expect(revenueMultiplier(100)).toBeGreaterThan(revenueMultiplier(60))
  })

  it('never takes the money away entirely — a 12/100 still pays', () => {
    // The satire has to survive the scoring. A rating is a pressure, not a
    // morality, and a multiplier that approached zero would make it a fail
    // state by arithmetic — which §25.3.2 forbids outright.
    expect(revenueMultiplier(0)).toBeGreaterThan(0.5)
    expect(revenueMultiplier(12)).toBeGreaterThan(0.6)
  })

  it('scales prestige by reputation, so a run can be good rather than long', () => {
    expect(prestigeMultiplier(100)).toBeGreaterThan(prestigeMultiplier(BASELINE_RATING))
    expect(prestigeMultiplier(0)).toBeLessThan(1)
    expect(prestigeMultiplier(0)).toBeGreaterThan(0)
  })

  it('is monotonic everywhere, so no rating is worth less than a worse one', () => {
    let lastRevenue = -Infinity
    let lastRep = -Infinity
    let lastPrestige = -Infinity
    for (let r = 0; r <= 100; r += 0.5) {
      expect(revenueMultiplier(r)).toBeGreaterThan(lastRevenue)
      expect(reputationMultiplier(r)).toBeGreaterThan(lastRep)
      expect(prestigeMultiplier(r)).toBeGreaterThan(lastPrestige)
      lastRevenue = revenueMultiplier(r)
      lastRep = reputationMultiplier(r)
      lastPrestige = prestigeMultiplier(r)
    }
  })
})

describe('§10.11.3 — the rating tints the cover', () => {
  it('picks a ramp step that climbs with the score', () => {
    expect(ratingBand(5)).toBeLessThan(ratingBand(50))
    expect(ratingBand(50)).toBeLessThan(ratingBand(95))
  })

  it('stays on the ramp at both ends', () => {
    for (const r of [-10, 0, 50, 100, 400, NaN]) {
      expect(ratingBand(r)).toBeGreaterThanOrEqual(0)
      expect(ratingBand(r)).toBeLessThanOrEqual(3)
      expect(Number.isInteger(ratingBand(r))).toBe(true)
    }
  })
})
