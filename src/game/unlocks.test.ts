/**
 * §21.0c and §21.7.6 — the floor and the ceiling.
 *
 * A few dozen lines of production code, and they decide what three quarters of
 * the simulation does during the four minutes §21 is paced against and the
 * ninety §13.12.2 gives Run 2. The store-level consequences are pinned in
 * `backlogs.test.ts`; this is the rule itself.
 */

import { describe, expect, it } from 'vitest'
import type { HeroId } from '../sim/storyHeroes.ts'
import { NO_HEROES, unlocksFor } from './unlocks.ts'

const roster = (...ids: HeroId[]): ReadonlySet<HeroId> => new Set(ids)
const ALL = roster('james', 'mo', 'serena', 'matt', 'melany', 'billy')

describe('§21.0c — the first Paradigm Shift is the door', () => {
  it('opens nothing during Run 1, however many heroes are somehow on staff', () => {
    for (const who of [NO_HEROES, ALL]) {
      const u = unlocksFor(0, who)
      expect(u.simulated).toBe(false)
      expect(u.upgrades).toBe(false)
      expect(u.defects).toBe(false)
      expect(u.incidents).toBe(false)
      expect(u.tickets).toBe(false)
      expect(u.anyBacklog).toBe(false)
      expect(u.roles).toEqual({ qa: false, sre: false, support: false })
    }
  })

  it('starts simulating, and opens the tree, on the first shift', () => {
    for (const shifts of [1, 2, 40]) {
      const u = unlocksFor(shifts, NO_HEROES)
      expect(u.simulated).toBe(true)
      expect(u.upgrades).toBe(true)
    }
  })

  /**
   * A save written before this field existed, or corrupted since, reads as a
   * player who has not prestiged — which is the safe direction. The alternative
   * is a first-time player handed an upgrade board in Act I, which is the exact
   * situation this section exists to remove.
   */
  it('treats a missing or nonsense counter as Run 1', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, undefined as unknown as number]) {
      expect(unlocksFor(bad, ALL).upgrades).toBe(false)
    }
  })
})

describe('§21.7.6 — a system enters in the hands of the person who solves it', () => {
  it('simulates the mechanism while the instrument is still absent', () => {
    // The half that makes the whole rule work: defects accrue, degrade the
    // rating and cost money from the first frame of Run 2. The player meets
    // them as a release they were proud of scoring 31 — a problem with no
    // handle — which is what makes Mo relief rather than a tutorial.
    const u = unlocksFor(1, NO_HEROES)
    expect(u.simulated).toBe(true)
    expect(u.defects).toBe(false)
    expect(u.incidents).toBe(false)
    expect(u.tickets).toBe(false)
  })

  it('hands each instrument over with its own hero, and nobody else’s', () => {
    expect(unlocksFor(1, roster('mo')).defects).toBe(true)
    expect(unlocksFor(1, roster('mo')).incidents).toBe(false)
    expect(unlocksFor(1, roster('mo')).tickets).toBe(false)

    expect(unlocksFor(1, roster('serena')).incidents).toBe(true)
    expect(unlocksFor(1, roster('serena')).defects).toBe(false)

    expect(unlocksFor(1, roster('matt')).tickets).toBe(true)
    expect(unlocksFor(1, roster('matt')).defects).toBe(false)
  })

  it('brings the role that answers the problem, never before the readout', () => {
    // "Offering QA before there is a defect readout is asking the player to buy
    // a fix for a problem the game has not shown them."
    expect(unlocksFor(1, NO_HEROES).roles).toEqual({ qa: false, sre: false, support: false })
    expect(unlocksFor(1, roster('mo')).roles.qa).toBe(true)
    expect(unlocksFor(1, roster('mo')).roles.sre).toBe(false)
    expect(unlocksFor(1, roster('serena')).roles.sre).toBe(true)
    expect(unlocksFor(1, roster('matt')).roles.support).toBe(true)
  })

  /**
   * §21.7.6 — "a person only brings what was not already there." Melany bends
   * §4.2's cap and Billy bends §4.1's entropy, and both of those have been on
   * screen since Run 1's first minute. They arrive holding a *branch*, and
   * nothing appears on the HUD when they sit down. The rule is confirmed by the
   * two heroes it does not apply to.
   */
  it('gates nothing on Melany or Billy', () => {
    const neither = unlocksFor(1, NO_HEROES)
    const both = unlocksFor(1, roster('melany', 'billy', 'james'))
    expect(both.defects).toBe(neither.defects)
    expect(both.incidents).toBe(neither.incidents)
    expect(both.tickets).toBe(neither.tickets)
    expect(both.roles).toEqual(neither.roles)
  })

  it('draws §4.15’s column only once something is in it — §21.7.6b', () => {
    // "A bar with no hero is not drawn at all, empty or otherwise." A rail that
    // reserves space for two bars that do not exist yet is the set asserted
    // before it exists.
    expect(unlocksFor(1, NO_HEROES).anyBacklog).toBe(false)
    expect(unlocksFor(1, roster('melany', 'billy')).anyBacklog).toBe(false)
    expect(unlocksFor(1, roster('mo')).anyBacklog).toBe(true)
    expect(unlocksFor(1, ALL).anyBacklog).toBe(true)
  })

  it('assembles the set one colour at a time, and completes it', () => {
    const order: HeroId[] = ['mo', 'serena', 'matt']
    const held: HeroId[] = []
    const seen: number[] = []
    for (const id of order) {
      held.push(id)
      const u = unlocksFor(1, roster(...held))
      seen.push([u.defects, u.incidents, u.tickets].filter(Boolean).length)
    }
    expect(seen).toEqual([1, 2, 3])
  })
})
