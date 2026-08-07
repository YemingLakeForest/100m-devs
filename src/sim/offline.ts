/**
 * Offline progression — GDD §24.5–24.7, and `playbook/SAVE.md` §5.
 *
 * **Nothing in this file may call `tick()`.** SAVE.md §5.1 calls "integrate,
 * never simulate" the rule most likely to be got wrong by a team with a good
 * simulation, and we have a good simulation. Replaying eight hours of the real
 * loop stutters for seconds on a phone, is non-deterministic the moment
 * anything in the loop is random, and drifts between two devices computing the
 * same absence. All three failures are invisible in a unit test and obvious to
 * a player.
 *
 * We get the strongest version of that rule for free. During an absence
 * headcount is frozen, D_cap is frozen, and therefore eta is frozen (§24.6 —
 * nothing hires, nothing decays, no events fire), so passive velocity is a
 * *constant* and the whole yield is `rate * seconds`. No buckets are needed at
 * all. If a future upgrade makes the offline rate time-varying, this becomes a
 * fixed bucket count and the approximation is accepted: consistency across
 * devices matters far more than precision, and the player cannot tell.
 *
 * Every function here is pure. The only clock is the `now` passed in.
 */

import Decimal from 'break_infinity.js'

/**
 * Absences shorter than this do not produce a §24.8 report.
 *
 * MONETISATION §4 R1's own trigger. It is also a quality bar: a summary screen
 * that opens to announce forty Story Points cheapens every later one.
 */
export const OFFLINE_MIN_SECONDS = 30 * 60

/**
 * The starting cap — GDD §24.5. **Two hours, deliberately.**
 *
 * SAVE.md §5.3 puts the genre band at 2–4h and warns that a generous starting
 * cap is a permanent revenue floor given away for nothing, and that it cannot
 * be lowered later without reading as a nerf. Two hours leaves *two* upgrade
 * steps to sell (2h -> 4h earned, 4h -> 16h subscribed) rather than one.
 */
export const OFFLINE_BASE_CAP_SECONDS = 2 * 60 * 60

/**
 * Offline output as a fraction of the active passive rate — §24.5.
 *
 * SAVE.md §5.3's band is 50–100% and we sit at the floor, because §6's thesis
 * requires that attention beats absence. An idle game whose offline rate
 * matches its active rate has told the player not to open it.
 */
export const OFFLINE_BASE_RATE = 0.5

/** §24.5 — the earned Paradigm Tree node that takes the cap 2h -> 4h. */
export const NODE_OFFLINE_CAP_4H = 'offline_cap_4h'

/** §24.5 — the earned Paradigm Tree node, +25% offline rate per level. */
export const NODE_OFFLINE_RATE = 'offline_rate'

/** MONETISATION §7 — SERIES A. Cap 4h -> 16h, and +50% rate. */
export const ENTITLEMENT_SERIES_A = 'series-a'

/** GDD §13.3 L2-2B. Owning it is what lets an absence chain-ship (§24.6). */
export const NODE_CI_CD_AUTOPILOT = 'L2-2B'

const HOUR = 60 * 60

/**
 * Hard bound on the §24.6 chain-ship walk.
 *
 * The one iterative step in the whole model, and SAVE.md §5.1 explicitly
 * permits "a few dozen". The bound is not a balance figure — it exists so that
 * a degenerate commitment ladder (a project priced at zero, a NaN that slipped
 * a defensive default) cannot spin the main thread on app open, which is the
 * exact symptom §5.1 is written to prevent.
 */
export const MAX_OFFLINE_SHIPS = 64

/** State frozen at the moment of the save. Every field comes off `SaveData`. */
export interface OfflineSnapshot {
  /** Epoch ms. **The only clock** — SAVE.md §5.2 forbids a second one. */
  savedAt: number
  /** Active passive SP/sec at save time, already taxed by eta (§4.4). */
  velocity: number
  /** Sprint Commitment of the project in progress (§10.4). */
  commitment: Decimal
  /** Burn-down progress into that commitment. */
  burned: Decimal
  projectIndex: number
  /**
   * Highest index the project ladder actually has.
   *
   * Needed because `commitmentFor` clamps internally, so it keeps returning a
   * valid commitment for an index that has already run off the end — which let
   * the chain-ship loop advance the index all the way to the ship cap against
   * a three-project ladder. `PROJECTS[projectIndex]` was then undefined and a
   * returning player got a project with no name and no commitment.
   */
  maxProjectIndex: number
  /** Sprint Commitment of the nth project. Walked only when chain-shipping. */
  commitmentFor: (index: number) => Decimal
  /** GDD §4.10 — dollars per Story Point shipped. */
  revenuePerSp: number
  /** Does the player own CI/CD Autopilot (§13.3 L2-2B)? See {@link offlineYield}. */
  autoShip: boolean
}

export interface OfflineConfig {
  capSeconds: number
  /** Fraction of the active rate. {@link OFFLINE_BASE_RATE}, times upgrades. */
  rateMultiplier: number
  /** §24.5 — offline accrual does not exist until the first Paradigm Shift. */
  unlocked: boolean
}

export interface OfflineReport {
  /** Real seconds since the save, clamped at zero but **not** by the cap. */
  elapsedSeconds: number
  /** Seconds actually paid for, after the cap. */
  paidSeconds: number
  /** Seconds thrown away by the cap — §24.8's `BUILD SERVER IDLE` figure. */
  idleSeconds: number
  /** Should §24.8 render at all? */
  qualifies: boolean
  storyPoints: Decimal
  /** Burn-down after the yield lands. */
  burned: Decimal
  /** Sprint Commitment after any chain-shipping. */
  commitment: Decimal
  projectIndex: number
  projectsShipped: number
  revenue: Decimal
  /** True if {@link MAX_OFFLINE_SHIPS} stopped the walk early. */
  shipCapReached: boolean
}

/**
 * Real seconds between a save and now.
 *
 * **`Math.max(0, ...)` is not defensive padding** (SAVE.md §5.2). Device clocks
 * move backwards: timezone changes, NTP corrections, and players who wind the
 * clock forward to farm and then wind it back. A negative interval must pay
 * zero, not a negative payout — and a negative payout here would *subtract*
 * from the burn-down, which is a corruption rather than an exploit.
 *
 * A non-finite or absent `savedAt` is treated the same way: it means the save
 * has been tampered with or truncated, and the safe reading of an unknown
 * absence is "none".
 */
export function elapsedSeconds(savedAt: number, now: number): number {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now)) return 0
  return Math.max(0, (now - savedAt) / 1000)
}

/** Seconds we will actually pay for — {@link elapsedSeconds}, capped. */
export function paidSeconds(savedAt: number, now: number, capSeconds: number): number {
  const cap = Number.isFinite(capSeconds) ? Math.max(0, capSeconds) : 0
  return Math.min(elapsedSeconds(savedAt, now), cap)
}

/**
 * The offline cap, in seconds — GDD §24.5.
 *
 * MONETISATION §7 sells this as "4h -> 16h", which reads as a contradiction
 * with a 2h start and is not one: 4h is the cap of every player who will ever
 * be *offered* a subscription, because MONETISATION §4 forbids any offer before
 * the first Paradigm Shift and the first Paradigm Shift is where the 2h -> 4h
 * node becomes purchasable. Both documents describe a different player.
 */
export function offlineCapSeconds(
  nodes: readonly string[],
  entitlements: readonly string[],
): number {
  if (entitlements.includes(ENTITLEMENT_SERIES_A)) return 16 * HOUR
  if (nodes.includes(NODE_OFFLINE_CAP_4H)) return 4 * HOUR
  return OFFLINE_BASE_CAP_SECONDS
}

/**
 * Offline rate as a fraction of the active rate — §24.5's other upgrade axis.
 *
 * The node is additive per level and SERIES A is additive on top, so the two
 * read as one axis on the store page rather than as a multiplier stack the
 * player has to reason about.
 */
export function offlineRateMultiplier(
  nodeLevels: Readonly<Record<string, number>>,
  entitlements: readonly string[],
): number {
  // `Math.max(0, Math.floor(NaN))` is NaN, and a NaN rate silently zeroes the
  // whole payout on return — the loudest possible bug arriving completely
  // silently. Guard finiteness before the clamp, not after it.
  const raw = nodeLevels[NODE_OFFLINE_RATE]
  const level = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
  const subscribed = entitlements.includes(ENTITLEMENT_SERIES_A) ? 0.5 : 0
  return OFFLINE_BASE_RATE * (1 + 0.25 * level + subscribed)
}

/**
 * The closed form. **This is the whole accrual model** (§24.7).
 *
 * Kept separate from {@link offlineYield} because it is the piece with the
 * property that actually matters: it is linear in `seconds`, so integrating one
 * long absence equals summing many short ones. If that ever stops holding, two
 * devices will disagree about the same eight hours.
 */
export function offlineStoryPoints(
  velocity: number,
  seconds: number,
  rateMultiplier: number,
): Decimal {
  if (!Number.isFinite(velocity) || velocity <= 0) return new Decimal(0)
  if (!Number.isFinite(seconds) || seconds <= 0) return new Decimal(0)
  if (!Number.isFinite(rateMultiplier) || rateMultiplier <= 0) return new Decimal(0)
  return new Decimal(velocity).times(rateMultiplier).times(seconds)
}

/**
 * Resolve an absence into a §24.8 report. Pure; `now` is the only clock.
 *
 * The shipping rule is GDD §24.6 and it is a design decision, not a
 * simplification: **without CI/CD Autopilot the burn-down fills and clamps at
 * 100%**, leaving the project complete and waiting on the player's ship. That
 * respects SAVE.md §5.5 (a decision must not be resolved while the player is
 * away) and it gives §13.3's L2-2B a concrete meaning — with the node an
 * overnight absence chain-ships and banks revenue, without it the line goes
 * flat at one project. Shipping is a decision right up until the player buys
 * the thing whose name is "you no longer decide this".
 *
 * The 2x rewarded offer of MONETISATION §4 R1 is not a separate code path: it
 * is this function with `rateMultiplier` doubled.
 */
export function offlineYield(
  snap: OfflineSnapshot,
  config: OfflineConfig,
  now: number,
): OfflineReport {
  const elapsed = elapsedSeconds(snap.savedAt, now)
  const paid = config.unlocked ? Math.min(elapsed, Math.max(0, config.capSeconds)) : 0
  const qualifies = config.unlocked && elapsed >= OFFLINE_MIN_SECONDS

  const storyPoints = offlineStoryPoints(snap.velocity, paid, config.rateMultiplier)

  let burned = snap.burned.plus(storyPoints)
  let commitment = snap.commitment
  let projectIndex = snap.projectIndex
  let projectsShipped = 0
  let revenue = new Decimal(0)
  let shipCapReached = false

  if (snap.autoShip) {
    // A few dozen steps at most, and bounded even against a malformed ladder.
    while (commitment.gt(0) && burned.gte(commitment)) {
      if (projectsShipped >= MAX_OFFLINE_SHIPS) {
        shipCapReached = true
        break
      }
      revenue = revenue.plus(commitment.times(snap.revenuePerSp))
      burned = burned.minus(commitment)
      // Clamped exactly as the online ship path clamps it: the ladder ends,
      // and its last project repeats rather than the index running past it.
      projectIndex = Math.min(projectIndex + 1, snap.maxProjectIndex)
      commitment = snap.commitmentFor(projectIndex)
      projectsShipped += 1
    }
  }

  // Clamp whenever the burn-down cannot advance further: no autopilot, the ship
  // cap hit, or a degenerate commitment. A burn-down past 100% would render a
  // bar wider than its track.
  if (commitment.gt(0) && burned.gt(commitment)) burned = commitment
  if (commitment.lte(0)) burned = snap.burned

  return {
    elapsedSeconds: elapsed,
    paidSeconds: paid,
    idleSeconds: Math.max(0, elapsed - paid),
    qualifies,
    storyPoints,
    burned,
    commitment,
    projectIndex,
    projectsShipped,
    revenue,
    shipCapReached,
  }
}
