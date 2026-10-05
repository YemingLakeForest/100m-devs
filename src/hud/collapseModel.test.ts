import { describe, expect, it } from 'vitest'
import { D_BASE } from '../sim/entropy.ts'
import { MASS_HIRE_COUNT } from '../game/onboarding.ts'
import { PLATE_MAX_HEADS, curvePath, marginalHire, peakHeads, plateCaption, plateX, plateY, workDone } from './collapseModel.ts'

/**
 * §21 Act IV [2026-10-04] — the plate draws a *hill*, and the claim is about its
 * shape: output rises to a peak below the cap and falls away on the far side, so
 * the thousand the offer promises land on the far slope. Tested as order, never
 * as a headcount, because ρ is the knob §4.1 says is most likely to move.
 */
describe('the collapse plate’s hill', () => {
  it('peaks below the cap, and the Mass Hire lands on the far slope', () => {
    const peak = peakHeads(D_BASE)
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThan(D_BASE)
    expect(workDone(MASS_HIRE_COUNT, D_BASE)).toBeLessThan(workDone(peak, D_BASE) / 10)
  })

  it('really is the maximum: either side of the peak does less work', () => {
    const peak = peakHeads(D_BASE)
    const best = workDone(peak, D_BASE)
    expect(workDone(peak * 0.8, D_BASE)).toBeLessThan(best)
    expect(workDone(peak * 1.2, D_BASE)).toBeLessThan(best)
  })

  it('puts the top of the hill at the top of the plate and the thousand inside the frame', () => {
    const best = workDone(peakHeads(D_BASE), D_BASE)
    expect(plateY(best, best, 96)).toBeCloseTo(0, 9)
    expect(plateY(0, best, 96)).toBe(96)
    expect(plateX(MASS_HIRE_COUNT, 320)).toBeLessThan(320)
    expect(plateX(PLATE_MAX_HEADS * 10, 320)).toBe(320)
  })

  it('draws a path that starts at the left edge', () => {
    expect(curvePath(D_BASE, 320, 96)).toMatch(/^M0\.0 /)
  })

  it('says it is past the peak only once it is', () => {
    expect(plateCaption(10, D_BASE).past).toBe(false)
    expect(plateCaption(500, D_BASE).past).toBe(true)
  })
})

describe('the marginal hire — what the next developer is worth', () => {
  it('starts at about one, shrinks as the studio grows, and goes negative past the peak', () => {
    const at = (d: number) => marginalHire(d, D_BASE).value
    expect(at(4)).toBeGreaterThan(0.99)
    expect(at(50)).toBeLessThan(at(4))
    expect(at(60)).toBeLessThan(at(50))
    expect(at(peakHeads(D_BASE) * 1.4)).toBeLessThan(0)
  })

  it('says so in words: ADDS before the peak, LOSES after it', () => {
    expect(marginalHire(10, D_BASE).label).toMatch(/^ADDS /)
    expect(marginalHire(500, D_BASE).label).toMatch(/^LOSES /)
  })

  it('has a short form that fits a price line, with a real minus sign for a loss', () => {
    expect(marginalHire(10, D_BASE).short).toMatch(/^\+[0-9]/)
    expect(marginalHire(500, D_BASE).short.startsWith('−')).toBe(true)
    expect(marginalHire(10, D_BASE).short.length).toBeLessThanOrEqual(8)
  })

  it('reads a batch as the whole batch', () => {
    expect(Math.abs(marginalHire(10, D_BASE, 5).value)).toBeGreaterThan(Math.abs(marginalHire(10, D_BASE, 1).value))
  })
})
