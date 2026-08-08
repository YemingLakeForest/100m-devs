/**
 * Picking developers up and putting them down — GDD §7.8.9.
 *
 * "The floor is the largest surface in the game and until now nothing on it
 * could be touched except to poke it." This is the toy, and the whole joke is
 * that it produces exactly nothing: §7.8.6 rule 2 guarantees no Story Point
 * moves in either direction, so a player who spends thirty seconds herding
 * eight wanderers has achieved precisely as much as one who watched.
 */

import { describe, expect, it } from 'vitest'
import { LOITER_MAX, loiterCap } from '../sim/ambient.ts'
import { createAmbient } from './ambient.ts'

const SEATS = Array.from({ length: 40 }, (_, i) => ({ x: i * 30, y: (i % 5) * 20 }))
const PROPS = [{ x: -200, y: 120 }]

function seeded(seed = 1): () => number {
  let x = seed >>> 0
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    return x / 0x100000000
  }
}

function floorWith(seconds: number, entropy = 0.5) {
  const a = createAmbient(seeded())
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    a.update(1 / 60, {
      seats: SEATS,
      props: PROPS,
      devs: SEATS.length,
      entropy,
      drawnIndividually: true,
    })
  }
  return a
}

function anyLoiterer(a: ReturnType<typeof createAmbient>): number {
  for (let i = 0; i < SEATS.length; i++) if (a.isLoitering(i)) return i
  return -1
}

describe('the loitering population — §7.8.9', () => {
  it('is a separate budget from the interruptions, and has to be', () => {
    // Loitering lasts twenty-two seconds and a conversation lasts three, so one
    // shared budget means the long state squats on every slot and the floor
    // goes quiet. That is not a hypothetical — it is what happened when
    // `loiter` was first added to `pickBehaviour`'s weights.
    expect(loiterCap(40, 0.5)).toBeGreaterThan(0)
    expect(loiterCap(40, 0.9)).toBeGreaterThan(loiterCap(40, 0.1))
  })

  it('always leaves somebody to pick up, once there is a floor at all', () => {
    // §7.8.9's toy is unplayable on an empty floor, so the cap has a floor of
    // one rather than rounding to nothing in a small studio.
    expect(loiterCap(3, 0)).toBeGreaterThanOrEqual(1)
    expect(loiterCap(2, 1)).toBe(0)
  })

  it('is capped, so a huge studio does not run a hundred walk cycles', () => {
    expect(loiterCap(1_000_000, 1)).toBe(LOITER_MAX)
  })

  it('actually produces loiterers on a running floor', () => {
    const a = floorWith(30)
    expect(anyLoiterer(a)).toBeGreaterThanOrEqual(0)
    a.destroy()
  })
})

describe('picking somebody up', () => {
  it('picks up a loiterer and not anybody else', () => {
    const a = floorWith(30)
    const who = anyLoiterer(a)
    expect(a.pickUp(who)).toBe(true)
    expect(a.carrying).toBe(who)
    a.destroy()
  })

  it('refuses somebody who is not loitering', () => {
    // §7.8.9 — a person mid-conversation is *busy*, and yanking them out of one
    // would make the drag read as an interruption rather than as a tidy-up,
    // which is the opposite of the joke.
    const a = floorWith(30)
    let refused = 0
    for (let i = 0; i < SEATS.length; i++) if (!a.isLoitering(i) && !a.pickUp(i)) refused++
    expect(refused).toBeGreaterThan(0)
    a.destroy()
  })

  it('only carries one person at a time', () => {
    const a = floorWith(30)
    expect(a.pickUp(anyLoiterer(a))).toBe(true)
    let second = -1
    for (let i = 0; i < SEATS.length; i++) if (a.isLoitering(i)) second = i
    if (second >= 0) expect(a.pickUp(second)).toBe(false)
    a.destroy()
  })

  it('follows the hand exactly, with no easing', () => {
    // A held object that lags the pointer does not feel held.
    const a = floorWith(30)
    const who = anyLoiterer(a)
    a.pickUp(who)
    a.carryTo(777, 555)
    const at = a.offsetFor(who)
    expect(at.x + SEATS[who].x).toBeCloseTo(777, 0)
    a.destroy()
  })

  it('does not let a carried developer expire in the player’s hand', () => {
    // §7.8.9 — "never a timer". A behaviour that aged out mid-carry would drop
    // somebody on the floor for no reason the player could see.
    const a = floorWith(30)
    const who = anyLoiterer(a)
    a.pickUp(who)
    for (let i = 0; i < 60 * 60; i++) {
      a.update(1 / 60, {
        seats: SEATS,
        props: PROPS,
        devs: SEATS.length,
        entropy: 0.5,
        drawnIndividually: true,
      })
    }
    expect(a.carrying).toBe(who)
    a.destroy()
  })

  it('is not dropped by a poke landing on the same person', () => {
    // Two verbs fighting over one finger.
    const a = floorWith(30)
    const who = anyLoiterer(a)
    a.pickUp(who)
    a.interrupt(who)
    expect(a.carrying).toBe(who)
    a.destroy()
  })
})

describe('putting them down', () => {
  it('seats them when dropped on a free desk', () => {
    const a = floorWith(30)
    const who = anyLoiterer(a)
    a.pickUp(who)
    expect(a.drop(who)).toBe('seated')
    expect(a.carrying).toBe(-1)
    expect(a.offsetFor(who)).toEqual({ x: 0, y: 0 })
    a.destroy()
  })

  it('sends them walking back when dropped on the floor', () => {
    // §7.8.9 — "drop them anywhere else and they walk back to wherever they
    // were going, unhurried, which is funnier than obeying."
    const a = floorWith(30)
    const who = anyLoiterer(a)
    a.pickUp(who)
    a.carryTo(900, 400)
    expect(a.drop(null)).toBe('walking')
    expect(a.carrying).toBe(-1)
    // Still away from their desk, on their way back.
    const at = a.offsetFor(who)
    expect(Math.hypot(at.x, at.y)).toBeGreaterThan(0)
    a.destroy()
  })

  it('reports nothing when nobody is being carried', () => {
    const a = floorWith(30)
    expect(a.drop(3)).toBe('none')
    a.destroy()
  })

  it('lets go when the floor stops being drawn individually', () => {
    // Crossing a rung boundary mid-carry must not leave a developer welded to
    // a pointer that no longer means anything.
    const a = floorWith(30)
    a.pickUp(anyLoiterer(a))
    a.update(1 / 60, {
      seats: SEATS,
      props: PROPS,
      devs: 5000,
      entropy: 0.5,
      drawnIndividually: false,
    })
    expect(a.carrying).toBe(-1)
    a.destroy()
  })
})
