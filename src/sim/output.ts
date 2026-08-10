/**
 * What each developer is actually worth — GDD §4.9a.
 *
 * §7.8.7 gives every developer a face. This gives them an **output**, rolled
 * the same way — from the seat index and the run seed, never stored — and the
 * instruction attached to it is to *exaggerate it*: "some people are worth ten
 * of the person next to them, some are worth a tenth. That is true of real
 * teams, it is the observation the whole game is built on, and a studio where
 * everyone produces the mean is a spreadsheet."
 *
 * Two constraints pull against each other and both are non-negotiable, so the
 * distribution is chosen to satisfy them by construction rather than by tuning.
 *
 * ## 1. The spread is wide, and the tail is where the heroes live
 *
 * **Log-normal**, because it is the only common distribution whose *shape* is
 * the claim being made: multiplicative, unbounded above, bounded below by zero,
 * and with a long thin upper tail that a small number of people occupy. §14.4's
 * hero classes then need no separate system — "a 10x Engineer is not a special
 * unit type, it is the top of the roll", which is a sentence about a
 * distribution and is implemented as one.
 *
 * At {@link OUTPUT_SIGMA} = 0.9 the numbers land almost exactly on §4.9a's own
 * two examples, which is why it is the value:
 *
 * | Percentile | Multiplier |
 * |---|---|
 * | 1st | **0.08** — "worth a tenth" |
 * | 25th | 0.36 |
 * | 50th | 0.67 |
 * | 75th | 1.22 |
 * | 99th | 5.4 |
 * | 99.9th | **10.8** — the 10x Engineer, one in a thousand |
 *
 * The median sitting *below* the mean is the point rather than a defect: most
 * of a studio's output comes from a minority of it, and a distribution where
 * the typical developer is average would be saying the opposite.
 *
 * ## 2. The mean is pinned — and pinned twice, because once is not enough
 *
 * §4.9a: "widening the spread must not change the total — section 4's economy
 * is calibrated on the sum, and a distribution that drifts its own mean
 * silently rebalances the whole game."
 *
 * **First, in the distribution.** A log-normal with parameters (μ, σ) has mean
 * `exp(μ + σ²/2)`, so setting `μ = −σ²/2` makes the mean exactly 1 whatever σ
 * is. σ can then be widened freely — which is what §4.9a asks for — and the
 * average cannot move, because it is not a consequence of σ at all.
 *
 * **Second, in the realised roster**, which is the half that matters and the
 * half that is easy to miss. A pinned *distribution* mean only pins the
 * *expected* sum. At σ = 0.9 the coefficient of variation is 1.12, so a studio
 * of forty rolls a total anywhere in roughly ±18% of forty — an eighteen per
 * cent swing in Run 1's economy decided by the run seed, arriving as "this run
 * is unwinnable and I do not know why". So every share is divided by the mean
 * the roster *actually* rolled ({@link outputShare}), which makes the sum
 * exactly the headcount, for every seed, at every size. Exaggerate the
 * variance; hold the average — with no room left for the average to drift.
 *
 * Pure and dependency-free apart from `identity.ts`'s hash, so the rule that
 * decides what a developer is worth is testable without a store or a renderer.
 */

import { draw } from './identity.ts'

/**
 * The width of the spread, in log space. **The knob §4.9a says to turn**, and
 * turning it cannot change the average — see the file header.
 */
export const OUTPUT_SIGMA = 0.9

/**
 * Bounds on a single roll.
 *
 * A log-normal has no upper limit, and at a hundred thousand seats it will
 * eventually produce one. The clamps are not a balance decision — the roster
 * normalise below makes the total exact regardless — they exist so no single
 * numeral on screen is `+41,000` beside a floor of `+1`s, and so a developer is
 * never worth so nearly nothing that their §8.2b numeral rounds away entirely.
 */
const MIN_ROLL = 0.02
const MAX_ROLL = 25

/** Draw channels, past the ones `identity.ts` uses. */
const CH_NORMAL_U1 = 20
const CH_NORMAL_U2 = 21

/**
 * §21 — James is developer 1, and his output is written down rather than
 * rolled, exactly as his name and face are.
 *
 * Deliberately just under the average. He is the co-founder who spends the
 * whole of §21 being wrong about how big this can get, and a James who turned
 * out to be a secret 10x Engineer would be a different joke and a worse one.
 */
export const JAMES_ROLL = 0.9

/** Box-Muller, from two of the shared hash's uniform draws. */
function standardNormal(seed: number, index: number): number {
  // `draw` can return exactly 0 and `log(0)` is −Infinity, which would come
  // back as a roll of MAX_ROLL for one unlucky seat on one unlucky seed —
  // a bug that would appear once in four billion and never reproduce.
  const u1 = Math.max(1e-12, draw(seed, index, CH_NORMAL_U1))
  const u2 = draw(seed, index, CH_NORMAL_U2)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * What seat `index` is worth, as a multiple of the average developer.
 *
 * Generated, never stored — the same contract as §7.8.7's identities, and for
 * the same reasons: a million developers cost one integer, and the person who
 * is a 10x Engineer is the same person after a reload.
 */
export function outputRoll(seed: number, index: number): number {
  if (index === 1) return JAMES_ROLL
  const mu = -(OUTPUT_SIGMA * OUTPUT_SIGMA) / 2
  const roll = Math.exp(mu + OUTPUT_SIGMA * standardNormal(seed, index))
  return Math.min(MAX_ROLL, Math.max(MIN_ROLL, roll))
}

/**
 * How many seats the roster mean is measured over.
 *
 * §7.8.1a's full floor. Past it individual developers are not drawn, not
 * pokeable and not shown a numeral, so their rolls have nobody to be compared
 * with — and a mean over ten thousand samples is within a percent of the true
 * one anyway, which is far inside anything the economy can feel.
 */
export const ROSTER_CAP = 10_000

/**
 * Prefix sums of the rolls, per seed.
 *
 * One array per run rather than a recomputation per query: the HUD, the
 * renderer and the store all ask for shares every frame, and ten thousand
 * `exp` calls sixty times a second is not a thing to do casually. Two seeds are
 * kept because a Paradigm Shift replaces the roster and the old run's numbers
 * are still being read for a frame or two on the way out.
 */
const sums = new Map<number, Float64Array>()

function prefixSums(seed: number): Float64Array {
  const cached = sums.get(seed)
  if (cached) return cached

  const table = new Float64Array(ROSTER_CAP + 1)
  for (let i = 0; i < ROSTER_CAP; i++) table[i + 1] = table[i] + outputRoll(seed, i)

  // Two is enough, and unbounded growth here would be a leak that only shows
  // up after a long session of prestiges.
  if (sums.size >= 2) sums.delete(sums.keys().next().value as number)
  sums.set(seed, table)
  return table
}

/** The average roll across the first `devs` seats — what the shares divide by. */
export function rosterMean(seed: number, devs: number): number {
  const n = Math.min(ROSTER_CAP, Math.max(1, Math.floor(devs)))
  const mean = prefixSums(seed)[n] / n
  // A roster of one is its own mean, so its share is 1 — correct, and it also
  // stops the very first developer in the game producing 0.67 of the velocity
  // the readout above their head promises.
  return mean > 0 ? mean : 1
}

/**
 * Seat `index`'s share of the studio, as a multiple of the average — GDD §4.9a.
 *
 * **This is the number the simulation uses, and it is not `outputRoll`.** The
 * shares over a roster sum to exactly the headcount, so multiplying the
 * studio's velocity by a seat's share and adding it up gives the velocity back
 * unchanged. That is the whole of §4.9a's "hold the average", and it is done
 * here rather than trusted to the distribution because a forty-person studio is
 * far too small a sample for the distribution's own mean to be worth anything.
 */
export function outputShare(seed: number, devs: number, index: number): number {
  const i = Math.max(0, Math.floor(index))
  if (i >= ROSTER_CAP) return 1
  return outputRoll(seed, i) / rosterMean(seed, devs)
}

/**
 * The shares of a whole seat range, summed — GDD §4.5b.
 *
 * R14 buffs a **unit**, and above the room a unit is a floor, a building, a
 * town. Asking {@link outputShare} a million times to find out what a town is
 * worth is not a thing to do on a tick, and the prefix sums that already exist
 * for {@link rosterMean} answer it in two array reads.
 *
 * Past {@link ROSTER_CAP} every seat's share is exactly 1 — individuals are
 * neither drawn nor pokeable there, so there is nobody for them to differ from
 * — which makes the tail of the range simply its length. Without that a buff on
 * a town of a million would evaluate to zero and R15's whole top half of the
 * ladder would be a verb that does nothing, which is the bug it exists to fix.
 */
export function shareSum(seed: number, devs: number, from: number, to: number): number {
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.floor(to)
  if (hi <= lo) return 0

  const table = prefixSums(seed)
  const rolled = Math.min(hi, ROSTER_CAP)
  const summed = rolled > lo ? (table[rolled] - table[lo]) / rosterMean(seed, devs) : 0

  return summed + Math.max(0, hi - Math.max(lo, ROSTER_CAP))
}

/**
 * What to call a developer's output — §14.4's hero classes, as bands of the
 * roll rather than as a separate system.
 *
 * Thresholds on the *share*, so they describe somebody's standing in the studio
 * they are actually in rather than their absolute number. The bands are wide
 * and there are only four: this is a label under a name on a card, not a stat
 * block, and §7.8.7's restraint about identity stats applies here too.
 */
export type OutputClass = '10x' | 'strong' | 'steady' | 'slow'

export function outputClass(share: number): OutputClass {
  if (share >= 8) return '10x'
  if (share >= 1.6) return 'strong'
  if (share >= 0.45) return 'steady'
  return 'slow'
}

/** Reset the memo — test seam, and the only reason this module has state. */
export function __clearRosterCache(): void {
  sums.clear()
}
