import { describe, expect, it } from 'vitest'
import {
  INCIDENTS_PER_GARAGE_RELEASE,
  INCIDENT_KEEP_FLOOR,
  INCIDENT_REFUND_PER_SEC,
  INCIDENT_WORK_SECONDS,
  IOTA,
  advanceIncidents,
  audienceShare,
  bleedDowned,
  clearanceCapacity,
  incidentBleedRate,
  incidentBleedShare,
  incidentRate,
  incidentTarget,
  lifetimeIncidents,
  suppressedReleases,
  type Incident,
} from './incidents.ts'
import { BETA } from './defects.ts'
import { RETIRE_AFTER_SECONDS, advanceTail, outstandingOf, rollShape, type Release } from './revenue.ts'

function release(id: number, payout = 1_000, age = 0): Release {
  return { id, ordinal: id, name: `Game ${id}`, payout, age, paid: 0, shape: rollShape(1234, id), defectDensity: 0, rating: 50 }
}

describe('§4.12a — ι is anchored to the tail, not chosen', () => {
  it('is the stated page count over β, so the sentence survives a retune of β', () => {
    expect(IOTA).toBeCloseTo(INCIDENTS_PER_GARAGE_RELEASE / BETA, 12)
  })

  /**
   * The sentence the whole file is arranged around: **a release shipped at the
   * garage density raises one incident over its entire lifetime, with no SRE.**
   *
   * Asserted by integration rather than by algebra, because what makes it true
   * is a property of §4.10e's normalised pair — `∫ a_r dt = 1` whatever shape
   * was rolled — and a change to the revenue curve is precisely the change that
   * would silently break it.
   *
   * **It lands a little under 1, and the shortfall is the right shortfall.**
   * §4.10e retires a release at `RETIRE_AFTER_SECONDS` and hands over the
   * asymptote's remainder as a lump — deliberately sized at "under one per
   * cent". `earningRate` is zero past that horizon, so the audience integral is
   * truncated in exactly the same place and by exactly the same fraction as the
   * money is. That is the behaviour to want: **ι's anchor and the economy's
   * books share one horizon**, and a release cannot page you after it has gone
   * off sale. The bound below is the retirement remainder, not slack in the
   * derivation.
   */
  it('raises the stated page count over a garage release lifetime, less the retirement remainder', () => {
    for (const seed of [1, 7, 99, 40_000]) {
      let releases: Release[] = [{ ...release(1), shape: rollShape(seed, 1) }]
      const densities = new Map([[1, BETA]])
      let total = 0
      const dt = 0.05
      // Past RETIRE_AFTER_SECONDS, so the whole tracked life is covered.
      for (let t = 0; t < RETIRE_AFTER_SECONDS + 30; t += dt) {
        total += incidentRate(releases, densities) * dt
        releases = advanceTail(releases, dt).releases
      }
      expect(total).toBeLessThanOrEqual(INCIDENTS_PER_GARAGE_RELEASE)
      expect(total).toBeGreaterThan(INCIDENTS_PER_GARAGE_RELEASE * 0.99)
    }
  })

  it('scales that count linearly with the density shipped', () => {
    expect(lifetimeIncidents(BETA)).toBeCloseTo(INCIDENTS_PER_GARAGE_RELEASE, 12)
    expect(lifetimeIncidents(BETA / 2)).toBeCloseTo(INCIDENTS_PER_GARAGE_RELEASE / 2, 12)
    expect(lifetimeIncidents(0)).toBe(0)
  })

  it('halves the pager load when the studio halves its defect density', () => {
    // The causal chain §4.12a exists to draw, stated as a test.
    expect(lifetimeIncidents(0.04)).toBeCloseTo(2 * lifetimeIncidents(0.02), 12)
  })
})

describe('§4.12a — the catalogue pages you, unreleased work never does', () => {
  it('raises nothing from an empty catalogue', () => {
    expect(incidentRate([], new Map())).toBe(0)
  })

  it('raises nothing from a release that shipped clean', () => {
    expect(incidentRate([release(1)], new Map([[1, 0]]))).toBe(0)
  })

  it('weights by audience, so a fresh hit pages harder than an old one', () => {
    const densities = new Map([[1, BETA]])
    const fresh = incidentRate([release(1, 1_000, 0)], densities)
    const old = incidentRate([release(1, 1_000, 120)], densities)
    expect(fresh).toBeGreaterThan(old)
  })

  it('a release that earned nothing has no audience and cannot page anybody', () => {
    expect(audienceShare(release(1, 0))).toBe(0)
  })

  /**
   * A release already down is not being played — its tail has stopped — so it
   * is excluded from the rate. Without this one bad game produces an unbounded
   * queue of incidents about itself while nobody can reach it.
   */
  it('does not page about a game that is already off sale', () => {
    const densities = new Map([[1, BETA]])
    expect(incidentRate([release(1)], densities, new Set([1]))).toBe(0)
  })
})

describe('advanceIncidents', () => {
  const candidates = [
    { id: 1, name: 'Flappy Square' },
    { id: 2, name: 'Calculator Pro' },
  ]

  it('carries the fractional arrival rather than flooring it away every tick', () => {
    // 0.3/s at 60fps floors to zero on every individual step. The carry is what
    // stops a real arrival rate producing no incidents at all.
    let pending = 0
    let incidents: Incident[] = []
    let id = 1
    for (let i = 0; i < 600; i++) {
      const step = advanceIncidents(incidents, 0.3, 0, 1 / 60, pending, id, candidates)
      incidents = step.incidents
      pending = step.pending
      id += step.incidents.length - incidents.length + 1
      id = Math.max(id, incidents.length + 1)
    }
    expect(incidents.length).toBeGreaterThan(0)
  })

  it('raises at most one incident per release', () => {
    const step = advanceIncidents([], 100, 0, 1, 0, 1, candidates)
    expect(step.incidents).toHaveLength(2)
    expect(suppressedReleases(step.incidents)).toEqual(new Set([1, 2]))
  })

  it('lets Serena’s runbook open a new incident half worked', () => {
    const step = advanceIncidents([], 1, 0, 1, 0, 1, candidates, 0.5)
    expect(step.incidents[0].work).toBeCloseTo(INCIDENT_WORK_SECONDS / 2, 9)
  })

  it('drops the carry when there is nothing to page about', () => {
    const step = advanceIncidents([], 100, 0, 1, 0, 1, [])
    expect(step.incidents).toHaveLength(0)
    expect(step.pending).toBe(0)
  })

  it('closes an incident once SRE have spent the work on it, and says which release is back', () => {
    const open = advanceIncidents([], 1, 0, 1, 0, 1, candidates).incidents
    expect(open).toHaveLength(1)

    const worked = advanceIncidents(open, 0, clearanceCapacity(1), INCIDENT_WORK_SECONDS, 0, 2, candidates)
    expect(worked.incidents).toHaveLength(0)
    expect(worked.cleared).toBe(1)
    expect(worked.restored).toEqual([open[0].releaseId])
  })

  /**
   * Oldest first. A queue worked newest-first buries one release forever while
   * the others cycle, which reads as a bug in the game rather than as a bug in
   * the game the player shipped.
   */
  it('works the queue oldest first', () => {
    const raised = advanceIncidents([], 100, 0, 1, 0, 1, candidates).incidents
    const aged = raised.map((i, n) => ({ ...i, age: 100 - n * 10 }))
    const step = advanceIncidents(aged, 0, clearanceCapacity(1), INCIDENT_WORK_SECONDS, 0, 3, candidates)
    expect(step.cleared).toBe(1)
    expect(step.incidents[0].releaseId).toBe(aged[1].releaseId)
  })

  it('a zero step changes nothing', () => {
    const open = advanceIncidents([], 1, 0, 1, 0, 1, candidates).incidents
    const step = advanceIncidents(open, 5, 5, 0, 0.4, 9, candidates)
    expect(step.incidents).toBe(open)
    expect(step.pending).toBe(0.4)
    expect(step.cleared).toBe(0)
  })
})

/**
 * §4.12a [amended 2026-10-16] — the page lands where the damage is, and a
 * downed game refunds. Orders and floors, not dollar figures.
 */
describe('§4.12a — incidents aim at d·a and bleed refunds', () => {
  const aged = (r: Release, t: number) => advanceTail([r], t).releases[0]

  it('raises the page on the release with the largest d·a, not the oldest', () => {
    const old = aged({ ...release(1), defectDensity: BETA }, 200)
    const fresh = aged({ ...release(2), defectDensity: BETA }, 2)
    const clean = aged({ ...release(3), defectDensity: 0 }, 1)
    expect(incidentTarget([old, fresh, clean])?.id).toBe(2)
    // A rushed launch outranks a clean one at the same age.
    const rushed = aged({ ...release(4), defectDensity: 3 * BETA }, 2)
    expect(incidentTarget([fresh, rushed])?.id).toBe(4)
    const step = advanceIncidents([], 1, 0, 1, 0, 1, [old, fresh, clean])
    expect(step.incidents[0].releaseId).toBe(2)
  })

  it('skips a release that is already down, and keeps catalogue order when nothing can be weighed', () => {
    const a = aged({ ...release(1), defectDensity: BETA }, 2)
    const b = aged({ ...release(2), defectDensity: BETA }, 50)
    expect(incidentTarget([a, b], new Set([1]))?.id).toBe(2)
    expect(incidentTarget([{ id: 8, name: 'x' }, { id: 9, name: 'y' }])?.id).toBe(8)
  })

  it('bleeds a downed release into its refunds, books balanced, and never below the floor', () => {
    let live = [aged(release(1, 10_000), 5)]
    const open: Incident[] = [{ id: 1, releaseId: 1, releaseName: 'Game 1', age: 0, work: 45 }]
    let refunded = 0
    let last = Infinity
    for (let t = 0; t < 600; t += 0.5) {
      const step = bleedDowned(live, open, 0.5)
      live = step.releases
      refunded += step.refunded
      const r = live[0]
      expect(r.paid + (r.refunded ?? 0) + outstandingOf(r)).toBeCloseTo(10_000, 6)
      expect(r.keep ?? 1).toBeGreaterThanOrEqual(INCIDENT_KEEP_FLOOR - 1e-12)
      expect(incidentBleedRate(r)).toBeLessThanOrEqual(last)
      last = incidentBleedRate(r)
    }
    expect(refunded).toBeGreaterThan(0)
    // At the floor it stops: no rate, no further refund.
    expect(incidentBleedRate(live[0])).toBe(0)
    expect(bleedDowned(live, open, 10).refunded).toBe(0)
  })

  it('touches nothing that is not down', () => {
    const live = [aged(release(1), 5), aged(release(2), 5)]
    const step = bleedDowned(live, [{ id: 1, releaseId: 2, releaseName: 'Game 2', age: 0, work: 45 }], 1)
    expect(step.releases[0]).toBe(live[0])
    expect(step.releases[1].refunded ?? 0).toBeGreaterThan(0)
  })

  it('a longer outage costs more, and the share per second is the stated one', () => {
    expect(incidentBleedShare(1, 1)).toBeCloseTo(1 - Math.exp(-INCIDENT_REFUND_PER_SEC), 12)
    expect(incidentBleedShare(1, 20)).toBeGreaterThan(incidentBleedShare(1, 10))
    expect(incidentBleedShare(INCIDENT_KEEP_FLOOR, 10)).toBe(0)
  })
})
