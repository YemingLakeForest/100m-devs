// Voxel duck lab: true unit voxels, flat-toned faces, one shared renderer painting into 2D canvases.
import * as THREE from 'three'
THREE.ColorManagement.enabled = false

export const C = {
  Y: '#ffd23f', YS: '#f0ae2c', BK: '#f5892a', BKD: '#c95f1a', EYE: '#1d1a24', GL: '#ffffff',
  CH: '#ff9c8a', LID: '#eab430', NAVY: '#2b3a67', NAVYD: '#1e2a4d', DARK: '#2a2433', TEAL: '#35c9d9',
  GOLD: '#f2a91c', RUBY: '#d83a4a', WATER: '#3f9fc0', RIPPLE: '#a9e4f2', CASE: '#6b5f7a', CASED: '#4a4057',
  SCREEN: '#1f6e7a', CODE: '#7fe3c4', CODE2: '#f3c52e', CODE3: '#ff8f7a', FLOOR: '#2c2738', FLOOR2: '#342e42',
  WHITE: '#f4f1ea', RED: '#e04848', BADGE: '#e8eef0',
}

export class Vox {
  constructor() { this.m = new Map() }
  k(x, y, z) { return x + ',' + y + ',' + z }
  set(x, y, z, c) { this.m.set(this.k(x, y, z), c) }
  get(x, y, z) { return this.m.get(this.k(x, y, z)) }
  has(x, y, z) { return this.m.has(this.k(x, y, z)) }
  del(x, y, z) { this.m.delete(this.k(x, y, z)) }
  *each() { for (const [k, c] of this.m) { const [x, y, z] = k.split(',').map(Number); yield [x, y, z, c] } }
  add(o, dx = 0, dy = 0, dz = 0) { for (const [x, y, z, c] of o.each()) this.set(x + dx, y + dy, z + dz, c); return this }
  box(x0, y0, z0, x1, y1, z1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, c); return this }
  bounds() {
    const b = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 }
    for (const [x, y, z] of this.each()) { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.z0 = Math.min(b.z0, z); b.x1 = Math.max(b.x1, x + 1); b.y1 = Math.max(b.y1, y + 1); b.z1 = Math.max(b.z1, z + 1) }
    return b
  }
}

const NB = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

/**
 * A rubber duck as a voxel grid. Units: the body is about one unit long; N voxels per unit sets the resolution.
 * Frame: beak toward +x, up +y, flanks ±z, sitting on y = 0. Returns the grid and the head's voxel anchors.
 */
export function duck(o) {
  const N = o.N, v = new Vox(), part = new Map()
  const H = o.head, B = o.body, T = o.tail, K = o.beak
  const hs = H.sy ?? 1
  // Superellipsoids, not ellipsoids: an exponent above 2 flattens the sides and keeps the corners round, so a voxel
  // shape has a few broad faces instead of a staircase on every curve.
  const P = o.p ?? 2.6
  const inE = (p, c, r) => Math.abs((p[0] - c[0]) / r[0]) ** P + Math.abs((p[1] - c[1]) / r[1]) ** P + Math.abs((p[2] - c[2]) / r[2]) ** P <= 1
  const span = Math.ceil(1.2 * N)
  for (let ix = -span; ix <= span; ix++) for (let iy = 0; iy <= Math.ceil(1.6 * N); iy++) for (let iz = -span; iz < span; iz++) {
    const p = [(ix + 0.5) / N, (iy + 0.5) / N, (iz + 0.5) / N]
    let c = null, pt = null
    if (inE(p, B.c, B.r) || (T && inE(p, T.c, T.r)) || (o.chest && inE(p, o.chest.c, o.chest.r))) { c = C.Y; pt = 'body' }
    if (inE(p, H.c, [H.r * (H.sx ?? 1), H.r * hs, H.r])) { c = C.Y; pt = 'head' }
    if (p[0] >= K.x0 && p[0] <= K.x1 && p[1] >= K.y0 && p[1] <= K.y1 && Math.abs(p[2]) <= K.w / 2) {
      c = p[1] < K.y0 + (K.y1 - K.y0) * (K.split ?? 0.4) ? C.BKD : C.BK; pt = 'beak'
    }
    if (c) { v.set(ix, iy, iz, c); part.set(v.k(ix, iy, iz), pt) }
  }
  const surface = (x, y, z) => NB.some(([a, b, c]) => !v.has(x + a, y + b, z + c))
  const hc = [H.c[0] * N, H.c[1] * N, H.c[2] * N]
  /** The k surface voxels of a part nearest a direction from a centre: a round patch at any resolution. */
  const patch = (pt, centre, dir, k, side) => {
    const d = norm(dir), list = []
    for (const [x, y, z] of v.each()) {
      if (part.get(v.k(x, y, z)) !== pt || !surface(x, y, z)) continue
      if (side && Math.sign(z + 0.5) !== side) continue
      const q = norm([x + 0.5 - centre[0], (y + 0.5 - centre[1]) / hs, z + 0.5 - centre[2]])
      list.push([q[0] * d[0] + q[1] * d[1] + q[2] * d[2], x, y, z])
    }
    return list.sort((a, b) => b[0] - a[0]).slice(0, k).map((e) => e.slice(1))
  }
  const E = o.eye
  for (const s of [-1, 1]) {
    if (o.wing) for (const [x, y, z] of patch('body', [B.c[0] * N, B.c[1] * N, 0], [o.wing.x ?? -0.15, o.wing.y ?? 0.1, s], o.wing.k, s)) v.set(x, y, z, C.YS)
    if (E.cheek) for (const [x, y, z] of patch('head', hc, [E.dir[0] + 0.25, E.dir[1] - 0.55, s * E.dir[2]], E.cheek, s)) v.set(x, y, z, C.CH)
    const eye = patch('head', hc, [E.dir[0], E.dir[1], s * E.dir[2]], E.k, s)
    for (const [x, y, z] of eye) v.set(x, y, z, C.EYE)
    if (E.lid) {
      // Half-lidded: the top row (or two) of the eye is lid, which is the whole of "unimpressed".
      const top = Math.max(...eye.map((e) => e[1]))
      for (const [x, y, z] of eye) if (y > top - E.lid) v.set(x, y, z, C.LID)
    }
    if (E.glint && eye.length >= 3) {
      const g = patch('head', hc, [E.dir[0] + E.glint[0], E.dir[1] + E.glint[1], s * E.dir[2]], 1, s)
        .filter(([x, y, z]) => eye.some((e) => e[0] === x && e[1] === y && e[2] === z) && v.get(x, y, z) === C.EYE)
      for (const [x, y, z] of g) v.set(x, y, z, C.GL)
    }
  }
  const headTop = Math.max(...[...v.each()].filter(([x, y, z]) => part.get(v.k(x, y, z)) === 'head').map((e) => e[1]))
  return { v, N, hc, hr: H.r * N, hs, headTop, part }
}

const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l) }

// --- wardrobe, in voxels --------------------------------------------------------

export function tie(d, rows = 4) {
  const { v, part } = d
  // The chest's front face under the head, two voxels wide: knot then blade.
  const front = (y, z) => { let best = null; for (const [x, yy, zz] of v.each()) if (yy === y && zz === z && part.get(v.k(x, yy, zz)) === 'body' && (best === null || x > best)) best = x; return best }
  let y = Math.floor(d.hc[1] - d.hr * d.hs) + 1
  for (let i = 0; i < rows; i++, y--) {
    for (const z of [-1, 0]) {
      const x = front(y, z); if (x === null) continue
      const narrow = i === rows - 1 && z === 0
      if (!narrow) v.set(x + 1, y, z, i === 0 ? C.NAVYD : C.NAVY)
    }
  }
  return d
}

export function headphones(d) {
  const { v, hc, hr, hs } = d
  const R = hr + 0.9, x = Math.floor(hc[0])
  for (let a = 0; a <= Math.PI; a += 0.04) {
    const z = Math.floor(hc[2] + Math.cos(a) * R), y = Math.floor(hc[1] + Math.sin(a) * R * hs)
    if (!v.has(x, y, z)) { v.set(x, y, z, C.DARK); v.set(x - 1, y, z, C.DARK) }
  }
  for (const s of [-1, 1]) {
    const z0 = s > 0 ? Math.floor(hc[2] + hr) : Math.floor(hc[2] - hr) - 1
    for (let dx = -2; dx <= 1; dx++) for (let dy = -2; dy <= 1; dy++) {
      const z = z0 + s * 0
      for (let zz = 0; zz < 2; zz++) v.set(x + dx, Math.floor(hc[1]) + dy, z + s * zz, Math.abs(dx + 0.5) < 1.6 && Math.abs(dy + 0.5) < 1.6 && zz === 1 ? C.TEAL : C.DARK)
    }
  }
  return d
}

export function crown(d) {
  const { v, hc } = d
  const y = d.headTop + 1, r = Math.max(2, Math.round(d.hr * 0.55))
  const cx = Math.floor(hc[0]) - 0.5 + 0.5, cz = 0
  for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) for (let z = -r - 1; z <= r; z++) {
    const dd = Math.hypot(x + 0.5 - cx - 0.5, z + 0.5 - cz)
    if (dd <= r + 0.5 && dd >= r - 0.9) {
      v.set(x, y, z, C.GOLD); v.set(x, y - 1, z, v.has(x, y - 1, z) ? v.get(x, y - 1, z) : C.GOLD)
      if ((x + z) % 2 === 0) v.set(x, y + 1, z, C.GOLD)
    }
  }
  v.set(Math.floor(cx) + r, y, 0, C.RUBY); v.set(Math.floor(cx) + r, y, -1, C.RUBY)
  return d
}

export function shades(d) {
  const { v } = d
  for (const [x, y, z, c] of [...v.each()]) if (c === C.EYE || c === C.GL || c === C.LID) {
    const s = Math.sign(z + 0.5)
    v.set(x, y, z + s, C.EYE); v.set(x, y + 1, z + s, C.EYE); v.set(x + 1, y, z + s, C.EYE)
  }
  return d
}

export function lanyard(d) {
  const { v, part } = d
  const y0 = Math.floor(d.hc[1] - d.hr * d.hs)
  for (const [x, y, z] of [...v.each()]) if (part.get(v.k(x, y, z)) === 'body' && y === y0 && !v.has(x, y + 1, z) && !v.has(x, y, z + (z >= 0 ? 1 : -1))) v.set(x, y + 1, z, C.RED)
  const front = (y, z) => { let b = null; for (const [x, yy, zz] of v.each()) if (yy === y && zz === z && part.get(v.k(x, yy, zz)) === 'body' && (b === null || x > b)) b = x; return b }
  for (let i = 1; i <= 3; i++) for (const z of [-1, 0]) { const x = front(y0 - i, z); if (x !== null) v.set(x + 1, y0 - i, z, i === 1 ? C.RED : C.BADGE) }
  return d
}

// --- scenery, in voxels ---------------------------------------------------------

/** A square of bath water with a ring of ripple round whatever stands in it. */
export function water(scene, half, y, ring) {
  for (let x = -half; x < half; x++) for (let z = -half; z < half; z++) {
    if (scene.has(x, y, z)) continue
    const r = Math.hypot(x + 0.5 - ring.x, (z + 0.5 - ring.z) * 1.15)
    scene.set(x, y, z, Math.abs(r - ring.r) < 0.6 ? C.RIPPLE : C.WATER)
    scene.set(x, y - 1, z, C.WATER)
  }
  return scene
}

export function monitor(w = 20, h = 15, deep = 12) {
  const m = new Vox(), z0 = -w / 2, z1 = w / 2 - 1
  m.box(-deep + 3, 0, z0 + 3, -3, 1, z1 - 3, C.CASED)
  m.box(-deep, 2, z0, 0, h, z1, C.CASE)
  // The screen, set one voxel into the case, with code on it.
  const lines = [[1, 9, C.CODE], [3, 6, C.CODE2], [3, 10, C.CODE], [1, 5, C.CODE3], [3, 8, C.CODE]]
  for (let y = 4; y <= h - 2; y++) for (let z = z0 + 2; z <= z1 - 2; z++) { m.del(0, y, z); m.set(-1, y, z, C.SCREEN) }
  lines.forEach(([ind, len, c], i) => { for (let k = 0; k < len; k++) { const z = z1 - 3 - ind - k, y = h - 3 - i * 2; if (z >= z0 + 3 && y >= 5) m.set(-1, y, z, c) } })
  return m
}

// --- rendering ------------------------------------------------------------------

let R = null
function renderer() {
  if (R) return R
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  R.outputColorSpace = THREE.LinearSRGBColorSpace
  R.setClearColor(0x000000, 0)
  return R
}

const LIGHT = norm([-0.25, 1, 0.55])
/** Flat tone per face: lit by its normal only, so every face is one colour and the shape reads by facets. */
function tone(n) { return 0.72 + 0.28 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / TOP }
const TOP = LIGHT[1]

function meshOf(v, yaw) {
  const pos = [], col = [], cy = Math.cos(yaw), sy = Math.sin(yaw), tmp = new THREE.Color()
  const corners = {
    '1,0,0': [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], '-1,0,0': [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
    '0,1,0': [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], '0,-1,0': [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    '0,0,1': [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], '0,0,-1': [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
  }
  for (const [x, y, z, c] of v.each()) for (const n of NB) {
    if (v.has(x + n[0], y + n[1], z + n[2])) continue
    const wn = [n[0] * cy + n[2] * sy, n[1], -n[0] * sy + n[2] * cy]
    // Shade warm, not grey: a face turned from the light goes darker *and* toward orange, which is how lit plastic
    // looks and why the sides stopped reading as mustard.
    const t = (tone(wn) - 0.72) / 0.28, hsl = {}
    tmp.set(c).getHSL(hsl)
    tmp.setHSL(hsl.h - (1 - t) * 0.014, hsl.s, Math.min(0.97, hsl.l * (0.84 + 0.18 * t)))
    const q = corners[n.join(',')].map(([a, b, d]) => [x + a, y + b, z + d])
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...q[i]); col.push(tmp.r, tmp.g, tmp.b) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.FrontSide }))
  m.rotation.y = yaw
  return m
}

/**
 * Render a grid at a yaw into a fresh canvas of w×h pixels. The camera is the game's isometric one; `fill` is how much
 * of the frame the model's larger extent takes, `dx`/`dy` slide it (in frame fractions).
 */
export function render(v, { w, h = w, yaw = 0, fill = 0.82, dx = 0, dy = 0, elev = 0.6155, frame = null } = {}) {
  const r = renderer()
  r.setPixelRatio(1); r.setSize(w, h, false)
  const scene = new THREE.Scene(), mesh = meshOf(v, yaw)
  scene.add(mesh)
  const b = v.bounds(), cx = (b.x0 + b.x1) / 2, cyy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2
  mesh.position.set(0, 0, 0)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
  const az = Math.PI / 4, dir = new THREE.Vector3(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az))
  mesh.updateMatrixWorld()
  const centre = new THREE.Vector3(cx, cyy, cz).applyMatrix4(mesh.matrixWorld)
  cam.position.copy(centre).addScaledVector(dir, 100); cam.lookAt(centre); cam.updateMatrixWorld()
  // Frame on the projected corners of the box.
  const inv = cam.matrixWorldInverse
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const pts = frame ? [[frame.x0, frame.y0, frame.z0]] : v.each()
  const span = frame ? [frame.x1 - frame.x0, frame.y1 - frame.y0, frame.z1 - frame.z0] : [1, 1, 1]
  for (const [x, y, z] of pts) for (const [a, bb, c] of [[0, 0, 0], [1, 1, 1], [1, 0, 0], [0, 1, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 1]]) {
    const p = new THREE.Vector3(x + a * span[0], y + bb * span[1], z + c * span[2]).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv)
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
  }
  const ext = Math.max((x1 - x0) / w, (y1 - y0) / h) / fill
  const mx = (x0 + x1) / 2 - dx * w * ext, my = (y0 + y1) / 2 + dy * h * ext
  cam.left = mx - (w * ext) / 2; cam.right = mx + (w * ext) / 2; cam.top = my + (h * ext) / 2; cam.bottom = my - (h * ext) / 2
  cam.updateProjectionMatrix()
  r.render(scene, cam)
  const out = document.createElement('canvas'); out.width = w; out.height = h
  out.getContext('2d').drawImage(r.domElement, 0, 0)
  mesh.geometry.dispose()
  return out
}

/** A dark rim round the model's silhouette, so it holds against any tile. */
export function outlined(src, px, colour = '#16121d') {
  const w = src.width, h = src.height, out = document.createElement('canvas'); out.width = w; out.height = h
  const tint = document.createElement('canvas'); tint.width = w; tint.height = h
  const t = tint.getContext('2d'); t.drawImage(src, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = colour; t.fillRect(0, 0, w, h)
  const o = out.getContext('2d')
  for (let a = 0; a < 16; a++) o.drawImage(tint, Math.round(Math.cos(a * Math.PI / 8) * px), Math.round(Math.sin(a * Math.PI / 8) * px))
  o.drawImage(src, 0, 0)
  return out
}

export function silhouette(src, colour = '#111') {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height
  const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = colour; g.fillRect(0, 0, c.width, c.height)
  return c
}

// --- hand-placed: chamfered blocks ----------------------------------------------

/**
 * A box with its edges chamfered: `b` is the bevel on each face as [x-, x+, y-, y+, z-, z+] (or one number). A face
 * with 0 keeps a square edge, so a body can sit flat while its top rolls.
 */
export function bev(v, x0, y0, z0, x1, y1, z1, b, c) {
  const B = typeof b === 'number' ? [b, b, b, b, b, b] : b
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const r = [], bb = []
    for (const [d0, d1, i] of [[x - x0, x1 - x, 0], [y - y0, y1 - y, 2], [z - z0, z1 - z, 4]]) {
      const near = d0 <= d1 ? i : i + 1, d = Math.min(d0, d1)
      r.push(Math.max(0, B[near] - d)); bb.push(B[near])
    }
    const mb = Math.max(...bb)
    if (r[0] + r[1] > Math.max(bb[0], bb[1]) || r[0] + r[2] > Math.max(bb[0], bb[2]) || r[1] + r[2] > Math.max(bb[1], bb[2])) continue
    if (r[0] + r[1] + r[2] > mb + (mb > 1 ? 1 : 0)) continue
    v.set(x, y, z, c)
  }
  return v
}

/** Recolour the outermost voxel of each (x, y) column on one flank. */
export function paintSide(v, side, cells, c, minX = -1e9, maxX = 1e9) {
  for (const [x, y] of cells) {
    let best = null
    for (const [vx, vy, vz] of v.each()) if (vx === x && vy === y && vx >= minX && vx <= maxX && (best === null || vz * side > best * side)) best = vz
    if (best !== null) v.set(x, y, best, c)
  }
}
export const rect = (x0, y0, x1, y1) => { const o = []; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) o.push([x, y]); return o }
