/**
 * You — GDD §4.5d, §13.7.1. R16 and R20.
 *
 * The two tests that matter most here are the two §4.5d writes as failure
 * conditions rather than as balance: this must never be an idle generator that
 * plays itself, and it must never beat hiring. Both are asserted below against
 * the real §4.1 curve rather than against a number typed into this file.
 */

import { describe, expect, it } from 'vitest'
import {
  FOUNDER_BASE_RATE,
  FOUNDER_BY_ID,
  FOUNDER_TAP_SECONDS,
  FOUNDER_TREE,
  MANAGEMENT_DILUTION,
  canBuyFounder,
  founderCost,
  founderEffects,
  founderMastery,
  founderTotalLevels,
  maxedFounderLevels,
} from './founder.ts'
import { D_BASE, bestOutput, optimalHeadcount, passiveVelocity } from './entropy.ts'
import { devCapFor } from './prestige.ts'
import { BRANCHES } from './heroTree.ts'

describe('the tree itself — §13.7.1', () => {
  it('has no duplicate ids', () => {
    expect(FOUNDER_BY_ID.size).toBe(FOUNDER_TREE.length)
  })

  it('borrows from every branch there is and invents nothing of its own', () => {
    // "The Management tree contains a diluted copy of every other tree's spine,
    // and nothing of its own." A node from a class that does not exist would be
    // the joke stopping being the joke — so this asserts the *set*, not a count.
    //
    // It read `all four` until §13.9.2 added Cloud as a sixth branch and gave
    // it Melany. §13.7's four were the four that existed when it was written;
    // the rule was never about the number.
    const branches = new Set(BRANCHES.filter((b) => b !== 'cohesion'))
    const borrowed = new Set(FOUNDER_TREE.map((n) => n.borrowedFrom))
    for (const b of borrowed) {
      expect(branches.has(b as never), `${b} is not a branch`).toBe(true)
    }
    expect([...borrowed].sort()).toEqual(['cloud', 'engineering', 'quality', 'reliability', 'support'])
  })

  it('uses §13.6.4’s three node kinds and no others', () => {
    for (const node of FOUNDER_TREE) {
      expect(['DEPTH', 'TRAIT', 'REACH']).toContain(node.kind)
    }
  })

  it('never writes "SP" at the player — §10.2a', () => {
    for (const n of FOUNDER_TREE) {
      expect(`${n.name} ${n.effect} ${n.flavour}`).not.toMatch(/\bSP\b/)
    }
  })

  it('prices a repeatable node up as it is stacked', () => {
    const typing = FOUNDER_BY_ID.get('M-ENG')!
    expect(founderCost(typing, 1)).toBeGreaterThan(founderCost(typing, 0))
    expect(founderCost(typing, 5)).toBeGreaterThan(founderCost(typing, 1) * 2)
  })

  it('refuses a maxed node however rich the player is', () => {
    const qa = FOUNDER_BY_ID.get('M-QA')!
    expect(canBuyFounder(qa, {}, 1e12)).toBe(true)
    expect(canBuyFounder(qa, { 'M-QA': 1 }, 1e12)).toBe(false)
  })
})

describe('your own curve — §4.5d', () => {
  it('starts at half a developer, which is the joke', () => {
    // One developer at full efficiency is 1 story point a second. The founder,
    // who now spends the day managing, is worth half of one.
    expect(founderEffects(undefined).rate).toBe(FOUNDER_BASE_RATE)
    expect(founderEffects({}).rate).toBe(FOUNDER_BASE_RATE)
  })

  it('grows only because you got better, never because the studio did', () => {
    // There is no headcount argument. That is the entire point of the section:
    // this is the one curve §4.1 cannot tax and hiring cannot raise.
    const base = founderEffects({}).rate
    const trained = founderEffects({ 'M-ENG': 10 }).rate
    expect(trained).toBeGreaterThan(base)
    expect(founderEffects({ 'M-ENG': 10 })).toEqual(founderEffects({ 'M-ENG': 10 }))
  })

  it('honours the max level even if a save claims more', () => {
    expect(founderEffects({ 'M-ENG': 999 }).rate).toBe(founderEffects({ 'M-ENG': 10 }).rate)
  })

  it('makes the tap worth more than the trickle — it is a clicker, not an idler', () => {
    // §4.5d failure condition 1: never "an idle generator that plays itself".
    const e = founderEffects({})
    expect(e.tapValue).toBe(e.rate * FOUNDER_TAP_SECONDS)
    expect(e.tapValue).toBeGreaterThan(e.rate)
  })

  it('survives a junk levels map', () => {
    const junk = { 'M-ENG': Number.NaN, 'M-REACH': -3 } as Record<string, number>
    expect(founderEffects(junk).rate).toBe(FOUNDER_BASE_RATE)
    expect(founderEffects(junk).reachRows).toBe(0)
  })
})

describe('the traits — §13.7.1’s borrowed spines', () => {
  it('keeps exactly the diluted share of the specialist effect', () => {
    expect(founderEffects({ 'M-QA': 1 }).contextSwitchScale).toBeCloseTo(
      1 - MANAGEMENT_DILUTION,
      6,
    )
  })

  it('is off until bought, every one of them', () => {
    const off = founderEffects({})
    expect(off.contextSwitchScale).toBe(1)
    expect(off.cashPerPoint).toBe(0)
    expect(off.worksOffline).toBe(false)
    expect(off.reachRows).toBe(0)
  })

  it('caps walking around at three rows', () => {
    expect(founderEffects({ 'M-REACH': 3 }).reachRows).toBe(3)
    expect(founderEffects({ 'M-REACH': 50 }).reachRows).toBe(3)
  })

  it('counts levels across the whole tree', () => {
    expect(founderTotalLevels({})).toBe(0)
    expect(founderTotalLevels({ 'M-ENG': 2, 'M-QA': 1, nonsense: 7 })).toBe(3)
  })
})

describe('it must never beat hiring — §4.5d, §13.7.1', () => {
  const maxed = founderEffects(maxedFounderLevels())

  it('loses to a correctly-sized studio at the base capacity', () => {
    // §4.5d's failure condition 2, stated as arithmetic: "if the optimal play is
    // to fire everyone and code alone, the satire has eaten the game."
    //
    // Measured against `bestOutput` — the swarm at its §4.1 optimum, which is
    // about 0.61 x D_cap — rather than against a headcount somebody chose.
    expect(maxed.rate).toBeLessThan(bestOutput(D_BASE))
  })

  it('loses to the studio at every headcount above a handful', () => {
    // Not just at the optimum: the founder must lose across the whole reachable
    // band, including the over-hired half of the curve where output is falling.
    for (const devs of [10, 20, 40, 76, 100, 150]) {
      expect(passiveVelocity(devs, D_BASE)).toBeGreaterThan(maxed.rate)
    }
  })

  it('falls further behind with every prestige, because it does not scale', () => {
    // The gap has to *widen*, or a late-game player eventually finds that
    // sacking the company is correct. The swarm scales with D_cap; this scales
    // with nothing.
    const ratios = [0, 1, 2].map((compression) => {
      const cap = devCapFor({ 'L1-1B': compression })
      return bestOutput(cap) / maxed.rate
    })
    expect(ratios[1]).toBeGreaterThan(ratios[0])
    expect(ratios[2]).toBeGreaterThan(ratios[1])
  })

  it('is still worth having, which is the other half of the constraint', () => {
    // §4.5d: "late game, your own hands are a small but *reliable* contribution
    // in a studio where nothing else is reliable." A curve tuned so low it never
    // matters would fail the section just as surely as one that wins.
    //
    // The measure is a collapsed studio, because that is where it is supposed to
    // show: a thousand developers on a cap of a hundred produce almost nothing.
    const seized = passiveVelocity(1_000, D_BASE)
    expect(maxed.rate).toBeGreaterThan(seized)
    expect(founderEffects({}).rate).toBeGreaterThan(seized)
  })

  it('is a rounding error in a healthy studio, and that is correct too', () => {
    const healthy = passiveVelocity(optimalHeadcount(D_BASE), D_BASE)
    expect(maxed.rate / healthy).toBeLessThan(0.15)
  })
})

/**
 * §4.14 — the two nodes that buy a *rating* rather than a rate.
 *
 * They exist because the rating grew a term about the founder, and a rating
 * input with no purchasable lever behind it is a number the player reads as
 * noise. Both reach §4.14 through a mechanism the game already has rather than
 * by adding points to a score: Taste bends §4.12's arrival rate, and Friends At
 * The Press compresses §4.14's roll.
 */
describe('§4.14, §13.7.1 — Taste and Friends At The Press', () => {
  it('does neither before either is bought', () => {
    expect(founderEffects({}).defectScale).toBe(1)
    expect(founderEffects({}).luckFloor).toBe(0)
  })

  it('takes MANAGEMENT_DILUTION of what §22.8 Quality does, per level', () => {
    // §13.7.1's whole shape: available earlier, meaningfully weaker. Mo's branch
    // multiplies defects by 0.85 a node; yours keeps two fifths of that.
    const one = founderEffects({ 'M-TASTE': 1 }).defectScale
    expect(1 - one).toBeCloseTo((1 - 0.85) * MANAGEMENT_DILUTION, 12)
    expect(one).toBeLessThan(1)
    expect(one).toBeGreaterThan(0.85)
  })

  it('compounds per level and stops at the node’s own ceiling', () => {
    const three = founderEffects({ 'M-TASTE': 3 }).defectScale
    expect(three).toBeCloseTo(founderEffects({ 'M-TASTE': 1 }).defectScale ** 3, 12)
    expect(founderEffects({ 'M-TASTE': 99 }).defectScale).toBe(three)
  })

  it('never drives defects to zero, so §4.12 stays a pressure', () => {
    expect(founderEffects({ 'M-TASTE': 3 }).defectScale).toBeGreaterThan(0.7)
  })

  it('floors reception without raising its ceiling', () => {
    // A node that made good games score better would multiply success. This one
    // stops the flop, which is what knowing a journalist actually buys.
    const floor = founderEffects({ 'M-PRESS': 1 }).luckFloor
    expect(floor).toBeGreaterThan(0)
    expect(floor).toBeLessThan(0.5)
    // The transform the store applies: floor + (1 − floor)·roll.
    expect(floor + (1 - floor) * 1).toBeCloseTo(1, 12)
    expect(floor + (1 - floor) * 0).toBeCloseTo(floor, 12)
  })
})

/**
 * §4.14's trait term, founder half. Per node rather than per level — see
 * `founderMastery` for why You Know A Guy must not be four fifths of a founder.
 */
describe('§4.14 — how developed the manager is', () => {
  it('is nothing in a garage', () => {
    expect(founderMastery({})).toBe(0)
    expect(founderMastery(undefined)).toBe(0)
  })

  it('is everything with the whole tree bought', () => {
    expect(founderMastery(maxedFounderLevels())).toBeCloseTo(1, 12)
  })

  it('weights every node the same, however many levels it has', () => {
    // M-CLOUD has twelve levels and M-REL has one. One node maxed is one node's
    // worth of a manager either way, because the claim §13.7.1 makes is about
    // breadth and a recruiting discount has nothing to do with quality.
    const cloud = founderMastery({ 'M-CLOUD': FOUNDER_BY_ID.get('M-CLOUD')!.maxLevel })
    const rel = founderMastery({ 'M-REL': 1 })
    expect(cloud).toBeCloseTo(rel, 12)
    expect(cloud).toBeCloseTo(1 / FOUNDER_TREE.length, 12)
  })

  it('never exceeds one, whatever a corrupt level says', () => {
    expect(founderMastery({ 'M-ENG': 1e9 })).toBeLessThanOrEqual(1)
  })
})
