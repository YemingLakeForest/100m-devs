/**
 * Revenue is a long tail, not a lump — GDD §4.10e.
 *
 * §4.10c's payout-on-ship is replaced. **The ladder of what a project is worth
 * survives untouched**; what changes is when the money arrives.
 *
 * The problem it answers was observed and then play-tested: payroll runs
 * continuously and revenue landed in a single lump, so the studio crossed zero
 * on every project cycle. It is arithmetically solvent and it *reads* as
 * permanently failing, which is the wrong feeling for a studio that is in fact
 * growing.
 *
 * ## The shape
 *
 * A shipped game earns for as long as it is on sale, on a decaying tail:
 * "front-loaded and long — a launch spike, then a decay, then a floor that
 * never quite reaches zero."
 *
 * That is two exponentials added together, and the sum is chosen rather than a
 * single curve for a reason that is the whole design: **one exponential cannot
 * be both front-loaded and long.** Its time constant is the only knob it has,
 * so a launch spike forces a short tail and a real back catalogue forces a
 * launch that is not a launch. Two of them buy both — a fast one that is most
 * of the money in the first few seconds, and a slow one that is still paying
 * out while the next project is in development.
 *
 * ## The constraint that keeps it from being gambling
 *
 * §4.10e: "randomised in the *shape*, never in the *total* — a player who ships
 * the same game must not be able to be unlucky with it."
 *
 * So the total is not a consequence of the randomised parameters at all. Each
 * exponential is written in its **normalised** form `(w/τ)·e^(−t/τ)`, whose
 * integral over all time is exactly `w` whatever τ is; the two weights are `w`
 * and `1 − w`, so the integral of the pair is exactly 1, for every draw. τ₁, τ₂
 * and `w` can then be rolled as widely as taste allows and the payout cannot
 * move by a cent. The same trick §4.9a's log-normal uses on its mean, applied
 * to an area instead.
 *
 * And because a tail with an asymptote never technically finishes, a release is
 * **retired** once it has paid all but a rounding error, and retirement pays the
 * exact remainder ({@link RETIRE_AFTER_SECONDS}). Over a run the books balance
 * to the ladder to the cent rather than to within a slow leak.
 *
 * Pure — no store, no clock. Everything takes the age of a release as an
 * argument, which is what lets the same functions serve the live tick, the §24
 * offline catch-up and a test that fast-forwards a fortnight.
 */

import { draw } from './identity.ts'

/**
 * The launch spike, in seconds.
 *
 * Short, because §21 Act IIa's loop is *ship, earn, hire, ship faster* and the
 * hire has to be affordable while the player still remembers shipping. Most of
 * a game's money arrives inside the first ten seconds and that is both true of
 * real launches and necessary for the loop to be playable.
 */
export const SPIKE_TAU = [4, 8] as const

/** The back catalogue, in seconds. Still paying while the next one is built. */
export const TAIL_TAU = [30, 70] as const

/** Share of the payout that arrives in the launch spike rather than the tail. */
export const SPIKE_SHARE = [0.5, 0.68] as const

/**
 * When a release stops being tracked, and pays whatever it has left.
 *
 * Four minutes is past five slow-tail time constants, so the remainder handed
 * over at retirement is under one per cent — small enough that the payment is
 * not a visible second lump, and large enough that dropping it would be a leak.
 * It also bounds the array: a long session ships a lot of games and an
 * unbounded catalogue is a slow memory fault dressed as an economy.
 */
export const RETIRE_AFTER_SECONDS = 240

export interface ReleaseShape {
  /** Fraction of the payout in the launch spike. */
  spikeShare: number
  spikeTau: number
  tailTau: number
}

/**
 * A game on sale — GDD §4.10e.
 *
 * `paid` rather than "remaining" so the arithmetic is a difference against a
 * closed-form cumulative rather than an accumulating subtraction. That matters
 * more than it looks: a subtractive tail drifts with the frame rate and with
 * every §24.5 offline catch-up, and the drift lands in the one number §4.10e
 * says must not move.
 */
export interface Release {
  id: number
  name: string
  /** The §4.10c ladder payout. The tail's total, exactly. */
  payout: number
  /** Seconds this release has been on sale. */
  age: number
  /** Dollars handed over so far. */
  paid: number
  shape: ReleaseShape
  /**
   * §4.12's defect backlog at ship, per Story Point — what the game went out
   * with, and what §4.12a charges it for forever.
   *
   * **Carried here rather than in a map beside the catalogue**, because a
   * release *is* the thing quality is a fact about: §4.12a's incident rate, the
   * §10.11 gallery and §4.14's score all ask the same record the same question,
   * and a second structure keyed by release id is a second thing that can fall
   * out of step with this one. Nothing in this module's arithmetic reads it.
   */
  defectDensity: number
  /** §4.14's score out of 100, fixed at ship. Also inert here; §10.11 tints by it. */
  rating: number
}

function lerp(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t
}

/**
 * Roll a release's shape — GDD §4.10e, "randomised per project".
 *
 * From the run seed and the release ordinal, the same contract §7.8.7 uses for
 * faces: two runs of the same ladder do not produce identical graphs, and a
 * reload does not reroll the graph the player is currently looking at.
 */
export function rollShape(seed: number, ordinal: number): ReleaseShape {
  return {
    spikeShare: lerp(SPIKE_SHARE, draw(seed, ordinal, 30)),
    spikeTau: lerp(SPIKE_TAU, draw(seed, ordinal, 31)),
    tailTau: lerp(TAIL_TAU, draw(seed, ordinal, 32)),
  }
}

/**
 * Fraction of the payout collected by age `t` — the cumulative of the pair.
 *
 * Exactly 0 at t = 0 and approaching exactly 1, whatever the shape, which is
 * the property the whole file is arranged around.
 */
export function collectedFraction(shape: ReleaseShape, t: number): number {
  if (!(t > 0)) return 0
  const spike = shape.spikeShare * (1 - Math.exp(-t / shape.spikeTau))
  const tail = (1 - shape.spikeShare) * (1 - Math.exp(-t / shape.tailTau))
  return Math.min(1, spike + tail)
}

/**
 * Dollars per second a release is earning at age `t` — the derivative.
 *
 * Only the graph needs this; the money itself is banked from the difference of
 * two cumulatives, so no amount of frame-rate jitter can make the totals
 * disagree with the ladder.
 */
export function earningRate(release: Release): number {
  const { shape, payout, age } = release
  if (age >= RETIRE_AFTER_SECONDS) return 0
  const spike = (shape.spikeShare / shape.spikeTau) * Math.exp(-age / shape.spikeTau)
  const tail = ((1 - shape.spikeShare) / shape.tailTau) * Math.exp(-age / shape.tailTau)
  return payout * (spike + tail)
}

export interface TailStep {
  /** The catalogue, aged forward. Retired releases are gone from it. */
  releases: Release[]
  /** Dollars earned across every release over this step. */
  earned: number
}

/**
 * Advance the whole catalogue by `dt` seconds and bank what it earned.
 *
 * **A release that retires pays its exact remainder**, so the sum of everything
 * this function ever returns for one release is its ladder payout to the cent.
 * That is the §4.10e constraint enforced at the only place it can leak.
 *
 * `held` is §4.12a's incident freeze: a release in that set **does not age**, so
 * its tail pauses and later resumes. That is why an incident is a freeze rather
 * than a deletion — the invariant above is the one thing this file exists to
 * protect, and a mechanic that destroyed tail revenue would break it and take
 * the books with it. The money still all arrives; it arrives *later*, while
 * §4.10d's payroll runs the whole time, so an incident is priced in runway.
 *
 * A held release is also excluded from retirement, so a game cannot quietly go
 * off sale while it is down and hand over its remainder as a reward for
 * neglecting it.
 */
export function advanceTail(
  releases: readonly Release[],
  dt: number,
  held: ReadonlySet<number> = new Set(),
): TailStep {
  if (!(dt > 0) || releases.length === 0) {
    return { releases: releases as Release[], earned: 0 }
  }

  const next: Release[] = []
  let earned = 0

  for (const release of releases) {
    if (held.has(release.id)) {
      next.push(release)
      continue
    }
    const age = release.age + dt

    if (age >= RETIRE_AFTER_SECONDS) {
      // Off sale. Hand over whatever the asymptote never got round to.
      earned += release.payout - release.paid
      continue
    }

    const paid = release.payout * collectedFraction(release.shape, age)
    earned += paid - release.paid
    next.push({ ...release, age, paid })
  }

  return { releases: next, earned }
}

/**
 * Dollars per second the whole catalogue is currently bringing in — §4.10d.
 *
 * `held` is §4.12a's freeze again. A release that is down earns nothing and must
 * read as earning nothing, or §10.1's income line would keep quoting money the
 * player is not receiving — which is the class of lie §4.10e was written to stop
 * the economy telling and §10.6 forbids the readouts from telling separately.
 */
export function catalogueIncome(
  releases: readonly Release[],
  held: ReadonlySet<number> = new Set(),
): number {
  let total = 0
  for (const release of releases) {
    if (held.has(release.id)) continue
    total += earningRate(release)
  }
  return total
}

/** What is still owed across the catalogue, for the runway readout. */
export function catalogueOutstanding(releases: readonly Release[]): number {
  let total = 0
  for (const release of releases) total += release.payout - release.paid
  return total
}
