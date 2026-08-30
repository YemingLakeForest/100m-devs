import { describe, expect, it } from 'vitest'
import {
  PROXIMA_LY,
  WORLD_CAP,
  devsOnWorld,
  lightYears,
  lightYearsFromSol,
  neighbourhood,
  settledRadiusLy,
  starAt,
  starName,
  worldsFor,
} from './starfield.ts'

describe('the star field', () => {
  it('puts Sol at the origin and Proxima where Proxima is', () => {
    // §21.8's scene names a star and states a distance. A generated first
    // neighbour would put the one hard number in the script somewhere the map
    // disagrees with.
    expect(starAt(0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(lightYearsFromSol(1)).toBeCloseTo(PROXIMA_LY, 6)
    expect(starName(0)).toBe('SOL')
    expect(starName(1)).toBe('PROXIMA CENTAURI')
  })

  it('is a function of the index, not a stored map', () => {
    // The property the whole rung rests on: star four thousand can be asked for
    // without having asked for the four thousand before it, and it answers the
    // same thing every time, on every machine.
    for (const i of [2, 37, 4_001, 999_999]) {
      expect(starAt(i)).toEqual(starAt(i))
      expect(starName(i)).toBe(starName(i))
    }
    expect(starAt(-4)).toEqual(starAt(0))
    expect(starAt(Number.NaN)).toEqual(starAt(0))
  })

  it('keeps one world per unit of area, forever', () => {
    // `r = PROXIMA_LY·√i` is the whole of the radial law, and it is the line
    // that makes the rung infinite: a count that goes as r² is a *constant*
    // density of worlds at every radius. Sparser and the thousandth world would
    // be less of an event than the second; denser and two suns share a pixel.
    for (const n of [10, 1_000, 100_000, 1e8]) {
      const density = n / (Math.PI * settledRadiusLy(n) ** 2)
      expect(density).toBeCloseTo(1 / (Math.PI * PROXIMA_LY ** 2), 9)
    }
  })

  it('orders by index the same way it orders by distance, in the large', () => {
    // Not exactly — two stars on opposite arms can share a radius — but well
    // enough that `neighbourhood` can search a window of indices instead of
    // scanning an unbounded set.
    expect(lightYearsFromSol(10_000)).toBeGreaterThan(lightYearsFromSol(100))
    expect(lightYearsFromSol(100)).toBeGreaterThan(lightYearsFromSol(4))
  })

  it('finds the true nearest neighbours inside the search window', () => {
    // The margin `SEARCH_SPREAD` exists for. A brute-force sweep over a much
    // wider band must not turn up anybody the windowed search missed.
    const worlds = 4_000
    const focus = 1_500
    const want = 25
    const found = neighbourhood(focus, worlds, want)
    expect(found[0]).toBe(focus)
    expect(found).toHaveLength(want)

    const brute = Array.from({ length: worlds }, (_, i) => i)
      .map((i) => ({ i, d: lightYears(focus, i) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, want)
      .map((s) => s.i)
    expect(new Set(found)).toEqual(new Set(brute))
  })

  it('never returns more neighbours than there are worlds', () => {
    expect(neighbourhood(0, 1, 25)).toEqual([0])
    expect(neighbourhood(0, 3, 25)).toHaveLength(3)
    // An address past the end of the studio still lands somewhere real.
    expect(neighbourhood(900, 3, 25)).toHaveLength(3)
  })

  it('fills worlds in order, and only the last one is ragged', () => {
    expect(worldsFor(0)).toBe(1)
    expect(worldsFor(WORLD_CAP)).toBe(1)
    expect(worldsFor(WORLD_CAP + 1)).toBe(2)
    expect(worldsFor(WORLD_CAP * 40.5)).toBe(41)
    expect(devsOnWorld(WORLD_CAP * 2.5, 0)).toBe(WORLD_CAP)
    expect(devsOnWorld(WORLD_CAP * 2.5, 2)).toBe(WORLD_CAP / 2)
    expect(devsOnWorld(WORLD_CAP * 2.5, 3)).toBe(0)
  })

  it('does not saturate — there is no last star', () => {
    // Every count below this rung stops at the thing it fills. This one counts,
    // which is §7.7.1a's whole claim stated as a test.
    expect(worldsFor(1e18)).toBe(1e10)
    expect(Number.isFinite(lightYearsFromSol(1e10))).toBe(true)
  })
})
