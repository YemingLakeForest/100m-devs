/**
 * §10.7 [amended 2026-09-26] — the wiring between a finished build and a game
 * on sale: the belt, the buffer, SHIP!, the ring's verdict and Serena's
 * auto-ship.
 *
 * `sim/pipeline.ts` owns the lanes and `sim/release.ts` owns the ring, and each
 * is tested there. What is tested here is the seam, and the claims are the
 * canon ones: a finished build goes onto the belt and not on sale; everything
 * past Code counts against one buffer, and a full buffer stops the floor;
 * SHIP! is the only way a player puts a build on sale and it stops the clock
 * while they decide; the launch reaches the payout and the rating; and nobody
 * attending costs nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  SHELF_CAPACITY,
  __resetStore,
  __setState,
  beltView,
  bufferCount,
  buyPipeline,
  closeLaunch,
  currentVelocity,
  dismissScene,
  getState,
  launchRelease,
  openLaunch,
  poke,
  pokeFounder,
  projectTitle,
  releaseNow,
  ringDefectCount,
  shelfBlocked,
  shelfCapacity,
  shipEverything,
  tick,
  type ShelvedBuild,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_SERENA_ARRIVES } from './scenes.ts'
import { BASELINE_RATING, DEFECT_DENSITY_ANCHOR } from '../sim/rating.ts'
import { LAUNCH_BANDS, TRAIN_LAUNCH, launchOutcome } from '../sim/release.ts'
import { titleFor } from '../three/sim/titles.ts'

beforeEach(() => {
  __resetStore()
})

/** Put the run a hair from finishing its project, with somebody at a desk. */
function aboutToFinish() {
  __setState({ devs: 1, burned: getState().commitment.minus(0.1) })
}

/** One step of the clock, with any story scene that opens dismissed — a scene stops the clock. */
function step(dt: number) {
  if (getState().scene !== null) dismissScene()
  tick(dt)
}

/** Finish the project on the burn-down. */
function finish() {
  aboutToFinish()
  step(0.5)
}

/** Kept so the calls below read the way they always did: there is nothing left to wait for. */
function runBelt() {
  step(0.5)
}

describe('§10.7 [2026-10-04] — a finished build goes straight into the queue, not on sale', () => {
  it('joins the queue when the burn-down reaches zero, and the next project starts at once', () => {
    const first = getState().sprintName
    finish()
    const s = getState()
    expect(s.shelf).toHaveLength(1)
    expect(s.projectsShipped).toBe(0)
    expect(s.shelf[0].name).toBe(first)
    expect(s.burned.toNumber()).toBeLessThan(s.commitment.toNumber())
    expect(s.sprintName).not.toBe(first)
  })

  it('has no Build and no Test: the build is shippable the frame it is made, and waits for SHIP!', () => {
    finish()
    expect(getState().shelf).toHaveLength(1)
    // And it waits there: nothing ships it but SHIP!.
    for (let i = 0; i < 20; i++) step(1)
    expect(getState().projectsShipped).toBe(0)
    expect(getState().shelf).toHaveLength(1)
    expect('pipeline' in getState()).toBe(false)
  })

  it('keeps the name, ordinal and genre it was finished with', () => {
    const named = projectTitle()
    finish()
    runBelt()
    const build = getState().shelf[0]
    expect(build.name).toBe(named.name)
    expect(build.genre).toBe(named.genre)
    expect(build.ordinal).toBe(0)
    // The game on the burn-down now is the next ordinal's.
    expect(getState().sprintName).toBe(titleFor(getState().runSeed, 1).name)
    releaseNow()
    expect(getState().history.recent[0].name).toBe(named.name)
    expect(getState().sprintName).toBe(titleFor(getState().runSeed, 1).name)
  })
})

describe('§10.7 — one queue, and a full one stops the floor', () => {
  function fill() {
    const shelf: ShelvedBuild[] = []
    for (let i = 0; i < SHELF_CAPACITY; i++) {
      finish()
      runBelt()
    }
    for (const b of getState().shelf) shelf.push(b)
    return shelf
  }

  it('counts every game in the queue against the one capacity', () => {
    finish()
    expect(bufferCount()).toBe(1)
    finish()
    expect(bufferCount()).toBe(2)
    expect(shelfCapacity()).toBe(SHELF_CAPACITY)
  })

  it('stops the velocity, the pokes and the burn-down once full', () => {
    fill()
    expect(shelfBlocked()).toBe(true)
    __setState({ devs: 5 })
    expect(currentVelocity()).toBe(0)
    const before = getState().burned.toNumber()
    for (let i = 0; i < 10; i++) step(1)
    expect(getState().burned.toNumber()).toBe(before)
    expect(pokeFounder()).toBe(0)
    expect(poke(0, 0).sp).toBe(0)
    // One ship frees a slot and the floor starts again.
    releaseNow()
    expect(shelfBlocked()).toBe(false)
    expect(currentVelocity()).toBeGreaterThan(0)
  })

  it('draws the belt from the same numbers the rule reads', () => {
    fill()
    const view = beltView()
    expect(view.buffer).toBe(bufferCount())
    expect(view.capacity).toBe(shelfCapacity())
    expect(view.ready).toBe(SHELF_CAPACITY)
  })
})

describe('§10.7 — SHIP! opens the ring, and the ring decides the release', () => {
  it('will not open on an empty shelf', () => {
    expect(openLaunch()).toBe(false)
    expect(getState().launching).toBe(false)
  })

  it('stops the clock while the ring is up, and closing it leaves the build at the head', () => {
    finish()
    runBelt()
    expect(openLaunch()).toBe(true)
    const cash = getState().cash
    const seconds = getState().runSeconds
    for (let i = 0; i < 10; i++) tick(1)
    expect(getState().cash).toBe(cash)
    expect(getState().runSeconds).toBe(seconds)
    closeLaunch()
    expect(getState().launching).toBe(false)
    expect(getState().shelf).toHaveLength(1)
  })

  it('carries the launch date onto the payout', () => {
    finish()
    runBelt()
    const perfect = launchOutcome({ turn: 0, year: 1, open: 0, initial: 4, chosen: true })
    expect(perfect.timing.band).toBe('perfect')
    openLaunch()
    launchRelease(perfect)
    const perfectPayout = getState().releases[0].payout

    __resetStore()
    finish()
    runBelt()
    releaseNow()
    const neutralPayout = getState().releases[0].payout
    // Same studio, same build: the date is the multiplier, and the Run 1
    // rating's launch term (GOLD, perfect) the rest.
    expect(perfectPayout).toBeGreaterThan(neutralPayout * LAUNCH_BANDS[0].multiplier * 0.99)
    expect(getState().launching).toBe(false)
  })

  it('ships an unattended release at exactly the baseline in Run 1', () => {
    finish()
    runBelt()
    releaseNow()
    expect(getState().history.recent[0].rating).toBe(BASELINE_RATING)
    expect(getState().ship?.timingLabel).toBeNull()
  })

  it('lets the ring move a Run 1 verdict both ways around the baseline', () => {
    finish()
    runBelt()
    // GOLD in the perfect window: above the baseline.
    launchRelease(launchOutcome({ turn: 0, year: 1, open: 0, initial: 4, chosen: true }))
    const good = getState().history.recent[0].rating
    __resetStore()
    finish()
    runBelt()
    // Every bug left and the season missed: below it.
    launchRelease(launchOutcome({ turn: 0.5, year: 4, open: 4, initial: 4, chosen: false }))
    const bad = getState().history.recent[0].rating
    expect(good).toBeGreaterThan(BASELINE_RATING)
    expect(bad).toBeLessThan(BASELINE_RATING)
    expect(getState().ship?.timingLabel).toBe('MISSED THE SEASON')
    expect(getState().ship?.stage).toBe('ALPHA')
  })

  it('draws a Run 1 build four bugs, and more for a neglected one', () => {
    finish()
    runBelt()
    expect(ringDefectCount(getState().shelf[0])).toBe(4)
    const neglected = { ...getState().shelf[0], density: DEFECT_DENSITY_ANCHOR * 3 }
    const clean = { ...getState().shelf[0], density: 0 }
    expect(ringDefectCount(neglected)).toBe(7)
    expect(ringDefectCount(clean)).toBe(0)
  })

  it('is neutral when the train is taken: ×1, launch term ½', () => {
    expect(TRAIN_LAUNCH.timing.multiplier).toBe(1)
    finish()
    runBelt()
    shipEverything()
    expect(getState().ship?.timing).toBe(1)
  })
})

describe("§10.7 — Serena's board", () => {
  function withSerena() {
    const p = emptyPermanent()
    setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_SERENA_ARRIVES.id] } })
  }

  it('is shut until Serena has arrived', () => {
    __setState({ cash: 1e9 })
    expect(buyPipeline('s1')).toBe(false)
    withSerena()
    expect(buyPipeline('s1')).toBe(true)
    expect(shelfCapacity()).toBe(SHELF_CAPACITY + 1)
  })

  it('ships on its own clock once Auto-Ship is bought, as nobody attending', () => {
    withSerena()
    __setState({ cash: 1e9 })
    expect(buyPipeline('s1')).toBe(true)
    expect(buyPipeline('a1')).toBe(true)
    finish()
    runBelt()
    expect(getState().shelf).toHaveLength(1)
    const every = beltView().autoShipIn!
    expect(every).toBeGreaterThan(0)
    for (let t = 0; t < every + 2; t += 1) step(1)
    expect(getState().projectsShipped).toBe(1)
    expect(getState().ship?.timingLabel).toBeNull()
  })
})

describe('§10.7 [2026-10-04] — Serena’s quality check happens as a game joins the queue', () => {
  it('takes a share of the defects off the finished build, and none without the node', () => {
    __setState({ devs: 1, defects: 100 })
    finish()
    const plain = getState().shelf[0].defects
    __resetStore()
    __setState({ devs: 1, defects: 100, pipelineNodes: { q1: 3 } })
    finish()
    expect(getState().shelf[0].defects).toBeLessThan(plain)
  })
})
