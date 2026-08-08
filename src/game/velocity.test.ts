/**
 * The VELOCITY readout — GDD §10.1, "the clicker layer's scoreboard".
 *
 * It was showing passive output only, which in Act I is not a rounding error
 * but the whole beat inverted: §21 asks the player to poke three to five times
 * a second and *feel the burn-down outpace the passive rate*, and the one
 * readout claiming to measure that sat flat while they did it.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  POKE_RATE_TAU,
  __resetStore,
  __setState,
  currentEffectiveVelocity,
  currentVelocity,
  getState,
  poke,
  tick,
} from './store.ts'

beforeEach(() => {
  __resetStore()
})

/** Poke `rate` times a second for `seconds`, ticking in between. */
function tap(rate: number, seconds: number) {
  const step = 1 / 60
  let owed = 0
  for (let t = 0; t < seconds; t += step) {
    owed += rate * step
    while (owed >= 1) {
      poke(0, 0)
      owed -= 1
    }
    tick(step)
  }
}

describe('effective velocity', () => {
  it('equals passive velocity when nobody is poking', () => {
    expect(currentEffectiveVelocity()).toBe(currentVelocity())
  })

  it('rises the moment the player starts poking', () => {
    const idle = currentEffectiveVelocity()
    poke(0, 0)
    expect(currentEffectiveVelocity()).toBeGreaterThan(idle)
  })

  it('converges on the actual rate rather than spiking per tap', () => {
    // The property that makes the readout usable at §21's target tapping
    // speed. An impulse-per-tap counter would jump to a huge number and back
    // sixty times a second and be unreadable; this settles on taps x SP.
    tap(4, 6)
    const s = getState()
    // Every Act I poke is worth 1 SP (the Fibonacci ladder starts there), so
    // four pokes a second is four points a second.
    expect(s.pokeRate).toBeGreaterThan(3)
    expect(s.pokeRate).toBeLessThan(5)
  })

  it('falls away when the player stops', () => {
    tap(5, 4)
    const while_tapping = getState().pokeRate
    for (let i = 0; i < 60 * 4; i++) tick(1 / 60)
    const after = getState().pokeRate
    expect(after).toBeLessThan(while_tapping * 0.2)
  })

  it('forgets on roughly the time constant, not instantly and not never', () => {
    __setState({ pokeRate: 10 })
    for (let i = 0; i < Math.round(60 * POKE_RATE_TAU); i++) tick(1 / 60)
    // One time constant leaves 1/e of it.
    expect(getState().pokeRate).toBeCloseTo(10 / Math.E, 1)
  })
})

describe('the simulation is not charged twice', () => {
  it('does not feed the poke rate back into banked output', () => {
    // The one way this feature could corrupt the game rather than merely
    // mis-report it. `poke` banks its own Story Points at the moment of the
    // tap; if `tick` also integrated the poke rate, every tap would be paid for
    // twice and Act I would be trivially winnable by mashing.
    __resetStore()
    tap(5, 3)
    const banked = getState().burned.toNumber()

    __resetStore()
    // Same elapsed time, same passive rate, no taps at all.
    for (let i = 0; i < 60 * 3; i++) tick(1 / 60)
    const passiveOnly = getState().burned.toNumber()

    const fromTaps = banked - passiveOnly
    // Fifteen pokes at 1 SP. Allowing a little slack for the tap scheduler,
    // but nothing like the 2x a double-count would produce.
    expect(fromTaps).toBeGreaterThan(12)
    expect(fromTaps).toBeLessThan(20)
  })

  it('keeps currentVelocity free of the thumb, for tick and for offline', () => {
    // `currentVelocity` is what `tick` integrates and what §24's offline
    // resolution extrapolates. A player who was mashing when they closed the
    // tab must not earn eight hours of mashing while they sleep.
    __setState({ pokeRate: 999 })
    expect(currentVelocity()).not.toBeGreaterThan(currentEffectiveVelocity() - 900)
    expect(currentVelocity()).toBe(currentVelocity({ ...getState(), pokeRate: 0 }))
  })
})
