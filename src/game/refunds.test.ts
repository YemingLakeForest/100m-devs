/**
 * Matt's problems cost money — plan 2026-10-16, phase 5 (fun-killers finding 05).
 *
 * The pure arithmetic is pinned in `revenue.test.ts` and `incidents.test.ts`.
 * This is the wiring: that the run books every refund on a named release, that
 * the books still balance, that Run 1 books none, and that a refunded dollar is
 * never cash and never prestige. Claims about where money goes, not how much.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, __setState, getState, tick } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { outstandingOf, rollShape, type Release } from '../sim/revenue.ts'

function prestiged(milestones: string[] = []) {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones } })
}

function onSale(id: number, payout: number, defectDensity = 0): Release {
  return { id, ordinal: id, name: `Game ${id}`, payout, age: 0, paid: 0, shape: rollShape(7, id), defectDensity, rating: 50 }
}

const refundedOn = (rs: readonly Release[]) => rs.reduce((a, r) => a + (r.refunded ?? 0), 0)
const balanced = (r: Release) => r.paid + (r.refunded ?? 0) + outstandingOf(r)

beforeEach(() => {
  __resetStore()
  prestiged()
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§4.12a — a downed release refunds while it is down', () => {
  it('books the bleed on the release the incident names, and nowhere else', () => {
    __setState({
      releases: [onSale(1, 1_000_000), onSale(2, 1_000_000)],
      incidents: [{ id: 1, releaseId: 2, releaseName: 'Game 2', age: 0, work: 1e6 }],
    })
    tick(1)
    const [up, down] = getState().releases
    expect(up.refunded ?? 0).toBe(0)
    expect(down.refunded ?? 0).toBeGreaterThan(0)
    expect(balanced(down)).toBeCloseTo(1_000_000, 4)
  })

  it('books none in Run 1, where nothing pages', () => {
    setPermanent(emptyPermanent())
    __setState({
      releases: [onSale(1, 1_000_000)],
      incidents: [{ id: 1, releaseId: 1, releaseName: 'Game 1', age: 0, work: 1e6 }],
    })
    tick(1)
    expect(refundedOn(getState().releases)).toBe(0)
  })
})

describe('§4.13 — the ticket tax is a logged refund, not a silent deletion', () => {
  it('books the taxed share on the release, and only the rest reaches the till', () => {
    __setState({ releases: [onSale(1, 1_000_000)], tickets: 1e9, cash: 0, lifetimeRevenue: 0 })
    tick(1)
    const s = getState()
    const r = s.releases[0]
    expect(r.refunded ?? 0).toBeGreaterThan(0)
    expect(balanced(r)).toBeCloseTo(1_000_000, 4)
    // What settled = what reached the till + what was refunded, and BP counts the till.
    expect(s.lifetimeRevenue).toBeCloseTo(r.paid, 6)
    expect(s.cash).toBeLessThanOrEqual(r.paid + 1e-6)
  })

  it('books no refund in Run 1, however deep the queue is', () => {
    setPermanent(emptyPermanent())
    __setState({ releases: [onSale(1, 1_000_000)], tickets: 1e9 })
    tick(1)
    expect(refundedOn(getState().releases)).toBe(0)
  })
})
