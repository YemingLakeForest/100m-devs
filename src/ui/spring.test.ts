import { describe, expect, it } from 'vitest'
import {
  FRICTION,
  SPRING_HEAVY,
  SPRING_UI,
  clamp,
  decayVelocity,
  isSettled,
  momentumTravel,
  rubberBand,
  springStep,
  type SpringState,
} from './spring.ts'

/** Run a spring to rest and report the path it took. */
function trace(from: number, to: number, config = SPRING_UI, dt = 16): number[] {
  let s: SpringState = { value: from, velocity: 0 }
  const out: number[] = []
  for (let i = 0; i < 600 && !isSettled(s, to); i++) {
    s = springStep(s, to, dt, config)
    out.push(s.value)
  }
  return out
}

describe('the release spring — §10.8 F2, "not a linear return"', () => {
  it('overshoots its target before settling', () => {
    // A button released from 0.96 must pass 1.0 and come back. A curve that
    // approaches 1.0 from below and stops is the linear return F2 fails.
    const path = trace(0.96, 1)
    expect(Math.max(...path)).toBeGreaterThan(1)
  })

  it('settles, and settles at the target', () => {
    const path = trace(0.96, 1)
    expect(path.length).toBeLessThan(600)
    expect(path[path.length - 1]).toBeCloseTo(1, 2)
  })

  it('is visually finished inside the F6 budget at 60 Hz', () => {
    // F6: under 400 ms unless it is a scored beat, and a press release is not
    // one. Measured against what the eye can see rather than against the
    // settle epsilon, which is chasing a fraction of a pixel long after the
    // motion has stopped reading as motion.
    const path = trace(0.96, 1)
    expect(Math.abs(path[Math.floor(400 / 16)] - 1)).toBeLessThan(0.005)
  })

  it('keeps the heavy spring to one small overshoot rather than a wobble', () => {
    // Panels and the camera carry visible mass; a bouncing panel reads as a
    // fault rather than as weight.
    const path = trace(0, 100, SPRING_HEAVY)
    const overshoot = (Math.max(...path) - 100) / 100
    expect(overshoot).toBeGreaterThan(0)
    expect(overshoot).toBeLessThan(0.05)
  })

  it('reaches the same rest point whatever the frame rate', () => {
    // The §7.7.6 camera runs on the Pixi ticker, not on rAF, so nothing here
    // may assume a 16 ms step.
    const at8 = trace(0, 100, SPRING_UI, 8)
    const at33 = trace(0, 100, SPRING_UI, 33)
    expect(at8[at8.length - 1]).toBeCloseTo(100, 1)
    expect(at33[at33.length - 1]).toBeCloseTo(100, 1)
  })

  it('stays stable when a backgrounded tab hands back a huge step', () => {
    const s = springStep({ value: 0, velocity: 0 }, 100, 5000)
    expect(Number.isFinite(s.value)).toBe(true)
    expect(s.value).toBeCloseTo(100, 1)
  })

  it('does not call a spring settled while it is passing through at speed', () => {
    expect(isSettled({ value: 100, velocity: 40 }, 100)).toBe(false)
  })
})

describe('rubber band — F2 "resistance that increases with distance"', () => {
  it('is continuous at the bound', () => {
    expect(rubberBand(0, 120)).toBe(0)
  })

  it('always follows the finger, in the same direction', () => {
    // A list that stops dead at its boundary fails F2.
    let previous = 0
    for (let x = 1; x <= 400; x += 1) {
      const v = rubberBand(x, 120)
      expect(v).toBeGreaterThan(previous)
      previous = v
    }
    expect(rubberBand(-50, 120)).toBeCloseTo(-rubberBand(50, 120), 10)
  })

  it('buys less surface per pixel of finger the further it is pulled', () => {
    // This is the whole of "elastic resistance": the derivative must fall.
    const d = (x: number) => rubberBand(x + 1, 120) - rubberBand(x, 120)
    expect(d(100)).toBeLessThan(d(10))
    expect(d(300)).toBeLessThan(d(100))
  })

  it('never reaches the extent, however hard it is pulled', () => {
    expect(rubberBand(1e6, 120)).toBeLessThan(120)
  })
})

describe('momentum and friction', () => {
  it('decays a flick smoothly rather than stopping it dead', () => {
    const v = decayVelocity(2, 100)
    expect(v).toBeLessThan(2)
    expect(v).toBeGreaterThan(0)
  })

  it('is frame-rate independent — two half steps equal one whole step', () => {
    const once = decayVelocity(2, 32)
    const twice = decayVelocity(decayVelocity(2, 16), 16)
    expect(twice).toBeCloseTo(once, 10)
  })

  it('predicts the resting point of a flick before it is flown', () => {
    // useMomentum decides glide-vs-spring from this at the moment of release,
    // so it must agree with the integration that follows.
    const v0 = 2
    let v = v0
    let travelled = 0
    for (let i = 0; i < 20000; i++) {
      v = decayVelocity(v, 1)
      travelled += v
    }
    // 1 ms rectangles under an exponential undershoot by ~0.1%; the prediction
    // only has to be right to within a pixel of a several-hundred-pixel glide.
    expect(travelled).toBeCloseTo(momentumTravel(v0, FRICTION), -1)
  })

  it('coasts for a fraction of a second, not for a journey', () => {
    // F6 applies to inertia too: 8% of launch velocity left after 300 ms.
    expect(decayVelocity(1, 300) / 1).toBeLessThan(0.5)
    expect(decayVelocity(1, 1000)).toBeLessThan(0.1)
  })
})

describe('clamp', () => {
  it('holds a value inside its bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
  })
})
