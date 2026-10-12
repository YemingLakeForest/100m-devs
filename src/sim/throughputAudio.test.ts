import { describe, expect, it } from 'vitest'
import {
  BED_PULL_OUT_DB, MAX_TICK_VOICES, TICK_MAX_PER_SECOND, TICK_MIN_PER_SECOND, TICK_VOICE_MS,
  VoiceBudget, bedLevel, pullOut, tickRate,
} from './throughputAudio.ts'

/*
 * Claims, not values (CLAUDE.md): as the world's output grows the individual clicks thin out and
 * one continuous bed takes over, pulling the camera back makes it louder, and however fast the
 * work arrives the ears are never asked for more than a fixed number of voices.
 */

const rates = [0, 0.5, 1, 10, 1e2, 1e3, 1e4, 1e6, 1e9, 1e12]

describe('the bed takes over from the clicks as output grows', () => {
  it('is silent with no work, and never quieter as the work grows, within 0..1', () => {
    expect(bedLevel(0)).toBe(0)
    expect(bedLevel(-5)).toBe(0)
    expect(bedLevel(NaN)).toBe(0)
    const levels = rates.map(bedLevel)
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1])
    for (const l of levels) { expect(l).toBeGreaterThanOrEqual(0); expect(l).toBeLessThanOrEqual(1) }
    expect(bedLevel(1e12)).toBe(1)
  })

  it('thins the clicks from a handful a second to about one, and never to nothing while work goes on', () => {
    const t = rates.slice(1).map(tickRate)
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeLessThanOrEqual(t[i - 1])
    expect(tickRate(1)).toBeLessThanOrEqual(TICK_MAX_PER_SECOND)
    expect(tickRate(1e12)).toBe(TICK_MIN_PER_SECOND)
    expect(tickRate(0)).toBe(0)
  })

  it('is louder pulled out than close in, by the step the reference makes, and by no more', () => {
    const near = 10 ** (-BED_PULL_OUT_DB / 20)
    expect(pullOut(0.3)).toBe(1)
    expect(pullOut(3)).toBeCloseTo(near, 6)
    for (let z = 0.3; z < 3; z += 0.1) expect(pullOut(z + 0.1)).toBeLessThanOrEqual(pullOut(z) + 1e-12)
    expect(BED_PULL_OUT_DB).toBeGreaterThan(6)
    expect(BED_PULL_OUT_DB).toBeLessThan(12)
  })
})

describe('the voice budget (§20)', () => {
  function run(arrivalsPerSecond: number, rate: number, seconds = 20) {
    const budget = new VoiceBudget()
    let admitted = 0, peak = 0
    const live: number[] = []
    const step = 1000 / arrivalsPerSecond
    for (let t = 0; t < seconds * 1000; t += step) {
      while (live.length && live[0] <= t) live.shift()
      if (budget.admit(t, tickRate(rate))) { admitted++; live.push(t + TICK_VOICE_MS) }
      peak = Math.max(peak, live.length)
    }
    return { admitted: admitted / seconds, peak }
  }

  it('never has more voices sounding than the cap, however fast the work arrives', () => {
    for (const arrivals of [1, 5, 24, 240, 5000]) {
      for (const rate of [1, 100, 1e6]) expect(run(arrivals, rate).peak).toBeLessThanOrEqual(MAX_TICK_VOICES)
    }
  })

  it('lets through no more clicks a second than the rate allows, and fewer as the world grows', () => {
    const small = run(24, 1), big = run(24, 1e9)
    expect(small.admitted).toBeLessThanOrEqual(TICK_MAX_PER_SECOND + 0.5)
    expect(big.admitted).toBeLessThanOrEqual(TICK_MIN_PER_SECOND + 0.5)
    expect(big.admitted).toBeLessThan(small.admitted)
  })

  it('stays quiet when the rate says nothing is happening, and wakes the moment it does', () => {
    const b = new VoiceBudget()
    expect(b.admit(0, 0)).toBe(false)
    expect(b.admit(10, 3)).toBe(true)
  })
})
