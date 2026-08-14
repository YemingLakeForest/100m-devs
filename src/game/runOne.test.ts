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

import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROJECT_PAYOUTS,
  WAGE_PER_DEV_PER_SEC,
  isBankrupt,
  payrollPerSecond,
} from '../sim/economy.ts'
import { passiveVelocity } from '../sim/entropy.ts'
import {
  PROJECTS,
  __resetStore,
  __setState,
  dismissScene,
  getState,
  hireDeveloper,
  massHire,
  poke,
  pokeFounder,
  showScene,
  takeSeedRound,
  tick,
} from './store.ts'
import { SCENE_JAMES_ARRIVES } from './scenes.ts'

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
  __setState({ runSeed: FIXED_SEED })
})

/** Run the simulation for `seconds`, poking `pokesPerSecond` throughout. */
function play(seconds: number, pokesPerSecond = 0) {
  const step = 1 / 30
  let owed = 0
  for (let t = 0; t < seconds; t += step) {
    // §21.7 — a scene stops the world and `poke` is inert while one is up, so
    // the harness taps through it exactly as a player would. Without this, Act
    // I's arrival scene simply parks the run.
    if (getState().scene !== null) dismissScene()
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

  it('makes every hire after the first project increase profit per second', () => {
    // d(profit)/dn = r - W. If this is ever negative, Act IIa's "each hire
    // works" is a lie and the player is punished for doing what they were told.
    for (let i = 1; i < PROJECTS.length; i++) {
      const r = PROJECT_PAYOUTS[i] / PROJECTS[i].commitment
      const profitAt = (n: number) => passiveVelocity(n, 100) * r - payrollPerSecond(n)
      expect(profitAt(20)).toBeGreaterThan(profitAt(10))
      expect(profitAt(40)).toBeGreaterThan(profitAt(20))
    }
  })
})

describe('a player who does what the game says does not go broke', () => {
  it('ships two projects in the garage and can then afford to hire', () => {
    // §21 Act I and II. Both founders unpaid, so this is pure profit, and it is
    // the money Act IIa is played with.
    //
    // **§21.0b changed the ordering and it is worth recording what it was.**
    // James used to cost a dollar against a treasury of nothing, so the real
    // gate on the first hire was shipping the whole of *Flappy Square* alone —
    // Act II's beat was gated on Act I's payout without anything saying so, and
    // that is precisely the brutality R41 was reported for. He is free now, and
    // arrives fifty pokes in, so the first hire the player *pays* for is the
    // third person.
    play(240, 4)
    expect(getState().projectsShipped).toBeGreaterThanOrEqual(1)
    // James is already at a desk; this is employee number two.
    expect(getState().devs).toBe(1)
    expect(hireDeveloper()).toBe(true)

    // Played to the beat rather than to a stopwatch. A fixed 200 seconds put
    // the second ship on a knife edge, so the assertions below were testing
    // *timing* — which legitimately varies, because §8.2's crits are a real
    // dice roll and no seed pins them — instead of solvency.
    for (let i = 0; i < 40 && getState().projectsShipped < 2; i++) play(30, 4)
    // §4.10e pays on a tail, so a treasury read on the frame a game ships is a
    // treasury read before it has been paid. Let the catalogue settle.
    play(120, 4)

    const s = getState()
    expect(s.projectsShipped).toBeGreaterThanOrEqual(2)
    expect(s.phase).toBe('act2a_loop')

    /**
     * The canary: **the loop pays for itself.** Two unpaid founders and one
     * wage against two shipped games, so the treasury has to hold most of what
     * the catalogue has paid out. Stated as a share of §4.10e's realised
     * revenue rather than as a round number, because §4.14 now scales the
     * payout by the rating — a literal would have been re-tuned every time
     * quality moved, which is how a canary stops being one.
     */
    expect(s.lifetimeRevenue).toBeGreaterThan(10_000)
    expect(s.cash).toBeGreaterThan(0.8 * s.lifetimeRevenue)
  })

  it('survives hiring to forty, which is what Act IIa asks for', () => {
    // The regression that mattered. Under a flat $/SP this ended at roughly
    // minus a hundred thousand dollars and a dead run: every hire made the next
    // project less affordable, which is the exact opposite of the beat.
    play(240, 4)
    hireDeveloper()
    play(200, 4)
    for (let i = 0; i < 120 && getState().devs < 40; i++) {
      hireDeveloper()
      play(5, 3)
    }
    const s = getState()
    expect(s.devs).toBeGreaterThanOrEqual(20)
    expect(s.cash).toBeGreaterThan(0)
    expect(isBankrupt(s.cash)).toBe(false)
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
