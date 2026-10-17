/**
 * Poking James — 2026-09-26, *"I can't click james to code at the moment"*.
 *
 * The claims, not the numbers: he pays nothing before he has arrived, a poke on
 * him is worth more than one on you (he is the super dev), and the gym still
 * takes him away for an hour a day (§21.7.0 rule 5).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POKE_RATE_TAU, __resetStore, __setState, founderOf, getState, pokeJames, structuralVelocity } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_JAMES_ARRIVES } from './scenes.ts'
import { GYM_START_HOUR, runSecondsAtHour } from '../sim/james.ts'

function jamesHasArrived(yes: boolean) {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, milestones: yes ? [SCENE_JAMES_ARRIVES.id] : [] } })
}

describe('a poke on James', () => {
  beforeEach(() => __resetStore())
  afterEach(() => { jamesHasArrived(false); __resetStore() })

  it('pays nothing before he has arrived', () => {
    jamesHasArrived(false)
    __setState({ runSeconds: 100 })
    expect(pokeJames()).toBe(0)
  })

  it('is code, and worth more than a poke on the founder', () => {
    jamesHasArrived(true)
    __setState({ runSeconds: 100 })
    const before = getState().burned.toNumber()
    const sp = pokeJames(10, 20)
    expect(sp).toBeGreaterThan(founderOf().tapValue)
    expect(getState().burned.toNumber()).toBeCloseTo(before + sp, 6)
    expect(getState().floaters.at(-1)).toMatchObject({ sp, x: 10, y: 20 })
  })

  it('pays nothing while he is at the gym', () => {
    jamesHasArrived(true)
    __setState({ runSeconds: runSecondsAtHour(GYM_START_HOUR + 0.5) })
    expect(pokeJames()).toBe(0)
  })
})

/**
 * James as a share of the studio [2026-10-16, plan phase 6.2]. Run 2 only: the
 * claims are that his presence lifts the studio and the gym takes it away, that
 * the poke is a share of the studio rather than of your tap, and that hammering
 * him adds no more than one studio's worth.
 */
describe('James in Run 2 is a share of the studio', () => {
  function runTwo() {
    const p = emptyPermanent()
    setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_JAMES_ARRIVES.id] } })
  }
  beforeEach(() => __resetStore())
  afterEach(() => { jamesHasArrived(false); __resetStore() })

  it('lifts the studio while he is at his desk, and the gym takes it with him', () => {
    runTwo()
    __setState({ devs: 40, runSeconds: 100 })
    const here = structuralVelocity()
    __setState({ runSeconds: runSecondsAtHour(GYM_START_HOUR + 0.5) })
    const gym = structuralVelocity()
    // More than his one head is worth: 41 coders against 40.
    expect(here / gym).toBeGreaterThan(41 / 40)
  })

  it('a poke on him grows with the studio, not with your tap', () => {
    runTwo()
    __setState({ devs: 10, runSeconds: 100 })
    const small = pokeJames()
    __resetStore()
    runTwo()
    __setState({ devs: 400, devCap: 1000, runSeconds: 100 })
    const big = pokeJames()
    expect(big).toBeGreaterThan(small * 10)
    expect(big).toBeGreaterThan(founderOf().tapValue * 2)
  })

  it('hammering him adds at most about one studio of speed', () => {
    runTwo()
    __setState({ devs: 400, devCap: 1000, runSeconds: 100 })
    const v = structuralVelocity()
    let banked = 0
    // Fifty taps on one frame: the cap, not the thumb, decides. The old tap floor
    // is still paid on each, which is a rounding error at this size.
    for (let i = 0; i < 50; i++) banked += pokeJames()
    const floor = 50 * founderOf().tapValue * 2
    expect(banked).toBeLessThanOrEqual(v * POKE_RATE_TAU * 1.000001 + floor)
    expect(banked).toBeGreaterThan(v)
  })
})
