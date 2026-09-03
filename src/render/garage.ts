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
  /**
   * Full height, behind everything — the lightest large surface in the room,
   * and **warm**, because it is inside.
   *
   * The floor's wash (see `floor.warmth`) put the two halves of the room's
   * biggest surfaces on opposite sides of the hue axis: a brown floor under a
   * lavender wall, which reads as a room built on somebody else's ground. The
   * concept's far wall measures 82,71,63 — warm grey, and lighter than its
   * floor, which is why it is the surface the room sits in front of.
   *
   * Solved rather than tuned, the same way: `WARN[0]` over `NEUTRAL[4]` at 0.51
   * lands on (80,65,63) against (82,71,63). The indices go up a step to pay for
   * the wash, which darkens as it warms — a wall washed at its old values came
   * out darker than the floor and the room lost its back.
   */
  farWall: { top: 5, left: 4, right: 3, warmth: 0.51 },
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
  /**
   * Poured concrete: the base pour, the lighter bays polished over it, and the
   * **warmth** laid over both.
   *
   * `warmth` is the one entry in this table that is not a ramp index, and it is
   * here because the value scheme could not see the defect it fixes. Every
   * surface in this room separated from every other by *lightness alone*, on a
   * ramp that is uniformly cool — and the concept does not work that way. Its
   * cool surfaces match `NEUTRAL` almost exactly (near wall 36,31,40 against
   * `[1]`'s 36,31,46; road 12,11,16 against `[0]`'s 20,18,26) and its **warm**
   * ones are nowhere on the ramp at all: the floor measures 55,35,28, whose
   * blue channel is less than half what any `NEUTRAL` step of that lightness
   * carries.
   *
   * That split is what a lit room at night is: the light inside is a filament
   * and the light outside is a sodium lamp two hundred feet away. A room whose
   * floor is the same hue as its road cannot say that, however the values are
   * ordered — which is why five iterations of ordering values did not fix it.
   *
   * So the floor gets a wash of `WARN[0]`, the warmest dark the palette has,
   * and the fraction is solved rather than tuned. Over `NEUTRAL[2]` (58,50,68)
   * at 0.66 it lands on (50,37,28) against the concept's (55,35,28) — within
   * five on every channel, and the blue, which is the channel that was wrong,
   * is exact. It is an alpha fill and not a new colour: the same mechanism the
   * pod lamps already use, so the 37-colour master palette is untouched.
   */
  floor: { base: 1, bays: 2, warmth: 0.66 },
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
  /**
   * §7.8.0c [added 2026-09-03] — **which floor axis the table lies on.**
   *
   * The pod owns its orientation and everything else reads it: `garageSeat`
   * derives both the seat coordinates and the {@link Facing}, `podPlot`
   * transposes the footprint, and the room draws the table, the screen plane,
   * the body pose, the hit target and the depth layer from the same value.
   *
   * That single ownership is the requirement, not the variety it produces. A
   * pod drawn one way and seated another is the defect §7.8.0b was written
   * after — a workstation whose screen was mirrored in screen space while its
   * plane stayed put — and four unrelated draw functions is the same mistake
   * with more places to make it.
   *
   * `'gy'` is the table running down-left, which puts its two rows of seats
   * either side on `gx` and therefore facing `gx+`/`gx-`. `'gx'` is the table
   * running down-right, seats either side on `gy`, facing `gy+`/`gy-`.
   */
  readonly axis: 'gx' | 'gy'
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
  /*
   * [2026-09-03] **Re-laid against v6, and the arrangement is two bands.**
   *
   * The previous five sat in a loose diagonal with four of them packed into the
   * room's right third and the whole left-centre of the floor empty — a
   * quincunx by the letter of the staggering test and a clump in the picture.
   * The concept's reads as a composition: a back band a couple of tiles off the
   * workshop wall, a front band with the open middle of the floor between them,
   * and no two tables closer than a table's width. That is what makes twenty
   * people read as five teams with room to grow rather than as one crowd.
   *
   * The band positions are the concept's own, converted into plan tiles and
   * then pulled inside the clearance rules rather than copied as pixels — its
   * rightmost table stands about a tile off the near-right block, which
   * WALL_CLEAR does not allow and which is a lane a person has to walk.
   */
  // Straight out in front of the leadership glass — the pod the founder can see
  // from their desk, which is why it is the one James lands in.
  // gy 4.0, not 3.3: `WALL_CLEAR` is measured off the *block*, and the first
  // 1.55 tiles of that wall are the workshop run — so a pod that clears the
  // wall by a lane can still be a hand's width from the tool chest, which is
  // what it was. The band moves back until there is somewhere to stand at the
  // bench.
  { id: 0, name: 'THE BENCH', gx: 8.0, gy: 4.0, axis: 'gy' },
  /*
   * Under the tool board, deepest into the workshop end — a lane off it rather
   * than shoved against it, so the board is something you can stand at.
   *
   * **The first of the two tables laid on `gx`**, and it is here rather than
   * anywhere else because this is the pod with the most room behind it: its
   * `gy-` row looks back up the room toward the workshop wall, where there is
   * nothing to occlude and a lit surface to be seen against.
   */
  { id: 1, name: 'THE TOOL WALL', gx: 11.8, gy: 4.3, axis: 'gx' },
  // Past the foot of the corner, in the open end of the room. It is the pod the
  // route from the gate comes up beside, and the one furthest from everything.
  { id: 2, name: 'THE LONG TABLE', gx: 5.4, gy: 10.6, axis: 'gy' },
  // The middle of the room, between the two bands, and the pod the spine runs
  // past on its way to the corner.
  { id: 3, name: 'THE MIDDLE', gx: 9.2, gy: 7.6, axis: 'gy' },
  /*
   * Front right, by the sofa. The last pod to fill, and the second `gx` table.
   *
   * Two of five rather than one: a single turned pod reads as a mistake, and
   * three would make the arrangement a chequerboard. Two put a `gy+`/`gy-` pair
   * in each half of the frame, which is what "easy to see in the canonical
   * camera" means when the camera is fixed.
   */
  { id: 4, name: 'THE SOFA END', gx: 12.4, gy: 10.4, axis: 'gx' },
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
  /*
   * §7.8.0c [2026-09-03] — **the seat is the pod's axis, resolved.**
   *
   * `across` is the offset from the table centre out to a row, on the axis the
   * table does *not* lie on; `step` is the place down the table. One expression
   * covering both axes rather than two branches, because what is being asserted
   * is that a seat's coordinates and its facing come out of the same value — a
   * second branch is a second chance for them to disagree, which is the shape
   * of every defect §7.8.0b records.
   */
  const across = far ? -POD_REACH : POD_REACH
  const step = along * POD_STRIDE
  const onGy = pod.axis === 'gy'
  return {
    index: i,
    pod: pod.id,
    inPod,
    gx: pod.gx + (onGy ? across : step),
    gy: pod.gy + (onGy ? step : across),
    facing: onGy ? (far ? 'gx+' : 'gx-') : far ? 'gy+' : 'gy-',
  }
}

/**
 * Does this facing point **toward the camera** — down-right or down-left?
 *
 * The one question the renderer asks of a `Facing` that is not a coordinate:
 * which of the two rows across a table is the one whose screen you can see,
 * whose face is drawn front-on and whose monitor is mounted low. It was
 * `facing === 'gx+'` written out at three call sites while there were only two
 * facings, and it would have been silently wrong at all three the moment a
 * table lay on `gx`.
 */
export function facesCamera(f: Facing): boolean {
  return f === 'gx+' || f === 'gy+'
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
  /*
   * [2026-09-03] **The reservation is the room as drawn plus a hand's breadth,
   * and it was two tiles too deep on the axis that costs the most.**
   *
   * §7.8.12's suite is measured in the floor's `col`/`row`, and `garagePlot`
   * maps `col` onto `gy` and `row` onto `gx`. The seven-plot suite reaches
   * `col` 3.04 and `row` -0.9, which is plan **gy 6.41 by gx 4.41** — a room
   * longer along the back-left wall than it is deep, which is what the concept
   * draws. The reservation had it at gx 6.6 by gy 8.6: about right in area,
   * wrong in shape.
   *
   * The cost was paid in pods. {@link GLASS_CLEAR} is measured off `gx1`, so a
   * reservation 2.2 tiles deeper than the glass actually stands pushed every
   * pod sharing the corner's `gy` band out to gx 9.1 — which is why four of the
   * five ended up in the room's right third with the middle of the floor empty.
   * Naming the drawn extent gives the back band its left-hand table back.
   *
   * Still generous, and deliberately: `suiteEastCol` moves with the roster, so
   * this is the seven-plot extent rather than today's.
   */
  gx1: 5.1,
  gy1: 7.1,
}

/** The reclaimed glass that fences it off, as a run in the shell's language. */
/** Where the glass stops, leaving the corner's way in. */
export const GLASS_MOUTH = GARAGE_LEADERSHIP.gy1

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
/**
 * §7.8.0c [added 2026-09-03] — **the four zones the clutter belongs to.**
 *
 * A prop's zone is not decoration and it is not a comment: it is the rectangle
 * of perimeter the prop is allowed to be in, and it is what makes "the workshop
 * run" a *place* rather than a list of things that happen to be near each
 * other. The failure it exists to catch has already happened once — a plot
 * moved two tiles over three iterations, cleared every other plot at every
 * step, and ended up in the kitchenette.
 *
 * Every plot in {@link GARAGE_PROPS} lies wholly inside exactly one of these,
 * and the zones do not overlap. Both halves are asserted, because either one on
 * its own is satisfiable by a zone table that has quietly grown to cover the
 * whole room.
 */
export const GARAGE_ZONES: readonly Plot[] = [
  // The far-right wall, in the order a workshop is actually built along it.
  { name: 'THE WORKSHOP RUN', gx0: 5.4, gy0: 0, gx1: 11.2, gy1: 1.6 },
  // The same wall, past the run: where you sit down is past where you work.
  { name: 'THE LOUNGE', gx0: 11.2, gy0: 0, gx1: 13.7, gy1: 1.6 },
  // The far-left wall, clear of the leadership corner.
  { name: 'THE KITCHENETTE', gx0: 0, gy0: 7.4, gx1: 2.4, gy1: 11.5 },
  // And the one corner things are stacked in.
  { name: 'THE STORAGE CORNER', gx0: 0, gy0: 11.5, gx1: 3.2, gy1: 14.0 },
]

export const GARAGE_PROPS: readonly Plot[] = [
  /*
   * [re-zoned 2026-09-03] **Four named zones, and every plot belongs to one.**
   *
   * The table was one perimeter band with ten objects distributed round it, and
   * it produced the defect §7.8.0c warns about in its own opening line:
   * *deterministic is not the same as sensibly placed.* Every plot cleared
   * every other, every one touched a wall, every check passed — and the
   * far-left wall came out as a fridge, a bin, a two-metre stack of boxes, a
   * pallet and a crate tower in one continuous heap, which is not a
   * kitchenette. It is a fly-tip with a kettle in it.
   *
   * So the plots are grouped by what the zone is *for*, and the grouping is in
   * the table rather than in a comment above it:
   *
   * - **the workshop run**, on the far-right wall, in the order you would build
   *   it: shelves, board, bench, chest, bike, tyres;
   * - **the lounge**, on the same wall after the run — the place you sit down
   *   is past the place you work;
   * - **the kitchenette**, on the far-left wall clear of the leadership corner:
   *   a fridge, a table with a kettle on it, a bin near them and nothing else;
   * - **one storage corner**, at the far end of that same wall, holding the few
   *   things a garage genuinely stacks and nothing that belongs to a zone.
   *
   * They are still all against a far wall, for the reason {@link NEAR_CLEAR}
   * records: the near walls stand between the camera and the room, and a prop
   * behind one is a prop nobody drew.
   */
  // --- the workshop run: the far-right wall (gy 0), past the corner --------
  { name: 'THE SHELVES', gx0: 5.6, gy0: 0, gx1: 7.7, gy1: 0.55 },
  { name: 'THE PLANT', gx0: 5.6, gy0: 0.55, gx1: 6.3, gy1: 1.15 },
  { name: 'THE TOOL BOARD', gx0: 7.9, gy0: 0, gx1: 9.8, gy1: 0.55 },
  // Second rank, standing in front of the first — which is what a workshop
  // wall is, and why the anchoring test walks the chain back to masonry rather
  // than looking one step.
  { name: 'THE WORKBENCH', gx0: 7.9, gy0: 0.55, gx1: 9.8, gy1: 1.0 },
  { name: 'THE TOOL CHEST', gx0: 7.9, gy0: 1.0, gx1: 9.1, gy1: 1.55 },
  { name: 'THE BIKE', gx0: 10.0, gy0: 0, gx1: 11.1, gy1: 0.9 },
  { name: 'THE TYRES', gx0: 10.0, gy0: 0.9, gx1: 11.0, gy1: 1.5 },
  // --- the lounge: the same wall, after the run ----------------------------
  //
  // Everything stops at `GARAGE_SPAN - NEAR_CLEAR`. The sofa ran to the corner
  // once and the near-right wall stood in front of its last third, which is
  // the whole reason that constant exists.
  { name: 'THE SOFA', gx0: 11.3, gy0: 0, gx1: 13.5, gy1: 1.1 },
  { name: 'THE STOOL', gx0: 11.4, gy0: 1.1, gx1: 12.1, gy1: 1.55 },
  // --- the kitchenette: the far-left wall (gx 0), outside the corner -------
  { name: 'THE FRIDGE', gx0: 0, gy0: 7.6, gx1: 1.1, gy1: 8.8 },
  { name: 'THE KETTLE', gx0: 0, gy0: 9.0, gx1: 1.1, gy1: 10.0 },
  { name: 'THE BIN', gx0: 0, gy0: 10.2, gx1: 0.95, gy1: 11.3 },
  // --- the storage corner: the far end of that wall, and only this ---------
  { name: 'THE BOXES', gx0: 0, gy0: 11.7, gx1: 1.1, gy1: 13.8 },
  { name: 'THE CRATES', gx0: 1.1, gy0: 12.0, gx1: 2.1, gy1: 13.3 },
  { name: 'THE PALLET', gx0: 2.1, gy0: 12.2, gx1: 3.0, gy1: 13.1 },
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
/**
 * §7.8.0c — **what the sign over the gate says**, exactly.
 *
 * A constant rather than a literal at the draw site because it is *canon*: the
 * section fixes the wording, and a string typed into a renderer is a string
 * nothing can assert. `garage.test.ts` checks it character for character, which
 * is the only useful test of a piece of authored copy.
 */
export const GARAGE_SIGN = 'NO BUGS. JUST FEATURES'

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

/**
 * §7.8.0c [added 2026-09-03] — **how deep the clear apron behind the gate is**,
 * in tiles.
 *
 * Two character widths, which is the requirement stated in the unit that makes
 * it checkable: a developer's plot is about 1.2 tiles across, so 2.4 is two of
 * them standing one behind the other. It is not a margin round the door — it is
 * the piece of floor a vehicle occupies once it is through it, and an opening
 * the floor plan cannot use is scenery rather than an entrance.
 */
export const GATE_APRON_DEPTH = 2.4

/**
 * The floor behind the gate that nothing may stand on — the inside half of the
 * driveway, as a plot in the same table every other claim is checked against.
 *
 * Written as a `Plot` rather than as a rule inside a test so that "no desk,
 * person, prop, lamp or loose cable occupies the apron" is one containment
 * question asked of one rectangle, the way §7.8.0c asks every other clash
 * question. The *outside* half is the district's business and is an exclusion
 * span on the frontage kerb; the two are the same driveway seen from either
 * side of the wall.
 */
export const GARAGE_APRON: Plot = {
  name: 'THE APRON',
  gx0: GARAGE_ROLLUP.at,
  gy0: GARAGE_SPAN - GATE_APRON_DEPTH,
  gx1: GARAGE_ROLLUP.at + GARAGE_ROLLUP.width,
  gy1: GARAGE_SPAN,
}
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
      /*
       * [amended 2026-09-03] **The personnel door is on the gate's far side.**
       *
       * It was a stride to the *left* of the roll-up — lower `gx`, up-left on
       * screen — on the argument that the concept put it there. v6 does not:
       * its door is down-right of the shutter, past the near jamb pier, with
       * the timber threshold and the lamp between the two. That is also the
       * better arrangement for this camera, because the near vertex of the
       * building is the corner nearest the viewer and a door there is a door
       * you can see the whole of, where the up-left end of the frontage is the
       * part the wall foreshortens hardest.
       *
       * The array stays written left to right along the wall, so the door is
       * now `openings[1]`. Nothing reads it by index — `rollUpIn` asks which
       * opening reaches the head of the wall — which is the whole reason that
       * function exists and the reason this move costs one expression.
       */
      openings: [
        { at: rollAt, width: rollWidth },
        { at: rollAt + rollWidth + 1.5, width: doorWidth, head: SIDE_DOOR_HEAD },
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
/**
 * Where §7.8.12's suite doorway lands in the garage plan, in tiles.
 *
 * The suite's door is at floor plot column 0 and this plan's origin is
 * `GARAGE_COL0 = FLOOR_MIN_COL + WALL_THICK` columns west of that, so the
 * doorway is `-(-4 + 0.63) = 3.37` tiles along `gy`. Written out rather than
 * imported because `room.ts` owns both of those constants and already imports
 * this file; `room.test.ts` asserts that `garagePlot(0, SUITE_DOOR_GY)` lands
 * on column 0, which is the seam this number would otherwise drift through.
 *
 * It is here at all because the route has to reach the corner **through the
 * door**, and a waypoint carrying a bare 3.37 is how a door and the path to it
 * come to disagree.
 */
export const SUITE_DOOR_GY = 3.37

export const GARAGE_ROUTE: ReadonlyArray<{ gx: number; gy: number }> = [
  // On the threshold of the roll-up door — a `gx` in the opening, at the near
  // wall's `gy`. The gate sits at 0.62 along the frontage rather than at its
  // midpoint (see {@link garageShellRuns}), so the route reads the same
  // fraction instead of keeping its own idea of where the way in is.
  { gx: GARAGE_SPAN * 0.62, gy: GARAGE_SPAN - 1.0 },
  // Straight in over the apron, which is the one piece of floor guaranteed to
  // be empty — see {@link GARAGE_APRON}.
  { gx: GARAGE_SPAN * 0.62, gy: 13.0 },
  // Across the front of the room, below both front-band tables.
  { gx: 7.3, gy: 13.0 },
  // Up the middle lane, between THE LONG TABLE on the left and THE MIDDLE on
  // the right — the widest aisle in the garage, and the one the concept leaves
  // empty from the gate all the way to the corner.
  { gx: 7.3, gy: 8.0 },
  /*
   * [2026-09-03] **And then along the front of the glass, not over the end of
   * it.**
   *
   * The old last leg crossed the partition line at `gy` 7.6 on the argument
   * that `GLASS_MOUTH` was 6.6 and the glass had therefore stopped. That was
   * true of this file's idea of the partition and false of the one §7.8.12
   * draws: the suite glazes the full width of its corner and cuts a **doorway**
   * in it at floor plot 0. So the route comes up the lane between the glass and
   * THE BENCH and turns in where the door actually is.
   */
  { gx: 5.8, gy: 8.0 },
  { gx: 5.8, gy: SUITE_DOOR_GY },
  { gx: 3.4, gy: SUITE_DOOR_GY },
]

/**
 * §7.8.0c [moved here 2026-09-03] — **the leads on the floor.**
 *
 * They were three literals inside `room.ts`'s draw loop, which made them
 * unreachable to the one check they most need: `GARAGE_APRON` is a rectangle of
 * floor nothing may cross, and a *path* is the one kind of object an overlap
 * test on plots will never notice — it can clear the apron at both ends and run
 * straight through the middle of it.
 *
 * What they are for is unchanged and worth keeping: the canonical garage has
 * leads snaking across the slab between the pods, and they are the only object
 * in the room that **crosses** the grain. Everything else — desks, walls, bays,
 * pods — lies on one of the two floor axes, which is what makes the projection
 * read and is also what makes a floor of them read as a diagram. One line that
 * wanders is what says somebody set this up in a hurry.
 *
 * Three runs, each from perimeter power to a pod, each hugging an aisle edge.
 * Not five: §7.8.0c asks for "a few", and a lead to every pod is a web.
 */
export const GARAGE_CABLES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // From under the workbench, down the lane between the two back-band tables.
  [[10.4, 1.5], [9.6, 2.6], [9.9, 4.2], [9.6, 5.8]],
  // From the far-left wall across to THE LONG TABLE, the long way round.
  [[1.2, 6.2], [2.6, 7.4], [3.4, 8.8], [3.6, 10.2]],
  // Down the near-right lane to THE SOFA END, behind the sofa rather than
  // across the aisle in front of it.
  [[13.9, 3.0], [14.2, 5.4], [13.8, 7.6], [14.0, 9.2]],
]

/**
 * §7.8.0c [added 2026-09-03] — **the cracks in the slab, as an authored
 * network.**
 *
 * The floor had one crack, drawn in screen pixels off the slab's own width, and
 * a scatter of aggregate chips. The concept's has a *network*: lines of
 * different lengths that fork, wander across the quiet parts of the floor and
 * stop. That difference is the difference between concrete that has been poured
 * and cured and a grey field with a scratch on it.
 *
 * Three properties make it that rather than a texture, and each is a rule this
 * table is written to keep:
 *
 * - **It is authored, not generated.** The room rebuilds on every hire; a crack
 *   network reseeded per rebuild would crawl across the floor as the studio
 *   grows. This is a constant, and `garage.test.ts` asserts it.
 * - **It forks.** A branch leaves a trunk at one of the trunk's own interior
 *   points, so the join is a real junction rather than two lines that happen to
 *   touch. That is why the table is two lists and not one.
 * - **It crosses the quiet floor.** The cracks run through the open middle and
 *   along the empty ends — never round a pod. A crack that traces a footprint
 *   reads as a chalk outline, and the eye finds it immediately.
 */
export const GARAGE_CRACKS: {
  readonly trunks: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
  readonly branches: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
} = {
  trunks: [
    // The long one: out of the far-left wall, across the empty middle of the
    // floor between the two pod bands, and away toward the gate.
    [[1.6, 5.2], [3.4, 6.1], [5.2, 6.4], [7.0, 7.2], [8.1, 9.0], [8.6, 11.4]],
    // Down the near-right end, behind the workshop run and the sofa.
    [[14.2, 2.4], [13.6, 5.0], [14.1, 7.3], [13.4, 9.8]],
    // A short one in the corner by the kitchenette, going nowhere in
    // particular — which is the honest kind.
    [[3.2, 13.2], [5.0, 14.0], [6.6, 13.6]],
  ],
  branches: [
    // Off the long trunk where it crosses the middle, heading for the left wall.
    [[5.2, 6.4], [4.6, 8.2], [4.9, 9.6]],
    // And again further down, the other way.
    [[8.1, 9.0], [9.9, 8.6], [11.2, 9.1]],
    // A hairline off the near-right run.
    [[14.1, 7.3], [12.9, 6.8]],
  ],
}

/** Every crack as one flat list of polylines — what the renderer strokes. */
export function garageCrackPaths(): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
  return [...GARAGE_CRACKS.trunks, ...GARAGE_CRACKS.branches]
}

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

/**
 * The footprint a pod occupies on the floor — **transposed with its axis.**
 *
 * The plot is a table plus the room a seated body needs either side of it, and
 * which of those is the long side is a fact about the table's orientation. A
 * fixed rectangle was right while every pod lay on `gy`; applied to a table
 * lying on `gx` it reserves the floor at ninety degrees to the furniture, which
 * is a clearance test that passes while two pods overlap.
 *
 * §7.8.0c's no-chair rule does not shrink it. The clearance is the space a
 * person sitting at the table occupies whether or not a chair is drawn under
 * them, and taking it back would narrow every aisle in the room for a change
 * that was about a silhouette.
 */
export function podPlot(pod: Pod): Plot {
  const halfGx = pod.axis === 'gy' ? POD_HALF_GX : POD_HALF_GY
  const halfGy = pod.axis === 'gy' ? POD_HALF_GY : POD_HALF_GX
  return {
    name: pod.name,
    gx0: pod.gx - halfGx,
    gy0: pod.gy - halfGy,
    gx1: pod.gx + halfGx,
    gy1: pod.gy + halfGy,
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
    // Through `podPlot`, so a turned table reports the footprint it actually
    // has. Reading the two half-extents directly was right while every pod lay
    // the same way and silently transposed the moment one did not.
    const plot = podPlot(GARAGE_PODS[Math.floor(i / POD_SEATS)])
    maxGx = Math.max(maxGx, plot.gx1)
    maxGy = Math.max(maxGy, plot.gy1)
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
