/**
 * The Rating — the only number that judges a run. GDD §4.14, R23.
 *
 * **Every other score in this game measures size.** Cash, headcount, Story
 * Points, the whole Construction Ladder — all of them go up and none of them is
 * ever *bad*. This is the first quantity in the design that can go **down while
 * everything else goes up**, which is the only way anything on screen can say
 * the studio is doing badly.
 *
 * §25.3.1 says to build it before §4.12's defects, and the argument is worth
 * repeating because this file is where it is honoured: *"building R21's defects
 * first means guessing what a bug is worth, and a guess made at that point
 * becomes canon by accident."* So the scale is named **here** and `defects.ts`
 * takes its coefficient from {@link DEFECT_DENSITY_ANCHOR}, rather than this
 * file being calibrated against whatever β turned out to be.
 *
 * ## The three weights, and the one thing about them that is canon
 *
 * §4.14 fixes their **order** — defects dominant, hero ability strong, craft
 * moderate — and §25.3.2 explicitly refuses to fix their values. So the order
 * is what the tests pin and the values are a first pass that wants a playtest.
 *
 * ## The baseline is derived from the garage, not picked at fifty
 *
 * This is the load-bearing decision in the file and it took two wrong answers
 * to reach.
 *
 * The rating multiplies revenue (§4.14: "§4.10e's payout scales with the
 * rating"), and §4.10's economy is calibrated against §21's two stated
 * figures — *Flappy Square* pays exactly +$50. A neutral point picked at 50/100
 * would therefore have quietly rebalanced **every number in the game**, because
 * a Run 1 studio has no heroes at all and would have scored well under it.
 * Worse, the hero term would have become a *gate* on the rating rather than
 * amplitude, which §13.6.7 forbids in the one sentence it spends on the
 * subject.
 *
 * So the neutral point is not chosen. It is {@link BASELINE_RATING}: **what a
 * garage ships** — no QA, no heroes, an average team — computed from the
 * weights themselves. A player who ignores this entire batch earns exactly what
 * they earned before it existed, at every multiplier, and the arithmetic says
 * so rather than a comment claiming it. Everything above the garage is a bonus
 * and everything below it is a penalty, which is also the only framing under
 * which "ships a 12/100 and makes a fortune" stays funny instead of punitive.
 *
 * Pure — no store, no clock, no renderer.
 */

/**
 * §4.14's three inputs, weighted. **The order is canon; the values are not.**
 *
 * "Defects dominate deliberately. The other two are things the player arranges
 * in advance; defects are the thing they are choosing to ignore *right now* in
 * exchange for going faster."
 */
export const RATING_WEIGHTS = {
  defects: 0.5,
  heroes: 0.3,
  craft: 0.2,
} as const

/**
 * Defects per Story Point at which the defect half of the score is exactly ½.
 *
 * **This is the batch's one genuinely load-bearing number, and it is defined
 * here rather than in `defects.ts` on purpose.** §4.12's β is set *from* it, so
 * a studio with no QA ships at exactly this density and therefore always scores
 * exactly half on defects — which means **β cannot secretly rebalance the
 * rating.** Retuning how fast bugs arrive changes how quickly a studio reaches
 * §4.12's incident threshold and changes nothing about what a shipped game is
 * worth. That is the §25.3.2 dodge done properly: the quantity nobody has
 * measured is prevented from mattering in two places at once.
 *
 * What the rating then actually measures is **how well you are managing
 * defects relative to doing nothing about them**, which is the question the
 * player is really being asked.
 *
 * One defect per fifty Story Points, with nobody checking. First pass.
 */
export const DEFECT_DENSITY_ANCHOR = 0.02

/**
 * How many releases it takes reputation to forget one — §4.14.
 *
 * "Reputation decays slowly enough to be outrun by volume for a while." Eight
 * is slow enough that a bad patch is survivable and fast enough that a run of
 * shovelware is eventually priced in.
 */
export const REPUTATION_MEMORY = 8

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function clampScore(x: number): number {
  if (!Number.isFinite(x)) return 0
  return x < 0 ? 0 : x > 100 ? 100 : x
}

/**
 * §4.12's backlog at ship, per Story Point → 0..1.
 *
 * `1 / (1 + d / anchor)`. Perfect at zero, exactly ½ at the anchor, and
 * **never zero** however broken the game is. The floor is not a numerical
 * safeguard: a term that could reach zero would make a sufficiently buggy
 * release worth nothing, and §4.14 is explicit that the rating is a pressure
 * rather than a morality.
 */
export function defectScore(density: number): number {
  const d = Number.isFinite(density) ? Math.max(0, density) : 0
  return 1 / (1 + d / DEFECT_DENSITY_ANCHOR)
}

/**
 * §4.9a's realised output share of the developers who built it → 0..1.
 *
 * `m / (m + 1)`, so a team of exactly average developers scores ½ — and
 * "average" is an exact number here rather than an approximation, because
 * §4.9a pins the roster mean at 1.0 twice over.
 *
 * **It washes out as the studio grows, and that is the design rather than a
 * limitation.** The mean of `n` shares converges on 1 as `n` rises, so craft
 * swings wildly in a garage and is almost constant at a million people. §4.14
 * asks whether a game was "built by the people or by the headcount"; at a
 * million developers the honest answer is always the headcount, and the term
 * says so by going quiet.
 */
export function craftScore(meanShare: number): number {
  const m = Number.isFinite(meanShare) ? Math.max(0, meanShare) : 0
  return m / (m + 1)
}

/**
 * **What a garage ships.** No QA, no heroes, an average team.
 *
 * Derived from the weights rather than written down, so it cannot drift out of
 * step with them: the defect term sits at ½ because a studio with no QA ships
 * at exactly {@link DEFECT_DENSITY_ANCHOR}, the hero term at 0 because there
 * are no heroes, and the craft term at ½ because the roster mean is pinned.
 *
 * Every multiplier below is ×1 here. See the file header for why that matters
 * more than the number does.
 */
export const BASELINE_RATING =
  100 * (RATING_WEIGHTS.defects * 0.5 + RATING_WEIGHTS.heroes * 0 + RATING_WEIGHTS.craft * 0.5)

export interface RatingInputs {
  /** §4.12's defect backlog at the moment it shipped. */
  defects: number
  /** What the project cost, in Story Points. */
  storyPoints: number
  /** §13.6 coverage over the team that built it, 0..1. */
  heroCoverage: number
  /** §4.9a's mean realised output share of the developers on it. */
  craft: number
}

/**
 * Score a shipped game out of 100 — §4.14.
 *
 * A release with no Story Points behind it is unrated rather than perfect: it
 * scores the baseline, because dividing a backlog by zero work is a question
 * about a game nobody built.
 */
export function rateRelease(inputs: RatingInputs): number {
  const sp = Number.isFinite(inputs.storyPoints) ? inputs.storyPoints : 0
  if (!(sp > 0)) return BASELINE_RATING

  const defects = Number.isFinite(inputs.defects) ? Math.max(0, inputs.defects) : 0
  const score =
    RATING_WEIGHTS.defects * defectScore(defects / sp) +
    RATING_WEIGHTS.heroes * clamp01(inputs.heroCoverage) +
    RATING_WEIGHTS.craft * craftScore(inputs.craft)

  return clampScore(100 * score)
}

/**
 * Fold a new rating into the studio's reputation — §4.14.
 *
 * An exponential moving average over {@link REPUTATION_MEMORY} releases. A run
 * opens at {@link BASELINE_RATING} rather than at zero: a studio that has
 * shipped nothing has a garage's reputation, and starting at zero would tax the
 * first project for the crime of being first.
 */
export function advanceReputation(reputation: number, rating: number): number {
  const rep = Number.isFinite(reputation) ? reputation : BASELINE_RATING
  const next = Number.isFinite(rating) ? rating : rep
  return clampScore(rep + (next - rep) / REPUTATION_MEMORY)
}

/**
 * Two straight lines meeting at the baseline, ×1 there by construction.
 *
 * Piecewise rather than a single lerp because the neutral point is not the
 * midpoint — see {@link BASELINE_RATING} — and a single line through it would
 * have to give up one of the two endpoints.
 */
function aroundBaseline(score: number, floor: number, ceiling: number): number {
  const r = clampScore(score)
  if (r >= BASELINE_RATING) {
    return 1 + ((r - BASELINE_RATING) / (100 - BASELINE_RATING)) * (ceiling - 1)
  }
  return floor + (r / BASELINE_RATING) * (1 - floor)
}

/**
 * §4.14 — "§4.10e's payout scales with the rating."
 *
 * A 0/100 still pays over half. **The satire has to survive the scoring**: a
 * multiplier that approached zero would turn the rating into a fail state by
 * arithmetic, which §25.3.2 forbids outright, and would delete the funniest
 * outcome the game has — shipping a 12 and making a fortune anyway.
 */
export function revenueMultiplier(rating: number): number {
  return aroundBaseline(rating, 0.55, 1.6)
}

/**
 * §4.14 — reputation scales §4.10c's revenue *per Story Point*.
 *
 * "The studio's rate is a fact about its reputation, which is what §4.10c
 * already says and never had a mechanism for." Gentler than the per-release
 * multiplier because it is a standing effect rather than a verdict on one game.
 */
export function reputationMultiplier(reputation: number): number {
  return aroundBaseline(reputation, 0.8, 1.25)
}

/**
 * §4.14, §14.1 — banked Paradigm Points scale with reputation.
 *
 * **The first thing in the game that rewards playing well instead of playing
 * more**, and the reason the whole batch is worth building. The spread is the
 * widest of the three on purpose: prestige is where a run is finally judged,
 * and a ×0.5/×2 swing is the difference between two runs of the same length.
 */
export function prestigeMultiplier(reputation: number): number {
  return aroundBaseline(reputation, 0.5, 2)
}

/** How many steps §10.11.3's cover-frame ramp has. */
export const RATING_BANDS = 4

/**
 * §10.11.3 — "the rating tints the frame. The score picks the ramp step, so a
 * wall of covers reads as a quality history *before a single number has been
 * read*."
 */
export function ratingBand(rating: number): number {
  const r = clampScore(rating)
  return Math.min(RATING_BANDS - 1, Math.floor((r / 100) * RATING_BANDS))
}
