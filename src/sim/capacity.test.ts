import { describe, expect, it } from 'vitest'

import {
  BUILDING_CAP,
  FLOORS_PER_BUILDING,
  FLOOR_CAP,
  GARAGE_CAP,
  addressOf,
  completedFloors,
  floorsFor,
  ordinaryCapacity,
  sceneFor,
} from './capacity.ts'
import { RUNGS, rungFor } from './headcount.ts'

/**
 * §7.8.0 — the scale model, pinned at its boundaries.
 *
 * The prompt that commissioned this asks for 19, 20, 21, 99, 100, 101 and
 * 10,000 specifically, and the choice of numbers is the interesting part: every
 * one of them is *either side of a change of picture*. A capacity model can
 * only be wrong at a boundary, because in the middle of a band nothing is being
 * decided.
 */
describe('the three numbers', () => {
  it('is 20, 100 and a hundred floors of a hundred', () => {
    expect(GARAGE_CAP).toBe(20)
    expect(FLOOR_CAP).toBe(100)
    expect(FLOORS_PER_BUILDING).toBe(100)
    expect(BUILDING_CAP).toBe(10_000)
  })
})

describe('which scene a headcount is drawn as', () => {
  // The twentieth developer *completes* the garage rather than leaving it, and
  // the hundredth completes the floor. A player who has just watched somebody
  // sit down has to be looking at the room they sat down in.
  it.each([
    [1, 'garage'],
    [19, 'garage'],
    [20, 'garage'],
    [21, 'floor'],
    [99, 'floor'],
    [100, 'floor'],
    [101, 'building'],
    [10_000, 'building'],
    [10_001, 'building'],
  ] as const)('%i developers is the %s', (devs, scene) => {
    expect(sceneFor(devs)).toBe(scene)
  })

  it('holds at zero and refuses to crash on nonsense', () => {
    expect(sceneFor(0)).toBe('garage')
    expect(sceneFor(-5)).toBe('garage')
    expect(sceneFor(Number.NaN)).toBe('garage')
  })
})

describe('ordinary capacity', () => {
  it('is the capacity of the scene on screen', () => {
    expect(ordinaryCapacity(19)).toBe(GARAGE_CAP)
    expect(ordinaryCapacity(20)).toBe(GARAGE_CAP)
    expect(ordinaryCapacity(21)).toBe(FLOOR_CAP)
    expect(ordinaryCapacity(100)).toBe(FLOOR_CAP)
    expect(ordinaryCapacity(101)).toBe(BUILDING_CAP)
  })

  /**
   * **Leadership plots do not consume ordinary capacity**, and the reason this
   * is a test rather than a comment is that the two used to share an address
   * space. The founder is `'founder'` and the suite's heroes are `HeroId`s;
   * neither is an integer seat index, so there is no arithmetic by which a
   * leadership hire can reach the seat lattice. This asserts the type-level
   * fact at runtime: the capacity function takes a *developer count* and knows
   * nothing else, so twenty ordinary developers is a full garage whether the
   * suite holds nobody or all of §21.7.3's five.
   */
  it('is untouched by how many heroes are standing in the suite', () => {
    // There is no hero parameter to pass. That is the assertion.
    expect(ordinaryCapacity.length).toBe(1)
    expect(sceneFor(GARAGE_CAP)).toBe('garage')
    expect(sceneFor(GARAGE_CAP + 1)).toBe('floor')
  })
})

describe('floors', () => {
  it('is one floor until the office is full', () => {
    expect(floorsFor(1)).toEqual({ floors: 1, onTop: 1 })
    expect(floorsFor(20)).toEqual({ floors: 1, onTop: 20 })
    expect(floorsFor(100)).toEqual({ floors: 1, onTop: 100 })
  })

  // The storey lands and is then filled — §7.7.2's gag as arithmetic.
  it('opens a second storey for the hundred and first', () => {
    expect(floorsFor(101)).toEqual({ floors: 2, onTop: 1 })
    expect(floorsFor(200)).toEqual({ floors: 2, onTop: 100 })
    expect(floorsFor(201)).toEqual({ floors: 3, onTop: 1 })
  })

  it('tops the building out at a hundred storeys of a hundred', () => {
    expect(floorsFor(BUILDING_CAP)).toEqual({ floors: FLOORS_PER_BUILDING, onTop: FLOOR_CAP })
    expect(floorsFor(BUILDING_CAP).floors * FLOOR_CAP).toBe(BUILDING_CAP)
    expect(completedFloors(BUILDING_CAP)).toBe(FLOORS_PER_BUILDING)
    expect(completedFloors(BUILDING_CAP - 1)).toBe(FLOORS_PER_BUILDING - 1)
  })

  it('draws nothing for nobody', () => {
    expect(floorsFor(0)).toEqual({ floors: 0, onTop: 0 })
  })
})

describe('the address of a developer', () => {
  /**
   * §7.8.1b, stated where it can be tested cheaply: seat *n* is always the same
   * seat. `addressOf` takes one argument and reads no state, so there is no
   * headcount for it to be re-solved against — which is the structural version
   * of the claim, and stronger than sampling it at a few counts.
   */
  it('is a pure function of the index and nothing else', () => {
    expect(addressOf.length).toBe(1)
    for (const i of [0, 19, 20, 99, 100, 101, 9_999]) {
      expect(addressOf(i)).toEqual(addressOf(i))
    }
  })

  it('keeps the garage on floor 0 so the move at 21 renumbers nobody', () => {
    for (let i = 0; i < GARAGE_CAP; i++) {
      expect(addressOf(i)).toEqual({ floor: 0, seat: i })
    }
  })

  it('wraps onto the next storey at a hundred', () => {
    expect(addressOf(99)).toEqual({ floor: 0, seat: 99 })
    expect(addressOf(100)).toEqual({ floor: 1, seat: 0 })
    expect(addressOf(9_999)).toEqual({ floor: 99, seat: 99 })
  })
})

/**
 * The Construction Ladder has to agree with the three numbers, and — the part
 * that is easy to lose — **everything above the building has to not have
 * moved**. The rescale is entirely below 10^4; §13.5's 10^8 gate and the hero
 * reach derived from the same table are downstream of rungs this change does
 * not touch.
 */
describe('the ladder agrees, and stops agreeing above the building', () => {
  it('puts the boundaries on the rungs the scale model names', () => {
    // Inclusive at the top, because the twentieth developer is the one who
    // fills the garage and has to be standing in it when they do.
    expect(rungFor(19).rung).toBe(0)
    expect(rungFor(20).rung).toBe(0)
    expect(rungFor(21).rung).toBe(1)
    expect(rungFor(99).rung).toBe(1)
    expect(rungFor(100).rung).toBe(1)
    expect(rungFor(101).rung).toBe(2)
    expect(rungFor(1_000).rung).toBe(2)
    expect(rungFor(1_001).rung).toBe(3)
    expect(rungFor(10_000).rung).toBe(3)
    expect(rungFor(10_001).rung).toBe(4)
  })

  it('counts a floor as a hundred people wherever the table says floor', () => {
    for (const r of RUNGS) {
      if (r.unit === 'floor') expect(r.unitSize).toBe(FLOOR_CAP)
    }
  })

  it('leaves the building and everything above it exactly where it was', () => {
    expect(RUNGS[4]).toMatchObject({ upTo: 1e5, unit: 'building', unitSize: BUILDING_CAP })
    expect(RUNGS[5]).toMatchObject({ upTo: 1e6, unit: 'campus', unitSize: 1e5 })
    expect(RUNGS[6]).toMatchObject({ upTo: 1e8, unit: 'site', unitSize: 1e6 })
    expect(RUNGS[7]).toMatchObject({ upTo: 1e10, unit: 'world', unitSize: 1e8 })
    // The 100M title gate: 10^8 is still exactly the top of rung 6, so the
    // thing the game is named after is still the moment a world fills.
    expect(rungFor(1e8 - 1).rung).toBe(6)
    expect(rungFor(1e8).rung).toBe(7)
  })
})
