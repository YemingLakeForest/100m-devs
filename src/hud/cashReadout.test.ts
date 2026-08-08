/**
 * What the cash readout says, and when it panics — GDD §4.10d.
 *
 * The readout coloured on `cash < 0`, which sounds obviously right and became
 * obviously wrong the moment §4.10c made revenue arrive **on ship**: payroll
 * runs continuously and payouts land in lumps, so a healthy studio spends most
 * of every project overdrawn on its way to a large cheque. The interface was
 * telling that player they were failing while they were winning.
 */

import { describe, expect, it } from 'vitest'
import { BANKRUPTCY_THRESHOLD, isCashCritical, payrollPerSecond } from '../sim/economy.ts'
import { payoutReadout } from './hudModel.ts'

describe('isCashCritical — the alarm predicate', () => {
  it('does not panic about a hole the next payout closes', () => {
    // Forty developers, eleven thousand in the red, eighty seconds from a
    // half-million-dollar ship. This is the exact frame that started §4.10d,
    // and it is a studio in perfect health.
    expect(isCashCritical(-11_800, 40, 80)).toBe(false)
  })

  it('panics when the payout cannot be reached', () => {
    // The same overdraft, with the ship far enough away that the burn crosses
    // the threshold first. This is the only case that is actually an emergency.
    const devs = 40
    const secondsToThreshold = (0 - BANKRUPTCY_THRESHOLD) / payrollPerSecond(devs)
    expect(isCashCritical(0, devs, secondsToThreshold + 60)).toBe(true)
    expect(isCashCritical(0, devs, secondsToThreshold - 60)).toBe(false)
  })

  it('treats a seized studio as the emergency it is', () => {
    // §21 Act V — production has stopped, so no payout is coming and
    // `secondsToPayout` is Infinity. A negative balance there really is a slow
    // death, and inventing a reassurance for that beat would undo it.
    expect(isCashCritical(-1, 1_040, Number.POSITIVE_INFINITY)).toBe(true)
    expect(isCashCritical(500_000, 1_040, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('never panics in the garage, where nobody is paid', () => {
    // §4.10 — two unpaid founders. With no burn there is no runway to run out
    // of, and the only failure left is the bankruptcy floor itself.
    expect(isCashCritical(-100, 2, 30)).toBe(false)
    expect(isCashCritical(BANKRUPTCY_THRESHOLD - 1, 2, 30)).toBe(true)
  })

  it('is monotone in cash — more money is never more critical', () => {
    for (const t of [10, 60, 300]) {
      expect(isCashCritical(50_000, 40, t)).toBe(false)
      if (isCashCritical(-500_000, 40, t)) {
        expect(isCashCritical(-900_000, 40, t)).toBe(true)
      }
    }
  })
})

describe('payoutReadout — the missing half of the number', () => {
  it('names the amount and the wait', () => {
    expect(payoutReadout(550_000, 82)).toBe('+$550.0K IN 82s')
  })

  it('says nothing when nothing is coming', () => {
    // A seized studio gets no reassurance, because none is true.
    expect(payoutReadout(550_000, Number.POSITIVE_INFINITY)).toBeNull()
    expect(payoutReadout(0, 30)).toBeNull()
  })

  it('says nothing about a payout too far away to be context', () => {
    // Past about ten minutes this stops being "money is coming" and becomes a
    // countdown to something the player cannot feel.
    expect(payoutReadout(550_000, 5_000)).toBeNull()
  })

  it('never reads as zero seconds', () => {
    // A ship that is one frame away should say `1s`, not `0s` — a payout
    // arriving "in 0 seconds" that has not arrived reads as a stuck readout.
    expect(payoutReadout(1_000, 0.2)).toContain('IN 1s')
  })
})
