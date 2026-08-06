import { describe, expect, it } from 'vitest'
import {
  BANKRUPTCY_THRESHOLD,
  REVENUE_PER_SP,
  UNPAID_FOUNDERS,
  isBankrupt,
  paidHeadcount,
  payrollPerSecond,
  projectRevenue,
  secondsUntilBankrupt,
} from './economy.ts'
import { efficiency, passiveVelocity } from './entropy.ts'

describe('the two figures the GDD actually states (§21)', () => {
  it('Act II: the first project pays exactly +$50', () => {
    expect(projectRevenue(1000)).toBe(50)
  })

  it('Act II: two people in a garage draw no payroll', () => {
    expect(payrollPerSecond(2)).toBe(0)
    expect(paidHeadcount(2)).toBe(0)
  })

  it('Act V: ~1,000 developers burn $50,000/sec', () => {
    expect(payrollPerSecond(1000 + UNPAID_FOUNDERS)).toBe(50_000)
  })
})

describe('payroll', () => {
  it('starts the moment a paid head is hired', () => {
    expect(payrollPerSecond(2)).toBe(0)
    expect(payrollPerSecond(3)).toBe(50)
  })

  it('never goes negative on a shrinking studio', () => {
    expect(payrollPerSecond(0)).toBe(0)
    expect(paidHeadcount(1)).toBe(0)
  })

  it('is linear in headcount — the collapse comes from entropy, not wages', () => {
    // §6.1 makes payroll the timer, not the trap. If wages were superlinear
    // they would be doing the lesson's work instead of Communication Entropy.
    expect(payrollPerSecond(102) / payrollPerSecond(52)).toBeCloseTo(2, 10)
  })
})

describe('revenue scales with the work committed', () => {
  it('pays proportionally to the Sprint Commitment', () => {
    expect(projectRevenue(2000)).toBe(2 * projectRevenue(1000))
    expect(REVENUE_PER_SP).toBeGreaterThan(0)
  })
})

describe('the trap closes on the schedule §6.1 describes', () => {
  it('bankrupts a locked 1,000-dev studio inside 60 seconds', () => {
    // The player ships Flappy Square for $50, then mass-hires.
    const runway = secondsUntilBankrupt(50, 1002)
    expect(runway).toBeLessThan(60)
    expect(runway).toBeGreaterThan(5) // long enough to panic in
  })

  it('leaves a garage studio solvent indefinitely', () => {
    expect(secondsUntilBankrupt(50, 2)).toBe(Infinity)
  })

  it('is a genuine trap: 1,000 devs earn less than 2 did', () => {
    // The whole lesson, as one assertion. Production at 1,000 devs against a
    // cap of 100 is *lower* than at 2, so revenue falls while payroll explodes.
    const garage = passiveVelocity(2, 100)
    const swarm = passiveVelocity(1002, 100)
    expect(swarm).toBeLessThan(garage)
    expect(payrollPerSecond(1002)).toBeGreaterThan(payrollPerSecond(2))
  })

  it('cannot be tapped out of — poke yield is taxed by the same eta', () => {
    // §6.3's design rule: never let tapping rescue a run from Entropy Lock.
    expect(efficiency(1002, 100)).toBeLessThan(1e-4)
  })
})

describe('bankruptcy', () => {
  it('fires at the threshold §21 Act V walks the player down to', () => {
    expect(BANKRUPTCY_THRESHOLD).toBe(-1_000_000)
    expect(isBankrupt(-999_999)).toBe(false)
    expect(isBankrupt(-1_000_000)).toBe(true)
  })

  it('does not fire on a merely negative balance', () => {
    // §21 shows −$10,000 and −$100,000 as beats on the way down, not endings.
    expect(isBankrupt(-10_000)).toBe(false)
    expect(isBankrupt(-100_000)).toBe(false)
  })
})
