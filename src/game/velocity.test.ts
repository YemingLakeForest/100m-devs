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
  baseVelocity,
  currentEffectiveVelocity,
  currentVelocity,
  getState,
  poke,
  pokeVelocity,
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
    //
    // Measured on `pokeVelocity` rather than on `pokeRate` alone, because R14
    // moved three quarters of a poke out of the instant payout and into a buff.
    // `pokeRate` on its own now reads a quarter of what the player is doing,
    // which is exactly the under-reporting §25.1 exists to stop.
    tap(4, 6)
    // Every Act I poke is worth 1 SP (the Fibonacci ladder starts there), so
    // four pokes a second is four points a second.
    expect(pokeVelocity()).toBeGreaterThan(3)
    expect(pokeVelocity()).toBeLessThan(5)
  })

  it('keeps reading the player’s contribution while their buffs are still up', () => {
    // §4.5a's loop, in the one readout that can show it. The old `pokeRate`
    // emptied two seconds after the last tap whatever the taps had bought; the
    // player's actual contribution now decays on the buff's time constant,
    // because that is when their work actually stops arriving.
    tap(5, 4)
    for (let i = 0; i < 60 * 3; i++) tick(1 / 60)
    expect(getState().pokeRate).toBeLessThan(0.3)
    expect(pokeVelocity()).toBeGreaterThan(1)
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
    // mis-report it. `poke` banks its Story Points itself — a quarter on the
    // tap and the rest through §4.5a's buff — so if `tick` *also* integrated
    // `pokeRate`, every tap would be paid for twice and Act I would be
    // trivially winnable by mashing.
    //
    // Asserted directly rather than by counting taps: a poke's worth now
    // arrives over about fifteen seconds, so a three-second window measures the
    // buff's ramp rather than the double-count this is guarding against. The
    // full accounting is pinned in `pokeBuff.test.ts`.
    __resetStore()
    for (let i = 0; i < 60; i++) tick(1 / 60)
    const honest = getState().burned.toNumber()

    __resetStore()
    __setState({ pokeRate: 500 })
    for (let i = 0; i < 60; i++) tick(1 / 60)

    expect(getState().burned.toNumber()).toBeCloseTo(honest, 8)
  })

  it('keeps the banked rate free of the thumb, for tick and for offline', () => {
    // `baseVelocity` is what §24's offline resolution extrapolates. A player who
    // was mashing when they closed the tab must not earn eight hours of mashing
    // while they sleep — and `currentVelocity` is no longer the right question,
    // because R14's buffs are a real rate that `tick` is *supposed* to integrate.
    __setState({ pokeRate: 999 })
    expect(currentVelocity()).not.toBeGreaterThan(currentEffectiveVelocity() - 900)
    expect(currentVelocity()).toBe(currentVelocity({ ...getState(), pokeRate: 0 }))
    expect(baseVelocity()).toBe(baseVelocity({ ...getState(), pokeRate: 0, buffs: [] }))
  })
})
