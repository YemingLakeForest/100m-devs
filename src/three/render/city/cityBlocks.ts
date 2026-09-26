/*
 * Copied from the rebuild (100m-devs-three/src/render/city/cityBlocks.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **What stands on a block** — the city's architecture, 2026-09-24, third pass.
 *
 * [amended twice at the user's instruction: *"The scenes are ugly make them
 * more interesting"*, then *"Still ugly, not what I expect"*.] Measured
 * against the two references that were approved — the garage render and the
 * `q4-P-city` concept — the second pass failed for the reasons the first did,
 * only louder:
 *
 * - **Noise instead of form.** Confetti dots, thin fins, a random prop on every
 *   roof. The concept city is calm towers whose *windows* carry the light.
 * - **Towers that were scaffolding.** An open stack of slabs is not a building.
 * - **A palette nobody chose.** Randomised pastels, where the garage uses a few
 *   materials — off-white, sage, warm wood, graphite glass — and lets light and
 *   shadow do the rest.
 *
 * So this pass is built on the garage's own language (`worldArt.INK`): solid
 * towers with a window grid drawn by the shader, where **every window is lit by
 * the seats behind it** (the salvaged `unitLights` idea: "a window … coloured
 * by sampling their own seats", so a studio in a meeting is still a blue
 * city); the garage's faceted low-poly trees; restrained roofs; and real sun
 * shadows from the renderer.
 *
 * Variety still comes from the seed, never from chance: a block picks one of
 * three facade families, so neighbours differ quietly and a street looks the
 * same every time you drag back to it.
 *
 * The vertex attribute `aFacade` carries (tower seed, facade mode) — 0 plain,
 * 1 punched windows, 2 curtain glass — and `endlessCity`'s material draws the
 * grid from the world position, so the geometry stays one box per wall.
 */
import * as T from 'three'
import {
  blockOrigin, blockPeople, blockSeed, FLOOR_H, FLOORS, isRiver, LOT_D, LOT_W, PITCH_X, PITCH_Z,
  TOWER_D, TOWER_SEATS, TOWER_SLOTS, TOWER_W, type BlockKind,
} from '../../sim/cityGrid.ts'

export type RGB = number[]
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const c = (rgb: readonly number[], k = 1): RGB => [rgb[0] / 255 * k, rgb[1] / 255 * k, rgb[2] / 255 * k]
const shade = (rgb: RGB, k: number): RGB => rgb.map(v => v * k)

export class Mesher {
  pos: number[] = []
  nor: number[] = []
  col: number[] = []
  fac: number[] = []
  /** What the next faces carry in `aFacade`: (tower seed, mode). */
  facade: [number, number] = [0, 0]
  tri(a: number[], b: number[], d: number[], n: number[], rgb: RGB) {
    for (const p of [a, b, d]) {
      this.pos.push(p[0], p[1], p[2]); this.nor.push(...n); this.col.push(...rgb); this.fac.push(this.facade[0], this.facade[1])
    }
  }
  quad(ax: number, ay: number, az: number, ux: number, uy: number, uz: number, vx: number, vy: number, vz: number, n: number[], rgb: RGB) {
    const p0 = [ax, ay, az], p1 = [ax + ux, ay + uy, az + uz], p2 = [ax + ux + vx, ay + uy + vy, az + uz + vz], p3 = [ax + vx, ay + vy, az + vz]
    this.tri(p0, p1, p2, n, rgb); this.tri(p0, p2, p3, n, rgb)
  }
  flat(x: number, z: number, w: number, d: number, y: number, rgb: RGB) {
    this.quad(x, y, z, 0, 0, d, w, 0, 0, [0, 1, 0], rgb)
  }
  /**
   * A box standing on y0. The sides are the colour given; the lights and the
   * shadow map do the shading, as they do in the garage.
   */
  box(x: number, z: number, w: number, d: number, y0: number, h: number, rgb: RGB, topRgb: RGB = rgb) {
    const walls = this.facade
    this.facade = [walls[0], 0]
    this.quad(x, y0 + h, z, 0, 0, d, w, 0, 0, [0, 1, 0], topRgb)
    this.facade = walls
    // Wound so u × v points out of the box, or culling removes the wall.
    this.quad(x, y0, z + d, w, 0, 0, 0, h, 0, [0, 0, 1], rgb)
    this.quad(x + w, y0, z, 0, h, 0, 0, 0, d, [1, 0, 0], rgb)
    this.quad(x + w, y0, z, -w, 0, 0, 0, h, 0, [0, 0, -1], rgb)
    this.quad(x, y0, z + d, 0, h, 0, 0, 0, -d, [-1, 0, 0], rgb)
  }
  /** A pitched roof over a rectangle, ridge along x. */
  gable(x: number, z: number, w: number, d: number, y0: number, rise: number, rgb: RGB) {
    const ridge = z + d / 2, top = y0 + rise
    const nz = Math.hypot(rise, d / 2)
    this.quad(x, y0, z + d, w, 0, 0, 0, rise, -d / 2, [0, (d / 2) / nz, rise / nz], rgb)
    this.quad(x + w, y0, z, -w, 0, 0, 0, rise, d / 2, [0, (d / 2) / nz, -rise / nz], rgb)
    this.tri([x + w, y0, z + d], [x + w, y0, z], [x + w, top, ridge], [1, 0, 0], rgb)
    this.tri([x, y0, z], [x, y0, z + d], [x, top, ridge], [-1, 0, 0], rgb)
  }
  /**
   * A faceted crown — the garage's tree, which is a low-poly sphere with flat
   * normals. An icosahedron, stretched by `sy`, one normal per face.
   */
  ico(cx: number, cy: number, cz: number, r: number, sy: number, rgb: RGB) {
    const g = ICO
    for (let f = 0; f < g.faces.length; f += 3) {
      const [a, b, d] = [g.faces[f], g.faces[f + 1], g.faces[f + 2]].map(k => [cx + g.v[k * 3] * r, cy + g.v[k * 3 + 1] * r * sy, cz + g.v[k * 3 + 2] * r])
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const l = Math.hypot(n[0], n[1], n[2]) || 1
      this.tri(a, b, d, [n[0] / l, n[1] / l, n[2] / l], rgb)
    }
  }
  geometry(): T.BufferGeometry {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aFacade', new T.Float32BufferAttribute(this.fac, 2))
    return g
  }
}

const ICO = (() => {
  const g = new T.IcosahedronGeometry(1, 0)
  const p = g.getAttribute('position')
  const v: number[] = []
  const faces: number[] = []
  for (let k = 0; k < p.count; k++) { v.push(p.getX(k), p.getY(k), p.getZ(k)); faces.push(k) }
  g.dispose()
  return { v, faces }
})()

export function rand(seed: number, k: number): number {
  let x = (Math.imul(seed | 0, 2654435761) ^ Math.imul(k + 1, 1597334677)) >>> 0
  x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

// --- the garage's materials -------------------------------------------------------

const M = {
  paper: hex('#f3f0e8'), wall: hex('#e1d9c8'), trim: hex('#f5eddb'), grout: hex('#c9c0ac'),
  glass: hex('#48565c'), wood: hex('#b99059'), woodEdge: hex('#8d693f'), metal: hex('#393f3d'),
  leaf: hex('#87934e'), leafLight: hex('#9daa64'), lawn: hex('#a3ac72'), water: hex('#91adbe'),
  amber: hex('#d4a24e'), road: c([146, 152, 154]), roadLine: hex('#f3f0e8'), kerb: hex('#dcd6c8'),
}
/**
 * Three facade families, from the garage's walls outward: the warm plaster of
 * the garage itself, a pale stone, and graphite glass (the concept city's cool
 * towers). Roofs are the garage's metal; nothing on a tower is saturated
 * except its windows, which are its people.
 */
const FACADES = [
  { wall: M.wall, roof: shade(M.metal, 1.9), mode: 1 },
  { wall: c([196, 194, 186]), roof: shade(M.metal, 1.6), mode: 1 },
  { wall: c([172, 122, 98]), roof: shade(M.metal, 1.5), mode: 1 },   // muted brick, the garage's warm end
  { wall: shade(M.glass, 1.05), roof: shade(M.metal, 1.25), mode: 2 },
  { wall: c([118, 138, 128]), roof: shade(M.metal, 1.4), mode: 2 },  // sage glass, the garage's green
]

// --- furniture ------------------------------------------------------------------

/** The garage's tree: a wooden trunk and a faceted crown. */
export function tree(m: Mesher, x: number, z: number, s = 1, seed = 0) {
  const light = rand(seed, 3) < 0.5
  m.box(x - 0.18 * s, z - 0.18 * s, 0.36 * s, 0.36 * s, 0, 2.2 * s, M.woodEdge)
  m.ico(x, 3.4 * s, z, 1.9 * s, 1.35, light ? M.leafLight : M.leaf)
}

function hedgeRow(m: Mesher, x: number, z: number, w: number, d: number) {
  m.box(x, z, w, d, 0, 0.3, M.trim)
  m.box(x + 0.1, z + 0.1, w - 0.2, d - 0.2, 0.3, 0.9, M.leaf)
}

/** The street's furniture on a block's south and east sides: dashes, a crossing, and a row of trees. */
function street(m: Mesher, i: number, j: number, x0: number, z0: number, seed: number) {
  const ex = x0 + LOT_W + (PITCH_X - LOT_W) / 2
  const sz = z0 + LOT_D + (PITCH_Z - LOT_D) / 2
  if (!(isRiver(i + 1, j) && isRiver(i, j))) for (let z = z0 + 4; z < z0 + LOT_D - 4; z += 9) m.flat(ex - 0.2, z, 0.4, 4, 0.04, M.roadLine)
  for (let x = x0 + 4; x < x0 + LOT_W - 4; x += 9) m.flat(x, sz - 0.2, 4, 0.4, 0.04, M.roadLine)
  for (let k = 0; k < 7; k++) m.flat(x0 + LOT_W + 4 + k * 2.4, z0 + LOT_D + 2, 1.2, 4, 0.045, M.roadLine)
  // The kerb: a raised apron round the lot, the garage's pavement.
  m.box(x0 - 3, z0 - 3, LOT_W + 6, LOT_D + 6, 0, 0.15, M.kerb, M.paper)
  for (let k = 0; k < 4; k++) tree(m, x0 + 9 + k * 18, z0 + LOT_D + 1.5, 0.75, seed + k)
  for (let k = 0; k < 3; k++) tree(m, x0 + LOT_W + 1.5, z0 + 10 + k * 18, 0.75, seed + 20 + k)
}

// --- the blocks -------------------------------------------------------------------

/** `hqTower` false leaves HQ's tower out: the HQ floor's room stands there instead (phase 6). */
/**
 * `hqTower` false leaves HQ's tower out (the HQ floor's room stands there).
 * `world` [2026-09-25]: on a colony, HQ is the outpost dome and the land past
 * the frontier is rock, not somebody's suburb.
 */
export function buildBlock(m: Mesher, i: number, j: number, kind: BlockKind, heads: number, hqTower = true,
  world: { colony: boolean; wild: 'houses' | 'rocks' } = { colony: false, wild: 'houses' }) {
  const [x0, z0] = blockOrigin(i, j)
  const seed = blockSeed(i, j)
  m.facade = [0, 0]
  if (kind === 'river') return river(m, i, j, x0, z0)
  street(m, i, j, x0, z0, seed)
  if (kind === 'hq') return world.colony ? outpost(m, x0, z0, seed) : hq(m, x0, z0, seed, hqTower)
  if (kind === 'park') return park(m, x0, z0, seed)
  if (kind === 'suburb') return world.wild === 'rocks' ? rocks(m, x0, z0, seed) : suburb(m, x0, z0, seed)
  if (kind === 'site') return site(m, x0, z0, seed)
  built(m, i, j, x0, z0, seed, heads)
}

function river(m: Mesher, i: number, j: number, x0: number, z0: number) {
  const px = x0 - (PITCH_X - LOT_W) / 2, pz = z0 - (PITCH_Z - LOT_D) / 2
  // Above the street plane, which runs under the whole view: water below it
  // was simply covered (measured: a grey river). The banks stand proud instead.
  // Deeper than the garage's pond blue: a hundred metres of that pale tone under
  // the sun read as a grey road. Darker mid-channel, lighter at the banks.
  m.flat(px, pz, PITCH_X, PITCH_Z, 0.03, c([92, 138, 166]))
  m.flat(px + 14, pz, PITCH_X - 28, PITCH_Z, 0.04, c([64, 108, 140]))
  if (!isRiver(i - 1, j)) m.box(px, pz, 5, PITCH_Z, 0, 0.7, M.grout, M.paper)
  if (!isRiver(i + 1, j)) m.box(px + PITCH_X - 5, pz, 5, PITCH_Z, 0, 0.7, M.grout, M.paper)
  // The bridge: a deck, two parapets and piers.
  const bz = z0 + LOT_D + 2
  m.box(px, bz, PITCH_X, 18, 0.6, 0.6, M.grout, M.road)
  m.box(px, bz, PITCH_X, 0.6, 1.2, 1, M.paper)
  m.box(px, bz + 17.4, PITCH_X, 0.6, 1.2, 1, M.paper)
  for (const k of [0.3, 0.7]) m.box(px + PITCH_X * k - 1, bz + 2, 2, 14, 0.03, 0.6, M.grout)
}

/** HQ's measurements, shared with the renderer's lit crown and beacon. */
export const HQ_TOWER = { dx: 40, dz: 8, w: 26, d: 22, floors: 11, setback: 3, upper: 4 }

function hq(m: Mesher, x0: number, z0: number, seed: number, withTower = true) {
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, M.lawn)
  const { dx, dz, w, d, floors, setback, upper } = HQ_TOWER
  const tx = x0 + dx, tz = z0 + dz
  if (!withTower) return
  m.box(tx - 2, tz - 2, w + 4, d + 4, 0.15, 0.8, M.trim, M.paper)
  m.box(tx + 6, tz + d, 14, 4, FLOOR_H - 1.2, 0.5, M.amber)
  // The studio's tower: curtain glass, its windows lit by the heroes' floor.
  m.facade = [seed % 997, 2]
  m.box(tx, tz, w, d, 0.95, floors * FLOOR_H - 0.95, shade(M.glass, 0.9), shade(M.metal, 1.4))
  m.box(tx + setback, tz + setback, w - setback * 2, d - setback * 2, floors * FLOOR_H, upper * FLOOR_H, shade(M.glass, 0.9), shade(M.metal, 1.4))
  m.facade = [0, 0]
  for (let f = 4; f < floors; f += 4) m.box(tx - 0.1, tz - 0.1, w + 0.2, d + 0.2, f * FLOOR_H - 0.15, 0.3, M.amber)
  const top = (floors + upper) * FLOOR_H
  m.box(tx + w / 2 - 0.35, tz + d / 2 - 0.35, 0.7, 0.7, top + 3.2, 16, M.paper)
  // The lawn: the launch pad James will leave from (§5), and a grove.
  m.box(x0 + 12, z0 + 12, 16, 16, 0.15, 0.4, M.grout, M.paper)
  m.flat(x0 + 15, z0 + 15, 10, 10, 0.56, M.amber)
  m.flat(x0 + 17, z0 + 17, 6, 6, 0.57, M.paper)
  for (let k = 0; k < 7; k++) tree(m, x0 + 6 + (k % 4) * 8, z0 + 40 + Math.floor(k / 4) * 12, 1, seed + k)
}

function park(m: Mesher, x0: number, z0: number, seed: number) {
  const plaza = rand(seed, 40) < 0.3
  if (plaza) {
    // A paved square, a fountain, trees in a grid: the garage's courtyard, grown up.
    m.flat(x0, z0, LOT_W, LOT_D, 0.16, M.paper)
    for (let a = 0; a < 12; a++) m.flat(x0 + a * 6, z0, 0.2, LOT_D, 0.17, M.grout)
    m.box(x0 + 28, z0 + 24, 16, 16, 0.15, 0.7, M.trim, M.paper)
    m.flat(x0 + 29, z0 + 25, 14, 14, 0.86, M.water)
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
      if (a >= 1 && a <= 2 && b === 1) continue
      tree(m, x0 + 9 + a * 18, z0 + 10 + b * 22, 1, seed + a * 7 + b)
    }
    return
  }
  // The park: lawn, one path, a pond, and trees in clumps rather than confetti.
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, M.lawn)
  m.flat(x0, z0 + 30, LOT_W, 3, 0.17, M.paper)
  m.flat(x0 + 42, z0 + 38, 22, 17, 0.17, M.water)
  for (let clump = 0; clump < 4; clump++) {
    const cx = x0 + 8 + rand(seed, clump) * 28, cz = z0 + 6 + rand(seed, clump + 9) * 18 + (clump % 2) * 34
    for (let k = 0; k < 4; k++) tree(m, cx + (k % 2) * 5 + rand(seed, clump * 7 + k) * 2, cz + Math.floor(k / 2) * 5, 0.9 + rand(seed, k + clump) * 0.4, seed + clump * 4 + k)
  }
}

/**
 * A colony's HQ — James's outpost (§5): a dome, a relay dish pointed home, and
 * a landing pad where the ship came down. Stepped rings, because the grid's
 * box language builds a dome the way voxel art does.
 */
function outpost(m: Mesher, x0: number, z0: number, seed: number) {
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, c([176, 150, 128]))
  const cx = x0 + 40, cz = z0 + 24, R = 16
  for (let k = 0; k < 7; k++) {
    const r = R * Math.cos((k / 7) * Math.PI / 2)
    m.box(cx - r, cz - r * .85, r * 2, r * 1.7, k * 2.2, 2.2, k % 2 ? M.trim : c([226, 232, 236]))
  }
  m.box(cx - 2, cz + R * .85 - .5, 4, 3, 0.15, 3.2, M.glass)
  // The dish, on its mast.
  m.box(x0 + 14, z0 + 14, 1, 1, 0.15, 14, M.metal)
  m.box(x0 + 9, z0 + 11, 11, 7, 14, 1, M.paper)
  m.box(x0 + 13.5, z0 + 13.5, 2, 2, 15, 3, M.metal)
  // The landing pad, and the ship that brought them.
  m.box(x0 + 8, z0 + 38, 18, 18, 0.15, .4, M.grout, M.paper)
  m.flat(x0 + 11, z0 + 41, 12, 12, .56, M.amber)
  m.box(x0 + 14.5, z0 + 44.5, 5, 5, .56, 12, c([236, 236, 230]))
  m.box(x0 + 15.5, z0 + 45.5, 3, 3, 12.5, 3, c([200, 72, 60]))
  for (let k = 0; k < 4; k++) tree(m, x0 + 50 + (k % 2) * 8, z0 + 46 + Math.floor(k / 2) * 8, .8, seed + k)
}

/** Alien wilds: rocks and low scrub, where Earth would have a suburb. */
function rocks(m: Mesher, x0: number, z0: number, seed: number) {
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, c([186, 164, 140]))
  for (let k = 0; k < 9; k++) {
    const rx = x0 + 4 + rand(seed, k) * 60, rz = z0 + 4 + rand(seed, k + 30) * 52, r = 2 + rand(seed, k + 60) * 6
    m.box(rx, rz, r, r * .8, 0.15, r * .7, c([150, 132, 116]), c([170, 152, 134]))
    if (rand(seed, k + 90) < .4) m.box(rx + r * .2, rz + r * .2, r * .5, r * .4, r * .7 + .15, r * .4, c([160, 142, 124]))
  }
  for (let k = 0; k < 3; k++) tree(m, x0 + 10 + rand(seed, k + 120) * 50, z0 + 10 + rand(seed, k + 150) * 44, .6, seed + k)
}

function suburb(m: Mesher, x0: number, z0: number, seed: number) {
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, M.lawn)
  for (let k = 0; k < 6; k++) {
    const hx = x0 + 4 + (k % 3) * 23, hz = z0 + 4 + Math.floor(k / 3) * 31
    const s = seed * 7 + k
    hedgeRow(m, hx - 1, hz + 26.5, 22, 1)
    const hw = 11, hd = 9
    // The garage's plaster and trim; roofs in two quiet tones.
    const roof = rand(s, 3) < 0.5 ? c([148, 104, 84]) : shade(M.metal, 1.6)
    m.box(hx + 3, hz + 4, hw, hd, 0.15, 3.4, rand(s, 2) < 0.5 ? M.wall : M.trim)
    m.gable(hx + 2.5, hz + 3.5, hw + 1, hd + 1, 3.55, 2.8, roof)
    m.box(hx + 6, hz + 4 + hd - 0.05, 2, 0.1, 0.15, 2.2, M.woodEdge)
    m.flat(hx + hw + 4, hz + 3, 3.5, 22, 0.17, M.grout)
    tree(m, hx + 6, hz + 20, 0.9, s)
  }
}

function site(m: Mesher, x0: number, z0: number, seed: number) {
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, c([196, 184, 160]))
  m.box(x0, z0 + LOT_D - 0.4, LOT_W, 0.4, 0.15, 2.2, M.trim)
  m.box(x0 + LOT_W - 0.4, z0, 0.4, LOT_D, 0.15, 2.2, M.trim)
  const [ox, oz] = TOWER_SLOTS[Math.floor(rand(seed, 6) * 4)]
  const floors = 2 + Math.floor(rand(seed, 5) * 5)
  // The next tower rising: slabs on a grid of columns.
  for (let f = 1; f <= floors; f++) m.box(x0 + ox, z0 + oz, TOWER_W, TOWER_D, f * FLOOR_H - 0.4, 0.4, M.grout, M.paper)
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) m.box(x0 + ox + a * (TOWER_W - 0.6) / 2, z0 + oz + b * (TOWER_D - 0.6) / 2, 0.6, 0.6, 0.15, floors * FLOOR_H, M.grout)
  // One crane, in the garage's amber.
  const cx = x0 + ox + TOWER_W + 4, cz = z0 + oz + 4
  const mast = floors * FLOOR_H + 22
  m.box(cx - 0.7, cz - 0.7, 1.4, 1.4, 0.15, mast, M.amber)
  m.box(cx - 8, cz - 0.5, 34, 1, mast, 1.1, M.amber)
  m.box(cx - 8, cz - 1.3, 3, 2.6, mast - 2, 2, M.metal)
  m.box(cx + 18, cz - 0.1, 0.2, 0.2, mast * 0.5, mast * 0.5, M.metal)
}

/**
 * A block's form: four ways to hold four thousand people, chosen by the seed,
 * so the skyline has shape instead of being a carpet of equal towers. Each is
 * scaled by how full the block is — a frontier block is shorter, not emptier.
 * The windows sample the block's seats whatever the form (`endlessCity`), so
 * the form is architecture and the headcount is still the studio's.
 */
/** A built block's dice, in one place: {@link built} draws them and {@link builtRoof} points at them. */
function blockForm(i: number, j: number, seed: number, heads: number) {
  const fill = Math.min(1, blockPeople(i, j, heads) / (TOWER_SEATS * TOWER_SLOTS.length))
  return {
    look: FACADES[Math.floor(rand(seed, 30) * FACADES.length)],
    floorsOf: (max: number) => Math.max(2, Math.round(max * fill)),
    form: Math.floor(rand(seed, 31) * 4),
  }
}

const STEPS = [1, 0.8, 0.9, 0.7]

/**
 * The top of a built block's tallest roof, world metres — where its speech
 * balloons and its build sparks leave from (§6 [2026-09-26]).
 */
export function builtRoof(i: number, j: number, heads: number): [number, number, number] {
  const [x0, z0] = blockOrigin(i, j)
  const seed = blockSeed(i, j)
  const { floorsOf, form } = blockForm(i, j, seed, heads)
  if (form === 1) return [x0 + 19, floorsOf(17) * FLOOR_H + 3, z0 + 17]
  if (form === 2) return [x0 + 36, FLOOR_H * (2 + floorsOf(28)) + 4, z0 + 31]
  if (form === 3) return [x0 + 36, floorsOf(8) * FLOOR_H + 1, z0 + 10]
  const slot = (4 - (seed % 4)) % 4
  const [ox, oz] = TOWER_SLOTS[slot]
  return [x0 + ox + TOWER_W / 2, floorsOf(Math.round(FLOORS * 1.3 * STEPS[(slot + seed) % 4])) * FLOOR_H + 3, z0 + oz + TOWER_D / 2]
}

function built(m: Mesher, i: number, j: number, x0: number, z0: number, seed: number, heads: number) {
  const { look, floorsOf, form } = blockForm(i, j, seed, heads)
  m.flat(x0, z0, LOT_W, LOT_D, 0.16, M.paper)
  if (form === 1) {
    // Twin towers on a lawn.
    m.flat(x0 + 4, z0 + 34, 30, 26, 0.17, M.lawn)
    m.flat(x0 + 38, z0 + 4, 30, 26, 0.17, M.lawn)
    tower(m, x0 + 5, z0 + 5, 28, 24, floorsOf(17), look, seed * 4)
    tower(m, x0 + 39, z0 + 35, 28, 24, floorsOf(15), look, seed * 4 + 1)
    for (let k = 0; k < 3; k++) { tree(m, x0 + 10 + k * 9, z0 + 46, 1.1, seed + k); tree(m, x0 + 44 + k * 9, z0 + 15, 1.1, seed + 9 + k) }
    return
  }
  if (form === 2) {
    // One spire on a podium, the block's landmark.
    m.box(x0 + 4, z0 + 4, 64, 56, 0.15, FLOOR_H * 2, look.wall, shade(M.lawn, 1))
    for (let k = 0; k < 5; k++) tree(m, x0 + 10 + k * 12, z0 + 50, 1, seed + k)
    const f = floorsOf(28)
    m.facade = [seed % 9973, look.mode === 1 ? 2 : look.mode]
    m.box(x0 + 22, z0 + 18, 28, 26, FLOOR_H * 2, f * FLOOR_H, look.mode === 1 ? shade(M.glass, 1.05) : look.wall, look.roof)
    m.facade = [0, 0]
    m.box(x0 + 30, z0 + 26, 12, 10, FLOOR_H * (2 + f), 4, shade(look.roof, 1.15), M.amber)
    livery(m, x0 + 22, z0 + 18, 28, 26, FLOOR_H * (2 + f))
    return
  }
  if (form === 3) {
    // A courtyard block: four bars round a garden, the way old cities hold people.
    const f = floorsOf(8)
    m.flat(x0 + 16, z0 + 16, 40, 32, 0.17, M.lawn)
    tree(m, x0 + 28, z0 + 28, 1.3, seed); tree(m, x0 + 44, z0 + 36, 1.1, seed + 1); tree(m, x0 + 36, z0 + 24, 0.9, seed + 2)
    tower(m, x0 + 4, z0 + 4, 64, 12, f, look, seed * 4, false)
    tower(m, x0 + 4, z0 + 48, 64, 12, f, look, seed * 4 + 1, false)
    tower(m, x0 + 4, z0 + 16, 12, 32, f, look, seed * 4 + 2, false)
    tower(m, x0 + 56, z0 + 16, 12, 32, f, look, seed * 4 + 3, false)
    return
  }
  // Four towers, their heights stepped so the block reads as a group.
  m.flat(x0 + 30, z0 + 25, 10, 13, 0.17, M.lawn)
  tree(m, x0 + 35, z0 + 31.5, 1.1, seed)
  TOWER_SLOTS.forEach(([ox, oz], slot) => {
    tower(m, x0 + ox, z0 + oz, TOWER_W, TOWER_D, floorsOf(Math.round(FLOORS * 1.3 * STEPS[(slot + seed) % 4])), look, seed * 4 + slot)
  })
}

/**
 * **The studio's livery** — §6 [amended 2026-09-26]: *"I need to know and
 * showing clear to players these are you developers offices"*. Every tower the
 * studio holds wears HQ's amber — a band round the parapet and the roof mark —
 * and nothing else in the city does, so from ten blocks up the player's offices
 * read as one company against the grey suburb they are eating. The amber is
 * already the studio's (HQ's floor bands, the launch pad, the cranes building
 * the next ones); this puts it where the sky can see it.
 */
function livery(m: Mesher, tx: number, tz: number, w: number, d: number, h: number) {
  m.box(tx, tz, w, 0.6, h, 1.1, M.amber)
  m.box(tx, tz + d - 0.6, w, 0.6, h, 1.1, M.amber)
  m.box(tx, tz, 0.6, d, h, 1.1, M.amber)
  m.box(tx + w - 0.6, tz, 0.6, d, h, 1.1, M.amber)
}

function tower(m: Mesher, tx: number, tz: number, w: number, d: number, floors: number, look: typeof FACADES[number], seed: number, crown = true) {
  const h = floors * FLOOR_H
  // Lobby: the garage's glass at street level, set back under the building.
  m.box(tx + 0.8, tz + 0.8, w - 1.6, d - 1.6, 0.15, FLOOR_H - 0.15, M.glass)
  // The body: one box. The shader draws a window per bay per floor, lit by the
  // seats behind it (`endlessCity`'s facade material).
  m.facade = [seed % 9973, look.mode]
  m.box(tx, tz, w, d, FLOOR_H, h - FLOOR_H, look.wall, look.roof)
  m.facade = [0, 0]
  // The parapet in the studio's livery, and the plant room; one in three a water tank.
  livery(m, tx, tz, w, d, h)
  if (!crown) return
  // The roof mark: HQ's amber pad, on every roof the studio holds.
  m.box(tx + w * 0.22, tz + d * 0.24, w * 0.4, d * 0.4, h, 3, shade(look.roof, 1.15), M.amber)
  m.flat(tx + w * 0.32, tz + d * 0.34, w * 0.2, d * 0.2, h + 3.02, M.paper)
  if (rand(seed, 7) < 0.33) {
    m.box(tx + w * 0.72, tz + d * 0.58, 3.6, 3.6, h, 1.4, M.metal)
    m.box(tx + w * 0.72, tz + d * 0.58, 3.6, 3.6, h + 1.4, 3.2, M.wood)
  }
}
