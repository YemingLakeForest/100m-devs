import { describe, expect, it } from 'vitest'
import { formatManWeeks, manWeekReport, planState } from './manWeeks.ts'
import { passiveVelocity, D_BASE } from '../sim/entropy.ts'

describe('man-weeks — the unit the plan is written in', () => {
  it('takes the plan straight off the headcount, with no model in it', () => {
    // That is the whole point. Nobody estimates throughput off a load curve;
    // they count heads. The figure needs to be the naive one or it is not the
    // number in the player's head.
    expect(manWeekReport(40, 0).planned).toBe(40)
    expect(manWeekReport(1000, 0).planned).toBe(1000)
  })

  it('agrees with the plan while the studio is small', () => {
    // Early on the assumption is very nearly right, which is exactly why the
    // player trusts it later.
    const r = manWeekReport(10, passiveVelocity(10, D_BASE))
    expect(r.ratio).toBeGreaterThan(0.99)
    expect(r.lost).toBeLessThan(0.2)
  })

  it('opens the gap §6 is about, in the plan’s own currency', () => {
    // A thousand developers against a hundred of capacity. The plan says a
    // thousand man-weeks; §4.1 delivers single figures.
    const r = manWeekReport(1000, passiveVelocity(1000, D_BASE))
    expect(r.planned).toBe(1000)
    expect(r.delivered).toBeLessThan(20)
    expect(r.lost).toBeGreaterThan(980)
    expect(planState(r.ratio)).toBe('gone')
  })

  it('is worst somewhere past the optimum, not at the end', () => {
    // The curve turns over: the gap in absolute man-weeks keeps growing while
    // the studio does, which is the number that makes the trap feel personal.
    const at = (n: number) => manWeekReport(n, passiveVelocity(n, D_BASE)).lost
    expect(at(200)).toBeGreaterThan(at(80))
    expect(at(1000)).toBeGreaterThan(at(200))
  })

  it('does not paint an empty studio as a failure', () => {
    // Act I opens on one developer and, for a frame, on none. 0/0 is not a
    // collapse.
    expect(manWeekReport(0, 0).ratio).toBe(1)
    expect(planState(manWeekReport(0, 0).ratio)).toBe('holding')
  })

  it('never reports delivering more than nothing from nothing', () => {
    expect(manWeekReport(-5, -5).planned).toBe(0)
    expect(manWeekReport(-5, -5).delivered).toBe(0)
    expect(manWeekReport(10, 40).ratio).toBe(1)
  })
})

describe('formatManWeeks', () => {
  it('keeps a decimal exactly where the gap is the point', () => {
    // A studio of a thousand delivering 8.4 is the joke; rounding it to 8
    // throws away precision at the one headcount that matters.
    expect(formatManWeeks(8.42)).toBe('8.4')
    expect(formatManWeeks(40)).toBe('40')
    expect(formatManWeeks(1000)).toBe('1.0K')
    expect(formatManWeeks(1.2e6)).toBe('1.2M')
  })

  it('drops a trailing zero rather than writing 8.0', () => {
    expect(formatManWeeks(8)).toBe('8')
  })
})
