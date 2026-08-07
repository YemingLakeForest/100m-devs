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
  const [value, setValue] = useState(target)
  const state = useRef({ value: target, velocity: 0 })

  useEffect(() => {
    if (reduced) {
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
  }, [target, config, reduced])

  // §10.5 rule 3 has no springs to shorten — a spring is the motion itself, so
  // under reduce-motion the value is simply the target, resolved in render
  // rather than pushed through state.
  return reduced ? target : value
}
