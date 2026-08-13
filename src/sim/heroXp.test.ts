import { describe, expect, it } from 'vitest'
import {
  XP_COST_BASE,
  XP_KAPPA,
  XP_RATE,
  canBuyNode,
  unplacedEarnsNothing,
  xpAccrued,
  xpNodeCost,
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

  it('earns about one node per project shipped, early', () => {
    // §13.10: "ξ is set so a hero at a rung they cover completely gains about
    // one node per project shipped, early." A small project is ~400 points.
    const earned = xpAccrued(400 / 60, 60)
    expect(earned).toBeCloseTo(XP_COST_BASE, 6)
    expect(XP_RATE).toBeCloseTo(XP_COST_BASE / 400, 6)
  })
})

describe('the node cost curve — §14.5’s shape', () => {
  it('is X0 κ^n, and always a positive integer', () => {
    expect(xpNodeCost(0)).toBe(XP_COST_BASE)
    expect(xpNodeCost(1)).toBe(Math.ceil(XP_COST_BASE * XP_KAPPA))
    for (let n = 0; n < 6; n++) {
      expect(xpNodeCost(n)).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(xpNodeCost(n))).toBe(true)
    }
  })

  it('rises at every step', () => {
    for (let n = 1; n < 6; n++) expect(xpNodeCost(n)).toBeGreaterThan(xpNodeCost(n - 1))
  })

  it('refuses a node the XP cannot cover', () => {
    expect(canBuyNode(0, XP_COST_BASE - 1)).toBe(false)
    expect(canBuyNode(0, XP_COST_BASE)).toBe(true)
  })
})

describe('§13.10 — an unplaced hero earns nothing', () => {
  it('is a rate difference, never a debt', () => {
    expect(unplacedEarnsNothing(false, 100)).toBe(true)
    expect(unplacedEarnsNothing(true, 0)).toBe(true)
    expect(unplacedEarnsNothing(true, 100)).toBe(false)
  })
})
