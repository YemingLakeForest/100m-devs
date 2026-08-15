/**
 * What a run has, and when it got it — GDD §21.0c, §21.7.6, R43, R55.
 *
 * **Run 1 is the trap and nothing else**, and after it every system arrives in
 * the hands of the person who solves it. Those are two gates, not one, and this
 * file is where they meet.
 *
 * ## The floor — §21.0c
 *
 * §21.0's thesis is that the player builds one mental model — *more developers,
 * more speed* — out of nothing but evidence, and then watches it kill the
 * company. That takes about four minutes and it needs all four. A defect counter
 * that appears at the fourth poke and names a job the player cannot hire for, a
 * tickets bar with nothing in it, a hire dial offering two professions before
 * anybody has hired one person, an `UPGRADES` button onto a tree whose root was
 * given away in a cutscene — none of those is *wrong*, and all of them are wrong
 * **there**. So the first Paradigm Shift is the door.
 *
 * ## The ceiling — §21.7.6
 *
 * §21.0c's gate opens onto Run 2, which §13.12.2 makes an hour and a half long,
 * and it would otherwise deliver four systems in the first frame of it. **A
 * system enters the game in the hands of the person who solves it**: defects
 * with Mo, incidents with Serena, tickets with Matt.
 *
 * The apparent circle — Mo is triggered *by* defects and defects wait *for* Mo —
 * is not one, because a system has two halves and only one of them is gated:
 *
 * | | Before the hero | With the hero |
 * |---|---|---|
 * | **The mechanism** — accrues, degrades the rating, costs money | **Running, in full** | Running |
 * | **The instrument** — the counter, the colour, the role on the dial | **Absent** | **Arrives with them** |
 *
 * The player meets defects as a release they were proud of scoring 31: a problem
 * with no handle, which is what makes the person who turns up holding the handle
 * *relief* rather than a tutorial.
 *
 * **Melany and Billy gate nothing, and the difference confirms the rule.** The
 * developer cap and the speedometer have been on screen since Run 1's first
 * minute — they are not systems the player is being introduced to, they are
 * systems the player has been fighting. A person only brings what was not
 * already there.
 *
 * ## Why this is still not a new flag
 *
 * §21.0c refused a second flag on the grounds that it is a second thing that can
 * be wrong after a save migration. That reasoning survives: the answer to "has
 * Mo arrived" is her arrival scene's id in `milestones`, which §24.3 already
 * unions across saves and §21.7.3 already writes. One source of truth, already
 * present, already merged.
 */

import type { HeroId } from '../sim/storyHeroes.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'

/** §4.11's professions, minus the one everybody starts with. */
export interface RoleUnlocks {
  qa: boolean
  sre: boolean
  support: boolean
}

export interface Unlocks {
  /**
   * §21.0c — the systems are *simulated* at all.
   *
   * False for the whole of Run 1. This is the half that keeps §4.14.1's anchor
   * honest: a studio with an empty defect bench scores *better* than the anchor,
   * so a Run 1 running the live rating would hand every first release a quality
   * bonus and quietly re-tune the economy §21 is paced against.
   */
  simulated: boolean
  /**
   * §11 — the studio tech tree, and §11.5's Instant Messenger with it.
   *
   * §15's ladder is a *prestige* ladder. An upgrade screen during Run 1 offers
   * the player a way to make the trap survivable, which is the one thing Run 1
   * must not sell them.
   */
  upgrades: boolean

  /** §21.7.6 — §4.12's backlog, its colour and its density line. Mo brings it. */
  defects: boolean
  /** §21.7.6 — §4.12a's incident list. Serena brings it. */
  incidents: boolean
  /** §21.7.6 — §4.13's ticket bar. Matt brings it. */
  tickets: boolean

  /**
   * §4.11 — which professions §10.10's dial offers.
   *
   * Each one arrives with the hero who makes it worth hiring for. Hiring QA
   * before there is a defect readout is asking the player to buy a fix for a
   * problem the game has not shown them.
   */
  roles: RoleUnlocks

  /**
   * Is *any* backlog on screen — i.e. is §4.15's column drawn at all?
   *
   * §21.7.6b: the set assembles one colour at a time, and **a bar with no hero
   * is not drawn**, empty or otherwise. A rail that reserves space for two bars
   * that do not exist yet is the set being asserted before it exists, and
   * §25.7.2a's rule that a silent row is the loudest kind of furniture applies
   * exactly.
   */
  anyBacklog: boolean
}

/** Which hero hands over which instrument — read off §22.8's roster, never restated. */
const BRINGS: ReadonlyArray<readonly [HeroId, 'defects' | 'incidents' | 'tickets']> =
  STORY_HEROES.filter((h) => h.brings !== null).map((h) => [h.id, h.brings!] as const)

/** Run 1. One lever, and it is hiring. */
const SHUT: Unlocks = {
  simulated: false,
  upgrades: false,
  defects: false,
  incidents: false,
  tickets: false,
  roles: { qa: false, sre: false, support: false },
  anyBacklog: false,
}

/**
 * What this player has, given how many times they have prestiged and who has
 * walked through a door.
 *
 * The two gates are applied in order and the order is the design: **Run 1 has no
 * instruments because it has no shift; Run 2 gets each one when its hero arrives.**
 *
 * `arrived` is a set of {@link HeroId}, which the store derives from
 * `milestones`. Passing the derived set rather than the milestone list keeps
 * this file from having to know what an arrival scene is called.
 */
export function unlocksFor(paradigmShifts: number, arrived: ReadonlySet<HeroId>): Unlocks {
  const shifted = Number.isFinite(paradigmShifts) && paradigmShifts > 0
  if (!shifted) return SHUT

  const has = (id: HeroId): boolean => arrived.has(id)
  const instrument = { defects: false, incidents: false, tickets: false }
  for (const [id, brings] of BRINGS) if (has(id)) instrument[brings] = true

  return {
    simulated: true,
    upgrades: true,
    defects: instrument.defects,
    incidents: instrument.incidents,
    tickets: instrument.tickets,
    // The role arrives with the instrument that makes it legible. Nothing is
    // hired against a problem the player cannot see.
    roles: { qa: instrument.defects, sre: instrument.incidents, support: instrument.tickets },
    anyBacklog: instrument.defects || instrument.incidents || instrument.tickets,
  }
}

/** The empty roster, for callers that have not got one yet. */
export const NO_HEROES: ReadonlySet<HeroId> = new Set<HeroId>()
