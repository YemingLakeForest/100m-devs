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
 * | **The instrument** — the counter, the colour, the role on the dial | **Absent** | **Arrives with them** |
 *
 * The player meets defects as a release they were proud of scoring 31: a problem
 * with no handle, which is what makes the person who turns up holding the handle
 * *relief* rather than a tutorial.
 *
 * ## The three boards — §21.7.7
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
 * | §13.9 hero board | the first level, and therefore the first point | *"this person is getting better and I have something to spend"* |
 *
 * **Melany gates nothing, and the difference confirms the rule.** The developer
 * cap has been on screen since Run 1's first minute — it is not a system the
 * player is being introduced to, it is a system the player has been fighting. A
 * person only brings what was not already there.
 *
 * **Billy used to be the second half of that sentence, and is not any more**
 * [amended 2026-08-29]. The reasoning was identical and it was right about the
 * speedometer: he hands over no readout, because §4.3's gauge has been the most
 * looked-at number in the game since the garage. What it missed is that he
 * hands over something much larger than a readout — §13.8's floor. See
 * {@link Unlocks.heroPlacement}. The rule is unbroken; the audit of what counts
 * as "a system" was short by one.
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
   * §21.7.7 — §13.7.1's Management tree, the founder's own board.
   *
   * **Your desk is not gated and never will be.** §4.5d is explicit that the
   * corner seat is yours from the garage, clickable at every zoom, and it is
   * the whole clicker layer of Run 1. What is gated is the *board*, which is
   * §21.7.6's two halves applied to the one system where the person who solves
   * it is the player: the mechanism (you code, and your curve never dilutes)
   * has been running since the first tap; the instrument arrives the first time
   * §4.5d's joke is visible in a readout rather than only in the equations.
   */
  founderBoard: boolean
  /**
   * §21.7.7 — §13.9's shared skill board, reached from a hero's card.
   *
   * Gated on there being a **point to spend**, which is §26.1.6's wall in
   * miniature: a board full of purchases and no currency is exactly the screen
   * that could not be built in the 2026-08-13 session. §22.9's card is not
   * gated — a card is who somebody is, and that has been true since Act I.
   */
  heroBoard: boolean

  /**
   * §21.7.6 — **§13.8's floor, and Billy brings it** [added 2026-08-29].
   *
   * This is the rule's own blind spot, closed. §21.7.7 found the first one — an
   * upgrade board is an instrument too — and placement is the second and larger
   * one: it is the single most consequential control in Layer 1, it was reachable
   * from the first frame anybody had two heroes, and nobody handed it over.
   *
   * The two halves split exactly as the table at the top of this file draws
   * them. The **mechanism** — coverage, reach, the §13.10 cost of a benched
   * hero, the XP that only accrues under coverage — has been running the whole
   * time. What waited is the **instrument**: the roster strip's placement verb,
   * the armed gesture, the floor as something you can put a person on.
   *
   * And the apparent circle is the same non-circle Mo's is. Placement is not
   * gated on *having placed somebody*; it is gated on the studio having fallen
   * apart in a way a person can fix, which is §21.7.3's `billyArrives`. The
   * player meets §4.1 as a gauge reading half and no handle — and then the man
   * whose entire job is that gauge walks in holding one.
   *
   * §22.9's card stays ungated for the same reason it stayed ungated for the
   * hero board: a card is who somebody is. What the card loses before this is
   * one button.
   */
  heroPlacement: boolean

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

/** Run 1. One lever, and it is the thumb. */
const SHUT: Unlocks = {
  simulated: false,
  upgrades: false,
  manualHire: false,
  founderBoard: false,
  heroBoard: false,
  heroPlacement: false,
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
export function unlocksFor(
  paradigmShifts: number,
  arrived: ReadonlySet<HeroId>,
  /**
   * §21.7.7 — which boards have been introduced.
   *
   * Derived by the store from `milestones`, exactly as `arrived` is, and for
   * exactly the same reason: **this file does not know what a scene is called.**
   * §21.7.6c's argument holds either way — the truth lives in `milestones`,
   * which §24.3 already unions across saves — and passing the two answers
   * rather than the ids keeps that fact in one module instead of two.
   *
   * Defaulted, so every existing caller keeps compiling and reads the honest
   * answer for a player who has been introduced to nothing.
   */
  boards: BoardIntros = NO_BOARDS,
): Unlocks {
  const shifted = Number.isFinite(paradigmShifts) && paradigmShifts > 0
  if (!shifted) return SHUT

  const has = (id: HeroId): boolean => arrived.has(id)
  const instrument = { defects: false, incidents: false, tickets: false }
  for (const [id, brings] of BRINGS) if (has(id)) instrument[brings] = true

  return {
    simulated: true,
    upgrades: true,
    manualHire: true,
    founderBoard: boards.founder,
    heroBoard: boards.hero,
    // §21.7.6 — the floor arrives with the man whose job is the floor.
    heroPlacement: has('billy'),
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

/** §21.7.7 — which of the two gated boards has been handed over. */
export interface BoardIntros {
  founder: boolean
  hero: boolean
}

/** Nothing introduced, for callers that have not derived it yet. */
export const NO_BOARDS: BoardIntros = { founder: false, hero: false }
