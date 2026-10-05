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

import type { HeroId } from '../sim/storyHeroes.ts'

/**
 * The state a trigger reads. A snapshot, not `GameState`, so it stays testable.
 *
 * [amended 2026-10-04] Mo and Melany are gone, so the release defect densities,
 * the developer count, the cap and the cash that their two predicates read are
 * gone with them; what is here is what Billy, Serena and Matt ask.
 */
export interface StorySnapshot {
  paradigmShifts: number
  /** §4.12a — incidents open right now. */
  incidents: number
  /** §4.13 — the queue depth. */
  tickets: number
  /** Seconds the queue has gone unanswered. "Sustained" needs a clock. */
  ticketsUnservedFor: number
  /**
   * §4.1 — the entropy reading, 0..1, **as a fact about the organisation**.
   *
   * `store.structuralEntropy`, not the gauge: §18.0's event ceiling is taken
   * back out, so a studio held at 25% output by a thread does not read as a
   * studio that has outgrown its own capacity. Only {@link billyArrives} reads
   * it, and that is the only reading it wants.
   */
  entropy: number
  /** §21.7.3, Billy — seconds that reading has been at or above {@link SYNC_FELT}. */
  syncSlippedFor: number
  /** §10.7, Serena — seconds, this run, the floor has stood still on a full shelf. */
  shelfStalledFor: number
  /** §10.7, Serena — builds the player has put on sale by hand, this run. */
  handReleases: number
  /**
   * Seconds Serena has been in the building, this run; 0 if she is not. Matt's
   * door is behind hers, on purpose, **and a little way behind** — see
   * {@link MATT_AFTER_SERENA_S}.
   */
  sinceSerena: number
}

/** §21.7.3 — "a sustained period". A first pass, marked as one. */
export const MATT_SUSTAINED_S = 30

/**
 * §21.7.3, Billy — **the first moment growth visibly costs sync.**
 *
 * Amended 2026-10-04. Sync falling as the studio grows is the core of the game,
 * and Billy's meeting tree is how it is pushed back, so he is the answer to the
 * first *felt* slip and not to a collapse. The previous door (half, held for
 * twenty seconds) was D = D_cap, which a player who reads the speedometer never
 * reaches: measured over two simulated hours, the careful player stopped at 80
 * of 105 and never met him. A scene that rewards overhiring and punishes the
 * player who was right is the wrong scene for the one hero who is about sync.
 *
 * Five per cent is the first reading the gauge shows as something other than
 * `IN SYNC` that a player would not dismiss — §21.0's measured table has the
 * wave-away `CHATTY 1%` at forty developers, and this is a few hires past it.
 * **A first pass, to be tuned against `pacing.test.ts`'s arrival table.**
 */
export const SYNC_FELT = 0.05

/**
 * §21.7.3, Billy — and it has to have *stayed* there, so the scene is about a
 * state and not a flicker, and the gauge is still under the player's eye when
 * James speaks. Shorter than {@link MATT_SUSTAINED_S}: the speedometer is the
 * one readout they are already looking at.
 */
export const BILLY_SUSTAINED_S = 20

/**
 * §21.7.3, Billy — **the second reality, not the third.**
 *
 * "The second restart" is Run 2: the first run that has hiring, upgrades or
 * heroes. A named constant rather than `> 0` inline because it is a reading of
 * an instruction, and moving the beat a run later should cost one edit here.
 */
export const BILLY_MIN_SHIFTS = 1

/**
 * §10.7, Serena — **the queue is the bottleneck.** Two doors, because the
 * feeling has two forms and a player only ever has one of them.
 *
 * The *stall*: the floor has stood still on a full shelf for a cumulative
 * fifteen seconds — a player who walks away from the thumb finds out what a
 * full buffer is. The *chore*: eight hand-releases, for the player who never
 * lets it stall and so never meets the first form, and is exactly the player
 * to whom *"I can make it ship itself"* is relief. Both numbers are first
 * passes.
 */
export const SERENA_STALL_S = 15
export const SERENA_HAND_RELEASES = 8

/**
 * §4.12a, Matt — incidents open at once that count as drowning. Two: one is a
 * page, two is a bad night. (Three, until it was measured: with the rate then in
 * force no studio in the game ever had three.) First pass.
 */
export const MATT_INCIDENTS = 2

/**
 * §21.7.3, Matt — the gap behind Serena. Two arrivals on one frame is the failure
 * §21.7.3's shape rules forbid, and with incidents raised (`incidents.ts`) a
 * studio that has been paging for ten minutes meets Serena with the pile already
 * there. A minute is long enough for her scene to have finished and her board to
 * have been looked at. First pass.
 */
export const MATT_AFTER_SERENA_S = 60

/**
 * Serena — Reliability. The pipeline is not keeping up with the studio: the
 * floor has stopped waiting for a thumb, or the thumb is tired of it.
 */
export function serenaArrives(s: StorySnapshot): boolean {
  return s.shelfStalledFor >= SERENA_STALL_S || s.handReleases >= SERENA_HAND_RELEASES
}

/**
 * Matt — Support. Incidents and tickets are landing faster than the studio
 * clears them. **After Serena**, because the order is the design: the player
 * fixes how the studio ships, and then finds out what shipping does to them.
 */
export function mattArrives(s: StorySnapshot): boolean {
  if (s.sinceSerena < MATT_AFTER_SERENA_S) return false
  if (s.incidents >= MATT_INCIDENTS) return true
  return s.incidents > 0 && s.tickets > 0 && s.ticketsUnservedFor >= MATT_SUSTAINED_S
}

/**
 * Billy — Cohesion. **Sync has first slipped from the studio's growth, and has
 * stayed slipped.** See {@link SYNC_FELT}.
 */
export function billyArrives(s: StorySnapshot): boolean {
  if (s.paradigmShifts < BILLY_MIN_SHIFTS) return false
  return s.entropy >= SYNC_FELT && s.syncSlippedFor >= BILLY_SUSTAINED_S
}

/**
 * §21.7.7 — what the founder board's introduction reads.
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
}

/**
 * §21.7.7 — the founder's board, and the feeling is *"there is work here I am
 * not doing."*
 *
 * §13.7.1's Management tree is a **diluted copy of every other tree's spine and
 * nothing of its own** — a bit of engineering, a bit of QA, a bit of support, a
 * bit of ops. So the moment to hand it over is the first time the player is
 * looking at work they personally cannot do, and there are two ways to arrive
 * at that: **your share of the output falls past a twentieth.** You were one
 * hundred per cent of this company; you are now a rounding error in it.
 *
 * There was a second door — the first specialist hire, *you just paid somebody
 * to do a job you have never done* — and it closed with the professions on
 * 2026-09-26. The share rule was always the guarantee, and it fires for every
 * studio that grows at all.
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
  if (s.devs < FOUNDER_BOARD_MIN_DEVS) return false
  const total = s.founderRate + s.swarmRate
  if (!(total > 0)) return false
  return s.founderRate / total < FOUNDER_BOARD_SHARE
}

/**
 * §21.7.4 — **Global Head of His Desk**, once James has a department.
 *
 * It fired on the second arrival [amended 2026-10-04], and with Mo's door the
 * second arrival landed on the same frame as the first — two scenes back to
 * back, and a joke about *global* before there was anything global. It waits
 * for the third person in the building: James, Billy and Serena, which is a
 * team with a head. The title is no less meaningless for being earned this way,
 * which is the joke.
 */
export const JAMES_PROMOTED_AT = 3

export function jamesPromoted(arrived: ReadonlySet<HeroId>): boolean {
  return arrived.has('james') && arrived.size >= JAMES_PROMOTED_AT
}

/** The predicate for a hero, or null for James (who needs no trigger). */
export function arrivalPredicate(id: HeroId): ((s: StorySnapshot) => boolean) | null {
  switch (id) {
    case 'james': return null
    case 'serena': return serenaArrives
    case 'matt': return mattArrives
    case 'billy': return billyArrives
  }
}
