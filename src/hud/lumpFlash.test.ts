import { describe, expect, it } from 'vitest'
import { LUMP_SECONDS, isLump } from './lumpFlash.ts'

describe('a cash lump is a payout, not the drip', () => {
  it('does not flash for one frame of income or payroll', () => {
    // A frame is a fraction of a second; whatever the flow is, a frame of it is not two seconds of it.
    for (const flow of [-5_000, -40, 0, 40, 5_000]) expect(isLump(1_000, 1_000 + flow / 60, flow)).toBe(false)
  })

  it('flashes for a gain bigger than two seconds of flow, at any scale', () => {
    for (const flow of [10, 1_000, 1_000_000]) expect(isLump(0, flow * LUMP_SECONDS * 1.01, flow)).toBe(true)
  })

  it('treats a bleeding studio the same way: a payout is a payout', () => {
    expect(isLump(-50_000, 100_000, -2_000)).toBe(true)
  })

  it('never flashes for a loss, however large', () => {
    expect(isLump(100_000, 0, 10)).toBe(false)
  })

  it('does not flash a one-dollar poke in a studio with no flow', () => {
    expect(isLump(0, 1, 0)).toBe(false)
  })
})
