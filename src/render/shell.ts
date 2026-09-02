/**
 * **The building shell** — thick walls, cutaway near walls, real door openings
 * and glass with mullions. GDD §7.8.0b [CANON - added 2026-09-01].
 *
 * ## What was wrong
 *
 * The room's shell was **two flat quads**. `room.ts` drew a back-left plane and
 * a back-right plane, each a four-point polygon with a skirting band at the
 * bottom and a cornice at the top, and drew *nothing at all* on the two near
 * sides — the plan deck's own diagnosis, unchanged since: "we have two window
 * walls and then nothing — the other two sides just stop, which is why the
 * floor reads as a slab."
 *
 * Two consequences, and the second is the expensive one:
 *
 * - **A plane has no thickness**, so a door in it is a painted rectangle and a
 *   window is a lighter painted rectangle. Both canonical concepts make the
 *   wall's *depth* do real work: you see the top of the near wall as a lit
 *   band, you see the reveal at the sides of the garage's roll-up door, and the
 *   entrance canopy is a lintel with a wall standing on it.
 * - **A room with two sides is not a room.** The concepts are cutaways: full
 *   height far, cut to about a third near, so you look over the near wall into
 *   the floor. That is a *four*-sided building drawn honestly, not a two-sided
 *   one drawn cheaply, and it is what makes the floor sit inside something.
 *
 * ## Why the numbers are the numbers
 *
 * Measured off the two canonical artworks rather than chosen, and expressed in
 * **person-heights**, because that is the only ratio that survives the two
 * images being at different zooms:
 *
 * |  | garage concept | office concept | taken |
 * |---|---|---|---|
 * | far wall | 4.5 people | 4.9 people | **4.7** |
 * | near wall | 1.9 people | 1.5 people | **1.7** |
 * | thickness | 0.7 people | 0.75 people | **0.7** |
 *
 * A person in this renderer is a torso of about 19px with a head on it, so
 * roughly 0.9 of a {@link HEIGHT_UNIT}. The tile figures below are those
 * ratios multiplied through, and the ratio between them — near is **0.36** of
 * far — is the number to preserve if either is ever retuned. That ratio is what
 * makes the cutaway read: much higher and the near wall hides the front row of
 * desks, much lower and it stops reading as a wall at all.
 *
 * ## Purity
 *
 * The geometry is separated from the drawing on purpose. {@link wallSegments}
 * and {@link shellExtent} are pure functions of numbers, so `shell.test.ts` can
 * assert that an opening is a real gap and that containment is computed from
 * what is drawn — without a canvas, and without the room's five thousand lines
 * of context. That separation is the whole reason `test:room` had to exist as a
 * browser gate: geometry that only exists inside a `Graphics` call can only be
 * checked by photographing it.
 */

import type { Graphics } from 'pixi.js'

import { HEIGHT_UNIT, isoPatch, isoSolid, type Project } from './isoSolid.ts'

/**
 * A standing person's height, in tile-height units — the unit the wall
 * proportions below are quoted in.
 *
 * Not read from `torsoShape` at runtime, deliberately: that function returns
 * one of five costumes and a wall may not be a different height depending on
 * who is standing next to it. This is the figure the *proportions* were
 * measured against, and it is a constant of the art direction.
 */
export const PERSON_H = 0.9

/** Full-height far wall — 4.7 people. The storey. */
export const WALL_FULL = 4.7 * PERSON_H
/** Half-height near wall — 1.7 people. The cutaway. */
export const WALL_NEAR = 1.7 * PERSON_H
/** How thick a load-bearing exterior wall is, in tiles. 0.7 of a person. */
export const WALL_THICK = 0.7 * PERSON_H
/** An interior partition — thinner, and it has to read as thinner. */
export const PARTITION_THICK = 0.3 * PERSON_H

/**
 * The ratio the cutaway lives or dies by, pinned so a retune of either height
 * has to be a deliberate change to *both*.
 */
export const CUTAWAY_RATIO = WALL_NEAR / WALL_FULL

/**
 * Which of a rectangle's four edges a wall stands on.
 *
 * `gridToScreen` pushes **both** axes down the screen, so the camera is to the
 * south and the two edges at minimum `gx`/`gy` are the ones with nothing in
 * front of them: those are `far`. The two at maximum are between the camera and
 * the floor, and are therefore the ones that get cut down.
 */
export type Edge = 'far-left' | 'far-right' | 'near-left' | 'near-right'

/** Is this edge behind the floor from the camera's point of view? */
export function isFarEdge(edge: Edge): boolean {
  return edge === 'far-left' || edge === 'far-right'
}

/** The height an exterior wall on this edge is drawn at. */
export function edgeHeight(edge: Edge): number {
  return isFarEdge(edge) ? WALL_FULL : WALL_NEAR
}

/**
 * A hole in a wall, measured **along the run** from its start.
 *
 * `head` is where the opening stops and the wall resumes above it. Omit it for
 * an opening that goes all the way up — a garage's roll-up door in a near wall
 * is one of those, because the wall is barely taller than the door. Give it for
 * a doorway in a full-height wall, where the wall above the door is a *lintel*
 * and has to be drawn as one: that band of wall standing on nothing visible is
 * the single detail that makes an opening read as cut through something solid
 * rather than as a dark rectangle painted on it.
 */
export interface Opening {
  readonly at: number
  readonly width: number
  readonly head?: number
}

/**
 * One straight run of wall on the floor lattice, in tiles.
 *
 * `at` is the wall's **outer** face and the run grows inward, so a shell built
 * from four runs on the same rectangle meets at its corners without any call
 * site doing thickness arithmetic — which is the mistake that puts a one-tile
 * notch in a corner and survives review because every individual number is
 * right.
 */
export interface WallRun {
  readonly edge: Edge
  /** The outer face's position on the axis the wall is thin in. */
  readonly at: number
  /** Where the run starts and ends on the axis it is long in. */
  readonly from: number
  readonly to: number
  readonly thickness?: number
  readonly height?: number
  readonly openings?: readonly Opening[]
}

/** A drawable piece of wall: a corner-anchored box in tiles. */
export interface WallSegment {
  readonly gx: number
  readonly gy: number
  readonly gz: number
  readonly w: number
  readonly d: number
  readonly h: number
  /** `pier` is wall standing on the ground; `lintel` is wall over an opening. */
  readonly kind: 'pier' | 'lintel'
}

function runThickness(run: WallRun): number {
  return run.thickness ?? WALL_THICK
}

function runHeight(run: WallRun): number {
  return run.height ?? edgeHeight(run.edge)
}

/** Is this run long in `gy` (the two `-left` edges) or in `gx`? */
export function runsAlongGy(edge: Edge): boolean {
  return edge === 'far-left' || edge === 'near-right'
}

/**
 * **Cut a run into the solids that actually get drawn.**
 *
 * The whole point of this function is that an opening is a *gap in a list of
 * boxes*, not a dark rectangle drawn on top of a box. Nothing downstream can
 * accidentally fill it in, a walker route can be tested against the same list,
 * and a lintel is a box like any other rather than a special case in a shader.
 *
 * Openings are clipped to the run and sorted, so a caller may list them in any
 * order and may over-reach the end of a wall without producing a segment of
 * negative length. Overlapping openings merge rather than producing a
 * zero-width pier, because a zero-width pier is a hairline that flickers.
 */
export function wallSegments(run: WallRun): WallSegment[] {
  const t = runThickness(run)
  const h = runHeight(run)
  const lo = Math.min(run.from, run.to)
  const hi = Math.max(run.from, run.to)
  if (!(hi > lo) || !(t > 0) || !(h > 0)) return []

  const holes = (run.openings ?? [])
    .map((o) => ({
      a: Math.max(lo, Math.min(hi, o.at)),
      b: Math.max(lo, Math.min(hi, o.at + o.width)),
      head: o.head,
    }))
    .filter((o) => o.b > o.a)
    .sort((a, b) => a.a - b.a)

  /*
   * **`at` is the outer face on all four edges**, so the wall always grows
   * *inward* from the rectangle it stands on.
   *
   * This placed the box at `[at, at + t]` regardless of edge until 2026-09-01,
   * which put the two near walls a whole thickness outside the room while
   * {@link insideShell} — reading the same runs — believed they were a
   * thickness inside it. Neither function was wrong on its own; they disagreed,
   * which is worse, and it is exactly the failure mode §7.8.0b's "containment
   * is computed from the drawn geometry" exists to close. A shell built on a
   * slab now has its walls standing *on* the slab's edge, which is also what a
   * building does.
   */
  const base = isFarEdge(run.edge) ? run.at : run.at - t

  const out: WallSegment[] = []
  const push = (from: number, to: number, gz: number, height: number, kind: 'pier' | 'lintel') => {
    if (!(to > from) || !(height > 0)) return
    // The thin axis always starts at `at` and grows by `t`; the long axis is
    // the piece we just cut. Which is which is the edge's business, not the
    // caller's.
    if (runsAlongGy(run.edge)) out.push({ gx: base, gy: from, gz, w: t, d: to - from, h: height, kind })
    else out.push({ gx: from, gy: base, gz, w: to - from, d: t, h: height, kind })
  }

  let cursor = lo
  for (const hole of holes) {
    if (hole.a > cursor) push(cursor, hole.a, 0, h, 'pier')
    // The lintel: wall above the opening, only where the opening stops short.
    if (hole.head !== undefined && hole.head < h) {
      push(Math.max(cursor, hole.a), hole.b, hole.head, h - hole.head, 'lintel')
    }
    cursor = Math.max(cursor, hole.b)
  }
  push(cursor, hi, 0, h, 'pier')
  return out
}

/**
 * The rectangle a set of runs encloses, **read off the drawn solids**.
 *
 * §7.8.0b's fifth claim, and it is a claim about who is allowed to know the
 * room's size. The camera used to fit a rectangle computed from the seat
 * lattice while the walls were drawn from a second calculation, so the two
 * could disagree — and did, which is the class of defect `test:room` was built
 * to photograph. Deriving the extent from the segments means a wall that moved
 * moves the camera, with no third number to keep in step.
 */
export function shellExtent(runs: readonly WallRun[]): {
  minGx: number
  maxGx: number
  minGy: number
  maxGy: number
  height: number
} {
  let minGx = Infinity
  let maxGx = -Infinity
  let minGy = Infinity
  let maxGy = -Infinity
  let height = 0
  for (const run of runs) {
    for (const s of wallSegments(run)) {
      minGx = Math.min(minGx, s.gx)
      maxGx = Math.max(maxGx, s.gx + s.w)
      minGy = Math.min(minGy, s.gy)
      maxGy = Math.max(maxGy, s.gy + s.d)
      height = Math.max(height, s.gz + s.h)
    }
  }
  if (!Number.isFinite(minGx)) return { minGx: 0, maxGx: 0, minGy: 0, maxGy: 0, height: 0 }
  return { minGx, maxGx, minGy, maxGy, height }
}

/** Is a point on the floor inside every run's inner face? */
export function insideShell(runs: readonly WallRun[], gx: number, gy: number): boolean {
  for (const run of runs) {
    const t = runThickness(run)
    const inner = isFarEdge(run.edge) ? run.at + t : run.at - t
    if (runsAlongGy(run.edge)) {
      if (isFarEdge(run.edge) ? gx < inner : gx > inner) return false
    } else if (isFarEdge(run.edge) ? gy < inner : gy > inner) return false
  }
  return true
}

/**
 * How a wall is coloured. Three faces and an optional cap strip.
 *
 * `cap` is the plan deck's highest-value borrowed idea: a strip of saturated
 * colour along a partition's top edge, one extra quad, and the thing that lets
 * a dozen low walls be told apart in a 960-pixel frame. On a *thick* exterior
 * wall the whole top face is the coping and `top` carries it, so `cap` is for
 * partitions.
 */
export interface WallPaint {
  readonly top: string
  readonly left: string
  readonly right: string
  readonly cap?: string
}

/** Draw one run: every segment as a real solid, openings as real gaps. */
export function drawWallRun(g: Graphics, p: Project, run: WallRun, paint: WallPaint): WallSegment[] {
  const segments = wallSegments(run)
  for (const s of segments) {
    isoSolid(g, p, s.gx, s.gy, s.gz, s.w, s.d, s.h, paint)
    if (paint.cap) {
      // A band across the whole top rather than `isoCap`'s two edge strips: a
      // wall this thin *is* its own cap, and the strip version leaves a sliver
      // of the base colour on a run whose thin axis is wider than 0.16.
      isoPatchAtHeight(g, p, s.gx, s.gy, s.gx + s.w, s.gy + s.d, s.gz + s.h, paint.cap)
    }
  }
  return segments
}

/** {@link isoPatch}, lifted to a height. Used for wall copings and sills. */
export function isoPatchAtHeight(
  g: Graphics,
  p: Project,
  gx0: number,
  gy0: number,
  gx1: number,
  gy1: number,
  gz: number,
  fill: string,
  alpha = 1,
): void {
  const lifted: Project = (gx, gy) => {
    const q = p(gx, gy)
    return { x: q.x, y: q.y - gz * HEIGHT_UNIT }
  }
  isoPatch(g, lifted, gx0, gy0, gx1, gy1, fill, alpha)
}

/**
 * A glazed run — panes between dark mullions, in the same wall plane.
 *
 * **The frame is laid down whole and the panes go on top**, which is the
 * construction `room.ts`'s curtain wall already uses one level up and the
 * reason it reads: the gaps between the panes *are* the mullion grid, so the
 * rhythm cannot drift out of step with the glass. Both canonical concepts lean
 * hard on that rhythm — the garage's reclaimed partition and the office's
 * LEADERSHIP box are both read almost entirely from their mullion spacing.
 *
 * The glass does not take the wall's key. What is behind it is either outside,
 * which does not care which wall it is in, or a lit room, which supplies its
 * own. Only the mullions are shaded.
 */
export interface GlassPaint {
  readonly mullion: string
  readonly pane: string
  readonly paneAlpha?: number
  /** A solid kerb under the glazing, if the panes do not reach the floor. */
  readonly sill?: string
}

export interface GlassRun {
  readonly edge: Edge
  readonly at: number
  readonly from: number
  readonly to: number
  readonly thickness?: number
  readonly height?: number
  /** Bottom of the glazing. Above 0 there is a solid spandrel under it. */
  readonly sillHeight?: number
  /** Target pane width in tiles; the run divides evenly into whole panes. */
  readonly paneWidth?: number
}

/** How wide a pane wants to be — about a person and a half. */
export const PANE_WIDTH = 1.5 * PERSON_H
/** How thick a mullion is. Thin, dark, and the same on every glazed thing. */
export const MULLION = 0.12

/**
 * The mullion positions for a glazed run, **as offsets along the run**.
 *
 * Pure, and separated for the same reason {@link wallSegments} is: "the panes
 * are evenly spaced and there is always a mullion at each end" is a claim a
 * test should be able to make without rendering anything.
 */
export function paneDivisions(length: number, paneWidth = PANE_WIDTH): number[] {
  if (!(length > 0) || !(paneWidth > 0)) return []
  const count = Math.max(1, Math.round(length / paneWidth))
  const step = length / count
  const out: number[] = []
  for (let i = 0; i <= count; i++) out.push(i * step)
  return out
}

export function drawGlassRun(g: Graphics, p: Project, run: GlassRun, paint: GlassPaint): void {
  const t = run.thickness ?? PARTITION_THICK
  const h = run.height ?? edgeHeight(run.edge)
  const sill = run.sillHeight ?? 0
  const lo = Math.min(run.from, run.to)
  const hi = Math.max(run.from, run.to)
  if (!(hi > lo) || !(h > sill)) return
  const alongGy = runsAlongGy(run.edge)

  const box = (from: number, to: number, gz: number, height: number, faces: WallPaint, alpha = 1) => {
    if (!(to > from) || !(height > 0)) return
    if (alongGy) isoSolid(g, p, run.at, from, gz, t, to - from, height, faces, alpha)
    else isoSolid(g, p, from, run.at, gz, to - from, t, height, faces, alpha)
  }

  // The spandrel below the glazing, if any — solid, and it takes the wall key.
  if (sill > 0 && paint.sill) {
    box(lo, hi, 0, sill, { top: paint.sill, left: paint.sill, right: paint.sill })
  }
  // The frame, whole.
  const frame = { top: paint.mullion, left: paint.mullion, right: paint.mullion }
  box(lo, hi, sill, h - sill, frame)
  // The panes, inset into it. The gaps left over are the mullions, so the
  // rhythm and the glass are the same measurement rather than two.
  const pane = { top: paint.pane, left: paint.pane, right: paint.pane }
  const divs = paneDivisions(hi - lo, run.paneWidth)
  for (let i = 0; i + 1 < divs.length; i++) {
    const a = lo + divs[i] + MULLION
    const b = lo + divs[i + 1] - MULLION
    box(a, b, sill + MULLION, h - sill - MULLION * 2, pane, paint.paneAlpha ?? 1)
  }
}
