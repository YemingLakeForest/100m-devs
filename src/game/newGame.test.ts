import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FOUNDER_PROFILE_KEY } from './founderProfile.ts'
import { emptyPermanent, getPermanent, readSave, setPermanent } from './save.ts'
import { __resetStore, __setState, getState, saveGame, startNewGame } from './store.ts'

beforeEach(() => {
  localStorage.clear()
  __resetStore()
})

afterEach(() => {
  localStorage.clear()
  __resetStore()
})

describe('New Game', () => {
  it('replaces run and permanent progress but keeps install identity', () => {
    const permanent = emptyPermanent()
    setPermanent({
      ...permanent,
      meta: { ...permanent.meta, lifetimeRevenue: 99_000, heroCards: ['james'] },
    })
    __setState({ devs: 1_001, cash: 50_000, projectsShipped: 8 })
    localStorage.setItem(FOUNDER_PROFILE_KEY, '{"name":"Ada","head":"wave","body":"jacket"}')
    saveGame()

    startNewGame()

    expect(getState().devs).toBe(1)
    expect(getState().cash).toBe(0)
    expect(getState().projectsShipped).toBe(0)
    expect(getPermanent()).toEqual(emptyPermanent())
    expect(readSave()?.run.devs).toBe(1)
    expect(localStorage.getItem(FOUNDER_PROFILE_KEY)).toContain('Ada')
  })
})
