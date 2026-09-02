import { describe, expect, it } from 'vitest'
import { PLAZA_RADIUS, octagonPoints, statueRung } from './plaza.ts'

/**
 * The 2:1 projection, as `room.ts` does it. One tile across is half a tile
 * down, and these tests exist to prove that the plaza's rounded shape is
 * actually lying on that floor rather than being a circle drawn in screen
 * pixels — the mistake §7.8.12 records as three glass panes at slopes of
 * −0.39, +1.18 and −1.05.
 */
const TILE_W = 64
const TILE_H = 32
const project = (gx: number, gy: number) => ({
  x: (gx - gy) * (TILE_W / 2),
  y: (gx + gy) * (TILE_H / 2),
})

describe('octagonPoints', () => {
  it('has eight vertices', () => {
    expect(octagonPoints(0, 0, 2)).toHaveLength(8)
  })

  it('puts every edge on a direction the floor plane actually has', () => {
    // Four edges run on the grid axes and come out at the projection's only
    // legal wall slope; four run on the grid diagonals and come out exactly
    // vertical or exactly horizontal. There is no fifth option, and an edge at
    // any other slope would be a shape floating above the floor.
    const pts = octagonPoints(3, -1.5, PLAZA_RADIUS)
    for (let i = 0; i < pts.length; i++) {
      const a = project(pts[i][0], pts[i][1])
      const b = project(pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1])
      const dx = b.x - a.x
      const dy = b.y - a.y
      const legal =
        Math.abs(dx) < 1e-9 || // the grid diagonal — vertical on screen
        Math.abs(dy) < 1e-9 || // the anti-diagonal — horizontal on screen
        Math.abs(Math.abs(dy / dx) - 0.5) < 1e-9 // a floor axis
      expect(legal, `edge ${i} runs at ${dy / dx}`).toBe(true)
    }
  })

  it('is centred where it is asked to be', () => {
    const pts = octagonPoints(5, -2, 1.5)
    const cx = pts.reduce((t, q) => t + q[0], 0) / pts.length
    const cy = pts.reduce((t, q) => t + q[1], 0) / pts.length
    expect(cx).toBeCloseTo(5, 9)
    expect(cy).toBeCloseTo(-2, 9)
  })

  it('fits inside the transverse corridor', () => {
    // §7.8.1d's whole claim is that the plaza costs no seats because
    // CORRIDOR_ROWS is two row-steps of PITCH_ROW — 4.2 tiles — and the inlay
    // fits in it. If the radius ever outgrows that, it is taking desks.
    expect(PLAZA_RADIUS * 2).toBeLessThan(2 * 2.1)
  })
})

describe('statueRung', () => {
  it('has no plinth before the floor unfolds', () => {
    expect(statueRung(0)).toBe(-1)
    expect(statueRung(99)).toBe(-1)
  })

  it('opens with an empty plinth at the unfold', () => {
    // The joke is that facilities built it before anybody decided what goes on
    // it, so rung 0 is deliberately the *first* thing that arrives.
    expect(statueRung(100)).toBe(0)
    expect(statueRung(199)).toBe(0)
  })

  it('climbs once per band and never falls back', () => {
    const steps = [100, 200, 400, 700, 1000]
    let last = statueRung(0)
    for (const at of steps) {
      const here = statueRung(at)
      expect(here).toBe(last + 1)
      expect(statueRung(at - 1)).toBe(last)
      last = here
    }
  })

  it('is monotonic across the whole room', () => {
    let last = statueRung(0)
    for (let n = 0; n <= 1200; n += 7) {
      const here = statueRung(n)
      expect(here).toBeGreaterThanOrEqual(last)
      last = here
    }
  })

  it('tops out at the room cap and stays there', () => {
    expect(statueRung(1000)).toBe(4)
    expect(statueRung(50_000)).toBe(4)
  })
})
