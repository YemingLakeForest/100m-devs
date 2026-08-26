/**
 * The three backlogs, wired — GDD §4.12, §4.12a, §4.13, §4.14.
 *
 * `defects.ts`, `incidents.ts` and `support.ts` are pure and tested on their
 * own. This is the other half: that the *run* actually charges them, that
 * shipping transfers a backlog rather than forgiving it, and that none of the
 * three can become the second seizure §4.12 forbids.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  catalogueRate,
  dismissScene,
  getState,
  hireDeveloper,
  poke,
  setHireRole,
  tick,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { BETA } from '../sim/defects.ts'
import { BASELINE_RATING, RATING_WEIGHTS, rateRelease } from '../sim/rating.ts'
import { countsOf, headcountOf } from '../sim/roles.ts'
import { INCIDENT_WORK_SECONDS } from '../sim/incidents.ts'

/**
 * §21.7 — a scene stops the world, so the harness has to tap through it.
 *
 * `poke` is deliberately inert while a scene is up (the dialogue box is eating
 * those taps for its own advance), so a test that pokes through Act I without
 * dismissing James's arrival simply stops making progress. Dismissing on sight
 * is what a player does; not doing it was the harness pretending scenes did not
 * exist.
 */
function clearScene() {
  if (getState().scene !== null) dismissScene()
}

function play(seconds: number, pokesPerSecond = 0) {
  const dt = 1 / 30
  let owed = 0
  for (let t = 0; t < seconds; t += dt) {
    clearScene()
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
    clearScene()
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

/**
 * §21.0c — **every test in this file is about a studio that has prestiged.**
 *
 * The three backlogs do not exist during Run 1: no defect accrues, no incident
 * is raised, no ticket arrives, and shipping stamps §4.14.1's anchor rather than
 * grading anything. That is the design and it is asserted at the bottom of this
 * file — so the rest of it, which is about how the three behave once they *do*
 * exist, has to say which run it is playing.
 *
 * Set in a `beforeEach` rather than per test because the alternative is one line
 * of setup repeated nineteen times and forgotten on the twentieth, and the
 * symptom of forgetting is a test that passes by measuring zero against zero.
 */
function prestiged() {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
}

/**
 * Start over, still on Run 2.
 *
 * `__resetStore` clears **permanent** state as well as the run — it is the
 * harness's "forget this player ever existed" — so a test that resets in the
 * middle of itself silently drops back to Run 1 and then measures zero against
 * zero. Every mid-test reset in this file goes through here.
 */
function reset() {
  __resetStore()
  prestiged()
}

beforeEach(reset)

afterEach(() => setPermanent(emptyPermanent()))

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
    // Three, not two: §21.0b's James is a free `dev` hire during Act I, so the
    // studio already had one before the loop above hired any.
    expect(counts.dev).toBe(3)
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
    reset()
    play(20, 5)
    expect(getState().defects).toBeGreaterThan(passive)
  })

  /**
   * The store-level half of the QA curve: that the **roster's** share reaches
   * §4.12's accrual at all. `defects.test.ts` already pins the curve's shape;
   * what can only be wrong here is the wiring.
   *
   * Measured over a short window with a ship guard, because shipping zeroes the
   * bench (§4.12 transfers the backlog rather than forgiving it) — a window that
   * straddles a ship measures a *negative* delta and says nothing about QA.
   */
  it('is suppressed by hiring QA', () => {
    function accrualOver(role: 'qa' | 'dev'): number {
      reset()
      play(240, 4)
      for (let i = 0; i < 6; i++) {
        setHireRole(role)
        hireDeveloper()
      }
      const shippedBefore = getState().projectsShipped
      const before = getState().defects
      play(3)
      expect(getState().projectsShipped).toBe(shippedBefore)
      return getState().defects - before
    }

    const withQa = accrualOver('qa')
    const withDevs = accrualOver('dev')
    expect(withQa).toBeGreaterThan(0)
    expect(withDevs).toBeGreaterThan(withQa)
  })
})

describe('§4.12 / §4.12a — shipping transfers the backlog, it does not forgive it', () => {
  it('clears the bench and stamps the release with what it went out at', () => {
    // `playUntilShipped` returns on the very tick the release appears, so the
    // bench holds at most one frame's accrual — anything more would mean the
    // transfer had not happened.
    const release = playUntilShipped(4)
    const carried = release.defectDensity * getState().releases[0].payout

    expect(release.defectDensity).toBeGreaterThan(0)
    expect(carried).toBeGreaterThan(0)
    // What left with the game is orders of magnitude more than what stayed.
    expect(getState().defects).toBeLessThan(release.defectDensity * 1000 * 0.02)
  })

  /**
   * §4.12: "the faster you go, the more you break", and §4.14: defects
   * dominate. A game burned down by thumb ships worse than one that was left
   * to the passive rate, and the rating says so.
   */
  it('rates a hammered project below a patient one', () => {
    const hammered = playUntilShipped(8)
    reset()
    const patient = playUntilShipped(0)

    expect(hammered.defectDensity).toBeGreaterThan(patient.defectDensity)
    expect(hammered.rating).toBeLessThan(patient.rating)
  })

  it('pays a patient studio the baseline it would have earned before any of this existed', () => {
    /*
     * §4.14.1's promise, end to end — restated for the six-input rating.
     *
     * The original claim was that a studio doing ordinary uninterrupted work
     * ships at exactly β and scores exactly the baseline. **The first half is
     * still exact and is the half that is load-bearing**: β is what calibrates
     * the whole defect economy, and the assertion below is unchanged.
     *
     * The score is no longer exact, and that is the point of §4.14's added
     * inputs rather than a regression in them. This studio is not a garage. It
     * has hired, so §4.1's efficiency is under 1 and `teamSync` says so; and its
     * release drew a reception, which is a fact about the run seed. Demanding
     * the baseline back would mean demanding that neither term did anything.
     *
     * So what is pinned is that the *departure is small and is attributable*:
     * the release scores within the band the two uncontrolled terms can move it
     * — sync and luck together — and re-scoring the same release with a
     * garage's sync and an average reception lands back on the baseline
     * exactly, which is the original promise with the two new terms held still.
     */
    const first = playUntilShipped(0)
    expect(first.defectDensity).toBeCloseTo(BETA, 3)

    const swing = (RATING_WEIGHTS.sync + RATING_WEIGHTS.luck) * 100
    expect(Math.abs(first.rating - BASELINE_RATING)).toBeLessThan(swing / 2)

    // The same release, with the terms this studio does not control held at a
    // garage's values. `craft: 1` and `heroCoverage: 0` are what `shipProject`
    // passed; `sync` and `luck` are omitted, so they default to the garage.
    expect(
      rateRelease({
        defects: first.defectDensity * 1000,
        storyPoints: 1000,
        heroCoverage: 0,
        craft: 1,
      }),
    ).toBeCloseTo(BASELINE_RATING, 0)
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
    // **Played to the catalogue, not to a stopwatch.** This said `play(240, 4)`
    // and asserted on "one shipped game", and the two agreed only by accident:
    // §4.10f split the garage into three short rungs, four minutes started
    // shipping four or five games instead of one, and the test failed for the
    // entirely correct reason that a five-game catalogue *has* outgrown one
    // founder. The subject is a garage, so the setup has to be a garage.
    playUntilShipped(4)
    expect(getState().releases.length).toBe(1)
    // One shipped game is 0.1 tickets a second against the founder's 0.4 heads.
    // A catalogue of one has not outgrown anybody.
    play(60)
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

/**
 * §22.3 — **LOYAL: never quits when poked.**
 *
 * A live bug, not a hypothetical: `dev` is one studio-wide state machine, so it
 * can enter `tenx` while the studio *is* James — and a poke then cashed him
 * out, leaving Act I with zero developers, a phase machine already past the
 * beat that grants him, and no way back. It reproduced intermittently, because
 * whether the machine is in `tenx` on the frame the player taps is a real dice
 * roll, so it is pinned deterministically here.
 */
describe('§22.3 — James does not quit', () => {
  it('survives being poked in the state that cashes everybody else out', () => {
    play(30, 4)
    expect(getState().devs).toBe(1)

    for (let i = 0; i < 50; i++) {
      __setState({ dev: { state: 'tenx', elapsed: 0 } })
      poke(0, 0, { rung: 0, index: 0 })
      expect(getState().devs).toBe(1)
      expect(headcountOf(getState().roster)).toBe(1)
    }
  })

  it('does not make everybody else immortal', () => {
    play(240, 4)
    setHireRole('dev')
    hireDeveloper()
    const before = getState().devs
    expect(before).toBe(2)

    __setState({ dev: { state: 'tenx', elapsed: 0 } })
    // Seat 1 is not James, and the 10x cash-out is a real mechanic.
    poke(0, 0, { rung: 0, index: 1 })
    expect(getState().devs).toBe(before - 1)
    expect(headcountOf(getState().roster)).toBe(before - 1)
  })
})

/**
 * §21.0c — **none of the above happens during Run 1.**
 *
 * Everything else in this file runs with `paradigmShifts: 1`, because everything
 * else in this file is about a system Run 1 does not have. This block is the
 * other half of that sentence, and it is the half worth pinning: the three
 * backlogs were built, wired and shipped straight into Act I, where a defect
 * counter appeared beside a hire dial offering a job the player could not take.
 *
 * Asserted against the **simulation**, not the HUD. Hiding a readout whose
 * number is climbing behind it would leave the player's Run 1 quietly taxed by a
 * ticket queue they were never shown, which is worse than showing it.
 */
describe('§21.0c — the first run has one lever', () => {
  beforeEach(() => {
    __resetStore()
    setPermanent(emptyPermanent())
  })

  it('breaks nothing, however hard the player hammers it', () => {
    play(240, 8)
    expect(getState().defects).toBe(0)
    expect(getState().incidents).toEqual([])
    expect(getState().tickets).toBe(0)
  })

  it('ships at exactly the baseline, so §21 is paced against the economy it was tuned for', () => {
    // Not "the bench is empty so the rating is high" — that is the bug this
    // guards. A bench of zero scores *better* than §4.14.1's anchor, so a Run 1
    // that ran the live rating would hand every release a quality bonus and
    // quietly re-tune Act II's money.
    const first = playUntilShipped(8)
    expect(first.defectDensity).toBeCloseTo(BETA, 6)
    expect(first.rating).toBeCloseTo(BASELINE_RATING, 6)
    expect(getState().reputation).toBe(BASELINE_RATING)
  })

  it('never taxes the catalogue, because nobody has written in', () => {
    play(240, 4)
    const s = getState()
    expect(s.releases.length).toBeGreaterThan(0)
    // §4.13's tax is `catalogueMultiplier`, which is 1 at parity. The point here
    // is that the queue it reads is not merely small but absent.
    expect(s.tickets).toBe(0)
    expect(catalogueRate()).toBeGreaterThan(0)
  })

  it('opens the backlogs the moment the player prestiges', () => {
    // The gate is a real gate rather than a permanent deletion: the same store,
    // the same play, one prestige apart.
    play(60, 8)
    expect(getState().defects).toBe(0)

    prestiged()
    play(10, 8)
    expect(getState().defects).toBeGreaterThan(0)
  })
})
