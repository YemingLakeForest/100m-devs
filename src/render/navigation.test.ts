import { describe, expect, it } from 'vitest'
import {
  TAP_SLOP,
  clampPan,
  exceedsSlop,
  flingVelocity,
  initPan,
  panLimit,
  pickNearest,
  stepPan,
} from './navigation.ts'

describe('tap vs drag — GDD §7.7.6, §7.7.6b', () => {
  it('treats a still finger as a tap, however long it rested', () => {
    // **The whole of §7.7.6b in one assertion.** There is no duration argument
    // to pass any more: a slow tap and a quick tap are the same tap, and what
    // that tap *means* is the mode on the HUD rather than the clock. Restoring
    // a time threshold here would restore the thing that was reported as being
    // hard to control.
    expect(exceedsSlop(0, 0)).toBe(false)
    expect(exceedsSlop(3, 4)).toBe(false)
    expect(exceedsSlop(TAP_SLOP, 0)).toBe(false)
  })

  it('treats a travelled finger as a look-around, not a poke', () => {
    // §7.7.6: "a pan that pokes means every attempt to look around costs the
    // player Entropy". Entropy is the resource the whole game is about, so
    // this is not a papercut — it is the player being taxed for using the
    // camera.
    expect(exceedsSlop(TAP_SLOP + 1, 0)).toBe(true)
    expect(exceedsSlop(40, 40)).toBe(true)
    expect(exceedsSlop(8, 8)).toBe(true)
  })

  it('is symmetric, so a diagonal drag is not a cheaper one', () => {
    // Euclidean rather than per-axis: a box would let a finger travel 14 px
    // north-east and still poke, which is a drag on any device.
    expect(exceedsSlop(0, TAP_SLOP + 1)).toBe(true)
    expect(exceedsSlop(-TAP_SLOP - 1, 0)).toBe(true)
    expect(exceedsSlop(0, -TAP_SLOP - 1)).toBe(true)
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
