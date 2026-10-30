/**
 * The resolution governor — the room gives up pixels before it gives up frames.
 *
 * [2026-10-30, at the user's instruction: *"I need the mobile game to be smooth, and the
 * browser should be a good simulation of it"*.] The lite room (`GarageViewOptions.lite`) is
 * chosen once, from the device, and a phone that is slower than the device it was guessed from
 * had nothing to fall back on. This is the fall-back: it watches the frame interval and walks
 * the pixel ratio down a short ladder, and the glass over the room (CRT lines, curvature) is
 * what hides a room drawn at three quarters of its pixels.
 *
 * Down only. A governor that also climbs back oscillates on exactly the machines that need
 * it: the cheaper frame it just bought is what tells it there is room to spend again. The
 * ladder is short so that the worst case is a softer picture, never a blank one.
 *
 * Pure: it is fed frame intervals and answers with a ratio. No clock, no renderer (`perf/`
 * has the same rule as `sim/`), so the stage owns the side effects and a test owns the claim.
 */

/** Pixel ratios, best first. 1 is the lite room's own; the rungs below it are the governor's. */
export const RATIO_LADDER: readonly number[] = [1, 0.8, 0.65]

/** Mean frame interval, in ms, above which a window of frames counts as slow: below ~45 fps. */
export const SLOW_MS = 22

/** Frames in a window. Long enough that one hitch (a hire's shaders compiling) cannot trip it. */
export const WINDOW = 90

/** Frames ignored at the start and after every step: the first draws compile shaders, a resize reallocates. */
export const SETTLE = 60

/** An interval this long is a backgrounded tab or a load stall, not a slow room; it says nothing about speed. */
export const STALL_MS = 250

export class QualityGovernor {
  private rung: number
  private sum = 0
  private n = 0
  private settle = SETTLE

  /** `ceiling` is the best ratio this device may start on; the ladder is entered at the nearest rung at or below it. */
  constructor(ceiling = 1) {
    const at = RATIO_LADDER.findIndex((r) => r <= ceiling)
    this.rung = at < 0 ? RATIO_LADDER.length - 1 : at
  }

  get ratio(): number {
    return RATIO_LADDER[this.rung]
  }

  /** Feed one frame interval. Returns the new ratio when the governor steps down, otherwise null. */
  sample(ms: number): number | null {
    if (ms >= STALL_MS) { this.settle = SETTLE; this.sum = 0; this.n = 0; return null }
    if (this.settle > 0) { this.settle -= 1; return null }
    if (this.rung >= RATIO_LADDER.length - 1) return null
    this.sum += ms
    this.n += 1
    if (this.n < WINDOW) return null
    const slow = this.sum / this.n > SLOW_MS
    this.sum = 0
    this.n = 0
    if (!slow) return null
    this.rung += 1
    this.settle = SETTLE
    return this.ratio
  }
}
