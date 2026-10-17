import { describe, expect, it } from 'vitest'
import { NO_FOUNDER } from './founder.ts'
import { NO_HERO_FOLD } from './heroRoster.ts'
import { TREES, TREE_HEROES, isBuilt, syncCapMultiplier, treeKey } from './upgradeTrees.ts'
import {
  FAQ_TICKET_RATE,
  HEADSET_ONCALL_HEADS,
  INBOX_SUPPORT_STEP,
  INSPECTOR_START_WORK,
  JAMES_POKE_CAP,
  MACROS_TICKET_RATE,
  NO_JAMES_TREE,
  SECOND_MONITOR_RATE,
  founderCapFromTree,
  founderFromTree,
  jamesFromTree,
  jamesPokeShare,
  withBillyTree,
  withMattTree,
  withSerenaTree,
  itWasDegraded,
  callCentreHeads,
  CALL_CENTRE_GROWTH,
  RUNBOOK_START_WORK,
} from './treeLevers.ts'

/**
 * The founder's tree and Matt's do something [2026-10-04] — found by playing:
 * once the board stopped selling nodes that change nothing, both were empty.
 * Claims about shape; the numbers are first passes.
 */
const bought = (hero: 'you' | 'matt', ids: Record<string, number>) =>
  Object.fromEntries(Object.entries(ids).map(([id, n]) => [treeKey(hero, id), n]))

describe('the founder’s tree', () => {
  it('is NO_FOUNDER for a save that has bought nothing', () => {
    expect(founderFromTree({})).toBe(NO_FOUNDER)
    expect(founderFromTree(undefined)).toBe(NO_FOUNDER)
  })

  it('Second Monitor makes your own desk write more, and nothing else', () => {
    const f = founderFromTree(bought('you', { y1: 1 }))
    expect(f.rate).toBeCloseTo(NO_FOUNDER.rate * SECOND_MONITOR_RATE, 12)
    expect(f.tapValue).toBeGreaterThan(NO_FOUNDER.tapValue)
    expect(f.hireGrowth).toBe(NO_FOUNDER.hireGrowth)
  })

  it('the Hiring Dial lowers the price step with every level and never to nothing', () => {
    let last = NO_FOUNDER.hireGrowth
    for (let level = 1; level <= 5; level++) {
      const g = founderFromTree(bought('you', { h2: level })).hireGrowth
      expect(g).toBeLessThan(last)
      expect(g).toBeGreaterThan(1)
      last = g
    }
  })

  it('a poke over the shoulder interrupts less', () => {
    expect(founderFromTree(bought('you', { p1: 1 })).contextSwitchScale).toBeLessThan(1)
  })

  // [2026-10-16, plan phase 6.3] The founder batch.
  it('Walk the Floor reaches a row past your own desk', () => {
    expect(founderFromTree(bought('you', { p2: 1 })).reachRows).toBeGreaterThan(0)
  })

  it('Take a Holiday keeps the studio working while you are away, and nothing else', () => {
    const f = founderFromTree(bought('you', { p6: 1 }))
    expect(f.worksOffline).toBe(true)
    expect(f.rate).toBe(NO_FOUNDER.rate)
  })

  it('Moving Day raises the cap, and only once it is bought', () => {
    expect(founderCapFromTree({})).toBe(1)
    expect(founderCapFromTree(undefined)).toBe(1)
    expect(founderCapFromTree(bought('you', { m2: 1 }))).toBeGreaterThan(1)
  })
})

describe('Matt’s tree', () => {
  it('leaves the fold alone for a save that has bought nothing of his', () => {
    expect(withMattTree(NO_HERO_FOLD, {}, 100)).toBe(NO_HERO_FOLD)
  })

  /**
   * [2026-10-16] Nothing of Matt's is a share of the headcount — the plan's
   * ruling, because a share grows with the problem it answers.
   */
  it('grows the help desk the same at twenty heads as at twenty thousand', () => {
    const base = { ...NO_HERO_FOLD, supportHeads: 8 }
    const all = bought('matt', { t1: 3, t2: 5, t3: 4 })
    expect(withMattTree(base, all, 20).supportHeads).toBe(withMattTree(base, all, 20_000).supportHeads)
  })

  it('builds every Call Centre Floor bigger than the last, by the step its price climbs', () => {
    let last = 0
    let lastFloor = 0
    for (let floors = 1; floors <= 12; floors++) {
      const heads = callCentreHeads(floors)
      const floor = heads - last
      expect(floor).toBeGreaterThan(lastFloor)
      if (lastFloor > 0) expect(floor / lastFloor).toBeCloseTo(CALL_CENTRE_GROWTH, 9)
      last = heads
      lastFloor = floor
    }
    expect(callCentreHeads(0)).toBe(0)
  })
})

describe('Serena’s reliability half [2026-10-16]', () => {
  it('Wrote the Runbook halves a new incident, and nothing else', () => {
    const base = { ...NO_HERO_FOLD, incidentStartWork: 0.5 }
    expect(withSerenaTree(base, {})).toBe(base)
    expect(withSerenaTree(base, { [treeKey('serena', 'r1')]: 1 }).incidentStartWork).toBeCloseTo(0.5 * RUNBOOK_START_WORK, 12)
  })

  it('It Was Degraded is off until it is bought', () => {
    expect(itWasDegraded({})).toBe(false)
    expect(itWasDegraded({ [treeKey('serena', 'r5')]: 1 })).toBe(true)
  })
})

describe('Matt’s tree, levers', () => {

  it('each wired node moves its own lever the right way', () => {
    const base = { ...NO_HERO_FOLD, supportHeads: 5, ticketRate: 0.8, oncallHeads: 2, incidentStartWork: 0.5 }
    const at = (ids: Record<string, number>) => withMattTree(base, bought('matt', ids), 100)
    expect(at({ t1: 1 }).supportHeads).toBeCloseTo(5 * INBOX_SUPPORT_STEP, 12)
    expect(at({ t2: 2 }).supportHeads).toBeGreaterThan(5)
    expect(at({ h1: 1 }).ticketRate).toBeCloseTo(0.8 * MACROS_TICKET_RATE, 12)
    expect(at({ K: 1 }).ticketRate).toBeCloseTo(0.8 * FAQ_TICKET_RATE, 12)
    expect(at({ m1: 1 }).oncallHeads).toBe(2 + HEADSET_ONCALL_HEADS)
    expect(at({ i1: 1 }).incidentStartWork).toBeCloseTo(0.5 * INSPECTOR_START_WORK, 12)
  })

  it('never takes the ticket rate to zero, or the help desk below where it started', () => {
    const base = { ...NO_HERO_FOLD, supportHeads: 5, ticketRate: 0.8 }
    const all = withMattTree(base, bought('matt', { t1: 5, t2: 5, h1: 1, K: 1 }), 1000)
    expect(all.ticketRate).toBeGreaterThan(0)
    expect(all.supportHeads).toBeGreaterThan(base.supportHeads)
  })
})

/**
 * James is a share of the studio [2026-10-16, plan phase 6.2]. The claims: an
 * empty save is the base share and nothing else, every node moves its own field
 * the way its card says, the poke is scale-free, and sustained poking is capped
 * at one studio's worth (j5a raising that cap is the fork's point).
 */
describe('James’s tree', () => {
  const at = (ids: Record<string, number>) =>
    jamesFromTree(Object.fromEntries(Object.entries(ids).map(([id, n]) => [treeKey('james', id), n])))

  it('is the base share and nothing else for a save that has bought nothing of his', () => {
    expect(jamesFromTree({})).toBe(NO_JAMES_TREE)
    expect(jamesFromTree(undefined)).toBe(NO_JAMES_TREE)
    expect(NO_JAMES_TREE.lift).toBeGreaterThan(0)
    expect(NO_JAMES_TREE.lift).toBeLessThan(0.5)
  })

  it('each node moves its own field the way its card says', () => {
    let last = NO_JAMES_TREE.lift
    for (let l = 1; l <= 5; l++) {
      const lift = at({ j1: l }).lift
      expect(lift).toBeGreaterThan(last)
      last = lift
    }
    expect(at({ j2: 1 }).founderTapScale).toBeGreaterThan(1)
    expect(at({ j3: 1 }).callsBilly).toBe(true)
    expect(at({ j4: 1 }).commitmentScale).toBeLessThan(1)
    expect(at({ j5a: 1 }).pokeScale).toBeGreaterThan(1)
    expect(at({ j5b: 1 }).lift).toBeGreaterThan(NO_JAMES_TREE.lift)
    expect(at({ j6: 1 }).commitmentScale).toBeLessThan(at({ j4: 1 }).commitmentScale)
    expect(at({ j4: 1, j6: 1 }).commitmentScale).toBeLessThan(at({ j6: 1 }).commitmentScale)
  })

  it('a poke on him is the same share of the studio at any size', () => {
    const small = jamesPokeShare(40, 0, 2, NO_JAMES_TREE)
    const big = jamesPokeShare(4e7, 0, 2, NO_JAMES_TREE)
    expect(small).toBeGreaterThan(0)
    expect(big / 4e7).toBeCloseTo(small / 40, 12)
  })

  it('poking him as fast as a thumb can adds at most one studio, and the snippets folder raises both', () => {
    const v = 1000
    const tau = 2
    for (const fx of [NO_JAMES_TREE, at({ j5a: 1 })]) {
      // A thumb at twenty taps a second, for a minute: the same leaky average the store keeps.
      let rate = 0
      for (let i = 0; i < 1200; i++) {
        rate *= Math.exp(-0.05 / tau)
        rate += jamesPokeShare(v, rate, tau, fx) / tau
      }
      expect(rate).toBeLessThanOrEqual(JAMES_POKE_CAP * fx.pokeScale * v * (1 + 1e-9))
      expect(rate).toBeGreaterThan(0.9 * JAMES_POKE_CAP * fx.pokeScale * v)
    }
    expect(jamesPokeShare(v, 0, tau, at({ j5a: 1 }))).toBeGreaterThan(jamesPokeShare(v, 0, tau, NO_JAMES_TREE))
  })

  it('pays nothing scale-free for a studio that has stopped', () => {
    expect(jamesPokeShare(0, 0, 2, NO_JAMES_TREE)).toBe(0)
    expect(jamesPokeShare(Number.NaN, 0, 2, NO_JAMES_TREE)).toBe(0)
  })
})

/** Billy's meeting nodes [2026-10-16, plan phase 6.4]: more of the floor keeps typing, never all of it. */
describe('Billy’s tree', () => {
  const b = (ids: Record<string, number>) =>
    Object.fromEntries(Object.entries(ids).map(([id, n]) => [treeKey('billy', id), n]))

  it('leaves the fold alone for a save that has bought nothing of his', () => {
    expect(withBillyTree(NO_HERO_FOLD, {}, 100)).toBe(NO_HERO_FOLD)
  })

  it('Timebox, then Walking Meeting, keep more of the floor working through the stand-up', () => {
    const billy = { ...NO_HERO_FOLD, standupHeads: 50 }
    const timebox = withBillyTree(billy, b({ b1: 1 }), 100).standupHeads
    const both = withBillyTree(billy, b({ b1: 1, b2: 1 }), 100).standupHeads
    expect(timebox).toBeGreaterThan(50)
    expect(both).toBeGreaterThan(timebox)
    // The Meeting Ban stays the only thing that deletes the stand-up.
    expect(both).toBeLessThan(100)
  })
})

/**
 * Plan 2026-10-16 phase 6 — **every node the board sells moves some fold, and
 * an empty save moves none of them.** One table of folds, every reader of a
 * tree level the economy has; a lever wired somewhere else must be added here,
 * which is the point: a node whose effect nobody can find is a shop for nothing.
 * Serena's pipeline nodes (`wired`) are the pipeline's own claim and its tests'.
 */
describe('every built node moves some fold', () => {
  const fold = { ...NO_HERO_FOLD, supportHeads: 5, ticketRate: 0.8, oncallHeads: 2, incidentStartWork: 0.5, standupHeads: 50 }
  const FOLDS: readonly ((levels: Record<string, number> | undefined) => unknown)[] = [
    (l) => founderFromTree(l),
    (l) => founderCapFromTree(l),
    (l) => jamesFromTree(l),
    (l) => withBillyTree(fold, l, 100),
    (l) => withMattTree(fold, l, 100),
    (l) => withSerenaTree(fold, l),
    (l) => itWasDegraded(l),
    (l) => syncCapMultiplier(l),
  ]
  const readings = (levels: Record<string, number> | undefined) => FOLDS.map((f) => JSON.stringify(f(levels)))
  const empty = readings({})

  it('an empty save is the same studio as no save at all', () => {
    expect(readings(undefined)).toEqual(empty)
  })

  for (const hero of TREE_HEROES) {
    for (const n of TREES[hero]) {
      if (n.kind === 'root' || n.kind === 'link' || n.wired || !isBuilt(n)) continue
      it(`${hero}:${n.id} ${n.name}`, () => {
        expect(readings({ [treeKey(hero, n.id)]: 1 }), `${hero}:${n.id}`).not.toEqual(empty)
      })
    }
  }
})

describe('both trees are really built', () => {
  it('has something to buy on the founder’s and on Matt’s, and every wired node is marked built', () => {
    for (const hero of ['you', 'matt'] as const) {
      expect(TREES[hero].filter((n) => n.lever).length, hero).toBeGreaterThan(0)
      for (const n of TREES[hero].filter((n) => n.lever)) {
        expect(isBuilt(n), `${hero}:${n.id}`).toBe(true)
        expect(n.effect, `${hero}:${n.id}`).toBeTruthy()
      }
    }
  })
})
