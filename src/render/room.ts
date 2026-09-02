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

import { Container, Graphics, Text } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import type { GridPoint, Lanes } from './walkPath.ts'
import { HAIR_RAMP, SHIRT_RAMP, SKIN_BASE } from '../art/personPalette.ts'
import { createAmbient } from './ambient.ts'
import { NO_SPOTS, createErrands } from './errands.ts'
import { bubblesLegible, counterScale, createBubbles, typeAtDesignSize } from './bubble.ts'
import type { Away } from '../sim/slackOff.ts'
import { BILLY_TORSO, developerAt, heroIdentity, type Look } from '../sim/identity.ts'
import {
  DEFAULT_FOUNDER,
  founderLook,
  type FounderProfile,
} from '../game/founderProfile.ts'
import { AVATAR_HAIR, frontAvatarParts, type AvatarRect } from './avatarParts.ts'
import type { SeatMark } from './heroBadges.ts'
import { CAR_BODIES, car, districtFitTiles, drawDistrict, lamp } from './district.ts'
import {
  ATRIUM,
  OFFICE_AMENITIES,
  OFFICE_PODS,
  type OfficeAmenity,
  OFFICE_SEATS,
  OFFICE_SPAN,
  officeSeat,
  podsUsedFor,
} from './office.ts'
import { drawLandmarks, type LandmarkPlot } from './landmarks.ts'
import { GARAGE_CAP, sceneFor } from '../sim/capacity.ts'
import {
  GARAGE_PODS,
  GARAGE_PROPS,
  GARAGE_SPAN,
  POD_TABLE_DEPTH,
  type Plot,
  garageExtentFor,
  POD_SEATS,
  POD_STRIDE,
  garageLaneLines,
  garageSeat,
  garageShellRuns,
} from './garage.ts'
import {
  PLAN_AMENITIES,
  PLAN_BLOCKS,
  PLAN_BOUNDS,
  PLAN_PLATES,
  PLAN_PLAZA,
  occupiedRuns,
  planLattice,
  planSeat,
  plateOfSeat,
} from './floorplan.ts'
import { drawPlaza, statueRung } from './plaza.ts'
import { HEIGHT_UNIT, isoPatch, isoSolid, type Project } from './isoSolid.ts'
import {
  WALL_NEAR,
  WALL_THICK,
  drawWallRun,
  runsAlongGy,
  type WallPaint,
  type WallSegment,
} from './shell.ts'
import { STORY_HEROES, type HeroId } from '../sim/storyHeroes.ts'

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
 * §7.8.1e — how much of the district the camera is asked to keep.
 *
 * Deliberately not all of it. `districtFitTiles` explains the composition side;
 * this is the conversion, and the reason it is capped rather than proportional:
 * the road is the same road at every headcount, so the frame does not have to
 * grow to hold more of it. A thousand-person floor showing the kerb in its two
 * near corners is the reference's own composition, and it costs about six per
 * cent of the fill instead of a fifth.
 */
function districtPad(halfBack: number, halfAcross: number): { x: number; y: number } {
  const t = districtFitTiles(halfBack, halfAcross)
  return { x: t * TILE_W, y: t * TILE_H * 2 }
}

/**
 * How the district's height is split between above the room and below it.
 *
 * It used to be all below: the pad was added to the fit's height and the pivot
 * moved down by exactly half of it, so the top edge of the frame did not move
 * and every pixel of new ground appeared in front of the building. That was
 * right when the ground was an L on the two open sides and there was nothing
 * above the roof to see.
 *
 * §7.8.1e put a city up there. A fifth of the pad now goes above the cornice,
 * which is where the far row of neighbours rises past the two back walls —
 * enough for a band of lit windows in the top corners, and not so much that the
 * developers stop being the subject.
 */
const SKYLINE_SHARE = 0.2

/**
 * §7.8.1d — the statue is the founder at this many times life size.
 *
 * Two and a half rather than a round two: a statue the same height as the
 * people looking at it is a mannequin, and past about three it stops fitting
 * under the ceiling strips. `torsoShape` is in screen pixels — it describes a
 * sprite — so the conversion to tiles happens here, once, at the only call
 * site that needs a person measured in floor units.
 */
const STATUE_SCALE = 2.5

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
 * How the room lays its squads out — **five across, two back**.
 *
 * §7.7.1's floor is a thousand people and {@link ROOM_DEV_CAP} is the same
 * thousand, so a full room is exactly ten squads. Five by two is the only
 * arrangement of ten that is neither a line nor a square with holes in it, and
 * it gives the floor an office's shape: longer than it is deep, with a length
 * of desks to look down.
 *
 * The two arrangements that were here before both showed. `squad % FLOOR_COLS`
 * with ten columns put all ten in a **single row** — a conveyor belt across the
 * horizon. Square shells put them in a four-by-four with six plots empty, which
 * is `grid.ts`'s answer and is the right one *there*, where a parent can hold a
 * hundred children and the count is not known in advance. A floor's count is
 * known: it is ten, always, and a fixed five-wide lattice fills it exactly.
 *
 * Fixed width is also what keeps §7.8.1b's promise at the squad: because the
 * lattice never resizes, squad `i` is at `(i % 5, ⌊i / 5⌋)` for ever, and the
 * hundred people who arrive next never move the hundred already sitting down.
 */
export const ROOM_SQUAD_COLS = 5
export const ROOM_SQUAD_ROWS = ROOM_DEV_CAP / SQUAD_SIZE / ROOM_SQUAD_COLS

/**
 * §7.8.1a — **the corridor**, in the same units as the two desk pitches.
 *
 * Not decoration. It is what makes a hundred squads read as a hundred *squads*
 * rather than as ten thousand identical dots, and §7.8.6's walkers belong in
 * it. Wider across than back for the same reason the desk pitches are: a
 * corridor has to beat a desk's own footprint before it reads as a corridor,
 * and a desk is nearly a tile wide.
 */
/**
 * The perimeter aisle around the whole floor, in seat units.
 *
 * **A constant, and it is the fix to "the room is too big".** What was here was
 * `pad = SQUAD_COLS * 0.45` — half a squad on every side, computed from the
 * squads that happened to be occupied. At ten squads that is a ten per cent
 * surround and reads as a room; at *one* squad it is wider than the squad, so
 * the shell came out 2,046 px around an 893 px block. A constant expressed as a
 * fraction of the child is a constant that has stopped being one.
 *
 * The two numbers differ because the axes are not the same screen distance: one
 * column step moves 32 px across, one row step 67 px. Four and two come out
 * symmetric on screen, and four columns is also wide enough to hold §7.8.10's
 * corner desk, which sits outside the squad grid entirely.
 */
export const FLOOR_AISLE_COLS = 4
export const FLOOR_AISLE_ROWS = 2

export const CORRIDOR_COLS = 2.6
export const CORRIDOR_ROWS = 2.0
/** Squad origin to squad origin, in seat units. */
export const SQUAD_STRIDE_COLS = SQUAD_COLS + CORRIDOR_COLS
export const SQUAD_STRIDE_ROWS = SQUAD_ROWS + CORRIDOR_ROWS

/**
 * **The floor's own rectangle, in seat units — fixed at every headcount.**
 *
 * The shell used to be re-solved on every hire, so the room's extent moved, so
 * the camera's fit moved, so **hiring re-framed the picture**. A floor is five
 * squads across and two back from the moment the garage is outgrown; empty
 * squads are drawn bare. Growth goes *up*, into storeys, which is what makes
 * the building level mean anything.
 */
/**
 * §7.8.12 [amended 2026-08-31] — **how deep the floor is behind row 0**, and the
 * one constant the executive suite costs the rest of the room.
 *
 * The front and side margins are {@link FLOOR_AISLE_ROWS}/{@link
 * FLOOR_AISLE_COLS}'s two and four. The *back* margin is deeper than either,
 * because the two rows behind row 0 are not margin: they are the suite, and a
 * suite two banks deep with a walkway between them does not fit in two rows.
 *
 * It is asymmetric on purpose, and the asymmetry is the section's whole joke
 * stated as a number. §7.8.10 fixes the founder at the north vertex and forbids
 * them to move, so the room cannot make space for the people who arrived by
 * shuffling anybody along. **It makes space by pushing the back wall out.** You
 * did not move into the executive suite; the back wall moved away from you.
 *
 * 3.3 is the budget read off the layout rather than a tuned number: 0.7 rows of
 * clearance behind the back bank, one row of aisle between the banks (the same
 * aisle the floor gives its own rows), and 1.6 rows from the founder's row to
 * row 0 — which was already there and is what the glass now stands in.
 */
export const FLOOR_BACK_ROWS = 3.3

export const FLOOR_MIN_COL = -FLOOR_AISLE_COLS
export const FLOOR_MIN_ROW = -FLOOR_BACK_ROWS
/*
 * §7.8.1e — **read off the plan, not off a stride.**
 *
 * These were `(ROOM_SQUAD_COLS - 1) * SQUAD_STRIDE_COLS + …`, which is the right
 * arithmetic for a floor generated from a five-by-two lattice of identical
 * squads and has no meaning for a floor that is drawn. The plan knows how far
 * its own desks reach; the room adds its perimeter aisle to that. Deriving it
 * means moving a bank cannot leave the shell the wrong size, which is a class of
 * defect `test:room` would only catch after the fact.
 */
export const FLOOR_MAX_COL = PLAN_BOUNDS.maxCol + FLOOR_AISLE_COLS
export const FLOOR_MAX_ROW = PLAN_BOUNDS.maxRow + FLOOR_AISLE_ROWS
/*
 * `PLATE_PAD_COLS` / `PLATE_PAD_ROWS` used to live here — how much of the
 * corridor a squad's plate took on each side, so that ten plates would tile
 * with a visible seam between them. §7.8.1e moved that into `floorplan.ts`,
 * which is where the plate outlines are built now, and dropped the corridor
 * apron entirely: the hallway is the slab, and the slab was always there.
 */

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
   * §7.8.12 — everybody physically present in the team room.
   *
   * Safe every frame: the room folds these to a short key and only rebuilds
   * the six-desk layer when somebody arrives or their assignment state moves.
   */
  setTeam(heroes: readonly TeamRoomHero[]): void
  /** The room-local desk for a named hero, or null before they arrive. */
  teamDeskAt(id: HeroId): { x: number; y: number } | null
  /** The named hero under a room-local point, for world-space card opening. */
  teamHeroAt(x: number, y: number, reach?: number): HeroId | null
  /**
   * §13.11.2 — is this room-local point on the sign over the suite's door?
   *
   * The roster's front door. `Roster.tsx` has said since it was written that it
   * *"is not the intended front door ... once [the suite] exists the way you
   * reach Mo is by looking at Mo"*, and this is the other half of that: the
   * strip answers "who is idle", which is a question about the room rather than
   * about any one person, so it opens from the room's own name plate. Which is
   * also what frees the rail slot the `TEAM` button now uses.
   */
  teamSignAt(x: number, y: number, reach?: number): boolean
  /** The sign's room-local centre, or null while it is not drawn. */
  teamSignPoint(): { x: number; y: number } | null
  /**
   * §7.8.12 — **what the room actually drew**, room-local, for `test:room`.
   *
   * Three facts a screenshot cannot be asked for and arithmetic cannot be
   * trusted to reproduce: the slab's four corners, the suite's box, and the
   * feet of every wall the suite built. The gate that measures them exists
   * because the two defects this room has now shipped — panes at illegal screen
   * slopes, and a suite floating in the middle of a slab instead of sitting in
   * its corner — were both invisible to every check the project had. Neither
   * was a wrong number in a place somebody could have looked; both were the
   * *drawn result* of numbers that each looked fine on their own.
   *
   * Deliberately a plain data snapshot rather than anything drawable: this is
   * for measuring, and something that can be rendered would eventually be.
   */
  geometry(): RoomGeometry
  /** Which team-room hero is speaking; James continues to use seat 0. */
  setTeamSpeaker(id: HeroId | null): void
  /**
   * §7.8.13 — how much of each desk plate to print, from the camera's level.
   *
   * Pushed in by `stage.ts` rather than derived here, on the same rule as
   * {@link setAway}: the room draws, the stage knows where the camera is, and a
   * renderer that reads the lens is a second camera nobody can find.
   */
  setLabelDetail(detail: LabelDetail): void
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
  /**
   * §7.8.0c — is the room drawing the garage rather than the office floor?
   *
   * Exposed because §7.7.2's arrivals have to drop a body into the same chair
   * the room will draw it in, and the two plans put seat 7 in different
   * buildings. `stage.ts` reads this and hands it to `arrivals.spawn`, which is
   * the same one-resolver argument §7.8.12 makes about the suite: the thing
   * that falls and the thing that sits down cannot be allowed to disagree.
   */
  readonly inGarage: boolean
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
  /**
   * §7.8.9 — the away population, from the simulation.
   *
   * Pushed in rather than pulled, because `game/` may not import `render/` and
   * `render/room.ts` has no business importing the store either — only
   * `stage.ts` does. It is a plain array reference and the store replaces it on
   * every tick rather than mutating it, so holding it costs nothing and cannot
   * go half-stale.
   */
  setAway(roster: readonly Away[]): void
  /**
   * §21.7.0 — put a line over one seat's head for a moment.
   *
   * A **floor** bubble, not §7.5's HUD one. The HUD bubble is where the studio
   * talks to the player; this is one person answering something the player did
   * to *them*, and it has to come from the body it is about — a refusal that
   * appears in the corner of the screen makes the player look away from the
   * developer who just refused, which is the wrong direction for a joke whose
   * whole subject is that he has not moved.
   */
  sayOver(seat: number, text: string, ms?: number): void
  /**
   * §7.8.9 — the floor as a toy, in pixels only.
   *
   * **What this no longer decides is whether the grab is allowed.** That moved
   * to `sim/slackOff.ts` with the rest of the roster on 2026-08-26, because a
   * drag that changes the economy cannot have its rules living in the renderer
   * — the answer would disappear at the Floor tier along with the bodies. This
   * now records where the hand is so the body can follow it. Room-local
   * coordinates throughout.
   */
  readonly hands: {
    hold(i: number): void
    carryTo(x: number, y: number): void
    release(): void
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
  /**
   * The rectangle the room occupies, in its own coordinates.
   *
   * Distinct from {@link extent}, which is a size with no position — and the
   * position is the half the lens needs, because the room is not centred on its
   * own origin and never was: §7.8.10's corner desk sits at a negative
   * coordinate and the seat lattice runs away from it in both directions.
   */
  readonly shellRect: { cx: number; cy: number; w: number; h: number }
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
export function isoAt(col: number, row: number) {
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
  /**
   * Which **bank** of the floor — §7.8.1e's blocks, in hiring order.
   *
   * Still called `squad` because that is what the zoom ladder calls this level
   * (§7.7's FLOOR / SQUAD / DESK) and renaming it would have rippled through
   * `frames.ts`, the lens and four tiers of the map for no gain. What changed is
   * what one *is*: a hundred desks on a stride, versus a named bank of between
   * forty-eight and a hundred and ninety-three, laid out however its
   * arrangement lays it out.
   */
  squad: number
  /** Place along this seat's own run of desks, and which run of the bank. */
  col: number
  row: number
  /** The bank's own corner on the floor lattice, in seat units. */
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
  const s = planSeat(index)
  const block = PLAN_BLOCKS[s.block]
  return {
    squad: s.block,
    col: s.inRun,
    row: s.run - block.firstRun,
    squadCol: block.minCol,
    squadRow: block.minRow,
  }
}

/**
 * Seat `index` as absolute grid coordinates — §7.8.1e's plan, read out.
 *
 * One line now, and that is the point of the rewrite: where a seat goes is a
 * *table lookup* rather than three nested strides, so a bank can be any shape
 * and hiring still cannot move anybody. `floorplan.test.ts` pins both halves.
 */
export function seatGrid(index: number): { col: number; row: number } {
  const s = planSeat(index)
  return { col: s.col, row: s.row }
}

/**
 * Where seat `index` sits **on the floor lattice**, in room-local coordinates.
 *
 * Exported because it is the only honest way to ask "which direction does a row
 * run" without standing up a renderer, and that question has now been got wrong
 * twice.
 *
 * **It is not where the room draws that seat**, and since 2026-08-31 that is a
 * real difference rather than a pedantic one: §7.8.12's suite holds seat 0, so
 * the lattice plot this returns for it is the empty doorway threshold. Anything
 * placing a body, a desk or a camera on a seat wants {@link drawnSeatPosition}.
 */
export function seatPosition(index: number): { x: number; y: number } {
  const { col, row } = seatGrid(index)
  return isoAt(col, row)
}

/**
 * §7.8.6 — **the walkable lattice**, for `walkPath.ts`.
 *
 * The floor's grain is already a lattice; this is the same arithmetic
 * {@link isoAt} does, read as "where can somebody put their feet" instead of
 * "where does a desk go". Built here rather than in the router because which
 * lines exist is a fact about *this* headcount's room — how many rows are
 * occupied, how many squad corridors got drawn — and the router must never
 * recompute it from constants and end up walking down a corridor that is now
 * desks (§7.8.1's crowding).
 *
 * Three kinds of line, and the third is the one that was missing on the first
 * pass:
 *
 *  - **Row aisles.** One behind each occupied row, at `laneFor(row)`.
 *  - **Squad corridors.** The `CORRIDOR_COLS` gap between squad columns.
 *  - **The perimeter.** A lane outside row zero and outside the last row, and
 *    corridors outside the first and last columns. Without the back-wall lane
 *    a route to a prop standing against the wall picks the nearest *row* aisle
 *    and then walks the final leg straight back through row zero — the exact
 *    defect this module exists to fix, reintroduced at the destination.
 */
export function roomLanes(devs: number): Lanes {
  const n = Math.max(0, Math.min(ROOM_DEV_CAP, Math.floor(devs)))
  const plan = planLattice(n)
  return {
    // The plan speaks in seat units and `walkPath.ts` routes in grid tiles, so
    // this is the whole of the conversion: an aisle is a row position times the
    // row pitch, a hallway is a column position times the column pitch. The
    // scan that used to be here — walk every seat, find the deepest row and the
    // widest column, then reconstruct where the corridors must have been —
    // exists in `floorplan.ts` now, on the side of the seam that knows the
    // answer rather than the side that has to infer it.
    aisles: plan.aisles.map((row) => row * PITCH_ROW),
    corridors: plan.hallways.map((col) => col * PITCH_COL),
    // A workstation is about a tile deep and a tile wide; half of each is the
    // box a walker must stay out of.
    deskHalfDepth: 0.5,
    deskHalfWidth: PITCH_COL / 2,
  }
}

/**
 * §7.8.6 — the walkable lattice **of the garage**, in the same units as
 * {@link roomLanes}.
 *
 * A separate function rather than a branch inside `roomLanes` because the two
 * are asking different tables: `roomLanes` reads the office plan's aisles, and
 * the garage's pods are nowhere near them. Routing a garage walker on the
 * office lattice sends them across three tables on the way to the kettle, which
 * is not a tuning error but an answer to the wrong question.
 */
export function garageLanes(ordinary: number): Lanes {
  const lines = garageLaneLines(ordinary)
  return {
    aisles: lines.aisles,
    corridors: lines.hallways,
    // A pod's table is two desks deep, so the box a walker has to stay out of
    // is twice as deep here as it is on the floor. Half-width is unchanged: a
    // desk is a desk along its own axis.
    deskHalfDepth: DESK_DEPTH,
    deskHalfWidth: PITCH_COL / 2,
  }
}

/**
 * §7.8.0c — **the lamp on a pod's table, and the pool it throws.**
 *
 * The canonical concept puts one warm lamp in the middle of every table, and it
 * is doing something no amount of desk dressing can: it is the **only warm
 * light in a room lit by screens**, so it separates the pod from the floor and
 * gives four people a centre to be gathered around. Without it a pod is eight
 * cyan rectangles and a brown slab.
 *
 * The pool is drawn on the table surface rather than on the floor, and that is
 * the detail that makes it read as a lamp rather than as a glowing disc: light
 * falls on the nearest surface, and the nearest surface here is the desk.
 */
function drawPodLamp(g: Graphics, p: Project, gx: number, gy: number, deskTop: number) {
  const at = p(gx, gy)
  const y = at.y - deskTop
  // The pool first, so everything else sits in it. Two ellipses: a wide dim one
  // and a tight bright one, which is what a bare bulb over a table does.
  // **Three pools, not two, and much stronger than the first pass.** The
  // canonical garage is lit by these: a wide amber wash that reaches the floor
  // either side of the table, a tighter one on the surface, and a hot core
  // under the shade. At 0.16 and 0.22 the lamp was technically present and
  // visually absent, which in a room lit by cyan screens is the one thing it
  // could not afford to be.
  g.ellipse(at.x, y + 6, 58, 29).fill({ color: c(RAMPS.WARN[0]), alpha: 0.20 })
  g.ellipse(at.x, y + 2, 34, 17).fill({ color: c(RAMPS.WARN[1]), alpha: 0.34 })
  g.ellipse(at.x, y + 2, 17, 8).fill({ color: c(RAMPS.WARN[2]), alpha: 0.42 })
  // Base, stem, shade — three marks, and the shade is the one that names it.
  isoBox(g, at.x, y, 9, 3, RAMPS.NEUTRAL, 2, false)
  g.rect(at.x - 0.9, y - 21, 1.8, 19).fill(c(RAMPS.NEUTRAL[3]))
  g.moveTo(at.x - 7, y - 21)
    .lineTo(at.x + 7, y - 21)
    .lineTo(at.x + 4.5, y - 27)
    .lineTo(at.x - 4.5, y - 27)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[5]))
  // The bulb, seen under the shade. Two pixels of the warmest tone in the room.
  g.ellipse(at.x, y - 20, 3.2, 1.8).fill(c(RAMPS.WARN[3]))
}

/**
 * §7.8.0d — **the office's amenities, modelled.**
 *
 * Same rule as the garage's clutter one room down: give the object the two or
 * three marks that name it and nothing else. What differs is *why* each is
 * here, and each one is doing a job the concept assigns it:
 *
 * - **Lockers** are the strongest rhythm on the floor. A run of identical tall
 *   doors against a wall is the one place repetition is the point rather than
 *   the failure, because it is what the eye measures the room's length with.
 * - **The server room** is the one near-black volume, with the only cool light
 *   that is not a monitor. §7.8.1e's read of the reference calls this out: among
 *   pale rooms one dark room reads as the important one at any zoom.
 * - **A kitchenette is a counter and a pendant**, and the pendant matters more —
 *   it is a second warm pool, which is what stops the floor being one flat cyan.
 * - **Sofas face the statue.** Four of them, on the axes, so they read as a
 *   square arranged around something rather than as four benches.
 */
function drawOfficeAmenity(g: Graphics, p: Project, a: OfficeAmenity) {
  const w = a.gx1 - a.gx0
  const d = a.gy1 - a.gy0
  const box = (
    bx: number, by: number, bz: number, bw: number, bd: number, bh: number,
    ramp: readonly string[], base: number, alpha = 1,
  ) =>
    isoSolid(g, p, bx, by, bz, bw, bd, bh, {
      top: ramp[Math.min(ramp.length - 1, base + 2)],
      left: ramp[Math.min(ramp.length - 1, base + 1)],
      right: ramp[base],
    }, alpha)

  switch (a.kind) {
    case 'lockers': {
      // A plinth, then a run of doors with a hairline between each. The gaps
      // are the rhythm; the plinth is what stops them floating.
      box(a.gx0, a.gy0, 0, w, d, 0.12, RAMPS.NEUTRAL, 1)
      const DOOR = 0.62
      for (let y = a.gy0 + 0.05; y + DOOR < a.gy1; y += DOOR) {
        box(a.gx0 + 0.1, y, 0.12, w - 0.2, DOOR - 0.08, 1.9, RAMPS.CALM, 0)
      }
      break
    }
    case 'server': {
      // Racks, and the blue strip down each. Near-black, because being the one
      // dark object is the whole of what it does.
      box(a.gx0, a.gy0, 0, w, d, 0.1, RAMPS.NEUTRAL, 0)
      for (let y = a.gy0 + 0.15; y + 0.7 < a.gy1; y += 0.85) {
        box(a.gx0 + 0.12, y, 0.1, w - 0.24, 0.7, 2.0, RAMPS.NEUTRAL, 0)
        box(a.gx0 + 0.08, y + 0.2, 0.7, 0.05, 0.3, 0.9, RAMPS.GLOW, 1)
      }
      break
    }
    case 'kitchenette': {
      // Counter, splashback, two stools — and the pendant, which is the point.
      box(a.gx0, a.gy0, 0, w, d, 0.7, RAMPS.WOOD, 1)
      box(a.gx0, a.gy0, 0.7, w, d, 0.08, RAMPS.NEUTRAL, 4)
      const along = w > d
      const mid = along ? a.gx0 + w / 2 : a.gy0 + d / 2
      for (const off of [-0.9, 0.9]) {
        const sx = along ? mid + off : a.gx0 + w / 2
        const sy = along ? a.gy0 + d / 2 : mid + off
        box(sx - 0.16, sy - 0.16, 0, 0.32, 0.32, 0.45, RAMPS.NEUTRAL, 2)
      }
      // The pendant and its pool. Warm, and the only other one on the floor.
      const cx2 = a.gx0 + w / 2
      const cy2 = a.gy0 + d / 2
      const at = p(cx2, cy2)
      g.ellipse(at.x, at.y, 30, 15).fill({ color: c(RAMPS.WARN[1]), alpha: 0.15 })
      g.ellipse(at.x, at.y - 44, 5, 2.6).fill(c(RAMPS.WARN[3]))
      g.rect(at.x - 0.7, at.y - 72, 1.4, 28).fill(c(RAMPS.NEUTRAL[2]))
      break
    }
    case 'meeting': {
      // A glass box: a floor plate, a low spandrel, and glazing above it with
      // dark uprights. Inside, a table and a lit screen.
      isoPatch(g, p, a.gx0, a.gy0, a.gx1, a.gy1, RAMPS.WOOD[0])
      box(a.gx0 + w * 0.28, a.gy0 + d * 0.3, 0, w * 0.44, d * 0.4, 0.62, RAMPS.WOOD, 2)
      box(a.gx0, a.gy0, 0, w, 0.14, 2.3, RAMPS.GLOW, 0, 0.28)
      box(a.gx0, a.gy1 - 0.14, 0, w, 0.14, 2.3, RAMPS.GLOW, 0, 0.28)
      box(a.gx0, a.gy0, 0, 0.14, d, 2.3, RAMPS.GLOW, 0, 0.28)
      for (let y = a.gy0; y <= a.gy1 - 0.9; y += 1.4) {
        box(a.gx0 - 0.02, y, 0, 0.16, 0.16, 2.4, RAMPS.NEUTRAL, 0)
      }
      break
    }
    case 'entrance': {
      // The doors and the sign over them. Bright, because it is the one thing
      // on this wall the player is meant to find.
      isoPatch(g, p, a.gx0, a.gy0, a.gx1, a.gy1, RAMPS.NEUTRAL[2])
      box(a.gx0 + 0.2, a.gy1 - 0.3, 0, w - 0.4, 0.24, 2.4, RAMPS.GLOW, 0, 0.4)
      box(a.gx0, a.gy1 - 0.42, 2.4, w, 0.4, 0.34, RAMPS.NEUTRAL, 3)
      box(a.gx0 + w * 0.2, a.gy1 - 0.5, 2.5, w * 0.6, 0.1, 0.22, RAMPS.GLOW, 2)
      break
    }
    case 'sofa': {
      box(a.gx0, a.gy0, 0, w, d, 0.36, RAMPS.FOLIAGE, 0)
      // The back, on the side away from the statue.
      const backOnX = w < d
      if (backOnX) box(a.gx0, a.gy0, 0, 0.22, d, 0.66, RAMPS.FOLIAGE, 1)
      else box(a.gx0, a.gy0, 0, w, 0.22, 0.66, RAMPS.FOLIAGE, 1)
      break
    }
    case 'planter': {
      box(a.gx0, a.gy0, 0, w, d, 0.42, RAMPS.WOOD, 1)
      const at2 = p(a.gx0 + w / 2, a.gy0 + d / 2)
      g.ellipse(at2.x, at2.y - 22, 11, 8).fill(c(RAMPS.FOLIAGE[0]))
      g.ellipse(at2.x - 4, at2.y - 27, 7, 5).fill(c(RAMPS.FOLIAGE[1]))
      break
    }
  }
}

/**
 * §7.8.0c — **the clutter, modelled.**
 *
 * Every one of these was a single box first, and a garage furnished in identical
 * grey cuboids is a storage unit. The rule each of them follows is the cheapest
 * one available and the only one that works at this size: **give the object the
 * two or three marks that name it, and nothing else.** A workbench is a slab on
 * legs with a vice on the end. A fridge is a tall box with a door line and a
 * handle. A sofa is a low block with a back and two arms. At thirty pixels
 * across, a fourth mark is a smudge — and a third mark that is *wrong* costs
 * more than the first two buy.
 *
 * All of it goes through {@link isoSolid} in the plan's own frame, so a prop is
 * a solid on the floor rather than a sprite leaning against a wall.
 */
function drawGarageProp(g: Graphics, p: Project, plot: Plot) {
  const w = plot.gx1 - plot.gx0
  const d = plot.gy1 - plot.gy0
  const x = plot.gx0
  const y = plot.gy0
  const box = (
    bx: number,
    by: number,
    bz: number,
    bw: number,
    bd: number,
    bh: number,
    ramp: readonly string[],
    base: number,
  ) =>
    isoSolid(g, p, bx, by, bz, bw, bd, bh, {
      top: ramp[Math.min(ramp.length - 1, base + 2)],
      left: ramp[Math.min(ramp.length - 1, base + 1)],
      right: ramp[base],
    })

  switch (plot.name) {
    case 'THE SHELVES': {
      /*
       * **The gaps are the object.** [2026-09-02]
       *
       * The first version put a box on nearly every tier at nearly full depth,
       * and the result was a solid tan slab with two lines on it — a cupboard,
       * or a wall. A shelf unit is read from the *voids*: you know it is
       * shelving because you can see through it between the boards.
       *
       * So the boards are dark and thin, the uprights darker still, and the
       * contents are small, sparse and at three different depths. Four objects
       * on four tiers, none of them full width, and two tiers left empty.
       */
      const TIERS = 4
      for (let i = 0; i < TIERS; i++) {
        box(x, y, 0.42 + i * 0.55, w, d, 0.07, RAMPS.WOOD, 0)
      }
      box(x, y, 0, 0.14, d, 2.3, RAMPS.NEUTRAL, 0)
      box(x + w - 0.14, y, 0, 0.14, d, 2.3, RAMPS.NEUTRAL, 0)
      box(x + w / 2 - 0.07, y, 0, 0.14, d, 2.3, RAMPS.NEUTRAL, 0)
      // Three things, small, on three of the four tiers — and the top one left
      // bare, because a shelf with something on every level is a stock room.
      box(x + 0.35, y + 0.16, 0.49, 0.62, d * 0.5, 0.3, RAMPS.WOOD, 3)
      box(x + 1.9, y + 0.18, 1.04, 0.5, d * 0.45, 0.26, RAMPS.WOOD, 2)
      box(x + 2.55, y + 0.14, 0.49, 0.4, d * 0.45, 0.24, RAMPS.NEUTRAL, 4)
      box(x + 1.15, y + 0.2, 1.59, 0.34, d * 0.4, 0.2, RAMPS.CALM, 1)
      break
    }
    case 'THE TOOL BOARD': {
      // A pegboard against the wall with tools hung on it. The board is thin —
      // it is a *board*, and giving it depth turns it into a cabinet.
      box(x, y, 0.55, w, 0.1, 1.35, RAMPS.NEUTRAL, 2)
      // The tools: five silhouettes at different heights, in the one tone that
      // is lighter than the board. Their irregular spacing is the read; a row
      // of evenly spaced marks is a ruler.
      const at = [0.25, 0.75, 1.15, 1.85, 2.35]
      const len = [0.5, 0.34, 0.62, 0.4, 0.28]
      for (let i = 0; i < at.length; i++) {
        box(x + at[i], y + 0.02, 1.55 - len[i], 0.12, 0.06, len[i], RAMPS.NEUTRAL, 5)
      }
      break
    }
    case 'THE WORKBENCH': {
      // A slab on four legs, with a vice at the near end and a drawer bank
      // under the far one. The overhang of the top past the legs is what says
      // "bench" instead of "table with a thick top".
      box(x + 0.12, y + 0.08, 0, 0.14, 0.14, 0.72, RAMPS.WOOD, 0)
      box(x + w - 0.26, y + 0.08, 0, 0.14, 0.14, 0.72, RAMPS.WOOD, 0)
      box(x + 0.12, y + d - 0.22, 0, 0.14, 0.14, 0.72, RAMPS.WOOD, 0)
      box(x + w - 0.26, y + d - 0.22, 0, 0.14, 0.14, 0.72, RAMPS.WOOD, 0)
      box(x + 0.9, y + 0.1, 0, 1.1, d - 0.2, 0.7, RAMPS.NEUTRAL, 2)
      box(x, y, 0.72, w, d, 0.13, RAMPS.WOOD, 2)
      box(x + w - 0.5, y + d * 0.35, 0.85, 0.34, 0.3, 0.3, RAMPS.NEUTRAL, 5)
      break
    }
    case 'THE BIKE': {
      // Two wheels, a frame bar and a saddle, leaned against the wall. Wheels
      // as thin upright boxes rather than ellipses: an ellipse is the one shape
      // in this room that does not lie in a plane, and at this size the
      // silhouette is all that survives anyway.
      box(x + 0.15, y + 0.3, 0, 0.1, 0.62, 0.62, RAMPS.NEUTRAL, 1)
      box(x + 1.0, y + 0.3, 0, 0.1, 0.62, 0.62, RAMPS.NEUTRAL, 1)
      box(x + 0.2, y + 0.5, 0.5, 0.9, 0.09, 0.12, RAMPS.ALARM, 1)
      box(x + 0.22, y + 0.48, 0.32, 0.1, 0.12, 0.3, RAMPS.ALARM, 1)
      box(x + 0.72, y + 0.42, 0.62, 0.3, 0.2, 0.1, RAMPS.NEUTRAL, 2)
      break
    }
    case 'THE BOXES': {
      // A stack that has been added to rather than built: three boxes, none
      // squarely on the one below, the top one open.
      box(x, y, 0, w, 1.0, 0.55, RAMPS.WOOD, 2)
      box(x + 0.1, y + 1.1, 0, w - 0.2, 0.9, 0.48, RAMPS.WOOD, 3)
      box(x - 0.05, y + 0.25, 0.55, w - 0.15, 0.85, 0.5, RAMPS.WOOD, 3)
      box(x + 0.15, y + 1.35, 0.48, w - 0.4, 0.7, 0.4, RAMPS.WOOD, 2)
      break
    }
    case 'THE BIN': {
      // A wheelie bin: body, sloped-looking lid a shade lighter, two wheels.
      box(x + 0.1, y + 0.15, 0, w - 0.25, d - 0.35, 0.78, RAMPS.FOLIAGE, 0)
      box(x + 0.05, y + 0.1, 0.78, w - 0.15, d - 0.25, 0.1, RAMPS.FOLIAGE, 1)
      box(x + 0.14, y + 0.2, 0, 0.1, 0.12, 0.1, RAMPS.NEUTRAL, 0)
      box(x + 0.14, y + d - 0.35, 0, 0.1, 0.12, 0.1, RAMPS.NEUTRAL, 0)
      break
    }
    case 'THE FRIDGE': {
      // The beer fridge. A tall box, a door line down two thirds of it, a
      // handle, and one magnet — which is the joke and the only warm mark on
      // this wall.
      box(x + 0.1, y + 0.1, 0, w - 0.25, d - 0.25, 1.45, RAMPS.NEUTRAL, 4)
      box(x + 0.08, y + 0.12, 0.5, 0.05, d - 0.3, 0.04, RAMPS.NEUTRAL, 1)
      box(x + 0.06, y + d - 0.5, 0.75, 0.06, 0.3, 0.09, RAMPS.NEUTRAL, 6)
      box(x + 0.07, y + 0.35, 1.05, 0.04, 0.16, 0.16, RAMPS.WARN, 2)
      break
    }
    case 'THE KETTLE': {
      // A counter with a kettle and two mugs on it. The kettle is the taller
      // of the three and the one with a spout.
      box(x + 0.1, y + 0.1, 0, w - 0.25, d - 0.2, 0.62, RAMPS.WOOD, 1)
      box(x + 0.35, y + 0.25, 0.62, 0.34, 0.34, 0.36, RAMPS.NEUTRAL, 5)
      box(x + 0.28, y + 0.32, 0.82, 0.12, 0.14, 0.08, RAMPS.NEUTRAL, 4)
      box(x + 0.3, y + 0.66, 0.62, 0.18, 0.18, 0.18, RAMPS.CALM, 1)
      box(x + 0.55, y + 0.66, 0.62, 0.18, 0.18, 0.18, RAMPS.ALARM, 1)
      break
    }
    case 'THE SOFA': {
      // The battered sofa: a low seat block, a back along the wall side, and an
      // arm at each end. The arms are what make it a sofa rather than a bench,
      // and they are the two marks worth spending.
      box(x + 0.35, y + 0.2, 0, w - 0.5, d - 0.4, 0.4, RAMPS.WOOD, 1)
      box(x + 0.1, y + 0.2, 0, 0.3, d - 0.4, 0.78, RAMPS.WOOD, 0)
      box(x + 0.35, y + 0.05, 0, w - 0.5, 0.22, 0.6, RAMPS.WOOD, 0)
      box(x + 0.35, y + d - 0.28, 0, w - 0.5, 0.22, 0.6, RAMPS.WOOD, 0)
      // Two cushions, sagging — different sizes, because a matched pair on a
      // battered sofa is a matched pair somebody bought.
      box(x + 0.5, y + 0.4, 0.4, 0.5, 0.55, 0.12, RAMPS.WOOD, 3)
      box(x + 0.5, y + 1.1, 0.4, 0.5, 0.7, 0.1, RAMPS.WOOD, 2)
      break
    }
    case 'THE CRATES': {
      // Milk crates and a stack of flattened card. Two heights, one leaning.
      box(x + 0.15, y + 0.1, 0, 0.75, 0.75, 0.42, RAMPS.CALM, 0)
      box(x + 0.15, y + 0.1, 0.42, 0.75, 0.75, 0.42, RAMPS.CALM, 1)
      box(x + 0.2, y + 1.0, 0, 0.7, 0.7, 0.4, RAMPS.ALARM, 0)
      box(x + 0.1, y + 0.05, 0.84, 0.85, 0.9, 0.08, RAMPS.WOOD, 2)
      break
    }
    default: {
      const look = PROP_LOOK[plot.name] ?? { h: 1.1, ramp: RAMPS.NEUTRAL, base: 3 }
      box(x, y, 0, w, d, look.h, look.ramp, look.base)
    }
  }
}

/**
 * §7.8.0c — what each named garage prop is made of.
 *
 * Keyed by the plan's own name, so adding a plot without a look here gets a
 * plain grey box rather than a crash, and the table cannot drift out of step
 * with the plan because the plan is what indexes it. Heights are in tiles: a
 * person is about 0.9, so 0.7 is a sofa back and 2.3 is a shelf stack you
 * cannot see over.
 */
const PROP_LOOK: Record<string, { h: number; ramp: readonly string[]; base: number }> = {
  // The workshop half — tall, dark, and against the far wall where it
  // silhouettes against the one full-height surface in the room.
  'THE SHELVES': { h: 2.3, ramp: RAMPS.WOOD, base: 0 },
  'THE TOOL BOARD': { h: 1.9, ramp: RAMPS.NEUTRAL, base: 1 },
  'THE WORKBENCH': { h: 0.85, ramp: RAMPS.WOOD, base: 1 },
  'THE BIKE': { h: 1.0, ramp: RAMPS.NEUTRAL, base: 2 },
  // The left wall — stacked boxes and the bin nobody empties.
  'THE BOXES': { h: 1.3, ramp: RAMPS.WOOD, base: 2 },
  'THE BIN': { h: 0.8, ramp: RAMPS.FOLIAGE, base: 0 },
  // The sitting-down half. Low, so the near wall does not swallow it.
  'THE FRIDGE': { h: 1.5, ramp: RAMPS.NEUTRAL, base: 4 },
  'THE KETTLE': { h: 0.9, ramp: RAMPS.NEUTRAL, base: 3 },
  'THE SOFA': { h: 0.72, ramp: RAMPS.WOOD, base: 1 },
  'THE CRATES': { h: 1.0, ramp: RAMPS.WOOD, base: 3 },
}

/**
 * §7.8.0c — **where the garage plan's origin sits on the room's lattice.**
 *
 * The one seam between two coordinate systems, and it is a constant rather than
 * a conversion because there is exactly one right answer: plan tile (0, 0) is
 * the room's **inner back corner**, the point where the two full-height walls
 * meet on the inside. `garage.ts` measures everything from there; the room's
 * lattice measures everything from `FLOOR_MIN_*`; and these two numbers are the
 * distance between those two beliefs.
 *
 * They exist because the alternative was tried and failed in a way that looked
 * fine. The plan was in its own tiles and the shell in the shell box's centred
 * tiles, four columns and three rows apart, so every prop drawn through either
 * projection landed on one wall — including the fridge and the sofa authored on
 * the opposite one. Two frames with no stated relationship is not a bug you fix
 * once; it is a bug you fix once per call site, for ever.
 */
export const GARAGE_COL0 = FLOOR_MIN_COL + WALL_THICK
export const GARAGE_ROW0 = FLOOR_MIN_ROW + WALL_THICK / PITCH_ROW

/** A plan tile, on the room's lattice. */
export function garagePlot(gx: number, gy: number): { col: number; row: number } {
  return { col: GARAGE_COL0 + gy / PITCH_COL, row: GARAGE_ROW0 + gx / PITCH_ROW }
}

/** Seat `index` in the grid axes `walkPath.ts` routes in. */
export function seatGridPoint(index: number): GridPoint {
  const { col, row } = seatGrid(index)
  return { gx: row * PITCH_ROW, gy: col * PITCH_COL }
}

/** Room-local screen coordinates back into the floor's grid axes. */
export function screenToGrid(x: number, y: number): GridPoint {
  return { gx: x / TILE_W + y / TILE_H, gy: y / TILE_H - x / TILE_W }
}

/** And back again — {@link gridToScreen}, exported for the walkers. */
export function gridPointToScreen(p: GridPoint): { x: number; y: number } {
  return gridToScreen(p.gx, p.gy)
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

/**
 * §7.8.12 [amended 2026-08-31] — **the suite is built out of the floor's own
 * units**, and that one rule is the whole of this rewrite.
 *
 * What stood here was seven desks at hand-picked screen offsets — `{ x: -68, y:
 * -25 }` and five more like it — inside a room where every other object goes
 * through {@link isoAt}. Everything reported about the suite followed from that
 * and only from that:
 *
 *  - Three of its four glass planes ran at screen slopes of −0.39, +1.18 and
 *    −1.05. In this projection a wall on the floor plane runs at ±0.50 and there
 *    are no other legal values, so one pane in four was right. That is what
 *    "hit and miss" is: a room in which some edges agree with the floor.
 *  - Its plate was drawn `(-140,-154) (0,-208) (140,-138) (0,12)` — a kite. The
 *    two side vertices of a level iso floor share a `y`; these differed by 16 px,
 *    and the south vertex overshot the rhombus by 88. It was the one object in
 *    the room not lying in the floor plane.
 *  - Mo, Serena and Billy were stacked at 55 px intervals straight down the
 *    *monitor*, which on the floor is a diagonal running 1.72 tiles into the far
 *    corner on both axes at once. Mo and Matt were mirrored about the screen's
 *    vertical; the room's own mirror is the north–south vertex line, and
 *    reflecting across it swaps the two floor axes — so they were a matched pair
 *    on the glass and two unrelated points on the ground.
 *
 * None of that is fixable by adjusting the numbers, because the numbers were in
 * the wrong unit. **No coordinate below is expressed in screen pixels.**
 *
 * The lattice is anchored to the founder rather than to the seat grid. §7.8.10's
 * north vertex lands at `col -3.36, row -1.60`, which is not an integer seat, and
 * moving the founder onto one is the single thing that section forbids. The
 * offset is sub-tile and invisible; what matters is that every step from here is
 * a whole number of floor axes.
 */
/**
 * Desk to desk **inside the suite**, in seat units — twice the floor's.
 *
 * §7.8.1's rank and file sit at exactly one {@link PITCH_COL}, shoulder to
 * shoulder, and get worse as the room fills. The suite is the one place in the
 * studio that does not, and this is where that is said: two seat pitches per
 * person, legible at a glance, costing one constant. It is §6's thesis stated in
 * furniture rather than in a curve — the same argument §7.8.1's crowding bands
 * make, told from the other end of the company.
 */
/*
 * **1.4, and it was 2 until 2026-09-01.** §7.8.0c.
 *
 * The argument below still holds, and is why this is 1.4 rather than the
 * floor's own 1: the suite is the one place in the studio that does not sit
 * shoulder to shoulder. What changed is that the number was set against the
 * *office* and then inherited by a garage a fifth of its size, where seven
 * plots at two pitches each came to over half the room's width — a corner
 * office wider than the studio it looks out over.
 *
 * The canonical garage concept puts leadership in a small improvised box behind
 * salvaged glass, and that is the honest picture: you do not get a generous desk
 * pitch in a garage. You get the desks pushed together behind whatever glazing
 * somebody found.
 */
export const SUITE_PITCH_COLS = 1.4
/**
 * The suite's two banks, as rows.
 *
 * The front bank is the founder's own row, and it has to be: §7.8.10 has them
 * facing back down the rows, and a bank of heroes between them and the floor
 * would take away the view that section spends three paragraphs protecting. So
 * the glass arrives *in front of* the founder — which is the literal reading of
 * "the walls arrive around where you were already sitting" — and the second bank
 * arrives behind, in the depth {@link FLOOR_BACK_ROWS} exists to hold.
 */
export const SUITE_FRONT_ROW = FOUNDER_CORNER_ROW
/*
 * **Two banks, and a third was tried and rejected on 2026-09-02.**
 *
 * The suite is seven plots at 1.4 pitch, which comes to a corner office taking
 * two fifths of the garage's width where the canonical concept gives leadership
 * about a fifth. Three shallower banks would have squared it up — and it breaks
 * two of this section's own rules, both of which are worth more than the width:
 *
 *  - **Every plot is a whole number of half-steps from the founder** on both
 *    floor axes. Three banks inside the reserved depth land at 0.7 of a row,
 *    which is not on the lattice at all — and being on the lattice is the
 *    entire fix §7.8.12 records, after a version drawn in screen pixels put
 *    three of four glass planes at illegal slopes.
 *  - **Nobody sits directly behind anybody.** With three banks and a
 *    half-pitch stagger there is no arrangement of seven plots that keeps every
 *    column distinct between the front and back rows; something always lines up.
 *
 * The width stays, and §7.8.0c records why: the concept's sketch has three
 * people behind that glass and the game's roster is seven. A corner sized for
 * seven is bigger than a corner drawn for three, and that is a difference in
 * the *content*, not in the drawing.
 */
export const SUITE_BACK_ROW = FOUNDER_CORNER_ROW - 1
/**
 * How far the back bank is offset along its row from the front one, in seats.
 *
 * Half a suite pitch, so no desk is drawn directly behind another. Two rows of
 * desks in exact register read as a grid — the "car park" `PITCH_ROW`'s note
 * warns about — and a stagger is what a real two-row office does for the same
 * reason: the person behind you should not be looking at the back of your head.
 */
export const SUITE_STAGGER_COLS = SUITE_PITCH_COLS / 2
/**
 * Where the glass stands, as a row.
 *
 * 0.7 rows in front of the founder's bank and 0.9 behind row 0 — so it is a wall
 * with a walkway on both sides of it rather than a pane bolted to the front of
 * somebody's desk. The gap on the floor side is the lane `roomLanes` already
 * builds behind row 0, which is what the doorway opens onto.
 */
export const SUITE_GLASS_ROW = SUITE_FRONT_ROW + 0.7

/**
 * The suite's two opaque sides **are the room's own back walls.**
 *
 * The shell is a diamond whose north vertex is `(FLOOR_MIN_COL, FLOOR_MIN_ROW)`,
 * and the two edges meeting there are the two the suite tucks into. So the suite
 * builds one glass wall and one end pane, and borrows the other two from the room
 * the founder was already sitting in. That is §7.8.12's joke made structural
 * rather than decorative: **most of this room was already here.**
 */
export const SUITE_WEST_COL = FLOOR_MIN_COL
export const SUITE_WALL_ROW = FLOOR_MIN_ROW

/**
 * How wide the doorway is, in seats — and **where** it is, which is the more
 * interesting half.
 *
 * It is centred on column zero, so it opens onto floor plot `(0, 0)`: the head
 * of row 0, the plot {@link SUITE_SEATS} holds empty. A door needs somewhere to
 * let out, and the alternative was the arrangement this replaced, where the only
 * way between the suite and the floor was a 36 px notch between two panes that
 * were not on the grid, with a developer sitting in it.
 *
 * One and a half seats: wide enough to read as a gap at Squad zoom, narrow
 * enough that the glass still reads as a wall with a hole in it rather than as
 * two unrelated screens.
 */
export const SUITE_DOOR_COLS = 1.5

/**
 * What the sign over the door says.
 *
 * Not `CXO`, not `EXECUTIVE SUITE`, and not `HEROES`. §13.11.2 already ruled out
 * that whole class of label — machine vocabulary about a database row, and
 * nothing in an office is labelled with one. This is the flattest corporate noun
 * available, which is why it is funny screwed to the wall of a converted garage
 * containing four people and a beer fridge: it is the sign nobody would think to
 * question, printed by a company that has just decided it is the kind of company
 * that has one.
 */
export const SUITE_SIGN = 'LEADERSHIP'
/** How far the sign hangs out past the glass, in rows — the floor's side. */
export const SUITE_SIGN_OUT = 0.3

/**
 * The size every word printed inside the room is set at.
 *
 * **Departure Mono's design size, and it is not a preference.** It is a pixel
 * font: its glyphs are drawn on an 11-pixel grid, and asking for any other size
 * resamples that grid. The first cut of the desk plates used 8 for a name and 6
 * for a role — reasonable-looking numbers for small type, and both wrong, because
 * a bitmap glyph at three quarters of its grid is not a lighter version of
 * itself, it is a different arrangement of pixels. The sign came out of the
 * renderer reading `I-EANFRAHTP`.
 *
 * Held constant on *screen* rather than in the room; see {@link PLATE_RISE} and
 * the counter-scale in `animate`.
 */
export const ROOM_TYPE_SIZE = 11
/** How far above a desk its plate floats, in room pixels. */
export const PLATE_RISE = 52
/** Name to role, in the plate's own units — one line, at the type's own size. */
export const PLATE_LINE = 12
/** Breathing room either side of a plate's words, in the plate's own units. */
export const PLATE_PAD = 3
/**
 * One character's advance, as a fraction of the type size.
 *
 * Departure Mono is monospace, so a string's width is its length times this and
 * there is nothing to measure. Same number `bubble.ts` sizes a balloon with.
 */
export const CHAR_ADVANCE = 0.6

/** One plot in the suite, in the floor's own seat units. */
export interface SuitePlot {
  col: number
  row: number
}

/**
 * The seven plots, fixed for the life of a run.
 *
 * Fixed **per hero** rather than filled in arrival order, so Serena's desk is
 * Serena's desk in every run and a player who learns the room once has learned
 * it. An unarrived hero's plot is bare floor, not an empty desk — §7.8.12 gives
 * a desk to a person, and a desk with nobody coming to it is set dressing that
 * makes a promise the run may not keep.
 *
 * Front bank first, then back, alternating, so the room fills outward from the
 * founder and the walls have somewhere to grow. James is plot 1: **the second
 * desk in the garage was always a CXO desk** (§7.8.1's table, row 2 — "a second
 * desk pushed alongside. James") and the code's mistake was to make that object
 * and rank-and-file seat 0 the same thing. See {@link SUITE_SEATS}.
 */
const SUITE_PLOTS: Readonly<Record<HeroId, SuitePlot>> = {
  james: { col: FOUNDER_CORNER_COL + SUITE_PITCH_COLS, row: SUITE_FRONT_ROW },
  matt: { col: FOUNDER_CORNER_COL + SUITE_STAGGER_COLS, row: SUITE_BACK_ROW },
  mo: { col: FOUNDER_CORNER_COL + SUITE_PITCH_COLS * 2, row: SUITE_FRONT_ROW },
  melany: { col: FOUNDER_CORNER_COL + SUITE_PITCH_COLS + SUITE_STAGGER_COLS, row: SUITE_BACK_ROW },
  serena: { col: FOUNDER_CORNER_COL + SUITE_PITCH_COLS * 3, row: SUITE_FRONT_ROW },
  billy: { col: FOUNDER_CORNER_COL + SUITE_PITCH_COLS * 2 + SUITE_STAGGER_COLS, row: SUITE_BACK_ROW },
}

/** The founder's own plot, in the same units — plot 0 of the front bank. */
export const FOUNDER_PLOT: SuitePlot = {
  col: FOUNDER_CORNER_COL,
  row: SUITE_FRONT_ROW,
}

/** Where a named hero is physically sitting, on the floor's grid. */
export function suitePlot(id: HeroId): SuitePlot {
  return { ...SUITE_PLOTS[id] }
}

/** Where a named hero is physically sitting, assigned or not. */
export function teamDeskPosition(id: HeroId): { x: number; y: number } {
  const plot = SUITE_PLOTS[id]
  return isoAt(plot.col, plot.row)
}

/**
 * §7.8.12 — the suite's footprint, in seat units, for a given east wall.
 *
 * **The east wall is the only side that moves.** It stands one seat past the
 * last occupied plot, so the room is two desks wide when James arrives and the
 * full seven when Billy does — §7.8.1b's promise ("the people already sitting
 * down never move") applied to the corner office. The other three sides are
 * constants: two of them are the shell's, and the glass is where the glass is.
 *
 * Depth is deliberately *not* a function of occupancy. A wall that stepped back
 * on one particular hire would be the camera's fit moving under the player, and
 * `floorBox` spent a paragraph explaining why the shell stopped doing that.
 */
export function suiteBox(eastCol: number): { minX: number; maxX: number; minY: number; maxY: number } {
  return blockBox(SUITE_WEST_COL, SUITE_WALL_ROW, eastCol, SUITE_GLASS_ROW)
}

/** The east wall for a suite holding these heroes — one seat past the last plot. */
export function suiteEastCol(ids: readonly HeroId[]): number {
  let east = FOUNDER_CORNER_COL
  for (const id of ids) east = Math.max(east, SUITE_PLOTS[id].col)
  return east + 1
}

/** The suite at its full extent — the seven-plot room, for tests and fits. */
export const TEAM_ROOM_BOUNDS = suiteBox(
  suiteEastCol(Object.keys(SUITE_PLOTS) as HeroId[]),
)

/**
 * §7.8.12 [added 2026-08-31] — **how many of the room's first seats are in the
 * suite rather than on the floor.**
 *
 * One, and it is James. He remains the simulation's seat 0 — `jamesPresent`,
 * `BILLY_SEAT`, §10.7a's focus indices and every rule that names that seat are
 * untouched — but the *room* draws him at his suite plot, and the floor's
 * lattice plot `(0, 0)` is left empty.
 *
 * That empty plot is not a hole. It is at the head of row 0, directly in front
 * of the glass, and it is where the suite's door lets out: **it is the
 * threshold.** Which is the argument for doing it this way round rather than
 * shifting every seat index by one. Nothing else in the room has to learn a new
 * numbering — `seatGrid`, `roomLanes`, `deskFrame`, the arrivals and the
 * coverage decals all keep the arithmetic they have — and the one visible
 * consequence is a plot of bare floor that the design wanted anyway.
 *
 * Reported as *"we should have considered James in the beginning, that his desk
 * should be the beginning of forming the CXO space, separated from the rank and
 * file coders"*, and the report is right about the history: §7.8.1's table has
 * said "2 — a second desk pushed alongside. James" since before any of this was
 * built. It was never a description of a rank-and-file seat.
 */
export const SUITE_SEATED: readonly HeroId[] = ['james']

/**
 * How many of a window's first seats the suite holds. One, and it is James.
 *
 * **Derived from {@link SUITE_SEATED} rather than written down beside it**, so
 * the two cannot disagree — which is the same rule the rest of this file applies
 * to its geometry, applied to its casting.
 */
export const SUITE_SEATS = SUITE_SEATED.length

/** The same, for a given §26.2.2 window. Zero anywhere but the studio's own. */
export function suiteSeatsIn(windowFrom: number): number {
  return windowFrom === 0 ? SUITE_SEATS : 0
}

/**
 * §7.8.12 — **where seat `seat` is actually drawn.** The single authority.
 *
 * {@link seatGrid} and {@link seatPosition} answer for the *floor lattice*, and
 * they are still right about it: they are the reading order §7.8.1b defines and
 * everything that reasons about rows, aisles and squads goes through them. They
 * are the wrong question for anything that draws a **person**, because a seat
 * the suite holds is not on the lattice at all.
 *
 * Having two answers to that question is what broke James's arrival on
 * 2026-08-31: the room drew him at his desk in the suite, `deskFor` and §7.7.2's
 * falling silhouette both went to `seatPosition(0)`, and he was dropped onto the
 * doorway threshold and then teleported to his chair. The bug was not that a
 * call site was wrong; it was that a call site *could* be.
 *
 * So this is the one function, and everything that puts a body, a desk or a
 * camera on a seat resolves through it — the build loop, `deskFor`, `deskAt` and
 * `arrivals.spawn`. **Moving anybody into or out of the suite is now an edit to
 * {@link SUITE_SEATED} and nothing else.**
 *
 * `windowFrom` is required rather than defaulted, deliberately: the suite exists
 * in the studio's own first thousand and nowhere else, and a default would let a
 * caller forget that question rather than answer it.
 */
export function drawnSeatPlot(seat: number, windowFrom: number, garage: boolean): SuitePlot {
  const i = Math.max(0, Math.floor(seat))
  const held = suiteSeatsIn(windowFrom)
  if (i < held) return suitePlot(SUITE_SEATED[i])
  if (garage) {
    /*
     * §7.8.0c — the garage's own plan, **shifted past the suite's seats**.
     *
     * The office floor leaves the suite's lattice plot bare and starts ordinary
     * developers at their own index; one hole in a hundred-wide lattice is
     * invisible and the reading order stays simple. A garage cannot afford that
     * trade: one bare plot there is a missing chair at a table of four, which
     * reads as a defect rather than as a threshold. So the twenty pod seats are
     * filled by the twenty *ordinary* developers and the suite's people are in
     * addition to them — which is §7.8.0's separation stated as an index shift.
     *
     * Tiles to lattice: `col` runs along `gy` and `row` steps along `gx`, so
     * the conversion is a division by each axis's pitch and nothing else.
     */
    const g = garageSeat(i - held)
    return garagePlot(g.gx, g.gy)
  }
  /*
   * §7.8.0d — **the office floor's own plan**, in the same frame as the
   * garage's. Both are tiles measured from the room's inner back corner, so
   * `garagePlot` converts either: the frame is a property of the *room*, not of
   * which plan is standing in it.
   *
   * Past the floor's hundred the room falls back to §7.8.1e's lattice, and that
   * is the honest interim. Above a hundred ordinary developers the picture is
   * the tower (§7.8.0), so the only way to be looking at a hundred-and-first
   * seat in this room is to have pinched all the way in to a storey — and the
   * storey window has not been rebuilt on the new plan yet. Drawing it on the
   * old lattice is wrong in a way the player can reach; drawing nothing is
   * wrong in a way they cannot recover from.
   */
  const ordinary = i - held
  if (ordinary < OFFICE_SEATS) {
    const o = officeSeat(ordinary)
    return garagePlot(o.gx, o.gy)
  }
  const { col, row } = seatGrid(i)
  return { col, row }
}

/** {@link drawnSeatPlot}, projected — room-local screen coordinates. */
export function drawnSeatPosition(
  seat: number,
  windowFrom: number,
  garage: boolean,
): { x: number; y: number } {
  const plot = drawnSeatPlot(seat, windowFrom, garage)
  return isoAt(plot.col, plot.row)
}

/**
 * Does seat `seat` rest facing the camera? — §7.8.0c's facing pods.
 *
 * Half of every garage pod looks back across the table, so the front pose is no
 * longer the exclusive property of a selected developer (§7.8.8, amended
 * 2026-09-01). It is still true that *turning* is: nobody on the floor ever
 * changes which way they are looking except by being selected or by speaking.
 */
export function seatFacesCamera(seat: number, windowFrom: number, garage: boolean): boolean {
  const held = suiteSeatsIn(windowFrom)
  const i = Math.max(0, Math.floor(seat))
  if (i < held) return false
  const ordinary = i - held
  if (garage) return garageSeat(ordinary).facing === 'gx+'
  // The office's pods face each other too — §7.8.0d is the same furniture at a
  // different scale, so the same half of every table rests looking back.
  if (ordinary < OFFICE_SEATS) return officeSeat(ordinary).facing === 'gx+'
  return false
}

/**
 * §7.8.13 [added 2026-08-31] — **how much of a desk plate survives this zoom.**
 *
 * Three states, and the middle one is the point. A plate is a name over a role,
 * and at Squad scale the role is 6 px of type — a smear, not a word. So the role
 * is *dropped* rather than shrunk, because the name is the half that identifies
 * and a legible half beats an illegible whole.
 *
 * At Floor the plates go entirely and the branch-coloured monitor strip is all
 * that is left, which is enough: at that size the question has stopped being
 * "who is that" and become "what is that lit box in the corner", and the sign
 * over the door answers it. The sign is therefore **not** part of this — it is
 * the one piece of type in the room that is drawn at every level the room is.
 */
export type LabelDetail = 'full' | 'name' | 'none'

/** A wall as drawn — the two ends of its foot, on the floor. */
export interface WallFoot {
  a: { x: number; y: number }
  b: { x: number; y: number }
}

/**
 * A rectangle of the seat grid — **the unit containment is decided in.**
 *
 * Every room-shaped thing in here is a parallelogram on screen, so its screen
 * bounding box is a loose over-approximation of it: `blockBox` of the suite
 * contains the first four seats of row 0, which are outside the suite by two
 * whole rows. The first version of the `test:room` gate compared screen boxes
 * and reported the room as broken at nine headcounts out of eleven; the room was
 * fine and the *question* was in the wrong unit. Grid rectangles nest exactly,
 * so the claims made of them are exact.
 */
export interface GridRect {
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
}

/** A seat or plot, in both units, so a gate can check they agree. */
export interface PlacedPlot {
  col: number
  row: number
  x: number
  y: number
}

/** §7.8.12 — the measured room, for the `test:room` gate. */
export interface RoomGeometry {
  shell: {
    /** The slab's four corners, room-local screen coordinates. */
    top: { x: number; y: number }
    left: { x: number; y: number }
    right: { x: number; y: number }
    bottom: { x: number; y: number }
    /** And the same rectangle in the grid it was built from. */
    grid: GridRect
  }
  /** The suite as drawn, or null before its walls arrive. */
  suite: {
    box: { minX: number; maxX: number; minY: number; maxY: number }
    grid: GridRect
  } | null
  /** Every wall the suite built for itself, as drawn. */
  suiteWalls: WallFoot[]
  /** Where each arrived hero is sitting. */
  plots: Array<PlacedPlot & { id: HeroId }>
  founder: PlacedPlot
  /** Where the room drew each seat it is showing, and which plot that came from. */
  seats: PlacedPlot[]
  /** Which of this window's first seats the suite is holding. */
  heldSeats: number
  seatWindow: number
}

/** The small slice of hero state the renderer needs. */
export interface TeamRoomHero {
  id: HeroId
  colour: string
  assigned: boolean
  connecting: boolean
  selected: boolean
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
  // Measured across the *plan* rather than across a lattice of squads, and in
  // one unit rather than two: a row step is 2.1 tiles and a column step is one,
  // so adding raw seat coordinates would have released the deep banks far too
  // early. The far corner is the last to start and finishes exactly on time.
  const far = PLAN_BOUNDS.maxCol + PLAN_BOUNDS.maxRow * PITCH_ROW
  const reach = Math.max(0, squadCol) + Math.max(0, squadRow) * PITCH_ROW
  return Math.min(1, reach / far) * UNFOLD_STAGGER
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
  halfBack: number,
  depth: number,
  halfAcross = halfBack,
): { x: number; y: number } {
  // **Two half-extents, not one.** The garage is a square room and the two were
  // the same number; an open-plan floor is five squads across and two back, so
  // a single `halfTiles` put the props for the long wall at the short wall's
  // spacing — bunched into the middle of one and hanging off the end of the
  // other. `halfBack` is the room's depth (the `gx` axis) and `halfAcross` its
  // width (`gy`), and each wall runs along the one it is not the back of.
  const across = -halfAcross + Math.min(1, Math.max(0, u)) * 2 * halfAcross
  const along = -halfBack + Math.min(1, Math.max(0, u)) * 2 * halfBack
  const p =
    wall === 'left'
      ? gridToScreen(-halfBack + depth / 2 + WALL_GAP, across)
      : gridToScreen(along, -halfAcross + depth / 2 + WALL_GAP)
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

/**
 * The four creator silhouettes, shared by generated developers and YOU — **and
 * a fifth that only Billy has.**
 *
 * The fifth is the same exception the hair and shirt ramps already make for
 * James (`art/personPalette.ts`): it sits one past `BODY_SHAPES`, so a roll can
 * never produce it and it belongs to one person. §22.8's roster is six people
 * who are somebody in particular against a floor of people who are nobody in
 * particular, and R51 asks for *extremely distinct* — a hero the player can
 * pick out of a crowd of a thousand without a label, which is the same argument
 * §7.8.13 makes for giving each of them one permanent idle.
 *
 * It exists because the other four cannot say what Billy is. He is slim, he is
 * tall and he is wearing a proper collared shirt: `tee` is slim and short,
 * `knit` is tall and ribbed into a turtleneck, `jacket` has the broadest
 * shoulders in the room, and `hoodie` is boxy. Picking any of them would have
 * contradicted the description in the silhouette while the colour said
 * otherwise, and the silhouette is what reads at fifty developers.
 */
function torsoShape(look: Look): { w: number; h: number } {
  switch (look.body) {
    // Tee — the narrowest, clearly the smallest silhouette.
    case 1: return { w: 12, h: 18 }
    // Jacket — the broadest shoulders in the room.
    case 2: return { w: 22, h: 18 }
    // Knit — the tallest, a turtleneck body.
    case 3: return { w: 16, h: 22 }
    // Shirt — Billy's, and nobody else's: narrow *and* full height.
    case BILLY_TORSO: return { w: 13, h: 23 }
    // Hoodie — boxy, in between.
    default: return { w: 18, h: 19 }
  }
}

/** Details large enough to survive the room scale; no preview-only costume. */
function drawTorsoDetails(g: Graphics, look: Look, front: boolean) {
  const body = look.body
  if (body === BILLY_TORSO) {
    // Shirt: a collar with a notch at the throat, and a buttoned placket down
    // the front. Two marks, because at this scale a third is a smudge — and
    // they are the two that say "this is not a t-shirt" from across the floor.
    g.rect(-5, -13, 10, 2).fill(c(RAMPS.NEUTRAL[7]))
    if (front) {
      g.moveTo(-4.5, -13).lineTo(-0.75, -8).lineTo(-0.75, -13).closePath().fill(c(RAMPS.NEUTRAL[8]))
      g.moveTo(4.5, -13).lineTo(0.75, -8).lineTo(0.75, -13).closePath().fill(c(RAMPS.NEUTRAL[7]))
      g.rect(-0.6, -11, 1.2, 14).fill(c(RAMPS.NEUTRAL[7]))
    }
    return
  }
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

  /*
   * **Forearms, reaching to the desk — and the back pose deliberately has
   * none.** §7.8.0c [2026-09-01].
   *
   * `buildDeveloper` draws elbows and stops, and its comment says exactly why:
   * *"from behind, the forearms are hidden by the torso and the elbows are the
   * only part of the arms that reads — which is also true of the real thing."*
   * That was correct while the front pose was spent on one selected developer
   * at a time, where the eye is on the face and the pose lasts a moment.
   *
   * It stops being correct when **half of every pod rests facing the camera**.
   * A seated person seen from the front has their forearms on the table in
   * front of them; leaving them off gives a floor of figures with no arms at
   * all, which is the single most obvious thing wrong with a crowd. So the
   * front pose gets what the front actually shows: a shoulder line, two
   * forearms angled down and outward to where the keyboard is, and a cuff where
   * the sleeve ends.
   *
   * Drawn *after* the face so a hand never covers a chin, and in the same skin
   * ramp as the head so the two read as one person rather than as a figure
   * holding two objects.
   */
  const reach = torso.w / 2
  const cuff = c(shirtRamp[Math.max(0, shirtBase - 1)])
  const flesh = c(RAMPS.SKIN[skin])
  for (const side of [-1, 1] as const) {
    // Upper arm: a short band off the shoulder, in the shirt's own shadow tone
    // so it reads as sleeve rather than as a second torso.
    g.rect(side === -1 ? -reach - 2.5 : reach - 0.5, -11, 3, 7).fill(cuff)
    // Forearm: angled in toward the keyboard, which is on the desk's centre
    // line. Two quads rather than a rotated rect, because everything else in
    // this room is a polygon in a plane and a rotated sprite would be the one
    // object that is not.
    const x0 = side * (reach + 1)
    const x1 = side * (reach - 3.5)
    g.moveTo(x0 - 1.4, -4.5)
      .lineTo(x0 + 1.4, -4.5)
      .lineTo(x1 + 1.4, 1.5)
      .lineTo(x1 - 1.4, 1.5)
      .closePath()
      .fill(flesh)
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
function deskOffset(face: 1 | -1 = 1) {
  return gridToScreen(-DESK_SETBACK * face, 0)
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
export function drawDeskBank(
  g: Graphics,
  colFrom: number,
  colTo: number,
  row: number,
  /**
   * How deep the surface is and how far it stands back from the seat line.
   *
   * Defaulted to the floor's single-sided bank, which is every existing caller.
   * §7.8.0c's garage pods pass a double depth and **no setback**, because a
   * facing pod's table is not behind anybody — it is between two people, and
   * both of them are set back from it in opposite directions.
   */
  depth = DESK_DEPTH,
  setback = DESK_SETBACK,
) {
  // The run goes along `gy` — the row's axis — and is `DESK_DEPTH` across it.
  const gy0 = colFrom * PITCH_COL - DESK_SPAN / 2
  const gy1 = colTo * PITCH_COL + DESK_SPAN / 2
  // Set back from the seats — see {@link DESK_SETBACK}. This one subtraction is
  // the difference between a person at a desk and a person standing on one.
  const gx = row * PITCH_ROW - setback
  const d = depth / 2

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
function coverageKey(marks: ReadonlyMap<number, { colour: string; wasted: boolean; settling: boolean; activation?: number }>): string {
  let key = ''
  for (const [seat, m] of marks) {
    key += `${seat}${m.colour}${m.wasted ? 'w' : ''}${m.settling ? 's' : ''}${(m.activation ?? 1).toFixed(2)};`
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
  mark: { colour: string; wasted: boolean; settling: boolean; activation?: number },
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

  const activation = mark.activation ?? 1
  outline().fill({ color: colour, alpha: 0.3 * activation })
  outline().stroke({ width: 1, color: colour, alpha: 0.55 + 0.3 * activation })

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

/**
 * **A chair, and only behind somebody facing you.** §7.8.0c [2026-09-01].
 *
 * §7.8.1 records three attempts at a chair and rejects all of them, and the
 * conclusion it draws is exact: *"the honest depth order puts a chair between
 * the camera and a figure facing away, so it either covers the person or, drawn
 * behind them, shows only slivers the eye assigns to the person anyway."*
 *
 * Every word of that is about a figure **facing away**. It does not apply to
 * one facing you: their chair is behind them, on the far side, where it
 * occludes nothing and reads as its own silhouette. §7.8.0c's facing pods put
 * half the floor in exactly that case, and the canonical concept draws a chair
 * behind every one of them — a tall dark back, which is the strongest shape in
 * the whole pod after the screens.
 *
 * So the rule is not "chairs are back" but "a chair is drawn where a chair can
 * be seen", which is what §7.8.1 was really saying. Rank-and-file floors, where
 * everybody faces away, still have none.
 *
 * Drawn into the **back** layer, because behind a camera-facing person is away
 * from the camera.
 */
export function drawChair(g: Graphics, x: number, y: number) {
  /*
   * **Narrower than a monitor, and with a lit rail.** [2026-09-02]
   *
   * The first version was 19 by 21 in the same dark tone as a monitor's back,
   * so every camera-facing developer had two indistinguishable slabs against
   * them and a pod read as a heap of dark boxes. The fix is not size alone: a
   * chair back and a screen are both dark rectangles at this scale, so one of
   * them has to carry a mark the other does not.
   *
   * The chair takes the mark, because it is the cheaper of the two: a pale rail
   * along its top edge, which is what an office chair actually shows — and it
   * is also the one line that says *back of a chair* rather than *panel*. It is
   * narrower than the screen and shorter than the person, so the silhouette
   * reads shoulders-above-chair, which is how a seated figure looks.
   */
  const back = gridToScreen(-0.34, 0)
  isoBox(g, x + back.x, y + back.y - 2, 14, 16, RAMPS.NEUTRAL, 1, true)
  // The rail. Two pixels, and it is the whole difference between a chair and a
  // second monitor turned round.
  g.rect(x + back.x - 7, y + back.y - 19, 14, 2).fill(c(RAMPS.NEUTRAL[4]))
  const seat = gridToScreen(-0.15, 0)
  isoBox(g, x + seat.x, y + seat.y, 15, 3, RAMPS.NEUTRAL, 2, false)
}

/**
 * One person's kit on the bank — the screen they are looking at and the box
 * under it.
 *
 * `face` is `1` for the floor's default, a developer seen from behind with the
 * desk in front of them, and `-1` for one **turned round** — §7.8.0c's facing
 * pods, where half of every table looks back across it toward the camera.
 *
 * The mirror is done on the floor's own axes rather than by flipping the
 * sprite: `DESK_SETBACK` reverses, the wall plane's slope reverses with it, and
 * every item on the surface is placed from the same two signed constants. A
 * horizontal flip would put the light on the wrong side of every object in the
 * room, which is the one thing ART_DIRECTION §7 will not have.
 *
 * The monitor is the one part that is not a mirror but a different object. A
 * screen turned away from the camera shows its **back** — a dark panel with the
 * glow escaping round its top edge — and that is what the canonical concepts
 * draw: bright screens for the people facing away, dark monitor backs with lit
 * faces above them for the people facing you. Drawing the emissive face on both
 * sides would put two screens back to back both shining at the camera, which is
 * not a thing that happens in a room.
 */
export function drawWorkstation(g: Graphics, x: number, y: number, seat = 0, face: 1 | -1 = 1) {
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
  const off = deskOffset(face)
  const sx = x + off.x
  const sy = y + off.y - DESK_H
  /*
   * **The screen's plane does not flip with the facing, and flipping it was the
   * bug.** §7.8.0c [2026-09-02].
   *
   * A monitor is a vertical panel whose horizontal extent runs along `gy` —
   * that is true of every screen in the room, whichever way its owner is
   * looking, because turning a developer round moves the screen to the other
   * side of the desk and points its *normal* the other way along `gx`. The
   * plane it lies in is unchanged.
   *
   * `-0.5 * face` sheared it the other way as well, which is not a mirror of
   * anything in this room: it put the turned screens on a third slope the 2:1
   * projection does not have, leaning against the desk they stand on. Exactly
   * the defect `test:room` exists to catch one scale up, reintroduced inside a
   * prop small enough to slip under it.
   *
   * What the facing *does* change is where the panel sits ({@link deskOffset}),
   * which of its faces is lit, and how high it is mounted — not its geometry.
   */
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
  const BACK = -0.14 * face
  const FRONT = 0.12 * face
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

  /*
   * **A turned screen is mounted low, and that is not a style choice.**
   * §7.8.0c [2026-09-02].
   *
   * A monitor is drawn *upward* from its desk point, and for a developer facing
   * away that is right — their desk is further from the camera, so the panel
   * rises behind them and reads as standing on it. Mirror the same numbers for
   * a developer facing *you* and the desk point moves only five pixels down the
   * screen while the panel still climbs thirty, so it lands **above their
   * head**: a screen apparently floating behind the person who is looking at
   * the back of it.
   *
   * No offset fixes this. To push a panel below a person's head by geometry
   * alone the desk would have to be two whole tiles nearer the camera, which is
   * wider than the table.
   *
   * The concept shows what actually happens in the room: in a facing pod the
   * two rows' screens stand **back to back in the middle of the table**, so you
   * see them low, against people's torsos, never over their faces. So a turned
   * monitor is mounted at desk height on a short neck and is smaller — which is
   * also what a screen seen edge-on-ish from behind looks like.
   */
  const lift = face === 1 ? 30 : 17
  const neck = face === 1 ? 14 : 5
  // The monitor's foot, then its neck, then the panel over both.
  isoBox(g, sx, sy - 1, 9, 3, RAMPS.NEUTRAL, 2, false)
  const my = sy - lift
  g.rect(sx - 1.5, my + neck, 3, lift - neck - 2).fill(c(RAMPS.NEUTRAL[2]))

  // Bezel, then the emissive face. The screen is the room's only light source,
  // so it is the one surface here allowed to ignore the top-left key.
  const panelW = face === 1 ? 30 : 25
  const panelH = face === 1 ? 21 : 15
  wallQuad(g, sx, my - 2, panelW, panelH, S, c(RAMPS.NEUTRAL[2]))
  if (face === 1) {
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
  } else {
    // The back of the panel. Flat and unlit — a monitor's rear is the one large
    // surface in this room with nothing on it, which is exactly why it reads:
    // it is the silhouette that says *there is a screen there and you are on
    // the wrong side of it*.
    //
    // `NEUTRAL[3]`, not `[1]`: at the darkest tone it was the same value as a
    // chair back, so a camera-facing developer came with two identical slabs
    // and the pod read as a heap of boxes. A screen's back is moulded plastic
    // and a chair's is upholstery — they are not the same colour in the room
    // either.
    wallQuad(g, sx, my, 21, 11, S, c(RAMPS.NEUTRAL[3]))
    // And the light escaping over its top edge, which is the only evidence the
    // thing is switched on. Two pixels, in the same plane, and it is what puts
    // the cyan on the face of the person behind it.
    wallQuad(g, sx, my - 1, 22, 2, S, c(RAMPS.GLOW[1]))
  }
  // The sliver of the monitor's own side that a panel turned away from the
  // camera shows. Two pixels, and it is the whole difference between a screen
  // and a decal. On the edge that is turning away, which swaps with `face`.
  // The sliver of the monitor's own side. It is on the same end whichever way
  // the screen faces, for the same reason the slope is: the panel has not
  // moved, only the side of it you are looking at.
  const half = panelW / 2
  g.moveTo(sx + half, my - panelH * 0.45)
    .lineTo(sx + half + 2, my - panelH * 0.4)
    .lineTo(sx + half + 2, my + panelH * 0.5)
    .lineTo(sx + half, my + panelH * 0.45)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[1]))
  // A sticky note on the bezel, on about half the screens. Four pixels of WARN
  // in the plane of the panel — the one piece of desk dressing that reads at a
  // full floor, because it is the only warm colour in a room lit by a blue
  // screen. Stuck *on* the bezel rather than beside it: at `sx - 16` it hung
  // off the edge of the monitor and read as a little pennant.
  // Only on a screen whose face the camera can see; a sticky note on the back
  // of a monitor is a note nobody wrote.
  if (face === 1 && deskRoll(seat, 3) < 0.45) {
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
  /**
   * §7.8.12 — the team room is three depth planes, not a DOM panel.
   * Architecture sits behind the old founder/James desks, the five additional
   * bodies sit with them, and the IM activity is the last piece of scenery on
   * top. Keeping those planes separate is what lets the glass grow around the
   * two desks without fading the people who were already sitting there.
   */
  const teamArchitecture = new Container()
  const teamFloor = new Graphics()
  const teamGlass = new Graphics()
  const teamDeskLayer = new Graphics()
  const teamPeopleLayer = new Container()
  const teamSignals = new Graphics()
  /**
   * §7.8.12 [added 2026-08-31] — **the words.**
   *
   * Its own container rather than a `Graphics`, because these are `Text` and
   * text cannot be baked into a shape layer that is cleared and refilled. It
   * sits above the bodies for the same reason the desk plates in a real office
   * are at eye level: a name occluded by the person it names is not a name.
   *
   * The one thing it must never become is HUD. §7.1 gives the interface its own
   * pane of glass and this is not on it — these objects are printed, screwed to
   * furniture, and scale with the room, so they leave the frame when the room
   * does. `plateFor` and `signFor` below both go through `Text` with a `try`
   * around construction, on `bubble.ts`'s rule: a missing font must degrade to
   * the wrong monospace rather than to no words at all.
   */
  const teamLabels = new Container()
  /**
   * **The walls only.** `teamDeskLayer` used to live in here and does not any
   * more, because the two now appear at different moments: §7.8.12 builds the
   * glass when a *second* hero arrives, while the desks inside it are the
   * founder's and James's and have been there since the garage. Keeping the
   * furniture inside the architecture meant the first desk could not be drawn
   * until the room around it existed, which is the wrong way round — the whole
   * joke is that the desks came first.
   */
  teamArchitecture.addChild(teamFloor, teamGlass)
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
  teamArchitecture.label = 'team-room'
  teamPeopleLayer.label = 'team-room-heroes'
  teamSignals.label = 'team-room-signals'
  teamDeskLayer.label = 'team-room-desks'
  teamLabels.label = 'team-room-labels'
  const ambient = createAmbient()
  /**
   * §7.8.9 — the away population's bodies.
   *
   * Handed the simulation's roster every frame via {@link RoomHandle.setAway};
   * it owns nothing about *who* is away, only where they are standing.
   */
  const errands = createErrands()
  /**
   * §21.7.0 — one transient line over one seat. At most one at a time, because
   * it answers a gesture and the player only has one finger on the floor.
   */
  const speech = createBubbles()
  let saying: { seat: number; text: string; born: number; ms: number } | null = null
  // Bubbles go above everyone, including the people in the front row — a
  // speech bubble occluded by the desk in front of it is not a speech bubble.
  // Panels sit *above* the shell's own floor and below everything else: the
  // shell's diamond and its walls are what the unfold fades away, and the two
  // never overlap on screen because the walls rise from behind the deepest
  // plate.
  /**
   * §7.8.0b — the cutaway's **near walls**, drawn over the floor they enclose.
   *
   * A cutaway only reads if the wall between the camera and the floor is
   * actually drawn between them. Put these in `shell` with the far walls and
   * they are painted first and then covered by every desk in the room, which is
   * a two-sided room again by a different route.
   */
  /**
   * §7.8.0c — **the garage's clutter, drawn after the executive suite.**
   *
   * The props were in `furniture`, which is painted *before* `teamArchitecture`
   * — so §7.8.12's glass went over the top of them. On the office floor that
   * never showed, because the suite is at the back of a room whose desks start
   * several tiles away. A garage is small enough that the shelving stands right
   * against the glass, and the glass won: a two-metre shelf stack with a pane
   * drawn through it.
   *
   * It is not a sorting bug inside one layer. The suite is a *building* and the
   * clutter is furniture standing on the floor in front of it, so they belong
   * on opposite sides of it — the same argument §7.8.0c makes about the near
   * half of a facing pod's kit, one object larger.
   */
  const garageProps = new Graphics()
  /** §7.8.0c — the near half of a facing pod's kit. See {@link frontDesks}. */
  const frontDeskLayer = new Container()
  const nearWall = new Graphics()
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
    teamArchitecture,
    teamDeskLayer,
    garageProps,
    managerDesk,
    devLayer,
    // Above the seated people and below the walkers: a monitor on the near side
    // of a facing pod stands between its owner and the camera, and somebody
    // crossing the aisle in front of that pod is nearer still.
    frontDeskLayer,
    founderLayer,
    teamPeopleLayer,
    teamLabels,
    teamSignals,
    ambient.layer,
    errands.layer,
    // Above the walkers, so somebody crossing the front of the studio passes
    // *behind* the near wall rather than over it. Below speech, which is on
    // §7.1's pane of glass and is not in the room at all.
    nearWall,
    speech.layer,
  )

  /** One §7.8.1c panel: the plate, its lip, and the light it catches turning. */
  interface Panel {
    root: Container
    base: Graphics
    /** The plate's edge, kept apart from `base` so it can be re-tinted. */
    lip: Graphics
    sheen: Graphics
    /** The plate's own corner on the floor lattice, in seat units. */
    squadCol: number
    squadRow: number
  }
  const panels: Panel[] = []
  const squadDesks: Graphics[] = []
  /**
   * §7.8.0c — **the kit that stands between a developer and the camera.**
   *
   * A facing pod puts half its people on the near side of the table, looking
   * back across it, and their monitors are therefore *in front of them*. Drawn
   * in `deskLayer` with everybody else's, those monitors are painted before the
   * people and then covered by them — so a developer appears to be sitting on
   * top of their own screen.
   *
   * This is not a sorting bug that a depth key would fix. The two halves of a
   * pod genuinely belong on opposite sides of the people layer, because the
   * table runs between them; the honest structure is two layers, and which one
   * a workstation goes into is decided by the same `facing` that decides which
   * way its owner is drawn. One fact, read twice, rather than two facts that
   * can disagree.
   */
  const frontDesks: Graphics[] = []

  const devs: Container[] = []
  let team: TeamRoomHero[] = []
  let teamDrawnFor = ''
  let teamSpeaker: HeroId | null = null
  let teamReveal = 1
  const teamBodies = new Map<HeroId, Container>()
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
  /**
   * §7.8.0c — is the room currently drawing the garage?
   *
   * Set once per rebuild and read by everything that has to agree with what was
   * drawn: `deskFor`, the seat report, the resting pose and §7.7.2's arrivals.
   * It is a *drawn* fact rather than a derived one on purpose — `deskFor` is
   * asked about a seat that does not exist yet, so re-deriving it from a
   * headcount there would answer for a different room than the one on screen.
   */
  let drawnGarage = false
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
  /**
   * §7.8.12 — the suite's current screen box, or null while it has no walls.
   *
   * A `let` rather than the {@link TEAM_ROOM_BOUNDS} constant because the east
   * wall moves: the room is two desks wide when James arrives and seven when
   * Billy does, and the camera rectangle has to be the room that is actually
   * standing there. The constant remains the full extent, which is what tests
   * and `frames.suiteFrame` want.
   */
  let teamBox: { minX: number; maxX: number; minY: number; maxY: number } | null = null
  /** The sign over the door, as a group — its live scale is the hit box's. */
  let signGroup: Container | null = null
  /** §7.8.12 — the slab's four corners as last drawn, for {@link RoomHandle.geometry}. */
  const shellQuad = {
    top: { x: 0, y: 0 },
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
    bottom: { x: 0, y: 0 },
  }
  /** Every wall the suite built for itself as last drawn, in the same units. */
  let suiteWalls: WallFoot[] = []
  /** The grid rectangle the slab was last built from — the shell's real shape. */
  const shellGrid: GridRect = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 }
  /** And the suite's, which shares its two back sides. */
  let suiteGrid: GridRect | null = null
  /** §7.8.13 — how much of a desk plate is legible at the current zoom. */
  let labelDetail: LabelDetail = 'full'
  /** Whether the room's type is currently landing at its own design size. */
  let typeLegible = true

  /**
   * §7.8.12 — **how many of this window's first seats the suite holds.**
   *
   * One in the studio's own window, none anywhere else. §26.2.2's block 50 has
   * no executive suite in it: its local seat 0 is an ordinary developer with a
   * rolled face, and holding a plot back for a James who is a hundred thousand
   * desks away would put a hole in a floor that has no room to explain it.
   */
  function suiteSeats(): number {
    return suiteSeatsIn(windowFrom)
  }

  /**
   * §7.8.12 — build the suite on the floor's own lattice.
   *
   * Three things arrive in order and the order is the composition: the room
   * (floor, two borrowed walls, one glass front with a door in it), the desks
   * and the people, then the words. Only the east wall moves with the
   * headcount — see {@link suiteBox}.
   *
   * The *walls* still appear only when a second hero arrives, which is unchanged
   * and is §7.8.12's own rule: James alone is the garage story and a glass box
   * around two people is a punchline told before the setup. The *desks* are the
   * suite's from the first frame, because they always were — the founder's and
   * the one pushed alongside it.
   */
  function rebuildTeam() {
    teamFloor.clear()
    teamGlass.clear()
    teamDeskLayer.clear()
    teamSignals.clear()
    // The reveal below only runs once there are walls to reveal, so a suite
    // that is still two desks in a garage has to start at full strength rather
    // than at whatever alpha the last reveal left behind.
    teamDeskLayer.alpha = 1
    teamPeopleLayer.alpha = 1
    teamLabels.alpha = 1
    teamSignals.alpha = 1
    for (const body of teamBodies.values()) body.destroy({ children: true })
    teamBodies.clear()
    teamPeopleLayer.removeChildren()
    for (const label of teamLabels.removeChildren()) label.destroy()

    // §26.2.2 — the suite exists in the studio's own first thousand and nowhere
    // else. A block drawn out of a nation is a floor of a company this size; it
    // is not the floor the founder is sitting on.
    const here = windowFrom === 0
    const peopled = here && team.length > 0
    const walls = here && team.length > 1
    teamArchitecture.visible = walls
    teamDeskLayer.visible = peopled
    teamPeopleLayer.visible = peopled
    teamSignals.visible = walls
    teamLabels.visible = walls
    signGroup = null
    suiteWalls = []
    if (!peopled) {
      teamBox = null
      suiteGrid = null
      return
    }

    const east = suiteEastCol(team.map((hero) => hero.id))
    teamBox = walls ? suiteBox(east) : null
    suiteGrid = walls
      ? { minCol: SUITE_WEST_COL, maxCol: east, minRow: SUITE_WALL_ROW, maxRow: SUITE_GLASS_ROW }
      : null

    if (walls) {
      // The floor of the suite, as a parallelogram in the seat grid's own axes —
      // the same shape `squadPlate` uses and for the same reason. It is a darker
      // inset in the ordinary slab rather than a second material: the border and
      // the glass make it a room, not a change of flooring.
      const nw = isoAt(SUITE_WEST_COL, SUITE_WALL_ROW)
      const ne = isoAt(east, SUITE_WALL_ROW)
      const se = isoAt(east, SUITE_GLASS_ROW)
      const sw = isoAt(SUITE_WEST_COL, SUITE_GLASS_ROW)
      teamFloor
        .moveTo(nw.x, nw.y)
        .lineTo(ne.x, ne.y)
        .lineTo(se.x, se.y)
        .lineTo(sw.x, sw.y)
        .closePath()
        .fill({ color: c(RAMPS.NEUTRAL[1]), alpha: 0.72 })
        .stroke({ width: 2, color: c(RAMPS.NEUTRAL[5]), alpha: 0.5 })

      /**
       * One pane, standing on a line **between two floor plots**.
       *
       * The two endpoints go through {@link isoAt}, so the pane's foot is on the
       * floor's own axis by construction and its screen slope is whatever the
       * projection makes of that. It cannot come out at 1.18 the way a pane
       * given two screen points could, and did.
       */
      const pane = (fromCol: number, fromRow: number, toCol: number, toRow: number, h: number) => {
        const a = isoAt(fromCol, fromRow)
        const b = isoAt(toCol, toRow)
        suiteWalls.push({ a: { ...a }, b: { ...b } })
        // Which way this pane faces, from which way its foot runs. The two
        // orientations take different mullion values so the room has a lit side
        // and a shaded one rather than four identical walls.
        const lit = b.y < a.y
        teamGlass
          .moveTo(a.x, a.y)
          .lineTo(b.x, b.y)
          .lineTo(b.x, b.y - h)
          .lineTo(a.x, a.y - h)
          .closePath()
          .fill({ color: c(RAMPS.GLOW[0]), alpha: 0.24 })
          .stroke({ width: 2, color: c(RAMPS.NEUTRAL[lit ? 7 : 6]), alpha: 0.72 })
        // Mullions every seat, so the glass is divided in the same unit the
        // floor is. A pane whose divisions do not match the desks behind it
        // reads as a picture of glass rather than as glass.
        const spans = Math.max(1, Math.round(Math.abs(toCol - fromCol) + Math.abs(toRow - fromRow)))
        for (let i = 1; i < spans; i++) {
          const t = i / spans
          const x = a.x + (b.x - a.x) * t
          const y = a.y + (b.y - a.y) * t
          teamGlass.moveTo(x, y).lineTo(x, y - h).stroke({ width: 1, color: c(RAMPS.NEUTRAL[5]), alpha: 0.5 })
        }
      }

      // The east end — the only wall the suite builds for itself on that side,
      // and the one that moves. Half height, so it reads as a partition rather
      // than as the room having been cut off.
      pane(east, SUITE_WALL_ROW, east, SUITE_GLASS_ROW, 34)
      // The front, in two runs with the doorway between them. The door is on
      // the floor's grid too: it opens onto plot (0, 0) — the head of row 0,
      // which `suiteSeats` holds empty precisely so that it can.
      pane(SUITE_WEST_COL, SUITE_GLASS_ROW, -SUITE_DOOR_COLS / 2, SUITE_GLASS_ROW, 46)
      if (east > SUITE_DOOR_COLS / 2) {
        pane(SUITE_DOOR_COLS / 2, SUITE_GLASS_ROW, east, SUITE_GLASS_ROW, 46)
      }

      /*
       * §7.8.12 — **the sign over the door**, and it is words now.
       *
       * The argument this room used to make against that — structured words
       * belong on the HUD's pane of glass — drew the line in the wrong place. A
       * sign over a door is architecture; offices have them. What belongs on
       * the HUD is the *roster*, and tapping this is how the roster opens.
       *
       * It hangs on the **floor** side of the glass, because a sign over a door
       * is for the people who are not in the room yet. That also keeps it clear
       * of the plates on the desks behind it, which is not a coincidence: every
       * word in this room is the same eleven pixels tall, so anything sharing
       * their band collides with them.
       */
      const door = isoAt(0, SUITE_GLASS_ROW + SUITE_SIGN_OUT)
      signGroup = group(door.x, door.y - 62)
      signGroup.addChild(
        new Graphics()
          .roundRect(-38, -9, 76, 18, 2)
          .fill({ color: c(RAMPS.NEUTRAL[1]), alpha: 0.94 })
          .stroke({ width: 1, color: c(RAMPS.GLOW[1]), alpha: 0.8 })
          .rect(-34, -13, 68, 2)
          .fill({ color: c(RAMPS.GLOW[2]), alpha: 0.5 }),
      )
      // `typeLine`, not `label`: the sign already has a board and does not want
      // a second plate behind its words.
      const sign = typeLine(SUITE_SIGN, c(RAMPS.GLOW[2]))
      if (sign) {
        sign.label = 'lettering'
        signGroup.addChild(sign)
      }
    }

    for (const hero of team) {
      const plot = SUITE_PLOTS[hero.id]
      const at = isoAt(plot.col, plot.row)
      const colour = c(hero.colour)

      // Every hero brings one desk, James included. He used to be exempt on the
      // grounds that the floor was already drawing seat 0's; it is not, since
      // 2026-08-31 that plot is the doorway's threshold and this is his desk.
      drawDeskBank(teamDeskLayer, plot.col, plot.col, plot.row)
      drawWorkstation(teamDeskLayer, at.x, at.y, 1200 + teamBodies.size)
      const identity = heroIdentity(hero.id)
      if (identity) {
        const body = buildDeveloper(identity.look)
        body.label = `team-hero:${hero.id}`
        body.position.set(at.x, at.y + 6)
        teamBodies.set(hero.id, body)
        teamPeopleLayer.addChild(body)
      }

      // The branch-coloured monitor strip is dim on the bench and live while
      // this desk owns a remote assignment. It is the suite end of §13.11's
      // plate and it is the only part of the naming that survives Floor zoom.
      teamDeskLayer
        .roundRect(at.x - 13, at.y - 15, 26, 5, 1)
        .fill({ color: colour, alpha: hero.assigned ? 0.95 : 0.28 })
      if (hero.assigned) {
        teamDeskLayer
          .circle(at.x + 15, at.y - 21, hero.connecting ? 2.5 : 3.5)
          .fill({ color: colour, alpha: hero.connecting ? 0.55 : 1 })
      }

      if (walls) drawDeskPlate(hero, at, colour)
    }

    if (walls) {
      // §7.8.10's corner desk gets one too. It is the only plate in the room
      // whose second line is not a department, because the founder does not
      // have one — the rail has called this MANAGER CORNER since §4.5d and the
      // plate says the same thing the button does.
      plate(
        isoAt(FOUNDER_PLOT.col, FOUNDER_PLOT.row),
        founderProfile.name.toUpperCase().slice(0, 12),
        c(RAMPS.NEUTRAL[8]),
        'MANAGER CORNER',
        c(RAMPS.NEUTRAL[5]),
      )
    }

    // The plates are rebuilt at full detail and then cut back to whatever the
    // camera is currently asking for. Doing it in this order means a hero who
    // arrives while the lens is at Floor gets the same treatment as everyone
    // else the moment it comes back down.
    applyLabelDetail()
  }

  /**
   * §7.8.13 — a desk plate: the name, the role under it, in the branch colour.
   *
   * The object `WorldHeroAssignments.tsx` already specified and argued for, put
   * where that argument leads. Its note is worth restating because it is the
   * whole reason this is not a card: *"nothing in an office is labelled
   * ASSIGNED"* — and the other half of that is that everything in an office
   * **is** labelled with a name and a job. The suite had a 26x5 px coloured
   * rectangle with no text on it, which is the entire "no clear signs" gap.
   *
   * Two lines at Desk zoom, one at Squad, none at Floor. That is not a fade: the
   * type is held at a constant size on screen, so at Squad it is the *plates*
   * that run out of room rather than the letters — two desks are 51 px apart
   * there and `CUSTOMER SUPPORT` is 106 px wide. The role is dropped rather than
   * shrunk because the name is the half that identifies, and a legible half
   * beats an illegible whole. See {@link RoomHandle.setLabelDetail}.
   */
  function drawDeskPlate(hero: TeamRoomHero, at: { x: number; y: number }, colour: number) {
    const story = STORY_HEROES.find((h) => h.id === hero.id)
    if (!story) return
    plate(at, story.name.toUpperCase(), colour, story.role, c(RAMPS.NEUTRAL[hero.assigned ? 6 : 5]))
  }

  /**
   * A name over a role, printed above one desk — §7.8.13's plate.
   *
   * **Both lines are on their own backing**, and that is not decoration. A
   * branch colour is chosen to be legible as *coverage paint on a dark floor*
   * (§13.11.1), and four of the six are light: Melany's `#58b0d0` and Billy's
   * `#b088d0` set straight onto the room's lilac walls came out as two grey
   * smudges while Matt's green and Serena's red read fine, which is a plate that
   * works for some of the staff.
   *
   * A backing per line rather than one behind the pair, because {@link
   * LabelDetail} drops the role on its own and a plate left with a hole in it
   * where the second line used to be is worse than either state.
   */
  function plate(
    at: { x: number; y: number },
    name: string,
    nameFill: number,
    role: string,
    roleFill: number,
  ) {
    const g = group(at.x, at.y - PLATE_RISE)
    const top = label(name, nameFill)
    if (top) g.addChild(top)
    const under = label(role, roleFill)
    if (under) {
      // Inside the group, so the gap between the two lines is in the same units
      // the type is and cannot open up or close as the camera moves.
      under.position.set(0, PLATE_LINE)
      under.label = 'role'
      g.addChild(under)
    }
  }

  /**
   * One counter-scaled group of printed type, anchored to a point in the room.
   *
   * **The group is what scales, not the text inside it**, so a plate's two lines
   * stay one plate at every zoom. `animate` sets the scale each frame from
   * `bubble.ts`'s `counterScale` — the same rule, and for the same reason a map
   * label does not grow when you zoom in.
   */
  function group(x: number, y: number): Container {
    const g = new Container()
    g.position.set(x, y)
    teamLabels.addChild(g)
    return g
  }

  /**
   * Apply {@link labelDetail} to the type already on the plates.
   *
   * A toggle rather than a rebuild, because zoom changes every frame during a
   * fly-to and rebuilding seven desks per frame to hide fourteen words is the
   * kind of cost that only shows up on the §23.3 test device.
   */
  function applyLabelDetail() {
    // Words are drawn only where they can be drawn *properly* — the zoom has to
    // want them and the type has to be landing at its design size.
    const words = labelDetail !== 'none' && typeLegible
    teamLabels.visible = teamBox !== null
    for (const g of teamLabels.children) {
      if (g === signGroup) continue
      g.visible = words
      for (const line of (g as Container).children) {
        if (line.label === 'role') line.visible = labelDetail === 'full'
      }
    }
    /*
     * **The sign is the one thing that does not go out — it goes quiet.**
     *
     * Its lettering obeys the same rule as the plates, because it is the same
     * eleven-pixel face and would be resampled into nonsense past the same
     * point. Its *board* does not: a lit strip in the corner of a floor is
     * exactly what the room used to have as its only sign, and it is still the
     * answer to the question that is left once no name is legible — not "who is
     * that" any more, but "what is that lit box in the corner".
     *
     * So the far tier of this object is the object the first build stopped at,
     * which is a pleasant way for an amendment to land: the old design was not
     * wrong, it was the last frame of the new one.
     */
    if (signGroup) {
      for (const part of signGroup.children) {
        if (part.label === 'lettering') part.visible = words
      }
    }
  }

  /**
   * One line of printed type on its own plate.
   *
   * A `Container` rather than a bare `Text` so the backing travels with the
   * words: the two are one object, they are shown and hidden together, and the
   * plate is sized from the type it is actually carrying rather than from a
   * guess about how long a job title is.
   */
  function label(text: string, fill: number): Container | null {
    const t = typeLine(text, fill)
    if (!t) return null
    // **Measured from the string, not from the `Text`.** Reading `t.width` makes
    // Pixi lay the glyphs out through a canvas 2D context, which is a thing the
    // test environment does not have — the first cut of this threw
    // `Cannot set properties of null (setting 'font')` out of three suites that
    // have nothing to do with type. The face is monospace, so the arithmetic is
    // not an approximation of the measurement; it is the measurement, and
    // `bubble.ts` sizes its balloons the same way for the same reason.
    const w = text.length * ROOM_TYPE_SIZE * CHAR_ADVANCE
    const line = new Container()
    line.addChild(
      new Graphics()
        .roundRect(-w / 2 - PLATE_PAD, -PLATE_LINE / 2, w + PLATE_PAD * 2, PLATE_LINE, 1)
        .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.62 }),
      t,
    )
    return line
  }

  /** The words themselves. Null if the renderer has no fonts. */
  function typeLine(text: string, fill: number): Text | null {
    let t: Text
    try {
      t = new Text({
        // ART_DIRECTION §3 — the one face, and the generic fallback matters for
        // the same reason it does in `bubble.ts`.
        //
        // **{@link ROOM_TYPE_SIZE}, always.** Departure Mono is a pixel font
        // with a design size, and the first cut of this drew names at 8 and
        // roles at 6 — below it. The result was not small type, it was *wrong*
        // type: the sign reading LEADERSHIP came out of the renderer as
        // `I-EANFRAHTP`, because a bitmap glyph resampled to three quarters of
        // its own grid is a different set of pixels rather than a lighter one.
        style: { fontFamily: 'Departure Mono, monospace', fontSize: ROOM_TYPE_SIZE, fill },
      })
    } catch {
      return null
    }
    t.text = text
    t.anchor.set(0.5, 0.5)
    return t
  }

  function teamKey(heroes: readonly TeamRoomHero[]): string {
    return heroes
      .map((hero) =>
        [hero.id, hero.colour, hero.assigned ? 1 : 0, hero.connecting ? 1 : 0, hero.selected ? 1 : 0].join(':'),
      )
      .join('|')
  }

  /** The animated Instant Messenger packets leaving the room. */
  function drawTeamSignals(elapsed: number) {
    teamSignals.clear()
    if (!teamBox) return
    // §7.8.12 — the Instant Messenger packets leave through the doorway,
    // because that is where the room lets out. They used to converge on a fixed
    // point below the old plate, which put every remote assignment through the
    // middle of a pane of glass.
    const exit = isoAt(0, SUITE_GLASS_ROW)
    for (let order = 0; order < team.length; order++) {
      const hero = team[order]
      if (!hero.assigned) continue
      const at = teamDeskPosition(hero.id)
      const colour = c(hero.colour)
      const alpha = hero.connecting ? 0.42 : 0.8
      teamSignals
        .moveTo(at.x + 10, at.y - 25)
        .lineTo(exit.x, exit.y)
        .stroke({ width: 1, color: colour, alpha: alpha * 0.34 })
      for (let packet = 0; packet < 3; packet++) {
        const t = (elapsed * (hero.connecting ? 0.32 : 0.58) + packet / 3 + order * 0.13) % 1
        const x = at.x + 10 + (exit.x - at.x - 10) * t
        const y = at.y - 25 + (exit.y - at.y + 25) * t
        teamSignals.rect(x - 2, y - 1, 4, 2).fill({ color: colour, alpha })
      }
    }
  }

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
  /**
   * §7.8.9 — **where the errands go**, one list per destination kind.
   *
   * This used to be a single `walkTargets` array holding the cooler, the coffee
   * machine and the fridge, because §7.8.6 had one walk and it was for a drink.
   * The away population has four destinations and they are not interchangeable:
   * a developer sent to "a prop" and drawn staring at a filing cabinet is not
   * the joke, and a whiteboard huddle has to happen at a whiteboard.
   *
   * Recorded as the props are laid out rather than recomputed, because the
   * perimeter ring's slot allocation depends on which props exist at this
   * headcount and duplicating that logic in the walker is how the two quietly
   * disagree about where the cooler is.
   *
   * In **grid** coordinates, not screen: `walkPath.ts` routes in the floor's own
   * axes, and converting once here beats converting on every waypoint of every
   * route on every frame.
   */
  const spots: {
    water: GridPoint[]
    whiteboard: GridPoint[]
    window: GridPoint[]
    sofa: GridPoint[]
  } = { water: [], whiteboard: [], window: [], sofa: [] }
  /** Where somebody stands to use a prop: on the floor, out from the wall. */
  const standingSpot = (x: number, y: number): GridPoint => {
    const g = screenToGrid(x, y)
    // Out of the wall and onto the floor. The props are drawn with their backs
    // against it, so their own centre is inside the furniture.
    return { gx: g.gx + 0.75, gy: g.gy + 0.75 }
  }
  /** The roster as of the last {@link RoomHandle.setAway}. */
  let away: readonly Away[] = []
  /** Reused rather than rebuilt per frame — it is written on every one. */
  const awaySeats = new Set<number>()
  /** Who is in the player's hand, and where the hand is. Room-local. */
  let carried = -1
  let carryAt: { x: number; y: number } | null = null
  /** The walkable lattice for this headcount, rebuilt with the room. */
  let currentLanes = roomLanes(1)
  let currentProps = propsAt(1)
  let lastDevs = -1
  const extent = { w: TILE_W * 3, h: 156 }
  /**
   * What the room actually occupies, in its own coordinates — the rectangle the
   * lens frames at floor level.
   *
   * Live, because the *garage* really does grow: §7.8.1's first frames are one
   * desk and the walls push outward across the 11–30 band. Above the unfold it
   * is a constant, which is the half that matters — see FLOOR_MIN_COL.
   */
  const shellRect = { cx: 0, cy: 0, w: TILE_W * 3, h: 156 }

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
    shellRect.w = fit.w
    shellRect.h = fit.h
    shellRect.cx = fit.px
    shellRect.cy = fit.py
    // **The pivot is zero, and that is the change.** The room used to centre
    // itself on its own fit, because the camera framed *containers* and every
    // one of them had to arrive pre-centred. The lens now frames a rectangle in
    // the world, so a container that shifts its own contents underneath that
    // rectangle is a second, invisible camera fighting the first — which is
    // exactly what pushed the floor to the top of the frame with the near half
    // of it off screen.
    root.pivot.set(0, 0)
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

  /** Include the team room in a camera rectangle without moving either world. */
  function includeTeamInFit(fit: { w: number; h: number; px: number; py: number }) {
    if (!teamBox) return
    const minX = Math.min(fit.px - fit.w / 2, teamBox.minX - 18)
    const maxX = Math.max(fit.px + fit.w / 2, teamBox.maxX + 18)
    const minY = Math.min(fit.py - fit.h / 2, teamBox.minY - 18)
    const maxY = Math.max(fit.py + fit.h / 2, teamBox.maxY + 18)
    fit.w = maxX - minX
    fit.h = maxY - minY
    fit.px = (minX + maxX) / 2
    fit.py = (minY + maxY) / 2
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
    /*
     * §7.8.0 — **ordinary developers, which is not the headcount.**
     *
     * The suite's people (§7.8.12) are in `n` and are not in the seat lattice,
     * so the scale model has to be asked about the difference. This is the one
     * place the two are reconciled, and everything downstream reads `ordinary`
     * rather than re-deriving it: "leadership does not consume capacity" is one
     * subtraction, made once, or it is a rule that holds in some files.
     */
    const heldSeats = suiteSeats()
    const ordinary = Math.max(0, n - heldSeats)
    // §7.8.1c [amended 2026-09-01] — the **twentieth** ordinary hire fills the
    // garage, so the floor has to open on the twenty-first. Once started, never
    // unstarted for this run: the unfold is a one-shot and the floor does not
    // fold back up if the studio shrinks.
    if (unfoldT < 0 && sceneFor(ordinary) !== 'garage') unfoldT = 0
    const unfolded = unfoldT >= 0
    // §7.8.0c — the garage is the folded room, and it is only ever the studio's
    // own window: §26.2.2's blocks are drawn out of a nation, and a block in a
    // company that size is not somebody's garage.
    const garage = !unfolded && windowFrom === 0
    drawnGarage = garage
    /*
     * §7.8.1 [amended 2026-09-01] — **the garage does not grow. It is a garage.**
     *
     * §7.8.1's table has the walls pushing outward across the 11–30 band, and
     * for the open-plan floor that is right: an office is a lease, and a studio
     * that outgrows one takes more of the building. A garage is not a lease. It
     * is a building somebody already owns, it is the wrong size from the day
     * they move in, and its walls do not move when you hire somebody. The
     * canonical concept is one fixed room.
     *
     * The growth the player sees is therefore the **pods filling** and the
     * camera pulling back, not masonry sliding. That is a stronger read of the
     * same beat: at one developer you are looking at a room far too big for
     * you, which is exactly the feeling §7.8.1 was reaching for and could not
     * get from a room that shrank to fit whoever was in it.
     */
    const { cols, rows } = garage
      ? { cols: GARAGE_COL0 + GARAGE_SPAN + 1, rows: GARAGE_ROW0 + GARAGE_SPAN / PITCH_ROW + 1 }
      : gridFor(n)
    const props = propsAt(headcount)
    currentProps = props
    // §7.8.6 — the walkway lattice is a fact about *this* room, so it is rebuilt
    // with it. A router holding last headcount's aisles walks people down a
    // corridor that is now four desks.
    currentLanes = garage ? garageLanes(ordinary) : roomLanes(n)

    shell.clear()
    light.clear()
    furniture.clear()
    managerDesk.clear()
    desks.length = 0
    spots.water.length = 0
    spots.whiteboard.length = 0
    spots.window.length = 0
    spots.sofa.length = 0

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
    // **The shell encloses whatever the studio actually occupies.**
    //
    // It used to be sized from the block inside a single squad and then faded
    // to nothing by the unfold, on the reading that "its walls and its dressing
    // belong to a room that has just been outgrown". That left every headcount
    // above a hundred standing on bare plates in the dark — no walls, no floor,
    // no room. A studio that grows does not stop being in a building; it takes
    // more of one. So past the unfold the shell is sized from the *floor*
    // rather than from the squad, and it stays.
    /*
     * §7.8.1 + §7.8.12 — **the shell is a rectangle of the grid, at every
     * headcount, and its north corner is the suite's back corner.**
     *
     * The unfolded branch has worked this way since the "the room is too big"
     * fix, and the note below records why: a *diamond* that contains a block of
     * desks has to be about twice the block's width, so the people end up in a
     * clump in the middle of a slab. The folded branch kept the diamond, and
     * §7.8.12's suite is what finally made that visible — reported as
     * *"floating and totally not immersed in the scene"*, which is exactly what
     * it was.
     *
     * **A wide box cannot tuck into a point.** The garage's north corner was a
     * vertex, and at the height the suite sits the diamond is far wider than the
     * suite is, so there is no arrangement of margins that puts the suite in the
     * corner of that shape. Nothing about the numbers caused it; the shape did,
     * one scale down from where that was learned the first time.
     *
     * So both branches now name a grid rectangle, and because
     * {@link SUITE_WEST_COL} is {@link FLOOR_MIN_COL} and {@link SUITE_WALL_ROW}
     * is {@link FLOOR_MIN_ROW}, the two agree about where the back of the room
     * is. The suite is in the corner **by construction** rather than by
     * arithmetic that has to keep coming out right — see `scripts/room-check.ts`,
     * which asserts it at every headcount the room can be drawn at.
     *
     * The two back sides are architecture and do not move. The two the floor
     * grows into take §7.8.1's surround, which still opens across the 11–30 band
     * and closes again past forty — that is the half of `roomMargin` the player
     * can actually see. Doubled on the column axis for `FLOOR_AISLE_COLS`'
     * reason: one column step is 32 px across and one row step 67, so equal
     * screen margins are unequal seat counts.
     */
    const surround = roomMargin(n)
    const shellMinCol = SUITE_WEST_COL
    /*
     * §7.8.0d [2026-09-01] — **the leadership suite is bolted onto the outside
     * of the office floor, not tucked into a corner of it.**
     *
     * The canonical concept is unambiguous: `LEADERSHIP` is a glass box hanging
     * off the building's west corner, outside the shell, attached to it. §7.8.12
     * built it *inside* the shell's north vertex — "most of this room was
     * already here", which was the joke and was cheap — and that reads as a
     * partitioned corner of the open plan rather than as an annex.
     *
     * The change is one number rather than a relocation, and that is the whole
     * reason to make it this way: §7.8.10 fixes the founder at the north vertex
     * and forbids them to move, so the suite does not move either. **The floor's
     * far wall moves instead**, back past the suite's depth — so the same glass
     * box, in the same place, with the same people in it, is now outside the
     * building it is attached to. The wall arrived between them, which is
     * §7.8.12's own sentence ("the walls arrive around where you were already
     * sitting") read one clause further on.
     *
     * It also buys the non-rectangular silhouette the concept has and §7.8.1e's
     * rectangle never could.
     */
    const SUITE_CLEAR = 4.6
    const shellMinRow = unfolded && windowFrom === 0
      ? GARAGE_ROW0 + SUITE_CLEAR / PITCH_ROW
      : SUITE_WALL_ROW
    // The garage takes no surround: the plan already contains its own margins,
    // and adding §7.8.1's growing border to a room that does not grow would put
    // a widening strip of bare concrete between the last pod and the wall.
    /*
     * §7.8.0d — **the office floor is its own plan's rectangle**, the same way
     * the garage is. `FLOOR_MAX_COL` sizes §7.8.1e's thousand-seat lattice, and
     * a hundred people standing in it are a hundred people in a room built for
     * ten times as many — the exact complaint §7.8.0 exists to answer, left in
     * place one level up.
     */
    const officeShell = unfolded && windowFrom === 0
    const shellMaxCol = officeShell
      ? GARAGE_COL0 + OFFICE_SPAN + WALL_THICK
      : unfolded
      ? FLOOR_MAX_COL
      : garage
        ? Math.max(cols - 1 + WALL_THICK, suiteEastCol(team.map((hero) => hero.id)) + 1)
        : Math.max(cols - 1, suiteEastCol(team.map((hero) => hero.id)), FOUNDER_CORNER_COL + 2) +
          surround * 2
    const shellMaxRow = officeShell
      ? GARAGE_ROW0 + (OFFICE_SPAN + WALL_THICK) / PITCH_ROW
      : unfolded
      ? FLOOR_MAX_ROW
      : garage
        ? rows - 1 + WALL_THICK / PITCH_ROW
        : Math.max(rows - 1, 0) + surround
    shellGrid.minCol = shellMinCol
    shellGrid.minRow = shellMinRow
    shellGrid.maxCol = shellMaxCol
    shellGrid.maxRow = shellMaxRow
    const box = blockBox(shellMinCol, shellMinRow, shellMaxCol, shellMaxRow)
    // **The open floor's border is a surround, not a crowding factor.**
    // `roomMargin` returns 0.4 once the studio passes forty — it is §7.8.1's
    // "walls close in as it fills up", and in the folded branch it goes through
    // the surround, which is breathing room around the grid rectangle. It used
    // to be multiplied straight into the radius of a diamond that had to
    // *contain* the desk block, so the slab came out at forty per cent of the
    // people standing on it. That whole class of mistake went with the diamond:
    // a margin is now added to the edges of a rectangle, so it cannot make the
    // room smaller than the block however it is tuned.
    const floorW = (box.maxX - box.minX) / 2
    const floorH = (box.maxY - box.minY) / 2

    // **The shell's half-extents in the grid's own axes, and they are not
    // equal.** A garage is a square room, so its floor is a diamond and one
    // number described it. An open-plan floor is *five squads across and two
    // back* — a rectangle — and a rectangle in this projection is a
    // parallelogram, not a diamond.
    //
    // That distinction is the whole of "the room is too big". A diamond that
    // **contains** a 2:1 block of desks has to be twice the block's width, so
    // framing the shell framed a room with the people in a clump in the middle
    // of it: measured, 483 px of developers inside a 997 px frame at a full
    // floor and 283 px at one squad. Nothing about the margins caused that; the
    // shape did — and the garage kept that shape until 2026-08-31, which is how
    // §7.8.12's suite ended up floating in the middle of a slab.
    const halfBack = (shellMaxRow - shellMinRow) * PITCH_ROW * 0.5
    const halfAcross = (shellMaxCol - shellMinCol) * PITCH_COL * 0.5
    const halfW = halfBack

    const cx = (box.minX + box.maxX) / 2
    const cy = (box.minY + box.maxY) / 2

    // The shell's four corners. For the garage these come out exactly where
    // the old diamond's vertices were, so nothing below had to learn a new
    // shape — only that the two walls may now be different lengths.
    const nw = gridToScreen(-halfBack, -halfAcross)
    const ww = gridToScreen(-halfBack, halfAcross)
    const ee = gridToScreen(halfBack, -halfAcross)
    const ss = gridToScreen(halfBack, halfAcross)
    const topX = cx + nw.x
    const topY = cy + nw.y
    const leftX = cx + ww.x
    const leftY = cy + ww.y
    const rightX = cx + ee.x
    const rightY = cy + ee.y
    const botX = cx + ss.x
    const botY = cy + ss.y
    shellQuad.top = { x: topX, y: topY }
    shellQuad.left = { x: leftX, y: leftY }
    shellQuad.right = { x: rightX, y: rightY }
    shellQuad.bottom = { x: botX, y: botY }
    /** How far the back-left wall runs from the corner, on each axis. */
    const westW = topX - leftX
    const westH = leftY - topY
    /** And the back-right. Equal to the west pair in a garage; longer here. */
    const eastW = rightX - topX
    const eastH = rightY - topY

    // The wall planes' screen slope, from the room's own geometry rather than
    // a literal 0.5, so wall-mounted things stay in plane if the projection
    // ratio is ever retuned.
    const WALL_SLOPE = westH / westW

    // Floor — a concrete slab, not wood. This room is a garage, and the slab
    // is the half of that the eye checks first: a dark grey pour with a paler
    // edge, an oil stain in front of the door, and one crack. Office wood
    // belongs to the open-plan plates that arrive with §7.8.1c; the founder's
    // room never stops being the garage it started as.
    const slab = (inset: number, fill: number) => {
      const k = inset
      shell
        .moveTo(topX + (botX - topX) * k, topY + (botY - topY) * k)
        .lineTo(rightX + (leftX - rightX) * k, rightY + (leftY - rightY) * k)
        .lineTo(botX + (topX - botX) * k, botY + (topY - botY) * k)
        .lineTo(leftX + (rightX - leftX) * k, leftY + (rightY - leftY) * k)
        .closePath()
        .fill(fill)
    }
    // --- the district ------------------------------------------------------
    //
    // §7.8.1e, and it goes first because the room is painted *on* it. Before
    // this the floor was a lit rectangle on `NEUTRAL[0]` and nothing else at
    // every headcount, which reads as a UI panel rather than as a building —
    // the largest single gap between this room and its reference material, and
    // the cheapest to close.
    //
    // The ring closed on 2026-08-31. It used to be an L on the two open sides,
    // which is where you can see *past* the building — and the void was never
    // mostly down there. It was above the roofline, in the two upper corners of
    // the frame, which is where the neighbours now stand with their lights on.
    const project: Project = (gx, gy) => {
      const q = gridToScreen(gx, gy)
      return { x: cx + q.x, y: cy + q.y }
    }
    drawDistrict(shell, project, { halfBack, halfAcross })

    /*
     * **The garage's slab is a step darker than the floor's.** §7.8.0c
     * [2026-09-02].
     *
     * The canonical concept is a dark room with warm pools in it — the lamps on
     * the tables and the pendant over the workbench are what you see by, and
     * the concrete between them falls away. At `NEUTRAL[2]` the slab was bright
     * enough that a lamp pool laid on it barely changed the value, so the room
     * came out evenly lit and cool: technically the right hue, and none of the
     * *drama* the reference gets almost entirely from contrast.
     *
     * One step down is the whole change. The pools were already there; what
     * they lacked was something to be brighter than.
     */
    const dim = garage ? 1 : 0
    slab(0, c(RAMPS.NEUTRAL[1 - dim]))
    slab(0.004, c(RAMPS.NEUTRAL[2 - dim]))
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
    const WALL_H = Math.max(34, Math.min(unfolded ? 210 : 112, floorH * 0.48))

    /*
     * §7.8.0b/§7.8.0c — **the garage gets four thick walls; the office floor
     * keeps its two flat planes.**
     *
     * The two branches are the migration in progress rather than a permanent
     * split. The floor's curtain wall, piers, skirting and cornice are a large
     * piece of drawing with nothing wrong with it except that it is two-sided,
     * and moving that onto the shell primitives is Loop 6's business. The
     * garage is the room the canonical concept is *of*, so it goes first.
     *
     * Everything below is in the **shell box's own centred tiles** — the space
     * `nw`/`ww`/`ee`/`ss` are computed in — and goes through the room's one
     * projection. Nothing here is a screen offset.
     */
    nearWall.clear()
    const shellProject: Project = (gx, gy) => {
      const q = gridToScreen(gx, gy)
      return { x: cx + q.x, y: cy + q.y }
    }
    if (garage) {
      // Concrete block. The coping is the lightest surface in the room after a
      // monitor, because it is the one plane facing straight up into §7's key.
      const blockFar: WallPaint = {
        top: RAMPS.NEUTRAL[4],
        left: RAMPS.NEUTRAL[3],
        right: RAMPS.NEUTRAL[2],
      }
      /*
       * **The near wall's faces were too dark to be a wall.**
       *
       * Its coping was `NEUTRAL[5]` and its two faces `[3]` and `[2]`, so
       * against a dark floor the only part of it that read was the lit strip
       * along the top — and a long thin lit strip is a kerb, or a ramp, not a
       * wall you are looking over. The concept's street wall is a *tall lit
       * face* with a thin coping on it, which is the opposite emphasis.
       *
       * The key is unchanged and still §7's: the top is brightest because it
       * faces straight up into it. What changed is the *range* — three steps of
       * the ramp instead of five, so the faces are near enough the top to read
       * as the same object.
       */
      const blockNear: WallPaint = {
        top: RAMPS.NEUTRAL[5],
        left: RAMPS.NEUTRAL[4],
        right: RAMPS.NEUTRAL[3],
      }
      const runs = garageShellRuns(-halfBack, -halfAcross, halfBack, halfAcross)
      const door = runs.find((r) => r.edge === 'near-left')?.openings?.[0]

      /*
       * **Block courses**, and they are not texture. §7.8.0c.
       *
       * The canonical garage's walls are concrete block, and the courses are
       * what make them *concrete block* rather than a grey plane: they give the
       * wall a known unit, so the eye can measure the room's height off it
       * without anything having to be labelled. They are the same idea as the
       * floor's bays one surface up, and they cost one stroke per course.
       *
       * Drawn on the wall's **visible long face**, which is always the box's
       * maximum on its thin axis — for a far wall that is the inner face and
       * for a near wall the outer one. Deriving it rather than listing it per
       * edge is what keeps this from being four almost-identical branches.
       */
      const COURSE = 0.42
      const courses = (into: Graphics, segs: readonly WallSegment[], alongGy: boolean) => {
        for (const seg of segs) {
          for (let z = COURSE; z < seg.h - 0.02; z += COURSE) {
            const at = seg.gz + z
            const a = alongGy
              ? shellProject(seg.gx + seg.w, seg.gy)
              : shellProject(seg.gx, seg.gy + seg.d)
            const b2 = alongGy
              ? shellProject(seg.gx + seg.w, seg.gy + seg.d)
              : shellProject(seg.gx + seg.w, seg.gy + seg.d)
            const lift = at * HEIGHT_UNIT
            into
              .moveTo(a.x, a.y - lift)
              .lineTo(b2.x, b2.y - lift)
              .stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]), alpha: 0.45 })
          }
        }
      }

      // --- the floor: poured concrete, in bays -----------------------------
      //
      // The concept's garage floor is not one pour. It is slabs with joints
      // between them, and the joints are doing more work than they look: they
      // are the **only regular measure** on a floor whose furniture is
      // deliberately irregular, so they are what the eye uses to judge how big
      // the room is and how far apart the pods are. Without them a garage at
      // one developer and a garage at twenty are the same grey field at
      // different zooms.
      //
      // Four bays each way — about the spacing a floor this size is actually
      // poured at, and few enough that the joints read as construction rather
      // than as a tile pattern.
      const BAYS = 4
      for (let i = 1; i < BAYS; i++) {
        const alongGx = -halfBack + (2 * halfBack * i) / BAYS
        const a = shellProject(alongGx, -halfAcross)
        const b = shellProject(alongGx, halfAcross)
        shell
          .moveTo(a.x, a.y)
          .lineTo(b.x, b.y)
          .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]), alpha: 0.5 })
        const alongGy = -halfAcross + (2 * halfAcross * i) / BAYS
        const d = shellProject(-halfBack, alongGy)
        const e = shellProject(halfBack, alongGy)
        shell
          .moveTo(d.x, d.y)
          .lineTo(e.x, e.y)
          .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]), alpha: 0.5 })
      }

      /*
       * **Cables on the floor.** §7.8.0c.
       *
       * The canonical garage has leads snaking across the slab between the
       * pods, and they are doing something none of the furniture can: they are
       * the only object in the room that **crosses** the grain. Everything else
       * — desks, walls, bays, pods — lies on one of the two floor axes, which is
       * what makes the projection read, and is also what makes a floor of them
       * read as a diagram. One line that wanders is what says somebody set this
       * up in a hurry and nobody has tidied since.
       *
       * Drawn as polylines through the projection, so they lie *on* the floor
       * rather than across the picture — the same rule §7.8.1 records about the
       * monitor lead it deleted, which failed because it was a screen-space
       * stroke and came out as a horizontal bar. These are floor-plane paths
       * with several segments, so no leg of one is ever screen-horizontal.
       */
      // One conversion into the plan's frame, shared by the cables, the cracks
      // and the oil stain — all three are marks on the same floor.
      const onPlan = (gx: number, gy: number) => {
        const at = garagePlot(gx, gy)
        return isoAt(at.col, at.row)
      }
      const CABLE_RUNS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
        // From the workbench toward the middle pod, round the back of it.
        [[10.6, 1.4], [9.4, 3.1], [8.4, 4.6], [8.6, 6.2]],
        // From the far-left wall to the long table, the long way.
        [[1.2, 7.4], [2.4, 8.6], [3.2, 9.4]],
        // One that goes nowhere in particular, which is the honest kind.
        [[6.4, 11.6], [7.8, 12.2], [9.6, 11.9], [10.8, 12.6]],
      ]
      for (const run of CABLE_RUNS) {
        const first = onPlan(run[0][0], run[0][1])
        shell.moveTo(first.x, first.y)
        for (let i = 1; i < run.length; i++) {
          const q = onPlan(run[i][0], run[i][1])
          shell.lineTo(q.x, q.y)
        }
        shell.stroke({ width: 2, color: c(RAMPS.NEUTRAL[0]), alpha: 0.7 })
      }

      // --- the expansion seam ----------------------------------------------
      //
      // §7.8.0c's "understated expansion-ready cue", and it is the one thing in
      // the garage drawn in interface cyan rather than in the room's own
      // palette. That is deliberate and it is the whole idea: this is not a
      // thing in the room, it is a **plan for a thing**, surveyed onto the
      // ground outside the wall the studio is about to go through. The concept
      // draws it as a dashed outline with corner brackets, which is what a
      // site plan chalked on a slab looks like, and it is the only moment
      // before the unfold where the game says *there is more building here*.
      //
      // It appears at exactly {@link GARAGE_CAP} and not before, so it is a
      // reward for filling the fifth pod rather than a permanent promise. It is
      // drawn into `shell`, under everything, because it is paint on the
      // ground — §7.1's rule for the coverage layer, one room down.
      if (ordinary >= GARAGE_CAP) {
        const SEAM = c(RAMPS.GLOW[2])
        const y0 = -halfAcross
        const y1 = halfAcross
        const x0 = halfBack + 0.9
        const x1 = halfBack + 8.4
        // A dashed run between two points on the floor. Sampled through the
        // projection rather than dashed on screen: a screen-space dash pattern
        // on an isometric line has a different period on each of the two axes,
        // which reads as two different fences meeting at a corner.
        const dashed = (ax: number, ay: number, bx: number, by: number) => {
          const steps = Math.max(6, Math.round(Math.hypot(bx - ax, by - ay) * 2.2))
          for (let i = 0; i < steps; i += 2) {
            const t0 = i / steps
            const t1 = Math.min(1, (i + 1) / steps)
            const p0 = shellProject(ax + (bx - ax) * t0, ay + (by - ay) * t0)
            const p1 = shellProject(ax + (bx - ax) * t1, ay + (by - ay) * t1)
            shell.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke({ width: 1.5, color: SEAM, alpha: 0.75 })
          }
        }
        dashed(x0, y0, x1, y0)
        dashed(x1, y0, x1, y1)
        dashed(x0, y1, x1, y1)
        dashed(x0, y0, x0, y1)
        // The corner brackets — solid where the outline is dashed, which is how
        // a survey mark differs from a boundary. Four of them, one per corner.
        const BRACKET = 1.5
        for (const [bxc, byc, sx2, sy2] of [
          [x0, y0, 1, 1],
          [x1, y0, -1, 1],
          [x0, y1, 1, -1],
          [x1, y1, -1, -1],
        ] as const) {
          const a = shellProject(bxc + BRACKET * sx2, byc)
          const b = shellProject(bxc, byc)
          const d2 = shellProject(bxc, byc + BRACKET * sy2)
          shell
            .moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .lineTo(d2.x, d2.y)
            .stroke({ width: 2, color: SEAM, alpha: 0.95 })
        }
      }

      /*
       * **Cracks in the pour.** §7.8.0c.
       *
       * The concept's slab is cracked, and the cracks do the same job the bay
       * joints do with the opposite method: the joints are *regular* and give
       * the room a measure, and the cracks are irregular and give it an age. A
       * floor with only joints reads as newly laid, which is the one thing this
       * building is not.
       *
       * Each crack starts on a joint and wanders off it — that is where
       * concrete actually fails — and none of them runs on a floor axis, for
       * the same reason the cables do not: everything else in the room does.
       */
      const CRACKS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
        [[3.5, 3.5], [4.6, 4.9], [5.2, 6.4], [4.8, 7.6]],
        [[10.5, 7.0], [9.4, 8.3], [9.7, 9.9], [8.6, 11.2]],
        [[7.0, 12.4], [8.2, 12.9], [9.1, 13.4]],
      ]
      for (const crack of CRACKS) {
        const first = onPlan(crack[0][0], crack[0][1])
        shell.moveTo(first.x, first.y)
        for (let i = 1; i < crack.length; i++) {
          const q = onPlan(crack[i][0], crack[i][1])
          shell.lineTo(q.x, q.y)
        }
        shell.stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]), alpha: 0.55 })
      }
      // The oil stain, in front of the gate where a car has stood — the one
      // mark that names the room a garage before the door is even read. Drawn
      // here rather than with the slab so it lands in the plan's frame with
      // everything else.
      const oil = onPlan(GARAGE_SPAN / 2, GARAGE_SPAN - 2.6)
      shell.ellipse(oil.x, oil.y, 52, 26).fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.42 })
      shell.ellipse(oil.x + 16, oil.y + 7, 20, 10).fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.3 })

      // --- the driveway ----------------------------------------------------
      //
      // §7.8.1e's thesis, one room down: *draw the ground once and never change
      // what it is.* The district already lays a road round the whole plot; the
      // driveway is the piece that makes the roll-up door mean something by
      // joining the two. A door onto nothing is a hole in a wall.
      //
      // Slightly wider than the opening, because a real apron is — you need
      // room to swing a car in, and the splay is what says a vehicle uses it.
      if (door) {
        /*
         * **Pale stone, not asphalt.** The apron was `NEUTRAL[1]` — the road's
         * own tone — so it was invisible: a driveway the same colour as the
         * carriageway is not a driveway, it is a wider road. The concept lays
         * light paving slabs in front of the gate and the change of material is
         * the whole read.
         *
         * It also stops short of the carriageway now. It ran the full depth to
         * the road before and swallowed the kerb, so the studio appeared to
         * open straight onto the traffic lane.
         */
        isoPatch(
          shell,
          shellProject,
          door.at - 1.1,
          halfAcross,
          door.at + door.width + 1.1,
          halfAcross + 2.4,
          RAMPS.NEUTRAL[3],
        )
        // The paving joints, on the same argument the floor's bays make inside.
        for (let i = 1; i < 3; i++) {
          const gy = halfAcross + (2.4 * i) / 3
          const j0 = shellProject(door.at - 1.1, gy)
          const j1 = shellProject(door.at + door.width + 1.1, gy)
          shell
            .moveTo(j0.x, j0.y)
            .lineTo(j1.x, j1.y)
            .stroke({ width: 1, color: c(RAMPS.NEUTRAL[2]), alpha: 0.6 })
        }
        /*
         * **The kerb**, and it is a solid rather than a line.
         *
         * A stroke was what was here, and a stroke is flat: it marked where the
         * pavement ended without saying that the pavement is *higher than the
         * road*, which is the only thing a kerb is for. A shallow solid along
         * the whole street frontage gives it a lit top and a shadowed face, and
         * that is what separates footway from carriageway at a glance.
         */
        isoSolid(
          shell,
          shellProject,
          -halfBack,
          halfAcross + 2.4,
          0,
          halfBack * 2,
          0.24,
          0.18,
          { top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[1] },
        )
        isoPatch(
          shell,
          shellProject,
          door.at,
          halfAcross - WALL_THICK,
          door.at + door.width,
          halfAcross,
          RAMPS.NEUTRAL[3],
        )
        /*
         * **The car and the lamp**, borrowed from `district.ts` rather than
         * drawn again here.
         *
         * §7.8.1e's rule is that the ground outside is drawn once and never
         * changes what it is, and street furniture is part of that ground. The
         * garage does not own a car; it *parks on* the same apron the district
         * lays, so the two objects come from the one module that knows what a
         * car in this world looks like. Duplicating them here is how the studio
         * ends up with two subtly different cars a hundred pixels apart.
         *
         * Placed the way the canonical concept places them: the car on the
         * apron beside the door rather than in front of it — nobody parks
         * across their own roller shutter — and the lamp at the kerb on the
         * other side, so its pool falls across the threshold. That second light
         * source is what makes the monitors read as *interior*, which is
         * `lamp`'s own note one module over.
         */
        /*
         * **The car is parked on the road, not on the forecourt.**
         *
         * It sat on the apron, which is where you put a car if you are drawing
         * a car and not a street: nobody parks across their own roller shutter,
         * and the concept has it at the kerb with its long axis along the
         * carriageway. `along: 'gx'` is that axis, which is the same one the
         * street wall runs on — so the car lines up with the kerb for free
         * rather than by a number somebody tuned.
         *
         * Offset along the wall so it is beside the gate rather than in front
         * of it: the gate has to be visibly usable, and a car across it says
         * the opposite.
         */
        car(shell, shellProject, door.at - 3.4, halfAcross + 3.1, CAR_BODIES[1], 'gx')
        // The lamp stands on the *footway*, this side of the kerb, so its pool
        // falls across the threshold rather than into the road.
        lamp(shell, shellProject, door.at + door.width + 1.6, halfAcross + 1.5)
      }

      for (const run of runs) {
        const isFar = run.edge === 'far-left' || run.edge === 'far-right'
        const into = isFar ? shell : nearWall
        const segs = drawWallRun(into, shellProject, run, isFar ? blockFar : blockNear)
        courses(into, segs, runsAlongGy(run.edge))
      }
      // The roll-up door, standing in the hole the near-left wall left for it.
      // A shutter is a stack of horizontal slats and nothing else: the
      // corrugation is the whole read, and it is the one surface in the garage
      // with a repeating pattern on it.
      if (door) {
        /*
         * **The shutter is one panel with slats drawn on its face, not seven
         * boxes stacked in Z.**
         *
         * The stack was the first attempt and it failed for a reason worth
         * keeping: each slat is a *solid*, so each one showed its own lit top,
         * and seven lit tops in a row on a wall we already see the top of came
         * out as a striped ramp leaning against the building. The corrugation
         * of a roller shutter is a pattern **on a surface**, not a pile of
         * objects — so it is drawn the way the monitors' code lines are, as
         * marks in the plane of the face.
         *
         * Full height of the wall, because that is what the concept shows and
         * what a door you drive through has to be. There is deliberately no
         * lintel above it (§7.8.0b): this wall is the height of the door.
         */
        const reveal = halfAcross - WALL_THICK * 0.86
        const depth = WALL_THICK * 0.52
        isoSolid(
          nearWall,
          shellProject,
          door.at,
          reveal,
          0,
          door.width,
          depth,
          WALL_NEAR,
          { top: RAMPS.NEUTRAL[6], left: RAMPS.NEUTRAL[5], right: RAMPS.NEUTRAL[3] },
        )
        // The corrugation. Lines across the panel's visible face at a fixed
        // pitch — the one repeating pattern in the garage, and what names the
        // object from across the street.
        const faceGy = reveal + depth
        const SLAT = WALL_NEAR / 9
        for (let i = 1; i < 9; i++) {
          const z = i * SLAT
          const a2 = shellProject(door.at, faceGy)
          const b2 = shellProject(door.at + door.width, faceGy)
          const lift = z * HEIGHT_UNIT
          nearWall
            .moveTo(a2.x, a2.y - lift)
            .lineTo(b2.x, b2.y - lift)
            .stroke({ width: 1, color: c(RAMPS.NEUTRAL[2]), alpha: 0.85 })
        }
        // The guide rails either side, standing proud of the panel.
        for (const side of [door.at - 0.16, door.at + door.width]) {
          isoSolid(
            nearWall,
            shellProject,
            side,
            reveal - 0.06,
            0,
            0.16,
            depth + 0.12,
            WALL_NEAR,
            { top: RAMPS.NEUTRAL[3], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1] },
          )
        }
      }
      // --- the clutter -----------------------------------------------------
      //
      // §7.8.0c's plots, standing on the floor in the **plan's own frame** —
      // `garagePlot` is the single conversion, and it is the whole reason the
      // props are back. Heights and tones per named plot rather than one loop
      // with one box: a workbench, a fridge and a sofa are the same rectangle on
      // the plan and three different objects in the room, and a garage where
      // every prop is the same grey cuboid is a storage unit.
      const planProject: Project = (gx, gy) => {
        const at = garagePlot(gx, gy)
        return isoAt(at.col, at.row)
      }
      garageProps.clear()
      for (const prop of GARAGE_PROPS) drawGarageProp(garageProps, planProject, prop)
      /*
       * **The pendant over the workbench** — the garage's second warm source.
       *
       * §7.8.1's first frame is "a dark home garage, lit only by the monitor",
       * and the lamps on the tables answered that for the desks. The workshop
       * end had nothing, so a third of the room was furniture in the dark. The
       * concept hangs one bulb over the bench, and one bulb is enough: it lights
       * the tool board behind it and throws a pool on the bench, which is what
       * makes that corner a *place somebody works* rather than storage.
       */
      const bench = planProject(11.0, 0.9)
      garageProps.ellipse(bench.x, bench.y + 4, 66, 33).fill({ color: c(RAMPS.WARN[0]), alpha: 0.22 })
      garageProps.ellipse(bench.x, bench.y, 34, 17).fill({ color: c(RAMPS.WARN[1]), alpha: 0.3 })
      garageProps.rect(bench.x - 0.7, bench.y - 92, 1.4, 34).fill(c(RAMPS.NEUTRAL[2]))
      garageProps
        .moveTo(bench.x - 8, bench.y - 58)
        .lineTo(bench.x + 8, bench.y - 58)
        .lineTo(bench.x + 5, bench.y - 66)
        .lineTo(bench.x - 5, bench.y - 66)
        .closePath()
        .fill(c(RAMPS.NEUTRAL[4]))
      garageProps.ellipse(bench.x, bench.y - 56, 4, 2.2).fill(c(RAMPS.WARN[3]))
      /*
       * **Superseded 2026-09-01, kept as the reason the seam above exists.**
       *
       * §7.8.0c's ten prop plots exist, are tested for overlap, and are in the
       * *plan's* coordinates — tiles measured from the garage's own back corner.
       * The shell above is drawn in the **shell box's centred tiles**, and the
       * shell box is not the plan's rectangle: §7.8.12 pins its back corner to
       * `SUITE_WEST_COL`/`SUITE_WALL_ROW` so the executive suite lands in it,
       * which puts the room's origin four columns and three rows away from the
       * plan's.
       *
       * Drawing the props through either projection therefore puts them all on
       * one wall — which was tried, and looked plausible enough at a glance to
       * be worth naming: the workshop props landed against the far wall where
       * they belong, and so did the fridge and the sofa that are authored on the
       * opposite one. A layout that is wrong in a way that reads as right is the
       * worst of the three outcomes.
       *
       * The fix is not a third conversion. It is to make the garage's shell
       * rectangle **be** the plan's rectangle and move the leadership corner
       * into the garage — which is §7.8.0c's own requirement ("a separate
       * improvised corner behind reclaimed glass") and needs §7.8.12 amended,
       * so it is the next slice rather than a line here.
       */
    } else {
      shell
        .moveTo(leftX, leftY)
        .lineTo(topX, topY)
        .lineTo(topX, topY - WALL_H)
        .lineTo(leftX, leftY - WALL_H)
        .closePath()
        .fill(c(unfolded ? RAMPS.NEUTRAL[2] : RAMPS.WOOD[0]))
      shell
        .moveTo(rightX, rightY)
        .lineTo(topX, topY)
        .lineTo(topX, topY - WALL_H)
        .lineTo(rightX, rightY - WALL_H)
        .closePath()
        .fill(c(unfolded ? RAMPS.NEUTRAL[3] : RAMPS.WOOD[1]))
      // The corner seam, so the two planes read as meeting rather than as one
      // folded shape.
      shell
        .moveTo(topX, topY)
        .lineTo(topX, topY - WALL_H)
        .stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]) })
    }

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
    if (!garage) {
      skirt(leftX, leftY, 3)
      skirt(rightX, rightY, 4)
    }

    // --- the plaza ----------------------------------------------------------
    //
    // §7.8.1d. In the transverse corridor between the two rows of squads, which
    // is `CORRIDOR_ROWS` row-steps deep and therefore already 4.2 tiles of
    // floor `gridFor` has never put anything on. **No seat moves for this**,
    // which is the whole reason it is here rather than anywhere else.
    //
    // It does not move as the studio grows, either. Centred on the *floor's*
    // full width rather than on the occupied part, so at a hundred and one
    // developers it is an empty ring on an empty floor — which is honest: the
    // building is built for a thousand and there are a hundred of you.
    //
    // Drawn into `furniture` rather than `shell`: it has to sit above the
    // §7.8.1c plates, whose corridor aprons overlap it, and below the desks and
    // the people, who walk in front of it.
    if (unfolded) {
      // --- the landmarks ---------------------------------------------------
      //
      // §7.8.1e. Everything the plan reserved and did not put a desk on: the
      // meeting rooms and the lift core along the back wall, the kitchenettes
      // and the nooks, the canteen at the street end. Drawn in tiles through
      // the room's own projection, with the seat-unit conversion done here — a
      // module that draws furniture should not also own the table saying how
      // wide a seat is (the same rule that hands `plaza.ts` a torso).
      const floorProject: Project = (gx, gy) => gridToScreen(gx, gy)
      const plots: LandmarkPlot[] = PLAN_AMENITIES.map((a) => ({
        kind: a.kind,
        name: a.name,
        x0: a.minRow * PITCH_ROW,
        y0: a.minCol * PITCH_COL,
        x1: a.maxRow * PITCH_ROW,
        y1: a.maxCol * PITCH_COL,
      }))
      /*
       * §7.8.1e's amenities are plotted on the thousand-seat lattice, which the
       * office floor no longer stands on — drawn anyway they land *outside* the
       * building, scattered across the district like furniture left on a
       * pavement. §7.8.0d has not authored the office's own amenity table yet,
       * so they are withheld rather than drawn in the wrong place: a floor
       * missing its meeting rooms is incomplete, and a floor with its meeting
       * rooms in the road is broken.
       */
      if (!officeShell) drawLandmarks(furniture, floorProject, plots, headcount)

      /*
       * §7.8.0d — **the atrium is where the plan says, not where §7.8.1e's
       * thousand-seat floor put it.** The concept makes this the centre of the
       * building at about a third of its width, and every desk on the floor is
       * arranged around it; `office.ts` is the only table that knows where that
       * is, so the plaza reads it rather than keeping a second copy.
       */
      const atriumAt = officeShell ? garagePlot(ATRIUM.gx, ATRIUM.gy) : null
      const plazaCol = atriumAt ? atriumAt.col : PLAN_PLAZA.col
      const plazaRow = atriumAt ? atriumAt.row : PLAN_PLAZA.row
      const base = isoAt(plazaCol, plazaRow)
      const plazaProject: Project = (gx, gy) => {
        const q = gridToScreen(gx, gy)
        return { x: base.x + q.x, y: base.y + q.y }
      }
      const shape = torsoShape(founderLook(founderProfile))
      drawPlaza(furniture, plazaProject, {
        cx: 0,
        cy: 0,
        rung: statueRung(headcount),
        torso: {
          w: (shape.w / TILE_W) * STATUE_SCALE,
          h: (shape.h / HEIGHT_UNIT) * STATUE_SCALE,
        },
      })
    }

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
    if (!garage) {
      cornice(leftX, leftY - WALL_H, 3)
      cornice(rightX, rightY - WALL_H, 4)
    }

    /** Filled by the curtain wall below; empty in a garage, which has none. */
    let officePiers: { x: number; y: number; slope: number }[] = []

    // --- the curtain wall ---------------------------------------------------
    //
    // **The floor is inside the building you were just looking at.**
    //
    // The tower at §7.4's Building level is a glass slab, and its windows are
    // the one thing on it carrying information — five bays a face, one per
    // squad, lit by the monitors of the people underneath. Descend into a
    // storey and the same wall had no windows at all: two flat grey planes with
    // a skirting and a cornice. The floor did not read as being *in* anything,
    // and the two levels of one continuous zoom disagreed about what the
    // building was made of.
    //
    // So the same construction, seen from the other side. Precast spandrel up
    // to the sill, a glazing ribbon to the head, a transom rail across it, and
    // mullions drawn the way the tower draws them: the frame is laid down whole
    // and the panes go on top, so the gaps between them *are* the grid.
    //
    // **The glass is not shaded by wall.** Every other surface in here takes
    // the room's key — right wall lighter, left wall darker — and the glass
    // deliberately does not, because what you can see through it is outside
    // and outside does not care which wall it is in. The mullions carry the
    // lighting; the panes are the same night on both.
    //
    // What is out there is other towers. The dots are the exact thing the
    // player was looking at one level up — a lit window with a squad behind it
    // — at the size that level renders them, which is the whole joke of §7.2's
    // continuous zoom told without a word: the studio is one of these.
    //
    // Garages keep their brick and their two UPVC windows; see below.
    if (unfolded) {
      /** Sill, head and transom, as heights above the wall's own base. */
      const SILL = SKIRT_H + WALL_H * 0.15
      const HEAD = WALL_H - CORNICE_H - WALL_H * 0.03
      const TRANSOM = SILL + (HEAD - SILL) * 0.74
      /**
       * One window module, in room units — about two desks.
       *
       * Derived per wall from the wall's own run rather than fixed per side.
       * The floor is five squads across and two deep and the two axes are not
       * pitched alike, so a bay count that is right for the long wall leaves
       * the short one with panes half as wide again. A facade has one module.
       */
      const PANE_UNITS = TILE_W * 1.7

      /** Deterministic, so the city does not rearrange itself on every hire. */
      const spark = (a: number, b: number, k: number) => {
        const h = Math.sin(a * 12.9898 + b * 78.233 + k * 37.719) * 43758.5453
        return h - Math.floor(h)
      }

      /**
       * Every rail is a fraction of the wall, never a pixel count.
       *
       * The first pass inset the panes by "2" and made the transom "2" tall,
       * which is two *room* units — and at Floor zoom the room draws at about
       * 0.19, so both were four tenths of a screen pixel and neither existed.
       * A wall forty pixels tall needs its rails measured against the wall.
       */
      const RAIL = Math.max(1, WALL_H * 0.028)

      /**
       * Where a solid module interrupts the glazing — and the only place in
       * this room anything may be hung.
       *
       * **Nothing gets stuck on a window.** The wall dressing sat at fractions
       * of the wall's run, which was right while the wall was brick; over a
       * curtain wall it put a whiteboard and three posters flat across the
       * glass, taped to the view. A tower this size has columns in its facade,
       * so every fifth module is a pier instead of a pane — architecture that
       * was going to be there anyway, doing the job of giving the office
       * somewhere to hang things.
       */
      const piers: { x: number; y: number; slope: number }[] = []
      /** The floor in front of a glazing bay — §7.8.9's window errand. */
      const glazedSpots: { x: number; y: number }[] = []

      const glaze = (
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        wall: number,
        side: number,
        slope: number,
      ) => {
        const run = toX - fromX
        const rise = toY - fromY
        const at = (t: number) => ({ x: fromX + run * t, y: fromY + rise * t })
        const band = (t0: number, t1: number, h0: number, h1: number, fill: string, alpha = 1) => {
          const a = at(t0)
          const b = at(t1)
          shell
            .moveTo(a.x, a.y - h0)
            .lineTo(b.x, b.y - h0)
            .lineTo(b.x, b.y - h1)
            .lineTo(a.x, a.y - h1)
            .closePath()
            .fill({ color: c(fill), alpha })
        }

        // Spandrel, then the mullion grid laid down whole.
        band(0, 1, SKIRT_H, SILL, RAMPS.NEUTRAL[wall + 1])
        band(0, 1, SILL, HEAD, RAMPS.NEUTRAL[wall + 2])

        const panes = Math.max(3, Math.round(Math.abs(run) / PANE_UNITS))
        const gap = 0.17 / panes
        for (let i = 0; i < panes; i++) {
          const t0 = i / panes + gap
          const t1 = (i + 1) / panes - gap

          // A pier: the wall's own material, floor to ceiling, and a place to
          // hang a whiteboard that is not the view.
          if (i % 5 === 2) {
            band(t0 - gap, t1 + gap, SKIRT_H, HEAD, RAMPS.NEUTRAL[wall])
            band(t0 - gap, t1 + gap, HEAD - RAIL * 0.7, HEAD, RAMPS.NEUTRAL[0], 0.5)
            piers.push({ ...at((t0 + t1) / 2), slope })
            continue
          }

          // §7.8.9 — somewhere to stand and look out. **The open floor has
          // always had windows**; what it did not have was anywhere to stand at
          // one. One bay in five is enough: a spot at every pane would put forty
          // standing places round a room that is meant to have people in the
          // middle of it, and the errand only ever needs a handful.
          //
          // No `continue` — a bay somebody stands at is still a window, and must
          // still be glazed by the code below.
          if (i % 5 === 0) glazedSpots.push(at((t0 + t1) / 2))

          /*
           * **The glass is `GLOW[0]`, not `NEUTRAL[1]`.**
           *
           * Painted in the darkest neutral it was not dark glass, it was an
           * absence: the wall read as a colonnade of piers with the night
           * showing between them, which is a car park. Glass at night is not
           * black, it is a very dark blue — and the palette has exactly one,
           * the bottom of the ramp the monitors and the tower's lit windows are
           * already drawn from. So the thing you are looking through belongs to
           * the same family as the thing you were looking at.
           */
          band(t0, t1, SILL + RAIL, HEAD - RAIL, RAMPS.GLOW[0])

          // The room, reflected in the top of its own window. This is the tell
          // that turns a dark rectangle into glass, and it costs one band: at
          // night you see the ceiling before you see the city.
          band(t0, t1, HEAD - (HEAD - SILL) * 0.34, HEAD - RAIL, RAMPS.NEUTRAL[wall + 2], 0.28)

          // The city. Two or three windows of somebody else's building, and
          // never more — a pane packed with lights reads as a screen, and this
          // one is a hole in the wall.
          const lights = Math.floor(spark(side, i, 0) * 3)
          for (let n = 0; n < lights; n++) {
            const p = at(t0 + (t1 - t0) * (0.15 + 0.7 * spark(side, i, n + 1)))
            const h = SILL + (HEAD - SILL) * (0.12 + 0.62 * spark(side, i, n + 5))
            shell
              .rect(p.x - RAIL * 0.6, p.y - h, RAIL * 1.6, RAIL)
              .fill(c(spark(side, i, n + 9) < 0.18 ? RAMPS.WARN[2] : RAMPS.GLOW[2]))
          }
        }

        // The transom, over the glass rather than between the panes: from in
        // here the rail is the nearest thing in the wall and everything it
        // crosses is behind it.
        band(0, 1, TRANSOM - RAIL / 2, TRANSOM + RAIL / 2, RAMPS.NEUTRAL[wall + 2])

        // The rules that actually read at a distance — a lit edge on the sill
        // and the head's own shadow under the cornice.
        band(0, 1, SILL, SILL + RAIL * 0.7, RAMPS.NEUTRAL[wall + 3])
        band(0, 1, HEAD - RAIL * 0.7, HEAD, RAMPS.NEUTRAL[0], 0.55)
      }

      glaze(leftX, leftY, topX, topY, 2, 0, -WALL_SLOPE)
      glaze(topX, topY, rightX, rightY, 3, 1, WALL_SLOPE)
      officePiers = piers
      for (const g of glazedSpots) spots.window.push(standingSpot(g.x, g.y))
    }

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
            .moveTo(leftX, leftY - bedTop)
            .lineTo(topX, topY - bedTop)
            .stroke({ width: 1, color: c(RAMPS.NEUTRAL[5]), alpha: 0.4 })
        }
        // Vertical joints, offset half a brick on every second course. Each joint
        // runs the full height of its own course, bed to bed, so nothing
        // overshoots or falls short of the wall.
        const offset = (i % 2) * brickW * 0.5
        for (let x = leftX + offset; x < topX; x += brickW) {
          const bx = leftY - (x - leftX) * WALL_SLOPE
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
        topX + eastW * 0.3,
        topY + eastH * 0.3,
        topX + eastW * 0.7,
        topY + eastH * 0.7,
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
      for (const along of [0.25, 0.65]) {
        const wx = topX - westW * along
        const wy = topY + westH * along
        drawWindow(shell, wx, wy - WALL_H * 0.75, WIN_W, WIN_H, -WALL_SLOPE)
        // §7.8.9 — somewhere to stand and look out of it. The garage's two
        // casements are high on the wall and that is fine: the errand is
        // "staring out of the window", and staring upward at a garage window is
        // if anything the bleaker read.
        spots.window.push(standingSpot(wx, wy))
      }

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

    if (officePiers.length > 0) {
      /*
       * **On the piers, or not at all.** The open floor's back walls are glass
       * and glass carries nothing; the solid modules the curtain wall leaves
       * are the whole of the hanging space, so the dressing takes them in turn
       * and anything past the last one simply does not go up. That is the right
       * failure: a studio with more posters than wall has more posters than
       * wall.
       *
       * The order is the order they were earned, so the whiteboard the player
       * has had since three developers keeps the first pier it is given.
       */
      let slot = 0
      const hang = (draw: (p: { x: number; y: number; slope: number }) => void) => {
        const pier = officePiers[slot]
        if (!pier) return
        slot += 1
        draw(pier)
      }
      if (props.whiteboard) {
        hang((p) => {
          // §7.8.9 — a board is a destination as well as dressing, and this is
          // the one prop the huddle needs. The spot is the floor in front of
          // the pier, not the pier: people stand at a whiteboard, not in it.
          spots.whiteboard.push(standingSpot(p.x, p.y))
          drawWhiteboard(shell, p.x, p.y - WALL_H * 0.62, 3, p.slope)
        })
      }
      if (props.whiteboardRight) {
        hang((p) => {
          spots.whiteboard.push(standingSpot(p.x, p.y))
          drawWhiteboard(shell, p.x, p.y - WALL_H * 0.62, 17, p.slope)
        })
      }
      for (let i = 0; i < props.posters; i++) {
        hang((p) => drawPoster(shell, p.x, p.y - WALL_H * 0.5, i, p.slope))
      }
    } else {
      if (props.whiteboard) {
        drawWhiteboard(
          shell,
          topX - westW * 0.42,
          topY + westH * 0.42 - WALL_H * 0.66,
          3,
          -WALL_SLOPE,
        )
        spots.whiteboard.push(standingSpot(topX - westW * 0.42, topY + westH * 0.42))
      }
      if (props.whiteboardRight) {
        // Tucked into the corner beside the centred garage door, not over it.
        drawWhiteboard(shell, topX + eastW * 0.16, topY + eastH * 0.16 - WALL_H * 0.62, 17, WALL_SLOPE)
        spots.whiteboard.push(standingSpot(topX + eastW * 0.16, topY + eastH * 0.16))
      }
      for (let i = 0; i < props.posters; i++) {
        // Alternating walls, marching outward from the corner so a second poster
        // never lands on the first.
        const left = i % 2 === 0
        const along = 0.18 + Math.floor(i / 2) * 0.3
        const px = left ? topX - westW * along : topX + eastW * along
        // Follows the wall down from the corner — `along` is a fraction of the
        // wall's run, so the drop is the same fraction of its rise.
        const py = topY + (left ? westH : eastH) * along - WALL_H * (0.5 - (i % 3) * 0.08)
        drawPoster(shell, px, py, i, left ? -WALL_SLOPE : WALL_SLOPE)
      }
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
          spots.water.push(standingSpot(x, y))
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
          spots.water.push(standingSpot(x, y))
          drawCoffee(furniture, x, y)
        },
      })
    if (props.waterCooler)
      ring.push({
        w: 15,
        draw: (x, y) => {
          spots.water.push(standingSpot(x, y))
          drawWaterCooler(furniture, x, y)
        },
      })
    if (props.filingCabinet) ring.push({ w: 18, draw: (x, y) => drawFilingCabinet(furniture, x, y) })
    if (props.printer) ring.push({ w: 22, draw: (x, y) => drawPrinter(furniture, x, y) })
    if (props.sofa)
      ring.push({
        w: 46,
        draw: (x, y) => {
          // §7.8.9's longest errand. The sofa is breakout seating and the first
          // real furniture §7.8.1's crowding sacrifices, so it is a destination
          // that a growing studio *loses* — which is the correct joke and needs
          // no extra code, because `errands.ts` falls back to the desk aisle.
          spots.sofa.push(standingSpot(x, y))
          drawSofa(furniture, x, y)
        },
      })
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
      const at = wallSpot(wall, u, cx, cy, halfBack, ring[i].w / TILE_W, halfAcross)
      ring[i].draw(at.x, at.y, wall === 'left' ? -WALL_SLOPE : WALL_SLOPE)
    }

    if (props.serverRack) {
      // Against the back-right wall by the corner, where a rack goes: it is the
      // one thing in the room that wants a wall behind it, it is never in
      // anybody's way there, and it does not move as the dressing around it
      // comes and goes.
      const at = wallSpot('right', 0.08, cx, cy, halfBack, 24 / TILE_W, halfAcross)
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
    // One per **bank**, not per hundred: §7.8.1e's blocks are between forty-eight
    // and a hundred and ninety-three seats, so the count comes from the plan.
    const squadsUsed = garage
      ? ordinary === 0
        ? 0
        : Math.floor((ordinary - 1) / POD_SEATS) + 1
      : officeShell
        ? podsUsedFor(ordinary)
        : n === 0
          ? 0
          : planSeat(n - 1).block + 1
    while (squadDesks.length < squadsUsed) {
      const g = new Graphics()
      squadDesks.push(g)
      deskLayer.addChild(g)
    }
    while (frontDesks.length < squadsUsed) {
      const g = new Graphics()
      frontDesks.push(g)
      frontDeskLayer.addChild(g)
    }
    for (const g of squadDesks) g.clear()
    for (const g of frontDesks) g.clear()

    // §7.8.1 — **the bank first, then the kit on it.** Consecutive seats that
    // share a squad and a row are one run of desks and are drawn as one shape;
    // see `drawDeskBank` for why ten separate diamonds were the diagonal the
    // rows appeared to have.
    //
    // Two passes, and the split is load-bearing rather than tidy: a bank has to
    // be under the screens standing on it, so every seat's position must be
    // known before the first shape is drawn. Computing and drawing in one loop
    // put each row's surface on top of its own monitors.
    // §7.8.12 — **the first plot of row 0 is the suite's threshold, not a seat.**
    // James is the studio's seat 0 and is drawn at his desk inside the glass, so
    // the plot the reading order would have given him is left bare: it sits at
    // the head of row 0 directly outside the door, which is the one place on this
    // floor that should have nobody sitting in it. See {@link SUITE_SEATS}.
    //
    // Only in the studio's own window. §26.2.2's block 50 has no suite in it and
    // its local seat 0 is an ordinary developer, so the floor there is whole.
    const held = suiteSeats()
    // One resolver, so a seat the suite holds is recorded at its real desk
    // rather than at the lattice plot the reading order would have given it.
    for (let i = 0; i < n; i++) desks.push(drawnSeatPosition(i, windowFrom, garage))
    // The plan already knows which seats form a continuous bank — that is what
    // a run *is* — so the run-detection loop that used to be here (walk forward
    // until a seat's column is zero again) is gone. It only ever worked because
    // every row was exactly ten wide.
    if (garage) {
      // §7.8.0c — **one table per pod, and it is between the people rather than
      // behind them.** A facing pod's surface is drawn once at the pod's centre
      // with no setback and twice the depth of a floor bank, which is what two
      // desks pushed together actually is. Drawing it as two single banks left
      // a hairline down the middle of every table where the two shadows met.
      for (let podIndex = 0; podIndex < squadsUsed; podIndex++) {
        const pod = GARAGE_PODS[podIndex]
        // **Through `garagePlot`, like everything else on this plan.** This was
        // the one call site left in the plan's raw tiles after §7.8.0c gave the
        // two frames a single origin — so the five tables were drawn three
        // tiles from the people sitting at them, and the pods came out as
        // twenty developers and their monitors floating on bare concrete. The
        // seats went through the conversion, the lamp went through it, and the
        // surface they both stand on did not.
        const at = garagePlot(pod.gx, pod.gy)
        const half = POD_STRIDE / 2
        drawDeskBank(
          squadDesks[podIndex],
          at.col - half,
          at.col + half,
          at.row,
          POD_TABLE_DEPTH,
          0,
        )
      }
    } else if (officeShell) {
      // §7.8.0d — the same furniture as the garage at a different scale: one
      // table per pod, drawn once between the two rows rather than as two banks.
      for (let podIndex = 0; podIndex < squadsUsed; podIndex++) {
        const pod = OFFICE_PODS[podIndex]
        const half = (pod.perSide * POD_STRIDE) / 2
        const at = garagePlot(pod.gx, pod.gy)
        drawDeskBank(
          squadDesks[podIndex],
          at.col - half + POD_STRIDE / 2,
          at.col + half - POD_STRIDE / 2,
          at.row,
          POD_TABLE_DEPTH,
          0,
        )
      }
      // §7.8.0d's amenities, in the plan's own frame — the same single
      // conversion the pods and the garage's clutter go through.
      const officeProject: Project = (gx, gy) => {
        const q = garagePlot(gx, gy)
        return isoAt(q.col, q.row)
      }
      for (const a of OFFICE_AMENITIES) drawOfficeAmenity(furniture, officeProject, a)
    } else {
      for (const { run, len } of occupiedRuns(n)) {
        const skip = Math.max(0, held - run.from)
        if (skip >= len) continue
        drawDeskBank(squadDesks[run.block], run.col + skip, run.col + len - 1, run.row)
      }
    }

    for (let i = held; i < n; i++) {
      const { x, y } = desks[i]
      if (garage) {
        // The far side of every table is turned round to face across it, which
        // is what a pod *is*. No dividers and no cable tray: both belong to a
        // bank of desks all pointing the same way, and a panel down the middle
        // of a facing pod is a wall between four people who were put together
        // on purpose.
        const seatInPod = garageSeat(i - held)
        const toCamera = seatInPod.facing === 'gx+'
        // A chair only where one can be seen — behind somebody facing you.
        if (toCamera) drawChair(squadDesks[seatInPod.pod], x, y)
        drawWorkstation(
          toCamera ? frontDesks[seatInPod.pod] : squadDesks[seatInPod.pod],
          x,
          y,
          i,
          toCamera ? -1 : 1,
        )
        continue
      }
      if (officeShell && i - held < OFFICE_SEATS) {
        const o = officeSeat(i - held)
        const toCamera = o.facing === 'gx+'
        if (toCamera) drawChair(squadDesks[o.pod], x, y)
        drawWorkstation(
          toCamera ? frontDesks[o.pod] : squadDesks[o.pod],
          x,
          y,
          i,
          toCamera ? -1 : 1,
        )
        continue
      }
      const place = planSeat(i)
      const g = squadDesks[place.block]

      // A divider needs a neighbour to divide from, and the plan says exactly
      // when there is one: the next seat along the same *run*. At a run's end
      // the next seat is across an aisle or in another bank entirely, and a
      // panel standing in an aisle is a barricade. This used to test the column
      // against `SQUAD_COLS`, which was the same question only while every run
      // was ten desks long.
      if (props.dividers && place.inRun < place.runLen - 1 && i + 1 < n) {
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

    /*
     * §7.8.0c — **the lamps go on last.**
     *
     * They were drawn with the table, at the top of the pod loop, and then the
     * workstations were painted into the same `Graphics` afterwards and covered
     * them: within one layer the later call wins regardless of where the object
     * stands. So a pod had a lamp nobody could see, which is the same as not
     * having one.
     *
     * Last within the desk layer is the right place rather than a later layer:
     * the lamp stands on the table between the two rows, so it belongs above
     * the kit and below the people.
     */
    if (garage || officeShell) {
      const lampPods = garage
        ? GARAGE_PODS.slice(0, squadsUsed).map((pod) => garagePlot(pod.gx, pod.gy))
        : OFFICE_PODS.slice(0, squadsUsed).map((pod) => garagePlot(pod.gx, pod.gy))
      lampPods.forEach((at, i) => {
        drawPodLamp(squadDesks[i], (lx, ly) => isoAt(at.col + ly, at.row + lx), 0, 0, DESK_H)
      })
    }

    // §7.8.10 — one non-row workstation, held outside the reading order and
    // turned across it. It is redrawn only on hire, like every other desk.
    const founderAt = founderDeskPosition()
    drawFounderWorkstation(managerDesk, founderAt.x, founderAt.y)
    founder.position.set(founderAt.x, founderAt.y + 6)

    // Reuse developer containers across rebuilds — a hire should not rebuild
    // ninety-nine sprites that did not change.
    while (devs.length < n) {
      // §7.8.7 — `developerAt` pins seat 0 to James rather than generating one.
      // (This comment said "index 1" until 2026-08-26; `identity.ts` moved him
      // to seat 0 when §21.0b made him the first developer and this line was
      // not moved with it.) Containers are reused
      // across rebuilds, so a developer's look is fixed at the moment their
      // seat first exists and never churns underneath them.
      const d = buildDeveloper(developerAt(seed, windowFrom + devs.length).look)
      devs.push(d)
      jolts.push(0)
      devLayer.addChild(d)
    }
    for (let i = 0; i < devs.length; i++) {
      // A seat the suite holds has its body drawn by the suite, not by the
      // floor. Drawing it here as well is the same person twice, once per layer.
      const visible = i < n && i >= held
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
    // **All ten, or none.** A floor is five squads by two whatever the
    // headcount, and the empty ones are drawn bare — that is what makes hiring
    // read as the floor *filling up* rather than as the room being rebuilt one
    // squad wider. Rebuilding the plates on every hundredth hire was also a
    // second reason the camera's fit moved under the player.
    const squadsNeeded = unfolded ? PLAN_PLATES.length : 0
    if (squadsNeeded > panels.length) {
      for (const p of panels) p.root.destroy({ children: true })
      panels.length = 0
      plates.removeChildren()
      buildPanels()
    }
    if (unfolded) applyUnfold(unfoldT)
    // §7.8.1d — **which plate the next hire lands on.**
    //
    // §7.8.1b has always promised that hire *n* takes the next seat in the
    // current row, and nothing on screen has ever said which row that is. This
    // is the cheapest possible answer: the plate that is filling — or, when the
    // last one came out exactly square, the empty plate that is about to — wears
    // the warning ramp on its lip instead of the neutral. It reads from across
    // the floor and it costs a tint.
    // It is one *island* now rather than one plate in ten — six desks in a
    // cluster bank, or one pair of a spine — which says where the next hire
    // lands far more precisely than a hundred-seat rectangle ever did.
    const nextPlate = plateOfSeat(n)
    for (const [idx, panel] of panels.entries()) {
      /*
       * **An empty bay is not a desking bay.**
       *
       * Every plate used to be the same board colour whether or not anybody was
       * on it, so a studio of three hundred stood in the corner of a brown plain
       * the size of a thousand — which is the picture §7.8.1c's own note calls
       * "a clump in the corner of an empty brown plane" and thought it had
       * fixed. It had fixed the *count*; this fixes the reading.
       *
       * A fitted-out bay is board. An unfitted one is the slab it is going to be
       * built on, with its lip still drawn — so the floor plan is visible and
       * the floor is honestly empty. The building is built for a thousand and
       * there are three hundred of you, and now you can see both facts at once
       * instead of one of them.
       */
      const fitted = n > PLAN_PLATES[idx].from
      panel.base.tint = c(fitted ? RAMPS.WOOD[0] : RAMPS.NEUTRAL[2])
      panel.lip.tint = c(
        idx === nextPlate ? RAMPS.WARN[1] : fitted ? RAMPS.NEUTRAL[3] : RAMPS.NEUTRAL[2],
      )
    }

    // The camera fit reads this every frame (§23.4.1), so the room growing is
    // also the camera pulling back — without anyone driving Z.
    // The camera fit reads these, so they must describe the *drawn* bounds:
    // floor plus the walls standing behind it, and a pivot at the true centre
    // of that box rather than at the floor's centre. Pivoting on the floor
    // pushes the whole room down the frame by half a wall.
    const pad = districtPad(halfBack, halfAcross)
    /*
     * §7.8.1 [amended 2026-09-01] — **the walls are fixed and the frame is not.**
     *
     * §7.8.0c's garage does not grow: it is a building somebody already owns and
     * its walls do not move when you hire somebody. But the *camera* still has
     * to, and the first version of that section forgot to say so in code — it
     * framed the whole fourteen-tile shell at every headcount, so at nought
     * developers the founder was drawn about a third of their proper size and
     * `test:walk` could not find a single pokeable point on the canvas.
     *
     * That is the failure §7.8.1's growth curve exists to prevent, arriving by a
     * different route, and it is a hard requirement rather than a preference:
     * §7.7.4's Hero Anchor and the mobile tap target both need the founder to be
     * a real object at one developer.
     *
     * So the frame covers **the back corner and the pods that exist**, and
     * widens as they fill. The props are scenery the frame reaches on its way
     * out rather than content it has to contain — and it does reach them: at
     * twenty the last pod plus this margin already encloses every one of them,
     * which is checked by arithmetic rather than hoped for.
     */
    let fitW = floorW
    let fitH = floorH
    let fitCx = cx
    let fitCy = cy
    if (garage) {
      const seen = garageExtentFor(ordinary)
      const far = garagePlot(seen.maxGx, seen.maxGy)
      const reach = Math.min(shellMaxCol, far.col + 1.6)
      /*
       * **Once the room is full, the frame takes in the street it opens onto.**
       *
       * The canonical concept puts the driveway, the parked car and the street
       * lamp in shot at the bottom-left, and they are a real part of the
       * composition — the lamp is the second light source that makes the
       * monitors read as *interior*. But the apron is outside the near wall, so
       * a frame fitted to the room alone crops all three.
       *
       * Widening unconditionally is not the answer: that is exactly what shrank
       * the founder below the tap target at nought developers. So the frame
       * reaches out over the apron **only once the pods have grown to within
       * two columns of the near wall**, which is late in the garage's life and
       * is its own small beat — the studio fills the room, and the picture pulls
       * back far enough to show you what it is about to spill into.
       */
      /*
       * **The street is shown by widening the frame, not by extending the box
       * on one side.**
       *
       * Extending `maxCol` was the first two attempts, at 3.4 columns and then
       * 2.0, and both were wrong in the same way: the apron is on one side
       * only, so adding it moves the frame's *centre* as well as its width. The
       * room slid into the top-right corner with a quarter of the picture given
       * to empty road, and the far wall clipped against the right edge.
       *
       * The concept does something simpler. The garage is centred and fills
       * about four fifths of the frame, and the remaining fifth is street on
       * *every* side — which is what the district already draws. So the fit
       * stays centred on the room and simply zooms out a little once the studio
       * has filled it.
       */
      const OUTSIDE = 1.18
      const spilling = reach >= shellMaxCol - 2
      const framed = blockBox(
        shellMinCol,
        shellMinRow,
        reach,
        Math.min(shellMaxRow, far.row + 0.9),
      )
      const zoomOut = spilling ? OUTSIDE : 1
      fitW = ((framed.maxX - framed.minX) / 2) * zoomOut
      fitH = ((framed.maxY - framed.minY) / 2) * zoomOut
      fitCx = (framed.minX + framed.maxX) / 2
      fitCy = (framed.minY + framed.maxY) / 2
    }
    foldedFit.w = fitW * 2 + ROOM_CONTENT_PAD_X + pad.x
    foldedFit.h = fitH * 2 + WALL_H + ROOM_CONTENT_PAD_Y + pad.y
    // Biased toward the north corner — the founder and the walls that rise
    // behind it — rather than the true centre of the bounding box. Centring
    // geometrically drops the people low in frame under a slab of empty floor,
    // and biasing the other way (toward the desks) buried the cornice and the
    // windows under the top edge of the frame. Half a wall is the balance.
    foldedFit.px = fitCx
    foldedFit.py = fitCy - WALL_H * 0.5 + pad.y * (0.5 - SKYLINE_SHARE)
    if (unfolded) {
      /*
       * §7.8.0d — **the office fits its own shell, not §7.8.1e's.**
       *
       * `floorBox` measures the thousand-seat lattice's occupied squads, and a
       * hundred people on the new plan occupy none of them — so the frame came
       * out sized for a building ten times larger with the studio pushed into
       * one corner of it. The office's shell rectangle is the honest extent,
       * the same way the garage's is.
       */
      const f = officeShell
        ? blockBox(shellMinCol, shellMinRow, shellMaxCol, shellMaxRow)
        : floorBox(squadsUsed)
      openFit.w = f.maxX - f.minX + ROOM_CONTENT_PAD_X + pad.x
      // The walls stand *above* the floor's north corner, so they are height
      // the frame has to find rather than scenery it can crop: a room whose
      // cornice is cut off by the top edge reads as a mistake, not as a camera
      // move. They cost about seven per cent of the fill and buy the fact that
      // this is a room.
      openFit.h = f.maxY - f.minY + WALL_H + ROOM_CONTENT_PAD_Y + pad.y
      openFit.px = (f.minX + f.maxX) / 2
      openFit.py = (f.minY + f.maxY) / 2 - WALL_H * 0.5 + pad.y * (0.5 - SKYLINE_SHARE)
    }
    // §7.8.12 — once the walls arrive, the resting frame includes the room
    // they made. This is a union with the existing composition, not a new
    // camera target, so the rank and file remain the subject and the suite
    // reads as deliberately off to the corner.
    includeTeamInFit(foldedFit)
    if (unfolded) includeTeamInFit(openFit)
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
  function floorBox(_squadsUsed: number) {
    // **Fixed.** See FLOOR_MIN_COL. The room is the same rectangle whatever the
    // headcount, so the camera's fit is a constant and hiring can never
    // re-frame the picture — which it did, on every single hire.
    return blockBox(FLOOR_MIN_COL, FLOOR_MIN_ROW, FLOOR_MAX_COL, FLOOR_MAX_ROW)
  }

  /**
   * One plate, as a polygon in the seat grid's own axes — §7.8.1e.
   *
   * **Not a rectangle, and not a diamond either.** The diamond went first, for
   * `floorBox`'s reason: a diamond that contains a 2:1 block of desks is twice
   * its width, so the people ended up in a clump in the middle of a slab. The
   * rectangle went on 2026-08-31, and the argument is the same one a scale up:
   * ten identical rectangles on a regular grid were the largest shapes in the
   * frame and they were all the same shape, which is half of why a thousand
   * developers read as a parade ground.
   *
   * `floorplan.ts` builds the outline to follow the desks that are actually on
   * it — a staircase down a ragged bank, a small square round an island of six,
   * a long thin pair for a spine — and every edge of it lies on a floor axis,
   * which `floorplan.test.ts` asserts before anything is ever drawn.
   */
  function platePath(g: Graphics, points: ReadonlyArray<readonly [number, number]>) {
    const first = isoAt(points[0][0], points[0][1])
    g.moveTo(first.x, first.y)
    for (let i = 1; i < points.length; i++) {
      const q = isoAt(points[i][0], points[i][1])
      g.lineTo(q.x, q.y)
    }
    g.closePath()
  }

  /**
   * Build one floor plate per island of desks — §7.8.1c.
   *
   * It built all hundred, every time, whatever the headcount. At a hundred
   * developers that is one squad of people standing in the middle of ninety-nine
   * empty plates, and because `scene.extentOf('room')` measures what is drawn,
   * §23.4.1 then framed *those* — so the studio was a clump in the corner of an
   * empty brown plane, and every complaint about the room at that headcount
   * starts there. It is the whole plan now, all at once, for the reason below.
   *
   * **The corridor apron is gone**, and it is not a loss. Each plate used to
   * carry a lighter surround so that the plates would tile with no gaps — the
   * corridor had to be *drawn*, because a hole between two plates showed the
   * background through the floor. The plan's holes are real now and there are
   * many more of them, so the hallway is simply the slab: one fill, already
   * there, already the lighter value, and it cannot fall out of step with the
   * plates because it is not made of them.
   */
  function buildPanels() {
    for (const plate of PLAN_PLATES) {
      // Drawn white and tinted per rebuild, like the lip below and for the same
      // reason: this function runs once for every plate on the floor, and what
      // colour a plate is depends on whether anybody is sitting on it yet.
      const base = new Graphics()
      platePath(base, plate.points)
      base.fill(0xffffff)

      // The plate's own edge, so a bank reads as a plate rather than as a
      // region of one continuous floor.
      //
      // Its own `Graphics`, drawn white and **tinted** per rebuild: this
      // function runs once for every plate on the floor (see `squadsNeeded` —
      // all of them, or none), so a colour baked in here could never follow the
      // headcount, and §7.8.1d's next-hire marker has to.
      const lip = new Graphics()
      platePath(lip, plate.points)
      lip.stroke({ width: 2, color: 0xffffff })
      lip.tint = c(RAMPS.NEUTRAL[2])

      const sheen = new Graphics()
      platePath(sheen, plate.points)
      sheen.fill(c(RAMPS.GLOW[1]))
      sheen.alpha = 0

      const holder = new Container()
      holder.addChild(base, lip, sheen)
      // Hinged on the corner facing the origin, so the panel swings out of its
      // neighbour rather than growing out of its own middle. Pivot and position
      // are the same point because the geometry is drawn in room coordinates —
      // the panel does not move, it opens.
      const hinge = isoAt(plate.hinge[0], plate.hinge[1])
      holder.pivot.set(hinge.x, hinge.y)
      holder.position.set(hinge.x, hinge.y)
      panels.push({ root: holder, base, lip, sheen, squadCol: plate.minCol, squadRow: plate.minRow })
      plates.addChild(holder)
    }
    applyUnfold(unfoldT < 0 ? 0 : unfoldT)
  }

  /** Put every panel where progress `t` says it is. */
  function applyUnfold(t: number) {
    for (const [i, p] of panels.entries()) {
      const plate = PLAN_PLATES[i]
      const u = panelProgress(t, p.squadCol, p.squadRow)
      const open = panelOpen(u)
      // Sideways or forward, whichever direction the panel is mostly opening
      // in. A single axis is enough: the other one is the hinge. Measured on the
      // plate's own proportions rather than on a lattice index — a long thin
      // spine pair and a small cluster island want different answers, and under
      // the squad grid every plate was the same shape so the question never
      // came up.
      const sideways = plate.maxCol - plate.minCol >= (plate.maxRow - plate.minRow) * PITCH_ROW
      p.root.scale.set(sideways ? open : 1, sideways ? 1 : open)
      p.root.visible = u > 0
      p.sheen.alpha = panelLight(u) * 0.35
      // Block 0 is already open and stays open — §7.8.1c, "the single squad
      // stays where it is and stays the size it is." It is one plate, because
      // THE FIRST HUNDRED is one unbroken bank of ten rows of ten.
      if (plate.block === 0) {
        p.root.scale.set(1, 1)
        p.root.visible = true
        p.sheen.alpha = 0
      }
    }
    // A bank's desks wait for its plates. Landing a desk on a panel that is
    // still edge-on is the one thing that would give the trick away.
    for (let b = 0; b < squadDesks.length; b++) {
      const block = PLAN_BLOCKS[b]
      squadDesks[b].visible = b === 0 || !block || panelProgress(t, block.minCol, block.minRow) >= 0.5
    }
    for (let i = 0; i < devs.length; i++) {
      const g = squadDesks[planSeat(i).block]
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
      /*
       * §7.8.12 — **the walls and the people are two animations, not one.**
       *
       * They used to share a gate, and the gate was the walls' condition: a
       * suite of one had no glass, so `team.length > 1` was false, so *nothing*
       * in this block ran. That is correct for the glass and wrong for the
       * person standing inside it — and the person it was wrong for was James
       * during his own arrival scene, who is the whole of the room for the ten
       * minutes before anybody joins him. He never turned to camera when he
       * spoke, because the line that turns him is down here.
       *
       * The two conditions are genuinely different and now say so: the glass
       * exists once a second hero arrives (§7.8.12's own rule), and a body is
       * animated whenever there is a body.
       */
      if (teamBox) {
        // The glass grows around the original corner rather than the whole
        // suite popping in. Geometry transitions keep running through a scene,
        // while the bodies and their IM packets obey its frozen clock.
        teamReveal = Math.min(1, teamReveal + dt / 0.52)
        const reveal = 1 - (1 - teamReveal) ** 3
        const contents = Math.max(0, Math.min(1, (reveal - 0.18) / 0.82))
        teamFloor.alpha = reveal
        teamGlass.alpha = reveal
        // The glass rises from its own front edge, so the reveal reads as
        // walls going up rather than as a box being scaled.
        const sill = teamBox ? teamBox.maxY : 0
        teamGlass.pivot.set(0, sill)
        teamGlass.position.set(0, sill)
        teamGlass.scale.y = 0.06 + reveal * 0.94
        teamDeskLayer.alpha = contents
        teamPeopleLayer.alpha = contents
        teamSignals.alpha = contents
        teamLabels.alpha = contents
        drawTeamSignals(liveElapsed)

        /*
         * §7.8.13 — **the type is held at a constant size on screen.**
         *
         * The plates are parented into the room and would otherwise scale with
         * the camera, which is exactly the failure `bubble.ts` documents one
         * layer up: text pinned to a world object has to stay legible rather
         * than stay proportional, the way a map label does not grow when you
         * zoom. Reusing that module's curve rather than writing a second one
         * means the two kinds of words in this room agree about how far away
         * "far away" is.
         */
        const type = counterScale(root.worldTransform.a)
        for (const g of teamLabels.children) g.scale.set(type)
        /*
         * **Never below the design size.** `counterScale` holds the type at
         * eleven screen pixels while it can and then gives up, so past its clamp
         * the words start being resampled again — and a resampled pixel font is
         * not faint, it is wrong (see `label`). The words go out at exactly the
         * zoom where holding them would start lying about what they say.
         *
         * Applied through {@link applyLabelDetail} rather than by hiding the
         * layer, because the sign's board survives this and its lettering does
         * not. Only re-applied when the answer changes: this runs every frame
         * and the answer changes about twice a flight.
         */
        const legible = typeAtDesignSize(root.worldTransform.a)
        if (legible !== typeLegible) {
          typeLegible = legible
          applyLabelDetail()
        }

      }

      // §10.7a.1 and §7.8.13 — whoever is in the room, walls or no walls.
      for (let order = 0; order < team.length; order++) {
        const hero = team[order]
        const body = teamBodies.get(hero.id)
        if (!body) continue
        const at = teamDeskPosition(hero.id)
        // **The line that turns a hero to camera.** `selected` is the player's
        // intent and `teamSpeaker` is the script's; either one faces them.
        const facing = hero.selected || hero.id === teamSpeaker
        const [back, front] = body.children as Graphics[]
        back.visible = !facing
        front.visible = facing
        // Active heroes type from this desk; benched heroes stay visibly in
        // the same chair. Connecting is deliberately a slower, tentative
        // rhythm until the remote channel becomes live.
        const pulse = hero.assigned
          ? Math.max(0, Math.sin(liveElapsed * (hero.connecting ? 5 : 8) + order * 1.7))
          : 0
        body.alpha = hero.assigned ? 1 : 0.64
        body.position.set(at.x, at.y + 6 - pulse * (hero.connecting ? 0.7 : 1.25))
      }
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
      // §7.8.6, §7.8.9 — the two layers of life on the floor, in the order they
      // have to run: the errands first, because they own bodies, and the free
      // ambience second, so it can be told which seats are already spoken for.
      //
      // **The props go dark once §7.8.1's crowding has taken the walkway.** An
      // errand with no destination falls back to standing outside its own desk,
      // which is the correct behaviour and a better joke than the walk was:
      // *a crowded floor stops being able to reach the cooler*, and the people
      // who wanted a drink just stand about instead.
      //
      // Skipped while frozen — §10.7a.3. Walkers stop mid-stride where they
      // are, like everything else on the floor.
      if (!frozen) {
        // Read off the live world transform rather than plumbed down from the
        // stage: the camera's scale is already baked into it, and a second copy
        // passed by hand is a second thing that can be one frame stale.
        const worldScale = root.worldTransform.a
        errands.update(dt, {
          roster: away,
          seatGrid: seatGridPoint,
          toScreen: gridPointToScreen,
          toGrid: screenToGrid,
          spots: currentProps.walkway ? spots : NO_SPOTS,
          lanes: currentLanes,
          drawnIndividually: true,
          worldScale,
          carryAt,
        })
        awaySeats.clear()
        for (const a of away) awaySeats.add(a.seat)
        ambient.update(dt, {
          seats: desks,
          devs: desks.length,
          entropy,
          drawnIndividually: true,
          worldScale,
          busySeats: awaySeats,
        })
      }

      // §21.7.0 — the refusal, over the head of whoever refused.
      //
      // Drawn outside the `frozen` guard above on purpose: this answers a
      // gesture the player just made, and a line that never appears because a
      // scene happened to open is a press that silently did nothing, which is
      // the exact failure the line exists to prevent.
      speech.begin()
      if (saying) {
        const age = performance.now() - saying.born
        const seat = desks[saying.seat]
        if (age >= saying.ms || !seat) {
          saying = null
        } else if (bubblesLegible(root.worldTransform.a)) {
          const off = errands.offsetFor(saying.seat)
          speech.draw({
            x: seat.x + off.x,
            y: seat.y + off.y - 46,
            ageMs: age,
            remainMs: saying.ms - age,
            says: saying.text,
            inv: counterScale(root.worldTransform.a),
          })
        }
      }
      speech.end()

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

        /*
         * §7.8.0c — **half of every garage pod rests facing the camera**, so
         * the front pose is no longer the exclusive property of a selected
         * developer. What is still exclusive, and is the half of §7.8.8 that
         * was ever load-bearing, is the *turn*: nobody on this floor ever
         * changes which way they are looking except by being selected or by
         * speaking. Somebody already facing you does not squash and swap when
         * you tap them — they are already looking at you — so they are excluded
         * from `turning` rather than given a turn that plays to the same pose.
         */
        const rests = seatFacesCamera(i, windowFrom, drawnGarage)
        const called = i === selected || i === turningOut || i === speaker || i === speakerOut
        const turning = called && !rests
        const facing = rests || i === selected || i === speaker
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
        // Two layers can move a body and exactly one ever does: `errands.ts`
        // owns anybody on the away roster, `ambient.ts` owns the drive-by
        // walkers, and the roster wins because it is the one the simulation
        // agrees with. `busySeats` above is what keeps the ambient layer from
        // claiming somebody it would then draw in the wrong chair.
        const errand = errands.offsetFor(i)
        const walk = errands.isAway(i) ? errand : ambient.offsetFor(i)
        // §7.8.9 — a developer in the player's hand dangles. Legs cycling, a
        // slight swing, and lifted clear of the floor, because the whole read
        // is "held by the scruff" and a held figure that stays upright looks
        // like it is flying. They do not hop while held: whatever they are
        // doing in mid-air, pushing off it is not it.
        const held = i === carried
        const hopping = !still && !held
        const phase = liveElapsed * hz + offset
        const lift = hopping ? hopHeight(phase) * HOP_HEIGHT * reach : 0
        const sway = hopping ? hopSway(phase) * HOP_SWAY * reach : 0
        const squash = hopping ? hopSquash(phase) : 1

        d.scale.x = turning ? turnScale(t) : 1
        d.scale.y = squash
        /**
         * §7.8.9 — **the struggle.**
         *
         * A held developer used to rock gently, at one frequency, forever,
         * which read as a pendulum: something hanging from the hand rather than
         * somebody objecting to being in it. A person trying to get down does
         * not oscillate — they *kick*, in bursts, and the bursts do not line up
         * with each other.
         *
         * So: two sine terms at frequencies with no common period, so the swing
         * never repeats a shape, times a third slow term that makes the whole
         * thing surge and subside. That is the difference between a struggle
         * and a metronome, and it is still three multiplies — §7.8.9 rule 4's
         * "no ragdoll, no collision" is not endangered by trigonometry.
         *
         * Seeded off the seat so two people held in succession do not perform
         * the identical animation.
         */
        const kick = held
          ? (Math.sin(liveElapsed * 13 + offset * 6) * 0.7 +
              Math.sin(liveElapsed * 21.4 + offset * 11) * 0.3) *
            (0.55 + 0.45 * Math.sin(liveElapsed * 3.1 + offset * 4))
          : 0
        d.rotation = kick * 0.34
        // The jolt sits on top of the hop: §8.2's "sprite jolts upright".
        //
        // `BODY_BASE` compensates the squash. The container's origin is at the
        // waist and the drawn figure hangs below it, so scaling Y about the
        // origin lifts the bottom of the body off the seat — the one place a
        // squash must never move.
        // The legs kick sideways as well as the body twisting — a figure that
        // only rotates is a signpost swinging in wind. Small: the hand is the
        // fixed point and the body hangs off it, so the feet travel and the
        // scruff does not.
        d.position.set(
          desks[i].x + walk.x + sway + kick * 4,
          desks[i].y +
            6 -
            lift +
            walk.y -
            jolts[i] * 5 -
            (held ? 16 : 0) +
            (held ? Math.abs(kick) * 2 : 0) +
            BODY_BASE * (1 - squash),
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
    setAway(roster) {
      away = roster
    },
    sayOver(seat, text, ms = 2600) {
      saying = { seat, text, born: performance.now(), ms }
    },
    hands: {
      hold(i) {
        carried = i
      },
      carryTo(x, y) {
        carryAt = { x, y }
      },
      release() {
        carried = -1
        carryAt = null
      },
      get carrying() {
        return carried
      },
    },
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
      // §7.8.12 — the corner desk's plate carries this name, so setting it
      // during first-start has to repaint the suite. Cheap: it is seven desks.
      rebuildTeam()
    },
    setTeam(heroes: readonly TeamRoomHero[]) {
      const key = teamKey(heroes)
      if (key === teamDrawnFor) return
      const before = teamBox
      team = heroes.map((hero) => ({ ...hero }))
      teamDrawnFor = key
      rebuildTeam()
      if (!before && teamBox) teamReveal = 0
      // The suite changes the room's camera rectangle when the walls arrive and
      // **every time the east wall moves**, which is once per hero. Comparing a
      // boolean would have caught only the first of those and left the sixth
      // desk outside the frame the camera was fitting to. Assignment lights
      // repaint the suite without rebuilding the rank-and-file floor.
      const moved =
        (before === null) !== (teamBox === null) ||
        (before !== null && teamBox !== null && before.maxX !== teamBox.maxX)
      if (moved && lastDevs >= 0) rebuild(lastDevs)
    },
    setLabelDetail(detail: LabelDetail) {
      if (detail === labelDetail) return
      labelDetail = detail
      applyLabelDetail()
    },
    teamDeskAt(id: HeroId) {
      if (!team.some((hero) => hero.id === id)) return null
      return teamDeskPosition(id)
    },
    teamHeroAt(x: number, y: number, reach = 24) {
      if (team.length === 0 || windowFrom !== 0) return null
      let found: HeroId | null = null
      let nearest = reach * reach
      for (const hero of team) {
        const at = teamDeskPosition(hero.id)
        const dx = x - at.x
        const dy = y - (at.y - 7)
        const distance = dx * dx + dy * dy
        if (distance <= nearest) {
          found = hero.id
          nearest = distance
        }
      }
      return found
    },
    teamSignAt(x: number, y: number, reach = 0) {
      if (!signGroup || !teamLabels.visible) return false
      // The board is 76 x 18 in the group's own units and the group is
      // counter-scaled, so the target grows as the camera pulls back — which is
      // what keeps it a thumb-sized target at both levels the room is drawn at.
      const k = signGroup.scale.x
      return (
        Math.abs(x - signGroup.position.x) <= 38 * k + reach &&
        Math.abs(y - signGroup.position.y) <= 9 * k + reach
      )
    },
    teamSignPoint() {
      if (!signGroup || !teamLabels.visible) return null
      return { x: signGroup.position.x, y: signGroup.position.y }
    },
    geometry(): RoomGeometry {
      return {
        shell: {
          top: { ...shellQuad.top },
          left: { ...shellQuad.left },
          right: { ...shellQuad.right },
          bottom: { ...shellQuad.bottom },
          grid: { ...shellGrid },
        },
        suite: teamBox && suiteGrid ? { box: { ...teamBox }, grid: { ...suiteGrid } } : null,
        suiteWalls: suiteWalls.map((w) => ({ a: { ...w.a }, b: { ...w.b } })),
        plots: team.map((hero) => {
          const plot = suitePlot(hero.id)
          const at = teamDeskPosition(hero.id)
          return { id: hero.id, col: plot.col, row: plot.row, x: at.x, y: at.y }
        }),
        founder: { ...FOUNDER_PLOT, ...founderDeskPosition() },
        /*
         * **Both units, from two different places.** The `x, y` is what the room
         * laid out; the `col, row` is what {@link drawnSeatPlot} says it should
         * have been. Handing over both lets the gate assert they agree, which is
         * the check that would have caught §7.7.2's falling silhouette landing on
         * the doorway threshold while the person sat down somewhere else.
         */
        seats: desks.map((d, i) => ({ ...drawnSeatPlot(i, windowFrom, drawnGarage), x: d.x, y: d.y })),
        heldSeats: suiteSeats(),
        seatWindow: windowFrom,
      }
    },
    setTeamSpeaker(id: HeroId | null) {
      teamSpeaker = id
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
      // §7.8.12 — and the suite comes down with them. It exists in the studio's
      // own first thousand and nowhere else, so a window that has moved off it
      // is a floor with no executive suite *and* no held-back threshold.
      rebuildTeam()
    },
    jolt(i: number) {
      if (i >= 0 && i < jolts.length) jolts[i] = 1
      // §7.8.6 rule 5 — a poke beats ambience. A player who taps somebody and
      // gets no reaction because that person happened to be chatting has been
      // told the game is a cutscene.
      // §7.8.6 rule 5 — the free behaviours end here. The away roster's own
      // version of the same rule lives in `store.ts`'s `poke`, because that one
      // hands back Story Points and this one never has.
      ambient.interrupt(i)
    },
    joltFounder() {
      founderHopStartedAt = performance.now() / 1000
    },
    founderDeskAt() {
      return founderDeskPosition()
    },
    deskFor(i: number) {
      // §7.7.2's arrivals ask this for a seat that is deliberately not drawn
      // yet, so it cannot read `desks` — but it must give the same answer, and
      // it does because both go through the one resolver.
      return drawnSeatPosition(i, windowFrom, drawnGarage)
    },

    deskAt(i: number) {
      return desks[i] ?? null
    },
    get drawn() {
      return desks.length
    },
    get inGarage() {
      return drawnGarage
    },
    get seatWindow() {
      return windowFrom
    },
    extent,
    shellRect,
  }
}
