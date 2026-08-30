import { describe, expect, it } from 'vitest'
import { TOP_RUNG } from './ladder.ts'
import {
  SEAT_WINDOW_GRAIN,
  UNIT_KINDS,
  nominalUnitSize,
  seatForUnit,
  unitCount,
  unitKindAt,
  unitLabel,
  unitSeats,
  unitSizeAt,
  unitWindow,
} from './units.ts'

describe('what the unit is at each rung (GDD §7.7.1)', () => {
  it('is a person for all three rungs of the room', () => {
    // §7.7.1: "Rungs 0–2 are the same picture at three densities, and that is
    // the point." One sprite is one person at every one of them.
    expect([0, 1, 2].map(unitKindAt)).toEqual(['developer', 'developer', 'developer'])
  })

  it('climbs floor, building, campus, town, nation, planet, galaxy above it', () => {
    expect([3, 4, 5, 6, 7, 8, 9].map(unitKindAt)).toEqual([
      'floor',
      'building',
      'campus',
      'site',
      'world',
      'planet',
      'galaxy',
    ])
  })

  it('names every rung of the ladder and no more', () => {
    expect(UNIT_KINDS).toHaveLength(TOP_RUNG + 1)
  })

  it('clamps rather than falling off either end of the ladder', () => {
    expect(unitKindAt(-4)).toBe('developer')
    expect(unitKindAt(99)).toBe('galaxy')
  })

  it('has a word a player would recognise for every one', () => {
    for (let rung = 0; rung <= TOP_RUNG; rung++) {
      expect(unitLabel(rung)).toMatch(/^[a-z]+$/)
    }
    expect(unitLabel(0)).toBe('developer')
    expect(unitLabel(4)).toBe('building')
  })
})

describe('how many developers a unit holds (GDD §7.7.1)', () => {
  it('takes each rung’s size from the bottom of its own headcount band', () => {
    // §7.7.1's table is the source: rung 3 covers 10³–10⁴ and the unit that
    // arrives is a floor, so a floor is 10³ people. Writing these down a second
    // time is the mistake; they are read off the band.
    expect(nominalUnitSize(2)).toBe(1)
    expect(nominalUnitSize(3)).toBe(1e3)
    expect(nominalUnitSize(4)).toBe(1e4)
    expect(nominalUnitSize(6)).toBe(1e6)
    expect(nominalUnitSize(9)).toBe(1e13)
  })

  it('grows monotonically up the ladder', () => {
    const sizes = Array.from({ length: TOP_RUNG + 1 }, (_, r) => nominalUnitSize(r))
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  it('never claims more people than the studio has', () => {
    // A tower with 1,400 developers on it has one full floor and a second with
    // four hundred people on it. Charging the buff for a thousand either way
    // would pay a studio for people it has not hired.
    expect(unitSizeAt(3, 0, 1_400)).toBe(1_000)
    expect(unitSizeAt(3, 1, 1_400)).toBe(400)
    expect(unitSizeAt(3, 2, 1_400)).toBe(0)
  })

  it('is one person per unit throughout the room', () => {
    expect(unitSizeAt(1, 0, 40)).toBe(1)
    expect(unitSizeAt(1, 39, 40)).toBe(1)
    expect(unitSizeAt(1, 40, 40)).toBe(0)
  })
})

describe('how many units there are (GDD §7.7.1)', () => {
  it('counts the partial one, because it is on screen', () => {
    expect(unitCount(3, 1_000)).toBe(1)
    expect(unitCount(3, 1_001)).toBe(2)
    expect(unitCount(3, 10_000)).toBe(10)
  })

  it('is the headcount itself in the room', () => {
    expect(unitCount(2, 437)).toBe(437)
  })

  it('is one even in an empty studio, so there is always something to poke', () => {
    expect(unitCount(6, 0)).toBe(1)
    expect(unitCount(0, 0)).toBe(1)
  })
})

describe('which seats a unit covers', () => {
  it('is the seat itself in the room', () => {
    expect(unitSeats(2, 17, 40)).toEqual({ from: 17, to: 18 })
  })

  it('is a contiguous block above it', () => {
    expect(unitSeats(4, 2, 100_000)).toEqual({ from: 20_000, to: 30_000 })
  })

  it('stops at the last person hired', () => {
    expect(unitSeats(3, 1, 1_400)).toEqual({ from: 1_000, to: 1_400 })
  })

  it('tiles the whole studio exactly — no gaps, no overlaps', () => {
    // The invariant the velocity sum rests on. Every developer belongs to
    // exactly one unit at a given rung, so summing a buff over units and
    // summing it over people give the same answer. If these ranges overlapped,
    // a poke would pay for somebody twice.
    for (const [rung, devs] of [
      [2, 137],
      [3, 4_321],
      [4, 55_000],
      [5, 1_000_000],
    ] as const) {
      let next = 0
      for (let i = 0; i < unitCount(rung, devs); i++) {
        const { from, to } = unitSeats(rung, i, devs)
        expect(from).toBe(next)
        expect(to).toBeGreaterThan(from)
        next = to
      }
      expect(next).toBe(devs)
    }
  })

  it('is empty for a unit past the end of the studio', () => {
    expect(unitSeats(3, 9, 1_400)).toEqual({ from: 1_400, to: 1_400 })
  })
})

/** How many the tower and the city can draw. `room.ts` draws a thousand. */
const MAX = 10
const ROOM = 1000

describe('unitWindow — the ladder is a tree, and this is the address (GDD §26.2.2)', () => {
  it('shows the studio’s own first units for the whole of a normal run', () => {
    // The property that keeps §26.2 off Run 1's back: below a thousand
    // developers every window starts at unit zero, so nothing measured before
    // 2026-08-18 moves because this exists.
    for (const devs of [1, 2, 40, 137, 999]) {
      for (let rung = 0; rung <= TOP_RUNG; rung++) {
        expect(unitWindow(rung, 0, devs, MAX).from).toBe(0)
      }
    }
  })

  it('shows the CHILDREN of the unit the address is in, not the studio’s first ten', () => {
    // The bug this function exists to end, stated as a test. Seat 4,000,000 of
    // a ten-million studio is in town 4, campus 40, building 400, storey 4000 —
    // and each of those is the *fifth* thing on its own screen, because the
    // window it is drawn in starts at its parent's first child.
    const devs = 10_000_000
    const seat = 4_000_000
    expect(unitWindow(6, seat, devs, MAX)).toMatchObject({ from: 0, count: 10, focus: 4 })
    expect(unitWindow(5, seat, devs, MAX)).toMatchObject({ from: 40, count: 10, focus: 0 })
    expect(unitWindow(4, seat, devs, MAX)).toMatchObject({ from: 400, count: 10, focus: 0 })
    expect(unitWindow(3, seat, devs, MAX)).toMatchObject({ from: 4000, count: 10, focus: 0 })
  })

  it('makes a unit past the tenth reachable, which it was not', () => {
    // Every view drew units 0–9 of the studio, so building 400 could not be
    // looked at by any sequence of gestures. It is now the first thing on
    // screen when the address is inside it.
    const devs = 10_000_000
    const w = unitWindow(4, 4_003_500, devs, MAX)
    expect(w.from).toBe(400)
    expect(w.focus).toBe(0)
    expect(unitWindow(3, 4_003_500, devs, MAX)).toMatchObject({ from: 4000, focus: 3 })
  })

  it('descends and lands where it was pointed — the whole path composes', () => {
    // Walk the ladder the way a player does: pick a unit on screen, take its
    // first seat, drop a rung, pick again. Every unit picked must still contain
    // the address at the end, or the descent has silently changed subject.
    const devs = 10_000_000
    let seat = 0
    const picked: Array<{ rung: number; index: number }> = []
    for (const [rung, slot] of [[6, 3], [5, 7], [4, 2], [3, 9]] as const) {
      const w = unitWindow(rung, seat, devs, MAX)
      expect(slot).toBeLessThan(w.count)
      const index = w.from + slot
      picked.push({ rung, index })
      seat = seatForUnit(rung, index, devs)
    }
    for (const { rung, index } of picked) {
      const { from, to } = unitSeats(rung, index, devs)
      expect(seat).toBeGreaterThanOrEqual(from)
      expect(seat).toBeLessThan(to)
    }
    // Town 3, its campus 7, its building 2, its storey 9.
    expect(seat).toBe(3_000_000 + 7 * 100_000 + 2 * 10_000 + 9 * 1_000)
  })

  it('makes the room exactly one storey, because a storey is a roomful', () => {
    // `DEVS_PER_STOREY` and `ROOM_DEV_CAP` are the same thousand, so descending
    // from a tower storey shows that storey's people and nobody else's.
    const devs = 10_000_000
    expect(unitWindow(2, 3_456_789, devs, ROOM)).toMatchObject({
      from: 3_456_000,
      count: 1000,
      focus: 789,
    })
    expect(unitSeats(3, 3456, devs).from).toBe(3_456_000)
  })

  it('pages the one parent too big for the screen — a nation is a hundred towns', () => {
    // Rungs 3–5 branch by ten and fit exactly. A nation branches by a hundred
    // and the city draws ten, so the window is the page holding the address.
    const devs = 100_000_000
    expect(unitWindow(6, 0, devs, MAX)).toMatchObject({ from: 0, count: 10, total: 100 })
    expect(unitWindow(6, 57_000_000, devs, MAX)).toMatchObject({
      from: 50,
      count: 10,
      total: 100,
      focus: 7,
    })
  })

  it('counts the ragged last unit and never draws empty ones', () => {
    // A studio that has just entered a rung has barely started filling it.
    const devs = 10_250
    expect(unitWindow(3, 0, devs, MAX)).toMatchObject({ from: 0, count: 10, total: 10 })
    // The second building holds 250 people — one storey, not ten.
    expect(unitWindow(3, 10_100, devs, MAX)).toMatchObject({ from: 10, count: 1, total: 1 })
  })

  it('clamps an address the studio has shrunk out from under', () => {
    // §14's Paradigm Shift liquidates the swarm. An address left pointing at
    // town 40 must land on the last person, not on an empty plot.
    const w = unitWindow(3, 9_999_999, 500, MAX)
    expect(w.from).toBe(0)
    expect(w.count).toBe(1)
    expect(w.focus).toBe(0)
  })

  it('survives nonsense', () => {
    expect(unitWindow(3, 0, 0, MAX)).toEqual({ from: 0, count: 0, total: 0, focus: -1 })
    expect(unitWindow(-1, -5, -5, MAX)).toEqual({ from: 0, count: 0, total: 0, focus: -1 })
    expect(unitWindow(99, 1e9, Number.NaN, MAX).count).toBe(0)
    expect(Number.isFinite(unitWindow(9, 1e12, 1e13, MAX).from)).toBe(true)
    expect(unitWindow(3, Number.NaN, 5000, Number.NaN).count).toBeGreaterThan(0)
  })
})

describe('seatForUnit — where the address goes when you descend', () => {
  it('is the unit’s first seat', () => {
    expect(seatForUnit(4, 3, 1_000_000)).toBe(30_000)
    expect(seatForUnit(6, 7, 100_000_000)).toBe(7_000_000)
  })

  it('never opens a room with nobody in it', () => {
    // The last unit at any rung is ragged, and its first seat can be past the
    // last person hired. Arriving in an empty room reads as a bug.
    const devs = 10_250
    for (let index = 0; index < 12; index++) {
      expect(seatForUnit(4, index, devs)).toBeLessThan(devs)
    }
  })

  it('agrees with the arithmetic about what a block of a hundred is', () => {
    expect(SEAT_WINDOW_GRAIN).toBe(100)
  })

  it('survives nonsense', () => {
    expect(seatForUnit(3, 0, 0)).toBe(0)
    expect(seatForUnit(3, -1, -1)).toBe(0)
    expect(seatForUnit(99, 1e9, Number.NaN)).toBe(0)
  })
})
