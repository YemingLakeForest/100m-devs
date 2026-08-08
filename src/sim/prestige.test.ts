/**
 * Layer 1 prestige — GDD §13.2, §14.1, §14.2, §4.2.
 *
 * Until this existed a Paradigm Shift was a reset with a counter: no currency
 * computed, none stored, nothing to spend it on. **Run 2 was Run 1 again**, so
 * the game had a first hour and no second one.
 */

import { describe, expect, it } from 'vitest'
import {
  CAP_EXPONENT,
  CAP_MULTIPLIER,
  D_BASE,
  EFFECTIVE,
  NODE_BY_ID,
  PARADIGM_TREE,
  bpFor,
  canAfford,
  devCapFor,
  nodeCost,
  totalLevels,
} from './prestige.ts'

describe('BP yield — §14.1', () => {
  it('pays a real first run about twenty points', () => {
    // The number that decides whether prestige exists as a system. Run 1 earns
    // roughly a million against a **trillion**-dollar normaliser, which sounds
    // like it should round to nothing — the 0.2 exponent is what stops it: a
    // millionth of the normaliser still yields a sixteenth of the scalar.
    const bp = bpFor(1_000_000, 1_040)
    expect(bp).toBeGreaterThan(10)
    expect(bp).toBeLessThan(40)
  })

  it('makes the first Telepathic Compression unaffordable, and that is the arc', () => {
    // §13.2 prices it at 25 BP. A first shift pays about nineteen, so nobody
    // reaches it until their *second* — and one level takes the cap from 100 to
    // 100,100. **The second prestige is the one that changes the game**, which
    // is a better shape than ten that each change it slightly.
    expect(bpFor(1_000_000, 1_040)).toBeLessThan(NODE_BY_ID.get('L1-1B')!.baseCost)
    expect(bpFor(1_000_000, 1_040)).toBeGreaterThanOrEqual(
      NODE_BY_ID.get('L1-1A')!.baseCost,
    )
  })

  it('weighs how far the run got, not only how well it went', () => {
    // Both terms matter and they measure different things. A player who banks a
    // fortune at forty developers has not earned a prestige, and the logarithm
    // on peak headcount is what says so.
    expect(bpFor(1_000_000, 40)).toBeLessThan(bpFor(1_000_000, 1_040))
    expect(bpFor(100_000, 1_040)).toBeLessThan(bpFor(1_000_000, 1_040))
  })

  it('damps a revenue spike rather than rewarding it', () => {
    // §14.1's exponent exists "so players cannot double their prestige payout
    // purely through short revenue spikes". Ten times the money is nowhere near
    // ten times the points.
    expect(bpFor(10_000_000, 1_040)).toBeLessThan(bpFor(1_000_000, 1_040) * 3)
  })

  it('pays nothing for a run that went nowhere', () => {
    expect(bpFor(0, 1_000)).toBe(0)
    expect(bpFor(1_000_000, 1)).toBe(0)
    expect(bpFor(-5, -5)).toBe(0)
  })

  it('returns a whole number, never NaN or Infinity', () => {
    for (const [rev, peak] of [
      [Number.MAX_VALUE, 1e12],
      [1e-9, 2],
      [Infinity, 10],
    ] as const) {
      const bp = bpFor(rev, peak)
      expect(Number.isFinite(bp)).toBe(true)
      expect(Number.isInteger(bp)).toBe(true)
      expect(bp).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('node costs — §14.2', () => {
  it('charges more for stacking levels on one node', () => {
    const node = NODE_BY_ID.get('L1-1A')!
    expect(nodeCost(node, 1)).toBeGreaterThan(nodeCost(node, 0))
    expect(nodeCost(node, 4)).toBeGreaterThan(nodeCost(node, 1))
  })

  it('charges more the deeper down a branch a node sits', () => {
    const shallow = NODE_BY_ID.get('L1-1A')!
    const deep = NODE_BY_ID.get('L1-3A')!
    expect(nodeCost(deep, 0) / deep.baseCost).toBeGreaterThan(
      nodeCost(shallow, 0) / shallow.baseCost,
    )
  })

  it('refuses a purchase past the max level, however rich the player is', () => {
    const node = NODE_BY_ID.get('L1-2A')!
    expect(canAfford(node, 0, 1e9)).toBe(true)
    expect(canAfford(node, node.maxLevel, 1e9)).toBe(false)
  })

  it('refuses a purchase that cannot be paid for', () => {
    const node = NODE_BY_ID.get('L1-1A')!
    expect(canAfford(node, 0, nodeCost(node, 0) - 1)).toBe(false)
    expect(canAfford(node, 0, nodeCost(node, 0))).toBe(true)
  })
})

describe('the developer cap — §4.2', () => {
  it('starts at the base hundred, which is what forces the Run 1 lock', () => {
    expect(devCapFor({})).toBe(D_BASE)
  })

  it('multiplies capacity a thousandfold on the first Compression level', () => {
    // §13.2's "+1,000x per level" *is* §4.2's mu of 1000. The two read like
    // different claims and are the same one.
    expect(devCapFor({ 'L1-1B': 1 })).toBeCloseTo(D_BASE * (1 + CAP_MULTIPLIER), 6)
  })

  it('accelerates with levels rather than adding evenly', () => {
    // The 1.35 exponent is what lets late prestige reach millions of developers
    // without breaking §4.1.
    const one = devCapFor({ 'L1-1B': 1 })
    const two = devCapFor({ 'L1-1B': 2 })
    expect(two).toBeGreaterThan(one * 2)
    expect(two).toBeCloseTo(D_BASE * (1 + CAP_MULTIPLIER * 2 ** CAP_EXPONENT), 6)
  })

  it('treats Async-First as capacity, because dividing load is multiplying cap', () => {
    // §4.1 only ever sees the ratio, so a 10% load reduction and a 1/0.9 cap
    // increase are the same number arriving by different routes. Folding it in
    // here is what stops it becoming a second adjustment nobody remembers.
    expect(devCapFor({ 'L1-1A': 1 })).toBeCloseTo(D_BASE / 0.9, 6)
    expect(devCapFor({ 'L1-1A': 5 })).toBeCloseTo(D_BASE / 0.5, 6)
  })

  it('honours §13.2’s max of five levels even if the save says otherwise', () => {
    // A hand-edited save asking for ten levels would otherwise divide by zero
    // and hand back an infinite cap.
    expect(devCapFor({ 'L1-1A': 99 })).toBe(devCapFor({ 'L1-1A': 5 }))
    expect(Number.isFinite(devCapFor({ 'L1-1A': 99 }))).toBe(true)
  })

  it('never returns something the entropy maths cannot use', () => {
    const cases: Record<string, number>[] = [{}, { 'L1-1B': 10 }, { 'L1-1A': 5, 'L1-1B': 10 }, { X: 3 }]
    for (const levels of cases) {
      const cap = devCapFor(levels)
      expect(Number.isFinite(cap)).toBe(true)
      expect(cap).toBeGreaterThanOrEqual(D_BASE)
    }
  })
})

describe('the tree itself — §13.2', () => {
  it('has no duplicate ids', () => {
    expect(NODE_BY_ID.size).toBe(PARADIGM_TREE.length)
  })

  it('says which nodes are wired and which are promises', () => {
    // §13.2 lists five and two are live. A tree with three buttons that take
    // the player's currency and change nothing is worse than three that say so.
    for (const id of EFFECTIVE) expect(NODE_BY_ID.has(id)).toBe(true)
    const inert = PARADIGM_TREE.filter((n) => !EFFECTIVE.has(n.id))
    expect(inert.length).toBeGreaterThan(0)
    for (const n of inert) expect(n.effect).toContain('not yet implemented')
  })

  it('counts levels across the whole tree', () => {
    expect(totalLevels({})).toBe(0)
    expect(totalLevels({ 'L1-1A': 2, 'L1-1B': 1, unknown: 9 })).toBe(3)
  })
})
