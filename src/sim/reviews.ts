/**
 * The reviews — GDD §10.8b, the reception a release actually gets read out.
 *
 * §4.14 scores every release out of 100 and, until this existed, the only place
 * that number was ever *said* was a small figure on §10.11's gallery wall, some
 * time later, if the player went looking. The rating is the one quantity in the
 * design that can go down while everything else goes up; it deserves to arrive
 * as an event rather than as a column.
 *
 * So a release is reviewed. Three outlets, each with a score out of ten and one
 * line of copy, and then the aggregate — which is §4.14's number, unchanged.
 * The critics do not compute anything; they *report*. That distinction is the
 * whole reason this file is allowed to exist beside `rating.ts`: it is
 * presentation of a fact, and it may never become an input to one.
 *
 * ## Deterministic in the seed and the ordinal
 *
 * The same contract §7.8.7 uses for faces, §4.10e for tail shapes and §4.14 for
 * `luckRoll`: a reload cannot reroll a review the player has already read. It
 * also means a release's press is a *fact about that release* — the gallery
 * could show it back years later and it would be the same three quotes.
 *
 * ## The outlets are invented, not thinly veiled
 *
 * A parody masthead attached to a fabricated one-line pan of a fabricated game
 * is a joke; the same joke wearing a real publication's name is that
 * publication's byline on copy it never wrote. These are all made up, and they
 * are made up in the direction of the *genre* of games press rather than at any
 * particular one of them.
 *
 * Pure — no store, no clock, no renderer.
 */

import { draw } from './identity.ts'
import { ratingBand, RATING_BANDS } from './rating.ts'

export interface Review {
  outlet: string
  /** Out of ten. Derived from §4.14's score, spread per outlet. */
  score: number
  quote: string
}

/**
 * Three. Two is a coincidence and four does not fit above the aggregate on a
 * handset in landscape (§23.4.2), which is the only shape this ever renders in.
 */
export const REVIEW_COUNT = 3

const OUTLETS = [
  'BYTE WEEKLY',
  'THE CRUNCH',
  'PIXEL DISPATCH',
  'FRAME RATE',
  'THE BACKLOG',
  'SIDE QUEST',
  'HARD RESET',
  'CRITICAL PATH',
  'INDIE ALMANAC',
  'LOOT DROP',
  'PATCH NOTES',
  'SECOND CONTROLLER',
] as const

/**
 * One column per §10.11.3 rating band, worst first, so the index is
 * `ratingBand`'s and cannot drift from the frame tint the gallery draws.
 *
 * The copy climbs from *this is an incident* to *this is a career*, and every
 * line is about the reviewer rather than about the game — which is where the
 * joke in a review actually lives, and also the only way twelve lines can cover
 * eight titles without describing a game the player did not make.
 */
const QUOTES: readonly (readonly string[])[] = [
  [
    'IT CRASHED ON THE MENU.',
    'WHO SIGNED THIS OFF?',
    'I HAVE FILED A REPORT.',
    'ZERO. ROUNDED UP.',
    'THIS SHOULD NOT EXIST.',
    'MY DEVICE IS WARM AND ANGRY.',
  ],
  [
    'IT RUNS. THAT IS THE REVIEW.',
    'WAIT FOR THE PATCH.',
    'THERE IS A GAME IN HERE SOMEWHERE.',
    'AMBITIOUS. UNFINISHED.',
    'I WANT MY EVENING BACK.',
    'FINE, I SUPPOSE.',
  ],
  [
    'SOLID, IF UNSURPRISING.',
    'BETTER THAN THE LAST ONE.',
    'WORTH THE MONEY.',
    'A COMPETENT VIDEO GAME.',
    'I ENJOYED MOST OF IT.',
    'RECOMMENDED, QUIETLY.',
  ],
  [
    'A GENERATIONAL ACHIEVEMENT.',
    'I HAVE NOT SLEPT.',
    'THEY ACTUALLY DID IT.',
    'GAME OF THE FISCAL YEAR.',
    'PERFECT. NO NOTES.',
    'I AM SHAKING. PROFESSIONALLY.',
  ],
]

/**
 * The one-word verdict stamped over the aggregate — §10.8b.
 *
 * Indexed by {@link ratingBand}, so the word, the cover frame's tint and the
 * score are three readings of one number and can never disagree.
 */
const VERDICTS = ['SHOVELWARE', 'MIXED', 'ACCLAIMED', 'MASTERPIECE'] as const

export function verdictFor(rating: number): string {
  return VERDICTS[Math.min(VERDICTS.length - 1, ratingBand(rating))]
}

/**
 * How far one outlet may sit from the aggregate, in points out of ten.
 *
 * ±1.5 is enough that the three scores are visibly three opinions and small
 * enough that they still read as being about the same game. A wider spread
 * makes the aggregate look computed from somewhere else, which it is — and the
 * player must never be able to catch it at that.
 */
const SPREAD = 1.5

/** Draw one entry out of a list and remove it. Deterministic in the channel. */
function take<T>(pool: T[], seed: number, ordinal: number, channel: number): T {
  const i = Math.min(pool.length - 1, Math.floor(draw(seed, ordinal, channel) * pool.length))
  return pool.splice(i, 1)[0]
}

/**
 * §4.14's score, as three opinions. `seed` and `ordinal` are the release's own.
 *
 * Both the mastheads and the lines are drawn **without replacement**, so no
 * outlet reviews the game twice and no two of them say the same sentence — the
 * sort of thing nobody notices working and everybody notices broken.
 */
export function reviewsFor(seed: number, ordinal: number, rating: number): Review[] {
  const band = Math.min(RATING_BANDS - 1, Math.max(0, ratingBand(rating)))
  const quotes = [...QUOTES[band]]
  const outlets = [...OUTLETS] as string[]
  const reviews: Review[] = []

  for (let i = 0; i < REVIEW_COUNT; i++) {
    const outlet = take(outlets, seed, ordinal, 61 + i)
    const quote = take(quotes, seed, ordinal, 81 + i)
    const offset = (draw(seed, ordinal, 71 + i) * 2 - 1) * SPREAD
    const score = Math.max(0, Math.min(10, Math.round(rating / 10 + offset)))
    reviews.push({ outlet, score, quote })
  }

  return reviews
}
