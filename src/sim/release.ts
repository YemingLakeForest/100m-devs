/*
 * Copied from the rebuild (100m-devs-three/src/sim/release.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
/**
 * The release window — GDD §10.7 [CANON - added 2026-09-14, at the user's
 * instruction], which supersedes legacy §10.8b. See §10.7.5 for what moved.
 *
 * A finished build used to become a shipped game inside a single `if` in
 * `tick`. That is correct simulation and it is the loop's payoff arriving as a
 * side effect: the one moment per project the player has actually been working
 * toward happened *to* them, at a frame boundary, with nothing to do about it.
 *
 * So a finished build is **shelved**, and releasing it is a decision. The
 * decision has two halves, and they are the two halves a real studio argues
 * about in the last week before a launch:
 *
 *  - **What is still broken.** §4.12's defect backlog goes out *with* the game
 *    and §4.12a pages you about it afterwards. Until now the player could
 *    never touch it directly — defects arrived, accumulated and shipped, and
 *    the only lever was buying a node months earlier.
 *  - **When it goes out.** §4.10c already says revenue is a fact about the
 *    studio rather than about the Story Points, and *when you put it in front
 *    of people* is the last input to that nobody was modelling.
 *
 * ## One ring, one head, one button
 *
 * The ring is **one fiscal year**. The head sweeps it at a constant rate. The
 * top of the ring is the release date, with the timing bands drawn either side;
 * the rest of the year is where the open defects sit.
 *
 * There is **one control**, and its meaning is whatever the head is over:
 * *Fix it* on a defect, *Ship it* in the window, *Commit* on bare calendar.
 * That is possible because the two jobs are separated in *space* rather than
 * by a second button — defects may never sit within {@link BUG_EXCLUSION} of
 * the top, so a tap near the date can only ever have meant "ship". The
 * ambiguity is removed by the layout, not by asking the player to be careful.
 *
 * **Two buttons was the first design and it was two minigames sharing a
 * screen.** Fixing and shipping were separate verbs with separate controls and
 * nothing made the player weigh one against the other; you cleared the
 * backlog, then you aimed. The rule below is what welds them together.
 *
 * ## The window is worth less every year — and that is the whole decision
 *
 * The **angle** says how well the date was picked *within* a year. The **lap**
 * says which year it is. {@link bandIndexFor} adds them, so dead centre is a
 * perfect launch in year one, *fashionably late* in year two and a missed
 * season in year four: the same slot on the calendar, worth less each time it
 * comes round.
 *
 * That single rule is what makes this one decision instead of two:
 *
 * > **A perfect launch is only on the table in year one, and in year one the
 * > backlog is still full.**
 *
 * Every defect the player stops to fix costs them the best window this build
 * will ever be offered. Fixing and timing are not two problems on one screen;
 * they are one budget, and the ring shows it being spent.
 *
 * ## Three properties, and the whole design is in them
 *
 *  1. **Doing nothing costs nothing.** A build the player never comes here for
 *     leaves the shelf on {@link TRAIN_LAUNCH}: neutral timing, neutral
 *     readiness, ×1 exactly, and a launch term of exactly ½. §21's measured Run
 *     1 economy is untouched by adding a minigame to it — the same argument
 *     `rating.ts` makes for `BASELINE_RATING`.
 *
 *     **Running the years out is a different thing and it is not free.** That
 *     player came and dithered; they missed the season. The floor is at the
 *     shelf, not inside a window somebody opened.
 *  2. **A blind press is worth nothing either.** {@link MISSED_MULTIPLIER} is
 *     *derived* so the width-weighted mean of the ramp across the bar is
 *     exactly ×1. On top of that, tapping at random here cannot even produce a
 *     release: outside {@link SHIP_ZONE} a tap is not a launch at all, it is a
 *     commit nobody asked for, and it opens a defect.
 *  3. **Speed changes skill, never the baseline.** {@link turnPeriodMs} makes
 *     later, larger releases turn faster. Because of (2) that cannot re-tune
 *     the economy for anybody; it only widens the gap between a studio that
 *     attends its own launches and one that does not.
 *
 * §26.3.4's standing constraint — *"no minigame may be the optimal way to
 * play"* — holds by construction. This is amplitude on a payout the loop
 * already produces, it cannot be farmed (the release rate is the loop's, not
 * the player's), and its ceiling is ×1.75 against a defect backlog's ×0.55.
 *
 * ## What left this file, and why
 *
 * `stallSeconds`, `STALL_MARGIN_MS`, `AUTO_LAUNCH_SWEEPS` and
 * `LAUNCH_WINDOW_COOLDOWN_SECONDS` are gone. All four served legacy §10.8b's
 * shape, where the window was a modal that **halted the studio** and therefore
 * owed the player a timeout, a simulation-side backstop for a hidden tab, and
 * a cooldown so a studio shipping ten games a minute did not become a
 * slideshow of its own celebration. §12.5 settles the first — a surface does
 * not pause the world — and the **shelf** settles the other two. A constant
 * with no caller quietly comes back, so they left with their reasons recorded.
 *
 * Pure — no store, no clock, no renderer.
 */

import { draw } from './identity.ts'

/** Which ring of the window the release landed in. */
export type LaunchBandId = 'perfect' | 'window' | 'soft' | 'missed'

/** Which side of the date it landed on. The payout is symmetric; the joke is not. */
export type LaunchSide = 'early' | 'late'

export interface LaunchBand {
  id: LaunchBandId
  /**
   * The outer edge of this ring, as a fraction of the half-year. Cumulative, so
   * the ring's own width is this minus the previous one's — which is what
   * {@link MISSED_MULTIPLIER}'s derivation weights by.
   */
  edge: number
  multiplier: number
  /** What the studio just did to itself, per side. */
  label: Record<LaunchSide, string>
  /** The short form, for the button and the release log. */
  short: string
}

/** ×1. The neutral point, and the value of every path that is not a decision. */
export const NEUTRAL_MULTIPLIER = 1

/**
 * The two ratios the player can aim for. **Their order is canon and their
 * values are not** — §25.3.2, the same dodge `rating.ts` documents.
 */
const PERFECT_MULTIPLIER = 1.75
const WINDOW_MULTIPLIER = 1.25

/** The rings, inner to outer, as cumulative edges on the half-year. */
const EDGES = { perfect: 0.09, window: 0.3, soft: 0.64, missed: 1 } as const

/**
 * **Derived, so the ramp cannot secretly pay for itself.**
 *
 * Each ring's share of the calendar is its own width, so fixing the outer ring
 * at whatever makes the width-weighted mean exactly ×1 is what makes property
 * (2) in the file header true rather than asserted.
 *
 * It lands near ×⅔, which is also about where it belongs on feel — a missed
 * season is the worst thing in this file and it is still gentler than shipping
 * a game with a rotten defect backlog (`revenueMultiplier`, ×0.55). The satire
 * has to survive the scoring here for the same reason it does there.
 */
export const MISSED_MULTIPLIER =
  (1 -
    (EDGES.perfect * PERFECT_MULTIPLIER +
      (EDGES.window - EDGES.perfect) * WINDOW_MULTIPLIER +
      (EDGES.soft - EDGES.window) * NEUTRAL_MULTIPLIER)) /
  (EDGES.missed - EDGES.soft)

/** The ring an unattended launch resolves into. See {@link NEUTRAL_MULTIPLIER}. */
export const BAND_SOFT: LaunchBandId = 'soft'

export const LAUNCH_BANDS: readonly LaunchBand[] = [
  {
    id: 'perfect', edge: EDGES.perfect, multiplier: PERFECT_MULTIPLIER, short: 'PERFECT',
    label: { early: 'PERFECT WINDOW', late: 'PERFECT WINDOW' },
  },
  {
    id: 'window', edge: EDGES.window, multiplier: WINDOW_MULTIPLIER, short: 'AHEAD',
    label: { early: 'AHEAD OF THE CURVE', late: 'FASHIONABLY LATE' },
  },
  {
    id: 'soft', edge: EDGES.soft, multiplier: NEUTRAL_MULTIPLIER, short: 'QUIET',
    label: { early: 'STILL IN BETA', late: 'QUIET LAUNCH' },
  },
  {
    id: 'missed', edge: EDGES.missed, multiplier: MISSED_MULTIPLIER, short: 'MISSED',
    label: { early: 'SHIPPED HALF A GAME', late: 'MISSED THE SEASON' },
  },
]

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/* -------------------------------------------------------------------------
 * The ring.
 * ---------------------------------------------------------------------- */

/** Years the studio gets before the team ships it without being asked. */
export const YEARS = 4

/**
 * How far from the release date a tap may still be a release, in turns either
 * side of the top.
 *
 * **This is what makes one button possible.** The ring carries two jobs, so
 * they are separated in space; a tap means whatever the head is over. Narrower
 * than the soft band's own 0.32 on purpose — the window has to leave the
 * majority of the year to the backlog, or there is nowhere to put the other
 * half of the game.
 */
export const SHIP_ZONE = 0.2

/**
 * No defect may sit this near the release date, in turns.
 *
 * The gap between {@link SHIP_ZONE} and this is a **dead zone**, drawn on the
 * ring, and it is the disambiguation: inside it there is nothing to fix and it
 * is not yet a release, so the one control can never mean two things at once.
 * Being 0.3, defects live in the 40% of the year furthest from the date.
 */
export const BUG_EXCLUSION = 0.3

/** Where the head is after `elapsedMs`, as a fraction of a turn from the date. */
export function headAt(elapsedMs: number, periodMs: number): number {
  if (!(periodMs > 0) || !Number.isFinite(elapsedMs)) return 0
  return (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs
}

/** Which year the studio is in after `elapsedMs`. One-based, clamped at {@link YEARS}. */
export function yearAt(elapsedMs: number, periodMs: number): number {
  if (!(periodMs > 0) || !Number.isFinite(elapsedMs) || elapsedMs < 0) return 1
  return Math.min(YEARS, 1 + Math.floor(elapsedMs / periodMs))
}

/** Signed distance from the release date, in turns: negative is early. */
export function wrapTurn(turn: number): number {
  if (!Number.isFinite(turn)) return 0
  const w = ((turn % 1) + 1) % 1
  return w > 0.5 ? w - 1 : w
}

/** How far from the release date, 0 at the date and 1 at the far side of the year. */
export function offsetFromDate(turn: number): number {
  return Math.min(1, Math.abs(wrapTurn(turn)) * 2)
}

/** Whether a tap here is a release at all. Outside this it is a stray commit. */
export function inShipZone(turn: number): boolean {
  return Math.abs(wrapTurn(turn)) <= SHIP_ZONE
}

/** Which ring an angle is in, before the years are taken off it. */
export function angleBandAt(turn: number): number {
  const d = offsetFromDate(turn)
  const i = LAUNCH_BANDS.findIndex((b) => d <= b.edge)
  return i < 0 ? LAUNCH_BANDS.length - 1 : i
}

/**
 * **The window is worth less every year you leave it.**
 *
 * The angle says how well the date was picked within a year; the year says
 * which year it is, and they add. Shipping into Q4 is a perfect launch in year
 * one and the same calendar slot two years late in year three.
 *
 * This is the rule the whole screen turns on — see the file header. It is also
 * why running the clock out needs no special number: it is simply the worst
 * case of the same arithmetic.
 */
export function bandIndexFor(turn: number, year: number): number {
  const y = Number.isFinite(year) ? Math.max(1, Math.floor(year)) : 1
  return Math.min(LAUNCH_BANDS.length - 1, angleBandAt(turn) + (y - 1))
}

/* -------------------------------------------------------------------------
 * The backlog on the ring.
 * ---------------------------------------------------------------------- */

/** Channels, kept together so two draws can never share one. */
const CH = { defect: 201, regression: 202 } as const

/**
 * Where this release's open defects sit on the year — deterministic in
 * `(seed, ordinal)`, like everything else a release is made of.
 *
 * Laid out with a minimum separation so two defects never overlap into one
 * unhittable smear, and never inside {@link BUG_EXCLUSION}. A reload cannot
 * reshuffle a ring the player is halfway through clearing.
 */
export function defectRing(seed: number, ordinal: number, count: number): number[] {
  const n = Math.max(0, Math.floor(count))
  if (n === 0) return []
  const span = 1 - BUG_EXCLUSION * 2
  const slot = span / n
  /*
   * **Jittered slots, not rejection sampling.**
   *
   * The first pass rolled each position and rejected any that landed too near
   * an existing one — then fell back to an evenly spaced slot when the rolls
   * ran out, which could itself land on top of a position already taken. The
   * invariant held for most rings and broke for the crowded ones, which is the
   * worst way for it to break: two defects inside one reach are one defect the
   * player cannot finish, and it would only have happened on a long backlog.
   *
   * One defect per slot with a bounded jitter guarantees the separation by
   * construction instead, and stays varied. The jitter narrows as the slots do,
   * so a crowded ring stays hittable rather than staying pretty.
   */
  const jitter = Math.max(0, Math.min(0.5, 1 - (REACH_CLEAN * 1.5) / slot))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const inSlot = (1 - jitter) / 2 + draw(seed, ordinal, CH.defect + i) * jitter
    out.push(BUG_EXCLUSION + (i + inSlot) * slot)
  }
  return out
}

/* -------------------------------------------------------------------------
 * Fixing, and what a rushed fix costs.
 * ---------------------------------------------------------------------- */

export type FixQuality = 'clean' | 'rushed' | 'miss'

/**
 * **Two reaches, and the wide one always lands.**
 *
 * The first pass had one window and a regression chance that climbed with
 * every fix. That is not difficulty, it is noise: being precise bought the
 * player nothing and staying to finish the job was punished at random, so
 * anyone who cleared a backlog had been lucky and could tell.
 *
 * The old window is now the **core** — hit it and the fix is clean, which can
 * never regress — and a much wider band around it still fixes the defect, with
 * a chance of opening another. Progress is never taken away for being slightly
 * late; only accuracy is. Both bands are drawn on the ring, so the rule is
 * legible before it is explained.
 */
export const REACH_CLEAN = 0.024
export const REACH_RUSHED = 0.066

/** What a tap this far from a defect does to it. */
export function fixQuality(distance: number): FixQuality {
  const d = Number.isFinite(distance) ? Math.abs(distance) : 1
  if (d <= REACH_CLEAN) return 'clean'
  if (d <= REACH_RUSHED) return 'rushed'
  return 'miss'
}

/**
 * §1, as arithmetic, and only where the player chose it.
 *
 * A **rushed** fix is the one that opens the next defect, and the codebase
 * does get tireder the longer you stay in it. A **clean** fix never regresses
 * at any depth, so precision is the answer to the ramp rather than luck being
 * it — which is the difference between a mechanic and a slot machine.
 */
export const REGRESSION_BASE = 0.12
export const REGRESSION_STEP = 0.025
export const REGRESSION_CAP = 0.25

export function regressionChance(fixes: number): number {
  const n = Number.isFinite(fixes) ? Math.max(0, Math.floor(fixes)) : 0
  return Math.min(REGRESSION_CAP, REGRESSION_BASE + n * REGRESSION_STEP)
}

/**
 * Whether this particular rushed fix opened something else — deterministic in
 * the release and the fix's own index, so a reload cannot reroll a regression
 * the player has already been shown.
 */
export function regresses(seed: number, ordinal: number, fixIndex: number, fixes: number): boolean {
  return draw(seed, ordinal, CH.regression + fixIndex) < regressionChance(fixes)
}

/* -------------------------------------------------------------------------
 * Readiness — what is left in the backlog when it goes out.
 * ---------------------------------------------------------------------- */

/** The four stages a build can go out at, worst first. */
export type ReadinessStage = 'ALPHA' | 'BETA' | 'RC' | 'GOLD'

export interface ReadinessBand {
  id: ReadinessStage
  /** Fraction of the opening backlog that has to be closed to reach this stage. */
  from: number
  /**
   * What a build at this stage is worth to §4.14's Launch term.
   *
   * The middle of the band rather than its floor, because a stage names a
   * range and the honest reading of "it went out at RC" is *somewhere in RC*.
   * GOLD is the exception at exactly 1: GOLD is not a range, it is an empty
   * backlog.
   */
  value: number
}

export const READINESS_BANDS: readonly ReadinessBand[] = [
  { id: 'ALPHA', from: 0, value: 0.1 },
  { id: 'BETA', from: 1 / 3, value: 0.4 },
  { id: 'RC', from: 2 / 3, value: 0.79 },
  { id: 'GOLD', from: 1, value: 1 },
]

/**
 * What stage a build goes out at, given what is still open.
 *
 * **GOLD requires an empty backlog and nothing else does.** A build with one
 * defect left in it is a release candidate, not a finished game, however small
 * the fraction looks — so the top stage is gated on the count rather than on
 * the ratio, and a big backlog cannot round its way to gold.
 */
export function stageFor(open: number, initial: number): ReadinessStage {
  const left = Number.isFinite(open) ? Math.max(0, Math.floor(open)) : 0
  if (left === 0) return 'GOLD'
  const start = Number.isFinite(initial) ? Math.max(1, Math.floor(initial)) : 1
  const cleared = clamp01(1 - left / start)
  let stage: ReadinessStage = 'ALPHA'
  for (const band of READINESS_BANDS) {
    if (band.id === 'GOLD') continue
    if (cleared >= band.from) stage = band.id
  }
  return stage
}

/** What a build described only by its stage is worth. See {@link ReadinessBand.value}. */
export function stageReadiness(stage: ReadinessStage): number {
  return (READINESS_BANDS.find((b) => b.id === stage) ?? READINESS_BANDS[0]).value
}

/* -------------------------------------------------------------------------
 * The outcome, and what it is worth.
 * ---------------------------------------------------------------------- */

export interface LaunchHit {
  /** Where on the year it went out, 0..1 from the release date. */
  at: number
  band: LaunchBandId
  side: LaunchSide
  label: string
  short: string
  multiplier: number
}

export interface LaunchOutcome {
  timing: LaunchHit
  /** {@link stageReadiness} of the stage it went out at, 0..1. */
  readiness: number
  stage: ReadinessStage
  /** Which year of the window it went out in. 1 for a build nobody sat on. */
  year: number
  /**
   * Defects still open when it shipped, against the ring it started with —
   * §4.12's backlog, transferred.
   *
   * **Both numbers, because a ratio is what the caller needs and one of them
   * alone is a trap.** The train carried `open: 0` in the first pass, which the
   * store correctly read as *the player cleared everything* — so an unattended
   * release shipped a spotless game and the backlog was silently forgiven. An
   * outcome that cannot state what it was measured against will be measured
   * against something else.
   *
   * `open` may exceed `initial`: a session that opened more than it closed had
   * a bad afternoon, and that is a true thing to record.
   */
  open: number
  initial: number
  /** False for the shelf's train and for Serena's pipeline — nobody was watching. */
  attended: boolean
}

/**
 * How the two halves are weighted against each other, for §4.14's Launch term.
 *
 * **Readiness carries more, and it has to.** Timing is an aim test and
 * readiness is a decision about what to ship; §26.3.4 forbids a minigame being
 * the optimal way to play, and a term that paid mostly for reflexes would make
 * the rating a test of them. Sixty/forty is also what keeps the train's ½ the
 * *middle* of the range rather than the bottom of it.
 */
export const LAUNCH_SPLIT = { readiness: 0.6, timing: 0.4 } as const

/**
 * What each timing band is worth to the *score*, as distinct from the payout.
 *
 * Not the revenue multipliers: those are a ramp about money, centred on ×1 and
 * derived so a blind press is worth nothing. This is a 0..1 term of a rating,
 * and its neutral is ½ because every other term's neutral is ½.
 */
export const TIMING_SCORE: Record<LaunchBandId, number> = {
  perfect: 1,
  window: 0.8,
  soft: 0.5,
  missed: 0.15,
}

/** §4.14's Launch input, 0..1. See {@link LAUNCH_SPLIT}. */
export function launchScore(outcome: LaunchOutcome): number {
  return clamp01(
    LAUNCH_SPLIT.readiness * clamp01(outcome.readiness) +
    LAUNCH_SPLIT.timing * TIMING_SCORE[outcome.timing.band],
  )
}

function hitFrom(index: number, turn: number, forceLate = false): LaunchHit {
  const band = LAUNCH_BANDS[Math.min(LAUNCH_BANDS.length - 1, Math.max(0, index))]
  const side: LaunchSide = forceLate || wrapTurn(turn) >= 0 ? 'late' : 'early'
  return {
    at: ((turn % 1) + 1) % 1,
    band: band.id,
    side,
    label: band.label[side],
    short: band.short,
    multiplier: band.multiplier,
  }
}

export interface LaunchInput {
  /** Where the head was when they pressed it. */
  turn: number
  /** Which year of the window. */
  year: number
  /** Defects still open. */
  open: number
  /** How many the backlog opened with, for the stage. */
  initial: number
  /**
   * False when the years ran out rather than the player picking the moment.
   *
   * They still attended — they came and they dithered — so this is not the
   * train. It is the worst band of the same arithmetic, which is what "missed
   * the season" means.
   */
  chosen: boolean
}

/** Resolve a release the player was present for. */
export function launchOutcome(input: LaunchInput): LaunchOutcome {
  const year = Number.isFinite(input.year) ? Math.max(1, Math.floor(input.year)) : 1
  const open = Number.isFinite(input.open) ? Math.max(0, Math.floor(input.open)) : 0
  const stage = stageFor(open, input.initial)
  const index = input.chosen ? bandIndexFor(input.turn, year) : LAUNCH_BANDS.length - 1
  return {
    timing: hitFrom(index, input.turn, !input.chosen),
    readiness: stageReadiness(stage),
    stage,
    year,
    open,
    initial: Number.isFinite(input.initial) ? Math.max(0, Math.floor(input.initial)) : 0,
    attended: true,
  }
}

/**
 * A build nobody came for — the shelf overflowing, and §24.8's offline ships.
 *
 * Deliberately **not** the ring at whatever angle it happened to be: the head's
 * position at a fixed time is not uniform, it is one exact spot, so an absent
 * player would be paid the same band every single release. That would be a tax
 * on not playing a minigame, which is the one thing §26.3.4 forbids outright.
 * The honest reading of "nobody pressed the button" is *it went out whenever,
 * half-finished*, which is the neutral ring at the middle stage.
 *
 * Both halves are neutral, so {@link launchScore} is exactly ½ and the payout
 * multiplier is exactly ×1 — property (1) in the file header, in both
 * currencies. **This is the floor, and it is at the shelf**: a player who never
 * opens the window earns precisely what they earned before it existed.
 */
export const TRAIN_LAUNCH: LaunchOutcome = {
  timing: {
    at: 0.5 + (EDGES.window + EDGES.soft) / 4,
    band: BAND_SOFT,
    side: 'late',
    label: LAUNCH_BANDS[2].label.late,
    short: LAUNCH_BANDS[2].short,
    multiplier: NEUTRAL_MULTIPLIER,
  },
  readiness: 0.5,
  stage: 'BETA',
  year: 1,
  /*
   * **Nobody fixed anything, so everything ships.** The launch *term* is neutral
   * — that is what property (1) is about — but the defect backlog is a separate
   * input and forgiving it would pay a player for work they did not do. One of
   * one still open says exactly that, in the ratio the caller reads.
   */
  open: 1,
  initial: 1,
  attended: false,
}

/**
 * Serena's release pipeline — §7.1's reliability branch, the later slice.
 *
 * The fiction is CI/CD. The arithmetic is the point: **automation is worth
 * exactly what a competent unattended launch is worth, and never what an
 * attended perfect one is.** A build goes out on its own at RC on a neutral
 * date, which beats the train (a better build) and loses to a player who
 * turned up (a worse date, for ever). Each DEPTH rank past the node raises the
 * stage one step, so the ceiling is a GOLD build on a date nobody chose.
 *
 * `HeroFold.autoRelease` is the seam and it lands with the shelf; no node sets
 * it yet.
 */
export function pipelineLaunch(stagesUp = 0): LaunchOutcome {
  const base = READINESS_BANDS.findIndex((b) => b.id === 'RC')
  const band = READINESS_BANDS[
    Math.min(READINESS_BANDS.length - 1, base + Math.max(0, Math.floor(stagesUp)))
  ]
  return { ...TRAIN_LAUNCH, readiness: band.value, stage: band.id }
}

/** How long one turn of the ring takes at the first rung of §4.10c's ladder. */
export const TURN_MS_FIRST_PROJECT = 6_200
/** ...and at the last authored rung. See the file header, property (3). */
export const TURN_MS_LAST_PROJECT = 4_400

/**
 * How long one full turn of the ring takes, by ladder rung.
 *
 * A garage's launch is a slow, forgiving ring; a live-service hero shooter's is
 * not. The ramp is linear in the rung rather than in the payout, because the
 * payouts span five orders of magnitude and the *difficulty* must not.
 */
export function turnPeriodMs(projectIndex: number, projectCount: number, marks = 0): number {
  const crowdFloor = Number.isFinite(marks) ? Math.max(0, marks) * 750 : 0
  if (!(projectCount > 1)) return Math.max(TURN_MS_FIRST_PROJECT, crowdFloor)
  const i = Math.min(Math.max(0, Math.floor(projectIndex)), projectCount - 1)
  const t = i / (projectCount - 1)
  return Math.max(crowdFloor, TURN_MS_FIRST_PROJECT + t * (TURN_MS_LAST_PROJECT - TURN_MS_FIRST_PROJECT))
}

/**
 * How much slower the ring turns for a player who has asked for less motion.
 *
 * **The one place in the product where §10.5 rule 3 is inverted on purpose.**
 * Rule 3 shortens a transition to ~40%, which is the right accommodation for
 * something the player is *watching* and exactly the wrong one for something
 * they are *aiming at*: a gameplay animation cut to 40% is not an
 * accommodation, it is a harder game.
 *
 * Because the years are turns of the same ring, scaling the period scales the
 * whole clock at once and every relationship in this file survives it — which
 * is the advantage of having one rate instead of two.
 */
export const REDUCED_SWEEP_SCALE = 1.6

/** Start just past the launch window. The first pass gives everyone time to fix
 * bugs before aiming, and both sides of the first top crossing pay year one. */
export function launchClock(elapsedMs: number, periodMs: number): { turn: number; year: number; expired: boolean } {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  return {
    turn: headAt(elapsed + periodMs * (SHIP_ZONE + .01), periodMs),
    year: yearAt(elapsed, periodMs),
    expired: elapsed >= periodMs * YEARS,
  }
}
