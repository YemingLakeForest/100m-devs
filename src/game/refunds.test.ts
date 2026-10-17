/**
 * Matt's problems cost money — plan 2026-10-16, phase 5 (fun-killers finding 05).
 *
 * The pure arithmetic is pinned in `revenue.test.ts` and `incidents.test.ts`.
 * This is the wiring: that the run books every refund on a named release, that
 * the books still balance, that Run 1 books none, and that a refunded dollar is
 * never cash and never prestige. Claims about where money goes, not how much.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  answerTickets,
  getState,
  patchIncident,
  refundIncident,
  releaseNow,
  tick,
} from './store.ts'
import { BASELINE_RATING, refundShare } from '../sim/rating.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { outstandingOf, rollShape, type Release } from '../sim/revenue.ts'
import { PATCH_SECONDS, REFUND_MOVE_ON_SHARE } from '../sim/incidents.ts'

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

describe('§4.15 — the player can do something about it', () => {
  const pageOn = (id: number, work = 45) => ({ id, releaseId: id, releaseName: `Game ${id}`, age: 0, work })

  it('PATCH takes work off the incident it names, and closes it at zero', () => {
    __setState({ releases: [onSale(1, 1_000)], incidents: [pageOn(1, PATCH_SECONDS * 1.5)] })
    expect(patchIncident(1)).toBe(true)
    expect(getState().incidents[0].work).toBeCloseTo(PATCH_SECONDS * 0.5, 9)
    expect(patchIncident(1)).toBe(true)
    expect(getState().incidents).toEqual([])
    expect(patchIncident(1)).toBe(false)
  })

  it('REFUND & MOVE ON closes it at once and books the quarter on that release', () => {
    __setState({ releases: [onSale(1, 1_000), onSale(2, 1_000)], incidents: [pageOn(2)] })
    expect(refundIncident(2)).toBe(true)
    const [one, two] = getState().releases
    expect(getState().incidents).toEqual([])
    expect(one.refunded ?? 0).toBe(0)
    expect(two.refunded).toBeCloseTo(1_000 * REFUND_MOVE_ON_SHARE, 9)
    expect(balanced(two)).toBeCloseTo(1_000, 9)
  })

  it('patching by hand costs less than leaving it to the founder', () => {
    const run = (taps: boolean) => {
      __resetStore()
      prestiged()
      __setState({ releases: [onSale(1, 1_000_000)], incidents: [pageOn(1)] })
      for (let t = 0; t < 120 && getState().incidents.length > 0; t += 0.25) {
        if (taps) patchIncident(1)
        tick(0.25)
      }
      return refundedOn(getState().releases)
    }
    expect(run(true)).toBeLessThan(run(false))
  })

  it('a tap on the ticket bar answers tickets, and does nothing with an empty queue', () => {
    __setState({ releases: [onSale(1, 1_000)], projectsShipped: 50, tickets: 1_000 })
    expect(answerTickets()).toBe(true)
    expect(getState().tickets).toBeLessThan(1_000)
    __setState({ tickets: 0 })
    expect(answerTickets()).toBe(false)
  })

  it('refuses every verb while a scene has the clock stopped', () => {
    __setState({ releases: [onSale(1, 1_000)], incidents: [pageOn(1)], tickets: 10, launching: true })
    expect(patchIncident(1)).toBe(false)
    expect(refundIncident(1)).toBe(false)
    expect(answerTickets()).toBe(false)
  })
})

describe('§4.14 — a bad review refunds at launch', () => {
  const rushed = {
    id: 1, ordinal: 1, name: 'Rushed', genre: 'roguelike', projectIndex: 3, revenueBase: 100_000,
    size: 300, defects: 3_000, density: 10, graded: true, heroCoverage: 0, sync: 0, traits: 0, luck: 0,
    buildSeconds: 30, labourSeconds: 30, shelvedAt: 0,
  }

  it('books the review refund on the release the moment it goes on sale', () => {
    __setState({ shelf: [rushed] as unknown as ReturnType<typeof getState>['shelf'] })
    releaseNow()
    const r = getState().releases[0]
    expect(r.rating).toBeLessThan(BASELINE_RATING)
    expect(r.refunded).toBeCloseTo(r.payout * refundShare(r.rating), 6)
    expect(balanced(r)).toBeCloseTo(r.payout, 6)
  })

  it('books none in Run 1', () => {
    setPermanent(emptyPermanent())
    __setState({ shelf: [rushed] as unknown as ReturnType<typeof getState>['shelf'] })
    releaseNow()
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
