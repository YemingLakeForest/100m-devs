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
  SCENE_MELANY_ARRIVES,
  SCENE_MO_ARRIVES,
  SCENE_SERENA_ARRIVES,
} from './scenes.ts'
import { THREAD, retiredMilestone } from '../sim/events.ts'
import { BILLY_SUSTAINED_S, SYNC_HALVED } from './storyTriggers.ts'
import { D_BASE } from '../sim/entropy.ts'

/**
 * Run 2, with every scene that would otherwise interrupt already recorded.
 *
 * Melany is in the list on purpose and it is the point of her being there:
 * `melanyArrives` reads the same instant as `SYNC_HALVED` (D = D_cap), so a
 * studio parked at its own cap would raise *her* scene first and every tick
 * after the first would return early behind it. A player at this headcount has
 * met her; recording it is the honest fixture rather than a workaround.
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
        // §21.7.3 — the four who come before him. A studio of a hundred people
        // that has shipped three games has felt every one of those feelings, so
        // recording them is the honest fixture; leaving them out would mean
        // measuring whichever of their scenes fired first instead of Billy's.
        SCENE_MO_ARRIVES.id,
        SCENE_SERENA_ARRIVES.id,
        SCENE_MATT_ARRIVES.id,
        SCENE_MELANY_ARRIVES.id,
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
  // Instant Messenger (James's root) and Melany both raise the cap now that
  // nobody has to be posted for it. Hold the *effective* cap at the base cap,
  // so "a hundred hires" still reads as the studio's own capacity.
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

describe('§4.1 — the hundredth hire is the studio reaching its own capacity', () => {
  /**
   * The claim {@link SYNC_HALVED} rests on, checked against the curve rather
   * than restated: η = 1/(1 + (D/D_cap)^ρ) is a half exactly at D = D_cap. It
   * is asserted here because "~100 hires" is a *reading* of the base cap, and a
   * future retune of §4.2 must move the beat rather than break it.
   */
  it('reads exactly half at the base cap, and worse past it', () => {
    atTheCap(D_BASE)
    expect(currentEntropy()).toBeCloseTo(SYNC_HALVED, 6)

    atTheCap(D_BASE - 20)
    expect(currentEntropy()).toBeLessThan(SYNC_HALVED)

    atTheCap(D_BASE + 20)
    expect(currentEntropy()).toBeGreaterThan(SYNC_HALVED)
  })
})

describe('§21.7.3 — Billy arrives on a collapse that stayed collapsed', () => {
  it('does not come for a studio that stopped at the top of the curve', () => {
    // §4.1's optimum is below the cap, so a player reading the speedometer and
    // stopping is *playing correctly*. `founderBoardArrives` records the same
    // lesson in its own note: a trigger that punishes correct play by
    // withholding a system has misread which half of the section is the feeling.
    // Billy's answer is that stopping short of the cap is not a collapse — and
    // the player who does it has no problem for him to solve.
    atTheCap(70)
    play(BILLY_SUSTAINED_S * 3)
    expect(getState().scene).toBeNull()
    expect(getState().syncHalvedFor).toBe(0)
  })

  it('runs a clock only while sync is at or below half, and resets it', () => {
    atTheCap(D_BASE + 20)
    play(10)
    expect(getState().syncHalvedFor).toBeGreaterThan(9)

    // The studio gets organised — §11.2's protocols raise the cap, which is
    // exactly the move the scene exists to make the player want. The clock has
    // to forget, or a player who fixed it still gets told they did not.
    __setState({ devCap: D_BASE * 4 })
    play(1)
    expect(getState().syncHalvedFor).toBe(0)
    expect(getState().scene).toBeNull()
  })

  /**
   * §18.0 — **an event is weather, and Billy is about the building.**
   *
   * This is a walk failure written down as a unit test. THE THREAD holds the
   * studio at 25% output, which is 75% entropy on the gauge, so a clock reading
   * the gauge filled during a thread and brought Billy to a Run 2 garage of
   * twelve developers — before Mo, before Serena, before anybody had a
   * problem it solves. `store.structuralEntropy` is the fix and this is the case
   * that would have caught it.
   */
  it('ignores a §18.0 event holding the studio at a ceiling', () => {
    atTheCap(12)
    __setState({
      devs: 12,
      event: { id: THREAD.id, remaining: 20, age: 0, routed: true },
    })
    // The gauge really is reading a collapse — that is the event working.
    expect(currentEntropy()).toBeGreaterThan(SYNC_HALVED)

    play(BILLY_SUSTAINED_S * 2)

    // And the organisation is in perfect shape, so the clock never starts.
    expect(getState().syncHalvedFor).toBe(0)
    expect(getState().scene).toBeNull()
  })

  it('raises the scene once the collapse has been held', () => {
    atTheCap(D_BASE + 20)
    expect(getState().scene).toBeNull()

    play(BILLY_SUSTAINED_S + 2)
    expect(getState().scene).toBe(SCENE_BILLY_ARRIVES.id)
  })
})

describe('§21.7.3 — and afterwards, half the floor keeps working through stand-up', () => {
  it('changes nothing about the stand-up until he has spoken', () => {
    atTheCap(D_BASE + 20)
    play(1)
    // James alone: one person typing through the meeting.
    expect(getState().heroFold.standupHeads).toBe(1)
  })

  it('keeps half the floor coding once he is here — no placement to make', () => {
    atTheCap(D_BASE + 20)
    play(BILLY_SUSTAINED_S + 2)
    expect(getState().scene).toBe(SCENE_BILLY_ARRIVES.id)
    dismissScene()
    play(0.1)
    const devs = getState().devs
    expect(getState().heroFold.standupHeads).toBeCloseTo(1 + devs / 2, 6)
  })
})
