/**
 * Moving around the world — GDD §7.7.6.
 *
 * "The Omni-Lens is not a fixed camera that only zooms. The player can drag the
 * world around at every rung, and everything on screen is individually
 * addressable."
 *
 * Two jobs, and the second is the one that is easy to get wrong:
 *
 *  1. **Pan** with momentum and friction, clamped so the world cannot be
 *     dragged off the screen and abandoned.
 *  2. **Tell a tap from a drag.** §7.7.6: "Getting this wrong in either
 *     direction is fatal: a poke that pans loses the clicker layer, and a pan
 *     that pokes means every attempt to look around costs the player Entropy."
 *     A tap is a pointer that travelled under {@link TAP_SLOP} px in under
 *     {@link TAP_MS} ms. Anything else is a drag and yields no poke.
 *
 * The momentum maths is imported from the §10.8 juice kit rather than written
 * again here — it is the same spring and friction model the UI scrolls on, and
 * `useMomentum` was built frame-rate independent precisely so the camera could
 * run it on the Pixi ticker instead of rAF.
 */

import { FRICTION, clamp, decayVelocity } from '../ui/spring.ts'

/** §7.7.6 — a tap is a pointer that barely moved. */
export const TAP_SLOP = 10
export const TAP_MS = 250

/**
 * §7.8.8 — how long a finger must rest before a tap becomes a *selection*.
 *
 * Selection needs a gesture of its own, because §8.2's poke is the game's
 * primary verb and fires hundreds of times a session: giving both the same
 * gesture would mean either poking opens a panel — unusable — or selection
 * needs a mode.
 *
 * 380 ms sits above the fastest deliberate double-tap and well below the point
 * where a held finger feels ignored. It is longer than {@link TAP_MS}, which is
 * what makes the two mutually exclusive by construction rather than by a flag.
 */
export const HOLD_MS = 380

/** Did this pointer rest in one place long enough to be a hold? */
export function isHold(dx: number, dy: number, elapsedMs: number): boolean {
  return Math.hypot(dx, dy) <= TAP_SLOP && elapsedMs >= HOLD_MS
}

/** Below this, a flick is a hand tremor rather than an instruction. */
const MIN_FLING = 40

export interface PanState {
  x: number
  y: number
  vx: number
  vy: number
}

export function initPan(): PanState {
  return { x: 0, y: 0, vx: 0, vy: 0 }
}

/**
 * How far the world may be panned on each axis, in screen pixels.
 *
 * Half the overhang: the world can be pushed until its edge reaches the middle
 * of the screen and no further. A tier smaller than the viewport gets zero,
 * which is why the room does not slide around when it already fits — panning a
 * thing that fits is how a player gets lost in an empty frame.
 */
export function panLimit(worldPx: number, viewportPx: number): number {
  return Math.max(0, (worldPx - viewportPx) / 2)
}

/** Clamp a pan offset to its limits. */
export function clampPan(pan: PanState, limitX: number, limitY: number): PanState {
  return {
    ...pan,
    x: clamp(pan.x, -limitX, limitX),
    y: clamp(pan.y, -limitY, limitY),
  }
}

/**
 * Advance a free-flying pan by one frame.
 *
 * Velocity decays by the shared §10.8 friction, and hitting a limit kills the
 * velocity on that axis rather than letting it grind against the edge — a
 * flick into a wall should stop, not buzz.
 */
export function stepPan(pan: PanState, dt: number, limitX: number, limitY: number): PanState {
  if (pan.vx === 0 && pan.vy === 0) return clampPan(pan, limitX, limitY)

  const vx = decayVelocity(pan.vx, dt, FRICTION)
  const vy = decayVelocity(pan.vy, dt, FRICTION)
  const nx = pan.x + vx * dt
  const ny = pan.y + vy * dt

  const cx = clamp(nx, -limitX, limitX)
  const cy = clamp(ny, -limitY, limitY)

  return {
    x: cx,
    y: cy,
    // Stopped by a wall, or slowed below the point of caring.
    vx: cx !== nx || Math.abs(vx) < 8 ? 0 : vx,
    vy: cy !== ny || Math.abs(vy) < 8 ? 0 : vy,
  }
}

/** Is this pointer journey a tap, or was the player looking around? */
export function isTap(dx: number, dy: number, elapsedMs: number): boolean {
  return Math.hypot(dx, dy) <= TAP_SLOP && elapsedMs <= TAP_MS
}

/** A flick below this is not a flick. Exported so the release path can agree. */
export function flingVelocity(vx: number, vy: number): { vx: number; vy: number } {
  return Math.hypot(vx, vy) < MIN_FLING ? { vx: 0, vy: 0 } : { vx, vy }
}

/**
 * Which of `points` is under `(x, y)`, or -1.
 *
 * A `ParticleContainer` carries no hit areas — particles are not display
 * objects and Pixi will not test them — so §7.7.6's requirement that "every one
 * of the 1,000 floor sprites is individually hit-testable" has to be answered
 * here. This is a linear scan, which is the right call at these counts: 1,000
 * distance comparisons is microseconds and happens once per tap, and a spatial
 * index would be more code to be wrong in.
 *
 * Nearest-within-radius rather than first-within-radius, so overlapping desks
 * resolve to the one the thumb is actually closest to.
 */
export function pickNearest(
  points: ReadonlyArray<{ x: number; y: number }>,
  x: number,
  y: number,
  radius: number,
): number {
  let best = -1
  let bestDistance = radius * radius
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - x
    const dy = points[i].y - y
    const d = dx * dx + dy * dy
    if (d <= bestDistance) {
      bestDistance = d
      best = i
    }
  }
  return best
}
