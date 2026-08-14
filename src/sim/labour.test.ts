import { describe, expect, it } from 'vitest'
import { formatBuildTime, formatLabour } from './labour.ts'

const DAY = 86400
const YEAR = DAY * 365

describe('§10.11.2 — the labour ladder', () => {
  it('reads a garage project in man-hours', () => {
    // One developer, two minutes: 120 man-seconds.
    expect(formatLabour(120)).toBe('0.03 man-hours')
    expect(formatLabour(8 * 3600)).toBe('8 man-hours')
  })

  it('climbs to man-days past one of them', () => {
    expect(formatLabour(DAY)).toBe('1 man-days')
    expect(formatLabour(212 * DAY)).toBe('212 man-days')
    expect(formatLabour(364 * DAY)).toBe('364 man-days')
  })

  it('climbs to man-years past 365 man-days', () => {
    expect(formatLabour(YEAR)).toBe('1 man-years')
    expect(formatLabour(4.8 * YEAR)).toBe('4.8 man-years')
    expect(formatLabour(999 * YEAR)).toBe('999 man-years')
  })

  it('skips the century and goes straight to man-millennia', () => {
    expect(formatLabour(1000 * YEAR)).toBe('1 man-millennia')
    expect(formatLabour(2.9 * 1000 * YEAR)).toBe('2.9 man-millennia')
  })

  it('climbs to man-aeons, then lets the number grow', () => {
    expect(formatLabour(1e6 * YEAR)).toBe('1 man-aeons')
    expect(formatLabour(41 * 1e6 * YEAR)).toBe('41 man-aeons')
    // Past 999 man-aeons the word stops and §10.2's suffix ladder takes over.
    expect(formatLabour(4.1e6 * 1e6 * YEAR)).toBe('4.1 M man-aeons')
  })

  it('spells the unit out and never normalises across the ladder', () => {
    // Two figures that would be the same number if the column were normalised
    // read in different units — which §10.11.2 rule 3 says is the point.
    const small = formatLabour(0.5 * DAY)
    const large = formatLabour(3 * YEAR)
    expect(small).toContain('man-')
    expect(large).toContain('man-')
    expect(small).not.toBe(large)
  })
})

describe('§10.11.1 — dev time elapsed', () => {
  it('reads a sub-second ship in milliseconds', () => {
    expect(formatBuildTime(0.4)).toBe('400ms')
  })

  it('reads seconds, then minutes', () => {
    expect(formatBuildTime(4.5)).toBe('4.5s')
    expect(formatBuildTime(45)).toBe('45s')
    expect(formatBuildTime(59)).toBe('59s')
    expect(formatBuildTime(60)).toBe('1m')
    expect(formatBuildTime(90)).toBe('2m')
  })

  it('reads hours and minutes, then days and hours', () => {
    expect(formatBuildTime(3600)).toBe('1h')
    expect(formatBuildTime(3660)).toBe('1h 1m')
    expect(formatBuildTime(DAY)).toBe('1d')
    expect(formatBuildTime(DAY + 3600)).toBe('1d 1h')
  })
})
