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

    for (let i = 0; i < n; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const { x, y } = isoAt(col, row)
      desks.push({ x, y })

      if (props.dividers && col < cols - 1) {
        // A panel standing between two desks, so it runs along the grid axis
        // rather than straight up the screen.
        const dx = x + TILE_W * 0.5 * PITCH
        const dy = y + TILE_H * 0.5 * PITCH
        furniture
          .moveTo(dx - 10, dy - 5 - 18)
          .lineTo(dx + 10, dy + 5 - 18)
          .lineTo(dx + 10, dy + 5)
          .lineTo(dx - 10, dy - 5)
          .closePath()
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
