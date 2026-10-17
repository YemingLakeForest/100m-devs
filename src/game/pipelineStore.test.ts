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
  POLISH_CAP,
  SHELF_CAPACITY,
  __parkBuild,
  __resetStore,
  launchMinimum,
  launchView,
  pressShip,
  setHolding,
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
  pipelineOf,
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
import { LAUNCH_HOLD_SECONDS, minimumBatch } from '../sim/pipeline.ts'

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

  it('[2026-10-16, D4] ships a build her delay after it lands, with no node bought, as nobody attending', () => {
    withSerena()
    finish()
    runBelt()
    expect(getState().shelf).toHaveLength(1)
    const every = beltView().autoShipIn!
    expect(every).toBeGreaterThan(0)
    for (let t = 0; t < every + 2; t += 1) step(1)
    expect(getState().projectsShipped).toBe(1)
    // §10.8b [amended 2026-10-16] — the reel is for attended releases. An
    // auto-ship publishes no `ship` event, only the ticker's.
    expect(getState().ship).toBeNull()
    expect(getState().autoShipped?.name).toBe(getState().history.recent[0].name)
    expect(getState().autoShipped?.count).toBe(1)
  })

  it('never stops the floor while every build takes at least her delay', () => {
    // A delay keeps up with any cadence as long as itself; a clock did not
    // (finding 06). Builds land every delay + ½s for ten minutes.
    withSerena()
    const delay = pipelineOf().autoShipDelay
    let built = 0
    for (let t = 0; t < 600; t += delay + 0.5) {
      finish()
      built += 1
      expect(shelfBlocked()).toBe(false)
      for (let k = 0; k < delay; k += 1) {
        step(1)
        expect(shelfBlocked()).toBe(false)
      }
    }
    expect(getState().shelf.length).toBeLessThanOrEqual(1)
    expect(getState().projectsShipped).toBeGreaterThanOrEqual(built - 1)
  })

  it('[phase 4.6] ships at GOLD rather than RC once Ship on Green is owned', () => {
    withSerena()
    const stageAfterAutoShip = () => {
      finish()
      for (let i = 0; i < 40; i++) step(1)
      return getState().history.recent[getState().history.recent.length - 1].launch!
    }
    const rc = stageAfterAutoShip()
    __resetStore()
    withSerena()
    __setState({ pipelineNodes: { a3b: 1 } })
    expect(stageAfterAutoShip()).toBeGreaterThan(rc)
  })

  it('does nothing before Serena: the queue waits for SHIP!', () => {
    finish()
    for (let i = 0; i < 120; i++) step(1)
    expect(getState().projectsShipped).toBe(0)
    expect(beltView().autoShipIn).toBeNull()
  })
})

describe('§10.7 [2026-10-16, plan phase 4.5] — SHIP!, HOLD and the launch', () => {
  function serena() {
    const p = emptyPermanent()
    setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_SERENA_ARRIVES.id] } })
  }
  /** Land `n` builds that each took `seconds` to make. */
  function land(n: number, seconds: number) {
    for (let i = 0; i < n; i++) {
      __setState({ projectSeconds: seconds })
      finish()
    }
  }
  function holdWithLaunchDay() {
    serena()
    __setState({ pipelineNodes: { s1: 5, a1: 1 } })
    expect(setHolding(true)).toBe(true)
  }

  it('before Serena, every SHIP! is still a one-build ring', () => {
    land(3, 130)
    expect(launchView().mode).toBe('ring')
    expect(pressShip()).toBe('ring')
    expect(getState().launching).toBe(true)
    expect(getState().launchBatch).toBe(1)
  })

  it('with Serena and nothing held, SHIP! ships the head at once: no ring, no reel', () => {
    serena()
    land(2, 130)
    const head = getState().shelf[0].name
    expect(pressShip()).toBe('shipped')
    expect(getState().launching).toBe(false)
    expect(getState().ship).toBeNull()
    expect(getState().autoShipped?.hand).toBe(true)
    expect(getState().history.recent[0].name).toBe(head)
    expect(getState().shelf).toHaveLength(1)
  })

  it('HOLD needs Launch Day, and pauses Serena while it is on', () => {
    serena()
    expect(setHolding(true)).toBe(false)
    __setState({ pipelineNodes: { a1: 1 } })
    expect(setHolding(true)).toBe(true)
    land(1, 130)
    for (let i = 0; i < 120; i++) step(1)
    expect(getState().projectsShipped).toBe(0)
    setHolding(false)
    step(1)
    expect(getState().projectsShipped).toBe(1)
  })

  it('launches the held batch oldest first, under one reel', () => {
    holdWithLaunchDay()
    land(3, 130)
    const names = getState().shelf.map((b) => b.name)
    expect(launchView().ready).toBe(true)
    expect(pressShip()).toBe('ring')
    expect(getState().launchBatch).toBe(3)
    const outcome = launchOutcome({ turn: 0, year: 1, open: 0, initial: 4, chosen: true })
    launchRelease(outcome)
    const s = getState()
    expect(s.shelf).toHaveLength(0)
    expect(s.history.recent.slice(-3).map((r) => r.name)).toEqual(names)
    expect(s.ship?.name).toBe(names[0])
    expect(s.ship?.batch).toBe(3)
    // Every build in the batch went out on the one date the ring chose.
    expect(new Set(s.history.recent.slice(-3).map((r) => r.launch)).size).toBe(1)
  })

  it('refuses a launch below the minimum batch', () => {
    holdWithLaunchDay()
    land(2, 30)
    expect(launchMinimum()).toBeGreaterThan(2)
    expect(launchView().ready).toBe(false)
    expect(openLaunch()).toBe(false)
    expect(pressShip()).toBeNull()
    expect(getState().launching).toBe(false)
  })

  it('draws a bigger backlog on a bigger launch, and one build exactly as before', () => {
    land(1, 130)
    const b = getState().shelf[0]
    expect(ringDefectCount(b, 1)).toBe(ringDefectCount(b))
    expect(ringDefectCount(b, 3)).toBeGreaterThan(ringDefectCount(b))
  })

  it('keeps `?release` a one-build ring, even with HOLD on', () => {
    holdWithLaunchDay()
    land(2, 130)
    __parkBuild()
    expect(getState().launching).toBe(true)
    expect(getState().launchBatch).toBe(1)
  })

  it('keeps rings to fifteen an hour for builds of 20 to 120 seconds', () => {
    for (let seconds = 20; seconds <= 120; seconds += 1) {
      const perHour = 3600 / (minimumBatch(seconds) * seconds)
      expect(perHour).toBeLessThanOrEqual(3600 / LAUNCH_HOLD_SECONDS + 1e-9)
    }
  })

  it('pays a blind launch ×1 on average, batch or not', () => {
    // §26.3.4 — the date's ramp averages ×1 for a press at a uniform moment, and
    // the batch carries one date for every build, so the mean is unchanged.
    const n = 4000
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += launchOutcome({ turn: (i + 0.5) / n, year: 1, open: 0, initial: 0, chosen: true }).timing.multiplier
    }
    expect(sum / n).toBeCloseTo(1, 2)
  })
})

describe('§10.7 [2026-10-16, plan phase 4.3] — a poke into a full queue polishes the next game out', () => {
  function fullRunTwoQueue() {
    const p = emptyPermanent()
    setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
    for (let i = 0; i < SHELF_CAPACITY; i++) {
      __setState({ defects: 100 })
      finish()
    }
    expect(shelfBlocked()).toBe(true)
  }

  it('takes defects off the front build, and the floor stays stopped', () => {
    fullRunTwoQueue()
    const before = getState().shelf[0].defects
    const second = getState().shelf[1].defects
    const burned = getState().burned.toNumber()
    expect(poke(10, 10).sp).toBe(0)
    expect(pokeFounder(10, 10)).toBe(0)
    expect(getState().shelf[0].defects).toBeLessThan(before)
    expect(getState().shelf[1].defects).toBe(second)
    expect(getState().burned.toNumber()).toBe(burned)
    expect(currentVelocity()).toBe(0)
    expect(getState().floaters.some((f) => f.label === 'POLISH')).toBe(true)
  })

  it('never takes more than half of what the build was shelved with', () => {
    fullRunTwoQueue()
    const before = getState().shelf[0].defects
    for (let i = 0; i < 100; i++) poke(0, 0)
    expect(getState().shelf[0].defects).toBeCloseTo(before * (1 - POLISH_CAP), 6)
  })

  it('leaves Run 1’s stamped builds alone and says why the floor stopped', () => {
    for (let i = 0; i < SHELF_CAPACITY; i++) finish()
    const before = getState().shelf[0].defects
    poke(0, 0)
    expect(getState().shelf[0].defects).toBe(before)
    expect(getState().bubble?.text).toMatch(/SHIP!/)
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
