/**
 * §10.11 — the release history is written on ship and goes with the run.
 *
 * The pure model lives in `sim/history.ts` and is tested there. What is tested
 * here is the wiring: that a ship produces a record carrying the run's build
 * time and labour, that the project clock resets for the next build, and that a
 * Paradigm Shift takes the catalogue with everything else attached to it.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { BASELINE_RATING } from '../sim/rating.ts'
import { nextOrdinal } from '../sim/history.ts'
import {
  __resetStore,
  __setState,
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

    const history = getState().history
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

  it('goes with the run — a Paradigm Shift liquidates the catalogue', () => {
    // **This asserted the opposite until 2026-08-27**, and the sentence it
    // asserted was "a Paradigm Shift liquidates the run, not the memory". It is
    // the right rule for a trophy and the wrong one for §10.11's gallery, which
    // is the catalogue this studio is *selling*: the tails, the ratings and the
    // ticket queues attached to every one of those games are liquidated by the
    // shift, and what was left standing was a wall of titles from a reality that
    // no longer exists. Reported as "galleries should not persist across
    // paradigm shifts".
    aboutToShip()
    tick(1)
    expect(getState().history.recent).toHaveLength(1)

    triggerParadigmShift()

    expect(getState().history.recent).toHaveLength(0)
    expect(getState().history.aggregates).toHaveLength(0)
    // And the ordinal restarts with it, so the next reality's first game is its
    // first game rather than its forty-first. Zero-based, like every other
    // index in this codebase — `nextOrdinal` is "one past the highest recorded".
    expect(nextOrdinal(getState().history)).toBe(0)
  })
})
