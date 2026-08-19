import { describe, expect, it } from 'vitest'
import {
  cellAt,
  cellAtLocal,
  cellSquare,
  drawOrder,
  gridCentre,
  gridExtent,
  gridSide,
  squareCell,
} from './grid.ts'

const PITCH = { w: 140, d: 84 }

describe('the fill is square shells — GDD §7.7.2, and §7.7.1', () => {
  it('never moves a unit that is already standing', () => {
    // §7.7.2's promotion is "a whole tower slams down beside the last one", and
    // the one thing it must never look like is the scene rearranging to make
    // room. So a cell is a function of its index and of nothing else — this is
    // the requirement that rules out row-major on a lattice sized for a hundred.
    const before = Array.from({ length: 5 }, (_, i) => cellAt(i, PITCH))
    const after = Array.from({ length: 100 }, (_, i) => cellAt(i, PITCH))
    for (let i = 0; i < before.length; i++) expect(after[i]).toEqual(before[i])
  })

  it('makes every prefix a block rather than a line', () => {
    // The other half of the bind. Ten units drawn row-major into a lattice big
    // enough for a hundred is a single row across the horizon — which is the
    // shape the room's squads already had, and why they read as a conveyor
    // belt. Shells keep the occupied set inside a square at every count.
    for (const n of [2, 5, 10, 37, 100]) {
      const side = gridSide(n)
      for (let i = 0; i < n; i++) {
        const { col, row } = cellSquare(i)
        expect(col).toBeLessThan(side)
        expect(row).toBeLessThan(side)
      }
      // And tight: a square one smaller would not have held them.
      expect((side - 1) * (side - 1)).toBeLessThan(n)
    }
  })

  it('completes a square exactly on the square numbers', () => {
    expect(Array.from({ length: 4 }, (_, i) => cellSquare(i))).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 0, row: 1 },
    ])
    expect(cellSquare(99)).toEqual({ col: 0, row: 9 })
    expect(gridSide(100)).toBe(10)
  })

  it('holds a nation — a hundred towns, none of them on top of another', () => {
    // `i % 12` drew the thirteenth unit on top of the first, so the top of the
    // ladder could not be drawn at all.
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const at = cellAt(i, PITCH)
      seen.add(`${at.x.toFixed(3)},${at.y.toFixed(3)}`)
    }
    expect(seen.size).toBe(100)
  })

  it('is its own inverse, index to square and back', () => {
    for (let i = 0; i < 200; i++) {
      const { col, row } = cellSquare(i)
      expect(squareCell(col, row)).toBe(i)
    }
  })
})

describe('the pivot centres the picture, and the cells never do', () => {
  it('puts the middle of the occupied square under the pivot', () => {
    for (const n of [1, 4, 10, 100]) {
      const c = gridCentre(n, PITCH)
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let i = 0; i < gridSide(n) * gridSide(n); i++) {
        const at = cellAt(i, PITCH)
        minX = Math.min(minX, at.x)
        maxX = Math.max(maxX, at.x)
        minY = Math.min(minY, at.y)
        maxY = Math.max(maxY, at.y)
      }
      expect(c.x).toBeCloseTo((minX + maxX) / 2, 9)
      expect(c.y).toBeCloseTo((minY + maxY) / 2, 9)
    }
  })

  it('gives one cell the origin all to itself', () => {
    expect(cellAt(0, PITCH)).toEqual({ x: 0, y: 0 })
    expect(gridCentre(1, PITCH)).toEqual({ x: 0, y: 0 })
  })
})

describe('the hit test is the inverse of the layout', () => {
  it('finds every cell at its own centre, at every grid size', () => {
    // The property the whole address rests on. A descent picks whatever this
    // returns, so a single wrong cell is a player arriving somewhere they did
    // not point at — and every unit at every rung is drawn identically, so
    // nothing on screen would say so.
    for (const n of [1, 2, 9, 10, 12, 37, 100]) {
      for (let i = 0; i < n; i++) {
        const at = cellAt(i, PITCH)
        expect(cellAtLocal(at.x, at.y, n, PITCH)).toBe(i)
      }
    }
  })

  it('is forgiving inside the grid and honest outside it', () => {
    // A tap in the corridor between two plots hits the nearer plot: §4.5b's
    // verb is the whole game at this scale and a miss it cannot explain is
    // worse than a neighbour. Off the grid is still a miss — there is sky.
    const at = cellAt(5, PITCH)
    expect(cellAtLocal(at.x + 8, at.y + 3, 10, PITCH)).toBe(5)
    expect(cellAtLocal(0, -4000, 10, PITCH)).toBe(-1)
    expect(cellAtLocal(-4000, 0, 10, PITCH)).toBe(-1)
  })

  it('misses the unbuilt corner of a part-built shell', () => {
    // Ten units fill the first ten cells of a 4x4 square. The other six are
    // plots nobody stands on, and offering one would buff developers who are
    // not there.
    expect(gridSide(10)).toBe(4)
    const ghost = cellAt(12, PITCH)
    expect(cellAtLocal(ghost.x, ghost.y, 10, PITCH)).toBe(-1)
    expect(cellAtLocal(ghost.x, ghost.y, 16, PITCH)).toBe(12)
  })

  it('survives nonsense', () => {
    expect(cellAtLocal(0, 0, 0, PITCH)).toBe(-1)
    expect(cellAtLocal(0, 0, 10, { w: 0, d: 0 })).toBe(-1)
    expect(cellAtLocal(Number.NaN, 0, 10, PITCH)).toBe(-1)
  })
})

describe('draw order is back to front, and stable', () => {
  it('never draws a nearer cell before a further one', () => {
    const order = drawOrder(100, PITCH)
    expect(order).toHaveLength(100)
    expect(new Set(order).size).toBe(100)
    for (let k = 1; k < order.length; k++) {
      expect(cellAt(order[k], PITCH).y).toBeGreaterThanOrEqual(cellAt(order[k - 1], PITCH).y)
    }
  })

  it('is identical on every rebuild', () => {
    // An unstable sort would repaint the overlaps differently each frame and
    // read as flicker rather than as a city.
    expect(drawOrder(37, PITCH)).toEqual(drawOrder(37, PITCH))
  })
})

describe('the extent grows the way the square does', () => {
  it('is bigger for more cells, and steps on the square numbers', () => {
    expect(gridExtent(100, PITCH).w).toBeGreaterThan(gridExtent(10, PITCH).w)
    expect(gridExtent(10, PITCH).w).toBeGreaterThan(gridExtent(1, PITCH).w)
    expect(gridExtent(4, PITCH)).toEqual(gridExtent(3, PITCH))
    expect(gridExtent(5, PITCH).w).toBeGreaterThan(gridExtent(4, PITCH).w)
  })

  it('covers every cell it claims to, allowing each one its own footprint', () => {
    const e = gridExtent(100, PITCH)
    const c = gridCentre(100, PITCH)
    for (let i = 0; i < 100; i++) {
      const at = cellAt(i, PITCH)
      expect(Math.abs(at.x - c.x)).toBeLessThanOrEqual(e.w / 2 + 1e-9)
      expect(Math.abs(at.y - c.y)).toBeLessThanOrEqual(e.h / 2 + 1e-9)
    }
  })
})
