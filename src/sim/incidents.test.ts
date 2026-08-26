import { describe, expect, it } from 'vitest'
import {
  INCIDENTS_PER_GARAGE_RELEASE,
  INCIDENT_HALVING_SRE_SHARE,
  INCIDENT_WORK_SECONDS,
  IOTA,
  advanceIncidents,
  audienceShare,
  clearanceCapacity,
  incidentRate,
  incidentSuppression,
  lifetimeIncidents,
  suppressedReleases,
  type Incident,
} from './incidents.ts'
import { BETA } from './defects.ts'
import { advanceTail, rollShape, type Release } from './revenue.ts'

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
      for (let t = 0; t < 300; t += dt) {
        total += incidentRate(releases, densities, 0) * dt
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

describe('§4.12a.1 — SRE bend the arrival rate', () => {
  it('is 1 with nobody on it, exactly half at the halving share, never zero', () => {
    expect(incidentSuppression(0)).toBe(1)
    expect(incidentSuppression(INCIDENT_HALVING_SRE_SHARE)).toBeCloseTo(0.5, 12)
    expect(incidentSuppression(1)).toBeGreaterThan(0)
  })

  it('needs far fewer SRE than QA to matter — the gap is the design', () => {
    expect(INCIDENT_HALVING_SRE_SHARE).toBeLessThan(0.25)
  })
})

describe('§4.12a — the catalogue pages you, unreleased work never does', () => {
  it('raises nothing from an empty catalogue', () => {
    expect(incidentRate([], new Map(), 0)).toBe(0)
  })

  it('raises nothing from a release that shipped clean', () => {
    expect(incidentRate([release(1)], new Map([[1, 0]]), 0)).toBe(0)
  })

  it('weights by audience, so a fresh hit pages harder than an old one', () => {
    const densities = new Map([[1, BETA]])
    const fresh = incidentRate([release(1, 1_000, 0)], densities, 0)
    const old = incidentRate([release(1, 1_000, 120)], densities, 0)
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
    expect(incidentRate([release(1)], densities, 0, new Set([1]))).toBe(0)
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
