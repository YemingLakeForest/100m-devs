import { describe, expect, it } from 'vitest'
import {
  BANKRUPTCY_THRESHOLD,
  UNPAID_FOUNDERS,
  WAGE_PER_DEV_PER_SEC,
  paidHeadcount,
  secondsUntilBankrupt,
} from './economy.ts'
import { MAX_RUNWAY_SECONDS } from './hireDial.ts'
import {
  SEVERANCE_PER_HEAD,
  SEVERANCE_SECONDS,
  layoffQuote,
  runwayAfterLayoff,
  trimToRunway,
} from './layoff.ts'

/** A studio `heads` paid developers strong with `seconds` of wage above the bankruptcy line. */
function studio(heads: number, seconds: number) {
  return { devs: heads + UNPAID_FOUNDERS, cash: BANKRUPTCY_THRESHOLD + seconds * heads * WAGE_PER_DEV_PER_SEC }
}

describe('who can be let go', () => {
  it('only paid heads — the founder who draws no wage stays', () => {
    // Nobody lays off James. A studio of exactly the unpaid head has nobody to cut.
    expect(layoffQuote(UNPAID_FOUNDERS, 1e9, 'max').count).toBe(0)
    expect(layoffQuote(UNPAID_FOUNDERS, 1e9, 100).count).toBe(0)
    expect(layoffQuote(UNPAID_FOUNDERS, 1e9, 100).affordable).toBe(false)
  })

  it('never more than the paid headcount, whatever the dial says', () => {
    const q = layoffQuote(8, 1e9, 100)
    expect(q.count).toBe(paidHeadcount(8))
    expect(q.count).toBeLessThan(100)
  })

  it('prices what it would really do, not a smaller thing under the same label', () => {
    // §10.10.3 rule 1, from the other side: a `x100` that quietly lets fifty go
    // is the interface lying about the one thing the button is for.
    const q = layoffQuote(1_001, 1e9, 100)
    expect(q.count).toBe(100)
    expect(q.cost).toBe(100 * SEVERANCE_PER_HEAD)
  })
})

describe('severance is the price of the exit, and it fixes when the exit helps', () => {
  it('is thirty seconds of the wage per head', () => {
    expect(SEVERANCE_PER_HEAD).toBe(SEVERANCE_SECONDS * WAGE_PER_DEV_PER_SEC)
  })

  it('pays for itself only if the studio would have lived longer than the severance', () => {
    // The derivative of the runway after n layoffs has the sign of
    // (R − S·p) and nothing else, so the claim is a straight line: more than
    // SEVERANCE_SECONDS in hand and every cut helps; fewer and every cut hurts.
    for (const heads of [10, 400, 12_000]) {
      const rich = studio(heads, SEVERANCE_SECONDS * 2)
      const poor = studio(heads, SEVERANCE_SECONDS / 2)
      const cut = Math.max(1, Math.floor(heads / 10))
      const richAfter = layoffQuote(rich.devs, rich.cash, cut)
      const poorAfter = layoffQuote(poor.devs, poor.cash, cut)
      expect(richAfter.runwayAfter).toBeGreaterThan(secondsUntilBankrupt(rich.cash, rich.devs))
      expect(poorAfter.runwayAfter).toBeLessThan(secondsUntilBankrupt(poor.cash, poor.devs))
    }
  })

  it('never refunds the hire: letting people go costs money', () => {
    const { devs, cash } = studio(200, 100)
    const q = layoffQuote(devs, cash, 10)
    expect(q.cost).toBeGreaterThan(0)
  })
})

describe('MAX, for a layoff — the fewest who must go to be safe', () => {
  const windowStudios = [
    studio(50, 40),
    studio(50, 90),
    studio(900, 60),
    studio(30_000, 110),
  ]

  it('puts the studio back the runway MAX hire refuses to cross', () => {
    for (const { devs, cash } of windowStudios) {
      const n = trimToRunway(devs, cash)
      expect(n).toBeGreaterThan(0)
      const q = layoffQuote(devs, cash, 'max')
      expect(q.runwayAfter).toBeGreaterThanOrEqual(MAX_RUNWAY_SECONDS)
    }
  })

  it('is the fewest — one fewer would not be enough', () => {
    for (const { devs, cash } of windowStudios) {
      const n = trimToRunway(devs, cash)
      const lighter = runwayAfterLayoff(devs, cash, n - 1, (n - 1) * SEVERANCE_PER_HEAD)
      expect(lighter).toBeLessThan(MAX_RUNWAY_SECONDS)
    }
  })

  it('does nothing for a studio that is already safe', () => {
    const { devs, cash } = studio(300, MAX_RUNWAY_SECONDS + 1)
    expect(trimToRunway(devs, cash)).toBe(0)
    expect(layoffQuote(devs, cash, 'max').affordable).toBe(false)
  })

  it('does nothing for a studio inside its own severance — there is nobody whose going helps', () => {
    const { devs, cash } = studio(300, SEVERANCE_SECONDS - 1)
    expect(trimToRunway(devs, cash)).toBe(0)
    // And it is not offered as a rescue it is not.
    expect(layoffQuote(devs, cash, 'max').affordable).toBe(false)
  })

  it('does nothing for a studio at or past the line', () => {
    expect(trimToRunway(100, BANKRUPTCY_THRESHOLD)).toBe(0)
    expect(trimToRunway(100, BANKRUPTCY_THRESHOLD - 1)).toBe(0)
  })

  it('never asks for more people than there are', () => {
    const { devs, cash } = studio(2, SEVERANCE_SECONDS + 1)
    expect(trimToRunway(devs, cash)).toBeLessThanOrEqual(paidHeadcount(devs))
  })
})

describe('what the studio can afford to do', () => {
  it('can pay severance from below zero — the studio in the red is who this is for', () => {
    // Cash is negative, the line is a million dollars further down.
    const q = layoffQuote(201, -200_000, 10)
    expect(q.affordable).toBe(true)
  })

  it('refuses a layoff whose severance would itself cross the line', () => {
    // The button must not be a bankruptcy dressed as a rescue.
    const q = layoffQuote(201, BANKRUPTCY_THRESHOLD + SEVERANCE_PER_HEAD * 5, 10)
    expect(q.count).toBe(10)
    expect(q.affordable).toBe(false)
  })

  it('shows an unaffordable multiplier with its true cost, not a smaller one', () => {
    const q = layoffQuote(1_001, BANKRUPTCY_THRESHOLD + 10, 100)
    expect(q.count).toBe(100)
    expect(q.cost).toBe(100 * SEVERANCE_PER_HEAD)
    expect(q.affordable).toBe(false)
  })
})
