/**
 * Man-weeks — the unit the player is doing arithmetic in, and the one the game
 * is about being wrong.
 *
 * Every readout in §10.1 reports what the studio *is doing*: velocity, entropy,
 * cash. None of them reports what the player **thinks** it is doing, and that
 * gap is the entire premise. Nobody looks at forty developers and estimates
 * their throughput off a load curve. They think *forty people, forty
 * man-weeks a week*, because that is how software has been costed for fifty
 * years and it is the assumption The Mythical Man-Month is named after.
 *
 * So this readout states the assumption out loud and puts the truth directly
 * underneath it:
 *
 *     MAN-WEEKS   40 ON PAPER
 *                 28 DELIVERED
 *
 * It is the same information §4.3's Entropy speedometer carries and it is not
 * a duplicate, because a percentage is a fact about a *system* and a missing
 * twelve man-weeks is a fact about *your plan*. One of those is a readout and
 * the other is a grievance. At the Act IV headcount it reads a thousand on
 * paper and eight delivered, which is the joke the whole run is built toward,
 * stated in the units of the plan that produced it.
 *
 * Pure, and in the same family as `hudModel.ts` and `revenueModel.ts`: the two
 * things here that can be *wrong* — the conversion and the wording of the gap —
 * are answerable without a DOM.
 */

import { SP_PER_DEV_PER_SEC } from '../sim/entropy.ts'

export interface ManWeekReport {
  /**
   * What the plan says. One developer for one week is one man-week, so a studio
   * of forty commits forty of them a week — and that number needs no model,
   * which is exactly why it is the one people trust.
   */
  planned: number
  /** What the §4.1 load curve actually delivers, in the same unit. */
  delivered: number
  /** The difference. §6's lesson, denominated in the planner's own currency. */
  lost: number
  /** `delivered / planned`, 0..1. Drives the colour and nothing else. */
  ratio: number
}

/**
 * `velocity` is Story Points per second — the studio's real output, already
 * taxed by §4.1. One developer at full efficiency produces
 * {@link SP_PER_DEV_PER_SEC}, so dividing by it converts an output back into
 * *the number of people that output is worth*, which is a man-week rate.
 */
export function manWeekReport(devs: number, velocity: number): ManWeekReport {
  const planned = Math.max(0, devs)
  const delivered = Math.max(0, velocity / SP_PER_DEV_PER_SEC)
  return {
    planned,
    delivered,
    lost: Math.max(0, planned - delivered),
    // A studio of nobody is not underperforming, it is empty. Reporting 0/0 as
    // a total collapse would paint Act I's opening frame red.
    ratio: planned > 0 ? Math.min(1, delivered / planned) : 1,
  }
}

/**
 * How far gone the plan is, as a band rather than a number.
 *
 * Three, and the thresholds are §4.3a's rather than new ones: the readout has
 * to change colour on the same beat the speedometer does, or the interface is
 * telling the player two different stories about one situation.
 */
export type PlanState = 'holding' | 'slipping' | 'gone'

export function planState(ratio: number): PlanState {
  if (ratio >= 0.75) return 'holding'
  if (ratio >= 0.3) return 'slipping'
  return 'gone'
}

/**
 * Short form for the rail — `40`, `1.2K`, `8.4M`.
 *
 * One decimal below a hundred and none above, the same rule
 * `headcount.formatCount` uses, because these two numbers sit one above the
 * other on screen and a different rounding between them would read as a
 * different quantity.
 */
export function formatManWeeks(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  const abs = Math.abs(n)
  for (const [at, suffix] of [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ] as const) {
    if (abs >= at) {
      const scaled = n / at
      return `${scaled < 100 ? scaled.toFixed(1) : Math.round(scaled)}${suffix}`
    }
  }
  // Below ten, a decimal — because the *interesting* case is a studio of a
  // thousand delivering 8.4, and rounding that to 8 throws away the precision
  // at the one headcount where the gap is the point.
  if (abs >= 10) return String(Math.round(n))
  return n.toFixed(1).replace(/\.0$/, '')
}
