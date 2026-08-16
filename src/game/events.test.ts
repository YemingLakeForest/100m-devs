/**
 * §18.0 wired into the run — the half `sim/events.test.ts` cannot see.
 *
 * The pure module owns what an event *is*. This owns the three claims that only
 * exist once it is plugged into the store: that the thing fires at the right
 * moment and never during Run 1, that both exits actually work and are
 * different from each other, and that a live event holds the studio down
 * without ever holding it *still*.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  acknowledgeEvent,
  boughtTechNodes,
  buyTech,
  clearEventByHand,
  currentEfficiency,
  currentEvent,
  dismissScene,
  eventRetired,
  getState,
  tick,
} from './store.ts'
import { emptyPermanent, makeSaveData, setPermanent, serialize, deserialize } from './save.ts'
import { THREAD, THREAD_MIN_DEVS } from '../sim/events.ts'
import { SCENE_FOUNDER_BOARD, SCENE_HERO_BOARD, SCENE_THE_THREAD } from './scenes.ts'

/**
 * A Run 2 studio big enough for a thread, with the two board scenes already
 * behind it so nothing else claims the frame.
 *
 * The board introductions are recorded rather than suppressed because §21.7.7
 * puts them at exactly this point in a career: a player with twenty developers
 * in Run 2 has met their own board. Leaving them out would make every test
 * below a test of whichever scene happened to win the tick.
 */
function runTwo(devs = THREAD_MIN_DEVS + 8) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [SCENE_FOUNDER_BOARD.id, SCENE_HERO_BOARD.id],
    },
  })
  __setState({ devs, cash: 1e9, phase: 'act2a_loop' })
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  localStorage.clear()
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§18.0a — the first event is mandatory, and it fires on an empty board', () => {
  it('does not fire during Run 1, at any headcount', () => {
    __setState({ devs: 500, phase: 'act4_collapse' })
    for (let i = 0; i < 20; i++) tick(0.25)
    expect(getState().event).toBeNull()
  })

  it('fires in Run 2 once the studio is big enough, and opens on the scene', () => {
    runTwo()
    tick(0.25)
    expect(currentEvent()?.def).toBe(THREAD)
    expect(getState().scene).toBe(SCENE_THE_THREAD.id)
  })

  it('never fires at a player who has already bought a node', () => {
    runTwo()
    // C1 is ring 1 and needs no prerequisite, so it is buyable on the first
    // frame of Run 2 — which is the whole point: this player opened the board.
    expect(buyTech('C1')).toBe(true)
    expect(boughtTechNodes()).toBe(1)
    for (let i = 0; i < 20; i++) tick(0.25)
    expect(getState().event).toBeNull()
  })

  it('waits until "everybody replied" is a number', () => {
    runTwo(THREAD_MIN_DEVS - 1)
    for (let i = 0; i < 20; i++) tick(0.25)
    expect(getState().event).toBeNull()
  })
})

describe('what a live thread does to the studio', () => {
  it('holds output at the ceiling without ever stopping it', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    expect(currentEfficiency()).toBeCloseTo(THREAD.ceiling, 8)
    // Not zero — the intended exit costs money, and a studio earning nothing
    // could never reach it. §25.3.2: none of this may become a fail state.
    expect(currentEfficiency()).toBeGreaterThan(0)
  })

  it('keeps the burn-down moving while it is up', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    const before = getState().burned.toNumber()
    for (let i = 0; i < 20; i++) tick(0.25)
    expect(getState().burned.toNumber()).toBeGreaterThan(before)
  })

  it('ages while it is live', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    for (let i = 0; i < 8; i++) tick(0.25)
    expect(getState().event!.age).toBeGreaterThan(0)
  })
})

describe('the two exits', () => {
  it('resolves for good on any purchase, and plays the payoff', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    expect(buyTech('C1')).toBe(true)
    expect(getState().event).toBeNull()
    expect(eventRetired(THREAD.id)).toBe(true)
    expect(getState().scene).toBe(THREAD.resolvedScene)
    // And it never comes back, at any headcount, on any later run.
    dismissScene()
    __setState({ tech: {}, devs: 400 })
    for (let i = 0; i < 20; i++) tick(0.25)
    expect(getState().event).toBeNull()
  })

  it('clears by hand in exactly as many taps as it says', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    for (let i = 1; i < THREAD.clearTaps; i++) {
      expect(clearEventByHand()).toBe(true)
      expect(getState().event).not.toBeNull()
    }
    expect(clearEventByHand()).toBe(true)
    expect(getState().event).toBeNull()
  })

  it('does not retire the event when it is cleared by hand', () => {
    // The whole reason the two exits are different: twenty taps ends a thread,
    // a protocol ends threads. A player who taps out with an empty board meets
    // it again, and no scene plays the second time.
    runTwo()
    tick(0.25)
    dismissScene()
    for (let i = 0; i < THREAD.clearTaps; i++) clearEventByHand()
    expect(eventRetired(THREAD.id)).toBe(false)

    tick(0.25)
    expect(currentEvent()?.def).toBe(THREAD)
    expect(getState().scene).toBeNull()
  })

  it('routes the card to a banner without ending anything', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    expect(getState().event!.routed).toBe(false)
    expect(acknowledgeEvent()).toBe(true)
    expect(getState().event!.routed).toBe(true)
    expect(acknowledgeEvent()).toBe(false)
    // Still live, still at the ceiling. Knowing about it is not dealing with it.
    expect(currentEfficiency()).toBeCloseTo(THREAD.ceiling, 8)
  })
})

describe('an event is a state of the world — §24.2', () => {
  it('survives a reload, choice of exit and all', () => {
    runTwo()
    tick(0.25)
    dismissScene()
    clearEventByHand()
    acknowledgeEvent()
    const live = getState().event!

    const round = deserialize(serialize(makeSaveData(getState())))!
    expect(round.run.event).toEqual({
      id: live.id,
      remaining: live.remaining,
      age: live.age,
      routed: true,
    })
  })

  it('comes back as a quiet floor when the build no longer has the event', () => {
    runTwo()
    tick(0.25)
    const doc = deserialize(serialize(makeSaveData(getState())))!
    const forged = {
      ...doc,
      run: { ...doc.run, event: { id: 'event.gone', remaining: 4, age: 1, routed: false } },
    }
    expect(deserialize(JSON.stringify(forged))!.run.event).toBeUndefined()
  })

  it('omits the key entirely when the floor is quiet', () => {
    runTwo(2)
    expect(deserialize(serialize(makeSaveData(getState())))!.run.event).toBeUndefined()
  })
})
