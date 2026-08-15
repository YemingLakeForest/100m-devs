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
 * Calibrated so *Flappy Square 1.0* (300 SP) pays the +$50 that §21 Act II
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

/**
 * What project `index` pays on ship — GDD §4.10c.
 *
 * Takes a ladder index, not a Story Point count. Revenue used to be
 * `commitment × REVENUE_PER_SP`, on the assumption that a Story Point is worth
 * a fixed amount of money whoever ships it. It is not: a forty-person studio's
 * output is not worth forty times a solo developer's, it is worth
 * *disproportionately* more, which is both true of real games and the only
 * shape that makes the loop solvable — see §4.10c and `PROJECTS`.
 */
export function projectRevenue(index: number): number {
  const ladder = PROJECT_PAYOUTS
  return ladder[Math.max(0, Math.min(ladder.length - 1, Math.floor(index)))]
}

/**
 * Payouts, mirrored here so `economy.ts` stays free of store imports.
 *
 * Kept in step with `PROJECTS` by test rather than by discipline — two lists
 * that must agree and are edited in different files is exactly the pairing that
 * silently drifts.
 */
export const PROJECT_PAYOUTS: readonly number[] = [50, 25_000, 120_000, 550_000]

/**
 * §21.0 — what the next developer costs.
 *
 * Escalating, so Act IIa's loop has a shape: the first hires are impulse buys
 * and the later ones are decisions. Geometric rather than linear because
 * velocity is linear in headcount — a linear cost would make each hire *more*
 * affordable than the last and the loop would have no tension at all.
 *
 * The base is deliberately tiny, and that is the joke rather than a rounding
 * problem: **a developer costs a dollar to hire and $50 a second to keep.**
 * The hire is cheap; the payroll is what ends the company. §6's lesson stated
 * in two constants.
 *
 * Simulated against the §21 ladder, reaching 40 developers costs $238 of the
 * ~$320 the loop earns, leaving a treasury to gamble on the Mass Hire.
 * **First-pass numbers that want a playtest**, unlike the wage and the
 * bankruptcy threshold, which are derived.
 */
export const HIRE_BASE_COST = 1
export const HIRE_COST_GROWTH = 1.08

/**
 * What the next developer costs — and **the growth base is now a lever.**
 *
 * `growth` defaults to {@link HIRE_COST_GROWTH}, so every existing caller and
 * §21's whole ladder are unchanged to the cent. §13.7.1's Recruiting node lowers
 * it, and that is the only thing in the game that does.
 *
 * Why the base and not a discount: a cost that grows exponentially in headcount
 * against an income that grows *linearly* in it crosses at a fixed headcount and
 * stops. A 20% discount moves that crossing by three developers; halving the
 * step doubles it. Measured before the node existed, the studio stalled at ~180
 * developers in every run from the third onward while §4.2's cap passed a
 * million — the price of a head, not §4.1, was the wall.
 *
 * A parameter rather than an import, deliberately: `founder.ts` reads this
 * module's constant to build the lever, so this module reading `founder.ts`
 * back would be a cycle.
 */
export function hireCost(devs: number, growth = HIRE_COST_GROWTH): number {
  const n = Math.max(1, Math.floor(devs))
  const g = Number.isFinite(growth) && growth > 1 ? growth : HIRE_COST_GROWTH
  // Deliberately NOT rounded to whole dollars. At a $1 base, rounding flattens
  // the first ten hires to "$1, $1, $1, $2" — the curve exists to make late
  // hires feel like decisions, and rounding deletes exactly the part of it
  // where the player is learning that hiring has a price. Cash is already
  // fractional (§4.10's revenue is $0.05/SP); the HUD rounds for display.
  return HIRE_BASE_COST * g ** (n - 1)
}

/** Total to grow from `from` developers to `to`. Act IIa's whole cost. */
export function hireCostTotal(from: number, to: number, growth = HIRE_COST_GROWTH): number {
  let total = 0
  for (let n = Math.floor(from); n < Math.floor(to); n++) total += hireCost(n, growth)
  return total
}

/**
 * §21.0 — the Mass Hire is priced at **everything the player has**.
 *
 * "Roughly the entire treasury they have accumulated by Act III — affordable,
 * and only just." Taking it literally rather than picking a number is the
 * robust reading and the funnier one:
 *
 * - It is **always ruinous**, so the beat cannot be broken by any later change
 *   to revenue or hire costs. A fixed price would have to be re-tuned every
 *   time §4.10 moved, and would silently become either unreachable or trivial
 *   when nobody was looking.
 * - It is **not always affordable**, which an earlier draft of this comment
 *   claimed. Payroll runs continuously and can empty the treasury faster than
 *   shipping refills it, so a studio can sit in Act III below the floor. The
 *   caller must check — see `canMassHire`.
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

/**
 * Is the studio in real trouble, or merely between milestones? — §4.10d.
 *
 * These are not the same thing and the interface was treating them as one. It
 * coloured the cash readout on `cash < 0`, which sounds obviously right and is
 * obviously wrong once §4.10c makes revenue arrive **on ship**: payroll runs
 * continuously and payouts land in lumps, so a healthy studio at forty
 * developers spends most of every project overdrawn by five figures on its way
 * to a half-million-dollar payment. Colouring on the *sign* tells that player
 * they are failing, at the exact moment they are eighty seconds from the
 * biggest cheque they have ever seen.
 *
 * The predicate the player actually cares about is **can I reach the next
 * payout**. That is computable rather than felt: project the burn forward over
 * the time the current project still needs, and ask whether it crosses the
 * bankruptcy threshold before the money arrives.
 *
 * `secondsToPayout` is `Infinity` when nothing is being worked on, which
 * correctly falls back to "any negative balance is a slow death" — the Act V
 * case, where production has stopped and no payout is coming.
 */
export function isCashCritical(
  cash: number,
  devs: number,
  secondsToPayout: number,
): boolean {
  const burn = payrollPerSecond(devs)
  if (burn <= 0) return cash <= BANKRUPTCY_THRESHOLD
  if (!Number.isFinite(secondsToPayout)) return cash < 0
  return cash - burn * secondsToPayout <= BANKRUPTCY_THRESHOLD
}
