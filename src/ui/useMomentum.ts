import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useReducedMotion } from './motion.ts'
import {
  FRICTION,
  SPRING_HEAVY,
  clamp,
  decayVelocity,
  isSettled,
  momentumTravel,
  rubberBand,
  springStep,
} from './spring.ts'

/**
 * One draggable axis with momentum, friction and rubber-band ends — the §10.8
 * F2 rows for scroll, pull-down and drag, in one hook.
 *
 * Single-axis on purpose. The §7.7.6 camera pan is two of these, and keeping
 * the axes independent is what lets a horizontal fling on the office floor
 * survive a slightly diagonal thumb without the vertical bound stealing it.
 */

export interface MomentumOptions {
  /** Travel limits. Inside them the surface follows the finger exactly. */
  min: number
  max: number
  /**
   * Rubber-band reference distance — the asymptote the drag can never reach
   * past a bound. Roughly "how much stretch is available", not a hard stop.
   */
  extent?: number
  friction?: number
  initial?: number
}

export interface MomentumHandlers {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerCancel: (e: ReactPointerEvent) => void
}

export interface Momentum {
  value: number
  dragging: boolean
  handlers: MomentumHandlers
}

/**
 * Velocity is sampled over the last few moves rather than the last one. A
 * single-sample estimate is dominated by whatever happened in the final 4 ms
 * before release, which on a touchscreen is usually the finger decelerating to
 * lift — so flicks come out far too slow.
 */
const VELOCITY_WINDOW_MS = 60

export function useMomentum(options: MomentumOptions): Momentum {
  const { min, max, extent = 120, friction = FRICTION, initial = 0 } = options
  const reduced = useReducedMotion()

  const [value, setValue] = useState(() => clamp(initial, min, max))
  const [dragging, setDragging] = useState(false)

  const drag = useRef({ pointer: 0, origin: 0, start: 0 })
  const samples = useRef<{ x: number; t: number }[]>([])
  const frame = useRef(0)
  const live = useRef(clamp(initial, min, max))

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
  }, [])

  useEffect(() => stop, [stop])

  const commit = useCallback((v: number) => {
    live.current = v
    setValue(v)
  }, [])

  /**
   * The release animation. Two modes, and which one runs is decided once, at
   * release, from {@link momentumTravel}: a glide that would end out of bounds
   * is cut short and handed to the spring, so the surface never sails past the
   * end and then jerks back.
   */
  const release = useCallback(
    (velocity: number) => {
      if (reduced) {
        commit(clamp(live.current, min, max))
        return
      }

      const rest = live.current + momentumTravel(velocity, friction)
      let mode: 'glide' | 'spring' = rest < min || rest > max ? 'spring' : 'glide'
      const spring = { value: live.current, velocity: velocity * 1000 }
      let v = velocity
      let last = performance.now()

      const step = (now: number) => {
        const dt = Math.min(now - last, 64)
        last = now

        if (mode === 'glide') {
          v = decayVelocity(v, dt, friction)
          const next = live.current + v * dt
          commit(next)
          // Sub-pixel per frame is not motion any more, it is a battery drain.
          if (Math.abs(v) < 0.002) return
          if (next < min || next > max) {
            mode = 'spring'
            spring.value = next
            spring.velocity = v * 1000
          }
          frame.current = requestAnimationFrame(step)
          return
        }

        const target = clamp(spring.value, min, max)
        const next = springStep(spring, target, dt, SPRING_HEAVY)
        spring.value = next.value
        spring.velocity = next.velocity
        commit(next.value)
        if (isSettled(next, target)) {
          commit(target)
          return
        }
        frame.current = requestAnimationFrame(step)
      }

      frame.current = requestAnimationFrame(step)
    },
    [commit, friction, max, min, reduced],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      stop()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { pointer: e.pointerId, origin: e.clientX, start: live.current }
      samples.current = [{ x: e.clientX, t: performance.now() }]
      setDragging(true)
    },
    [stop],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragging || e.pointerId !== drag.current.pointer) return

      const raw = drag.current.start + (e.clientX - drag.current.origin)
      // Past a bound the surface still follows, but each further pixel of
      // finger buys less pixel of surface — F2's "resistance that increases
      // with distance".
      const next =
        raw < min
          ? min + rubberBand(raw - min, extent)
          : raw > max
            ? max + rubberBand(raw - max, extent)
            : raw

      commit(next)

      const now = performance.now()
      samples.current.push({ x: e.clientX, t: now })
      while (samples.current.length > 2 && now - samples.current[0].t > VELOCITY_WINDOW_MS) {
        samples.current.shift()
      }
    },
    [commit, dragging, extent, max, min],
  )

  const end = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerId !== drag.current.pointer) return
      setDragging(false)

      const first = samples.current[0]
      const lastSample = samples.current[samples.current.length - 1]
      const span = lastSample && first ? lastSample.t - first.t : 0
      const velocity = span > 0 ? (lastSample.x - first.x) / span : 0
      samples.current = []

      release(velocity)
    },
    [release],
  )

  return {
    value,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  }
}
