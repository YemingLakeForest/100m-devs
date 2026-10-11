import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { NIGHT, OS, OS_HORIZON } from '../art/skin.ts'
import { BLOCK_PITCH, BLOCK_SIZE } from './cityGrid.ts'
import { createLotBrackets, createOsDesktop, LOT_BRACKET } from './osDesktop.ts'

/**
 * The scene as the interface's own picture [2026-10-11]. Claims about where things sit and what
 * they may never do — not about how they look (that is a frame, and a frame is looked at).
 */
describe('the lot brackets', () => {
  it('stand on the kerb: outside the lot’s own wall and inside its neighbour’s', () => {
    // dressCityLot's side walls are at x = ±14.7; the next lot's wall is a street's width past this lot's.
    expect(LOT_BRACKET).toBeGreaterThan(14.7)
    expect(LOT_BRACKET).toBeLessThan(BLOCK_PITCH / 2)
    expect(LOT_BRACKET).toBeGreaterThan(BLOCK_SIZE / 2)
  })

  it('are four corners of two arms each, and every arm points into the lot', () => {
    const b = createLotBrackets(LOT_BRACKET)
    const p = b.geometry.getAttribute('position')
    expect(p.count).toBe(16)
    for (let i = 0; i < p.count; i += 2) {
      const corner = new T.Vector3().fromBufferAttribute(p, i), tip = new T.Vector3().fromBufferAttribute(p, i + 1)
      expect(Math.abs(corner.x)).toBeCloseTo(LOT_BRACKET)
      expect(Math.abs(corner.z)).toBeCloseTo(LOT_BRACKET)
      expect(corner.y).toBe(0)
      // The arm runs along one axis, toward the middle of the lot.
      expect(Math.abs(tip.x) < Math.abs(corner.x) || Math.abs(tip.z) < Math.abs(corner.z)).toBe(true)
      expect(tip.distanceTo(corner)).toBeGreaterThan(0)
    }
  })

  it('are one-pixel lines, because the interface has no other weight', () => {
    expect(createLotBrackets(LOT_BRACKET)).toBeInstanceOf(T.LineSegments)
  })
})

describe('the desktop', () => {
  it('lies on the horizon slab and under the paving, so the slab never hides it and a lot always covers it', () => {
    // garageEnvironment's 512 m slab tops out at -0.5; cityHouses' lowest paving is a 0.05 slab centred at -0.49 (top -0.465).
    const grid = createOsDesktop()
    expect(grid.position.y).toBeGreaterThan(-0.5)
    expect(grid.position.y).toBeLessThan(-0.465)
  })

  it('never writes depth and is never picked: it is the ground the world stands on, not part of it', () => {
    const grid = createOsDesktop()
    expect((grid.material as T.ShaderMaterial).depthWrite).toBe(false)
    expect((grid.material as T.ShaderMaterial).transparent).toBe(true)
    expect(grid.name).toBe('os-desktop')
  })
})

describe('the night rig', () => {
  it('keeps its grade and its rules to fractions, so the materials stay the materials', () => {
    for (const v of [NIGHT.tint, NIGHT.edge, NIGHT.edgeFloor]) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(1)
    }
    // A grade past a half is a filter, and the 2026-09-28 verdict on a tinted scene was already given.
    expect(NIGHT.tint).toBeLessThanOrEqual(0.5)
  })

  it('draws its horizon from the interface’s neutrals and darker than any lit surface of the room', () => {
    const lum = (hex: string) => { const c = new T.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b }
    expect(lum(OS_HORIZON)).toBeLessThan(lum(OS.n2))
    // Neutral: the horizon is not a hue. The survey behind it is charcoal, not teal.
    const c = new T.Color(OS_HORIZON)
    expect(Math.abs(c.r - c.b)).toBeLessThan(0.02)
  })
})
