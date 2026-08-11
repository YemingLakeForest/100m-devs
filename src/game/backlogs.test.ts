/**
 * The three backlogs, wired — GDD §4.12, §4.12a, §4.13, §4.14.
 *
 * `defects.ts`, `incidents.ts` and `support.ts` are pure and tested on their
 * own. This is the other half: that the *run* actually charges them, that
 * shipping transfers a backlog rather than forgiving it, and that none of the
 * three can become the second seizure §4.12 forbids.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  catalogueRate,
  getState,
  hireDeveloper,
  poke,
  setHireRole,
  tick,
} from './store.ts'
import { BETA } from '../sim/defects.ts'
import { BASELINE_RATING } from '../sim/rating.ts'
import { countsOf, headcountOf } from '../sim/roles.ts'
import { INCIDENT_WORK_SECONDS } from '../sim/incidents.ts'

function play(seconds: number, pokesPerSecond = 0) {
  const dt = 1 / 30
  let owed = 0
  for (let t = 0; t < seconds; t += dt) {
    owed += pokesPerSecond * dt
    while (owed >= 1) {
      poke(0, 0, { rung: 0, index: 0 })
      owed -= 1
    }
    tick(dt)
  }
}

/**
 * Play until the first game goes on sale, and hand back the release itself.
 *
 * Not `play(n)` then `releases[0]`: §4.10e **retires** a release four minutes
 * after it ships and removes it from the catalogue, so a slow patient studio
 * that takes half an hour to burn 1,000 Story Points has no `releases[0]` by
 * the time it is asked. The record has to be taken while it exists.
 */
function playUntilShipped(pokesPerSecond = 0, limit = 4000) {
  const dt = 1 / 30
  let owed = 0
  for (let t = 0; t < limit; t += dt) {
    owed += pokesPerSecond * dt
    while (owed >= 1) {
      poke(0, 0, { rung: 0, index: 0 })
      owed -= 1
    }
    tick(dt)
    if (getState().releases.length > 0) return getState().releases[0]
  }
  throw new Error('nothing shipped')
}

beforeEach(() => __resetStore())

describe('§4.11 — the roster and the headcount are the same number', () => {
  it('starts empty, because there is no QA in a garage', () => {
    expect(getState().roster).toEqual([])
    expect(getState().devs).toBe(0)
  })

  /**
   * The invariant `hire` exists to keep. `devs` is read on every hot path and
   * the roster is the *shape* of it; if the two can disagree, `roleAtSeat`
   * silently reads seats past the end as developers and every share in §4.11 is
   * computed against the wrong denominator.
   */
  it('stays equal to devs through a run of mixed hires', () => {
    play(240, 4) // ship something, so there is money
    for (const role of ['dev', 'qa', 'sre', 'support', 'dev'] as const) {
      setHireRole(role)
      expect(hireDeveloper()).toBe(true)
      expect(headcountOf(getState().roster)).toBe(getState().devs)
    }
    const counts = countsOf(getState().roster)
    expect(counts.qa).toBe(1)
    expect(counts.sre).toBe(1)
    expect(counts.support).toBe(1)
    expect(counts.dev).toBe(2)
  })

  it('hires into the role the dial is set to, and never reassigns', () => {
    play(240, 4)
    setHireRole('qa')
    hireDeveloper()
    setHireRole('dev')
    hireDeveloper()
    // §4.11 — "a role is chosen at hire, not reassigned". The first seat is
    // still QA after a developer was hired above them; a four-counter roster
    // could not do this.
    expect(countsOf(getState().roster).qa).toBe(1)
  })
})

describe('§4.12 — defects accrue from the work itself', () => {
  it('charges nothing to a studio that has not done anything', () => {
    expect(getState().defects).toBe(0)
  })

  it('accrues while the studio works', () => {
    play(10)
    expect(getState().defects).toBeGreaterThan(0)
  })

  /**
   * §4.12: "§4.5's interruption is exactly how defects get written." A run of
   * the same length with a thumb on it must break more than one without.
   */
  it('breaks more when the player pokes', () => {
    play(20)
    const passive = getState().defects
    __resetStore()
    play(20, 5)
    expect(getState().defects).toBeGreaterThan(passive)
  })

  it('is suppressed by hiring QA', () => {
    play(240, 4)
    for (let i = 0; i < 6; i++) {
      setHireRole('qa')
      hireDeveloper()
    }
    const before = getState().defects
    play(20)
    const withQa = getState().defects - before

    __resetStore()
    play(240, 4)
    for (let i = 0; i < 6; i++) {
      setHireRole('dev')
      hireDeveloper()
    }
    const base = getState().defects
    play(20)
    expect(getState().defects - base).toBeGreaterThan(withQa)
  })
})

describe('§4.12 / §4.12a — shipping transfers the backlog, it does not forgive it', () => {
  it('clears the bench and stamps the release with what it went out at', () => {
    play(240, 4)
    const s = getState()
    expect(s.projectsShipped).toBeGreaterThanOrEqual(1)
    // The bench is clear the frame after a ship. It may have accrued a little
    // again since, so this is bounded rather than exactly zero.
    expect(s.defects).toBeLessThan(5)
    expect(s.releases[0].defectDensity).toBeGreaterThan(0)
  })

  /**
   * §4.12: "the faster you go, the more you break", and §4.14: defects
   * dominate. A game burned down by thumb ships worse than one that was left
   * to the passive rate, and the rating says so.
   */
  it('rates a hammered project below a patient one', () => {
    const hammered = playUntilShipped(8)
    __resetStore()
    const patient = playUntilShipped(0)

    expect(hammered.defectDensity).toBeGreaterThan(patient.defectDensity)
    expect(hammered.rating).toBeLessThan(patient.rating)
  })

  it('pays a patient studio the baseline it would have earned before any of this existed', () => {
    // §4.14.1's promise, end to end: a studio doing ordinary uninterrupted work
    // ships at exactly β, scores exactly the baseline, and every multiplier is
    // ×1. Approximate rather than exact because the burn-down overshoots the
    // commitment by a fraction of a tick's work.
    const first = playUntilShipped(0)
    expect(first.defectDensity).toBeCloseTo(BETA, 3)
    expect(first.rating).toBeCloseTo(BASELINE_RATING, 0)
  })
})

describe('§4.12a — the catalogue pages you, and a page is a freeze', () => {
  it('takes a downed release out of the income readout', () => {
    play(240, 4)
    const before = catalogueRate()
    expect(before).toBeGreaterThan(0)

    const s = getState()
    s.incidents.push({
      id: 1,
      releaseId: s.releases[0].id,
      releaseName: s.releases[0].name,
      age: 0,
      work: INCIDENT_WORK_SECONDS,
    })
    expect(catalogueRate()).toBeLessThan(before)
  })

  /**
   * The reason a page is a freeze rather than a deletion: §4.10e's invariant is
   * that a release pays its ladder payout to the cent, and a mechanic that
   * destroyed tail revenue would break it. Frozen, the release does not age —
   * so the money is delayed, not lost, and the cost lands in runway.
   */
  it('does not age a frozen release', () => {
    play(240, 4)
    const s = getState()
    const release = s.releases[0]
    s.incidents.push({
      id: 1,
      releaseId: release.id,
      releaseName: release.name,
      age: 0,
      work: 1e9,
    })
    const ageBefore = release.age
    const paidBefore = release.paid
    play(30)
    const after = getState().releases.find((r) => r.id === release.id)
    expect(after?.age).toBe(ageBefore)
    expect(after?.paid).toBe(paidBefore)
  })

  /**
   * §4.12's standing warning: "nothing here may become a fail state that stops
   * the clicker". With no SRE at all, clearance capacity would be zero and a
   * frozen release would never come back — so §13.7.1's founder carries the
   * pager, and this is the test that says an incident always ends.
   */
  it('always ends, even with nobody on the rota', () => {
    play(240, 4)
    const s = getState()
    expect(countsOf(s.roster).sre).toBe(0)
    s.incidents.push({
      id: 1,
      releaseId: s.releases[0].id,
      releaseName: s.releases[0].name,
      age: 0,
      work: INCIDENT_WORK_SECONDS,
    })
    play(INCIDENT_WORK_SECONDS * 10)
    expect(getState().incidents).toHaveLength(0)
  })
})

describe('§4.13 — the tickets do not stop, and never stop the game', () => {
  it('leaves a garage alone, because the founder answers the email', () => {
    play(240, 4)
    // One shipped game is 0.1 tickets a second against the founder's 0.4 heads.
    // A catalogue of one has not outgrown anybody.
    expect(getState().tickets).toBeCloseTo(0, 6)
  })

  it('taxes the catalogue and never the ship, however deep the queue', () => {
    play(240, 4)
    const s = getState()
    // A queue no studio could ever answer.
    s.tickets = 1e9
    const taxed = catalogueRate()
    expect(taxed).toBeGreaterThan(0)
    // §4.13's floor: mild, and never zero. A harsh tax would make "stop
    // shipping" the correct play, which inverts the whole game.
    s.tickets = 0
    expect(taxed / catalogueRate()).toBeGreaterThan(0.5)
  })
})

describe('§4.14 — reputation is a fact about this studio', () => {
  it('opens at the baseline rather than at zero', () => {
    expect(getState().reputation).toBe(BASELINE_RATING)
  })

  it('moves toward what the studio actually ships', () => {
    play(240, 8)
    const s = getState()
    expect(s.reputation).toBeLessThan(BASELINE_RATING)
    expect(s.reputation).toBeGreaterThan(s.releases[0].rating)
  })
})
