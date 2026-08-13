import { describe, expect, it } from 'vitest'
import {
  NO_TECH,
  PRESTIGE_PHI,
  STANDUP_LENGTH_S,
  STANDUP_PERIOD_S,
  TECH_BY_ID,
  TECH_TREE,
  boardCost,
  canBuyTech,
  inStandup,
  standupFactor,
  techCost,
  techEffects,
  techUnlocked,
} from './techTree.ts'

describe('the tree itself', () => {
  it('has no duplicate ids', () => {
    expect(TECH_BY_ID.size).toBe(TECH_TREE.length)
  })

  it('only names prerequisites that exist, and never itself', () => {
    for (const node of TECH_TREE) {
      if (node.requires === undefined) continue
      expect(TECH_BY_ID.has(node.requires)).toBe(true)
      expect(node.requires).not.toBe(node.id)
    }
  })

  it('has no prerequisite cycles — every node is reachable from a root', () => {
    for (const node of TECH_TREE) {
      const seen = new Set<string>([node.id])
      let cursor = node.requires
      while (cursor !== undefined) {
        expect(seen.has(cursor)).toBe(false)
        seen.add(cursor)
        cursor = TECH_BY_ID.get(cursor)?.requires
      }
    }
  })

  it('never lists a node whose effect string is empty', () => {
    // §11's own rule, restated as a test: a node that says nothing about what
    // it does is one step from a node that does nothing.
    for (const node of TECH_TREE) {
      expect(node.effect.length).toBeGreaterThan(0)
      expect(node.flavour.length).toBeGreaterThan(0)
    }
  })

  it('never writes "SP" at the player — §10.2a', () => {
    for (const node of TECH_TREE) {
      expect(`${node.name} ${node.effect} ${node.flavour}`).not.toMatch(/\bSP\b/)
    }
  })
})

describe('costs — §11.0', () => {
  it('is BaseCost x Multiplier^N', () => {
    // C1 rather than B1: §11.5 made B1 a *granted* node with no price, so the
    // cost curve needs a node that actually has one.
    const c1 = TECH_BY_ID.get('C1')!
    expect(techCost(c1, 0)).toBe(100)
    expect(techCost(c1, 1)).toBe(Math.round(100 * 1.09))
    expect(techCost(c1, 3)).toBe(Math.round(100 * 1.09 ** 3))
  })

  it('treats a negative level as zero rather than making a node cheaper', () => {
    const b1 = TECH_BY_ID.get('B1')!
    expect(techCost(b1, -4)).toBe(techCost(b1, 0))
  })
})

describe('buying', () => {
  const b2 = TECH_BY_ID.get('B2')!

  it('refuses a node whose prerequisite is unowned, at any price', () => {
    expect(techUnlocked(b2, {})).toBe(false)
    // Ring open (one shift), so the prerequisite is the thing being refused.
    expect(canBuyTech(b2, {}, Number.MAX_SAFE_INTEGER, 1)).toBe(false)
  })

  it('allows it once the prerequisite is owned, the ring is open, and the cash is there', () => {
    const cost = boardCost(b2, 0, 1)
    expect(canBuyTech(b2, { B1: 1 }, cost, 1)).toBe(true)
    expect(canBuyTech(b2, { B1: 1 }, cost - 1, 1)).toBe(false)
  })

  it('refuses a node whose ring has not opened, whatever the cash', () => {
    // B2 is ring 1: before the first shift the board is shut to it.
    expect(canBuyTech(b2, { B1: 1 }, Number.MAX_SAFE_INTEGER, 0)).toBe(false)
  })

  it('refuses a maxed node', () => {
    expect(canBuyTech(b2, { B1: 1, B2: 1 }, Number.MAX_SAFE_INTEGER, 1)).toBe(false)
  })
})

describe('the board shape — §11.4.1, §11.4.6', () => {
  it('puts Instant Messenger at the centre of the grid', () => {
    const im = TECH_BY_ID.get('B1')!
    expect(im.x).toBe(0)
    expect(im.y).toBe(0)
    expect(im.ring).toBe(0)
    expect(im.granted).toBe(true)
  })

  it('lays every branch out as a compass heading, never a column', () => {
    // Protocol runs west (negative x), culture runs north (negative y), and the
    // estimation fork runs east from the culture root — three headings.
    const xs = new Set(TECH_TREE.filter((n) => !n.granted).map((n) => n.x))
    expect(xs.size).toBeGreaterThan(2)
    const ys = new Set(TECH_TREE.filter((n) => !n.granted).map((n) => n.y))
    expect(ys.size).toBeGreaterThan(1)
  })

  it('marks the ring on every node as a first pass, monotonically by chain depth', () => {
    for (const node of TECH_TREE) {
      expect(node.ring).toBeGreaterThanOrEqual(0)
    }
    // A child is never in an earlier ring than its prerequisite.
    for (const node of TECH_TREE) {
      if (node.requires === undefined) continue
      expect(node.ring).toBeGreaterThan(TECH_BY_ID.get(node.requires)!.ring)
    }
  })

  it('charges the prestige term on the price — §11.4.6', () => {
    const c1 = TECH_BY_ID.get('C1')!
    const flat = techCost(c1, 0)
    expect(boardCost(c1, 0, 0)).toBe(flat)
    expect(boardCost(c1, 0, 1)).toBe(Math.round(flat * PRESTIGE_PHI))
    expect(boardCost(c1, 0, 2)).toBe(Math.round(flat * PRESTIGE_PHI ** 2))
  })
})

describe('effects', () => {
  it('an empty tree changes nothing', () => {
    expect(techEffects({})).toEqual(NO_TECH)
  })

  it('B1 compounds rather than summing, so it can never reach zero load', () => {
    // Five summed −5%s would be −25%; compounded they are 0.95^5 = 0.774.
    expect(techEffects({ B1: 5 }).devCapMultiplier).toBeCloseTo(1 / 0.95 ** 5, 6)
    expect(techEffects({ B1: 5 }).devCapMultiplier).toBeGreaterThan(1)
    // And it is clamped at the node's max level even if a save says otherwise.
    expect(techEffects({ B1: 99 }).devCapMultiplier).toBeCloseTo(
      techEffects({ B1: 5 }).devCapMultiplier,
      6,
    )
  })

  it('B3 is a real trade — half the studio, but load and payout both move', () => {
    const e = techEffects({ B1: 1, B2: 1, B3: 1 })
    expect(e.activeDevFraction).toBe(0.5)
    expect(e.revenueMultiplier).toBe(2)
    expect(e.devCapMultiplier).toBeGreaterThan(techEffects({ B1: 1 }).devCapMultiplier)
  })

  it('takes the tightest entropy cap, never the product of two', () => {
    expect(techEffects({ B2: 1 }).entropyCap).toBe(0.8)
    // §11.2's documented [CONFLICT] resolved to 60%.
    expect(techEffects({ B2: 1, B4: 1 }).entropyCap).toBe(0.6)
  })

  it('climbs the estimation ladder in absolute steps', () => {
    expect(techEffects({}).estimationTier).toBe(1)
    expect(techEffects({ C6: 1 }).estimationTier).toBe(2)
    expect(techEffects({ C6: 1, C7: 1 }).estimationTier).toBe(3)
    expect(techEffects({ C6: 1, C7: 1, C8: 1 }).estimationTier).toBe(4)
    expect(techEffects({ C6: 1, C7: 1, C8: 1, C9: 1 }).estimationTier).toBe(5)
  })

  it('states an absolute tier, so an out-of-order save cannot invent one', () => {
    // The prerequisites forbid this; a save from another build could still
    // present it, and the answer must be a tier somebody designed.
    expect(techEffects({ C9: 1 }).estimationTier).toBe(5)
  })

  it('lets the consultants take their cut on top of the pair-programming double', () => {
    const e = techEffects({ B1: 1, B2: 1, B3: 1, C6: 1, C7: 1, C8: 1, C9: 1 })
    expect(e.revenueMultiplier).toBeCloseTo(1.8, 6)
  })

  it('keeps C8 cosmetic — the readout moves and the output does not', () => {
    const e = techEffects({ C6: 1, C7: 1, C8: 1 })
    expect(e.velocityDisplayScale).toBeCloseTo(1.1, 6)
    // Nothing in the effect set multiplies real output.
    expect(e.activeDevFraction).toBe(1)
    expect(e.devCapMultiplier).toBe(1)
  })
})

describe('the standup pause — §11.2 B2', () => {
  it('does nothing at all until the node is owned', () => {
    for (let t = 0; t < 130; t += 0.5) expect(standupFactor(t, false)).toBe(1)
  })

  it('stops a fifth of the studio for five seconds a minute', () => {
    expect(standupFactor(0, true)).toBeCloseTo(0.8, 6)
    expect(standupFactor(STANDUP_LENGTH_S - 0.01, true)).toBeCloseTo(0.8, 6)
    expect(standupFactor(STANDUP_LENGTH_S, true)).toBe(1)
    expect(standupFactor(STANDUP_PERIOD_S - 0.01, true)).toBe(1)
    // And it comes round again. Forever.
    expect(standupFactor(STANDUP_PERIOD_S, true)).toBeCloseTo(0.8, 6)
    expect(standupFactor(STANDUP_PERIOD_S * 7 + 2, true)).toBeCloseTo(0.8, 6)
  })

  it('spends exactly a twelfth of the run in a meeting', () => {
    let meeting = 0
    const step = 0.01
    for (let t = 0; t < STANDUP_PERIOD_S; t += step) if (inStandup(t, true)) meeting += step
    expect(meeting / STANDUP_PERIOD_S).toBeCloseTo(STANDUP_LENGTH_S / STANDUP_PERIOD_S, 2)
  })

  it('survives a nonsense clock rather than freezing the studio forever', () => {
    expect(standupFactor(Number.NaN, true)).toBe(1)
    expect(standupFactor(Number.POSITIVE_INFINITY, true)).toBe(1)
  })
})
