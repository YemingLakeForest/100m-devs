import { describe, expect, it } from 'vitest'
import {
  HOLD_MS,
  TAP_MS,
  TAP_SLOP,
  clampPan,
  exceedsSlop,
  resolveGesture,
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

describe('poke or drag — how a thumb tells the difference, GDD §7.7.6a', () => {
  it('makes the poke the default, because it is the common action', () => {
    // §7.7.6a: "it is instant, and it is the default — the common action must
    // never be the one that needs learning."
    expect(resolveGesture(0, 0, 0)).toBe('poke')
    expect(resolveGesture(2, 2, 80)).toBe('poke')
    expect(resolveGesture(0, 0, TAP_MS)).toBe('poke')
  })

  it('lets motion beat time, at every duration', () => {
    // The rule that stops a slow, sloppy pan resolving as a grab three hundred
    // milliseconds in. A finger that has travelled is dragging whatever the
    // clock says — including well past the hold timer.
    for (const ms of [0, 100, TAP_MS, HOLD_MS, HOLD_MS + 2000]) {
      expect(resolveGesture(TAP_SLOP + 1, 0, ms)).toBe('drag')
      expect(resolveGesture(0, 300, ms)).toBe('drag')
    }
  })

  it('resolves a still, patient finger as a hold', () => {
    expect(resolveGesture(0, 0, HOLD_MS)).toBe('hold')
    expect(resolveGesture(TAP_SLOP, 0, HOLD_MS + 500)).toBe('hold')
  })

  it('never lets one press be two gestures', () => {
    // Mutually exclusive by construction rather than by a flag: `HOLD_MS` is
    // longer than `TAP_MS`, so no journey can satisfy both, and the resolver
    // returns exactly one answer for every one of them.
    expect(HOLD_MS).toBeGreaterThan(TAP_MS)
    for (const d of [0, 3, TAP_SLOP, TAP_SLOP + 1, 90]) {
      for (const ms of [0, 40, TAP_MS, TAP_MS + 1, HOLD_MS - 1, HOLD_MS, 4000]) {
        expect(['poke', 'drag', 'hold']).toContain(resolveGesture(d, 0, ms))
      }
    }
  })

  it('guesses nothing in the window where the player has not said', () => {
    // Still, but slower than a tap and quicker than a hold. Resolving it as
    // either would be acting on the player's behalf in the one case where they
    // have given no signal, so it resolves as a drag of no distance — which
    // does nothing at all.
    expect(resolveGesture(0, 0, TAP_MS + 1)).toBe('drag')
    expect(resolveGesture(0, 0, HOLD_MS - 1)).toBe('drag')
  })

  it('agrees with the slop test the drag path uses to cancel the timer', () => {
    expect(exceedsSlop(0, 0)).toBe(false)
    expect(exceedsSlop(TAP_SLOP, 0)).toBe(false)
    expect(exceedsSlop(TAP_SLOP + 1, 0)).toBe(true)
    expect(exceedsSlop(8, 8)).toBe(true)
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
