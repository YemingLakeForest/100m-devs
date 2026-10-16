/**
 * The release ring, played — GDD §10.8b [amended 2026-10-16, at the user's
 * instruction: *"I like the roundal the art style, and the bug hit, but it's too
 * repeatative and not challenging enough"*].
 *
 * `release.ts` owns what a release is *worth*: the bands, the years, the stages,
 * the reaches, the regression roll. None of that moved, so §26.3.4's
 * guarantees — a blind press is ×1, nobody attending is ×1, the ceiling is
 * ×1.75 — hold exactly as they did. What this file owns is how the head moves
 * and what a tap does to it, and that is where the ring was flat.
 *
 * ## Why it was repetitive
 *
 * The first ring was a constant-speed head over static bugs. Once the player had
 * learnt the lead time for one bug they had learnt it for every bug in every
 * release: each tap was the same reaction to the same stimulus, and a release
 * forty games in was the release they did in the garage with a different cover.
 * Nothing the player did changed what they had to do next.
 *
 * ## The four changes, and the argument for each
 *
 *  1. **A rushed fix bounces the head back.** The dial-lock genre's reversal,
 *     kept for sloppy hits only. It first reversed on *every* hit, and that
 *     could not be played: the bugs live in one 40% arc at the bottom, so the
 *     head that fixes the nearest one is turned away from all the rest, and
 *     every fix after it cost most of a lap. A bot with perfect aim, playing to
 *     those rules, cleared a five-bug backlog in the third stage of hype, every
 *     time (*"still killing all bugs take more time than the outer ring
 *     complete?"*, 2026-10-16). Now a clean fix carries the head on through the
 *     backlog, and a rushed one throws it back the way it came, away from the
 *     bugs that are left: the cost of a sloppy fix is the lap back round to
 *     them, paid in hype. An armour crack still turns the head, so it lands on
 *     the plate it just dented, and a second hit sends it on its way again.
 *  2. **A clean streak speeds the head up.** {@link TEMPO_STEP} a clean fix, to
 *     {@link TEMPO_MAX}. Precision is rewarded with a harder ring, which is the
 *     only reward a skill game can give without paying for reflexes in money
 *     (§26.3.4). A rushed fix ends the streak and keeps the speed; a miss
 *     drops both.
 *  3. **A miss stalls the head** for {@link MISS_STALL_MS} while the year keeps
 *     running. The rebuild tried opening a defect on a stray tap and it read as
 *     noise; a stall is a cost the player *watches* being paid, in the one
 *     currency the ring is about — time before the window decays.
 *  4. **The bugs change up the ladder.** The garage's first games are static
 *     bugs, which is the tutorial. From there *crawlers* walk the track (so a
 *     lead time is never learnt twice) and *armoured* bugs take two hits (so a
 *     reversal lands you on the same bug again, on purpose). {@link bugMix}
 *     ramps them by rung, so a late release is a different game from the first.
 *
 * ## The hype, not the years [2026-10-16]
 *
 * *"the year story on the release isn't really fitting, that breaks the
 * immersion, can you make a different story?"* A studio does not sit on a
 * finished game for four fiscal years, and nobody thinks of a launch that way.
 * What a studio does watch drain is **hype**: the top of the ring is the
 * storefront's spotlight, and the hype cools in four stages — {@link HYPE}'s
 * HYPED, BUZZING, NOTICED, FORGOTTEN — each paying less at the top. The
 * arithmetic is `release.ts`'s years exactly (its `year` argument is the stage
 * here), so every claim there about the window's worth reads the same.
 *
 * A stage is {@link turnPeriodMs} of *clock*, not a lap: a reversing head need
 * never complete one. The head at tempo 1 going one way still crosses the top
 * once a stage, which is what a lap was.
 *
 * ## A clean hit wins hype back
 *
 * Same day: *"the moving bugs are fun, but to debug them all you are bound to
 * exceed the first round."* With crawlers and armour a full backlog could not be
 * cleared inside the first stage by anybody, so GOLD at the peak was a promise
 * the ring could not keep, and the fix-or-ship trade was decided before the
 * first press. So a **clean** hit (a fix or an armour crack) is news, and buys
 * back {@link CLEAN_REFUND} of a stage's fuse — but never past the start of the
 * stage it is in, so hype that has cooled stays cooled. A rushed fix buys
 * nothing and a miss burns time while the head stalls: precision is now what
 * holds the window open, which is the trade the ring was always meant to be.
 *
 * Pure — no store, no clock, no renderer. The surface hands it elapsed time.
 */

import { draw } from './identity.ts'
import {
  BUG_EXCLUSION,
  REACH_RUSHED,
  SHIP_ZONE,
  YEARS,
  defectRing,
  fixQuality,
  inShipZone,
  regresses,
  wrapTurn,
  yearAt,
  type FixQuality,
} from './release.ts'

export type BugKind = 'bug' | 'crawler' | 'armoured'

export interface RingBug {
  id: number
  /** Where on the year it sits, in turns from the date. Inside the bug zone always. */
  t: number
  kind: BugKind
  /** Hits left. An armoured bug starts on two. */
  hp: number
  /** A crawler's speed, in turns per year, signed. Zero for everything else. */
  v: number
}

export interface RingPlay {
  started: boolean
  /** Milliseconds of clock since the first press. */
  elapsed: number
  /** The head, in turns from the date. */
  turn: number
  dir: 1 | -1
  /** The head's speed as a multiple of the base: one lap a year at 1. */
  tempo: number
  /** Milliseconds the head stays frozen after a miss. */
  stall: number
  /** Clean fixes in a row. */
  streak: number
  bestStreak: number
  /** Every fix that landed, for the regression ramp. */
  fixes: number
  misses: number
  bugs: RingBug[]
  nextId: number
  /** How many the backlog opened with, for the stage. */
  initial: number
  /** One year, in ms. */
  period: number
}

export type RingEvent =
  | { kind: 'start' }
  | { kind: 'fix'; quality: Exclude<FixQuality, 'miss'>; bug: RingBug; regressed: RingBug | null; cleared: boolean; streak: number }
  | { kind: 'crack'; quality: Exclude<FixQuality, 'miss'>; bug: RingBug; streak: number }
  | { kind: 'miss' }
  | { kind: 'ship' }
  | { kind: 'expired' }

/** How much faster each clean fix in a row makes the head, and the most it gets. */
export const TEMPO_STEP = 0.07
export const TEMPO_MAX = 1.5
/** How long a miss freezes the head while the year runs on. Long enough to see; short of a punishment that ends a run. */
export const MISS_STALL_MS = 450
/** What a clean hit buys back, as a share of one stage of hype. Never past the stage's own start. */
export const CLEAN_REFUND = 0.15

/** The four stages of hype, hottest first: `release.ts`'s years, as the studio would say them. */
export const HYPE = ['HYPED', 'BUZZING', 'NOTICED', 'FORGOTTEN'] as const

/** A crawler's speed range, in turns per year: well under the head's one, so it is a moving target and not a race. */
const CRAWL = { min: 0.05, max: 0.11 } as const

/** Channels, apart from `release.ts`'s 201/202, so a draw here can never share one there. */
const CH = { kind: 231, speed: 261, side: 291 } as const

/** The bug zone, as `release.ts` lays it out. A crawler turns round at its edges. */
const LO = BUG_EXCLUSION
const HI = 1 - BUG_EXCLUSION

/**
 * What share of a backlog is crawlers and armour, by ladder rung.
 *
 * **The first rungs are the tutorial and have neither**: a player meeting the
 * reversal for the first time should meet it on bugs that stand still. Crawlers
 * arrive before armour because a moving target is a new skill and a second hit
 * is a new rule, and a rule is cheaper to learn once the hands are trained.
 */
export function bugMix(projectIndex: number, projectCount: number): { crawler: number; armoured: number } {
  const i = Number.isFinite(projectIndex) ? Math.max(0, Math.floor(projectIndex)) : 0
  const t = projectCount > 1 ? Math.min(1, i / (projectCount - 1)) : 0
  if (i < 1) return { crawler: 0, armoured: 0 }
  const crawler = Math.min(0.45, 0.25 + t * 0.3)
  const armoured = i < 3 ? 0 : Math.min(0.3, 0.12 + t * 0.25)
  return { crawler, armoured }
}

/** Fold a position into the bug zone the way a crawler walks it: out to an edge and back. */
function bounce(t: number, v: number): { t: number; v: number } {
  const span = HI - LO
  const raw = (t - LO) / span
  // A triangle wave, so a long frame (a throttled tab) still lands it inside:
  // every edge crossed is one turn-round, and an odd number of them has it
  // walking the other way.
  const k = Math.floor(raw)
  const frac = raw - k
  const odd = Math.abs(k) % 2 === 1
  return { t: LO + (odd ? 1 - frac : frac) * span, v: odd ? -v : v }
}

/** A fresh ring for this release — deterministic in `(seed, ordinal)`, like the layout under it. */
export function createRingPlay(
  seed: number,
  ordinal: number,
  count: number,
  period: number,
  projectIndex: number,
  projectCount: number,
): RingPlay {
  const mix = bugMix(projectIndex, projectCount)
  const bugs = defectRing(seed, ordinal, count).map((t, id): RingBug => {
    const r = draw(seed, ordinal, CH.kind + id)
    const kind: BugKind = r < mix.armoured ? 'armoured' : r < mix.armoured + mix.crawler ? 'crawler' : 'bug'
    const speed = CRAWL.min + draw(seed, ordinal, CH.speed + id) * (CRAWL.max - CRAWL.min)
    const side = draw(seed, ordinal, CH.side + id) < 0.5 ? -1 : 1
    return { id, t, kind, hp: kind === 'armoured' ? 2 : 1, v: kind === 'crawler' ? speed * side : 0 }
  })
  return {
    started: false,
    elapsed: 0,
    turn: SHIP_ZONE + 0.01,
    dir: 1,
    tempo: 1,
    stall: 0,
    streak: 0,
    bestStreak: 0,
    fixes: 0,
    misses: 0,
    bugs,
    nextId: bugs.length,
    initial: bugs.length,
    period: period > 0 ? period : 1,
  }
}

/** Which stage of hype the clock is in, one-based: 1 is HYPED. */
export function hypeStage(p: RingPlay): number {
  return yearAt(p.elapsed, p.period)
}

/** How much of the current stage's hype has burnt, 0..1. */
export function hypeBurnt(p: RingPlay): number {
  if (ringExpired(p)) return 1
  return (p.elapsed % p.period) / p.period
}

export function ringExpired(p: RingPlay): boolean {
  return p.elapsed >= p.period * YEARS
}

/** Advance the clock. Nothing moves before the first press. */
export function stepRing(p: RingPlay, dtMs: number): RingPlay {
  if (!p.started || !(dtMs > 0)) return p
  const dt = Math.min(dtMs, p.period * YEARS)
  const frozen = Math.min(dt, p.stall)
  const moving = dt - frozen
  const turn = p.turn + (p.dir * p.tempo * moving) / p.period
  const bugs = p.bugs.map((b) => {
    if (b.v === 0) return b
    const next = bounce(b.t + (b.v * dt) / p.period, b.v)
    return { ...b, t: next.t, v: next.v }
  })
  return { ...p, elapsed: p.elapsed + dt, turn: ((turn % 1) + 1) % 1, stall: p.stall - frozen, bugs }
}

/** The bug under the head, if one is within the wide reach, and how well a tap now would land. */
export function bugUnderHead(p: RingPlay): { bug: RingBug; quality: Exclude<FixQuality, 'miss'> } | null {
  let best: RingBug | null = null
  let bestD = REACH_RUSHED
  for (const b of p.bugs) {
    const d = Math.abs(wrapTurn(b.t - p.turn))
    if (d <= bestD) {
      bestD = d
      best = b
    }
  }
  if (!best) return null
  const q = fixQuality(bestD)
  return q === 'miss' ? null : { bug: best, quality: q }
}

/**
 * The one control. What it does is whatever the head is over — `release.ts`'s
 * rule, unchanged; what is new is what it does to the head afterwards.
 */
export function tapRing(p: RingPlay, seed: number, ordinal: number): { play: RingPlay; event: RingEvent } {
  if (!p.started) return { play: { ...p, started: true }, event: { kind: 'start' } }
  if (ringExpired(p)) return { play: p, event: { kind: 'expired' } }
  const hit = bugUnderHead(p)
  if (!hit) {
    if (inShipZone(p.turn)) return { play: p, event: { kind: 'ship' } }
    return {
      play: { ...p, streak: 0, tempo: 1, stall: MISS_STALL_MS, misses: p.misses + 1 },
      event: { kind: 'miss' },
    }
  }
  const { bug, quality } = hit
  const clean = quality === 'clean'
  const streak = clean ? p.streak + 1 : 0
  const tempo = clean ? Math.min(TEMPO_MAX, p.tempo + TEMPO_STEP) : p.tempo
  // A clean hit wins hype back, never past the start of the stage it is in.
  const stageStart = Math.floor(p.elapsed / p.period) * p.period
  const elapsed = clean ? Math.max(stageStart, p.elapsed - CLEAN_REFUND * p.period) : p.elapsed
  // A clean fix carries the head on through the backlog; a rushed fix bounces
  // it back, and an armour crack turns it round onto the plate it just dented.
  const bounces = !clean || bug.hp > 1
  const turned = {
    ...p,
    elapsed,
    dir: (bounces ? -p.dir : p.dir) as 1 | -1,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    tempo,
    stall: 0,
  }
  if (bug.hp > 1) {
    const cracked = { ...bug, hp: bug.hp - 1 }
    return {
      play: { ...turned, bugs: p.bugs.map((b) => (b.id === bug.id ? cracked : b)) },
      event: { kind: 'crack', quality, bug: cracked, streak },
    }
  }
  const fixes = p.fixes + 1
  // A rushed fix that regressed reopens in the same slot as a plain bug: a
  // retry can never land somewhere unaimable, and the reversal has just put
  // the head on top of it, which is the joke.
  const broke = !clean && regresses(seed, ordinal, bug.id, fixes)
  const left = p.bugs.filter((b) => b.id !== bug.id)
  const regressed: RingBug | null = broke ? { id: p.nextId, t: bug.t, kind: 'bug', hp: 1, v: 0 } : null
  if (regressed) left.push(regressed)
  return {
    play: { ...turned, fixes, bugs: left, nextId: p.nextId + (regressed ? 1 : 0) },
    event: { kind: 'fix', quality, bug, regressed, cleared: left.length === 0, streak },
  }
}
