import * as T from 'three'

/**
 * **The planet is a city plan waiting to be filled.**
 *
 * An abstract globe (the user, 2026-09-27: *"I want abstract globe, not a real
 * world map"*): a cube-sphere of square blocks, so the street grid that runs
 * past the garage is the same grid that wraps the planet. Rectangles on one
 * street grid is the rebuild's locked decision 4 (*"after seeing I am now not
 * big fan of hex"*); a cube-sphere is the one way to keep blocks square on a
 * ball, and the only price is eight corners where three faces meet, far from HQ.
 *
 * **Toy scale, on purpose.** At true scale a hundred million developers is a
 * city a few kilometres across on a 12,742 km planet: a speck. "Earth is full at
 * 100,000,000" (locked decision 5) is only a picture if the planet is small, so
 * it is, the same licence the 2:1 floor takes. 49 blocks of 120 m per face edge
 * puts R at 3.74 km and the whole planet at exactly 100M seats.
 *
 * Everything here is a pure function of the seed. Nothing is stored; a seat's
 * tower, floor and window are arithmetic, which is what lets the renderer draw
 * "whoever lives where you are looking" at any zoom (§7.8.7, applied to places).
 */
export const M = 49
export const BLOCK = 120
/** Towers per block edge: a block is three by three buildings with lanes between. */
export const TPB = 3
export const R = (M * BLOCK * 2) / Math.PI
export const FLOOR_H = 3.6
export const WIN = 2.4
export const EARTH_SEATS = 100_000_000
/** How far under the garage's floor plane the planet's ground is drawn. */
export const GROUND_DROP = 0.6

export interface Face { n: T.Vector3; u: T.Vector3; v: T.Vector3 }
export const FACES: readonly Face[] = [
  { n: new T.Vector3(1, 0, 0), u: new T.Vector3(0, 0, -1), v: new T.Vector3(0, 1, 0) },
  { n: new T.Vector3(-1, 0, 0), u: new T.Vector3(0, 0, 1), v: new T.Vector3(0, 1, 0) },
  // +Y is HQ's face: u is east (+x) and v is south (+z), the garage's own axes.
  { n: new T.Vector3(0, 1, 0), u: new T.Vector3(1, 0, 0), v: new T.Vector3(0, 0, 1) },
  { n: new T.Vector3(0, -1, 0), u: new T.Vector3(1, 0, 0), v: new T.Vector3(0, 0, -1) },
  { n: new T.Vector3(0, 0, 1), u: new T.Vector3(1, 0, 0), v: new T.Vector3(0, 1, 0) },
  { n: new T.Vector3(0, 0, -1), u: new T.Vector3(-1, 0, 0), v: new T.Vector3(0, 1, 0) },
]
export const HQ_FACE = 2
export const HQ_BLOCK = (M - 1) / 2

/** The unit direction of face-local equal-angle coordinates (a, b) in [-1, 1]. */
export function dirOf(face: number, a: number, b: number, out = new T.Vector3()): T.Vector3 {
  const f = FACES[face]
  const ta = Math.tan((a * Math.PI) / 4), tb = Math.tan((b * Math.PI) / 4)
  return out.copy(f.n).addScaledVector(f.u, ta).addScaledVector(f.v, tb).normalize()
}

/** Which face a direction is on, and its equal-angle coordinates there. */
export function faceCoords(p: T.Vector3): { face: number; a: number; b: number } {
  const ax = Math.abs(p.x), ay = Math.abs(p.y), az = Math.abs(p.z)
  const face = ax >= ay && ax >= az ? (p.x > 0 ? 0 : 1) : ay >= az ? (p.y > 0 ? 2 : 3) : (p.z > 0 ? 4 : 5)
  const f = FACES[face]
  const d = p.dot(f.n)
  return { face, a: (Math.atan(p.dot(f.u) / d) * 4) / Math.PI, b: (Math.atan(p.dot(f.v) / d) * 4) / Math.PI }
}

/** One deterministic 0..1 draw per (index, channel) — the same hash family as sim/identity. */
export function rnd(i: number, ch: number): number {
  let x = (i * 0x9e3779b1 + ch * 0x85ebca6b) | 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad)
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97)
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296
}

/** Smooth value noise on the unit sphere, for a frontier that is not a circle. */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const s = (t: number) => t * t * (3 - 2 * t)
  const h = (i: number, j: number, k: number) => rnd(i * 73856093 ^ j * 19349663 ^ k * 83492791, 7)
  const u = s(xf), v = s(yf), w = s(zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w)
}
export function fbm(p: T.Vector3, scale: number): number {
  let sum = 0, amp = 0.5, f = scale
  for (let o = 0; o < 4; o++) { sum += amp * noise3(p.x * f + 11.3, p.y * f - 4.1, p.z * f + 7.7); f *= 2.03; amp *= 0.5 }
  return sum
}

/**
 * **Where the studio goes next.** Not a circle round HQ: HQ sprawls, and
 * satellite hubs open elsewhere on the planet as it grows, sprawl in their turn
 * and merge. That is the "colonise the globe" picture — offices opening across
 * the world like lights coming on — without a real map to open them on.
 */
export interface Hub { dir: T.Vector3; delay: number }
export function hubs(seed: number): Hub[] {
  const out: Hub[] = [{ dir: new T.Vector3(0, 1, 0), delay: 0 }]
  for (let k = 1; k < 24; k++) {
    const z = rnd(seed * 31 + k, 1) * 2 - 1
    const t = rnd(seed * 31 + k, 2) * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    const dir = new T.Vector3(r * Math.cos(t), z, r * Math.sin(t))
    // Keep the first few out of HQ's own sprawl, or they read as HQ's suburbs.
    if (dir.y > 0.8) dir.y = 0.8 - (dir.y - 0.8)
    dir.normalize()
    out.push({ dir, delay: 900 + (k - 1) * 220 + rnd(seed * 31 + k, 3) * 150 })
  }
  return out
}

export interface Towers {
  count: number
  perBlock: number
  /** Render-space base centre on the sphere (planet centre at the origin). */
  pos: Float32Array
  /** Orientation quaternion (x, y, z, w): local +y is up, local +x along the block. */
  quat: Float32Array
  /** Footprint along local x and z, metres. */
  w: Float32Array
  d: Float32Array
  floors: Float32Array
  perFloor: Float32Array
  /** First seat, and how many seats, as doubles: 10^8 is past a float's integers. */
  seatBase: Float64Array
  capacity: Float64Array
  block: Int32Array
  /** Distance to the nearest hub centre, metres (downtown is short, suburbs long). */
  downtown: Float32Array
  seed: Float32Array
  blocks: number
  blockCapacity: Float64Array
}

/**
 * Every tower on the planet, sorted by when it fills: tower `k` holds seats
 * `seatBase[k] .. seatBase[k] + capacity[k] - 1`. `firstSeat` is where the
 * planet's towers start (after the garage and HQ), and the last tower is cut so
 * the planet holds exactly `total`.
 */
export function buildTowers(seed: number, firstSeat: number, total = EARTH_SEATS): Towers {
  const hs = hubs(seed)
  interface Tw { face: number; a: number; b: number; block: number; pri: number; dh: number }
  const list: Tw[] = []
  const tmp = new T.Vector3()
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < M; j++) {
        // HQ's block is the campus (hq.ts), not four towers.
        if (face === HQ_FACE && i === HQ_BLOCK && j === HQ_BLOCK) continue
        const block = face * M * M + j * M + i
        const ac = -1 + (2 * i + 1) / M, bc = -1 + (2 * j + 1) / M
        for (let q = 0; q < TPB * TPB; q++) {
          // Tower centres a third of the block's inside apart: 100 m inside the streets.
          const a = ac + (((q % TPB) - (TPB - 1) / 2) * (100 / TPB / BLOCK) * 2) / M
          const b = bc + ((Math.floor(q / TPB) - (TPB - 1) / 2) * (100 / TPB / BLOCK) * 2) / M
          const p = dirOf(face, a, b, tmp)
          let best = Infinity, dh = Infinity
          for (const h of hs) {
            const g = Math.acos(Math.min(1, Math.max(-1, p.dot(h.dir)))) * R
            if (g + h.delay < best) { best = g + h.delay; dh = g }
          }
          const pri = best + (fbm(p, 2.2) - 0.5) * 900 + rnd(block * 9 + q, 5) * 40
          list.push({ face, a, b, block, pri, dh })
        }
      }
    }
  }
  list.sort((x, y) => x.pri - y.pri)

  const n = list.length
  const t: Towers = {
    count: n,
    perBlock: TPB * TPB,
    pos: new Float32Array(n * 3), quat: new Float32Array(n * 4),
    w: new Float32Array(n), d: new Float32Array(n), floors: new Float32Array(n), perFloor: new Float32Array(n),
    seatBase: new Float64Array(n), capacity: new Float64Array(n), block: new Int32Array(n),
    downtown: new Float32Array(n), seed: new Float32Array(n),
    blocks: 6 * M * M, blockCapacity: new Float64Array(6 * M * M),
  }
  const p = new T.Vector3(), pa = new T.Vector3(), pb = new T.Vector3()
  const X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3(), m = new T.Matrix4(), q = new T.Quaternion()
  const eps = 1e-4
  const raw = new Float64Array(n)
  let rawSum = 0
  for (let k = 0; k < n; k++) {
    const e = list[k]
    dirOf(e.face, e.a, e.b, p)
    dirOf(e.face, e.a + eps, e.b, pa)
    dirOf(e.face, e.a, e.b + eps, pb)
    // The block's size here, from the mapping's own stretch: blocks near a cube
    // corner are smaller, and their towers with them.
    const la = pa.distanceTo(p) * R / eps * (2 / M)
    const lb = pb.distanceTo(p) * R / eps * (2 / M)
    Y.copy(p)
    X.subVectors(pa, p).addScaledVector(Y, -pa.clone().sub(p).dot(Y)).normalize()
    Z.crossVectors(X, Y).normalize()
    // No two towers quite square to the street: a perfectly regular grid of
    // them shimmers in rings from orbit. A few degrees and a metre or two.
    const yaw = (rnd(k, 16) - 0.5) * 0.16
    X.applyAxisAngle(Y, yaw); Z.applyAxisAngle(Y, yaw)
    p.addScaledVector(X, ((rnd(k, 17) - 0.5) * 3) / R).addScaledVector(Z, ((rnd(k, 18) - 0.5) * 3) / R).normalize()
    m.makeBasis(X, Y, Z)
    q.setFromRotationMatrix(m)
    // Bases on the ground, which sits just under the plane the garage is drawn on.
    const base = R - GROUND_DROP
    t.pos[k * 3] = p.x * base; t.pos[k * 3 + 1] = p.y * base; t.pos[k * 3 + 2] = p.z * base
    t.quat[k * 4] = q.x; t.quat[k * 4 + 1] = q.y; t.quat[k * 4 + 2] = q.z; t.quat[k * 4 + 3] = q.w
    // A third of the block's inside, less a lane: 24-29 m on a side.
    t.w[k] = la * (0.2 + rnd(k, 11) * 0.04)
    t.d[k] = lb * (0.2 + rnd(k, 12) * 0.04)
    t.perFloor[k] = 2 * (Math.max(1, Math.floor(t.w[k] / WIN)) + Math.max(1, Math.floor(t.d[k] / WIN)))
    t.block[k] = e.block
    t.downtown[k] = e.dh
    // An integer, exact in a float: the shader's seat hash takes it as a uint.
    t.seed[k] = Math.floor(rnd(k, 13) * 16_000_000)
    // Downtown is tall and the far suburbs are low; the scale below fixes the total.
    raw[k] = 12 + 16 * Math.exp(-e.dh / 1500) + 8 * rnd(k, 14) * rnd(k, 15)
    rawSum += raw[k] * t.perFloor[k]
  }
  const want = total - firstSeat
  const scale = want / rawSum
  // Whole floors, with the rounding carried forward (error diffusion) so the
  // running total never drifts more than a floor from the ideal one. The last
  // tower then takes up the remainder as a part-built top storey.
  let carry = 0, sum = 0
  for (let k = 0; k < n; k++) {
    const ideal = raw[k] * scale * t.perFloor[k] + carry
    const floors = Math.max(3, Math.round(ideal / t.perFloor[k]))
    t.floors[k] = floors
    t.capacity[k] = floors * t.perFloor[k]
    carry = ideal - t.capacity[k]
    sum += t.capacity[k]
  }
  const last = n - 1
  t.capacity[last] = Math.max(t.perFloor[last], t.capacity[last] + (want - sum))
  t.floors[last] = Math.ceil(t.capacity[last] / t.perFloor[last])
  let s = firstSeat
  for (let k = 0; k < n; k++) { t.seatBase[k] = s; s += t.capacity[k]; t.blockCapacity[t.block[k]] += t.capacity[k] }
  return t
}

/** The tower holding seat `s`, by binary search; -1 before the planet's first tower. */
export function towerOfSeat(t: Towers, s: number): number {
  if (s < t.seatBase[0]) return -1
  let lo = 0, hi = t.count - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t.seatBase[mid] <= s) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** How many towers have anybody in them at headcount `n`. */
export function towersStarted(t: Towers, n: number): number {
  if (n <= t.seatBase[0]) return 0
  return Math.min(t.count, towerOfSeat(t, Math.min(n - 1, t.seatBase[t.count - 1] + t.capacity[t.count - 1] - 1)) + 1)
}
