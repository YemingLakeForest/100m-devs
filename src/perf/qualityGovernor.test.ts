import { describe, expect, it } from 'vitest'
import { QualityGovernor, RATIO_LADDER, SETTLE, SLOW_MS, STALL_MS, WINDOW } from './qualityGovernor.ts'

/** Feed `frames` intervals of `ms`; the last step the governor took, if any. */
const run = (g: QualityGovernor, ms: number, frames: number) => {
  let step: number | null = null
  for (let i = 0; i < frames; i += 1) step = g.sample(ms) ?? step
  return step
}
const WARM = SETTLE + WINDOW

describe('QualityGovernor', () => {
  it('holds a room that makes its frames', () => {
    const g = new QualityGovernor()
    expect(run(g, 16.7, WARM * 5)).toBeNull()
    expect(g.ratio).toBe(RATIO_LADDER[0])
  })

  it('steps down when a window runs slow, and only down', () => {
    const g = new QualityGovernor()
    expect(run(g, SLOW_MS + 8, WARM)).toBe(RATIO_LADDER[1])
    // A fast stretch afterwards does not buy the pixels back.
    run(g, 10, WARM * 3)
    expect(g.ratio).toBe(RATIO_LADDER[1])
  })

  it('stops at the bottom of the ladder', () => {
    const g = new QualityGovernor()
    run(g, 60, WARM * 10)
    expect(g.ratio).toBe(RATIO_LADDER[RATIO_LADDER.length - 1])
  })

  it('does not read a stalled tab as a slow room', () => {
    const g = new QualityGovernor()
    for (let i = 0; i < 20; i += 1) g.sample(STALL_MS * 4)
    expect(run(g, 16.7, WARM * 3)).toBeNull()
    expect(g.ratio).toBe(RATIO_LADDER[0])
  })

  it('enters the ladder at the device ceiling', () => {
    expect(new QualityGovernor(0.8).ratio).toBe(RATIO_LADDER[1])
  })
})
