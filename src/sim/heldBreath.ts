/**
 * The held breath — move 6 of the juice layer (docs/PLAN-2026-10-11-juice-layer.md, GDD §10.8a).
 *
 * The reference game withholds its payoff: the counter sits just under the milestone for a long,
 * quiet stretch (999,999 of 1,000,000, about eleven seconds in the trailer), then rolls the last
 * digits as an odometer. The wait is what makes the number land. This is that, for the headcount's
 * decades, pure: what the counter shows `elapsedMs` after a hire crossed one.
 *
 * Ours is shorter than the trailer's, because the trailer is a trailer and this is a counter on
 * a screen the player is also playing: 2.4 s of hold and 0.6 s of roll. And the number is never
 * *wrong* for longer than that: the held figure is one short of a milestone the studio has
 * already passed, shown for 3 s on a figure the HUD updates continuously, and then it is the truth.
 */

/** 1K, 10K ... 100M. Below a thousand a hire is a person, not an arrival. */
export const MILESTONES = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8] as const

export const BREATH_HOLD_MS = 2400
/** Steps in the roll, and how long each holds: `steps(8, end)`, the interface's only motion. */
export const BREATH_ROLL_STEPS = 8
const STEP_MS = 80
export const BREATH_MS = BREATH_HOLD_MS + BREATH_ROLL_STEPS * STEP_MS

/** The highest decade `next` has reached that `prev` had not, or null. */
export function crossedMilestone(prev: number, next: number): number | null {
  if (!(next > prev)) return null
  let hit: number | null = null
  for (const m of MILESTONES) if (prev < m && next >= m) hit = m
  return hit
}

/**
 * What the counter shows: one short of `milestone` through the hold, then a hard-stepped roll up to
 * `to`, then null — the real count takes over. `from` is where it was before the crossing and is
 * only there to say the roll starts at the held figure, never below it.
 *
 * Reduced motion keeps the hold (stillness is not movement) and drops the roll: it snaps.
 */
export function breathShown(elapsedMs: number, from: number, to: number, milestone: number, reduced = false): number | null {
  void from
  if (!(elapsedMs >= 0)) return null
  const held = Math.min(milestone - 1, to)
  if (elapsedMs < BREATH_HOLD_MS) return held
  if (reduced || elapsedMs >= BREATH_MS) return null
  const step = Math.floor((elapsedMs - BREATH_HOLD_MS) / STEP_MS) + 1
  return Math.min(to, held + Math.round(((to - held) * step) / (BREATH_ROLL_STEPS + 1)))
}
