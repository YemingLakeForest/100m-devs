import { describe, expect, it } from 'vitest'
import {
  CAPTION_MAX,
  GLOBE_BANDS,
  NETWORK_BANDS,
  cityCaption,
  compactPopulation,
  globeBand,
  globeCaption,
  networkBand,
  networkCaption,
  percentDone,
} from './monitorVoice.ts'
import { cityName, regionHouses, WORLD_CAPACITY, WORLD_REGIONS } from './worldAddress.ts'

/**
 * The monitor's voice [2026-10-11]. The claims are the rule the file keeps — **deadpan, and every
 * number true; the instruction never goes** — and the order the bands come in. What a band *says* is
 * copy, and copy is not pinned (§25.3.2).
 */
describe('the survey captions', () => {
  const cityFacts = { population: 41_600, total: 100_000, occupied: 416, offices: 416, city: 'London' }

  it('keeps the instruction in every caption that has a control to point at', () => {
    expect(cityCaption(cityFacts).detail).toMatch(/SELECT/)
    expect(cityCaption({ ...cityFacts, occupied: 100, population: 10_000, total: 10_000 }).detail).toMatch(/SELECT/)
    expect(globeCaption({ population: 1e6, capacity: WORLD_CAPACITY, hubs: 1, selected: null }).detail).toMatch(/SELECT/)
    for (const worlds of [1, 2, 10, 11, 100, 400]) expect(networkCaption({ worlds, burned: 0.3 }).detail).toMatch(/TAP/)
  })

  it('says every true number it was given', () => {
    const c = cityCaption(cityFacts)
    expect(c.title).toContain('41,600')
    expect(c.title).toContain('100,000')
    expect(c.detail).toContain('416 / 416')
    const g = globeCaption({ population: 4_300_000, capacity: WORLD_CAPACITY, hubs: 3, selected: null })
    expect(g.title).toContain('4.3M')
    expect(g.title).toContain('3 HUBS')
    expect(networkCaption({ worlds: 42, burned: 0.5 }).title).toContain('42 WORLDS')
  })

  it('says "of the studio" only when the city is not the whole studio', () => {
    // 41,600 under a HUD that said 100 K read as a contradiction: it was a map of one city.
    expect(cityCaption(cityFacts).title).toMatch(/ OF /)
    expect(cityCaption({ ...cityFacts, population: 10_000, total: 10_000, occupied: 100 }).title).not.toMatch(/ OF /)
  })

  it('carries the one constant — the app — on every title, and its progress where the numbers are largest', () => {
    expect(cityCaption(cityFacts).title).toMatch(/1 APP/)
    expect(globeCaption({ population: 1, capacity: WORLD_CAPACITY, hubs: 1, selected: null }).title).toMatch(/1 APP/)
    expect(networkCaption({ worlds: 100, burned: 0.02 }).title).toMatch(/1 APP, 2% DONE/)
  })

  it('never invents a progress it was not given', () => {
    for (const burned of [null, undefined, Number.NaN, Infinity]) {
      expect(networkCaption({ worlds: 10, burned: burned as number | null }).title).not.toMatch(/DONE/)
    }
    expect(percentDone(0)).toBe(0)
    expect(percentDone(1)).toBe(100)
    expect(percentDone(7)).toBe(100)
    expect(percentDone(-3)).toBe(0)
    // Never rounds up to done: 99.9% of an app is not an app.
    expect(percentDone(0.999)).toBe(99)
  })

  it('quotes the chart’s own distance to the next desk, and has nothing to say when there is no next', () => {
    expect(networkCaption({ worlds: 1, burned: 0, nextLy: 4.24 }).detail).toContain('4.2 LIGHT-YEARS')
    expect(networkCaption({ worlds: 1, burned: 0, nextLy: null }).detail).not.toMatch(/\d LIGHT-YEARS/)
  })

  it('names one world a world, not "1 WORLDS"', () => {
    expect(networkCaption({ worlds: 1, burned: 0 }).title).toMatch(/^1 WORLD CONNECTED/)
    expect(networkCaption({ worlds: 2, burned: 0 }).title).toMatch(/^2 WORLDS CONNECTED/)
    expect(globeCaption({ population: 1, capacity: WORLD_CAPACITY, hubs: 1, selected: null }).title).toMatch(/1 HUB /)
  })

  it('says a city is full exactly when it is', () => {
    expect(cityCaption(cityFacts).detail).toMatch(/LONDON IS FULL/)
    expect(cityCaption({ ...cityFacts, occupied: 415 }).detail).not.toMatch(/FULL/)
  })

  it('leaves a selection to the player: no remark over their choice', () => {
    const picked = globeCaption({ population: 1e6, capacity: WORLD_CAPACITY, hubs: 2, selected: 'BERLIN / 0002' })
    expect(picked.detail).toBe('SELECTED: BERLIN / 0002')
  })

  it('fits the survey frame at every address the map can show', () => {
    const lines: string[] = []
    // Every settlement name on every world's first twenty colonies, at the fullest a city can be.
    for (const world of [0, 1, 2, 5, 9, 30, 72]) {
      for (let region = 0; region < WORLD_REGIONS; region += 97) {
        const { first, end } = regionHouses(region)
        const city = cityName(region, world).split(' / ')[0]
        const c = cityCaption({ population: (end - first) * 100, total: 1e13, occupied: end - first, offices: end - first, city })
        lines.push(c.title, c.detail)
      }
    }
    for (const worlds of [1, 9, 10, 99, 100, 420, 5000]) {
      const n = networkCaption({ worlds, burned: 1, nextLy: 123.4 })
      lines.push(n.title, n.detail)
    }
    for (const band of GLOBE_BANDS) lines.push(globeCaption({ population: 0, capacity: 1, hubs: 24, selected: null }).title, band.text + ' · > SELECT A CITY')
    for (const line of lines) expect(line.length, line).toBeLessThanOrEqual(CAPTION_MAX)
  })
})

describe('the bands', () => {
  it('only ever move on as the planet fills', () => {
    const seen: string[] = []
    for (const fill of [0, 0.01, 0.019, 0.02, 0.1, 0.19, 0.2, 0.5, 0.999, 1, 2]) {
      const text = globeBand(fill * WORLD_CAPACITY, WORLD_CAPACITY)
      if (seen[seen.length - 1] !== text) seen.push(text)
    }
    // Each band appears once and in order: a planet does not un-fill.
    expect(seen).toEqual(GLOBE_BANDS.map((b) => b.text))
  })

  it('only ever move on as the network grows', () => {
    const seen: string[] = []
    for (const worlds of [1, 2, 9, 10, 11, 50, 100, 101, 1000]) {
      const text = networkBand(worlds, 4.24)
      if (seen[seen.length - 1] !== text) seen.push(text)
    }
    expect(seen).toEqual(NETWORK_BANDS.map((b) => b.text(4.24)))
  })

  it('has no two bands saying the same thing', () => {
    expect(new Set(GLOBE_BANDS.map((b) => b.text)).size).toBe(GLOBE_BANDS.length)
    expect(new Set(NETWORK_BANDS.map((b) => b.text(4.24))).size).toBe(NETWORK_BANDS.length)
  })
})

describe('compactPopulation', () => {
  it('agrees with what the globe always said, and no longer needs the capacity spelt out by hand', () => {
    expect(compactPopulation(999_999)).toBe('999,999')
    expect(compactPopulation(1_000_000)).toBe('1M')
    expect(compactPopulation(4_250_000)).toBe('4.3M')
    expect(compactPopulation(WORLD_CAPACITY)).toBe('100M')
  })
})
