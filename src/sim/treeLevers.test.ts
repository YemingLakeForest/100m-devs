import { describe, expect, it } from 'vitest'
import { NO_FOUNDER } from './founder.ts'
import { NO_HERO_FOLD } from './heroRoster.ts'
import { TREES, isBuilt, treeKey } from './upgradeTrees.ts'
import {
  FAQ_TICKET_RATE,
  HEADSET_ONCALL_HEADS,
  INBOX_SUPPORT_STEP,
  INSPECTOR_START_WORK,
  MACROS_TICKET_RATE,
  SECOND_MONITOR_RATE,
  founderFromTree,
  withMattTree,
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
})

describe('Matt’s tree', () => {
  it('leaves the fold alone for a save that has bought nothing of his', () => {
    expect(withMattTree(NO_HERO_FOLD, {}, 100)).toBe(NO_HERO_FOLD)
  })

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
