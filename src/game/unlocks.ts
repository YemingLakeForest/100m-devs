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
 * §21.0e puts **hiring itself** behind that door, which is the largest thing
 * this gate has ever held back and the one that made the rest of it coherent:
 * Run 1 is now literally two people in a garage from the first frame to the
 * Mass Hire, so there is no beat in it where any of the instruments above would
 * have had anything to say.
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
 * | **The instrument** — the counter and its colour | **Absent** | **Arrives with them** |
 *
 * The player meets defects as a release they were proud of scoring 31: a problem
 * with no handle, which is what makes the person who turns up holding the handle
 * *relief* rather than a tutorial.
 *
 * ## The boards — §21.7.7
 *
 * The rule turned out to have one more class of victim than §21.7.6 counted,
 * and it is the class where it is hardest to notice: **an upgrade board is an
 * instrument too.** §11's studio tree was already gated and already had a scene
 * (§11.5, James, at the first shift). §13.7.1's Management tree and §13.9's
 * hero board had neither — both were reachable the moment the object they hang
 * off existed, which for the founder's tree meant *the first frame of Run 1*.
 *
 * So each board now arrives with somebody and on a feeling:
 *
 * | Board | Arrives | On the feeling |
 * |---|---|---|
 * | §11 studio tree | James, at the first shift | already canon (§11.5) |
 * | §13.7.1 founder tree | the founder's own output overtakes a developer's | *"I am the only thing here that still works"* |
 * | GDD §8's hero trees | the first Paradigm Shift, from each person's card | *"these people could be better at this"* |
 *
 * §13.9's shared hero board was the third row, and it went with placement on
 * 2026-09-26: its only currency was XP earned while a hero was posted.
 *
 * **Melany gates nothing, and the difference confirms the rule.** The developer
 * cap has been on screen since Run 1's first minute — it is not a system the
 * player is being introduced to, it is a system the player has been fighting. A
 * person only brings what was not already there.
 *
 * **Billy is the same case** [amended 2026-09-26]. From 2026-08-29 he handed
 * over §13.8's floor — the verb that posted a hero onto part of the studio —
 * and placement was cut at the user's instruction (*"Some mechanics in the old
 * game I want remove, hero placement, different types of hires"*). He brings
 * nothing new again: stand-ups have been on screen since Run 1.
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
   * §21.0e — **can the player hire one developer at a time?**
   *
   * False for the whole of Run 1, and it is the newest and bluntest of this
   * file's gates. §21.0's Act IIa spent six minutes teaching the player to hire,
   * and then §21.0d's Act III opened with James saying *"two of us shipped four
   * games"* to a founder holding forty people. The scene is the trap; a scene
   * whose premise is visibly false on screen does not spring anything.
   *
   * So Run 1 hires exactly once, for a thousand people, and it is not a button —
   * it is a conversation the player cannot decline (§21.0d). Everything before it
   * is two people in a garage.
   *
   * The same one source of truth as every other gate here: the shift counter.
   * There is no new flag, so there is nothing extra to be wrong after a save
   * migration, and a player who has prestiged can never lose the control.
   */
  manualHire: boolean

  /**
   * GDD §8 — the heroes' upgrade trees, each opened from its person's card.
   *
   * *"Upgrades trees should be only available after the first prestige, and it
   * should be opened by heroes info page"* [2026-09-26]. Only the shift, not a
   * scene: the tree is shown per person, so it arrives for each hero with that
   * hero, and the card that carries the door already waits on their arrival.
   *
   * It is also the only upgrade gate left. §11's studio board and §13.7.1's
   * Management tree had one each, and both boards were retired the same day
   * (*"retire the old tree"*). Their argument carries over whole: §15's ladder
   * is a *prestige* ladder, and an upgrade screen during Run 1 offers the player
   * a way to make the trap survivable, which is the one thing Run 1 must not
   * sell them.
   */
  trees: boolean

  /** §21.7.6 — §4.12's backlog, its colour and its density line. Mo brings it. */
  defects: boolean
  /** §21.7.6 — §4.12a's incident list. Serena brings it. */
  incidents: boolean
  /** §21.7.6 — §4.13's ticket bar. Matt brings it. */
  tickets: boolean


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

/** Run 1. One lever, and it is the thumb. */
const SHUT: Unlocks = {
  simulated: false,
  manualHire: false,
  trees: false,
  defects: false,
  incidents: false,
  tickets: false,
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
export function unlocksFor(
  paradigmShifts: number,
  arrived: ReadonlySet<HeroId>,
): Unlocks {
  const shifted = Number.isFinite(paradigmShifts) && paradigmShifts > 0
  if (!shifted) return SHUT

  const has = (id: HeroId): boolean => arrived.has(id)
  const instrument = { defects: false, incidents: false, tickets: false }
  for (const [id, brings] of BRINGS) if (has(id)) instrument[brings] = true

  return {
    simulated: true,
    manualHire: true,
    trees: true,
    defects: instrument.defects,
    incidents: instrument.incidents,
    tickets: instrument.tickets,
    anyBacklog: instrument.defects || instrument.incidents || instrument.tickets,
  }
}

/** The empty roster, for callers that have not got one yet. */
export const NO_HEROES: ReadonlySet<HeroId> = new Set<HeroId>()
