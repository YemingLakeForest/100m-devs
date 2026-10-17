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
 *
 * **[amended 2026-10-16] A studio hour is a minute of play, and the doors open
 * at eleven.** The clock was one studio second per simulated second, so the
 * first gym was ten hours into a session, and the fun-killers audit (finding
 * 12) put it plainly: nobody will ever see it. At {@link STUDIO_HOUR_SECONDS} =
 * 60 a studio day is 24 minutes, and opening at 11:00 — the minute the gym
 * ends, so a run never starts with him missing — puts the first gym about 23
 * minutes into a run and one every 24 minutes after. Often enough to be seen in
 * a session and rare enough to stay an event; the HUD carries the clock so the
 * player can see it coming.
 */

/** §21.7.0 rule 5 — the gym's window, in studio-clock hours. */
export const GYM_START_HOUR = 10
export const GYM_END_HOUR = 11

/** Simulated seconds in one studio hour [amended 2026-10-16]: a studio day is 24 minutes. */
export const STUDIO_HOUR_SECONDS = 60

/** The studio clock at run second zero: the hour the gym ends, so a run opens with James at his desk. */
export const STUDIO_OPENS_HOUR = GYM_END_HOUR

/** Studio-clock hour, 0..24, from simulated run seconds. */
export function studioHourOf(runSeconds: number): number {
  if (!Number.isFinite(runSeconds) || runSeconds < 0) return STUDIO_OPENS_HOUR
  return (STUDIO_OPENS_HOUR + runSeconds / STUDIO_HOUR_SECONDS) % 24
}

/** The studio clock as the HUD reads it, `HH:MM`. */
export function studioClockLabel(runSeconds: number): string {
  const hour = studioHourOf(runSeconds)
  const h = Math.floor(hour)
  const m = Math.min(59, Math.floor((hour - h) * 60))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Is James at the gym right now? The one boolean rule 5 promised. */
export function atGym(studioHour: number): boolean {
  return studioHour >= GYM_START_HOUR && studioHour < GYM_END_HOUR
}

/** Is James at his desk right now, given the run's clock? */
export function jamesPresent(runSeconds: number): boolean {
  return !atGym(studioHourOf(runSeconds))
}

/** The first run second at which the studio clock reads `hour` (0..24). */
export function runSecondsAtHour(hour: number): number {
  const ahead = (((hour - STUDIO_OPENS_HOUR) % 24) + 24) % 24
  return ahead * STUDIO_HOUR_SECONDS
}
