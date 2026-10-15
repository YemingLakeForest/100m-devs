import { describe, expect, it } from 'vitest'
import {
  BED_PULL_OUT_DB, MAX_TICK_VOICES, TICK_MAX_PER_SECOND, TICK_MIN_PER_SECOND, TICK_VOICE_MS,
  BLIP_COUNT, Blips, RUN_GAP_MS, RUN_MAX_PER_SECOND, SCALE_COUNT, VoiceBudget, bedLevel, nextBlip, nextRunNote, pullOut, runRate, tickRate,
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

describe('the blips never repeat, so a stream of landings is a figure and not a clock', () => {
  it('always moves to another note, whatever the roll and wherever it was', () => {
    for (let prev = 0; prev < BLIP_COUNT; prev++) {
      for (const r of [0, 0.1, 0.25, 0.5, 0.75, 0.999, 1, 5, -3]) {
        const next = nextBlip(prev, r)
        expect(next).not.toBe(prev)
        expect(Number.isInteger(next)).toBe(true)
        expect(next).toBeGreaterThanOrEqual(0)
        expect(next).toBeLessThan(BLIP_COUNT)
      }
    }
  })

  it('can reach every other note, so the family is used and not a pair of them', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 100; i++) seen.add(nextBlip(2, i / 100))
    expect([...seen].sort()).toEqual([0, 1, 3, 4])
  })
})

describe('the run: a hand on the people is answered with a climbing figure', () => {
  it('lifts the cap only while the player is clicking, and never invents work out of none', () => {
    expect(runRate(tickRate(1), true)).toBeGreaterThan(TICK_MAX_PER_SECOND)
    expect(runRate(tickRate(1), true)).toBe(RUN_MAX_PER_SECOND)
    expect(runRate(tickRate(1e6), false)).toBe(tickRate(1e6))
    expect(runRate(0, true)).toBe(0)
  })

  it('stays inside the voice budget at the run’s own rate', () => {
    const budget = new VoiceBudget()
    let live = 0
    const ends: number[] = []
    for (let t = 0; t < 3000; t += 5) {
      if (budget.admit(t, RUN_MAX_PER_SECOND)) ends.push(t + TICK_VOICE_MS)
      live = Math.max(live, ends.filter((e) => e > t).length)
    }
    expect(live).toBeLessThanOrEqual(MAX_TICK_VOICES)
    expect(ends.length).toBeGreaterThan(TICK_MAX_PER_SECOND * 3)
  })

  it('climbs while landings keep coming, one step at a time', () => {
    let note = 0, direction: 1 | -1 = 1
    const heard = [note]
    for (let i = 0; i < 6; i++) {
      ;({ note, direction } = nextRunNote(note, direction, RUN_GAP_MS - 10, 0.5))
      heard.push(note)
    }
    expect(heard).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('turns round at the top and at the bottom rather than leaving the scale', () => {
    let note = 0, direction: 1 | -1 = 1
    const heard: number[] = []
    for (let i = 0; i < SCALE_COUNT * 3; i++) {
      ;({ note, direction } = nextRunNote(note, direction, 80, 0.5))
      heard.push(note)
    }
    expect(Math.max(...heard)).toBe(SCALE_COUNT - 1)
    expect(Math.min(...heard)).toBe(0)
    expect(heard.every((n, i) => i === 0 || Math.abs(n - heard[i - 1]) === 1)).toBe(true)
  })

  it('starts a new run low once the gap has been left', () => {
    for (let r = 0; r < 1; r += 0.1) {
      const { note, direction } = nextRunNote(8, -1, RUN_GAP_MS + 1, r)
      expect(note).toBeLessThan(3)
      expect(direction).toBe(1)
    }
  })
})

describe('the notes are sung where the points land (2026-10-15)', () => {
  // *"currently when I spam clicks the notes are played when I click, not when received, should be received"*
  const sing = (landingsPerSecond: number, seconds: number) => {
    const blips = new Blips()
    const heard: { t: number; note: number }[] = []
    for (let t = 0; t < seconds * 1000; t += 1000 / landingsPerSecond) {
      const note = blips.hand(t, 0.5)
      if (note !== null) heard.push({ t, note })
    }
    return heard
  }

  it('never sings more than the run’s cap a second, however fast the points land', () => {
    for (const rate of [5, 11, 24, 240, 5000]) {
      const heard = sing(rate, 5)
      expect(heard.length / 5, `${rate} landings a second`).toBeLessThanOrEqual(RUN_MAX_PER_SECOND + 0.5)
      for (let i = 1; i < heard.length; i++) expect(heard[i].t - heard[i - 1].t).toBeGreaterThanOrEqual(1000 / RUN_MAX_PER_SECOND - 1e-6)
    }
  })

  it('climbs through a spam, a note to a landing, and turns at the top rather than leaving the scale', () => {
    const heard = sing(11, 3).map((h) => h.note)
    expect(heard.length).toBeGreaterThan(SCALE_COUNT * 2)
    expect(heard[0]).toBeLessThan(3) // a run starts low
    expect(heard.every((n, i) => i === 0 || Math.abs(n - heard[i - 1]) === 1)).toBe(true)
    expect(Math.max(...heard)).toBe(SCALE_COUNT - 1)
  })

  it('starts a new run low once the points have stopped landing for longer than the run’s gap', () => {
    const blips = new Blips()
    for (let t = 0; t < 1000; t += 90) blips.hand(t, 0.5)
    const after = blips.hand(1000 + RUN_GAP_MS + 200, 0.9)
    expect(after).not.toBeNull()
    expect(after!).toBeLessThan(3)
  })

  it('is one voice with the passive landings: a note too close to the last is not sung, whichever of them sang it', () => {
    const blips = new Blips()
    blips.passive(0, 0.5)
    expect(blips.hand(30, 0.5)).toBeNull()
    expect(blips.hand(30 + 1000 / RUN_MAX_PER_SECOND, 0.5)).not.toBeNull()
  })

  it('keeps the passive landings a figure and not a clock: never the same note twice running, always inside the blip family', () => {
    const blips = new Blips()
    let last = -1
    for (let i = 0; i < 200; i++) {
      const note = blips.passive(i * 250, (i * 0.618) % 1)
      expect(note).not.toBe(last)
      expect(note).toBeGreaterThanOrEqual(0)
      expect(note).toBeLessThan(BLIP_COUNT)
      last = note
    }
  })
})
