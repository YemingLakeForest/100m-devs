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
import { NO_BOARDS, NO_HEROES, unlocksFor } from './unlocks.ts'

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
      // §21.7.7 — and not the two personal boards either, whatever the story
      // thinks it has already shown this player. Run 1's whole argument is one
      // lever, and a skill tree bought with the money the trap is about to take
      // is a second one.
      expect(u.founderBoard).toBe(false)
      expect(u.heroBoard).toBe(false)
      // §21.0e — and not hiring. The bluntest gate in the file and the newest:
      // Run 1 is two people in a garage from the first frame to the Mass Hire,
      // because §21.0d's scene says "two of us" and has to be right about it.
      expect(u.manualHire).toBe(false)
    }
  })

  it('starts simulating, and opens the tree, on the first shift', () => {
    for (const shifts of [1, 2, 40]) {
      const u = unlocksFor(shifts, NO_HEROES)
      expect(u.simulated).toBe(true)
      expect(u.upgrades).toBe(true)
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
      expect(unlocksFor(bad, ALL).upgrades).toBe(false)
    }
  })
})

/**
 * §21.7.7 — an upgrade board is an instrument too, and that is the class of
 * victim §21.7.6 did not count.
 *
 * §11's studio tree was already gated and already had a scene. §13.7.1's
 * Management tree and §13.9's hero board had neither: both were reachable the
 * moment the object they hang off existed, and for the founder's tree that
 * meant the first frame of Run 1.
 */
describe('§21.7.7 — the two personal boards arrive with somebody', () => {
  it('opens neither on a shift alone', () => {
    // The shift opens §11's tree, because James hands that one over in §21.6's
    // scene at the same moment. The other two have their own scenes and their
    // own feelings, and neither of those is "you prestiged".
    const u = unlocksFor(1, ALL)
    expect(u.upgrades).toBe(true)
    expect(u.founderBoard).toBe(false)
    expect(u.heroBoard).toBe(false)
  })

  it('opens each one on its own introduction, and only that one', () => {
    expect(unlocksFor(1, ALL, { founder: true, hero: false }).founderBoard).toBe(true)
    expect(unlocksFor(1, ALL, { founder: true, hero: false }).heroBoard).toBe(false)
    expect(unlocksFor(1, ALL, { founder: false, hero: true }).heroBoard).toBe(true)
    expect(unlocksFor(1, ALL, { founder: false, hero: true }).founderBoard).toBe(false)
  })

  it('defaults to neither, so a caller that has not derived them cannot leak one', () => {
    expect(unlocksFor(1, ALL, NO_BOARDS).founderBoard).toBe(false)
    expect(unlocksFor(1, ALL).heroBoard).toBe(false)
  })

  it('shuts both again for Run 1 even when the scenes are on record', () => {
    // The two gates are applied in order and §21.0c's is the floor. A player
    // who somehow carries both introductions into a fresh Run 1 — which a
    // `?act` jump or a hand-edited save can produce — still gets Run 1.
    const u = unlocksFor(0, ALL, { founder: true, hero: true })
    expect(u.founderBoard).toBe(false)
    expect(u.heroBoard).toBe(false)
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
   * §4.2's cap, which has been on screen since Run 1's first minute. She arrives
   * holding a *branch*, and no readout appears when she sits down. The rule is
   * confirmed by the hero it does not apply to.
   *
   * **Billy used to be in this case and is not** [amended 2026-08-29]. The
   * reasoning was the same and it was right about the *speedometer*: he brings
   * no instrument either. What it missed is that he brings §13.8's floor, which
   * is not a readout and is much larger than one.
   */
  it('gates no readout on Melany or Billy', () => {
    const neither = unlocksFor(1, NO_HEROES)
    const both = unlocksFor(1, roster('melany', 'billy', 'james'))
    expect(both.defects).toBe(neither.defects)
    expect(both.incidents).toBe(neither.incidents)
    expect(both.tickets).toBe(neither.tickets)
    expect(both.roles).toEqual(neither.roles)
  })

  /**
   * §21.7.6 — **§13.8's floor arrives with Billy, and with nobody else.**
   *
   * The gate the rule had been missing since it was written. Placement is the
   * most consequential verb in Layer 1 — it is what makes every hero worth
   * anything at all — and it was reachable from the frame anybody had two of
   * them, handed over by no one.
   */
  it('hands the floor over with Billy, and only with Billy', () => {
    expect(unlocksFor(1, NO_HEROES).heroPlacement).toBe(false)
    expect(unlocksFor(1, roster('james', 'mo', 'serena', 'matt', 'melany')).heroPlacement).toBe(false)
    expect(unlocksFor(1, roster('billy')).heroPlacement).toBe(true)
    expect(unlocksFor(1, ALL).heroPlacement).toBe(true)
  })

  it('keeps the floor shut for the whole of Run 1, Billy or no Billy', () => {
    // §21.0c's gate runs first and outranks the roster: a save that somehow has
    // Billy recorded before a shift is a save from a career that prestiged,
    // and §21.0's four minutes are still four minutes about one lever.
    expect(unlocksFor(0, ALL).heroPlacement).toBe(false)
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
