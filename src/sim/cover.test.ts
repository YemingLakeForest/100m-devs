import { describe, expect, it } from 'vitest'
import {
  ACCENTS,
  GLYPHS,
  LAYOUTS,
  PATTERNS,
  coverFor,
  genreFor,
  type CoverSpec,
} from './cover.ts'
import { RATING_BANDS, ratingBand } from './rating.ts'

describe('§10.11.3 — cover art is generated, never authored', () => {
  it('is deterministic for a seed and ordinal', () => {
    const a = coverFor(4242, 7, 50, 'Untitled Roguelike Deckbuilder')
    const b = coverFor(4242, 7, 50, 'Untitled Roguelike Deckbuilder')
    expect(a).toEqual(b)
  })

  it('names a genre in every ladder title', () => {
    expect(genreFor('Flappy Square 1.0', 0.5).glyph).toBe('rocket')
    expect(genreFor('Flappy Square 2.0 (Now With Ads)', 0.5).glyph).toBe('rocket')
    expect(genreFor('Untitled Roguelike Deckbuilder', 0.5).glyph).toBe('die')
    expect(genreFor('Open-World Survival Craft (Early Access)', 0.5).glyph).toBe('castle')
  })

  it('falls back to a seeded glyph and accent when a title names no genre', () => {
    const g = genreFor('Project X', 0.1)
    expect(GLYPHS).toContain(g.glyph)
    expect(g.accent).toBeGreaterThanOrEqual(0)
    expect(g.accent).toBeLessThan(ACCENTS)
  })

  it('keeps every roll inside its range', () => {
    for (let ordinal = 0; ordinal < 500; ordinal++) {
      const c = coverFor(99, ordinal, 50, 'Some Game')
      expect(GLYPHS).toContain(c.glyph)
      expect(c.band).toBeGreaterThanOrEqual(0)
      expect(c.band).toBeLessThan(RATING_BANDS)
      expect(c.layout).toBeGreaterThanOrEqual(0)
      expect(c.layout).toBeLessThan(LAYOUTS)
      expect(c.pattern).toBeGreaterThanOrEqual(0)
      expect(c.pattern).toBeLessThan(PATTERNS)
      expect(c.accent).toBeGreaterThanOrEqual(0)
      expect(c.accent).toBeLessThan(ACCENTS)
    }
  })

  it('tints the frame by the rating band, never the geometry', () => {
    const low = coverFor(1, 0, 10, 'Flappy Square 1.0')
    const high = coverFor(1, 0, 95, 'Flappy Square 1.0')
    expect(high.band).toBe(ratingBand(95))
    expect(high.band).toBeGreaterThan(low.band)
    // Same glyph, accent, layout and pattern — only the frame differs.
    expect(low.glyph).toBe(high.glyph)
    expect(low.accent).toBe(high.accent)
    expect(low.layout).toBe(high.layout)
    expect(low.pattern).toBe(high.pattern)
  })

  it('varies the geometry across releases', () => {
    const seen = new Set<string>()
    for (let ordinal = 0; ordinal < 200; ordinal++) {
      const c = coverFor(77, ordinal, 50, 'Untitled Roguelike Deckbuilder')
      seen.add(`${c.layout}/${c.pattern}`)
    }
    // 4 layouts × 4 patterns — a single combination over 200 releases would be
    // a wall of identical covers, which is the one thing a generated cover must
    // not be.
    expect(seen.size).toBeGreaterThan(1)
  })

  it('rolls a different cover for a different seed on the same release', () => {
    const a = coverFor(1, 3, 50, 'Open-World Survival Craft (Early Access)')
    const b = coverFor(2, 3, 50, 'Open-World Survival Craft (Early Access)')
    expect(a).not.toEqual(b)
  })

  it('is a plain serialisable object', () => {
    const c: CoverSpec = coverFor(1, 0, 50, 'Flappy Square 1.0')
    expect(JSON.parse(JSON.stringify(c))).toEqual(c)
  })
})
