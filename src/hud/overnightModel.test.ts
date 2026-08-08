import { describe, expect, it } from 'vitest'
import Decimal from 'break_infinity.js'
import {
  ROW_STAGGER_MS,
  doubleLabel,
  formatAway,
  idleLine,
  reportRows,
  rowDelay,
  shouldShowReport,
  totalDelay,
} from './overnightModel.ts'
import type { OfflineReport } from '../sim/offline.ts'

function report(over: Partial<OfflineReport> = {}): OfflineReport {
  return {
    elapsedSeconds: 8 * 3600,
    paidSeconds: 2 * 3600,
    idleSeconds: 0,
    qualifies: true,
    storyPoints: new Decimal(4200),
    burned: new Decimal(0),
    commitment: new Decimal(1000),
    projectIndex: 0,
    projectsShipped: 0,
    revenue: new Decimal(0),
    shipCapReached: false,
    ...over,
  }
}

describe('rows — GDD §24.8', () => {
  it('never renders a zero row', () => {
    // "A row with a zero value is not rendered, never rendered as 0." A report
    // listing PROJECTS SHIPPED 0 draws attention to a thing that did not
    // happen, at the exact moment the screen is meant to feel like a reward.
    const keys = reportRows(report()).map((r) => r.key)
    expect(keys).not.toContain('shipped')
    expect(keys).not.toContain('revenue')
  })

  it('renders them once they are non-zero', () => {
    const keys = reportRows(
      report({ projectsShipped: 3, revenue: new Decimal(150) }),
    ).map((r) => r.key)
    expect(keys).toEqual(['away', 'storyPoints', 'shipped', 'revenue'])
  })

  it('always shows time away, because it is the premise not a result', () => {
    const keys = reportRows(report({ storyPoints: new Decimal(0) })).map((r) => r.key)
    expect(keys).toEqual(['away'])
  })

  it('shows the PAID time, not the elapsed time', () => {
    // The player was away eight hours and paid for two. Showing eight beside a
    // two-hour payout invites the obvious question and answers it badly; the
    // honest disclosure is the separate BUILD SERVER IDLE line.
    const rows = reportRows(report({ elapsedSeconds: 28800, paidSeconds: 7200 }))
    expect(rows[0].value).toBe(7200)
  })
})

describe('the headline lands last — §24.8', () => {
  it('starts after every row has started', () => {
    // "So it reads as a summation rather than a lookup."
    for (const count of [1, 2, 3, 4]) {
      expect(totalDelay(count)).toBeGreaterThan(rowDelay(count - 1))
    }
  })

  it('staggers rows rather than revealing a finished table', () => {
    expect(rowDelay(1) - rowDelay(0)).toBe(ROW_STAGGER_MS)
    expect(ROW_STAGGER_MS).toBeGreaterThanOrEqual(40)
    expect(ROW_STAGGER_MS).toBeLessThanOrEqual(60)
  })
})

describe('time away formatting', () => {
  it('is read at a glance, not timed', () => {
    expect(formatAway(2 * 3600 + 14 * 60)).toBe('2h 14m')
    expect(formatAway(3600)).toBe('1h')
    expect(formatAway(14 * 60)).toBe('14m')
    expect(formatAway(45)).toBe('45s')
  })

  it('never goes negative on a tampered clock', () => {
    expect(formatAway(-500)).toBe('0s')
  })
})

describe('the cap sell — §24.8', () => {
  it('stays silent when nothing was actually lost', () => {
    // A nag that fires when the player lost nothing is just a nag.
    expect(idleLine(report({ idleSeconds: 0 }))).toBeNull()
  })

  it('states plainly what was thrown away', () => {
    expect(idleLine(report({ idleSeconds: 3 * 3600 + 12 * 60 }))).toBe(
      'BUILD SERVER IDLE — 3h 12m',
    )
  })
})

describe('the rewarded offer — MONETISATION §4', () => {
  it('names the exact reward on the button face, never a question mark', () => {
    // The player is told what they are being offered before spending thirty
    // seconds on an ad. That is the difference between an offer and a gamble.
    const label = doubleLabel(report({ storyPoints: new Decimal(4200) }))
    expect(label).toContain('8.4K')
    expect(label).not.toContain('?')
  })
})

describe('whether the report shows at all', () => {
  it('does not show for an absence that earned nothing', () => {
    expect(shouldShowReport(report({ storyPoints: new Decimal(0) }))).toBe(false)
  })

  it('does not show when the absence did not qualify', () => {
    expect(shouldShowReport(report({ qualifies: false }))).toBe(false)
  })

  it('shows when something was actually earned', () => {
    expect(shouldShowReport(report())).toBe(true)
  })

  it('handles no report at all', () => {
    expect(shouldShowReport(null)).toBe(false)
  })
})
