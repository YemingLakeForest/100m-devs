import { describe, expect, it } from 'vitest'
import {
  BANKRUPTCY_THRESHOLD,
  UNPAID_FOUNDERS,
  hireCost,
  hireCostTotal,
  isBankrupt,
  massHireCost,
  paidHeadcount,
  payrollPerSecond,
  projectRevenue,
  secondsUntilBankrupt,
  PROJECT_PAYOUTS,
  PROJECT_COMMITMENTS,
  FIRST_PAID_RUNG,
  HIRE_COST_GROWTH,
  REFERENCE_CAP,
  SP_PER_DEV_PER_SEC,
  STARTING_DEVS,
  TARGET_BUILD_SECONDS,
  capAdjustedGrowth,
  openingRung,
  WAGE_PER_DEV_PER_SEC,
} from './economy.ts'
import { PROJECTS, __resetStore, getState, triggerParadigmShift } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import {
  D_BASE,
  SP_PER_DEV_PER_SEC as ENTROPY_SP_PER_DEV_PER_SEC,
  efficiency,
  passiveVelocity,
} from './entropy.ts'

describe('the two figures the GDD actually states (§21)', () => {
  it('Act II: the first project pays exactly +$50', () => {
    // Indexed on the ladder now, not on the Story Point count — §4.10c.
    expect(projectRevenue(0)).toBe(50)
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

describe('§14.8.9 — the hire curve prices how full the studio is, not how big', () => {
  it('leaves Run 1 unchanged to the cent', () => {
    // The whole §21 ladder is priced against a cap of exactly 100. If this ever
    // stops being the identity, Act IIa's $238-to-forty-developers and Act III's
    // "cost: your entire treasury" both move, and the prologue is re-tuned by
    // accident. This is the assertion that makes the change safe to have made.
    expect(capAdjustedGrowth(HIRE_COST_GROWTH, REFERENCE_CAP)).toBe(HIRE_COST_GROWTH)
    for (let n = 1; n <= 200; n++) {
      expect(hireCost(n, capAdjustedGrowth(HIRE_COST_GROWTH, REFERENCE_CAP))).toBe(hireCost(n))
    }
  })

  it('makes the same *fraction* of a cap cost the same at any scale', () => {
    // The claim in one line. Filling three quarters of a hundred-person cap and
    // three quarters of a hundred-thousand-person cap are the same amount of
    // hiring work, and used to differ by a factor with three hundred digits in
    // it. Not exact — headcount is integral and the cap is not — so this asserts
    // the same order of magnitude rather than equality.
    const fill = (cap: number) =>
      hireCost(Math.floor(cap * 0.758), capAdjustedGrowth(HIRE_COST_GROWTH, cap))
    const small = fill(REFERENCE_CAP)
    for (const cap of [1_000, 17_543, 1e6]) {
      expect(fill(cap) / small).toBeGreaterThan(0.5)
      expect(fill(cap) / small).toBeLessThan(2)
    }
  })

  it('keeps §6’s lesson off the market', () => {
    // `hireGrowthFor`'s comment states the rule for the Recruiting node — "the
    // base never reaches 1, so a hire never stops getting dearer" — and the same
    // has to hold here or §4.10a stops being a cost curve at all. A cap of a
    // trillion still makes the last head dearer than the first.
    const g = capAdjustedGrowth(HIRE_COST_GROWTH, 1e12)
    expect(g).toBeGreaterThan(1)
    expect(hireCost(1_000_000, g)).toBeGreaterThan(hireCost(1, g))
  })

  it('leaves §13.7.1’s Recruiting node worth buying', () => {
    // §14.8.9 flagged the risk by name: this fix "is close to §13.7.1's
    // Recruiting node and may make that node redundant". It does not — the node
    // lowers `growth` before the cap scales it, so it still buys a cheaper climb
    // through whatever capacity you hold.
    for (const cap of [REFERENCE_CAP, 1_500, 17_543]) {
      const withNode = hireCost(Math.floor(cap * 0.7), capAdjustedGrowth(1.02, cap))
      const without = hireCost(Math.floor(cap * 0.7), capAdjustedGrowth(HIRE_COST_GROWTH, cap))
      expect(withNode).toBeLessThan(without)
    }
  })

  it('mirrors entropy.ts’s D_BASE, which is the cap it was authored against', () => {
    expect(REFERENCE_CAP).toBe(D_BASE)
  })
})

describe('the mirrors this module keeps of numbers it does not own', () => {
  it('matches entropy.ts on passive output', () => {
    expect(SP_PER_DEV_PER_SEC).toBe(ENTROPY_SP_PER_DEV_PER_SEC)
  })

  it('matches what a Paradigm Shift actually leaves standing — §21.6', () => {
    // `openingRung` bounds the opening game by this number. It drifting from
    // `triggerParadigmShift`'s `devs:` is how a studio ends up holding a game it
    // has not the people to build, which is the failure the function's own note
    // records. The store now reads the constant, so this asserts the mirror is
    // still pointed at the right thing rather than at a copy of it.
    __resetStore()
    setPermanent(emptyPermanent())
    triggerParadigmShift()
    expect(getState().devs).toBe(STARTING_DEVS)
    __resetStore()
    setPermanent(emptyPermanent())
  })
})

describe('revenue scales with the studio, not with the Story Point — §4.10c', () => {
  it('pays more per project as the ladder climbs', () => {
    for (let i = 1; i < PROJECT_PAYOUTS.length; i++) {
      expect(projectRevenue(i)).toBeGreaterThan(projectRevenue(i - 1))
    }
  })

  it('clears the wage from the first *paid* rung onward, which is the whole rule', () => {
    // profit/sec = n*r - n*W + 2*W, so d(profit)/dn = r - W: **hiring pays if
    // and only if revenue per Story Point exceeds the wage per developer per
    // second.** Every payout on the ladder is chosen against this one line, and
    // a flat $/SP failed it by a factor of six hundred.
    //
    // **From `FIRST_PAID_RUNG`, not from rung 1** — §4.10f. `d(profit)/dn` only
    // binds where there is an `n` to differentiate, and the garage rungs are
    // shipped by two unpaid founders. Asserting the rule from rung 1 is what
    // forced the ×500 cliff: a 300-point game worth $50 and a 400-point game
    // obliged to beat $50/SP are twenty thousand dollars apart by arithmetic.
    for (let i = FIRST_PAID_RUNG; i < PROJECT_PAYOUTS.length; i++) {
      const r = projectRevenue(i) / PROJECTS[i].commitment
      expect(r).toBeGreaterThan(WAGE_PER_DEV_PER_SEC)
    }
  })

  it('keeps every garage rung below the line, which is the joke', () => {
    // Your first three games would have lost money the instant you hired
    // anybody. They turn a profit only because you and James are not paid — and
    // §21's phase machine will not open the paid hiring loop until they are all
    // shipped, which is what makes it safe for them to sit here.
    for (let i = 0; i < FIRST_PAID_RUNG; i++) {
      const r = projectRevenue(i) / PROJECTS[i].commitment
      expect(r).toBeLessThan(WAGE_PER_DEV_PER_SEC)
    }
  })

  it('climbs toward the wage line rather than jumping over it', () => {
    // The complaint that started §4.10f was "$50 then $25,000 — how is that
    // sensible?", and the honest answer was that it was forced rather than
    // chosen. This is the assertion that stops it coming back: no single step on
    // the ladder may multiply the payout by more than this.
    //
    // Fifty is deliberately loose. The first step is ×30 — *Flappy Square 1.1
    // (Now With Ads)* — because discovering advertising is genuinely the largest
    // multiplier a garage ever finds, and a limit tight enough to forbid that
    // would be a limit tuned to a taste rather than to the failure.
    for (let i = 1; i < PROJECT_PAYOUTS.length; i++) {
      const step = PROJECT_PAYOUTS[i] / PROJECT_PAYOUTS[i - 1]
      expect(step).toBeLessThanOrEqual(50)
    }
  })

  it('has enough rungs that new games keep arriving after the garage', () => {
    // Four rungs meant three "new game" moments in the entire career and then
    // the same title for ever. The terminal rung still repeats — §4.4 grows its
    // commitment instead — but it should not be reached in the prologue.
    expect(PROJECT_PAYOUTS.length).toBeGreaterThan(FIRST_PAID_RUNG + 3)
  })

  it('keeps the mirrored ladders in step', () => {
    // `PROJECTS` lives in the store and the two mirrors in the sim, so that
    // economy.ts stays free of store imports. Two lists that must agree and are
    // edited in different files is exactly the pairing that silently drifts —
    // and `openingRung` reads the commitments, so a drifted mirror would put a
    // run on a rung whose size it had guessed.
    expect(PROJECT_PAYOUTS).toEqual(PROJECTS.map((p) => p.payout))
    expect(PROJECT_COMMITMENTS).toEqual(PROJECTS.map((p) => p.commitment))
  })

  it('never opens a later run in the garage — §4.10f', () => {
    // The bug this exists to stop: `triggerParadigmShift` reset `projectIndex`
    // to zero, so a studio with a cap of fifteen thousand went back to making
    // *Flappy Square 1.0* for fifty dollars. Measured, that stalled runs 2–8 at
    // **two developers**, because three garage games on §4.10e's tail never
    // clear the payroll buffer a third hire needs behind it.
    expect(openingRung(0, STARTING_DEVS)).toBe(0)
    for (let shifts = 1; shifts <= 12; shifts++) {
      expect(openingRung(shifts, STARTING_DEVS)).toBeGreaterThanOrEqual(FIRST_PAID_RUNG)
    }
  })

  it('opens on a game the two developers a run actually has can finish', () => {
    // **The regression that named the bound.** This was written against the
    // *cap* first — one story point per developer of capacity — and measured, at
    // run 8, a cap of 210,526 handed the run the terminal 3,500-point game. Two
    // developers need about seven hundred seconds for that, there is no money
    // until it ships, and so there is no third hire: the run sat at two people
    // and $0 revenue until the harness called it stalled.
    //
    // A run opens with the people §21.6 leaves it, not with the people its cap
    // allows, and the opening game is bounded by §4.4's window at that headcount.
    const buildable = STARTING_DEVS * SP_PER_DEV_PER_SEC * TARGET_BUILD_SECONDS
    for (let shifts = 1; shifts <= 40; shifts++) {
      const r = openingRung(shifts, STARTING_DEVS)
      expect(r).toBeLessThanOrEqual(PROJECT_COMMITMENTS.length - 1)
      // Either it is the floor, or it is genuinely buildable from a standing start.
      expect(r === FIRST_PAID_RUNG || PROJECT_COMMITMENTS[r] <= buildable).toBe(true)
    }
  })

  it('follows the starting headcount rather than hard-coding its own answer', () => {
    // The bound is written as a computation because the 3 it currently produces
    // is an *output*. If §21.6 ever leaves a run more people, the opening game
    // should follow — this is the test that says so, and that would have caught
    // the cap-bound version by showing it did not depend on headcount at all.
    expect(openingRung(9, STARTING_DEVS)).toBe(FIRST_PAID_RUNG)
    expect(openingRung(9, 1_000)).toBeGreaterThan(FIRST_PAID_RUNG)
    let last = 0
    for (const devs of [STARTING_DEVS, 20, 40, 100, 1_000]) {
      const r = openingRung(9, devs)
      expect(r).toBeGreaterThanOrEqual(last)
      last = r
    }
  })

  it('clamps rather than returning undefined past the end of the ladder', () => {
    // §21's list repeats its last entry, and `maxProjectIndex` relies on this.
    expect(projectRevenue(99)).toBe(projectRevenue(PROJECT_PAYOUTS.length - 1))
    expect(projectRevenue(-3)).toBe(projectRevenue(0))
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
    const topProjectRevenue = projectRevenue(PROJECT_PAYOUTS.length - 1)
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
