/**
 * §10.11 — the release history is written on ship and survives prestige.
 *
 * The pure model lives in `sim/history.ts` and is tested there. What is tested
 * here is the wiring: that a ship produces a permanent record with the run's
 * build time and labour, that the project clock resets for the next build, and
 * that a Paradigm Shift — which liquidates the run and the catalogue — leaves
 * the memory intact.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { BASELINE_RATING } from '../sim/rating.ts'
import {
  __resetStore,
  __setState,
  getPermanent,
  getState,
  tick,
  triggerParadigmShift,
} from './store.ts'

beforeEach(() => {
  __resetStore()
})

/** Put the run a hair from shipping, with a known build time and labour. */
function aboutToShip() {
  __setState({
    devs: 1,
    projectSeconds: 5,
    projectLabourSeconds: 30,
    burned: getState().commitment.minus(0.1),
  })
}

describe('the release history — §10.11', () => {
  it('records a shipped game with its build time and labour', () => {
    aboutToShip()
    tick(1)

    const history = getPermanent().meta.history
    expect(history.recent).toHaveLength(1)

    const r = history.recent[0]
    expect(r.name).toBe('Flappy Square 1.0')
    // §21.0c — Run 1 ships at the baseline by construction, so the rating is the
    // garage's, not a live roll.
    expect(r.rating).toBe(BASELINE_RATING)
    expect(r.buildSeconds).toBeGreaterThanOrEqual(5)
    expect(r.labourSeconds).toBeGreaterThanOrEqual(30)
    expect(r.run).toBe(0)
    expect(r.seed).toBe(getState().runSeed)

    // The project clock started again for the next build.
    expect(getState().projectSeconds).toBe(0)
    expect(getState().projectLabourSeconds).toBe(0)
  })

  it('is career-wide — a Paradigm Shift liquidates the run, not the memory', () => {
    aboutToShip()
    tick(1)
    expect(getPermanent().meta.history.recent).toHaveLength(1)

    triggerParadigmShift()

    // §13.2 cleared the run and the catalogue; the history is untouched.
    expect(getState().projectsShipped).toBe(1)
    expect(getPermanent().meta.history.recent).toHaveLength(1)
    expect(getPermanent().meta.history.recent[0].name).toBe('Flappy Square 1.0')
  })
})
