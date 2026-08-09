/**
 * Level 1 — the room. GDD §7.8.1, and the §7.7.1 rungs it covers.
 *
 * This tier is not "a desk". It is **the whole of the studio from one developer
 * to about a hundred**, because §7.7.1 caps the zoom ceiling at one room until
 * the headcount earns more — so everything in rungs 0–2 has to happen here.
 *
 * §7.8.1's table is the brief and it is followed literally:
 *
 *   1        one desk in a dark bedroom, lit only by the monitor
 *   2        a second desk pushed alongside. James
 *   3–5      a huddle facing inward. Whiteboard, the first plant
 *   6–10     a small office, two rows, a walkway. Coffee machine
 *   11–30    walls push out. Dividers. A server rack
 *   31–100   a full open-plan floor. Cable runs
 *   301+     shoulder to shoulder — **props start disappearing**
 *
 * That last line is the point of the whole section. Above roughly three hundred
 * the room stops gaining things and starts losing them: the dividers go, the
 * plant goes, the walkway becomes desks. **The room gets worse as it gets
 * fuller**, which is the §6 thesis told in set dressing before any number says
 * it.
 *
 * Everything here is drawn in code from the master palette — ART_DIRECTION §4
 * classes room furniture as T3 commodity, buyable or generatable, and none of
 * it is authored yet. It reads as composed and in-palette rather than as pixel
 * art, and it is built so authored sprites drop into the same slots later.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { createAmbient, type Seat } from './ambient.ts'
import { developerAt, type Look } from '../sim/identity.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** 2:1 isometric — ART_DIRECTION §1. Shared with scene.ts. */
const TILE_W = 64
const TILE_H = 32

/**
 * Most developers this tier ever draws individually.
 *
 * §7.7.1's zoom ceiling opens the floor tier at 100, so this only has to cover
 * rungs 0–2 with headroom. Past it the swarm is the floor's job and these
 * become 1,000 particles instead.
 */
export const ROOM_DEV_CAP = 120

/**
 * Desk pitch — **different along a row and between rows**, which is the whole
 * of why an office looks like an office.
 *
 * And rows run **horizontally across the screen**. That is a deliberate break
 * from laying them along an isometric axis, which is what a grid-index
 * projection gives you for free and which put every row on a 26.5-degree
 * diagonal. People sit *side by side*. A row climbing away up-right reads as a
 * queue rather than as a bank of desks, and at forty of them the floor looks
 * like a staircase.
 *
 * The objects are still drawn in the 2:1 projection — desks, monitors and
 * bodies all recede exactly as before. Only their *arrangement* is
 * screen-aligned, which is legal here because this floor has no drawn tile
 * grid for a horizontal line to disagree with.
 *
 * A single uniform pitch spaces every desk equally in all four directions, and
 * the result reads as a *car park*: a lattice of identical objects with no
 * grain, no front, and no way to tell which direction anyone is meant to walk.
 * Real floors are not laid out that way. Desks are butted together
 * shoulder-to-shoulder into rows, and the space is taken out *behind* the row,
 * where people actually need to get past.
 *
 * `isoAt`'s `col` runs along a row and `row` steps back to the next one, so
 * the two pitches map straight onto that: tight across, generous behind. The
 * ratio between them is the aisle, and it is the reason a floor at forty
 * developers reads as rows of workers rather than as a grid of dots.
 *
 * **The ratio wants to be larger than it first looks.** A first pass at
 * 0.96/1.62 was already a clear improvement over uniform spacing and still read
 * as a slightly-stretched grid: at 2.3x the desks are unmistakably *in rows*,
 * with a gap you could walk down. The reason is that the aisle competes with a
 * desk's own footprint, not with the gap between desks — the desk is nearly a
 * tile wide on its own, so an aisle only reads as an aisle once it is wider
 * than the thing it runs past.
 */
/**
 * Desk-to-desk **along a row**, in floor tiles. Exactly one, so a row of desks
 * is a continuous run with no gap and no overlap — shoulder to shoulder.
 */
export const PITCH_COL = 1
/**
 * Row to row, **across** the rows, in floor tiles. The aisle.
 *
 * Bigger than one, and that gap is the whole grain of the floor: desks are
 * butted together along a row and the space is taken out *behind* it, where
 * people actually need to get past. 2.1 tiles leaves an aisle a little wider
 * than a desk is deep, which is about what an office gives you.
 *
 * There is no shear constant any more. Rows step back along the floor's own
 * second axis, so the offset between one row and the next is a fact about the
 * projection rather than a number somebody chose — which is what
 * {@link ROW_SHEAR} was, and it existed only to prop up a layout that ran the
 * rows across the screen instead of across the floor.
 */
export const PITCH_ROW = 2.1

/**
 * §7.8.1a — **the squad**. Ten by ten desks, a hundred people who can see each
 * other, and the unit a poke lands in.
 *
 * The row width is a *constant*, and that is the whole of §7.8.1b. What was
 * here before solved for a square-ish footprint at every headcount, so the row
 * width changed as the studio grew — and a row that widens **moves everybody
 * already sitting in it**. Hiring the seventh developer re-flowed the other
 * six into different seats, which is precisely the failure §7.8.1b names: *a
 * scattered fill is indistinguishable from a redraw*. The player cannot see
 * where the last hire went if the last hire rearranged the room.
 *
 * The cost is one line of §7.8.1's older table: "6–10, a small office, **two
 * rows**". Eight developers now sit in one row of eight rather than two of
 * four, because the alternative is a floor that reshuffles under them. §7.8.1a
 * and §7.8.1b are the later canon and they win; the table's other bands are
 * unaffected, and "2 — a second desk pushed alongside" still reads exactly as
 * written.
 */
export const SQUAD_COLS = 10
export const SQUAD_ROWS = 10
/** One squad — §7.8.1a's hundred, and the size the room starts out fitting. */
export const SQUAD_SIZE = SQUAD_COLS * SQUAD_ROWS

/** §7.8.1a — **the floor**. Ten by ten squads, so ten thousand people. */
export const FLOOR_COLS = 10
export const FLOOR_ROWS = 10
export const FLOOR_SQUADS = FLOOR_COLS * FLOOR_ROWS
export const FLOOR_SIZE = SQUAD_SIZE * FLOOR_SQUADS

/**
 * §7.8.1a — **the corridor**, in the same units as the two desk pitches.
 *
 * Not decoration. It is what makes a hundred squads read as a hundred *squads*
 * rather than as ten thousand identical dots, and §7.8.6's walkers belong in
 * it. Wider across than back for the same reason the desk pitches are: a
 * corridor has to beat a desk's own footprint before it reads as a corridor,
 * and a desk is nearly a tile wide.
 */
export const CORRIDOR_COLS = 2.6
export const CORRIDOR_ROWS = 2.0
/** Squad origin to squad origin, in seat units. */
export const SQUAD_STRIDE_COLS = SQUAD_COLS + CORRIDOR_COLS
export const SQUAD_STRIDE_ROWS = SQUAD_ROWS + CORRIDOR_ROWS
/**
 * How much of the corridor the squad's own floor plate takes, each side.
 *
 * Less than half, so what is left between two plates is a visible gap rather
 * than a seam. That gap *is* the corridor; the plates do not draw it.
 */
const PLATE_PAD_COLS = 0.8
const PLATE_PAD_ROWS = 0.6

/** §7.8.1 — the headcount at which the room stops gaining and starts losing. */
const CROWDING_STARTS = 40

/** §7.8.8 — how long a developer takes to turn round. */
export const TURN_MS = 400

/**
 * The horizontal squash through a turn, and where the pose swaps.
 *
 * A 2D figure turns by being squashed to nothing and coming back the other way
 * round; the pose swaps at the pinch, where there is nothing on screen to see it
 * happen. It is the oldest trick in sprite animation and still the only one
 * that works without a second set of art.
 *
 * Returns the x-scale, 1 -> 0 -> 1. Eased so the pinch is quick and the arrival
 * has weight — a linear turn reads as a card flipping, not as a person moving.
 */
export function turnScale(t: number): number {
  if (t <= 0 || t >= 1) return 1
  const u = Math.abs(t * 2 - 1)
  return 0.06 + 0.94 * u * u
}

/**
 * §7.8.3's idle, as a **hop** rather than a bob.
 *
 * The idle used to be `sin(t)` on Y, which is a float: the figure is never
 * still, never in contact with anything, and spends exactly as long going up as
 * coming down. At one developer it reads as breathing and at forty it reads as
 * a field of buoys.
 *
 * A hop is the same one-sine budget spent differently, and the difference is
 * entirely in the **contact**. Half the cycle is airborne on a ballistic arc;
 * the other half the figure is *down*, planted, doing nothing. Stillness is what
 * makes the motion read as a push against something, and it is also what keeps
 * a crowd legible — at any instant about half the floor is at rest, so the eye
 * has somewhere to land.
 *
 * Split into three pure functions of one phase because they are the only part
 * of the figure a test can see. `phase` is in whole hops: its integer part
 * counts hops taken, its fraction is the position within the current one.
 */
/** Fraction of a hop spent in the air. The rest is planted. */
export const HOP_AIRBORNE = 0.5
/** Peak height of a hop, in room units. */
export const HOP_HEIGHT = 4.2
/** Sideways lean at the top of a hop. This is the "about" in "hop about". */
export const HOP_SWAY = 1.3
/** How far the figure compresses on impact and again into the next launch. */
export const HOP_SQUASH = 0.1

/** Height of the hop at `phase`, 0 (planted) to 1 (top of the arc). */
export function hopHeight(phase: number): number {
  const u = phase - Math.floor(phase)
  if (u >= HOP_AIRBORNE) return 0
  const a = u / HOP_AIRBORNE
  // A parabola, not a sine half-cycle: gravity means the figure hangs near the
  // top and is quickest at take-off and landing. Peaks at exactly 1.
  return 1 - (2 * a - 1) ** 2
}

/**
 * Sideways lean at `phase`, -1..1, alternating direction each hop.
 *
 * A hop that only goes up and down is a pogo stick. Alternating the lean turns
 * the same motion into somebody shifting their weight about, and because it is
 * tied to {@link hopHeight} it is exactly zero whenever they are on the ground —
 * so nobody drifts off their desk however long the game runs.
 */
export function hopSway(phase: number): number {
  const dir = Math.floor(phase) % 2 === 0 ? 1 : -1
  return dir * hopHeight(phase)
}

/**
 * Vertical scale at `phase`. 1 at rest, less when compressed.
 *
 * Deepest on the frame of impact and again at the crouch that launches the next
 * hop — both discontinuities are deliberate. An impact that eases *in* is not an
 * impact, and the release at take-off is the whole point of the crouch.
 */
export function hopSquash(phase: number): number {
  const u = phase - Math.floor(phase)
  if (u < HOP_AIRBORNE) return 1
  const g = (u - HOP_AIRBORNE) / (1 - HOP_AIRBORNE)
  const land = Math.max(0, 1 - g / 0.35)
  const crouch = Math.max(0, (g - 0.75) / 0.25)
  return 1 - HOP_SQUASH * Math.min(1, Math.max(land, crouch))
}

/**
 * How far the drawn body sits below its container's origin.
 *
 * {@link hopSquash} scales about that origin, and the origin is at the waist
 * rather than under the seat — so a squash would lift the bottom of the figure
 * off the chair unless it is compensated. One multiply, and without it the
 * whole floor twitches upward on every landing.
 */
export const BODY_BASE = 9

export interface RoomHandle {
  container: Container
  /**
   * Rebuild for a headcount. Called when `devs` changes, never per frame —
   * this rebuilds geometry and is far too expensive for the ticker.
   */
  setHeadcount(devs: number): void
  /** §7.8.7 — set the run seed. Rebuilds every developer's appearance. */
  setSeed(seed: number): void
  /** §7.8.8 — who is turned round to face the camera. -1 for nobody. */
  setSelected(index: number): void
  /** §7.8.9 — the floor as a toy. Room-local coordinates throughout. */
  readonly hands: {
    isLoitering(i: number): boolean
    pickUp(i: number): boolean
    carryTo(x: number, y: number): void
    drop(seat: number | null): 'seated' | 'walking' | 'none'
    readonly carrying: number
  }
  /**
   * Advance the §7.8.3 idle animation. `elapsed` in seconds, `state` is the
   * shared §8.2 dev state (the store models one machine, not one per person).
   */
  /**
   * Advance the §7.8.3 idle animation and §7.8.6's ambient life.
   *
   * `dt` is separate from `elapsed` because the two want different clocks: the
   * bob is a function of absolute time, so it is continuous across a rebuild,
   * while ambient behaviours age and must not jump when a hidden tab wakes up.
   */
  animate(elapsed: number, state: string, dt?: number, entropy?: number): void
  /** Jolt developer `i` — the §8.2 poke reaction. */
  jolt(i: number): void
  /** Where developer `i` sits, in room-local coordinates. Null if not drawn. */
  deskAt(i: number): { x: number; y: number } | null
  /**
   * Where seat `i` *would* be, drawn or not — §7.7.2's arrivals.
   *
   * {@link deskAt} answers only for seats the room has already built, and an
   * arrival needs the position of a seat precisely while it is being withheld:
   * the room must not draw the new hire until the falling silhouette has
   * landed, so for the whole of the animation the one position the renderer
   * needs is the one `deskAt` returns null for.
   *
   * Pure, and independent of the pivot — everything under `container` shares
   * that transform, so a seat's local coordinates do not move when the plate
   * re-centres around a hire.
   */
  deskFor(i: number): { x: number; y: number }
  /** How many developers are actually on screen. */
  readonly drawn: number
  /** Live bounding size, for the §23.4.1 camera fit. Grows with the room. */
  readonly extent: { w: number; h: number }
}

/**
 * A point on the floor grid, projected — the one place the 2:1 goes in.
 *
 * `gx` runs along the rows and `gy` across them, both in tile widths. This is
 * the standard 2:1 isometric map and everything on the floor goes through it,
 * so nothing can end up in a different projection from the room it is in.
 */
function gridToScreen(gx: number, gy: number) {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) }
}

/**
 * Where seat (`col`, `row`) sits, in room-local coordinates.
 *
 * **The rows run along the floor, parallel to the wall.** That is what a row
 * *is* in an isometric room, and it is the correction to the version of this
 * function that stood here for months:
 *
 *     x = col * PITCH_COL * TILE_W - row * ROW_SHEAR * TILE_W
 *     y = row * PITCH_ROW * (TILE_H / 2)
 *
 * — which laid the rows out **level across the screen**, deliberately, with a
 * long comment defending it ("people sit side by side; a row climbing away
 * up-right reads as a queue"). The reasoning is what you get from looking at a
 * row in isolation, and it is wrong as soon as the row is in a room: the walls,
 * the floor plate, the corridors, the desks and the props all recede along the
 * isometric axes, and a bank of desks running flat across the frame is the one
 * thing in the picture that does not lie in the floor plane. It reads as
 * furniture skewed off the ground — which is exactly how it was reported, as
 * rows that "are diagonal, not horizontal to the office layout".
 *
 * A row is horizontal **to the room**, not to the monitor. On screen that is a
 * 26.5-degree line, parallel to a wall, and it is the same line the plate edges
 * and the corridors already run along.
 *
 * **Which of the two floor axes is not a free choice**, and picking the wrong
 * one produces a picture that is isometrically correct and still wrong. A row
 * is *people sitting next to each other*, so it has to run **across** the way
 * they are facing. `drawWorkstation` turns the screen south-east, which puts
 * the developer looking north-west — so laying the row along that same axis
 * sits every developer directly behind the next one. That is a queue, not a
 * row, and it is what the first attempt at this built.
 *
 * So a row runs **south-west**, along `gy`, and the next row steps south-east
 * along `gx`, toward the camera. Shoulder to shoulder across the frame,
 * parallel to the left-hand wall, with the row in front and the row behind
 * where those words say they should be.
 *
 * **Row 0 is still the back row**, and index order is still very nearly the
 * painter order: every seat that can overlap another has a greater `y` than the
 * one it covers, because both axes push down the screen. The pairs where index
 * order and depth disagree are more than a desk apart on screen and cannot
 * overlap at all.
 */
function isoAt(col: number, row: number) {
  // `col` — the seat's place *along* its row — drives `gy`; `row` drives `gx`.
  return gridToScreen(row * PITCH_ROW, col * PITCH_COL)
}

function isoQuad(g: Graphics, cx: number, cy: number, w: number, h: number, fill: number) {
  g.moveTo(cx, cy - h / 2)
    .lineTo(cx + w / 2, cy)
    .lineTo(cx, cy + h / 2)
    .lineTo(cx - w / 2, cy)
    .closePath()
    .fill(fill)
}

/**
 * A solid standing on the floor — three faces, drawn in the 2:1 projection.
 *
 * Everything in this room that has volume goes through here. The props used to
 * be flat screen-aligned rectangles, which is the single most obvious way to
 * break an isometric scene: a cabinet drawn as an upright rectangle in a room
 * where the floor, desks and walls all recede reads as a sticker on the glass,
 * and the eye finds it instantly even when it cannot say why.
 *
 * `(x, y)` is the centre of the **footprint**, so a prop is positioned by where
 * it stands rather than by where its art happens to begin. `w` is the screen
 * width of that footprint; its screen height is `w / 2`, which is what 2:1
 * means.
 *
 * Shading follows ART_DIRECTION §7's single top-left source, and it is worth
 * being explicit about which face that makes lighter, because it is easy to get
 * backwards: both visible vertical faces point *downward*, so the one facing
 * down-**left** is the one turned toward the light. Left face lighter, right
 * face darker, top lightest of all.
 */
function isoBox(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: readonly string[],
  base: number,
  grounded = true,
) {
  const q = w / 4
  // The contact shadow, and it is not decoration. A solid with nothing beneath
  // it reads as **floating** in an isometric scene however correctly it is
  // placed, because the projection throws away the one depth cue — occlusion at
  // the base — that says "this is standing on that". Cheaper and more effective
  // than any amount of repositioning. Offset down-right, away from
  // ART_DIRECTION §7's top-left source.
  //
  // `grounded` is false for anything stacked on top of something else, which
  // has a contact patch but not a floor.
  if (grounded) {
    g.ellipse(x + w * 0.07, y + q * 0.16, w * 0.56, w * 0.28).fill({
      color: c(RAMPS.NEUTRAL[0]),
      alpha: 0.4,
    })
  }
  const top = c(ramp[Math.min(ramp.length - 1, base + 1)])
  const left = c(ramp[base])
  const right = c(ramp[Math.max(0, base - 1)])

  g.moveTo(x - w / 2, y - h)
    .lineTo(x, y - h + q)
    .lineTo(x, y + q)
    .lineTo(x - w / 2, y)
    .closePath()
    .fill(left)
  g.moveTo(x + w / 2, y - h)
    .lineTo(x, y - h + q)
    .lineTo(x, y + q)
    .lineTo(x + w / 2, y)
    .closePath()
    .fill(right)
  g.moveTo(x, y - h - q)
    .lineTo(x + w / 2, y - h)
    .lineTo(x, y - h + q)
    .lineTo(x - w / 2, y - h)
    .closePath()
    .fill(top)
}

/**
 * A flat panel lying **in** a wall plane rather than parallel to the screen.
 *
 * A whiteboard is a rectangle in the world and a parallelogram on the screen:
 * its horizontal edges run along the wall, so they rise or fall at the wall's
 * slope, while its vertical edges stay vertical. `slope` is that wall's — with
 * the room's own geometry passed in, so this stays correct if the projection
 * ratio ever changes.
 *
 * `(x, y)` is the centre of the panel's top edge.
 */
function wallQuad(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  slope: number,
  fill: number,
) {
  const dy = (slope * w) / 2
  g.moveTo(x - w / 2, y - dy)
    .lineTo(x + w / 2, y + dy)
    .lineTo(x + w / 2, y + dy + h)
    .lineTo(x - w / 2, y - dy + h)
    .closePath()
    .fill(fill)
}

/**
 * The occupied block **inside one squad** at this headcount.
 *
 * Rows are ten wide and fill left to right; the block is as many rows deep as
 * the headcount has started. That is §7.8.1b stated as arithmetic, and the
 * property that matters is the one it is easy to miss: `cols` does not depend
 * on `devs` above ten, so **a seat, once taken, never moves**.
 *
 * The floor plate is sized from this rather than from the squad, so §7.8.1's
 * first frame is still a bedroom that hugs the one person in it.
 */
export function gridFor(devs: number): { cols: number; rows: number } {
  const n = Math.max(1, Math.min(SQUAD_SIZE, Math.floor(devs)))
  const cols = Math.min(SQUAD_COLS, n)
  return { cols, rows: Math.ceil(n / SQUAD_COLS) }
}

/** Where seat `index` sits — §7.8.1a's two scales, and §7.8.1b's reading order. */
export interface SeatPlace {
  /** Which of the floor's hundred squads. */
  squad: number
  /** Column and row **within** that squad, 0–9. */
  col: number
  row: number
  /** The squad's own column and row on the floor, 0–9. */
  squadCol: number
  squadRow: number
}

/**
 * §7.8.1b — seat `index`, at both scales, in one reading order.
 *
 * Hire one and they take the next seat in the current row; fill the row and
 * the next row starts; fill the squad and the next squad starts, **and squads
 * fill row by row too**. The same two lines of arithmetic express both,
 * which is the point: the rule is meant to read identically at either scale.
 */
export function seatFor(index: number): SeatPlace {
  const i = Math.max(0, Math.floor(index))
  const squad = Math.floor(i / SQUAD_SIZE)
  const within = i % SQUAD_SIZE
  return {
    squad,
    col: within % SQUAD_COLS,
    row: Math.floor(within / SQUAD_COLS),
    squadCol: squad % FLOOR_COLS,
    squadRow: Math.floor(squad / FLOOR_COLS),
  }
}

/** Seat `index` as absolute grid coordinates, corridors included. */
export function seatGrid(index: number): { col: number; row: number } {
  const p = seatFor(index)
  return {
    col: p.squadCol * SQUAD_STRIDE_COLS + p.col,
    row: p.squadRow * SQUAD_STRIDE_ROWS + p.row,
  }
}

/**
 * Where seat `index` sits, in room-local coordinates — the pure form.
 *
 * `RoomHandle.deskFor` is this, and so is the position the build loop lays
 * out. Exported because it is the only honest way to ask "which direction does
 * a row run" without standing up a renderer, and that question has now been got
 * wrong twice.
 */
export function seatPosition(index: number): { x: number; y: number } {
  const { col, row } = seatGrid(index)
  return isoAt(col, row)
}

/**
 * The screen bounding box of everything between two grid coordinates.
 *
 * The one piece of arithmetic R6 turns on. The desk block is **sheared** —
 * rows run level and each row behind steps left by {@link ROW_SHEAR} — so its
 * four screen corners are not the four grid corners, and sizing the floor from
 * a count of desks (which is what this replaced) leaves the corners of the
 * block hanging over the edge of the plate. That is the "desks walk off the
 * floor" defect, and it is visible from about forty developers.
 */
export function blockBox(
  minCol: number,
  minRow: number,
  maxCol: number,
  maxRow: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    // Each screen extreme is one corner of the grid rectangle, and they are
    // four *different* corners: `x` runs on `row − col` and `y` on `row + col`,
    // so left and right are the two off-diagonal corners and top and bottom the
    // two on-diagonal ones. Under the old level-row layout `y` did not depend
    // on the column at all and `x` barely on the row, so three of these four
    // could be read off the wrong corner and still come out right.
    minX: isoAt(maxCol, minRow).x,
    maxX: isoAt(minCol, maxRow).x,
    minY: isoAt(minCol, minRow).y,
    maxY: isoAt(maxCol, maxRow).y,
  }
}

/**
 * The half-width of the iso floor diamond that **contains** a block of that
 * size — §7.8.1a, "nothing is ever placed outside the plate".
 *
 * A diamond with half-extents (W, W/2) contains a box of half-extents (bw, bh)
 * only when `bw / W + bh / (W / 2) <= 1`, so the width has to cover the block's
 * height twice over. Sizing it as `max(width, height)` — the previous rule —
 * satisfies that only while the block is nearly flat, which is exactly why the
 * overflow appeared as the studio got deeper rather than wider.
 */
export function plateHalfWidth(bw: number, bh: number, margin: number): number {
  return bw + 2 * bh + margin * TILE_W
}

/**
 * §7.8.1c — the unfold. **The hundredth hire fills the first squad, and the
 * room has nowhere to put the hundred and first.**
 *
 * Three curves, pure, because the animation is the whole requirement and none
 * of it is checkable through Pixi. `t` is progress through the whole event;
 * each panel gets its own window inside it.
 *
 * It is **not scored here**, and that is not an omission: a hundred developers
 * is a §7.7.1 rung boundary, so `stage.ts` is already firing the promotion
 * stinger, the zoom-ceiling reveal and the dolly on that exact hire. A second
 * cue laid on top would be two things scoring one event.
 */
export const UNFOLD_MS = 2600
/** Fraction of the event spent releasing panels; the rest is one panel's turn. */
const UNFOLD_STAGGER = 0.55

/**
 * When panel (`squadCol`, `squadRow`) starts turning, 0..{@link UNFOLD_STAGGER}.
 *
 * Ordered by distance from squad 0, so the wave leaves the occupied squad and
 * runs outward — the floor opening *away* from the people rather than sweeping
 * across them. It is also §7.8.1b's reading order, which is not a coincidence:
 * the squads are being laid down in the order they will be filled.
 */
export function panelDelay(squadCol: number, squadRow: number): number {
  const far = FLOOR_COLS - 1 + (FLOOR_ROWS - 1)
  return ((squadCol + squadRow) / far) * UNFOLD_STAGGER
}

/**
 * How far one panel has turned, 0 (folded away to nothing) to 1 (flat).
 *
 * Overshoots slightly and settles back, because paper does. A monotonic ease
 * reads as a panel being *scaled*, which is the one thing §7.8.1c says this
 * must not be.
 */
/** How far past flat a panel swings before it settles. Paper, not rubber. */
const PANEL_OVERSHOOT = 0.9

export function panelOpen(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const u = t - 1
  return 1 + (PANEL_OVERSHOOT + 1) * u * u * u + PANEL_OVERSHOOT * u * u
}

/**
 * The light a panel catches as it turns — §7.8.1c, "catch the light as they
 * turn". Zero folded, zero flat, brightest edge-on halfway through.
 */
export function panelLight(t: number): number {
  if (t <= 0 || t >= 1) return 0
  return Math.sin(Math.PI * t)
}

/** Panel `squad`'s own progress at overall progress `t`. */
export function panelProgress(t: number, squadCol: number, squadRow: number): number {
  const u = (t - panelDelay(squadCol, squadRow)) / (1 - UNFOLD_STAGGER)
  return Math.min(1, Math.max(0, u))
}

/**
 * Which props are present at this headcount — §7.8.1.
 *
 * Returned as data rather than drawn inline so the arrival and *departure* of
 * each prop is a testable fact. The departures above {@link CROWDING_STARTS}
 * are the half that matters.
 */
export interface RoomProps {
  whiteboard: boolean
  /** A second board once there is a wall spare — §7.8.1's 11–30 band. */
  whiteboardRight: boolean
  /** How many pot plants. They multiply while there is floor, then all go. */
  plants: number
  coffee: boolean
  /** The water cooler. The other thing people stand around instead of working. */
  waterCooler: boolean
  filingCabinet: boolean
  printer: boolean
  /** Breakout seating. The first casualty of a full floor after the plants. */
  sofa: boolean
  /** Unpacked cardboard. Appears when the studio grows faster than it tidies. */
  boxes: number
  bin: boolean
  posters: number
  dividers: boolean
  serverRack: boolean
  cables: boolean
  walkway: boolean
  /** A rug under the first desks. A bedroom has one; an office never does. */
  rug: boolean
}

export function propsAt(devs: number): RoomProps {
  const crowded = devs >= CROWDING_STARTS * 2
  // Floor space runs out before wall space does, which is why the two lists
  // below empty at different rates. Anything that needs somebody to walk
  // around it goes first.
  const roomy = !crowded

  return {
    whiteboard: devs >= 3,
    whiteboardRight: devs >= 11,
    // Plants multiply while anyone still has time to water them, then vanish
    // together. Nobody waters anything once there are eighty people.
    plants: crowded ? 0 : devs >= 24 ? 4 : devs >= 11 ? 3 : devs >= 6 ? 2 : devs >= 3 ? 1 : 0,
    coffee: devs >= 6,
    waterCooler: devs >= 8,
    filingCabinet: devs >= 14,
    printer: devs >= 18,
    // Breakout seating is the most floor per person in the room, so it is the
    // first real furniture to be sacrificed.
    sofa: devs >= 20 && roomy,
    // Cardboard arrives when hiring outruns tidying, and it never leaves —
    // §7.8.1's crowding takes away the things people chose and keeps the
    // things nobody did.
    boxes: devs >= 31 ? (crowded ? 5 : 3) : devs >= 20 ? 1 : 0,
    bin: devs >= 6,
    posters: devs >= 24 ? 3 : devs >= 11 ? 2 : devs >= 5 ? 1 : 0,
    // Dividers need floor space between desks, and that is exactly what runs
    // out first.
    dividers: devs >= 11 && roomy,
    serverRack: devs >= 11,
    cables: devs >= 31,
    walkway: devs < CROWDING_STARTS,
    // A rug is a bedroom thing. It goes the moment this is an office.
    rug: devs <= 5,
  }
}

/**
 * A point on the floor's perimeter, `t` around the diamond from the top corner.
 *
 * Props live in the margin between the desk grid and the walls, so they need
 * positions that follow the room as it grows rather than fractions of a fixed
 * box. `inset` pulls them off the wall so nothing is embedded in it.
 */
export function perimeterPoint(
  t: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  inset: number,
): { x: number; y: number } {
  const u = ((t % 1) + 1) % 1
  const w = Math.max(0, halfW - inset)
  const h = Math.max(0, halfH - inset * 0.5)
  // Four edges of the iso diamond, a quarter of the parameter each.
  const edge = Math.floor(u * 4)
  const f = u * 4 - edge
  switch (edge) {
    case 0:
      return { x: cx + w * f, y: cy - h + h * f }
    case 1:
      return { x: cx + w - w * f, y: cy + h * f }
    case 2:
      return { x: cx - w * f, y: cy + h - h * f }
    default:
      return { x: cx - w + w * f, y: cy - h * f }
  }
}

/**
 * One developer at a desk, facing **north-west** — into their monitor.
 *
 * They used to face the camera, which is how every placeholder figure starts
 * and is wrong for two reasons. It breaks the projection, in the same way the
 * upright props did: a room where the furniture recedes and the people stare
 * out of the screen is two drawings in one frame. And it inverts the joke —
 * §6 is about a hundred people who are all *very busy*, and a hundred people
 * looking straight at you are not busy, they are posing.
 *
 * Turned away, the anatomy falls out of {@link isoBox} for free. A figure
 * facing north-west shows a south-camera exactly two faces: their left side
 * (south-west) and their back (south-east) — which are precisely the two faces
 * an iso box draws. The body is a box. That is not a simplification, it is
 * what the projection says a turned figure *is*.
 *
 * The cost is the face. The glasses and the two-pixel eyes were the most
 * charming thing in the room and they are gone, because you cannot see
 * somebody's face from behind. §22.7's authored sprites get to solve that
 * properly — the standing brief for them is a **turn on poke** (§8.2), which
 * buys the face back at the exact moment the player has asked for attention.
 */
/**
 * §7.8.7's part tables. Indices into these are what `identityFor` rolls, so the
 * palette stays in the renderer and the generator stays testable without one.
 *
 * Everything here reads at the size a developer actually occupies on a floor of
 * eighty, which rules out most of what "variety" usually means: a different
 * nose is four identical people. Silhouette and block colour are the only two
 * channels that survive, so those are the two that vary.
 */
const HAIR: ReadonlyArray<{ w: number; h: number; y: number }> = [
  { w: 14, h: 12, y: -18 }, // full
  { w: 15, h: 9, y: -18 }, // cropped
  { w: 13, h: 15, y: -18 }, // tall
  { w: 16, h: 11, y: -17 }, // wide, low
]
const HAIR_RAMP: ReadonlyArray<readonly [readonly string[], number]> = [
  [RAMPS.WOOD, 1],
  [RAMPS.WOOD, 0],
  [RAMPS.NEUTRAL, 1],
  [RAMPS.WOOD, 2],
]
const SKIN_BASE = [0, 1, 3, 5] as const
const SHIRT: ReadonlyArray<readonly [readonly string[], number]> = [
  [RAMPS.NEUTRAL, 6],
  [RAMPS.CALM, 1],
  [RAMPS.WARN, 1],
  [RAMPS.FOLIAGE, 1],
  [RAMPS.NEUTRAL, 3],
]

/**
 * The front pose — §7.8.8.
 *
 * Turning everyone north-west into their monitors was right and it cost the
 * game its faces. This is where they come back, and **only** where: a selected
 * developer turns round, and nobody else ever does. That is what makes it worth
 * something rather than a style choice.
 *
 * Drawn as a sibling of the back pose and toggled, rather than redrawn, because
 * the turn has to be able to swap poses on a single frame at the midpoint of
 * the spin.
 */
function drawFront(g: Graphics, look: Look) {
  const [shirtRamp, shirtBase] = SHIRT[look.shirt % SHIRT.length]
  const [hairRamp, hairBase] = HAIR_RAMP[look.hairColour % HAIR_RAMP.length]
  const hair = HAIR[look.hair % HAIR.length]
  const skin = SKIN_BASE[look.skin % SKIN_BASE.length]

  isoBox(g, 0, 5, 17, 19, shirtRamp, shirtBase, false)
  // The face. A flat panel rather than a box: it is turned to the camera, so
  // its two vertical faces are edge-on and drawing them would be a lie.
  g.rect(-6, -26, 12, 14).fill(c(RAMPS.SKIN[skin]))
  // Hair over the crown and down the sides, leaving the face clear.
  g.rect(-hair.w / 2, -26 - hair.h + 8, hair.w, hair.h - 6).fill(c(hairRamp[hairBase]))
  g.rect(-hair.w / 2, -24, 2, 8).fill(c(hairRamp[hairBase]))
  g.rect(hair.w / 2 - 2, -24, 2, 8).fill(c(hairRamp[hairBase]))
  // Eyes. Two pixels each, and they are the whole payoff of the section.
  g.rect(-4, -20, 2.5, 2).fill(c(RAMPS.NEUTRAL[0]))
  g.rect(1.5, -20, 2.5, 2).fill(c(RAMPS.NEUTRAL[0]))
  if (look.glasses) {
    g.rect(-6, -21.5, 5, 4.5).fill({ color: c(RAMPS.NEUTRAL[2]), alpha: 0.55 })
    g.rect(1, -21.5, 5, 4.5).fill({ color: c(RAMPS.NEUTRAL[2]), alpha: 0.55 })
    g.rect(-1, -20, 2, 1).fill(c(RAMPS.NEUTRAL[2]))
  }
  if (look.headphones) {
    g.rect(-hair.w / 2 - 1, -26 - hair.h + 7, hair.w + 2, 2.5).fill(c(RAMPS.NEUTRAL[1]))
    g.rect(-hair.w / 2 - 3, -24, 3.5, 6).fill(c(RAMPS.NEUTRAL[2]))
    g.rect(hair.w / 2 - 0.5, -24, 3.5, 6).fill(c(RAMPS.NEUTRAL[2]))
  }
}

export function buildDeveloper(look: Look): Container {
  const dev = new Container()
  const g = new Graphics()

  const [shirtRamp, shirtBase] = SHIRT[look.shirt % SHIRT.length]
  const [hairRamp, hairBase] = HAIR_RAMP[look.hairColour % HAIR_RAMP.length]
  const hair = HAIR[look.hair % HAIR.length]
  const skin = SKIN_BASE[look.skin % SKIN_BASE.length]

  // Torso and head, as solids. Lighter on the south-west face, darker on the
  // back — the same top-left key the props and the walls obey.
  isoBox(g, 0, 5, 17, 19, shirtRamp, shirtBase, false)
  // The neck, showing under the hair. One band, and it is the only skin
  // visible on a figure seen from behind.
  isoBox(g, 0, -14, 10, 4, RAMPS.SKIN, skin, false)
  // Hair, covering the whole back of the head.
  isoBox(g, 0, hair.y, hair.w, hair.h, hairRamp, hairBase, false)

  // Headphones — a band over the hair and a cup on the near side. The clearest
  // silhouette change available at this size, which is why about a quarter of
  // the floor has them.
  if (look.headphones) {
    g.rect(-hair.w / 2 - 1, hair.y - hair.h + 1, hair.w + 2, 2.5).fill(c(RAMPS.NEUTRAL[1]))
    g.rect(-hair.w / 2 - 2, hair.y - hair.h + 3, 3.5, 6).fill(c(RAMPS.NEUTRAL[2]))
  }
  // Glasses read from behind as the arm over the ear — two pixels, and it is
  // the only way spectacles are visible on a figure facing away.
  if (look.glasses) {
    g.rect(-hair.w / 2 - 1, hair.y - hair.h / 2, 4, 1.5).fill(c(RAMPS.NEUTRAL[2]))
  }
  // A slight lean. Nothing else varies posture and nothing else needs to: a row
  // of figures at identical angles is what reads as clones.
  dev.skew.x = look.slouch * 0.05

  // Elbows, out to the sides. From behind, the forearms are hidden by the
  // torso and the elbows are the only part of the arms that reads — which is
  // also true of the real thing.
  g.moveTo(-11, -6).lineTo(-6, -4).lineTo(-6, 3).lineTo(-11, 1).closePath().fill(c(RAMPS.NEUTRAL[5]))
  g.moveTo(11, -10).lineTo(6, -8).lineTo(6, -1).lineTo(11, -3).closePath().fill(c(RAMPS.NEUTRAL[4]))

  // **No chair, and no legs.** §7.8.1 records three attempts at a chair and why
  // the third was still wrong; the short version is that the honest depth order
  // puts it between the camera and a figure facing away, so it either covers
  // the person or shows only slivers the eye reads as more person.
  //
  // The legs are the same argument one step further. §7.8.1's figure is waist
  // up: a seated person's legs are under a desk, so drawing them is drawing
  // what nothing can see — and at forty desks it is forty invisible pairs of
  // legs costing real geometry. The torso ends at the waist and the desk in
  // front of it closes the silhouette.

  const front = new Graphics()
  drawFront(front, look)
  front.visible = false

  dev.addChild(g, front)
  dev.label = 'developer'
  return dev
}

/**
 * The desk footprint — **a 2:1 rectangle, not a square.**
 *
 * The first version drew a screen diamond of {@link TILE_W} x {@link TILE_H},
 * which is 2:1 *on screen* and therefore a **square** on the ground: the 2:1
 * projection is exactly the thing that turns a square plan into a 2:1 diamond.
 * A square desk is a card table. A desk is roughly twice as wide as it is deep,
 * so its diamond has to be twice as flat again — 4:1 on screen.
 *
 * The easy way to get this wrong is to read the ratio off the picture.
 */
/**
 * The desk footprint, **in floor tiles rather than in screen pixels.**
 *
 * A desk is a rectangle on the ground: one tile along the row, a little over
 * half a tile deep. Stating it in grid units is what stops it drifting out of
 * the projection — the old `DESK_W` / `DESK_D` pair was a screen width and a
 * screen height, and a screen diamond of width `w` and height `w / 4` is not a
 * 2:1 rectangle seen in isometric. It is not a ground-aligned shape at all: a
 * 2:1 rectangle on the floor projects to a *parallelogram*, and only a square
 * projects to a diamond. The comment that used to sit here derived `w / 4` very
 * carefully from the wrong premise.
 */
export const DESK_SPAN = PITCH_COL
export const DESK_DEPTH = 0.62
/** Kept for the room's other props, which are still placed in screen units. */
export const DESK_W = TILE_W * DESK_SPAN
export const DESK_D = (TILE_H * DESK_DEPTH) / 2
/** Apron depth — the drop from the surface to the underside. */
const DESK_LIP = 8

/**
 * A desk, the PC on it, and the person's place in front of it.
 *
 * Drawn into a shared Graphics; none of it animates, and none of it moves when
 * the person does.
 *
 * **There is no chair.** Three attempts at one are recorded in §7.8.1 and the
 * third still did not read: the honest depth order puts a chair back between
 * the camera and a figure facing away, so it either covers the person or, drawn
 * behind them, shows only slivers that the eye reads as more person. The
 * silhouette is better without it, and a desk, a lit screen and somebody at it
 * is already the whole picture.
 */
/**
 * **A bank of desks, drawn as one surface** — the fix for §7.8.1's rows reading
 * as diagonals.
 *
 * Each desk used to be its own diamond, butted against its neighbour at exactly
 * {@link PITCH_COL}. Butted diamonds do not make a bank; they make a **sawtooth**,
 * and every one of its teeth is a 26.5-degree edge. Those edges are the longest
 * straight lines in the room, so they are what the eye follows — and with the
 * rows half-staggered behind each other the teeth line up across rows into
 * unbroken diagonal chains. The seats were level the whole time. It was the
 * furniture that was diagonal, and no amount of adjusting the seat pitch could
 * have fixed it.
 *
 * One run of desks is now one shape: a hexagon, pointed at each end where the
 * outermost desk still has its corner, and **flat along the top and bottom in
 * between**. Those two long horizontal edges are now the longest lines in the
 * room, which is the whole point — a row is legible because its front edge is
 * one line rather than ten.
 *
 * It is also what "desks are butted together shoulder-to-shoulder into rows"
 * has meant since §7.8.1 was written. A real bank of desks is a continuous
 * surface; the individual desk is an accounting fiction.
 */
export function drawDeskBank(g: Graphics, colFrom: number, colTo: number, row: number) {
  // The run goes along `gy` — the row's axis — and is `DESK_DEPTH` across it.
  const gy0 = colFrom * PITCH_COL - DESK_SPAN / 2
  const gy1 = colTo * PITCH_COL + DESK_SPAN / 2
  const gx = row * PITCH_ROW
  const d = DESK_DEPTH / 2

  // The four corners of a rectangle **on the floor**, projected. Not a
  // screen-space shape that happens to look isometric: a run of desks is a
  // rectangle in the room, so its outline is whatever the projection makes of
  // one, and its two long edges come out parallel to the wall for free.
  const back = gridToScreen(gx - d, gy0)
  const far = gridToScreen(gx - d, gy1)
  const front = gridToScreen(gx + d, gy1)
  const near = gridToScreen(gx + d, gy0)

  g.moveTo(back.x, back.y)
    .lineTo(far.x, far.y)
    .lineTo(front.x, front.y)
    .lineTo(near.x, near.y)
    .closePath()
    .fill(c(RAMPS.WOOD[2]))

  // The apron, on the two edges that face the camera. ART_DIRECTION §7's single
  // top-left source: the long south-east side of the run turns away from it,
  // and the south-west end cap catches it.
  g.moveTo(near.x, near.y)
    .lineTo(front.x, front.y)
    .lineTo(front.x, front.y + DESK_LIP)
    .lineTo(near.x, near.y + DESK_LIP)
    .closePath()
    .fill(c(RAMPS.WOOD[0]))
  g.moveTo(far.x, far.y)
    .lineTo(front.x, front.y)
    .lineTo(front.x, front.y + DESK_LIP)
    .lineTo(far.x, far.y + DESK_LIP)
    .closePath()
    .fill(c(RAMPS.WOOD[1]))
}

/** One person's kit on the bank — the screen they are looking at and the box under it. */
export function drawWorkstation(g: Graphics, x: number, y: number) {
  // The monitor. A screen is a flat panel, so it is drawn the way every other
  // flat panel in this room is drawn: lying in a plane, not parallel to the
  // glass. Its face is the down-left one — the same plane the wall dressing
  // uses, which is what makes a monitor and a whiteboard look like they are in
  // the same room.
  //
  // This is the one prop where getting it wrong was least obvious and most
  // damaging: it is repeated once per developer, so an upright rectangle here
  // was not one mistake but a hundred, tiling the whole floor.
  //
  // It sits on the desk's centre line and its face turns south-east, because
  // that is the direction the person at it is looking (`buildDeveloper`). The
  // two were specified independently at first and pointed the same way, which
  // is a room full of people reading the backs of their own screens.
  //
  // Centred rather than offset north-west, so the developer, the screen and the
  // desk are one column: the figure stands **directly in front of** the thing
  // they are looking at, which is what a workstation looks like from behind and
  // is a stronger read than any amount of furniture around it.
  const mx = x
  const my = y - 31
  const S = -0.5

  // The stand, first, so the panel sits over it. Based on the desk's **back
  // half**, which is now only seven pixels deep — the old base at y-11 sat
  // behind the far edge of a surface that used to be twice as deep, so it would
  // hang off the back of the new one.
  isoBox(g, mx, y - 3, 8, 4, RAMPS.NEUTRAL, 2, false)
  g.rect(mx - 1, my + 15, 3, 13).fill(c(RAMPS.NEUTRAL[2]))

  // Bezel, then the emissive face. The screen is the room's only light source,
  // so it is the one surface here allowed to ignore the top-left key.
  wallQuad(g, mx, my - 2, 30, 21, S, c(RAMPS.NEUTRAL[2]))
  wallQuad(g, mx, my, 26, 17, S, c(RAMPS.GLOW[0]))
  // Code on it. Each line is a strip in the same plane, left-aligned along the
  // panel, so the text runs across the screen rather than across the viewport.
  for (let i = 0; i < 4; i++) {
    const w = 5 + ((i * 7) % 13)
    const off = -(26 - w) / 2 + 2
    wallQuad(
      g,
      mx + off,
      my + 2 + i * 4 + S * off,
      w,
      1.5,
      S,
      c(i % 2 === 0 ? RAMPS.GLOW[2] : RAMPS.GLOW[1]),
    )
  }
  // The sliver of the monitor's own side that a panel turned away from the
  // camera shows. Two pixels, and it is the whole difference between a screen
  // and a decal. On the north-east edge, which is the one turning away now.
  g.moveTo(mx + 15, my - 9.5)
    .lineTo(mx + 17, my - 8.5)
    .lineTo(mx + 17, my + 10.5)
    .lineTo(mx + 15, my + 9.5)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[1]))

  // The machine itself, standing on the desk beside the screen.
  //
  // **Placed through the projection, not with a screen offset.** `x + 21` put
  // it on the desk's east corner while rows ran flat across the frame, and the
  // moment they ran along the floor instead the same offset put it in mid-air
  // beside the developer — which is exactly how it was reported: "what's the
  // grey thing on the right hand side of a person?". A prop positioned in
  // screen pixels is a prop that does not know which way the room is facing.
  //
  // It is here because a desk with only a screen on it is a desk with a screen
  // *floating* over it; the tower is the one prop that says the surface is a
  // work surface. Kept small and tucked toward the back of the desk, clear of
  // both the panel and the body in front of it.
  const stand = gridToScreen(-DESK_DEPTH * 0.22, PITCH_COL * 0.34)
  const px = x + stand.x
  const py = y + stand.y
  // `grounded` is false — it is standing on the desk, so it gets a contact
  // patch from the surface under it rather than a floor shadow, which is
  // §7.8.1's second projection rule.
  isoBox(g, px, py, 8, 11, RAMPS.NEUTRAL, 3, false)
  // A power light. Two pixels of GLOW, and at forty desks it is the cheapest
  // thing in the room that says the machines are *on*.
  g.rect(px - 2, py - 9, 1.5, 1.5).fill(c(RAMPS.GLOW[2]))

}

/** A pot plant. The most-repeated prop, so it varies by index. */
function drawPlant(g: Graphics, x: number, y: number, i: number) {
  const tall = i % 2 === 0
  isoBox(g, x, y, 14, 9, RAMPS.WOOD, 1)
  // Foliage stays as ellipse clusters. A bush has no flat faces to catch the
  // light and no edges to project, so boxing it would be worse, not better —
  // the projection rule is about objects with sides.
  const top = y - 9
  if (tall) {
    g.rect(x - 1, top - 20, 2, 20).fill(c(RAMPS.FOLIAGE[0]))
    g.ellipse(x - 5, top - 18, 7, 5).fill(c(RAMPS.FOLIAGE[0]))
    g.ellipse(x + 5, top - 14, 7, 5).fill(c(RAMPS.FOLIAGE[1]))
    g.ellipse(x, top - 24, 6, 5).fill(c(RAMPS.FOLIAGE[1]))
  } else {
    g.ellipse(x, top - 8, 12, 10).fill(c(RAMPS.FOLIAGE[0]))
    g.ellipse(x - 4, top - 12, 7, 6).fill(c(RAMPS.FOLIAGE[1]))
  }
}

/** The water cooler. The other thing people stand around instead of working. */
function drawWaterCooler(g: Graphics, x: number, y: number) {
  isoBox(g, x, y, 15, 22, RAMPS.NEUTRAL, 6)
  // The bottle. GLOW rather than a blue-grey because it is the one translucent
  // object in the room and it should catch the monitor light. Drawn as a box
  // too, so its shoulders turn with everything else.
  const top = y - 22
  g.moveTo(x - 6, top - 18)
    .lineTo(x, top - 18 + 3)
    .lineTo(x, top + 3)
    .lineTo(x - 6, top)
    .closePath()
    .fill({ color: c(RAMPS.GLOW[1]), alpha: 0.8 })
  g.moveTo(x + 6, top - 18)
    .lineTo(x, top - 18 + 3)
    .lineTo(x, top + 3)
    .lineTo(x + 6, top)
    .closePath()
    .fill({ color: c(RAMPS.GLOW[0]), alpha: 0.8 })
  isoQuad(g, x, top - 18, 12, 6, c(RAMPS.NEUTRAL[4]))
  // The tap, on the near-left face where it can be seen.
  g.rect(x - 5, y - 16, 3, 3).fill(c(RAMPS.NEUTRAL[2]))
}

function drawCoffee(g: Graphics, x: number, y: number) {
  isoBox(g, x, y, 18, 24, RAMPS.NEUTRAL, 3)
  // The alcove and the pot sit on the near-left face, angled into it.
  g.moveTo(x - 8, y - 20)
    .lineTo(x - 2, y - 17)
    .lineTo(x - 2, y - 9)
    .lineTo(x - 8, y - 12)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[0]))
  g.moveTo(x - 7, y - 14)
    .lineTo(x - 3, y - 12)
    .lineTo(x - 3, y - 9)
    .lineTo(x - 7, y - 11)
    .closePath()
    .fill(c(RAMPS.WOOD[1]))
  g.rect(x + 2, y - 21, 3, 2).fill(c(RAMPS.ALARM[2]))
}

function drawFilingCabinet(g: Graphics, x: number, y: number) {
  isoBox(g, x, y, 18, 28, RAMPS.NEUTRAL, 4)
  // Drawer fronts on the near-left face, each sheared to lie in it.
  for (let d = 0; d < 3; d++) {
    const t = y - 25 + d * 9
    g.moveTo(x - 7, t)
      .lineTo(x - 1, t + 3)
      .lineTo(x - 1, t + 10)
      .lineTo(x - 7, t + 7)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[3]))
    g.rect(x - 5, t + 4, 3, 1.5).fill(c(RAMPS.NEUTRAL[6]))
  }
}

function drawPrinter(g: Graphics, x: number, y: number) {
  // Darker than the walls it stands against. At NEUTRAL[5] the body and the
  // paper on top were within one step of each other and the whole thing read
  // as one featureless pale cube.
  isoBox(g, x, y, 22, 13, RAMPS.NEUTRAL, 3)
  // Paper, permanently half-fed. Small, on the back half of the top face, so
  // the body still reads as a body.
  isoQuad(g, x + 3, y - 16, 11, 5.5, c(RAMPS.NEUTRAL[8]))
  // The output slot, sheared into the near-left face — the one line that says
  // "printer" rather than "box".
  g.moveTo(x - 8, y - 7)
    .lineTo(x - 1, y - 3.5)
    .lineTo(x - 1, y - 1.5)
    .lineTo(x - 8, y - 5)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[0]))
  g.rect(x + 3, y - 9, 2, 2).fill(c(RAMPS.WARN[2]))
}

function drawSofa(g: Graphics, x: number, y: number) {
  // Long along one iso axis rather than along the screen. The seat is a slab
  // and the back is a second slab set behind it, so the whole thing recedes.
  const run = 20
  const rise = run / 2
  g.ellipse(x - 2, y + 2, run * 1.15, run * 0.4).fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.4 })
  const seat = (ox: number, oy: number, h: number, base: number) => {
    const bx = x + ox
    const by = y + oy
    g.moveTo(bx - run, by + rise - h)
      .lineTo(bx + run, by - rise - h)
      .lineTo(bx + run, by - rise)
      .lineTo(bx - run, by + rise)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[base]))
    g.moveTo(bx - run, by + rise - h)
      .lineTo(bx + run, by - rise - h)
      .lineTo(bx + run + 9, by - rise - h + 4)
      .lineTo(bx - run + 9, by + rise - h + 4)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[base + 1]))
  }
  seat(0, 0, 13, 3)
  seat(-7, -3, 22, 4)
}

/** Unpacked cardboard. Arrives when hiring outruns tidying and never leaves. */
function drawBoxes(g: Graphics, x: number, y: number, i: number) {
  const h = 12 + (i % 3) * 4
  isoBox(g, x, y, 20, h, RAMPS.WOOD, 2)
  // The tape seam, running along the top face's long diagonal.
  g.moveTo(x - 10, y - h - 5)
    .lineTo(x + 10, y - h + 5)
    .stroke({ width: 1.5, color: c(RAMPS.WOOD[1]) })
  if (i % 2 === 0) isoBox(g, x + 2, y - h, 13, 9, RAMPS.WOOD, 2, false)
}

function drawBin(g: Graphics, x: number, y: number) {
  // Tapered, so it needs its own polygon rather than isoBox — but the taper is
  // in the vertical only; the footprint is still a rhombus at both ends.
  const w = 13
  const tw = 9
  const h = 14
  g.ellipse(x + 1, y + 1, tw * 0.6, tw * 0.3).fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.4 })
  g.moveTo(x - w / 2, y - h)
    .lineTo(x, y - h + w / 4)
    .lineTo(x, y + tw / 4)
    .lineTo(x - tw / 2, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[3]))
  g.moveTo(x + w / 2, y - h)
    .lineTo(x, y - h + w / 4)
    .lineTo(x, y + tw / 4)
    .lineTo(x + tw / 2, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[2]))
  isoQuad(g, x, y - h, w, w / 2, c(RAMPS.NEUTRAL[1]))
  // Overflowing, because nobody empties it either.
  g.rect(x - 4, y - h - 4, 3, 3).fill(c(RAMPS.NEUTRAL[7]))
  g.rect(x + 1, y - h - 3, 3, 3).fill(c(RAMPS.NEUTRAL[8]))
}

/**
 * A poster, lying in a wall plane. `slope` is the wall's — negative for the
 * back-left wall, positive for the back-right.
 */
function drawPoster(g: Graphics, x: number, y: number, i: number, slope: number) {
  const w = 22 + (i % 2) * 8
  const h = 28
  const rise = (slope * w) / 2
  wallQuad(g, x, y, w, h, slope, c(RAMPS.NEUTRAL[2]))
  wallQuad(g, x, y + 2, w - 4, h - 4, slope, c(i % 2 === 0 ? RAMPS.CALM[0] : RAMPS.WARN[0]))
  // A motivational block of nothing. Sheared with the panel, or it would sit
  // on the poster like a caption on a photograph.
  wallQuad(g, x, y + h - 9, w - 10, 2, slope, c(RAMPS.NEUTRAL[5]))
  wallQuad(g, x - (w - 10) * 0.2, y + h - 5 + rise * 0.2, (w - 10) * 0.6, 2, slope, c(RAMPS.NEUTRAL[4]))
}

function drawWhiteboard(g: Graphics, x: number, y: number, seed: number, slope: number) {
  const W = 60
  wallQuad(g, x, y, W, 34, slope, c(RAMPS.NEUTRAL[7]))
  wallQuad(g, x, y + 32, W, 3, slope, c(RAMPS.NEUTRAL[4]))
  // Scrawl. Each line is a wall-plane strip, left-aligned, so the writing runs
  // along the board instead of across the screen in front of it.
  for (let i = 0; i < 3; i++) {
    const w = 18 + ((seed + i * 13) % 26)
    const off = -(W - w) / 2 + 3
    wallQuad(g, x + off, y + 4 + i * 7 + slope * off, w, 2, slope, c(RAMPS.NEUTRAL[4]))
  }
}

export function buildRoom(): RoomHandle {
  const root = new Container()

  // Draw order is the whole illusion: floor plates, walls, then light, then
  // desks, then people in front of their own desks.
  //
  // §7.8.1c is why the floor is a layer of its own rather than part of the
  // shell: a hundred panels that hinge outward one after another have to be a
  // hundred display objects. Below a hundred developers exactly one of them is
  // ever visible and it is the room's floor, so the split costs nothing until
  // the moment it is needed.
  const plates = new Container()
  const shell = new Graphics()
  const light = new Graphics()
  const furniture = new Graphics()
  // Desks, one Graphics per squad. Split so a squad's desks can be withheld
  // until its panel has finished turning — trap 7 still holds *within* each
  // one, and squads are themselves laid down in painter order, so index order
  // is still the correct depth order end to end.
  const deskLayer = new Container()
  const devLayer = new Container()
  // Labelled because the layer list is now long enough that finding it by
  // child index is a test that breaks every time a layer is added.
  devLayer.label = 'developers'
  plates.label = 'plates'
  deskLayer.label = 'desks'
  const ambient = createAmbient()
  // Bubbles go above everyone, including the people in the front row — a
  // speech bubble occluded by the desk in front of it is not a speech bubble.
  // Panels sit *above* the shell's own floor and below everything else: the
  // shell's diamond and its walls are what the unfold fades away, and the two
  // never overlap on screen because the walls rise from behind the deepest
  // plate.
  root.addChild(shell, plates, light, furniture, deskLayer, devLayer, ambient.layer)

  /** One §7.8.1c panel: the plate itself, and the light it catches turning. */
  interface Panel {
    root: Container
    base: Graphics
    sheen: Graphics
    squadCol: number
    squadRow: number
  }
  const panels: Panel[] = []
  const squadDesks: Graphics[] = []

  const devs: Container[] = []
  /**
   * §7.8.7's run seed. Held here rather than passed per rebuild because the
   * identities must not change while a run is being played — the store owns the
   * value and hands it over once.
   */
  let seed = 1
  /** §7.8.8 — the selected seat, and the spin's clock. */
  let selected = -1
  let turningOut = -1
  let turnAt = 0
  /** Per-developer jolt decay, 1 -> 0. The §8.2 poke reaction. */
  const jolts: number[] = []
  const desks: Array<{ x: number; y: number }> = []
  /**
   * Where §7.8.6's water trips go — the cooler and the coffee machine, as
   * placed on this rebuild's perimeter ring.
   *
   * Recorded rather than recomputed, because the ring's slot allocation depends
   * on which props are present at this headcount and duplicating that logic in
   * the walker is how the two quietly disagree.
   */
  const walkTargets: Seat[] = []
  let currentProps = propsAt(1)
  let lastDevs = -1
  const extent = { w: TILE_W * 3, h: 156 }

  /**
   * §7.8.1c's clock. -1 until the hundredth hire, then 0..1 once, then 1.
   *
   * Held across rebuilds, because a hire *during* the unfold must not restart
   * it — §7.8.1c says it happens once.
   */
  let unfoldT = -1
  /**
   * What the §23.4.1 camera fit sees, folded and open. The camera pulls back
   * *with* the unfold rather than after it, so both are computed at rebuild and
   * interpolated per frame. Snapping the extent at the hundredth hire would
   * make the fit cut on a frame where §10.5 says nothing cuts.
   */
  const foldedFit = { w: TILE_W * 3, h: 156, px: 0, py: 0 }
  const openFit = { w: TILE_W * 3, h: 156, px: 0, py: 0 }

  /**
   * Push the fit for a given unfold progress onto the extent and the pivot.
   *
   * Eased on the same curve the panels use so the pull-back tracks the picture;
   * a linear camera against an eased floor reads as two events.
   */
  function applyFit(t: number) {
    const k = t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) ** 3
    extent.w = foldedFit.w + (openFit.w - foldedFit.w) * k
    extent.h = foldedFit.h + (openFit.h - foldedFit.h) * k
    root.pivot.set(
      foldedFit.px + (openFit.px - foldedFit.px) * k,
      foldedFit.py + (openFit.py - foldedFit.py) * k,
    )
  }

  function rebuild(headcount: number) {
    const n = Math.max(1, Math.min(ROOM_DEV_CAP, Math.floor(headcount)))
    // §7.8.1c — the hundredth hire fills the squad, so the floor has to open.
    // Once started, never unstarted for this run: the unfold is a one-shot and
    // the floor does not fold back up if the studio shrinks.
    if (unfoldT < 0 && n >= SQUAD_SIZE) unfoldT = 0
    const unfolded = unfoldT >= 0
    const { cols, rows } = gridFor(n)
    const props = propsAt(headcount)
    currentProps = props

    shell.clear()
    light.clear()
    furniture.clear()
    desks.length = 0
    walkTargets.length = 0

    // --- the shell ---------------------------------------------------------
    //
    // A margin of empty floor around the desks, so the room is a room rather
    // than a plinth. It shrinks as the place fills up: §7.8.1's walls push
    // outward, but never as fast as the headcount grows.
    // Tight around a single desk and opening up as the studio grows. §7.8.1's
    // first frame is a *bedroom*, and a bedroom with three tiles of empty
    // floor around the desk is a hall — the room has to hug the person in it
    // before it can feel like it is filling up.
    const roomy = props.walkway ? 1.5 : 0.6
    const TIGHTEST = 1.05
    // Clamped at both ends. The old form interpolated on an *unbounded*
    // `n / 14`, which is only an interpolation while the room is opening up —
    // once crowding flips `roomy` below `TIGHTEST` the same expression runs
    // away downward, and by forty developers the margin was **negative**: a
    // floor plate smaller than the block of desks standing on it. That is the
    // second half of R6, and it is the half no amount of geometry would have
    // fixed.
    const margin = TIGHTEST + Math.min(1, n / 14) * (roomy - TIGHTEST)
    // Sized from the seats' real screen bounding box, and then from the rule
    // that actually contains it — see `blockBox` and `plateHalfWidth`. The
    // previous `max(width, height)` was correct only for a nearly flat block
    // and let the corners of a deep one hang over the edge of the plate.
    const box = blockBox(0, 0, cols - 1, rows - 1)
    const bw = (box.maxX - box.minX) / 2
    const bh = (box.maxY - box.minY) / 2
    const floorW = plateHalfWidth(bw, bh, margin)
    const floorH = floorW / 2
    const halfW = floorW / TILE_W
    const cx = (box.minX + box.maxX) / 2
    const cy = (box.minY + box.maxY) / 2

    // The wall planes' screen slope, from the room's own geometry rather than
    // a literal 0.5, so wall-mounted things stay in plane if the projection
    // ratio is ever retuned.
    const WALL_SLOPE = floorH / floorW

    // Floor, with a darker inset so the edge reads as a skirting line.
    isoQuad(shell, cx, cy, floorW * 2, floorH * 2, c(RAMPS.NEUTRAL[2]))
    isoQuad(shell, cx, cy, floorW * 2 - 10, floorH * 2 - 5, c(RAMPS.WOOD[0]))

    // The two back walls, rising from the far edges. The back-RIGHT wall takes
    // the lighter neutral, which is the counter-intuitive half of
    // ART_DIRECTION §7's single top-left source and was backwards here until
    // the props were boxed and the mismatch became visible: both back walls
    // face the camera, and the one on the right faces down-*left*, toward the
    // light. Held by hand, because no script can check it.
    // Wall height scales with the room. A fixed height made the walls 46% of
    // the frame in a two-desk bedroom, which pushed the people — the actual
    // subject — onto the bottom edge. Walls are backdrop; they get whatever
    // room is left after the floor has what it needs.
    const WALL_H = Math.max(38, Math.min(120, floorH * 0.62))
    const topX = cx
    const topY = cy - floorH
    const leftX = cx - floorW
    const rightX = cx + floorW
    shell
      .moveTo(leftX, cy)
      .lineTo(topX, topY)
      .lineTo(topX, topY - WALL_H)
      .lineTo(leftX, cy - WALL_H)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[2]))
    shell
      .moveTo(rightX, cy)
      .lineTo(topX, topY)
      .lineTo(topX, topY - WALL_H)
      .lineTo(rightX, cy - WALL_H)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[3]))
    // The corner seam, so the two planes read as meeting rather than as one
    // folded shape.
    shell.moveTo(topX, topY).lineTo(topX, topY - WALL_H).stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]) })

    // --- light -------------------------------------------------------------
    //
    // §7.8.1: "lit only by the glow of a chunky CRT monitor". The pool is drawn
    // as three stacked ellipses rather than a gradient, because a gradient
    // would introduce colours the §5 quantiser has never seen.
    for (const [i, alpha] of [0.1, 0.055, 0.03].entries()) {
      const r = (0.85 + i * 0.55) * TILE_W * Math.max(1, Math.min(3.2, halfW * 0.42))
      light.ellipse(cx, cy - TILE_H * 0.2, r, r * 0.5).fill({ color: c(RAMPS.GLOW[1]), alpha })
    }

    // A rug under the first desks. A bedroom has one; an office never does,
    // which is why it leaves rather than accumulating like everything else.
    if (props.rug) {
      isoQuad(shell, cx, cy + TILE_H * 0.2, floorW * 1.05, floorH * 1.05, c(RAMPS.WOOD[1]))
      isoQuad(shell, cx, cy + TILE_H * 0.2, floorW * 0.9, floorH * 0.9, c(RAMPS.WOOD[2]))
    }

    // --- props -------------------------------------------------------------

    // --- wall dressing -----------------------------------------------------
    //
    // Wall space survives crowding; floor space does not. That asymmetry is
    // §7.8.1's whole point, so the two are drawn from separate budgets.

    if (props.whiteboard) {
      drawWhiteboard(shell, topX - floorW * 0.42, topY + floorH * 0.42 - WALL_H * 0.66, 3, -WALL_SLOPE)
    }
    if (props.whiteboardRight) {
      drawWhiteboard(shell, topX + floorW * 0.40, topY + floorH * 0.40 - WALL_H * 0.62, 17, WALL_SLOPE)
    }
    for (let i = 0; i < props.posters; i++) {
      // Alternating walls, marching outward from the corner so a second poster
      // never lands on the first.
      const left = i % 2 === 0
      const along = 0.18 + Math.floor(i / 2) * 0.3
      const px = left ? topX - floorW * along : topX + floorW * along
      // Follows the wall down from the corner — `along` is a fraction of the
      // wall's run, so the drop is the same fraction of its rise.
      const py = topY + floorH * along - WALL_H * (0.5 - (i % 3) * 0.08)
      drawPoster(shell, px, py, i, left ? -WALL_SLOPE : WALL_SLOPE)
    }

    // --- floor furniture ---------------------------------------------------
    //
    // Placed on the perimeter between the desk grid and the walls, so the
    // dressing follows the room as it grows instead of sitting at fractions of
    // a box that changes size underneath it.

    const ring: Array<(x: number, y: number, i: number) => void> = []
    // The two props people actually walk to. §7.8.1 puts them on the ring for
    // dressing; §7.8.6 gives them a second job as destinations, which is most
    // of why the room has them.
    if (props.coffee)
      ring.push((x, y) => {
        walkTargets.push({ x, y })
        drawCoffee(furniture, x, y)
      })
    if (props.waterCooler)
      ring.push((x, y) => {
        walkTargets.push({ x, y })
        drawWaterCooler(furniture, x, y)
      })
    if (props.filingCabinet) ring.push((x, y) => drawFilingCabinet(furniture, x, y))
    if (props.printer) ring.push((x, y) => drawPrinter(furniture, x, y))
    if (props.sofa) ring.push((x, y) => drawSofa(furniture, x, y))
    if (props.bin) ring.push((x, y) => drawBin(furniture, x, y))
    for (let i = 0; i < props.plants; i++) ring.push((x, y) => drawPlant(furniture, x, y, i))
    for (let i = 0; i < props.boxes; i++) ring.push((x, y) => drawBoxes(furniture, x, y, i))

    // Spread evenly around the ring rather than clustered, and offset by a
    // quarter turn so nothing sits exactly on the near corner where it would
    // occlude the desks the camera is framing.
    // Proportional, with a floor. A fixed pixel inset is a *shrinking fraction*
    // as the room grows — at twenty-six developers it put the ring 95% of the
    // way to the wall, where a plant's foliage crosses the skirting line and
    // the prop reads as standing outside the room rather than against its wall.
    const inset = Math.max(TILE_W * 0.42, floorW * 0.16)
    for (let i = 0; i < ring.length; i++) {
      const t = 0.125 + i / Math.max(1, ring.length)
      const at = perimeterPoint(t, cx, cy, floorW, floorH, inset)
      ring[i](at.x, at.y, i)
    }

    if (props.serverRack) {
      // Corner-mounted rather than on the ring: it is the one thing that wants
      // a wall behind it and it never moves once installed.
      // Norm 0.44 + 0.44 = 0.88 — against the corner but wholly on the
      // floor. At 1.0 it straddled the wall seam, where no contact shadow can
      // help because half the base is on a vertical surface.
      const sx = topX + floorW * 0.44
      const sy = topY + floorH * 0.56
      isoBox(furniture, sx, sy, 24, 54, RAMPS.NEUTRAL, 1)
      // Rack units and their status LEDs, sheared into the near-left face. The
      // LEDs are the point: six green pinpricks in the dark corner are the
      // cheapest depth cue in the room.
      for (let i = 0; i < 6; i++) {
        const t = sy - 50 + i * 8
        furniture
          .moveTo(sx - 9, t)
          .lineTo(sx - 1, t + 4)
          .lineTo(sx - 1, t + 7)
          .lineTo(sx - 9, t + 3)
          .closePath()
          .fill(c(RAMPS.NEUTRAL[2]))
        furniture.rect(sx - 3, t + 4, 1.5, 2).fill(c(RAMPS.GLOW[2]))
      }
    }

    // --- desks and people --------------------------------------------------

    // One Graphics per occupied squad. Cleared and re-filled rather than
    // rebuilt, so a hire inside squad 0 does not churn squad 1's geometry.
    const squadsUsed = Math.ceil(n / SQUAD_SIZE)
    while (squadDesks.length < squadsUsed) {
      const g = new Graphics()
      squadDesks.push(g)
      deskLayer.addChild(g)
    }
    for (const g of squadDesks) g.clear()

    // §7.8.1 — **the bank first, then the kit on it.** Consecutive seats that
    // share a squad and a row are one run of desks and are drawn as one shape;
    // see `drawDeskBank` for why ten separate diamonds were the diagonal the
    // rows appeared to have.
    //
    // Two passes, and the split is load-bearing rather than tidy: a bank has to
    // be under the screens standing on it, so every seat's position must be
    // known before the first shape is drawn. Computing and drawing in one loop
    // put each row's surface on top of its own monitors.
    for (let i = 0; i < n; i++) {
      const { col: gcol, row: grow } = seatGrid(i)
      desks.push(isoAt(gcol, grow))
    }
    for (let i = 0; i < n; ) {
      const place = seatFor(i)
      let end = i + 1
      while (end < n && seatFor(end).col !== 0) end++
      const first = seatGrid(i)
      const last = seatGrid(end - 1)
      drawDeskBank(squadDesks[place.squad], first.col, last.col, first.row)
      i = end
    }

    for (let i = 0; i < n; i++) {
      const place = seatFor(i)
      const { x, y } = desks[i]
      const g = squadDesks[place.squad]
      const col = place.col

      // A divider needs a neighbour to divide from. Inside the squad that is
      // the next column along; at the squad's edge the next seat is across a
      // corridor, and a panel standing in a corridor is a barricade.
      if (props.dividers && col < SQUAD_COLS - 1 && i + 1 < n) {
        // A panel standing between two desks, halfway to the next seat *along
        // the row* — the only gap a divider ever fills. Between rows there is
        // an aisle, and a panel across an aisle is a barricade.
        //
        // Placed by stepping half a pitch through the projection rather than by
        // adding a screen offset. The screen offset that used to be here was
        // correct only while rows ran flat across the frame, and it would have
        // put every divider on the floor's other axis the moment they did not.
        const half = gridToScreen(0, PITCH_COL / 2)
        const dx = x + half.x
        const dy = y + half.y
        // The panel stands *across* the gap, so its footprint runs on `gx`.
        const across = gridToScreen(DESK_DEPTH / 2, 0)
        g.moveTo(dx - across.x, dy - across.y - 18)
          .lineTo(dx + across.x, dy + across.y - 18)
          .lineTo(dx + across.x, dy + across.y)
          .lineTo(dx - across.x, dy - across.y)
          .closePath()
          .fill({ color: c(RAMPS.NEUTRAL[3]), alpha: 0.8 })
      }
      if (props.cables) {
        // A short run along the front edge of the bank, on the floor's axis
        // like everything else on it.
        const a = gridToScreen(DESK_DEPTH * 0.55, -PITCH_COL * 0.42)
        const b = gridToScreen(DESK_DEPTH * 0.55, PITCH_COL * 0.42)
        g.moveTo(x + a.x, y + a.y)
          .lineTo(x + b.x, y + b.y)
          .stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]), alpha: 0.7 })
      }

      drawWorkstation(g, x, y)
    }

    // Reuse developer containers across rebuilds — a hire should not rebuild
    // ninety-nine sprites that did not change.
    while (devs.length < n) {
      // §7.8.7 — index 1 is James and is never generated. Containers are reused
      // across rebuilds, so a developer's look is fixed at the moment their
      // seat first exists and never churns underneath them.
      const d = buildDeveloper(developerAt(seed, devs.length).look)
      devs.push(d)
      jolts.push(0)
      devLayer.addChild(d)
    }
    for (let i = 0; i < devs.length; i++) {
      const visible = i < n
      devs[i].visible = visible
      if (visible) devs[i].position.set(desks[i].x, desks[i].y + 6)
    }

    // --- §7.8.1c, the hundred panels ---------------------------------------
    //
    // Built only once the floor has unfolded, and built once: below a hundred
    // developers this layer is empty and the room is exactly what it was.
    plates.visible = unfolded
    shell.alpha = 1
    light.alpha = 1
    if (unfolded && panels.length === 0) buildPanels()
    if (unfolded) applyUnfold(unfoldT)

    // The camera fit reads this every frame (§23.4.1), so the room growing is
    // also the camera pulling back — without anyone driving Z.
    // The camera fit reads these, so they must describe the *drawn* bounds:
    // floor plus the walls standing behind it, and a pivot at the true centre
    // of that box rather than at the floor's centre. Pivoting on the floor
    // pushes the whole room down the frame by half a wall.
    foldedFit.w = floorW * 2
    foldedFit.h = floorH * 2 + WALL_H
    // Biased toward the desks rather than the true centre of the bounding box.
    // Centring the box geometrically is correct and composes badly: it puts
    // half a wall above the people and drops them low in frame.
    foldedFit.px = cx
    foldedFit.py = cy - WALL_H * 0.3
    if (unfolded) {
      const f = floorBox(squadsUsed)
      openFit.w = f.maxX - f.minX
      openFit.h = f.maxY - f.minY
      openFit.px = (f.minX + f.maxX) / 2
      openFit.py = (f.minY + f.maxY) / 2
    }
    applyFit(Math.max(0, unfoldT))
  }

  /**
   * The screen box the camera should frame once the floor is open.
   *
   * **Not all hundred plates**, and that is a decision worth defending. The
   * unfold really does lay out ten thousand seats, and framing all of them puts
   * a hundred developers in about one percent of the picture: the first version
   * of this did exactly that, and the result was a screen full of empty floor
   * with the studio somewhere off the top-left corner. §7.7's promise is the
   * other way round — *the studio you see is the studio you have* — and §7.8.1a
   * already says the way to see the rest is to **zoom to it**, not to be shown
   * all of it at once.
   *
   * So the fit covers the squads that have people in them plus one squad of
   * headroom in each direction: the player watches the floor open, keeps their
   * own hundred at a readable size, and can see there is somewhere for the next
   * hundred to go. The other ninety-odd plates are still there and still
   * unfold; they simply run off the edge of the frame, which is the honest
   * picture of a floor that holds ten thousand.
   */
  function floorBox(squadsUsed: number) {
    const used = Math.max(1, squadsUsed)
    const wide = Math.min(FLOOR_COLS, used)
    const deep = Math.ceil(used / FLOOR_COLS)
    const maxCol = (wide - 1) * SQUAD_STRIDE_COLS + SQUAD_COLS - 1
    const maxRow = (deep - 1) * SQUAD_STRIDE_ROWS + SQUAD_ROWS - 1
    // **Headroom on all four sides, not only two.** The previous version framed
    // the occupied squads *plus a whole further squad* in +col and +row and
    // nothing on the other two, so at exactly a hundred developers — the moment
    // the floor unfolds and the player is watching hardest — the studio sat in
    // one corner of a frame three-quarters empty. Half a squad, symmetric,
    // puts the people in the middle and still shows somewhere for the next
    // hundred to go.
    const pad = SQUAD_COLS * 0.45
    const padRows = SQUAD_ROWS * 0.45
    return blockBox(-pad, -padRows, maxCol + pad, maxRow + padRows)
  }

  /**
   * One squad's plate, as a parallelogram in the seat grid's own axes.
   *
   * **Not a diamond.** The room's plate is a diamond because a room is a box
   * seen in projection; a hundred squad plates have to *tile*, and the diamond
   * that contains a squad's block of desks is nearly twice the block's width
   * (see `plateHalfWidth`) — laid out in a grid they would either overlap into
   * a blob or leave corridors as wide as the squads. The grid axes are affine
   * under `isoAt`, so a rectangle in seat units is a parallelogram on screen,
   * which tiles exactly and still recedes.
   */
  function platePoints(squadCol: number, squadRow: number, padCol: number, padRow: number) {
    const c0 = squadCol * SQUAD_STRIDE_COLS - padCol
    const r0 = squadRow * SQUAD_STRIDE_ROWS - padRow
    const c1 = c0 + SQUAD_COLS - 1 + padCol * 2
    const r1 = r0 + SQUAD_ROWS - 1 + padRow * 2
    return [isoAt(c0, r0), isoAt(c1, r0), isoAt(c1, r1), isoAt(c0, r1)]
  }

  function fillPlate(g: Graphics, pts: Array<{ x: number; y: number }>, fill: number) {
    g.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
    g.closePath().fill(fill)
  }

  function buildPanels() {
    for (let s = 0; s < FLOOR_SQUADS; s++) {
      const squadCol = s % FLOOR_COLS
      const squadRow = Math.floor(s / FLOOR_COLS)
      // Two footprints per panel. The apron takes half the corridor on every
      // side, so panels **tile with no gaps**: the corridor is a darker band of
      // floor between two plates rather than a hole through to the background.
      // §7.8.1a puts §7.8.6's walkers in it, and they cannot walk on a hole.
      const apron = platePoints(squadCol, squadRow, CORRIDOR_COLS / 2, CORRIDOR_ROWS / 2)
      const pts = platePoints(squadCol, squadRow, PLATE_PAD_COLS, PLATE_PAD_ROWS)
      const base = new Graphics()
      fillPlate(base, apron, c(RAMPS.NEUTRAL[1]))
      fillPlate(base, pts, c(RAMPS.WOOD[0]))
      // The plate's own edge, so a squad reads as a plate rather than as a
      // region of one continuous floor. The corridor is the gap; this is the
      // lip that makes the gap visible.
      base
        .moveTo(pts[0].x, pts[0].y)
        .lineTo(pts[1].x, pts[1].y)
        .lineTo(pts[2].x, pts[2].y)
        .lineTo(pts[3].x, pts[3].y)
        .closePath()
        .stroke({ width: 2, color: c(RAMPS.NEUTRAL[2]) })
      const sheen = new Graphics()
      fillPlate(sheen, apron, c(RAMPS.GLOW[1]))
      sheen.alpha = 0

      const holder = new Container()
      holder.addChild(base, sheen)
      // Hinged on the corner facing squad 0, so the panel swings out of its
      // neighbour rather than growing out of its own middle. Pivot and
      // position are the same point because the geometry is drawn in room
      // coordinates — the panel does not move, it opens.
      holder.pivot.set(apron[0].x, apron[0].y)
      holder.position.set(apron[0].x, apron[0].y)
      panels.push({ root: holder, base, sheen, squadCol, squadRow })
      plates.addChild(holder)
    }
    applyUnfold(unfoldT < 0 ? 0 : unfoldT)
  }

  /** Put every panel where progress `t` says it is. */
  function applyUnfold(t: number) {
    for (const p of panels) {
      const u = panelProgress(t, p.squadCol, p.squadRow)
      const open = panelOpen(u)
      // Sideways or forward, whichever direction the panel is mostly opening
      // in. A single axis is enough: the other one is the hinge.
      const sideways = p.squadCol >= p.squadRow
      p.root.scale.set(sideways ? open : 1, sideways ? 1 : open)
      p.root.visible = u > 0
      p.sheen.alpha = panelLight(u) * 0.35
    }
    // Squad 0 is already open and stays open — §7.8.1c, "the single squad
    // stays where it is and stays the size it is."
    if (panels.length > 0) {
      panels[0].root.scale.set(1, 1)
      panels[0].root.visible = true
      panels[0].sheen.alpha = 0
    }
    // A squad's desks wait for its panel. Landing a desk on a panel that is
    // still edge-on is the one thing that would give the trick away.
    for (let s = 0; s < squadDesks.length; s++) {
      const p = panels[s]
      // Squad 0 is exempt: its panel never turns, so its hundred people must
      // never blink out. They are the reason the floor is opening.
      squadDesks[s].visible = s === 0 || !p || panelProgress(t, p.squadCol, p.squadRow) >= 0.5
    }
    for (let i = 0; i < devs.length; i++) {
      const g = squadDesks[Math.floor(i / SQUAD_SIZE)]
      devs[i].visible = i < desks.length && (!g || g.visible)
    }
    // The room folds away as the floor opens: its walls, its dressing and the
    // surplus of plate around squad 0 all belong to a room that has just been
    // outgrown.
    shell.alpha = 1 - Math.min(1, t / 0.6)
    light.alpha = shell.alpha
  }

  rebuild(1)

  return {
    container: root,
    setHeadcount(devsCount: number) {
      const clamped = Math.max(1, Math.floor(devsCount))
      if (clamped === lastDevs) return
      lastDevs = clamped
      rebuild(clamped)
    },
    animate(elapsed: number, state: string, dt = 1 / 60, entropy = 0) {
      // §7.8.1c — the unfold, on `dt` rather than on `elapsed`, because it is
      // an event with a start and must not jump forward while the tab is
      // hidden (trap 3). Once it lands it costs one comparison a frame.
      if (unfoldT >= 0 && unfoldT < 1) {
        unfoldT = Math.min(1, unfoldT + (dt * 1000) / UNFOLD_MS)
        applyUnfold(unfoldT)
        applyFit(unfoldT)
      }
      // §7.8.6 — ambient life. Fed the desks and the walkable destinations; it
      // decides who is doing what and hands back an offset per seat.
      //
      // `walkTargets` is empty once §7.8.1's crowding has taken the walkway,
      // which stops the water trips with it. That is the correct behaviour and
      // a better joke than the walk was: **a crowded floor stops being able to
      // reach the cooler.**
      ambient.update(dt, {
        seats: desks,
        props: currentProps.walkway ? walkTargets : [],
        devs: desks.length,
        entropy,
        drawnIndividually: true,
        // Read off the live world transform rather than plumbed down from the
        // stage: the camera's scale is already baked into it, and a second copy
        // passed by hand is a second thing that can be one frame stale.
        worldScale: root.worldTransform.a,
      })

      // §7.8.3 — a transform on a static part, never a spritesheet. The whole
      // motion budget for a hundred people is one hop per person per frame.
      //
      // Stillness is a state and must read as deliberate: an Overwhelmed
      // developer has their head on the desk and a 10x Engineer is facing the
      // camera, and both are legible *because* the floor around them moves.
      const still = state === 'overwhelmed' || state === 'tenx'
      // Hops per second. Carried over from the old bob's angular rates divided
      // by 2π rather than retuned, because those were tuned against the §8.2
      // state list and the *relative* speeds are the part that carries meaning:
      // Flow is not "fast", it is faster than Working.
      const hz = (state === 'flow' ? 11 : state === 'rogue' ? 15 : state === 'slacking' ? 2.5 : 6.2) / 6.283
      const reach = state === 'slacking' ? 0.6 : 1

      // §7.8.8 — the spin. At most two people are ever mid-turn (the one
      // arriving and the one leaving), so this is two lerps, not a pass.
      const turnT = Math.min(1, (performance.now() - turnAt) / TURN_MS)
      if (turnT >= 1 && turningOut >= 0) turningOut = -1

      for (let i = 0; i < desks.length; i++) {
        const d = devs[i]
        if (!d.visible) continue

        const turning = i === selected || i === turningOut
        const facing = i === selected
        const t = turning ? turnT : 1
        // Halfway through the squash there is nothing on screen, so the pose
        // swap is invisible — which is the entire point of the squash.
        const shown = turning && t < 0.5 ? !facing : facing
        const [back, front] = d.children as Graphics[]
        back.visible = !shown
        front.visible = shown
        // Per-developer phase offset, hashed from the index rather than drawn
        // at random so it is identical every run. Without it a hundred people
        // hop in unison and read as one bouncing object rather than a crowd —
        // §7.8.3 calls this non-negotiable and it is the single cheapest thing
        // that makes the room feel populated. It matters more for a hop than it
        // did for the old bob: forty figures leaving the ground on the same
        // frame is a Mexican wave.
        const offset = ((i * 2654435761) % 1024) / 1024

        if (jolts[i] > 0) jolts[i] = Math.max(0, jolts[i] - 0.06)
        const walk = ambient.offsetFor(i)
        // §7.8.9 — a developer in the player's hand dangles. Legs cycling, a
        // slight swing, and lifted clear of the floor, because the whole read
        // is "held by the scruff" and a held figure that stays upright looks
        // like it is flying. They do not hop while held: whatever they are
        // doing in mid-air, pushing off it is not it.
        const held = i === ambient.carrying
        const hopping = !still && !held
        const phase = elapsed * hz + offset
        const lift = hopping ? hopHeight(phase) * HOP_HEIGHT * reach : 0
        const sway = hopping ? hopSway(phase) * HOP_SWAY * reach : 0
        const squash = hopping ? hopSquash(phase) : 1

        d.scale.x = turning ? turnScale(t) : 1
        d.scale.y = squash
        d.rotation = held ? Math.sin(elapsed * 9) * 0.12 : 0
        // The jolt sits on top of the hop: §8.2's "sprite jolts upright".
        //
        // `BODY_BASE` compensates the squash. The container's origin is at the
        // waist and the drawn figure hangs below it, so scaling Y about the
        // origin lifts the bottom of the body off the seat — the one place a
        // squash must never move.
        d.position.set(
          desks[i].x + walk.x + sway,
          desks[i].y + 6 - lift + walk.y - jolts[i] * 5 - (held ? 16 : 0) + BODY_BASE * (1 - squash),
        )
      }
    },
    hands: ambient,
    setSelected(index: number) {
      if (index === selected) return
      // Both the outgoing and the incoming developer have to turn, so the two
      // are tracked separately and the animation runs on whichever is mid-spin.
      turningOut = selected
      selected = index
      turnAt = performance.now()
    },
    setSeed(next: number) {
      if (next === seed) return
      seed = next
      // Every look is baked into a Graphics at construction, so a new seed
      // means new containers rather than a repaint. Only ever happens on a
      // Paradigm Shift, which is already a scene change.
      for (const d of devs) d.destroy()
      devs.length = 0
      jolts.length = 0
      devLayer.removeChildren()
      lastDevs = -1
      // §7.8.1c happens once *per run*. A Paradigm Shift is a new run and a new
      // studio of one, so the floor folds back up with everything else —
      // otherwise the biggest one-shot in the tier is spent for the lifetime of
      // the page, which is the same bug the Act IV dolly had.
      unfoldT = -1
      for (const p of panels) p.root.destroy({ children: true })
      panels.length = 0
      plates.removeChildren()
      for (const g of squadDesks) g.destroy()
      squadDesks.length = 0
      deskLayer.removeChildren()
      shell.alpha = 1
      light.alpha = 1
    },
    jolt(i: number) {
      if (i >= 0 && i < jolts.length) jolts[i] = 1
      // §7.8.6 rule 5 — a poke beats ambience. A player who taps somebody and
      // gets no reaction because that person happened to be chatting has been
      // told the game is a cutscene.
      ambient.interrupt(i)
    },
    deskFor(i: number) {
      return seatPosition(i)
    },

    deskAt(i: number) {
      return desks[i] ?? null
    },
    get drawn() {
      return desks.length
    },
    extent,
  }
}
