/*
 * Copied from the rebuild (100m-devs-three/src/art/coverPixels.test.ts) on 2026-09-26, when the user
 * asked for the rebuild's cover art and title generation to be ported: the
 * rebuild is read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
import { describe, expect, it } from 'vitest'

import {
  COVER_SIZE, FAMILY_TABLE, SUBJECTS, hueCount, paintCover, runsOf, subjectHeight,
} from './coverPixels.ts'
import { coverFor, FAMILIES, SUBJECTS_PER_GENRE } from '../sim/cover.ts'
import { GENRES, titleFor } from '../sim/titles.ts'

describe('§10.5 — the cover is coloured pixel art', () => {
  it('paints every cell of a 32-cell square', () => {
    const b = paintCover(coverFor(1, 0, 50, 'Hollow Orbit', 'arcade'))
    expect(b.size).toBe(COVER_SIZE)
    expect(b.cells.length).toBe(COVER_SIZE * COVER_SIZE)
    for (const c of b.cells) expect(c).toBeLessThan(b.palette.length)
  })

  /**
   * The user's instruction, measured: *"coloured, not just a mono hue
   * drawing."* Hue is bucketed to thirty-degree sectors and greys are ignored,
   * so a cover that passes carries at least four genuinely different colours.
   * The old ramp scored one on this test for every cover it drew.
   */
  it('carries at least four hues on every cover, for every genre and family', () => {
    for (const genre of GENRES) {
      for (let ordinal = 0; ordinal < 40; ordinal++) {
        const title = titleFor(11, ordinal)
        const spec = coverFor(11, ordinal, 50, title.name, genre)
        expect(hueCount(paintCover(spec)), `${genre} #${ordinal}`).toBeGreaterThanOrEqual(4)
      }
    }
  })

  /**
   * *"I want no text in the cover arts."* The painter does not take a title,
   * so it cannot letter one; and the bottom rows, where the first draft put
   * its plate, are ground — every cell there is one of the family's ground
   * colours or a wave dash on its water.
   */
  it('carries no text: the bottom rows are ground, not a label', () => {
    for (const genre of GENRES) {
      for (let ordinal = 0; ordinal < 24; ordinal++) {
        const spec = coverFor(5, ordinal, 50, 'x', genre)
        const b = paintCover(spec)
        const f = FAMILY_TABLE[spec.family]
        const allowed = new Set([f.ground, f.groundLit, f.groundDark, f.road, f.water, '#FFFFFF', '#F2E9C8'])
        for (let y = COVER_SIZE - 3; y < COVER_SIZE; y++) {
          for (let x = 0; x < COVER_SIZE; x++) {
            const colour = b.palette[b.cells[y * COVER_SIZE + x]]
            expect(allowed.has(colour), `${genre} #${ordinal} row ${y} col ${x} is ${colour}`).toBe(true)
          }
        }
      }
    }
  })

  it('has as many families as the spec promises', () => {
    expect(FAMILY_TABLE.length).toBe(FAMILIES)
  })

  /**
   * The spec rolls the subject and the painter owns the sprites, so the two
   * tables have to agree: a genre with two sprites here and one there draws
   * the second one never, and nothing else in the build would say so.
   */
  it('has as many subjects per genre as the spec rolls', () => {
    for (const genre of GENRES) {
      expect(SUBJECTS[genre].length, genre).toBe(SUBJECTS_PER_GENRE[genre])
      for (const id of SUBJECTS[genre]) expect(typeof id).toBe('string')
    }
    // Twelve pictures, and no two genres sharing one.
    const all = GENRES.flatMap((g) => [...SUBJECTS[g]])
    expect(all.length).toBe(12)
    expect(new Set(all).size).toBe(12)
  })

  /**
   * *"The subject is the picture."* [2026-09-14]
   *
   * Measured rather than asserted, because the first pass said exactly this in
   * a comment while drawing a ten-row die in a thirty-two-row box — a third of
   * the height, which at the 34 px the rail draws is eleven pixels of subject
   * under twenty-one pixels of sky. Every subject, on every layout, now stands
   * at least 45% of the box.
   */
  it('stands the subject in at least 45% of the box, on every layout', () => {
    for (const genre of GENRES) {
      for (let subject = 0; subject < SUBJECTS_PER_GENRE[genre]; subject++) {
        for (let layout = 0; layout < 4; layout++) {
          const spec = { ...coverFor(5, 3, 50, 'x', genre), subject, layout }
          expect(subjectHeight(spec), `${genre}/${subject} layout ${layout}`)
            .toBeGreaterThanOrEqual(0.45)
        }
      }
    }
  })

  /**
   * And it is inside the frame. An off-centre layout with a doubled kart on it
   * put the sprite's left edge at column −2, which does not read as *off to
   * one side*; it reads as broken.
   */
  it('never clips the subject against the edge of the box', () => {
    for (const genre of GENRES) {
      for (let subject = 0; subject < SUBJECTS_PER_GENRE[genre]; subject++) {
        for (let layout = 0; layout < 4; layout++) {
          const spec = { ...coverFor(5, 3, 50, 'x', genre), subject, layout, backdrop: 3, scene: 3 }
          const b = paintCover(spec)
          // The outline is near-black and only the subject carries it, so the
          // ink's own bounding box is the silhouette's.
          const ink = b.palette.indexOf('#1B1B22')
          expect(ink, `${genre}/${subject} has no outline`).toBeGreaterThanOrEqual(0)
          for (let y = 0; y < COVER_SIZE; y++) {
            expect(b.cells[y * COVER_SIZE], `${genre}/${subject} touches the left edge`).not.toBe(ink)
            expect(b.cells[y * COVER_SIZE + COVER_SIZE - 1], `${genre}/${subject} touches the right edge`).not.toBe(ink)
          }
        }
      }
    }
  })

  it('is the same picture whatever it scored — only the frame reads the rating', () => {
    const low = paintCover(coverFor(5, 3, 8, 'Iron Kart', 'racer'))
    const high = paintCover(coverFor(5, 3, 96, 'Iron Kart', 'racer'))
    expect(Array.from(low.cells)).toEqual(Array.from(high.cells))
    expect(low.palette).toEqual(high.palette)
  })

  it('differs between layouts, grounds, skies, backdrops and families', () => {
    const base = coverFor(5, 3, 50, 'Iron Kart', 'racer')
    const seen = new Set<string>()
    for (const field of ['layout', 'pattern', 'scene', 'backdrop', 'family'] as const) {
      for (let v = 0; v < 4; v++) {
        const b = paintCover({ ...base, [field]: v })
        seen.add(Array.from(b.cells).map((c) => b.palette[c]).join(','))
      }
    }
    // 5 fields × 4 values, with the base's own value repeated once per field.
    expect(seen.size).toBeGreaterThanOrEqual(16)
  })

  it('draws a small subject at twice its size', () => {
    // The die is ten rows by ten, so it doubles on every layout. Its ivory
    // face then spans more than ten columns on one row.
    const b = paintCover({ ...coverFor(5, 3, 50, 'x', 'roguelike'), layout: 0 })
    const ivory = b.palette.indexOf('#F5EEDC')
    expect(ivory).toBeGreaterThanOrEqual(0)
    let widest = 0
    for (let y = 0; y < COVER_SIZE; y++) {
      let n = 0
      for (let x = 0; x < COVER_SIZE; x++) if (b.cells[y * COVER_SIZE + x] === ivory) n++
      widest = Math.max(widest, n)
    }
    expect(widest).toBeGreaterThan(10)
  })

  it('folds a bitmap into far fewer runs than cells', () => {
    const b = paintCover(coverFor(1, 0, 50, 'Hollow Orbit', 'arcade'))
    const runs = runsOf(b)
    expect(runs.length).toBeLessThan(b.cells.length / 2)
    expect(runs.reduce((n, r) => n + r.w, 0)).toBe(b.cells.length)
  })
})
