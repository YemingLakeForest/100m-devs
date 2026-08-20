/**
 * The four frames, and the nesting between them — `docs/PLAN-2026-08-19-lens.md`.
 *
 * ## What this replaces
 *
 * The lens used to hold seven *views*, each fitted to the viewport on its own
 * and cross-faded into its neighbours by rung distance. Measured at 10,000
 * developers, that put **two copies of one building on screen at once** — the
 * tower at 190 px and the same building at ~724 px behind it at four per cent
 * alpha — because `ladderShrink` draws a view one rung from its stop at 3.16x
 * or 1/3.16x its fitted size. Two pictures of one object at different sizes,
 * blended, can never resolve into a camera move however the fade is tuned.
 *
 * ## The rule
 *
 * **A child is drawn inside its parent's cell, at the parent's scale.** A floor
 * plate in the building *is* the room, at 1/{@link PLATE_DIVISOR} — not a
 * second picture of it. So descending is one affine transform taking a cell's
 * rectangle to the frame, there is nothing to cross-fade, and smoothness is a
 * property of the geometry rather than of an easing curve.
 *
 * ## The four frames
 *
 * | Level | Unit | Holds | Space |
 * |---|---|---|---|
 * | {@link DESK} | a developer | — | floor |
 * | {@link SQUAD} | 100 | 10x10 desks | floor |
 * | {@link FLOOR} | 1,000 | 5x2 squads | floor |
 * | {@link BUILDING} | 10,000 | 10 floors | building |
 *
 * **Three of the four share one space**, and that is not a simplification — it
 * is the reason rungs 0–2 were already "all the room". A desk, a squad and a
 * floor are three framings of the same isometric grid, so moving between them
 * involves no LOD swap at all, only scale. The one real nesting in this scope
 * is floor-inside-building, and {@link PLATE_SCALE} is the whole of it.
 *
 * Everything here is pure and rendererless. The framing is the thing that was
 * asserted rather than measured last time, so it has to be answerable without
 * standing up a canvas.
 */

import {
  FLOOR_AISLE_COLS,
  FLOOR_AISLE_ROWS,
  FLOOR_MAX_COL,
  FLOOR_MAX_ROW,
  PITCH_ROW,
  ROOM_DEV_CAP,
  ROOM_SQUAD_COLS,
  ROOM_SQUAD_ROWS,
  SQUAD_COLS,
  SQUAD_ROWS,
  SQUAD_SIZE,
  SQUAD_STRIDE_COLS,
  SQUAD_STRIDE_ROWS,
  blockBox,
  isoAt,
  seatFor,
  seatGrid,
} from './room.ts'

/** The levels, innermost first. Continuous positions between them are legal. */
export const DESK = 0
export const SQUAD = 1
export const FLOOR = 2
export const BUILDING = 3
export const BLOCK = 4
export type Level = 0 | 1 | 2 | 3 | 4

export const LEVELS: readonly Level[] = [DESK, SQUAD, FLOOR, BUILDING, BLOCK]

/**
 * What each level is called, for the breadcrumb and the debug snapshot.
 *
 * §10.2a: if a player would have to be told what it means, it is not ready to
 * be on screen. These are the four words the HUD uses and the four the
 * `__stage` snapshot prints, so a screenshot and a bug report say the same
 * thing.
 */
export const LEVEL_NAMES: Record<Level, string> = {
  0: 'DESK',
  1: 'SQUAD',
  2: 'FLOOR',
  3: 'BUILDING',
  4: 'BLOCK',
}
export const TOP_LEVEL = BLOCK

/** How many developers one unit at each level holds. */
export const LEVEL_DEVS: readonly number[] = [
  1,
  SQUAD_SIZE,
  ROOM_DEV_CAP,
  ROOM_DEV_CAP * 10,
  ROOM_DEV_CAP * 100,
]

/** §7.7.1's floor, and the room's own cap — the same thousand, by construction. */
export const DEVS_PER_FLOOR = ROOM_DEV_CAP
/** Ten storeys to a building — 10,000 people. */
export const FLOORS_PER_BUILDING = 10
export const BUILDING_CAP = DEVS_PER_FLOOR * FLOORS_PER_BUILDING

/** A frame, centre-based, because every consumer wants the centre and not a corner. */
export interface Rect {
  cx: number
  cy: number
  w: number
  h: number
}

// ---------------------------------------------------------------------------
// Floor space — the room's own isometric grid
// ---------------------------------------------------------------------------

/**
 * The floor's rectangle, in seat units — **read off `room.ts` rather than
 * written down again.**
 *
 * The room draws this box and the camera frames it, and the one way those two
 * can never disagree is for there to be one of them. A second copy here would
 * be the quiet divergence ART_DIRECTION §0 forbids, one scale up.
 */
export const AISLE_COLS = FLOOR_AISLE_COLS
export const AISLE_ROWS = FLOOR_AISLE_ROWS

/** The far corner of the floor's seat lattice — 5 squads across, 2 back. */
const LAST_SEAT_COL = FLOOR_MAX_COL - FLOOR_AISLE_COLS
const LAST_SEAT_ROW = FLOOR_MAX_ROW - FLOOR_AISLE_ROWS

function rectOf(minCol: number, minRow: number, maxCol: number, maxRow: number): Rect {
  const b = blockBox(minCol, minRow, maxCol, maxRow)
  return {
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
    w: b.maxX - b.minX,
    h: b.maxY - b.minY,
  }
}

/**
 * The floor, whole — **fixed, and the same rectangle at every headcount.**
 *
 * The shell used to be re-solved on every hire (`floorBox(ceil(n / 100))`), so
 * the room's extent moved, so the camera's fit moved, so **hiring re-framed the
 * picture**. That is a shove nobody asked for and it is one of the two reasons
 * the zoom never settled. A floor is 5x2 squad plates from the moment the
 * garage is outgrown; empty squads are drawn dark. Growth goes *up*, into
 * storeys, which is what makes the building level mean anything.
 */
export function floorFrame(): Rect {
  return rectOf(
    -AISLE_COLS,
    -AISLE_ROWS,
    LAST_SEAT_COL + AISLE_COLS,
    LAST_SEAT_ROW + AISLE_ROWS,
  )
}

/** Just the seats — what the camera is actually trying to fill. See §3.3. */
export function floorSeatRect(): Rect {
  return rectOf(0, 0, LAST_SEAT_COL, LAST_SEAT_ROW)
}

/**
 * The pad around one squad, in seat units. Smaller than the floor's aisle
 * because a squad's own surround is the corridor it already sits in.
 */
export const SQUAD_PAD_COLS = 1.2
export const SQUAD_PAD_ROWS = 0.6

/** One squad of a hundred, framed — floor space. */
export function squadFrame(squad: number): Rect {
  const i = Math.max(0, Math.min(ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS - 1, Math.floor(squad)))
  const col0 = (i % ROOM_SQUAD_COLS) * SQUAD_STRIDE_COLS
  const row0 = Math.floor(i / ROOM_SQUAD_COLS) * SQUAD_STRIDE_ROWS
  return rectOf(
    col0 - SQUAD_PAD_COLS,
    row0 - SQUAD_PAD_ROWS,
    col0 + SQUAD_COLS - 1 + SQUAD_PAD_COLS,
    row0 + SQUAD_ROWS - 1 + SQUAD_PAD_ROWS,
  )
}

/**
 * How far either side of a seat the desk frame reaches, in seat units.
 *
 * Not one desk. A close-up of exactly one person is a portrait, and what the
 * level is *for* is §4.9a's spread — this developer against the ones beside
 * them. Nine people in frame is a squad row and a bit, which is enough to
 * compare and few enough that the selected one is unmistakable.
 */
export const DESK_REACH_COLS = 1.2
export const DESK_REACH_ROWS = 0.7

/** One developer and their neighbours, framed — floor space. */
export function deskFrame(localSeat: number): Rect {
  const { col, row } = seatGrid(Math.max(0, Math.floor(localSeat)))
  return rectOf(
    col - DESK_REACH_COLS,
    row - DESK_REACH_ROWS,
    col + DESK_REACH_COLS,
    row + DESK_REACH_ROWS,
  )
}

// ---------------------------------------------------------------------------
// Building space — the exploded stack
// ---------------------------------------------------------------------------

/**
 * How much smaller a floor is when it is a plate in the stack.
 *
 * The one nesting constant in this scope. A plate is the floor's own frame
 * divided by this, so `plateRect(f)` and `floorFrame()` describe the same
 * rectangle in two spaces and the descent between them is a pure scale.
 */
export const PLATE_DIVISOR = 10.5
export const PLATE_SCALE = 1 / PLATE_DIVISOR

/**
 * The tower, and the plan pulled out beside it.
 *
 * ## Three compositions were measured before this one
 *
 * Ten floor plans are ten 2:1 rectangles, and the frame is 2.23:1. That
 * constraint is unforgiving and it decided this:
 *
 * - **A column.** Plates clear each other only when `dx + 2·dy >= W` — the same
 *   diamond containment `plateHalfWidth` uses one scale down — so a column
 *   (`dx = 0`) needs `dy >= W/2` and ten of them come out **84 px wide** in a
 *   937x421 box. Not a floor plan, and not a touch target.
 * - **A staircase**, stepping along the plate's own edge. That buys 145 px, and
 *   it was built and looked at: because the step *is* an edge, the plates tile,
 *   and ten tiling plates are **one continuous ramp**. Overshooting the edge by
 *   a quarter to open gaps was tried too; it reads as a ribbon with slots in it.
 *   A stack needs its members to be separated, not merely not colliding.
 * - **A 5x2 contact sheet** packs perfectly at 187 px and does not read as a
 *   building at all.
 *
 * ## So: a tower to choose from, and one plan pulled out
 *
 * The nine floors you are not on are **bands** — a real building, compact,
 * tall, unmistakable, with a 36 px band each, which is a comfortable thumb.
 * The floor you *are* on is drawn as its full plan, lifted out to the side and
 * joined back to its band by the lift line. It comes out **286 px wide**, which
 * is twice the best any stack managed, so the five-by-two arrangement inside it
 * is actually legible.
 *
 * And it keeps the rule the whole camera rests on: the plan is the floor's own
 * geometry at {@link PLATE_SCALE}, so descending into it is still one affine
 * transform with nothing to cross-fade.
 */
export const TOWER_W = 150
/** Storey to storey up the tower. Ten of these is the building's height. */
export const BAND_H = 46
/** Where the pulled-out plan sits, relative to the tower's ground floor. */
export const PLAN_X = 346
export const PLAN_Y = -309

/**
 * The plinth, and where a tower actually stops.
 *
 * These live here rather than in `building.ts` for the reason §6 records about
 * `towerSurfaceY`: **geometry the frame and the drawing both depend on cannot
 * be written down twice.** It was, and the frame's copy was wrong. The bottom
 * of a tower was a hand-written 58, and the plinth's *deck* — a 2:1 diamond
 * centred on the shaft's foot — reaches its near corner at 78, so both
 * `buildingFrame` and `towerRect` were cutting the last twenty units off the
 * thing they were measuring. At the building level that is a trimmed apron; on
 * the block it is a tower that ends in a spike above a pad drawn behind it,
 * which reads exactly as it was reported: *"the buildings are floating?"*
 */
export const PODIUM_W = (TOWER_W / 2) * 1.09
export const PODIUM_H = 20
/** How far the contact shadow oversails the plinth it grounds. */
export const SHADOW_SPREAD = 1.18
/** The plinth deck's centre — the tower's own ground plane, at its near corner. */
export const TOWER_GROUND = TOWER_W / 4
/** The lowest point a tower is drawn at: the deck's near corner and its shadow's rim. */
export const TOWER_FOOT = TOWER_GROUND + (PODIUM_W / 2) * SHADOW_SPREAD
/** How far the plot oversails the tower on each side. */
export const PLOT_SPREAD = 40

/**
 * Where the pulled-out plan sits — building space.
 *
 * The same slot whichever floor is open, so selecting a different one slides
 * the *contents* rather than moving the frame: the camera does not lurch
 * sideways every time the player looks at another storey.
 */
export function plateAt(_floorIndex?: number, _focus?: number): { x: number; y: number } {
  return { x: PLAN_X, y: PLAN_Y }
}

/**
 * How deep the tower is — the roof diamond, and the rake of both facades.
 *
 * Half its width, so {@link TOWER_GROUND} — the shaft's near corner, which is
 * `TOWER_D / 2` — is written as `TOWER_W / 4` above where it is needed before
 * this line exists.
 */
export const TOWER_D = TOWER_W / 2

/**
 * The tower's surface, at horizontal `x` and `level` storeys above the ground.
 *
 * **The one place the building's rake is written down.** Every face, window,
 * floor plate, parapet and — importantly — every *tap* is a point on this
 * plane, so none of them can disagree about which way the thing leans. They
 * did: `building.ts` offset its windows by half the slope its own facades had,
 * and `storeyAtBuilding` tested an upright rectangle against a sheared band.
 *
 * 2:1 isometric (ART_DIRECTION §1), the same projection `isoAt` uses one scale
 * down. `x = 0` is the corner nearest the camera and is the *lowest* point of
 * a storey's edge; `|x| = TOWER_W / 2` are the outer corners.
 */
export function towerSurfaceY(x: number, level: number): number {
  const halfW = TOWER_W / 2
  const halfD = TOWER_D / 2
  return halfD - Math.min(Math.abs(x), halfW * 4) * (halfD / halfW) - level * BAND_H
}

/**
 * Headroom above the top storey, for what stands on the roof.
 *
 * A building ends in a parapet, a plant room and a mast, and the mast is the
 * part that carries the scale — one red light at the top of a grey slab is most
 * of what says the thing is enormous. It was 18 units, which is a parapet and
 * nothing else, so the crown was drawn and then cropped off by its own frame.
 *
 * `building.ts` measures the crown from here, so the two cannot drift: the
 * frame reserves exactly what the drawing uses.
 */
export const TOWER_CROWN = 62

/**
 * One storey's band on the tower, in building space.
 *
 * **Measured at the tower's outer corners**, where the storey's own edges are
 * highest — which is what the lift line and `buildingFrame` want, and is *not*
 * what a tap wants. A storey is painted as a sheared band that drops `TOWER_D /
 * 2` toward the near corner, so an upright rectangle is up to four fifths of a
 * floor out at the middle of the building. See `storeyAtBuilding`.
 */
export function bandRect(floorIndex: number): Rect {
  const f = Math.max(0, Math.min(FLOORS_PER_BUILDING - 1, Math.floor(floorIndex)))
  return { cx: 0, cy: -(f * BAND_H) - BAND_H / 2, w: TOWER_W, h: BAND_H }
}

/** The pulled-out plan's rectangle, in building space. */
export function plateRect(_floorIndex?: number, _focus?: number): Rect {
  const at = plateAt()
  const floor = floorFrame()
  return {
    cx: at.x + floor.cx * PLATE_SCALE,
    cy: at.y + floor.cy * PLATE_SCALE,
    w: floor.w * PLATE_SCALE,
    h: floor.h * PLATE_SCALE,
  }
}

/**
 * The whole building, framed — building space.
 *
 * Measured from the plates that exist plus the plot under them, so a two-storey
 * studio is framed as a two-storey studio rather than as the bottom fifth of a
 * tower it has not built. `storeys` is what the headcount has earned; `focus`
 * shifts the frame because the open window is part of the object.
 */
export function buildingFrame(storeys: number, _focus?: number): Rect {
  const n = Math.max(1, Math.min(FLOORS_PER_BUILDING, Math.floor(storeys)))
  const top = bandRect(n - 1)
  const plan = plateRect()
  const minX = Math.min(-TOWER_W / 2 - PLOT_SPREAD, plan.cx - plan.w / 2)
  const maxX = Math.max(TOWER_W / 2 + PLOT_SPREAD, plan.cx + plan.w / 2)
  const minY = Math.min(top.cy - top.h / 2 - TOWER_CROWN, plan.cy - plan.h / 2)
  const maxY = Math.max(TOWER_FOOT, plan.cy + plan.h / 2)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

// ---------------------------------------------------------------------------
// Block space — a street of towers
// ---------------------------------------------------------------------------

/**
 * The block, and why ten towers fit where ten floor plans did not.
 *
 * §2 of the handoff records the arithmetic that killed the exploded plate
 * stack: ten 2:1 rectangles in a 2.23:1 frame come out at 145 px however they
 * are arranged, because the diamond containment rule `dx + 2·dy >= W` is
 * unforgiving. One scale up the same question is asked of ten *buildings*, and
 * this time it has an answer — because a tower is tall and narrow rather than
 * flat and wide, so the thing that has to clear its neighbour is a 230-unit
 * footprint and not a 604-unit plan.
 *
 * Measured at 997x448, ten full towers on a 5x2 plot lattice:
 *
 * | Arrangement | Tower on screen | Composition |
 * |---|---|---|
 * | 10 in a row | 61 x 147 px | 2300 x 1592 units, height-bound |
 * | two rows of five across a wide street | 66 x 176 px | 1025 x 734 |
 * | **5 across, 2 back** | **80 x 194 px** | **765 x 604** |
 *
 * The 5x2 wins and it is also the shape the floor already uses for its squads,
 * which is not a coincidence worth hiding: a floor is five-by-two groups of a
 * hundred, a block is five-by-two groups of ten thousand, and the player learns
 * one arrangement instead of two.
 *
 * **Along a row, no tower touches another.** Plots one column apart are
 * {@link PLOT_STRIDE_X} apart horizontally against a 115-unit footprint, so
 * there are fifteen units of street between them.
 *
 * **Across the rows they overlap, and that is the honest half.** On a 2:1
 * lattice the plot one column along *and* one row nearer sits at exactly the
 * same x, 130 units lower, against a 290-unit tower — so four of the ten stand
 * half in front of four others. The first draft of this note claimed otherwise
 * and a test written from the claim failed on the first run, which is the right
 * order for that to happen in.
 *
 * It is not the defect the plate stack had, and the difference is worth being
 * precise about. A stack of plates that hide each other is unusable because a
 * hidden plate has **nothing** left to point at. A tower behind a tower keeps
 * its crown and its upper floors, `buildingAtBlock` resolves nearest-first so
 * the exposed band belongs to the building it looks like it belongs to, and the
 * test that matters — *every tower keeps a band of itself the finger can
 * reach* — measures 89 px on the worst of them against a 34 px fingertip. It is
 * also, simply, what a city block looks like from across the street.
 *
 * What the arrangement costs is width: the composition is 534 px of a 997 px
 * frame, because a 2:1 lattice buys one unit of x for every half unit of y and
 * ten full towers are 194 px tall. The ground plane runs out to the rails to
 * fill it (§3.3), which is what a block looks like anyway.
 */
export const BLOCK_COLS = 5
export const BLOCK_ROWS = 2
export const BUILDINGS_PER_BLOCK = BLOCK_COLS * BLOCK_ROWS
export const BLOCK_CAP = BUILDING_CAP * BUILDINGS_PER_BLOCK

/**
 * How much smaller a building is when it is one plot of the block.
 *
 * The second nesting constant, and it does exactly what {@link PLATE_SCALE}
 * does one level down: a plot *is* the building's own frame divided by this, so
 * descending into it is a pure scale and there is nothing to cross-fade.
 */
export const BLOCK_DIVISOR = 2
export const BLOCK_SCALE = 1 / BLOCK_DIVISOR

/**
 * Plot centre to plot centre, one column along — block space, 2:1 isometric.
 *
 * 130 against a 115-unit tower footprint. Anything less and the towers overlap;
 * much more and the lattice's own vertical spread — half a unit of y for every
 * unit of x — eats the height the towers need.
 */
export const PLOT_STRIDE_X = 130
export const PLOT_STRIDE_Y = PLOT_STRIDE_X / 2

/**
 * Where a plot's building stands, in block space.
 *
 * The same 2:1 as everything else: one column along is right and down, one row
 * back is left and up. Plots fill the back row first, left to right, so the
 * studio grows away from the camera and the buildings you have longest are the
 * ones furthest back — which is also the order the seats number in.
 */
export function plotAt(building: number): { x: number; y: number } {
  const i = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(building)))
  const col = i % BLOCK_COLS
  const row = Math.floor(i / BLOCK_COLS)
  return { x: (col - row) * PLOT_STRIDE_X, y: (col + row) * PLOT_STRIDE_Y }
}

/** How near the camera a plot is. Larger is nearer, and is drawn later. */
export function plotDepth(building: number): number {
  const i = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(building)))
  return (i % BLOCK_COLS) + Math.floor(i / BLOCK_COLS)
}

/** Map a building-space rectangle into block space, through plot `building`. */
export function intoPlot(rect: Rect, building: number): Rect {
  const at = plotAt(building)
  return {
    cx: at.x + rect.cx * BLOCK_SCALE,
    cy: at.y + rect.cy * BLOCK_SCALE,
    w: rect.w * BLOCK_SCALE,
    h: rect.h * BLOCK_SCALE,
  }
}

/** A building-space point, in block space, through plot `building`. */
export function buildingToBlock(p: { x: number; y: number }, building: number): { x: number; y: number } {
  const at = plotAt(building)
  return { x: at.x + p.x * BLOCK_SCALE, y: at.y + p.y * BLOCK_SCALE }
}

/** The inverse — a block-space point, in one plot's building space. */
export function blockToBuilding(p: { x: number; y: number }, building: number): { x: number; y: number } {
  const at = plotAt(building)
  return { x: (p.x - at.x) / BLOCK_SCALE, y: (p.y - at.y) / BLOCK_SCALE }
}

/** A floor-space point, in block space — through the plate and then the plot. */
export function floorToBlock(
  p: { x: number; y: number },
  storey: number,
  building: number,
): { x: number; y: number } {
  return buildingToBlock(floorToBuilding(p, storey), building)
}

/**
 * The tower alone, framed — building space, no pulled-out plan.
 *
 * {@link buildingFrame} is this plus the plan, because at the building level
 * the plan is the point. At the block level it is not: ten plans at plot scale
 * would each be 143 units wide against a 130-unit plot stride, so every one of
 * them would be drawn across its neighbour's tower. A plot holds a *tower*.
 */
export function towerRect(storeys: number): Rect {
  const n = Math.max(1, Math.min(FLOORS_PER_BUILDING, Math.floor(storeys)))
  const top = bandRect(n - 1)
  const halfW = TOWER_W / 2 + PLOT_SPREAD
  const minY = top.cy - top.h / 2 - TOWER_CROWN
  return { cx: 0, cy: (minY + TOWER_FOOT) / 2, w: halfW * 2, h: TOWER_FOOT - minY }
}

/**
 * The whole block, framed — block space.
 *
 * Every occupied plot is framed as if it held the tallest tower in the studio,
 * and that is deliberate: buildings fill in order, so the moment there are two
 * of them the first is full and the tallest never changes again. A frame
 * measured off each building's *actual* height would re-frame the block every
 * time a storey landed anywhere in it, which is the re-framing this whole
 * rebuild exists to stop.
 */
export function blockFrame(buildings: number, tallest: number): Rect {
  const n = Math.max(1, Math.min(BUILDINGS_PER_BLOCK, Math.floor(buildings)))
  const tower = towerRect(tallest)
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (let i = 0; i < n; i++) {
    const r = intoPlot(tower, i)
    minX = Math.min(minX, r.cx - r.w / 2)
    maxX = Math.max(maxX, r.cx + r.w / 2)
    minY = Math.min(minY, r.cy - r.h / 2)
    maxY = Math.max(maxY, r.cy + r.h / 2)
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/**
 * Which building a block-space point is over, or −1.
 *
 * **Nearest plot first**, which is the whole of what makes it correct: the near
 * row stands in front of the far row's lower half, so a point inside two boxes
 * belongs to the one that is drawn over the other. `plotDepth` is the same
 * `col + row` the y coordinate is built from, so the picker and the scene graph
 * cannot disagree about which tower is in front.
 *
 * A box per plot rather than the tower's true silhouette. What that costs is
 * the corners — a tap just off the roof still names the building — and naming
 * the thing the finger is nearest is the right failure for a tap that missed.
 */
export function buildingAtBlock(
  x: number,
  y: number,
  buildings: number,
  storeysOf: (building: number) => number,
): number {
  const n = Math.max(0, Math.min(BUILDINGS_PER_BLOCK, Math.floor(buildings)))
  let best = -1
  let bestDepth = -1
  for (let i = 0; i < n; i++) {
    const r = intoPlot(towerRect(Math.max(1, storeysOf(i))), i)
    if (Math.abs(x - r.cx) > r.w / 2 || Math.abs(y - r.cy) > r.h / 2) continue
    const depth = plotDepth(i)
    if (depth > bestDepth) {
      bestDepth = depth
      best = i
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Outlines and picking
// ---------------------------------------------------------------------------

/** The four screen corners of a rectangle of the seat grid, in floor space. */
function outline(
  minCol: number,
  minRow: number,
  maxCol: number,
  maxRow: number,
): Array<{ x: number; y: number }> {
  return [
    isoAt(minCol, minRow),
    isoAt(maxCol, minRow),
    isoAt(maxCol, maxRow),
    isoAt(minCol, maxRow),
  ]
}

/**
 * The floor's slab, as a parallelogram in floor space.
 *
 * **Not a diamond**, for `platePoints`' reason one scale up: the floor is a
 * rectangle of the seat grid, and the grid axes are affine under `isoAt`, so
 * its screen shape is a sheared rectangle. Drawing the containing diamond
 * instead is what made the room twice the size of the people on it.
 */
export function floorOutline(): Array<{ x: number; y: number }> {
  return outline(-AISLE_COLS, -AISLE_ROWS, LAST_SEAT_COL + AISLE_COLS, LAST_SEAT_ROW + AISLE_ROWS)
}

/** One squad's plate, as a parallelogram in floor space. */
export function squadOutline(squad: number, pad = 0.9): Array<{ x: number; y: number }> {
  const i = Math.max(0, Math.min(ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS - 1, Math.floor(squad)))
  const col0 = (i % ROOM_SQUAD_COLS) * SQUAD_STRIDE_COLS
  const row0 = Math.floor(i / ROOM_SQUAD_COLS) * SQUAD_STRIDE_ROWS
  return outline(
    col0 - pad,
    row0 - pad * 0.5,
    col0 + SQUAD_COLS - 1 + pad,
    row0 + SQUAD_ROWS - 1 + pad * 0.5,
  )
}

/**
 * Floor space back to seat-grid coordinates — the inverse of `isoAt`.
 *
 * Exact rather than a nearest-centre search, which is what the hit test wants:
 * the lattice tiles with no gaps, so every point on the floor belongs to
 * exactly one cell and a tap between two desks should hit the nearer one rather
 * than nothing.
 */
export function gridAtFloor(x: number, y: number): { col: number; row: number } {
  // isoAt(col, row) = ((row·PR − col)·TW/2, (row·PR + col)·TH/2) with TW/2 = 32
  // and TH/2 = 16, so both axes invert in two lines.
  const gx = (y / 16 + x / 32) / 2
  const gy = (y / 16 - x / 32) / 2
  return { col: gy, row: gx / PITCH_ROW }
}

/**
 * Which squad a floor-space point is over, or −1 off the lattice.
 *
 * The epsilon is not decoration. A squad origin is an exact multiple of the
 * stride in seat units — squad 4 starts at `4 × 12.6 = 50.4` — and `50.4 / 12.6`
 * evaluates to 3.9999999999999996 in doubles, so the *first seat of a squad*
 * floored to the squad before it. Every squad's own corner desk picked its
 * neighbour, which is the worst possible place for a rounding error to live.
 */
const CELL_EPSILON = 1e-6

export function squadAtFloor(x: number, y: number): number {
  const { col, row } = gridAtFloor(x, y)
  const sc = Math.floor((col + CELL_EPSILON) / SQUAD_STRIDE_COLS)
  const sr = Math.floor((row + CELL_EPSILON) / SQUAD_STRIDE_ROWS)
  if (sc < 0 || sc >= ROOM_SQUAD_COLS || sr < 0 || sr >= ROOM_SQUAD_ROWS) return -1
  return sr * ROOM_SQUAD_COLS + sc
}

/**
 * Which storey a building-space point is over, or −1.
 *
 * Tested nearest-first — plate 0 is drawn last and is therefore on top where
 * two plates overlap — so the answer is always the plate the player can see.
 */
export function storeyAtBuilding(x: number, y: number, storeys: number, focus: number): number {
  const n = Math.max(1, Math.min(FLOORS_PER_BUILDING, Math.floor(storeys)))
  /*
   * **The bands are sheared, so the test has to be.**
   *
   * This walked `bandRect` — an upright rectangle — down the tower, and the
   * tower is drawn on a 2:1 rake that drops `TOWER_D / 2` from its outer corners
   * to the one nearest the camera. That is 37.5 units against a 46-unit storey:
   * four fifths of a floor. Pressing the middle of a storey you can see hit the
   * one below it, and pressing the bottom of the shaft hit nothing at all and
   * fell through to the plan. §26.2.2's whole claim is that a tap lands on the
   * thing that was pointed at.
   *
   * Undoing the shear first turns the band test back into a single division:
   * `towerSurfaceY` is the ceiling of storey `level` at this `x`, so how many
   * storeys down from the roofline the point sits is the storey it is in.
   */
  if (Math.abs(x) <= TOWER_W / 2) {
    const f = Math.floor((towerSurfaceY(x, 0) - y) / BAND_H)
    if (f >= 0 && f < n) return f
  }
  // The pulled-out plan is the focused floor seen large, so a tap anywhere on
  // it names that floor — which is what makes "tap it again to go in" work on
  // the thing the player is actually looking at rather than only on its band.
  const at = plateAt()
  const local = gridAtFloor((x - at.x) / PLATE_SCALE, (y - at.y) / PLATE_SCALE)
  if (
    local.col >= -AISLE_COLS &&
    local.col <= LAST_SEAT_COL + AISLE_COLS &&
    local.row >= -AISLE_ROWS &&
    local.row <= LAST_SEAT_ROW + AISLE_ROWS
  ) {
    return Math.max(0, Math.min(n - 1, Math.floor(focus)))
  }
  return -1
}

// ---------------------------------------------------------------------------
// The address, and the frame it names
// ---------------------------------------------------------------------------

/**
 * The address, clamped to the studio this scope draws.
 *
 * One number still — a global seat — and every part of the address is derived
 * from it. §26.2.2's argument for that has not changed and gets stronger with
 * another level on the ladder: a path (`building 3, floor 7, squad 2`) is four
 * things that can disagree, and a seat is one thing that cannot.
 */
function seatIn(seat: number): number {
  const s = Math.max(0, Math.floor(Number.isFinite(seat) ? seat : 0))
  return Math.min(BLOCK_CAP - 1, s)
}

/** Which building of the block holds a global seat. */
export function buildingOf(seat: number): number {
  return Math.floor(seatIn(seat) / BUILDING_CAP)
}

/**
 * Which storey a global seat is on — **within its own building**.
 *
 * Local, not global, and that is the one place the second level changed the
 * meaning of an existing function rather than adding beside it. A storey is
 * only a storey of something: "floor 14" is not a floor of a ten-storey
 * building, it is floor 4 of the second one, and every caller that draws a
 * tower or lifts a plate wants the second reading.
 */
export function storeyOf(seat: number): number {
  return Math.floor(seatIn(seat) / DEVS_PER_FLOOR) % FLOORS_PER_BUILDING
}

/** The first seat of a building — where descending into it lands. */
export function seatOfBuilding(building: number): number {
  return Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(building))) * BUILDING_CAP
}

/** The first seat of a storey of a building — where descending into it lands. */
export function seatOfStorey(storey: number, building = 0): number {
  const f = Math.max(0, Math.min(FLOORS_PER_BUILDING - 1, Math.floor(storey)))
  return seatOfBuilding(building) + f * DEVS_PER_FLOOR
}

/** Which of the floor's ten squads a global seat is in. */
export function squadOf(seat: number): number {
  const local = Math.max(0, Math.floor(Number.isFinite(seat) ? seat : 0)) % DEVS_PER_FLOOR
  return seatFor(local).squad
}

/** The first seat of a squad, within its own floor. */
export function seatOfSquad(storey: number, squad: number, building = 0): number {
  return seatOfStorey(storey, building) + Math.max(0, Math.floor(squad)) * SQUAD_SIZE
}

/** How many buildings a headcount has put up. At least one — you are always somewhere. */
export function buildingsFor(devs: number): number {
  if (!Number.isFinite(devs) || devs <= 0) return 1
  return Math.max(1, Math.min(BUILDINGS_PER_BLOCK, Math.ceil(devs / BUILDING_CAP)))
}

/**
 * How many storeys stand in one building of the studio.
 *
 * Buildings fill in order, so this is the headcount left over once the
 * buildings before it are full — which means the first building is at ten the
 * moment there is a second one, and the last is the only one that grows.
 */
export function storeysIn(devs: number, building = 0): number {
  const b = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(building)))
  const left = (Number.isFinite(devs) ? devs : 0) - b * BUILDING_CAP
  if (left <= 0) return b === 0 ? 1 : 0
  return Math.max(1, Math.min(FLOORS_PER_BUILDING, Math.ceil(left / DEVS_PER_FLOOR)))
}

/** How many developers stand in one building of the studio. */
export function devsIn(devs: number, building = 0): number {
  const b = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(building)))
  const left = (Number.isFinite(devs) ? devs : 0) - b * BUILDING_CAP
  return Math.max(0, Math.min(BUILDING_CAP, left))
}

/** The tallest building in the studio, in storeys — what {@link blockFrame} spans. */
export function tallestIn(devs: number): number {
  return storeysIn(devs, 0)
}

/**
 * The frame a level names, **always in block space**.
 *
 * One space for every level is what lets the camera be a single scale and
 * centre, and adding a level does not add a space — it adds one more division.
 * A desk is a rectangle of the floor; the floor is a plate of the building at
 * {@link PLATE_SCALE}; the building is a plot of the block at
 * {@link BLOCK_SCALE}. Five frames, one coordinate system, and descending the
 * whole ladder is still a single affine transform.
 */
export function frameFor(level: Level, seat: number, storeys: number, buildings = 1): Rect {
  const building = buildingOf(seat)
  // The tallest tower, which the frame spans: buildings fill in order, so the
  // moment there are two of them the first is full and `storeys` is whichever
  // building the address is in rather than the highest one.
  if (level === BLOCK) {
    return blockFrame(buildings, buildings > 1 ? FLOORS_PER_BUILDING : storeys)
  }

  const focus = storeyOf(seat)
  if (level === BUILDING) return intoPlot(buildingFrame(storeys, focus), building)

  const local = Math.max(0, Math.floor(seat)) % DEVS_PER_FLOOR
  const inner =
    level === FLOOR ? floorFrame() : level === SQUAD ? squadFrame(seatFor(local).squad) : deskFrame(local)
  return intoPlot(intoPlate(inner, focus), building)
}

/** A floor-space point, in building space, through plate `focus`. */
export function floorToBuilding(
  p: { x: number; y: number },
  focus: number,
): { x: number; y: number } {
  const at = plateAt(focus, focus)
  return { x: at.x + p.x * PLATE_SCALE, y: at.y + p.y * PLATE_SCALE }
}

/** The inverse — a building-space point, in the focused plate's floor space. */
export function buildingToFloor(
  p: { x: number; y: number },
  focus: number,
): { x: number; y: number } {
  const at = plateAt(focus, focus)
  return { x: (p.x - at.x) / PLATE_SCALE, y: (p.y - at.y) / PLATE_SCALE }
}

/** Map a floor-space rectangle into building space, through plate `focus`. */
export function intoPlate(rect: Rect, focus: number): Rect {
  const at = plateAt(focus, focus)
  return {
    cx: at.x + rect.cx * PLATE_SCALE,
    cy: at.y + rect.cy * PLATE_SCALE,
    w: rect.w * PLATE_SCALE,
    h: rect.h * PLATE_SCALE,
  }
}

// ---------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------

/**
 * How much of the short axis the subject fills.
 *
 * 0.94, not 0.88. The old margin was reserving room for a HUD that also had
 * `viewportForView` taking 130 px of rail off each side — the two together cost
 * the picture 35% of the frame before anything was drawn. The rails are still
 * there; what changed is that the *scenery* is allowed to run under them and
 * only the content has to clear them (§3.3).
 */
export const FIT_MARGIN = 0.94

/** Building-space units per screen pixel's worth of scale, for a frame. */
export function fitScaleFor(rect: Rect, viewport: { w: number; h: number }): number {
  if (!(viewport.w > 0) || !(viewport.h > 0)) return 1
  if (!(rect.w > 0) || !(rect.h > 0)) return 1
  return Math.min(viewport.w / rect.w, viewport.h / rect.h) * FIT_MARGIN
}

/**
 * The camera scale at which each level exactly fits, innermost first.
 *
 * Exported because the magnetic stops, the LOD thresholds and the tests all
 * need to agree about where a level *is*, and three derivations of that is
 * three chances to disagree by a frame.
 */
export function levelScales(
  seat: number,
  storeys: number,
  viewport: { w: number; h: number },
  buildings = 1,
): Record<Level, number> {
  return nestScales({
    0: fitScaleFor(frameFor(DESK, seat, storeys, buildings), viewport),
    1: fitScaleFor(frameFor(SQUAD, seat, storeys, buildings), viewport),
    2: fitScaleFor(frameFor(FLOOR, seat, storeys, buildings), viewport),
    3: fitScaleFor(frameFor(BUILDING, seat, storeys, buildings), viewport),
    4: fitScaleFor(frameFor(BLOCK, seat, storeys, buildings), viewport),
  })
}

/**
 * Force the ladder to nest — **no level may frame less than the level inside
 * it**.
 *
 * The five frames are nested by construction: a desk is in a squad, a squad is
 * on a floor, a floor is in a building, a building is on the block. The *room* is not, because §7.8.1's
 * garage is a real rectangle that grows, and for the first thirty developers it
 * is smaller than the 10x10 block a squad names. Measured at one developer, on
 * the reference frame: desk 51.8, squad 8.4, floor **9.8** — the floor sat
 * *inside* the squad, and every piece of arithmetic downstream reads the ladder
 * as ordered.
 *
 * What that cost was not subtle. {@link levelAtScale} walks the rungs in order,
 * so an out-of-order rung is not merely mis-sized, it is **unreachable**: the
 * band between squad and floor inverted, the level curve grew a cliff, and a
 * camera parked anywhere on the wrong side of it reported a level the ceiling
 * would not allow and could not be zoomed out of. That is the whole of "when
 * there's only me on a new game, when I zoomed out, I can't zoom back in".
 *
 * The rule is the honest one: a level that would frame less than the room shows
 * the room. Two levels that then frame the same rectangle **are the same
 * place** — which is true of a garage, where "your squad", "your floor" and
 * "everybody" name one group of people — and the collapsed rungs always land
 * outside §7.7.1's ceiling anyway, because the ceiling is what put the room
 * there.
 */
export function nestScales(scales: Record<Level, number>): Record<Level, number> {
  const out = { ...scales }
  for (let l = TOP_LEVEL - 1; l >= DESK; l--) {
    out[l as Level] = Math.max(out[l as Level], out[(l + 1) as Level])
  }
  return out
}

/**
 * Where a camera scale sits on the level ladder, continuously.
 *
 * Log-interpolated, because scale is multiplicative: half way between two
 * levels has to mean the geometric mean of their scales, or the second half of
 * every dolly runs at a different rate from the first and the gesture reads as
 * sticking.
 */
export function levelAtScale(scale: number, scales: Record<Level, number>): number {
  if (!(scale > 0)) return TOP_LEVEL
  const s = Math.log(scale)
  // Strictly below, so a tie between the top two rungs falls through to the
  // band scan and resolves *inward* like every other tie. One building on a
  // block is exactly that tie: the block and the building are the same picture,
  // and the camera sitting on it is in the building.
  if (s < Math.log(scales[TOP_LEVEL])) return TOP_LEVEL
  if (s >= Math.log(scales[DESK])) return DESK
  // Innermost first, so a scale two rungs share is read as the *inner* one.
  // {@link nestScales} collapses a rung onto its neighbour when the room is
  // smaller than the frame the rung names, and the camera sitting exactly on
  // that shared scale is sitting at the closer of the two: it got there by
  // pulling back until it stopped, and the thing that stopped it was the inner
  // rung's own ceiling.
  for (let l = DESK + 1; l <= TOP_LEVEL; l++) {
    const lo = Math.log(scales[l as Level])
    const hi = Math.log(scales[(l - 1) as Level])
    // A collapsed rung is not a band and cannot be interpolated across.
    if (!(hi - lo > 1e-12)) continue
    if (s >= lo && s <= hi) return l - (s - lo) / (hi - lo)
  }
  return TOP_LEVEL
}

/** The scale at a continuous level position — the inverse of {@link levelAtScale}. */
export function scaleAtLevel(level: number, scales: Record<Level, number>): number {
  const l = Math.max(DESK, Math.min(TOP_LEVEL, Number.isFinite(level) ? level : TOP_LEVEL))
  const lo = Math.floor(l)
  const hi = Math.min(TOP_LEVEL, lo + 1)
  const t = l - lo
  // Exact on a stop, rather than `exp(log(s))` of it. A level is a *place* and
  // the round trip through the logarithm lands a unit in the last place either
  // side of one, which is enough for `levelAtScale` to report the neighbouring
  // rung and for anything watching the level to flicker between two names while
  // the camera has not moved at all.
  if (lo === hi || t <= 0) return scales[lo as Level]
  return Math.exp(Math.log(scales[lo as Level]) * (1 - t) + Math.log(scales[hi as Level]) * t)
}

// ---------------------------------------------------------------------------
// Level of detail
// ---------------------------------------------------------------------------

/**
 * Effective scale of *floor space* at a given camera scale.
 *
 * Floor space lives inside a plate, which lives inside a plot, so everything
 * the room draws is a factor of {@link PLATE_DIVISOR} times
 * {@link BLOCK_DIVISOR} smaller than the camera says. Every LOD threshold below
 * is expressed in this rather than in camera scale, so it is a statement about
 * how big a desk is on screen and stays true when the stack is retuned — which
 * is exactly what happened when the block arrived. Every threshold below is
 * unchanged; only this line knows there is another division in the chain.
 */
export function floorScaleAt(cameraScale: number): number {
  return cameraScale * PLATE_SCALE * BLOCK_SCALE
}

/**
 * Above this floor-space scale the room draws real people; below it, the plate
 * draws a plan.
 *
 * **Chosen so the two look the same at the swap.** At 0.10 a desk is about six
 * pixels across, which is a dot either way — the plan's dot and the room's
 * shrunk workstation are indistinguishable, so the swap is invisible. That is
 * the whole mechanism replacing the cross-fade: match the representations at
 * the hand-off size instead of blending two that never match.
 */
export const ROOM_RESOLVE_SCALE = 0.1

/**
 * The band over which the building's chrome — plot, unfocused plates, lift
 * core — leaves, in floor-space scale.
 *
 * It **starts** leaving after the room has already resolved, so the two
 * hand-offs never land on the same frame: for the band between
 * {@link ROOM_RESOLVE_SCALE} and {@link BUILDING_FADE_END} the player can see
 * the room they are entering still sitting inside the building it belongs to.
 * That overlap is the one thing the old cross-fade was reaching for and could
 * not have, because its two pictures were never the same size.
 */
export const BUILDING_FADE_START = 0.09
export const BUILDING_FADE_END = 0.17

/** 1 while the building is the subject, 0 once the room is. */
export function buildingChromeAlpha(floorScale: number): number {
  if (!(floorScale > 0)) return 1
  const t = (BUILDING_FADE_END - floorScale) / (BUILDING_FADE_END - BUILDING_FADE_START)
  const u = Math.max(0, Math.min(1, t))
  // Smoothstep, so the chrome does not appear or vanish with a visible kink at
  // either end of the band — §10.5's rule, applied to the one fade left.
  return u * u * (3 - 2 * u)
}

/**
 * The band over which the *block* leaves — its ground, its streets and the nine
 * towers you are not in — in floor-space scale.
 *
 * Measured at 997x448, ten full buildings: the block sits at a floor scale of
 * **0.033** and one building at **0.072**, so the band is the middle of the
 * only gap there is. It has to be crossed completely, and this is not
 * housekeeping: the building's pulled-out plan is 286 units wide against a
 * 130-unit plot stride, so a plan drawn while a neighbour is still on screen is
 * drawn straight through it.
 *
 * The plan fades in on `1 - blockChromeAlpha`, so the two trade places rather
 * than overlapping. That is a fade between *different objects*, which §10.5
 * allows; the thing it forbids is fading between two pictures of one object,
 * which is what the old ladder did and what the plot-to-tower hand-off
 * deliberately does not do — those two are the same drawing at the same size.
 */
export const BLOCK_FADE_START = 0.042
export const BLOCK_FADE_END = 0.06

/** 1 while the block is the subject, 0 once a single building is. */
export function blockChromeAlpha(floorScale: number): number {
  if (!(floorScale > 0)) return 1
  const t = (BLOCK_FADE_END - floorScale) / (BLOCK_FADE_END - BLOCK_FADE_START)
  const u = Math.max(0, Math.min(1, t))
  return u * u * (3 - 2 * u)
}

/** Whether the room's individual people are worth building at this scale. */
export function roomResolved(floorScale: number): boolean {
  return floorScale >= ROOM_RESOLVE_SCALE
}
