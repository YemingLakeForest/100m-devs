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
 * The Z band is bounded by the game's own ceiling. `maxZoomFor(1)` is rung 1 —
 * the room — and the stage ticker re-clamps to it every frame, so a drift that
 * reached past it would be silently flattened into a still frame at exactly the
 * moment §10.9.4 forbids one. That is not hypothetical: the band used to be
 * centred on 0.15 against a ceiling of 0.2, and §7.4a's ladder moved the
 * ceiling to 1/9 ≈ 0.111 underneath it. The numbers below are derived from
 * `maxZoomFor(1)` rather than written down, so the next time the ladder moves
 * this file moves with it instead of quietly going still.
 */

import { useEffect, useRef } from 'react'
import type { StageHandle } from '../render/stage.ts'
import { maxZoomFor } from '../sim/headcount.ts'

/** The furthest out the lens may go over a one-developer studio — §7.7.1. */
const CEILING = maxZoomFor(1)
/** Centre of the drift, and its swing. Both a fraction of the ceiling, so the
 *  whole band stays comfortably inside it however the ladder is retuned. */
const DRIFT_Z = CEILING * 0.68
const DRIFT_AMPLITUDE = CEILING * 0.26
/** Radians/sec. ~28 s per cycle — movement you notice only if you look for it. */
const DRIFT_RATE = 0.22

/** Where the push-in lands: the desk, as close as the lens goes. */
const PUSH_IN_Z = CEILING * 0.18

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
