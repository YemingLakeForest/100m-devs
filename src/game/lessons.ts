/**
 * What a run taught — GDD §15.1a.
 *
 * §21's bankruptcy screen has printed one lesson since the game had an ending:
 *
 * > LESSON LEARNED: Manpower without Communication Infrastructure is Chaos.
 *
 * That is §6, it is the right line for Run 1, and it is the *only* line. Every
 * run after the first ends in silence — the player presses `TRIGGER PARADIGM
 * SHIFT`, the studio is liquidated, and nothing anywhere says what happened or
 * why it stopped. §13.12's whole argument for a prestige ladder is that a run
 * ends and you know something you did not know before; the game was never
 * saying the second half out loud.
 *
 * So a shift picks a lesson **from the run that just ended**, and it is chosen
 * by measurement rather than by a script. That distinction is the design:
 *
 * - A fixed list indexed by shift number is a story, and a player on their
 *   fourth run would read a lesson about a mistake they did not make.
 * - A lesson derived from the studio's own final state is a *reading*, and it
 *   can be checked against the numbers that were on screen ten seconds ago.
 *
 * The ledger is a **set**, not a log (`PermanentSave.meta.lessons`). A player
 * who hits the same wall twice has not learned a second thing, and a list that
 * repeats itself is a list nobody finishes reading. It also means the ledger is
 * bounded by this file rather than by how long somebody plays.
 *
 * Pure — no store, no clock, no renderer.
 */

import { RHO } from '../sim/entropy.ts'
import { BASELINE_RATING } from '../sim/rating.ts'

/**
 * Stable ids. They go into `meta.lessons`, which is unioned across saves like
 * `milestones` (§24.3), so **never renumber one** — the text below may be
 * rewritten freely, and the id is what a save is holding.
 */
export type LessonId =
  | 'lesson.entropy'
  | 'lesson.payroll'
  | 'lesson.protocol'
  | 'lesson.optimum'
  | 'lesson.capacity'
  | 'lesson.quality'
  | 'lesson.patience'

/**
 * The catalogue. One line each, present tense, no second sentence.
 *
 * They are written as *rules about studios*, not as notes about the player's
 * run. "You hired too many people" is a scolding; "past three quarters of
 * capacity, every hire makes the studio slower" is a thing the player can go and
 * use, which is the only kind of lesson worth printing on a screen they are
 * about to leave.
 */
export const LESSONS: Record<LessonId, string> = {
  // §6, verbatim from §21's bankruptcy screen. Run 1's, and only Run 1's.
  'lesson.entropy': 'Manpower without Communication Infrastructure is Chaos.',
  'lesson.payroll': 'Payroll is a clock. It does not stop when the studio does.',
  'lesson.protocol': 'Nothing raises the ceiling except the board.',
  'lesson.optimum': 'Past three quarters of capacity, every hire makes the studio slower.',
  'lesson.capacity': 'Capacity is bought, not hired.',
  'lesson.quality': 'A game nobody trusts earns like a game nobody played.',
  'lesson.patience': 'A run is over when it stops teaching you anything.',
}

/** The state a lesson is read off. A snapshot, not `GameState`, so it stays testable. */
export interface RunEnding {
  /** Shifts *after* this one. The first shift is 1. */
  shift: number
  /** Did the run end on §4.10's bankruptcy threshold? */
  bankrupt: boolean
  /** §4.1's load: headcount over the effective cap. */
  load: number
  /** Cash in the bank at the shift. */
  cash: number
  /** §4.14's standing. */
  reputation: number
  /** §11 — nodes the player *bought*, not counting the granted centre. */
  techNodesBought: number
}

/**
 * §4.1's optimum, as a load — `(ρ−1)^(−1/ρ)`, about 0.758.
 *
 * Derived rather than written down, and derived *here* rather than imported
 * from `optimalHeadcount`, because that function answers "how many people" and
 * this rule is about the ratio. ρ is the one knob §4.1 says is most likely to
 * move, and a lesson that stopped agreeing with the curve would be the game
 * teaching a number it no longer uses.
 */
export const OPTIMUM_LOAD = (RHO - 1) ** (-1 / RHO)

/**
 * What this run taught — the first rule that fits, top to bottom.
 *
 * Order is the design and it is worth reading as a sentence: **the trap, then
 * the way the studio died, then the thing it never bought, then the two ways it
 * was mis-sized, then the way it was disliked, then the honest shrug.** Each
 * rule is only reached when every louder one is false, so a studio that went
 * broke never gets told about its capacity — going broke is the larger fact.
 */
export function lessonFor(end: RunEnding): LessonId {
  // Run 1 is §6's trap and it teaches §6's lesson. It is not a measurement and
  // it must not become one: the trap is scripted, the player had no control
  // over the collapse, and reading their final state would produce a lesson
  // about a decision James made for them.
  if (end.shift <= 1) return 'lesson.entropy'

  // A studio that went broke has one fact about it that outranks the rest.
  if (end.bankrupt) return 'lesson.payroll'

  // §11's board is the only thing in the game that raises §4.2's cap from the
  // inside. A run that never opened it hit a ceiling it had been handed a key to.
  if (end.techNodesBought <= 0) return 'lesson.protocol'

  // §4.1's falling half, which is the whole thesis, felt rather than described.
  if (end.load > OPTIMUM_LOAD) return 'lesson.optimum'

  // The other side of the same curve: a studio pressed against its cap with
  // money spare is a studio that needed a bigger cap and bought people instead.
  if (end.load >= 0.9 * OPTIMUM_LOAD && end.cash > 0) return 'lesson.capacity'

  // §4.14 — the run was the right size and shipped badly anyway.
  if (end.reputation < BASELINE_RATING) return 'lesson.quality'

  // Nothing was wrong. §13.12's stall is a real way for a run to end and it
  // deserves a line that does not invent a mistake to explain it.
  return 'lesson.patience'
}

/**
 * The ledger, with this run's lesson folded in — a **set**, in catalogue order.
 *
 * Catalogue order rather than order-learned, so the list a player reads on their
 * ninth shift is the same list in the same places it was on their eighth. A
 * ledger that reshuffles is a ledger you have to re-read.
 */
export function ledgerWith(known: readonly string[], learned: LessonId): LessonId[] {
  const held = new Set<string>([...known, learned])
  return (Object.keys(LESSONS) as LessonId[]).filter((id) => held.has(id))
}
