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
export function projectRevenue(index: number, scale = 1): number {
  const ladder = PROJECT_PAYOUTS
  const i = Math.max(0, Math.floor(index))
  const terminal = ladder.length - 1
  const authored = ladder[Math.min(terminal, i)]
  // **At the terminal rung**, not past it: `PROJECTS` clamps the index there and
  // that rung is explicitly "the rate the studio runs at for the rest of the
  // run", so it is the one that grows.
  //
  // `scale` is the ratio the *commitment* grew by, so dollars-per-story-point is
  // identical at every size and this is a cadence change rather than an economy
  // one. It is passed in rather than recomputed because the thing that shipped
  // is the authority on how big it was — deriving it here from a cap that has
  // moved since would pay a different price than the one on the burn-down.
  return i < terminal ? authored : authored * projectScale(scale)
}

/**
 * §4.4, §10.4 — **how long the studio should spend on one game.**
 *
 * The ladder's terminal rung is 4,000 story points and it used to repeat for
 * ever. Measured at run 8 (§14.8): 2,800 developers producing ~700 SP a second
 * ship that project **every six seconds**. §10.4's burn-down becomes a strobe,
 * §10.11's gallery fills with hundreds of identically-named games, and shipping
 * stops being an event.
 *
 * Two wrong answers were tried before this one, and both are worth keeping.
 *
 * **Ship count** compounds per *ship* rather than per *studio*, so a fast run
 * outruns its own ladder within minutes — and it makes the size of your next
 * game a fact about your history rather than about your company.
 *
 * **§4.2's cap** is the one that looked right and measured worst. The cap is
 * what the studio *could* hold, not what it *has*: every run restarts at zero
 * developers, so scaling by the cap opened each run with a project fifteen times
 * larger than the last and nobody to build it. Measured, run 7 went to
 * 451 s/ship at 160 developers and −$1M in the bank.
 *
 * So a project is sized by **the velocity that just shipped one**, at the moment
 * it ships, floored at the authored rung. It is a fact about the studio as it
 * actually is, it cannot outrun itself, and it holds a game at roughly
 * {@link TARGET_BUILD_SECONDS} at every scale.
 */
/**
 * Measured rather than chosen: 90 starved the early runs (cash went negative in
 * runs 3-6, because a longer project means revenue arrives less often against a
 * constant payroll) and 75 left run 8 collapsing on the hire curve. 60 keeps the
 * treasury positive at every run and sits closest to the ~69 s the authored
 * ladder already produced in Run 1, so the terminal rung inherits the cadence
 * the story rungs set rather than imposing a new one.
 */
export const TARGET_BUILD_SECONDS = 60

export function projectScale(scale: number): number {
  return Number.isFinite(scale) && scale > 1 ? scale : 1
}

/**
 * Payouts, mirrored here so `economy.ts` stays free of store imports.
 *
 * Kept in step with `PROJECTS` by test rather than by discipline — two lists
 * that must agree and are edited in different files is exactly the pairing that
 * silently drifts.
 */
export const PROJECT_PAYOUTS: readonly number[] = [
  50,
  1_500,
  12_000,
  38_000,
  110_000,
  320_000,
  900_000,
  2_600_000,
]

/**
 * The first rung the player ships while paying somebody — §4.10f.
 *
 * §21's phase machine holds `act2_ship` until this many games are out, and only
 * then opens Act IIa's hiring loop. Everything below this index is garage work
 * at two unpaid founders; everything from it upward must satisfy `r > W`, and
 * `economy.test.ts` asserts exactly that split rather than asserting it from
 * rung 1 — which is what forced the old ×500 cliff between the first two games.
 *
 * It lives here, beside the payouts and the wage, rather than in the store: the
 * phase machine needs it and `onboarding.ts` cannot import the store. The three
 * places this rule lives — the ladder, the gate and the test — drifting apart is
 * precisely how a player ends up hiring into a loss.
 */
export const FIRST_PAID_RUNG = 3

/**
 * Sprint Commitments, mirrored beside the payouts for {@link openingRung}.
 *
 * Same contract as {@link PROJECT_PAYOUTS}: the store owns `PROJECTS` and a test
 * asserts these two lists never drift from it.
 */
export const PROJECT_COMMITMENTS: readonly number[] = [
  300,
  200,
  300,
  600,
  900,
  1_400,
  2_200,
  3_500,
]

/**
 * Which game a run opens on — §4.10f, §13.12.4.
 *
 * **A studio that shipped a live-service hero shooter last run does not go back
 * to making a $50 mobile game**, and until this existed it did exactly that:
 * `triggerParadigmShift` reset `projectIndex` to zero, so every run in the
 * career re-climbed the garage ladder from *Flappy Square 1.0*.
 *
 * That was invisible while the ladder's second rung paid $25,000 — the replay
 * lasted about twenty seconds and then the studio was rich. §4.10f spread that
 * one payout across three garage rungs, and the replay stopped being invisible
 * immediately: measured, runs 2–8 stalled at **two developers** on §4.10a's hire
 * cost, because three games earning $13,550 on §4.10e's tail never clear the
 * thirty seconds of payroll a third hire needs standing behind it.
 *
 * So the run inherits a **position in the catalogue** rather than a pile of
 * cash. §14.8.9 named the cash version — *"the bank lends against the company
 * you have proven you can build"* — and this is the same idea with the advantage
 * that it cannot be spent on a hiring spree the run cannot pay for, which is the
 * exact failure that made §13.12.3's option 2 unshippable.
 *
 * ## The bound is the **standing start**, and the first version got this wrong
 *
 * The first version bounded the rung by the *cap* — one story point per
 * developer of capacity — reasoning that a studio opens on the largest game it
 * could have built with the people it is allowed to hold. That reads well and it
 * is the wrong noun. **A run does not open with the people it is allowed to
 * hold; it opens with two.** §21.6 liquidates the swarm and leaves James.
 *
 * Measured, at run 8 of §14.8: cap 210,526, so the cap-bound rule handed the run
 * the terminal 3,500-point game, which two developers need about seven hundred
 * seconds to finish — and until it ships there is no money, so there is no
 * hiring, so there is no velocity. The run sat at **two developers, $0 revenue
 * and one game in progress** until the harness declared it stalled. A studio with
 * a cap of two hundred thousand, unable to hire its third employee.
 *
 * So the bound is what the studio a fresh run *actually has* can build in §4.4's
 * target window. That is `STARTING_DEVS · SP_PER_DEV_PER_SEC · TARGET_BUILD_SECONDS`
 * — a hundred and twenty story points — which in practice always floors to
 * {@link FIRST_PAID_RUNG}, and it is written as the computation rather than as
 * the number 3 because the number 3 is an output. Raise the headcount a run
 * opens with and the opening game should follow it; hard-coding the answer would
 * silently decouple the two.
 *
 * **What this gives up, stated rather than buried.** "Each prestige opens on a
 * bigger game" was a nice per-run reward and it is not on offer. It does not need
 * to be: measured, the cap, the velocity, the revenue and the BP now all climb
 * every single run, so the sense of progress is carried by the systems that can
 * actually carry it. This function's job is the narrower one it was built for —
 * **stop the studio re-climbing the garage** — and that it does.
 *
 * Floored at {@link FIRST_PAID_RUNG} because the garage is a Run 1 joke and
 * telling it twice is not funnier, and because every rung below that floor is
 * deliberately underwater on `r > W` — opening a run there would hand the player
 * a studio that loses money on every hire it is being told to make.
 */
export function openingRung(paradigmShifts: number, startingDevs: number): number {
  // Run 1 is the garage. It is the only run that earns the joke.
  if (!(paradigmShifts > 0)) return 0
  const devs = Number.isFinite(startingDevs) && startingDevs > 0 ? startingDevs : 0
  // Passive output only. §8.2's poking would raise this and a bound that assumed
  // the player was poking would be a bound on the attentive player alone.
  const buildable = devs * SP_PER_DEV_PER_SEC * TARGET_BUILD_SECONDS
  const terminal = PROJECT_COMMITMENTS.length - 1
  let rung = FIRST_PAID_RUNG
  for (let i = FIRST_PAID_RUNG + 1; i <= terminal; i++) {
    if (PROJECT_COMMITMENTS[i] > buildable) break
    rung = i
  }
  return rung
}

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
/**
 * §4.10a's growth base, **normalised by the capacity it is filling** — §14.8.9.
 *
 * §14.8.9 named this as one of two candidate fixes for the wall that is not
 * §4.1: *"make the hire cost scale with the cap rather than with headcount
 * alone, so a bigger cap makes each head cheaper as well as allowed."* It was
 * not taken then because it was untested. It is tested now, and the measurement
 * that forced it is run 8 of §14.8: cap 1,754, treasury −$1,011,069, stalled at
 * 1,180 developers on the **price of a head** with §4.1 nowhere in sight.
 *
 * The argument is not only mechanical. A company allowed 1,754 people, hiring
 * its thousandth, is not doing something `1.08^1000` times harder than two
 * friends in a garage hiring their second — **it is 57% full**. The old curve
 * priced absolute headcount, which is a fact about the world; this prices how
 * much of your own capacity you have used, which is a fact about your company,
 * and capacity is the thing §13.2's tree actually sells.
 *
 * ## Why an effective base rather than a new formula
 *
 * Raising the exponent's divisor turns `g^(n·D/cap)` back into a geometric
 * series with ratio `g^(D/cap)`, so **every closed form in `hireDial.ts` keeps
 * working untouched** — `batchCost`'s series sum and `maxAffordable`'s logarithm
 * both stay exact. A bespoke cost curve would have needed both re-derived, and
 * §10.10.3's dial would have quietly drifted from what the game charges.
 *
 * ## What it does not change
 *
 * At `cap === D_BASE` this is the identity, so **Run 1 is unchanged to the
 * cent** — the whole §21 ladder, Act IIa's $238-to-forty-developers, and Act
 * III's treasury are all priced off a cap of exactly 100.
 *
 * §6's lesson is not for sale here either. The base still never reaches 1, the
 * last quarter of any cap is still expensive, and §4.1 is untouched — what goes
 * away is a *second* wall that was standing in front of the first one.
 *
 * §13.7.1's Recruiting node survives rather than being made redundant, which
 * §14.8.9 flagged as the risk: it lowers `growth` before this scales it, so it
 * still buys a cheaper climb through whatever cap you hold.
 */
export function capAdjustedGrowth(growth: number, devCap: number): number {
  const g = Number.isFinite(growth) && growth > 1 ? growth : HIRE_COST_GROWTH
  const cap = Number.isFinite(devCap) && devCap > 0 ? devCap : REFERENCE_CAP
  // A cap below the reference would make hiring *dearer* than Run 1. Nothing in
  // the game produces one, and clamping is cheaper than reasoning about it.
  if (cap <= REFERENCE_CAP) return g
  return g ** (REFERENCE_CAP / cap)
}

/**
 * The cap §4.10a's raw curve was authored against — §21's Run 1.
 *
 * Mirrored from `entropy.ts`'s `D_BASE` rather than imported, for the same
 * reason {@link PROJECT_PAYOUTS} is mirrored: this module is the leaf every
 * other economic module reads, and a test keeps the two in step.
 */
export const REFERENCE_CAP = 100

/**
 * Passive output per developer per second, mirrored from `entropy.ts`.
 *
 * Same mirroring contract as {@link REFERENCE_CAP}, kept in step by test.
 */
export const SP_PER_DEV_PER_SEC = 1

/**
 * Developers a run opens with — §21.6, "James survives; everybody else is
 * liquidated", plus you.
 *
 * Mirrored from `triggerParadigmShift`'s `devs: 2` and asserted against it,
 * because {@link openingRung} bounds the opening game by exactly this number and
 * the two silently disagreeing is how run 8 ended up unable to hire its third
 * employee against a cap of two hundred thousand.
 */
export const STARTING_DEVS = 2

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
