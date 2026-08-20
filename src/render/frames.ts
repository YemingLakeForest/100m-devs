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
export type Level = 0 | 1 | 2 | 3

export const LEVELS: readonly Level[] = [DESK, SQUAD, FLOOR, BUILDING]

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
}
export const TOP_LEVEL = BUILDING

/** How many developers one unit at each level holds. */
export const LEVEL_DEVS: readonly number[] = [1, SQUAD_SIZE, ROOM_DEV_CAP, ROOM_DEV_CAP * 10]

/** §7.7.1's floor, and the room's own cap — the same thousand, by construction. */
export const DEVS_PER_FLOOR = ROOM_DEV_CAP
/** Ten storeys, which is where this scope stops: one building, 10,000 people. */
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

/** Ground clearance below the tower, for the plot and its shadow. */
export const PLOT_DROP = 58
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

/** How deep the tower is — the roof diamond, and the rake of both facades. */
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
  const maxY = Math.max(PLOT_DROP, plan.cy + plan.h / 2)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY }
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

/** Which storey of the building holds a global seat. */
export function storeyOf(seat: number): number {
  const s = Math.max(0, Math.floor(Number.isFinite(seat) ? seat : 0))
  return Math.min(FLOORS_PER_BUILDING - 1, Math.floor(s / DEVS_PER_FLOOR))
}

/** The first seat of a storey — where descending into it lands. */
export function seatOfStorey(storey: number): number {
  return Math.max(0, Math.min(FLOORS_PER_BUILDING - 1, Math.floor(storey))) * DEVS_PER_FLOOR
}

/** Which of the floor's ten squads a global seat is in. */
export function squadOf(seat: number): number {
  const local = Math.max(0, Math.floor(Number.isFinite(seat) ? seat : 0)) % DEVS_PER_FLOOR
  return seatFor(local).squad
}

/** The first seat of a squad, within its own floor. */
export function seatOfSquad(storey: number, squad: number): number {
  return seatOfStorey(storey) + Math.max(0, Math.floor(squad)) * SQUAD_SIZE
}

/** How many storeys a headcount has built. At least one — you are always somewhere. */
export function storeysFor(devs: number): number {
  if (!Number.isFinite(devs) || devs <= 0) return 1
  return Math.max(1, Math.min(FLOORS_PER_BUILDING, Math.ceil(devs / DEVS_PER_FLOOR)))
}

/**
 * Does a double tap descend a level from here — §7.7.6's navigation gesture.
 *
 * Two conditions, and the second one is the interesting one.
 *
 * It descends from the floor and from the squad, because those are the levels
 * with something under them. And it descends **only once there is more than one
 * squad to choose between**, which is the lift panel's own argument — *a lift
 * with one button is furniture* — applied to a gesture instead of a control. A
 * studio of two people is one squad: descending into it names the group the
 * player is already looking at, and the level below is the same two people
 * drawn larger.
 *
 * What it costs to offer it anyway is not nothing. The descend consumes the
 * tap, so **the second tap does not code**, and §21 Act I boots with POKE
 * latched over a script that reads TAP TO CODE. Clicking *is* the game there,
 * and a player clicking at any speed a clicker is played at produces a double
 * tap on every second click: half their taps went to navigation, and the
 * navigation flew the camera onto the person they were coding at. Reported as
 * "when there's only James and us, clicking one of us to code, it should not
 * zoom to the person".
 *
 * Nothing is lost above a squad's worth of people, and nothing is lost below it
 * either: the address ladder, the wheel and the pinch all still navigate, and
 * §7.7.6b's INSPECT tap still names whoever is under it.
 */
export function descendOnDoubleTap(level: Level, devs: number): boolean {
  if (level !== FLOOR && level !== SQUAD) return false
  return (Number.isFinite(devs) ? devs : 0) > SQUAD_SIZE
}

/**
 * The frame a level names, **always in building space**.
 *
 * One space for every level is what lets the camera be a single scale and
 * centre — the floor's three frames are simply the same rectangles seen from
 * inside the plate that holds them.
 */
export function frameFor(level: Level, seat: number, storeys: number): Rect {
  const focus = storeyOf(seat)
  if (level === BUILDING) return buildingFrame(storeys, focus)

  const local = Math.max(0, Math.floor(seat)) % DEVS_PER_FLOOR
  const inner =
    level === FLOOR ? floorFrame() : level === SQUAD ? squadFrame(seatFor(local).squad) : deskFrame(local)
  return intoPlate(inner, focus)
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
): Record<Level, number> {
  return nestScales({
    0: fitScaleFor(frameFor(DESK, seat, storeys), viewport),
    1: fitScaleFor(frameFor(SQUAD, seat, storeys), viewport),
    2: fitScaleFor(frameFor(FLOOR, seat, storeys), viewport),
    3: fitScaleFor(frameFor(BUILDING, seat, storeys), viewport),
  })
}

/**
 * Force the ladder to nest — **no level may frame less than the level inside
 * it**.
 *
 * The four frames are nested by construction: a desk is in a squad, a squad is
 * on a floor, a floor is in a building. The *room* is not, because §7.8.1's
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
  if (s <= Math.log(scales[TOP_LEVEL])) return TOP_LEVEL
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
 * Floor space lives inside a plate, so everything the room draws is a factor of
 * {@link PLATE_DIVISOR} smaller than the camera says. Every LOD threshold below
 * is expressed in this rather than in camera scale, so it is a statement about
 * how big a desk is on screen and stays true if the stack is retuned.
 */
export function floorScaleAt(cameraScale: number): number {
  return cameraScale * PLATE_SCALE
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

/** Whether the room's individual people are worth building at this scale. */
export function roomResolved(floorScale: number): boolean {
  return floorScale >= ROOM_RESOLVE_SCALE
}
