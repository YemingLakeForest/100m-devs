/**
 * How the sound of work changes unit as the world grows — move 4 of the juice layer
 * (docs/PLAN-2026-10-11-juice-layer.md, GDD §20.5a). Pure: what the ears are given for a rate of
 * work, not how it is played (`audio/throughputBed.ts`).
 *
 * The 1 Million Books study's finding is a change of unit, as it is in the picture: sparse
 * individual clicks while the work is countable, then one continuous bed once it is not, and the
 * clicks thinning out under it (about five a second down to about one) rather than multiplying.
 * Ten thousand clicks a second is not a sound, it is noise, and it is also the sound that kills a
 * phone's audio pool (§23.3 names pool exhaustion as a kill criterion) — so the voice budget is a
 * claim and is tested as one, at any rate.
 */

/** Clicks a second while the work is countable, and the floor they thin to under the bed. */
export const TICK_MAX_PER_SECOND = 5
export const TICK_MIN_PER_SECOND = 1
/** Voices a click may occupy at once, and how long one sounds (the `ui-tick` clip is short). */
export const MAX_TICK_VOICES = 4
export const TICK_VOICE_MS = 90

/** Decades of story points a second the bed takes to rise from silence to full: 1 to a million. */
const BED_FLOOR = 1
const BED_DECADES = 6

/** How much louder the bed is with the camera pulled all the way out than all the way in. */
export const BED_PULL_OUT_DB = 9

/**
 * The bed's level, 0 to 1, from the story points a second being made. Logarithmic, because the
 * ear and the study both read scale in decades: a thousand developers is not a thousand times
 * a lone one, it is three steps up. Nothing below one a second, where clicks do the talking.
 */
export function bedLevel(ratePerSecond: number): number {
  if (!(ratePerSecond > BED_FLOOR)) return 0
  return Math.min(1, Math.log10(ratePerSecond / BED_FLOOR) / BED_DECADES)
}

/**
 * Clicks a second the budget allows at this rate: {@link TICK_MAX_PER_SECOND} while the bed is
 * silent, falling linearly in {@link bedLevel} to {@link TICK_MIN_PER_SECOND}, and 0 only when
 * there is no work at all — a bed on its own would say the studio had stopped.
 */
export function tickRate(ratePerSecond: number): number {
  if (!(ratePerSecond > 0)) return 0
  return TICK_MAX_PER_SECOND - (TICK_MAX_PER_SECOND - TICK_MIN_PER_SECOND) * bedLevel(ratePerSecond)
}

/**
 * The bed's gain factor for how far the lens has pulled back: 1 with the camera at a desk, the
 * {@link BED_PULL_OUT_DB} step down from it when close in. From a distance the work is the
 * whole picture and the bed is the sound of the picture; up close it is the clicks' backdrop.
 * `zoom` is the lens (0.3 the whole city, 3 a face).
 */
export function pullOut(zoom: number): number {
  const close = Math.max(0, Math.min(1, (zoom - 0.6) / 1.4))
  return 10 ** (-(BED_PULL_OUT_DB * close) / 20)
}

/**
 * The cap on voices, applied where the clicks are asked for. Admits a click only if there is a
 * free voice and the gap since the last one is the rate's own period, so a burst of arrivals is
 * thinned to a steady tick and never to a chord (a clip bank was tried and read as a melody).
 */
export class VoiceBudget {
  private ends: number[] = []
  private last = -Infinity

  admit(nowMs: number, perSecond: number): boolean {
    this.ends = this.ends.filter((e) => e > nowMs)
    if (!(perSecond > 0) || this.ends.length >= MAX_TICK_VOICES) return false
    if (nowMs - this.last < 1000 / perSecond) return false
    this.last = nowMs
    this.ends.push(nowMs + TICK_VOICE_MS)
    return true
  }
}
