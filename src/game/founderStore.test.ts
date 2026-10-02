/**
 * You, wired — GDD §4.5d, §13.7.1. R16 and R20.
 *
 * `sim/founder.test.ts` proves the curve. This proves the three claims that
 * only exist once the curve is plugged into the store, and every one of them is
 * a sentence §4.5d writes as a requirement rather than as a number:
 *
 *   - your output is **not** divided by §4.1's Entropy;
 *   - your output is **not** multiplied by the swarm;
 *   - it lands in §10.1's `you` half, not the `swarm` half.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  baseVelocity,
  currentEffectiveVelocity,
  currentEntropy,
  founderOf,
  founderPassiveVelocity,
  founderVelocity,
  getState,
  pokeFounder,
  pokeVelocity,
  tick,
} from './store.ts'
import { FOUNDER_BASE_RATE, NO_FOUNDER } from '../sim/founder.ts'
import { emptyPermanent, setPermanent } from './save.ts'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  localStorage.clear()
})

describe('the curve nothing can touch — §4.5d', () => {
  it('does not fall when the studio collapses', () => {
    // The claim, stated as the harshest case in the game. A thousand developers
    // on a cap of a hundred is §21 Act IV: Entropy near 1, the swarm producing
    // almost nothing. Your desk does not notice.
    __setState({ devs: 2, devCap: 100 })
    const healthy = founderVelocity()
    const healthySwarm = baseVelocity()

    __setState({ devs: 1_000, devCap: 100 })
    expect(currentEntropy()).toBeGreaterThan(0.9)
    expect(baseVelocity()).toBeLessThan(healthySwarm)
    expect(founderVelocity()).toBe(healthy)
  })

  it('does not rise when the studio does', () => {
    __setState({ devs: 2, devCap: 100 })
    const small = founderVelocity()
    __setState({ devs: 76, devCap: 100 })
    expect(baseVelocity()).toBeGreaterThan(1)
    expect(founderVelocity()).toBe(small)
  })

  it('adds no founder output to a seized studio without clicks', () => {
    __setState({ devs: 100_000, devCap: 100, cash: 1e12 })
    const before = getState().burned.toNumber()
    for (let i = 0; i < 60; i++) tick(1 / 60)
    expect(getState().burned.toNumber() - before).toBeLessThan(FOUNDER_BASE_RATE * .01)
    expect(founderPassiveVelocity()).toBe(0)
  })
})

describe('the garage is a clicker — §4.5d, amended 2026-08-30', () => {
  /**
   * Reported as "when there's only us, the story points should not drop
   * without us clicking".
   *
   * The order is the claim, not the numbers (§25.3.2): before the first hire
   * the burn-down moves *only* on a tap, and from the first hire on it moves on
   * its own. §21.7.1's closing announcement — STORY POINTS NOW BURN DOWN
   * AUTOMATICALLY. NO TAPPING REQUIRED. — is the machine reading these two
   * assertions out, so if either one flips the scene starts lying.
   */
  it('banks nothing while the studio is only you', () => {
    __setState({ devs: 0 })
    const before = getState().burned.toNumber()
    for (let i = 0; i < 60; i++) tick(1 / 60)
    expect(getState().burned.toNumber()).toBe(before)
  })

  it('still pays for a tap on your own desk, which is the whole act', () => {
    // §4.5d failure condition 1 inverted: the trickle waits for a colleague,
    // the *tap* never waits for anything.
    __setState({ devs: 0 })
    const before = getState().burned.toNumber()
    expect(pokeFounder()).toBeGreaterThan(0)
    expect(getState().burned.toNumber()).toBeGreaterThan(before)
  })

  it('never produces passive founder points after hiring either', () => {
    __setState({ devs: 0 })
    expect(founderPassiveVelocity()).toBe(0)
    __setState({ devs: 1 })
    expect(founderPassiveVelocity()).toBe(0)
  })

  it('does not claim a velocity the burn-down is not moving at', () => {
    // §10.1's readout and the bar have to agree, or the player is told they
    // are producing while nothing produces.
    __setState({ devs: 0 })
    expect(currentEffectiveVelocity()).toBe(0)
    expect(pokeVelocity()).toBe(0)
  })
})

describe('§10.1’s split — the you half is finally you', () => {
  it('counts your desk as you, never as the swarm', () => {
    __setState({ devs: 40, devCap: 100 })
    // R11 built this split so the player could tell their own contribution
    // apart. Until §4.5d there was nothing in it but pokes.
    expect(pokeVelocity()).toBe(0)

    // The swarm runs on its own; YOU rises only after the player's action.
    expect(baseVelocity()).toBeGreaterThan(0)
    expect(pokeVelocity()).toBe(0)
    pokeFounder()
    expect(pokeVelocity()).toBeGreaterThan(0)
  })
})

describe('tapping your own desk — §4.5d', () => {
  it('pays without needing a target, a zoom or a mood', () => {
    // `poke` resolves a dev state, a zoom yield and a context switch. None of
    // them is a statement about you, which is why this is its own verb.
    const before = getState().burned.toNumber()
    const paid = pokeFounder()
    expect(paid).toBeGreaterThan(0)
    expect(getState().burned.toNumber() - before).toBeCloseTo(paid, 8)
  })

  it('throws the same Story Point and code-line feedback as a developer', () => {
    const paid = pokeFounder(123, 234)
    const floater = getState().floaters.at(-1)

    expect(floater).toMatchObject({ sp: paid, x: 123, y: 234, crit: false })
    expect(floater?.snippet).toBeTruthy()
  })

  it('is worth more than standing still, or it is an idler and not a clicker', () => {
    // §4.5d failure condition 1.
    expect(pokeFounder()).toBeGreaterThan(founderVelocity())
  })

  it('is inert during a scene and after bankruptcy, like every other tap', () => {
    __setState({ scene: 'anything' })
    expect(pokeFounder()).toBe(0)
    __setState({ scene: null, phase: 'bankrupt' })
    expect(pokeFounder()).toBe(0)
  })

})

describe('§13.7.1 — the Management tree is retired [2026-09-26]', () => {
  // *"retire the old tree"* — your upgrades are your tree now (GDD §8), and none
  // of its nodes is wired yet, so you are the founder you started as, whatever
  // an older save remembers.
  it('leaves you at the founder you started as', () => {
    expect(founderOf()).toEqual(NO_FOUNDER)
    expect(founderVelocity()).toBe(FOUNDER_BASE_RATE)
  })
})
