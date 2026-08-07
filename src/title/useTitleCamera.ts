/**
 * The title screen's camera — GDD §10.9.1 and §10.9.4.
 *
 * "The camera drifts slowly and never stops... a still title screen reads as a
 * broken build", and on start it "pushes in to the desk". Both are driven
 * through the real `LensCamera` rather than through a CSS transform, because
 * §10.9.1's entire premise is that the title and the game share one camera:
 * fake the drift and the push-in becomes a hand-off between two cameras, which
 * is a cut wearing a dolly's clothes.
 *
 * The Z band is bounded by the game's own ceiling. `maxZoomFor(1)` is 0.2 for
 * a one-developer studio and the stage ticker re-clamps to it every frame, so
 * a drift that reached past it would be silently flattened into a still frame
 * at exactly the moment §10.9.4 forbids one.
 */

import { useEffect, useRef } from 'react'
import type { StageHandle } from '../render/stage.ts'

/** Centre of the drift. Comfortably inside the rung-0 ceiling of 0.2. */
const DRIFT_Z = 0.15
const DRIFT_AMPLITUDE = 0.035
/** Radians/sec. ~28 s per cycle — movement you notice only if you look for it. */
const DRIFT_RATE = 0.22

/** Where the push-in lands: the desk, as close as the lens goes. */
const PUSH_IN_Z = 0.02

/**
 * Approach rates, per second. The drift is slack enough that arriving at the
 * band from wherever the camera starts is itself part of the entrance; the
 * push-in is stiff enough to be a move.
 */
const DRIFT_RATE_APPROACH = 0.8
const PUSH_RATE_APPROACH = 3.2

/**
 * Drive the camera for as long as the title is on screen.
 *
 * `pushIn` is read through a ref rather than taken as a dependency: restarting
 * the loop on the press would reset `last`, and the first frame after a
 * restart has a dt of whatever the scheduler felt like, which lands as a jump
 * on the one frame the player is watching most closely.
 */
export function useTitleCamera(stage: StageHandle | null, pushIn: boolean): void {
  const pushingIn = useRef(pushIn)
  useEffect(() => {
    pushingIn.current = pushIn
  }, [pushIn])

  useEffect(() => {
    const camera = stage?.camera
    if (!camera) return

    let frame = 0
    let last = performance.now()

    const step = (now: number) => {
      // Clamped to four frames. Chrome suspends rAF entirely while
      // `document.hidden`, so a backgrounded tab hands back a dt measured in
      // seconds on its first frame home; without the clamp the camera would
      // teleport to its target on resume. (`document.hasFocus()` is no help
      // here — it reads true for a hidden window. See LANDSCAPE.md.)
      const dt = Math.min(0.064, (now - last) / 1000)
      last = now

      const target = pushingIn.current
        ? PUSH_IN_Z
        : DRIFT_Z + DRIFT_AMPLITUDE * Math.sin((now / 1000) * DRIFT_RATE)
      const rate = pushingIn.current ? PUSH_RATE_APPROACH : DRIFT_RATE_APPROACH

      // Exponential approach rather than a tween: there is no start value to
      // capture, so a preference change, a resize or an interrupted press
      // cannot leave the camera stranded mid-interpolation.
      camera.set(camera.z + (target - camera.z) * Math.min(1, dt * rate))
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [stage])
}
