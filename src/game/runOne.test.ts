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
import { PROJECTS, __resetStore, getState, hireDeveloper, poke, tick } from './store.ts'

beforeEach(() => {
  __resetStore()
})

/** Run the simulation for `seconds`, poking `pokesPerSecond` throughout. */
function play(seconds: number, pokesPerSecond = 0) {
  const step = 1 / 30
  let owed = 0
  for (let t = 0; t < seconds; t += step) {
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
    // Note the ordering, which the first draft of this test got wrong and which
    // is a fact about the design rather than about the test: **James cannot be
    // hired until the first project ships**, because the player starts with no
    // money at all and he costs a dollar. Act II's beat is gated on Act I's
    // payout without anything having to say so.
    play(240, 4)
    expect(getState().projectsShipped).toBeGreaterThanOrEqual(1)
    expect(hireDeveloper()).toBe(true)
    play(200, 4)
    const s = getState()
    expect(s.projectsShipped).toBeGreaterThanOrEqual(2)
    expect(s.cash).toBeGreaterThan(20_000)
    expect(s.phase).toBe('act2a_loop')
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
