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
 * is unwinnable and I do not know why". So the roll is never used raw: it is
 * normalised against the unit holding it, in [`aggregate.ts`](./aggregate.ts),
 * which makes the sum exactly the headcount for every seed at every size.
 * Exaggerate the variance; hold the average — with no room left for the average
 * to drift.
 *
 * **The normalise used to be here and used to be global** — a prefix table of
 * the first ten thousand rolls, and a flat 1 for every seat past it. §26.2 is
 * the phase that gave those seats somebody to be compared with, so it moved and
 * became hierarchical. See `aggregate.ts`'s header for what changed and why.
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
 * Where the roster cap went — GDD §26.2, 2026-08-18.
 *
 * `ROSTER_CAP`, `rosterMean`, `prefixSums`, `outputShare` and `shareSum` all
 * used to live here. They normalised **globally**, against a prefix table of
 * the first ten thousand rolls, and returned exactly 1 for every seat past it
 * — correct while nothing above the room could be looked at, and the reason
 * §26.2.5's line 4 would have passed while nothing had been built.
 *
 * They are now [`aggregate.ts`](./aggregate.ts), which normalises **top-down**:
 * the studio's weight is the headcount and every level divides it exactly, so
 * the shares sum to the headcount by construction at any size, and a hundred
 * people at seat fifty million differ from each other exactly as much as the
 * first hundred do.
 *
 * This module kept the half it was always about: **what one person is worth.**
 */

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

