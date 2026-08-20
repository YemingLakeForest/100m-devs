import { describe, expect, it } from 'vitest'
import {
  SOURCE_CAP,
  SOURCE_SPAN,
  capForLevel,
  sourceWindow,
  spanForLevel,
  MAX_SOURCES,
  TALLY_PERIOD,
  formatTally,
  groupSizeFor,
  tallyAlpha,
  tallyRise,
  tallySources,
} from './tallies.ts'
import { outputShare } from '../sim/aggregate.ts'

const seatsAt = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }))

describe('it thins out as the floor fills — GDD §8.2b', () => {
  it('gives one numeral per person while there are few enough people', () => {
    for (const n of [1, 2, 8, 20, MAX_SOURCES]) {
      expect(groupSizeFor(n)).toBe(1)
      expect(tallySources(seatsAt(n), n, () => 1)).toHaveLength(n)
    }
  })

  it('aggregates rather than stopping, at every headcount', () => {
    // §8.2b: "it must thin out as the floor fills, **not stop**." So there is
    // never a headcount at which the numerals go away — only ones where each
    // speaks for more people.
    for (const n of [1, 37, 100, 999, 1000, 10_000]) {
      const sources = tallySources(seatsAt(Math.min(n, 10_000)), n, () => 1)
      expect(sources.length).toBeGreaterThan(0)
      expect(sources.length).toBeLessThanOrEqual(MAX_SOURCES)
    }
  })

  it('gives every developer their own numeral for the whole of Run 1', () => {
    // §21 tops out at forty developers, so if aggregation starts below that the
    // per-person spread is never once visible during the only act anybody has
    // played — which is exactly what a first pass at this did.
    expect(groupSizeFor(40)).toBe(1)
    expect(tallySources(seatsAt(40), 40, () => 1)).toHaveLength(40)
  })

  it('aggregates per row, then per squad — §7.8.1a’s own units', () => {
    // Not an arbitrary divisor: a row is ten and a squad is a hundred, so the
    // numeral always sits over a group whose edges the player can see.
    expect(groupSizeFor(100)).toBe(1)
    expect(groupSizeFor(101)).toBe(10)
    expect(groupSizeFor(1000)).toBe(10)
    expect(groupSizeFor(1001)).toBe(100)
    expect(groupSizeFor(10_000)).toBe(100)
    expect(groupSizeFor(10_001)).toBe(1000)
  })

  it('keeps the total honest when it aggregates', () => {
    // The information survives the thinning: ten people earning 2 each become
    // one numeral saying 20, not one saying 2 and nine people going silent.
    const sources = tallySources(seatsAt(100), 100, () => 2)
    const total = sources.reduce((a, s) => a + s.rate, 0)
    expect(total).toBeCloseTo(200, 9)
  })

  it('anchors an aggregate on the middle of its group, not its first seat', () => {
    // A `+40` over the left-hand end of a row reads as belonging to the person
    // standing there, which is the exact misreading aggregation should avoid.
    // Past a squad the seats group by ten, so the first numeral speaks for
    // seats 0–9 and belongs over the middle of them.
    const seats = Array.from({ length: 200 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }))
    const [first] = tallySources(seats, 200, () => 1)
    expect(first.x).toBeCloseTo(4.5, 9)
    expect(first.y).toBeCloseTo(0, 9)
  })

  it('draws nothing for an empty studio rather than a numeral over nobody', () => {
    expect(tallySources([], 0, () => 1)).toEqual([])
    expect(tallySources(seatsAt(10), 0, () => 1)).toEqual([])
  })
})

describe('it is the display of §4.9a — the spread, on screen', () => {
  it('shows one developer emitting several times what their neighbour does', () => {
    // §4.9a: "One developer emitting +5 beside one emitting +0.2 is the entire
    // idea, on screen, with no readout." Per-person granularity plus the roll
    // has to actually produce that range across a small team.
    const n = 30
    const rates = tallySources(seatsAt(n), n, (i) => outputShare(4242, n, i)).map((s) => s.rate)
    expect(Math.max(...rates) / Math.min(...rates)).toBeGreaterThan(8)
  })

  it('emits at one rate per source, so a fast developer shows a bigger number', () => {
    // Not more numerals — a bigger one. Emitting more often would read as the
    // floor getting busier rather than as anybody getting better.
    const fast = tallySources(seatsAt(2), 2, (i) => (i === 0 ? 5 : 0.2))
    expect(formatTally(fast[0].rate * TALLY_PERIOD)).toBe('+5.8')
    expect(formatTally(fast[1].rate * TALLY_PERIOD)).toBe('+0.23')
  })
})

describe('formatTally — quiet, and never a lie', () => {
  it('never says +0 while the simulation is banking points', () => {
    // §25.1's rule, applied at the other end of the scale: at this size a
    // near-zero yield is the *slow* developer's whole characterisation, and
    // rounding it away deletes the half of §4.9a that is not the hero.
    expect(formatTally(0.004)).toBe('+0.01')
    expect(formatTally(0)).toBe('+0.01')
  })

  it('short-forms the big ones rather than running off the head', () => {
    expect(formatTally(1)).toBe('+1')
    expect(formatTally(4.25)).toBe('+4.3')
    expect(formatTally(42)).toBe('+42')
    expect(formatTally(4200)).toBe('+4.2K')
    expect(formatTally(4.2e9)).toBe('+4.2B')
  })

  it('never exceeds the pool’s glyph row, out to the top of §7.7.1', () => {
    // 10¹³ developers at 10¹³ story points a second is the last rung's rate,
    // and a numeral that ran off its head there would fail exactly where the
    // game is at its largest.
    for (const sp of [0.001, 0.5, 9.99, 999, 1e4, 9.9e12, 1e15, 1.15e16]) {
      expect(formatTally(sp).length).toBeLessThanOrEqual(7)
    }
  })
})

describe('the motion — quiet, and readable before it goes', () => {
  it('rises and never falls', () => {
    let previous = -1
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const y = tallyRise(t)
      expect(y).toBeGreaterThanOrEqual(previous)
      previous = y
    }
  })

  it('holds full opacity long enough to be read, then leaves', () => {
    expect(tallyAlpha(0)).toBe(1)
    expect(tallyAlpha(0.3)).toBe(1)
    expect(tallyAlpha(1)).toBe(0)
    expect(tallyAlpha(0.67)).toBeGreaterThan(0)
    expect(tallyAlpha(0.67)).toBeLessThan(1)
  })

  it('clamps outside its own life rather than going negative', () => {
    expect(tallyAlpha(-1)).toBe(1)
    expect(tallyAlpha(4)).toBe(0)
    expect(tallyRise(-1)).toBe(0)
  })
})

describe('it thins by where the lens is, not only by headcount', () => {
  // A thousand seats are a thousand seats whether they measure 2,700 pixels
  // across or 334. The cap that made a squad readable stacked eight numerals
  // deep over a floor plan, so the group a numeral speaks for is a property of
  // the lens: a person at Desk and Squad, a squad at Floor, a storey at
  // Building.
  it('leaves the people levels exactly as they were', () => {
    expect(capForLevel(0)).toBe(MAX_SOURCES)
    expect(capForLevel(1)).toBe(MAX_SOURCES)
    expect(tallySources(seatsAt(40), 40, () => 1, { cap: capForLevel(1) })).toHaveLength(40)
  })

  it('gives a floor one numeral per squad', () => {
    const sources = tallySources(seatsAt(1000), 1000, () => 1, { cap: capForLevel(2) })
    expect(sources).toHaveLength(10)
  })

  it('gives a building one numeral for the storey it has open', () => {
    expect(tallySources(seatsAt(1000), 1000, () => 1, { cap: capForLevel(3) })).toHaveLength(1)
  })

  it('still never stops, at any level or headcount', () => {
    for (let level = 0; level <= 3; level++) {
      for (const n of [1, 37, 100, 999, 1000]) {
        const sources = tallySources(seatsAt(n), n, () => 1, { cap: capForLevel(level) })
        expect(sources.length).toBeGreaterThan(0)
        expect(sources.length).toBeLessThanOrEqual(SOURCE_CAP[level])
      }
    }
  })

  it('keeps the total honest wherever it aggregates', () => {
    // Everything the layer covers is accounted for exactly once — the property
    // §4.9a hangs on, and the one aggregation is easiest to break.
    for (let level = 0; level <= 3; level++) {
      const window = sourceWindow(1000, 0, spanForLevel(level))
      const total = tallySources(seatsAt(1000), 1000, () => 0.5, {
        cap: capForLevel(level),
        ...window,
      }).reduce((sum, s) => sum + s.rate, 0)
      expect(total).toBeCloseTo((window.to - window.from) * 0.5, 6)
    }
  })

  it('speaks for the address own squad while the people are individuals', () => {
    // A hundred people, one numeral each, and the boundary is the squad rather
    // than a hundred seats either side of the camera — a window that slides
    // with the lens pops numerals in and out at an edge nobody can see.
    expect(spanForLevel(0)).toBe(SOURCE_SPAN[0])
    expect(sourceWindow(1000, 0, spanForLevel(0))).toEqual({ from: 0, to: 100 })
    expect(sourceWindow(1000, 99, spanForLevel(0))).toEqual({ from: 0, to: 100 })
    expect(sourceWindow(1000, 100, spanForLevel(1))).toEqual({ from: 100, to: 200 })
    expect(sourceWindow(1000, 640, spanForLevel(1))).toEqual({ from: 600, to: 700 })

    const sources = tallySources(seatsAt(1000), 1000, () => 1, {
      cap: capForLevel(0),
      ...sourceWindow(1000, 640, spanForLevel(0)),
    })
    expect(sources).toHaveLength(100)
  })

  it('covers the whole floor once the members are squads', () => {
    expect(sourceWindow(1000, 640, spanForLevel(2))).toEqual({ from: 0, to: 1000 })
    expect(sourceWindow(1000, 640, spanForLevel(3))).toEqual({ from: 0, to: 1000 })
  })

  it('does not fall off the end of a part-filled floor', () => {
    // 6,400 developers put 400 on the top storey, and the address can be any of
    // them. The window clamps to what is drawn rather than emitting over seats
    // nobody is sitting in.
    expect(sourceWindow(400, 380, MAX_SOURCES)).toEqual({ from: 300, to: 400 })
    expect(sourceWindow(400, 999, MAX_SOURCES)).toEqual({ from: 300, to: 400 })
    expect(sourceWindow(0, 0, MAX_SOURCES)).toEqual({ from: 0, to: 0 })
    expect(tallySources(seatsAt(400), 400, () => 1, { from: 300, to: 400 })).toHaveLength(100)
  })

  it('rounds a lens between two levels to the nearer one', () => {
    expect(capForLevel(1.4)).toBe(MAX_SOURCES)
    expect(capForLevel(1.6)).toBe(10)
    expect(capForLevel(-3)).toBe(MAX_SOURCES)
    expect(capForLevel(99)).toBe(1)
  })
})
