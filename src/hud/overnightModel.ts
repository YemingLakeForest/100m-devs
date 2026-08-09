/**
 * The Overnight Build Report, as data — GDD §24.8.
 *
 * The screen itself is `OvernightReport.tsx`; everything that decides *what it
 * says* lives here so it can be tested without a renderer. That split matters
 * more than usual for this screen: §24.8 has rules that are invisible from a
 * screenshot — a zero row is not rendered rather than rendered as `0`, the
 * headline lands after the rows, the 2× button disappears rather than greying
 * out — and each of them is the kind of thing that quietly stops being true.
 */

import type Decimal from 'break_infinity.js'
import type { OfflineReport } from '../sim/offline.ts'

/** §10.8a — rows reveal on a stagger, never as a finished table. */
export const ROW_STAGGER_MS = 50
/** The headline total tweens up after the last row, so it reads as a summation. */
export const TOTAL_DELAY_MS = 260

export interface ReportRow {
  key: 'away' | 'storyPoints' | 'shipped' | 'revenue'
  label: string
  /** Rendered by `Counter` where numeric, so it rolls and bounces. */
  value: number
  format: (n: number) => string
}

/**
 * `2h 14m`, `14m`, `45s`.
 *
 * Whole units only and never more than two of them: this number is read once,
 * at a glance, by somebody who has just picked the phone up. `2h 14m 09s` is
 * a stopwatch, and nobody is timing anything.
 */
export function formatAway(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

/** Short-form a Decimal for a report row. */
function num(d: Decimal): number {
  const n = d.toNumber()
  return Number.isFinite(n) ? n : 0
}

function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

/**
 * The rows this report actually shows — §24.8.
 *
 * "A row with a zero value is **not rendered**, never rendered as `0`." A
 * report that lists `PROJECTS SHIPPED  0` is telling the player about a thing
 * that did not happen, which is worse than saying nothing: it draws attention
 * to the absence at the exact moment the screen is supposed to feel like a
 * reward.
 *
 * Time away is the one row that always shows, because it is the premise of the
 * screen rather than a result.
 */
export function reportRows(report: OfflineReport): ReportRow[] {
  const rows: ReportRow[] = [
    {
      key: 'away',
      label: 'TIME AWAY',
      value: report.paidSeconds,
      format: formatAway,
    },
  ]

  const sp = num(report.storyPoints)
  if (sp > 0) {
    rows.push({ key: 'storyPoints', label: 'STORY POINTS', value: sp, format: compact })
  }
  if (report.projectsShipped > 0) {
    rows.push({
      key: 'shipped',
      label: 'PROJECTS SHIPPED',
      value: report.projectsShipped,
      format: (n) => String(Math.round(n)),
    })
  }
  const revenue = num(report.revenue)
  if (revenue > 0) {
    rows.push({ key: 'revenue', label: 'REVENUE', value: revenue, format: (n) => `$${compact(n)}` })
  }

  return rows
}

/** When row `i` starts revealing, in ms from the screen appearing. */
export function rowDelay(i: number): number {
  return i * ROW_STAGGER_MS
}

/** When the headline total starts. After every row — §24.8. */
export function totalDelay(rowCount: number): number {
  return rowDelay(Math.max(0, rowCount - 1)) + TOTAL_DELAY_MS
}

/**
 * The `BUILD SERVER IDLE` line, or null — §24.8.
 *
 * "The diegetic sell for the cap raise and it is the honest one: the player is
 * being shown what they actually lost." Only ever shown when time was genuinely
 * thrown away, because a nag that fires when nothing was lost is just a nag.
 */
export function idleLine(report: OfflineReport): string | null {
  if (report.idleSeconds <= 0) return null
  return `BUILD SERVER IDLE — ${formatAway(report.idleSeconds)}`
}

/**
 * The 2× button's label — MONETISATION §4 forbids a `?` on the button face.
 *
 * The player is told exactly what they are being offered before they spend
 * thirty seconds on an ad, which is the difference between an offer and a
 * gamble.
 */
export function doubleLabel(report: OfflineReport): string {
  const sp = num(report.storyPoints)
  return `WATCH AD FOR ${compact(sp * 2)} STORY POINTS`
}

/**
 * Should the report render at all?
 *
 * `qualifies` already encodes §24.5's minimum absence and the offline unlock;
 * this adds the one thing the model cannot know — whether anything was
 * actually earned. A report with nothing in it is worse than no report.
 */
export function shouldShowReport(report: OfflineReport | null): report is OfflineReport {
  if (!report || !report.qualifies) return false
  return num(report.storyPoints) > 0 || report.projectsShipped > 0
}
