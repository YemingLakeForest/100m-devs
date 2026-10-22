/**
 * The CTO — GDD §11.7 [2026-10-21]. The claims, not the numbers (§25.3.2): a
 * duck nobody has promoted does nothing; every node moves its lever the way its
 * card says; no amount of buying drives a lever past its floor; and the
 * wardrobe is the tree's receipt — one item per node, earned once, worn by
 * choice, and never a stat.
 */

import { describe, expect, it } from 'vitest'
import {
  DUCK_CATCH_CAP,
  DUCK_DEFECT_FLOOR,
  DUCK_ITEMS,
  DUCK_SLOTS,
  NO_DUCK,
  SHOP_ITEMS,
  combinedCatch,
  duckFromTree,
  duckItemPrice,
  duckLook,
  itemForNode,
  ownedItems,
  shopEra,
  toggleItem,
  wardrobeKey,
  wornOutfit,
} from './duck.ts'
import { TREES, isBuilt, treeKey } from './upgradeTrees.ts'

const L = (ids: Record<string, number>) => Object.fromEntries(Object.entries(ids).map(([id, n]) => [treeKey('duck', id), n]))

describe('§11.7 — what the CTO does', () => {
  it('does nothing until he is promoted, whatever is bought', () => {
    expect(duckFromTree(L({ q1: 3, q2: 1, K: 1 }), false)).toBe(NO_DUCK)
  })

  it('is worth something on the day of the org change, before a node is bought', () => {
    expect(duckFromTree({}, true).defectScale).toBeLessThan(1)
  })

  it('writes fewer bugs with every level of Explain It Out Loud, the breakthrough and the desk ducks', () => {
    const base = duckFromTree({}, true).defectScale
    const one = duckFromTree(L({ q1: 1 }), true).defectScale
    const three = duckFromTree(L({ q1: 3 }), true).defectScale
    expect(one).toBeLessThan(base)
    expect(three).toBeLessThan(one)
    expect(duckFromTree(L({ K: 1 }), true).defectScale).toBeLessThan(base)
    expect(duckFromTree(L({ c1: 4 }), true).defectScale).toBeLessThan(duckFromTree(L({ c1: 1 }), true).defectScale)
  })

  it('never takes the written rate below its floor, however many desk ducks', () => {
    const all = duckFromTree(L({ q1: 3, K: 1, c1: 10_000 }), true)
    expect(all.defectScale).toBe(DUCK_DEFECT_FLOOR)
    expect(all.defectScale).toBeGreaterThan(0)
  })

  it('catches more with the glasses, more again with the monocle, and never more than the cap', () => {
    const readers = duckFromTree(L({ q2: 1 }), true).catches
    const both = duckFromTree(L({ q2: 1, q3b: 1 }), true).catches
    expect(readers).toBeGreaterThan(0)
    expect(both).toBeGreaterThan(readers)
    expect(both).toBeLessThanOrEqual(DUCK_CATCH_CAP)
  })

  it('moves the poke, the press, the refunds and the incidents only through their own nodes', () => {
    const base = duckFromTree({}, true)
    expect(duckFromTree(L({ q3a: 1 }), true).pokeDefectScale).toBeLessThan(base.pokeDefectScale)
    expect(duckFromTree(L({ p1: 1 }), true).luckFloor).toBeGreaterThan(base.luckFloor)
    expect(duckFromTree(L({ p2: 1 }), true).refundScale).toBeLessThan(base.refundScale)
    expect(duckFromTree(L({ b1: 1 }), true).incidentStartWork).toBeLessThan(base.incidentStartWork)
  })

  it('combines two independent catches as what gets past both', () => {
    expect(combinedCatch(0, 0)).toBe(0)
    expect(combinedCatch(0.5, 0.5)).toBeCloseTo(0.75)
    expect(combinedCatch(0.3, 0)).toBeCloseTo(0.3)
    expect(combinedCatch(Number.NaN, 0.2)).toBeCloseTo(0.2)
  })
})

describe('§11.7 — his tree', () => {
  it('sells nothing that does nothing: every node is built', () => {
    for (const n of TREES.duck) if (n.kind !== 'root') expect(isBuilt(n), n.id).toBe(true)
  })

  it('has one breakthrough and one pick-one fork', () => {
    expect(TREES.duck.filter((n) => n.kind === 'key')).toHaveLength(1)
    const forks = new Set(TREES.duck.map((n) => n.fork).filter(Boolean))
    expect(forks.size).toBe(1)
  })
})

describe('§11.7 — the wardrobe is the receipt', () => {
  it('hands over exactly one item for every node of his tree, and names only nodes that exist', () => {
    for (const n of TREES.duck) {
      if (n.kind === 'root') continue
      expect(itemForNode(n.id), n.id).toBeDefined()
    }
    for (const item of DUCK_ITEMS) {
      if ('node' in item.from) expect(TREES.duck.some((n) => n.id === (item.from as { node: string }).node), item.id).toBe(true)
    }
  })

  it('puts every item in a slot that exists, and gives every slot something', () => {
    for (const item of DUCK_ITEMS) expect(DUCK_SLOTS).toContain(item.slot)
    for (const slot of DUCK_SLOTS) expect(DUCK_ITEMS.some((i) => i.slot === slot), slot).toBe(true)
  })

  it('reads what the career owns off its milestones', () => {
    expect(ownedItems(['scene.act1.james-arrives', wardrobeKey('crown')])).toEqual(new Set(['crown']))
  })

  it('wears only what is owned, and only in its own slot', () => {
    const owned = new Set(['readers', 'crown'])
    expect(wornOutfit({ face: 'readers', head: 'tophat', neck: 'crown' }, owned)).toEqual({ face: 'readers' })
  })

  it('puts an item on in its slot, swaps the slot, and takes it off again', () => {
    const on = toggleItem({}, 'readers')
    expect(on).toEqual({ face: 'readers' })
    expect(toggleItem(on, 'shades')).toEqual({ face: 'shades' })
    expect(toggleItem(on, 'readers')).toEqual({})
  })

  it('draws no ducklings unless they are worn, and at least one when they are', () => {
    expect(duckLook(L({ c1: 3 }), true, {}).ducklings).toBe(0)
    expect(duckLook({}, true, { tub: 'ducklings' }).ducklings).toBe(1)
    expect(duckLook(L({ c1: 40 }), true, { tub: 'ducklings' }).ducklings).toBe(5)
  })

  it('is a duck in a corner and nothing else before the org change', () => {
    const look = duckLook(L({ q1: 3 }), false, { head: 'crown' })
    expect(look.promoted).toBe(false)
    expect(look.outfit).toEqual({})
    expect(look.printouts).toBe(0)
  })
})

describe('§11.7 [2026-10-22] — the rail: some of it is bought', () => {
  it('prices what is for sale and nothing that is earned', () => {
    for (const item of DUCK_ITEMS) expect(duckItemPrice(item) !== null).toBe(SHOP_ITEMS.includes(item))
  })

  it('has something for sale in every slot', () => {
    for (const slot of DUCK_SLOTS) expect(SHOP_ITEMS.some((i) => i.slot === slot)).toBe(true)
  })

  it('charges more for a later era, and never less than the trees would floor it at', () => {
    const byEra = [...SHOP_ITEMS].sort((a, b) => shopEra(a)! - shopEra(b)!)
    for (let i = 1; i < byEra.length; i++) {
      if (shopEra(byEra[i]) === shopEra(byEra[i - 1])) continue
      expect(duckItemPrice(byEra[i])!).toBeGreaterThan(duckItemPrice(byEra[i - 1])!)
    }
    const floor = 1e12
    for (const item of SHOP_ITEMS) expect(duckItemPrice(item, floor)!).toBeGreaterThanOrEqual(floor)
  })
})
