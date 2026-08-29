/**
 * Run 1, played — GDD §4.10c, §21.0, §21.0a.
 *
 * The economy is the one system whose failure is invisible in a unit test: every
 * constant can be individually defensible and the *loop* still not close. It
 * did not close for two turns. `payrollPerSecond`, `projectRevenue` and
 * `hireCost` all passed their own tests while shipping a 1,000 SP project cost
 * forty thousand dollars in wages and paid fifty.
 *
 * So this simulates the run instead of asserting about its parts: poke, ship,
 * hire, ship faster, and check the money is still there at the end.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FIRST_PAID_RUNG,
  PROJECT_PAYOUTS,
  WAGE_PER_DEV_PER_SEC,
  isBankrupt,
  payrollPerSecond,
} from '../sim/economy.ts'
import { optimalHeadcount, passiveVelocity } from '../sim/entropy.ts'
import {
  PROJECTS,
  __resetStore,
  __setState,
  commitmentFor,
  dismissScene,
  getState,
  hireDeveloper,
  massHire,
  poke,
  pokeFounder,
  releaseNow,
  showScene,
  takeSeedRound,
  tick,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_JAMES_ARRIVES, SCENE_MASS_HIRE } from './scenes.ts'
import { MASS_HIRE_COUNT } from './onboarding.ts'

/**
 * §7.8.7's run seed is `Date.now()`-based, so every run of this file gets a
 * different set of §4.9a output shares and therefore a different velocity. That
 * is right for the game and wrong for a test that asserts a treasury: this file
 * measures the *economy*, and letting the dice into it makes a solvency canary
 * fail once every few runs for reasons that have nothing to do with solvency.
 */
const FIXED_SEED = 0x5eed

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  __setState({ runSeed: FIXED_SEED })
})

afterEach(() => {
  // The shift counter is permanent state, so it leaks between files unless it
  // is put back — and the failure is a Run 1 test quietly passing because an
  // earlier one prestiged.
  setPermanent(emptyPermanent())
})

/** §21.0e — a player who has been through the trap, and may therefore hire. */
function prestiged() {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
}

/** Put the run on a ladder rung, name, commitment and burn-down together. */
function onRung(index: number) {
  return {
    projectIndex: index,
    sprintName: PROJECTS[index].name,
    commitment: commitmentFor(index),
  }
}

/** Run the simulation for `seconds`, poking `pokesPerSecond` throughout. */
function play(seconds: number, pokesPerSecond = 0) {
  const step = 1 / 30
  let owed = 0
  for (let t = 0; t < seconds; t += step) {
    // §21.7 — a scene stops the world and `poke` is inert while one is up, so
    // the harness taps through it exactly as a player would. Without this, Act
    // I's arrival scene simply parks the run.
    if (getState().scene !== null) dismissScene()
    // §10.8b — and the same for a finished build waiting on a release date.
    // See `releaseNow`: the neutral date pays ×1, so Run 1's measured economy
    // is the economy this file was written against.
    if (getState().pendingRelease !== null) releaseNow()
    owed += pokesPerSecond * step
    while (owed >= 1) {
      poke(0, 0)
      owed -= 1
    }
    tick(step)
  }
}

describe('the loop closes — §4.10c', () => {
  it('costs about the wage to produce a Story Point while the studio is in sync', () => {
    // More developers finish sooner *and* cost proportionally more, so linear
    // payroll over linear velocity is a **constant cost per point**, climbing
    // toward the wage as the two unpaid founders are diluted away. This is the
    // relation the ladder's payouts are chosen against.
    for (const n of [5, 10, 20, 40]) {
      const costPerSp = payrollPerSecond(n) / passiveVelocity(n, 100)
      expect(costPerSp).toBeLessThan(WAGE_PER_DEV_PER_SEC)
      expect(costPerSp).toBeGreaterThan(WAGE_PER_DEV_PER_SEC * 0.5)
    }
  })

  it('makes a Story Point cost MORE than the wage once entropy bites', () => {
    // Velocity is not linear in headcount — §4.1 taxes it — so the cost of a
    // point is `W(n-2) / (n * eta)`, and the denominator collapses long before
    // the numerator stops growing. At a hundred developers against a cap of a
    // hundred it is already double the wage.
    //
    // **This is §6's thesis denominated in dollars**, and it was worth finding:
    // the trap does not need payroll to be superlinear (§6.1 forbids that), it
    // only needs payroll to be linear while output is not.
    const at = (n: number) => payrollPerSecond(n) / passiveVelocity(n, 100)
    expect(at(100)).toBeGreaterThan(WAGE_PER_DEV_PER_SEC)
    expect(at(100)).toBeGreaterThan(at(40) * 2)
  })

  it('makes every hire increase profit per second, once hiring is what the game asks for', () => {
    // d(profit)/dn = r - W. If this is ever negative, Act IIa's "each hire
    // works" is a lie and the player is punished for doing what they were told.
    //
    // **From `FIRST_PAID_RUNG`** — §4.10f. Act IIa is the phase that asks for
    // hires, and §21's machine does not open it until the garage catalogue is
    // shipped. The rungs before it are two unpaid founders selling advertising
    // to themselves; there is no `n` there for the derivative to be about.
    for (let i = FIRST_PAID_RUNG; i < PROJECTS.length; i++) {
      const r = PROJECT_PAYOUTS[i] / PROJECTS[i].commitment
      const profitAt = (n: number) => passiveVelocity(n, 100) * r - payrollPerSecond(n)
      expect(profitAt(20)).toBeGreaterThan(profitAt(10))
      expect(profitAt(40)).toBeGreaterThan(profitAt(20))
    }
  })

  it('makes hiring against a garage rung a *loss*, which is the lesson §6 charges for later', () => {
    // The other half of §4.10f, and the reason the rungs below the line are safe
    // to ship: they are not neutral, they are actively wrong to hire against,
    // and the phase machine is what keeps the player off them. Stated as a test
    // so that "safe because nobody hires here" stays a fact about the gate
    // rather than an assumption about the player.
    for (let i = 0; i < FIRST_PAID_RUNG; i++) {
      const r = PROJECT_PAYOUTS[i] / PROJECTS[i].commitment
      const profitAt = (n: number) => passiveVelocity(n, 100) * r - payrollPerSecond(n)
      expect(profitAt(20)).toBeLessThan(profitAt(10))
    }
  })
})

describe('a player who does what the game says does not go broke', () => {
  it('ships the garage catalogue with two people and no hire button — §21.0e', () => {
    // §21 Act I, all of it. Nobody is paid, nothing is hired, and the two of
    // them work through every rung below `FIRST_PAID_RUNG`. That is what makes
    // Act III's "two of us shipped three games" a sentence the player can
    // check against their own floor.
    for (let i = 0; i < 60 && getState().projectsShipped < FIRST_PAID_RUNG; i++) play(30, 4)
    // §4.10e pays on a tail, so a treasury read on the frame a game ships is a
    // treasury read before it has been paid. Let the catalogue settle.
    play(120, 4)

    const s = getState()
    expect(s.projectsShipped).toBeGreaterThanOrEqual(FIRST_PAID_RUNG)
    // James, and nobody else, from the first frame to the mousetrap.
    expect(s.devs).toBe(1)
    expect(s.phase).toBe('act2_termsheet')

    /**
     * The canary: **the garage pays for itself.** Nobody is on payroll, so the
     * treasury has to hold essentially everything the catalogue has paid out.
     * Stated as a share of §4.10e's realised revenue rather than as a round
     * number, because §4.14 scales the payout by the rating — a literal would
     * have been re-tuned every time quality moved, which is how a canary stops
     * being one.
     */
    expect(s.lifetimeRevenue).toBeGreaterThan(10_000)
    expect(s.cash).toBeGreaterThan(0.8 * s.lifetimeRevenue)
  })

  it('refuses to hire at all during Run 1 — §21.0e', () => {
    // The gate lives in the store and not only in `actionFor`, because the HUD
    // is one caller: the `?act=` seams, the dev bar and the acceptance walk all
    // reach `hireDeveloper` directly.
    __setState({ devs: 1, cash: 1_000_000 })
    expect(hireDeveloper()).toBe(false)
    expect(getState().devs).toBe(1)
  })

  it('survives hiring to forty once the door is open — §4.10h', () => {
    // The regression that mattered, moved to the run that can actually hire.
    // Under a flat $/SP this ended at roughly minus a hundred thousand dollars
    // and a dead run: every hire made the next project less affordable, which
    // is the exact opposite of the beat. §4.10h is the second half of the same
    // fix — a studio at forty is now visibly *profitable* rather than merely
    // not-yet-bankrupt.
    prestiged()
    __setState({ devs: 1, cash: 200_000, ...onRung(FIRST_PAID_RUNG) })
    for (let i = 0; i < 120 && getState().devs < 40; i++) {
      hireDeveloper()
      play(5, 3)
    }
    const s = getState()
    expect(s.devs).toBeGreaterThanOrEqual(20)
    expect(s.cash).toBeGreaterThan(0)
    expect(isBankrupt(s.cash)).toBe(false)
  })

  it('makes a studio at §4.1’s optimum *profitable*, not break-even — §4.10h', () => {
    // The complaint this answers, as one assertion. At the old ladder's first
    // paid rung the break-even headcount and §4.1's output optimum were the
    // same number, so a player who hired to the headcount the speedometer calls
    // best was losing money standing on it — "it's not the inefficiency that's
    // killing but the budget awareness killing us".
    const cap = 100
    const optimum = optimalHeadcount(cap)
    for (let i = FIRST_PAID_RUNG; i < PROJECTS.length; i++) {
      const r = PROJECT_PAYOUTS[i] / PROJECTS[i].commitment
      const profit = passiveVelocity(optimum, cap) * r - payrollPerSecond(optimum)
      expect(profit).toBeGreaterThan(0)
      // And by a real margin rather than a rounding error: half of payroll
      // again, which is the difference between "solvent" and "growing".
      expect(profit).toBeGreaterThan(payrollPerSecond(optimum) * 0.5)
    }
  })
})

describe('the trap still springs — §6.1', () => {
  it('bankrupts a mass-hired studio inside a minute', () => {
    // §6.1 asks for "within 60 seconds". Payroll is the timer, not the trap:
    // 1,040 developers at $50/sec each is $51,900/sec, and the Mass Hire leaves
    // no buffer by design.
    const payroll = payrollPerSecond(1_040)
    expect(payroll).toBeGreaterThan(50_000)
    expect(1_000_000 / payroll).toBeLessThan(60)
  })

  it('signs nothing in the scene — the button is the transaction — §21.0d amended', () => {
    // Until 2026-08-27 the pitch scene *was* the trap: reaching its acceptance
    // line hired the thousand people, and dismissing the box early did it too,
    // so there was nothing to press. The amendment ends the scene on the pitch
    // and makes the offer button the signature: the dialogue closes with the
    // treasury and headcount untouched, and only the player's tap springs it.
    __setState({ devs: 1, cash: 60_000, projectsShipped: 3, phase: 'act3_bait' })
    showScene(SCENE_MASS_HIRE.id)
    dismissScene()

    expect(getState().massHired).toBe(false)
    expect(getState().devs).toBe(1)
    expect(getState().cash).toBe(60_000)

    expect(massHire()).toBe(true)
    expect(getState().massHired).toBe(true)
    expect(getState().devs).toBe(1 + MASS_HIRE_COUNT)
    expect(getState().cash).toBe(0)
  })
})

describe('the world holds its breath while a scene is up — §10.7a.3', () => {
  it('stops the burn-down, the payroll and the clock', () => {
    __setState({ devs: 3, cash: 500 })
    showScene(SCENE_JAMES_ARRIVES.id)
    const before = getState()
    tick(5)
    const during = getState()
    // Five seconds of conversation must not burn a single Story Point, pay a
    // dollar of wages or age the run: the dialogue advances on the player's
    // taps, never on the simulation.
    expect(during.burned.toNumber()).toBe(before.burned.toNumber())
    expect(during.cash).toBe(before.cash)
    expect(during.runSeconds).toBe(before.runSeconds)
    expect(during.localEntropy).toBe(before.localEntropy)
  })

  it('resumes the moment the scene is dismissed', () => {
    __setState({ devs: 3, cash: 500 })
    showScene(SCENE_JAMES_ARRIVES.id)
    tick(5)
    const held = getState().burned.toNumber()
    dismissScene()
    tick(1)
    expect(getState().burned.toNumber()).toBeGreaterThan(held)
  })

  it('keeps every player verb inert while it plays', () => {
    // The scrim eats the taps at the UI layer; these guards are the same rule
    // at the model layer, so a path that skips the glass cannot hire, spring
    // the trap, sign the term sheet or poke mid-conversation.
    __setState({ devs: 1, cash: 100 })
    showScene(SCENE_JAMES_ARRIVES.id)
    expect(hireDeveloper()).toBe(false)
    expect(massHire()).toBe(false)
    expect(takeSeedRound()).toBe(false)
    expect(poke(0, 0).sp).toBe(0)
    expect(pokeFounder()).toBe(0)
  })
})
