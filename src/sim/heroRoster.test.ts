/**
 * §13.6.2, §13.8, §13.9.1, §13.13 — the six, resolved.
 *
 * The three rules this file is the only place to enforce, each with a test that
 * fails if it stops being true: a hero is a starting position rather than a
 * role, coverage is a share rather than a switch, and every multiplier is 1 on
 * an empty roster.
 */

import { describe, expect, it } from 'vitest'
import {
  NO_HERO_FOLD,
  SETTLE_SECONDS,
  buyHeroNode,
  canBuyHeroNode,
  effectiveDepth,
  heroCoverage,
  heroFold,
  heroNodeState,
  heroRuntime,
  pointsSpent,
  type HeroRuntime,
} from './heroRoster.ts'
import { OFF_BRANCH, STORY_STARTING_DEPTH, TRUNK_NODE, startingNodes } from './heroTree.ts'
import { XP_BASE, xpToReach } from './heroXp.ts'
import type { HeroId } from './storyHeroes.ts'

/** A hero as they walk through the door: no XP banked, nothing bought, benched. */
function fresh(id: HeroId): HeroRuntime {
  return heroRuntime(id, 0, undefined, null)!
}

function at(id: HeroId, level: number, nodes?: string[]): HeroRuntime {
  return heroRuntime(id, xpToReach(level), nodes, null)!
}

describe('§13.9.1 — a story hire arrives already good at their job', () => {
  it('starts three deep in their own branch, at level 1, owing nothing', () => {
    const mo = fresh('mo')
    expect(mo.branch).toBe('quality')
    expect(mo.nodes).toEqual(startingNodes('quality'))
    expect(mo.progress.level).toBe(1)
    // §13.9.1's position is who she is, not something she paid for — charging
    // her would mean Mo arrives three points in debt.
    expect(mo.spent).toBe(0)
    expect(mo.points).toBe(1)
  })

  it('arrives at reach zero, so §13.8’s puzzle is not solved before it is seen', () => {
    for (const id of ['mo', 'serena', 'matt', 'melany', 'billy'] as HeroId[]) {
      expect(fresh(id).reach).toBe(0)
    }
    // A row, eight people — the smallest meaningful reach.
    expect(fresh('mo').reachDevs).toBe(8)
  })

  it('gives James the trunk and nothing else — §22.8', () => {
    expect(fresh('james').nodes).toEqual([TRUNK_NODE])
  })

  it('reads level and points straight off the XP, with nothing stored between', () => {
    const mo = at('mo', 6)
    expect(mo.progress.level).toBe(6)
    expect(mo.points).toBe(6)
    const spentTwo = at('mo', 6, [...startingNodes('quality'), 'quality:4'])
    // quality:4 is a REACH node and costs three.
    expect(spentTwo.spent).toBe(3)
    expect(spentTwo.points).toBe(3)
    expect(spentTwo.reach).toBe(1)
  })

  it('tolerates a save that knows nothing about any of this', () => {
    const mo = heroRuntime('mo', undefined, undefined, undefined)!
    expect(mo.progress.level).toBe(1)
    expect(mo.nodes).toEqual(startingNodes('quality'))
    // And an id that is not one of the six is not a hero.
    expect(heroRuntime('nobody' as HeroId, 10, [], null)).toBeNull()
  })

  it('ignores a node id that is not on the board', () => {
    const mo = heroRuntime('mo', 0, ['quality:1', 'not-a-node', ''], null)!
    expect(mo.nodes).not.toContain('not-a-node')
    expect(pointsSpent(mo.nodes, 'quality')).toBe(0)
  })
})

describe('§11.4.2’s reveal, on the hero board', () => {
  it('shows the next node live when it is affordable and dark when it is far', () => {
    const mo = at('mo', 4)
    expect(heroNodeState(mo, 'quality:1')).toBe('owned')
    expect(heroNodeState(mo, 'quality:4')).toBe('live')
    // Two steps past what she owns.
    expect(heroNodeState(mo, 'quality:5')).toBe('dark')
    expect(heroNodeState(mo, 'nowhere:9')).toBe('dark')
  })

  it('silhouettes the next node when the points are short', () => {
    // Level 1 is one point; quality:4 is a REACH node and costs three.
    const mo = fresh('mo')
    expect(heroNodeState(mo, 'quality:4')).toBe('silhouette')
    expect(canBuyHeroNode(mo, 'quality:4')).toBe(false)
    expect(buyHeroNode(mo, 'quality:4')).toBeNull()
  })

  it('opens on a legal one-point decision the instant a hero arrives', () => {
    // §13.9.1: "nothing stops Mo going down Cloud." The board must say so from
    // the first frame, and level 1 grants exactly the point Cloud:1 costs.
    const mo = fresh('mo')
    expect(mo.points).toBe(1)
    expect(heroNodeState(mo, 'cloud:1')).toBe('live')
    expect(buyHeroNode(mo, 'cloud:1')).toContain('cloud:1')
  })
})

describe('§13.9.1 — she will be worse at it than Melany', () => {
  it('counts an off-branch node at half, and never refuses it', () => {
    const moInCloud = at('mo', 9, [...startingNodes('quality'), 'cloud:1', 'cloud:2'])
    const melany = at('melany', 9, startingNodes('cloud'))
    // Mo has bought two Cloud depth nodes; Melany arrived with three.
    expect(effectiveDepth(moInCloud, 'cloud')).toBeCloseTo(2 * OFF_BRANCH, 9)
    expect(effectiveDepth(melany, 'cloud')).toBe(STORY_STARTING_DEPTH)
    expect(effectiveDepth(moInCloud, 'cloud')).toBeLessThan(effectiveDepth(melany, 'cloud'))
    // And she is still fully herself at home.
    expect(effectiveDepth(moInCloud, 'quality')).toBe(STORY_STARTING_DEPTH)
  })

  it('makes James half of everybody, everywhere — §13.6.3', () => {
    const james = at('james', 9, [TRUNK_NODE, 'quality:1', 'cloud:1'])
    expect(effectiveDepth(james, 'quality')).toBeCloseTo(0.5, 9)
    expect(effectiveDepth(james, 'cloud')).toBeCloseTo(0.5, 9)
    // Never better than a specialist at home.
    expect(effectiveDepth(james, 'quality')).toBeLessThan(effectiveDepth(fresh('mo'), 'quality'))
  })
})

describe('§13.6.2 — a hero is only effective at the reach they have bought', () => {
  const placed = (id: HeroId, nodes?: string[]): HeroRuntime =>
    heroRuntime(id, xpToReach(9), nodes, { rung: 3, index: 0, placedAt: 0 })!

  it('covers a row of a floor, and says what it does not cover', () => {
    const mo = placed('mo')
    const cov = heroCoverage(mo, 1000, 100)
    expect(cov.covered).toBe(8)
    expect(cov.fraction).toBeCloseTo(0.008, 9)
    expect(cov.complete).toBe(false)
  })

  it('never over-reports — a row of reach on a huddle of six is six', () => {
    expect(heroCoverage(placed('mo'), 6, 100).covered).toBe(6)
    expect(heroCoverage(placed('mo'), 6, 100).complete).toBe(true)
  })

  it('covers nothing at all while it is still walking — §13.8 rule 4', () => {
    const mo = placed('mo')
    const settling = heroCoverage(mo, 1000, SETTLE_SECONDS - 1)
    expect(settling.settling).toBe(true)
    expect(settling.covered).toBe(0)
    expect(heroCoverage(mo, 1000, SETTLE_SECONDS).settling).toBe(false)
  })

  it('covers nothing when benched', () => {
    expect(heroCoverage(fresh('mo'), 1000, 100).covered).toBe(0)
  })
})

describe('§13.6.7 — amplitude, not gate', () => {
  it('is exactly 1 with nobody placed', () => {
    expect(heroFold([], 100)).toEqual(NO_HERO_FOLD)
    expect(heroFold([{ runtime: fresh('mo'), covered: 0 }], 100)).toEqual(NO_HERO_FOLD)
  })

  it('bends the branch’s own field and leaves the others alone', () => {
    const fold = heroFold([{ runtime: fresh('mo'), covered: 40 }], 40)
    expect(fold.defects).toBeLessThan(1)
    expect(fold.incidents).toBe(1)
    expect(fold.cap).toBe(1)
    expect(fold.entropy).toBe(1)
  })

  it('scales by the share of the studio actually covered, so REACH pays', () => {
    // The same hero over the same studio, covering a fifth of it and all of it.
    const narrow = heroFold([{ runtime: fresh('mo'), covered: 8 }], 40)
    const wide = heroFold([{ runtime: fresh('mo'), covered: 40 }], 40)
    expect(narrow.defects).toBeGreaterThan(wide.defects)
    expect(narrow.defects).toBeLessThan(1)
  })

  it('scales Support by the covered share, like every other branch', () => {
    const narrow = heroFold([{ runtime: fresh('matt'), covered: 8 }], 1000)
    const wide = heroFold([{ runtime: fresh('matt'), covered: 1000 }], 1000)
    expect(narrow.supportHeads).toBeLessThan(wide.supportHeads)
    expect(narrow.supportHeads).toBeGreaterThan(0)
  })

  it('wires all six signature promises while their owner is placed', () => {
    const james = heroFold([{ runtime: fresh('james'), covered: 1 }], 100)
    const mo = heroFold([{ runtime: fresh('mo'), covered: 100 }], 100)
    const serena = heroFold([{ runtime: fresh('serena'), covered: 100 }], 100)
    const matt = heroFold([{ runtime: fresh('matt'), covered: 100 }], 100)
    const melany = heroFold([{ runtime: fresh('melany'), covered: 100 }], 100)
    const billy = heroFold([{ runtime: fresh('billy'), covered: 40 }], 100)

    expect(james.standupHeads).toBe(1)
    expect(mo.defects).toBeLessThan(heroFold([{ runtime: fresh('mo'), covered: 0 }], 100).defects)
    expect(serena.incidentStartWork).toBeCloseTo(0.5, 9)
    expect(matt.ticketRate).toBeCloseTo(0.8, 9)
    expect(melany.cap).toBeGreaterThan(1)
    expect(melany.operatingCost).toBe(100)
    expect(billy.standupHeads).toBe(40)
  })

  it('stacks two heroes of different branches without either eating the other', () => {
    const fold = heroFold(
      [
        { runtime: fresh('mo'), covered: 40 },
        { runtime: fresh('serena'), covered: 40 },
      ],
      40,
    )
    expect(fold.defects).toBeLessThan(1)
    expect(fold.incidents).toBeLessThan(1)
  })

  it('survives a studio of nobody', () => {
    const fold = heroFold([{ runtime: fresh('billy'), covered: 8 }], 0)
    expect(Number.isFinite(fold.entropy)).toBe(true)
    expect(fold.entropy).toBeGreaterThan(0)
  })
})

describe('§13.13 — the levels a run actually produces', () => {
  it('is about one level per project shipped, early', () => {
    // A four-hundred-point project, fully covered. §13.10's ξ was set for this.
    expect(xpToReach(2)).toBe(XP_BASE)
  })
})
