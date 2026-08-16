/**
 * The one rule that drives the story — GDD §21.7, R42.
 *
 * > **A hero arrives the first time the player feels the problem that hero
 * > solves, and never before.** Not at a headcount, not at a shift, not on a
 * > timer.
 *
 * Every predicate here is a *feeling* expressed as a pure function of state:
 * a release that scored badly on defects, an incident that stopped a tail
 * earning, a queue nobody answered. Each is a system the player already has on
 * screen (§21.7.3: "nothing here needs a new counter"), so the scene is the
 * first time the game says out loud what a readout has been saying quietly.
 *
 * Fire-once is not this module's job — the store's `milestones` union already
 * remembers a scene has played. These only answer *would it fire now?*.
 */

import { DEFECT_DENSITY_ANCHOR } from '../sim/rating.ts'
import type { HeroId } from '../sim/storyHeroes.ts'

/** What a release carries that a trigger cares about. */
export interface StoryRelease {
  defectDensity: number
}

/** The state a trigger reads. A snapshot, not `GameState`, so it stays testable. */
export interface StorySnapshot {
  paradigmShifts: number
  releases: readonly StoryRelease[]
  /** §4.12a — is any release's tail being suppressed right now? */
  hasIncident: boolean
  /** §4.13 — the queue depth. */
  tickets: number
  /** Seconds the queue has gone unanswered. "Sustained" needs a clock. */
  ticketsUnservedFor: number
  devs: number
  devCap: number
  cash: number
  /** §4.1 — the entropy reading, 0..1. */
  entropy: number
}

/** §21.7.3 — "a sustained period". A first pass, marked as one. */
export const MATT_SUSTAINED_S = 30

/** §21.7.3 — "past CHATTY". CHATTY ends at 10% (§4.3a); past it is BOGGED DOWN. */
export const CHATTY_TOP = 0.1

/**
 * Mo — Quality. A release is rated below baseline *on defects alone*: it shipped
 * with a density worse than the garage anchor, which is the half of the rating
 * the player watched themselves cause.
 */
export function moArrives(s: StorySnapshot): boolean {
  return s.releases.some((r) => r.defectDensity > DEFECT_DENSITY_ANCHOR)
}

/** Serena — Reliability. A game that *was* earning has stopped, overnight. */
export function serenaArrives(s: StorySnapshot): boolean {
  return s.hasIncident
}

/** Matt — Support. The drab grey bar filled up and nobody is answering it. */
export function mattArrives(s: StorySnapshot): boolean {
  return s.tickets > 0 && s.ticketsUnservedFor >= MATT_SUSTAINED_S
}

/** Melany — Cloud. Tried to solve a problem by hiring and hit the cap with cash spare. */
export function melanyArrives(s: StorySnapshot): boolean {
  return s.devs >= s.devCap && s.cash > 0
}

/** Billy — Cohesion. Met §4.1 as an ongoing condition, not as Run 1's punchline. */
export function billyArrives(s: StorySnapshot): boolean {
  return s.paradigmShifts > 0 && s.entropy >= CHATTY_TOP
}

/**
 * §21.7.7 — what the two **board** introductions read.
 *
 * Separate from {@link StorySnapshot} because these are not arrivals: nobody
 * walks through a door for either of them, and the questions they ask are about
 * curves rather than about the three backlogs.
 */
export interface BoardSnapshot {
  paradigmShifts: number
  /** §4.5d — the founder's own story points a second. Never taxed by §4.1. */
  founderRate: number
  /** The swarm's realised output a second, after §4.1 has taken its cut. */
  swarmRate: number
  devs: number
  /** §4.11 — people on the floor doing a job that is not "developer". */
  specialists: number
  /** §13.13 — the highest unspent point count on any hero. */
  heroPoints: number
  /** §13.13 — the highest level anybody has reached. */
  heroLevel: number
}

/**
 * §21.7.7 — the founder's board, and the feeling is *"there is work here I am
 * not doing."*
 *
 * §13.7.1's Management tree is a **diluted copy of every other tree's spine and
 * nothing of its own** — a bit of engineering, a bit of QA, a bit of support, a
 * bit of ops. So the moment to hand it over is the first time the player is
 * looking at work they personally cannot do, and there are two ways to arrive
 * at that. **Two doors, deliberately, because no beat in this game may be the
 * only door into a system.**
 *
 * | Door | The feeling |
 * |---|---|
 * | **The first specialist hire** | You just paid somebody to do a job you have never done. §4.11's dial only offers one after §21.7.6 has brought the hero who makes it legible, so this door opens *behind* Mo, Serena or Matt and never before |
 * | **Your share of the output falls past a twentieth** | You were one hundred per cent of this company. You are now a rounding error in it |
 *
 * The first door is the beat and the second is the guarantee. A player who
 * never hires outside `dev` — which is entirely possible and entirely
 * reasonable — must still be able to reach their own skill board, and the
 * share rule fires for every studio that grows at all.
 *
 * **The share rule is not §4.5d's "your output overtakes theirs".** That was
 * the first cut and it is wrong in a way worth recording: it only ever fires
 * for a studio hired *past* §4.1's optimum, so a player who reads the
 * speedometer and stops at the right headcount would never see the scene. A
 * trigger that punishes correct play by withholding a system is a trigger that
 * has misread which half of §4.5d is the feeling.
 */
export const FOUNDER_BOARD_MIN_DEVS = 25
export const FOUNDER_BOARD_SHARE = 0.05

export function founderBoardArrives(s: BoardSnapshot): boolean {
  if (s.paradigmShifts <= 0) return false
  if (s.specialists > 0) return true
  if (s.devs < FOUNDER_BOARD_MIN_DEVS) return false
  const total = s.founderRate + s.swarmRate
  if (!(total > 0)) return false
  return s.founderRate / total < FOUNDER_BOARD_SHARE
}

/**
 * §21.7.7 — the hero board, and the feeling is somebody visibly getting better.
 *
 * §13.13: XP earned from covered work becomes levels, a level is a point, a
 * point buys a node. Both halves are required here and the second one is the
 * interesting one:
 *
 * - **A point to spend**, because a board of purchases with no currency is
 *   §26.1.6's wall in miniature.
 * - **A level somebody earned**, meaning level 2 or better — not the one they
 *   walked in with.
 *
 * The second condition is doing three jobs. It makes the scene land on a
 * *moment* rather than on a state that was already true (§13.13: "a level-up is
 * a moment, not a notification"). It keeps the introduction away from the top
 * of Run 2, where §21.6's Instant Messenger scene already is — every hero
 * arrives holding a point, so `points > 0` alone would fire on the frame after
 * James finished speaking and §13.12.2's whole argument is that these do not
 * land in a pile.
 *
 * And it is the one that actually matters: **XP only accrues under coverage**,
 * so an earned level means the player has placed somebody. A board whose nodes
 * are REACH and DEPTH — how much of the floor a person covers, and how hard —
 * introduced to a player who has never put anybody on the floor would be a
 * screen about a thing they have not done.
 *
 * §13.13's "arrives with one decision attached" survives intact: the point is
 * granted at level 1 and is still there, waiting, when the board opens.
 */
export const HERO_BOARD_MIN_LEVEL = 2

export function heroBoardArrives(s: BoardSnapshot): boolean {
  return s.paradigmShifts > 0 && s.heroLevel >= HERO_BOARD_MIN_LEVEL && s.heroPoints > 0
}

/**
 * §21.7.4 — **Global Head of His Desk**, and what "above" means on this floor.
 *
 * The section says the scene fires *"the first time a card is placed above
 * another card"* on §22.2's org chart. There is no org chart: §13.8 replaced
 * the grid with the floor, deliberately and on §13.6.7's argument that a player
 * managing heroes on a grid has thrown away the reason for the design.
 *
 * **So the ladder is the org chart, and it always was.** §7.7's rungs are
 * nested by construction — a floor contains blocks, a building contains floors
 * — so a hero standing on a higher rung than another hero is standing *over*
 * them, in exactly the sense a line on a chart means. Nothing has to be built
 * for the fiction to be true; it is a comparison between two integers.
 *
 * Two conditions, and the second one is the one that keeps it honest:
 *
 * 1. **James is placed.** A promotion is about somebody who is at work.
 * 2. **Somebody else is placed below him.** Strictly below, so two heroes side
 *    by side on the same rung are colleagues rather than a hierarchy — which is
 *    the whole joke of the title he is about to be given.
 */
export interface PlacedAt {
  id: string
  rung: number
}

export function jamesPromoted(placed: readonly PlacedAt[]): boolean {
  const james = placed.find((p) => p.id === 'james')
  if (!james) return false
  return placed.some((p) => p.id !== 'james' && p.rung < james.rung)
}

/** The predicate for a hero, or null for James (who needs no trigger). */
export function arrivalPredicate(id: HeroId): ((s: StorySnapshot) => boolean) | null {
  switch (id) {
    case 'james': return null
    case 'mo': return moArrives
    case 'serena': return serenaArrives
    case 'matt': return mattArrives
    case 'melany': return melanyArrives
    case 'billy': return billyArrives
  }
}
