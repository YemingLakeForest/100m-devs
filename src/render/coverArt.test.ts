import { describe, expect, it } from 'vitest'
import { COVER_SPRITES, SPRITE_SIZE, spriteCells } from './coverArt.ts'
import { GLYPHS } from '../sim/cover.ts'

describe('§10.11.3 — the key art', () => {
  it('draws every glyph the genre table can name', () => {
    // `genreFor` maps §4.10c's ladder onto these names. A glyph with no sprite
    // is a shipped game with no cover, and the gap would only show up on the
    // one title that happened to name it.
    for (const glyph of GLYPHS) {
      expect(COVER_SPRITES[glyph]).toBeDefined()
    }
  })

  it('is square, at the size the renderer scales by', () => {
    for (const [name, sprite] of Object.entries(COVER_SPRITES)) {
      expect(sprite, name).toHaveLength(SPRITE_SIZE)
      for (const row of sprite) {
        // The failure this catches is a row one character short, which shears
        // everything below it by a pixel and reads as a drawing mistake rather
        // than as a typo.
        expect(row.length, `${name}: "${row}"`).toBe(SPRITE_SIZE)
      }
    }
  })

  it('uses only body, shade and empty', () => {
    for (const [name, sprite] of Object.entries(COVER_SPRITES)) {
      for (const row of sprite) {
        expect(row.replace(/[#%.]/g, ''), name).toBe('')
      }
    }
  })

  it('is two-toned, which is the whole reason it stopped reading as a symbol', () => {
    // A shape filled in one colour is an icon. The second tone is what the eye
    // reads as form, and a sprite that lost its shade would silently go back to
    // being the flat silhouette this replaced.
    for (const [name, sprite] of Object.entries(COVER_SPRITES)) {
      const flat = sprite.join('')
      expect(flat.includes('#'), name).toBe(true)
      expect(flat.includes('%'), name).toBe(true)
    }
  })

  it('fills enough of its square to be a subject rather than a mark', () => {
    for (const [name, sprite] of Object.entries(COVER_SPRITES)) {
      const { cells, width, height } = spriteCells(sprite)
      expect(cells.length, name).toBeGreaterThan(40)
      // At least two thirds across one axis — a sprite that occupies a corner
      // of its own grid is a sprite the compositions cannot place.
      expect(Math.max(width, height), name).toBeGreaterThanOrEqual(11)
    }
  })
})

describe('spriteCells', () => {
  it('bounds the drawing rather than the grid', () => {
    const { minX, minY, width, height } = spriteCells([
      '................',
      '................',
      '..##............',
      '..##............',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ])
    expect({ minX, minY, width, height }).toEqual({ minX: 2, minY: 2, width: 2, height: 2 })
  })

  it('separates body from shade', () => {
    const { cells } = spriteCells([
      '#%..............',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ])
    expect(cells).toEqual([
      { x: 0, y: 0, lit: true },
      { x: 1, y: 0, lit: false },
    ])
  })

  it('reads an empty sprite as empty rather than as a negative box', () => {
    const blank = Array.from({ length: SPRITE_SIZE }, () => '.'.repeat(SPRITE_SIZE))
    expect(spriteCells(blank)).toEqual({ cells: [], minX: 0, minY: 0, width: 0, height: 0 })
  })
})
