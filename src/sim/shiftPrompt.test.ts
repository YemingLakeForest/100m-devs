/**
 * The one shift prompt — plan 2026-10-16 §1's ruling, phase 3.3. Pins the
 * predicate's two doors and the order of its two fuses, not their seconds.
 */

import { describe, expect, it } from 'vitest'
import { CAP_BOUND_STALL_S, PAST_PEAK_STALL_S, shiftPays, studioStalled } from './shiftPrompt.ts'
import { peakHeads } from './entropy.ts'

const CAP = 1_000
const UNDER = Math.floor(peakHeads(CAP)) - 50
const AT = Math.floor(peakHeads(CAP))
const PAST = Math.ceil(peakHeads(CAP)) + 100

describe('shiftPays — the shift buys the next ×10 of seats', () => {
  it('is true when the run’s BP covers what the next level still costs, whatever the studio is doing', () => {
    expect(shiftPays(30, 25, UNDER, CAP, 0)).toBe(true)
    expect(shiftPays(25, 25, UNDER, CAP, 0)).toBe(true)
  })

  it('is false one BP short, and with nothing to bank, and when there is no level left', () => {
    expect(shiftPays(24, 25, UNDER, CAP, 0)).toBe(false)
    expect(shiftPays(0, 0, UNDER, CAP, 0)).toBe(false)
    expect(shiftPays(1e9, Number.POSITIVE_INFINITY, UNDER, CAP, 0)).toBe(false)
  })
})

describe('shiftPays — or the run has stopped', () => {
  it('fires on the shorter fuse past the peak than at it', () => {
    expect(PAST_PEAK_STALL_S).toBeLessThan(CAP_BOUND_STALL_S)
    // Past the peak: the short fuse.
    expect(shiftPays(0, 25, PAST, CAP, PAST_PEAK_STALL_S - 1)).toBe(false)
    expect(shiftPays(0, 25, PAST, CAP, PAST_PEAK_STALL_S)).toBe(true)
    // At the cap: the same seconds are not enough; the long fuse is.
    expect(shiftPays(0, 25, AT, CAP, PAST_PEAK_STALL_S)).toBe(false)
    expect(shiftPays(0, 25, AT, CAP, CAP_BOUND_STALL_S)).toBe(true)
  })

  it('says nothing to a studio whose clock is not running', () => {
    expect(shiftPays(0, 25, PAST, CAP, 0)).toBe(false)
  })
})

describe('studioStalled — what the store’s clock counts', () => {
  it('counts past the peak whether or not there is anything to buy', () => {
    expect(studioStalled(PAST, CAP, true)).toBe(true)
    expect(studioStalled(PAST, CAP, false)).toBe(true)
  })

  it('counts at the cap only when nothing is affordable', () => {
    expect(studioStalled(AT, CAP, false)).toBe(true)
    expect(studioStalled(AT, CAP, true)).toBe(false)
  })

  it('never counts a studio with room to hire', () => {
    expect(studioStalled(UNDER, CAP, false)).toBe(false)
  })
})
