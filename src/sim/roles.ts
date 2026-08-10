/**
 * Roles — the studio stops being one kind of person. GDD §4.11, R19.
 *
 * §4.9a made developers differ in *how much* they produce and §7.8.7 made them
 * differ in what they look like. Neither made them differ in **what they are
 * for**, so a studio of a hundred thousand was one number wearing a hundred
 * thousand faces. There are four functions now, and they exist because §4.12
 * and §4.13 give the studio two ways to fail that writing more code cannot fix.
 *
 * ## The representation, and why it is a list rather than four counters
 *
 * The obvious storage is `{ dev: 900, qa: 60, support: 25, sre: 15 }`. It is
 * wrong, and the way it is wrong is invisible until you look at the floor.
 *
 * §4.11.2 wants roles to sit in **bands** — "four rows of developers, a row of
 * QA, half a row of support" — so a seat has to know its role. With four
 * counters the only way to derive that is to order the roles and lay them out,
 * which means **hiring one developer relabels every QA above them**. §7.8.7
 * generates a face from the seat index, so the player would watch a specific
 * person change jobs because somebody else was hired. That is §7.8.1b's "a seat
 * once taken never moves" broken on a second axis, and it is exactly the class
 * of bug the reading-order rule was introduced to kill.
 *
 * So the roster is the **hire history, run-length encoded**: a list of runs, in
 * the order they were hired, each one a role and a count. A seat's role is a
 * scan, seats never change role, and the storage is a handful of objects
 * however large the studio gets — §10.10's dial hires 1, 10, 100 or MAX at a
 * time, so a run *is* a batch.
 *
 * It also makes the floor honest in a way a tidy four-band layout would not
 * be: **the shape of the floor is the shape of your hiring history.** A player
 * who hired in blocks gets §4.11.2's bands; a player who alternated gets
 * stripes, and the stripes are true.
 *
 * ## What is deliberately not here
 *
 * **The role ratio.** §25.3.2 names it as the single most play-test-dependent
 * quantity in the batch, and this module never picks one — the mix is whatever
 * the player hired. What *is* here is the effect of one head of each kind, and
 * each of those is anchored to a sentence rather than chosen as a coefficient.
 *
 * **Reassignment.** §4.11: "A role is chosen at hire, not reassigned." There is
 * no function here that moves somebody between roles, and its absence is the
 * design — it would turn every failure into a slider adjustment, and the game's
 * thesis (§6) is that you cannot fix an organisation by moving people around
 * after the fact.
 *
 * Pure. No store, no clock, no renderer.
 */

export type Role = 'dev' | 'qa' | 'support' | 'sre'

/**
 * §4.11's table, in its own order: the one that produces, then the three that
 * absorb the consequences.
 */
export const ROLES: readonly Role[] = ['dev', 'qa', 'support', 'sre'] as const

/** What the HUD calls each one. §10.2a — the word a player would use. */
export const ROLE_LABEL: Record<Role, string> = {
  dev: 'DEVELOPER',
  qa: 'QA',
  support: 'SUPPORT',
  sre: 'SRE',
}

/** §4.11's "Produces" column, for the dial's one line of explanation. */
export const ROLE_BLURB: Record<Role, string> = {
  dev: 'story points',
  qa: 'fewer defects',
  support: 'answers tickets',
  sre: 'clears incidents',
}

/** One stretch of consecutive seats hired into the same job. */
export interface RoleRun {
  role: Role
  count: number
}

export type Roster = readonly RoleRun[]

export type RoleCounts = Record<Role, number>

/**
 * The studio at the start of a run — §21's garage.
 *
 * You and James write code. There is no QA in a garage, and the joke §4.11 is
 * making only lands once the player has been given something to protect.
 */
export function newRoster(devs = 0): Roster {
  const n = Math.max(0, Math.floor(devs))
  return n > 0 ? [{ role: 'dev', count: n }] : []
}

export function headcountOf(roster: Roster): number {
  let total = 0
  for (const run of roster) total += run.count
  return total
}

/**
 * Hire `count` people into `role`.
 *
 * Merges with the last run when the role matches, which is what keeps the list
 * short: a player who only ever hires developers has a roster of length one.
 */
export function addHires(roster: Roster, role: Role, count: number): Roster {
  const n = Math.floor(count)
  if (!(n > 0)) return roster

  const last = roster[roster.length - 1]
  if (last && last.role === role) {
    return [...roster.slice(0, -1), { role, count: last.count + n }]
  }
  return [...roster, { role, count: n }]
}

/**
 * What the person in this seat was hired to do.
 *
 * Out-of-range seats read as `dev` rather than throwing. The renderer asks
 * speculatively — an arrival draws the real person before the store publishes
 * them (trap 12, trap 13) — and a throw on that path is a blank frame rather
 * than an error anybody would see.
 */
export function roleAtSeat(roster: Roster, seat: number): Role {
  if (!Number.isFinite(seat) || seat < 0) return 'dev'
  let cursor = 0
  for (const run of roster) {
    cursor += run.count
    if (seat < cursor) return run.role
  }
  return 'dev'
}

export function countsOf(roster: Roster): RoleCounts {
  const counts: RoleCounts = { dev: 0, qa: 0, support: 0, sre: 0 }
  for (const run of roster) counts[run.role] += run.count
  return counts
}

export function roleShare(counts: RoleCounts, role: Role): number {
  let total = 0
  for (const r of ROLES) total += counts[r]
  return total > 0 ? counts[role] / total : 0
}

export interface RoleBand {
  role: Role
  /** First seat, inclusive. */
  from: number
  /** Last seat, exclusive. */
  to: number
}

/**
 * The roster as seat ranges — §4.11.2, and what the renderer tints.
 *
 * The bands **tile the studio exactly**: no gaps, no overlaps, `[0, devs)`
 * partitioned. That is the same property §4.5b's units are built on and for the
 * same reason — anything that sums over bands and anything that sums over
 * people must agree, or a floor can be counted twice.
 */
export function roleBands(roster: Roster): RoleBand[] {
  const bands: RoleBand[] = []
  let cursor = 0
  for (const run of roster) {
    bands.push({ role: run.role, from: cursor, to: cursor + run.count })
    cursor += run.count
  }
  return bands
}

// ---------------------------------------------------------------------------
// What a head of each kind is worth
// ---------------------------------------------------------------------------

/**
 * **The QA knob, stated as a sentence about a studio rather than as a
 * coefficient.**
 *
 * §25.3.2 forbids inventing the role ratio, and a suppression curve written as
 * `η = e^(−k·share)` smuggles one in through the back door — `k` is a ratio
 * nobody can picture, and picking it *is* deciding how much QA a studio needs.
 * So the curve is defined by its own half-life instead: **this is the QA share
 * at which the defect rate halves**, and the player can read that number off
 * the floor.
 *
 * A quarter is a first pass and it wants a playtest. What it cannot do is drift
 * into meaning something else, which is the failure §25.2 is actually about.
 */
export const DEFECT_HALVING_QA_SHARE = 0.25

/** The same constant under the name §4.12's equation uses for it. */
export const QA_SUPPRESSION = DEFECT_HALVING_QA_SHARE

/**
 * §4.12's `η_def(QA)` — the factor QA apply to the defect *arrival rate*.
 *
 * `1 / (1 + share / half)`, which is 1 with no QA, exactly ½ at the halving
 * share, and **never zero**. The last part is the design, not a numerical
 * safeguard: §4.12 gives QA the job of changing how fast defects arrive, and a
 * curve that reaches zero would let a studio switch the defect system off
 * entirely — deleting the thing the section exists to say.
 */
export function defectSuppression(qaShare: number): number {
  const share = Number.isFinite(qaShare) ? Math.max(0, qaShare) : 0
  return 1 / (1 + share / DEFECT_HALVING_QA_SHARE)
}

/**
 * Tickets one support head closes per second — §4.13.
 *
 * One, which makes the arrival rate in `support.ts` readable directly as "how
 * many people this catalogue needs". The interesting number is the one it is
 * compared against, not this one.
 */
export const TICKETS_PER_SUPPORT_PER_SEC = 1

/**
 * §4.13 — "Support capacity is headcount, straightforwardly."
 *
 * **Linear, at every scale, with no §4.1 term anywhere near it.** This is the
 * one place in the game where throwing people at a problem simply works, and
 * the exception is deliberate: it is what makes §6's dilution visible
 * everywhere else. Two support heads answer twice as many tickets whether the
 * studio is four people or four billion.
 */
export function supportCapacity(heads: number): number {
  const n = Number.isFinite(heads) ? Math.max(0, heads) : 0
  return n * TICKETS_PER_SUPPORT_PER_SEC
}
