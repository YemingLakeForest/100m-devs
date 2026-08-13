/**
 * §21.0c — Run 1 carries one idea.
 *
 * Four lines of production code, and they decide what three quarters of the
 * simulation does during the four minutes §21 is paced against. The store-level
 * consequences are pinned in `backlogs.test.ts`; this is the rule itself.
 */

import { describe, expect, it } from 'vitest'
import { unlocksFor } from './unlocks.ts'

describe('§21.0c — the first Paradigm Shift is the door', () => {
  it('opens nothing during Run 1', () => {
    expect(unlocksFor(0)).toEqual({ roles: false, backlogs: false, upgrades: false })
  })

  it('opens everything from Run 2 onward', () => {
    for (const shifts of [1, 2, 40]) {
      expect(unlocksFor(shifts)).toEqual({ roles: true, backlogs: true, upgrades: true })
    }
  })

  /**
   * **All three or none.** The temptation is to stagger them — roles on the
   * first shift, backlogs on the second — and §4.15's whole argument is that the
   * three backlogs are one system told in three colours. A run with defects but
   * no incidents would be teaching two thirds of a distinction, and a run with
   * backlogs but no roles would be naming a cure the player cannot buy.
   *
   * Asserted as an identity rather than field by field: {@link unlocksFor}
   * returns one of two constants, which is also what lets a React render depend
   * on the result without churning.
   */
  it('is one decision, not three', () => {
    expect(unlocksFor(2)).toBe(unlocksFor(1))
    expect(unlocksFor(0)).toBe(unlocksFor(0))
    expect(unlocksFor(1)).not.toBe(unlocksFor(0))
  })

  /**
   * A save written before this field existed, or corrupted since, reads as a
   * player who has not prestiged — which is the safe direction. The alternative
   * is a first-time player handed an upgrade board in Act I, which is the exact
   * situation this section exists to remove.
   */
  it('treats a missing or nonsense counter as Run 1', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, undefined as unknown as number]) {
      expect(unlocksFor(bad).upgrades).toBe(false)
    }
  })
})
