import { describe, expect, it } from 'vitest'
import { TOP_RUNG } from './ladder.ts'
import {
  SEAT_WINDOW_GRAIN,
  UNIT_KINDS,
  nominalUnitSize,
  seatWindowFor,
  unitCount,
  unitKindAt,
  unitLabel,
  unitSeats,
  unitSizeAt,
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
      'town',
      'nation',
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

describe('seatWindowFor — where the room looks when you descend (GDD §26.2.2)', () => {
  it('is the studio’s own first floor for the whole of a normal run', () => {
    // The property that keeps §26.2 off Run 1's back: below a thousand
    // developers there is one window and it starts at seat zero, so nothing
    // measured before 2026-08-18 moves because this exists.
    for (const devs of [1, 2, 40, 137, 999]) {
      for (let rung = 0; rung <= 9; rung++) expect(seatWindowFor(rung, 0, devs)).toBe(0)
    }
  })

  it('points at the unit that was actually pointed at', () => {
    // Rung 4's unit is ten thousand people, so block 3 begins at seat 30,000 —
    // and that is the thousand the room must draw, not the studio's first.
    expect(seatWindowFor(4, 3, 1_000_000)).toBe(30_000)
    expect(seatWindowFor(6, 7, 100_000_000)).toBe(7_000_000)
  })

  it('starts on a whole squad, so nobody moves chair', () => {
    // §7.8.1b — a scattered fill is indistinguishable from a redraw. Every
    // window begins on §7.8.1a's grain whatever the unit's own size is.
    for (const rung of [3, 4, 5, 6, 7]) {
      for (const index of [0, 1, 7, 999]) {
        expect(seatWindowFor(rung, index, 100_000_000) % SEAT_WINDOW_GRAIN).toBe(0)
      }
    }
  })

  it('agrees with the arithmetic about what a block of a hundred is', () => {
    expect(SEAT_WINDOW_GRAIN).toBe(100)
  })

  it('never opens a room with nobody in it', () => {
    // A studio that has just entered a rung has barely started filling it, so
    // the last unit's first seat can be past the last person hired. Arriving in
    // an empty room reads as a bug; the last half-full squad is the truth.
    const devs = 10_250
    for (let index = 0; index < 12; index++) {
      const from = seatWindowFor(4, index, devs)
      expect(from).toBeLessThan(devs)
    }
    expect(seatWindowFor(4, 11, devs)).toBe(10_200)
  })

  it('survives nonsense', () => {
    expect(seatWindowFor(3, 0, 0)).toBe(0)
    expect(seatWindowFor(3, -1, -1)).toBe(0)
    expect(seatWindowFor(99, 1e9, Number.NaN)).toBe(0)
  })
})
