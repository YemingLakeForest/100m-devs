/**
 * Spring, friction and rubber-band maths — the §10.8 F2 row set.
 *
 * F2 names four behaviours that a CSS transition cannot express, because all
 * four are velocity-carrying: a release that overshoots, a list that rubber-bands
 * at its ends, a pull-down whose resistance *increases* with distance, and a
 * drag that keeps travelling after the finger leaves. Those need an integrator,
 * so this is it.
 *
 * Everything here is pure and frame-rate independent — the §7.7.6 camera pan
 * reuses it, and the camera runs on the Pixi ticker rather than on rAF, so
 * nothing may assume a 16 ms step.
 */

export interface SpringConfig {
  /** Pull toward the target, per unit of displacement. */
  stiffness: number
  /** Velocity drag. Below the critical value the spring overshoots — the point. */
  damping: number
  mass: number
}

export interface SpringState {
  value: number
  velocity: number
}

/**
 * The house spring. Damping ratio ≈ 0.61 (`c / (2·sqrt(k·m))`), which
 * overshoots by roughly 12% and settles inside ~350 ms.
 *
 * F2 asks a button release to spring "not a linear return"; this is the shape
 * of that. Tuned under-damped on purpose — critical damping (ratio 1) is
 * mathematically tidy and reads as a slow fade back to rest.
 */
export const SPRING_UI: SpringConfig = { stiffness: 170, damping: 16, mass: 1 }

/**
 * Heavier, for anything with visible mass: a panel arriving, the camera
 * snapping back inside its bounds. Ratio ≈ 0.83 — one small overshoot, no
 * wobble.
 */
export const SPRING_HEAVY: SpringConfig = { stiffness: 120, damping: 18, mass: 1 }

/**
 * Sub-step size, ms. Semi-implicit Euler goes unstable when `k·dt²/m`
 * approaches 1, and a backgrounded tab hands back dt values in the hundreds.
 * Slicing is cheaper than switching integrators and keeps the maths readable.
 */
const SUB_STEP_MS = 4

/** Advance one spring by `dt` milliseconds. */
export function springStep(
  state: SpringState,
  target: number,
  dt: number,
  config: SpringConfig = SPRING_UI,
): SpringState {
  if (dt <= 0) return state

  let { value, velocity } = state
  let remaining = dt

  while (remaining > 0) {
    const step = Math.min(SUB_STEP_MS, remaining) / 1000
    remaining -= SUB_STEP_MS

    const force = -config.stiffness * (value - target) - config.damping * velocity
    velocity += (force / config.mass) * step
    value += velocity * step
  }

  return { value, velocity }
}

/**
 * Has the spring arrived? Both tests are needed: a spring passing through its
 * target at speed is momentarily at zero displacement and is not finished.
 */
export function isSettled(state: SpringState, target: number, epsilon = 0.002): boolean {
  return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < epsilon
}

/**
 * Overscroll resistance — F2's "real elastic resistance that increases with
 * distance", and the same curve behind rubber-band overscroll at a list's ends.
 *
 * `f(x) = (1 − 1/(x·c/extent + 1))·extent`, the curve UIScrollView uses. Three
 * properties matter and all three are asserted in the tests:
 *
 *   - `f(0) = 0`, so there is no discontinuity where the bound is crossed;
 *   - `f` is strictly increasing, so the surface never stops following the finger;
 *   - `f' ` decreases and `f < extent`, so pulling harder buys less and less.
 *
 * A linear drag past the bound has none of these and is the thing F2 fails.
 */
export function rubberBand(offset: number, extent: number, constant = 0.55): number {
  if (extent <= 0) return 0
  const sign = Math.sign(offset)
  const x = Math.abs(offset)
  return sign * (1 - 1 / ((x * constant) / extent + 1)) * extent
}

/**
 * Per-millisecond exponential decay rate for a released drag.
 *
 * 0.0025 leaves ~8% of the launch velocity after 300 ms, which is a flick that
 * coasts about a third of a second — long enough to feel like momentum, short
 * enough that it is never in the player's way. F6 applies to inertia too.
 */
export const FRICTION = 0.0025

/** Velocity (units/ms) after coasting for `dt` ms. */
export function decayVelocity(v: number, dt: number, friction = FRICTION): number {
  return v * Math.exp(-friction * dt)
}

/**
 * Total distance a flick of `v0` units/ms will cover before stopping — the
 * integral of the decay. Used to decide, at the moment of release, whether a
 * glide is going to run past a bound, rather than discovering it mid-flight.
 */
export function momentumTravel(v0: number, friction = FRICTION): number {
  return v0 / friction
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
