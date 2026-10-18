import { describe, expect, it } from 'vitest'
import {
  GYM_END_HOUR,
  GYM_START_HOUR,
  STUDIO_HOUR_SECONDS,
  atGym,
  gymNear,
  jamesPresent,
  runSecondsAtHour,
  studioClockLabel,
  studioHourOf,
} from './james.ts'

describe('§21.7.0 rule 5 — the clock warns before the gym, and only then', () => {
  it('is near during the gym and the hour before it', () => {
    expect(gymNear(runSecondsAtHour(GYM_START_HOUR) + 1)).toBe(true)
    expect(gymNear(runSecondsAtHour(GYM_START_HOUR - 0.5))).toBe(true)
  })

  it('is not near for the rest of the studio day, so the readout is an event', () => {
    expect(gymNear(0)).toBe(false) // the run opens as the gym ends
    expect(gymNear(runSecondsAtHour(GYM_END_HOUR + 6))).toBe(false)
    expect(gymNear(runSecondsAtHour(GYM_START_HOUR - 2))).toBe(false)
  })
})

describe('§21.7.0 rule 5 — the gym, ten to eleven, every day', () => {
  it('is absent for exactly one hour of the studio clock', () => {
    expect(atGym(9.99)).toBe(false)
    expect(atGym(GYM_START_HOUR)).toBe(true)
    expect(atGym(GYM_END_HOUR - 0.01)).toBe(true)
    expect(atGym(GYM_END_HOUR)).toBe(false)
  })

  it('comes round every studio day, for ever', () => {
    const day = 24 * STUDIO_HOUR_SECONDS
    const gym = runSecondsAtHour(GYM_START_HOUR)
    expect(studioHourOf(gym)).toBeCloseTo(GYM_START_HOUR, 9)
    expect(jamesPresent(gym)).toBe(false)
    expect(jamesPresent(gym + day)).toBe(false)
    expect(jamesPresent(gym + day * 1000)).toBe(false)
  })

  // [amended 2026-10-16] The audit's finding 12: a clock of one studio second a
  // second put the first gym ten hours into a session. The claim is that it is
  // seen inside a session, never at the start of one, and is a short event.
  it('opens with him at his desk, and first takes him away inside the first half hour of a run', () => {
    expect(jamesPresent(0)).toBe(true)
    const first = runSecondsAtHour(GYM_START_HOUR)
    expect(first).toBeGreaterThan(5 * 60)
    expect(first).toBeLessThan(30 * 60)
    for (let t = 0; t < first; t += 5) expect(jamesPresent(t)).toBe(true)
  })

  it('is at his desk for twenty-three hours of every studio day', () => {
    const day = 24 * STUDIO_HOUR_SECONDS
    let away = 0
    for (let t = 0; t < day; t++) if (!jamesPresent(t)) away++
    expect(away / day).toBeCloseTo(1 / 24, 2)
  })

  it('reads as a clock', () => {
    expect(studioClockLabel(0)).toBe('11:00')
    expect(studioClockLabel(runSecondsAtHour(GYM_START_HOUR))).toBe('10:00')
    expect(studioClockLabel(STUDIO_HOUR_SECONDS * 13 + STUDIO_HOUR_SECONDS / 2)).toBe('00:30')
  })

  it('survives a nonsense clock rather than vanishing James for ever', () => {
    expect(jamesPresent(Number.NaN)).toBe(true)
    expect(studioClockLabel(Number.NaN)).toMatch(/^\d\d:\d\d$/)
  })
})
