import { describe, expect, it } from 'vitest'
import { GARAGE_GLYPH, GARAGE_GLYPH_H, GARAGE_GLYPH_W, lampLit } from './garageGlyph.ts'

/**
 * The HQ's glyph [2026-10-11, demo]. Claims about what makes it *the garage* and about the one thing
 * on it that moves — not about how it is drawn.
 */
describe('the garage glyph', () => {
  it('is a rectangle of pixels, and an odd-width one so it has a middle to centre on', () => {
    for (const row of GARAGE_GLYPH) expect(row.length).toBe(GARAGE_GLYPH_W)
    expect(GARAGE_GLYPH.length).toBe(GARAGE_GLYPH_H)
    expect(GARAGE_GLYPH_W % 2).toBe(1)
  })

  it('is mirror-symmetric apart from the lamp: a building, not a blob', () => {
    for (const row of GARAGE_GLYPH) {
      const plain = row.replace('L', '=')
      expect(plain).toBe([...plain].reverse().join(''))
    }
  })

  it('has a gable that only ever widens, a door inside the walls, and exactly one lamp', () => {
    const widths = GARAGE_GLYPH.slice(0, 4).map((row) => [...row].filter((c) => c === '#').length)
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1])
    const door = GARAGE_GLYPH.slice(4)
    for (const row of door) expect(row).toMatch(/^\.#[=L]+#\.$/)
    expect(GARAGE_GLYPH.join('').split('L').length - 1).toBe(1)
  })

  it('keeps its lamp on under reduced motion, and lets it breathe otherwise', () => {
    for (const t of [0, 0.4, 1.3, 7, 100]) expect(lampLit(t, true)).toBe(true)
    const phases = new Set([0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map((t) => lampLit(t, false)))
    expect(phases.size).toBe(2)
  })
})
