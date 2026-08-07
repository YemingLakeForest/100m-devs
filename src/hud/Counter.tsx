import { useState } from 'react'
import { useSpring } from '../ui/useSpring.ts'
import { SPRING_HEAVY, type SpringConfig } from '../ui/spring.ts'

/**
 * A numeral that rolls to its new value and bounces on arrival — GDD §10.8a,
 * "counters roll, never set", and §10.6's "numbers that snap to new values"
 * anti-pattern.
 *
 * Composition over `useSpring`, not a new primitive: the kit already owns the
 * integrator and the reduce-motion handling, and this only decides *which*
 * numbers get to be animated at all.
 *
 * That decision is the interesting part, so it is stated rather than implied.
 * A counter the simulation already moves continuously — cash draining at
 * $50,000/sec, velocity tracking the swarm — is **not** wrapped in this. It is
 * already rolling, by construction, and a spring laid over a ramp does nothing
 * but sit a constant distance behind the truth. §21 Act V asks the player to
 * read the cash figure as a threat, and a threat may not lag. This is for the
 * counters that *jump*: headcount over a Mass Hire, projects shipped, the
 * speedometer as a thousand people land on it at once.
 */

export interface CounterProps {
  value: number
  format: (n: number) => string
  /**
   * §10.8a asks for a scale overshoot on the digits when a counter arrives.
   * Off by default because a value that changes every frame would fire it every
   * frame, which is a vibration rather than an arrival.
   */
  bounce?: boolean
  config?: SpringConfig
  className?: string
}

export function Counter({ value, format, bounce = false, config = SPRING_HEAVY, className }: CounterProps) {
  const shown = useSpring(value, config)
  const [arriving, setArriving] = useState(false)
  // Set during render, not in an effect: the bounce and the new target have to
  // be committed in the same paint or the digits scale up a frame after they
  // have already changed, which reads as a stutter rather than an arrival.
  const [previous, setPrevious] = useState(value)
  if (value !== previous) {
    setPrevious(value)
    if (bounce) setArriving(true)
  }

  return (
    <b
      className={`hud__num${arriving ? ' is-arriving' : ''}${className ? ` ${className}` : ''}`}
      // The class is cleared by the animation itself rather than by a timer, so
      // the bounce cannot be left switched on by a re-render that lands mid-flight.
      onAnimationEnd={() => setArriving(false)}
    >
      {format(shown)}
    </b>
  )
}
