/**
 * §21.7.3, Billy — **the collapse, the referral, and the stand-up.**
 *
 * `storyTriggers.test.ts` owns the predicate. This is the join: every
 * assertion here goes through the *run* — the clock is advanced by `tick`, the
 * scene is raised by the store's own trigger sweep, and his effect is read off
 * the fold the simulation charges.
 *
 * Until 2026-09-26 the scene also handed over §13.8's placement and posted him
 * onto the floor. Placement was cut; what he brings now is that half the floor
 * keeps working through the stand-up (`heroRoster.ts`).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  currentEntropy,
  currentHeroFold,
  effectiveDevCap,
  dismissScene,
  getState,
  shipEverything,
  tick,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import {
  SCENE_BILLY_ARRIVES,
  SCENE_FOUNDER_BOARD,
  SCENE_JAMES_PROMOTED,
  SCENE_MATT_ARRIVES,
  SCENE_SERENA_ARRIVES,
} from './scenes.ts'
import { THREAD, retiredMilestone } from '../sim/events.ts'
import { BILLY_SUSTAINED_S, SYNC_FELT } from './storyTriggers.ts'
import { D_BASE } from '../sim/entropy.ts'

/**
 * Run 2, with every scene that would otherwise interrupt already recorded.
 *
 * Serena and Matt are in the list on purpose: a studio of this size that has
 * shipped three games has met both, and a scene of theirs would otherwise
 * halt the tick and every clock in this file would measure a stopped
 * simulation. [Amended 2026-10-04: Mo and Melany are gone.]
 */
function atTheCap(devs: number, extra: string[] = []) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [
        'scene.act1.james-arrives',
        SCENE_SERENA_ARRIVES.id,
        SCENE_MATT_ARRIVES.id,
        // §18.0a and §21.7.7 — the three other things a Run 2 studio of a
        // hundred people would already have been through. Without them the
        // first tick raises somebody else's scene and every tick after it
        // returns early, which is a suite measuring a stopped simulation.
        retiredMilestone(THREAD.id),
        SCENE_FOUNDER_BOARD.id,
        // §21.7.4 — James's first colleague is his promotion, and a studio
        // this size has long since had one.
        SCENE_JAMES_PROMOTED.id,
        ...extra,
      ],
    },
  })
  __setState({
    devs,
    devCap: D_BASE,
    cash: 5e7,
    runSeconds: 0,
    projectsShipped: 3,
  })
  // Instant Messenger (James's root) raises the cap. Hold the *effective* cap at
  // the base cap, so "a hundred hires" still reads as the studio's own capacity.
  __setState({ heroFold: currentHeroFold() })
  __setState({ devCap: (D_BASE * D_BASE) / effectiveDevCap() })
}

/**
 * Advance the simulation the way the frame loop does — **and answer the launch
 * window, because a studio of a hundred people ships one every few seconds.**
 *
 * §10.8b shelves a finished build and halts `tick` until somebody picks a
 * release date, so a loop that only ticks sits on the first finished project for
 * ever and every clock in this file quietly stops. `releaseNow` with nothing
 * locked pays x1, which keeps the economy exactly where it was before the
 * window existed.
 */
function play(seconds: number) {
  const dt = 1 / 30
  for (let t = 0; t < seconds; t += dt) {
    if (getState().scene !== null) return
    shipEverything()
    tick(dt)
  }
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§4.1 — where the curve sits against the line Billy waits for', () => {
  /**
   * §4.1's η = 1/(1 + (D/D_cap)^ρ) is a half exactly at D = D_cap, and the
   * optimum is below it. Billy's door is {@link SYNC_FELT}, well short of both,
   * and this pins the *order* of the three rather than any headcount: a future
   * retune of §4.2 or ρ must move the beat and not break it.
   */
  it('puts the felt slip before the optimum, and the optimum before the cap', () => {
    atTheCap(D_BASE)
    expect(currentEntropy()).toBeCloseTo(0.5, 6)

    atTheCap(Math.round(D_BASE * 0.758))
    const atOptimum = currentEntropy()
    expect(atOptimum).toBeLessThan(0.5)
    expect(atOptimum).toBeGreaterThan(SYNC_FELT)

    atTheCap(30)
    expect(currentEntropy()).toBeLessThan(SYNC_FELT)
  })
})

describe('§21.7.3 — Billy arrives when growth first costs sync, and it stays costing it', () => {
  it('does not come for a studio that is still comfortably in sync', () => {
    atTheCap(30)
    play(BILLY_SUSTAINED_S * 3)
    expect(getState().scene).toBeNull()
    expect(getState().syncSlippedFor).toBe(0)
  })

  it('comes for a studio that stopped at the top of the curve — playing correctly is not a way to miss him', () => {
    // [2026-10-04] This was the opposite test: "does not come for a studio that
    // stopped at the top of the curve". That reading made the one hero who is
    // about sync a reward for overhiring, and measured, a careful player never
    // met him in two simulated hours.
    atTheCap(Math.round(D_BASE * 0.758))
    play(BILLY_SUSTAINED_S + 2)
    expect(getState().scene).toBe(SCENE_BILLY_ARRIVES.id)
  })

  it('runs a clock only while sync is slipped, and resets it', () => {
    atTheCap(D_BASE)
    play(10)
    expect(getState().syncSlippedFor).toBeGreaterThan(9)

    // The studio gets organised — §11.2's protocols raise the cap, which is
    // exactly the move the scene exists to make the player want. The clock has
    // to forget, or a player who fixed it still gets told they did not.
    __setState({ devCap: D_BASE * 4 })
    play(1)
    expect(getState().syncSlippedFor).toBe(0)
    expect(getState().scene).toBeNull()
  })

  /**
   * §18.0 — **an event is weather, and Billy is about the building.**
   *
   * This is a walk failure written down as a unit test. THE THREAD holds the
   * studio at 25% output, which is 75% entropy on the gauge, so a clock reading
   * the gauge filled during a thread and brought Billy to a Run 2 garage of
   * twelve developers, before anybody had a problem he solves.
   * `store.structuralEntropy` is the fix and this is the case that would have
   * caught it.
   */
  it('ignores a §18.0 event holding the studio at a ceiling', () => {
    atTheCap(12)
    __setState({
      devs: 12,
      event: { id: THREAD.id, remaining: 20, age: 0, routed: true },
    })
    // The gauge really is reading a collapse — that is the event working.
    expect(currentEntropy()).toBeGreaterThan(SYNC_FELT)

    play(BILLY_SUSTAINED_S * 2)

    // And the organisation is in perfect shape, so the clock never starts.
    expect(getState().syncSlippedFor).toBe(0)
    expect(getState().scene).toBeNull()
  })
})

describe('§21.7.3 — and afterwards, half the floor keeps working through stand-up', () => {
  it('changes nothing about the stand-up until he has spoken', () => {
    atTheCap(Math.round(D_BASE * 0.758))
    play(1)
    // James alone: one person typing through the meeting.
    expect(getState().heroFold.standupHeads).toBe(1)
  })

  it('keeps half the floor coding once he is here — no placement to make', () => {
    atTheCap(Math.round(D_BASE * 0.758))
    play(BILLY_SUSTAINED_S + 2)
    expect(getState().scene).toBe(SCENE_BILLY_ARRIVES.id)
    dismissScene()
    play(0.1)
    const devs = getState().devs
    expect(getState().heroFold.standupHeads).toBeCloseTo(1 + devs / 2, 6)
  })
})
