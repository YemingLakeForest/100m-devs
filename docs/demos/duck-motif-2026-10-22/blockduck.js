// The duck from chamfered blocks. Every number is a voxel; beak toward +x, flanks ±z, sitting on y = 0.
import { Vox, C, bev, paintSide, rect } from './vox.js'

function outer(v, x, y, side) {
  let best = null
  for (const [vx, vy, vz] of v.each()) if (vx === x && vy === y && (best === null || vz * side > best * side)) best = vz
  return best
}

export const SPECS = {
  classic: {
    body: [0, 15, 7, 10, [3, 3, 1, 2, 2, 2]],
    tail: [[-1, 3, 5, 9, 6, [1, 1, 0, 2, 1, 1]]],
    head: [8, 6, 10, 10, 10, 3],
    beak: { x: 17, y: 9, len: 4, w: 6, lower: 3 },
    eye: { x: 13, y: 11, s: 2 },
    cheek: [[14, 9], [15, 9]],
    wing: [[4, 4, 7], [3, 3, 8], [3, 2, 8]],
  },
  big: {
    body: [0, 14, 6, 10, [3, 3, 1, 2, 2, 2]],
    tail: [[-1, 2, 4, 8, 6, [1, 1, 0, 2, 1, 1]]],
    head: [5, 5, 12, 12, 12, 3],
    beak: { x: 16, y: 9, len: 4, w: 6, lower: 3 },
    eye: { x: 11, y: 11, s: 3 },
    cheek: [[13, 8], [14, 8]],
    wing: [[3, 3, 6], [2, 2, 7]],
  },
  soft: {
    body: [0, 15, 7, 12, [4, 4, 1, 3, 3, 3]],
    tail: [[-1, 3, 5, 9, 6, [2, 1, 0, 2, 2, 2]]],
    head: [6, 6, 12, 12, 12, 4],
    beak: { x: 17, y: 9, len: 4, w: 6, lower: 3 },
    eye: { x: 12, y: 12, s: 3 },
    cheek: [[14, 9], [15, 9]],
    wing: [[4, 4, 7], [3, 3, 8], [4, 2, 7]],
  },
  mini: {
    body: [0, 4, 2, 4, [1, 1, 0, 0, 1, 1]],
    tail: [[-1, 0, 2, 2, 2, 0]],
    head: [2, 2, 3, 3, 4, 0],
    beak: { x: 5, y: 3, len: 1, w: 2, lower: 0 },
    eye: { x: 4, y: 4, s: 1 },
  },
  chunk: {
    body: [0, 8, 4, 6, [1, 1, 0, 1, 1, 1]],
    tail: [[-1, 1, 3, 5, 4, [1, 0, 0, 1, 0, 0]]],
    head: [4, 4, 6, 6, 6, 1],
    beak: { x: 9, y: 6, len: 2, w: 4, lower: 0 },
    eye: { x: 7, y: 7, s: 1 },
    wing: [[2, 2, 4]],
  },
}

export function blockDuck(spec, opts = {}) {
  const v = new Vox(), s = spec
  const [bx0, bx1, bh, bw, bb] = s.body
  bev(v, bx0, 0, -bw / 2, bx1, bh - 1, bw / 2 - 1, bb, C.Y)
  for (const [x0, x1, y0, y1, w, b] of s.tail) bev(v, x0, y0, -w / 2, x1, y1, w / 2 - 1, b, C.Y)
  const [hx, hy, hw, hh, hd, hb] = s.head
  bev(v, hx, hy, -hd / 2, hx + hw - 1, hy + hh - 1, hd / 2 - 1, hb, C.Y)
  const K = s.beak
  bev(v, K.x - 1, K.y, -K.w / 2, K.x + K.len - 1, K.y + 1, K.w / 2 - 1, [0, 1, 0, 0, 0, 0], C.BK)
  if (K.lower) bev(v, K.x - 1, K.y - 1, -K.w / 2 + 1, K.x + K.lower - 1, K.y - 1, K.w / 2 - 2, 0, C.BKD)
  const E = s.eye
  for (const side of [-1, 1]) {
    // Wing: raised one voxel off the flank, in the shade, so it reads by its edge and not only its colour.
    for (const [y, x0, x1] of s.wing ?? []) for (let x = x0; x <= x1; x++) { const z = outer(v, x, y, side); if (z !== null) v.set(x, y, z + side, C.YS) }
    const st = opts.eyes ?? 'glint'
    if (st === 'happy') {
      // Closed and smiling: an arch, which is the one eye that reads as a mood at twenty pixels.
      paintSide(v, side, [[E.x - 1, E.y], [E.x - 1, E.y + 1], ...rect(E.x, E.y + 2, E.x + E.s - 1, E.y + 2), [E.x + E.s, E.y], [E.x + E.s, E.y + 1]], C.EYE)
    } else {
      paintSide(v, side, rect(E.x, E.y, E.x + E.s - 1, E.y + E.s - 1), C.EYE)
      if (st === 'lid') paintSide(v, side, rect(E.x - 1, E.y + E.s - 1, E.x + E.s - 1, E.y + E.s - 1), C.LID)
      if (st === 'lid' && E.s > 2) paintSide(v, side, [[E.x + E.s - 1, E.y + E.s - 2]], C.GL)
      if (st === 'glint' && E.s > 1) paintSide(v, side, [[E.x + E.s - 1, E.y + E.s - 1]], C.GL)
      if (st === 'brow') paintSide(v, side, [[E.x - 1, E.y + E.s + 1], [E.x, E.y + E.s + 1], [E.x + 1, E.y + E.s], [E.x + 2, E.y + E.s]], C.BKD)
      if (st === 'brow') paintSide(v, side, [[E.x + E.s - 1, E.y + E.s - 1]], C.GL)
    }
    if (s.cheek && !opts.noCheek) paintSide(v, side, s.cheek, C.CH)
  }
  return { v, spec: s }
}
