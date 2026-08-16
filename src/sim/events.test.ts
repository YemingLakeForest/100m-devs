import { describe, expect, it } from 'vitest'
import {
  EVENTS,
  THREAD,
  THREAD_MIN_DEVS,
  ageEvent,
  beginEvent,
  clearOne,
  definitionOf,
  eventCeiling,
  eventDue,
  retiredMilestone,
  routeEvent,
  type EventSnapshot,
} from './events.ts'

/** Nothing has happened yet: Run 2, an empty board, a studio big enough. */
function snapshot(over: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
    paradigmShifts: 1,
    devs: THREAD_MIN_DEVS,
    techNodesBought: 0,
    live: false,
    retired: () => false,
    ...over,
  }
}

describe('§18.0 — every event has two exits', () => {
  it('gives every event a hand-clear priced in taps', () => {
    // The rule that keeps an event from becoming a paywall (§25.3.2). If a
    // future event ships without one, this is where it is caught.
    for (const event of EVENTS) expect(event.clearTaps).toBeGreaterThan(0)
  })

  it('gives every event a route at its intended exit', () => {
    for (const event of EVENTS) expect(event.routeLabel.length).toBeGreaterThan(0)
  })

  it('never lets an event stop the studio outright', () => {
    // §18.0a — the ceiling is not zero, because the intended exit costs money
    // and a studio earning nothing can never reach it.
    for (const event of EVENTS) expect(event.ceiling).toBeGreaterThan(0)
  })
})

describe('§18.0a — when THE THREAD fires', () => {
  it('fires in Run 2 with an empty board and a studio big enough', () => {
    expect(eventDue(snapshot())).toBe(THREAD)
  })

  it('never fires during Run 1', () => {
    // §21.0c and §3.1.1 reach the same gate from two directions.
    expect(eventDue(snapshot({ paradigmShifts: 0 }))).toBeNull()
  })

  it('never fires at a player who has already bought a node', () => {
    // The board is the subject. Somebody who opened it does not need the lesson.
    expect(eventDue(snapshot({ techNodesBought: 1 }))).toBeNull()
  })

  it('waits until "everybody replied" is a number', () => {
    expect(eventDue(snapshot({ devs: THREAD_MIN_DEVS - 1 }))).toBeNull()
  })

  it('never stacks a second event on a live one', () => {
    expect(eventDue(snapshot({ live: true }))).toBeNull()
  })

  it('never fires again once it has been resolved for good', () => {
    const retired = (id: string) => id === THREAD.id
    expect(eventDue(snapshot({ retired }))).toBeNull()
  })
})

describe('what a live event does', () => {
  it('holds the studio at its ceiling', () => {
    expect(eventCeiling(beginEvent(THREAD))).toBe(THREAD.ceiling)
  })

  it('does nothing at all when nothing is happening', () => {
    expect(eventCeiling(null)).toBe(1)
  })

  it('does nothing for an id this build has retired', () => {
    // A save naming an event that no longer exists must not hold a studio down
    // at a ceiling nothing can clear.
    expect(eventCeiling({ id: 'event.gone', remaining: 3, age: 0, routed: false })).toBe(1)
    expect(definitionOf({ id: 'event.gone', remaining: 3, age: 0, routed: false })).toBeNull()
  })
})

describe('the hand-clear', () => {
  it('counts down one reply per tap', () => {
    const live = beginEvent(THREAD)
    expect(live.remaining).toBe(THREAD.clearTaps)
    expect(clearOne(live)?.remaining).toBe(THREAD.clearTaps - 1)
  })

  it('returns null on the last tap rather than a zeroed event', () => {
    // A zeroed event left in state is a studio held at a quarter output with
    // nothing left to tap. `null` is the store's signal, and it cannot be
    // forgotten the way a `remaining === 0` check can.
    let live = beginEvent(THREAD)
    for (let i = 1; i < THREAD.clearTaps; i++) {
      const next = clearOne(live)
      expect(next).not.toBeNull()
      live = next!
    }
    expect(clearOne(live)).toBeNull()
  })
})

describe('the card gives way to a banner', () => {
  it('latches once the player has chosen an exit', () => {
    const live = beginEvent(THREAD)
    expect(live.routed).toBe(false)
    expect(routeEvent(live).routed).toBe(true)
  })

  it('is idempotent', () => {
    const routed = routeEvent(beginEvent(THREAD))
    expect(routeEvent(routed)).toBe(routed)
  })
})

describe('the clock', () => {
  it('ages while it is live', () => {
    expect(ageEvent(beginEvent(THREAD), 2.5).age).toBe(2.5)
  })

  it('ignores a non-advancing step', () => {
    const live = beginEvent(THREAD)
    expect(ageEvent(live, 0)).toBe(live)
    expect(ageEvent(live, -1)).toBe(live)
  })
})

describe('retirement is a milestone, never a new flag', () => {
  it('derives the id from the event', () => {
    // §21.7.6c's argument: one source of truth, already unioned by §24.3.
    expect(retiredMilestone(THREAD.id)).toBe('event.thread.resolved')
  })
})
