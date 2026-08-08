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

/** Desk pitch on the iso grid. Wide enough to walk between, until it isn't. */
const PITCH = 1.15

/** §7.8.1 — the headcount at which the room stops gaining and starts losing. */
const CROWDING_STARTS = 40

export interface RoomHandle {
  container: Container
  /**
   * Rebuild for a headcount. Called when `devs` changes, never per frame —
   * this rebuilds geometry and is far too expensive for the ticker.
   */
  setHeadcount(devs: number): void
  /**
   * Advance the §7.8.3 idle animation. `elapsed` in seconds, `state` is the
   * shared §8.2 dev state (the store models one machine, not one per person).
   */
  animate(elapsed: number, state: string): void
  /** Jolt developer `i` — the §8.2 poke reaction. */
  jolt(i: number): void
  /** Where developer `i` sits, in room-local coordinates. Null if not drawn. */
  deskAt(i: number): { x: number; y: number } | null
  /** How many developers are actually on screen. */
  readonly drawn: number
  /** Live bounding size, for the §23.4.1 camera fit. Grows with the room. */
  readonly extent: { w: number; h: number }
}

/** Iso projection of a grid cell. */
function isoAt(col: number, row: number) {
  return {
    x: (col - row) * (TILE_W / 2) * PITCH,
    y: (col + row) * (TILE_H / 2) * PITCH,
  }
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
 * Grid dimensions for a headcount.
 *
 * Kept squarish rather than in long rows: §7.8.1 wants a *huddle* at 3–5 and a
 * *floor* at 31+, and a square grid reads as both at the right sizes where a
 * 4-wide row would read as a call centre at every size.
 */
export function gridFor(devs: number): { cols: number; rows: number } {
  const n = Math.max(1, Math.min(ROOM_DEV_CAP, Math.floor(devs)))
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
  return { cols, rows: Math.ceil(n / cols) }
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

/** One developer at a desk, as a container so it can animate and be hit-tested. */
function buildDeveloper(): Container {
  const dev = new Container()
  const g = new Graphics()

  // Chair back, behind them.
  g.rect(-9, 6, 18, 22).fill(c(RAMPS.NEUTRAL[2]))
  // Torso.
  g.rect(-9, -2, 18, 20).fill(c(RAMPS.NEUTRAL[7]))
  // Arms forward, toward the keyboard.
  g.rect(-13, 2, 5, 13).fill(c(RAMPS.NEUTRAL[6]))
  g.rect(8, 2, 5, 13).fill(c(RAMPS.NEUTRAL[6]))
  // Head and hair.
  g.rect(-7, -16, 14, 15).fill(c(RAMPS.SKIN[0]))
  g.rect(-8, -18, 16, 6).fill(c(RAMPS.WOOD[0]))
  // Glasses — two dark rectangles read as spectacles at this size.
  g.rect(-6, -9, 5, 3).fill(c(RAMPS.NEUTRAL[1]))
  g.rect(1, -9, 5, 3).fill(c(RAMPS.NEUTRAL[1]))

  dev.addChild(g)
  dev.label = 'developer'
  return dev
}

/** A desk with its monitor. Drawn into a shared Graphics — these never animate. */
function drawDesk(g: Graphics, x: number, y: number) {
  // Desk surface and its two visible sides. Left catches the light.
  isoQuad(g, x, y, TILE_W * 0.9, TILE_H * 0.9, c(RAMPS.WOOD[2]))
  g.moveTo(x - TILE_W * 0.45, y)
    .lineTo(x, y + TILE_H * 0.45)
    .lineTo(x, y + TILE_H * 0.45 + 9)
    .lineTo(x - TILE_W * 0.45, y + 9)
    .closePath()
    .fill(c(RAMPS.WOOD[1]))
  g.moveTo(x + TILE_W * 0.45, y)
    .lineTo(x, y + TILE_H * 0.45)
    .lineTo(x, y + TILE_H * 0.45 + 9)
    .lineTo(x + TILE_W * 0.45, y + 9)
    .closePath()
    .fill(c(RAMPS.WOOD[0]))

  // Monitor: bezel, then the emissive screen. The screen is the room's light.
  g.rect(x - 13, y - 30, 26, 20).fill(c(RAMPS.NEUTRAL[2]))
  g.rect(x - 11, y - 28, 22, 16).fill(c(RAMPS.GLOW[0]))
  for (let i = 0; i < 4; i++) {
    const w = 5 + ((i * 7) % 13)
    g.rect(x - 9, y - 26 + i * 4, w, 1.5).fill(c(i % 2 === 0 ? RAMPS.GLOW[2] : RAMPS.GLOW[1]))
  }
  g.rect(x - 3, y - 10, 6, 3).fill(c(RAMPS.NEUTRAL[2]))
}

/** A pot plant. The most-repeated prop, so it varies by index. */
function drawPlant(g: Graphics, x: number, y: number, i: number) {
  const tall = i % 2 === 0
  g.rect(x - 6, y - 10, 12, 10).fill(c(RAMPS.WOOD[1]))
  g.rect(x - 6, y - 10, 12, 2).fill(c(RAMPS.WOOD[0]))
  if (tall) {
    g.rect(x - 1, y - 30, 2, 20).fill(c(RAMPS.FOLIAGE[0]))
    g.ellipse(x - 5, y - 28, 7, 5).fill(c(RAMPS.FOLIAGE[0]))
    g.ellipse(x + 5, y - 24, 7, 5).fill(c(RAMPS.FOLIAGE[1]))
    g.ellipse(x, y - 34, 6, 5).fill(c(RAMPS.FOLIAGE[1]))
  } else {
    g.ellipse(x, y - 18, 12, 10).fill(c(RAMPS.FOLIAGE[0]))
    g.ellipse(x - 4, y - 22, 7, 6).fill(c(RAMPS.FOLIAGE[1]))
  }
}

/** The water cooler. The other thing people stand around instead of working. */
function drawWaterCooler(g: Graphics, x: number, y: number) {
  g.rect(x - 7, y - 22, 14, 22).fill(c(RAMPS.NEUTRAL[6]))
  // The bottle. GLOW rather than a blue-grey because it is the one translucent
  // object in the room and it should catch the monitor light.
  g.rect(x - 6, y - 40, 12, 18).fill({ color: c(RAMPS.GLOW[1]), alpha: 0.75 })
  g.rect(x - 6, y - 40, 12, 3).fill(c(RAMPS.NEUTRAL[4]))
  g.rect(x - 3, y - 18, 6, 3).fill(c(RAMPS.NEUTRAL[2]))
}

function drawCoffee(g: Graphics, x: number, y: number) {
  g.rect(x - 9, y - 26, 18, 26).fill(c(RAMPS.NEUTRAL[3]))
  g.rect(x - 6, y - 21, 12, 8).fill(c(RAMPS.NEUTRAL[0]))
  g.rect(x - 4, y - 9, 8, 5).fill(c(RAMPS.WOOD[1]))
  g.rect(x + 2, y - 24, 4, 2).fill(c(RAMPS.ALARM[2]))
}

function drawFilingCabinet(g: Graphics, x: number, y: number) {
  g.rect(x - 9, y - 28, 18, 28).fill(c(RAMPS.NEUTRAL[4]))
  for (let d = 0; d < 3; d++) {
    g.rect(x - 7, y - 25 + d * 9, 14, 7).fill(c(RAMPS.NEUTRAL[3]))
    g.rect(x - 2, y - 22 + d * 9, 4, 1.5).fill(c(RAMPS.NEUTRAL[6]))
  }
}

function drawPrinter(g: Graphics, x: number, y: number) {
  g.rect(x - 11, y - 14, 22, 14).fill(c(RAMPS.NEUTRAL[5]))
  g.rect(x - 8, y - 18, 16, 4).fill(c(RAMPS.NEUTRAL[6]))
  // Paper, permanently half-fed. It is a printer.
  g.rect(x - 5, y - 22, 10, 5).fill(c(RAMPS.NEUTRAL[8]))
  g.rect(x + 6, y - 11, 2, 2).fill(c(RAMPS.WARN[2]))
}

function drawSofa(g: Graphics, x: number, y: number) {
  g.rect(x - 22, y - 14, 44, 14).fill(c(RAMPS.NEUTRAL[3]))
  g.rect(x - 22, y - 24, 44, 11).fill(c(RAMPS.NEUTRAL[4]))
  g.rect(x - 22, y - 20, 8, 20).fill(c(RAMPS.NEUTRAL[3]))
  g.rect(x + 14, y - 20, 8, 20).fill(c(RAMPS.NEUTRAL[3]))
}

/** Unpacked cardboard. Arrives when hiring outruns tidying and never leaves. */
function drawBoxes(g: Graphics, x: number, y: number, i: number) {
  const h = 12 + (i % 3) * 4
  g.rect(x - 10, y - h, 20, h).fill(c(RAMPS.WOOD[2]))
  g.rect(x - 10, y - h, 20, 2).fill(c(RAMPS.WOOD[1]))
  g.rect(x - 2, y - h, 4, h).fill({ color: c(RAMPS.WOOD[1]), alpha: 0.7 })
  if (i % 2 === 0) {
    g.rect(x - 6, y - h - 9, 12, 9).fill(c(RAMPS.WOOD[2]))
    g.rect(x - 6, y - h - 9, 12, 1.5).fill(c(RAMPS.WOOD[1]))
  }
}

function drawBin(g: Graphics, x: number, y: number) {
  g.moveTo(x - 6, y - 14)
    .lineTo(x + 6, y - 14)
    .lineTo(x + 4, y)
    .lineTo(x - 4, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[3]))
  // Overflowing, because nobody empties it either.
  g.rect(x - 4, y - 17, 3, 3).fill(c(RAMPS.NEUTRAL[7]))
  g.rect(x + 1, y - 16, 3, 3).fill(c(RAMPS.NEUTRAL[8]))
}

/** A poster on a wall. Flat, screen-aligned, never a lit object. */
function drawPoster(g: Graphics, x: number, y: number, i: number) {
  const w = 22 + (i % 2) * 8
  const h = 28
  g.rect(x - w / 2, y, w, h).fill(c(RAMPS.NEUTRAL[2]))
  g.rect(x - w / 2 + 2, y + 2, w - 4, h - 4).fill(c(i % 2 === 0 ? RAMPS.CALM[0] : RAMPS.WARN[0]))
  // A motivational block of nothing.
  g.rect(x - w / 2 + 5, y + h - 9, w - 10, 2).fill(c(RAMPS.NEUTRAL[5]))
  g.rect(x - w / 2 + 5, y + h - 5, (w - 10) * 0.6, 2).fill(c(RAMPS.NEUTRAL[4]))
}

function drawWhiteboard(g: Graphics, x: number, y: number, seed: number) {
  g.rect(x - 30, y, 60, 34).fill(c(RAMPS.NEUTRAL[7]))
  g.rect(x - 30, y + 32, 60, 3).fill(c(RAMPS.NEUTRAL[4]))
  for (let i = 0; i < 3; i++) {
    const w = 18 + ((seed + i * 13) % 26)
    g.rect(x - 27, y + 4 + i * 7, w, 2).fill(c(RAMPS.NEUTRAL[4]))
  }
}

export function buildRoom(): RoomHandle {
  const root = new Container()

  // Draw order is the whole illusion: walls behind, floor, then light, then
  // desks, then people in front of their own desks.
  const shell = new Graphics()
  const light = new Graphics()
  const furniture = new Graphics()
  const devLayer = new Container()
  root.addChild(shell, light, furniture, devLayer)

  const devs: Container[] = []
  /** Per-developer jolt decay, 1 -> 0. The §8.2 poke reaction. */
  const jolts: number[] = []
  const desks: Array<{ x: number; y: number }> = []
  let lastDevs = -1
  const extent = { w: TILE_W * 3, h: 156 }

  function rebuild(headcount: number) {
    const n = Math.max(1, Math.min(ROOM_DEV_CAP, Math.floor(headcount)))
    const { cols, rows } = gridFor(n)
    const props = propsAt(headcount)

    shell.clear()
    light.clear()
    furniture.clear()
    desks.length = 0

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
    const margin = TIGHTEST + Math.min(roomy - TIGHTEST, (n / 14) * (roomy - TIGHTEST))
    const halfW = (cols + rows) / 2 + margin
    const floorW = halfW * TILE_W * PITCH
    const floorH = halfW * TILE_H * PITCH
    const cx = ((cols - 1) - (rows - 1)) * (TILE_W / 2) * PITCH * 0.5
    const cy = ((cols - 1) + (rows - 1)) * (TILE_H / 2) * PITCH * 0.5

    // Floor, with a darker inset so the edge reads as a skirting line.
    isoQuad(shell, cx, cy, floorW * 2, floorH * 2, c(RAMPS.NEUTRAL[2]))
    isoQuad(shell, cx, cy, floorW * 2 - 10, floorH * 2 - 5, c(RAMPS.WOOD[0]))

    // The two back walls, rising from the far edges. Left wall takes the
    // lighter neutral — ART_DIRECTION §7's single top-left source, held by
    // hand because no script can check it.
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
      .fill(c(RAMPS.NEUTRAL[3]))
    shell
      .moveTo(rightX, cy)
      .lineTo(topX, topY)
      .lineTo(topX, topY - WALL_H)
      .lineTo(rightX, cy - WALL_H)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[2]))
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
      drawWhiteboard(shell, topX - floorW * 0.42, topY - floorH * 0.02 - WALL_H * 0.66, 3)
    }
    if (props.whiteboardRight) {
      drawWhiteboard(shell, topX + floorW * 0.40, topY + floorH * 0.02 - WALL_H * 0.62, 17)
    }
    for (let i = 0; i < props.posters; i++) {
      // Alternating walls, marching outward from the corner so a second poster
      // never lands on the first.
      const left = i % 2 === 0
      const along = 0.18 + Math.floor(i / 2) * 0.3
      const px = left ? topX - floorW * along : topX + floorW * along
      const py = topY + floorH * along * 0.02 - WALL_H * (0.5 - (i % 3) * 0.08)
      drawPoster(shell, px, py, i)
    }

    // --- floor furniture ---------------------------------------------------
    //
    // Placed on the perimeter between the desk grid and the walls, so the
    // dressing follows the room as it grows instead of sitting at fractions of
    // a box that changes size underneath it.

    const ring: Array<(x: number, y: number, i: number) => void> = []
    if (props.coffee) ring.push((x, y) => drawCoffee(furniture, x, y))
    if (props.waterCooler) ring.push((x, y) => drawWaterCooler(furniture, x, y))
    if (props.filingCabinet) ring.push((x, y) => drawFilingCabinet(furniture, x, y))
    if (props.printer) ring.push((x, y) => drawPrinter(furniture, x, y))
    if (props.sofa) ring.push((x, y) => drawSofa(furniture, x, y))
    if (props.bin) ring.push((x, y) => drawBin(furniture, x, y))
    for (let i = 0; i < props.plants; i++) ring.push((x, y) => drawPlant(furniture, x, y, i))
    for (let i = 0; i < props.boxes; i++) ring.push((x, y) => drawBoxes(furniture, x, y, i))

    // Spread evenly around the ring rather than clustered, and offset by a
    // quarter turn so nothing sits exactly on the near corner where it would
    // occlude the desks the camera is framing.
    const inset = TILE_W * 0.42
    for (let i = 0; i < ring.length; i++) {
      const t = 0.125 + i / Math.max(1, ring.length)
      const at = perimeterPoint(t, cx, cy, floorW, floorH, inset)
      ring[i](at.x, at.y, i)
    }

    if (props.serverRack) {
      // Corner-mounted rather than on the ring: it is the one thing that wants
      // a wall behind it and it never moves once installed.
      const sx = topX + floorW * 0.52
      const sy = topY + floorH * 0.36
      furniture.rect(sx - 12, sy - 54, 24, 54).fill(c(RAMPS.NEUTRAL[1]))
      for (let i = 0; i < 6; i++) {
        furniture.rect(sx - 8, sy - 50 + i * 8, 16, 3).fill(c(RAMPS.NEUTRAL[2]))
        furniture.rect(sx + 4, sy - 50 + i * 8, 2, 3).fill(c(RAMPS.GLOW[2]))
      }
    }

    // --- desks and people --------------------------------------------------

    for (let i = 0; i < n; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const { x, y } = isoAt(col, row)
      desks.push({ x, y })

      if (props.dividers && col < cols - 1) {
        furniture
          .rect(x + TILE_W * 0.5 * PITCH - 1, y - 14, 2, 20)
          .fill({ color: c(RAMPS.NEUTRAL[3]), alpha: 0.8 })
      }
      if (props.cables) {
        furniture
          .moveTo(x - TILE_W * 0.4, y + 12)
          .lineTo(x + TILE_W * 0.4, y + 14)
          .stroke({ width: 1, color: c(RAMPS.NEUTRAL[1]), alpha: 0.7 })
      }

      drawDesk(furniture, x, y)
    }

    // Reuse developer containers across rebuilds — a hire should not rebuild
    // ninety-nine sprites that did not change.
    while (devs.length < n) {
      const d = buildDeveloper()
      devs.push(d)
      jolts.push(0)
      devLayer.addChild(d)
    }
    for (let i = 0; i < devs.length; i++) {
      const visible = i < n
      devs[i].visible = visible
      if (visible) devs[i].position.set(desks[i].x, desks[i].y + 6)
    }

    // The camera fit reads this every frame (§23.4.1), so the room growing is
    // also the camera pulling back — without anyone driving Z.
    // The camera fit reads these, so they must describe the *drawn* bounds:
    // floor plus the walls standing behind it, and a pivot at the true centre
    // of that box rather than at the floor's centre. Pivoting on the floor
    // pushes the whole room down the frame by half a wall.
    extent.w = floorW * 2
    extent.h = floorH * 2 + WALL_H
    // Biased toward the desks rather than the true centre of the bounding box.
    // Centring the box geometrically is correct and composes badly: it puts
    // half a wall above the people and drops them low in frame.
    root.pivot.set(cx, cy - WALL_H * 0.3)
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
    animate(elapsed: number, state: string) {
      // §7.8.3 — a transform on a static part, never a spritesheet. The whole
      // motion budget for a hundred people is one sine per person per frame.
      //
      // Stillness is a state and must read as deliberate: an Overwhelmed
      // developer has their head on the desk and a 10x Engineer is facing the
      // camera, and both are legible *because* the floor around them moves.
      const still = state === 'overwhelmed' || state === 'tenx'
      const rate = state === 'flow' ? 11 : state === 'rogue' ? 15 : state === 'slacking' ? 2.5 : 6.2
      const reach = state === 'slacking' ? 0.6 : 1

      for (let i = 0; i < desks.length; i++) {
        const d = devs[i]
        if (!d.visible) continue
        // Per-developer phase offset, hashed from the index rather than drawn
        // at random so it is identical every run. Without it a hundred people
        // bob in unison and read as one breathing object rather than a crowd —
        // §7.8.3 calls this non-negotiable and it is the single cheapest thing
        // that makes the room feel populated.
        const phase = ((i * 2654435761) % 1024) / 1024
        const bob = still ? 0 : Math.sin((elapsed * rate + phase * 6.283)) * 1.6 * reach

        if (jolts[i] > 0) jolts[i] = Math.max(0, jolts[i] - 0.06)
        // The jolt sits on top of the bob: §8.2's "sprite jolts upright".
        d.position.set(desks[i].x, desks[i].y + 6 + bob - jolts[i] * 5)
      }
    },
    jolt(i: number) {
      if (i >= 0 && i < jolts.length) jolts[i] = 1
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
