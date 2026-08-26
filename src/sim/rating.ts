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
 * ## Six inputs, three of which §4.14 wrote down
 *
 * §4.14's table has three rows — defects, hero ability, craft — and it fixes
 * their **order** (defects dominant, hero ability strong, craft moderate) while
 * §25.3.2 explicitly refuses to fix their values. That order is still canon and
 * is still what the tests pin.
 *
 * Three more sit beside them, and each one exists because a thing the player
 * genuinely does was invisible to the score:
 *
 * - **Team sync** — `teamSync.ts`. §6's whole thesis is that a company gets
 *   worse at building software as it grows, and §4.1 models it; until this term
 *   existed, the *only* consequence was less output. A diluted studio shipped
 *   later, not worse. Now the organisation is on the release.
 * - **Traits** — how developed the founder's Management tree (§13.7.1) and the
 *   placed heroes' own branches (§13.9.1) are. §4.14's hero row measures
 *   *coverage*, which is a question about the org chart; this measures whether
 *   the people on it are any good, which is a different question and was
 *   nowhere.
 * - **Luck** — reception. See {@link luckRoll} for the one line of §4.10e it
 *   has to be read against, and why it does not break it.
 *
 * The three additions are sized against one sentence of §4.14 that has to
 * survive them: *"defects are the thing they are choosing to ignore right
 * now."* Defects therefore went **up** to 0.4 rather than down, and everything
 * else was fitted around it — because the arithmetic that matters is what a
 * thoroughly broken game can score with every other input perfect, and each
 * point given to a new term is a point that ceiling rises by. At these weights
 * it is 60/100 with nothing broken-adjacent going wrong anywhere else, which no
 * studio that has actually let its backlog rot is going to be near.
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
 * garage ships** — no QA, no heroes, an average team, perfectly in sync with
 * itself, and averagely lucky — computed from the weights themselves. A
 * player who ignores this entire batch earns exactly what they earned before
 * it existed, at every multiplier, and the arithmetic says
 * so rather than a comment claiming it. Everything above the garage is a bonus
 * and everything below it is a penalty, which is also the only framing under
 * which "ships a 12/100 and makes a fortune" stays funny instead of punitive.
 *
 * Pure — no store, no clock, no renderer.
 */

import { draw } from './identity.ts'
import { GARAGE_SYNC } from './teamSync.ts'

/**
 * The six inputs, weighted. **§4.14's order is canon; no value here is.**
 *
 * "Defects dominate deliberately. The other two are things the player arranges
 * in advance; defects are the thing they are choosing to ignore *right now* in
 * exchange for going faster."
 *
 * `defects > heroes > craft` is the part §4.14 writes down and the part
 * `rating.test.ts` pins. The other three are placed by argument:
 *
 * - **sync above craft**, because craft goes quiet as the studio grows (see
 *   {@link craftScore}) and sync is precisely the term that does not — at a
 *   million developers the organisation is the only thing left that varies.
 * - **luck above craft** for the same reason, and because a variance nobody can
 *   feel is a variance not worth rolling. Twelve points of spread is about ±6%
 *   of revenue at the neutral point: enough that two runs of the same ladder
 *   are visibly different games, small enough that the ladder still decides
 *   what a project is worth.
 * - **traits last**, because it is the slowest of the six to move and the one
 *   most nearly a *second* reading of hero coverage. It is the seasoning.
 */
export const RATING_WEIGHTS = {
  defects: 0.4,
  heroes: 0.16,
  sync: 0.14,
  luck: 0.12,
  craft: 0.1,
  traits: 0.08,
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
 * §13.7.1's Management tree against §13.9.1's hero branches → 0..1.
 *
 * The heroes carry slightly more than the founder because §13.7.1 is a joke
 * about breadth without depth — the manager is the only person who can do
 * everything and therefore the worst person to do any of it — and a rating that
 * paid the founder more than the specialists would be telling that joke
 * backwards.
 *
 * Both halves are 0 in a garage, which is what keeps {@link BASELINE_RATING}
 * where §4.14.1 needs it.
 */
export const TRAIT_SPLIT = { founder: 0.45, heroes: 0.55 } as const

export function traitScore(founderMastery: number, heroMastery: number): number {
  return clamp01(
    TRAIT_SPLIT.founder * clamp01(founderMastery) + TRAIT_SPLIT.heroes * clamp01(heroMastery),
  )
}

/** An averagely received game. The neutral point of {@link luckRoll}. */
export const LUCK_NEUTRAL = 0.5

/**
 * Reception — §4.14's luck, rolled once and never again.
 *
 * ## The line of §4.10e this has to be read against
 *
 * *"Randomised in the shape, never in the total — a player who ships the same
 * game must not be able to be unlucky with it. That line is what keeps this
 * from being gambling."*
 *
 * That sentence is about the **tail**, and it stands exactly. Once a release
 * knows what it is worth, `revenue.ts` pays every cent of it whatever τ₁, τ₂ and
 * the spike share roll — a player watching a graph can never be cheated by it.
 *
 * What varies here is what the release *is worth*, which is a different claim
 * and a true one: a studio does not decide how a game is received. It is not
 * gambling for three reasons, and all three are arithmetic rather than taste:
 *
 *  1. **It is one input of six**, at {@link RATING_WEIGHTS}.luck, and the
 *     smallest of the ones the player cannot control. The other five are all
 *     decisions.
 *  2. **It is bounded.** The full roll spans twelve rating points, which is
 *     about ±6% of a payout. A defect backlog is worth forty.
 *  3. **It is deterministic in the run seed and the ordinal** — the same
 *     contract §7.8.7 uses for faces and §4.10e uses for tail shapes. A reload
 *     cannot reroll a release the player has already seen, and save-scumming a
 *     bad review is not a strategy because the review is a fact about the seed.
 *
 * ## The shape
 *
 * Triangular about ½ — the mean of two draws — rather than uniform. Most games
 * are received about as well as they deserve; a breakout hit and a flop are
 * both rare and neither is impossible. A uniform roll would make one release in
 * five a disaster, which reads as noise rather than as reception.
 */
export function luckRoll(seed: number, ordinal: number): number {
  return (draw(seed, ordinal, 41) + draw(seed, ordinal, 42)) / 2
}

/**
 * **What a garage ships.** No QA, no heroes, an average team, in sync with
 * itself, averagely received.
 *
 * Derived from the weights rather than written down, so it cannot drift out of
 * step with them: the defect term sits at ½ because a studio with no QA ships
 * at exactly {@link DEFECT_DENSITY_ANCHOR}, the hero and trait terms at 0
 * because there is nobody to be good, the craft term at ½ because the roster
 * mean is pinned, sync at {@link GARAGE_SYNC} because one desk has no
 * communication overhead and no catalogue to be understaffed for, and luck at
 * {@link LUCK_NEUTRAL} because that is the mean of the roll.
 *
 * Every multiplier below is ×1 here. See the file header for why that matters
 * more than the number does — and note that adding three terms did **not**
 * re-tune the economy, precisely because this is a derivation and not a
 * constant somebody would have had to remember to change.
 */
export const BASELINE_RATING =
  100 *
  (RATING_WEIGHTS.defects * 0.5 +
    RATING_WEIGHTS.heroes * 0 +
    RATING_WEIGHTS.sync * GARAGE_SYNC +
    RATING_WEIGHTS.luck * LUCK_NEUTRAL +
    RATING_WEIGHTS.craft * 0.5 +
    RATING_WEIGHTS.traits * 0)

export interface RatingInputs {
  /** §4.12's defect backlog at the moment it shipped. */
  defects: number
  /** What the project cost, in Story Points. */
  storyPoints: number
  /** §13.6 coverage over the team that built it, 0..1. */
  heroCoverage: number
  /** §4.9a's mean realised output share of the developers on it. */
  craft: number
  /**
   * `teamSync.ts` over the build, 0..1. Defaults to {@link GARAGE_SYNC}.
   *
   * **The three additions default to the garage rather than to zero**, and that
   * is the same decision `save.ts` makes about a release with no recorded
   * defect density: the honest reading of "we were not told" is *what a studio
   * with none of this ships at*, not *the worst possible studio*. It also means
   * every existing caller — and §21.0c's ungraded Run 1 — keeps scoring exactly
   * what it scored before these terms existed.
   */
  sync?: number
  /** §13.7.1 and §13.9.1's depth, 0..1. Defaults to a garage's 0. */
  traits?: number
  /** {@link luckRoll}, 0..1. Defaults to {@link LUCK_NEUTRAL}. */
  luck?: number
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
  const sync = inputs.sync === undefined ? GARAGE_SYNC : clamp01(inputs.sync)
  const luck = inputs.luck === undefined ? LUCK_NEUTRAL : clamp01(inputs.luck)
  const score =
    RATING_WEIGHTS.defects * defectScore(defects / sp) +
    RATING_WEIGHTS.heroes * clamp01(inputs.heroCoverage) +
    RATING_WEIGHTS.sync * sync +
    RATING_WEIGHTS.luck * luck +
    RATING_WEIGHTS.craft * craftScore(inputs.craft) +
    RATING_WEIGHTS.traits * clamp01(inputs.traits ?? 0)

  return clampScore(100 * score)
}

/**
 * What each input contributed, in rating points — §10.11's breakdown.
 *
 * Derived from the same weights the score is, so the gallery cannot print a
 * bar that adds up to a different number than the one beside it. The six sum to
 * exactly {@link rateRelease}'s answer for any input that does not clamp.
 */
export interface RatingBreakdown {
  defects: number
  heroes: number
  sync: number
  luck: number
  craft: number
  traits: number
}

export function ratingBreakdown(inputs: RatingInputs): RatingBreakdown {
  const sp = Number.isFinite(inputs.storyPoints) ? inputs.storyPoints : 0
  const defects = Number.isFinite(inputs.defects) ? Math.max(0, inputs.defects) : 0
  const sync = inputs.sync === undefined ? GARAGE_SYNC : clamp01(inputs.sync)
  const luck = inputs.luck === undefined ? LUCK_NEUTRAL : clamp01(inputs.luck)
  return {
    defects: 100 * RATING_WEIGHTS.defects * (sp > 0 ? defectScore(defects / sp) : 0.5),
    heroes: 100 * RATING_WEIGHTS.heroes * clamp01(inputs.heroCoverage),
    sync: 100 * RATING_WEIGHTS.sync * sync,
    luck: 100 * RATING_WEIGHTS.luck * luck,
    craft: 100 * RATING_WEIGHTS.craft * craftScore(inputs.craft),
    traits: 100 * RATING_WEIGHTS.traits * clamp01(inputs.traits ?? 0),
  }
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
