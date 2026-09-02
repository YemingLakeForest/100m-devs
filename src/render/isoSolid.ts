/**
 * Solids and patches on the floor plane, in **grid tiles**.
 *
 * `room.ts` has had its own `isoBox` since the props stopped being upright
 * rectangles, and it is bound to that file's shading conventions and its
 * footprint-centred coordinates. The street furniture added in 2026-08-31's
 * batch — the apron outside the shell, the plaza inside it — wants the same
 * projection and a corner-anchored footprint, and two copies of "how a box is
 * shaded in this game" is exactly the divergence ART_DIRECTION §0 exists to
 * prevent. So the second convention lives here once, and both callers use it.
 *
 * The rules it shares with `isoBox`, because these are the parts that must
 * agree or the scene reads as two drawings:
 *
 * - **Three visible faces.** A camera to the south sees a solid's top, its
 *   down-left face (`gy + d`) and its down-right face (`gx + w`). There is no
 *   fourth.
 * - **Light from the top-left**, so the down-left face is the lit one and the
 *   down-right is in shadow. ART_DIRECTION §7's single source.
 * - **One height unit is one tile height.** `gz` is in the same units as `gx`
 *   and `gy`, which is what keeps a two-tile lamp post two tiles tall.
 *
 * Nothing in here takes a screen pixel. §7.8.12 records what happens when
 * something does.
 */
import type { Graphics } from 'pixi.js'
import { hexToRgb } from '../art/palette.ts'

/** Project a point on the floor plane to room-local screen coordinates. */
export type Project = (gx: number, gy: number) => { x: number; y: number }

/** Screen pixels per unit of height. One tile, matching `TILE_H * 2`. */
export const HEIGHT_UNIT = 32

export function toHex(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * A solid standing on the floor, anchored at its **minimum corner** rather
 * than its centre.
 *
 * Corner anchoring is the difference from `isoBox`, and it is deliberate: this
 * furniture is laid out against edges — a kerb, a plate's boundary, the ring of
 * a plaza — and positioning by centre means every call site does the same
 * half-extent arithmetic and one of them eventually gets it wrong.
 */
export function isoSolid(
  g: Graphics,
  p: Project,
  gx: number,
  gy: number,
  gz: number,
  w: number,
  d: number,
  h: number,
  faces: { top: string; left: string; right: string },
  alpha = 1,
): void {
  const at = (x: number, y: number, z: number) => {
    const q = p(x, y)
    return { x: q.x, y: q.y - z * HEIGHT_UNIT }
  }
  const t0 = at(gx, gy, gz + h)
  const t1 = at(gx + w, gy, gz + h)
  const t2 = at(gx + w, gy + d, gz + h)
  const t3 = at(gx, gy + d, gz + h)
  const l0 = at(gx, gy + d, gz)
  const l1 = at(gx + w, gy + d, gz)
  const r0 = at(gx + w, gy, gz)
  g.moveTo(t0.x, t0.y).lineTo(t1.x, t1.y).lineTo(t2.x, t2.y).lineTo(t3.x, t3.y).closePath()
    .fill({ color: toHex(faces.top), alpha })
  g.moveTo(l0.x, l0.y).lineTo(l1.x, l1.y).lineTo(t2.x, t2.y).lineTo(t3.x, t3.y).closePath()
    .fill({ color: toHex(faces.left), alpha })
  g.moveTo(r0.x, r0.y).lineTo(l1.x, l1.y).lineTo(t2.x, t2.y).lineTo(t1.x, t1.y).closePath()
    .fill({ color: toHex(faces.right), alpha })
}

/**
 * A **cap** — a strip of saturated colour along the top edge of a partition.
 *
 * The single highest-value idea taken from the reference material, and it is
 * one extra quad. A run of low walls in one neutral is a run of low walls; the
 * same run with three pixels of colour on its top edge is three rooms you can
 * tell apart in a 960-pixel frame. It is a *strip*, not a painted lid: on a
 * partition thin in one axis the strip is the whole top, and on a counter it is
 * a sixth of a tile along the near edge, which is what reads at floor zoom.
 */
export function isoCap(
  g: Graphics,
  p: Project,
  gx: number,
  gy: number,
  gz: number,
  w: number,
  d: number,
  colour: string,
): void {
  const cd = Math.min(d, 0.16)
  const cw = Math.min(w, 0.16)
  const at = (x: number, y: number) => {
    const q = p(x, y)
    return { x: q.x, y: q.y - gz * HEIGHT_UNIT }
  }
  const strip = (x0: number, y0: number, x1: number, y1: number) => {
    const a = at(x0, y0)
    const b = at(x1, y0)
    const c2 = at(x1, y1)
    const e = at(x0, y1)
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c2.x, c2.y).lineTo(e.x, e.y).closePath()
      .fill(toHex(colour))
  }
  strip(gx, gy + d - cd, gx + w, gy + d)
  strip(gx + w - cw, gy, gx + w, gy + d)
}

/** A flat patch of ground, corner-anchored. */
export function isoPatch(
  g: Graphics,
  p: Project,
  gx0: number,
  gy0: number,
  gx1: number,
  gy1: number,
  fill: string,
  alpha = 1,
): void {
  const a = p(gx0, gy0)
  const b = p(gx1, gy0)
  const d = p(gx1, gy1)
  const e = p(gx0, gy1)
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(d.x, d.y).lineTo(e.x, e.y).closePath()
    .fill({ color: toHex(fill), alpha })
}

/** An arbitrary flat polygon on the floor, given in grid tiles. */
export function isoPoly(
  g: Graphics,
  p: Project,
  pts: ReadonlyArray<readonly [number, number]>,
  fill: string,
  alpha = 1,
): void {
  if (pts.length < 3) return
  const first = p(pts[0][0], pts[0][1])
  g.moveTo(first.x, first.y)
  for (let i = 1; i < pts.length; i++) {
    const q = p(pts[i][0], pts[i][1])
    g.lineTo(q.x, q.y)
  }
  g.closePath().fill({ color: toHex(fill), alpha })
}
