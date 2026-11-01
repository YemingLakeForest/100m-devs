import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
// The shipped HQ, not a copy: the same builder the game's garage view calls. Vite serves it from src/.
import { buildGarageEnvironment, GARAGE_ASSEMBLED, showGarageSeats, showGarageStations } from '/src/three/render/garageEnvironment.ts'
import { defaultCast } from '/src/three/render/studioPeople.ts'

/* ------------------------------------------------------------------ constants */
// The floor is a 5 x 5 lattice of the HQ lot's own size (33 x 25 m, the apron garageEnvironment lays under the studio),
// with the HQ in the middle cell, so the HQ is the heart of the floor and not a guest on somebody's. The lattice is only
// a ruler: nothing is drawn per cell except desks and the strips of rooms between them, so the carpet, the aisles and
// the columns read straight across every line the cells would have made.
const W = 33, D = 25
const HQ_AT = { x: 1.5, z: 1.1 }
const REACH = 2                                   // cells out from the HQ cell on each side
const A = (REACH + .5) * W, B = (REACH + .5) * D  // the floor spans x +-82.5, z +-62.5
const COLS = 8, ROWS = 6                          // desks per cell (48)
const HQ_HEADS = 20
const LEVEL = -0.4                                // the HQ lot's top (garageEnvironment's apron), so the first seam has no step
const SINK = 0.35                                 // the hinge line sits this far under the floor: see buildFlap
const UNFOLD = 1.5                                // seconds from hanging to flat
const STAGGER = 0.16                              // the four flaps go a beat apart, clockwise: a pinwheel, not a queue
const BOUNCE = 0.09                               // the slam's rebound, radians: a 50 m flap lifts its far edge 4 m, not 10
const WAVE_AT = 1.8                               // seconds after the open until the furniture wave leaves the HQ
const WAVE_SPEED = 34                             // metres a second, along the floor's own rectangle
const DROP = 0.45, LEAD = 0.25, DROP_H = 3.4      // a hire: the desk falls first, its developer a quarter-second behind

const PAL = {
  n0:0x181919, n1:0x292a29, n2:0x3c3e3c, n3:0x575a56, n6:0xb8b9b0, n7:0xd9d8cd, n8:0xf1efe6,
  calm1:0x1a6b78, calm2:0x35c9d9, calm3:0xb8f4ff, warn2:0xe0a52e, warn3:0xffe9b0, alarm2:0xe03c3c,
}
const clamp01 = (t) => Math.max(0, Math.min(1, t))
const rnd = (a, b) => a + Math.random() * (b - a)
const easeInOut = (t) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const hash = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
const bounce = (x) => {
  const n1 = 7.5625, d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + .75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + .9375
  return n1 * (x -= 2.625 / d1) * x + .984375
}

/* ------------------------------------------------------------------ renderer, camera, light */
const renderer = new THREE.WebGLRenderer({ antialias:true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(PAL.n0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000)
const VIEW = new THREE.Vector3(1, 0.88, 1).normalize()   // from +X/+Z, as the game's lens
// The game's own rig in the OS look (garageView.ts), so the HQ is lit as it is in play. No shadows: the lit area is
// the whole floor and a shadow map cannot cover it.
scene.add(new THREE.HemisphereLight('#e6ecea', '#8d9795', 1.25))
const sun = new THREE.DirectionalLight('#f1f1ed', 1.25); sun.position.set(-18, 30, -8); scene.add(sun)
const fill = new THREE.DirectionalLight('#e7ebe8', 0.30); fill.position.set(-32, 15, -10); scene.add(fill)

/* ------------------------------------------------------------------ shared geometry, materials, shaders */
const U = { value: 0 }                 // idle-motion clock
const WAVE = { value: -10 }            // the furniture wave's front, metres from the HQ along the floor's rectangle

/** Idle life without per-frame JS: workers breathe, monitors shimmer, each by a hash of its own position. */
function alive(mat, { bob = 0, shimmer = 0 }) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying float vH;')
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        #ifdef USE_INSTANCING
          vH = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898,78.233))) * 43758.5453);
        #else
          vH = 0.;
        #endif
        transformed.y += ${bob.toFixed(3)} * (0.5 + 0.5*sin(uTime*3.0 + vH*40.));`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying float vH;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 1.0 - ${shimmer.toFixed(3)} * (0.5 + 0.5*sin(uTime*(2.0+vH*3.) + vH*40.));`)
  }
  return mat
}

/**
 * **One wave for the whole office.** Every architectural vertex carries `aDist`, the Chebyshev distance of its part's
 * centre from the HQ, scaled so the floor's wall is at A. Until the wave's front passes it a part has no height; then it
 * rises with a little overshoot. The front is a rectangle in the floor's own proportions, so the office swells out of
 * the HQ as one shape and the four flaps' seams are not on its path: the wave does not know they are there. (A part
 * with `aDist < 0` is the carpet itself and is always up.) `stripe` draws the front as a hard cyan band on the carpet,
 * hard-edged by the house rule (no glows).
 */
function waved(mat, uOff, stripe = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWave = WAVE; sh.uniforms.uOff = uOff
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDist; uniform float uWave; uniform vec2 uOff; varying vec2 vF;')
      .replace('#include <begin_vertex>', `
        float pp = aDist < 0.0 ? 1.0 : clamp((uWave - aDist) / 7.0, 0.0, 1.0);
        float ee = pp >= 1.0 ? 1.0 : 1.0 + 2.7 * pow(pp - 1.0, 3.0) + 1.7 * pow(pp - 1.0, 2.0);
        vec3 transformed = vec3(position.x, position.y * ee, position.z);
        vF = position.xz + uOff;`)
    if (!stripe) return
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWave; varying vec2 vF;
        float frontBand() { float dd = max(abs(vF.x) / ${A.toFixed(1)}, abs(vF.y) / ${B.toFixed(1)}) * ${A.toFixed(1)};
          return step(uWave, dd) * step(dd, uWave + 1.3) * step(-5.0, uWave); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += frontBand() * vec3(0.21, 0.79, 0.85);`)
  }
  return mat
}

const deskGeo = new THREE.BoxGeometry(1.7, 0.78, 0.85).translate(0, 0.39, 0)
const screenGeo = new THREE.BoxGeometry(0.72, 0.46, 0.05).translate(0, 1.05, -0.28)
const workerGeo = new THREE.CapsuleGeometry(0.24, 0.5, 3, 8)
const padGeo = new THREE.BoxGeometry(1.9, 0.02, 1.05)
const deskMat = new THREE.MeshLambertMaterial({ color:PAL.n6 })
const screenMat = alive(new THREE.MeshBasicMaterial({ color:PAL.calm2 }), { shimmer:0.45 })
const workerMat = alive(new THREE.MeshLambertMaterial({ color:0xffffff }), { bob:0.06 })
const padMat = new THREE.MeshLambertMaterial({ color:0x464a47 })
// Lit from within a little: a flap mid-swing shows its underside to the sky, and a lit-from-above slab is a black hole there.
const slabMat = new THREE.MeshLambertMaterial({ color:0x3a3c3a, emissive:0x1c1d1c })
const edgeMat = new THREE.LineBasicMaterial({ color:PAL.calm2 })
const SHIRTS = [PAL.calm2, PAL.warn2, PAL.alarm2, PAL.n7, PAL.calm3, 0x6a8f4e, 0xb06ad0].map((c) => new THREE.Color(c))

/* ------------------------------------------------------------------ the HQ: the real one, in the middle */
// buildGarageEnvironment is what the game's garage view builds, called the way garageView.build() calls it
// (cityGrid=true, the OS look). Nothing in it is moved, resized or re-skinned. The only thing taken away is the 512 m
// horizon plane: the floor is the ground now, and a floor-coloured sea under it would show between the flaps.
const cast = { ...defaultCast(), heroes: ['billy', 'serena', 'matt'] }
const hq = buildGarageEnvironment(HQ_HEADS, cast, 'off', false, GARAGE_ASSEMBLED, true)
showGarageSeats(hq, HQ_HEADS, 0)
showGarageStations(hq, GARAGE_ASSEMBLED, cast)
showGarageSeats(hq, HQ_HEADS, HQ_HEADS)
hq.root.traverse((o) => {
  if (!o.isMesh) return
  o.updateWorldMatrix(true, false)   // the 512 m is in the mesh's scale, not its geometry
  if (new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).x > 100) o.visible = false
})
scene.add(hq.root)

/* ------------------------------------------------------------------ the floor: four flaps around the HQ */
// A pinwheel: each flap is hinged on one edge of the HQ lot and runs out to the wall, and each hangs its far end past
// the next flap's near end, so the four rectangles tile the whole floor with the HQ in the middle and no corner piece
// left over to wait for a neighbour. (Cells are [column range] x [row range] from the HQ cell.) `nx, nz` point from the
// flap to its hinge.
const FLAPS = [
  { name:'N', ci:[-2, 0], cj:[-2, -1], nx:0,  nz:1  },
  { name:'E', ci:[1, 2],  cj:[-2, 0],  nx:-1, nz:0  },
  { name:'S', ci:[0, 2],  cj:[1, 2],   nx:0,  nz:-1 },
  { name:'W', ci:[-2, -1], cj:[0, 2],  nx:1,  nz:0  },
]
const floorRoot = new THREE.Group(); floorRoot.position.set(HQ_AT.x, LEVEL, HQ_AT.z); scene.add(floorRoot)
const dummy = new THREE.Object3D()
const allSeats = []

/** A Chebyshev distance from the HQ, scaled so the walls sit at A: the wave's own metric. */
const waveDist = (x, z) => Math.max(Math.abs(x) / A, Math.abs(z) / B) * A

function buildFlap(def, order) {
  const x0 = (def.ci[0] - .5) * W, x1 = (def.ci[1] + .5) * W, z0 = (def.cj[0] - .5) * D, z1 = (def.cj[1] + .5) * D
  // The hinge is the flap's edge toward the HQ; the panel's origin is that line, so everything below is built in
  // floor coordinates and shifted by (-hx, -hz).
  const hx = def.nx ? (def.nx < 0 ? x0 : x1) : (x0 + x1) / 2
  const hz = def.nz ? (def.nz < 0 ? z0 : z1) : (z0 + z1) / 2
  const parts = { carpet:[], deco:[], glass:[] }
  const lines = []
  const inRect = (x, z) => x >= x0 - .01 && x <= x1 + .01 && z >= z0 - .01 && z <= z1 + .01

  /** One box, in floor coordinates, y up from the carpet. `pop` false makes it carpet: always up. */
  function part(kind, w, h, d, x, y, z, color, pop = true) {
    const g = new THREE.BoxGeometry(w, h, d).translate(x - hx, y + h / 2, z - hz)
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3), dist = new Float32Array(n).fill(pop ? waveDist(x, z) : -1)
    for (let i = 0; i < n; i++) { a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1)); g.deleteAttribute('uv')
    parts[kind].push(g)
  }

  /* --- the carpet, the aisles and the two avenues ---------------------------------------------------------------- */
  part('carpet', x1 - x0, .03, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, 0x505653, false)
  for (let ci = def.ci[0]; ci <= def.ci[1]; ci++) for (let cj = def.cj[0]; cj <= def.cj[1]; cj++) layoutCell(ci, cj)

  function layoutCell(ci, cj) {
    const cx = ci * W, cz = cj * D
    const avenueNS = ci === 0, avenueEW = cj === 0
    // The desk grid: a centre aisle (3.2 m between desk edges) and a cross aisle (2.75 m); the runners lie in them.
    // The two avenues are the same runners made wider, and each one ends at a front door.
    const rw = avenueNS ? 4.2 : 3.0, ew = 2.6
    const pieces = avenueEW ? [[cz - D / 2, cz - ew / 2], [cz + ew / 2, cz + D / 2]] : [[cz - D / 2, cz + D / 2]]
    for (const [a0, a1] of pieces) {
      part('carpet', rw, .036, a1 - a0, cx, 0, (a0 + a1) / 2, 0x343a3b, false)
      // The avenues' inlay is the bright cyan; an ordinary aisle's is the dim teal, so the two high streets are the
      // ones the eye follows from the HQ to its doors.
      for (const s of [-1, 1]) part('carpet', .12, .04, a1 - a0, cx + s * (rw / 2 + .1), 0, (a0 + a1) / 2, avenueNS ? PAL.calm2 : PAL.calm1, false)
    }
    if (avenueEW) {
      part('carpet', W, .038, ew, cx, 0, cz, 0x343a3b, false)
      for (const s of [-1, 1]) part('carpet', W, .042, .12, cx, 0, cz + s * (ew / 2 + .1), PAL.calm2, false)
    }
    // Low pod dividers, with a gap to cross at the cross aisle.
    for (const sx of [-1, 1]) for (const [a0, a1] of [[-9.6, -.9], [.9, 9.6]]) part('deco', .14, 1.15, a1 - a0, cx + sx * 7.7, 0, cz + (a0 + a1) / 2, 0x7d8f92)

    // The two 3 m strips along the cell's north and south edges hold what makes it an office rather than a seating
    // chart. Four programmes, chosen by hash, so a walk across the floor is not one cell repeated 24 times.
    const prog = Math.floor(hash(ci * 7.3 + cj * 13.1 + 4) * 4)
    const meeting = (mx, mz) => {
      part('deco', 3.4, .08, 1.0, mx, .72, mz, 0xb69a6a); part('deco', .2, .72, .2, mx, 0, mz, 0x3c3e3c)
      for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) part('deco', .5, .5, .5, mx - 1.2 + i * .8, 0, mz + sz * .85, 0x1a6b78)
      part('glass', 7, 2.5, .06, mx, 0, mz - 1.1, 0xb8f4ff); part('glass', 7, 2.5, .06, mx, 0, mz + 1.1, 0xb8f4ff)
      part('glass', .06, 2.5, 2.2, mx - 3.5, 0, mz, 0xb8f4ff); part('glass', .06, 2.5, 2.2, mx + 3.5, 0, mz, 0xb8f4ff)
    }
    const pantry = (px, pz) => { part('deco', 6, .9, 1, px, 0, pz, 0x97988f); part('deco', 6.1, .06, 1.1, px, .9, pz, 0xd9d8cd) }
    const lounge = (lx, lz) => {
      part('deco', 5, .45, .9, lx, 0, lz, 0x1a6b78); part('deco', 5, .55, .22, lx, .45, lz + (lz > cz ? .34 : -.34), 0x1a6b78)
      part('deco', 1.4, .4, 1.0, lx - 3.4, 0, lz, 0x3c3e3c); part('deco', 1.4, .4, 1.0, lx + 3.4, 0, lz, 0x3c3e3c)   // an end table either side
    }
    const booths = (bx, bz, n) => { for (let i = 0; i < n; i++) { part('glass', 1.8, 2.4, 1.8, bx + i * 2.3, 0, bz, 0xb8f4ff); part('deco', 1.9, .1, 1.9, bx + i * 2.3, 2.4, bz, 0x3c3e3c) } }
    const s = 11.3
    if (prog === 0) { meeting(cx - 9.5, cz + s); pantry(cx + 9.5, cz + s); pantry(cx - 9.5, cz - s); meeting(cx + 9.5, cz - s) }
    else if (prog === 1) { meeting(cx - 9.5, cz + s); meeting(cx + 9.5, cz + s); meeting(cx - 9.5, cz - s); meeting(cx + 9.5, cz - s) }
    else if (prog === 2) { lounge(cx - 9.5, cz + s); pantry(cx + 9.5, cz + s); pantry(cx - 9.5, cz - s); lounge(cx + 9.5, cz - s) }
    else { booths(cx - 12.5, cz + s, 4); booths(cx + 4.5, cz + s, 4); pantry(cx - 9.5, cz - s); meeting(cx + 9.5, cz - s) }
    // Plants at the strips' free ends, never in an aisle.
    for (const [px, pz] of [[-15, -11.2], [15, -11.2], [-15, 11.2], [15, 11.2], [-4.2, -11.2], [4.2, 11.2]]) {
      part('deco', .55, .5, .55, cx + px, 0, cz + pz, 0x6b4a32); part('deco', .9, 1.1, .9, cx + px, .5, cz + pz, 0x3f7a3a)
    }
    // Columns on the cell corners: one structural grid across the whole floor, the thing that says this is one
    // building. Each cell owns its north-west corner, and the far ones where the floor ends. The four around the
    // HQ lot are the HQ's own walls' business.
    const corner = (i, j) => {
      if (i >= 0 && i <= 1 && j >= 0 && j <= 1) return
      const x = (i - .5) * W, z = (j - .5) * D
      part('deco', .8, 3.2, .8, x, 0, z, 0xb8b9b0); part('deco', .9, .14, .9, x, 2.7, z, PAL.calm2)
    }
    corner(ci, cj)
    if (ci === REACH) corner(ci + 1, cj)
    if (cj === REACH) corner(ci, cj + 1)
    if (ci === REACH && cj === REACH) corner(ci + 1, cj + 1)

    // Seats, on the plate demo's lattice: the desk's footprint is the seat, the developer sits at its south edge.
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const x = cx + (c - (COLS - 1) / 2) * 3.5 + (c >= COLS / 2 ? 0.7 : -0.7), z = cz + (r - (ROWS - 1) / 2) * 3.6
      allSeats.push({ flap: def, x, z, t0: Infinity, landed: false, key: Math.hypot(x / W, z / D) + hash(x * 3.1 + z) * .03 })
    }
  }

  /* --- the glass wall -------------------------------------------------------------------------------------------- */
  // Back walls (north, west) stand full height and the front ones (south, east) are a low parapet, so the camera
  // looks over them into the floor: the garage's own dollhouse convention. The two front walls have a door each, where
  // the avenues end, with a canopy and an amber sign.
  function wallRun(side, a0, a1) {
    const front = side === 'S' || side === 'E', sill = front ? .9 : 1.0, glassH = front ? 1.0 : 2.5
    const alongX = side === 'N' || side === 'S'
    const fixed = side === 'N' ? -B + .25 : side === 'S' ? B - .25 : side === 'W' ? -A + .25 : A - .25
    const gap = (side === 'S' || side === 'E') ? [-5, 5] : null
    const runs = gap ? [[a0, Math.min(a1, gap[0])], [Math.max(a0, gap[1]), a1]].filter(([p, q]) => q - p > .01) : [[a0, a1]]
    for (const [p, q] of runs) {
      const len = q - p, mid = (p + q) / 2
      const box = (h, t, y, color, kind) => alongX ? part(kind, len, h, t, mid, y, fixed, color) : part(kind, t, h, len, fixed, y, mid, color)
      box(sill, .5, 0, 0xb8b9b0, 'deco'); box(glassH, .08, sill, 0xb8f4ff, 'glass'); box(.12, .56, sill + glassH, 0xd9d8cd, 'deco')
      for (let k = Math.ceil(p / 3.3); k * 3.3 <= q; k++) {
        const m = k * 3.3
        alongX ? part('deco', .14, sill + glassH, .2, m, 0, fixed, 0x97988f) : part('deco', .2, sill + glassH, .14, fixed, 0, m, 0x97988f)
      }
    }
  }
  if (z0 <= -B + .01) wallRun('N', x0, x1)
  if (z1 >= B - .01) wallRun('S', x0, x1)
  if (x0 <= -A + .01) wallRun('W', z0, z1)
  if (x1 >= A - .01) wallRun('E', z0, z1)
  if (inRect(0, B)) {
    part('deco', 12.4, .25, 4, 0, 3.2, B - 2.2, 0x3c3e3c); part('deco', 12.4, .5, .22, 0, 3.45, B - .3, PAL.warn2)
    for (const s of [-1, 1]) part('deco', .3, 3.2, .3, s * 5.8, 0, B - 1.2, 0xb8b9b0)
  }
  if (inRect(A, 0)) {
    part('deco', 4, .25, 12.4, A - 2.2, 3.2, 0, 0x3c3e3c); part('deco', .22, .5, 12.4, A - .3, 3.45, 0, PAL.warn2)
    for (const s of [-1, 1]) part('deco', .3, 3.2, .3, A - 1.2, 0, s * 5.8, 0xb8b9b0)
  }
  // The floor's one hairline: the perimeter, in cyan, drawn only where this flap meets the outside.
  const edge = (ax, az, bx, bz) => lines.push(ax - hx, .07, az - hz, bx - hx, .07, bz - hz)
  if (z0 <= -B + .01) edge(x0, z0, x1, z0)
  if (z1 >= B - .01) edge(x0, z1, x1, z1)
  if (x0 <= -A + .01) edge(x0, z0, x0, z1)
  if (x1 >= A - .01) edge(x1, z0, x1, z1)

  /* --- the objects ----------------------------------------------------------------------------------------------- */
  const hinge = new THREE.Group(); hinge.position.set(hx, -SINK, hz); floorRoot.add(hinge)
  const panel = new THREE.Group(); panel.position.y = SINK; hinge.add(panel)   // flat, the two offsets cancel
  const uOff = { value: new THREE.Vector2(hx, hz) }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, .3, z1 - z0), slabMat)
  slab.position.set((x0 + x1) / 2 - hx, -.15, (z0 + z1) / 2 - hz)
  const carpet = new THREE.Mesh(mergeGeometries(parts.carpet), waved(new THREE.MeshLambertMaterial({ vertexColors:true }), uOff, true))
  const deco = new THREE.Mesh(mergeGeometries(parts.deco), waved(new THREE.MeshLambertMaterial({ vertexColors:true }), uOff))
  const glass = new THREE.Mesh(mergeGeometries(parts.glass), waved(new THREE.MeshLambertMaterial({ vertexColors:true, transparent:true, opacity:.22, depthWrite:false }), uOff))
  glass.renderOrder = 2
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  panel.add(slab, carpet, deco, glass, new THREE.LineSegments(lg, edgeMat))
  for (const m of [carpet, deco, glass]) m.frustumCulled = false

  const seats = allSeats.filter((s) => s.flap === def)
  const n = seats.length
  const desks = new THREE.InstancedMesh(deskGeo, deskMat, n), screens = new THREE.InstancedMesh(screenGeo, screenMat, n)
  const people = new THREE.InstancedMesh(workerGeo, workerMat, n), pads = new THREE.InstancedMesh(padGeo, padMat, n)
  for (const m of [desks, screens, people, pads]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); panel.add(m) }
  people.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  seats.forEach((s, i) => { s.idx = i; s.flapHx = hx; s.flapHz = hz; people.setColorAt(i, SHIRTS[(Math.random() * SHIRTS.length) | 0]) })
  Object.assign(def, { x0, x1, z0, z1, hx, hz, hinge, panel, desks, screens, people, pads, seats, t: -1e9, landed: false, dirty: true })
  hinge.visible = false
}

FLAPS.forEach(buildFlap)
const order = allSeats.slice().sort((a, b) => a.key - b.key)    // nearest the HQ first: the office fills from its heart
const TOTAL = allSeats.length

/* ------------------------------------------------------------------ one seat's pose */
let clock = 0
function writeSeat(s) {
  const f = s.flap, i = s.idx, a = clock - s.t0
  const px = s.x - s.flapHx, pz = s.z - s.flapHz
  let ds = 0, dy = 0, ps = 0, py = 0
  if (a >= 0) {
    ds = 1; dy = DROP_H * (1 - bounce(clamp01(a / DROP)))
    const pa = a - LEAD
    if (pa >= 0) { ps = 1; py = DROP_H * (1 - bounce(clamp01(pa / DROP))); if (pa >= DROP && !s.landed) { s.landed = true; tick() } }
  }
  dummy.rotation.set(0, 0, 0)
  dummy.position.set(px, dy, pz); dummy.scale.setScalar(ds); dummy.updateMatrix()
  f.desks.setMatrixAt(i, dummy.matrix); f.screens.setMatrixAt(i, dummy.matrix)
  dummy.position.set(px, .62 + py, pz + .82); dummy.scale.setScalar(ps); dummy.updateMatrix(); f.people.setMatrixAt(i, dummy.matrix)
  dummy.position.set(px, .045, pz); dummy.scale.setScalar(a >= 0 ? 0 : 1); dummy.updateMatrix(); f.pads.setMatrixAt(i, dummy.matrix)
  f.dirty = true
}
allSeats.forEach(writeSeat)

/* ------------------------------------------------------------------ a flap's pose */
function writeFlap(f) {
  const t = f.t
  // phi is signed: negative is below the floor line. The flap starts hanging straight down from the HQ's edge, sweeps
  // up to flat, and rebounds a few degrees above flat once. It also unrolls as it comes: the sheet is drawn out of the
  // HQ's edge during the first part of the swing (k), so it is never seen lying folded under the floor in the void.
  let phi
  if (t < UNFOLD) phi = -(Math.PI / 2) * (1 - easeInOut(clamp01(t / UNFOLD)))
  else { const tau = t - UNFOLD; phi = BOUNCE * Math.exp(-7 * tau) * Math.abs(Math.sin(15 * tau)) }
  const k = Math.max(.001, easeOut(clamp01(t / (UNFOLD * .45))))
  f.hinge.rotation.set(f.nz * phi, 0, -f.nx * phi)
  f.panel.scale.set(f.nx ? k : 1, 1, f.nz ? k : 1)
  f.hinge.visible = t >= 0
}

/* ------------------------------------------------------------------ juice: dust, shock ring, shake */
const fx = []
const ringGeo = new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2)   // a hairline, not a halo
let shake = 0
function landingFx(f) {
  const seam = new THREE.Vector3(HQ_AT.x + f.hx, LEVEL, HQ_AT.z + f.hz)
  const along = f.nx ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
  const len = f.nx ? (f.z1 - f.z0) : (f.x1 - f.x0)
  const N = 90, pos = new Float32Array(N * 3), vel = []
  for (let i = 0; i < N; i++) {
    const a = rnd(-0.5, 0.5) * len
    pos[i*3] = seam.x + along.x * a; pos[i*3+1] = LEVEL + 0.2; pos[i*3+2] = seam.z + along.z * a
    vel.push(new THREE.Vector3((-f.nx * rnd(2, 10)) + rnd(-1, 1), rnd(1.5, 5), (-f.nz * rnd(2, 10)) + rnd(-1, 1)))
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const m = new THREE.PointsMaterial({ color:PAL.n7, size:2.2, sizeAttenuation:false, transparent:true, opacity:.8, depthWrite:false })
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts)
  fx.push({ age:0, life:1.1, tick(e, dt) {
    const a = g.attributes.position.array
    for (let i = 0; i < N; i++) { vel[i].y -= 9 * dt; a[i*3] += vel[i].x * dt; a[i*3+1] = Math.max(LEVEL + 0.1, a[i*3+1] + vel[i].y * dt); a[i*3+2] += vel[i].z * dt }
    g.attributes.position.needsUpdate = true
    const k = e.age / e.life
    m.opacity = .8 * (1 - k); m.size = 2.2 + k * 6
  }, dispose() { scene.remove(pts); g.dispose(); m.dispose() } })
  shake = Math.min(1.4, shake + 0.5)
  thump(0.55)
}
function waveFx() {
  // One ring from the HQ at the moment the wave leaves it, the hard cyan stripe's twin in the air: a single shock
  // for a single office, where the plate demo rang once per floor.
  const m = new THREE.MeshBasicMaterial({ color:PAL.calm3, transparent:true, opacity:.9, depthWrite:false })
  const ring = new THREE.Mesh(ringGeo, m); ring.position.set(HQ_AT.x, LEVEL + .1, HQ_AT.z); scene.add(ring)
  fx.push({ age:0, life:2.6, tick(e) { const t = e.age / e.life, s = 18 + t * (A * 1.05); ring.scale.set(s, s, s * (B / A)); m.opacity = .9 * (1 - t) * (1 - t) }, dispose() { scene.remove(ring); m.dispose() } })
  shake = Math.min(1.4, shake + .4)
  note(); note()
}

/* ------------------------------------------------------------------ sound: synthesised, off until M */
// Unpitched or plucked beats that stack into texture, never a pitched glide (a glide overlapping itself is a siren).
let actx = null, soundOn = false, bus = null, noiseBuf = null, lastNote = 0, lastTick = 0
function ensureAudio() {
  if (actx) return
  actx = new (window.AudioContext || window.webkitAudioContext)()
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200
  const comp = actx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5
  lp.connect(comp).connect(actx.destination); bus = lp
  noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate)
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
}
function noise(t, dur, type, f0, f1, peak, q = 1) {
  const src = actx.createBufferSource(); src.buffer = noiseBuf
  const f = actx.createBiquadFilter(); f.type = type; f.Q.value = q
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = actx.createGain(); g.gain.setValueAtTime(.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + dur * .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur)
  src.connect(f).connect(g).connect(bus); src.start(t, Math.random() * .5); src.stop(t + dur + .02)
}
function thump(v = 1) {
  if (!soundOn) return
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain()
  o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(62, t + .12)
  g.gain.setValueAtTime(.5 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .22)
  o.connect(g).connect(bus); o.start(t); o.stop(t + .24)
  noise(t, .06, 'bandpass', 2400, 1200, .22 * v, 0.8)
}
function whoosh() { if (soundOn) noise(actx.currentTime, UNFOLD, 'bandpass', 380, 1500, .16, 0.6) }
function tick() {   // a hire landing: a dry wooden tick, rate-limited so a stampede is a rattle, not a wall
  if (!soundOn) return
  const t = actx.currentTime; if (t - lastTick < .03) return; lastTick = t
  noise(t, .035, 'bandpass', 1800 + Math.random() * 900, 1100, .1, 1.4)
}
const PENTA = [0, 2, 4, 7, 9]
let noteIx = 0
function note() {
  if (!soundOn) return
  const t = actx.currentTime; if (t - lastNote < .07) return; lastNote = t
  const i = noteIx++, semis = PENTA[i % 5] + 12 * (Math.floor(i / 5) % 3)
  const f = 261.63 * Math.pow(2, semis / 12)
  for (const [m, a, d] of [[1, .22, .5], [4, .06, .12]]) {
    const o = actx.createOscillator(), g = actx.createGain()
    o.type = 'sine'; o.frequency.value = f * m
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d)
    o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02)
  }
}

/* ------------------------------------------------------------------ camera: frame the place, drag to pan, wheel to zoom */
const cam = { cx:HQ_AT.x, cz:HQ_AT.z, zoom:20, zv:0, tcx:HQ_AT.x, tcz:HQ_AT.z, tzoom:20 }
let view = 'floor', userMul = 1
const pan = { x:0, z:0 }
let fitZoom = 20, fitCentre = new THREE.Vector3(HQ_AT.x, 0, HQ_AT.z)
/** The ortho half-height that frames a ground box up to y1, from the fixed lens. */
function fitBox(x0, x1, z0, z1, y1) {
  const centre = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2)
  camera.position.copy(centre).addScaledVector(VIEW, 600); camera.lookAt(centre); camera.updateMatrixWorld()
  let hw = 0, hh = 0
  for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, y1]) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse); hw = Math.max(hw, Math.abs(v.x)); hh = Math.max(hh, Math.abs(v.y))
  }
  return { zoom:Math.max(hh, hw / (innerWidth / innerHeight)) * 1.08 + 3, centre }
}
function refit() {
  const hqBox = [HQ_AT.x - W / 2, HQ_AT.x + W / 2, HQ_AT.z - D / 2, HQ_AT.z + D / 2]
  let box
  if (!opened || view === 'hq') box = hqBox.map((v, i) => v + (i % 2 ? 4 : -4))
  else if (view === 'floor') box = [HQ_AT.x - A, HQ_AT.x + A, HQ_AT.z - B, HQ_AT.z + B]
  else {
    // "My people": the seats that have somebody in them plus one cell of headroom, never tighter than the HQ. The honest
    // picture of a floor that holds more than the studio does (GDD 7.8.1c): the far flaps hang off the frame's edge.
    let [x0, x1, z0, z1] = hqBox
    for (const s of allSeats) if (s.t0 < Infinity) { x0 = Math.min(x0, HQ_AT.x + s.x); x1 = Math.max(x1, HQ_AT.x + s.x); z0 = Math.min(z0, HQ_AT.z + s.z); z1 = Math.max(z1, HQ_AT.z + s.z) }
    box = [Math.max(x0 - W / 2, HQ_AT.x - A), Math.min(x1 + W / 2, HQ_AT.x + A), Math.max(z0 - D / 2, HQ_AT.z - B), Math.min(z1 + D / 2, HQ_AT.z + B)]
  }
  const r = fitBox(box[0], box[1], box[2], box[3], 5)
  fitZoom = r.zoom; fitCentre = r.centre
}
function applyCamera(dt) {
  cam.tzoom = fitZoom * userMul
  cam.tcx = fitCentre.x + pan.x; cam.tcz = fitCentre.z + pan.z
  // Underdamped spring on zoom: the open makes the camera lurch out and settle, which is the "oh no, it's bigger" beat.
  const k = 70, c = 11
  cam.zv += ((cam.tzoom - cam.zoom) * k - cam.zv * c) * dt
  cam.zoom = Math.max(4, cam.zoom + cam.zv * dt)
  const e = Math.min(1, dt * 4)
  cam.cx += (cam.tcx - cam.cx) * e; cam.cz += (cam.tcz - cam.cz) * e
  const a = innerWidth / innerHeight
  camera.left = -cam.zoom * a; camera.right = cam.zoom * a; camera.top = cam.zoom; camera.bottom = -cam.zoom
  camera.updateProjectionMatrix()
  shake *= Math.exp(-6 * dt)
  const centre = new THREE.Vector3(cam.cx, 0, cam.cz)
  camera.position.copy(centre).addScaledVector(VIEW, 900)
  camera.lookAt(centre)
  const s = shake * cam.zoom * 0.012
  camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s)
}
const cv = renderer.domElement
cv.addEventListener('wheel', (e) => { e.preventDefault(); userMul = Math.max(.1, Math.min(1.6, userMul * Math.exp(e.deltaY * .0012))) }, { passive:false })
let drag = null
cv.addEventListener('pointerdown', (e) => { drag = { x:e.clientX, y:e.clientY }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag') })
cv.addEventListener('pointermove', (e) => {
  if (!drag) return
  const upp = 2 * cam.zoom / innerHeight, dx = e.clientX - drag.x, dy = e.clientY - drag.y
  drag.x = e.clientX; drag.y = e.clientY
  // Content follows the pointer. Screen-right on the ground is (1,0,-1)/sqrt2; screen-up is away from the camera,
  // (-1,0,-1)/sqrt2, and a pixel of it covers 1/sin(elevation) metres of ground, so the lens's tilt is divided back out.
  const down = dy * upp / VIEW.y
  pan.x -= (dx * upp + down) / Math.SQRT2
  pan.z -= (-dx * upp + down) / Math.SQRT2
  pan.x = Math.max(-A, Math.min(A, pan.x)); pan.z = Math.max(-B, Math.min(B, pan.z))
})
const endDrag = () => { drag = null; cv.classList.remove('drag') }
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag)
function setView(v) { view = v; userMul = 1; pan.x = pan.z = 0; refit(); syncButtons() }

/* ------------------------------------------------------------------ driving it */
const $ = (id) => document.getElementById(id)
let opened = false, openAt = 0, waveFired = false, wavePast = false
let hired = 0, queued = 0
let auto = true, autoClock = 0, readyAt = 0
let devsShown = HQ_HEADS
const young = []
const MILESTONES = { 100:['100 DEVELOPERS', 'the carpet has not met them all yet'], 250:['250', 'nobody has needed a street'], 500:['500 PEOPLE', 'WHO IS PAYING FOR THIS'], 900:['900', 'still one room'] }
let milestoneDone = new Set()
function toast(a, b) { const t = $('toast'); t.innerHTML = a + '<small>' + b + '</small>'; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go') }
const fmt = (n) => n.toLocaleString('en-US')

function open() {
  if (opened) return
  opened = true; openAt = clock; waveFired = false; wavePast = false
  FLAPS.forEach((f, i) => { f.t = -i * STAGGER; f.landed = false; f.hinge.visible = false })
  whoosh()
  toast('THE WHOLE PLACE', 'one floor, one wave, no streets')
  $('stage').textContent = 'ONE FLOOR'
  $('area').textContent = fmt(Math.round(2 * A * 2 * B))
  refit()
}
/** Seat `n` more developers, nearest the HQ first. Before the floor is ready they wait in the lobby. */
function hire(n) {
  if (!opened) { open(); return }
  queued += n
}
function flushQueue() {
  if (clock < readyAt) return
  const n = Math.min(queued, TOTAL - hired)
  if (n <= 0) { queued = 0; return }
  // A batch lands a beat apart, as the garage's does; a very large one lands in at most half a second.
  const gap = Math.min(.06, .6 / n)
  for (let i = 0; i < n; i++) {
    const s = order[hired++]
    s.t0 = clock + i * gap; s.landed = false; young.push(s)
  }
  queued = 0
  refit()
}
function reset() {
  opened = false; waveFired = false; wavePast = false; hired = 0; queued = 0; autoClock = 0; readyAt = 0
  WAVE.value = -10; milestoneDone = new Set(); young.length = 0
  FLAPS.forEach((f) => { f.t = -1e9; f.hinge.visible = false })
  for (const s of allSeats) { s.t0 = Infinity; s.landed = false; writeSeat(s) }
  fx.forEach((e) => e.dispose()); fx.length = 0
  $('stage').textContent = 'THE GARAGE'; $('area').textContent = '-'; $('of').textContent = 'DEVELOPERS'
  userMul = 1; pan.x = pan.z = 0; refit()
}

function update(dt) {
  clock += dt; U.value = clock
  // The opening and the wave.
  if (opened) {
    for (const f of FLAPS) {
      if (f.t < UNFOLD + 2.5) { f.t += dt; writeFlap(f) }
      if (!f.landed && f.t >= UNFOLD) { f.landed = true; landingFx(f) }
    }
    const since = clock - openAt - WAVE_AT
    if (since >= 0 && !waveFired) { waveFired = true; waveFx() }
    if (!wavePast) { WAVE.value = since < 0 ? -10 : since * WAVE_SPEED - 2; if (WAVE.value > A + 14) { WAVE.value = 400; wavePast = true; readyAt = clock + .2 } }
  }
  if (wavePast) flushQueue()

  // Seats that are still arriving.
  for (let i = young.length - 1; i >= 0; i--) {
    const s = young[i]; writeSeat(s)
    if (clock - s.t0 > 1.4) young.splice(i, 1)
  }
  for (const f of FLAPS) if (f.dirty) { f.desks.instanceMatrix.needsUpdate = f.screens.instanceMatrix.needsUpdate = f.people.instanceMatrix.needsUpdate = f.pads.instanceMatrix.needsUpdate = true; f.dirty = false }

  // The autopilot: open after a moment, then hire at a rate that grows until the floor is full.
  if (auto) {
    autoClock += dt
    if (!opened && autoClock > 1.4) open()
    if (wavePast && hired + queued < TOTAL) {
      const e = clock - readyAt
      const rate = 5 * Math.exp(Math.max(0, e) / 4.5)     // full in about 18 s: a trickle you can follow, then a stampede
      autoAcc += rate * dt
      const n = Math.floor(autoAcc); autoAcc -= n
      if (n) hire(n)
    }
  }

  // The HUD.
  const target = HQ_HEADS + hired
  devsShown += (target - devsShown) * Math.min(1, dt * 6)
  const shown = Math.round(devsShown)
  const el = $('devs')
  if (el.textContent !== fmt(shown)) { el.textContent = fmt(shown); el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 90) }
  $('of').textContent = opened ? 'OF ' + fmt(HQ_HEADS + TOTAL) + ' SEATS' : 'DEVELOPERS'
  for (const m of Object.keys(MILESTONES)) if (target >= +m && !milestoneDone.has(m)) { milestoneDone.add(m); toast(...MILESTONES[m]); note() }
  if (hired >= TOTAL && !milestoneDone.has('full')) { milestoneDone.add('full'); toast(fmt(HQ_HEADS + TOTAL) + ' DEVELOPERS', 'one floor. one office. zero streets.'); note(); note() }

  fx.forEach((e) => { e.age += dt; e.tick(e, dt) })
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].age > fx[i].life) { fx[i].dispose(); fx.splice(i, 1) }
  applyCamera(dt)
}
let autoAcc = 0

/* ------------------------------------------------------------------ controls */
function syncButtons() {
  $('bAuto').classList.toggle('on', auto); $('bSound').classList.toggle('on', soundOn)
  ;['floor', 'people', 'hq'].forEach((v, i) => $('v' + i).classList.toggle('on', view === v))
}
function userAction(fn) { auto = false; syncButtons(); fn() }
$('bHire').onclick = () => userAction(() => hire(1))
$('bBurst').onclick = () => userAction(() => hire(100))
$('bFill').onclick = () => userAction(() => hire(TOTAL))
$('bAuto').onclick = () => { auto = !auto; syncButtons() }
$('bSound').onclick = () => { soundOn = !soundOn; if (soundOn) ensureAudio(); syncButtons() }
$('bReset').onclick = () => { reset(); auto = true; syncButtons() }
;['v0', 'v1', 'v2'].forEach((id, i) => { $(id).onclick = () => setView(['floor', 'people', 'hq'][i]) })
addEventListener('keydown', (e) => {
  if (e.repeat && e.key !== ' ') return
  const k = e.key.toLowerCase()
  if (k === ' ') { e.preventDefault(); $('bHire').onclick() }
  else if (k === 'b') $('bBurst').onclick()
  else if (k === 'f') $('bFill').onclick()
  else if (k === 'a') $('bAuto').onclick()
  else if (k === 'm') $('bSound').onclick()
  else if (k === 'r') $('bReset').onclick()
  else if (k === '1') setView('floor')
  else if (k === '2') setView('people')
  else if (k === '3') setView('hq')
})
function resize() { renderer.setSize(innerWidth, innerHeight); refit() }
addEventListener('resize', resize)
resize(); syncButtons()
cam.zoom = fitZoom; cam.cx = fitCentre.x; cam.cz = fitCentre.z

// Seams for a headless run (loopback only, like every demo): ?t=<seconds> steps the clock, so a screenshot can be
// taken at a known moment of the open without waiting on a real frame rate.
const params = new URLSearchParams(location.search)
const qs = (k) => params.has(k) ? +params.get(k) : null
if (params.has('manual')) {
  window.__step = (s, h = 1 / 60) => { for (let t = 0; t < s; t += h) update(h); renderer.render(scene, camera) }
  window.__demo = { hire, open, reset, setView, get state() { return { opened, hired, wave:WAVE.value, clock } } }
  auto = false; syncButtons()
  renderer.render(scene, camera)
} else {
  let last = performance.now()
  renderer.setAnimationLoop((now) => { const dt = Math.min(.05, (now - last) / 1000); last = now; update(dt); renderer.render(scene, camera) })
}
