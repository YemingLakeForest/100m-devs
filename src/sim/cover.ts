/**
 * Cover art — GDD §10.11.3, generated and never authored.
 *
 * §22.7 caps the collectable system at 19 sprites, and a release that cost an
 * asset would be the hole in the bottom of it: releases are unbounded, a long
 * run ships dozens and every prestige run ships more. So a cover is **rolled
 * from the release's own seed** on the same contract §7.8.7 uses for faces —
 * never stored, never shipped as an asset, identical across a reload.
 *
 * What this module produces is not pixels. It produces a {@link CoverSpec}: the
 * handful of integers a renderer needs to *draw* the tile. That split is the
 * point — the spec is testable without a canvas, and the drawing (§10.11.3's
 * "drawn in code, not composited from art") can live beside the other SVG the
 * gallery already has reason to own.
 *
 * ## The grammar
 *
 * A cover is four independent choices combined, so the same title shipped twice
 * still differs, and the ladder's handful of names produce a wall that does not
 * read as repeats:
 *
 *   cover = glyph(genre) × palette(rating band) × layout(seed) × pattern(seed)
 *
 * - **Glyph** is chosen by the genre the title names (§4.10's ladder names a
 *   genre in every title): a die for a roguelike, a rocket for an arcade
 *   endless-runner. A short library of primitive shapes — §10.11.3's "a die, a
 *   sword, a rocket, a spreadsheet".
 * - **Accent** is the genre's ink, an *index* rather than a colour. Like
 *   §7.8.7's part tables, the palette stays the renderer's business
 *   (ART_DIRECTION §4); this module names *which* accent, not what it is.
 * - **Palette** is §4.14's rating band ({@link ratingBand}), so a wall of covers
 *   reads as a quality history *before a single number is read*.
 * - **Layout** and **pattern** are free seed rolls, so two runs of the same
 *   ladder do not produce identical covers and a reload does not reroll the one
 *   the player is looking at.
 *
 * Pure — no store, no clock, no renderer.
 */

import { draw } from './identity.ts'
import { ratingBand } from './rating.ts'

/** The primitive glyphs a cover can carry. Index into the renderer's shape set. */
export const GLYPHS = [
  'rocket',
  'die',
  'sword',
  'spreadsheet',
  'castle',
  'gear',
  'heart',
  'pixel',
] as const

export type Glyph = (typeof GLYPHS)[number]

/** How many layout variants the renderer offers. */
export const LAYOUTS = 4

/** How many background-pattern variants the renderer offers. */
export const PATTERNS = 4

/** How many genre accents the renderer offers. */
export const ACCENTS = 6

export interface CoverSpec {
  glyph: Glyph
  /** §10.11.3's rating tint, 0..{@link ratingBand}'s {@link RATING_BANDS}. */
  band: number
  /** 0..{@link LAYOUTS}. */
  layout: number
  /** 0..{@link PATTERNS}. */
  pattern: number
  /** The genre's ink, 0..{@link ACCENTS}. Resolved to a palette colour by the renderer. */
  accent: number
}

/** Channel numbers, kept together so two fields can never share one. */
const CH = {
  fallback: 1,
  layout: 2,
  pattern: 3,
} as const

/**
 * §4.10's ladder names a genre in every title, so the glyph and the accent are a
 * lookup rather than a roll — and the same word always means the same shape,
 * which is what makes the glyph *genre* rather than decoration.
 */
const GENRE_HINTS: readonly [pattern: RegExp, glyph: Glyph, accent: number][] = [
  [/flappy|arcade|endless/, 'rocket', 0],
  [/rogue|deck|dungeon|rng/, 'die', 1],
  [/rpg|quest|sword|dragon|blade/, 'sword', 4],
  [/tycoon|manage|sim|spreadsheet|office/, 'spreadsheet', 2],
  [/survival|craft|open.?world|sandbox/, 'castle', 5],
  [/engine|platform|physics|racer/, 'gear', 3],
  [/puzzle|match|casual|match.?3/, 'heart', 3],
]

/**
 * The glyph and accent a title names, or a seeded pick when it names none.
 *
 * `roll` is a 0..1 draw passed in rather than drawn here, so the fallback and
 * the layout rolls in {@link coverFor} never share a channel.
 */
export function genreFor(name: string, roll: number): { glyph: Glyph; accent: number } {
  const lower = name.toLowerCase()
  for (const [pattern, glyph, accent] of GENRE_HINTS) {
    if (pattern.test(lower)) return { glyph, accent }
  }
  const glyph = GLYPHS[Math.min(GLYPHS.length - 1, Math.floor(roll * GLYPHS.length))]
  return { glyph, accent: Math.floor(roll * ACCENTS) }
}

/**
 * Roll a release's cover — GDD §10.11.3.
 *
 * Deterministic in `(seed, ordinal)`, the same contract §7.8.7 uses for faces
 * and {@link rollShape} uses for the revenue tail: two runs of the same ladder
 * do not produce identical covers, and a reload does not reroll the one the
 * player is looking at. `rating` only selects the frame tint — it never feeds
 * the geometry — so a bad game still gets a fair roll and only its frame gives
 * it away.
 */
export function coverFor(
  seed: number,
  ordinal: number,
  rating: number,
  name: string,
): CoverSpec {
  const genre = genreFor(name, draw(seed, ordinal, CH.fallback))
  return {
    glyph: genre.glyph,
    band: ratingBand(rating),
    layout: Math.floor(draw(seed, ordinal, CH.layout) * LAYOUTS),
    pattern: Math.floor(draw(seed, ordinal, CH.pattern) * PATTERNS),
    accent: genre.accent,
  }
}
