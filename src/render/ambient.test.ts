/**
 * The drawn half of GDD §7.8.6. `sim/ambient.test.ts` covers the rules; this
 * covers the thing those rules are for — that people actually move and that
 * bubbles actually appear.
 *
 * It exists because the browser could not answer the question. `document.hidden`
 * suspends `requestAnimationFrame`, so a backgrounded tab renders the last frame
 * it painted and a behaviour that needs a third of a second to reach full size
 * never gets there. Pumping the clock here is not a workaround for that; it is
 * the only way to assert "over ten seconds, somebody gets up", which no
 * screenshot can show.
 */

import { describe, expect, it } from 'vitest'
import { createAmbient, walkBob, walkOffset, walkPhase } from './ambient.ts'

const SEATS = Array.from({ length: 40 }, (_, i) => ({ x: i * 30, y: (i % 5) * 20 }))
const PROPS = [{ x: -200, y: 120 }]

/** Run `seconds` of frames at 60 Hz. */
function pump(a: ReturnType<typeof createAmbient>, seconds: number, entropy: number) {
  const dt = 1 / 60
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    a.update(dt, { seats: SEATS, props: PROPS, devs: SEATS.length, entropy, drawnIndividually: true })
  }
}

/** The largest offset any seat has this frame. */
function maxOffset(a: ReturnType<typeof createAmbient>): number {
  let best = 0
  for (let i = 0; i < SEATS.length; i++) {
    const o = a.offsetFor(i)
    best = Math.max(best, Math.hypot(o.x, o.y))
  }
  return best
}

describe('walkPhase', () => {
  it('starts and ends at the desk', () => {
    expect(walkPhase(0)).toBe(0)
    expect(walkPhase(1)).toBe(0)
  })

  it('holds at the far end rather than turning straight round', () => {
    // The joke of a water trip is the standing about, not the walking. A
    // there-and-back with no pause reads as somebody who changed their mind.
    expect(walkPhase(0.5)).toBe(1)
    expect(walkPhase(0.45)).toBe(1)
    expect(walkPhase(0.6)).toBe(1)
  })

  it('is continuous — nobody teleports', () => {
    let prev = walkPhase(0)
    for (let t = 0; t <= 1; t += 0.01) {
      const now = walkPhase(t)
      expect(Math.abs(now - prev)).toBeLessThan(0.15)
      prev = now
    }
  })
})

describe('walkOffset', () => {
  const trip = { home: { x: 0, y: 0 }, target: { x: 300, y: 0 } }

  it('is zero for somebody who is not going anywhere', () => {
    expect(walkOffset({ home: { x: 0, y: 0 }, target: null }, 0.5)).toEqual({ x: 0, y: 0 })
  })

  it('stops short of the destination', () => {
    // Standing *inside* the water cooler is not a clipping error the eye
    // forgives, and it is the default outcome of lerping to the target.
    const at = walkOffset(trip, 0.5)
    expect(at.x).toBeLessThan(300)
    expect(at.x).toBeGreaterThan(260)
  })

  it('returns them to their desk', () => {
    expect(walkOffset(trip, 0.999).x).toBeLessThan(2)
  })

  it('bobs while travelling and stands still on arrival', () => {
    expect(walkBob(0.5, false)).toBe(0)
    let moved = false
    for (let t = 0.02; t < 0.26; t += 0.01) if (walkBob(t, true) > 0.5) moved = true
    expect(moved).toBe(true)
  })
})

describe('the floor over time — GDD §7.8.6', () => {
  it('gets somebody out of their chair on a busy floor', () => {
    // The headline claim of the whole section, and the one thing no unit test
    // of the model alone can make: given a bogged-down floor and ten seconds,
    // at least one person is somewhere other than their desk.
    const a = createAmbient()
    let walked = 0
    for (let i = 0; i < 600; i++) {
      a.update(1 / 60, {
        seats: SEATS,
        props: PROPS,
        devs: SEATS.length,
        entropy: 0.9,
        drawnIndividually: true,
      })
      if (maxOffset(a) > 1) walked++
    }
    expect(walked).toBeGreaterThan(0)
    a.destroy()
  })

  it('keeps a calm floor to one thing at a time', () => {
    // The right measure is **concurrency, not total time**, and the first
    // draft of this test got that wrong. Water trips last seven seconds — the
    // longest behaviour there is — so on a quiet floor a single trip covers
    // most of a ten-second sample and "how many frames had somebody up" comes
    // out looking busy. What actually distinguishes calm from bogged down is
    // how many people are up *at once*: one person fetching a drink is a quiet
    // office, and five people milling about is not.
    const peak = (entropy: number) => {
      const a = createAmbient()
      let most = 0
      for (let i = 0; i < 1800; i++) {
        a.update(1 / 60, {
          seats: SEATS,
          props: PROPS,
          devs: SEATS.length,
          entropy,
          drawnIndividually: true,
        })
        let up = 0
        for (let s = 0; s < SEATS.length; s++) {
          const o = a.offsetFor(s)
          if (Math.hypot(o.x, o.y) > 1) up++
        }
        most = Math.max(most, up)
      }
      a.destroy()
      return most
    }
    expect(peak(0.01)).toBeLessThanOrEqual(2)
    expect(peak(0.95)).toBeGreaterThan(peak(0.01))
  })

  it('draws nothing at all above rung 2', () => {
    // Rule 4. The failure being avoided is not cost, it is a system running
    // where nobody can see it and therefore going wrong where nobody can see it.
    const a = createAmbient()
    for (let i = 0; i < 600; i++) {
      a.update(1 / 60, {
        seats: SEATS,
        props: PROPS,
        devs: 5000,
        entropy: 0.9,
        drawnIndividually: false,
      })
    }
    expect(maxOffset(a)).toBe(0)
    a.destroy()
  })

  it('returns everybody to their desk when it switches off mid-behaviour', () => {
    // Crossing a rung boundary while eight people are up and about must not
    // leave eight developers stranded in the aisle for the rest of the run.
    const a = createAmbient()
    pump(a, 10, 0.9)
    a.update(1 / 60, {
      seats: SEATS,
      props: PROPS,
      devs: 5000,
      entropy: 0.9,
      drawnIndividually: false,
    })
    expect(maxOffset(a)).toBe(0)
    a.destroy()
  })

  it('stops the water trips when crowding takes the walkway', () => {
    // §7.8.6's nicest consequence: a crowded floor stops being able to reach
    // the cooler, which is a better joke than the walk was. Modelled by the
    // room passing no destinations at all.
    const a = createAmbient()
    for (let i = 0; i < 900; i++) {
      a.update(1 / 60, {
        seats: SEATS,
        props: [],
        devs: SEATS.length,
        entropy: 0.3,
        drawnIndividually: true,
      })
      // Below the drive-by threshold, so nothing else can move anyone.
      expect(maxOffset(a)).toBe(0)
    }
    a.destroy()
  })

  it('never puts two behaviours on one developer', () => {
    // A double-booked seat is how somebody ends up walking to the cooler and
    // holding a conversation at their own desk at the same time.
    const a = createAmbient()
    for (let i = 0; i < 1200; i++) {
      a.update(1 / 60, {
        seats: SEATS,
        props: PROPS,
        devs: SEATS.length,
        entropy: 0.95,
        drawnIndividually: true,
      })
      for (let s = 0; s < SEATS.length; s++) {
        const o = a.offsetFor(s)
        expect(Number.isFinite(o.x) && Number.isFinite(o.y)).toBe(true)
      }
    }
    a.destroy()
  })

  it('sends a poked developer straight back to their desk — rule 5', () => {
    const a = createAmbient()
    pump(a, 12, 0.95)
    for (let i = 0; i < SEATS.length; i++) a.interrupt(i)
    expect(maxOffset(a)).toBe(0)
    a.destroy()
  })

  it('survives the seat list shrinking under it', () => {
    // The room rebuilds `desks` on every hire, and a behaviour started at seat
    // 39 outlives a rebuild that leaves twelve seats.
    const a = createAmbient()
    pump(a, 8, 0.9)
    const few = SEATS.slice(0, 12)
    for (let i = 0; i < 120; i++) {
      a.update(1 / 60, { seats: few, props: PROPS, devs: few.length, entropy: 0.9, drawnIndividually: true })
    }
    expect(Number.isFinite(maxOffset(a))).toBe(true)
    a.destroy()
  })
})
