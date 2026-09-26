/**
 * Poking James — 2026-09-26, *"I can't click james to code at the moment"*.
 *
 * The claims, not the numbers: he pays nothing before he has arrived, a poke on
 * him is worth more than one on you (he is the super dev), and the gym still
 * takes him away for an hour a day (§21.7.0 rule 5).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, __setState, founderOf, getState, pokeJames } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_JAMES_ARRIVES } from './scenes.ts'
import { GYM_START_HOUR } from '../sim/james.ts'

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
    __setState({ runSeconds: (GYM_START_HOUR + 0.5) * 3600 })
    expect(pokeJames()).toBe(0)
  })
})
