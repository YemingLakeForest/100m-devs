/**
 * Hero Cards — GDD §13.6.
 *
 * §13.6 is a design with exactly one idea in it — **a card is only effective at
 * the tier it has been upgraded to reach** — and a pile of consequences. These
 * tests are ordered that way: the ladder, then the coverage rule, then the
 * trade §13.6.4 builds on top of it, then the four things §13.6.7 says the
 * system must never become.
 */

import { describe, expect, it } from 'vitest'
import type { HeroState } from './heroes.ts'
import {
  CARD_BY_ID,
  DEPTH_STEP,
  DILUTION,
  HERO_CARDS,
  MAX_DEPTH,
  MAX_REACH,
  NO_EFFECT,
  REACH_LADDER,
  ROW_DEVS,
  WIRED_TRAITS,
  buyDepth,
  buyReach,
  canAcquire,
  coverage,
  depthCost,
  depthPower,
  fragmentRate,
  globalDepthMultiplier,
  newHero,
  reachCost,
  reachDevs,
  reachMaxed,
  strengthOf,
  studioEffect,
  upgradePrompt,
} from './heroes.ts'

const board = (state: ReturnType<typeof newHero>, devsAtSlot: number) => [{ state, devsAtSlot }]

describe('the reach ladder — §13.6.1', () => {
  it('starts at a row and ends at a galaxy', () => {
    expect(REACH_LADDER[0].name).toBe('row')
    expect(REACH_LADDER[0].devs).toBe(ROW_DEVS)
    expect(REACH_LADDER[MAX_REACH].name).toBe('galaxy')
  })

  it('follows §7.7.1 rather than restating it', () => {
    // The one thing that must stay true about this table: it is derived. A
    // second hand-written copy of the Construction Ladder is a second thing
    // that can disagree with the first, and §7.7.5 already has a scar from
    // exactly that — a scale bar reading "1 FLOOR = 1 DEVS".
    expect(REACH_LADDER.map((t) => t.name)).toEqual([
      'row',
      'floor',
      'building',
      'campus',
      'site',
      'world',
      'planet',
      'galaxy',
    ])
    // §7.8.0 — a floor is a hundred people now, so FLOOR reach covers a
    // hundred. The tier names did not move; the number one of them stands for
    // did, and that is exactly what deriving the ladder is for. Note also that
    // there is one `floor` tier and not two: the ladder is one entry per size
    // of thing, and the tower now spends two rungs on the same size.
    expect(reachDevs(1)).toBe(100)
    expect(reachDevs(2)).toBe(1e4)
  })

  it('climbs, and clamps at both ends', () => {
    for (let i = 1; i <= MAX_REACH; i++) {
      expect(REACH_LADDER[i].devs).toBeGreaterThan(REACH_LADDER[i - 1].devs)
    }
    expect(reachDevs(-5)).toBe(ROW_DEVS)
    expect(reachDevs(99)).toBe(REACH_LADDER[MAX_REACH].devs)
  })
})

describe('THE rule — a card only works at the tier it can reach (§13.6.2)', () => {
  it('does not scale a Scrum Master up to fill a building', () => {
    // §13.6.2's worked example, and the whole system in one assertion. Slotting
    // is free; *working* up there is not.
    const sm = newHero('scrum-master')
    const cov = coverage(sm, 4_000)
    expect(cov.covered).toBe(ROW_DEVS)
    expect(cov.fraction).toBeCloseTo(8 / 4000, 6)
    expect(cov.complete).toBe(false)
  })

  it('says so on the card, with the price of the fix', () => {
    // "Coverage is drawn, not stated" (§13.6.6), but the *nag* is stated, and
    // it teaches the reach rule, the ladder and the next cost in one line with
    // no tutorial anywhere.
    const sm = newHero('scrum-master')
    expect(coverage(sm, 4_000).line).toBe('covering 8 of 4.0 K (0.2%)')
    // Four GP rather than seven, and the drop is §7.8.0 rather than a nerf:
    // §13.6.5 prices a step by the *decades* it spans, and row-to-floor is now
    // 8 → 100 where it used to be 8 → 1,000. A shorter climb costs less.
    expect(upgradePrompt(sm, 4_000)).toBe('Upgrade REACH to FLOOR — 4 GP')
  })

  it('stops nagging once the card covers what it stands on', () => {
    const sm = newHero('scrum-master')
    expect(upgradePrompt(sm, 6)).toBeNull()
    expect(coverage(sm, 6).complete).toBe(true)
    // And never over-reports: eight developers of reach on a row of six is six.
    expect(coverage(sm, 6).covered).toBe(6)
  })

  it('scales every effect by coverage, so reach is worth what you point it at', () => {
    // §13.6.2's answer to the idle genre's flat-multiplier problem: a flat
    // multiplier is worthless two prestiges later; a *reach* upgrade is worth
    // exactly as much as the studio under it.
    const narrow = studioEffect(board(newHero('floor-master'), 1e6))
    const wide = studioEffect(board({ ...newHero('floor-master'), reach: 4 }, 1e6))
    expect(narrow.yield).toBeLessThan(wide.yield)
    expect(narrow.yield).toBeCloseTo(1, 3)
  })

  it('exempts The Compiler, which is the one card that ignores reach', () => {
    // §13.6.3 — "Ignores reach; effect is global and small". It pays for the
    // exemption by being an order of magnitude weaker than anything else.
    const compiler = newHero('the-compiler')
    expect(coverage(compiler, 1e12).complete).toBe(true)
    expect(CARD_BY_ID.get('the-compiler')!.base).toBeLessThan(
      CARD_BY_ID.get('floor-master')!.base / 3,
    )
  })
})

describe('reach costs more the further up it goes — §13.6.5', () => {
  it('rises at every single step', () => {
    // The trap in §13.6.5's formula. The log term alone is NOT monotonic: row →
    // floor crosses 2.1 decades and floor → building crosses 1, so a naive
    // reading prices the second step *below* the first. γ has to beat a decade
    // of gap on its own.
    for (let r = 1; r < MAX_REACH; r++) {
      expect(reachCost(r)).toBeGreaterThan(reachCost(r - 1))
    }
  })

  it('keeps the first rungs inside a first fork, and the last ones nowhere near', () => {
    // §14.3 pays 10 GP for the first Codebase Fork. Taking a Scrum Master off
    // its row and onto a floor has to be reachable then; taking anything to a
    // galaxy has to be a lifetime project, or the ladder has no top.
    expect(reachCost(0)).toBeLessThanOrEqual(10)
    expect(reachCost(MAX_REACH - 1)).toBeGreaterThan(1_000)
  })

  it('makes REACH the most expensive node available, at every tier', () => {
    // §13.6.4 states this as a fact about the tree. On two independent cost
    // curves it is a hope: depth compounds at κ and overtakes reach somewhere in
    // the middle of the ladder, which is exactly where nobody would look for it.
    // Pricing depth as a share of reach makes the sentence an invariant.
    for (let r = 0; r <= MAX_REACH; r++) {
      for (let l = 0; l < MAX_DEPTH; l++) {
        expect(depthCost(l, r)).toBeLessThan(reachCost(r))
      }
    }
  })

  it('has a top, and says so instead of selling a rung that does not exist', () => {
    expect(reachMaxed(MAX_REACH)).toBe(true)
    expect(upgradePrompt({ ...newHero('scrum-master'), reach: MAX_REACH }, 1e30)).toBeNull()
    const top = buyReach({ ...newHero('scrum-master'), reach: MAX_REACH })
    expect(top.reach).toBe(MAX_REACH)
  })
})

describe('a hero broadened is a hero diluted — §13.6.4', () => {
  it('keeps depth bought at a low reach, and makes it worth less', () => {
    // The sentence this whole state shape exists to implement: "Depth bought at
    // a low reach is not refunded when reach increases." Not refunded, not
    // deleted — *thinner*, which is what broadening a hero means.
    const deep = buyDepth(buyDepth(newHero('scrum-master')))
    const broadened = buyReach(deep)
    expect(broadened.depth).toHaveLength(2)
    expect(depthPower(broadened)).toBeCloseTo(2 * DEPTH_STEP * DILUTION, 9)
    expect(depthPower(broadened)).toBeLessThan(depthPower(deep))
  })

  it('punishes the player who deepened FIRST and broadened after', () => {
    // §13.6.4's "the player who rushed reach on a card they had already deepened
    // will feel it" — and the mirror of it, which is the part that makes this a
    // decision rather than a trap: the same GP spent in the other order is worth
    // strictly more.
    const deepenedThenBroadened = buyReach(buyDepth(buyDepth(newHero('scrum-master'))))
    const broadenedThenDeepened = buyDepth(buyDepth(buyReach(newHero('scrum-master'))))
    expect(deepenedThenBroadened.reach).toBe(broadenedThenDeepened.reach)
    expect(deepenedThenBroadened.depth).toHaveLength(broadenedThenDeepened.depth.length)
    expect(depthPower(deepenedThenBroadened)).toBeLessThan(depthPower(broadenedThenDeepened))
  })

  it('caps the tree at a handful of nodes — §13.6.4 says never a wall', () => {
    let h = newHero('scrum-master')
    for (let i = 0; i < 10; i++) h = buyDepth(h)
    expect(h.depth).toHaveLength(MAX_DEPTH)
    for (const card of HERO_CARDS) {
      expect(card.traits.length).toBeLessThanOrEqual(2)
    }
  })

  it('lets Retrospective Amnesia buy the dilution off, and charges for it', () => {
    const deep = buyReach(buyReach(buyDepth(buyDepth(newHero('scrum-master')))))
    const amnesiac = { ...deep, traits: ['retro-amnesia'] }
    expect(depthPower(amnesiac)).toBeCloseTo(2 * DEPTH_STEP, 9)
    expect(depthPower(amnesiac)).toBeGreaterThan(depthPower(deep))
    // "Trait nodes are fixed and expensive" — §13.6.5.
    const trait = CARD_BY_ID.get('scrum-master')!.traits.find((t) => t.id === 'retro-amnesia')!
    expect(trait.cost).toBeGreaterThan(depthCost(MAX_DEPTH - 1, 0) * 5)
  })

  it('only claims the traits it actually honours', () => {
    // The §13.2 lesson, applied before it can be learned twice: a card listing
    // six traits of which four do nothing is worse than a card listing two, so
    // every unwired trait says "not yet wired" on its own note.
    for (const card of HERO_CARDS) {
      for (const trait of card.traits) {
        expect(WIRED_TRAITS.has(trait.id)).toBe(!trait.note.includes('not yet wired'))
      }
    }
  })
})

describe('the cards behave like their descriptions — §13.6.3', () => {
  it('makes a card strongest at the rung it is about', () => {
    const home = newHero('architect')
    expect(home.reach).toBe(CARD_BY_ID.get('architect')!.home)
    const moved = buyReach(home)
    expect(strengthOf(moved)).toBeLessThan(strengthOf(home))
  })

  it('gives the VP of Engineering nothing of their own', () => {
    // §13.6.3 — "Multiplies other heroes' effects in reach; alone, does
    // nothing." A board of nothing but vice-presidents is a board that does
    // nothing at all, and that is the joke working as a rule.
    const vp = { state: { ...newHero('vp-engineering'), reach: 3 }, devsAtSlot: 1e5 }
    expect(studioEffect([vp])).toEqual(NO_EFFECT)
    expect(studioEffect([vp, vp])).toEqual(NO_EFFECT)
  })

  it('makes the VP worth having the moment there is somebody to amplify', () => {
    const fm = { state: { ...newHero('floor-master'), reach: 3 }, devsAtSlot: 1e5 }
    const vp = { state: { ...newHero('vp-engineering'), reach: 3 }, devsAtSlot: 1e5 }
    expect(studioEffect([fm, vp]).yield).toBeGreaterThan(studioEffect([fm]).yield)
  })

  it('makes the Chief Vision Officer not obviously good', () => {
    // §13.6.3's own words. Both halves scale together, so the card is a bet on
    // whether the studio's entropy defences can take it — and a test that only
    // checked the yield would let somebody quietly delete the downside.
    const cvo = { state: { ...newHero('chief-vision-officer'), reach: 5 }, devsAtSlot: 1e8 }
    const effect = studioEffect([cvo])
    expect(effect.yield).toBeGreaterThan(1)
    expect(effect.entropy).toBeGreaterThan(1)
  })

  it('never lets a Scrum Master drive entropy to nothing', () => {
    let sm: HeroState = { ...newHero('scrum-master'), traits: ['retro-amnesia'] }
    for (let i = 0; i < MAX_DEPTH; i++) sm = buyDepth(sm)
    const effect = studioEffect(board(sm, ROW_DEVS), 1e9)
    expect(effect.entropy).toBeGreaterThan(0)
    expect(effect.entropy).toBeLessThan(1)
  })

  it('keeps James small, at every rung, for ever', () => {
    // §13.6.3 — "he is the first card the player ever gets, he can be slotted
    // anywhere, and he never becomes strong. Players will keep him placed
    // anyway." Every mechanism that would fix that has to skip him, or the joke
    // stops being true — so this asserts against all three of them at once.
    let james = newHero('james')
    for (let i = 0; i < MAX_DEPTH; i++) james = buyDepth(james)
    for (let i = 0; i < MAX_REACH; i++) james = buyReach(james)
    const base = CARD_BY_ID.get('james')!.base
    expect(strengthOf(james, 1e12)).toBe(base)
    expect(strengthOf(newHero('james'))).toBe(base)
  })

  it('costs nothing to own James, because he was never bought', () => {
    expect(CARD_BY_ID.get('james')!.acquireCost).toBe(0)
    expect(canAcquire('james', 0, new Set())).toBe(true)
  })

  it('turns Whiteboard Debt into an actual debt', () => {
    const plain = { state: { ...newHero('architect'), reach: 2 }, devsAtSlot: 1e4 }
    const indebted = { state: { ...plain.state, traits: ['whiteboard-debt'] }, devsAtSlot: 1e4 }
    expect(studioEffect([indebted]).cap).toBeGreaterThan(studioEffect([plain]).cap)
    expect(studioEffect([indebted]).entropy).toBeGreaterThan(studioEffect([plain]).entropy)
  })
})

describe('§13.6.7 — what it must never be', () => {
  it('is not numerically mandatory: an empty board changes nothing', () => {
    // "A player who never slots a card must still be able to finish a run.
    // Heroes are amplitude, not gate." Every field has to be the identity, not
    // just the ones somebody remembered.
    expect(studioEffect([])).toEqual(NO_EFFECT)
    expect(NO_EFFECT).toEqual({ entropy: 1, yield: 1, cap: 1, cashFromEntropy: 0, pokeSpread: 0 })
  })

  it('is not a gacha: acquisition is a price, never a roll', () => {
    // The most tempting place in the game to break MONETISATION's no-loot-box
    // position. Nothing in this module takes a random source; a card is bought
    // or it is not, and the same call twice gives the same answer.
    const owned = new Set<string>()
    expect(canAcquire('architect', 19, owned)).toBe(false)
    expect(canAcquire('architect', 20, owned)).toBe(true)
    expect(canAcquire('architect', 20, owned)).toBe(true)
    expect(canAcquire('architect', 1e9, new Set(['architect']))).toBe(false)
  })

  it('keeps §14.4 alive as a drop RATE, which is what §13.6.8 promised', () => {
    // "The equations survive; what they multiply changes." $P_{class}$ now
    // governs card fragment drops rather than which developer in the swarm is
    // secretly special, and it is still bounded by its own soft cap.
    expect(fragmentRate(0, 0.05)).toBe(0)
    expect(fragmentRate(4, 0.05)).toBeGreaterThan(fragmentRate(2, 0.05))
    expect(fragmentRate(1e6, 0.05)).toBeLessThanOrEqual(0.05)
  })

  it('keeps M_hero alive as the global depth multiplier', () => {
    expect(globalDepthMultiplier(0)).toBe(1)
    expect(globalDepthMultiplier(9)).toBeCloseTo(1.5, 9)
    expect(globalDepthMultiplier(1e6)).toBeGreaterThan(globalDepthMultiplier(1e3))
  })
})

describe('the deck itself', () => {
  it('is the nine cards §13.6.3 names, each with one job', () => {
    expect(HERO_CARDS).toHaveLength(9)
    expect(new Set(HERO_CARDS.map((c) => c.kind)).size).toBe(9)
    expect(new Set(HERO_CARDS.map((c) => c.id)).size).toBe(9)
  })

  it('sits every card on a real rung, or on none at all', () => {
    for (const card of HERO_CARDS) {
      if (card.home === null) {
        // Only James, who is slotted anywhere and is the same everywhere.
        expect(card.id).toBe('james')
        continue
      }
      expect(card.home).toBeGreaterThanOrEqual(0)
      expect(card.home).toBeLessThanOrEqual(MAX_REACH)
    }
  })

  it('prices a card by how far up the ladder it lives', () => {
    // Home rung is the card's whole identity, so it should also be its price:
    // a Scrum Master is the first thing anybody buys and The Compiler is not.
    const sorted = [...HERO_CARDS].filter((c) => c.home !== null).sort((a, b) => a.home! - b.home!)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].acquireCost).toBeGreaterThanOrEqual(sorted[i - 1].acquireCost)
    }
  })
})
