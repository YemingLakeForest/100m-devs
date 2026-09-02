/**
 * The plaza, and the plinth in the middle of it. GDD §7.8.1d [added 2026-08-31].
 *
 * ## Where it goes, and what it costs
 *
 * The transverse corridor between the two rows of squads, which is
 * `CORRIDOR_ROWS = 2` row-steps deep — and a row step is `PITCH_ROW = 2.1`
 * tiles, so that corridor is already **4.2 tiles** of empty floor running the
 * whole width of the room. Nothing has to move. The plaza is drawn into space
 * `gridFor()` has always left blank, which is the same argument the kitchenette
 * islands make one scale down: the circulation is the free real estate.
 *
 * ## Why an octagon
 *
 * Because it is the only rounded shape this projection gives you for free. An
 * octagon laid out in **grid** space puts four of its edges on the floor axes —
 * screen slope ±0.50, the only legal value — and four on the floor's own
 * diagonals, which come out exactly vertical and exactly horizontal on screen.
 * Every edge is a real direction in the floor plane. A circle approximated in
 * screen pixels would be the same class of mistake as the kite-shaped floor
 * plate §7.8.12 records: a shape that is not lying on the ground.
 *
 * `test:room` asserts this, and `plaza.test.ts` proves it about the points
 * before they are ever drawn.
 *
 * ## And it has a job
 *
 * §7.8.6's errands and the slack-off walkers need somewhere to *go*, and the
 * only destinations on the floor were a water cooler and a wall. Every person
 * sitting in the ring is a person not at a desk, which is the §4.1 entropy
 * argument standing up and walking across the room.
 */
import type { Graphics } from 'pixi.js'
import { RAMPS } from '../art/palette.ts'
import { isoCap, isoPatch, isoPoly, isoSolid, type Project } from './isoSolid.ts'

/** The inlay's outer radius, in tiles. Sized to sit inside a 4.2-tile corridor. */
export const PLAZA_RADIUS = 1.85
/** How far out the ring of seating sits. */
const RING = 1.28
/** Where the planters stand, just outside the inlay. */
const PLANTER = PLAZA_RADIUS + 0.42

/**
 * An octagon in grid space.
 *
 * The corner cut is 0.415 of the radius rather than the regular octagon's
 * 0.414, which is not a rounding error: at the sizes this is drawn the two are
 * indistinguishable and the rounder number is easier to check by eye against a
 * grid. What matters is that four edges run on `gx`/`gy` and four on the two
 * floor diagonals, and that is true of any `k` strictly between 0 and `r`.
 */
export function octagonPoints(cx: number, cy: number, r: number): Array<[number, number]> {
  const k = r * 0.415
  return [
    [cx - k, cy - r], [cx + k, cy - r],
    [cx + r, cy - k], [cx + r, cy + k],
    [cx + k, cy + r], [cx - k, cy + r],
    [cx - r, cy + k], [cx - r, cy - k],
  ]
}

/**
 * Which rung of the vanity item this headcount has earned.
 *
 * −1 is "no plinth at all": below the unfold there is no plaza to put one in.
 * 0 is an **empty plinth** — facilities built it before anybody had decided what
 * goes on it — and it is deliberately the first thing that arrives, because it
 * is three boxes, it is funny on its own, and it makes the slot visible before
 * there is anything in it.
 *
 * The steps are §7.8.1's own bands rather than round numbers: the unfold, then
 * the point where the floor is visibly busy, then the two crowding thresholds,
 * then the cap.
 */
export function statueRung(devs: number): number {
  if (devs < 100) return -1
  if (devs < 200) return 0
  if (devs < 400) return 1
  if (devs < 700) return 2
  if (devs < 1000) return 3
  return 4
}

/** What the statue is cast in, per rung. Materials, not colours. */
const MATERIAL = [
  { top: RAMPS.NEUTRAL[5], left: RAMPS.NEUTRAL[4], right: RAMPS.NEUTRAL[2] }, // stone
  { top: RAMPS.WOOD[3], left: RAMPS.WOOD[2], right: RAMPS.WOOD[1] }, // foamboard
  { top: RAMPS.NEUTRAL[6], left: RAMPS.NEUTRAL[5], right: RAMPS.NEUTRAL[3] }, // resin
  { top: RAMPS.WOOD[3], left: RAMPS.WOOD[2], right: RAMPS.WOOD[0] }, // bronze
  { top: RAMPS.WARN[3], left: RAMPS.WARN[2], right: RAMPS.WARN[1] }, // gilded
]

const STONE = { top: RAMPS.NEUTRAL[5], left: RAMPS.NEUTRAL[4], right: RAMPS.NEUTRAL[2] }
const SOFA = { top: RAMPS.WOOD[2], left: RAMPS.WOOD[1], right: RAMPS.WOOD[0] }
const LEAF = { top: RAMPS.FOLIAGE[1], left: RAMPS.FOLIAGE[1], right: RAMPS.FOLIAGE[0] }

export interface PlazaOptions {
  /** Plaza centre, in tiles, in the same frame `project` consumes. */
  readonly cx: number
  readonly cy: number
  /** {@link statueRung} for the studio's headcount. */
  readonly rung: number
  /**
   * The founder's torso footprint, in tiles, as `room.ts` already computes it.
   *
   * Passed in rather than derived here on ART_DIRECTION §0's rule: the table
   * that says how wide a `knit` is lives in exactly one place, and a statue
   * that disagreed with the person it is a statue of would be the loudest
   * possible version of that bug.
   */
  readonly torso: { readonly w: number; readonly h: number }
}

/** The plinth's half-width, in tiles. Narrow and tall, or it draws a slab. */
const PLINTH = 0.82

/**
 * The vanity item — **the founder, cast.**
 *
 * Built from the same two solids a developer is, at the scale the caller hands
 * over in `torso`, out of the look the player already chose. No two runs get
 * the same statue and nothing had to be authored, which is the whole reason
 * this is a statue of *you* rather than a fountain.
 *
 * It holds the studio's first shipped release aloft, and it faces the
 * leadership suite in the north corner. **It has its back to the floor.**
 */
function drawStatue(g: Graphics, p: Project, o: PlazaOptions): void {
  const { cx, cy, rung } = o
  if (rung < 0) return
  const gold = { top: RAMPS.WARN[3], left: RAMPS.WARN[2], right: RAMPS.WARN[1] }

  // Two steps and a column. Narrow and tall, because a plinth that is wide and
  // low draws a slab.
  isoSolid(g, p, cx - 0.7 * PLINTH, cy - 0.7 * PLINTH, 0, 1.4 * PLINTH, 1.4 * PLINTH, 0.15 * PLINTH, STONE)
  isoSolid(g, p, cx - 0.55 * PLINTH, cy - 0.55 * PLINTH, 0.15 * PLINTH, 1.1 * PLINTH, 1.1 * PLINTH, 0.15 * PLINTH, STONE)
  isoSolid(g, p, cx - 0.36 * PLINTH, cy - 0.36 * PLINTH, 0.3 * PLINTH, 0.72 * PLINTH, 0.72 * PLINTH, 0.98 * PLINTH, STONE)
  if (rung >= 4) {
    isoCap(g, p, cx - 0.36 * PLINTH, cy - 0.36 * PLINTH, 1.28 * PLINTH, 0.72 * PLINTH, 0.72 * PLINTH, RAMPS.WARN[2])
  }
  const top = 1.28 * PLINTH
  // The plaque. It carries the first release's real title and rating, which the
  // caller writes over the top as `Text` — this is only the brass it sits on.
  isoPatch(g, p, cx - 0.24 * PLINTH, cy + 0.32 * PLINTH, cx + 0.24 * PLINTH, cy + 0.36 * PLINTH,
    rung >= 3 ? RAMPS.WARN[2] : RAMPS.NEUTRAL[5])

  if (rung === 0) {
    // An A4, taped on. STATUE — TBD.
    isoSolid(g, p, cx - 0.15 * PLINTH, cy + 0.3 * PLINTH, top * 0.62, 0.3 * PLINTH, 0.03, 0.24 * PLINTH,
      { top: RAMPS.NEUTRAL[7], left: RAMPS.NEUTRAL[6], right: RAMPS.NEUTRAL[4] })
    return
  }
  const m = MATERIAL[Math.min(rung, MATERIAL.length - 1)]
  if (rung === 1) {
    // The foamboard standee, warping at one corner.
    isoSolid(g, p, cx - o.torso.w * 0.5, cy + 0.02, top, o.torso.w, 0.06, o.torso.h * 0.62, m)
    isoSolid(g, p, cx - o.torso.w * 0.34, cy + 0.02, top + o.torso.h * 0.62, o.torso.w * 0.68, 0.06, o.torso.h * 0.34, m)
    return
  }
  if (rung === 2) {
    // The resin bust. The likeness is off, and it is never fixed.
    isoSolid(g, p, cx - o.torso.w * 0.58, cy - o.torso.w * 0.58, top, o.torso.w * 1.16, o.torso.w * 1.16, o.torso.h * 0.3, m)
    isoSolid(g, p, cx - o.torso.w * 0.4, cy - o.torso.w * 0.4, top + o.torso.h * 0.3, o.torso.w * 0.8, o.torso.w * 0.8, o.torso.h * 0.4, m)
    return
  }
  // Bronze, then gilded. Full height, holding the first release.
  const bw = o.torso.w * 1.05
  const bh = o.torso.h * 1.5
  isoSolid(g, p, cx - bw / 2, cy - bw / 2, top, bw, bw, bh, m)
  isoSolid(g, p, cx - bw * 0.4, cy - bw * 0.4, top + bh, bw * 0.8, bw * 0.8, bh * 0.42, m)
  isoSolid(g, p, cx + bw * 0.5, cy - bw * 0.14, top + bh * 0.66, bw * 0.26, bw * 0.26, bh * 0.9, m)
  isoSolid(g, p, cx + bw * 0.34, cy - bw * 0.3, top + bh * 1.56, bw * 0.58, bw * 0.58, bh * 0.3, gold)

  if (rung >= 4) {
    // Four floor uplighters, and the velvet rope.
    //
    // The rope is the point of the whole rung. §7.8.5 asks that crowding be
    // seen to remove *the things somebody chose* — the plants, the sofa. Here
    // the sofa is not taken away by crowding: it is taken away by **you**, so
    // that a thousand people have somewhere to not sit while they look at a
    // gold statue of whoever hired them. Same cruelty, and it needs no new rule.
    isoPoly(g, p, octagonPoints(cx, cy, RING * 1.15), RAMPS.WARN[2], 0.12)
    for (const [ux, uy] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
      isoSolid(g, p, cx + ux - 0.08, cy + uy - 0.08, 0, 0.16, 0.16, 0.1,
        { top: RAMPS.WARN[3], left: RAMPS.WARN[3], right: RAMPS.WARN[2] })
    }
    for (const [rx, ry] of [[-0.92, -0.92], [0.92, -0.92], [0.92, 0.92], [-0.92, 0.92]]) {
      isoSolid(g, p, cx + rx - 0.06, cy + ry - 0.06, 0, 0.12, 0.12, 0.52,
        { top: RAMPS.WARN[2], left: RAMPS.NEUTRAL[3], right: RAMPS.NEUTRAL[2] })
    }
    const rope = { top: RAMPS.RARITY[0], left: RAMPS.RARITY[0], right: RAMPS.NEUTRAL[1] }
    isoSolid(g, p, cx - 0.92, cy + 0.86, 0.36, 1.84, 0.07, 0.08, rope)
    isoSolid(g, p, cx + 0.86, cy - 0.92, 0.36, 0.07, 1.84, 0.08, rope)
  }
}

/** A sofa: a seat and a back, with the back on the outside of the ring. */
function sofa(g: Graphics, p: Project, x: number, y: number, len: number, facing: 'n' | 's' | 'w' | 'e'): void {
  if (facing === 'n' || facing === 's') {
    isoSolid(g, p, x, y, 0, len, 0.5, 0.18, SOFA)
    const backY = facing === 'n' ? y : y + 0.36
    isoSolid(g, p, x, backY, 0, len, 0.14, 0.46, SOFA)
    isoCap(g, p, x, backY, 0.46, len, 0.14, RAMPS.NEUTRAL[5])
  } else {
    isoSolid(g, p, x, y, 0, 0.5, len, 0.18, SOFA)
    const backX = facing === 'w' ? x : x + 0.36
    isoSolid(g, p, backX, y, 0, 0.14, len, 0.46, SOFA)
    isoCap(g, p, backX, y, 0.46, 0.14, len, RAMPS.NEUTRAL[5])
  }
}

/**
 * Draw the plaza and whatever is standing on its plinth.
 *
 * Called with the plaza's centre already resolved to the transverse corridor,
 * so this file knows nothing about squads, strides or headcount beyond the rung
 * it is handed.
 */
export function drawPlaza(g: Graphics, p: Project, o: PlazaOptions): void {
  if (o.rung < 0) return
  const { cx, cy } = o

  // The inlay — two rings, so the edge reads as a change of material rather
  // than as a stain. This is the same trick the hallway finish uses, and for
  // the same reason: a floor patch with no edge is a rug.
  isoPoly(g, p, octagonPoints(cx, cy, PLAZA_RADIUS), RAMPS.NEUTRAL[2])
  isoPoly(g, p, octagonPoints(cx, cy, PLAZA_RADIUS - 0.22), RAMPS.NEUTRAL[3])

  // Four sofas on the axis edges, four pouffes on the diagonals. A sofa cannot
  // sit on a diagonal edge without leaving the projection — its back would run
  // at a slope the floor plane has no room for — so the diagonals get something
  // that has no front.
  const half = RING * 0.62
  sofa(g, p, cx - half, cy - RING - 0.36, half * 2, 'n')
  sofa(g, p, cx - half, cy + RING - 0.14, half * 2, 's')
  sofa(g, p, cx - RING - 0.36, cy - half, half * 2, 'w')
  sofa(g, p, cx + RING - 0.14, cy - half, half * 2, 'e')
  for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = cx + qx * RING * 0.78 - 0.2
    const py = cy + qy * RING * 0.78 - 0.2
    isoSolid(g, p, px, py, 0, 0.4, 0.4, 0.18, SOFA)
    isoCap(g, p, px, py, 0.18, 0.4, 0.4, RAMPS.NEUTRAL[5])
  }

  // Planters outside the ring, on the diagonals. The one green thing on a floor
  // this size, and §7.8.5's first casualty of crowding everywhere else — which
  // is why the plaza keeping four of them is worth noticing.
  for (const [qx, qy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const px = cx + qx * PLANTER - 0.3
    const py = cy + qy * PLANTER - 0.3
    isoSolid(g, p, px, py, 0, 0.6, 0.6, 0.26, STONE)
    isoCap(g, p, px, py, 0.26, 0.6, 0.6, RAMPS.NEUTRAL[5])
    isoSolid(g, p, px + 0.1, py + 0.1, 0.26, 0.4, 0.4, 0.4, LEAF)
  }

  drawStatue(g, p, o)
}
