/**
 * **The garage** — GDD §7.8.0c [CANON - added 2026-09-01].
 *
 * The authored plan for the first twenty developers: five four-person pods, a
 * leadership corner behind reclaimed glass, a shell with a real roll-up door,
 * and the clutter that makes it a garage rather than a small office.
 *
 * ## Why this is a second plan and not a prefix of the office one
 *
 * `floorplan.ts` holds the office floor, and the obvious economy is to make the
 * garage its first twenty seats. That is wrong, and the reason is the whole
 * point of §7.8.0's transition: the garage and the office are **two rooms**.
 * Seat 7 is a person, and that person keeps their identity, their face and
 * their index across the move — but they do not keep their *coordinates*,
 * because the coordinates belong to a building they have left. A single table
 * that had to be both would have to be a compromise between five pods in a
 * garage and a neighbourhood on an office floor, and would be neither.
 *
 * So: two plans, one address space. `capacity.addressOf` is the address;
 * `garageSeat` and `planSeat` are the two rooms' answers to where that address
 * stands. §7.8.1b is preserved *within* each room, which is the version of it
 * that was ever meaningful — nobody is moved by a hire.
 *
 * ## Units
 *
 * **Tiles, directly**, not seat units. The office floor speaks in seat units
 * because it is a lattice of a hundred identical pitches; the garage is a
 * hand-drawn room of five objects, and expressing it through `PITCH_ROW`'s 2.1
 * would mean every number in here was a fraction of a pitch chosen to come out
 * at a tile. `gx` runs down-right on screen and `gy` down-left, which is
 * `gridToScreen`'s convention and therefore the room's.
 *
 * ## Where the numbers came from
 *
 * The canonical concept, read as a composition rather than as pixels. What was
 * measured off it and is load-bearing:
 *
 * - **Five pods of four, staggered — not a grid and not a row.** They sit in a
 *   loose quincunx with a pod's worth of floor between them. A grid of five is
 *   a car park at any scale, which is the §7.8.1e complaint one room down.
 * - **A pod is one table with two people each side, facing each other.** This
 *   is the only place in the game where developers face one another, and it is
 *   what makes four people read as a *team* rather than as four workstations.
 * - **The leadership corner is at the far vertex, behind glass, and off the
 *   grid.** It costs no ordinary seat — §7.8.0's separation, drawn.
 * - **Wide aisles.** The concept's floor is more empty than full; the negative
 *   space around the pods is what makes twenty people read as a small studio
 *   with room to grow rather than as a full one.
 */

import { GARAGE_CAP } from '../sim/capacity.ts'
import { PARTITION_THICK, WALL_THICK, type Opening, type WallRun } from './shell.ts'

/** How deep and wide the garage's interior is, in tiles. */
export const GARAGE_SPAN = 14

/**
 * Which way a developer is looking, on the floor's own two axes.
 *
 * Not a screen direction. `gx+` is down-right on screen and `gx-` is up-left,
 * so two seats across a table with opposite facings are looking at each other
 * however the projection is retuned.
 */
export type Facing = 'gx+' | 'gx-' | 'gy+' | 'gy-'

export function opposite(f: Facing): Facing {
  switch (f) {
    case 'gx+': return 'gx-'
    case 'gx-': return 'gx+'
    case 'gy+': return 'gy-'
    case 'gy-': return 'gy+'
  }
}

/**
 * One four-person pod: a table with two seats a side.
 *
 * `gx`/`gy` is the pod's **table centre**. The table runs along `gy` and the
 * two rows of seats sit either side of it on `gx`, so the pair on the low side
 * face `gx+` and the pair on the high side face `gx-`. That is the arrangement
 * in the concept and it is also the one that reads: a table running along `gy`
 * presents its long edge to the camera, so all four faces are visible at once
 * rather than two of them being hidden behind the near pair.
 */
export interface Pod {
  readonly id: number
  readonly name: string
  readonly gx: number
  readonly gy: number
}

/**
 * **How big a pod is**, and it was a third smaller until 2026-09-01.
 *
 * Measured off the canonical concept the second time rather than the first. A
 * side-by-side of the full frame made the gap plain: the concept's five tables
 * fill about **45 per cent** of the garage floor and the first pass filled
 * about twenty, so the same twenty people read as a sparse room rather than as
 * a packed one. Nothing was wrong with the arrangement — the furniture was
 * simply too small for the building.
 *
 * The three numbers move together, because they are one object: the table's
 * depth, the seat pitch along it, and the footprint the overlap tests use. A
 * table you can get four people round is about two tiles by three, and that is
 * what these now describe.
 */
/** Half the table's depth — how far a seat sits from the table centre. */
export const POD_REACH = 0.8
/** Seat-to-seat along the table. */
export const POD_STRIDE = 1.45
/** A pod's whole footprint, including chairs — used for overlap checks. */
export const POD_HALF_GX = 1.5
export const POD_HALF_GY = 1.4

/**
 * **The five pods.**
 *
 * A quincunx read off the concept, stated as the two things that make it one:
 * no two pods share a `gx` or a `gy`, and the set is not symmetric about either
 * axis. Both are checked, because "staggered" is the kind of property that
 * survives an edit as a word in a comment long after the numbers have drifted
 * back into a grid.
 *
 * The names are the joke the garage tells about itself — a twenty-person studio
 * with departments — and they are also what the §7.8.1e colour caps will label
 * once the pods get partitions.
 */
export const GARAGE_PODS: readonly Pod[] = [
  // Straight out in front of the leadership glass — the pod the founder can see
  // from their desk, which is why it is the one James lands in.
  { id: 0, name: 'THE BENCH', gx: 7.2, gy: 2.6 },
  // Under the tool board, deepest into the workshop end.
  { id: 1, name: 'THE TOOL WALL', gx: 11.0, gy: 2.5 },
  // Along the left wall past the corner, in front of the boxes.
  { id: 2, name: 'THE LONG TABLE', gx: 3.4, gy: 10.8 },
  // The middle of the room, and the pod the route from the door runs past.
  { id: 3, name: 'THE MIDDLE', gx: 7.8, gy: 7.8 },
  // Front right, by the sofa and the fridge. The last pod to fill.
  { id: 4, name: 'THE SOFA END', gx: 11.4, gy: 9.6 },
]

/** Four to a pod, five pods — §7.8.0's twenty, expressed as furniture. */
export const POD_SEATS = 4
export const GARAGE_SEATS = GARAGE_PODS.length * POD_SEATS

export interface GarageSeat {
  readonly index: number
  readonly pod: number
  /** 0 and 1 are the low-`gx` side; 2 and 3 the high side, facing them. */
  readonly inPod: number
  readonly gx: number
  readonly gy: number
  readonly facing: Facing
}

/**
 * Where ordinary developer `index` sits in the garage.
 *
 * **Pure, total and monotonic in the pod.** Seats fill a pod before starting
 * the next one, which is what makes the twentieth hire visibly *complete* the
 * fifth pod rather than adding a straggler to a half-empty room — §7.8.0's
 * "the twentieth developer visibly completes the garage", expressed as fill
 * order rather than as an animation.
 *
 * **Within a pod the order alternates sides**, so 0 and 1 face each other
 * across the table and 2 and 3 do. That is a decision and not a detail: the
 * alternative fills one side and then the other, which means a pod holding two
 * people is two strangers sitting side by side looking at an empty bench. Two
 * people facing each other is a pair, and a pair is the smallest thing in this
 * game that reads as a team.
 */
export function garageSeat(index: number): GarageSeat {
  const i = Math.max(0, Math.min(GARAGE_SEATS - 1, Math.floor(index)))
  const pod = GARAGE_PODS[Math.floor(i / POD_SEATS)]
  const inPod = i % POD_SEATS
  // Even seats take the far side of the table, odd the near — so consecutive
  // arrivals sit opposite each other. Which pair along the table is the
  // *second* bit, so the pod fills front-to-back rather than left-to-right.
  const far = inPod % 2 === 0
  const along = inPod < 2 ? -0.5 : 0.5
  return {
    index: i,
    pod: pod.id,
    inPod,
    gx: pod.gx + (far ? -POD_REACH : POD_REACH),
    gy: pod.gy + along * POD_STRIDE,
    facing: far ? 'gx+' : 'gx-',
  }
}

/** Every seat, in hiring order. */
export function garageSeats(): GarageSeat[] {
  return Array.from({ length: GARAGE_SEATS }, (_, i) => garageSeat(i))
}

/** The seat directly across the table from this one. */
export function acrossFrom(index: number): number {
  const i = Math.floor(index)
  const base = Math.floor(i / POD_SEATS) * POD_SEATS
  const inPod = i - base
  // 0<->1 and 2<->3 — consecutive arrivals are the ones facing each other.
  return base + (inPod % 2 === 0 ? inPod + 1 : inPod - 1)
}

/**
 * A rectangle of floor that is not seats — the leadership corner, the props,
 * the driveway. All in tiles, all corner-anchored.
 */
export interface Plot {
  readonly name: string
  readonly gx0: number
  readonly gy0: number
  readonly gx1: number
  readonly gy1: number
}

/**
 * **The leadership corner, and it costs nothing.**
 *
 * At the far vertex, behind a reclaimed glass partition, on its own plot. It is
 * listed separately from {@link GARAGE_PROPS} because the distinction is the
 * one §7.8.0 exists to make: this is where *people* stand who are not ordinary
 * developers, and no arithmetic anywhere may let it consume one of the twenty.
 * `garage.test.ts` asserts that no ordinary seat is inside it and that
 * {@link GARAGE_SEATS} does not know it exists.
 */
/**
 * **The leadership corner, and it costs nothing.**
 *
 * At the far vertex — the corner both full-height walls meet in — on its own
 * plot. It is listed separately from {@link GARAGE_PROPS} because the
 * distinction is the one §7.8.0 exists to make: this is where *people* stand who
 * are not ordinary developers, and no arithmetic anywhere may let it consume one
 * of the twenty. `garage.test.ts` asserts that no ordinary seat is inside it and
 * that {@link GARAGE_SEATS} does not know it exists.
 *
 * **Its size is §7.8.12's, not a number chosen here** [2026-09-01]. The suite
 * draws itself, at its own geometry, and this plot's only job is to keep the
 * pods and the clutter out of the space it will occupy. It was authored smaller
 * first, and the result was a corner the executive suite did not fit in — the
 * plot and the thing standing on it disagreeing, which is the same class of
 * defect as the two coordinate frames one level up. Generous on `gy` because
 * `suiteEastCol` widens with the roster: a corner that is right for one hero and
 * wrong for five is a corner that breaks halfway through Act I.
 */
export const GARAGE_LEADERSHIP: Plot = {
  name: 'THE CORNER',
  gx0: 0,
  gy0: 0,
  gx1: 5.2,
  gy1: 8.6,
}

/** The reclaimed glass that fences it off, as a run in the shell's language. */
/** Where the glass stops, leaving the corner's way in. */
export const GLASS_MOUTH = 6.6

/**
 * The reclaimed glass that fences the corner off, as a run in the shell's
 * language.
 *
 * `near-right` because that edge is the one that runs **along `gy` at a fixed
 * `gx`**, which is where this partition stands — on the corner's room-facing
 * side. Naming the edge rather than restating the axis is the point of
 * §7.8.0b's `Edge`: the one time this file said `near-left` here, the partition
 * came out lying across the corner's mouth instead of fencing its flank, and
 * every number in the line was individually correct.
 *
 * It stops short at {@link GLASS_MOUTH} rather than having a door cut in it.
 * The concept shows exactly that, and it is the honest detail: this is salvaged
 * glazing leaned into place by people with a deadline, not a fitted partition.
 */
export const GARAGE_GLASS = {
  edge: 'near-right' as const,
  at: GARAGE_LEADERSHIP.gx1,
  from: GARAGE_LEADERSHIP.gy0,
  to: GLASS_MOUTH,
  thickness: PARTITION_THICK,
  height: 2.6,
  paneWidth: 1.1,
}

/**
 * Where the plan's origin sits in the room, as an **offset in lattice units**.
 *
 * `room.ts` owns the two constants because they are `FLOOR_MIN_ROW` and
 * `FLOOR_MIN_COL` plus a wall, and those live there. This comment is the other
 * half of that seam, kept here because this is the file whose numbers would
 * silently mean something else if it moved: **plan tile (0, 0) is the room's
 * inner back corner** — the point where the two full-height walls meet on the
 * inside. Everything in this file is measured from there.
 *
 * Before 2026-09-01 there was no such agreement. The plan was in its own tiles
 * and the shell was in the shell box's centred tiles, and the two origins were
 * four columns and three rows apart, so every prop drawn through either
 * projection landed on one wall. See §7.8.0c.
 */
export const GARAGE_PLAN_ORIGIN_NOTE = 'plan (0,0) is the room s inner back corner'

/**
 * The clutter — §7.8.0c's list, as plots on the floor.
 *
 * Every one is a reserved rectangle rather than a coordinate the renderer picks,
 * for `floorplan.ts`'s reason one room down: *an amenity placed by the renderer
 * is an amenity that will eventually be placed on somebody's desk.* These are in
 * the same table the overlap test reads, so the two cannot disagree.
 *
 * They are also all against a wall or in a corner, which is not decoration but
 * circulation: the concept's floor is mostly empty in the middle, and that empty
 * middle is the route from the door to the corner.
 */
export const GARAGE_PROPS: readonly Plot[] = [
  // --- the far-right wall: the workshop half, past the corner --------------
  { name: 'THE SHELVES', gx0: 5.6, gy0: 0, gx1: 9.0, gy1: 0.55 },
  { name: 'THE TOOL BOARD', gx0: 9.4, gy0: 0, gx1: 12.2, gy1: 0.55 },
  { name: 'THE WORKBENCH', gx0: 9.4, gy0: 0.55, gx1: 12.2, gy1: 1.0 },
  { name: 'THE BIKE', gx0: 12.6, gy0: 0, gx1: 13.9, gy1: 0.9 },
  // --- the far-left wall, past the corner ---------------------------------
  { name: 'THE BOXES', gx0: 0, gy0: 8.9, gx1: 1.1, gy1: 11.4 },
  { name: 'THE BIN', gx0: 0, gy0: 11.8, gx1: 1.1, gy1: 13.2 },
  // --- the near-right wall: the sitting-down half -------------------------
  { name: 'THE FRIDGE', gx0: 12.9, gy0: 3.2, gx1: 14, gy1: 4.4 },
  { name: 'THE KETTLE', gx0: 12.9, gy0: 4.8, gx1: 14, gy1: 5.8 },
  { name: 'THE SOFA', gx0: 12.9, gy0: 7.0, gx1: 14, gy1: 9.6 },
  { name: 'THE CRATES', gx0: 12.9, gy0: 10.0, gx1: 14, gy1: 11.8 },
]

/**
 * **The garage's shell**, as four runs with real openings in them.
 *
 * The two far runs are full height and the two near ones are cut down — the
 * §7.8.0b cutaway. The roll-up door is an opening in the near-left wall with
 * **no lintel**, deliberately: that wall is barely taller than the door, so
 * drawing a band of wall above it would be a lie about the building. The side
 * door in the far-left wall does get one, because there is a storey above it.
 */
export const ROLLUP_WIDTH = 3.4
export const SIDE_DOOR_WIDTH = 1.1

/**
 * The roll-up door — an opening in the **near-left** wall.
 *
 * That wall runs along `gx` at the maximum `gy`, so `at` is a `gx` and not a
 * `gy`. Worth stating, because the two are interchangeable as numbers and the
 * mistake puts the door in the wrong wall while every test that checks a width
 * still passes.
 */
export const GARAGE_ROLLUP: Opening = {
  at: GARAGE_SPAN / 2 - ROLLUP_WIDTH / 2,
  width: ROLLUP_WIDTH,
}

export const GARAGE_SIDE_DOOR: Opening = {
  at: 9.6,
  width: SIDE_DOOR_WIDTH,
  // Head at two tiles — a door's height, with a storey of wall standing on it.
  head: 2,
}

/**
 * Four runs on one outer rectangle, so the corners meet without any call site
 * doing thickness arithmetic.
 *
 * `at` is the **outer** face on every edge (§7.8.0b), so the interior comes out
 * exactly `0 .. GARAGE_SPAN` and the walls stand on the slab's edge growing
 * inward — which is what a building does, and what lets `insideShell` and
 * `wallSegments` agree about where the room stops.
 */
export const GARAGE_OUTER_LO = -WALL_THICK
export const GARAGE_OUTER_HI = GARAGE_SPAN + WALL_THICK

export const GARAGE_SHELL: readonly WallRun[] = garageShellRuns(
  GARAGE_OUTER_LO,
  GARAGE_OUTER_LO,
  GARAGE_OUTER_HI,
  GARAGE_OUTER_HI,
)

/**
 * The shell of a garage of any size — the room builds this from its own
 * current extent so the walls push outward as the pods fill (§7.8.1's "a room
 * sized for twenty is not available to a studio of two"), and `GARAGE_SHELL`
 * above is the same function asked for the full one.
 *
 * The doors scale with the room rather than staying at their canonical widths.
 * A 3.4-tile roll-up door in a five-tile garage is not a door, it is a missing
 * wall, and the two-developer frame is one of the acceptance captures.
 */
export function garageShellRuns(
  minGx: number,
  minGy: number,
  maxGx: number,
  maxGy: number,
): WallRun[] {
  const spanGx = maxGx - minGx
  const spanGy = maxGy - minGy
  const rollWidth = Math.min(ROLLUP_WIDTH, spanGx * 0.34)
  const doorWidth = Math.min(SIDE_DOOR_WIDTH, spanGy * 0.16)
  return [
    {
      edge: 'far-left',
      at: minGx,
      from: minGy,
      to: maxGy,
      // Toward the far end of the wall, past the leadership corner — the
      // tradesman's door, not the one anybody arrives through.
      openings: [{ at: minGy + spanGy * 0.68, width: doorWidth, head: 2 }],
    },
    { edge: 'far-right', at: minGy, from: minGx, to: maxGx },
    {
      edge: 'near-left',
      at: maxGy,
      from: minGx,
      to: maxGx,
      // Centred, and with **no lintel**: this wall is barely taller than the
      // door, so a band of wall above it would be a lie about the building.
      openings: [{ at: minGx + spanGx / 2 - rollWidth / 2, width: rollWidth }],
    },
    { edge: 'near-right', at: maxGx, from: minGy, to: maxGy },
  ]
}

/**
 * **The route**, as the points a walker has to be able to reach in order.
 *
 * From the roll-up door, up the middle of the floor past the pods, to the
 * leadership corner. The prompt asks for "a clear route from the entrance
 * through the five pods to the leadership corner"; this is that route written
 * down so it can be tested rather than eyeballed, and the test asserts that no
 * pod, prop or plot sits on any leg of it.
 *
 * It is deliberately a *spine* and not a corridor between every pair of pods.
 * The concept's floor has one big open middle with the pods arranged around it,
 * which is both what a garage looks like and what makes twenty people tappable:
 * every pod is one step off the spine.
 */
export const GARAGE_ROUTE: ReadonlyArray<{ gx: number; gy: number }> = [
  // On the threshold of the roll-up door — a `gx` in the opening, at the near
  // wall's `gy`.
  { gx: GARAGE_SPAN / 2, gy: GARAGE_SPAN - 1.0 },
  // In, and across to the lane between the left-hand pod and the middle one.
  { gx: 5.4, gy: 12.6 },
  // Straight up that lane, the length of the room.
  { gx: 5.4, gy: 5.0 },
  // And in past the end of the glass.
  { gx: 3.0, gy: 4.0 },
]

/** Is a point inside a plot? Corner-anchored, half-open, so plots may abut. */
export function inPlot(p: Plot, gx: number, gy: number): boolean {
  return gx >= p.gx0 && gx < p.gx1 && gy >= p.gy0 && gy < p.gy1
}

/** The footprint a pod occupies on the floor, chairs included. */
export function podPlot(pod: Pod): Plot {
  return {
    name: pod.name,
    gx0: pod.gx - POD_HALF_GX,
    gy0: pod.gy - POD_HALF_GY,
    gx1: pod.gx + POD_HALF_GX,
    gy1: pod.gy + POD_HALF_GY,
  }
}

/** Do two plots overlap at all? */
export function plotsOverlap(a: Plot, b: Plot): boolean {
  return a.gx0 < b.gx1 && b.gx0 < a.gx1 && a.gy0 < b.gy1 && b.gy0 < a.gy1
}

/**
 * The garage is full at {@link GARAGE_CAP}, and this is the assertion that the
 * furniture agrees with the scale model rather than merely happening to.
 */
export const GARAGE_FULL_AT = GARAGE_CAP

/**
 * How far the occupied part of the garage reaches, in tiles.
 *
 * The shell is sized from this rather than from {@link GARAGE_SPAN}, because
 * §7.8.1's first rule about this room is that **a room sized for twenty is not
 * available to a studio of two**. One pod's worth of people gets one pod's
 * worth of garage; the walls push out as the pods fill, and reach the full span
 * at twenty. That is the same curve `roomMargin` already draws, now measured
 * against furniture that exists instead of against a lattice.
 *
 * Includes the props, so the workbench never ends up outside the wall it is
 * bolted to — but only the props on the side the pods have already reached,
 * which is what keeps a two-person garage from being drawn full width.
 */
export function garageExtentFor(ordinary: number): { maxGx: number; maxGy: number } {
  const n = Math.max(0, Math.min(GARAGE_SEATS, Math.floor(ordinary)))
  if (n === 0) return { maxGx: POD_HALF_GX * 2, maxGy: POD_HALF_GY * 2 }
  let maxGx = 0
  let maxGy = 0
  for (let i = 0; i < n; i++) {
    const pod = GARAGE_PODS[Math.floor(i / POD_SEATS)]
    maxGx = Math.max(maxGx, pod.gx + POD_HALF_GX)
    maxGy = Math.max(maxGy, pod.gy + POD_HALF_GY)
  }
  return { maxGx, maxGy }
}

/**
 * The lines a walker may use, in tiles — §7.8.6's lattice for this room.
 *
 * Derived from the pods rather than from the office plan's aisles, and that is
 * not a refinement but a correctness fix: `planLattice` answers for a
 * hundred-seat floor whose banks are nowhere near where the garage's pods
 * stand, so a walker routed on it would cross three tables on the way to the
 * kettle.
 *
 * One line either side of every pod on each axis. It over-supplies — some of
 * those lines are the same line to within a few pixels — and that is the right
 * error to make: a missing lane strands a walker, a duplicate lane costs
 * nothing.
 */
export function garageLaneLines(ordinary: number): { aisles: number[]; hallways: number[] } {
  const n = Math.max(0, Math.min(GARAGE_SEATS, Math.floor(ordinary)))
  const pods = GARAGE_PODS.slice(0, n === 0 ? 0 : Math.floor((n - 1) / POD_SEATS) + 1)
  const clearGx = POD_HALF_GX + 0.35
  const clearGy = POD_HALF_GY + 0.35
  const aisles = new Set<number>()
  const hallways = new Set<number>()
  for (const pod of pods) {
    aisles.add(pod.gx - clearGx)
    aisles.add(pod.gx + clearGx)
    hallways.add(pod.gy - clearGy)
    hallways.add(pod.gy + clearGy)
  }
  // The route's own legs, so the door-to-corner spine is always walkable even
  // at headcounts where the pods it runs between do not exist yet.
  for (const p of GARAGE_ROUTE) {
    aisles.add(p.gx)
    hallways.add(p.gy)
  }
  return {
    aisles: [...aisles].sort((a, b) => a - b),
    hallways: [...hallways].sort((a, b) => a - b),
  }
}
