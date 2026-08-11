/**
 * Support — the tickets do not stop. GDD §4.13, R22, R30.
 *
 * Where §4.12's defects are about the product and §4.12a's incidents are about
 * the servers, tickets are about **the people who bought it**, and they behave
 * completely differently from both: defects can be driven to zero, incidents can
 * be closed, **tickets cannot.**
 *
 * $$\\frac{dT}{dt} = \\tau \\cdot (\\text{catalogue}) + \\sigma \\cdot B$$
 *
 * Two terms, and the second is the interesting one. **Tickets scale with your
 * back catalogue, not with what you are currently building.** §4.10e's catalogue
 * is already the thing that pays the bills; this makes it the thing that also
 * sends the bill. The bigger your body of work, the larger the standing army you
 * need for games you finished years ago, and **no upgrade ever removes that
 * floor.**
 *
 * ---
 *
 * ## The two coefficients are stated as headcounts, not as rates
 *
 * `roles.ts` sets {@link TICKETS_PER_SUPPORT_PER_SEC} to 1 explicitly so that
 * "the arrival rate in `support.ts` is readable directly as *how many people
 * this catalogue needs*". This file is what honours that, and it is why neither
 * constant below is written as a rate:
 *
 * - {@link GAMES_PER_SUPPORT_HEAD} — **ten shipped games need one support
 *   head, forever.** That is §4.13's floor, stated as the sentence a player
 *   would say, and τ is derived from it.
 * - {@link DEFECTS_PER_SUPPORT_HEAD} — **a hundred outstanding defects need one
 *   more.** σ derived the same way.
 *
 * A designer retuning this should change the headcount and let the rate follow.
 * Changing the rate directly is how the one legible thing about this system
 * stops being legible.
 *
 * ## Why throwing people at this simply works
 *
 * §4.13: "Support capacity is headcount, straightforwardly. This is the one part
 * of the game where throwing people at a problem simply works, which is a
 * deliberate exception: it is the only place §6's dilution does not apply, and
 * **the exception is what makes the rule visible.**"
 *
 * So there is no §4.1 term anywhere in this file, and there must never be one.
 * Two support heads answer twice as many tickets whether the studio is four
 * people or four billion, and a player who notices that has understood §6 from
 * the outside.
 *
 * ## And it is not allowed to be a fail state
 *
 * §4.12's standing warning covers all three backlogs: §6.3's Entropy Lock is the
 * game's one seizure and a second one would read as the game being broken. A
 * studio drowning in tickets loses a *share* of its catalogue revenue —
 * {@link MIN_CATALOGUE_MULTIPLIER}, never zero — and never loses the ability to
 * click, ship or hire.
 *
 * Pure. No store, no clock, no renderer.
 */

import { supportCapacity, TICKETS_PER_SUPPORT_PER_SEC } from './roles.ts'

/**
 * Shipped games one support head can carry — §4.13's permanent floor.
 *
 * Ten, which makes the floor visible early without making it the whole game:
 * a studio with a five-game catalogue needs half a person and will not notice,
 * and one with eighty games needs eight and very much will.
 */
export const GAMES_PER_SUPPORT_HEAD = 10

/** Outstanding defects one support head can absorb — the `σ·B` term. */
export const DEFECTS_PER_SUPPORT_HEAD = 100

/** §4.13's `τ`. Derived from {@link GAMES_PER_SUPPORT_HEAD}, never written directly. */
export const TAU = TICKETS_PER_SUPPORT_PER_SEC / GAMES_PER_SUPPORT_HEAD

/** §4.13's `σ`. Derived from {@link DEFECTS_PER_SUPPORT_HEAD}. */
export const SIGMA = TICKETS_PER_SUPPORT_PER_SEC / DEFECTS_PER_SUPPORT_HEAD

/**
 * How long a queue may take to clear before the catalogue starts to notice.
 *
 * Five minutes of studio time, measured as *wait* rather than as depth, because
 * depth alone says nothing: two hundred tickets is a crisis for one person and a
 * quiet morning for fifty. Wait is the quantity a player is actually managing
 * and it is the one the §4.15 bar is legible in.
 */
export const TICKET_PATIENCE_SECONDS = 300

/**
 * The worst the catalogue can be suppressed to — §4.13, and §4.12's warning.
 *
 * Four-fifths. Deliberately mild: this is a standing tax on money the player has
 * already earned, applied to games they finished long ago, and a harsh one would
 * make the correct play "stop shipping", which inverts the entire game.
 */
export const MIN_CATALOGUE_MULTIPLIER = 0.8

function finite(x: number, fallback = 0): number {
  return Number.isFinite(x) ? x : fallback
}

/**
 * Tickets arriving per second — §4.13.
 *
 * `catalogue` is the number of games ever shipped, not the number currently on
 * sale. That distinction is the section's whole point: §4.10e retires a release
 * from the *economy* after four minutes and the people who bought it do not
 * retire with it. **Support is the one system in the game with no decay in it.**
 */
export function ticketRate(catalogue: number, defectBacklog: number): number {
  const games = Math.max(0, finite(catalogue))
  const defects = Math.max(0, finite(defectBacklog))
  return TAU * games + SIGMA * defects
}

/**
 * Heads needed to exactly keep up — the readout §4.13 is really about.
 *
 * Exported because it is what §4.15's bar compares against and what the hire
 * dial should be able to say out loud: *"this catalogue needs six people."*
 */
export function headsNeeded(catalogue: number, defectBacklog: number): number {
  return ticketRate(catalogue, defectBacklog) / TICKETS_PER_SUPPORT_PER_SEC
}

export interface TicketStep {
  /** Tickets still waiting. */
  queue: number
  /** Answered over this step. */
  served: number
}

/**
 * Advance the queue one step.
 *
 * Arrivals are added before service, so a studio with exactly enough capacity
 * holds a flat queue rather than drifting one tick's worth of tickets deep — the
 * ordering is the difference between "keeping up" reading as stable and reading
 * as slowly losing.
 */
export function advanceTickets(
  queue: number,
  catalogue: number,
  defectBacklog: number,
  supportHeads: number,
  dt: number,
): TicketStep {
  const step = Math.max(0, finite(dt))
  const start = Math.max(0, finite(queue))
  if (step === 0) return { queue: start, served: 0 }

  const arrived = ticketRate(catalogue, defectBacklog) * step
  const waiting = start + arrived
  const served = Math.min(waiting, supportCapacity(supportHeads) * step)
  return { queue: waiting - served, served }
}

/**
 * Seconds to clear the queue at current capacity — `Infinity` with nobody on it.
 *
 * An empty queue is zero wait whatever the capacity, which is the one case where
 * "no support heads" is not a problem and the readout should not shout about it.
 */
export function clearanceWait(queue: number, supportHeads: number): number {
  const q = Math.max(0, finite(queue))
  if (q === 0) return 0
  const capacity = supportCapacity(supportHeads)
  return capacity > 0 ? q / capacity : Infinity
}

/**
 * What unanswered tickets do to §4.10e's catalogue income — §4.13.
 *
 * "Unanswered tickets suppress revenue, and they do it on the catalogue rather
 * than on the current project — **you are losing money on the games you already
 * made.**"
 *
 * Applied to catalogue income only. The current project's ship payout is
 * untouched, which is what keeps the loop intact while the tax bites: a player
 * in trouble can always still ship their way out, and that is deliberate.
 */
export function catalogueMultiplier(queue: number, supportHeads: number): number {
  const wait = clearanceWait(queue, supportHeads)
  if (wait === 0) return 1
  if (!Number.isFinite(wait)) return MIN_CATALOGUE_MULTIPLIER
  const raw = 1 / (1 + wait / TICKET_PATIENCE_SECONDS)
  return Math.max(MIN_CATALOGUE_MULTIPLIER, raw)
}

/** §4.15's bar — below 1 is falling behind, at or above is keeping up. */
export function serviceRatio(catalogue: number, defectBacklog: number, supportHeads: number): number {
  const arriving = ticketRate(catalogue, defectBacklog)
  if (!(arriving > 0)) return Infinity
  return supportCapacity(supportHeads) / arriving
}
