import { describe, expect, it } from 'vitest'
import { GYM_END_HOUR, GYM_START_HOUR, atGym, jamesPresent, studioHourOf } from './james.ts'

describe('§21.7.0 rule 5 — the gym, ten to eleven, every day', () => {
  it('is absent for exactly one hour of the studio clock', () => {
    expect(atGym(9.99)).toBe(false)
    expect(atGym(GYM_START_HOUR)).toBe(true)
    expect(atGym(GYM_END_HOUR - 0.01)).toBe(true)
    expect(atGym(GYM_END_HOUR)).toBe(false)
  })

  it('comes round every day, for ever', () => {
    // Studio time is a 24-hour clock folded out of run seconds.
    const day = 24 * 3600
    expect(studioHourOf(GYM_START_HOUR * 3600)).toBe(GYM_START_HOUR)
    expect(jamesPresent(GYM_START_HOUR * 3600)).toBe(false)
    expect(jamesPresent(GYM_START_HOUR * 3600 + day)).toBe(false)
    expect(jamesPresent(GYM_START_HOUR * 3600 + day * 1000)).toBe(false)
  })

  it('is at his desk every other hour', () => {
    expect(jamesPresent(0)).toBe(true)
    expect(jamesPresent(12 * 3600)).toBe(true)
  })

  it('survives a nonsense clock rather than vanishing James for ever', () => {
    expect(studioHourOf(Number.NaN)).toBe(0)
    expect(jamesPresent(Number.NaN)).toBe(true)
  })
})
