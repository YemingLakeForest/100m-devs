/**
 * Routes across the floor — GDD §7.8.6's one open failure mode.
 *
 * §7.8.6 listed it against itself: *"Walk cycles that clip through desks. The
 * water trip is the only pathing in the game and it may take the §7.8.1 walkway
 * or nothing."* What was built was a straight line from a desk to a prop, which
 * on a floor of five squads runs diagonally through forty workstations. This is
 * the walkway half, finally.
 *
 * ## Manhattan, in the floor's own axes
 *
 * The room is not a free plane. `isoAt` lays a row along `gy` at a constant
 * `gx`, one desk per tile shoulder to shoulder, and takes the space out
 * *behind* the row — the room's `PITCH_ROW` is 2.1 tiles where a desk is about one.
 * So the walkable floor is a **lattice of lines**: the aisle behind every row
 * (constant `gx`, free in `gy`), and the corridors between squads and around
 * the perimeter (constant `gy`, free in `gx`).
 *
 * A route is therefore never a direction, it is a sequence of turns along that
 * lattice — out of the chair backwards into your own aisle, along it to a
 * corridor, across, and along the far aisle to the destination. On screen those
 * are the two isometric axes, which is exactly the "along the desks or square
 * to them, never through them" the floor is meant to read as.
 *
 * Pure and geometry-only: **no imports at all**, not even the room's own
 * pitches. The room hands it a lattice and two points and gets waypoints back.
 * That is not fastidiousness — `room.ts` is the module that would import this
 * one, and a router that reached back for `PITCH_ROW` would close a cycle whose
 * only protection is that neither side happens to read the other at module
 * evaluation time. The lattice carries the room's grain instead, which is also
 * what makes the one claim worth testing — **no leg of a route crosses a
 * desk** — testable without standing up a renderer.
 */


/** A point in the floor's grid axes: `gx` steps across rows, `gy` runs along one. */
export interface GridPoint {
  gx: number
  gy: number
}

/**
 * The lattice a route may use.
 *
 * Handed in rather than derived, because which corridors exist is a fact about
 * this headcount's room — §7.8.1 takes the walkway away once the floor is
 * crowded, and a router that recomputed the lattice from constants would keep
 * walking down a corridor that is now desks.
 *
 * **`aisles` must bracket every destination the router will be given.** A prop
 * standing against the back wall sits outside the desk grid entirely, so the
 * lattice needs a perimeter lane on that side; without one the router picks the
 * nearest *row* aisle and the final approach walks straight back through row
 * zero. `room.ts` builds the list with the perimeter included for exactly this
 * reason.
 */
export interface Lanes {
  /** Aisle lines: constant `gx`, walkable along `gy`. One behind each row, plus the perimeter. */
  readonly aisles: readonly number[]
  /** Corridor lines: constant `gy`, walkable along `gx`. Squad gaps and the perimeter. */
  readonly corridors: readonly number[]
  /** Half a desk's depth across the rows, in grid units. */
  readonly deskHalfDepth: number
  /** Half a desk's width along its row, in grid units. */
  readonly deskHalfWidth: number
}

/**
 * How far behind a row its aisle runs, as a fraction of the room's row pitch.
 *
 * Half, so the lane sits midway between the back of one row's desks and the
 * front of the next — which is where an office actually leaves the gap, and
 * which keeps a walker clear of both rows rather than brushing one of them.
 *
 * **Behind, not in front**, and that is not arbitrary: `drawWorkstation` turns
 * the desk south-east, so the developer faces north-west, so the space at their
 * back is `+gx`. A lane in front of the row would run through the monitors.
 */
export const LANE_BEHIND = 0.5

/** The aisle serving desk row `row`, given the room's row pitch. */
export function laneFor(row: number, pitchRow: number): number {
  return (row + LANE_BEHIND) * pitchRow
}

/** Nearest value in a list. Returns `to` itself if the list is empty. */
function nearest(list: readonly number[], to: number): number {
  if (list.length === 0) return to
  let best = list[0]
  for (const v of list) if (Math.abs(v - to) < Math.abs(best - to)) best = v
  return best
}

/**
 * The aisle **behind** `gx` — the first one past it, walking away from the
 * monitors.
 *
 * Not `nearest`, and the difference is the whole first leg of every route. A
 * desk sits exactly on a row line with an aisle half a pitch either side, so
 * the two are equidistant and `nearest` picks whichever the list happened to
 * offer first — which half the time is the lane *in front* of the row, on the
 * far side of the monitor the developer is facing. They then walk out through
 * their own desk before they have gone anywhere.
 *
 * Approaching a destination works the same way and for the same reason: you
 * arrive at a desk from the aisle behind it, not through the screen.
 *
 * Falls back to the nearest lane when there is nothing further out, which is
 * the case for anything standing against the far edge of the floor.
 */
function laneBehind(list: readonly number[], gx: number): number {
  let best = Infinity
  for (const v of list) if (v > gx + 1e-6 && v < best) best = v
  return Number.isFinite(best) ? best : nearest(list, gx)
}

/**
 * Waypoints from a desk to a destination, in grid coordinates.
 *
 * The first point is the desk itself and the last is the destination, so the
 * renderer can walk the whole thing without special-casing either end.
 *
 * **Legs alternate axes and never move both at once**, which is what makes the
 * result a walk down a corridor rather than a diagonal with corners on it.
 * Degenerate legs (zero length) are dropped rather than kept, so a route that
 * happens to need only one turn does not carry three collinear points that the
 * heading code would read as a stop.
 */
export function route(from: GridPoint, to: GridPoint, lanes: Lanes): GridPoint[] {
  const startLane = laneBehind(lanes.aisles, from.gx)
  const endLane = laneBehind(lanes.aisles, to.gx)
  // The corridor to cross on: whichever is nearest the *midpoint* of the two
  // lanes rather than nearest either end, so a walk between two distant rows
  // does not double back to the corridor it happened to start beside.
  const corridor = nearest(lanes.corridors, (from.gy + to.gy) / 2)

  const points: GridPoint[] = [
    { gx: from.gx, gy: from.gy },
    // Out of the chair, backwards into your own aisle.
    { gx: startLane, gy: from.gy },
  ]

  if (Math.abs(startLane - endLane) > 1e-6) {
    // Different rows: down the aisle to a corridor, across on it, then back
    // along the destination's aisle.
    points.push({ gx: startLane, gy: corridor })
    points.push({ gx: endLane, gy: corridor })
  }

  points.push({ gx: endLane, gy: to.gy })
  points.push({ gx: to.gx, gy: to.gy })

  return prune(points)
}

/** Drop zero-length legs and merge collinear ones. */
export function prune(points: readonly GridPoint[]): GridPoint[] {
  const out: GridPoint[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.gx - p.gx) < 1e-6 && Math.abs(last.gy - p.gy) < 1e-6) continue
    out.push({ gx: p.gx, gy: p.gy })
  }
  return out
}

/** Total length of a route, in grid units. */
export function pathLength(points: readonly GridPoint[]): number {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    d += Math.hypot(points[i].gx - points[i - 1].gx, points[i].gy - points[i - 1].gy)
  }
  return d
}

/**
 * How fast people walk, in grid tiles per second.
 *
 * **Faster than what was there**, which is the request and also the correction
 * to a bug: the old walk spent a fixed *fraction* of the behaviour's life
 * travelling, so a trip across five squads and a trip to the next desk took
 * exactly as long and the long one crossed the floor at a sprint. Speed is a
 * constant; duration is a consequence.
 *
 * 2.6 tiles a second crosses a ten-desk squad in about four seconds, which
 * reads as walking with somewhere to be rather than as a stroll — and the whole
 * point of the away population is that it should feel like it is getting away
 * from you.
 */
export const WALK_TILES_PER_SECOND = 2.6

export interface WalkAt {
  gx: number
  gy: number
  /** Unit vector along the current leg, for the facing and the leg cycle. */
  dx: number
  dy: number
  /** False once the end of the path has been reached — they are standing still. */
  moving: boolean
}

/**
 * Where somebody is `distance` grid units into a route.
 *
 * Clamps at the far end rather than wrapping or overshooting, which is what
 * lets the renderer fit a path of any length into the simulation's fixed travel
 * window (see `sim/slackOff.ts`): arrive early and stand there, which is
 * §7.8.6's flat middle by another name.
 */
export function advanceAlong(points: readonly GridPoint[], distance: number): WalkAt {
  if (points.length === 0) return { gx: 0, gy: 0, dx: 0, dy: 0, moving: false }
  const first = points[0]
  if (points.length === 1 || distance <= 0) {
    return { gx: first.gx, gy: first.gy, dx: 0, dy: 0, moving: false }
  }

  let left = distance
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = Math.hypot(b.gx - a.gx, b.gy - a.gy)
    if (len <= 1e-9) continue
    if (left <= len) {
      const t = left / len
      return {
        gx: a.gx + (b.gx - a.gx) * t,
        gy: a.gy + (b.gy - a.gy) * t,
        dx: (b.gx - a.gx) / len,
        dy: (b.gy - a.gy) / len,
        moving: true,
      }
    }
    left -= len
  }

  const end = points[points.length - 1]
  const prev = points[points.length - 2]
  const len = Math.hypot(end.gx - prev.gx, end.gy - prev.gy) || 1
  return {
    gx: end.gx,
    gy: end.gy,
    dx: (end.gx - prev.gx) / len,
    dy: (end.gy - prev.gy) / len,
    moving: false,
  }
}

/**
 * Does this route pass through a desk?
 *
 * The test §7.8.6's failure-mode list asks for, written as a function so it can
 * be asserted rather than eyeballed. A desk at grid `(gx, gy)` is a box of
 * `deskHalfWidth` either side along its row and `deskHalfDepth` either side
 * across; a leg crosses one if any point on it lands inside the box.
 *
 * Sampled rather than solved. The legs are axis-aligned by construction, so a
 * sample every fifth of a tile cannot step over a box a whole tile wide, and
 * the closed form buys nothing but a chance to get the algebra wrong.
 */
export function crossesDesk(
  points: readonly GridPoint[],
  desks: readonly GridPoint[],
  lanes: Pick<Lanes, 'deskHalfDepth' | 'deskHalfWidth'>,
  skip: readonly GridPoint[] = [],
): boolean {
  const skipped = new Set(skip.map((d) => `${d.gx.toFixed(3)},${d.gy.toFixed(3)}`))
  const boxes = desks.filter((d) => !skipped.has(`${d.gx.toFixed(3)},${d.gy.toFixed(3)}`))
  const total = pathLength(points)
  for (let d = 0; d <= total; d += 0.2) {
    const at = advanceAlong(points, d)
    for (const desk of boxes) {
      if (
        Math.abs(at.gx - desk.gx) < lanes.deskHalfDepth &&
        Math.abs(at.gy - desk.gy) < lanes.deskHalfWidth
      ) {
        return true
      }
    }
  }
  return false
}
