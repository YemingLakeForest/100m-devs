import { describe, expect, it } from 'vitest'
import { placeMapLabel, type LabelBox } from './mapLabels.ts'
describe('map label footprint', () => {
  it('keeps long names away from neighbours and the HUD margins', () => {
    const bounds = { x: 50, y: 20, w: 240, h: 130 }, occupied: LabelBox[] = []
    for (let i = 0; i < 80; i++) placeMapLabel(60 + i % 8 * 26, 30 + Math.floor(i / 8) * 12, i % 2 ? 'SOL' : 'PROXIMA CENTAURI', bounds, occupied)
    expect(occupied.length).toBeGreaterThan(2)
    for (const a of occupied) {
      expect(a.x).toBeGreaterThanOrEqual(bounds.x)
      expect(a.x + a.w).toBeLessThanOrEqual(bounds.x + bounds.w)
      expect(a.y + a.h).toBeLessThanOrEqual(bounds.y + bounds.h)
      for (const b of occupied) if (a !== b) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true)
    }
  })
  it('omits a label when every placement is blocked', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 }
    expect(placeMapLabel(50, 50, 'SOL', bounds, [bounds])).toBeNull()
  })
})
