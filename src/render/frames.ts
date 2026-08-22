/**
 * The six frames, and the nesting between them — `docs/PLAN-2026-08-19-lens.md`.
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
 * ## The six frames
 *
 * | Level | Unit | Holds | Space |
 * |---|---|---|---|
 * | {@link DESK} | a developer | — | floor |
 * | {@link SQUAD} | 100 | 10x10 desks | floor |
 * | {@link FLOOR} | 1,000 | 5x2 squads | floor |
 * | {@link BUILDING} | 10,000 | 10 floors | building |
 * | {@link BLOCK} | 100,000 | 5x2 buildings | block |
 * | {@link PARK} | 1,000,000 | 5x2 blocks | park |
 *
 * **Three of the six share one space**, and that is not a simplification — it
 * is the reason rungs 0–2 were already "all the room". A desk, a squad and a
 * floor are three framings of the same isometric grid, so moving between them
 * involves no LOD swap at all, only scale. Above them each level is one more
 * division: {@link PLATE_SCALE} puts a floor in a building, {@link BLOCK_SCALE}
 * puts a building on a block, {@link PARK_SCALE} puts a block on a parcel, and
 * descending the whole ladder is still a single affine transform.
 *
 * The last two arrived one at a time, on 2026-08-20 and 2026-08-22, and each
 * cost the same thing: one division, one `TOP_LEVEL`, and **no LOD threshold
 * moved**. Every threshold here is written in *floor-space* scale
 * ({@link floorScaleAt}), so a new division in the chain moves every camera
 * scale by exactly that factor and leaves the questions about how big a desk is
 * on screen answered the way they were.
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
export const PARK = 5
export type Level = 0 | 1 | 2 | 3 | 4 | 5

export const LEVELS: readonly Level[] = [DESK, SQUAD, FLOOR, BUILDING, BLOCK, PARK]

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
  5: 'PARK',
}
export const TOP_LEVEL = PARK

/** How many developers one unit at each level holds. */
export const LEVEL_DEVS: readonly number[] = [
  1,
  SQUAD_SIZE,
  ROOM_DEV_CAP,
  ROOM_DEV_CAP * 10,
  ROOM_DEV_CAP * 100,
  ROOM_DEV_CAP * 1000,
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
export function plotAt(plot: number): { x: number; y: number } {
  const i = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(plot)))
  const col = i % BLOCK_COLS
  const row = Math.floor(i / BLOCK_COLS)
  return { x: (col - row) * PLOT_STRIDE_X, y: (col + row) * PLOT_STRIDE_Y }
}

/** How near the camera a plot is. Larger is nearer, and is drawn later. */
export function plotDepth(plot: number): number {
  const i = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(plot)))
  return (i % BLOCK_COLS) + Math.floor(i / BLOCK_COLS)
}

/**
 * Which plot of its own block a building stands on.
 *
 * **{@link buildingOf} is a park-wide number and a plot is a block-local one**,
 * and the two were the same thing for exactly as long as there was one block.
 * Every geometry function below takes the *plot*, so the conversion is written
 * here once rather than assumed at ten call sites — trap 52a, forestalled: a
 * building index handed to `plotAt` would have clamped silently to plot 9 and
 * drawn the whole of block 3 on top of itself.
 */
export function plotOf(building: number): number {
  return Math.max(0, Math.floor(Number.isFinite(building) ? building : 0)) % BUILDINGS_PER_BLOCK
}

/** Map a building-space rectangle into block space, through plot `plot`. */
export function intoPlot(rect: Rect, plot: number): Rect {
  const at = plotAt(plot)
  return {
    cx: at.x + rect.cx * BLOCK_SCALE,
    cy: at.y + rect.cy * BLOCK_SCALE,
    w: rect.w * BLOCK_SCALE,
    h: rect.h * BLOCK_SCALE,
  }
}

/** A building-space point, in block space, through plot `plot`. */
export function buildingToBlock(p: { x: number; y: number }, plot: number): { x: number; y: number } {
  const at = plotAt(plot)
  return { x: at.x + p.x * BLOCK_SCALE, y: at.y + p.y * BLOCK_SCALE }
}

/** The inverse — a block-space point, in one plot's building space. */
export function blockToBuilding(p: { x: number; y: number }, plot: number): { x: number; y: number } {
  const at = plotAt(plot)
  return { x: (p.x - at.x) / BLOCK_SCALE, y: (p.y - at.y) / BLOCK_SCALE }
}

/** A floor-space point, in block space — through the plate and then the plot. */
export function floorToBlock(
  p: { x: number; y: number },
  storey: number,
  plot: number,
): { x: number; y: number } {
  return buildingToBlock(floorToBuilding(p, storey), plot)
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
// Park space — a business park of blocks
// ---------------------------------------------------------------------------

/**
 * The park, and why the fifth level was cheaper than the fourth.
 *
 * §7.7.1 rung 5: past a hundred thousand developers a block is full, and the
 * thing that arrives is no longer a building — it is another **block**, on its
 * own parcel, across a boulevard. Ten of those is a business park and a million
 * people, which is where this scope stops.
 *
 * ## The lattice, measured
 *
 * A block's own cell is `blockFrame(10, 10)` — **765 x 629** block units, which
 * is a very different shape from the thing the block level had to arrange. Ten
 * towers is ten tall narrow objects and the packing problem is horizontal; ten
 * *blocks* is ten squarish objects, so the question is whether a 2:1 lattice of
 * them clears itself at all. It does, and unlike the block it clears completely:
 *
 * | Neighbour | Offset | Cell | Clear by |
 * |---|---|---|---|
 * | one column along | 430 x, 215 y | 382.5 wide | **47.5 units of boulevard** |
 * | one row back | -430 x, 215 y | 382.5 wide | 47.5 |
 * | one along *and* one nearer | 0 x, **430** y | 314.5 tall | **115.5** |
 *
 * That third row is the one the block could not satisfy — on a 2:1 lattice the
 * plot one column along and one row nearer sits at the *same x*, and at the
 * block level a 130-unit stride against a 290-unit tower put four towers half
 * in front of four others. A block is wider than it is tall where a tower is
 * the reverse, so the same lattice that overlaps towers separates blocks. **The
 * park is ten islands and nothing hides behind anything.**
 *
 * Which is also what makes it read as a park rather than as more city. §7.8.2
 * rule 2 says a rung change has to change the silhouette, and that "a business
 * park drawn with towers the height of rung 4's reads as more towers, closer
 * together" — the one thing a rung change must never look like. These are
 * further apart, on visible ground, with a boulevard between every pair, so the
 * towers become the texture of a parcel instead of being the subject.
 *
 * Measured at 997x448, ten full blocks: the composition is 2532 x 1390 park
 * units, height-bound, so it fills 421 px of 448 and 768 px of 997. A parcel is
 * **116 x 95 px** — nearly three times §23.4.2's 44 px box — and one tower
 * inside it is 17 x 46, which is a mark on a facade and no longer an object.
 */
/**
 * The compounds - how the ten blocks are grouped, and where each group sits.
 *
 * **[rewritten 2026-08-22]** The first version was a 5x2 grid of parcels on one
 * 1600-unit ground diamond, and the ground neither matched nor contained them:
 * ten blocks spilled onto a sheet. Reported as *"they spilled out to what seems
 * to be a mat that does not meet that size."*
 *
 * The replacement groups the same ten into four compounds of different sizes and
 * shapes and stands them on a **board** - a finite slab, cut to its contents,
 * with a near face and an edge. Blocks still fill in order, so the compounds
 * fill in order too: four, then two, then three, then one.
 *
 * ## The one number a layout is expensive by
 *
 * On this lattice the projected aspect is **2:1 whatever the arrangement**, so
 * the framed size of everything is governed by a single quantity: the sum of the
 * board's two lattice spans, `U + V`. Every unit added shrinks every tower.
 *
 *   5x2 grid, as built               U + V = 40.6   tower 16.9 px   block 219 px
 *   four compounds, first attempt            53.4          13.1            170
 *   four compounds, packed to budget         43.9          16.0            207
 *
 * The first attempt cost 22% and would have failed 7.8.2 rule 1 - a block at the
 * park must occupy about what a building did at the block. What the grouping
 * spends on gaps *between* compounds it has to save *inside* them, which is why
 * {@link PARK_IN_U} and {@link PARK_IN_V} are tighter than the old parcel
 * stride. The cost as built is 5%.
 */
export interface Compound {
  /** Silkscreen mark. */
  readonly tag: string
  /** How many blocks this compound holds. */
  readonly blocks: number
  readonly cols: number
  readonly rows: number
  /** The package's far corner, in plot-lattice units. */
  readonly u: number
  readonly v: number
}

export const COMPOUNDS: readonly Compound[] = [
  { tag: 'U1', blocks: 4, cols: 2, rows: 2, u: 0, v: 0 },
  { tag: 'U2', blocks: 2, cols: 1, rows: 2, u: 13.6, v: 0 },
  { tag: 'U3', blocks: 3, cols: 3, rows: 1, u: 0, v: 9.0 },
  { tag: 'U4', blocks: 1, cols: 1, rows: 1, u: 19.4, v: 9.0 },
]

export const BLOCKS_PER_PARK = COMPOUNDS.reduce((n, c) => n + c.blocks, 0)
export const BUILDINGS_PER_PARK = BUILDINGS_PER_BLOCK * BLOCKS_PER_PARK
export const PARK_CAP = BLOCK_CAP * BLOCKS_PER_PARK

/**
 * How much smaller a block is when it is one parcel of the park.
 *
 * The third nesting constant, and it does what {@link PLATE_SCALE} and
 * {@link BLOCK_SCALE} do: a parcel *is* the block's own frame divided by this,
 * so descending into it is a pure scale with nothing to cross-fade. Two is the
 * same divisor the block uses, for the same reason — it keeps the numbers in
 * every space within an order of magnitude of each other, which is what makes a
 * stray coordinate obviously stray.
 */
export const PARK_DIVISOR = 2
export const PARK_SCALE = 1 / PARK_DIVISOR

/**
 * How far past its plot lattice a parcel's deck reaches, in plot strides.
 *
 * **The plinth's geometry lives here and not in `park.ts`**, and that is §13's
 * finding arriving a third time: `towerSurfaceY` had to move because the frame
 * and the drawing were each deriving the tower's rake, and `PODIUM_W` had to
 * move because they were each deriving where a tower stops. A deck is the same
 * shape of thing — the frame has to span it and the park has to draw it — and
 * it was written down twice for exactly one screenshot, in which the leftmost
 * parcel was cut off by the edge of the window.
 *
 * The margin is bounded on both sides. A plot's pad is 1.62 strides across,
 * which is ±0.405 of a stride in lattice coordinates, so anything under that
 * leaves pads hanging off the deck. Above 1.4 the decks of two parcels meet:
 * neighbours are 6.615 strides apart along one lattice axis and a deck spans
 * `4 + 2m` of them. 0.62 sits between, with 1.4 strides of boulevard.
 */
export const DECK_MARGIN = 0.62

/** How tall the plinth's visible edge is — block units. */
export const DECK_LIP = 26

/**
 * One parcel's deck, in block space — four points, the plot lattice continued
 * past the plots.
 *
 * **A sheared rectangle and not a diamond**, which is {@link floorOutline}'s
 * rule two levels up and for the same reason: the plots are a rectangle of a
 * lattice whose axes are affine under the projection, so what they project to
 * is a parallelogram. The containing diamond would be 1,940 block units across
 * against an 860-unit parcel stride — it would pave the boulevard, the
 * neighbour, and the neighbour's boulevard.
 */
export function deckOutline(): Array<{ x: number; y: number }> {
  const m = DECK_MARGIN
  return [
    plotLatticeAt(-m, -m),
    plotLatticeAt(BLOCK_COLS - 1 + m, -m),
    plotLatticeAt(BLOCK_COLS - 1 + m, BLOCK_ROWS - 1 + m),
    plotLatticeAt(-m, BLOCK_ROWS - 1 + m),
  ]
}

/**
 * The four corners of a deck, named — because two of them are the ones you can
 * see the side of.
 *
 * In a 2:1 projection the lowest vertex is the near corner and the two edges
 * running down to it are the faces a slab shows. The first pass extruded
 * `far -> left` instead of `right -> near` and put a lit face on the *back* of
 * the plinth, which reads as the deck being lifted at the wrong end.
 */
export const DECK_FAR = 0
export const DECK_RIGHT = 1
export const DECK_NEAR = 2
export const DECK_LEFT = 3

/**
 * A point of a block's plot lattice, in block space — fractional on purpose.
 *
 * The deck's corners are `-DECK_MARGIN` and `4 + DECK_MARGIN`, which is the
 * lattice continued past the plots rather than a rectangle guessed around them,
 * and the walkways between parcels are anchored the same way. That is what
 * keeps every piece of a parcel's ground parallel to the things standing on it
 * at whatever margin somebody retunes this to.
 */
export function plotLatticeAt(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * PLOT_STRIDE_X,
    // The plots sit on the tower's own ground plane, which is where a building
    // meets the ground — `TOWER_GROUND`, and never `PLOT_DROP`, which is the
    // mistake that made the towers float.
    y: (col + row) * PLOT_STRIDE_Y + TOWER_GROUND * BLOCK_SCALE,
  }
}

/** The deck's bounding box, plinth included — block space. */
export function deckRect(): Rect {
  const pts = deckOutline()
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys) + DECK_LIP
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/**
 * How far a deck reaches along each lattice axis, in plot strides.
 *
 * A block is **wider than it is tall** - 5.24 across against 2.24 back - and
 * that asymmetry is the whole reason parcels can be separated at all where
 * towers cannot: the same 2:1 lattice that stands four of a block's towers half
 * in front of four others pulls two blocks completely apart.
 */
export const DECK_U = BLOCK_COLS - 1 + 2 * DECK_MARGIN
export const DECK_V = BLOCK_ROWS - 1 + 2 * DECK_MARGIN

/**
 * Deck to deck *inside* one compound, in plot strides.
 *
 * Tighter than the 6.615 the old grid used, and asymmetric for a reason that is
 * about towers rather than about ground. A tower is 130 park units tall; one
 * lattice step back drops the next deck 32.5 units. At 3.94 the near row's
 * towers land 128 units lower and only graze the far row's - enough separation
 * that ten blocks stay ten blocks, close enough that a compound reads as one
 * site rather than as rows on a shelf. Across, where nothing occludes anything,
 * 0.45 of a stride is all the street a boundary needs.
 */
export const PARK_IN_U = DECK_U + 0.45
export const PARK_IN_V = DECK_V + 1.7

/** How far a compound's package oversails the decks standing on it. */
export const PACKAGE_MARGIN = 0.75

/** How far the board runs past everything standing on it. */
export const BOARD_MARGIN_U = 1.8
export const BOARD_MARGIN_V = 1.7

/** Where the bus runs - the two clear channels between the packages. */
export const BUS_U = 13.0
export const BUS_V = 8.34

/**
 * A rectangle of the plot lattice, which is what every piece of ground above the
 * block is: `u0..u1` by `v0..v1`, in plot strides.
 */
export interface LatticeBox {
  u0: number
  u1: number
  v0: number
  v1: number
}

/**
 * Plant - the passives, and the reason there are transmission lines at all.
 *
 * **Each one arrives with the compound it serves.** Left standing from the first
 * block, the substation sits at the far end of the board and drags the framed
 * hull across the whole of it, so a studio of two hundred thousand is shown its
 * empty future at the price of every tower being half size.
 *
 * The footprint lives here rather than in `park.ts` for the reason `deckRect`
 * does: the frame has to span it and the park has to draw it, and geometry both
 * of them need cannot be written down twice. Trap 53 was exactly this and it
 * cost a parcel off the side of the window; the second draft of *this* layout
 * reproduced it by cutting the board to the parcels and leaving the cooling
 * plant hanging off the near edge.
 */
export interface Plant {
  readonly kind: 'substation' | 'cooling'
  readonly u: number
  readonly v: number
  /** The block count at which it is built. */
  readonly since: number
  readonly box: LatticeBox
}

export const PLANT: readonly Plant[] = [
  { kind: 'substation', u: 21.8, v: 0.4, since: 5, box: { u0: -0.7, u1: 3.5, v0: -0.7, v1: 2.4 } },
  { kind: 'cooling', u: 21.0, v: 4.2, since: 7, box: { u0: -0.6, u1: 4.4, v0: -0.6, v1: 2.6 } },
]

/** The plant standing at this block count. */
export function plantFor(blocks: number): readonly Plant[] {
  const n = Math.max(0, Math.min(BLOCKS_PER_PARK, Math.floor(blocks)))
  return PLANT.filter((it) => n >= it.since)
}

/** One plant item's footprint, in absolute lattice coordinates. */
export function plantBox(it: Plant): LatticeBox {
  return { u0: it.u + it.box.u0, u1: it.u + it.box.u1, v0: it.v + it.box.v0, v1: it.v + it.box.v1 }
}

/**
 * Where a parcel's plot lattice starts - the lattice coordinate of its plot
 * (0, 0), derived from the compound that holds it.
 *
 * Blocks are numbered across the whole park and compounds hold runs of them, so
 * this is the one place that knows a block belongs to a compound at all.
 */
const PARCEL_LATTICE: ReadonlyArray<{ u: number; v: number }> = COMPOUNDS.flatMap((c) => {
  const out: Array<{ u: number; v: number }> = []
  const inset = DECK_MARGIN + PACKAGE_MARGIN
  for (let r = 0; r < c.rows && out.length < c.blocks; r++) {
    for (let col = 0; col < c.cols && out.length < c.blocks; col++) {
      out.push({ u: c.u + inset + col * PARK_IN_U, v: c.v + inset + r * PARK_IN_V })
    }
  }
  return out
})

/** Which compound a block belongs to. */
const COMPOUND_OF: readonly number[] = COMPOUNDS.flatMap((c, i) =>
  Array.from({ length: c.blocks }, () => i),
)

export function compoundOf(block: number): number {
  return COMPOUND_OF[Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))]
}

/** A plot-lattice point, in park space - the projection, applied once. */
export function parkLatticeAt(u: number, v: number): { x: number; y: number } {
  return {
    x: (u - v) * PLOT_STRIDE_X * PARK_SCALE,
    y: (u + v) * PLOT_STRIDE_Y * PARK_SCALE + TOWER_GROUND * BLOCK_SCALE * PARK_SCALE,
  }
}

/**
 * The four park-space corners of a lattice box - far, right, near, left.
 *
 * **A sheared rectangle and not an axis-aligned one**, which is `deckOutline`'s
 * rule and `floorOutline`'s before it. The first draft of the board built its
 * packages from a bounding box in *park* space; a park-space box projects to a
 * screen-aligned rectangle, and a screen-aligned rectangle in a 2:1 world reads
 * as a sticker stuck on the picture rather than as ground under it.
 */
export function latticeCorners(box: LatticeBox): Array<{ x: number; y: number }> {
  return [
    parkLatticeAt(box.u0, box.v0),
    parkLatticeAt(box.u1, box.v0),
    parkLatticeAt(box.u1, box.v1),
    parkLatticeAt(box.u0, box.v1),
  ]
}

/** A lattice box as a park-space rectangle. */
export function latticeRect(box: LatticeBox): Rect {
  const pts = latticeCorners(box)
  const xs = pts.map((q) => q.x)
  const ys = pts.map((q) => q.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/** One parcel's deck, as a lattice box. */
export function deckBox(block: number): LatticeBox {
  const at = PARCEL_LATTICE[Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))]
  return {
    u0: at.u - DECK_MARGIN,
    u1: at.u - DECK_MARGIN + DECK_U,
    v0: at.v - DECK_MARGIN,
    v1: at.v - DECK_MARGIN + DECK_V,
  }
}

function unionBox(a: LatticeBox | null, b: LatticeBox): LatticeBox {
  if (!a) return { ...b }
  return {
    u0: Math.min(a.u0, b.u0),
    u1: Math.max(a.u1, b.u1),
    v0: Math.min(a.v0, b.v0),
    v1: Math.max(a.v1, b.v1),
  }
}

/**
 * One compound's package - the slab its blocks stand on, or null if none of them
 * is built yet.
 */
export function packageBox(compound: number, blocks: number): LatticeBox | null {
  const n = Math.max(0, Math.min(BLOCKS_PER_PARK, Math.floor(blocks)))
  const i = Math.max(0, Math.min(COMPOUNDS.length - 1, Math.floor(compound)))
  let box: LatticeBox | null = null
  for (let b = 0; b < n; b++) {
    if (COMPOUND_OF[b] !== i) continue
    box = unionBox(box, deckBox(b))
  }
  if (!box) return null
  return {
    u0: box.u0 - PACKAGE_MARGIN,
    u1: box.u1 + PACKAGE_MARGIN,
    v0: box.v0 - PACKAGE_MARGIN,
    v1: box.v1 + PACKAGE_MARGIN,
  }
}

/** Everything standing at this block count, as one lattice box. */
export function standingBox(blocks: number): LatticeBox {
  const n = Math.max(1, Math.min(BLOCKS_PER_PARK, Math.floor(blocks)))
  let box: LatticeBox | null = null
  for (let b = 0; b < n; b++) box = unionBox(box, deckBox(b))
  for (const it of plantFor(n)) box = unionBox(box, plantBox(it))
  return box as LatticeBox
}

/**
 * The board - laid once at ten blocks, and the camera frames the built part.
 *
 * A board that shrank as it filled would put the unbuilt pads *outside* their
 * own substrate, which is the spill this layout exists to remove arriving from
 * the other side. The rest of it runs off the frame exactly as the block's
 * street plane already does one rung down.
 */
export function boardBox(): LatticeBox {
  const all = standingBox(BLOCKS_PER_PARK)
  return {
    u0: all.u0 - BOARD_MARGIN_U,
    u1: all.u1 + BOARD_MARGIN_U,
    v0: all.v0 - BOARD_MARGIN_V,
    v1: all.v1 + BOARD_MARGIN_V,
  }
}

/**
 * One straight run of the bus, in lattice coordinates.
 *
 * **The routing lives here rather than in `park.ts`, and the reason is that it
 * was wrong twice.** The first version ran a full cross whose vertical arm went
 * straight through a package; the second anchored every tap half a stride away
 * from the thing it was tapping, so four taps rendered as eight bright dots
 * floating beside a line they never touched. Neither is visible to a test that
 * can only see a `Graphics`, and both are obvious to one that can see the
 * segments — *does this run cross a package, does that tap touch its own edge.*
 *
 * Same rule as the deck's outline and the plant's footprint, for the third
 * time: geometry somebody has to check does not live only in the drawing.
 */
export interface BusRun {
  readonly kind: 'main' | 'spur' | 'tap' | 'plant'
  readonly a: { u: number; v: number }
  readonly b: { u: number; v: number }
}

/**
 * Where the bus goes at this block count.
 *
 * A main along the channel between the two rows of packages, a spur down the
 * channel between the far row's two — **and the spur stops at the main**,
 * because past it the channel closes: the near row's packages are wider and
 * there is no gap there to run in.
 */
export function busRuns(blocks: number): BusRun[] {
  const n = Math.max(1, Math.min(BLOCKS_PER_PARK, Math.floor(blocks)))
  const frame = parkBox(n)
  const out: BusRun[] = []

  const mainU0 = Math.min(frame.u0 + 1.4, BUS_U - 1.2)
  const mainU1 = Math.max(frame.u1 - 1.4, BUS_U + 1.2)
  out.push({ kind: 'main', a: { u: mainU0, v: BUS_V }, b: { u: mainU1, v: BUS_V } })
  out.push({
    kind: 'spur',
    a: { u: BUS_U, v: Math.min(frame.v0 + 1.2, BUS_V - 1.2) },
    b: { u: BUS_U, v: BUS_V },
  })

  /*
   * A tap starts **on** its package and ends **on** the bus. Far-row packages
   * reach the spur sideways because that is the channel they have; everything
   * else reaches the main head-on.
   */
  for (let i = 0; i < COMPOUNDS.length; i++) {
    const box = packageBox(i, n)
    if (!box) continue
    const cu = (box.u0 + box.u1) / 2
    const cv = (box.v0 + box.v1) / 2
    if (box.v1 <= BUS_V) {
      const u = cu < BUS_U ? box.u1 : box.u0
      out.push({ kind: 'tap', a: { u, v: cv }, b: { u: BUS_U, v: cv } })
    } else {
      const v = cv < BUS_V ? box.v1 : box.v0
      out.push({ kind: 'tap', a: { u: cu, v }, b: { u: cu, v: BUS_V } })
    }
  }

  /*
   * **The plant chains rather than taps.** Both stand in the same bay at the
   * same u, so two independent runs would have put one straight through the
   * other. Power leaves the substation, passes through the cooling plant, and
   * joins the main — the shortest wiring and the true story at once.
   *
   * Three quarters along the overlap of the two footprints, which keeps the
   * lane clear of the nearest compound's tap; `frames.test.ts` asserts the gap
   * rather than trusting the fraction.
   */
  const live = plantFor(n)
  const sub = live.find((it) => it.kind === 'substation')
  const cool = live.find((it) => it.kind === 'cooling')
  if (sub && cool) {
    const a = plantBox(sub)
    const b = plantBox(cool)
    const u = Math.max(a.u0, b.u0) + (Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0)) * 0.75
    out.push({ kind: 'plant', a: { u, v: a.v1 }, b: { u, v: b.v0 } })
    out.push({ kind: 'plant', a: { u, v: b.v1 }, b: { u, v: BUS_V } })
  } else if (sub) {
    const a = plantBox(sub)
    const u = (a.u0 + a.u1) / 2
    out.push({ kind: 'plant', a: { u, v: a.v1 }, b: { u, v: BUS_V } })
  }

  return out
}

/**
 * How far a pin reaches out of the package it belongs to, in plot strides, and
 * how much room it must leave the bus.
 *
 * At half a stride a pin came within 0.16 of the run in the channel it points
 * into - four pixels at 1280 - so a row of them read as a ladder laid across
 * the line. Reported, with the arc artefact above it, as *"the lines are still
 * cross and diagonal"*: the bus was straight and something else was crossing it.
 */
export const PIN_REACH = 0.3
export const PIN_CLEARANCE = 0.45

/**
 * One pin, in lattice coordinates: out of `a`, ending at `b`.
 *
 * `front` is whether it leaves by an edge the camera can see the side of, which
 * is the only thing the drawing needs to know: a front pin is lifted against
 * the package's own face and drawn after it, a back pin lies on the board and
 * is drawn before it.
 */
export interface Pin {
  readonly a: { u: number; v: number }
  readonly b: { u: number; v: number }
  readonly front: boolean
}

/** Distance from a lattice point to an axis-aligned lattice segment. */
function distToRun(u: number, v: number, r: BusRun): number {
  const du = Math.max(Math.min(r.a.u, r.b.u) - u, 0, u - Math.max(r.a.u, r.b.u))
  const dv = Math.max(Math.min(r.a.v, r.b.v) - v, 0, v - Math.max(r.a.v, r.b.v))
  return Math.hypot(du, dv)
}

/**
 * A compound's pin row - the detail that says *component* rather than *plot of
 * land*, along two of its four edges.
 *
 * **A crowded edge moves to the opposite side rather than losing its pins.**
 * Dropping the individual pins that would reach into the bus was the first
 * answer and it was measured before it shipped: U1 lost its whole near row and
 * **U2 lost every pin it had**, because both of its camera-facing edges face a
 * bus line. A package with no pins is not a component any more.
 *
 * So an edge is used whole or not at all: if any pin on it would come within
 * {@link PIN_CLEARANCE} of a run, the row goes to the edge opposite. The back
 * edges are always clear here, and a pin emerging from behind a slab reads
 * perfectly well - it is the same object seen from its other side.
 */
export function pinRows(compound: number, blocks: number): Pin[] {
  const box = packageBox(compound, blocks)
  if (!box) return []
  const runs = busRuns(blocks)
  const step = (span: number) => span / Math.max(3, Math.round(span / 1.15))
  const su = step(box.u1 - box.u0)
  const sv = step(box.v1 - box.v0)

  const row = (
    along: 'u' | 'v',
    edge: number,
    dir: number,
    front: boolean,
  ): Pin[] | null => {
    const out: Pin[] = []
    if (along === 'v') {
      for (let v = box.v0 + sv / 2; v < box.v1; v += sv) {
        const tip = { u: edge + dir * PIN_REACH, v }
        if (runs.some((r) => distToRun(tip.u, tip.v, r) < PIN_CLEARANCE)) return null
        out.push({ a: { u: edge, v }, b: tip, front })
      }
    } else {
      for (let u = box.u0 + su / 2; u < box.u1; u += su) {
        const tip = { u, v: edge + dir * PIN_REACH }
        if (runs.some((r) => distToRun(tip.u, tip.v, r) < PIN_CLEARANCE)) return null
        out.push({ a: { u, v: edge }, b: tip, front })
      }
    }
    return out
  }

  return [
    ...(row('v', box.u0, -1, true) ?? row('v', box.u1, +1, false) ?? []),
    ...(row('u', box.v1, +1, true) ?? row('u', box.v0, -1, false) ?? []),
  ]
}

/** The part of the board the camera frames - what is built, plus its margin. */
export function parkBox(blocks: number): LatticeBox {
  const live = standingBox(blocks)
  return {
    u0: live.u0 - BOARD_MARGIN_U,
    u1: live.u1 + BOARD_MARGIN_U,
    v0: live.v0 - BOARD_MARGIN_V,
    v1: live.v1 + BOARD_MARGIN_V,
  }
}

/**
 * A full block's own cell — what a parcel is sized against, and what the park's
 * frame spans.
 *
 * **The towers *and* the ground they stand on.** The first version was
 * `blockFrame` alone, which is the ten towers, and the deck is half again as
 * wide as they are — so the park framed the buildings, drew a site around them,
 * and ran the leftmost parcel off the side of the window. Trap 49 in its usual
 * clothes: the note above claimed a clearance and the clearance was real, but
 * the *frame* was measuring a different object from the one being cleared.
 */
export function blockCell(): Rect {
  const towers = blockFrame(BUILDINGS_PER_BLOCK, FLOORS_PER_BUILDING)
  const deck = deckRect()
  const minX = Math.min(towers.cx - towers.w / 2, deck.cx - deck.w / 2)
  const maxX = Math.max(towers.cx + towers.w / 2, deck.cx + deck.w / 2)
  const minY = Math.min(towers.cy - towers.h / 2, deck.cy - deck.h / 2)
  const maxY = Math.max(towers.cy + towers.h / 2, deck.cy + deck.h / 2)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/**
 * Where a parcel's block stands, in park space.
 *
 * The same 2:1 and the same fill order as every lattice below it: parcels fill
 * the back row first, left to right, so the studio grows away from the camera
 * and the blocks you have longest are the ones furthest back.
 */
export function parcelAt(block: number): { x: number; y: number } {
  const at = PARCEL_LATTICE[Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))]
  // Without the ground term: block space carries its own, through `plotLatticeAt`.
  return {
    x: (at.u - at.v) * PLOT_STRIDE_X * PARK_SCALE,
    y: (at.u + at.v) * PLOT_STRIDE_Y * PARK_SCALE,
  }
}

/** How near the camera a parcel is. Larger is nearer, and is drawn later. */
export function parcelDepth(block: number): number {
  const at = PARCEL_LATTICE[Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))]
  return at.u + at.v
}

/** Map a block-space rectangle into park space, through parcel `block`. */
export function intoParcel(rect: Rect, block: number): Rect {
  const at = parcelAt(block)
  return {
    cx: at.x + rect.cx * PARK_SCALE,
    cy: at.y + rect.cy * PARK_SCALE,
    w: rect.w * PARK_SCALE,
    h: rect.h * PARK_SCALE,
  }
}

/** A block-space point, in park space, through parcel `block`. */
export function blockToPark(p: { x: number; y: number }, block: number): { x: number; y: number } {
  const at = parcelAt(block)
  return { x: at.x + p.x * PARK_SCALE, y: at.y + p.y * PARK_SCALE }
}

/** The inverse — a park-space point, in one parcel's block space. */
export function parkToBlock(p: { x: number; y: number }, block: number): { x: number; y: number } {
  const at = parcelAt(block)
  return { x: (p.x - at.x) / PARK_SCALE, y: (p.y - at.y) / PARK_SCALE }
}

/** A floor-space point, in park space — through the plate, the plot and the parcel. */
export function floorToPark(
  p: { x: number; y: number },
  storey: number,
  plot: number,
  block: number,
): { x: number; y: number } {
  return blockToPark(floorToBlock(p, storey, plot), block)
}

/** The address's own block, framed the way the block level frames it. */
function ownBlockFrame(storeys: number, buildings: number): Rect {
  return blockFrame(buildings, buildings > 1 ? FLOORS_PER_BUILDING : storeys)
}

/**
 * The whole park, framed — park space.
 *
 * Every occupied parcel is framed as if it held a **full** block, for the reason
 * {@link blockFrame} frames every plot as the tallest tower: parcels fill in
 * order, so the moment there are two of them the first is full and the cell
 * never changes again. A park measured off each block's actual size would
 * re-frame itself on every hire anywhere in it.
 *
 * The exception is the studio that has only one block, where the park *is* the
 * block and framing a full one would put a hundred thousand people's worth of
 * empty ground around a single tower. One parcel is framed at its true size, so
 * the two levels land on the same scale and {@link levelAtScale} reads a shared
 * scale as the inner one — the same collapse a single building on a block
 * already has, one level up.
 */
export function parkFrame(blocks: number, storeys: number, buildings: number): Rect {
  const n = Math.max(1, Math.min(BLOCKS_PER_PARK, Math.floor(blocks)))
  // A park of one block *is* that block: the same collapse a single building on
  // a block already has, and the reason the two rungs land on one scale.
  if (n <= 1) return intoParcel(ownBlockFrame(storeys, buildings), 0)

  const cell = blockCell()
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const take = (r: Rect) => {
    minX = Math.min(minX, r.cx - r.w / 2)
    maxX = Math.max(maxX, r.cx + r.w / 2)
    minY = Math.min(minY, r.cy - r.h / 2)
    maxY = Math.max(maxY, r.cy + r.h / 2)
  }
  // The towers, which rise out of the ground the box below only describes...
  for (let i = 0; i < n; i++) take(intoParcel(cell, i))
  // ...the board under them, out to its margin, so the composition has an edge
  // in the frame rather than running off one...
  take(latticeRect(parkBox(n)))
  // ...and the plant, which is the half of this the second draft forgot and
  // which is how a cooling plant ended up hanging off the near edge.
  for (const it of plantFor(n)) take(latticeRect(plantBox(it)))
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
}

/**
 * Which block a park-space point is over, or −1.
 *
 * Nearest parcel first, exactly as {@link buildingAtBlock} resolves nearest plot
 * first — but where that rule is *load-bearing* on the block, because towers
 * stand in front of one another, here it is a tie-break that can never fire:
 * the parcels do not overlap. It is written the same way anyway, so the two
 * levels cannot come to disagree about what "the one in front" means if the
 * lattice is ever tightened.
 *
 * The box is the whole parcel — its ground, not its towers — because at this
 * size the ground *is* the object: a tap between two towers of a block is a tap
 * on that block, and naming the parcel the finger landed in is the right answer
 * for a tap that came down on a car park.
 */
export function blockAtPark(x: number, y: number, blocks: number): number {
  const n = Math.max(0, Math.min(BLOCKS_PER_PARK, Math.floor(blocks)))
  const cell = blockCell()
  let best = -1
  let bestDepth = -1
  for (let i = 0; i < n; i++) {
    const r = intoParcel(cell, i)
    if (Math.abs(x - r.cx) > r.w / 2 || Math.abs(y - r.cy) > r.h / 2) continue
    const depth = parcelDepth(i)
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
  return Math.min(PARK_CAP - 1, s)
}

/**
 * Which building of the **park** holds a global seat — 0 to 99.
 *
 * Park-wide rather than block-local, and that is the opposite of the choice
 * {@link storeyOf} made when the block arrived. The difference is what each
 * number is *for*. A storey is only ever a storey of one tower, so every caller
 * wanted the local reading; a building is the unit `storeysIn` and `devsIn`
 * count people into, and those two want one number that walks the whole studio
 * rather than a pair that has to be carried around together.
 *
 * The block-local reading is {@link plotOf}, and it is needed in exactly the
 * places that draw: which of ten plots this building stands on.
 */
export function buildingOf(seat: number): number {
  return Math.floor(seatIn(seat) / BUILDING_CAP)
}

/** Which block of the park holds a global seat. */
export function blockOf(seat: number): number {
  return Math.floor(seatIn(seat) / BLOCK_CAP)
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

/** The first seat of a block — where descending into it lands. */
export function seatOfBlock(block: number): number {
  return Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block))) * BLOCK_CAP
}

/** The first seat of a building of the park — where descending into it lands. */
export function seatOfBuilding(building: number): number {
  return Math.max(0, Math.min(BUILDINGS_PER_PARK - 1, Math.floor(building))) * BUILDING_CAP
}

/**
 * The park-wide number of the building standing on one plot of one block.
 *
 * The one conversion the drawing side needs and the one the model side keeps
 * asking for. Everything that *draws* counts in plots, because a block has ten
 * of them; everything that counts *people* — `storeysIn`, `devsIn`, the store's
 * own unit ranges — counts in buildings, because the park has a hundred. Two
 * numberings meeting at a function is fine; two numberings meeting at a call
 * site is trap 38.
 */
export function buildingAt(plot: number, block: number): number {
  const k = Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))
  const i = Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(plot)))
  return k * BUILDINGS_PER_BLOCK + i
}

/** The first seat of one plot of one block — the same building, said the other way. */
export function seatOfPlot(plot: number, block: number): number {
  return seatOfBuilding(buildingAt(plot, block))
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

/**
 * How many blocks a headcount has put up. At least one — you are always
 * somewhere.
 */
export function blocksFor(devs: number): number {
  if (!Number.isFinite(devs) || devs <= 0) return 1
  return Math.max(1, Math.min(BLOCKS_PER_PARK, Math.ceil(devs / BLOCK_CAP)))
}

/**
 * How many buildings stand on one block of the park.
 *
 * **The block is not optional**, and that is trap 52a paid off in advance. This
 * was `buildingsFor(devs)` while there was one block to count on, and a default
 * of "the first one" would have made every existing call site quietly mean
 * *block 0* the moment there were ten — the same silent opt-in that moved a
 * floor of building 8 to building 1.
 */
export function buildingsIn(devs: number, block: number): number {
  const b = Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))
  const left = (Number.isFinite(devs) ? devs : 0) - b * BLOCK_CAP
  if (left <= 0) return b === 0 ? 1 : 0
  return Math.max(1, Math.min(BUILDINGS_PER_BLOCK, Math.ceil(left / BUILDING_CAP)))
}

/**
 * How many storeys stand in one building of the studio.
 *
 * Buildings fill in order, so this is the headcount left over once the
 * buildings before it are full — which means the first building is at ten the
 * moment there is a second one, and the last is the only one that grows.
 *
 * `building` is park-wide (0 to 99), the number {@link buildingOf} returns.
 */
export function storeysIn(devs: number, building = 0): number {
  const b = Math.max(0, Math.min(BUILDINGS_PER_PARK - 1, Math.floor(building)))
  const left = (Number.isFinite(devs) ? devs : 0) - b * BUILDING_CAP
  if (left <= 0) return b === 0 ? 1 : 0
  return Math.max(1, Math.min(FLOORS_PER_BUILDING, Math.ceil(left / DEVS_PER_FLOOR)))
}

/** How many developers stand in one building of the studio. */
export function devsIn(devs: number, building = 0): number {
  const b = Math.max(0, Math.min(BUILDINGS_PER_PARK - 1, Math.floor(building)))
  const left = (Number.isFinite(devs) ? devs : 0) - b * BUILDING_CAP
  return Math.max(0, Math.min(BUILDING_CAP, left))
}

/** How many developers stand on one block of the park. */
export function devsOnBlock(devs: number, block: number): number {
  const b = Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))
  const left = (Number.isFinite(devs) ? devs : 0) - b * BLOCK_CAP
  return Math.max(0, Math.min(BLOCK_CAP, left))
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
export function frameFor(
  level: Level,
  seat: number,
  storeys: number,
  buildings = 1,
  blocks = 1,
): Rect {
  const block = blockOf(seat)
  const plot = plotOf(buildingOf(seat))
  // The park is the only frame that is not inside a parcel, because it *is* the
  // parcels.
  if (level === PARK) return parkFrame(blocks, storeys, buildings)

  // The tallest tower, which the frame spans: buildings fill in order, so the
  // moment there are two of them the first is full and `storeys` is whichever
  // building the address is in rather than the highest one.
  if (level === BLOCK) return intoParcel(ownBlockFrame(storeys, buildings), block)

  const focus = storeyOf(seat)
  if (level === BUILDING) {
    return intoParcel(intoPlot(buildingFrame(storeys, focus), plot), block)
  }

  const local = Math.max(0, Math.floor(seat)) % DEVS_PER_FLOOR
  const inner =
    level === FLOOR ? floorFrame() : level === SQUAD ? squadFrame(seatFor(local).squad) : deskFrame(local)
  return intoParcel(intoPlot(intoPlate(inner, focus), plot), block)
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
  blocks = 1,
): Record<Level, number> {
  return nestScales({
    0: fitScaleFor(frameFor(DESK, seat, storeys, buildings, blocks), viewport),
    1: fitScaleFor(frameFor(SQUAD, seat, storeys, buildings, blocks), viewport),
    2: fitScaleFor(frameFor(FLOOR, seat, storeys, buildings, blocks), viewport),
    3: fitScaleFor(frameFor(BUILDING, seat, storeys, buildings, blocks), viewport),
    4: fitScaleFor(frameFor(BLOCK, seat, storeys, buildings, blocks), viewport),
    5: fitScaleFor(frameFor(PARK, seat, storeys, buildings, blocks), viewport),
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
  return cameraScale * PLATE_SCALE * BLOCK_SCALE * PARK_SCALE
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
 * How far into a level's own band its chrome has left — **measured in levels**.
 *
 * ## Why this is not a size, when almost everything else here is
 *
 * The rule this file is built on is *LOD by on-screen size, never by camera Z*,
 * and it is right for what it is for: {@link ROOM_RESOLVE_SCALE} asks "is a
 * desk big enough to draw a person on", which is a question about pixels and
 * has the same answer on every screen.
 *
 * **"Which level's picture is on screen" is not that question.** A bigger
 * window draws everything bigger at the *same* level, so floor-space scale at a
 * given level scales with the viewport — and a threshold placed between two
 * levels at one viewport falls on the wrong side of them at another. Measured,
 * with the block's chrome band written as 0.042–0.060 of floor scale:
 *
 * | Viewport | Floor scale at Block | Block chrome |
 * |---|---|---|
 * | 640x360 | 0.026 | 1.00 |
 * | 997x448 | 0.032 | 1.00 |
 * | 1280x720 | 0.051 | 0.48 |
 * | **1999x1115** | **0.079** | **0.00** |
 *
 * At a desktop window the block was **completely invisible while the block was
 * the subject**: nine towers at alpha zero, the tenth drawn because it is the
 * real building, and its plan laid across the plots either side of it. Reported
 * as "at 100k still just one tower", and every gate in the repo agreed with the
 * old numbers because the largest viewport any of them uses is 997x448.
 *
 * A composition hand-off is a question about the *ladder*, and the ladder is
 * viewport-independent by construction — `levelAtScale` measures against the
 * fitted scales, which move with the window exactly as the camera does.
 *
 * The bands below are the ones the old floor-scale numbers worked out to at the
 * reference frame, converted once: the chrome is whole 0.8 of a level inside
 * its own band and gone 0.25 of a level past the level below it. The overlap
 * {@link ROOM_RESOLVE_SCALE} was tuned for survives — the room still resolves
 * while the building is still drawn — and now it survives at every size,
 * instead of only at the one it was measured on.
 */
const CHROME_FULL = 0.8
const CHROME_GONE = 0.25

function chromeAlpha(level: number, below: number): number {
  if (!Number.isFinite(level)) return 1
  const t = (level - (below + CHROME_GONE)) / (CHROME_FULL - CHROME_GONE)
  const u = Math.max(0, Math.min(1, t))
  // Smoothstep, so the chrome does not appear or vanish with a visible kink at
  // either end of the band — §10.5's rule, applied to the fades that are left.
  return u * u * (3 - 2 * u)
}

/** 1 while the building is the subject, 0 once the room is. */
export function buildingChromeAlpha(level: number): number {
  return chromeAlpha(level, FLOOR)
}

/**
 * 1 while the block is the subject, 0 once a single building is.
 *
 * The band has to be crossed completely, and that is not housekeeping: the
 * building's pulled-out plan is 286 units wide against a 130-unit plot stride,
 * so a plan drawn while a neighbour is still on screen is drawn straight
 * through it.
 *
 * The plan fades in on `1 - blockChromeAlpha`, so the two trade places rather
 * than overlapping. That is a fade between *different objects*, which §10.5
 * allows; the thing it forbids is fading between two pictures of one object,
 * which is what the old ladder did and what the plot-to-tower hand-off
 * deliberately does not do — those two are the same drawing at the same size.
 */
export function blockChromeAlpha(level: number): number {
  return chromeAlpha(level, BUILDING)
}

/**
 * 1 while the park is the subject, 0 once a single block is.
 *
 * The same band one level up, and it carries one more thing than its neighbour
 * does: the block's own ground plane runs {@link GROUND_SPREAD} past its
 * outermost plot so that ten towers do not sit on a raft, and at parcel scale
 * that plane is wider than the boulevard between two parcels. So the park does
 * not merely fade *out* as the camera descends — the block's ground fades *in*
 * behind it on `1 - parkChromeAlpha`, and what the player sees at the park is
 * ten matching podiums rather than nine podiums and one city.
 *
 * Two different objects trading places, which §10.5 allows. The thing it
 * forbids — two pictures of one object — is not happening here: the towers
 * underneath are drawn once, by the block, at every level.
 */
export function parkChromeAlpha(level: number): number {
  return chromeAlpha(level, BLOCK)
}

/** Whether the room's individual people are worth building at this scale. */
export function roomResolved(floorScale: number): boolean {
  return floorScale >= ROOM_RESOLVE_SCALE
}
