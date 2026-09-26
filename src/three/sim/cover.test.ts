/*
 * Copied from the rebuild (100m-devs-three/src/sim/cover.test.ts) on 2026-09-26, when the user
 * asked for the rebuild's cover art and title generation to be ported: the
 * rebuild is read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
import { describe, expect, it } from 'vitest'
import {
  BACKDROPS,
  FAMILIES,
  GENRE_FAMILIES,
  LAYOUTS,
  PATTERNS,
  SCENES,
  SUBJECTS_PER_GENRE,
  coverFor,
  coverKey,
} from './cover.ts'
import { RATING_BANDS, ratingBand } from '../../sim/rating.ts'
import { GENRES, titleFor } from './titles.ts'

describe('§10.5 — cover art is generated, never authored', () => {
  it('is deterministic for a seed and ordinal', () => {
    const a = coverFor(4242, 7, 50, 'Velvet Dungeon', 'roguelike')
    const b = coverFor(4242, 7, 50, 'Velvet Dungeon', 'roguelike')
    expect(a).toEqual(b)
  })

  it('takes the genre the title states, and reads it off a name when it must', () => {
    expect(coverFor(1, 0, 50, 'Anything', 'horror').genre).toBe('horror')
    expect(coverFor(1, 0, 50, 'Flappy Square 1.0').genre).toBe('arcade')
    // A name that says nothing gets a seeded genre, not a wrong certainty.
    expect(GENRES).toContain(coverFor(1, 0, 50, 'Project X').genre)
  })

  it('paints a genre only in the families it prefers', () => {
    for (const genre of GENRES) {
      for (let ordinal = 0; ordinal < 60; ordinal++) {
        const c = coverFor(3, ordinal, 50, 'x', genre)
        expect(GENRE_FAMILIES[genre]).toContain(c.family)
      }
    }
  })

  it('keeps every roll inside its range', () => {
    for (let ordinal = 0; ordinal < 500; ordinal++) {
      const t = titleFor(99, ordinal)
      const c = coverFor(99, ordinal, 50, t.name, t.genre)
      expect(c.band).toBeGreaterThanOrEqual(0)
      expect(c.band).toBeLessThan(RATING_BANDS)
      expect(c.layout).toBeGreaterThanOrEqual(0)
      expect(c.layout).toBeLessThan(LAYOUTS)
      expect(c.pattern).toBeGreaterThanOrEqual(0)
      expect(c.pattern).toBeLessThan(PATTERNS)
      expect(c.scene).toBeGreaterThanOrEqual(0)
      expect(c.scene).toBeLessThan(SCENES)
      expect(c.backdrop).toBeGreaterThanOrEqual(0)
      expect(c.backdrop).toBeLessThan(BACKDROPS)
      expect(c.family).toBeGreaterThanOrEqual(0)
      expect(c.family).toBeLessThan(FAMILIES)
      expect(c.subject).toBeGreaterThanOrEqual(0)
      expect(c.subject).toBeLessThan(SUBJECTS_PER_GENRE[c.genre])
    }
  })

  /**
   * The two commonest genres carry two subjects each, and a long run has to
   * actually draw both: a roll that never reached the second one would be a
   * sprite nobody ever sees, which is the same failure as not having drawn it.
   */
  it('draws both subjects of a genre that has two', () => {
    for (const genre of ['arcade', 'rpg'] as const) {
      const seen = new Set<number>()
      for (let ordinal = 0; ordinal < 60; ordinal++) seen.add(coverFor(13, ordinal, 50, 'x', genre).subject)
      expect(seen.size, genre).toBe(SUBJECTS_PER_GENRE[genre])
    }
    // ...and a genre with one subject only ever rolls it.
    for (let ordinal = 0; ordinal < 60; ordinal++) {
      expect(coverFor(13, ordinal, 50, 'x', 'horror').subject).toBe(0)
    }
  })

  it('tints the frame by the rating band, never the geometry', () => {
    const low = coverFor(1, 0, 10, 'Hollow Orbit', 'arcade')
    const high = coverFor(1, 0, 95, 'Hollow Orbit', 'arcade')
    expect(high.band).toBe(ratingBand(95))
    expect(high.band).toBeGreaterThan(low.band)
    expect({ ...low, band: 0 }).toEqual({ ...high, band: 0 })
  })

  it('keys on every field, so a memo cannot serve the wrong picture', () => {
    const a = coverFor(1, 0, 50, 'x', 'arcade')
    for (const field of ['layout', 'pattern', 'scene', 'backdrop', 'family', 'band', 'subject'] as const) {
      const b = { ...a, [field]: a[field] + 1 }
      expect(coverKey(b)).not.toBe(coverKey(a))
    }
    expect(coverKey({ ...a, genre: 'horror' })).not.toBe(coverKey(a))
  })
})
