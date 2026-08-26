/**
 * The simulation clock, on a dial — the live half of `?speed`.
 *
 * `?speed=40` already existed and is kept exactly: it is what the §26.1.8
 * playthrough harness drives, and a walk that has to be re-launched to change
 * pace is a walk nobody re-paces. What it could not do is answer the question
 * a person actually has while *looking* at the studio — "what does this look
 * like in a minute?" — because the only way to ask it was a reload, and a
 * reload throws away the run you wanted to fast-forward.
 *
 * So the flag becomes the **initial value of a dial** rather than a constant.
 * The query string still seeds it, {@link ScenarioBar} moves it, and
 * `render/stage.ts` reads it on every frame instead of once.
 *
 * ## Repeated whole ticks, never a bigger `dt`
 *
 * The multiplier is a **step count**, and that is load-bearing rather than an
 * implementation detail. Multiplying `dt` would be a different simulation:
 * payroll, §4.1's entropy, §4.10e's tail and §4.12's arrival rates are all
 * integrated per frame, and a fortyfold step changes what every one of them
 * computes. N calls at the frame's own `dt` is arithmetically the same thing as
 * N frames, so a run walked at ×40 passes through every state a run walked at
 * ×1 does, in the same order, and every trigger still fires off real state.
 *
 * ## Why it is clamped, and why the ceiling is sixty
 *
 * At some multiple the frame's own work stops fitting in a frame and what is
 * being watched is the harness rather than the game. Sixty is one simulated
 * minute per wall second at a full frame rate, which is where §21's Run 2 stops
 * being the thing that takes the time.
 *
 * ## The gate
 *
 * {@link DEBUG_TOOLS_ENABLED} is the sole authority, exactly as it is for every
 * other seam in `dev/`. Deployed HTML and a Capacitor-native build cannot reach
 * the setter at all — it returns ×1 and writes nothing — so this cannot become
 * a shipped cheat by being wired to a control that shipped by accident.
 */

import { DEBUG_TOOLS_ENABLED, debugSearchParams } from './debugAccess.ts'

/** Real time. The only speed a player is ever running at. */
export const SIM_SPEED_MIN = 1

/** One simulated minute per wall second at 60 fps. See the file header. */
export const SIM_SPEED_MAX = 60

/**
 * The stops on the dial — roughly logarithmic, because the interesting
 * comparisons are ratios rather than differences.
 *
 * A linear 1..60 slider spends four fifths of its travel between "much too
 * fast" and "slightly more much too fast", and the two speeds anybody actually
 * wants — a gentle ×2 to watch a burn-down, and a ×20 to get to the next act —
 * are two pixels apart at the bottom of it. These are the pace changes that
 * read as different, and the box beside the dial takes anything else.
 */
export const SIM_SPEED_STOPS: readonly number[] = [1, 2, 3, 5, 8, 12, 20, 30, 45, 60]

/**
 * A whole number of ticks per frame, inside the clamp.
 *
 * Floors rather than rounds: ×2.9 is two frames' worth of simulation, and
 * rounding up would mean a dial that says 2.9 and runs 3.
 */
export function clampSimSpeed(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return SIM_SPEED_MIN
  return Math.max(SIM_SPEED_MIN, Math.min(SIM_SPEED_MAX, Math.floor(n)))
}

/** The nearest stop at or below `speed` — where the slider parks for a typed value. */
export function stopIndexFor(speed: number): number {
  const n = clampSimSpeed(speed)
  let best = 0
  for (let i = 0; i < SIM_SPEED_STOPS.length; i += 1) {
    if (SIM_SPEED_STOPS[i] <= n) best = i
  }
  return best
}

/**
 * What `?speed` asked for, or ×1.
 *
 * `debugSearchParams` is already empty outside an authorised local browser
 * session, so this needs no second deployment check — which is the whole reason
 * that function exists.
 */
export function initialSimSpeed(): number {
  const raw = debugSearchParams().get('speed')
  return raw === null ? SIM_SPEED_MIN : clampSimSpeed(raw)
}

let speed = initialSimSpeed()

const listeners = new Set<() => void>()

/** Ticks of simulation per rendered frame. Read by `stage.ts` every frame. */
export function getSimSpeed(): number {
  return DEBUG_TOOLS_ENABLED ? speed : SIM_SPEED_MIN
}

/**
 * Move the dial. Returns what it landed on, which is not always what was asked.
 *
 * Returns rather than resolves silently because the caller is a control with a
 * readout on it, and a dial that quietly disagrees with its own number is the
 * failure mode this whole tool exists to avoid handing somebody.
 */
export function setSimSpeed(next: number): number {
  if (!DEBUG_TOOLS_ENABLED) return SIM_SPEED_MIN
  const clamped = clampSimSpeed(next)
  if (clamped === speed) return speed
  speed = clamped
  for (const fn of [...listeners]) fn()
  return speed
}

/** Step to the next stop up or down — the keyboard's half of the dial. */
export function nudgeSimSpeed(direction: 1 | -1): number {
  const i = stopIndexFor(getSimSpeed())
  // From a typed value between two stops, "up" means the stop above it rather
  // than the stop above the one below it — otherwise ×7 nudged up gives ×8 and
  // nudged down gives ×8 as well, which is a control that lies about direction.
  const at = SIM_SPEED_STOPS[i] === getSimSpeed()
  const target = direction === 1 ? i + 1 : at ? i - 1 : i
  return setSimSpeed(SIM_SPEED_STOPS[Math.max(0, Math.min(SIM_SPEED_STOPS.length - 1, target))])
}

/** Subscribe to dial movement. Same contract as the store's `subscribe`. */
export function subscribeSimSpeed(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Test seam — put the dial back where a fresh session starts. */
export function resetSimSpeed(): void {
  speed = initialSimSpeed()
  for (const fn of [...listeners]) fn()
}
