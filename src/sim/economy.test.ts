import { describe, expect, it } from 'vitest'
import {
  BANKRUPTCY_THRESHOLD,
  REVENUE_PER_SP,
  UNPAID_FOUNDERS,
  hireCost,
  hireCostTotal,
  isBankrupt,
  massHireCost,
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

describe('hiring costs money — GDD §21.0', () => {
  it('charges for the very first developer', () => {
    // Hiring used to be free, which removed the whole of Act IIa: with no cost
    // there is no loop, no reason to ship, and no treasury to spend on the trap.
    expect(hireCost(1)).toBeGreaterThan(0)
  })

  it('costs more every time, so late hires are decisions not impulses', () => {
    let previous = 0
    for (const devs of [1, 5, 10, 20, 39]) {
      const cost = hireCost(devs)
      expect(cost).toBeGreaterThan(previous)
      previous = cost
    }
  })

  it('escalates geometrically, because velocity is linear in headcount', () => {
    // A linear cost curve would make each hire *more* affordable than the last
    // relative to income, and Act IIa would have no tension at all.
    const early = hireCost(10) - hireCost(9)
    const late = hireCost(30) - hireCost(29)
    expect(late).toBeGreaterThan(early)
  })

  it('keeps Act IIa reachable in a handful of ships', () => {
    // The loop must be completable, or Act IIa is a wall rather than a ramp
    // and the player never reaches the bait.
    //
    // Revenue is NOT capped at one pass of the ladder: §21's project list
    // clamps at its last entry and repeats, so a player can keep shipping the
    // top project. The real constraint is therefore *how many* ships Act IIa
    // costs, not a fixed total — and past about three the loop stops being a
    // ramp and starts being a grind.
    const topProjectRevenue = projectRevenue(8000)
    expect(hireCostTotal(1, 40)).toBeLessThan(topProjectRevenue * 3)
  })

  it('survives nonsense rather than pricing a hire at NaN', () => {
    expect(hireCost(0)).toBeGreaterThan(0)
    expect(hireCost(-3)).toBeGreaterThan(0)
  })
})

describe('the Mass Hire takes everything — GDD §21.0', () => {
  it('costs exactly the treasury, so it always leaves zero buffer', () => {
    // §21.0: no cash buffer is what makes Act V's bankruptcy arrive in seconds
    // rather than needing a scripted nudge.
    expect(massHireCost(4210)).toBe(4210)
  })

  it('is always affordable, so the beat cannot be broken by rebalancing', () => {
    // A fixed price would silently become unreachable or trivial every time
    // §4.10 moved, and nobody would notice until the trap stopped springing.
    for (const cash of [50, 500, 5000, 1_000_000]) {
      expect(massHireCost(cash)).toBeLessThanOrEqual(cash)
    }
  })

  it('still charges a broke player something', () => {
    expect(massHireCost(0)).toBeGreaterThan(0)
    expect(massHireCost(-99)).toBeGreaterThan(0)
  })
})
