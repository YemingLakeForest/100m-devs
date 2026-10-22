/**
 * §11.7 and §21.7.9 — the CTO, through the run [2026-10-21].
 *
 * `sim/duck.test.ts` owns the levers and `storyTriggers` the predicate; this is
 * the join. The scene is raised by the store's own sweep the first time a game
 * is on sale with known bugs on it; his tree is shut until it has played; the
 * org change hands him a lanyard; a node bought hands him the thing on its
 * icon and he puts it on; and his levers reach the simulation's bug rate.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  buyDuckItem,
  buyTreeNode,
  dismissScene,
  duckItemPriceOf,
  duckItemRefusalOf,
  duckOf,
  duckOutfit,
  duckWardrobe,
  getState,
  isDuckPromoted,
  tick,
  treeRefusalOf,
  wearDuckItem,
} from './store.ts'
import { emptyPermanent, getPermanent, setPermanent } from './save.ts'
import {
  SCENE_DUCK_PROMOTED,
  SCENE_FIRST_HIRE,
  SCENE_FOUNDER_BOARD,
  SCENE_JAMES_PROMOTED,
} from './scenes.ts'
import { DUCK_AFTER_SHIPS, duckPromoted } from './storyTriggers.ts'
import { rollShape, type Release } from '../sim/revenue.ts'

function run2(milestones: string[] = []) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      // The Run 2 beats that would otherwise take the frame first.
      milestones: ['scene.act1.james-arrives', SCENE_FIRST_HIRE.id, SCENE_FOUNDER_BOARD.id, SCENE_JAMES_PROMOTED.id, ...milestones],
    },
  })
}

function release(id: number, defectDensity: number): Release {
  return { id, ordinal: id, name: `Game ${id}`, payout: 1000, age: 0, paid: 0, shape: rollShape(1, id), defectDensity, rating: 50 }
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§21.7.9 — the predicate', () => {
  const base = { paradigmShifts: 1, shipped: DUCK_AFTER_SHIPS, buggyReleases: 1 }

  it('fires on the first game on sale with known bugs on it', () => {
    expect(duckPromoted(base)).toBe(true)
  })

  it('never fires in Run 1, and not in the opening of Run 2', () => {
    expect(duckPromoted({ ...base, paradigmShifts: 0 })).toBe(false)
    expect(duckPromoted({ ...base, shipped: DUCK_AFTER_SHIPS - 1 })).toBe(false)
  })

  it('does not fire for a studio whose every release left the ring clean', () => {
    expect(duckPromoted({ ...base, buggyReleases: 0 })).toBe(false)
  })
})

describe('§21.7.9 — the org change, in the store', () => {
  it('keeps his tree shut until the scene, raises it on a buggy release, and hands over a lanyard', () => {
    run2()
    __setState({ devs: 10, cash: 1e6, projectsShipped: DUCK_AFTER_SHIPS, releases: [release(1, 0)] })
    expect(treeRefusalOf('duck', 'q1')).toBe('absent')
    tick(0.1)
    expect(getState().scene).toBeNull()

    __setState({ releases: [release(1, 0), release(2, 0.02)] })
    tick(0.1)
    expect(getState().scene).toBe(SCENE_DUCK_PROMOTED.id)
    dismissScene()

    expect(isDuckPromoted()).toBe(true)
    expect(duckWardrobe().has('lanyard')).toBe(true)
    expect(duckOutfit()).toEqual({ neck: 'lanyard' })
    expect(treeRefusalOf('duck', 'q1')).toBeNull()
  })

  it('makes every game he is CTO for less buggy: the simulation writes bugs slower', () => {
    run2()
    __setState({ devs: 40, cash: 1e6, defects: 0 })
    tick(1)
    const without = getState().defects
    __resetStore()
    run2([SCENE_DUCK_PROMOTED.id])
    __setState({ devs: 40, cash: 1e6, defects: 0 })
    expect(duckOf().defectScale).toBeLessThan(1)
    tick(1)
    expect(getState().defects).toBeGreaterThan(0)
    expect(getState().defects).toBeLessThan(without)
  })
})

describe('§11.7 — what you buy him, he wears', () => {
  it('hands over the item on the node’s icon the first time, puts it on, and lets the player take it off', () => {
    run2([SCENE_DUCK_PROMOTED.id])
    __setState({ devs: 10, cash: 1e9 })
    expect(buyTreeNode('duck', 'q1')).toBe(true)
    expect(buyTreeNode('duck', 'q2')).toBe(true)
    expect(duckWardrobe().has('readers')).toBe(true)
    expect(duckOutfit().face).toBe('readers')

    expect(wearDuckItem('readers')).toBe(true)
    expect(duckOutfit().face).toBeUndefined()
    // Not owned: nothing to put on.
    expect(wearDuckItem('crown')).toBe(false)
  })

  it('sells the rail only to a CTO, for cash, once in a career, and puts the purchase on', () => {
    run2()
    __setState({ devs: 10, cash: 1e12 })
    expect(duckItemRefusalOf('beanie')).toBe('absent')
    expect(buyDuckItem('beanie')).toBe(false)

    run2([SCENE_DUCK_PROMOTED.id])
    const price = duckItemPriceOf('beanie')!
    expect(duckItemRefusalOf('beanie')).toBeNull()
    expect(buyDuckItem('beanie')).toBe(true)
    expect(getState().cash).toBe(1e12 - price)
    expect(duckWardrobe().has('beanie')).toBe(true)
    expect(duckOutfit().head).toBe('beanie')
    // Bought once: the second time there is nothing to sell.
    expect(duckItemRefusalOf('beanie')).toBe('owned')
    expect(buyDuckItem('beanie')).toBe(false)
    // An earned item is not for sale at any price.
    expect(duckItemRefusalOf('crown')).toBe('earned')
  })

  it('will not sell what the run cannot pay for, nor an era the studio has not reached', () => {
    run2([SCENE_DUCK_PROMOTED.id])
    __setState({ devs: 10, cash: 0 })
    expect(duckItemRefusalOf('beanie')).toBe('short')
    __setState({ devs: 10, peakDevs: 10, cash: 1e15 })
    expect(duckItemRefusalOf('vr')).toBe('era')
  })

  it('keeps the wardrobe across runs: the items are permanent milestones', () => {
    run2([SCENE_DUCK_PROMOTED.id])
    __setState({ devs: 10, cash: 1e9 })
    buyTreeNode('duck', 'q1')
    const milestones = getPermanent().meta.milestones
    __resetStore()
    setPermanent({ ...emptyPermanent(), meta: { ...emptyPermanent().meta, paradigmShifts: 2, milestones } })
    expect(duckWardrobe().has('bowtie')).toBe(true)
  })
})
