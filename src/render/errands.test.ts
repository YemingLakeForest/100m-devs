/**
 * The away population's bodies — GDD §7.8.6, §7.8.9.
 *
 * This replaces `hands.test.ts`, which tested the version of the toy that lived
 * in `ambient.ts` and produced nothing: *"the whole joke is that it produces
 * exactly nothing — §7.8.6 rule 2 guarantees no Story Point moves in either
 * direction, so a player who spends thirty seconds herding eight wanderers has
 * achieved precisely as much as one who watched."* Rule 2 was reversed on
 * 2026-08-26 and herding now works, so that file's subject moved to
 * `sim/slackOff.ts` (who is away, and what it costs) and to this module (where
 * their body is while it happens).
 *
 * What is asserted here is only the second half. **Whether somebody may be
 * picked up is not a question this layer answers any more** — that is the
 * simulation's, precisely so the answer does not change when the player zooms
 * out and the bodies stop being drawn.
 */

import { describe, expect, it } from 'vitest'
import { createErrands, type Spots } from './errands.ts'
import { PITCH_COL, roomLanes, screenToGrid, seatGridPoint, gridPointToScreen } from './room.ts'
import { TRAVEL_SECONDS, type Away } from '../sim/slackOff.ts'

const DEVS = 60
const LANES = roomLanes(DEVS)

/** A cooler and a whiteboard, out past the back wall where the props stand. */
const SPOTS: Spots = {
  water: [{ gx: -1.6, gy: 2 * PITCH_COL }],
  whiteboard: [{ gx: -1.6, gy: 6 * PITCH_COL }],
  window: [{ gx: -1.6, gy: 9 * PITCH_COL }],
  sofa: [],
}

function entry(over: Partial<Away> = {}): Away {
  return { seat: 23, errand: 'water', phase: 'out', elapsed: 0, pick: 0.5, ...over }
}

function make() {
  const e = createErrands()
  const step = (roster: readonly Away[], dt = 1 / 60, carryAt: { x: number; y: number } | null = null) =>
    e.update(dt, {
      roster,
      seatGrid: seatGridPoint,
      toScreen: gridPointToScreen,
      toGrid: screenToGrid,
      spots: SPOTS,
      lanes: LANES,
      drawnIndividually: true,
      worldScale: 1,
      carryAt,
    })
  return { e, step }
}

/** How far from their own desk seat 23 is being drawn. */
function distance(e: ReturnType<typeof createErrands>, seat = 23): number {
  const o = e.offsetFor(seat)
  return Math.hypot(o.x, o.y)
}

describe('walking an errand', () => {
  it('starts at the desk and gets further away', () => {
    const { e, step } = make()
    step([entry({ elapsed: 0 })])
    expect(distance(e)).toBeLessThan(40)
    step([entry({ elapsed: 1 })])
    const early = distance(e)
    step([entry({ elapsed: 3 })])
    expect(distance(e)).toBeGreaterThan(early)
    e.destroy()
  })

  it('holds still at the far end rather than pacing', () => {
    const { e, step } = make()
    step([entry({ phase: 'there', elapsed: 1 })])
    const a = e.offsetFor(23)
    step([entry({ phase: 'there', elapsed: 4 })])
    const b = e.offsetFor(23)
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1)
    e.destroy()
  })

  it('walks home from where they were standing, not from the desk', () => {
    // The half that makes the drop work — §7.8.9's "they walk back, unhurried"
    // rather than the teleport this replaced.
    const { e, step } = make()
    for (let t = 0; t < TRAVEL_SECONDS; t += 1 / 60) step([entry({ elapsed: t })])
    step([entry({ phase: 'there', elapsed: 1 })])
    const atProp = distance(e)
    expect(atProp).toBeGreaterThan(40)

    step([entry({ phase: 'back', elapsed: 0 })])
    // The first frame of the walk home is still out by the prop. If the route
    // were rebuilt from the desk they would snap to their chair here.
    expect(distance(e)).toBeGreaterThan(atProp * 0.6)

    for (let t = 0; t < TRAVEL_SECONDS * 2; t += 1 / 60) step([entry({ phase: 'back', elapsed: t })])
    expect(distance(e)).toBeLessThan(20)
    e.destroy()
  })

  it('is continuous — nobody jumps across the floor between frames', () => {
    const { e, step } = make()
    let prev = e.offsetFor(23)
    for (let t = 0; t < TRAVEL_SECONDS; t += 1 / 60) {
      step([entry({ elapsed: t })])
      const now = e.offsetFor(23)
      expect(Math.hypot(now.x - prev.x, now.y - prev.y)).toBeLessThan(20)
      prev = now
    }
    e.destroy()
  })

  it('sends a whiteboard huddle to the whiteboard and not to the cooler', () => {
    const { e, step } = make()
    step([entry({ errand: 'whiteboard', phase: 'there', elapsed: 1 })])
    const board = e.offsetFor(23)
    step([entry({ errand: 'water', phase: 'there', elapsed: 1 })])
    const water = e.offsetFor(23)
    expect(Math.hypot(board.x - water.x, board.y - water.y)).toBeGreaterThan(20)
    e.destroy()
  })

  it('spreads a huddle out rather than stacking people in one spot', () => {
    const { e, step } = make()
    const huddle: Away[] = [24, 25, 26].map((seat) =>
      entry({ seat, errand: 'whiteboard', phase: 'there', elapsed: 1 }),
    )
    step(huddle)
    const at = huddle.map((a) => {
      const o = e.offsetFor(a.seat)
      const d = gridPointToScreen(seatGridPoint(a.seat))
      return { x: d.x + o.x, y: d.y + o.y }
    })
    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) {
        expect(Math.hypot(at[i].x - at[j].x, at[i].y - at[j].y)).toBeGreaterThan(4)
      }
    }
    e.destroy()
  })

  it('stands people outside their own desk when the room has no props left', () => {
    // §7.8.1's crowding takes the walkway and the room hands over no spots.
    // Nobody crosses the floor to a cooler that is not there — they stand about
    // where they already were, which is §7.8.9's own note and keeps the
    // crowding joke intact.
    const e = createErrands()
    const roster = [entry({ phase: 'there', elapsed: 2 })]
    e.update(1 / 60, {
      roster,
      seatGrid: seatGridPoint,
      toScreen: gridPointToScreen,
      toGrid: screenToGrid,
      spots: { water: [], whiteboard: [], window: [], sofa: [] },
      lanes: LANES,
      drawnIndividually: true,
      worldScale: 1,
      carryAt: null,
    })
    // Off their chair, but not across the room.
    expect(distance(e)).toBeGreaterThan(0)
    expect(distance(e)).toBeLessThan(120)
    e.destroy()
  })

  it('does not teleport a walker home when the camera comes back', () => {
    // §7.8.6 rule 4 drops every body above rung 2, so zooming out and back in
    // rebuilds this layer from nothing. Somebody who was walking home must be
    // reconstructed at the far end of their errand, not at their chair — a
    // teleport on a camera move is the exact defect the walk-back replaced.
    const { e, step } = make()
    const fresh = createErrands()
    step([entry({ phase: 'back', elapsed: 0 })])
    fresh.update(1 / 60, {
      roster: [entry({ phase: 'back', elapsed: 0 })],
      seatGrid: seatGridPoint,
      toScreen: gridPointToScreen,
      toGrid: screenToGrid,
      spots: SPOTS,
      lanes: LANES,
      drawnIndividually: true,
      worldScale: 1,
      carryAt: null,
    })
    expect(distance(fresh)).toBeGreaterThan(40)
    e.destroy()
    fresh.destroy()
  })
})

describe('the drag — §7.8.9', () => {
  it('puts the body exactly where the finger is, with no easing', () => {
    // A held object that lags the pointer does not feel held.
    const { e, step } = make()
    const desk = gridPointToScreen(seatGridPoint(23))
    step([entry({ phase: 'carried' })], 1 / 60, { x: desk.x + 300, y: desk.y - 120 })
    const o = e.offsetFor(23)
    expect(o.x).toBeCloseTo(300, 6)
    expect(o.y).toBeCloseTo(-120, 6)
    e.destroy()
  })

  it('leaves them where they were dropped, and walks home from there', () => {
    // The reported defect: *"when I move a person out from their desk, they
    // should end at where I drop them and walk back to their desk."* They did
    // not. `at` was only written by the walking branch, so a carried developer's
    // recorded position was still wherever they had been standing when they
    // were picked up — and letting go snapped them back across the floor to
    // that spot before the walk home began. The teleport the drop was supposed
    // to remove, moved one step later in the sequence.
    const { e, step } = make()
    const desk = gridPointToScreen(seatGridPoint(23))
    const drop = { x: desk.x + 260, y: desk.y + 150 }

    step([entry({ phase: 'carried' })], 1 / 60, drop)
    const held = e.offsetFor(23)

    // Let go. The very next frame is the first of the walk home, and it has to
    // start where the hand was — not at the desk, and not back at the cooler.
    step([entry({ phase: 'back', elapsed: 0 })])
    const released = e.offsetFor(23)
    expect(Math.hypot(released.x - held.x, released.y - held.y)).toBeLessThan(30)

    // And from there they walk, rather than staying put.
    for (let t = 0; t < TRAVEL_SECONDS * 2; t += 1 / 60) step([entry({ phase: 'back', elapsed: t })])
    expect(distance(e)).toBeLessThan(20)
    e.destroy()
  })

  it('follows the finger on the very next frame', () => {
    const { e, step } = make()
    const desk = gridPointToScreen(seatGridPoint(23))
    step([entry({ phase: 'carried' })], 1 / 60, { x: desk.x + 10, y: desk.y })
    step([entry({ phase: 'carried', elapsed: 1 })], 1 / 60, { x: desk.x + 400, y: desk.y })
    expect(e.offsetFor(23).x).toBeCloseTo(400, 6)
    e.destroy()
  })
})

describe('§7.8.6 rule 4 — above rung 2 the bodies switch off', () => {
  it('draws nobody when individuals are not drawn', () => {
    const e = createErrands()
    e.update(1 / 60, {
      roster: [entry({ phase: 'there', elapsed: 2 })],
      seatGrid: seatGridPoint,
      toScreen: gridPointToScreen,
      toGrid: screenToGrid,
      spots: SPOTS,
      lanes: LANES,
      drawnIndividually: false,
      worldScale: 0.05,
      carryAt: null,
    })
    // **The simulation is still running and still charging for them.** That is
    // the whole reason the roster lives in `sim/` — this layer going quiet must
    // not make the studio productive again.
    expect(e.isAway(23)).toBe(false)
    e.destroy()
  })
})

describe('housekeeping', () => {
  it('forgets people who are no longer on the roster', () => {
    const { e, step } = make()
    step([entry({ phase: 'there', elapsed: 1 })])
    expect(e.isAway(23)).toBe(true)
    step([])
    expect(e.isAway(23)).toBe(false)
    e.destroy()
  })

  it('survives a roster naming a seat past the end of the room', () => {
    // The room rebuilds its desks on every hire and the roster is culled on the
    // next tick, so there is one frame where the two disagree.
    const { e, step } = make()
    expect(() => step([entry({ seat: 5000, phase: 'there', elapsed: 1 })])).not.toThrow()
    e.destroy()
  })
})
