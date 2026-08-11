/**
 * Incidents — what a shipped game does at 3 a.m. GDD §4.12a, R29.
 *
 * §4.12 made an incident **a defect that crossed a threshold**, and that is the
 * wrong shape. A threshold is a state change inside the project on the bench,
 * which confines incidents to the thing you are currently building — while the
 * one thing §4.13 is most certain about is that the back catalogue is what sends
 * the bill. *An incident that can only happen to unreleased software is an
 * incident that has never happened.*
 *
 * So the two backlogs are separated by **where they live**:
 *
 * | | Arrives from | Lives on | Acted on by |
 * |---|---|---|---|
 * | **Defect** | The work itself | The project on the bench | QA, who slow the arrival |
 * | **Incident** | The **released** catalogue, forever | Every game you ever shipped | SRE, both ends |
 *
 * $$\\frac{dI}{dt} = \\iota \\cdot \\sum_r d_r \\cdot a_r \\cdot \\eta_{\\text{inc}}(\\text{SRE})$$
 *
 * **The bugs you chose not to fix become a permanent operational cost, weighted
 * by how many people are still playing.** A game nobody plays cannot page you. A
 * hit you rushed will page you forever.
 *
 * ---
 *
 * ## `a_r` is already in the economy, and that is why this is cheap
 *
 * "How many people are still playing" is a quantity §4.10e has been computing
 * since it shipped: a release's **earning rate as a share of its total payout**.
 * It peaks at launch, decays on the same two exponentials the money does, and —
 * the property that makes it the right choice rather than merely a convenient
 * one — **integrates to exactly 1 over the release's life, whatever shape was
 * rolled.**
 *
 * So no new curve, no second notion of audience that could drift out of step
 * with the revenue one, and §4.10e's anti-gambling constraint is inherited for
 * free: two players who ship the same game are exposed to exactly the same
 * lifetime incident load however differently their tails were rolled.
 *
 * ## ι is anchored to the tail, not chosen — §25.6.3
 *
 * §25.3.1's warning applies to this file exactly as it applied to `defects.ts`:
 * *"a guess made at that point becomes canon by accident."* So ι is defined by
 * the sentence it has to make true, and the integral above is what makes the
 * sentence exact:
 *
 * > **A release shipped at the garage density generates exactly one incident
 * > over its entire lifetime, with no SRE.**
 *
 * Since `∫ a_r dt = 1`, the lifetime count is `ι · d_r`, so `ι = 1 / β`. One
 * incident per shipped game is the correct scale for a thing that is meant to
 * be an *interruption* rather than a background rate — and it means a studio
 * that halves its defect density halves its pager load, which is the causal
 * chain §4.12a exists to draw and the player can feel it.
 *
 * **Measured, and it lands a shade under one — for the right reason.** §4.10e
 * retires a release at `RETIRE_AFTER_SECONDS` and pays the asymptote's
 * remainder as a lump, sized deliberately at "under one per cent".
 * {@link audienceShare} is built on `earningRate`, which is zero past that
 * horizon, so the audience integral truncates in exactly the same place and by
 * exactly the same fraction as the money does. That is the behaviour to want:
 * **ι's anchor and the economy's books share one horizon, and a release cannot
 * page you after it has gone off sale.** The test asserts the bound rather than
 * the equality, and names the remainder as the cause.
 *
 * ## What an incident does, and why it is a freeze rather than a loss
 *
 * §4.12a: "the tail stops entirely until SRE clear it". Taken literally — an
 * open incident **freezes its release's age**, so the tail pauses and resumes.
 *
 * That is a stronger choice than destroying the revenue, for a reason that is
 * not sentiment: §4.10e's whole file is arranged around one invariant — a
 * release pays its ladder payout *to the cent*, and the total cannot move. A
 * mechanic that deletes tail revenue breaks that invariant and takes the books
 * with it. A freeze does not: the money still all arrives, later, while §4.10d's
 * payroll runs the whole time. **The cost of an incident is measured in runway,
 * which is the currency the player is already frightened of.**
 *
 * It also makes the damage scale correctly with no extra arithmetic. Freezing a
 * launch-week hit costs a fortune a second; freezing a four-month-old release
 * costs almost nothing. "Weighted by how many people are still playing" turns
 * out to be true of the punishment as well as of the arrival rate.
 *
 * Pure. No store, no clock, no renderer.
 */

import { BETA } from './defects.ts'
import { earningRate, type Release } from './revenue.ts'

/**
 * **The anchoring sentence, as a number.** How many times a release shipped at
 * the garage density pages you over its entire life.
 *
 * A tenth: **you need a catalogue of ten mediocre games before the pager is a
 * standing feature of the studio.** That is the shape §4.13 already establishes
 * for tickets — the back catalogue is what sends the bill — and it is what keeps
 * §21's Run 1 clean: a studio with one or two releases essentially never sees an
 * incident, and a mature one sees them constantly.
 *
 * **Measured at 1.0 first, and it was wrong by a mile.** At one page per release
 * a garage spent *half of every release's life off sale*: two incidents per
 * game, each taking {@link INCIDENT_WORK_SECONDS} at the founder's diluted
 * clearance rate (§13.7.1), against a four-minute tail. Act II became a game
 * about outages, which is not the act §21 wrote. The number is recorded here as
 * a stated design quantity rather than left implicit in ι, so that retuning it
 * is one edit and reading it is one sentence.
 */
export const INCIDENTS_PER_GARAGE_RELEASE = 0.1

/**
 * §4.12a's `ι`, derived rather than chosen — see the file header.
 *
 * Written as the division so the sentence above survives any retune of β rather
 * than quietly becoming false. β is what a studio with nobody checking ships at,
 * so `ι · β` is by construction the lifetime page count of exactly that studio.
 */
export const IOTA = INCIDENTS_PER_GARAGE_RELEASE / BETA

/**
 * The SRE share at which the incident arrival rate halves — §4.12a.1.
 *
 * Stated as a half-life for the same reason `roles.ts` states QA's that way:
 * a suppression exponent is a number nobody can picture, and picking one *is*
 * deciding how much SRE a studio needs, which §25.3.2 forbids. This is a share
 * a player can read off the floor.
 *
 * A tenth, against QA's quarter, and the gap is the design. **You need far fewer
 * SRE than QA to matter**, because §4.12a's rate is already small — one incident
 * per shipped game — and a studio that had to staff reliability like quality
 * would be a studio where §4.11's four roles collapse back into one ratio.
 *
 * First pass. Wants a playtest.
 */
export const INCIDENT_HALVING_SRE_SHARE = 0.1

/**
 * Seconds of one SRE's attention to close one incident.
 *
 * The only number here that is a feel rather than a derivation: long enough
 * that a studio with a token SRE presence visibly cannot keep up during a bad
 * week, short enough that hiring two more is a fix the player can see working
 * within a project cycle.
 */
export const INCIDENT_WORK_SECONDS = 45

/**
 * An open incident.
 *
 * **It names its release.** §4.15 is explicit that the HUD shows a stack of
 * chips rather than a total, because a total hides which game is on fire — and
 * a total is exactly what an incident record without a release id forces the
 * interface to become.
 */
export interface Incident {
  id: number
  /** Which release is down. Matches `Release.id`. */
  releaseId: number
  /** The release's name, copied at raise time. */
  releaseName: string
  /** Seconds this has been open. Drives §4.15's chip and nothing else. */
  age: number
  /** SRE-seconds still needed. Counts down; at zero the incident closes. */
  work: number
}

function finite(x: number, fallback = 0): number {
  return Number.isFinite(x) ? x : fallback
}

/**
 * §4.12a's `η_inc(SRE)` — the factor SRE apply to the incident arrival rate.
 *
 * `1 / (1 + share / half)`: 1 with no SRE, exactly ½ at the halving share, and
 * **never zero**. The floor is the design rather than a safeguard — a curve that
 * reached zero would let a studio switch the pager off, deleting the thing the
 * section exists to say.
 */
export function incidentSuppression(sreShare: number): number {
  const share = Math.max(0, finite(sreShare))
  return 1 / (1 + share / INCIDENT_HALVING_SRE_SHARE)
}

/**
 * A release's audience *right now*, as a share of its lifetime audience.
 *
 * The earning rate normalised by the payout — see the file header for why this
 * is the right quantity rather than merely an available one. Units are 1/s and
 * the integral over the release's life is exactly 1.
 *
 * A release with no payout has no audience rather than an infinite one; a
 * project that earned nothing cannot page anybody.
 */
export function audienceShare(release: Release): number {
  if (!(release.payout > 0)) return 0
  return earningRate(release) / release.payout
}

/**
 * Incidents arriving per second across the whole catalogue — §4.12a.
 *
 * **Frozen releases do not page you.** A release with an incident already open
 * is not being played — its tail has stopped — so it is excluded, which is both
 * the honest reading of `a_r` and the thing that stops one bad game producing an
 * unbounded queue of incidents about itself while nobody can reach it.
 */
export function incidentRate(
  releases: readonly Release[],
  densities: ReadonlyMap<number, number>,
  sreShare: number,
  open: ReadonlySet<number> = new Set(),
): number {
  let sum = 0
  for (const release of releases) {
    if (open.has(release.id)) continue
    const density = Math.max(0, finite(densities.get(release.id) ?? 0))
    if (density === 0) continue
    sum += density * audienceShare(release)
  }
  return IOTA * sum * incidentSuppression(sreShare)
}

/**
 * How many incidents a release will raise over its whole life, if nobody
 * touches it — `ι · d_r`.
 *
 * Exported because it is the number that makes the system *teachable*: §21.7.3's
 * Serena scene, the release gallery and any tooltip that wants to say "this one
 * will page you about three times" all need the lifetime figure rather than the
 * instantaneous rate. It is also what the anchoring test asserts.
 */
export function lifetimeIncidents(density: number, sreShare = 0): number {
  return IOTA * Math.max(0, finite(density)) * incidentSuppression(sreShare)
}

/** Which releases are down. What {@link incidentRate} skips and the tail freezes on. */
export function suppressedReleases(incidents: readonly Incident[]): Set<number> {
  return new Set(incidents.map((i) => i.releaseId))
}

/**
 * SRE clearance capacity, in incident-seconds per second — §4.12a.1.
 *
 * Linear in headcount, like §4.13's support capacity and for the same reason:
 * clearing a queue is the one shape of work where more people simply help. The
 * *arrival* side is where §4.1's dilution lives, and having exactly one of the
 * two ends be linear is what makes the pair legible.
 */
export function clearanceCapacity(sreHeads: number): number {
  return Math.max(0, finite(sreHeads))
}

export interface IncidentStep {
  incidents: Incident[]
  /** Closed over this step. For §4.15's chip leaving and the ship toast. */
  cleared: number
  /** Fractional carry, so a slow arrival rate is not rounded to zero every tick. */
  pending: number
  /** Ids of releases that just came back on sale. */
  restored: number[]
}

/**
 * Advance the incident queue one step: raise, then work, then close.
 *
 * `pending` carries the fractional part of the arrival between calls. Without
 * it a studio whose rate is 0.3 incidents a second would raise none at all at
 * 60 fps, because every individual step floors to zero — the same class of bug
 * as a subtractive tail, and this is where it would have landed.
 *
 * **Oldest first.** A queue worked newest-first would let a permanent trickle
 * bury one release forever while the others cycled, which reads as a bug in the
 * game rather than as a bug in the game the player shipped.
 */
export function advanceIncidents(
  incidents: readonly Incident[],
  arrivals: number,
  capacity: number,
  dt: number,
  pending: number,
  nextId: number,
  candidates: readonly { id: number; name: string }[],
): IncidentStep {
  const step = Math.max(0, finite(dt))
  if (step === 0) {
    return { incidents: incidents as Incident[], cleared: 0, pending, restored: [] }
  }

  let carry = Math.max(0, finite(pending)) + Math.max(0, finite(arrivals)) * step
  const open = [...incidents]
  const alreadyDown = suppressedReleases(incidents)
  let id = nextId

  // Raise whole incidents. One release can only be down once — a second page
  // about a game that is already off sale is noise, and §4.15's chip stack has
  // nowhere to put it.
  while (carry >= 1 && candidates.length > 0) {
    const target = candidates.find((c) => !alreadyDown.has(c.id))
    if (!target) break
    carry -= 1
    alreadyDown.add(target.id)
    open.push({
      id: id++,
      releaseId: target.id,
      releaseName: target.name,
      age: 0,
      work: INCIDENT_WORK_SECONDS,
    })
  }
  // Nothing to page about: the carry is dropped rather than banked, or a studio
  // with no catalogue would accumulate a debt of incidents to raise the instant
  // it shipped its next game.
  if (candidates.length === 0) carry = 0

  let budget = Math.max(0, finite(capacity)) * step
  const next: Incident[] = []
  const restored: number[] = []
  let cleared = 0

  for (const incident of open) {
    const spent = Math.min(budget, incident.work)
    budget -= spent
    const work = incident.work - spent
    if (work <= 0) {
      cleared += 1
      restored.push(incident.releaseId)
      continue
    }
    next.push({ ...incident, age: incident.age + step, work })
  }

  return { incidents: next, cleared, pending: carry, restored }
}
