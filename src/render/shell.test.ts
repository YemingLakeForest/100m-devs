import { describe, expect, it } from 'vitest'

import { gridPointToScreen } from './room.ts'
import {
  CUTAWAY_RATIO,
  MULLION,
  PANE_WIDTH,
  PARTITION_THICK,
  WALL_FULL,
  WALL_NEAR,
  WALL_THICK,
  type Edge,
  type WallRun,
  edgeHeight,
  insideShell,
  isFarEdge,
  paneDivisions,
  runsAlongGy,
  shellExtent,
  wallSegments,
} from './shell.ts'

/**
 * §7.8.0b — the shell primitives.
 *
 * These tests exist because `test:room` is expensive and late. It photographs
 * the drawn floor in a real browser, which is the only way to catch a wall at a
 * screen slope the projection has no room for — but it takes minutes, and it
 * can only tell you *that* the geometry is wrong. Everything here is a claim
 * about the geometry that can be made in milliseconds and pointed at a line.
 */

const EDGES: readonly Edge[] = ['far-left', 'far-right', 'near-left', 'near-right']

describe('the cutaway', () => {
  it('stands the far walls full height and cuts the near ones down', () => {
    expect(edgeHeight('far-left')).toBe(WALL_FULL)
    expect(edgeHeight('far-right')).toBe(WALL_FULL)
    expect(edgeHeight('near-left')).toBe(WALL_NEAR)
    expect(edgeHeight('near-right')).toBe(WALL_NEAR)
  })

  /**
   * The ratio, not the heights. Both canonical concepts put the near wall at
   * roughly a third of the far wall, and that is the number that has to
   * survive a retune: much higher and the near wall hides the front row of
   * desks, much lower and it stops reading as a wall.
   */
  it('keeps the near wall around a third of the far wall', () => {
    expect(CUTAWAY_RATIO).toBeGreaterThan(0.28)
    expect(CUTAWAY_RATIO).toBeLessThan(0.45)
  })

  it('makes an exterior wall thicker than an interior partition', () => {
    expect(WALL_THICK).toBeGreaterThan(PARTITION_THICK)
  })

  it('knows which two edges the camera is behind', () => {
    expect(EDGES.filter(isFarEdge)).toEqual(['far-left', 'far-right'])
  })
})

describe('a wall is a solid, not a plane', () => {
  const run: WallRun = { edge: 'far-left', at: 0, from: 0, to: 10 }

  it('has thickness on the axis it is thin in', () => {
    const [s] = wallSegments(run)
    expect(s.w).toBe(WALL_THICK)
    expect(s.d).toBe(10)
    expect(s.h).toBe(WALL_FULL)
  })

  it('turns the thin axis with the edge', () => {
    // The two `-left` edges run along gy; the two others along gx. A caller
    // never states this — stating it is how a corner ends up with a notch.
    expect(runsAlongGy('far-left')).toBe(true)
    expect(runsAlongGy('near-right')).toBe(true)
    expect(runsAlongGy('far-right')).toBe(false)
    expect(runsAlongGy('near-left')).toBe(false)
    const [g] = wallSegments({ edge: 'far-right', at: 0, from: 0, to: 10 })
    expect(g.w).toBe(10)
    expect(g.d).toBe(WALL_THICK)
  })

  it('draws nothing for a run of no length', () => {
    expect(wallSegments({ edge: 'far-left', at: 0, from: 4, to: 4 })).toEqual([])
  })
})

/**
 * **Openings are real shell geometry.** The prompt asks for this by name, and
 * the test that proves it is not "a door was drawn" but "there is nothing
 * there": the wall is a list of solids and the doorway is a gap in the list.
 */
describe('door openings', () => {
  it('is a gap in the list of solids, not a rectangle drawn on one', () => {
    const segs = wallSegments({
      edge: 'far-left',
      at: 0,
      from: 0,
      to: 10,
      openings: [{ at: 4, width: 2 }],
    })
    expect(segs).toHaveLength(2)
    expect(segs[0]).toMatchObject({ gy: 0, d: 4 })
    expect(segs[1]).toMatchObject({ gy: 6, d: 4 })
    // And nothing occupies the hole at any height.
    for (const s of segs) {
      const covers = s.gy < 6 && s.gy + s.d > 4
      expect(covers).toBe(false)
    }
  })

  it('stands a lintel over a doorway that stops short of the head', () => {
    const segs = wallSegments({
      edge: 'far-left',
      at: 0,
      from: 0,
      to: 10,
      openings: [{ at: 4, width: 2, head: 2 }],
    })
    const lintel = segs.filter((s) => s.kind === 'lintel')
    expect(lintel).toHaveLength(1)
    // It starts where the opening stops and reaches the top of the wall — the
    // band of wall standing on nothing visible, which is what makes an opening
    // read as cut through something solid.
    expect(lintel[0]).toMatchObject({ gy: 4, d: 2, gz: 2 })
    expect(lintel[0].gz + lintel[0].h).toBeCloseTo(WALL_FULL, 10)
    // The doorway itself is still empty below the lintel.
    const atDoor = segs.filter((s) => s.gy < 6 && s.gy + s.d > 4 && s.gz < 2)
    expect(atDoor).toEqual([])
  })

  it('does not stand a lintel on an opening that reaches the top', () => {
    // The garage's roll-up door: the near wall is barely taller than the door,
    // so there is no band of wall above it and drawing one would be a lie.
    const segs = wallSegments({
      edge: 'near-left',
      at: 0,
      from: 0,
      to: 10,
      openings: [{ at: 3, width: 4, head: WALL_NEAR }],
    })
    expect(segs.every((s) => s.kind === 'pier')).toBe(true)
    expect(segs).toHaveLength(2)
  })

  it('merges overlapping openings rather than leaving a flickering hairline', () => {
    const segs = wallSegments({
      edge: 'far-left',
      at: 0,
      from: 0,
      to: 10,
      openings: [
        { at: 4, width: 2 },
        { at: 5, width: 2 },
      ],
    })
    expect(segs).toHaveLength(2)
    expect(segs[1].gy).toBe(7)
    for (const s of segs) expect(s.d).toBeGreaterThan(0)
  })

  it('clips an opening that overruns the end of the wall', () => {
    const segs = wallSegments({
      edge: 'far-left',
      at: 0,
      from: 0,
      to: 10,
      openings: [{ at: 8, width: 5 }],
    })
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ gy: 0, d: 8 })
  })

  it('takes openings in any order', () => {
    const a = wallSegments({
      edge: 'far-left', at: 0, from: 0, to: 12,
      openings: [{ at: 8, width: 1 }, { at: 3, width: 1 }],
    })
    const b = wallSegments({
      edge: 'far-left', at: 0, from: 0, to: 12,
      openings: [{ at: 3, width: 1 }, { at: 8, width: 1 }],
    })
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
  })
})

/**
 * **Wall geometry remains valid in the isometric projection.** The projection
 * is exactly 2:1, so every edge of a floor-aligned solid lands on a screen
 * slope of exactly ±0.5. A wall at any other slope is the defect `test:room`
 * exists to catch, and this catches the arithmetic that produces it.
 */
describe('the projection', () => {
  // The room's own projection, not a copy of it. A test that reimplements the
  // thing it is checking can only prove the copy is self-consistent.
  const p = (gx: number, gy: number) => gridPointToScreen({ gx, gy })

  it('puts every wall edge on the projection s own two slopes', () => {
    for (const edge of EDGES) {
      const [s] = wallSegments({ edge, at: 2, from: 1, to: 9 })
      const a = p(s.gx, s.gy)
      const b = runsAlongGy(edge) ? p(s.gx, s.gy + s.d) : p(s.gx + s.w, s.gy)
      const slope = (b.y - a.y) / (b.x - a.x)
      expect(Math.abs(slope)).toBeCloseTo(0.5, 10)
    }
  })

  it('runs the two axes in opposite screen directions', () => {
    // gx goes down-right, gy goes down-left. If these ever agree, the floor is
    // a parallelogram sheared the wrong way and every wall leans.
    const o = p(0, 0)
    expect(p(1, 0).x - o.x).toBeGreaterThan(0)
    expect(p(0, 1).x - o.x).toBeLessThan(0)
    expect(p(1, 0).y - o.y).toBeGreaterThan(0)
    expect(p(0, 1).y - o.y).toBeGreaterThan(0)
  })
})

/**
 * **Containment is computed from the drawn geometry.** The camera used to fit a
 * rectangle derived from the seat lattice while the walls came from a second
 * calculation, so the two could disagree — and did.
 */
describe('the extent', () => {
  const rect = (w: number, d: number): WallRun[] => [
    { edge: 'far-left', at: 0, from: 0, to: d },
    { edge: 'far-right', at: 0, from: 0, to: w },
    { edge: 'near-left', at: d, from: 0, to: w },
    { edge: 'near-right', at: w, from: 0, to: d },
  ]

  it('is exactly the rectangle the four runs stand on', () => {
    // §7.8.0b — `at` is the **outer** face on all four edges, so a shell built
    // from one rectangle occupies that rectangle and grows inward. Walls stand
    // on the slab's edge, which is what a building does.
    const e = shellExtent(rect(20, 12))
    expect(e.minGx).toBe(0)
    expect(e.minGy).toBe(0)
    expect(e.maxGx).toBeCloseTo(20, 10)
    expect(e.maxGy).toBeCloseTo(12, 10)
    expect(e.height).toBeCloseTo(WALL_FULL, 10)
  })

  /**
   * **The two functions have to agree**, and for a fortnight they did not: the
   * segments put the near walls a whole thickness *outside* the room while
   * `insideShell`, reading the same runs, believed they were a thickness
   * inside it. Neither was wrong alone. This is the assertion that catches the
   * disagreement rather than either half of it.
   */
  it('never calls a point inside the room that a wall is standing on', () => {
    const runs = rect(20, 12)
    for (const run of runs) {
      for (const seg of wallSegments(run)) {
        // Sample the middle of each solid's footprint.
        const gx = seg.gx + seg.w / 2
        const gy = seg.gy + seg.d / 2
        expect({ edge: run.edge, inside: insideShell(runs, gx, gy) })
          .toEqual({ edge: run.edge, inside: false })
      }
    }
  })

  it('follows a wall that moves, with no second number to keep in step', () => {
    const wide = shellExtent(rect(30, 12))
    expect(wide.maxGx - shellExtent(rect(20, 12)).maxGx).toBeCloseTo(10, 10)
  })

  it('survives an empty shell rather than returning infinities', () => {
    expect(shellExtent([])).toEqual({ minGx: 0, maxGx: 0, minGy: 0, maxGy: 0, height: 0 })
  })

  it('puts the floor inside the inner faces and the walls outside them', () => {
    const runs = rect(20, 12)
    expect(insideShell(runs, 10, 6)).toBe(true)
    // Just inside each inner face.
    expect(insideShell(runs, WALL_THICK + 0.01, 6)).toBe(true)
    // In the thickness of a wall is not inside the room.
    expect(insideShell(runs, WALL_THICK - 0.01, 6)).toBe(false)
    expect(insideShell(runs, 10, 12 - WALL_THICK + 0.01)).toBe(false)
    expect(insideShell(runs, -1, 6)).toBe(false)
  })
})

describe('glass', () => {
  it('divides a run into whole panes with a mullion at each end', () => {
    const d = paneDivisions(9)
    expect(d[0]).toBe(0)
    expect(d[d.length - 1]).toBeCloseTo(9, 10)
    const steps = d.slice(1).map((v, i) => v - d[i])
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 10)
  })

  it('keeps the pane close to the width it was asked for', () => {
    for (const len of [2, 3.7, 9, 14.5, 31]) {
      const d = paneDivisions(len)
      const step = d[1] - d[0]
      expect(step).toBeGreaterThan(PANE_WIDTH * 0.55)
      expect(step).toBeLessThan(PANE_WIDTH * 1.9)
    }
  })

  it('never divides a run into nothing, however short', () => {
    expect(paneDivisions(0.2)).toHaveLength(2)
    expect(paneDivisions(0)).toEqual([])
    expect(paneDivisions(-3)).toEqual([])
  })

  it('leaves a mullion narrower than the pane it separates', () => {
    // If the frame ever grows past the glass the run reads as a solid wall
    // with scratches on it.
    expect(MULLION * 2).toBeLessThan(PANE_WIDTH * 0.5)
  })
})
