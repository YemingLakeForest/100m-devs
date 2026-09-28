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
 * The Z band is authored against the room's own rung, the squad's Z, because
 * the room is what the title is a picture of. It used to be bounded by the
 * game's zoom ceiling, `maxZoomFor(1)` — the same number — and the stage ticker
 * re-clamped to it every frame, so a drift that reached past it was silently
 * flattened into a still frame at exactly the moment §10.9.4 forbids one. The
 * ceiling went on 2026-09-27 (GDD §7.4a, amended) and the band did not move:
 * the numbers below are still derived rather than written down, so the next
 * time the ladder moves this file moves with it instead of quietly going still.
 */

import { useEffect, useRef } from 'react'
import type { StageHandle } from '../render/stage.ts'
import { FLOOR, SQUAD } from '../render/frames.ts'
import { zAtRung } from '../sim/ladder.ts'

/** The room's rung — the squad — as §7.2's Z. */
const ROOM_Z = zAtRung(SQUAD)
/** Centre of the drift, and its swing. Both a fraction of the room's Z, so the
 *  whole band stays comfortably inside it however the ladder is retuned. */
const DRIFT_Z = ROOM_Z * 0.68
const DRIFT_AMPLITUDE = ROOM_Z * 0.26
/** Radians/sec. ~28 s per cycle — movement you notice only if you look for it. */
const DRIFT_RATE = 0.22

/** Where the push-in lands: the desk, as close as the lens goes. */
const PUSH_IN_Z = ROOM_Z * 0.18

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
    return () => {
      cancelAnimationFrame(frame)
      /*
       * **Hand the camera back on a stop.**
       *
       * `camera.set` is the lens's continuous door — it parks at exactly the Z
       * it is given and switches the magnetic stop off while it is there,
       * which is right for a driver that runs every frame and wrong for one
       * that stops. This one stops: the title goes away mid-push-in and the
       * game inherited a camera resting between two levels with nothing left
       * to move it. Measured on a cold boot: level 0.35, not settling, and
       * §7.8.10's corner desk 148 px above the top of the frame — Act I's
       * whole script is TAP TO CODE and there was nobody on the screen to tap.
       *
       * It hands back to **the frame the lens opens itself on** — the floor —
       * rather than to the Desk level the push-in ended at, and the difference
       * matters most for exactly the studio the push-in is about. The Desk
       * level frames seat 0, the *first developer's* chair; §7.8.10's founder
       * sits outside the seat lattice twelve units away. Handing back to Desk
       * opened a two-person studio on somebody else's desk with the player's
       * own avatar 395 px above the top of the screen, and §4.5d's front door
       * is that avatar. The floor frames the room the studio is in, so the one
       * call lands a garage on the whole garage and a tower on a floor of it.
       */
      camera.reframe(FLOOR)
    }
  }, [stage])
}
