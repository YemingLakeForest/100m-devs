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
import {
  PARTITION_THICK,
  WALL_FULL,
  WALL_NEAR,
  WALL_THICK,
  type Opening,
  type WallRun,
} from './shell.ts'

/**
 * How deep and wide the garage's interior is, in tiles.
 *
 * **Sixteen, and it was fourteen.** [2026-09-02] Not because the building grew
 * but because {@link WALL_CLEAR} could not be honoured at fourteen: the corner
 * takes 5.2 by 8.6 of it, the props take a tile off three walls, and what was
 * left could not hold five pods *and* a lane behind them. The pods were pushed
 * against the block instead, which is the one thing the canonical concept never
 * does — every desk there stands in open floor, with walking room behind the
 * chairs on every side.
 *
 * Sixteen is the smallest span at which that is true with these five pods, this
 * corner and these props, which is the whole argument for the number.
 */
export const GARAGE_SPAN = 16

/**
 * **How much clear floor stands between a pod and any wall**, in tiles.
 *
 * The lane behind the chairs. A pod's plot already includes the chairs pulled
 * out (see {@link POD_HALF_GY}), so this is walking room beyond them, and 1.5
 * tiles is a person and their elbows — which is what the concept draws, and why
 * its floor reads as a room with furniture in it rather than as furniture with
 * a wall drawn round it.
 *
 * It is a *constant with a test*, not a habit: `garage.test.ts` measures every
 * pod against every wall's inner face. Wall clearance is exactly the class of
 * detail that survives as an intention in a comment while the numbers drift,
 * which is how four of the five pods came to be within a tile of the block
 * without any check noticing.
 */
export const WALL_CLEAR = 1.5

/**
 * §7.8.0c [added 2026-09-02] — **the garage's value scheme, as ramp indices.**
 *
 * Three of the five garage iterations before this one were value problems that
 * arrived disguised as size problems, and each was fixed by looking at a
 * screenshot and moving a number one step. That method produced a picture whose
 * light ran *backwards*: the near walls were the brightest surface in the frame
 * and the floor was nearly the darkest.
 *
 * This table is the method that replaced it. Sample the canonical concept, map
 * the samples onto `RAMPS.NEUTRAL`, and write the ordering down where a test can
 * hold it. What came back, in the concept's own pixels:
 *
 * | surface                 | concept RGB | nearest ramp |
 * |-------------------------|-------------|--------------|
 * | far wall, inner face    | 82,71,63    | `[3]`        |
 * | floor, away from a lamp | 55,35,28    | `[2]`        |
 * | near wall, outer face   | 36,31,40    | `[1]`        |
 * | carriageway             | 12,11,16    | `[0]`        |
 *
 * Four surfaces, four steps, in that order — and the order is the whole point.
 * A lit room at night is *brighter inside than out*, and the near walls are the
 * one large thing standing in the dark between the camera and the light. When
 * they are the palest object in the picture the building reads as a daylit model
 * of a garage rather than as a garage with the lights on.
 *
 * The render had the same four surfaces at `[4]`, `[1]`, `[4]` and `[3]`.
 *
 * Only the copings sit off the ramp's ordering, and legitimately: they are the
 * one plane facing straight up into §7's key, so they are lighter than the faces
 * below them on both walls.
 */
export const GARAGE_VALUES = {
  /** Full height, behind everything — the lightest large surface in the room. */
  farWall: { top: 4, left: 3, right: 2 },
  /**
   * Cut down, in front of everything, outdoors.
   *
   * **The coping came down from `[3]` to `[2]` on the second pass**, and the
   * reason is worth keeping because it contradicts §7 on its face: the
   * concept's outdoor coping measures *darker* than the wall face below it —
   * 28 against 32. §7's key comes from above, and at night, outdoors, there is
   * nothing above. A horizontal surface out there sees the sky; the vertical
   * one facing the street sees the street lamp. So the rule "the top plane is
   * the brightest" is an **interior** rule, and the near walls are not
   * interior.
   *
   * It ended at **no lift at all**, which took two passes to accept. At `[2]`
   * over faces at `[1]` the coping was still the palest band on the frontage,
   * and because `WALL_THICK` is 0.63 tiles it is a *wide* band — so the wall
   * read as a lit ledge with a dark skirt under it. Flat is what the concept
   * measures and flat is what a block wall at night looks like: the thing that
   * draws its edge is the courses and the shadow of the coping's far side, not
   * a change of value. The `right` face goes a step **below** the others, which
   * is the one shading a night street actually has.
   */
  nearWall: { top: 1, left: 1, right: 0 },
  /**
   * The roll-up door, its guide piers, and the corrugation on its face.
   *
   * The shutter was `[6]`/`[5]`/`[3]` — brighter than anything else in the
   * lower half of the picture, on the argument that a dark panel in a dark
   * reveal disappears. That argument was made against a wall at `[4]` and a
   * floor at `[0]`, and both have moved since; inherited unchanged, it left the
   * building with a headlamp for a front door.
   *
   * The concept measures the shutter at `[1]`–`[2]` — **the same value as the
   * wall it sits in.** What makes it read there is not tone at all. It is the
   * corrugation, the sign painted across it, and two piers that are *lighter*
   * than both. So the panel joins the wall, the slats go to the bottom of the
   * ramp, and the piers take the lift the panel used to have.
   */
  gate: { panel: 2, pier: 4, slat: 0 },
  /**
   * The four corner piers.
   *
   * Same values as the gate's guide piers, and deliberately so: **the building
   * has piers, and the gate's are two of them.** One tone for every upright on
   * the shell is what makes them read as structure rather than as five
   * unrelated grey boxes.
   */
  column: { top: 4, left: 3, right: 2 },
  /** Poured concrete: the base pour and the lighter bays polished over it. */
  floor: { base: 1, bays: 2 },
  /**
   * The ground outside, from the wall to the middle of the road. `district.ts`
   * draws it (§7.8.1e — the ground is drawn once), but the *ordering* is this
   * room's business, because this is the room the concept is of.
   *
   * The forecourt is the garage's own apron rather than the district's, and it
   * was the one piece of ground still written as a literal — `NEUTRAL[3]`,
   * chosen when the floor inside was `[0]`, which by this pass made the
   * driveway the brightest ground in the frame.
   */
  street: { forecourt: 2, kerb: 2, footway: 1, carriageway: 0 },
} as const

/**
 * **How far a prop has to stand back from a near wall to be seen at all.**
 *
 * Not taste — arithmetic on the projection. A near wall is cut down to
 * {@link WALL_NEAR} and stands *between the camera and the room*, and one tile
 * of floor moves a point 16 px down the screen while one tile of height moves
 * it 32 up. So an object of height `h` clears the wall's near top edge only
 * once it is `(WALL_NEAR - h) * 2` tiles back from it — nearly four tiles for
 * something lying on the floor.
 *
 * 1.6 is where that lands for a prop about a person tall, which is the height
 * the shelves, the fridge and the boxes actually are: they clear completely,
 * and the sofa and the tea table show their tops. It is a compromise and worth
 * naming as one — the honest number for a *floor-level* object is 3.9 tiles,
 * and a sixteen-tile room whose corner already takes 5.2 by 8.6 does not have
 * that to give on two walls at once.
 *
 * What it replaces is nothing at all, and the cost of nothing at all was a
 * sofa, a fridge, a kettle and a stack of crates drawn every frame behind a
 * wall — authored, overlap-tested, clearance-tested, and invisible.
 */
export const NEAR_CLEAR = 1.6

/**
 * The same lane, but off the leadership glass.
 *
 * Smaller than {@link WALL_CLEAR} on purpose: the glass is a partition inside
 * one room rather than the edge of the building, and the concept crowds it a
 * little — the pod in front of the corner is close enough that the founder can
 * see what is on its screens, which is the point of putting it there.
 */
export const GLASS_CLEAR = 1.0

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
/**
 * How deep a facing pod's table is, in tiles.
 *
 * {@link POD_REACH} puts the two rows of seats 1.6 tiles apart, and the table
 * has to nearly fill that gap or the people sit a hand's width back from their
 * own desk with bare floor showing between. It was two desk depths — 0.92 —
 * which left a third of the gap empty on each side.
 */
export const POD_TABLE_DEPTH = 1.45

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
  //
  // All four of the pods east of the corner shifted right on 2026-09-02 when
  // the corner widened to 6.6. `GLASS_CLEAR` and `WALL_CLEAR` between them fix
  // the band they may occupy — gx 9.1 to 13.0 for a pod centre — and there is
  // exactly enough of it for two abreast. That is the cost of an uncrowded
  // corner, stated where it is paid.
  { id: 0, name: 'THE BENCH', gx: 9.3, gy: 3.2 },
  // Under the tool board, deepest into the workshop end — a lane off it rather
  // than shoved against it, so the board is something you can stand at.
  { id: 1, name: 'THE TOOL WALL', gx: 12.5, gy: 3.0 },
  // Past the foot of the corner, in the open end of the room. It used to run
  // along the left wall; it is 2.7 tiles off it now, which is the widest lane
  // in the garage and the one the route from the gate comes up.
  { id: 2, name: 'THE LONG TABLE', gx: 4.2, gy: 12.0 },
  // The middle of the room, and the pod the route from the door runs past.
  { id: 3, name: 'THE MIDDLE', gx: 9.5, gy: 7.4 },
  // Front right, by the sofa and the fridge. The last pod to fill.
  { id: 4, name: 'THE SOFA END', gx: 12.9, gy: 8.4 },
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
  // 6.6, and it was 5.2 [2026-09-02]. `SUITE_PITCH_COLS` went back to 1.8
  // because at 1.4 the leadership desks were closer together than the rank and
  // file's, and the width has to follow: the drawn suite reaches plan 6.41 at
  // seven plots, so the reservation is that plus a hand's breadth.
  gx1: 6.6,
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
  // --- the far-right wall (gy 0): workshop first, then the sitting-down end -
  //
  // Everything stops at `GARAGE_SPAN - NEAR_CLEAR`. The sofa ran to the corner
  // once and the near-right wall stood in front of its last third, which is
  // the whole reason that constant exists.
  { name: 'THE SHELVES', gx0: 6.7, gy0: 0, gx1: 8.8, gy1: 0.55 },
  { name: 'THE TOOL BOARD', gx0: 9.0, gy0: 0, gx1: 10.9, gy1: 0.55 },
  { name: 'THE WORKBENCH', gx0: 9.0, gy0: 0.55, gx1: 10.9, gy1: 1.0 },
  { name: 'THE BIKE', gx0: 11.1, gy0: 0, gx1: 12.2, gy1: 0.9 },
  // The sofa runs along the wall the camera looks *at*, which is the only one
  // a soft furnishing is worth drawing against — and is where the canonical
  // concept puts it.
  { name: 'THE SOFA', gx0: 12.4, gy0: 0, gx1: GARAGE_SPAN - NEAR_CLEAR, gy1: 1.1 },
  // --- the far-left wall (gx 0), past the corner ---------------------------
  { name: 'THE BOXES', gx0: 0, gy0: 8.9, gx1: 1.1, gy1: 11.0 },
  { name: 'THE KETTLE', gx0: 0, gy0: 11.3, gx1: 1.1, gy1: 12.3 },
  { name: 'THE FRIDGE', gx0: 0, gy0: 12.6, gx1: 1.1, gy1: 13.8 },
  // Second rank, standing in front of the first — the workbench's arrangement,
  // one wall over. A garage stacks things two deep against a wall; what it
  // never does is put them where you cannot see them.
  { name: 'THE CRATES', gx0: 1.1, gy0: 9.2, gx1: 2.1, gy1: 10.5 },
  { name: 'THE BIN', gx0: 1.1, gy0: 12.4, gx1: 2.2, gy1: 13.6 },
  /*
   * **The rest of the second rank.** [2026-09-02]
   *
   * Ten props against sixteen tiles of wall left the perimeter reading as a
   * shelf, a board and a sofa with gaps between them. The canonical concept has
   * something like twenty-five objects round its edge, and the density is not
   * decoration: a wall with one object against it is a wall with an object
   * against it, and a wall with five is a *workshop*. The middle of the floor
   * stays empty either way — that is §7.8.0c's circulation and it is untouched.
   *
   * All five sit in the 0.55-tile band in front of the first rank, which is the
   * gap between the props on the wall and the nearest pod's chairs. Nothing
   * moved to make room for them; the band was already there and empty.
   */
  { name: 'THE PLANT', gx0: 6.7, gy0: 0.55, gx1: 7.4, gy1: 1.15 },
  { name: 'THE TOOL CHEST', gx0: 9.0, gy0: 1.0, gx1: 10.2, gy1: 1.55 },
  { name: 'THE TYRES', gx0: 11.1, gy0: 0.9, gx1: 12.1, gy1: 1.5 },
  { name: 'THE STOOL', gx0: 12.5, gy0: 1.1, gx1: 13.2, gy1: 1.55 },
  { name: 'THE PALLET', gx0: 2.1, gy0: 9.4, gx1: 3.0, gy1: 10.3 },
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
/**
 * **How wide the roll-up door is** — 4.8 tiles, and it was 3.4.
 *
 * Measured off the concept rather than guessed the second time: the gate there
 * is about three times the side door's width and takes a clear third of the
 * street wall. At 3.4 it read as a hatch. A garage door is the width of a car
 * plus the room to get it wrong, and that is the size it has to look.
 */
export const ROLLUP_WIDTH = 4.8
export const SIDE_DOOR_WIDTH = 1.1
/**
 * How high the side door's opening reaches, in tiles.
 *
 * Two thirds of the street wall, so there is a real band of block above it. A
 * door the full height of the wall it is in is a gap, not a door.
 */
export const SIDE_DOOR_HEAD = WALL_NEAR * 0.66

/**
 * The roll-up door — an opening in the **near-left** wall.
 *
 * That wall runs along `gx` at the maximum `gy`, so `at` is a `gx` and not a
 * `gy`. Worth stating, because the two are interchangeable as numbers and the
 * mistake puts the door in the wrong wall while every test that checks a width
 * still passes.
 */
/*
 * The two doors are **read back out of the shell**, not written down a second
 * time. [2026-09-02]
 *
 * They were literals — `GARAGE_SPAN / 2 - ROLLUP_WIDTH / 2` for one and a bare
 * `9.6` for the other — while `garageShellRuns` computed both from the wall's
 * own span at 0.62 along it. The two agreed only by arithmetic accident, and
 * the accident held: every test that asked where the gate is was asking the
 * copy, so none of them could have caught the gate moving. That is the same
 * two-tables-one-floor defect §7.8.0c keeps producing, so the copy is gone and
 * these are views on the one table.
 *
 * Declared after {@link GARAGE_SHELL} for that reason, which is also why the
 * non-null assertions are honest: `garageShellRuns` always cuts both.
 */

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

/** The vehicle door, as cut. */
export const GARAGE_ROLLUP: Opening = rollUpIn(GARAGE_SHELL)!
/** The personnel door beside it — the opening that stops short of the head. */
export const GARAGE_SIDE_DOOR: Opening = GARAGE_SHELL.find(
  (r) => r.edge === 'near-left',
)!.openings!.find((o) => o.head !== undefined)!

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
  const rollWidth = Math.min(ROLLUP_WIDTH, spanGx * 0.44)
  const doorWidth = Math.min(SIDE_DOOR_WIDTH, spanGy * 0.16)
  /*
   * **The gate sits along the wall at 0.62, not at its midpoint.** [2026-09-02]
   *
   * Centred is where a garage door goes if you are drawing a garage in
   * isolation. It is the wrong place here for a reason that has nothing to do
   * with the building: at this camera the middle of the street wall lands under
   * the HUD's left column, so the one object in the room the player most needs
   * to see was behind `INCIDENT` and `HIRE SUPPORT`.
   *
   * The concept puts its gate right of centre on that frontage with the car and
   * the side door to its left, which is both a better composition and — since
   * the HUD is fixed furniture the world has to live with — the only position
   * where the gate is actually shown. §7.1's pane-of-glass rule cuts both ways:
   * the interface does not move for the world, so the world moves for it.
   */
  const rollAt = minGx + spanGx * 0.62 - rollWidth / 2
  return [
    { edge: 'far-left', at: minGx, from: minGy, to: maxGy },
    { edge: 'far-right', at: minGy, from: minGx, to: maxGx },
    {
      edge: 'near-left',
      at: maxGy,
      from: minGx,
      to: maxGx,
      /*
       * **Both doors are in the street wall** [2026-09-02].
       *
       * The side door was in the far-left wall, which is the one you cannot
       * reach from the road — a tradesman's door onto next door's yard. The
       * canonical concept puts it exactly where a garage really has it: in the
       * same street frontage as the roll-up, a stride to its left, with a step
       * and a bin beside it. That is also the only arrangement in which the two
       * doors are *about* anything — the big one is how the van gets in and the
       * small one is how people do.
       *
       * The roll-up gets no lintel: the wall is the height of the door. The
       * side door gets one, because a person-sized door in a wall a storey tall
       * leaves a band of block above it, and that band is what makes it read as
       * cut through something rather than painted on.
       */
      openings: [
        { at: rollAt - doorWidth - 1.5, width: doorWidth, head: SIDE_DOOR_HEAD },
        { at: rollAt, width: rollWidth },
      ],
    },
    { edge: 'near-right', at: maxGx, from: minGy, to: maxGy },
  ]
}

/**
 * How thick a corner pier is, in tiles — a wall and a half.
 *
 * It has to be thicker than the wall or it is not a pier, and it has to stand
 * proud on both faces or it cannot do its job, which is **covering the mitre**.
 * Two walls meeting at a corner in this projection produce a join that is only
 * correct if both runs stop at exactly the right coordinate, and getting it
 * wrong is invisible in the numbers and obvious in the picture. A pier makes
 * the question moot: the corner is an object rather than an agreement.
 */
export const COLUMN_THICK = WALL_THICK * 1.5

export interface Column {
  readonly name: string
  /** Corner-anchored, in the shell box's own coordinates. */
  readonly gx: number
  readonly gy: number
  readonly size: number
  readonly height: number
}

/**
 * §7.8.0b [added 2026-09-02] — **a pier on every corner of the shell.**
 *
 * Each one is as tall as **the taller of the two walls it joins**, which is the
 * whole rule. Three corners have at least one full-height wall on them and get
 * a full-height pier; the near vertex has two cut-down walls and gets a cut-down
 * pier, because a storey-tall column standing at the near vertex would be a post
 * planted between the camera and the room.
 *
 * `at` is the outer face on every edge (§7.8.0b), so a low edge's wall occupies
 * `[c, c + WALL_THICK]` and a high edge's `[c - WALL_THICK, c]`. The pier is
 * centred on that band and stands proud by the same amount on both sides.
 */
export function garageColumns(
  minGx: number,
  minGy: number,
  maxGx: number,
  maxGy: number,
): Column[] {
  const proud = (COLUMN_THICK - WALL_THICK) / 2
  const lo = (c: number) => c - proud
  const hi = (c: number) => c - WALL_THICK - proud
  return [
    // The far vertex: two full-height walls.
    { name: 'far', gx: lo(minGx), gy: lo(minGy), size: COLUMN_THICK, height: WALL_FULL },
    // The two side vertices: one full wall, one cut down. The full one wins.
    { name: 'left', gx: lo(minGx), gy: hi(maxGy), size: COLUMN_THICK, height: WALL_FULL },
    { name: 'right', gx: hi(maxGx), gy: lo(minGy), size: COLUMN_THICK, height: WALL_FULL },
    // The near vertex: two cut-down walls, and the one place a tall pier would
    // stand in the picture instead of in the building.
    { name: 'near', gx: hi(maxGx), gy: hi(maxGy), size: COLUMN_THICK, height: WALL_NEAR },
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
  // wall's `gy`. The gate sits at 0.62 along the frontage rather than at its
  // midpoint (see {@link garageShellRuns}), so the route reads the same
  // fraction instead of keeping its own idea of where the way in is.
  { gx: GARAGE_SPAN * 0.62, gy: GARAGE_SPAN - 1.0 },
  // In, and across to the lane between the left-hand pod and the middle one.
  { gx: 7.4, gy: GARAGE_SPAN - 1.6 },
  // Straight up that lane, the length of the room. It shifted right with the
  // corner: the lane is between THE LONG TABLE and the four pods east of it,
  // and both walls of it moved.
  { gx: 7.4, gy: 7.6 },
  // And in through the corner's mouth. `GLASS_MOUTH` is 6.6, so this leg
  // crosses the glass line at 7.6 — round the end of the partition, not
  // through it, which is what the old route at 4.0 did.
  { gx: 3.0, gy: 7.6 },
]

/**
 * **The vehicle door in a shell's street wall** — the opening with no lintel.
 *
 * Both doors are in the same run (§7.8.0c), and `openings[0]` is the side door
 * because the array is written left to right along the wall. Reading index zero
 * is what put the shutter, the forecourt, the car and the street lamp all at
 * the *personnel* door and left the roll-up opening as a four-tile hole in the
 * front of the building — which is what a hole in a wall looks like, because
 * that is what it was.
 *
 * The discriminator is not an index and not a width: it is that **the vehicle
 * door reaches the head of the wall and the personnel door does not**. That is
 * the same fact §7.8.0b uses to decide which opening gets a lintel, so there is
 * one property doing both jobs rather than two that can disagree.
 */
export function rollUpIn(runs: readonly WallRun[]): Opening | undefined {
  const street = runs.find((run) => run.edge === 'near-left')
  return street?.openings?.find((opening) => opening.head === undefined)
}

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
