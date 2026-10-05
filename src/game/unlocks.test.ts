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
const ALL = roster('james', 'serena', 'matt', 'billy')

describe('§21.0c — the first Paradigm Shift is the door', () => {
  it('opens nothing during Run 1, however many heroes are somehow on staff', () => {
    for (const who of [NO_HEROES, ALL]) {
      const u = unlocksFor(0, who)
      expect(u.simulated).toBe(false)
      expect(u.defects).toBe(false)
      expect(u.incidents).toBe(false)
      expect(u.tickets).toBe(false)
      expect(u.anyBacklog).toBe(false)
      // §21.7.7 — and not anybody's upgrades either. Run 1's whole argument is
      // one lever, and an upgrade bought with the money the trap is about to
      // take is a second one.
      expect(u.trees).toBe(false)
      // §21.0e — and not hiring. The bluntest gate in the file and the newest:
      // Run 1 is two people in a garage from the first frame to the Mass Hire,
      // because §21.0d's scene says "two of us" and has to be right about it.
      expect(u.manualHire).toBe(false)
    }
  })

  it('starts simulating, and opens the trees, on the first shift', () => {
    for (const shifts of [1, 2, 40]) {
      const u = unlocksFor(shifts, NO_HEROES)
      expect(u.simulated).toBe(true)
      // GDD §8 — *"Upgrades trees should be only available after the first
      // prestige"* [2026-09-26]. The shift and nothing else: each tree is
      // reached from its person's card, which waits on their arrival already.
      expect(u.trees).toBe(true)
      // §21.0e — hiring comes back with everything else, and unlike the
      // instruments it needs nobody to carry it through the door: it is a verb
      // the player already knows, withheld for one run to keep a scene honest.
      expect(u.manualHire).toBe(true)
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
      expect(unlocksFor(bad, ALL).trees).toBe(false)
    }
  })
})


describe('§21.7.6 — a system enters in the hands of the person who solves it', () => {
  it('simulates the mechanism while the instrument is still absent', () => {
    // The half that makes the whole rule work: defects accrue, degrade the
    // rating and cost money from the first frame of Run 2. The player meets
    // them as a release they were proud of scoring 31 — a problem with no
    // handle — which is what makes Serena relief rather than a tutorial.
    const u = unlocksFor(1, NO_HEROES)
    expect(u.simulated).toBe(true)
    expect(u.defects).toBe(false)
    expect(u.incidents).toBe(false)
    expect(u.tickets).toBe(false)
  })

  it('hands each instrument over with its own hero, and nobody else’s', () => {
    // [amended 2026-10-04] Mo is gone and her counter is Serena's; Matt took the
    // incident list as well as the ticket bar.
    const serena = unlocksFor(1, roster('serena'))
    expect(serena.defects).toBe(true)
    expect(serena.incidents).toBe(false)
    expect(serena.tickets).toBe(false)

    const matt = unlocksFor(1, roster('matt'))
    expect(matt.incidents).toBe(true)
    expect(matt.tickets).toBe(true)
    expect(matt.defects).toBe(false)
  })

  /**
   * §21.7.6 — "a person only brings what was not already there." Billy bends
   * §4.1, whose gauge has been on screen since Run 1; he brings a tree and no
   * readout. The rule is confirmed by the hero it does not apply to.
   */
  it('gates no readout on Billy or James', () => {
    const neither = unlocksFor(1, NO_HEROES)
    const both = unlocksFor(1, roster('billy', 'james'))
    expect(both.defects).toBe(neither.defects)
    expect(both.incidents).toBe(neither.incidents)
    expect(both.tickets).toBe(neither.tickets)
  })

  it('draws §4.15’s column only once something is in it — §21.7.6b', () => {
    // "A bar with no hero is not drawn at all, empty or otherwise." A rail that
    // reserves space for two bars that do not exist yet is the set asserted
    // before it exists.
    expect(unlocksFor(1, NO_HEROES).anyBacklog).toBe(false)
    expect(unlocksFor(1, roster('billy')).anyBacklog).toBe(false)
    expect(unlocksFor(1, roster('serena')).anyBacklog).toBe(true)
    expect(unlocksFor(1, ALL).anyBacklog).toBe(true)
  })

  it('assembles the set one colour at a time, and completes it', () => {
    const order: HeroId[] = ['serena', 'matt']
    const held: HeroId[] = []
    const seen: number[] = []
    for (const id of order) {
      held.push(id)
      const u = unlocksFor(1, roster(...held))
      seen.push([u.defects, u.incidents, u.tickets].filter(Boolean).length)
    }
    expect(seen).toEqual([1, 3])
  })
})
