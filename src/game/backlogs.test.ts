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
  oncallHeads,
  poke,
  shipEverything,
  supportHeads,
  tick,
  workingDevs,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { BETA } from '../sim/defects.ts'
import { BASELINE_RATING, RATING_WEIGHTS, rateRelease } from '../sim/rating.ts'
import { FOUNDER_ROLE_HEADS } from '../sim/founder.ts'
import { HELPDESK_SHARE, ONCALL_SHARE } from '../sim/heroRoster.ts'
import { SCENE_MATT_ARRIVES, SCENE_SERENA_ARRIVES } from './scenes.ts'
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

/**
 * §10.8b — answer the launch, the way a player does.
 *
 * A finished build is shelved rather than shipped, and the shelf halts `tick`
 * until somebody picks a release date. The window's own timeout is on the wall
 * clock (it has to be — `?speed` would otherwise compress a decision), so a
 * harness that pumps the simulation faster than real time will never reach it
 * and would sit on the first finished project for ever. Pressing the button is
 * what a player does, and it is what these loops do.
 *
 * The neutral date, deliberately: `releaseNow` with nothing locked pays ×1, so
 * every figure in this file is the figure it was before the window existed.
 */
function answerLaunch() {
  shipEverything()
}

/**
 * Somebody at a desk — §4.5d [amended 2026-08-30].
 *
 * The founder's passive trickle is gated on the studio having hired somebody:
 * before the first employee the burn-down moves only on a tap, which is exactly
 * what §21.7.1's `NO TAPPING REQUIRED.` announces the end of. So a harness that
 * neither hires nor pokes now runs a studio with nobody in it, and a studio
 * with nobody in it correctly produces nothing — which is not what the three
 * tests below are measuring.
 *
 * One head, seated rather than bought. `UNPAID_FOUNDERS` is 1, so the first
 * developer draws no wage and the economy under test is the one it always was.
 */
function staff(count = 1) {
  __setState({ devs: count })
}

function play(seconds: number, pokesPerSecond = 0) {
  const dt = 1 / 30
  let owed = 0
  for (let t = 0; t < seconds; t += dt) {
    clearScene()
    answerLaunch()
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
    answerLaunch()
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
function prestiged(milestones: string[] = []) {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones } })
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

/**
 * §4.11 [amended 2026-09-26] — **one kind of hire.** *"Some mechanics in the old
 * game I want remove, hero placement, different types of hires (SRE QA ETC."*
 * The pager and the inbox went to the heroes whose job they always were.
 */
describe('§4.11 — every hire is a developer', () => {
  it('puts every head on the floor at a desk that codes', () => {
    play(240, 4) // ship something, so there is money
    const before = workingDevs()
    expect(hireDeveloper()).toBe(true)
    expect(workingDevs()).toBeGreaterThan(before)
  })

  it('leaves the pager and the inbox to the founder until Serena and Matt arrive', () => {
    staff(200)
    tick(1 / 30)
    expect(oncallHeads()).toBe(FOUNDER_ROLE_HEADS)
    expect(supportHeads()).toBe(FOUNDER_ROLE_HEADS)
  })

  it('puts a share of the floor on call with Serena, and on the help desk with Matt', () => {
    prestiged([SCENE_SERENA_ARRIVES.id, SCENE_MATT_ARRIVES.id])
    staff(200)
    tick(1 / 30)
    expect(oncallHeads()).toBeCloseTo(FOUNDER_ROLE_HEADS + 200 * ONCALL_SHARE, 9)
    expect(supportHeads()).toBeCloseTo(FOUNDER_ROLE_HEADS + 200 * HELPDESK_SHARE, 9)
  })
})

describe('§4.12 — defects accrue from the work itself', () => {
  it('charges nothing to a studio that has not done anything', () => {
    expect(getState().defects).toBe(0)
  })

  it('accrues while the studio works', () => {
    staff()
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
    /*
     * **The same reception for both**, which is what makes this a comparison.
     *
     * §4.14's luck is `luckRoll(runSeed, ordinal)` and it is worth up to
     * `RATING_WEIGHTS.luck` — twelve points of a hundred, against a defect gap
     * of a few. Two studios rolled from two `Date.now()` seeds were therefore
     * being asked to prove a claim about defects using a term that has nothing
     * to do with defects, and it held only while the seeds happened to be kind.
     * Both studios ship their first release, so one shared seed is one shared
     * roll and the difference left is the one the section is about.
     */
    const seed = 0x5eed
    __setState({ runSeed: seed })
    staff()
    const hammered = playUntilShipped(8)
    reset()
    __setState({ runSeed: seed })
    staff()
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
    staff()
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
   * the clicker". Before Serena there is nobody on the rota, and clearance
   * capacity would be zero and a frozen release would never come back — so
   * §13.7.1's founder carries the pager, and this is the test that says an
   * incident always ends.
   */
  it('always ends, even with nobody on the rota', () => {
    play(240, 4)
    const s = getState()
    expect(oncallHeads()).toBe(FOUNDER_ROLE_HEADS)
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
    expect(s.releases.length).toBeGreaterThan(0)
    // It has left the baseline, in the direction of the work.
    expect(s.reputation).toBeLessThan(BASELINE_RATING)

    // **And it has moved toward the mean of what shipped**, which is the whole
    // of §4.14's claim about an EMA.
    //
    // This used to assert `reputation > releases[0].rating`, which held only
    // because the run was deterministic: it assumed the *first* release was the
    // worst, so the average could never fall past it. §7.8.9's away population
    // made the economy stochastic on 2026-08-26 — how many people are at the
    // cooler decides how much ships and when — so a run where a later release
    // rates lower than the first is now perfectly ordinary, and the old
    // assertion failed on it about once in a hundred runs. Pinning the ordering
    // of two particular releases was never the claim; pinning that the readout
    // tracks the work is.
    const ratings = s.releases.map((r) => r.rating)
    const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length
    expect(Math.abs(s.reputation - mean)).toBeLessThan(Math.abs(BASELINE_RATING - mean))
    // And it never leaves the interval the baseline and the work bracket.
    expect(s.reputation).toBeGreaterThanOrEqual(Math.min(...ratings))
    expect(s.reputation).toBeLessThanOrEqual(Math.max(BASELINE_RATING, ...ratings))
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
/**
 * §22.3 — **James does not quit**, and [amended 2026-09-04] he is now kept by
 * *where he is* rather than by an exemption.
 *
 * The pair of tests here used to poke floor seat 0 in the `tenx` cash-out state
 * and assert that the head survived, because seat 0 was James. §21.0b took him
 * off the floor: he sits in §7.8.0c's leadership corner, he is not one of the
 * twenty, and he is not in `devs` at all — so there is no seat to poke him at
 * and no exemption left to test.
 *
 * The rule is stronger for it. An exemption is a special case that has to be
 * remembered at every call site that can lose a head; *not being a head* is a
 * property nothing can forget. What the first test below now pins is the bug
 * the exemption was written for — Act I cashed out to nothing, with the phase
 * machine already past the beat that grants him and no way back — and it pins
 * it as impossible rather than as guarded.
 */
describe('§22.3 — James does not quit', () => {
  it('cannot be cashed out, because he is not a head anybody can spend', () => {
    play(30, 4)
    // Act I runs at nought developers and one man behind the glass.
    expect(getState().devs).toBe(0)
    expect(workingDevs()).toBeGreaterThan(0)

    for (let i = 0; i < 50; i++) {
      __setState({ dev: { state: 'tenx', elapsed: 0 } })
      poke(0, 0, { rung: 0, index: 0 })
      expect(getState().devs).toBe(0)
      // And he is still working after every one of them.
      expect(workingDevs()).toBeGreaterThan(0)
    }
  })

  it('leaves every ordinary developer losable, including the first', () => {
    play(240, 4)
    hireDeveloper()
    const before = getState().devs
    expect(before).toBe(1)

    __setState({ dev: { state: 'tenx', elapsed: 0 } })
    /*
     * **Seat 0, and that is the change.** It was seat 1 here, because seat 0
     * was James and sparing him was the point. Seat 0 is the first ordinary
     * hire now, and sparing them would be a rule nobody wrote: one developer,
     * in one chair, who cannot be cashed out, for no reason the player could
     * ever be told.
     */
    poke(0, 0, { rung: 0, index: 0 })
    expect(getState().devs).toBe(before - 1)
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
