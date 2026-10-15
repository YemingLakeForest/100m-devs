/**
 * What the liquidation screen says — GDD §21 Act V, §15.1a.
 *
 * Pure — no store, no renderer. The panel passes in what the studio was.
 *
 * **There are two bankruptcies and the screen only knew one** [2026-10-15].
 * Run 1's is §6's trap, scripted: a thousand people arrive on a promo, the
 * studio seizes, and the line *"Your 1,000 developers spent 100% of their time
 * arguing in Slack and zero seconds coding"* is exactly true. It was also the
 * text of every bankruptcy after it. A player who hired hard in Run 2, went
 * under at twenty-three developers with five games shipped, and was told they
 * had a thousand developers and no revenue, learned two things: that the
 * screen was not about them, and that the game does not know what happened.
 * Both are worse than the bankruptcy.
 *
 * The rule `lessons.ts` already states for the *shift* applies to the panel in
 * front of it: Run 1 teaches §6 and is a script; every run after it is
 * **a reading of the studio that actually ended**. So Run 2 onward prints that
 * run's own numbers and the payroll lesson, which is the one `lessonFor`
 * would have picked for a bankrupt studio anyway.
 */

import { LESSONS, RUN_ONE_WAY_OUT } from '../game/lessons.ts'
import { plateCaption, workLabel } from './collapseModel.ts'
import { formatMoney } from './hudModel.ts'

/** Founder and James: the two people who did the work before the Mass Hire. */
export const STARTING_HEADS = 2

/**
 * The studio terminal's line for a later run's bankruptcy.
 *
 * The CRT on the rail prints `PHASE_COPY.bankrupt` — Run 1's script — for every
 * run, so it said "Your 1,000 developers spent 100% of their time arguing in
 * Slack" under the modal that had just stopped saying it. **No numbers in it, on
 * purpose**: the terminal is a typewriter and re-types when its text changes,
 * and the studio's headcount keeps moving while the liquidation runs.
 */
export const LATER_RUN_TERMINAL: readonly string[] = [
  '** BANKRUPTCY **',
  'The money stopped before the next game did.',
  '',
  'LESSON LEARNED:',
  LESSONS['lesson.payroll'],
]

export interface BankruptcyInput {
  /** Has the player been through a Paradigm Shift? Run 1 is the one that has not. */
  prestiged: boolean
  devs: number
  /** §4.2's cap, for Run 1's curve. */
  cap: number
  /** This run's revenue — run-local, cleared by every shift. */
  revenue: number
  /** Dollars a second the studio was paying. */
  payroll: number
  /** What the studio was actually getting done: `devs × efficiency`, ceilings and all. */
  work: number
}

export interface BankruptcyReceipt {
  story: string
  result: string
  sums: readonly [string, string]
  lesson: readonly string[]
}

export function bankruptcyReceipt(i: BankruptcyInput): BankruptcyReceipt {
  const devs = Math.floor(i.devs)

  if (!i.prestiged) {
    return {
      story: 'Your 1,000 developers spent 100% of their time arguing in Slack and zero seconds coding.',
      result: '$0 REVENUE — TOTAL LIQUIDATION',
      sums: [
        `${STARTING_HEADS} DEVELOPERS: ${plateCaption(STARTING_HEADS, i.cap).work} DEVELOPERS’ WORTH OF WORK`,
        `${devs.toLocaleString()} DEVELOPERS: ${plateCaption(i.devs, i.cap).work} DEVELOPERS’ WORTH OF WORK`,
      ],
      lesson: [LESSONS['lesson.entropy'], RUN_ONE_WAY_OUT],
    }
  }

  return {
    story: `${devs.toLocaleString()} developers drew ${formatMoney(i.payroll)} a second, and the money stopped before the next game did.`,
    // Shorter than Run 1's pair on purpose: the box is thirty-eight glyphs wide and
    // a headcount with a comma in it made "DEVELOPERS’ WORTH OF WORK" an orphan.
    result: `${formatMoney(i.revenue)} REVENUE — TOTAL LIQUIDATION`,
    sums: [
      `${devs.toLocaleString()} DEVELOPERS DID ${workLabel(i.work)} DEVELOPERS’ WORK`,
      `PAYROLL: ${formatMoney(i.payroll)}/SEC`,
    ],
    lesson: [LESSONS['lesson.payroll']],
  }
}
