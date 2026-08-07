import { describe, expect, it } from 'vitest'
import {
  TAP_MS,
  TAP_SLOP,
  clampPan,
  flingVelocity,
  initPan,
  isTap,
  panLimit,
  pickNearest,
  stepPan,
} from './navigation.ts'

describe('tap vs drag — GDD §7.7.6', () => {
  it('treats a still finger as a tap', () => {
    expect(isTap(0, 0, 40)).toBe(true)
    expect(isTap(3, 4, 120)).toBe(true)
  })

  it('treats a travelled finger as a look-around, not a poke', () => {
    // §7.7.6: "a pan that pokes means every attempt to look around costs the
    // player Entropy". Entropy is the resource the whole game is about, so
    // this is not a papercut — it is the player being taxed for using the
    // camera.
    expect(isTap(TAP_SLOP + 1, 0, 100)).toBe(false)
    expect(isTap(40, 40, 100)).toBe(false)
  })

  it('treats a long press as a drag even if it did not move', () => {
    // The other half of the same rule: a poke that pans loses the clicker
    // layer. A finger resting on the glass is not a tap.
    expect(isTap(0, 0, TAP_MS + 1)).toBe(false)
  })
})

describe('pan limits — §7.7.6', () => {
  it('does not let a tier that already fits slide around', () => {
    // Panning something that fits is how a player ends up staring at an empty
    // frame with no idea which way home is.
    expect(panLimit(500, 1000)).toBe(0)
    expect(panLimit(1000, 1000)).toBe(0)
  })

  it('allows half the overhang once the tier is bigger than the frame', () => {
    expect(panLimit(1400, 1000)).toBe(200)
  })

  it('clamps an offset to its limits', () => {
    expect(clampPan({ x: 999, y: -999, vx: 0, vy: 0 }, 50, 20)).toMatchObject({ x: 50, y: -20 })
  })
})

describe('momentum — §7.7.6', () => {
  it('glides and then stops', () => {
    let pan = { ...initPan(), vx: 900, vy: 0 }
    for (let i = 0; i < 400; i++) pan = stepPan(pan, 1 / 60, 5000, 5000)
    expect(pan.vx).toBe(0)
    expect(pan.x).toBeGreaterThan(0)
  })

  it('stops dead at a wall rather than grinding against it', () => {
    let pan = { ...initPan(), vx: 4000, vy: 0 }
    pan = stepPan(pan, 1 / 60, 30, 30)
    expect(pan.x).toBe(30)
    expect(pan.vx).toBe(0)
  })

  it('ignores a tremor, keeps a flick', () => {
    expect(flingVelocity(5, 5)).toEqual({ vx: 0, vy: 0 })
    expect(flingVelocity(600, 0)).toEqual({ vx: 600, vy: 0 })
  })

  it('is frame-rate independent — same journey at 30 and 120 fps', () => {
    const travel = (steps: number, dt: number) => {
      let p = { ...initPan(), vx: 800, vy: 0 }
      for (let i = 0; i < steps; i++) p = stepPan(p, dt, 1e6, 1e6)
      return p.x
    }
    const at30 = travel(120, 1 / 30)
    const at120 = travel(480, 1 / 120)
    expect(Math.abs(at30 - at120) / at30).toBeLessThan(0.06)
  })
})

describe('picking a developer — §7.7.6', () => {
  const seats = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 100, y: 100 },
  ]

  it('picks the NEAREST, not the first within range', () => {
    // Desks overlap at floor zoom. First-within-radius resolves to whichever
    // happens to be earlier in the array, which is not the one under the thumb.
    expect(pickNearest(seats, 9, 0, 30)).toBe(1)
    expect(pickNearest(seats, 1, 0, 30)).toBe(0)
  })

  it('returns -1 on empty floor rather than the closest anywhere', () => {
    // An addressable world has places where nobody is sitting, and poking one
    // must not silently award a point from the nearest bystander.
    expect(pickNearest(seats, 500, 500, 30)).toBe(-1)
  })

  it('scans a full floor without complaint', () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: 0 }))
    expect(pickNearest(many, 999, 0, 5)).toBe(999)
  })
})
