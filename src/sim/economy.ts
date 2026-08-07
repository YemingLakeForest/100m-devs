/**
 * Cash, payroll and revenue — the Run 1 economy.
 *
 * The GDD does not specify an economy. It gives exactly two numbers, in §21:
 *
 *   Act II   "Game Published! Profit: +$50"      (2 people, first project)
 *   Act V    "Payroll Burn Rate: $50,000 / sec"  (~1,000 developers)
 *
 * Those two are irreconcilable under a flat per-developer wage: $50,000/sec
 * over 1,000 devs is $50/dev/sec, which would cost tens of thousands to ship
 * the Act II project that earns fifty dollars.
 *
 * **The resolution is in §21's own scene setting: it is a garage.** "A single
 * developer sits in a messy bedroom/garage." You and James are two friends
 * building a game, not employees — you are not drawing a salary. Payroll
 * begins with the Mass Hire, whose 1,000 developers arrive on the "FREE trial
 * promo" and start costing money the moment the promo lapses.
 *
 * That reading satisfies both stated figures exactly and needs no fudge:
 *
 *   Act II   0 paid heads          -> payroll $0/sec,      profit +$50   ✓
 *   Act V    1,000 paid heads      -> payroll $50,000/sec                ✓
 *
 * It also does the design work. §6.1 wants payroll to be the mechanism that
 * converts frozen production into bankruptcy, and this makes hiring the exact
 * moment the meter starts running.
 */

/**
 * Heads that draw no salary — you and James, in the garage.
 *
 * This is a narrative constant, not a balance knob. It is why the opening of
 * the game is survivable at all, and it is what makes the Mass Hire feel like
 * a decision rather than a button.
 */
export const UNPAID_FOUNDERS = 2

/** Dollars per paid developer per second. Derived from §21 Act V. */
export const WAGE_PER_DEV_PER_SEC = 50

/**
 * Dollars earned per Story Point shipped.
 *
 * Calibrated so *Flappy Square 1.0* (1,000 SP) pays the +$50 that §21 Act II
 * states. Every later project's payout follows from its Sprint Commitment,
 * which keeps revenue tied to work actually done rather than to a table.
 */
export const REVENUE_PER_SP = 0.05

/**
 * Cash at which the run is over — §21 Act V walks the player down through
 * −$10,000 and −$100,000 before landing here.
 */
export const BANKRUPTCY_THRESHOLD = -1_000_000

/** Developers actually on the payroll. */
export function paidHeadcount(devs: number): number {
  return Math.max(0, devs - UNPAID_FOUNDERS)
}

/** Dollars per second flowing out. */
export function payrollPerSecond(devs: number): number {
  return paidHeadcount(devs) * WAGE_PER_DEV_PER_SEC
}

/** What a project pays on ship. */
export function projectRevenue(sprintCommitment: number): number {
  return sprintCommitment * REVENUE_PER_SP
}

/**
 * §21.0 — what the next developer costs.
 *
 * Escalating, so Act IIa's loop has a shape: the first hires are impulse buys
 * and the later ones are decisions. Geometric rather than linear because
 * velocity is linear in headcount — a linear cost would make each hire *more*
 * affordable than the last and the loop would have no tension at all.
 *
 * The base is deliberately small. Total revenue across the §21 project ladder
 * is a few hundred dollars (§4.10's REVENUE_PER_SP is 0.05), so a hire priced
 * in hundreds would make Act IIa unreachable. **These are first-pass numbers
 * that want a playtest**, not derived constants like the wage or the
 * bankruptcy threshold.
 */
export const HIRE_BASE_COST = 4
export const HIRE_COST_GROWTH = 1.07

export function hireCost(devs: number): number {
  const n = Math.max(1, Math.floor(devs))
  return Math.max(1, Math.round(HIRE_BASE_COST * HIRE_COST_GROWTH ** (n - 1)))
}

/** Total to grow from `from` developers to `to`. Act IIa's whole cost. */
export function hireCostTotal(from: number, to: number): number {
  let total = 0
  for (let n = Math.floor(from); n < Math.floor(to); n++) total += hireCost(n)
  return total
}

/**
 * §21.0 — the Mass Hire is priced at **everything the player has**.
 *
 * "Roughly the entire treasury they have accumulated by Act III — affordable,
 * and only just." Taking it literally rather than picking a number is the
 * robust reading and the funnier one:
 *
 * - It is **always affordable and always ruinous**, so the beat cannot be
 *   broken by any later change to revenue or hire costs. A fixed price would
 *   have to be re-tuned every time §4.10 moved, and would silently become
 *   either unreachable or trivial when nobody was looking.
 * - It leaves **exactly zero buffer**, which is what §21.0 says makes Act V's
 *   bankruptcy arrive in seconds rather than needing a scripted nudge.
 * - "Cost: YOUR ENTIRE TREASURY" is a better joke than any figure, and it is
 *   the same joke the offer is already making.
 *
 * The floor exists so a player who somehow arrives broke still pays something
 * and still feels the transaction.
 */
export const MASS_HIRE_MIN_COST = 50

export function massHireCost(cash: number): number {
  return Math.max(MASS_HIRE_MIN_COST, Math.floor(Math.max(0, cash)))
}

export function isBankrupt(cash: number): boolean {
  return cash <= BANKRUPTCY_THRESHOLD
}

/**
 * Seconds of runway at the current burn, ignoring incoming revenue.
 *
 * Used by the HUD to show the player how long they have once the trap closes,
 * which is what turns Act V from a cutscene into a panic.
 */
export function secondsUntilBankrupt(cash: number, devs: number): number {
  const burn = payrollPerSecond(devs)
  if (burn <= 0) return Infinity
  return Math.max(0, (cash - BANKRUPTCY_THRESHOLD) / burn)
}
