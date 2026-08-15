import { describe, expect, it } from 'vitest'
import {
  MAX_LEVEL,
  XP_BASE,
  XP_KAPPA,
  XP_RATE,
  levelAt,
  pointsAvailable,
  pointsGranted,
  unplacedEarnsNothing,
  xpAccrued,
  xpForLevel,
  xpToReach,
} from './heroXp.ts'

describe('§13.10 — a placed hero earns XP from the work under them', () => {
  it('is linear in covered velocity, so REACH pays twice', () => {
    // Broadening a hero widens what they affect *and* what they learn from.
    expect(xpAccrued(200, 1)).toBeCloseTo(2 * xpAccrued(100, 1), 9)
  })

  it('earns nothing for nothing', () => {
    expect(xpAccrued(0, 10)).toBe(0)
    expect(xpAccrued(100, 0)).toBe(0)
    expect(xpAccrued(-5, 10)).toBe(0)
  })

  it('earns about one level per project shipped, early', () => {
    // §13.10: "ξ is set so a hero at a rung they cover completely gains about
    // one node per project shipped, early." A small project is ~400 points.
    const earned = xpAccrued(400 / 60, 60)
    expect(earned).toBeCloseTo(XP_BASE, 6)
    expect(XP_RATE).toBeCloseTo(XP_BASE / 400, 6)
    // And that is exactly one level, from a standing start.
    expect(levelAt(earned).level).toBe(2)
  })
})

describe('§13.13 — XP reaches levels, and is never spent', () => {
  it('starts every hero at level 1, having paid nothing to arrive', () => {
    expect(xpToReach(1)).toBe(0)
    expect(levelAt(0).level).toBe(1)
    expect(levelAt(-99).level).toBe(1)
    expect(levelAt(Number.NaN).level).toBe(1)
  })

  it('is X0 κⁿ, and every step costs more than the last', () => {
    expect(xpForLevel(1)).toBe(XP_BASE)
    expect(xpForLevel(2)).toBeCloseTo(XP_BASE * XP_KAPPA, 9)
    for (let l = 2; l < 12; l++) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1))
  })

  it('agrees with itself — the cumulative sum is the sum of the steps', () => {
    let running = 0
    for (let l = 1; l < 20; l++) {
      expect(xpToReach(l)).toBeCloseTo(running, 6)
      running += xpForLevel(l)
    }
  })

  it('reads the level back off the XP, at every level and either side of it', () => {
    for (let l = 1; l < 40; l++) {
      const at = xpToReach(l)
      expect(levelAt(at).level).toBe(l)
      expect(levelAt(at + xpForLevel(l) * 0.5).level).toBe(l)
      expect(levelAt(at + xpForLevel(l)).level).toBe(l + 1)
      // Half a level short is the level below. Measured as a share of the
      // previous step rather than as a fixed epsilon: at level 30 the
      // cumulative figure is ~10^7 and a thousandth of a point is not
      // representable in a double, so a fixed epsilon tests nothing.
      if (l > 1) expect(levelAt(at - xpForLevel(l - 1) * 0.5).level).toBe(l - 1)
    }
  })

  it('reports progress toward the next level as a fraction', () => {
    const half = xpToReach(5) + xpForLevel(5) / 2
    const p = levelAt(half)
    expect(p.level).toBe(5)
    expect(p.span).toBeCloseTo(xpForLevel(5), 9)
    expect(p.fraction).toBeCloseTo(0.5, 6)
  })

  it('survives a number that has stopped being one', () => {
    expect(levelAt(Number.POSITIVE_INFINITY).level).toBe(MAX_LEVEL)
    expect(levelAt(Number.POSITIVE_INFINITY).fraction).toBe(1)
    expect(levelAt(1e308).level).toBeLessThanOrEqual(MAX_LEVEL)
  })

  it('reaches about level 100 at the top of §4.2’s cap, so the ceiling is never met', () => {
    // A hero covering a hundred million developers for an hour.
    const xp = xpAccrued(1e20, 3600)
    expect(levelAt(xp).level).toBeGreaterThan(50)
    expect(levelAt(xp).level).toBeLessThan(MAX_LEVEL)
  })
})

describe('§13.13 — one level, one point, and no other source', () => {
  it('grants a point at level 1, so a new colleague arrives with a decision', () => {
    expect(pointsGranted(1)).toBe(1)
    expect(pointsGranted(14)).toBe(14)
  })

  it('subtracts what has been spent, and never goes negative', () => {
    expect(pointsAvailable(5, 2)).toBe(3)
    expect(pointsAvailable(5, 5)).toBe(0)
    expect(pointsAvailable(5, 99)).toBe(0)
  })
})

describe('§13.10 — an unplaced hero earns nothing', () => {
  it('is a rate difference, never a debt', () => {
    expect(unplacedEarnsNothing(false, 100)).toBe(true)
    expect(unplacedEarnsNothing(true, 0)).toBe(true)
    expect(unplacedEarnsNothing(true, 100)).toBe(false)
  })
})
