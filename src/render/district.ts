/**
 * The district — the ground the studio stands in. GDD §7.8.1e.
 *
 * ## What this replaces
 *
 * `apron.ts`, which put a road on the **two open sides only** and left the two
 * back sides as `NEUTRAL[0]` void. That was the right first cut — those are the
 * sides you can see past — but it answered the wrong half of the problem. The
 * void was never mostly *below* the building; it was mostly **above** it, in the
 * two upper corners of the frame either side of the roofline, and no amount of
 * kerb on the near sides fills that.
 *
 * Reported as *"increase immersion so create roads and scenes all around the
 * structure"*, and the fix is the literal reading: the street is a **ring**, and
 * across the far side of it there is a **city**.
 *
 * ## Why the far side is where the value is
 *
 * The two back walls rise `WALL_H` above the room's north corner, and everything
 * beyond them projects *higher up the screen* than that — so a row of buildings
 * set back behind the studio appears above and to either side of its roof, in
 * exactly the part of the frame that had nothing in it. It costs no fill inside
 * the room, it cannot occlude anybody, and it is the single change that turns a
 * lit rectangle into a building standing somewhere.
 *
 * And the windows in it are **warm**. §7.8.1's opening frame is one monitor in a
 * dark garage; a street lamp outside was already the second light source, and a
 * hundred lit windows across the road is the third. That is the whole of the
 * "cosy" brief: the studio is not the only place with the lights on.
 *
 * ## The rule kept from `apron.ts`
 *
 * **It is the same ground at every rung.** The garage's driveway meets a road;
 * the thousand-person floor's car park meets the same road, and the same city is
 * across it. You never left the street — the building ate it. That is why this
 * module takes the shell's own half-extents rather than a headcount: the ring
 * grows with the walls for free and the kerb stays where the kerb was.
 *
 * ## Units
 *
 * Grid **tiles**, projected through the caller's `project`. No coordinate in
 * this file is a screen pixel, for the reason §7.8.12 records at length: a
 * screen-pixel offset inside an isometric scene is how you end up with a wall at
 * a slope of −0.39.
 */
import type { Graphics } from 'pixi.js'
import { RAMPS } from '../art/palette.ts'
import { isoPatch, isoSolid, type Project } from './isoSolid.ts'

export interface DistrictShell {
  /** Half-extent along `gx`, in tiles — the axis the back-left wall runs on. */
  readonly halfBack: number
  /** Half-extent along `gy`, in tiles. */
  readonly halfAcross: number
}

/**
 * How deep the street is on the **near** sides, in tiles.
 *
 * Not a constant, and not proportional either. A fixed depth reads as a shelf
 * around a garage and as a kerb around a floor of a thousand; a proportional one
 * puts a forty-tile road beside a two-desk room. So it grows with the room and
 * then stops: the road is the same road, and past some point the studio is
 * simply a bigger thing standing next to it.
 */
export function districtDepth(halfBack: number, halfAcross: number): number {
  const span = Math.max(halfBack, halfAcross)
  return Math.max(6.3, Math.min(15, 4.2 + span * 0.34))
}

/**
 * How far back the neighbours stand, in tiles — and it is **half** the near
 * depth on purpose.
 *
 * A symmetric ring would be more honest as town planning and worse as a
 * picture. The far side is seen almost edge-on, foreshortened into the top
 * corners of the frame, so every tile spent on it is a tile of skyline pushed
 * out of shot. A service lane and a footway is enough road to read; what the
 * frame wants up there is the *buildings*.
 */
export function skylineSetback(halfBack: number, halfAcross: number): number {
  return districtDepth(halfBack, halfAcross) * 0.52
}

/** The bands, as fractions of {@link districtDepth}, from the shell outward. */
export const FORECOURT = 0.4
export const KERB = 0.43
export const FOOTWAY = 0.57
export const CARRIAGEWAY = 0.86
/** The rest is the far footway, kept as the remainder so the bands always sum. */

/**
 * How much of the district the camera has to keep in frame, in tiles.
 *
 * **Not all of it, deliberately.** Framing the whole ring would shrink a full
 * floor by a fifth to show a road nobody is looking at, and the reference does
 * not do that either: its buildings sit close to the frame edge with the ground
 * visible in the corners. This is enough for the forecourt, the kerb and the
 * near footway — the part that reads as "standing on something" — and the
 * carriageway is allowed to bleed.
 *
 * It went from 3.0 to 3.6 when the ring closed, and that is the entire cost of
 * this section: about six per cent of the fill at a full floor, in exchange for
 * the building having a street on every side of it.
 */
export function districtFitTiles(halfBack: number, halfAcross: number): number {
  return Math.min(3.6, districtDepth(halfBack, halfAcross) * FORECOURT * 0.62)
}

/**
 * Deterministic jitter. The district must draw the same on every rebuild — a
 * street whose trees move when somebody is hired is a street nobody believes,
 * and the room rebuilds on every single hire.
 */
function rnd(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

/** Body colours for the parked cars. Four, all already in the master palette. */
export const CAR_BODIES = [RAMPS.NEUTRAL[3], RAMPS.WOOD[0], RAMPS.FOLIAGE[0], RAMPS.CALM[1]]

/** Facade colours for the neighbours. Ordinary buildings, ordinary stone. */
const FACADES = [
  { top: RAMPS.NEUTRAL[3], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1] },
  { top: RAMPS.WOOD[1], left: RAMPS.WOOD[0], right: RAMPS.NEUTRAL[1] },
  { top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2] },
  { top: RAMPS.NEUTRAL[2], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[0] },
]

/**
 * A prop queued for drawing, with the screen depth it sorts on.
 *
 * Everything with volume goes through this. Painting the props in the order the
 * loops happen to generate them puts a tree in front of the building behind it
 * about a third of the time — and unlike a flat band, that is visible.
 */
interface Prop {
  depth: number
  draw(): void
}

/**
 * The lit windows on a neighbour's two visible faces.
 *
 * The single cheapest object in this file and the one carrying the brief. A
 * blank facade is a grey box; the same box with a scatter of warm squares in it
 * is a building with people in it at night, and the studio is suddenly not the
 * only lit thing in the world.
 *
 * Drawn as very thin solids lying *in* each face rather than as flat rectangles
 * on the screen — the same discipline the whole scene keeps. A window drawn as
 * an upright screen-space rectangle is the sticker-on-the-glass mistake, and on
 * a facade seen at this angle it is obvious immediately.
 */
function windows(
  g: Graphics,
  p: Project,
  gx: number,
  gy: number,
  w: number,
  d: number,
  h: number,
  salt: number,
) {
  const floors = Math.max(2, Math.floor(h / 0.62))
  const across = Math.max(2, Math.floor(d / 0.66))
  const back = Math.max(2, Math.floor(w / 0.66))
  for (let f = 0; f < floors; f++) {
    const z = 0.36 + f * ((h - 0.5) / floors)
    // The face turned down-left, toward ART_DIRECTION §7's light. Its windows
    // read as reflecting the sky; the shadow face's read as lit from inside,
    // which is why the two ramps below are different.
    for (let i = 0; i < across; i++) {
      const lit = rnd(salt * 31 + f * 7 + i) > 0.46
      const y = gy + 0.24 + (i * (d - 0.48)) / across
      isoSolid(g, p, gx + w - 0.03, y, z, 0.03, (d - 0.48) / across - 0.16, 0.3, {
        top: RAMPS.NEUTRAL[1],
        left: lit ? RAMPS.WARN[2] : RAMPS.NEUTRAL[1],
        right: lit ? RAMPS.WARN[1] : RAMPS.NEUTRAL[0],
      })
    }
    for (let i = 0; i < back; i++) {
      const lit = rnd(salt * 53 + f * 11 + i) > 0.52
      const x = gx + 0.24 + (i * (w - 0.48)) / back
      isoSolid(g, p, x, gy + d - 0.03, z, (w - 0.48) / back - 0.16, 0.03, 0.3, {
        top: RAMPS.NEUTRAL[1],
        left: lit ? RAMPS.WARN[3] : RAMPS.NEUTRAL[2],
        right: lit ? RAMPS.WARN[2] : RAMPS.NEUTRAL[1],
      })
    }
  }
}

/**
 * One neighbour across the road.
 *
 * Boxes with parapets and the odd roof plant. Deliberately plain: these are
 * scenery a hundred tiles from anything the player can touch, and ART_DIRECTION
 * §4's T3 commodity tier says a building at that distance is a silhouette with
 * some lit windows in it. What makes the row read is the *variation in height*,
 * which is free, rather than detail, which is not.
 */
function neighbour(g: Graphics, p: Project, gx: number, gy: number, w: number, d: number, h: number, salt: number) {
  const face = FACADES[Math.floor(rnd(salt * 7) * FACADES.length) % FACADES.length]
  isoSolid(g, p, gx, gy, 0, w, d, h, face)
  windows(g, p, gx, gy, w, d, h, salt)
  // The parapet — a thin lip standing proud of the roof. One quad, and it is
  // what stops a tower reading as a solid extruded rectangle.
  isoSolid(g, p, gx - 0.06, gy - 0.06, h, w + 0.12, d + 0.12, 0.16, {
    top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[1],
  })
  if (rnd(salt * 17) > 0.55) {
    // Roof plant: the water tank, the AC, the thing on top of every real
    // building and no drawn one.
    isoSolid(g, p, gx + w * 0.28, gy + d * 0.3, h + 0.16, w * 0.3, d * 0.28, 0.44, {
      top: RAMPS.NEUTRAL[3], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1],
    })
  }
  if (rnd(salt * 23) > 0.72) {
    // An aerial mast with a red lamp on it. One pixel of ALARM at the top of
    // the frame, which is the only thing up there that moves the eye.
    isoSolid(g, p, gx + w * 0.6, gy + d * 0.6, h + 0.16, 0.08, 0.08, 0.9, {
      top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2],
    })
    isoSolid(g, p, gx + w * 0.6 - 0.02, gy + d * 0.6 - 0.02, h + 1.06, 0.12, 0.12, 0.12, {
      top: RAMPS.ALARM[3], left: RAMPS.ALARM[2], right: RAMPS.ALARM[1],
    })
  }
}

/**
 * A stylised tree — a trunk and three tapering blocks.
 *
 * Deliberately blocky. ART_DIRECTION §4 classes street furniture as T3
 * commodity, and a cone of three solids reads as a tree at the size this is ever
 * seen while staying in the same projection as everything else. A billboarded
 * round tree would be the upright-prop mistake again.
 */
function tree(g: Graphics, p: Project, gx: number, gy: number, s: number) {
  isoSolid(g, p, gx + 0.19 * s, gy + 0.19 * s, 0, 0.13 * s, 0.13 * s, 0.32 * s,
    { top: RAMPS.WOOD[1], left: RAMPS.WOOD[0], right: RAMPS.NEUTRAL[1] })
  isoSolid(g, p, gx, gy, 0.28 * s, 0.5 * s, 0.5 * s, 0.32 * s,
    { top: RAMPS.FOLIAGE[1], left: RAMPS.FOLIAGE[0], right: RAMPS.NEUTRAL[1] })
  isoSolid(g, p, gx + 0.08 * s, gy + 0.08 * s, 0.56 * s, 0.34 * s, 0.34 * s, 0.28 * s,
    { top: RAMPS.FOLIAGE[1], left: RAMPS.FOLIAGE[1], right: RAMPS.FOLIAGE[0] })
  isoSolid(g, p, gx + 0.16 * s, gy + 0.16 * s, 0.8 * s, 0.18 * s, 0.18 * s, 0.22 * s,
    { top: RAMPS.NEUTRAL[4], left: RAMPS.FOLIAGE[1], right: RAMPS.FOLIAGE[0] })
}

/**
 * A street lamp, and the pool it throws.
 *
 * The pool matters more than the lamp. §7.8.1's first frame is "a dark home
 * garage, lit only by the monitor", and a second light source *outside* is what
 * makes the first one read as interior.
 */
export function lamp(g: Graphics, p: Project, gx: number, gy: number) {
  const r = 1.9
  isoPatch(g, p, gx - r * 0.6, gy - r * 0.6, gx + r, gy + r, RAMPS.WARN[2], 0.1)
  isoSolid(g, p, gx, gy, 0, 0.12, 0.12, 1.6,
    { top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2] })
  isoSolid(g, p, gx - 0.07, gy - 0.07, 1.6, 0.26, 0.26, 0.1,
    { top: RAMPS.WARN[3], left: RAMPS.WARN[2], right: RAMPS.WARN[1] })
}

/** A parked car: a body and a glasshouse. Two solids, and it is enough. */
export function car(g: Graphics, p: Project, gx: number, gy: number, body: string, along: 'gx' | 'gy') {
  const w = along === 'gy' ? 0.8 : 1.7
  const d = along === 'gy' ? 1.7 : 0.8
  isoSolid(g, p, gx, gy, 0, w, d, 0.28, { top: body, left: body, right: RAMPS.NEUTRAL[0] })
  // Dark glass, not a lit monitor. `GLOW[1]` put a row of bright cyan slabs
  // along the kerb that pulled the eye straight off the studio.
  isoSolid(g, p, gx + (along === 'gy' ? 0.07 : 0.42), gy + (along === 'gy' ? 0.42 : 0.07), 0.28,
    along === 'gy' ? 0.66 : 0.86, along === 'gy' ? 0.86 : 0.66, 0.24,
    { top: RAMPS.GLOW[0], left: RAMPS.NEUTRAL[1], right: RAMPS.NEUTRAL[0] })
}

/** A bench on the footway. Somewhere for the scene to have been sat in. */
function bench(g: Graphics, p: Project, gx: number, gy: number, along: 'gx' | 'gy') {
  const w = along === 'gy' ? 0.34 : 1.5
  const d = along === 'gy' ? 1.5 : 0.34
  isoSolid(g, p, gx, gy, 0, w, d, 0.24, { top: RAMPS.WOOD[2], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0] })
  if (along === 'gy') {
    isoSolid(g, p, gx, gy, 0.24, 0.08, d, 0.34, { top: RAMPS.WOOD[1], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0] })
  } else {
    isoSolid(g, p, gx, gy, 0.24, w, 0.08, 0.34, { top: RAMPS.WOOD[1], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0] })
  }
}

/** A planter — a box with a hedge in it. The green on the near footway. */
function planter(g: Graphics, p: Project, gx: number, gy: number, w: number, d: number) {
  isoSolid(g, p, gx, gy, 0, w, d, 0.28, { top: RAMPS.NEUTRAL[3], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1] })
  isoSolid(g, p, gx + 0.06, gy + 0.06, 0.28, w - 0.12, d - 0.12, 0.3, {
    top: RAMPS.FOLIAGE[1], left: RAMPS.FOLIAGE[0], right: RAMPS.NEUTRAL[1],
  })
}

/** A bike rack: three hoops read as three thin posts. */
function bikes(g: Graphics, p: Project, gx: number, gy: number) {
  for (let i = 0; i < 3; i++) {
    isoSolid(g, p, gx, gy + i * 0.42, 0, 0.06, 0.3, 0.55, {
      top: RAMPS.NEUTRAL[5], left: RAMPS.NEUTRAL[4], right: RAMPS.NEUTRAL[3],
    })
  }
}

/**
 * The bus shelter — a roof on two posts, a bench under it, a lit panel.
 *
 * The one piece of street furniture that says the studio is *reachable*. A
 * building with a car park is a building people drive to; a building with a bus
 * stop is a building in a city, which is the difference this section is for.
 */
function shelter(g: Graphics, p: Project, gx: number, gy: number) {
  isoPatch(g, p, gx - 0.2, gy - 0.2, gx + 0.9, gy + 2.6, RAMPS.NEUTRAL[3], 0.5)
  bench(g, p, gx + 0.1, gy + 0.4, 'gy')
  // The lit timetable panel, which is also the warmest thing at street level.
  isoSolid(g, p, gx + 0.72, gy + 1.9, 0, 0.06, 0.7, 1.3, {
    top: RAMPS.NEUTRAL[3], left: RAMPS.WARN[2], right: RAMPS.NEUTRAL[2],
  })
  for (const at of [gy, gy + 2.2]) {
    isoSolid(g, p, gx + 0.72, at, 0, 0.08, 0.08, 1.45, {
      top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2],
    })
  }
  isoSolid(g, p, gx - 0.05, gy - 0.1, 1.45, 0.95, 2.7, 0.1, {
    top: RAMPS.NEUTRAL[4], left: RAMPS.NEUTRAL[2], right: RAMPS.NEUTRAL[1],
  })
}

/**
 * Draw the district for a shell.
 *
 * Called **before** the slab, so the room is painted on top of its own ground
 * rather than the other way round. It goes into the shell's own `Graphics`
 * deliberately: the district belongs to the room, fades with it during a resize,
 * and a separate layer would have needed its own copy of every alpha the
 * §7.8.1c transition already owns.
 *
 * Two passes. **Every flat band first** — they are disjoint rings, so their
 * order among themselves does not matter — and then every solid, sorted by
 * screen depth. Painting the solids in the order the loops generate them puts a
 * tree in front of the building behind it about a third of the time.
 */
export function drawDistrict(g: Graphics, p: Project, shell: DistrictShell): void {
  const hb = shell.halfBack
  const ha = shell.halfAcross
  const d = districtDepth(hb, ha)
  const back = skylineSetback(hb, ha)
  const blockDepth = Math.max(4.5, d * 0.55)
  const outer = d + 2

  /**
   * One band of the ring, as four strips.
   *
   * A true ring polygon would be eight points with a hole in it, which `fill`
   * cannot express; four disjoint quads tile the same area exactly and each one
   * is a rectangle in the grid's own axes, so every edge lies on the floor.
   */
  const ring = (t0: number, t1: number, fill: string, alpha = 1) => {
    isoPatch(g, p, -hb - t1, -ha - t1, -hb - t0, ha + t1, fill, alpha)
    isoPatch(g, p, hb + t0, -ha - t1, hb + t1, ha + t1, fill, alpha)
    isoPatch(g, p, -hb - t0, -ha - t1, hb + t0, -ha - t0, fill, alpha)
    isoPatch(g, p, -hb - t0, ha + t0, hb + t0, ha + t1, fill, alpha)
  }
  /** The same, on the two open sides only — the near street is deeper. */
  const nearBand = (t0: number, t1: number, fill: string, alpha = 1) => {
    isoPatch(g, p, hb + t0, -ha - back, hb + t1, ha + t1, fill, alpha)
    isoPatch(g, p, -hb - back, ha + t0, hb + t0, ha + t1, fill, alpha)
  }

  // --- the ground ---------------------------------------------------------
  isoPatch(g, p, -hb - back - blockDepth - 2, -ha - back - blockDepth - 2, hb + outer, ha + outer, RAMPS.NEUTRAL[0])

  // --- the far side: a service lane, a footway, and the city ---------------
  //
  // Shallow, because it is seen almost edge-on. What the frame wants up there
  // is the buildings, not the tarmac.
  // **The ground outside is darker than the ground inside.** [2026-09-02]
  //
  // The kerb line was `[4]` and the far footway `[2]`, which put the brightest
  // strips in the picture *outside* the building — §7.8.0c measured the
  // canonical garage and found its carriageway at `[0]` and its footway barely
  // above it. A studio with the lights on at night is the light source in its
  // own street, and it was reading as a model on a lit table instead.
  ring(0, back * 0.34, RAMPS.NEUTRAL[1])
  ring(back * 0.34, back * 0.4, RAMPS.NEUTRAL[2])
  ring(back * 0.4, back * 0.78, RAMPS.NEUTRAL[0])
  ring(back * 0.78, back, RAMPS.NEUTRAL[1])

  // --- the near side: forecourt, kerb, footway, carriageway ----------------
  // Same argument on the near side, where it matters most: this is the band the
  // camera looks across to reach the room. The kerb keeps one step of lift over
  // the footway, because a kerb that is the same value as the pavement is not a
  // kerb — but it is a step near the bottom of the ramp now, not near the top.
  nearBand(back, d * FORECOURT, RAMPS.NEUTRAL[1])
  nearBand(d * FORECOURT, d * KERB, RAMPS.NEUTRAL[2])
  nearBand(d * KERB, d * FOOTWAY, RAMPS.NEUTRAL[1])
  nearBand(d * FOOTWAY, d * CARRIAGEWAY, RAMPS.NEUTRAL[0])
  nearBand(d * CARRIAGEWAY, d, RAMPS.NEUTRAL[1])

  // The centre dashes. Dashed rather than solid, because a solid line is a lane
  // edge and a dashed one is a road you may cross — and this is a road the
  // studio's own people walk over.
  const midX = hb + d * (FOOTWAY + CARRIAGEWAY) * 0.5
  const midY = ha + d * (FOOTWAY + CARRIAGEWAY) * 0.5
  for (let i = 0; i * 2.4 < ha + hb + d * 2; i++) {
    const y = -ha - back + i * 2.4
    if (y + 1.4 < ha + outer) isoPatch(g, p, midX - 0.07, y, midX + 0.07, y + 1.4, RAMPS.WARN[3], 0.42)
    const x = -hb - back + i * 2.4
    if (x + 1.4 < hb + outer) isoPatch(g, p, x, midY - 0.07, x + 1.4, midY + 0.07, RAMPS.WARN[3], 0.42)
  }
  // A zebra crossing on each near road, opposite the middle of the building —
  // which is also where §7.8.6's walkers would leave if they ever did.
  for (let i = 0; i < 6; i++) {
    isoPatch(g, p, hb + d * FOOTWAY, -ha * 0.1 + i * 0.34, hb + d * CARRIAGEWAY, -ha * 0.1 + i * 0.34 + 0.18, RAMPS.NEUTRAL[7], 0.5)
    isoPatch(g, p, -hb * 0.1 + i * 0.34, ha + d * FOOTWAY, -hb * 0.1 + i * 0.34 + 0.18, ha + d * CARRIAGEWAY, RAMPS.NEUTRAL[7], 0.5)
  }

  // --- everything with volume, in depth order ------------------------------
  const props: Prop[] = []
  const at = (gx: number, gy: number, draw: () => void) => props.push({ depth: gx + gy, draw })

  // The neighbours, across the far road on both back sides. They run past the
  // corners on purpose: a row that stops exactly where the building stops reads
  // as a stage flat, and the corner is the one place the eye can check.
  const runFar = ha + back + blockDepth + 4
  for (let i = 0, y = -ha - back - blockDepth - 2; y < runFar; i++) {
    const w = 3.4 + rnd(i * 3) * 2.6
    const wide = 2.6 + rnd(i * 5 + 1) * 2.8
    const h = 2.2 + rnd(i * 11 + 2) * 4.6
    const gx = -hb - back - blockDepth - w * 0.5 - rnd(i * 13) * 1.2
    at(gx, y, () => neighbour(g, p, gx, y, w, wide, h, i + 1))
    y += wide + 0.5 + rnd(i * 7) * 0.7
  }
  const runFar2 = hb + back + blockDepth + 4
  for (let i = 0, x = -hb - back - blockDepth - 2; x < runFar2; i++) {
    const w = 2.6 + rnd(i * 17 + 4) * 2.8
    const deep = 3.4 + rnd(i * 19 + 5) * 2.6
    const h = 2.2 + rnd(i * 23 + 6) * 4.6
    const gy = -ha - back - blockDepth - deep * 0.5 - rnd(i * 29) * 1.2
    at(x, gy, () => neighbour(g, p, x, gy, w, deep, h, i + 40))
    x += w + 0.5 + rnd(i * 31) * 0.7
  }

  // Street trees on the far footway, which is where a verge would be.
  for (let i = 0, y = -ha - back * 0.9; y < ha + outer; i++, y += 3.1) {
    const gx = -hb - back * 0.88
    const s = 1.05 + rnd(i + 60) * 0.25
    at(gx, y, () => tree(g, p, gx, y, s))
  }
  for (let i = 0, x = -hb - back * 0.9; x < hb + outer; i++, x += 3.1) {
    const gy = -ha - back * 0.88
    const s = 1.05 + rnd(i + 80) * 0.25
    at(x, gy, () => tree(g, p, x, gy, s))
  }

  // Parking bays on the forecourt, and cars in about two thirds of them.
  //
  // **The pitch has to clear the car**, which the first version did not: bays
  // every 1.55 tiles with a car 1.7 long overlapped every neighbour, so a
  // thousand-person forecourt came out as one continuous ribbon of bodywork
  // running the length of the kerb. A car park is only legible as a car park
  // when you can see the gaps — and the empty bays are what make the others read
  // as *parked* rather than as a pattern.
  const BAY = 2.15
  const bays = Math.max(1, Math.floor((ha + d * FORECOURT) / BAY))
  for (let i = 0; i < bays; i++) {
    const y = -ha + 0.3 + i * BAY
    isoPatch(g, p, hb + 0.25, y, hb + d * FORECOURT - 0.4, y + 0.06, RAMPS.NEUTRAL[3], 0.5)
    if (rnd(i * 3 + 1) > 0.34) {
      const body = CAR_BODIES[i % CAR_BODIES.length]
      at(hb + 0.45, y + 0.2, () => car(g, p, hb + 0.45, y + 0.2, body, 'gy'))
    }
  }
  // And a couple at the kerb on the other near side, so the street is used on
  // both sides of the corner rather than only where the car park is.
  for (let i = 0; i < 3; i++) {
    const x = -hb + 1.4 + i * 3.1
    const gy = ha + d * (FOOTWAY + 0.03)
    const body = CAR_BODIES[(i + 2) % CAR_BODIES.length]
    at(x, gy, () => car(g, p, x, gy, body, 'gx'))
  }

  // The near footway's own furniture — the part of the scene at the size the
  // camera actually frames, and therefore the part worth spending on.
  const footX = hb + d * (KERB + 0.04)
  const footY = ha + d * (KERB + 0.04)
  at(footX, -ha * 0.55, () => shelter(g, p, footX, -ha * 0.55))
  at(footX, ha * 0.35, () => bench(g, p, footX + 0.2, ha * 0.35, 'gy'))
  at(-hb * 0.5, footY, () => bench(g, p, -hb * 0.5, footY + 0.2, 'gx'))
  at(hb * 0.2, footY, () => bikes(g, p, hb * 0.2, footY + 0.2))
  for (let i = 0; i < Math.max(2, Math.round(ha / 6)); i++) {
    const y = -ha + 1.2 + i * 5.4
    at(footX, y, () => planter(g, p, footX + 0.1, y, 0.5, 1.6))
  }
  for (let i = 0; i < Math.max(2, Math.round(hb / 6)); i++) {
    const x = -hb + 1.2 + i * 5.4
    at(x, footY, () => planter(g, p, x, footY + 0.1, 1.6, 0.5))
  }
  // Trees on the near footway too, spaced off the room's own extent so they
  // never bunch: a garage gets two and a floor gets ten, and neither is tuned.
  for (let i = 0, y = -ha + 2.6; y < ha + d * 0.4; i++, y += 3.4) {
    const gx = hb + d * (FOOTWAY - 0.06)
    const s = 1.1 + rnd(i + 100) * 0.25
    at(gx, y, () => tree(g, p, gx, y, s))
  }
  for (let i = 0, x = -hb + 2.6; x < hb + d * 0.4; i++, x += 3.4) {
    const gy = ha + d * (FOOTWAY - 0.06)
    const s = 1.1 + rnd(i + 120) * 0.25
    at(x, gy, () => tree(g, p, x, gy, s))
  }

  // Lamps on all four kerbs. Four light sources outside the building, which is
  // three more than the room had and the whole reason the near corners of the
  // frame stopped being black.
  const lamps: Array<[number, number]> = [
    [footX, -ha * 0.15],
    [footX, ha * 0.75],
    [-hb * 0.15, footY],
    [hb * 0.75, footY],
    [-hb - back * 0.86, ha * 0.4],
    [hb * 0.4, -ha - back * 0.86],
  ]
  for (const [lx, ly] of lamps) at(lx, ly, () => lamp(g, p, lx, ly))

  props.sort((a, b) => a.depth - b.depth)
  for (const prop of props) prop.draw()
}
