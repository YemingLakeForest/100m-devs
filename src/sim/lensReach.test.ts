import { describe, expect, it } from 'vitest'
import { headcountToReach, maxLensLevelFor } from './headcount.ts'
import { lockNote } from './monitorVoice.ts'

/**
 * The sign on a locked stop [2026-10-11] must agree with the door: the price the address bar
 * names is exactly the studio at which the lens's ceiling lets you through. Order, not numbers (§25.3.2).
 */
describe('what a stop costs', () => {
  const levels = [1, 2, 3.6, 3.7, 4.4, 5, 5.5, 5.9, 6.3, 7]

  it('is the first headcount that can reach it, and not one developer sooner', () => {
    for (const level of levels) {
      const price = headcountToReach(level)
      expect(maxLensLevelFor(price), `a studio of ${price} reaches ${level}`).toBeGreaterThanOrEqual(level)
      if (price > 0) expect(maxLensLevelFor(price - 1), `a studio of ${price - 1} does not`).toBeLessThan(level)
    }
  })

  it('never gets cheaper the further out the stop is', () => {
    let last = 0
    for (const level of levels) {
      const price = headcountToReach(level)
      expect(price).toBeGreaterThanOrEqual(last)
      last = price
    }
  })

  it('is free at the garage and beyond reach past the network', () => {
    expect(headcountToReach(1)).toBe(0)
    expect(headcountToReach(8)).toBe(Infinity)
  })

  it('names that price, and the studio that is asking', () => {
    const note = lockNote(headcountToReach(5), 10_000)
    expect(note).toMatch(/NO SIGNAL/)
    expect(note).toContain('100 K')
    expect(note).toContain('10.0 K')
    expect(lockNote(Infinity, 5)).toMatch(/NEEDS MORE/)
  })
})
