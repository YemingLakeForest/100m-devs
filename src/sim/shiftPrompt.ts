/**
 * When the game says *shift now* — GDD §13.2, §13.12.4 [added 2026-10-16].
 *
 * Plan 2026-10-16 phase 3.3. Two group plans each proposed a shift prompt: the
 * cadence group a predicate on whether the shift's Bandwidth Points buy the next
 * ×10 of capacity, the money group a lit door after a sustained stall. The
 * ruling (plan §1) is **one pure predicate, built once**, true for either:
 *
 * - **The shift pays.** The BP this run would bank buys the next level of
 *   Telepathic Compression (`prestige.ts` `CAP_STEP`: one level is one order of
 *   magnitude of seats). Ending a run on the purchase that makes the next one a
 *   different game is the loop §13.12 is built around, and until now the player
 *   found out by opening a screen and doing a subtraction.
 * - **The run has stopped.** Sixty seconds past §4.1's peak — where §11.2 B2's
 *   floor holds output flat, so every second is payroll for nothing — or three
 *   minutes at the cap with nothing the studio can afford to buy. Either way the
 *   run has nowhere left to go, and the shift is the move that has.
 *
 * Two thresholds and **one clock**: `stalledForSeconds` counts while the studio
 * is in either state, and the threshold is chosen by where it is now. A studio
 * that sat cap-bound for two minutes and then hired past the peak has been
 * stuck for two minutes, and being stuck *past* the peak is the worse of the
 * two, so it gets the shorter fuse. Two clocks would let it start again from
 * zero for the act of making things worse.
 *
 * It prompts and nothing else. A prompt that took the run away would be a
 * fail state wearing an advisor's voice (§25.3.2), so the HUD pulses a door and
 * the player still opens it.
 *
 * Pure — no store, no clock, no renderer.
 */

import { peakHeads } from './entropy.ts'

/** Seconds past §4.1's peak before the stall alone is reason to shift. */
export const PAST_PEAK_STALL_S = 60

/** Seconds at the cap, with nothing affordable, before the stall alone is reason. */
export const CAP_BOUND_STALL_S = 180

/**
 * Should the HUD say *shift now*?
 *
 * `offer` is the BP shifting would bank; `nextCapPrice` is what the next ×10
 * capacity level still costs after the BP already in hand (≤ 0 when it is
 * already affordable, Infinity when there is no level left). `devs` and `cap`
 * say which stall threshold applies; `stalledForSeconds` is the store's clock.
 */
export function shiftPays(
  offer: number,
  nextCapPrice: number,
  devs: number,
  cap: number,
  stalledForSeconds: number,
): boolean {
  if (offer > 0 && Number.isFinite(nextCapPrice) && offer >= nextCapPrice) return true
  if (!(stalledForSeconds > 0)) return false
  const past = devs > peakHeads(cap)
  return stalledForSeconds >= (past ? PAST_PEAK_STALL_S : CAP_BOUND_STALL_S)
}

/**
 * Is the studio in a state the stall clock counts? Past the peak, or one hire
 * short of it with nothing in the trees it can afford. The store advances the
 * clock while this holds and resets it the moment it does not.
 */
export function studioStalled(devs: number, cap: number, anythingAffordable: boolean): boolean {
  const peak = peakHeads(cap)
  if (devs > peak) return true
  return devs + 1 > peak && !anythingAffordable
}
