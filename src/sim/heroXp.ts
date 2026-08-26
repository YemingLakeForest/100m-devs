/**
 * Hero XP and levels — GDD §13.10, §13.13, R39, R53.
 *
 * §4.5d gave the founder a curve that grows because *you* got better. Heroes
 * need the same thing, and §13.6.5 denied them it: their nodes were bought with
 * GP, which is prestige currency, so a hero could only ever improve *between*
 * runs and never during one.
 *
 * **A placed hero earns XP from the work done under their coverage.**
 *
 * $$\frac{dX_h}{dt} = \xi \cdot V_{\text{covered}(h)}$$
 *
 * `V` is §4.1's velocity, restricted to the developers the coverage rule says
 * the hero reaches. An unplaced hero earns nothing — that is the second reason
 * §13.8's placement matters, and it is a compounding one.
 *
 * ## §13.13 puts a level between the XP and the node
 *
 * §13.10 spent XP directly on nodes, which works and is missing the thing that
 * makes a person feel like they are getting better: a number that goes up and is
 * *theirs*. A currency is something you spend and then do not have.
 *
 * **So XP is never spent.** It reaches levels; a level grants one point; a point
 * buys a node. The consequence worth stating is that there is exactly one number
 * a player compares two heroes by, because §13.13 rejected "levels as a display
 * over an XP wallet" on the grounds that two numbers which can disagree are not
 * a progress reading.
 *
 * Everything here is pure. The store owns the velocity and the placement; this
 * owns the curve.
 */

/**
 * §13.10's rate, `ξ`.
 *
 * A first pass, marked as one. Picked so a hero covering a project completely
 * earns about one level per project shipped early on: a four-hundred-point
 * project at `ξ = 0.025` is ten XP, which is exactly {@link XP_BASE}.
 */
export const XP_RATE = 0.025

/**
 * §13.10a — a posted trailing hero's maximum learning rate and the veteran
 * lead that catch-up deliberately protects.
 *
 * Four times the normal rate is enough for a new arrival to traverse work the
 * veteran took most of a run to earn during the same run, while still making
 * REACH and productive coverage pay exactly as §13.10 requires. The bonus
 * switches off one level behind the leader, who also keeps every node their
 * earlier levels already bought.
 */
export const HERO_CATCH_UP_MAX_MULTIPLIER = 4
export const HERO_CATCH_UP_LEVEL_BUFFER = 1

/** §13.10 — XP accrued from `velocityCovered` for `dt` seconds. */
export function xpAccrued(velocityCovered: number, dt: number): number {
  if (!(velocityCovered > 0) || !(dt > 0)) return 0
  return XP_RATE * velocityCovered * dt
}

/**
 * Extra XP earned by a *posted* trailing hero.
 *
 * This is separated from {@link xpAccrued} so the store must explicitly prove
 * that the hero has settled over productive work before asking for it. It is a
 * multiplier on covered velocity, not a grant: quiet corners still learn
 * slowly, broad coverage still pays twice, and a bench still pays nothing.
 */
export function catchUpXpAccrued(
  currentXp: number,
  leaderXp: number,
  velocityCovered: number,
  dt: number,
): number {
  const ordinary = xpAccrued(velocityCovered, dt)
  if (!(ordinary > 0)) return 0
  return ordinary * (catchUpMultiplier(currentXp, leaderXp) - 1)
}

/**
 * Placement-facing catch-up rate, expressed as a multiplier over ordinary XP.
 * `1` means the hero is at or above the protected one-level gap. Fractional
 * level progress makes the taper smooth instead of dropping a whole multiplier
 * on the frame a level changes.
 */
export function catchUpMultiplier(currentXp: number, leaderXp: number): number {
  const current = levelAt(currentXp)
  const leader = levelAt(leaderXp)
  const currentPosition = current.level + current.fraction
  const leaderPosition = leader.level + leader.fraction
  const trailingLevels = leaderPosition - currentPosition - HERO_CATCH_UP_LEVEL_BUFFER
  if (!(trailingLevels > 0)) return 1
  return Math.min(HERO_CATCH_UP_MAX_MULTIPLIER, 1 + trailingLevels)
}

/** §13.13's curve, `X₀ κⁿ`, on §14.5's shape. A first pass. */
export const XP_BASE = 10
export const XP_KAPPA = 1.6

/**
 * A ceiling on the level, so the card has a width.
 *
 * **This is not §13.13's forbidden level gate.** A gate is a level that makes a
 * hero *allowed* to do something; this is the point past which the number stops
 * being a number and starts being scientific notation. At §4.2's cap a hero
 * covering everything reaches about level 100, so nothing reachable touches it.
 */
export const MAX_LEVEL = 999

/**
 * XP to go from `level` to `level + 1`.
 *
 * Level 1 is where every hero arrives, so the first step costs {@link XP_BASE}
 * flat and the exponent is measured from there.
 */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level))
  return XP_BASE * XP_KAPPA ** (l - 1)
}

/**
 * Cumulative XP required to *be* `level` — the geometric sum of every step
 * below it. `xpToReach(1)` is zero: arriving is free.
 */
export function xpToReach(level: number): number {
  const l = Math.max(1, Math.floor(level))
  return (XP_BASE * (XP_KAPPA ** (l - 1) - 1)) / (XP_KAPPA - 1)
}

/** Where a hero is, read off one number. */
export interface LevelProgress {
  /** §13.13's level. Always at least 1 — a hero arrives at 1. */
  level: number
  /** XP banked toward the next level. */
  into: number
  /** XP the next level costs. */
  span: number
  /** `into / span`, 0..1, for the card's bar. 1 at {@link MAX_LEVEL}. */
  fraction: number
}

/**
 * The level a total XP figure buys, closed-form.
 *
 * Inverting `xpToReach` rather than looping: at cosmic scale the loop would run
 * a hundred times per hero per frame to answer a question algebra answers once.
 * The `while` pair afterwards is not a search — it is a **one-step correction**
 * for the float error in `log`, and it is bounded by construction.
 */
export function levelAt(totalXp: number): LevelProgress {
  // A hero whose XP has overflowed the double is at the ceiling, not at zero.
  // The guard below reads a non-finite number as "no XP", which is right for
  // NaN and wrong for +Infinity in the one direction that matters.
  if (totalXp === Number.POSITIVE_INFINITY) {
    return { level: MAX_LEVEL, into: 0, span: 0, fraction: 1 }
  }
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? totalXp : 0

  let level = 1 + Math.floor(Math.log1p((xp * (XP_KAPPA - 1)) / XP_BASE) / Math.log(XP_KAPPA))
  if (!Number.isFinite(level) || level < 1) level = 1
  level = Math.min(MAX_LEVEL, level)

  // A *relative* tolerance, because the two ways of asking "what does level n
  // cost" disagree in the last bits: {@link xpToReach} is a closed-form
  // geometric sum and a player's XP is an accumulated series of additions.
  // Level 3 costs 26 by addition and 26.000000000000004 in closed form, and a
  // hero standing exactly on a boundary must not be told they are below it.
  const reached = (level: number): boolean => xpToReach(level) <= xp * (1 + 1e-9) + 1e-9
  while (level > 1 && !reached(level)) level -= 1
  while (level < MAX_LEVEL && reached(level + 1)) level += 1

  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, into: 0, span: 0, fraction: 1 }

  const span = xpForLevel(level)
  const into = Math.max(0, xp - xpToReach(level))
  return { level, into, span, fraction: span > 0 ? Math.min(1, into / span) : 1 }
}

/**
 * §13.13 — **every level grants exactly one point.**
 *
 * Including the first, so a hero who has just walked through §21.7.3's door
 * arrives with one decision attached to them rather than with a locked card.
 * The alternative — points from the second level — makes the first thing the
 * player does with a new colleague be *nothing*, which is a poor handshake.
 */
export function pointsGranted(level: number): number {
  return Math.max(0, Math.min(MAX_LEVEL, Math.floor(level)))
}

/**
 * Points left to spend.
 *
 * `spent` counts only nodes the player *bought*: §13.9.1's pre-bought starting
 * position is who the hero is, not something they paid for, and charging them
 * for it would mean Mo arrives three points in debt.
 */
export function pointsAvailable(level: number, spent: number): number {
  return Math.max(0, pointsGranted(level) - Math.max(0, Math.floor(spent)))
}

/**
 * §13.10 — "XP must not make an unplaced hero worthless."
 *
 * The gap between a tended hero and a benched one is a percentage that grows,
 * never a threshold that locks. This is that sentence restated as a predicate
 * the store asks before crediting: an unplaced hero earns zero *new* XP and is
 * never *drained*, so the difference is always one of rate, not of debt.
 */
export function unplacedEarnsNothing(placed: boolean, velocityCovered: number): boolean {
  return !placed || !(velocityCovered > 0)
}
