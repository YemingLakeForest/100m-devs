/*
 * Copied from the rebuild (100m-devs-three/src/sim/cover.ts) on 2026-09-26, when the user
 * asked for the rebuild's cover art and title generation to be ported: the
 * rebuild is read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
/**
 * Cover art — GDD §10.5, generated and never authored.
 *
 * §22.7 caps the collectable system at 19 sprites, and a release that cost an
 * asset would be the hole in the bottom of it: releases are unbounded, a long
 * run ships dozens and every prestige run ships more. So a cover is **rolled
 * from the release's own seed** on the same contract §7.8.7 uses for faces —
 * never stored, never shipped as an asset, identical across a reload.
 *
 * What this module produces is not pixels. It produces a {@link CoverSpec}: the
 * handful of integers a painter needs to *draw* the tile. That split is the
 * point — the spec is testable without a canvas, and the painting lives in
 * `art/coverPixels.ts` where the colours are (ART_DIRECTION §4: the palette is
 * the renderer's business, this module names *which*).
 *
 * ## The grammar [amended 2026-09-14, at the user's instruction]
 *
 *   cover = subject(genre, seed) × family(genre, seed) × layout(seed)
 *         × ground(seed) × sky(seed) × backdrop(seed) × frame(rating band)
 *
 * - **Subject** is one of the genre's own sprites, and the genre comes from the
 *   title (`sim/titles.ts`) rather than from a regex over it. The old build
 *   matched "flappy" and drew a rocket on every box the garage shipped; a
 *   title grammar that *states* its genre is what lets the wall carry twelve
 *   subjects. Arcade and rpg carry two each — see {@link SUBJECTS_PER_GENRE}.
 * - **Family** is which of the painter's palette families the sky and ground
 *   are taken from. Each genre prefers a few — a horror game is not painted on
 *   a candy sky — and the roll picks among them. This is the amendment's whole
 *   point: the user asked for covers that are *coloured, not a mono-hue
 *   drawing*, and one hue in four values was exactly what the old ramp was.
 *   The subject brings its own colours on top of the family's.
 * - **Layout**, **ground**, **sky** and **backdrop** are free seed rolls over
 *   the arrangement: where the horizon sits and which way the subject faces,
 *   what the ground is made of, what stands in the sky, what stands on the
 *   horizon behind the subject. Free so two runs of the same ladder do not
 *   produce identical covers and a reload does not reroll the one the player
 *   is looking at.
 * - **Frame** is the rating band and nothing else in the picture is. §10.5:
 *   the score picks the ramp step so a wall reads as a quality history before
 *   a number is read, and it never feeds the geometry — a bad game gets a fair
 *   roll and only its border gives it away.
 *
 * Pure — no store, no clock, no renderer.
 */

import { draw } from './identity.ts'
import { ratingBand } from '../../sim/rating.ts'
import { GENRES, genreNamed, type Genre } from './titles.ts'

/** How many horizon/facing arrangements the painter offers. */
export const LAYOUTS = 4
/** How many ground treatments the painter offers. */
export const PATTERNS = 4
/** How many sky features the painter offers. */
export const SCENES = 4
/** How many horizon backdrops the painter offers — the last is none. */
export const BACKDROPS = 4
/** How many palette families the painter offers. */
export const FAMILIES = 8

/**
 * How many sprites each genre may be drawn with — the painter's `SUBJECTS`,
 * counted here because this is the module that rolls the number.
 *
 * Two for arcade and rpg [added 2026-09-14]. They are the two genres the title
 * grammar rolls most often, and a gallery wall with four arcade games on it
 * was four identical rockets — which is the amendment's own complaint about
 * the build before it, one level down. `coverPixels.test.ts` pins this table
 * against the painter's, on the same terms as {@link FAMILIES}: a genre that
 * grew a subject in one and not the other would draw one of them never.
 */
export const SUBJECTS_PER_GENRE: Record<Genre, number> = {
  arcade: 2,
  roguelike: 1,
  rpg: 2,
  tycoon: 1,
  survival: 1,
  racer: 1,
  puzzle: 1,
  platformer: 1,
  horror: 1,
  farming: 1,
}

/**
 * Which families a genre may be painted in. Indices into the painter's table:
 * 0 day, 1 dusk, 2 night, 3 desert, 4 ice, 5 toxic, 6 candy, 7 ember. A genre
 * lists three or four so that its covers vary without one of them being
 * absurd for it.
 */
export const GENRE_FAMILIES: Record<Genre, readonly number[]> = {
  arcade: [2, 0, 1, 4],
  roguelike: [2, 7, 5],
  rpg: [0, 1, 3],
  tycoon: [0, 4, 6],
  survival: [3, 5, 4, 1],
  racer: [1, 0, 3],
  puzzle: [6, 4, 0],
  platformer: [0, 6, 1],
  horror: [2, 7, 5],
  farming: [0, 3, 1],
}

export interface CoverSpec {
  genre: Genre
  /** §10.5's rating tint, 0..{@link ratingBand}'s `RATING_BANDS`. */
  band: number
  /** 0..{@link LAYOUTS}. */
  layout: number
  /** 0..{@link PATTERNS} — the ground. */
  pattern: number
  /** 0..{@link SCENES} — what stands in the sky. */
  scene: number
  /** 0..{@link BACKDROPS} — what stands on the horizon behind the subject. */
  backdrop: number
  /** 0..{@link FAMILIES} — the painter's palette family. */
  family: number
  /** 0..{@link SUBJECTS_PER_GENRE}[genre] — which of the genre's sprites. */
  subject: number
}

/** Channel numbers, kept together so two fields can never share one. */
const CH = {
  fallback: 1,
  layout: 2,
  pattern: 3,
  scene: 4,
  backdrop: 5,
  family: 6,
  subject: 7,
} as const

/**
 * Roll a release's cover — GDD §10.5.
 *
 * Deterministic in `(seed, ordinal)`, the same contract §7.8.7 uses for faces
 * and `rollShape` uses for the revenue tail. `genre` is the title's own where
 * the caller has it; a record written before titles carried a genre is read
 * from its name, and a name that names nothing gets a seeded pick rather than
 * a wrong certainty. `rating` only selects the frame tint — it never feeds
 * the geometry.
 */
export function coverFor(
  seed: number,
  ordinal: number,
  rating: number,
  name: string,
  genre?: Genre,
): CoverSpec {
  const g = genre
    ?? genreNamed(name)
    ?? GENRES[Math.min(GENRES.length - 1, Math.floor(draw(seed, ordinal, CH.fallback) * GENRES.length))]
  const families = GENRE_FAMILIES[g]
  return {
    genre: g,
    band: ratingBand(rating),
    layout: Math.floor(draw(seed, ordinal, CH.layout) * LAYOUTS),
    pattern: Math.floor(draw(seed, ordinal, CH.pattern) * PATTERNS),
    scene: Math.floor(draw(seed, ordinal, CH.scene) * SCENES),
    backdrop: Math.floor(draw(seed, ordinal, CH.backdrop) * BACKDROPS),
    family: families[Math.min(families.length - 1, Math.floor(draw(seed, ordinal, CH.family) * families.length))],
    subject: Math.floor(draw(seed, ordinal, CH.subject) * SUBJECTS_PER_GENRE[g]),
  }
}

/** A stable string for memoising a painted cover on. Every field, in order. */
export function coverKey(spec: CoverSpec): string {
  return `${spec.genre}/${spec.band}/${spec.layout}/${spec.pattern}/${spec.scene}/${spec.backdrop}/${spec.family}/${spec.subject}`
}
