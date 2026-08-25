/**
 * Heroes, wired — GDD §13.6.2, §13.8, §13.10, §13.13.
 *
 * `heroRoster.ts` is pure and tested on its own. This is the other half: that
 * the *run* actually resolves who is on staff, that a placement moves the
 * numbers the simulation reads, that XP accrues only under coverage, and that
 * where somebody is standing survives a reload and does not survive a prestige.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  beginPosting,
  buyHeroTreeNode,
  cancelPosting,
  currentEntropy,
  currentHeroFold,
  currentPayroll,
  dismissScene,
  effectiveDevCap,
  getState,
  heroById,
  heroRoster,
  loadGame,
  placeHero,
  postHeroAt,
  recallHero,
  releaseHeroCoverage,
  selectHero,
  tick,
  workingDevs,
} from './store.ts'
import {
  SAVE_KEY,
  emptyPermanent,
  getPermanent,
  makeSaveData,
  serialize,
  setPermanent,
} from './save.ts'
import {
  SCENE_BILLY_ARRIVES,
  SCENE_FOUNDER_BOARD,
  SCENE_HERO_BOARD,
  SCENE_JAMES_ARRIVES,
  SCENE_JAMES_PROMOTED,
  SCENE_MELANY_ARRIVES,
  SCENE_MO_ARRIVES,
} from './scenes.ts'
import { SETTLE_SECONDS } from '../sim/heroRoster.ts'
import { startingNodes } from '../sim/heroTree.ts'
import { xpToReach } from '../sim/heroXp.ts'
import { THREAD, retiredMilestone } from '../sim/events.ts'

/**
 * Prestiged, with the named arrival scenes recorded — §21.7.6c's one flag.
 *
 * **And everything §18.0a and §21.7.7 would otherwise interrupt with.** These
 * studios are Run 2, past twelve developers, sometimes four hundred, holding an
 * empty §11 board — which is precisely when THE THREAD fires and when §4.5d's
 * joke lands hard enough to open the founder's board. Without this, every
 * `settle()` below would raise a scene on its first tick, `tick` would return
 * early for the rest of the loop, and a suite about where heroes stand would be
 * measuring a stopped simulation.
 *
 * A player who has staff and four hundred developers has been through all
 * three, so recording them is the honest fixture rather than a workaround.
 */
function staffed(...scenes: { id: string }[]) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [
        ...scenes.map((s) => s.id),
        retiredMilestone(THREAD.id),
        SCENE_FOUNDER_BOARD.id,
        SCENE_HERO_BOARD.id,
      ],
    },
  })
}

/**
 * Let a placed hero finish walking — §13.8's settling period.
 *
 * Ticks rather than writing `runSeconds`, because `state.heroFold` is a cache
 * that `tick` refreshes (see its note): settling ends *with time*, so a test
 * that jumps the clock without running a frame is asking `effectiveDevCap` to
 * read a fold computed before the hero arrived. In play there is a frame every
 * 16 ms and the question never comes up.
 */
function settle(seconds = SETTLE_SECONDS + 1) {
  for (let t = 0; t < seconds; t++) tick(1)
}

/** Bank a hero's XP directly, so a test about levels is not a test about time. */
function bankXp(id: string, level: number) {
  const p = getPermanent()
  setPermanent({
    ...p,
    meta: { ...p.meta, heroXp: { ...(p.meta.heroXp ?? {}), [id]: xpToReach(level) } },
  })
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§21.7.3 — the roster is who has walked through a door', () => {
  it('is empty until somebody has', () => {
    setPermanent(emptyPermanent())
    expect(heroRoster()).toEqual([])
    expect(heroById('mo')).toBeNull()
  })

  it('holds exactly the heroes whose arrival scenes are recorded', () => {
    staffed(SCENE_MO_ARRIVES, SCENE_BILLY_ARRIVES)
    expect(heroRoster().map((h) => h.id).sort()).toEqual(['billy', 'mo'])
    expect(heroById('mo')!.branch).toBe('quality')
    expect(heroById('serena')).toBeNull()
  })

  it('arrives benched — §7.8.12 makes that a place you can see', () => {
    staffed(SCENE_MO_ARRIVES)
    expect(heroById('mo')!.placement).toBeNull()
    expect(currentHeroFold()).toEqual(currentHeroFold())
    expect(currentHeroFold().defects).toBe(1)
  })
})

describe('§13.8 — placement moves the numbers the simulation reads', () => {
  beforeEach(() => {
    staffed(SCENE_MO_ARRIVES, SCENE_MELANY_ARRIVES, SCENE_BILLY_ARRIVES)
    __setState({ devs: 40, runSeconds: 100 })
  })

  it('refuses to place somebody who has not arrived', () => {
    expect(placeHero('serena', 0, 0)).toBe(false)
    expect(placeHero('mo', 0, 0)).toBe(true)
  })

  it('covers nothing while the hero is still walking — rule 4', () => {
    placeHero('mo', 0, 0)
    // `placedAt` is the current runSeconds, so nothing has elapsed yet.
    expect(currentHeroFold().defects).toBe(1)
    settle()
    expect(currentHeroFold().defects).toBeLessThan(1)
  })

  it('raises the cap when Melany is on the floor, and drops it when she leaves', () => {
    const before = effectiveDevCap()
    const payrollBefore = currentPayroll()
    placeHero('melany', 0, 0)
    settle()
    const during = effectiveDevCap()
    expect(during).toBeGreaterThan(before)
    expect(currentPayroll()).toBeGreaterThan(payrollBefore)

    recallHero('melany')
    expect(effectiveDevCap()).toBe(before)
  })

  it('unions hero coverage for release rating instead of double-counting overlap', () => {
    placeHero('mo', 0, 0)
    placeHero('melany', 0, 0)
    settle()
    expect(releaseHeroCoverage()).toBeCloseTo(8 / 40, 9)

    placeHero('melany', 0, 8)
    settle()
    expect(releaseHeroCoverage()).toBeCloseTo(16 / 40, 9)
  })

  it('makes specialist safety give up productive coding heads', () => {
    __setState({
      devs: 40,
      roster: [
        { role: 'dev', count: 30 },
        { role: 'qa', count: 10 },
      ],
    })
    expect(workingDevs()).toBeCloseTo(30, 9)
  })

  it('bends entropy when Billy is on the floor — §22.8', () => {
    __setState({ devs: 400 })
    const before = currentEntropy()
    expect(before).toBeGreaterThan(0)
    placeHero('billy', 0, 0)
    settle()
    expect(currentEntropy()).toBeLessThan(before)
  })

  it('re-placing restarts the settling period, so moving somebody costs time', () => {
    placeHero('mo', 0, 0)
    settle()
    expect(currentHeroFold().defects).toBeLessThan(1)
    // Moved. She covers nothing again until she has walked there.
    placeHero('mo', 0, 1)
    expect(currentHeroFold().defects).toBe(1)
  })

  it('recalling somebody who was never placed changes nothing', () => {
    expect(recallHero('mo')).toBe(false)
  })
})

describe('§13.10 — a placed hero earns XP from the work under them', () => {
  beforeEach(() => {
    staffed(SCENE_MO_ARRIVES)
    __setState({ devs: 40, runSeconds: 100 })
  })

  it('earns nothing on the bench, however long the run goes', () => {
    for (let i = 0; i < 60; i++) tick(1)
    expect(heroById('mo')!.xp).toBe(0)
    expect(heroById('mo')!.progress.level).toBe(1)
  })

  it('earns once placed and settled', () => {
    placeHero('mo', 0, 0)
    settle()
    for (let i = 0; i < 60; i++) tick(1)
    expect(heroById('mo')!.xp).toBeGreaterThan(0)
  })

  it('is never drained — the gap is a rate, never a debt', () => {
    placeHero('mo', 0, 0)
    settle()
    for (let i = 0; i < 30; i++) tick(1)
    const banked = heroById('mo')!.xp
    recallHero('mo')
    for (let i = 0; i < 120; i++) tick(1)
    expect(heroById('mo')!.xp).toBe(banked)
  })
})

describe('§13.13 — one level, one point, and a node to spend it on', () => {
  beforeEach(() => {
    staffed(SCENE_MO_ARRIVES)
    __setState({ devs: 40, runSeconds: 100 })
  })

  it('refuses a node the points cannot cover, and takes one they can', () => {
    // Level 1 is one point. quality:4 is REACH and costs three; cloud:1 is
    // DEPTH and costs one.
    expect(buyHeroTreeNode('mo', 'quality:4')).toBe(false)
    expect(buyHeroTreeNode('mo', 'cloud:1')).toBe(true)
    expect(heroById('mo')!.nodes).toContain('cloud:1')
    expect(heroById('mo')!.points).toBe(0)
  })

  it('refuses a second purchase once the points are gone', () => {
    expect(buyHeroTreeNode('mo', 'cloud:1')).toBe(true)
    expect(buyHeroTreeNode('mo', 'cloud:2')).toBe(false)
  })

  it('refuses a node whose parent is not owned, at any level', () => {
    bankXp('mo', 20)
    expect(buyHeroTreeNode('mo', 'cloud:3')).toBe(false)
    expect(buyHeroTreeNode('mo', 'cloud:1')).toBe(true)
    expect(buyHeroTreeNode('mo', 'cloud:2')).toBe(true)
    expect(buyHeroTreeNode('mo', 'cloud:3')).toBe(true)
  })

  it('refuses a hero who has not arrived, and a node that does not exist', () => {
    expect(buyHeroTreeNode('serena', 'reliability:1')).toBe(false)
    expect(buyHeroTreeNode('mo', 'nowhere:1')).toBe(false)
  })

  it('takes effect on the frame it is bought', () => {
    bankXp('mo', 20)
    placeHero('mo', 0, 0)
    settle()
    const before = currentHeroFold().defects
    expect(buyHeroTreeNode('mo', 'quality:4')).toBe(true)
    // A REACH node — she covers more, so she bends more.
    expect(currentHeroFold().defects).toBeLessThan(before)
  })

  it('keeps the purchase permanent, beside the level that paid for it', () => {
    bankXp('mo', 5)
    buyHeroTreeNode('mo', 'cloud:1')
    const mo = heroById('mo')!
    expect(mo.nodes).toEqual([...startingNodes('quality'), 'cloud:1'])
    expect(mo.spent).toBe(1)
    expect(mo.points).toBe(4)
  })
})

/**
 * §21.7.4 — **Global Head of His Desk**, wired to the only org chart the game
 * has: §7.7's ladder. A hero on a higher rung is standing over the people on
 * the rungs inside it, which is what a line on a chart means.
 */
describe('§21.7.4 — the promotion fires off a placement', () => {
  beforeEach(() => {
    staffed(SCENE_JAMES_ARRIVES, SCENE_MO_ARRIVES)
    __setState({ devs: 40, runSeconds: 100 })
  })

  it('says nothing while the two of them are side by side', () => {
    placeHero('james', 0, 0)
    placeHero('mo', 0, 1)
    tick(1)
    expect(getState().scene).toBeNull()
  })

  it('fires the first time somebody is standing below him', () => {
    placeHero('mo', 0, 0)
    placeHero('james', 3, 0)
    tick(1)
    expect(getState().scene).toBe(SCENE_JAMES_PROMOTED.id)
  })

  it('never fires twice', () => {
    placeHero('mo', 0, 0)
    placeHero('james', 3, 0)
    tick(1)
    dismissScene()
    tick(1)
    expect(getState().scene).toBeNull()
  })
})

describe('§24 — where somebody is standing survives a reload, not a prestige', () => {
  it('round-trips a placement through the save', () => {
    staffed(SCENE_MO_ARRIVES)
    __setState({ devs: 40, runSeconds: 100 })
    placeHero('mo', 3, 2)

    const save = makeSaveData(getState())
    localStorage.setItem(SAVE_KEY, serialize({ ...save, savedAt: Date.now() }))
    __resetStore()
    setPermanent(emptyPermanent())
    expect(heroById('mo')).toBeNull()

    loadGame(Date.now())
    const back = heroById('mo')!.placement!
    expect(back.rung).toBe(3)
    expect(back.index).toBe(2)
  })

  it('drops a placement naming somebody who is not one of the six', () => {
    staffed(SCENE_MO_ARRIVES)
    __setState({ devs: 40 })
    placeHero('mo', 1, 0)
    const save = makeSaveData(getState())
    // A hand-edited save. A placement is a claim about a specific person and
    // there is no sensible person to substitute, so an unknown id is dropped
    // rather than defaulted — and a duplicate is dropped too, because a hero
    // cannot be in two places and keeping the last would make the answer depend
    // on serialisation order.
    save.run.heroPlacements = [
      { id: 'mo', rung: 1, index: 0, placedAt: 0 },
      { id: 'gary', rung: 4, index: 0, placedAt: 0 },
      { id: 'mo', rung: 9, index: 0, placedAt: 0 },
    ]
    localStorage.setItem(SAVE_KEY, serialize({ ...save, savedAt: Date.now() }))
    __resetStore()
    loadGame(Date.now())

    expect(heroById('mo')!.placement!.rung).toBe(1)
    expect(heroRoster()).toHaveLength(1)
  })

  it('reads a save written before any of this as nobody placed', () => {
    staffed(SCENE_MO_ARRIVES)
    __setState({ devs: 40 })
    placeHero('mo', 1, 0)
    const save = makeSaveData(getState())
    delete save.run.heroPlacements
    localStorage.setItem(SAVE_KEY, serialize({ ...save, savedAt: Date.now() }))
    __resetStore()
    loadGame(Date.now())

    // The person survives (`meta`); the posting does not. That is the same
    // answer a Paradigm Shift gives, for the same reason: a floor that no longer
    // exists cannot have anybody standing on it.
    expect(heroRoster()).toHaveLength(1)
    expect(heroById('mo')!.placement).toBeNull()
  })
})

describe('§13.8 — the interim placement gesture', () => {
  beforeEach(() => {
    staffed(SCENE_MO_ARRIVES, SCENE_MELANY_ARRIVES)
    __setState({ devs: 40, runSeconds: 100 })
  })

  it('arms nobody the player has not met', () => {
    expect(beginPosting('serena')).toBe(false)
    expect(getState().posting).toBeNull()
  })

  it('closes the card it was armed from, because the target is behind it', () => {
    selectHero('mo')
    expect(beginPosting('mo')).toBe(true)
    expect(getState().posting).toBe('mo')
    expect(getState().selectedHero).toBeNull()
  })

  it('places on the unit the tap landed on, and disarms', () => {
    beginPosting('mo')
    expect(postHeroAt({ rung: 0, index: 7 })).toBe(true)
    expect(getState().heroPlacements.mo).toMatchObject({ rung: 0, index: 7 })
    expect(getState().posting).toBeNull()
  })

  it('answers no to a tap with nobody armed, so a poke stays a poke', () => {
    expect(postHeroAt({ rung: 0, index: 7 })).toBe(false)
    expect(getState().heroPlacements.mo).toBeUndefined()
  })

  it('disarms even when the placement is refused', () => {
    beginPosting('mo')
    // Somebody who left the roster between arming and tapping. The gesture must
    // not stay armed, or the *next* poke silently places them instead.
    setPermanent(emptyPermanent())
    expect(postHeroAt({ rung: 0, index: 7 })).toBe(false)
    expect(getState().posting).toBeNull()
  })

  it('cancels, and cancelling twice is not a state change', () => {
    beginPosting('mo')
    cancelPosting()
    expect(getState().posting).toBeNull()
    cancelPosting()
    expect(getState().posting).toBeNull()
  })

  // §24.2 — an armed tap restored from a previous session is a gesture the
  // player does not remember making, and the next thing they touch would be it.
  it('does not survive a reload', () => {
    beginPosting('mo')
    const save = makeSaveData(getState())
    localStorage.setItem(SAVE_KEY, serialize({ ...save, savedAt: Date.now() }))
    __resetStore()
    loadGame(Date.now())
    expect(getState().posting).toBeNull()
  })
})
