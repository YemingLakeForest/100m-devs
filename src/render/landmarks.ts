/**
 * The landmarks — what stands in the holes the plan leaves. GDD §7.8.1e.
 *
 * ## Why a floor needs these and not more desks
 *
 * A thousand desks is a texture. The eye can read a texture at one scale and
 * then has nothing left to do, which is what "way too boring" describes: there
 * was no object anywhere on the floor that was not a desk, so there was no
 * feature the eye could use to navigate by and no reason to look twice.
 *
 * A landmark is the opposite of a texture. It is a **thing in a place** — the
 * kitchenette is at the west end of the spine and it is the only kitchenette at
 * the west end of the spine — so it gives the floor an address system, and it
 * gives §7.8.6's walkers somewhere to walk that is not a wall.
 *
 * ## Congestion, not deletion
 *
 * §7.8.1d amended §7.8.1's crowding to say this and the landmarks are where it
 * gets paid: as the studio fills, the amenities do not disappear. They get
 * **used**. An island meant for four has six stools round it, the nook's low
 * table is stacked with mugs nobody cleared, and the canteen runs out of chairs.
 * The company keeps installing things and the room keeps getting worse, and
 * those are the same sentence.
 *
 * ## Units and order
 *
 * Grid **tiles**, projected through the caller's `project`, exactly like
 * `apron.ts` and `plaza.ts`. `gx` runs back into the floor, `gy` across it, and
 * screen depth is `gx + gy` — so within one landmark the far side (`x0`, `y0`)
 * is drawn before the near side, and {@link drawLandmarks} sorts the landmarks
 * themselves the same way. Nothing here is a screen pixel.
 */
import type { Graphics } from 'pixi.js'
import { RAMPS } from '../art/palette.ts'
import { isoCap, isoPatch, isoSolid, type Project } from './isoSolid.ts'

/** The kinds of room the plan can reserve — see `floorplan.ts`. */
export type LandmarkKind =
  | 'meeting'
  | 'library'
  | 'pantry'
  | 'kitchenette'
  | 'core'
  | 'breakout'
  | 'cafeteria'

/**
 * One reserved room, **in tiles**.
 *
 * The plan holds these in seat units, because that is the unit the desks are
 * in; the conversion happens once, at the call site in `room.ts`, for the same
 * reason `plaza.ts` is handed a torso instead of looking one up. A module that
 * draws furniture should not also own the table saying how wide a seat is.
 */
export interface LandmarkPlot {
  readonly kind: LandmarkKind
  readonly name: string
  /** Far edge, back into the floor. */
  readonly x0: number
  /** Far edge, across the floor. */
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/**
 * Deterministic jitter — a landmark must draw the same on every rebuild.
 *
 * A nook whose plant moves when somebody is hired is a nook nobody believes,
 * and the room rebuilds on every single hire.
 */
function rnd(i: number): number {
  const s = Math.sin(i * 41.7391) * 24571.113
  return s - Math.floor(s)
}

/**
 * The cap colour a room wears on its partition tops.
 *
 * ART_DIRECTION's highest-value idea from the reference, and one extra quad: a
 * run of low walls in one neutral is a run of low walls, and the same run with
 * three pixels of colour on its top edge is three rooms you can tell apart in a
 * 960-pixel frame. Keyed off the kind rather than the name, because the colour
 * is answering "what happens in there", not "which one is this".
 */
const CAP: Record<LandmarkKind, string> = {
  meeting: RAMPS.CALM[2],
  library: RAMPS.WARN[2],
  pantry: RAMPS.FOLIAGE[1],
  kitchenette: RAMPS.WARN[2],
  core: RAMPS.NEUTRAL[6],
  breakout: RAMPS.ALARM[2],
  cafeteria: RAMPS.WARN[2],
}

/** A warm pool of light on the floor — a lamp, a pendant, a strip. */
function pool(g: Graphics, p: Project, x: number, y: number, r: number, alpha = 0.13) {
  isoPatch(g, p, x - r, y - r, x + r, y + r, RAMPS.WARN[2], alpha)
}

/**
 * A seat you are not working at — sofa, armchair, canteen chair.
 *
 * Two solids: a cushion and a back. Which side the back goes on is the whole
 * argument, because a sofa's back has to run along a **floor axis** — the same
 * rule the plaza's octagon obeys and the reason its sofas sit on the axis edges
 * rather than the diagonals. `along` picks the axis: `'gy'` puts the back on the
 * far side across the floor, `'gx'` on the far side back into it.
 */
function seat(
  g: Graphics,
  p: Project,
  x: number,
  y: number,
  w: number,
  d: number,
  along: 'gx' | 'gy',
  body: string,
) {
  isoSolid(g, p, x, y, 0, w, d, 0.22, { top: body, left: body, right: RAMPS.NEUTRAL[1] })
  if (along === 'gy') {
    isoSolid(g, p, x, y, 0, w, 0.16, 0.5, { top: RAMPS.NEUTRAL[4], left: body, right: RAMPS.NEUTRAL[1] })
  } else {
    isoSolid(g, p, x, y, 0, 0.16, d, 0.5, { top: RAMPS.NEUTRAL[4], left: body, right: RAMPS.NEUTRAL[1] })
  }
}

/** A table, a desk-height surface, a counter — anything you put things on. */
function surface(g: Graphics, p: Project, x: number, y: number, w: number, d: number, h: number, top: string, side: string) {
  isoSolid(g, p, x, y, 0, w, d, h, { top, left: side, right: RAMPS.NEUTRAL[1] })
}

/** A pot plant. Three solids, and the only green thing on the floor. */
function plant(g: Graphics, p: Project, x: number, y: number, s: number) {
  isoSolid(g, p, x, y, 0, 0.3 * s, 0.3 * s, 0.22 * s, {
    top: RAMPS.WOOD[2], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0],
  })
  isoSolid(g, p, x + 0.03 * s, y + 0.03 * s, 0.22 * s, 0.24 * s, 0.24 * s, 0.36 * s, {
    top: RAMPS.FOLIAGE[1], left: RAMPS.FOLIAGE[0], right: RAMPS.NEUTRAL[1],
  })
  isoSolid(g, p, x + 0.09 * s, y + 0.09 * s, 0.5 * s, 0.14 * s, 0.14 * s, 0.24 * s, {
    top: RAMPS.FOLIAGE[1], left: RAMPS.FOLIAGE[1], right: RAMPS.FOLIAGE[0],
  })
}

/**
 * A floor lamp, and the pool it throws.
 *
 * The pool is the point, the same way it is out on the street. §7.8.1's opening
 * frame is lit by one monitor; every warm light added after that is the room
 * saying somebody lives here, which is the whole of the brief that asked for
 * this floor to be **cosy**. A ceiling grid would light it evenly and evenly
 * lit is what an office looks like in a photograph nobody kept.
 */
function lamp(g: Graphics, p: Project, x: number, y: number) {
  pool(g, p, x + 0.1, y + 0.1, 1.05, 0.16)
  isoSolid(g, p, x, y, 0, 0.12, 0.12, 1.28, {
    top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2],
  })
  isoSolid(g, p, x - 0.11, y - 0.11, 1.28, 0.34, 0.34, 0.22, {
    top: RAMPS.WARN[3], left: RAMPS.WARN[2], right: RAMPS.WARN[1],
  })
}

/** A mug, a kettle, a stack of paper — the small stuff that says somebody was here. */
function clutter(g: Graphics, p: Project, x: number, y: number, z: number, s: number, colour: string) {
  isoSolid(g, p, x, y, z, 0.13 * s, 0.13 * s, 0.16 * s, {
    top: colour, left: colour, right: RAMPS.NEUTRAL[1],
  })
}

/**
 * A glass partition standing on a line between two plots.
 *
 * Its foot runs on a floor axis by construction, so it comes out at the
 * projection's ±0.50 rather than at whatever two screen points would have
 * given — §7.8.12's rule, which cost the suite three of its four walls the
 * first time it was ignored.
 */
function glass(g: Graphics, p: Project, x: number, y: number, w: number, d: number, h: number, cap: string) {
  isoSolid(g, p, x, y, 0, w, d, h, { top: RAMPS.GLOW[0], left: RAMPS.GLOW[0], right: RAMPS.NEUTRAL[1] }, 0.34)
  isoCap(g, p, x, y, h, w, d, cap)
}

/** Carpet — the floor finish that says this patch is a room and not a walkway. */
function carpet(g: Graphics, p: Project, plot: LandmarkPlot, fill: string) {
  isoPatch(g, p, plot.x0, plot.y0, plot.x1, plot.y1, fill)
  isoPatch(g, p, plot.x0, plot.y0, plot.x1, plot.y0 + 0.08, RAMPS.NEUTRAL[4], 0.5)
  isoPatch(g, p, plot.x0, plot.y0, plot.x0 + 0.08, plot.y1, RAMPS.NEUTRAL[4], 0.5)
}

/**
 * A meeting room — carpet, a table, chairs, a screen, and glass on two sides.
 *
 * Glass on the **near** two sides only. The far two are the back wall and the
 * next room along, and a pane drawn there would be a pane seen from behind
 * another pane, which at this scale is a smear. It is also what an office
 * actually builds: the partition faces the floor, because the point of a glass
 * meeting room is that the floor can see it is in use.
 */
function meeting(g: Graphics, p: Project, plot: LandmarkPlot, crowd: number) {
  const { x0, y0, x1, y1 } = plot
  const w = x1 - x0
  const d = y1 - y0
  carpet(g, p, plot, RAMPS.NEUTRAL[2])
  // The screen on the back wall, and it is on, because an empty meeting room
  // with a live screen is funnier and more true than an empty meeting room.
  isoSolid(g, p, x0 + w * 0.1, y0 + d * 0.3, 0.62, w * 0.06, d * 0.4, 0.44, {
    top: RAMPS.NEUTRAL[2], left: RAMPS.GLOW[1], right: RAMPS.NEUTRAL[1],
  })
  const tx = x0 + w * 0.34
  const ty = y0 + d * 0.22
  const tw = w * 0.34
  const td = d * 0.56
  // Chairs on the far side first — they are behind the table and have to be
  // drawn behind it, which is the one ordering mistake that reads instantly.
  for (let i = 0; i < 3; i++) {
    seat(g, p, tx - 0.42, ty + (td * (i + 0.5)) / 3 - 0.18, 0.34, 0.36, 'gx', RAMPS.NEUTRAL[3])
  }
  surface(g, p, tx, ty, tw, td, 0.3, RAMPS.WOOD[2], RAMPS.WOOD[1])
  clutter(g, p, tx + tw * 0.3, ty + td * 0.3, 0.3, 1, RAMPS.NEUTRAL[7])
  if (crowd > 0.35) clutter(g, p, tx + tw * 0.5, ty + td * 0.62, 0.3, 0.9, RAMPS.WARN[2])
  for (let i = 0; i < 3; i++) {
    seat(g, p, tx + tw + 0.1, ty + (td * (i + 0.5)) / 3 - 0.18, 0.34, 0.36, 'gx', RAMPS.NEUTRAL[3])
  }
  // The two panes that face the floor, and the cap that names the room.
  glass(g, p, x0, y1 - 0.1, w, 0.1, 1.3, CAP.meeting)
  glass(g, p, x1 - 0.1, y0, 0.1, d, 1.3, CAP.meeting)
}

/**
 * The quiet end — shelves, two armchairs and a lamp.
 *
 * The one room on the floor with nothing to do with work, and the reason it
 * exists is §7.8.5's protected detail: crowding takes away the things somebody
 * *chose*. You cannot take away a chosen thing that was never there, so the
 * floor has to be given some.
 */
function library(g: Graphics, p: Project, plot: LandmarkPlot, crowd: number) {
  const { x0, y0, x1, y1 } = plot
  const w = x1 - x0
  const d = y1 - y0
  carpet(g, p, plot, RAMPS.NEUTRAL[2])
  // Shelves along the back wall, and the spines are the colour. Books at this
  // scale are two pixels each; a run of coloured caps is what reads as books.
  const bays = Math.max(3, Math.round(d / 1.6))
  for (let i = 0; i < bays; i++) {
    const by = y0 + 0.15 + (i * (d - 0.3)) / bays
    const bd = (d - 0.3) / bays - 0.12
    isoSolid(g, p, x0 + 0.12, by, 0, 0.34, bd, 1.15, {
      top: RAMPS.WOOD[1], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0],
    })
    const spine = [RAMPS.ALARM[1], RAMPS.CALM[1], RAMPS.WARN[1], RAMPS.FOLIAGE[0]][i % 4]
    isoCap(g, p, x0 + 0.12, by, 1.15, 0.34, bd, spine)
    isoPatch(g, p, x0 + 0.44, by, x0 + 0.47, by + bd, spine, 0.7)
  }
  // The rug the chairs stand on. A rug is what turns two chairs into a corner.
  isoPatch(g, p, x0 + 0.9, y0 + d * 0.2, x1 - 0.3, y1 - d * 0.2, RAMPS.WOOD[0])
  isoPatch(g, p, x0 + 1.05, y0 + d * 0.24, x1 - 0.45, y1 - d * 0.24, RAMPS.WOOD[1], 0.5)
  lamp(g, p, x0 + 1.0, y1 - 0.5)
  seat(g, p, x0 + 1.1, y0 + d * 0.3, 0.5, 0.5, 'gx', RAMPS.CALM[1])
  const table = { x: x0 + w * 0.5, y: y0 + d * 0.45 }
  surface(g, p, table.x, table.y, 0.42, 0.5, 0.24, RAMPS.WOOD[2], RAMPS.WOOD[1])
  clutter(g, p, table.x + 0.12, table.y + 0.16, 0.24, 0.9, RAMPS.NEUTRAL[7])
  // The mugs nobody cleared. §7.8.1d's congestion, at the scale of one table.
  for (let i = 0; i < Math.round(crowd * 3); i++) {
    clutter(g, p, table.x + 0.05 + i * 0.11, table.y + 0.3, 0.24, 0.8, RAMPS.NEUTRAL[6])
  }
  seat(g, p, x1 - 0.75, y0 + d * 0.55, 0.5, 0.5, 'gx', RAMPS.CALM[1])
  plant(g, p, x1 - 0.6, y1 - 0.5, 1.15)
}

/** A tea point along the back wall — counter, urn, cabinets, and a warm strip. */
function pantry(g: Graphics, p: Project, plot: LandmarkPlot, crowd: number) {
  const { x0, y0, x1, y1 } = plot
  const d = y1 - y0
  carpet(g, p, plot, RAMPS.NEUTRAL[3])
  isoPatch(g, p, x0 + 0.3, y0, x1, y1, RAMPS.WARN[2], 0.1)
  isoSolid(g, p, x0 + 0.08, y0 + 0.1, 1.05, 0.42, d - 0.2, 0.5, {
    top: RAMPS.WOOD[1], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0],
  })
  surface(g, p, x0 + 0.1, y0 + 0.1, 0.56, d - 0.2, 0.34, RAMPS.NEUTRAL[6], RAMPS.NEUTRAL[3])
  isoCap(g, p, x0 + 0.1, y0 + 0.1, 0.34, 0.56, d - 0.2, CAP.pantry)
  // The urn, the mugs, and more mugs the fuller the floor gets.
  clutter(g, p, x0 + 0.28, y0 + 0.5, 0.34, 1.6, RAMPS.NEUTRAL[5])
  const mugs = 3 + Math.round(crowd * 6)
  for (let i = 0; i < mugs; i++) {
    clutter(g, p, x0 + 0.24 + (i % 2) * 0.14, y0 + 1.15 + i * 0.19, 0.34, 0.8, i % 3 === 0 ? RAMPS.ALARM[2] : RAMPS.NEUTRAL[7])
  }
  plant(g, p, x1 - 0.5, y1 - 0.55, 1.0)
}

/**
 * A kitchenette island in the spine.
 *
 * The one landmark deliberately placed **in the middle of a walkway**, which is
 * where a real office puts one and which is why it works: it makes the corridor
 * into a place rather than a route, and §7.8.6's walkers have to go round it.
 */
function kitchenette(g: Graphics, p: Project, plot: LandmarkPlot, crowd: number) {
  const { x0, y0, x1, y1 } = plot
  const w = x1 - x0
  const d = y1 - y0
  isoPatch(g, p, x0, y0, x1, y1, RAMPS.NEUTRAL[3])
  isoPatch(g, p, x0 + 0.15, y0 + 0.15, x1 - 0.15, y1 - 0.15, RAMPS.NEUTRAL[4], 0.35)
  pool(g, p, x0 + w * 0.5, y0 + d * 0.5, Math.min(w, d) * 0.8, 0.15)
  // Stools on the far side, then the island, then stools on the near side —
  // the same ordering the meeting room's chairs need and for the same reason.
  const stools = 2 + Math.round(crowd * 2)
  for (let i = 0; i < stools; i++) {
    isoSolid(g, p, x0 + w * 0.22, y0 + 0.4 + (i * (d - 0.8)) / stools, 0, 0.26, 0.26, 0.3, {
      top: RAMPS.WOOD[2], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0],
    })
  }
  const ix = x0 + w * 0.36
  const iy = y0 + d * 0.16
  const iw = w * 0.34
  const id = d * 0.66
  surface(g, p, ix, iy, iw, id, 0.34, RAMPS.NEUTRAL[6], RAMPS.NEUTRAL[3])
  isoCap(g, p, ix, iy, 0.34, iw, id, CAP.kitchenette)
  // The sink, the kettle, the fruit bowl. Three objects, and they are enough
  // for the shape to read as a kitchen rather than as a low wall.
  isoPatch(g, p, ix + iw * 0.25, iy + id * 0.15, ix + iw * 0.7, iy + id * 0.4, RAMPS.NEUTRAL[3])
  clutter(g, p, ix + iw * 0.3, iy + id * 0.62, 0.34, 1.5, RAMPS.NEUTRAL[7])
  clutter(g, p, ix + iw * 0.55, iy + id * 0.82, 0.34, 1.1, RAMPS.FOLIAGE[1])
  for (let i = 0; i < Math.round(crowd * 4); i++) {
    clutter(g, p, ix + iw * 0.15 + i * 0.1, iy + id * 0.45, 0.34, 0.75, RAMPS.NEUTRAL[6])
  }
  for (let i = 0; i < stools; i++) {
    isoSolid(g, p, x0 + w * 0.78, y0 + 0.55 + (i * (d - 0.9)) / stools, 0, 0.26, 0.26, 0.3, {
      top: RAMPS.WOOD[2], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0],
    })
  }
}

/**
 * The core — lifts, risers and the WCs.
 *
 * The one solid volume on the floor, and the only object that makes the
 * building read as having *other floors*. A thousand-person studio reached by
 * no visible means of arrival is a diorama; a lift lobby is the difference
 * between a floor and a picture of a floor.
 *
 * It stands in the back band because it is two and a half tiles tall and it
 * needs a wall behind it. Every other landmark on this floor is under a tile
 * and a half for exactly that reason: the desk layer is drawn above the
 * furniture layer, so anything tall enough to reach a row *behind* it would be
 * painted over by that row's monitors.
 */
function core(g: Graphics, p: Project, plot: LandmarkPlot) {
  const { x0, y0, x1, y1 } = plot
  const w = x1 - x0
  const d = y1 - y0
  isoPatch(g, p, x0, y0, x1, y1, RAMPS.NEUTRAL[2])
  // The lobby mat, so the lifts have somewhere to open onto.
  isoPatch(g, p, x1 - 0.7, y0 + 0.2, x1, y1 - 0.2, RAMPS.NEUTRAL[1])
  // The shaft. Its near face is the doors, so it is drawn as one solid and
  // then written on.
  isoSolid(g, p, x0 + 0.1, y0 + 0.15, 0, w - 0.8, d * 0.62, 2.45, {
    top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2],
  })
  isoCap(g, p, x0 + 0.1, y0 + 0.15, 2.45, w - 0.8, d * 0.62, CAP.core)
  const doorY = y0 + 0.15
  for (let i = 0; i < 2; i++) {
    const dy = doorY + 0.25 + i * (d * 0.62 - 0.9)
    // A lift door is a panel in the near face: a dark inset, a bright seam down
    // the middle, and a call button beside it that is lit.
    isoSolid(g, p, x0 + w - 0.72, dy, 0, 0.04, 0.72, 1.5, {
      top: RAMPS.NEUTRAL[1], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1],
    })
    isoSolid(g, p, x0 + w - 0.74, dy + 0.34, 0, 0.04, 0.04, 1.5, {
      top: RAMPS.GLOW[1], left: RAMPS.GLOW[1], right: RAMPS.GLOW[0],
    })
    isoSolid(g, p, x0 + w - 0.74, dy + 0.78, 1.05, 0.04, 0.08, 0.1, {
      top: RAMPS.WARN[2], left: RAMPS.WARN[2], right: RAMPS.WARN[1],
    })
  }
  // The riser cupboard and the WC block beside the shaft, shorter so the core
  // reads as three volumes rather than one slab.
  isoSolid(g, p, x0 + 0.1, y0 + d * 0.66, 0, w - 0.5, d * 0.32, 2.0, {
    top: RAMPS.NEUTRAL[3], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1],
  })
  isoCap(g, p, x0 + 0.1, y0 + d * 0.66, 2.0, w - 0.5, d * 0.32, CAP.core)
  isoSolid(g, p, x0 + w - 0.44, y0 + d * 0.7, 0, 0.05, 0.5, 1.4, {
    top: RAMPS.WOOD[0], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0],
  })
  plant(g, p, x1 - 0.45, y0 + 0.05, 1.25)
}

/**
 * A breakout nook — a rug, two sofas, a low table and a lamp.
 *
 * The cheapest cosy object in the game and the one carrying the most weight.
 * The rug does most of it: an area of floor in a different material with
 * furniture standing on it reads as *somebody arranged this*, which is the one
 * thing a grid of desks can never say.
 */
function breakout(g: Graphics, p: Project, plot: LandmarkPlot, crowd: number, salt: number) {
  const { x0, y0, x1, y1 } = plot
  const w = x1 - x0
  const d = y1 - y0
  // The rug, with a border. Warm, because everything else on this floor is a
  // neutral and the rug is where the warmth is allowed to be.
  isoPatch(g, p, x0, y0, x1, y1, RAMPS.WOOD[0])
  isoPatch(g, p, x0 + 0.14, y0 + 0.14, x1 - 0.14, y1 - 0.14, RAMPS.WOOD[1])
  isoPatch(g, p, x0 + 0.34, y0 + 0.34, x1 - 0.34, y1 - 0.34, RAMPS.WOOD[0], 0.45)
  const long = w >= d
  // Two sofas facing each other across the long axis, so the nook has a middle
  // and the middle has a table in it. Their backs run on a floor axis — a sofa
  // on a diagonal has its back at a slope this floor plane has no room for.
  if (long) {
    seat(g, p, x0 + 0.2, y0 + d * 0.16, 0.46, d * 0.68, 'gx', RAMPS.CALM[1])
    lamp(g, p, x0 + w * 0.5, y0 + 0.16)
    surface(g, p, x0 + w * 0.42, y0 + d * 0.3, w * 0.22, d * 0.4, 0.24, RAMPS.WOOD[2], RAMPS.WOOD[1])
    clutter(g, p, x0 + w * 0.48, y0 + d * 0.44, 0.24, 1.1, RAMPS.NEUTRAL[7])
    for (let i = 0; i < Math.round(crowd * 4); i++) {
      clutter(g, p, x0 + w * 0.45 + i * 0.1, y0 + d * 0.56, 0.24, 0.8, RAMPS.NEUTRAL[6])
    }
    seat(g, p, x1 - 0.66, y0 + d * 0.16, 0.46, d * 0.68, 'gx', RAMPS.ALARM[1])
    plant(g, p, x1 - 0.5, y1 - 0.45, 1.1 + rnd(salt) * 0.3)
  } else {
    seat(g, p, x0 + w * 0.16, y0 + 0.2, w * 0.68, 0.46, 'gy', RAMPS.CALM[1])
    lamp(g, p, x0 + 0.16, y0 + d * 0.5)
    surface(g, p, x0 + w * 0.3, y0 + d * 0.42, w * 0.4, d * 0.22, 0.24, RAMPS.WOOD[2], RAMPS.WOOD[1])
    clutter(g, p, x0 + w * 0.44, y0 + d * 0.48, 0.24, 1.1, RAMPS.NEUTRAL[7])
    for (let i = 0; i < Math.round(crowd * 4); i++) {
      clutter(g, p, x0 + w * 0.56, y0 + d * 0.45 + i * 0.1, 0.24, 0.8, RAMPS.NEUTRAL[6])
    }
    seat(g, p, x0 + w * 0.16, y1 - 0.66, w * 0.68, 0.46, 'gy', RAMPS.ALARM[1])
    plant(g, p, x1 - 0.45, y1 - 0.5, 1.1 + rnd(salt) * 0.3)
  }
}

/**
 * The canteen, at the street end of the floor.
 *
 * Put here rather than buried in the middle for one reason: the front band is
 * the edge that looks out at §7.8.1e's road, so the one room people go to in
 * order to *stop working* is the one room with a view. It is also the room the
 * overflow desks are crowding toward, which is the joke telling itself.
 */
function cafeteria(g: Graphics, p: Project, plot: LandmarkPlot, crowd: number) {
  const { x0, y0, x1, y1 } = plot
  const w = x1 - x0
  const d = y1 - y0
  isoPatch(g, p, x0, y0, x1, y1, RAMPS.NEUTRAL[2])
  isoPatch(g, p, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, RAMPS.NEUTRAL[3], 0.55)
  // The servery along the back edge, with the hot counter lit.
  surface(g, p, x0 + 0.15, y0 + 0.3, 0.6, d - 0.6, 0.34, RAMPS.NEUTRAL[6], RAMPS.NEUTRAL[3])
  isoCap(g, p, x0 + 0.15, y0 + 0.3, 0.34, 0.6, d - 0.6, CAP.cafeteria)
  isoPatch(g, p, x0 + 0.9, y0 + 0.3, x0 + 1.5, y1 - 0.3, RAMPS.WARN[2], 0.14)
  // Tables in two rows, each with its own pendant. Not a grid of identical
  // ones: a couple are pushed together, which is what a canteen looks like
  // twenty minutes after it opens.
  const cols = Math.max(2, Math.floor((d - 1.4) / 1.7))
  const rows = Math.max(2, Math.floor((w - 1.6) / 1.9))
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const salt = r * 7 + i
      const tx = x0 + 1.5 + r * 1.9 + rnd(salt) * 0.12
      const ty = y0 + 0.7 + i * 1.7 + rnd(salt + 3) * 0.16
      pool(g, p, tx + 0.35, ty + 0.35, 0.85, 0.1)
      seat(g, p, tx - 0.36, ty + 0.1, 0.3, 0.5, 'gx', RAMPS.WOOD[1])
      surface(g, p, tx, ty, 0.7, 0.72, 0.3, RAMPS.WOOD[2], RAMPS.WOOD[1])
      if (rnd(salt + 11) > 0.55) clutter(g, p, tx + 0.3, ty + 0.3, 0.3, 1, RAMPS.NEUTRAL[7])
      for (let k = 0; k < Math.round(crowd * 2); k++) {
        clutter(g, p, tx + 0.18 + k * 0.13, ty + 0.5, 0.3, 0.8, RAMPS.ALARM[2])
      }
      seat(g, p, tx + 0.76, ty + 0.1, 0.3, 0.5, 'gx', RAMPS.WOOD[1])
    }
  }
  // Planters along the street edge, so the room has a boundary that is not a
  // wall — and so the front of the floor has something green on it.
  for (let i = 0; i < Math.max(2, Math.round(d / 2.4)); i++) {
    plant(g, p, x1 - 0.55, y0 + 0.6 + i * 2.2, 1.2)
  }
}

/**
 * Draw every landmark on the floor.
 *
 * Sorted by screen depth — `gx + gy` at the far corner — so a nook in front of
 * a meeting room is painted after it. One `Graphics` and one sort is the whole
 * of the depth handling here, and it is enough because no two plots overlap:
 * the plan guarantees that, and `floorplan.test.ts` asserts it.
 *
 * `devs` drives {@link crowd}, which is §7.8.1d's amended crowding — the rooms
 * do not empty as the studio fills, they *fill*.
 */
export function drawLandmarks(
  g: Graphics,
  p: Project,
  plots: readonly LandmarkPlot[],
  devs: number,
): void {
  // Ramps from nothing at three hundred to full at the cap. Below three hundred
  // the studio has not yet reached the band §7.8.1 calls crowded, and a
  // kitchenette buried under mugs at a hundred and fifty developers is a joke
  // told before its setup.
  const crowd = Math.max(0, Math.min(1, (devs - 300) / 700))
  const order = [...plots].sort((a, b) => a.x0 + a.y0 - (b.x0 + b.y0))
  for (const [i, plot] of order.entries()) {
    switch (plot.kind) {
      case 'meeting':
        meeting(g, p, plot, crowd)
        break
      case 'library':
        library(g, p, plot, crowd)
        break
      case 'pantry':
        pantry(g, p, plot, crowd)
        break
      case 'kitchenette':
        kitchenette(g, p, plot, crowd)
        break
      case 'core':
        core(g, p, plot)
        break
      case 'breakout':
        breakout(g, p, plot, crowd, i)
        break
      case 'cafeteria':
        cafeteria(g, p, plot, crowd)
        break
    }
  }
}
