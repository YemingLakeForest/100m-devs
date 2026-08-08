import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './motion.ts'
import { SPRING_UI, isSettled, springStep, type SpringConfig } from './spring.ts'

/**
 * Drive one number toward a target on a spring — §10.8 F2.
 *
 * The rAF loop only runs while the spring is in flight and cancels itself on
 * arrival, so an idle screen costs nothing. That matters here more than in most
 * apps: the §23.3 budget is a 60 fps floor with a Pixi ticker already spending
 * most of the frame, and a permanently-running React animation loop would be
 * taken out of the simulation's share.
 */
export function useSpring(target: number, config: SpringConfig = SPRING_UI): number {
  const reduced = useReducedMotion()
  const hidden = useDocumentHidden()
  const [value, setValue] = useState(target)
  const state = useRef({ value: target, velocity: 0 })

  useEffect(() => {
    // A hidden tab suspends requestAnimationFrame entirely, so the loop below
    // would never run and `value` would sit on whatever it held when the tab
    // was backgrounded. That is not a dropped animation, it is a **wrong
    // number** — the HUD read `DEVS 2` while the store held 1,002, because the
    // target moved while nothing was pumping the spring.
    //
    // Motion the player cannot see is worth nothing and being correct on
    // return is worth everything, so a hidden tab resolves to the target the
    // same way reduce-motion does. `hidden` is reactive, so becoming visible
    // re-runs this and the spring resumes from a settled state.
    if (reduced || hidden) {
      // Kept in step so that turning the preference off resumes from where the
      // value actually is rather than from wherever the spring was abandoned.
      state.current = { value: target, velocity: 0 }
      return
    }

    let frame = 0
    let last = performance.now()

    const step = (now: number) => {
      // A backgrounded tab returns with a dt of seconds. Clamping to four
      // frames means the spring resumes from where it was rather than teleporting.
      const dt = Math.min(now - last, 64)
      last = now

      const next = springStep(state.current, target, dt, config)
      if (isSettled(next, target)) {
        state.current = { value: target, velocity: 0 }
        setValue(target)
        return
      }

      state.current = next
      setValue(next.value)
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, config, reduced, hidden])

  // §10.5 rule 3 has no springs to shorten — a spring is the motion itself, so
  // under reduce-motion the value is simply the target, resolved in render
  // rather than pushed through state.
  return reduced || hidden ? target : value
}

/**
 * Is the document hidden, as a reactive value?
 *
 * `document.hidden` read during render is not reactive on its own, and the
 * spring needs to *re-run* when the tab comes back rather than merely read the
 * right value once. Subscribed rather than polled because visibility changes
 * are events and there is nothing to poll for.
 */
function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(isHidden)

  useEffect(() => {
    const onChange = () => setHidden(isHidden())
    // Read once on mount as well: the tab can be hidden before this subscribes,
    // in which case no event is ever coming.
    onChange()
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return hidden
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden
}
