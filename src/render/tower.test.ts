import { describe, expect, it } from 'vitest'
import {
  DEVS_PER_STOREY,
  STOREY_HEIGHT,
  storeyAtLocal,
  MAX_STOREYS,
  storeyDropHeight,
  storeysFor,
  towerSquash,
} from './tower.ts'
import { maxZoomFor } from '../sim/headcount.ts'
import { zAtRung } from '../sim/ladder.ts'

describe('storeysFor — GDD §7.7.1, the unit becomes a floor', () => {
  it('shows no tower while one sprite is still one person', () => {
    expect(storeysFor(1)).toBe(0)
    expect(storeysFor(999)).toBe(0)
  })

  it('starts the tower exactly where the ladder says the unit changes', () => {
    expect(storeysFor(DEVS_PER_STOREY)).toBe(1)
  })

  it('floors rather than rounds — a half-empty storey is not a storey', () => {
    // 1,999 developers is one full floor and most of a second. Showing two
    // would be claiming a floor that is half empty, and the player counts
    // what they can see.
    expect(storeysFor(1999)).toBe(1)
    expect(storeysFor(2000)).toBe(2)
  })

  it('caps at the rung, because rung 4 makes the whole tower one unit', () => {
    expect(storeysFor(1e9)).toBe(MAX_STOREYS)
  })

  it('covers the whole span the zoom ceiling traps the player in', () => {
    // §7.4a — the ceiling is rung 3 for the whole of this decade, and rung 3 is
    // the tower. So the tower has to carry everything from 1e3 to 1e4 on its
    // own — 1 to 10 storeys — because it is the furthest out the camera goes.
    expect(storeysFor(1e3)).toBe(1)
    expect(storeysFor(9999)).toBe(9)
    expect(maxZoomFor(9999)).toBe(zAtRung(3))
  })

  it('survives nonsense rather than drawing NaN storeys', () => {
    expect(storeysFor(Number.NaN)).toBe(0)
    expect(storeysFor(-5)).toBe(0)
  })
})

describe('the arrival — §7.7.2, a storey drops out of the sky', () => {
  it('falls under gravity, not at a constant rate', () => {
    // "Drops out of the sky and lands with a whump." An ease-out reads as a
    // crane lowering it, which is the opposite of the register §7.7.2 asks for.
    const first = storeyDropHeight(0.2) - storeyDropHeight(0.5)
    const second = storeyDropHeight(0.5) - storeyDropHeight(0.8)
    expect(second).toBeGreaterThan(first)
  })

  it('starts in the air and lands', () => {
    expect(storeyDropHeight(0)).toBeGreaterThan(0)
    expect(storeyDropHeight(1)).toBe(0)
  })

  it('squashes the tower on impact and settles back', () => {
    // "The building squashes, wobbles, and settles one floor taller."
    expect(towerSquash(0.5)).toBe(1)
    const impact = Math.min(...Array.from({ length: 40 }, (_, i) => towerSquash(0.82 + i * 0.0045)))
    expect(impact).toBeLessThan(1)
    expect(towerSquash(1)).toBe(1)
  })

  it('wobbles — it stretches back past rest, it does not just dip', () => {
    // §7.7.2 says "squashes, wobbles, and settles". A wobble overshoots on the
    // way back, so going slightly above 1 is the behaviour rather than a bug —
    // this assertion originally forbade it and was wrong. Compression without
    // rebound reads as the tower being dented, not as weight landing on it.
    const samples = Array.from({ length: 101 }, (_, i) => towerSquash(i / 100))
    expect(Math.min(...samples)).toBeLessThan(1)
    expect(Math.max(...samples)).toBeGreaterThan(1)
  })

  it('stays within a range that reads as concrete rather than rubber', () => {
    for (let t = 0; t <= 1; t += 0.01) {
      expect(towerSquash(t)).toBeGreaterThan(0.93)
      expect(towerSquash(t)).toBeLessThan(1.07)
    }
  })
})

describe('which storey is under the thumb (GDD §4.5b, R15)', () => {
  it('finds the storey a point sits on', () => {
    // Rung 3's unit is a floor, so a tap has to name *which* floor — the
    // sixth storey and the first are two different thousand-person units and
    // §4.5b makes each of them a target.
    expect(storeyAtLocal(0, 0, 6)).toBe(0)
    expect(storeyAtLocal(0, -STOREY_HEIGHT * 3, 6)).toBe(3)
    expect(storeyAtLocal(0, -STOREY_HEIGHT * 5, 6)).toBe(5)
  })

  it('clamps to the storeys that exist rather than inventing one', () => {
    expect(storeyAtLocal(0, -STOREY_HEIGHT * 40, 6)).toBe(5)
    expect(storeyAtLocal(0, STOREY_HEIGHT * 10, 6)).toBe(0)
  })

  it('misses when the tap is beside the building, not on it', () => {
    // §7.7.6 makes the world addressable, and an addressable world has sky in
    // it. A tap on the sky is a miss, exactly as a tap on empty floor is.
    expect(storeyAtLocal(900, 0, 6)).toBe(-1)
  })

  it('has nothing to hit before the tower is built', () => {
    expect(storeyAtLocal(0, 0, 0)).toBe(-1)
  })
})
