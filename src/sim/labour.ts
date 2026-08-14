/**
 * Labour and build time — GDD §10.11.1, §10.11.2.
 *
 * §10.11.2's labour figure is the number the entire product is about: headcount
 * integrated over build time, **not** divided by efficiency. A studio at 3%
 * efficiency spends thirty-three times the labour on the same game, and the
 * gallery says so — it is the receipt for *all* of it.
 *
 * The representation problem is that the wall clock barely moves (a project is
 * minutes at every scale) while headcount spans nine orders of magnitude, so
 * naive man-days run from `0.0014` to `1041666667`. §10.11.2's answer — the same
 * one §7.7.1 gives headcount — is a ladder of units where the number stays in a
 * 1–999 band and the *word* climbs: man-hours, man-days, man-years,
 * man-millennia, man-aeons. Two rules that matter:
 *
 * 1. The unit is spelled out, never abbreviated. `4.8 man-millennia` is the
 *    gag; `4.8 mm` is a spreadsheet.
 * 2. Each figure is shown in its *own* unit, never normalised to a column — the
 *    unit changing as the eye travels down the gallery is the readout.
 *
 * `formatBuildTime` is the other half of §10.11.1's card: the dev time elapsed
 * on one project, in plain wall-clock (simulated) terms rather than in labour.
 *
 * Pure — no store, no clock, no renderer.
 */

import { formatCount } from './headcount.ts'

const SECONDS_PER_DAY = 86400
const DAYS_PER_YEAR = 365

/**
 * One band of the ladder, in the 1–999 shape: whole numbers above a hundred,
 * one decimal in the tens, two below one. Trailing zeros stripped so `34.0`
 * reads `34` and `0.500` reads `0.5`.
 */
function band(v: number): string {
  if (v >= 100) return String(Math.round(v))
  if (v >= 1) return v.toFixed(1).replace(/\.0$/, '')
  return v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * §10.11.2 — labour in man-whatevers, the unit chosen by the magnitude.
 *
 * The rungs are the ones the section names, each roughly a thousand times the
 * last (the man-days → man-years step is 365, which the section calls "roughly
 * a thousand" and explicitly prefers to a century's ×10). Above a man-aeon the
 * word stops climbing and the number grows on §10.2's suffix ladder.
 */
export function formatLabour(labourSeconds: number): string {
  if (!Number.isFinite(labourSeconds)) return '∞ man-hours'

  const manDays = labourSeconds / SECONDS_PER_DAY
  if (manDays < 1) return `${band(labourSeconds / 3600)} man-hours`
  if (manDays < DAYS_PER_YEAR) return `${band(manDays)} man-days`

  const manYears = manDays / DAYS_PER_YEAR
  if (manYears < 1000) return `${band(manYears)} man-years`

  const manMillennia = manYears / 1000
  if (manMillennia < 1000) return `${band(manMillennia)} man-millennia`

  const manAeons = manYears / 1e6
  if (manAeons < 1000) return `${band(manAeons)} man-aeons`
  return `${formatCount(manAeons)} man-aeons`
}

/**
 * §10.11.1's "shipped" figure — how long one project took, in simulated seconds.
 *
 * Compact and monotonic: milliseconds below a second, seconds below a minute,
 * then minutes, then hours-and-minutes, then days-and-hours. A project that
 * ships in `400ms` and one that shipped in `4d 3h` are the two ends of the
 * speed story the gallery is meant to tell at a glance.
 */
export function formatBuildTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '∞'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds))}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (seconds < SECONDS_PER_DAY) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`

  const days = Math.floor(seconds / SECONDS_PER_DAY)
  const h = Math.round((seconds % SECONDS_PER_DAY) / 3600)
  return h > 0 ? `${days}d ${h}h` : `${days}d`
}
