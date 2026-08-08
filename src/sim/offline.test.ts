import Decimal from 'break_infinity.js'
import { describe, expect, it } from 'vitest'
import {
  ENTITLEMENT_SERIES_A,
  MAX_OFFLINE_SHIPS,
  NODE_OFFLINE_CAP_4H,
  NODE_OFFLINE_RATE,
  OFFLINE_BASE_CAP_SECONDS,
  OFFLINE_BASE_RATE,
  OFFLINE_MIN_SECONDS,
  elapsedSeconds,
  offlineCapSeconds,
  offlineRateMultiplier,
  offlineStoryPoints,
  offlineYield,
  paidSeconds,
  type OfflineConfig,
  type OfflineSnapshot,
} from './offline.ts'

const T0 = 1_700_000_000_000
const HOUR = 3600 * 1000

function snapshot(over: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    savedAt: T0,
    velocity: 10,
    commitment: new Decimal(1000),
    burned: new Decimal(0),
    projectIndex: 0,
    // The default ladder in these tests is effectively unbounded, so the clamp
    // does not interfere; the test that cares about it sets its own.
    maxProjectIndex: 999,
    commitmentFor: () => new Decimal(1000),
    // §4.10c — a payout per ladder position, not a rate per Story Point.
    revenueFor: () => 50,
    autoShip: false,
    ...over,
  }
}

function config(over: Partial<OfflineConfig> = {}): OfflineConfig {
  return {
    capSeconds: OFFLINE_BASE_CAP_SECONDS,
    rateMultiplier: OFFLINE_BASE_RATE,
    unlocked: true,
    ...over,
  }
}

describe('the away clock — SAVE.md §5.2', () => {
  it('measures from savedAt and nothing else', () => {
    expect(elapsedSeconds(T0, T0 + HOUR)).toBe(3600)
  })

  it('pays zero for a clock that moved backwards', () => {
    // Timezone changes, NTP corrections, and the player who wound the clock
    // forward to farm and then wound it back.
    expect(elapsedSeconds(T0, T0 - 5 * HOUR)).toBe(0)
    expect(paidSeconds(T0, T0 - 5 * HOUR, OFFLINE_BASE_CAP_SECONDS)).toBe(0)
  })

  it('never produces a negative payout from a backwards clock', () => {
    const report = offlineYield(snapshot({ burned: new Decimal(400) }), config(), T0 - 9 * HOUR)
    expect(report.storyPoints.toNumber()).toBe(0)
    // The real hazard: a negative yield would *subtract* from the burn-down,
    // which is corruption rather than an exploit.
    expect(report.burned.toNumber()).toBe(400)
  })

  it('treats a tampered or truncated savedAt as no absence at all', () => {
    expect(elapsedSeconds(Number.NaN, T0)).toBe(0)
    expect(elapsedSeconds(Number.POSITIVE_INFINITY, T0)).toBe(0)
    expect(elapsedSeconds(undefined as unknown as number, T0)).toBe(0)
  })

  it('bounds a clock wound years forward to a single capped payout', () => {
    const report = offlineYield(snapshot(), config(), T0 + 365 * 24 * HOUR)
    expect(report.paidSeconds).toBe(OFFLINE_BASE_CAP_SECONDS)
  })
})

describe('the cap — GDD §24.5', () => {
  it('starts at 2 hours, leaving two upgrade steps to sell', () => {
    expect(OFFLINE_BASE_CAP_SECONDS).toBe(2 * 3600)
    expect(offlineCapSeconds([], [])).toBe(2 * 3600)
  })

  it('the earned Paradigm node takes it to 4h — MONETISATION §7 baseline', () => {
    expect(offlineCapSeconds([NODE_OFFLINE_CAP_4H], [])).toBe(4 * 3600)
  })

  it('SERIES A takes it to 16h, node or not', () => {
    expect(offlineCapSeconds([], [ENTITLEMENT_SERIES_A])).toBe(16 * 3600)
    expect(offlineCapSeconds([NODE_OFFLINE_CAP_4H], [ENTITLEMENT_SERIES_A])).toBe(16 * 3600)
  })

  it('pays the cap and reports the remainder as idle time', () => {
    const report = offlineYield(snapshot(), config(), T0 + 8 * HOUR)
    expect(report.elapsedSeconds).toBe(8 * 3600)
    expect(report.paidSeconds).toBe(2 * 3600)
    // The §24.8 "BUILD SERVER IDLE" figure — the honest upsell.
    expect(report.idleSeconds).toBe(6 * 3600)
  })

  it('does not cap an absence inside the cap', () => {
    const report = offlineYield(snapshot(), config(), T0 + HOUR)
    expect(report.paidSeconds).toBe(3600)
    expect(report.idleSeconds).toBe(0)
  })
})

describe('the rate — GDD §24.5', () => {
  it('is half the active rate, so attention beats absence', () => {
    expect(OFFLINE_BASE_RATE).toBe(0.5)
    expect(offlineRateMultiplier({}, [])).toBe(0.5)
  })

  it('stacks node levels and SERIES A additively, as one axis', () => {
    expect(offlineRateMultiplier({ [NODE_OFFLINE_RATE]: 2 }, [])).toBeCloseTo(0.75, 10)
    expect(offlineRateMultiplier({}, [ENTITLEMENT_SERIES_A])).toBeCloseTo(0.75, 10)
    expect(offlineRateMultiplier({ [NODE_OFFLINE_RATE]: 4 }, [ENTITLEMENT_SERIES_A])).toBeCloseTo(
      1.25,
      10,
    )
  })

  it('ignores a garbage node level rather than producing NaN Story Points', () => {
    expect(offlineRateMultiplier({ [NODE_OFFLINE_RATE]: Number.NaN }, [])).toBe(0.5)
    expect(offlineRateMultiplier({ [NODE_OFFLINE_RATE]: -3 }, [])).toBe(0.5)
  })
})

describe('integrate, never simulate — SAVE.md §5.1, GDD §24.7', () => {
  it('one long absence equals many short ones', () => {
    // The property that actually matters. If it breaks, the model has become
    // path-dependent and two devices will disagree about the same eight hours.
    const long = offlineStoryPoints(10, 3600, 0.5)
    let sum = new Decimal(0)
    for (let i = 0; i < 3600; i++) sum = sum.plus(offlineStoryPoints(10, 1, 0.5))
    expect(sum.toNumber()).toBeCloseTo(long.toNumber(), 6)
  })

  it('holds through the full report, with the remainder carried across ships', () => {
    const snap = snapshot({ velocity: 1, autoShip: true })
    const oneGo = offlineYield(snap, config(), T0 + 2 * HOUR)

    // Six twenty-minute absences, each resuming from the last one's state.
    let cursor = snapshot({ velocity: 1, autoShip: true })
    let shipped = 0
    let revenue = new Decimal(0)
    for (let i = 0; i < 6; i++) {
      const step = offlineYield(cursor, config(), cursor.savedAt + HOUR / 3)
      shipped += step.projectsShipped
      revenue = revenue.plus(step.revenue)
      cursor = {
        ...cursor,
        savedAt: cursor.savedAt + HOUR / 3,
        burned: step.burned,
        commitment: step.commitment,
        projectIndex: step.projectIndex,
      }
    }

    expect(shipped).toBe(oneGo.projectsShipped)
    expect(revenue.toNumber()).toBeCloseTo(oneGo.revenue.toNumber(), 6)
    expect(cursor.burned.toNumber()).toBeCloseTo(oneGo.burned.toNumber(), 6)
  })

  it('is linear in seconds, which is why the closed form is available', () => {
    const a = offlineStoryPoints(7, 100, 0.5)
    const b = offlineStoryPoints(7, 300, 0.5)
    expect(b.div(a).toNumber()).toBeCloseTo(3, 10)
  })

  it('does not narrow a large yield to a float', () => {
    // A 100M-developer studio. `number` would still hold this, but the type
    // must not be the thing that decides that.
    const sp = offlineStoryPoints(1e8, 2 * 3600, 0.5)
    expect(sp).toBeInstanceOf(Decimal)
    expect(sp.toNumber()).toBeCloseTo(3.6e11, -3)
  })

  it('yields nothing for a stalled studio', () => {
    // §24.6 — an entropy-locked studio produces ~0 offline, so the §6 trap is
    // waiting exactly as it was left. It cannot resolve itself overnight.
    expect(offlineStoryPoints(0, 8 * 3600, 0.5).toNumber()).toBe(0)
    expect(offlineStoryPoints(Number.NaN, 8 * 3600, 0.5).toNumber()).toBe(0)
  })
})

describe('what qualifies for a report — GDD §24.5, §24.8', () => {
  it('needs at least 30 minutes away', () => {
    expect(OFFLINE_MIN_SECONDS).toBe(30 * 60)
    expect(offlineYield(snapshot(), config(), T0 + 29 * 60_000).qualifies).toBe(false)
    expect(offlineYield(snapshot(), config(), T0 + 31 * 60_000).qualifies).toBe(true)
  })

  it('pays nothing at all before the first Paradigm Shift', () => {
    // §21 paces Run 1 at four minutes and scripts every beat of it.
    const report = offlineYield(snapshot(), config({ unlocked: false }), T0 + 8 * HOUR)
    expect(report.qualifies).toBe(false)
    expect(report.paidSeconds).toBe(0)
    expect(report.storyPoints.toNumber()).toBe(0)
  })
})

describe('what accrues — GDD §24.6', () => {
  it('fills the burn-down and clamps at 100% without CI/CD Autopilot', () => {
    // The project sits complete, waiting on the player's ship. Shipping is a
    // decision until L2-2B is the thing that says otherwise.
    const report = offlineYield(snapshot({ velocity: 1000 }), config(), T0 + 2 * HOUR)
    expect(report.burned.toNumber()).toBe(1000)
    expect(report.projectsShipped).toBe(0)
    expect(report.revenue.toNumber()).toBe(0)
    expect(report.projectIndex).toBe(0)
  })

  it('chain-ships and banks revenue with CI/CD Autopilot', () => {
    // 7,200 SP over the cap against a 1,000 SP ladder: seven ships, 200 left.
    const report = offlineYield(
      snapshot({ velocity: 1, autoShip: true }),
      config({ capSeconds: 7200, rateMultiplier: 1 }),
      T0 + 2 * HOUR,
    )
    expect(report.projectsShipped).toBe(7)
    expect(report.projectIndex).toBe(7)
    expect(report.burned.toNumber()).toBe(200)
    expect(report.revenue.toNumber()).toBeCloseTo(7 * 1000 * 0.05, 10)
  })

  it('walks the real ladder, not one repeated commitment', () => {
    const ladder = [1000, 2500, 8000]
    const report = offlineYield(
      snapshot({
        velocity: 1,
        autoShip: true,
        commitmentFor: (i) => new Decimal(ladder[Math.min(i, ladder.length - 1)]),
      }),
      config({ capSeconds: 4000, rateMultiplier: 1 }),
      T0 + 2 * HOUR,
    )
    // 4,000 SP ships the 1,000 and leaves 3,000 against a 2,500 commitment,
    // which ships too — leaving 500 of the 8,000.
    expect(report.projectsShipped).toBe(2)
    expect(report.commitment.toNumber()).toBe(8000)
    expect(report.burned.toNumber()).toBe(500)
  })

  it('is bounded against a degenerate ladder rather than hanging on app open', () => {
    const report = offlineYield(
      snapshot({ velocity: 1e6, autoShip: true, commitmentFor: () => new Decimal(1) }),
      config({ capSeconds: 7200, rateMultiplier: 1 }),
      T0 + 2 * HOUR,
    )
    expect(report.projectsShipped).toBe(MAX_OFFLINE_SHIPS)
    expect(report.shipCapReached).toBe(true)
  })

  it('does not advance a zero-cost project ladder at all', () => {
    const report = offlineYield(
      snapshot({ commitment: new Decimal(0), commitmentFor: () => new Decimal(0), autoShip: true }),
      config(),
      T0 + 2 * HOUR,
    )
    expect(report.projectsShipped).toBe(0)
    expect(report.burned.toNumber()).toBe(0)
  })
})

describe('the 2x rewarded offer is the same code path — MONETISATION §4 R1', () => {
  it('doubles the rate rather than post-multiplying the total', () => {
    const single = offlineYield(snapshot(), config(), T0 + HOUR)
    const doubled = offlineYield(snapshot(), config({ rateMultiplier: 1 }), T0 + HOUR)
    expect(doubled.storyPoints.toNumber()).toBeCloseTo(2 * single.storyPoints.toNumber(), 6)
  })

  it('can ship a further project at 2x, which post-multiplying would miss', () => {
    const snap = snapshot({ velocity: 1, autoShip: true })
    const single = offlineYield(snap, config({ capSeconds: 1500, rateMultiplier: 1 }), T0 + HOUR)
    const doubled = offlineYield(snap, config({ capSeconds: 1500, rateMultiplier: 2 }), T0 + HOUR)
    expect(single.projectsShipped).toBe(1)
    expect(doubled.projectsShipped).toBe(3)
  })
})
