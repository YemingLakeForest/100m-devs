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
  /**
   * §4.12a [added 2026-10-16] — of those, how many have been open at least
   * {@link MATT_SUSTAINED_S}. Read off each incident's own `age`, so a pile that
   * is cleared and re-raised does not count as one that sat there.
   */
  incidentsHeld: number
  /** §4.13 — the queue depth. */
  tickets: number
  /** Seconds the queue has gone unanswered. "Sustained" needs a clock. */
  ticketsUnservedFor: number
  /**
   * §4.1 — the entropy reading, 0..1: `store.currentEntropy`, fold and
   * purchased floor included. Only {@link billyArrives} reads it.
   */
  entropy: number
  /** §21.7.3, Billy — seconds that reading has been at or above {@link SYNC_FELT}. */
  syncSlippedFor: number
  /**
   * §21.7.3, Billy [added 2026-10-16] — seconds the studio has stood at the cap
   * wall: one more hire would pass §4.1's peak, so hiring has stopped buying
   * output. The wall is where "how do we get more sync" becomes a question.
   */
  atCapFor: number
  /** §10.7, Serena — seconds, this run, the floor has stood still on a full shelf. */
  shelfStalledFor: number
  /**
   * §10.7, Serena [added 2026-10-16, replaces the hand-release count] —
   * seconds, this run, spent pressing SHIP! by hand at the cap wall (see
   * {@link atCapFor}): the stretch when SHIP! is all the thumb is for.
   */
  handShipSeconds: number
  /**
   * Seconds Serena has been in the building, this run; 0 if she is not. Matt's
   * door is behind hers, on purpose, **and a little way behind** — see
   * {@link MATT_AFTER_SERENA_S}.
   */
  sinceSerena: number
  /**
   * James's Knows a Chap is owned — see {@link knowsAChap}. Optional so a
   * snapshot built without it is the old snapshot.
   */
  knowsAChap?: boolean
}

/**
 * §21.7.3 [amended 2026-10-16] — **a clock may hold a door shut; it may never
 * open one.**
 *
 * The audit (`docs/AUDIT-2026-10-16-fun-killers.html`, finding 04) measured
 * every Run 2 beat landing between minutes 6 and 9 — board, Billy, Serena, the
 * promotion and Matt, two of them on one frame — and then nothing for the rest
 * of the hour. Each door was a true feeling; they were all true at once because
 * the problems they answer arrive together in a studio that is growing. So two
 * clocks space them out, and neither can bring anybody in: a predicate still
 * has to be true, and the clocks only say *not yet*.
 *
 * {@link SCENE_COOLDOWN_S} is the floor under every Run 2 scene: a minute of
 * play after one closes before the next can open, so a hand-over has time to be
 * used before the next one interrupts it. {@link ARRIVAL_GAP_S} is the longer
 * one between *people* (Billy, Serena, Matt): five minutes, so each has a stretch
 * of the run that is theirs. Run 1's scenes are exempt — §21.0e's four minutes
 * are a script, not a ladder, and nothing in them is waiting on a feeling.
 */
export const SCENE_COOLDOWN_S = 60
export const ARRIVAL_GAP_S = 300

/**
 * Has the cooldown passed since the last scene closed? `endedAt` and `now` are
 * the run's own clock (`runSeconds`); null means no scene has closed this run.
 */
export function sceneCooledDown(now: number, endedAt: number | null): boolean {
  return endedAt === null || now - endedAt >= SCENE_COOLDOWN_S
}

/** Has the gap passed since the last person walked in? Same clock as above. */
export function arrivalGapPassed(now: number, arrivedAt: number | null): boolean {
  return arrivedAt === null || now - arrivedAt >= ARRIVAL_GAP_S
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
 *
 * [amended 2026-10-16] Twenty seconds became three minutes, and the cap wall
 * ({@link BILLY_AT_CAP_S}) was added. At twenty seconds he arrived on the first
 * slip, at minute 7, before the studio had met the wall that makes sync the
 * question; the audit measured him landing in the same two minutes as the
 * board, Serena and Matt. Three minutes is a slip the player has lived with.
 * D6 of the plan: no node purchase is needed — dwell plus the wall is the door.
 */
export const BILLY_SUSTAINED_S = 180

/**
 * §21.7.3, Billy [added 2026-10-16] — seconds at the cap wall. A minute: long
 * enough that the HIRE button has been looked at and declined (or pressed and
 * regretted), short enough that he arrives while it is still the problem.
 */
export const BILLY_AT_CAP_S = 60

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
 * full buffer is. The *chore*: eight minutes of pressing SHIP! by hand, for the
 * player who never lets it stall and so never meets the first form, and is
 * exactly the player to whom *"I can make it ship itself"* is relief. The
 * minutes count only at the cap wall, where hiring has stopped and SHIP! is
 * the thumb's one job; that also keeps her behind Billy, whose door wants one
 * minute of the same wall.
 *
 * [amended 2026-10-16] The chore was eight hand-releases. Plan 2026-10-16 §1's
 * ruling restated it in minutes: phase 2 made hiring ship faster, so any count
 * arrives sooner the better the player does, and eight releases became about
 * five minutes of play. Minutes are the chore whatever the cadence. Both
 * numbers are first passes.
 */
export const SERENA_STALL_S = 15
export const SERENA_HAND_SHIP_S = 8 * 60

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
 *
 * [amended 2026-10-16] Eight minutes, not one. A minute behind her was the
 * frame-collision rule and nothing more: the audit measured Matt at minute 9,
 * sixty seconds after Serena, so her pipeline board had one minute of being the
 * newest thing in the building. Eight minutes gives her stretch of the run to
 * her, and the arrival gap (`ARRIVAL_GAP_S`) is still the floor under it.
 */
export const MATT_AFTER_SERENA_S = 8 * 60

/**
 * Serena — Reliability. The pipeline is not keeping up with the studio: the
 * floor has stopped waiting for a thumb, or the thumb is tired of it.
 */
export function serenaArrives(s: StorySnapshot): boolean {
  return s.shelfStalledFor >= SERENA_STALL_S || s.handShipSeconds >= SERENA_HAND_SHIP_S
}

/**
 * Matt — Support. Incidents and tickets are landing faster than the studio
 * clears them. **After Serena**, because the order is the design: the player
 * fixes how the studio ships, and then finds out what shipping does to them.
 *
 * [amended 2026-10-16] The pile has to have *sat*: {@link MATT_INCIDENTS} open
 * for {@link MATT_SUSTAINED_S} each, not two on one frame. Two pages that clear
 * in ten seconds are a studio coping; two that are still open half a minute
 * later are the drowning his scene is about.
 */
export function mattArrives(s: StorySnapshot): boolean {
  if (s.sinceSerena < MATT_AFTER_SERENA_S) return false
  if (s.incidentsHeld >= MATT_INCIDENTS) return true
  return s.incidents > 0 && s.tickets > 0 && s.ticketsUnservedFor >= MATT_SUSTAINED_S
}

/**
 * Billy — Cohesion. **Sync has first slipped from the studio's growth, and has
 * stayed slipped.** See {@link SYNC_FELT}. [amended 2026-10-16] **And the studio
 * is at the wall**, so the answer to "hire more" has already stopped being yes.
 */
export function billyArrives(s: StorySnapshot): boolean {
  if (s.paradigmShifts < BILLY_MIN_SHIFTS) return false
  // [2026-10-16] James's Knows a Chap waives the dwell and the wall, not the clocks.
  if (knowsAChap(s)) return true
  return s.entropy >= SYNC_FELT && s.syncSlippedFor >= BILLY_SUSTAINED_S && s.atCapFor >= BILLY_AT_CAP_S
}

/**
 * James's **Knows a Chap** [2026-10-16, plan phase 6.3] — *"Introduces Billy.
 * Billy's tree opens."*
 *
 * The one purchase that is allowed to open a door early, because it is not a
 * clock: it is the player deciding they have felt the problem already and asking
 * James for the chap. A separate term of {@link billyArrives}, so whatever else
 * that predicate is asked to wait for, this answers only whether the player
 * paid for the introduction: it skips the three minutes of slip and the minute
 * at the wall, and nothing else. {@link SCENE_COOLDOWN_S} and
 * {@link ARRIVAL_GAP_S} are asked by the store around every predicate, so they
 * still hold the door — a clock may hold a door shut, and a purchase is not a
 * clock, so this is the one thing allowed to open it early.
 */
export function knowsAChap(s: StorySnapshot): boolean {
  return s.knowsAChap === true
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
/**
 * §21.6a — **the first hire** [added 2026-10-18]. The feeling is *"this takes
 * forever"*, and it needs two things to be true before it is a feeling rather
 * than a script: the player has waited out more than one burn-down alone with
 * James, and there is money in the till to do something about it.
 *
 * Two ships rather than one: the first Run 2 game lands during the opening
 * minute, while the player is still reading the room, and a complaint about
 * waiting after one wait is not yet a complaint. Affordability rather than a
 * fixed sum, so the scene never ends on a button the player cannot press.
 *
 * Only while the studio is the two of them (`devs ≤ 1` — James is outside the
 * count, §21.0b): a save or a debug seam that already has a floor of people has
 * plainly found the control, and the store treats it as introduced.
 */
export const FIRST_HIRE_AFTER_SHIPS = 2

export interface FirstHireSnapshot {
  paradigmShifts: number
  /** Games shipped this run. */
  shipped: number
  devs: number
  cash: number
  /** What the next developer costs right now. */
  hireCost: number
}

export function firstHireArrives(s: FirstHireSnapshot): boolean {
  if (s.paradigmShifts <= 0) return false
  if (Math.floor(s.devs) > 1) return false
  if (s.shipped < FIRST_HIRE_AFTER_SHIPS) return false
  return Number.isFinite(s.hireCost) && s.cash >= s.hireCost
}

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

/**
 * §11.7, §21.7.9 [CANON - added 2026-10-21] — **the duck is promoted the first
 * time a game goes out with known bugs in it.**
 *
 * §21.7.3's rule, kept exactly: the CTO solves bugs, so the feeling is a game
 * on sale with bugs the player could see on §10.7's ring and did not fix —
 * because they shipped through them, or because Serena's auto-ship sent it
 * while nobody was at the ring. Both are the same sentence: *we shipped it
 * broken.* A release that left the ring clean has a density of zero
 * (`store.releaseFrom`), so "known bugs" is a fact on the release and not a
 * new counter.
 *
 * Not before the third game of the run: the opening of Run 2 is James, the
 * first hire and the first launches, and a promotion on the first ring is a
 * scene about a system the player has not met yet. (A clock may hold a door
 * shut, §21.7.3 — three games is the hold.) Serena's auto-ship always leaves
 * bugs on, so a player who clears every ring by hand still meets him the day
 * the belt starts shipping for them.
 */
export const DUCK_AFTER_SHIPS = 3

export interface DuckSnapshot {
  paradigmShifts: number
  /** Games shipped this run. */
  shipped: number
  /** Releases on sale this run that went out with bugs left on them. */
  buggyReleases: number
}

export function duckPromoted(s: DuckSnapshot): boolean {
  if (s.paradigmShifts <= 0) return false
  if (s.shipped < DUCK_AFTER_SHIPS) return false
  return s.buggyReleases > 0
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
