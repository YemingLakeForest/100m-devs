import { describe, expect, it } from 'vitest'
import {
  LANE_BEHIND,
  WALK_TILES_PER_SECOND,
  advanceAlong,
  crossesDesk,
  laneFor,
  pathLength,
  prune,
  route,
  type GridPoint,
  type Lanes,
} from './walkPath.ts'
import { PITCH_COL, PITCH_ROW, roomLanes, seatGridPoint } from './room.ts'

/** Every desk on a floor of `n`, in the axes the router works in. */
function desks(n: number): GridPoint[] {
  return Array.from({ length: n }, (_, i) => seatGridPoint(i))
}

/** A prop against the back wall, well outside the desk grid. */
function wallProp(gy: number): GridPoint {
  return { gx: laneFor(-1, PITCH_ROW) - 0.8, gy }
}

describe('the lattice', () => {
  it('puts a lane behind every occupied row, and one in front of the first', () => {
    const lanes = roomLanes(60)
    expect(lanes.aisles).toContain(laneFor(0, PITCH_ROW))
    // The back-wall lane. Without it, props against the wall are unreachable
    // without walking through row zero.
    expect(Math.min(...lanes.aisles)).toBeLessThan(0)
  })

  it('brackets the desks on both sides — the router relies on it', () => {
    const lanes = roomLanes(300)
    const all = desks(300)
    expect(Math.min(...lanes.aisles)).toBeLessThan(Math.min(...all.map((d) => d.gx)))
    expect(Math.max(...lanes.aisles)).toBeGreaterThan(Math.max(...all.map((d) => d.gx)))
    expect(Math.min(...lanes.corridors)).toBeLessThan(Math.min(...all.map((d) => d.gy)))
    expect(Math.max(...lanes.corridors)).toBeGreaterThan(Math.max(...all.map((d) => d.gy)))
  })

  it('grows a corridor as the studio grows into the next squad', () => {
    expect(roomLanes(700).corridors.length).toBeGreaterThan(roomLanes(40).corridors.length)
  })
})

describe('route', () => {
  it('leaves the chair backwards, into its own aisle — never forwards', () => {
    const lanes = roomLanes(60)
    const from = seatGridPoint(23)
    const path = route(from, wallProp(3 * PITCH_COL), lanes)
    expect(path[0]).toEqual(from)
    // The first move is across the rows, in the direction the developer's back
    // is turned. `drawWorkstation` faces them north-west, so that is +gx.
    expect(path[1].gy).toBeCloseTo(from.gy, 6)
    expect(path[1].gx).toBeGreaterThan(from.gx)
  })

  it('moves one axis at a time — no diagonals across the floor', () => {
    const lanes = roomLanes(300)
    const path = route(seatGridPoint(7), seatGridPoint(268), lanes)
    for (let i = 1; i < path.length; i++) {
      const dx = Math.abs(path[i].gx - path[i - 1].gx)
      const dy = Math.abs(path[i].gy - path[i - 1].gy)
      expect(Math.min(dx, dy)).toBeLessThan(1e-6)
    }
  })

  it('ends on the destination', () => {
    const lanes = roomLanes(60)
    const to = wallProp(5 * PITCH_COL)
    const path = route(seatGridPoint(11), to, lanes)
    expect(path[path.length - 1]).toEqual(to)
  })

  it('never walks through a desk — §7.8.6’s open failure mode', () => {
    // The claim the whole module exists for, asserted across a floor rather
    // than on one hand-picked pair.
    const n = 240
    const lanes = roomLanes(n)
    const all = desks(n)
    for (const seat of [0, 1, 9, 10, 37, 99, 100, 143, 239]) {
      const from = seatGridPoint(seat)
      for (const gy of [0, 4 * PITCH_COL, 9 * PITCH_COL]) {
        const path = route(from, wallProp(gy), lanes)
        // The origin desk is skipped: a route starts *at* the chair, so it is
        // inside that one box by construction.
        expect(crossesDesk(path, all, lanes, [from])).toBe(false)
      }
    }
  })

  it('never walks through a desk on a desk-to-desk trip either', () => {
    const n = 240
    const lanes = roomLanes(n)
    const all = desks(n)
    for (const [a, b] of [
      [3, 4],
      [0, 239],
      [55, 56],
      [12, 210],
      [100, 101],
    ]) {
      const from = seatGridPoint(a)
      const to = seatGridPoint(b)
      expect(crossesDesk(route(from, to, lanes), all, lanes, [from, to])).toBe(false)
    }
  })

  it('takes longer to cross the floor than to visit the next row', () => {
    const lanes = roomLanes(240)
    const near = pathLength(route(seatGridPoint(0), seatGridPoint(10), lanes))
    const far = pathLength(route(seatGridPoint(0), seatGridPoint(239), lanes))
    expect(far).toBeGreaterThan(near)
  })

  it('drops degenerate legs rather than leaving collinear stops in', () => {
    const p = prune([
      { gx: 0, gy: 0 },
      { gx: 0, gy: 0 },
      { gx: 1, gy: 0 },
    ])
    expect(p).toHaveLength(2)
  })
})

describe('advanceAlong', () => {
  const straight: GridPoint[] = [
    { gx: 0, gy: 0 },
    { gx: 0, gy: 4 },
    { gx: 3, gy: 4 },
  ]

  it('starts at the desk and stops at the destination', () => {
    expect(advanceAlong(straight, 0)).toMatchObject({ gx: 0, gy: 0, moving: false })
    const end = advanceAlong(straight, 999)
    expect(end.gx).toBeCloseTo(3, 6)
    expect(end.gy).toBeCloseTo(4, 6)
    expect(end.moving).toBe(false)
  })

  it('is continuous — nobody teleports across a corner', () => {
    let prev = advanceAlong(straight, 0)
    for (let d = 0.05; d <= pathLength(straight); d += 0.05) {
      const at = advanceAlong(straight, d)
      expect(Math.hypot(at.gx - prev.gx, at.gy - prev.gy)).toBeLessThan(0.2)
      prev = at
    }
  })

  it('hands back a heading along the current leg, so they face where they walk', () => {
    expect(advanceAlong(straight, 1)).toMatchObject({ dx: 0, dy: 1 })
    expect(advanceAlong(straight, 5)).toMatchObject({ dx: 1, dy: 0 })
  })

  it('holds still once it arrives, however long the walk window is', () => {
    // The renderer fits any path into the simulation's fixed travel window
    // (`TRAVEL_SECONDS`); arriving early has to read as standing there, not as
    // overshooting the cooler.
    const over = advanceAlong(straight, pathLength(straight) * 4)
    expect(over.moving).toBe(false)
  })

  it('walks a squad in a few seconds rather than a fraction of a behaviour', () => {
    const crossing = 10 * PITCH_COL
    expect(crossing / WALK_TILES_PER_SECOND).toBeLessThan(8)
    expect(crossing / WALK_TILES_PER_SECOND).toBeGreaterThan(1)
  })
})

describe('laneFor', () => {
  it('sits between two rows rather than on either', () => {
    const lane = laneFor(0, PITCH_ROW)
    expect(lane).toBeGreaterThan(0)
    expect(lane).toBeLessThan(PITCH_ROW)
    expect(lane).toBeCloseTo(LANE_BEHIND * PITCH_ROW, 6)
  })
})

describe('crossesDesk', () => {
  it('catches the straight line this module replaced', () => {
    // The old walk: desk to wall prop, as the crow flies. On a floor of rows it
    // is a diagonal through the furniture, which is what §7.8.6 flagged.
    const n = 240
    const lanes: Lanes = roomLanes(n)
    const from = seatGridPoint(200)
    const to = wallProp(2 * PITCH_COL)
    expect(crossesDesk([from, to], desks(n), lanes, [from])).toBe(true)
  })
})
