/**
 * James's gym — GDD §21.7.0 rule 5.
 *
 * > **The gym, ten to eleven, every day.** Every single day. Through the
 * > collapse, through the bankruptcy, through the heat death of four universes.
 * > If the player pokes his desk between 10:00 and 11:00 studio time, **he is
 * > not there**, and the desk says so.
 *
 * Rule 5 is a mechanic and it is built as one: an hour a day where the game's
 * most reliable card is simply absent. That is funnier than any line about it,
 * it is the only scheduled event in the game, and it costs one boolean.
 *
 * Studio time is a 24-hour clock folded out of {@link runSeconds} — simulated
 * seconds, not wall-clock — so the gym runs on the same clock the studio is
 * paid for and never happens while nobody is working (§11.2 B2's clock makes
 * the same distinction).
 */

/** §21.7.0 rule 5 — the gym's window, in studio-clock hours. */
export const GYM_START_HOUR = 10
export const GYM_END_HOUR = 11

/** Studio-clock hour, 0..24, from simulated run seconds. */
export function studioHourOf(runSeconds: number): number {
  if (!Number.isFinite(runSeconds) || runSeconds < 0) return 0
  return (runSeconds / 3600) % 24
}

/** Is James at the gym right now? The one boolean rule 5 promised. */
export function atGym(studioHour: number): boolean {
  return studioHour >= GYM_START_HOUR && studioHour < GYM_END_HOUR
}

/** Is James at his desk right now, given the run's clock? */
export function jamesPresent(runSeconds: number): boolean {
  return !atGym(studioHourOf(runSeconds))
}
