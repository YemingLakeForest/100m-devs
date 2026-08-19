/**
 * Level 1 — the room. GDD §7.8.1, and the §7.7.1 rungs it covers.
 *
 * This tier is not "a desk". It is **the whole of the studio from one developer
 * to about a hundred**, because §7.7.1 caps the zoom ceiling at one room until
 * the headcount earns more — so everything in rungs 0–2 has to happen here.
 *
 * §7.8.1's table is the brief and it is followed literally:
 *
 *   1        one desk in a dark home garage, lit only by the monitor
 *   2        a second desk pushed alongside. James. Shelving, a beer fridge
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
 * The first frames are a **home garage**, not an office — §21's scene setting
 * is "a single developer sits in a messy bedroom/garage", and the garage is the
 * funnier and more legible half. The shell carries the permanent garage bones
 * (the door, the concrete slab, the block walls) and the props carry the
 * junk (workbench, shelves, beer fridge); none of it ever leaves, so the
 * studio's later growth reads as an office filling a converted garage, which
 * is exactly the founding myth the game is telling.
 *
 * Everything here is drawn in code from the master palette — ART_DIRECTION §4
 * classes room furniture as T3 commodity, buyable or generatable, and none of
 * it is authored yet. It reads as composed and in-palette rather than as pixel
 * art, and it is built so authored sprites drop into the same slots later.
 */

import { Container, Graphics } from 'pixi.js'
import { cellSquare, gridSide } from './grid.ts'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { HAIR_RAMP, SHIRT_RAMP, SKIN_BASE } from '../art/personPalette.ts'
import { createAmbient, type Seat } from './ambient.ts'
import { developerAt, type Look } from '../sim/identity.ts'
import {
  DEFAULT_FOUNDER,
  founderLook,
  type FounderProfile,
} from '../game/founderProfile.ts'
import { AVATAR_HAIR, frontAvatarParts, type AvatarRect } from './avatarParts.ts'
import type { SeatMark } from './heroBadges.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** 2:1 isometric — ART_DIRECTION §1. Shared with scene.ts. */
const TILE_W = 64
const TILE_H = 32

/**
 * The shell is not the visual bound: monitors, the founder, heads and wall
 * props stand beyond its floor/wall box. The camera used to fit only the shell,
 * which cropped YOU even though the floor itself technically fitted.
 */
const ROOM_CONTENT_PAD_X = 84
const ROOM_CONTENT_PAD_Y = 48

/**
 * Most developers this tier ever draws individually.
 *
 * **A full floor — §7.8.1a's own number, and §23.3 criterion 4's.** It was 120,
 * on the reasoning that "past it the swarm is the floor's job and these become
 * 1,000 particles instead", and that handover was the whole problem: rung 2 is
 * where the entire hundred-to-a-thousand band of the game lives, and it was
 * being drawn as an abstract particle grid with no walls, no plates and no
 * individuals in it.
 *
 * The perf reason turned out not to exist. Measured at a thousand real
 * developers — a thousand `Container`s with their own faces, hops and idle
 * animation — the room holds **59 fps** on the desktop reference, which is the
 * same figure the particle floor was getting. The particle path was bought with
 * a cost that was never charged.
 */
export const ROOM_DEV_CAP = 1000

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

/**
 * The floor margin around the desk block, in tiles — how open the room is.
 *
 * §7.8.1's table, read as three numbers: up to ten developers the room hugs
 * like the garage it starts as; across the 11–30 band the walls push outward
 * until the room reaches its full open-plan size; past forty the floor is
 * crowded and the margin closes again, which is the "the room gets worse as
 * it fills" half of the thesis.
 *
 * The first gate is the one §7.8.1 names and it is worth restating as a
 * requirement rather than a tuned curve: **a room sized for a hundred
 * developers is not available to a studio of two.** Two developers get a
 * home garage; ten developers get a small office; the hundred-developer open
 * plan is something the headcount has to earn, one hire at a time, across
 * the band the table calls "walls push outward".
 */
export const ROOM_TIGHT_MARGIN = 0.6
export const ROOM_OPEN_MARGIN = 1.1
export const ROOM_CROWD_MARGIN = 0.4

/**
 * How much wider than its desks the open-plan floor is — §7.8.1c.
 *
 * A surround rather than a fraction: past the unfold the slab has to *contain*
 * the block, so anything below 1 draws a floor smaller than the people on it.
 * Six per cent is a walkway round the outside, which is what an office has.
 */
export const OPEN_FLOOR_SURROUND = 1.06
/** §7.8.1's "11–30: walls push outward" — below this the room stays tight. */
export const ROOM_OPENS_AT = 10
/** The headcount at which the open plan is fully open — §7.8.1's 31–100 band. */
export const ROOM_FULL_AT = 30

export function roomMargin(devs: number): number {
  const n = Math.max(0, Math.floor(devs))
  if (n >= CROWDING_STARTS) return ROOM_CROWD_MARGIN
  const t = Math.min(1, Math.max(0, (n - ROOM_OPENS_AT) / (ROOM_FULL_AT - ROOM_OPENS_AT)))
  return ROOM_TIGHT_MARGIN + t * (ROOM_OPEN_MARGIN - ROOM_TIGHT_MARGIN)
}

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
  /** The install identity drawn at §7.8.10's permanent corner desk. */
  setFounderProfile(profile: FounderProfile): void
  /** §7.8.7 — set the run seed. Rebuilds every developer's appearance. */
  setSeed(seed: number): void
  /**
   * §26.2.2 — which thousand seats of the studio this room is a picture of.
   *
   * Zero is the studio's own first floor and is what the whole of a normal run
   * uses. Above the room, descending into a unit sets this to that unit's first
   * seat, which is what makes "zoom in and it resolves" resolve to the people
   * who are actually in the thing that was pointed at.
   *
   * **Seats are global throughout this handle.** `setSelected`, `setSpeaker`,
   * `setCoverage` and `deskAt` all speak the room's own local indices, and the
   * caller converts — see `seatWindow`.
   */
  setSeatWindow(from: number): void
  /** The global seat index this room's local seat 0 is. */
  readonly seatWindow: number
  /** §7.8.8 — who is turned round to face the camera. -1 for nobody. */
  setSelected(index: number): void
  /**
   * §13.11.1 — the coverage footprint, one mark per covered seat.
   *
   * Safe to call every frame: the marks are folded to a key and the Graphics is
   * only rebuilt when that key moves, which is a few times a run. The caller
   * therefore does not have to know when a placement changed, and cannot get
   * that wrong (`refreshHeroFold` had to, and this is the same trade).
   */
  setCoverage(marks: ReadonlyMap<number, SeatMark>): void
  /**
   * §10.7a.1 — who is speaking a line of dialogue, turned to camera for it.
   * -1 for nobody (or for `STUDIO_OS`, which has no body). A seat, not an
   * identity, on the same argument §7.8.8 makes for selection.
   */
  setSpeaker(index: number): void
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
   *
   * `frozen` is §10.7a.3: while a scene is up the floor holds the instant the
   * scene opened — mid-motion, not settled — while the room's own geometry
   * transitions keep running.
   */
  animate(elapsed: number, state: string, dt?: number, entropy?: number, frozen?: boolean): void
  /** Jolt developer `i` — the §8.2 poke reaction. */
  jolt(i: number): void
  /** Your CODE action has its own physical reaction at the corner desk. */
  joltFounder(): void
  /** Room-local Hero Anchor for the desk-focused camera move. */
  founderDeskAt(): { x: number; y: number }
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
 * first frame is still a garage that hugs the one person in it.
 */
export function gridFor(devs: number): { cols: number; rows: number } {
  const n = Math.max(0, Math.min(SQUAD_SIZE, Math.floor(devs)))
  const cols = Math.min(SQUAD_COLS, n)
  return { cols, rows: n === 0 ? 0 : Math.ceil(n / SQUAD_COLS) }
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
  // **Squads fill in square shells, not along a row.** `squad % FLOOR_COLS` put
  // the first ten squads side by side in a single line ten squads long, so a
  // room of a thousand — every room above the first storey, which is to say
  // every room in the second half of the game — was a conveyor belt across the
  // horizon rather than a floor. `grid.ts`'s shells keep any number of squads
  // inside a square while still giving each one a fixed place, so §7.8.1b's
  // rule holds at the squad as well as at the chair: nothing moves under
  // anybody when the next hundred arrive.
  const at = cellSquare(squad)
  return {
    squad,
    col: within % SQUAD_COLS,
    row: Math.floor(within / SQUAD_COLS),
    squadCol: at.col,
    squadRow: at.row,
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
 * §7.8.10 — your desk lives on the room's true north vertex.
 *
 * Both floor axes have the same projected distance, so x resolves to exactly
 * zero and y is the furthest point away from the player. This is deliberately
 * not a vague upper-right offset: the founder owns the north corner itself and
 * no developer row can ever build through it.
 *
 * Kept close to row zero rather than pushed further out. The room's plate is a
 * diamond that must contain both the founder's corner and the first developer
 * row, so this offset *is* the room's size at a two-person studio — pull it
 * out and the garage becomes a hall before a single hire sits down. §7.8.1's
 * first frame is "one desk in a dark home garage", and a garage is only small
 * enough to read as one if the corner desk and row zero are within reach of
 * each other.
 */
export const FOUNDER_CORNER_ROW = -1.6
export const FOUNDER_CORNER_COL = FOUNDER_CORNER_ROW * PITCH_ROW

export function founderDeskPosition(): { x: number; y: number } {
  return isoAt(FOUNDER_CORNER_COL, FOUNDER_CORNER_ROW)
}

/** Space for the monitor and the founder's head below the north wall seam. */
export const FOUNDER_NORTH_CLEARANCE = 72

export function foldedRoomCentre(floorHalfHeight: number): { x: number; y: number } {
  const founder = founderDeskPosition()
  return {
    x: founder.x,
    // The north floor vertex is centreY - floorHalfHeight. Anchor that vertex
    // to the founder instead of centring a huge symmetric diamond around zero.
    y: founder.y - FOUNDER_NORTH_CLEARANCE + floorHalfHeight,
  }
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
  /** Kept in the shape for compatibility; the studio itself has no rug. */
  rug: boolean
  /** The garage workbench with its pegboard — the room's origin story. */
  workbench: boolean
  /** Garage shelving with paint cans and boxes. */
  shelf: boolean
  /** The garage beer fridge. A walk target for §7.8.6's water trips. */
  fridge: boolean
}

export function propsAt(devs: number): RoomProps {
  const crowded = devs >= CROWDING_STARTS * 2

  return {
    // The garage junk is the room's oldest furniture and the founding myth in
    // set dressing: it is there from the first frames, and like every other
    // prop it never leaves — the office that grows over it is an office in a
    // converted garage.
    workbench: devs >= 1,
    shelf: devs >= 2,
    fridge: devs >= 2,
    whiteboard: devs >= 3,
    whiteboardRight: devs >= 11,
    // Once a prop has entered the office it remains part of its history. Room
    // growth may make it look increasingly ill-advised, but never deletes it.
    plants: devs >= 24 ? 4 : devs >= 11 ? 3 : devs >= 6 ? 2 : devs >= 3 ? 1 : 0,
    coffee: devs >= 6,
    waterCooler: devs >= 8,
    filingCabinet: devs >= 14,
    printer: devs >= 18,
    // Breakout seating is the most floor per person in the room, so it is the
    // first real furniture to be sacrificed.
    sofa: devs >= 20,
    // Cardboard arrives when hiring outruns tidying, and it never leaves —
    // §7.8.1's crowding takes away the things people chose and keeps the
    // things nobody did.
    boxes: devs >= 31 ? (crowded ? 5 : 3) : devs >= 20 ? 1 : 0,
    bin: devs >= 6,
    posters: devs >= 24 ? 3 : devs >= 11 ? 2 : devs >= 5 ? 1 : 0,
    // Dividers need floor space between desks, and that is exactly what runs
    // out first.
    dividers: devs >= 11,
    serverRack: devs >= 11,
    cables: devs >= 31,
    walkway: devs < CROWDING_STARTS,
    // A small fixed mat belongs to the founder workstation only. It never
    // scales into the detached second-floor shape the old room rug became.
    rug: true,
  }
}

/**
 * The gap left between a prop's back face and the wall behind it, in tiles.
 *
 * Deliberately tiny — about four pixels. A prop pushed *into* the wall is a
 * modelling error and a prop standing off it is a prop nobody put there: real
 * furniture is against the skirting, with just enough clearance to show a line
 * of shadow. Both failures were on screen at once before this, and the second
 * was the reported one.
 */
export const WALL_GAP = 0.06

/**
 * A standing place **against one of the two back walls**, in room-local
 * coordinates.
 *
 * Props used to be spread evenly round the whole floor diamond at an inset of up
 * to sixteen percent of it, which produced both halves of the reported defect at
 * once: the ones on the two *front* edges had no wall behind them at all — the
 * room is open toward the camera — so a water cooler sat in the dark past the
 * front corner looking like it was floating, and the ones that did have a wall
 * were most of a metre off it.
 *
 * The fix is to stop parameterising the perimeter and start naming the wall. The
 * floor diamond is a square in the grid's own axes, so the back-left wall is
 * simply `gx = -s` and the back-right is `gy = -s`, and standing something
 * against one is a matter of adding its own half-depth back on. `u` runs 0..1
 * along the wall from the back corner outward; `depth` is the prop's footprint
 * in tiles, so a wide cabinet and a narrow bin both end up with their backs on
 * the same line rather than their centres.
 */
export function wallSpot(
  wall: 'left' | 'right',
  u: number,
  cx: number,
  cy: number,
  halfTiles: number,
  depth: number,
): { x: number; y: number } {
  const s = halfTiles
  const along = -s + Math.min(1, Math.max(0, u)) * 2 * s
  const back = -s + depth / 2 + WALL_GAP
  const p = wall === 'left' ? gridToScreen(back, along) : gridToScreen(along, back)
  return { x: cx + p.x, y: cy + p.y }
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
// §7.8.7's three colour tables now live in `art/personPalette.ts` — §22.9's
// card draws a person in the DOM, and a second copy of "which ramp entry is
// James's orange" is the quiet divergence ART_DIRECTION §0 forbids.

/** The four creator silhouettes, shared by generated developers and YOU. */
function torsoShape(look: Look): { w: number; h: number } {
  switch (look.body % 4) {
    // Tee — the narrowest, clearly the smallest silhouette.
    case 1: return { w: 12, h: 18 }
    // Jacket — the broadest shoulders in the room.
    case 2: return { w: 22, h: 18 }
    // Knit — the tallest, a turtleneck body.
    case 3: return { w: 16, h: 22 }
    // Hoodie — boxy, in between.
    default: return { w: 18, h: 19 }
  }
}

/** Details large enough to survive the room scale; no preview-only costume. */
function drawTorsoDetails(g: Graphics, look: Look, front: boolean) {
  const body = look.body % 4
  if (body === 0) {
    // Hoodie: a hood read from behind as a cowl around the neck, the zip on the front.
    if (!front) g.ellipse(0, -11, 8, 5).fill(c(RAMPS.NEUTRAL[2]))
    g.rect(-5, -13, 10, 3).fill(c(RAMPS.NEUTRAL[2]))
    if (front) g.rect(-0.75, -9, 1.5, 13).fill(c(RAMPS.NEUTRAL[2]))
  } else if (body === 1) {
    // Tee: plain — its narrow width is the whole statement.
  } else if (body === 2) {
    // Jacket: a shoulder seam across the top, and two lapels on the visible front.
    if (!front) g.rect(-11, -12, 22, 2).fill(c(RAMPS.NEUTRAL[4]))
    g.rect(-0.75, -12, 1.5, 16).fill(c(RAMPS.NEUTRAL[2]))
    if (front) {
      g.moveTo(-6, -12).lineTo(-1, -5).lineTo(-1, -11).closePath().fill(c(RAMPS.NEUTRAL[4]))
      g.moveTo(6, -12).lineTo(1, -5).lineTo(1, -11).closePath().fill(c(RAMPS.NEUTRAL[3]))
    }
  } else if (body === 3) {
    // Knit: a roll collar (turtleneck) around the neck, and rib bands below.
    if (!front) g.rect(-6, -16, 12, 5).fill(c(RAMPS.NEUTRAL[4]))
    for (let y = -8; y <= 2; y += 5) {
      g.rect(-6, y, 12, 1).fill({ color: c(RAMPS.NEUTRAL[5]), alpha: 0.42 })
    }
  }
}

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
  const [shirtRamp, shirtBase] = SHIRT_RAMP[look.shirt % SHIRT_RAMP.length]
  const [hairRamp, hairBase] = HAIR_RAMP[look.hairColour % HAIR_RAMP.length]
  const hair = AVATAR_HAIR[look.hair % AVATAR_HAIR.length]
  const skin = SKIN_BASE[look.skin % SKIN_BASE.length]
  const torso = torsoShape(look)

  isoBox(g, 0, 5, torso.w, torso.h, shirtRamp, shirtBase, false)
  drawTorsoDetails(g, look, true)
  // The face. A flat panel rather than a box: it is turned to the camera, so
  // its two vertical faces are edge-on and drawing them would be a lie.
  g.rect(-6, -26, 12, 14).fill(c(RAMPS.SKIN[skin]))
  // Hair over the crown and down the sides, leaving the face clear.
  g.rect(-hair.w / 2, -26 - hair.h + 8, hair.w, hair.h - 6).fill(c(hairRamp[hairBase]))
  g.rect(-hair.w / 2, -24, 2, 8).fill(c(hairRamp[hairBase]))
  g.rect(hair.w / 2 - 2, -24, 2, 8).fill(c(hairRamp[hairBase]))
  const partColour: Record<AvatarRect['colour'], number> = {
    ink: c(RAMPS.NEUTRAL[0]),
    mouth: c(RAMPS.NEUTRAL[1]),
    hair: c(hairRamp[hairBase]),
    glasses: c(RAMPS.NEUTRAL[2]),
    'phone-band': c(RAMPS.NEUTRAL[1]),
    'phone-cup': c(RAMPS.NEUTRAL[2]),
  }
  for (const part of frontAvatarParts(look)) {
    g.rect(part.x, part.y, part.w, part.h).fill(partColour[part.colour])
  }
}

export function buildDeveloper(look: Look): Container {
  const dev = new Container()
  const g = new Graphics()

  const [shirtRamp, shirtBase] = SHIRT_RAMP[look.shirt % SHIRT_RAMP.length]
  const [hairRamp, hairBase] = HAIR_RAMP[look.hairColour % HAIR_RAMP.length]
  const hair = AVATAR_HAIR[look.hair % AVATAR_HAIR.length]
  const skin = SKIN_BASE[look.skin % SKIN_BASE.length]
  const torso = torsoShape(look)

  // Torso and head, as solids. Lighter on the south-west face, darker on the
  // back — the same top-left key the props and the walls obey.
  isoBox(g, 0, 5, torso.w, torso.h, shirtRamp, shirtBase, false)
  drawTorsoDetails(g, look, false)
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
 * the projection — the pair this replaced was a screen width and a screen
 * height, and a screen diamond of width `w` and height `w / 4` is not a
 * 2:1 rectangle seen in isometric. It is not a ground-aligned shape at all: a
 * 2:1 rectangle on the floor projects to a *parallelogram*, and only a square
 * projects to a diamond. The comment that used to sit here derived `w / 4` very
 * carefully from the wrong premise.
 */
export const DESK_SPAN = PITCH_COL
/**
 * How deep a desk is, across the row, in floor tiles.
 *
 * Was 0.62 and reported as "the table [is] too deep". It was: a desk is about
 * 1.5 m along the row and 0.7 m across it, and `PITCH_COL` is that 1.5 m, so
 * the honest ratio is a little under a half rather than nearly two thirds.
 */
export const DESK_DEPTH = 0.46
/**
 * How far the bank sits **behind** the seat, in floor tiles — and the fix for
 * the plainest defect in the room.
 *
 * The desk used to be drawn centred on the seat point, which is also where the
 * person is drawn. The two therefore occupied the same footprint, the desk was
 * painted first, and the figure came down on top of it: reported as *"person is
 * placed wrong, it shows that he is on top of the table"*, which is exactly what
 * it looked like.
 *
 * A person at a desk is **in front of it**. They face north-west into their
 * monitor (see `buildDeveloper`), so their desk is north-west of them — further
 * from the camera, up and left on screen, and partly hidden behind their own
 * back. Setting the bank back by rather more than half its own depth puts the
 * surface at chest height with the body in front of it, which is what sitting at
 * a desk looks like from behind.
 *
 * Comfortably inside {@link PITCH_ROW}, so the row behind still has its aisle.
 */
export const DESK_SETBACK = 0.32
/**
 * How far the surface stands proud of its own footprint, in screen pixels.
 *
 * Small on purpose. The seated figure is drawn waist-up with its mass sunk
 * below the seat point, so a desk lifted to a *measured* 0.73 m would sit at the
 * shoulders of the person at it. Five pixels is enough to put a lit edge and a
 * shadow between the surface and the floor, which is all the height a 2:1
 * projection can show anyway.
 */
const DESK_H = 5
/** Valance depth — the drop from the surface to the underside. */
const DESK_LIP = 11
/** The screen offset from a seat to the centre of the desk it sits at. */
function deskOffset() {
  return gridToScreen(-DESK_SETBACK, 0)
}

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
  // Set back from the seats — see {@link DESK_SETBACK}. This one subtraction is
  // the difference between a person at a desk and a person standing on one.
  const gx = row * PITCH_ROW - DESK_SETBACK
  const d = DESK_DEPTH / 2

  // The four corners of a rectangle **on the floor**, projected. Not a
  // screen-space shape that happens to look isometric: a run of desks is a
  // rectangle in the room, so its outline is whatever the projection makes of
  // one, and its two long edges come out parallel to the wall for free.
  //
  // `back` is the topmost corner on screen, `far` the leftmost, `front` the
  // bottom and `near` the right — so the two edges turned toward the camera are
  // `far`–`front` (the south-west end cap) and `front`–`near` (the long side).
  const foot = {
    back: gridToScreen(gx - d, gy0),
    far: gridToScreen(gx - d, gy1),
    front: gridToScreen(gx + d, gy1),
    near: gridToScreen(gx + d, gy0),
  }
  const lift = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - DESK_H })
  const back = lift(foot.back)
  const far = lift(foot.far)
  const front = lift(foot.front)
  const near = lift(foot.near)

  // The shadow the bank casts on the floor it stands on. Same argument as
  // `isoBox`'s contact ellipse: the projection throws away occlusion at the
  // base, so without something under it a surface reads as floating however
  // correctly it is placed. Offset down-right, away from §7's top-left key.
  g.moveTo(foot.back.x + 3, foot.back.y + 2)
    .lineTo(foot.far.x + 3, foot.far.y + 2)
    .lineTo(foot.front.x + 3, foot.front.y + 2)
    .lineTo(foot.near.x + 3, foot.near.y + 2)
    .closePath()
    .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.38 })

  // The valance, on the two edges that face the camera. ART_DIRECTION §7's
  // single top-left source: the long south-east side of the run turns away from
  // it, and the south-west end cap catches it.
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

  g.moveTo(back.x, back.y)
    .lineTo(far.x, far.y)
    .lineTo(front.x, front.y)
    .lineTo(near.x, near.y)
    .closePath()
    .fill(c(RAMPS.WOOD[2]))

  // The lit edge along the two far sides, where the top-left source catches the
  // lip of the surface. One pixel, and it is what separates the top of the desk
  // from the floor beyond it at the point they meet.
  g.moveTo(far.x, far.y)
    .lineTo(back.x, back.y)
    .lineTo(near.x, near.y)
    .stroke({ width: 1, color: c(RAMPS.WOOD[3]) })
  // And the shadow line under the surface, where the top meets the valance.
  g.moveTo(far.x, far.y)
    .lineTo(front.x, front.y)
    .lineTo(near.x, near.y)
    .stroke({ width: 1, color: c(RAMPS.WOOD[1]) })

  // A seam per desk along the run, so a bank of eight reads as eight desks
  // pushed together rather than as one very long table. Interior joints only —
  // the ends already have the outline.
  for (let col = colFrom + 1; col <= colTo; col++) {
    const gy = col * PITCH_COL - DESK_SPAN / 2
    const a = lift(gridToScreen(gx - d, gy))
    const b = lift(gridToScreen(gx + d, gy))
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: c(RAMPS.WOOD[1]), alpha: 0.7 })
  }
}

/**
 * §13.11.1's coverage decal, in floor tiles.
 *
 * Deliberately smaller than a seat's pitch: the marks must read as **one per
 * person** at desk zoom, and a decal that fills its pitch tiles into a
 * continuous carpet the moment two adjacent seats are covered. The gap is what
 * makes a footprint countable, which is the whole of "the fraction is learned
 * by looking, not by reading `covering 8 of 4,000`".
 */
export const COVER_SPAN = 0.44

/**
 * The marks, as one comparable string.
 *
 * A string rather than a deep compare because the answer is almost always "the
 * same as last frame" and a string of a few dozen characters is cheaper to
 * build and compare than a walk over two maps. It is never parsed and never
 * stored, so its shape is nobody's business but this file's.
 */
function coverageKey(marks: ReadonlyMap<number, { colour: string; wasted: boolean; settling: boolean }>): string {
  let key = ''
  for (const [seat, m] of marks) {
    key += `${seat}${m.colour}${m.wasted ? 'w' : ''}${m.settling ? 's' : ''};`
  }
  return key
}

/** How many hatch lines cross a wasted seat — §13.8 rule 3. */
const COVER_HATCH = 3

/**
 * One seat's coverage mark, drawn on the floor — GDD §13.11.1, §7.8.13 rule 2.
 *
 * A square on the ground, which the 2:1 projection turns into a diamond, and
 * the hatch lines run **along a floor axis** for the same reason: a screen-space
 * diagonal across an isometric tile is a shape that does not lie on the floor,
 * and at this size the eye reads that as a rendering fault rather than as a
 * mark. `drawDeskBank` above makes the same argument at greater length.
 *
 * Three states, and each is a rule rather than a style:
 *
 * - **Covered** — filled in the branch colour. §13.11.1: the footprint is drawn.
 * - **Wasted** — filled and then hatched. §13.8 rule 3, and §13.11.1 is explicit
 *   that "the player is never told they have made a mistake; they can just see
 *   the hatched area and move somebody."
 * - **Settling** — the outline alone, because it is not coverage yet. §13.8
 *   rule 4 makes relocation cost time and §13.11.1 wants that time on screen.
 */
export function drawSeatCoverage(
  g: Graphics,
  index: number,
  mark: { colour: string; wasted: boolean; settling: boolean },
) {
  const { col, row } = seatGrid(index)
  const gx = row * PITCH_ROW
  const gy = col * PITCH_COL
  const d = COVER_SPAN / 2
  const colour = c(mark.colour)

  const back = gridToScreen(gx - d, gy - d)
  const far = gridToScreen(gx - d, gy + d)
  const front = gridToScreen(gx + d, gy + d)
  const near = gridToScreen(gx + d, gy - d)

  const outline = () =>
    g
      .moveTo(back.x, back.y)
      .lineTo(far.x, far.y)
      .lineTo(front.x, front.y)
      .lineTo(near.x, near.y)
      .closePath()

  if (mark.settling) {
    outline().stroke({ width: 1, color: colour, alpha: 0.55 })
    return
  }

  outline().fill({ color: colour, alpha: 0.3 })
  outline().stroke({ width: 1, color: colour, alpha: 0.85 })

  if (!mark.wasted) return
  // The hatch is drawn in the same colour rather than in a warning red. Nothing
  // has gone wrong — two heroes of one branch is a legal board that is paying
  // for one of them twice — and a red mark on the floor would be the scolding
  // §13.11.1 refuses.
  for (let i = 1; i <= COVER_HATCH; i++) {
    const t = -d + (2 * d * i) / (COVER_HATCH + 1)
    const a = gridToScreen(gx + t, gy - d)
    const b = gridToScreen(gx + t, gy + d)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: colour, alpha: 0.9 })
  }
}

/**
 * A rectangle lying **flat on the desk surface**, in the floor's own axes.
 *
 * `across` runs toward the camera and `along` runs down the row, both in floor
 * tiles, so a keyboard is stated as "half a tile wide and a fifth deep" rather
 * than as a screen shape somebody eyeballed. Everything on the desk goes through
 * here for the same reason every solid goes through {@link isoBox}: a flat item
 * drawn as a screen-space rectangle is the fastest way to break the projection,
 * and there are as many of these as there are developers.
 */
function deskQuad(
  g: Graphics,
  sx: number,
  sy: number,
  across: number,
  along: number,
  w: number,
  d: number,
  fill: number,
) {
  const at = (a: number, b: number) => {
    const p = gridToScreen(across + a, along + b)
    return { x: sx + p.x, y: sy + p.y }
  }
  const p0 = at(-d / 2, -w / 2)
  const p1 = at(-d / 2, w / 2)
  const p2 = at(d / 2, w / 2)
  const p3 = at(d / 2, -w / 2)
  g.moveTo(p0.x, p0.y)
    .lineTo(p1.x, p1.y)
    .lineTo(p2.x, p2.y)
    .lineTo(p3.x, p3.y)
    .closePath()
    .fill(fill)
}

/**
 * Deterministic 0..1 per seat and per question.
 *
 * The dressing on a desk has to be *stable* — a mug that appears and disappears
 * every time the room rebuilds is worse than no mug — and it has to be free,
 * because there is one of these per developer up to a thousand of them. A hash
 * of the seat index is both: no state, no storage, identical every run.
 */
function deskRoll(seat: number, salt: number): number {
  const h = (Math.imul(seat + 1, 2654435761) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  return (h % 1000) / 1000
}

/** One person's kit on the bank — the screen they are looking at and the box under it. */
export function drawWorkstation(g: Graphics, x: number, y: number, seat = 0) {
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
  // **Everything here is placed against the desk, not against the seat.** The
  // kit stands on a surface that is set back from the person (`DESK_SETBACK`)
  // and proud of the floor (`DESK_H`), so this is where those two offsets are
  // paid: `(sx, sy)` is the point on the desk surface directly in front of the
  // developer, and every item below is a displacement from it in the floor's
  // own axes.
  const off = deskOffset()
  const sx = x + off.x
  const sy = y + off.y - DESK_H
  const S = -0.5

  // --- what is on the surface, back to front ------------------------------
  //
  // The desk is a tile wide and a little under half a tile deep, so there are
  // exactly two useful rows on it: a back row against the screen (monitor,
  // tower, and whatever the person has stopped looking at) and a front row
  // under their hands (keyboard, mouse, mug). Everything below is placed in one
  // of those two, in floor tiles, and the layout is spaced so no two items on
  // this desk or the next one along can occupy the same square inch.
  //
  // Painter order runs back to front, so the mug in front of the keyboard
  // covers a corner of it rather than being swallowed by it.
  const BACK = -0.14
  const FRONT = 0.12
  // Which hand the mouse is under. A floor of a hundred right-handers is a
  // pattern the eye finds, so it is rolled — and everything else on the front
  // row is placed against it, so nobody has their coffee where their mouse is.
  const hand = deskRoll(seat, 5) < 0.82 ? 1 : -1
  // One desk in five has a lamp; the rest have paper they have stopped reading.
  // Mutually exclusive because they want the same corner, and a corner with
  // both in it is where two props intersect.
  const lamp = deskRoll(seat, 4) < 0.2

  // Papers, pushed to the back corner where they have been for a fortnight.
  if (!lamp && deskRoll(seat, 1) < 0.55) {
    deskQuad(g, sx, sy, BACK, -0.32, 0.26, 0.16, c(RAMPS.NEUTRAL[7]))
    deskQuad(g, sx, sy, BACK - 0.01, -0.33, 0.22, 0.12, c(RAMPS.NEUTRAL[8]))
  }

  // The monitor's foot, then its neck, then the panel over both.
  isoBox(g, sx, sy - 1, 9, 3, RAMPS.NEUTRAL, 2, false)
  const my = sy - 30
  g.rect(sx - 1.5, my + 14, 3, 14).fill(c(RAMPS.NEUTRAL[2]))

  // Bezel, then the emissive face. The screen is the room's only light source,
  // so it is the one surface here allowed to ignore the top-left key.
  wallQuad(g, sx, my - 2, 30, 21, S, c(RAMPS.NEUTRAL[2]))
  wallQuad(g, sx, my, 26, 17, S, c(RAMPS.GLOW[0]))
  // Code on it. Each line is a strip in the same plane, left-aligned along the
  // panel, so the text runs across the screen rather than across the viewport.
  // Indented from the seat rather than from a constant, so no two screens in a
  // row are showing the same file.
  for (let i = 0; i < 4; i++) {
    const w = 5 + ((i * 7 + Math.floor(deskRoll(seat, 2) * 9)) % 13)
    const line = -(26 - w) / 2 + 2
    wallQuad(
      g,
      sx + line,
      my + 2 + i * 4 + S * line,
      w,
      1.5,
      S,
      c(i % 2 === 0 ? RAMPS.GLOW[2] : RAMPS.GLOW[1]),
    )
  }
  // The sliver of the monitor's own side that a panel turned away from the
  // camera shows. Two pixels, and it is the whole difference between a screen
  // and a decal. On the north-east edge, which is the one turning away now.
  g.moveTo(sx + 15, my - 9.5)
    .lineTo(sx + 17, my - 8.5)
    .lineTo(sx + 17, my + 10.5)
    .lineTo(sx + 15, my + 9.5)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[1]))
  // A sticky note on the bezel, on about half the screens. Four pixels of WARN
  // in the plane of the panel — the one piece of desk dressing that reads at a
  // full floor, because it is the only warm colour in a room lit by a blue
  // screen. Stuck *on* the bezel rather than beside it: at `sx - 16` it hung
  // off the edge of the monitor and read as a little pennant.
  if (deskRoll(seat, 3) < 0.45) {
    const nx = -11
    wallQuad(g, sx + nx, my + 4 + S * nx, 4.5, 4.5, S, c(RAMPS.WARN[2]))
  }

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
  const stand = gridToScreen(BACK, 0.33)
  const px = sx + stand.x
  const py = sy + stand.y
  // `grounded` is false — it is standing on the desk, so it gets a contact
  // patch from the surface under it rather than a floor shadow, which is
  // §7.8.1's second projection rule.
  isoBox(g, px, py, 8, 11, RAMPS.NEUTRAL, 3, false)
  // A power light. Two pixels of GLOW, and at forty desks it is the cheapest
  // thing in the room that says the machines are *on*.
  g.rect(px - 2, py - 9, 1.5, 1.5).fill(c(RAMPS.GLOW[2]))
  //
  // **There is no cable, and there was.** A one-pixel stroke ran from the tower
  // up to the panel, to "stop the two objects reading as two objects". It was
  // reported off a screenshot as "a horizontal black bar across the desk", and
  // that is exactly what it was, for two reasons that compound:
  //
  // 1. **It is nearly flat.** The tower and the monitor's foot stand on the
  //    same surface a few tiles apart, so the lead's rise is about a pixel over
  //    its whole run — a horizontal line in a picture where §7.8.1's rule is
  //    that nothing is horizontal. Trap 10 in `docs/HANDOFF.md` is this same
  //    mistake in the floor layout; a screen-flat line reads as a girder bolted
  //    across the room rather than as anything lying in it.
  // 2. **A stroke width is in room units, so it scales with the room.** At the
  //    full floor the lead is sub-pixel and invisible; at rung 0, where the room
  //    is scaled up more than tenfold, that same one pixel is a dozen on screen.
  //    It is never the width of a cable — it is either nothing or a scaffolding
  //    pole, and there is no zoom at which it is a wire.
  //
  // Anything drawn between two props at this scale wants to be geometry with a
  // footprint, not a stroke. The desk already reads as one object without it.

  // A desk lamp on about one desk in five. Vertical interest along a row that
  // is otherwise nine copies of the same silhouette.
  if (lamp) {
    const at = gridToScreen(BACK, -0.34)
    const lx = sx + at.x
    const ly = sy + at.y
    isoBox(g, lx, ly, 7, 2, RAMPS.NEUTRAL, 3, false)
    g.rect(lx - 0.75, ly - 17, 1.5, 15).fill(c(RAMPS.NEUTRAL[3]))
    g.moveTo(lx - 5, ly - 17)
      .lineTo(lx + 3, ly - 20)
      .lineTo(lx + 4, ly - 16)
      .lineTo(lx - 4, ly - 13)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[4]))
    g.ellipse(lx - 1, ly - 13, 4, 2).fill({ color: c(RAMPS.WARN[3]), alpha: 0.5 })
  }

  // --- and what is in reach: keyboard, mouse, mug -------------------------

  // The keyboard, square on to the screen, half a desk wide. Two quads: the
  // case and the key field inset into it, which is the whole of what a keyboard
  // looks like once it is eleven pixels across.
  deskQuad(g, sx, sy, FRONT, 0, 0.52, 0.15, c(RAMPS.NEUTRAL[2]))
  deskQuad(g, sx, sy, FRONT, 0, 0.46, 0.1, c(RAMPS.NEUTRAL[4]))
  // The mouse, to one side of it, and a mat under it.
  deskQuad(g, sx, sy, FRONT, hand * 0.36, 0.18, 0.14, c(RAMPS.NEUTRAL[1]))
  deskQuad(g, sx, sy, FRONT, hand * 0.36, 0.08, 0.06, c(RAMPS.NEUTRAL[5]))

  // The mug, on the other hand's side. Most desks have one, and it is the one
  // object here that says somebody has been sitting at this desk for a while.
  const mug = deskRoll(seat, 6)
  if (mug < 0.62) {
    const at = gridToScreen(FRONT - 0.02, -hand * 0.36)
    const cxm = sx + at.x
    const cym = sy + at.y
    const ramp = mug < 0.2 ? RAMPS.ALARM : mug < 0.4 ? RAMPS.CALM : RAMPS.NEUTRAL
    const base = mug < 0.4 ? 1 : 6
    isoBox(g, cxm, cym, 7, 7, ramp, base, false)
    // The handle, on the side turned toward the camera so it is not a rumour.
    g.rect(cxm + 3, cym - 6, 2, 3.5).fill(c(ramp[Math.max(0, base - 1)]))
  }
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

/**
 * The garage workbench, with its pegboard mounted on the wall above it.
 *
 * The room's oldest piece of furniture and the one that carries the garage
 * fiction hardest: a scarred wood top over a solid body, and a pegboard of
 * tools hung *in the wall plane* — which is why this prop, alone of the ring,
 * takes the wall's slope. The tools are dark slivers rather than shapes:
 * at room scale a screwdriver is a streak, and a streak is all it needs.
 */
function drawWorkbench(g: Graphics, x: number, y: number, slope: number) {
  // The body, squat and solid. Dark enough to read as a tool-strewn slab
  // rather than as a desk someone misplaced.
  isoBox(g, x, y, 26, 12, RAMPS.NEUTRAL, 3)
  // The wood top, overhanging the body on all sides — the one detail that
  // separates a workbench from a filing cabinet at this size.
  isoQuad(g, x, y - 12, 30, 7, c(RAMPS.WOOD[2]))
  isoQuad(g, x + 1, y - 14, 30, 7, c(RAMPS.WOOD[3]))
  // The pegboard, in the wall plane behind and above the bench.
  const top = y - 36
  wallQuad(g, x, top, 24, 16, slope, c(RAMPS.WOOD[2]))
  // Peg holes, sheared with the board so they lie in it.
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      const ox = -9 + col * 6
      wallQuad(g, x + ox, top + slope * ox + 2 + r * 5, 1.5, 1.5, slope, c(RAMPS.NEUTRAL[0]))
    }
  }
  // Two tools: a screwdriver and a hammer head. Dark slivers, hung where the
  // holes are not.
  wallQuad(g, x + 9, top + slope * 9 + 2, 2, 6, slope, c(RAMPS.NEUTRAL[1]))
  wallQuad(g, x + 2, top + slope * 2 + 6, 5, 2.5, slope, c(RAMPS.NEUTRAL[1]))
  wallQuad(g, x + 3.5, top + slope * 3.5 + 8, 1.5, 4, slope, c(RAMPS.NEUTRAL[1]))
}

/**
 * Garage shelving — an open metal rack of three boards, loaded with the junk
 * nobody has sorted since the place was a garage. The paint can is ALARM red
 * for the same reason the sticky notes are: one warm spot in a room lit blue.
 */
function drawShelf(g: Graphics, x: number, y: number) {
  const W = 24
  const H = 30
  const board = H / 3.4
  // Two side posts, open-fronted — a box would read as another cabinet, and
  // the point is that you can see the junk on every shelf.
  isoBox(g, x - 8.5, y, 3.5, H, RAMPS.NEUTRAL, 5)
  isoBox(g, x + 8.5, y, 3.5, H, RAMPS.NEUTRAL, 5)
  for (let s = 0; s < 3; s++) {
    isoQuad(g, x, y - (s + 1) * board, W, 4, c(RAMPS.NEUTRAL[3]))
  }
  // Bottom: a paint can. Middle: a cardboard box. Top: a green can.
  isoBox(g, x - 5, y - board, 8, 7, RAMPS.ALARM, 1, false)
  isoBox(g, x + 5, y - 2 * board, 9, 7, RAMPS.WOOD, 2, false)
  isoBox(g, x - 4, y - 3 * board, 7, 7, RAMPS.FOLIAGE, 0, false)
}

/**
 * The garage beer fridge — the first thing two developers buy as a team.
 *
 * Silver-grey rather than white: a white box in this room would read as a
 * ghost. The door seam and handle sit on the near-left face, and the magnets
 * are the two warm dots that say somebody lives here.
 */
function drawFridge(g: Graphics, x: number, y: number) {
  isoBox(g, x, y, 18, 32, RAMPS.NEUTRAL, 6)
  // The door, inset from the left face by a sliver of body.
  g.moveTo(x - 4, y - 30.5)
    .lineTo(x - 1, y - 29)
    .lineTo(x - 1, y - 3)
    .lineTo(x - 4, y - 4.5)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[5]))
  // The handle, halfway down the door.
  g.rect(x - 1.2, y - 22, 2.2, 9).fill(c(RAMPS.NEUTRAL[1]))
  // Magnets. The fridge is the one surface in a garage people actually touch.
  g.rect(x - 3, y - 14, 2, 2).fill(c(RAMPS.WARN[2]))
  g.rect(x - 3.4, y - 18, 1.6, 1.6).fill(c(RAMPS.CALM[2]))
}

/**
 * The garage door — a segmented panel on the back-right wall.
 *
 * Part of the shell, not a prop: the studio grows *inside* the garage, so the
 * door stays through every expansion. Drawn as five horizontal bands in the
 * wall plane with a handle at the pull end, and it is the single strongest
 * "this is a garage" signal in the room — an office has neither a segmented
 * door nor a concrete slab to roll one over.
 *
 * `(x0, y0)` and `(x1, y1)` are the two ends of the door's floor line; `h` is
 * its height up the wall. The top edge is parallel to the bottom for the same
 * reason the skirting is: anything else would be a shape that does not lie in
 * the wall.
 */
function drawGarageDoor(g: Graphics, x0: number, y0: number, x1: number, y1: number, h: number) {
  g.moveTo(x0, y0)
    .lineTo(x1, y1)
    .lineTo(x1, y1 - h)
    .lineTo(x0, y0 - h)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[4]))
  // The track shadow where the door meets the slab.
  g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.5, color: c(RAMPS.NEUTRAL[0]) })
  // Five panels, four seams.
  for (let i = 1; i < 5; i++) {
    const k = i / 5
    g.moveTo(x0, y0 - h * k)
      .lineTo(x1, y1 - h * k)
      .stroke({ width: 1.5, color: c(RAMPS.NEUTRAL[2]) })
  }
  // The lit top edge, and the handle at the pull end.
  g.moveTo(x0, y0 - h).lineTo(x1, y1 - h).stroke({ width: 1, color: c(RAMPS.NEUTRAL[6]) })
  g.rect(x1 - 10, y1 - h * 0.62, 3, h * 0.22).fill(c(RAMPS.NEUTRAL[1]))
}

/**
 * A UPVC window in a back wall — two flat casements in a white frame, the
 * plainest possible way to say "there is an outside". No moon, no horizon, no
 * view: a two-pane UPVC window in a converted garage is its own joke, and
 * anything busier reads as a poster stuck on the wall rather than a hole
 * through it. `(x, y)` is the centre of the frame's top edge, `slope` is the
 * wall's.
 */
function drawWindow(g: Graphics, x: number, y: number, w: number, h: number, slope: number) {
  // The white UPVC frame.
  wallQuad(g, x, y, w, h, slope, c(RAMPS.NEUTRAL[8]))
  // The glass — a steel blue clearly lighter than the wall, so the pane reads
  // as glass set into the wall rather than as the wall showing through a white
  // outline.
  wallQuad(g, x, y + 3, w - 5, h - 6, slope, c(RAMPS.GLOW[1]))
  // The central mullion, splitting the glass into two casements.
  wallQuad(g, x, y + 3, 3, h - 6, slope, c(RAMPS.NEUTRAL[8]))
  // The sill — a wider ledge along the bottom, plus the shadow it casts down
  // the wall, so the window ends on a ledge instead of floating.
  wallQuad(g, x, y + h - 3, w + 8, 4, slope, c(RAMPS.NEUTRAL[7]))
  wallQuad(g, x, y + h + 1, w + 8, 3, slope, c(RAMPS.NEUTRAL[1]))
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

/**
 * The founder gets the same proven workstation as every developer.
 *
 * The first pass drew a unique rotated desk here. Its monitor was a separate
 * hand-built projection, the person used a separate anatomy, and the result
 * looked like the founder was standing on a distorted PC. A manager is still
 * a developer: use the exact desk bank, monitor, tower and dressing primitives
 * the rest of the room uses, then place that coherent unit at the fixed corner.
 */
function drawFounderWorkstation(g: Graphics, x: number, y: number) {
  g.position.set(x, y)
  // The manager sits in the north-east corner looking back down the rows. A
  // normal desk points out of the room there; mirror the shared workstation
  // around its seat so the monitor and keyboard face the crowd instead.
  g.scale.set(-1, 1)
  drawDeskBank(g, 0, 0, 0)
  drawWorkstation(g, 0, 0, 997)
}

/** Your personalised block developer, facing out toward the studio. */
function buildFounderAvatar(profile: FounderProfile): Container {
  const avatar = buildDeveloper(founderLook(profile))
  const [back, front] = avatar.children as Graphics[]
  back.visible = false
  front.visible = true
  avatar.label = `founder:${profile.name}`
  return avatar
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
  const managerDesk = new Graphics()
  // Desks, one Graphics per squad. Split so a squad's desks can be withheld
  // until its panel has finished turning — trap 7 still holds *within* each
  // one, and squads are themselves laid down in painter order, so index order
  // is still the correct depth order end to end.
  const deskLayer = new Container()
  const devLayer = new Container()
  const founderLayer = new Container()
  /** §13.11.1 — the coverage footprint, painted on the floor under everybody. */
  const coverage = new Graphics()
  // Previous room geometry lives just long enough to cross-fade into an
  // expanded room. Developers stay in their real containers, so an old hire
  // never blinks out while the walls move.
  const previousShell = new Container()
  const previousFurniture = new Container()
  const previousDesks = new Container()
  // Labelled because the layer list is now long enough that finding it by
  // child index is a test that breaks every time a layer is added.
  devLayer.label = 'developers'
  founderLayer.label = 'founder'
  plates.label = 'plates'
  deskLayer.label = 'desks'
  coverage.label = 'coverage'
  const ambient = createAmbient()
  // Bubbles go above everyone, including the people in the front row — a
  // speech bubble occluded by the desk in front of it is not a speech bubble.
  // Panels sit *above* the shell's own floor and below everything else: the
  // shell's diamond and its walls are what the unfold fades away, and the two
  // never overlap on screen because the walls rise from behind the deepest
  // plate.
  root.addChild(
    previousShell,
    shell,
    plates,
    light,
    // Above the floor it is painted on and below everything standing on it, so
    // a mark behind a desk is occluded by that desk. That is the correct depth
    // for a decal and it is why this is not simply drawn last: a footprint that
    // floated over the furniture would read as a UI overlay projected onto the
    // room rather than as paint on the floor of it (§7.1's pane-of-glass rule,
    // applied to the one layer that is *not* on the glass).
    coverage,
    previousFurniture,
    furniture,
    previousDesks,
    deskLayer,
    managerDesk,
    devLayer,
    founderLayer,
    ambient.layer,
  )

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
  let founderProfile = DEFAULT_FOUNDER
  let founder = buildFounderAvatar(founderProfile)
  let founderHopStartedAt = Number.NEGATIVE_INFINITY
  founderLayer.addChild(founder)
  /**
   * §7.8.7's run seed. Held here rather than passed per rebuild because the
   * identities must not change while a run is being played — the store owns the
   * value and hands it over once.
   */
  let seed = 1
  /**
   * §26.2.2 — **which thousand seats this room is a picture of.**
   *
   * Zero for the whole of a normal run, and that is not a special case being
   * tolerated: below a thousand developers there is only one window and it
   * starts at seat zero, so Run 1 and every measurement taken of it are
   * untouched by this existing.
   *
   * Above the room it stops being zero. §26.2.2's rule is that a unit is the
   * simulated body and the people inside it *do not exist until somebody
   * looks*; this is the record of where somebody looked. Descending into block
   * `k` of a nation sets the window to that block's first seat, so the room
   * draws **those** hundred people — their faces, their rolls, their numerals —
   * rather than redrawing the studio's first thousand for the fiftieth time.
   *
   * Until 2026-08-18 this did not exist and the room always drew seats 0–999,
   * whatever the studio was. At a hundred million developers the picture was
   * the same first floor as at a thousand, which is why §26.2.5's lines 2 and
   * 3 had nowhere to land: "the same person" is not a question you can ask of
   * a room that only ever shows one set of people.
   */
  let windowFrom = 0
  /** §13.11.1 — what the decal layer currently shows, as a comparable key. */
  let coverageDrawnFor = coverageKey(new Map())
  /** §7.8.8 — the selected seat, and the spin's clock. */
  let selected = -1
  let turningOut = -1
  /**
   * §10.7a.1 — the seat speaking a line of dialogue, turned to camera for the
   * duration of the line and back at its end. Separate from {@link selected}
   * because a dialogue speaker and a selected developer are different intents:
   * selection is the player's, the speaker is the script's, and the two can be
   * different people on the same frame.
   */
  let speaker = -1
  let speakerOut = -1
  let turnAt = 0
  /** Per-developer jolt decay, 1 -> 0. The §8.2 poke reaction. */
  const jolts: number[] = []
  const desks: Array<{ x: number; y: number }> = []
  let roomTransition = 1

  function clearPreviousGeometry() {
    for (const layer of [previousShell, previousFurniture, previousDesks]) {
      for (const child of layer.removeChildren()) child.destroy({ children: true })
    }
  }

  function copyGraphic(source: Graphics, destination: Container) {
    if (source.context.instructions.length === 0) return
    const copy = new Graphics({ context: source.context.clone() })
    copy.position.copyFrom(source.position)
    copy.pivot.copyFrom(source.pivot)
    copy.scale.copyFrom(source.scale)
    copy.rotation = source.rotation
    destination.addChild(copy)
  }

  /** Preserve the old shell and props while the next geometry comes in. */
  function beginRoomTransition() {
    // A batch reveals seats in quick succession. Keep the original snapshot
    // and update only the destination instead of allocating a new ghost for
    // every body in the cascade.
    if (roomTransition < 1) return
    clearPreviousGeometry()
    copyGraphic(shell, previousShell)
    copyGraphic(light, previousShell)
    copyGraphic(furniture, previousFurniture)
    copyGraphic(managerDesk, previousFurniture)
    for (const squad of squadDesks) copyGraphic(squad, previousDesks)
    previousShell.alpha = 1
    previousFurniture.alpha = 1
    previousDesks.alpha = 1
    roomTransition = 0
  }
  /**
   * Where §7.8.6's water trips go — the beer fridge first, then the cooler
   * and the coffee machine, as placed on this rebuild's perimeter ring.
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
  const resizeFrom = { ...foldedFit }
  const resizeTo = { ...foldedFit }
  let resizeFit = 1
  let fitReady = false

  function writeFit(fit: { w: number; h: number; px: number; py: number }) {
    extent.w = fit.w
    extent.h = fit.h
    root.pivot.set(fit.px, fit.py)
  }

  function fitAt(t: number) {
    const k = t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) ** 3
    return {
      w: foldedFit.w + (openFit.w - foldedFit.w) * k,
      h: foldedFit.h + (openFit.h - foldedFit.h) * k,
      px: foldedFit.px + (openFit.px - foldedFit.px) * k,
      py: foldedFit.py + (openFit.py - foldedFit.py) * k,
    }
  }

  function beginFitTransition(target: { w: number; h: number; px: number; py: number }) {
    Object.assign(resizeFrom, { w: extent.w, h: extent.h, px: root.pivot.x, py: root.pivot.y })
    Object.assign(resizeTo, target)
    resizeFit = 0
  }

  /**
   * Push the fit for a given unfold progress onto the extent and the pivot.
   *
   * Eased on the same curve the panels use so the pull-back tracks the picture;
   * a linear camera against an eased floor reads as two events.
   */
  function applyFit(t: number) {
    writeFit(fitAt(t))
  }

  function rebuild(headcount: number) {
    if (lastDevs >= 0) beginRoomTransition()
    // §26.2.2 — seats of *this window* that have somebody in them. The studio's
    // headcount still decides the furniture (`propsAt` below): a block drawn out
    // of a nation is a block in a company that size, not a garage.
    const n = Math.max(0, Math.min(ROOM_DEV_CAP, Math.floor(headcount) - windowFrom))
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
    managerDesk.clear()
    desks.length = 0
    walkTargets.length = 0

    // --- the shell ---------------------------------------------------------
    //
    // A margin of empty floor around the desks, so the room is a room rather
    // than a plinth. It shrinks as the place fills up: §7.8.1's walls push
    // outward, but never as fast as the headcount grows.
    // Tight around a single desk and opening up as the studio grows. §7.8.1's
    // first frame is a *garage*, and a garage with three tiles of empty
    // floor around the desk is a hall — the room has to hug the person in it
    // before it can feel like it is filling up.
    //
    // **The open plan is gated at ten developers.** Below that the margin sits
    // at {@link ROOM_TIGHT_MARGIN} no matter what — a two-person studio does
    // not get a hundred-developer room — and the room only reaches its full
    // openness across the 11–30 band §7.8.1 calls "walls push outward". The
    // old form ramped on `n / 14`, which handed a fourteen-developer huddle
    // the same open floor as the open plan, and its unbounded tail was the
    // negative-margin defect R6 records: once crowding flips the target below
    // {@link ROOM_TIGHT_MARGIN} the clamped form can no longer run away
    // downward and put a floor plate *smaller* than the block standing on it.
    const margin = roomMargin(n)
    // Sized from the seats' real screen bounding box, and then from the rule
    // that actually contains it — see `blockBox` and `plateHalfWidth`. The
    // previous `max(width, height)` was correct only for a nearly flat block
    // and let the corners of a deep one hang over the edge of the plate.
    // **The shell encloses whatever the studio actually occupies.**
    //
    // It used to be sized from the block inside a single squad and then faded
    // to nothing by the unfold, on the reading that "its walls and its dressing
    // belong to a room that has just been outgrown". That left every headcount
    // above a hundred standing on bare plates in the dark — no walls, no floor,
    // no room. A studio that grows does not stop being in a building; it takes
    // more of one. So past the unfold the shell is sized from the *floor*
    // rather than from the squad, and it stays.
    const box = unfolded
      ? floorBox(Math.ceil(n / SQUAD_SIZE))
      : blockBox(
          FOUNDER_CORNER_COL - 0.7,
          FOUNDER_CORNER_ROW - 0.7,
          cols - 1,
          rows - 1,
        )
    const bw = (box.maxX - box.minX) / 2
    const bh = (box.maxY - box.minY) / 2
    // **The open floor's border is a surround, not a crowding factor.**
    // `roomMargin` returns 0.4 once the studio passes forty — it is §7.8.1's
    // "walls close in as it fills up", and in the folded branch it goes through
    // `plateHalfWidth`, which treats it as breathing room around a block. Here
    // it was multiplied straight into the radius that has to *contain* the
    // block, so the slab was drawn at forty per cent of the desks standing on
    // it: the floor ended somewhere in the middle of the third row and the
    // manager's corner hung off the top edge entirely. That is the floor that
    // looked like it was floating over the old room, and it got worse the
    // fuller the room got, which is the opposite of what the margin means.
    //
    // An open-plan floor is the block plus a walkway. Never less than the block.
    const floorW = unfolded
      ? Math.max(bw, bh * 2) * OPEN_FLOOR_SURROUND
      : plateHalfWidth(bw, bh, margin)
    const floorH = floorW / 2
    const halfW = floorW / TILE_W
    const naturalCentre = {
      x: (box.minX + box.maxX) / 2,
      y: (box.minY + box.maxY) / 2,
    }
    const centre = unfolded ? naturalCentre : foldedRoomCentre(floorH)
    const cx = centre.x
    const cy = centre.y

    // The wall planes' screen slope, from the room's own geometry rather than
    // a literal 0.5, so wall-mounted things stay in plane if the projection
    // ratio is ever retuned.
    const WALL_SLOPE = floorH / floorW

    // Floor — a concrete slab, not wood. This room is a garage, and the slab
    // is the half of that the eye checks first: a dark grey pour with a paler
    // edge, an oil stain in front of the door, and one crack. Office wood
    // belongs to the open-plan plates that arrive with §7.8.1c; the founder's
    // room never stops being the garage it started as.
    isoQuad(shell, cx, cy, floorW * 2, floorH * 2, c(RAMPS.NEUTRAL[1]))
    isoQuad(shell, cx, cy, floorW * 2 - 10, floorH * 2 - 5, c(RAMPS.NEUTRAL[2]))
    // Worn scuffs, so the slab reads as poured concrete rather than as a
    // void. A few faint patches, lighter where traffic has polished it.
    shell
      .ellipse(cx - floorW * 0.38, cy + floorH * 0.42, floorW * 0.16, floorH * 0.08)
      .fill({ color: c(RAMPS.NEUTRAL[3]), alpha: 0.3 })
    shell
      .ellipse(cx + floorW * 0.2, cy - floorH * 0.15, floorW * 0.2, floorH * 0.1)
      .fill({ color: c(RAMPS.NEUTRAL[3]), alpha: 0.22 })
    // The oil stain, in front of the door — the one mark that names the room
    // a garage even before the door is read. It goes when the door does; an
    // open-plan floor with an oil stain on it is a floor nobody has swept.
    if (!unfolded) {
    shell
      .ellipse(cx + floorW * 0.5, cy + floorH * 0.55, floorW * 0.13, floorH * 0.065)
      .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.4 })
    shell
      .ellipse(cx + floorW * 0.56, cy + floorH * 0.5, floorW * 0.07, floorH * 0.035)
      .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.35 })
    // The crack, running off the stain toward the middle of the room.
    shell
      .moveTo(cx + floorW * 0.44, cy + floorH * 0.52)
      .lineTo(cx + floorW * 0.28, cy + floorH * 0.46)
      .lineTo(cx + floorW * 0.22, cy + floorH * 0.3)
      .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]), alpha: 0.55 })
    }

    // The two back walls, rising from the far edges. Red brick, not concrete —
    // a converted garage is brick, and brick is what says "garage" the same way
    // the slab below says it. The back-RIGHT wall takes the lighter brick, the
    // counter-intuitive half of ART_DIRECTION §7's single top-left source: both
    // back walls face the camera, and the one on the right faces down-*left*,
    // toward the light. Held by hand, because no script can check it.
    // Wall height scales with the room. A fixed height made the walls 46% of
    // the frame in a two-desk garage, which pushed the people — the actual
    // subject — onto the bottom edge. Walls are backdrop; they get whatever
    // room is left after the floor has what it needs.
    //
    // The fraction is deliberately small at the garage end of the curve: a
    // two-person studio in a room that is mostly wall reads as a room too big
    // for the people in it, which is the complaint the tighter margins above
    // exist to fix. 0.48 of the floor's half-height keeps the walls shorter
    // than the founder's clearance deserves at low headcounts while still
    // rising to the full cap once the open plan is out.
    const WALL_H = Math.max(34, Math.min(112, floorH * 0.48))
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
      .fill(c(RAMPS.WOOD[0]))
    shell
      .moveTo(rightX, cy)
      .lineTo(topX, topY)
      .lineTo(topX, topY - WALL_H)
      .lineTo(rightX, cy - WALL_H)
      .closePath()
      .fill(c(RAMPS.WOOD[1]))
    // The corner seam, so the two planes read as meeting rather than as one
    // folded shape.
    shell.moveTo(topX, topY).lineTo(topX, topY - WALL_H).stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]) })

    // --- the skirting -------------------------------------------------------
    //
    // A board along the bottom of both back walls, and the cheapest possible
    // way to make a room look like a room.
    //
    // The wall and the floor are two flat fills meeting on a line, and a
    // wall/floor junction with nothing in it is the tell that says "two
    // polygons" rather than "a building" — the eye has nothing to measure the
    // wall against, so the floor reads as continuing up it. A skirting board is
    // a horizontal band at a *known* height, so it gives the wall a scale, it
    // gives the junction an edge, and it gives every prop standing against the
    // wall something to stand against.
    //
    // Drawn as a band in the wall plane rather than a stroke: it runs down the
    // wall's own slope, catches the same top-left key the wall does (right wall
    // lighter, left wall darker), and takes a lit top rule where the light
    // clips its upper edge.
    const SKIRT_H = Math.max(5, Math.min(9, WALL_H * 0.09))
    const skirt = (fromX: number, fromY: number, base: number) => {
      shell
        .moveTo(fromX, fromY)
        .lineTo(topX, topY)
        .lineTo(topX, topY - SKIRT_H)
        .lineTo(fromX, fromY - SKIRT_H)
        .closePath()
        .fill(c(RAMPS.NEUTRAL[base]))
      // The rule along the top of the board. One pixel, lighter than the board,
      // and it is what actually reads at a distance.
      shell
        .moveTo(fromX, fromY - SKIRT_H)
        .lineTo(topX, topY - SKIRT_H)
        .stroke({ width: 1, color: c(RAMPS.NEUTRAL[base + 2]) })
      // And the shadow it casts into the floor at its foot, which is what stops
      // the board reading as painted on.
      shell
        .moveTo(fromX, fromY)
        .lineTo(topX, topY)
        .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]) })
    }
    skirt(leftX, cy, 3)
    skirt(rightX, cy, 4)

    // --- the cornice --------------------------------------------------------
    //
    // The skirting's twin at the top: a moulding where the wall meets the
    // ceiling. Same construction and lighting (right wall lighter, left wall
    // darker), running down from the top edge instead of up from the base. It
    // frames the brick at both ends so the wall reads as built rather than as
    // a flat red field.
    const CORNICE_H = Math.max(5, Math.min(9, WALL_H * 0.09))
    const cornice = (fromX: number, fromY: number, base: number) => {
      shell
        .moveTo(fromX, fromY)
        .lineTo(topX, topY - WALL_H)
        .lineTo(topX, topY - WALL_H + CORNICE_H)
        .lineTo(fromX, fromY + CORNICE_H)
        .closePath()
        .fill(c(RAMPS.NEUTRAL[base]))
      // The lit rule along the very top, and the shadow the moulding casts onto
      // the brick below it.
      shell
        .moveTo(fromX, fromY)
        .lineTo(topX, topY - WALL_H)
        .stroke({ width: 1, color: c(RAMPS.NEUTRAL[base + 2]) })
      shell
        .moveTo(fromX, fromY + CORNICE_H)
        .lineTo(topX, topY - WALL_H + CORNICE_H)
        .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]) })
    }
    cornice(leftX, cy - WALL_H, 3)
    cornice(rightX, cy - WALL_H, 4)

    // **The garage bones only belong to a garage.** §7.8.1c opens the floor
    // out into an open-plan office, and everything between here and the light
    // is what makes the room read as a converted garage: red brick courses, an
    // up-and-over door, two UPVC windows high on the wall. Drawn past the
    // unfold they were an office floor with a garage door in the middle of it,
    // and the desks of a hundred people standing next to a whiteboard hung on
    // a wall that had moved out from under it.
    //
    // The comment above the windows used to say they "never leave, whatever
    // the studio grows into". That was true while the studio never grew out
    // of the garage. It does now — that is what §7.8.1c *is* — and what stays
    // is the floor, the walls, the skirting and the cornice, which are a room
    // rather than a garage and read as an office without changing a line.
    if (!unfolded) {
      // --- the garage bones ----------------------------------------------------
      //
      // Brick courses on the left wall, and the door on the right. The courses
      // are what make the red fill read as brick rather than as painted plaster:
      // a fixed number of courses that tile the wall exactly from the skirting to
      // the cornice, so the pattern stretches with the wall and never leaves a
      // ragged gap at the top. A horizontal mortar bed between courses plus
      // staggered vertical joints — the stagger is the whole brick tell, a grid
      // of vertical joints reads as block. Kept to the left wall only — the
      // right wall's door is its statement, and a wall that says both says
      // neither.
      const BRICK_COURSES = 7
      const brickBot = SKIRT_H
      const brickTop = WALL_H - CORNICE_H
      const course = (brickTop - brickBot) / BRICK_COURSES
      const brickW = TILE_W * 0.9
      for (let i = 0; i < BRICK_COURSES; i++) {
        const bed = brickBot + i * course
        const bedTop = bed + course
        // The mortar bed above this course. Skipped above the top course — the
        // cornice's shadow line already marks that edge.
        if (i < BRICK_COURSES - 1) {
          shell
            .moveTo(leftX, cy - bedTop)
            .lineTo(topX, topY - bedTop)
            .stroke({ width: 1, color: c(RAMPS.NEUTRAL[5]), alpha: 0.4 })
        }
        // Vertical joints, offset half a brick on every second course. Each joint
        // runs the full height of its own course, bed to bed, so nothing
        // overshoots or falls short of the wall.
        const offset = (i % 2) * brickW * 0.5
        for (let x = leftX + offset; x < topX; x += brickW) {
          const bx = cy - (x - leftX) * WALL_SLOPE
          shell
            .moveTo(x, bx - bedTop)
            .lineTo(x, bx - bed)
            .stroke({ width: 1, color: c(RAMPS.NEUTRAL[5]), alpha: 0.25 })
        }
      }
      // The garage door, centred on the back-right wall — the right wall's one
      // statement, and the windows live on the left wall where the brick is.
      // Drawn after the skirting so it stands on the slab rather than behind it.
      drawGarageDoor(
        shell,
        topX + floorW * 0.3,
        topY + floorH * 0.3,
        topX + floorW * 0.7,
        topY + floorH * 0.7,
        WALL_H * 0.85,
      )

      // --- windows ------------------------------------------------------------
      //
      // Two UPVC windows high on the brick wall, one either side of the mid-wall,
      // so the garage is a place with an outside rather than a backroom. They live
      // in the shell beside the door — like the door they are bones of the garage
      // and never leave, whatever the studio grows into.
      const WIN_W = 52
      const WIN_H = Math.max(16, WALL_H * 0.5)
      drawWindow(shell, topX - floorW * 0.25, topY + floorH * 0.25 - WALL_H * 0.75, WIN_W, WIN_H, -WALL_SLOPE)
      drawWindow(shell, topX - floorW * 0.65, topY + floorH * 0.65 - WALL_H * 0.75, WIN_W, WIN_H, -WALL_SLOPE)

    }

    // --- light -------------------------------------------------------------
    //
    // §7.8.1: "lit only by the glow of a chunky CRT monitor". The pool is drawn
    // as three stacked ellipses rather than a gradient, because a gradient
    // would introduce colours the §5 quantiser has never seen.
    for (const [i, alpha] of [0.1, 0.055, 0.03].entries()) {
      const r = (0.85 + i * 0.55) * TILE_W * Math.max(1, Math.min(3.2, halfW * 0.42))
      light.ellipse(cx, cy - TILE_H * 0.2, r, r * 0.5).fill({ color: c(RAMPS.GLOW[1]), alpha })
    }

    // The founder's mat. Small, fixed to the manager desk and always inside
    // the room shell; it never becomes a detached second floor as the room
    // grows. Brown rather than the teal it once was: a worn doormat, the
    // one warm patch of floor in a concrete garage.
    // The doormat is garage dressing too — "the one warm patch of floor in a
    // concrete garage". On an open-plan floor it is a small detached island of
    // carpet with the manager standing on it, which is exactly what it looked
    // like.
    if (props.rug && !unfolded) {
      const rugW = Math.min(floorW * 0.38, TILE_W * 1.45)
      const rugH = rugW / 2
      const manager = founderDeskPosition()
      isoQuad(shell, manager.x, manager.y + TILE_H * 0.18, rugW, rugH, c(RAMPS.NEUTRAL[1]))
      isoQuad(shell, manager.x, manager.y + TILE_H * 0.18, rugW * 0.84, rugH * 0.84, c(RAMPS.WOOD[1]))
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
      // Tucked into the corner beside the centred garage door, not over it.
      drawWhiteboard(shell, topX + floorW * 0.16, topY + floorH * 0.16 - WALL_H * 0.62, 17, WALL_SLOPE)
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

    /**
     * One prop, and how wide its footprint is.
     *
     * The width is carried rather than assumed, because "against the wall"
     * means *its back face* is against the wall — a filing cabinet and a bin
     * standing on the same centre line are not standing against the same thing.
     */
    interface WallProp {
      /** Footprint width in screen pixels — what `isoBox` is given. */
      w: number
      /**
       * `slope` is the wall this prop stands against, in screen rise per run
       * — negative for the back-left wall, positive for the back-right. Only
       * the workbench uses it (its pegboard is mounted *in* the wall plane);
       * the rest stand on the floor and ignore it.
       */
      draw: (x: number, y: number, slope: number) => void
    }
    const ring: WallProp[] = []
    // The garage furniture comes first, so it takes the outer slots nearest
    // the corners — the junk was there before the company was.
    if (props.workbench)
      ring.push({ w: 26, draw: (x, y, slope) => drawWorkbench(furniture, x, y, slope) })
    if (props.fridge)
      ring.push({
        w: 18,
        draw: (x, y) => {
          // A walk target, like the cooler: the garage runs on fridge trips
          // long before a coffee machine arrives.
          walkTargets.push({ x, y })
          drawFridge(furniture, x, y)
        },
      })
    if (props.shelf) ring.push({ w: 24, draw: (x, y) => drawShelf(furniture, x, y) })
    // The two props people actually walk to. §7.8.1 puts them against the wall
    // for dressing; §7.8.6 gives them a second job as destinations, which is
    // most of why the room has them.
    if (props.coffee)
      ring.push({
        w: 18,
        draw: (x, y) => {
          walkTargets.push({ x, y })
          drawCoffee(furniture, x, y)
        },
      })
    if (props.waterCooler)
      ring.push({
        w: 15,
        draw: (x, y) => {
          walkTargets.push({ x, y })
          drawWaterCooler(furniture, x, y)
        },
      })
    if (props.filingCabinet) ring.push({ w: 18, draw: (x, y) => drawFilingCabinet(furniture, x, y) })
    if (props.printer) ring.push({ w: 22, draw: (x, y) => drawPrinter(furniture, x, y) })
    if (props.sofa) ring.push({ w: 46, draw: (x, y) => drawSofa(furniture, x, y) })
    if (props.bin) ring.push({ w: 13, draw: (x, y) => drawBin(furniture, x, y) })
    for (let i = 0; i < props.plants; i++)
      ring.push({ w: 14, draw: (x, y) => drawPlant(furniture, x, y, i) })
    for (let i = 0; i < props.boxes; i++)
      ring.push({ w: 20, draw: (x, y) => drawBoxes(furniture, x, y, i) })

    // **Both back walls, and only the back walls.**
    //
    // The room is open toward the camera, so its two front edges are not walls
    // and never were — anything placed against one of them stands in the dark
    // past the corner with nothing behind it. Alternating the two real walls
    // dresses them evenly and keeps the near half of the floor clear, which is
    // also the half the camera is framing the desks in.
    const walls = ['left', 'right'] as const
    const counts = [0, 0]
    for (let i = 0; i < ring.length; i++) counts[i % 2]++
    const placed = [0, 0]
    // The server rack takes the first slot on the right-hand wall, so the run
    // of props starts after it rather than through it.
    if (props.serverRack) placed[1] = 1
    for (let i = 0; i < ring.length; i++) {
      const side = i % 2
      const wall = walls[side]
      const slots = counts[side] + (side === 1 && props.serverRack ? 1 : 0)
      // Inset from both corners: the back corner is where the two walls meet
      // and the far ones are where the wall runs out, and a prop half off the
      // end of a wall is the same defect this whole change is fixing.
      const u = 0.1 + ((placed[side] + 0.5) / slots) * 0.82
      placed[side]++
      const at = wallSpot(wall, u, cx, cy, halfW, ring[i].w / TILE_W)
      ring[i].draw(at.x, at.y, wall === 'left' ? -WALL_SLOPE : WALL_SLOPE)
    }

    if (props.serverRack) {
      // Against the back-right wall by the corner, where a rack goes: it is the
      // one thing in the room that wants a wall behind it, it is never in
      // anybody's way there, and it does not move as the dressing around it
      // comes and goes.
      const at = wallSpot('right', 0.08, cx, cy, halfW, 24 / TILE_W)
      const sx = at.x
      const sy = at.y
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
        //
        // Set back with the bank, because a divider divides *desks*: left on
        // the seat line it would stand in the aisle behind the people it is
        // supposed to be between.
        const half = gridToScreen(-DESK_SETBACK, PITCH_COL / 2)
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
        // like everything else on it — and set back with the bank it belongs
        // to, since the cable tray is bolted under the desk.
        const a = gridToScreen(-DESK_SETBACK + DESK_DEPTH * 0.55, -PITCH_COL * 0.42)
        const b = gridToScreen(-DESK_SETBACK + DESK_DEPTH * 0.55, PITCH_COL * 0.42)
        g.moveTo(x + a.x, y + a.y)
          .lineTo(x + b.x, y + b.y)
          .stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]), alpha: 0.7 })
      }

      drawWorkstation(g, x, y, i)
    }

    // §7.8.10 — one non-row workstation, held outside the reading order and
    // turned across it. It is redrawn only on hire, like every other desk.
    const founderAt = founderDeskPosition()
    drawFounderWorkstation(managerDesk, founderAt.x, founderAt.y)
    founder.position.set(founderAt.x, founderAt.y + 6)

    // Reuse developer containers across rebuilds — a hire should not rebuild
    // ninety-nine sprites that did not change.
    while (devs.length < n) {
      // §7.8.7 — index 1 is James and is never generated. Containers are reused
      // across rebuilds, so a developer's look is fixed at the moment their
      // seat first exists and never churns underneath them.
      const d = buildDeveloper(developerAt(seed, windowFrom + devs.length).look)
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
    // Rebuilt whenever the studio has grown into more squads, so the floor is
    // exactly as big as the people on it.
    const squadsNeeded = unfolded ? Math.min(FLOOR_SQUADS, Math.ceil(n / SQUAD_SIZE)) : 0
    if (squadsNeeded > panels.length) {
      for (const p of panels) p.root.destroy({ children: true })
      panels.length = 0
      plates.removeChildren()
      buildPanels(squadsNeeded)
    }
    if (unfolded) applyUnfold(unfoldT)

    // The camera fit reads this every frame (§23.4.1), so the room growing is
    // also the camera pulling back — without anyone driving Z.
    // The camera fit reads these, so they must describe the *drawn* bounds:
    // floor plus the walls standing behind it, and a pivot at the true centre
    // of that box rather than at the floor's centre. Pivoting on the floor
    // pushes the whole room down the frame by half a wall.
    foldedFit.w = floorW * 2 + ROOM_CONTENT_PAD_X
    foldedFit.h = floorH * 2 + WALL_H + ROOM_CONTENT_PAD_Y
    // Biased toward the north corner — the founder and the walls that rise
    // behind it — rather than the true centre of the bounding box. Centring
    // geometrically drops the people low in frame under a slab of empty floor,
    // and biasing the other way (toward the desks) buried the cornice and the
    // windows under the top edge of the frame. Half a wall is the balance.
    foldedFit.px = cx
    foldedFit.py = cy - WALL_H * 0.5
    if (unfolded) {
      const f = floorBox(squadsUsed)
      openFit.w = f.maxX - f.minX + ROOM_CONTENT_PAD_X
      openFit.h = f.maxY - f.minY + ROOM_CONTENT_PAD_Y
      openFit.px = (f.minX + f.maxX) / 2
      openFit.py = (f.minY + f.maxY) / 2
    }
    const nextFit = fitAt(Math.max(0, unfoldT))
    if (!fitReady) {
      writeFit(nextFit)
      fitReady = true
    } else if (unfoldT >= 0 && unfoldT < 1) {
      // The panel unfold owns the camera fit while it is running.
      writeFit(nextFit)
      resizeFit = 1
    } else {
      beginFitTransition(nextFit)
    }

    const incomingAlpha = roomTransition >= 1 ? 1 : 1 - (1 - roomTransition) ** 3
    shell.alpha = incomingAlpha
    light.alpha = incomingAlpha
    furniture.alpha = incomingAlpha
    managerDesk.alpha = incomingAlpha
    for (const squad of squadDesks) squad.alpha = incomingAlpha
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
    // The same square the squads actually fill — see `seatFor`. Reading it off
    // `FLOOR_COLS` gave a box ten squads wide and one deep for the first
    // thousand people, which is why the shell was a letterbox around a line.
    const side = gridSide(used)
    const wide = side
    const deep = side
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
    // **The founder's corner is inside the room.** It sits at a negative
    // coordinate, outside the squad grid entirely, and the unfolded box was
    // measured from the squads alone — so the manager's desk stood on a
    // detached island of floor above the slab with nothing under it, which is
    // the thing that reads as "the floor is just floating on the old room".
    return blockBox(
      Math.min(-pad, FOUNDER_CORNER_COL - 4),
      Math.min(-padRows, FOUNDER_CORNER_ROW - 4),
      maxCol + pad,
      maxRow + padRows,
    )
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

  /**
   * Build one floor plate per **occupied** squad — §7.8.1c.
   *
   * It built all hundred, every time, whatever the headcount. At a hundred
   * developers that is one squad of people standing in the middle of ninety-nine
   * empty plates, and because `scene.extentOf('room')` measures what is drawn,
   * §23.4.1 then framed *those* — so the studio was a clump in the corner of an
   * empty brown plane, and every complaint about the room at that headcount
   * starts there.
   *
   * Rebuilt on demand rather than grown, because the plates are cheap and the
   * alternative is keeping a count in a second place.
   */
  function buildPanels(squadsUsed: number) {
    const used = Math.max(0, Math.min(FLOOR_SQUADS, Math.floor(squadsUsed)))
    for (let s = 0; s < used; s++) {
      const { col: squadCol, row: squadRow } = cellSquare(s)
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
    // **The room does not fold away.** It used to: the shell dissolved over the
    // first 60% of the unfold, on the reading that its walls belonged to a room
    // the studio had outgrown. What that produced was a floor with no building
    // round it at every headcount past a hundred. The shell is sized from the
    // whole occupied floor now (see `rebuild`), so it is the *same* room, with
    // the walls pushed out to where the desks reached.
  }

  /**
   * Throw away every generated person, so the next rebuild makes new ones.
   *
   * Shared by {@link RoomHandle.setSeed} and {@link RoomHandle.setSeatWindow},
   * which are the only two things that can change *who* is in the room as
   * opposed to how many.
   */
  function discardPeople() {
    for (const d of devs) d.destroy()
    devs.length = 0
    jolts.length = 0
    devLayer.removeChildren()
    // **`desks` is the length `animate` trusts.** It walks `desks` and indexes
    // `devs`, so leaving one full while the other is emptied is a crash waiting
    // for a frame to land between the discard and the rebuild — which is
    // exactly what happened the first time the seat window moved from the
    // ticker rather than from a gesture. `rebuild` refills it.
    desks.length = 0
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
  }

  rebuild(0)
  lastDevs = 0
  // §10.7a.3 — the last live elapsed instant, so a frozen floor holds its
  // motion rather than restarting it. See `animate`'s `frozen` parameter.
  let frozenElapsed = 0

  return {
    container: root,
    setHeadcount(devsCount: number) {
      const clamped = Math.max(0, Math.floor(devsCount))
      if (clamped === lastDevs) return
      lastDevs = clamped
      rebuild(clamped)
    },
    animate(elapsed: number, state: string, dt = 1 / 60, entropy = 0, frozen = false) {
      // §10.7a.3 — while a scene is up the clock is stopped, and the floor
      // shows it. The ambient life and the typing hop freeze on the frame the
      // scene opened, **mid-motion**, like a photograph of a paused simulation
      // — "frozen in time" is the message, and a snapped-to-rest pose would
      // read as "stopped working" instead. The elapsed clock is latched rather
      // than merely skipped: the hop is driven off `elapsed`, so freezing it
      // means holding the last live instant, not the last frame's.
      //
      // The room's own transitions (the rebuild fade, the unfold, the resize
      // fit) still run — they are geometry events a scene can itself trigger
      // (James's hire rebuilds the room mid-dialogue), not the clock.
      // Named `liveElapsed` rather than `shown` because the hop loop already
      // owns `shown` for the face-visibility squash — the same name here would
      // be shadowed and the hop would read its phase from a boolean.
      const liveElapsed = frozen ? frozenElapsed : elapsed
      if (!frozen) frozenElapsed = elapsed
      if (roomTransition < 1) {
        roomTransition = Math.min(1, roomTransition + dt / 0.42)
        const k = 1 - (1 - roomTransition) ** 3
        previousShell.alpha = 1 - k
        previousFurniture.alpha = 1 - k
        previousDesks.alpha = 1 - k
        shell.alpha = k
        light.alpha = k
        furniture.alpha = k
        managerDesk.alpha = k
        for (const squad of squadDesks) squad.alpha = k
        if (roomTransition >= 1) clearPreviousGeometry()
      }
      // §7.8.1c — the unfold, on `dt` rather than on `elapsed`, because it is
      // an event with a start and must not jump forward while the tab is
      // hidden (trap 3). Once it lands it costs one comparison a frame.
      if (unfoldT >= 0 && unfoldT < 1) {
        unfoldT = Math.min(1, unfoldT + (dt * 1000) / UNFOLD_MS)
        applyUnfold(unfoldT)
        applyFit(unfoldT)
      } else if (resizeFit < 1) {
        resizeFit = Math.min(1, resizeFit + dt / 0.55)
        const k = 1 - (1 - resizeFit) ** 3
        writeFit({
          w: resizeFrom.w + (resizeTo.w - resizeFrom.w) * k,
          h: resizeFrom.h + (resizeTo.h - resizeFrom.h) * k,
          px: resizeFrom.px + (resizeTo.px - resizeFrom.px) * k,
          py: resizeFrom.py + (resizeTo.py - resizeFrom.py) * k,
        })
      }
      // §7.8.6 — ambient life. Fed the desks and the walkable destinations; it
      // decides who is doing what and hands back an offset per seat.
      //
      // `walkTargets` is empty once §7.8.1's crowding has taken the walkway,
      // which stops the water trips with it. That is the correct behaviour and
      // a better joke than the walk was: **a crowded floor stops being able to
      // reach the cooler.**
      //
      // Skipped while frozen — §10.7a.3. Walkers stop mid-stride where they
      // are, like everything else on the floor.
      if (!frozen)
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
      if (turnT >= 1) {
        if (turningOut >= 0) turningOut = -1
        if (speakerOut >= 0) speakerOut = -1
      }

      for (let i = 0; i < desks.length; i++) {
        const d = devs[i]
        if (!d.visible) continue

        const turning = i === selected || i === turningOut || i === speaker || i === speakerOut
        const facing = i === selected || i === speaker
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

        if (!frozen && jolts[i] > 0) jolts[i] = Math.max(0, jolts[i] - 0.06)
        const walk = ambient.offsetFor(i)
        // §7.8.9 — a developer in the player's hand dangles. Legs cycling, a
        // slight swing, and lifted clear of the floor, because the whole read
        // is "held by the scruff" and a held figure that stays upright looks
        // like it is flying. They do not hop while held: whatever they are
        // doing in mid-air, pushing off it is not it.
        const held = i === ambient.carrying
        const hopping = !still && !held
        const phase = liveElapsed * hz + offset
        const lift = hopping ? hopHeight(phase) * HOP_HEIGHT * reach : 0
        const sway = hopping ? hopSway(phase) * HOP_SWAY * reach : 0
        const squash = hopping ? hopSquash(phase) : 1

        d.scale.x = turning ? turnScale(t) : 1
        d.scale.y = squash
        d.rotation = held ? Math.sin(liveElapsed * 9) * 0.12 : 0
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

      const founderAt = founderDeskPosition()
      const founderHopAge = liveElapsed - founderHopStartedAt
      const founderHopping = founderHopAge >= 0 && founderHopAge < 0.55
      const founderPhase = founderHopping ? founderHopAge / 0.55 : 1
      const founderLift = founderHopping ? hopHeight(founderPhase) * HOP_HEIGHT * 1.35 : 0
      const founderSway = founderHopping ? hopSway(founderPhase) * HOP_SWAY : 0
      const founderSquash = founderHopping ? hopSquash(founderPhase) : 1
      founder.scale.set(1, founderSquash)
      founder.position.set(
        founderAt.x + founderSway,
        founderAt.y + 6 - founderLift + BODY_BASE * (1 - founderSquash),
      )
    },
    hands: ambient,
    setFounderProfile(next: FounderProfile) {
      if (
        next.name === founderProfile.name &&
        next.head === founderProfile.head &&
        next.hairColour === founderProfile.hairColour &&
        next.skin === founderProfile.skin &&
        next.accessory === founderProfile.accessory &&
        next.facialHair === founderProfile.facialHair &&
        next.body === founderProfile.body &&
        next.bodyColour === founderProfile.bodyColour
      ) return
      founderProfile = next
      const replacement = buildFounderAvatar(founderProfile)
      replacement.position.copyFrom(founder.position)
      founder.destroy({ children: true })
      founder = replacement
      founderLayer.addChild(founder)
    },
    setCoverage(marks: ReadonlyMap<number, SeatMark>) {
      const key = coverageKey(marks)
      if (key === coverageDrawnFor) return
      coverageDrawnFor = key
      coverage.clear()
      for (const [seat, mark] of marks) drawSeatCoverage(coverage, seat, mark)
    },
    setSelected(index: number) {
      if (index === selected) return
      // Both the outgoing and the incoming developer have to turn, so the two
      // are tracked separately and the animation runs on whichever is mid-spin.
      turningOut = selected
      selected = index
      turnAt = performance.now()
    },
    setSpeaker(index: number) {
      if (index === speaker) return
      speakerOut = speaker
      speaker = index
      turnAt = performance.now()
    },
    setSeed(next: number) {
      if (next === seed) return
      seed = next
      // §26.2.2 — a Paradigm Shift is a new studio and you are back at your own
      // desk in it. Without this the first frame of Run 3 would be whichever
      // block of the *previous* studio the player happened to be looking into.
      windowFrom = 0
      // Every look is baked into a Graphics at construction, so a new seed
      // means new containers rather than a repaint. Only ever happens on a
      // Paradigm Shift, which is already a scene change.
      discardPeople()
    },
    setSeatWindow(from: number) {
      const next = Math.max(0, Math.floor(from))
      if (next === windowFrom) return
      windowFrom = next
      // Same teardown as a new seed, and for the same reason: a look is baked
      // in at construction, so a different thousand people is a different
      // thousand containers. This is the cost §26.2.2 accepts in exchange for
      // never storing any of them — "generated at the moment of the click, and
      // discarded when the camera leaves".
      discardPeople()
    },
    jolt(i: number) {
      if (i >= 0 && i < jolts.length) jolts[i] = 1
      // §7.8.6 rule 5 — a poke beats ambience. A player who taps somebody and
      // gets no reaction because that person happened to be chatting has been
      // told the game is a cutscene.
      ambient.interrupt(i)
    },
    joltFounder() {
      founderHopStartedAt = performance.now() / 1000
    },
    founderDeskAt() {
      return founderDeskPosition()
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
    get seatWindow() {
      return windowFrom
    },
    extent,
  }
}
