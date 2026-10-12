import { describe, expect, it } from 'vitest'
import { BREATH_HOLD_MS, BREATH_MS, BREATH_ROLL_STEPS, breathShown, crossedMilestone } from './heldBreath.ts'

/*
 * The claim (docs/PLAN-2026-10-11-juice-layer.md, move 6): the payoff is withheld, then paid in
 * hard steps, and the number that ends up on screen is always the true one.
 */

describe('which headcounts are held for', () => {
  it('names the milestone a hire crossed, and none when it crossed no decade', () => {
    expect(crossedMilestone(900, 1_000)).toBe(1_000)
    expect(crossedMilestone(999, 1_200)).toBe(1_000)
    expect(crossedMilestone(1_000, 9_999)).toBeNull()
    expect(crossedMilestone(50, 99)).toBeNull()
    expect(crossedMilestone(1, 100)).toBeNull()
  })

  it('names the highest decade when a mass hire crosses several', () => {
    expect(crossedMilestone(500, 2_000_000)).toBe(1_000_000)
  })

  it('never holds for a headcount going down, or for no change', () => {
    expect(crossedMilestone(2_000, 900)).toBeNull()
    expect(crossedMilestone(1_000, 1_000)).toBeNull()
  })
})

describe('the held breath shows one short of the milestone, then rolls to the truth in hard steps', () => {
  const from = 900, to = 1_024, M = 1_000

  it('sits on one short of the milestone for the whole hold', () => {
    for (const t of [0, 1, BREATH_HOLD_MS / 2, BREATH_HOLD_MS - 1]) expect(breathShown(t, from, to, M)).toBe(M - 1)
  })

  it('never shows the milestone before the roll and never shows a number past the truth', () => {
    for (let t = 0; t < BREATH_MS; t += 7) {
      const v = breathShown(t, from, to, M)!
      expect(v).toBeGreaterThanOrEqual(M - 1)
      expect(v).toBeLessThanOrEqual(to)
    }
  })

  it('rolls upward only, in no more than a handful of distinct values, and lands on the truth', () => {
    const seen: number[] = []
    for (let t = BREATH_HOLD_MS; t < BREATH_MS; t++) {
      const v = breathShown(t, from, to, M)!
      if (seen.at(-1) !== v) seen.push(v)
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1])
    expect(seen.length).toBeLessThanOrEqual(BREATH_ROLL_STEPS + 1)
    expect(seen.at(-1)).toBeLessThanOrEqual(to)
    expect(breathShown(BREATH_MS, from, to, M)).toBeNull()
  })

  it('is over inside the time a held moment is allowed, and nothing is shown before it begins', () => {
    expect(breathShown(-1, from, to, M)).toBeNull()
    expect(BREATH_MS).toBeLessThanOrEqual(5_000)
  })

  it('under reduced motion holds, then snaps: no roll', () => {
    expect(breathShown(BREATH_HOLD_MS - 1, from, to, M, true)).toBe(M - 1)
    expect(breathShown(BREATH_HOLD_MS, from, to, M, true)).toBeNull()
  })

  it('has nothing to withhold when the truth is the number itself', () => {
    expect(breathShown(100, 999, 1_000, 1_000)).toBe(999)
    for (let t = BREATH_HOLD_MS; t < BREATH_MS; t += 10) expect(breathShown(t, 999, 1_000, 1_000)).toBeLessThanOrEqual(1_000)
    expect(breathShown(BREATH_MS, 999, 1_000, 1_000)).toBeNull()
  })
})
