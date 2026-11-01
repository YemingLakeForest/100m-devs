import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
// The shipped HQ, not a copy: the same builder the game's garage view calls. Vite serves it from src/.
import { buildGarageEnvironment, GARAGE_ASSEMBLED, showGarageSeats, showGarageStations } from '/src/three/render/garageEnvironment.ts'
import { defaultCast } from '/src/three/render/studioPeople.ts'

/* ------------------------------------------------------------------ constants */
// One floor plate is the HQ's own lot: the apron slab garageEnvironment lays under the studio (33 x 25 m, centred
// on 1.5, 1.1). Every plate after it is the same size, so the HQ is plate 0 of a grid and not a guest in somebody
// else's. Its two back walls (north, west) are 4.6 m and face the camera's blind side, so the grid only ever grows
// the other way: +X and +Z, toward the viewer, off the lot's open edges.
const W = 33, D = 25
const HQ_AT = { x: 1.5, z: 1.1 }
const COLS = 8, ROWS = 6             // desks per plate (48)
const DEVS_PER = COLS * ROWS
const N = 18                         // the claimable patch is N x N plates: one face of the planet's cube-sphere
const MAX_PLATES = N * N             // 324. Draw calls are 4 a plate, and only while the floor view is up
const R = 380                        // planet radius, metres: a face of N plates of W spans ~ R * pi/2
const UNFOLD = 1.45                  // seconds from folded to flat
const LEVEL = -0.4                   // the HQ lot's top (garageEnvironment's apron), so the first seam has no step
const SINK = 0.35                    // how far the hinge line sits below LEVEL: see makePlate
const SETTLE = 3.6                  // seconds until a plate stops being animated at all

const PAL = {
  n0:0x181919, n1:0x292a29, n2:0x3c3e3c, n3:0x575a56, n6:0xb8b9b0, n7:0xd9d8cd, n8:0xf1efe6,
  calm1:0x1a6b78, calm2:0x35c9d9, calm3:0xb8f4ff, warn2:0xe0a52e, warn3:0xffe9b0, alarm2:0xe03c3c,
}

/* ------------------------------------------------------------------ renderer, camera, light */
const renderer = new THREE.WebGLRenderer({ antialias:true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setClearColor(PAL.n0)
document.body.prepend(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000)
const VIEW = new THREE.Vector3(1, 0.88, 1).normalize()   // from +X/+Z, as the game's lens
// The game's own rig in the OS look (garageView.ts), so the HQ is lit as it is in play; shadows are left out
// because the lit area grows without bound and a shadow map cannot.
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
const hemi = new THREE.HemisphereLight('#e6ecea', '#8d9795', 1.25)
scene.add(hemi)
const sun = new THREE.DirectionalLight('#f1f1ed', 1.25)
sun.position.set(-18, 30, -8)
scene.add(sun)
const fill = new THREE.DirectionalLight('#e7ebe8', 0.30)
fill.position.set(-32, 15, -10)
scene.add(fill)

/* ------------------------------------------------------------------ shared geometry + materials */
const U = { value: 0 }   // shared clock for the GPU-side idle motion

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

const deskGeo = new THREE.BoxGeometry(1.7, 0.78, 0.85).translate(0, 0.39, 0)
const screenGeo = new THREE.BoxGeometry(0.72, 0.46, 0.05).translate(0, 1.05, -0.28)
const workerGeo = new THREE.CapsuleGeometry(0.24, 0.5, 3, 8).translate(0, 0.0, 0)
const plateGeo = new THREE.BoxGeometry(W, 0.3, D)
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.3, D))
const deskMat = new THREE.MeshLambertMaterial({ color:PAL.n6 })
const screenMat = alive(new THREE.MeshBasicMaterial({ color:PAL.calm2 }), { shimmer:0.45 })
const workerMat = alive(new THREE.MeshLambertMaterial({ color:0xffffff }), { bob:0.06 })
const edgeMat = new THREE.LineBasicMaterial({ color:PAL.calm1 })
const SHIRTS = [PAL.calm2, PAL.warn2, PAL.alarm2, PAL.n7, PAL.calm3, 0x6a8f4e, 0xb06ad0].map((c) => new THREE.Color(c))

/* ------------------------------------------------------------------ what makes a plate an office */
// A bare slab of desks reads as a seating chart. The HQ below reads as an office because of what is around the
// desks: carpet with a darker aisle, low pod dividers, glass meeting rooms, a pantry, plants. Every plate carries
// the same set, built once and merged into two shared geometries (solid, vertex-coloured; glass), so 324 floors
// cost two draw calls of furniture each. The layout works to the desk grid below: desks fill x +-13, z +-9.4, so the
// two 3 m strips along z = +-11 hold the rooms and the pantry, and the 3.2 m aisle at x = 0 stays clear.
const decorParts = [], glassParts = []
function part(list, w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv')
  list.push(g.index ? g.toNonIndexed() : g)
}
part(decorParts, 31, .03, 23, 0, 0, 0, 0x505653)                 // carpet
part(decorParts, 3.0, .035, 23, 0, 0, 0, 0x343a3b)               // aisle runner
part(decorParts, .12, .036, 23, -1.6, 0, 0, 0x35c9d9)            // cyan inlay either side of the runner
part(decorParts, .12, .036, 23, 1.6, 0, 0, 0x35c9d9)
for (const sx of [-1, 1]) for (const [z0, z1] of [[-9.6, -.9], [.9, 9.6]])   // pod dividers, with a gap to cross at z = 0
  part(decorParts, .14, 1.15, z1 - z0, sx * 7.7, 0, (z0 + z1) / 2, 0x7d8f92)
for (const [mx, mz] of [[-9.5, 11], [9.5, -11]]) {               // meeting rooms: table, chairs, glass box
  part(decorParts, 4.2, .08, 1.5, mx, .72, mz, 0xb69a6a); part(decorParts, .2, .72, .2, mx, 0, mz, 0x3c3e3c)
  for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) part(decorParts, .5, .5, .5, mx - 1.5 + i, 0, mz + sz * 1.1, 0x1a6b78)
  part(glassParts, 7, 2.5, .06, mx, 0, mz - 1.4, 0xb8f4ff); part(glassParts, 7, 2.5, .06, mx, 0, mz + 1.4, 0xb8f4ff)
  part(glassParts, .06, 2.5, 2.8, mx - 3.5, 0, mz, 0xb8f4ff); part(glassParts, .06, 2.5, 2.8, mx + 3.5, 0, mz, 0xb8f4ff)
}
part(decorParts, 6, .9, 1, 9.5, 0, 11.3, 0x97988f); part(decorParts, 6.1, .06, 1.1, 9.5, .9, 11.3, 0xd9d8cd)   // pantry counter
part(decorParts, 6, .9, 1, -9.5, 0, -11.3, 0x97988f); part(decorParts, 6.1, .06, 1.1, -9.5, .9, -11.3, 0xd9d8cd)
for (const [px, pz] of [[-15, -11.2], [15, -11.2], [-15, 11.2], [15, 11.2], [-1.6, -11.2], [1.6, 11.2], [-1.6, 5], [1.6, -5]]) {
  part(decorParts, .55, .5, .55, px, 0, pz, 0x6b4a32); part(decorParts, .9, 1.1, .9, px, .5, pz, 0x3f7a3a)   // pot, foliage
}
const decorGeo = mergeGeometries(decorParts), glassGeo = mergeGeometries(glassParts)
const glassMat = new THREE.MeshLambertMaterial({ color:0xb8f4ff, transparent:true, opacity:.22, depthWrite:false })

/* ------------------------------------------------------------------ the spiral */
// A quarter-plane, ring by ring: (r,0) up to (r,r), then back along the far edge to (0,r). The HQ is the corner
// (0,0); every cell has an older neighbour on its -x or -z side, so there is always a seam to hinge from, and the
// footprint grows as a square toward the camera instead of round the HQ.
const CELLS = (() => {
  const out = [[0, 0]]
  for (let r = 1; out.length < MAX_PLATES + 8; r++) {
    for (let j = 0; j <= r; j++) out.push([r, j])
    for (let i = r - 1; i >= 0; i--) out.push([i, r])
  }
  return out
})()
const cellIndex = new Map()
CELLS.forEach(([x, y], i) => cellIndex.set(x + ',' + y, i))

/* ------------------------------------------------------------------ the HQ: plate 0, the real one */
// buildGarageEnvironment is what the game's garage view builds, called the way garageView.build() calls it
// (cityGrid=true, the OS look). Nothing in it is moved, resized or re-skinned. The only thing taken away is the 512 m
// horizon plane: the grid is the ground now, and a floor-coloured sea under it would show between the plates.
const HQ_HEADS = 20
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

/* ------------------------------------------------------------------ plates */
const plates = [{ n:0, cx:HQ_AT.x, cz:HQ_AT.z, settled:true, hq:true }]
const root = new THREE.Group(); scene.add(root)
const dummy = new THREE.Object3D()
const rnd = (a, b) => a + Math.random() * (b - a)
const easeInOut = (t) => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2
const easeOutBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3*Math.pow(t-1, 3) + c1*Math.pow(t-1, 2) }
const clamp01 = (t) => Math.max(0, Math.min(1, t))

function makePlate(n, delay = 0, instant = false) {
  const [ci, cj] = CELLS[n]
  const cx = HQ_AT.x + ci * W, cz = HQ_AT.z + cj * D
  // The hinge is the shared edge with the oldest neighbour already standing.
  let best = -1, nx = 0, nz = 0
  for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const k = cellIndex.get((ci + dx) + ',' + (cj + dz))
    if (k !== undefined && k < n && (best < 0 || k < best)) { best = k; nx = dx; nz = dz }
  }
  const hinge = new THREE.Group()
  hinge.position.set(cx + nx * W / 2, LEVEL - SINK, cz + nz * D / 2)
  // The hinge line is SINK below the floor and the panel stands SINK above it, so flat the two cancel. Folded
  // (a half turn) the panel is mirrored about the hinge, i.e. it lies UNDER the neighbour, out of sight beneath its
  // floor: the new storey swings up from under the old one and never passes over the HQ.
  const panel = new THREE.Group(); panel.position.y = SINK
  hinge.add(panel)
  const pc = new THREE.Vector3(-nx * W / 2, 0, -nz * D / 2)   // panel centre, in hinge space

  const shade = (ci + cj) & 1 ? 0x2f302f : 0x3a3c3a
  const plateMat = new THREE.MeshLambertMaterial({ color:shade, emissive:PAL.calm2, emissiveIntensity:0 })
  const slab = new THREE.Mesh(plateGeo, plateMat); slab.position.set(pc.x, -0.15, pc.z)
  const baseY = 0   // desks stand on the panel's own floor
  const edge = new THREE.LineSegments(edgeGeo, edgeMat); edge.position.copy(slab.position)
  const desks = new THREE.InstancedMesh(deskGeo, deskMat, DEVS_PER)
  const screens = new THREE.InstancedMesh(screenGeo, screenMat, DEVS_PER)
  const people = new THREE.InstancedMesh(workerGeo, workerMat, DEVS_PER)
  for (const m of [desks, screens, people]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) }
  const decorMat = new THREE.MeshLambertMaterial({ vertexColors:true, emissive:PAL.calm2, emissiveIntensity:0 })
  const decor = new THREE.Mesh(decorGeo, decorMat); decor.position.copy(slab.position); decor.position.y = 0
  const glass = new THREE.Mesh(glassGeo, glassMat); glass.position.copy(decor.position); glass.renderOrder = 2
  panel.add(slab, edge, decor, glass, desks, screens, people)

  // Desk grid with a centre aisle; each desk knows how far it is from the hinge so the pop runs away from the seam.
  const seats = []
  const edgeLen = nx ? D : W
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const lx = (c - (COLS - 1) / 2) * 3.5 + (c >= COLS / 2 ? 0.7 : -0.7)
    const lz = (r - (ROWS - 1) / 2) * 3.6
    const p = new THREE.Vector3(pc.x + lx, 0, pc.z + lz)
    const seat = new THREE.Vector3(p.x, 0.62, p.z + 0.82)
    const dist = Math.hypot(p.x, p.z)                   // hinge is the local origin
    // People enter over the seam, at a random point along it.
    const entry = new THREE.Vector3(nx ? 0 : rnd(-edgeLen / 2, edgeLen / 2), 0.62, nz ? 0 : rnd(-edgeLen / 2, edgeLen / 2))
    seats.push({ p, seat, entry, dist, spin:rnd(0, 6.28) })
  }
  people.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DEVS_PER * 3), 3)
  seats.forEach((s, i) => people.setColorAt(i, SHIRTS[(Math.random() * SHIRTS.length) | 0]))

  const plate = {
    n, hinge, panel, nx, nz, cx, cz, pc, plateMat, decorMat, desks, screens, people, seats,
    t: -delay, landed: false, settled: false,
  }
  if (instant) { plate.t = SETTLE + 1; plate.landed = true; plate.settled = true }   // claimed out of sight of the floor view
  root.add(hinge)
  plates.push(plate)
  writePlate(plate)
  if (instant) plate.plateMat.emissiveIntensity = plate.decorMat.emissiveIntensity = 0
  return plate
}

/** One plate's whole pose at its own age. Called every frame only while the plate is young. */
function writePlate(pl) {
  const t = pl.t
  // --- the hinge swing ---
  // phi is signed: negative is below the floor line. It starts folded under the neighbour, sweeps up through
  // "hanging straight down" and arrives flat, then overshoots a little ABOVE flat and settles (the slam).
  let phi
  if (t < 0) phi = -(Math.PI - 0.06)
  else if (t < UNFOLD) phi = -(Math.PI - 0.06) * (1 - easeInOut(t / UNFOLD))
  else { const tau = t - UNFOLD; phi = 0.2 * Math.exp(-7 * tau) * Math.abs(Math.sin(15 * tau)) }
  pl.hinge.rotation.set(pl.nz * phi, 0, -pl.nx * phi)
  pl.hinge.visible = t >= 0

  // --- the landing flash (set once, decays) ---
  pl.plateMat.emissiveIntensity = pl.decorMat.emissiveIntensity = pl.landed ? Math.max(0, 1 - (t - UNFOLD) / 1.1) * 0.3 : 0

  // --- desks spring up in a wave from the seam; people walk in over the seam ---
  const popStart = UNFOLD * 0.78
  for (let i = 0; i < pl.seats.length; i++) {
    const s = pl.seats[i]
    const dt = t - popStart - s.dist * 0.032
    const k = dt <= 0 ? 0 : easeOutBack(clamp01(dt / 0.5))
    dummy.position.set(s.p.x, 0, s.p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(k, k, k); dummy.updateMatrix()
    pl.desks.setMatrixAt(i, dummy.matrix); pl.screens.setMatrixAt(i, dummy.matrix)

    const wt = t - UNFOLD - 0.15 - s.dist * 0.045 - (s.spin % 1) * 0.35
    const u = clamp01(wt / 1.0)
    const e = u * u * (3 - 2 * u)
    const hop = u > 0 && u < 1 ? Math.abs(Math.sin(u * Math.PI * 5)) * 0.35 : 0
    dummy.position.set(s.entry.x + (s.seat.x - s.entry.x) * e, s.entry.y + (s.seat.y - s.entry.y) * e + hop, s.entry.z + (s.seat.z - s.entry.z) * e)
    dummy.rotation.set(0, 0, 0)
    const w = u > 0 ? (u < 0.12 ? easeOutBack(u / 0.12) : 1) : 0      // pops into existence at the seam
    dummy.scale.set(w, w, w); dummy.updateMatrix()
    pl.people.setMatrixAt(i, dummy.matrix)
  }
  pl.desks.instanceMatrix.needsUpdate = true
  pl.screens.instanceMatrix.needsUpdate = true
  pl.people.instanceMatrix.needsUpdate = true
}

/* ------------------------------------------------------------------ juice: dust, shock ring, shake, pop text */
const fx = []
const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2)
function landingFx(pl) {
  const wpos = new THREE.Vector3(pl.hinge.position.x, LEVEL, pl.hinge.position.z)
  const along = pl.nx ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
  const len = pl.nx ? D : W
  // Dust: a row of puffs along the seam, thrown outward in the direction the plate unfolded.
  const N = 56, pos = new Float32Array(N * 3), vel = []
  for (let i = 0; i < N; i++) {
    const a = rnd(-0.5, 0.5) * len
    pos[i*3] = wpos.x + along.x * a; pos[i*3+1] = LEVEL + 0.2; pos[i*3+2] = wpos.z + along.z * a
    vel.push(new THREE.Vector3((-pl.nx * rnd(2, 8)) + rnd(-1, 1), rnd(1.5, 5), (-pl.nz * rnd(2, 8)) + rnd(-1, 1)))
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const m = new THREE.PointsMaterial({ color:PAL.n7, size:2.2, sizeAttenuation:false, transparent:true, opacity:.8, depthWrite:false })
  const pts = new THREE.Points(g, m); scene.add(pts)
  // Shock ring from the middle of the new plate, cyan, the one cool colour in a warm-grey room.
  const ringMat = new THREE.MeshBasicMaterial({ color:PAL.calm3, transparent:true, opacity:.9, depthWrite:false })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.set(pl.cx, LEVEL + 0.08, pl.cz); scene.add(ring)
  fx.push({ age:0, life:1.1, pts, vel, ring, tick(f, dt) {
    const a = f.pos.array
    for (let i = 0; i < N; i++) { f.vel[i].y -= 9 * dt; a[i*3] += f.vel[i].x * dt; a[i*3+1] = Math.max(LEVEL + 0.1, a[i*3+1] + f.vel[i].y * dt); a[i*3+2] += f.vel[i].z * dt }
    f.pos.needsUpdate = true
    const k = f.age / f.life
    m.opacity = .8 * (1 - k); m.size = 2.2 + k * 6
    const s = 2 + k * 30; ring.scale.set(s, s, s); ringMat.opacity = .9 * (1 - k) * (1 - k)
  }, pos:g.attributes.position, dispose(){ scene.remove(pts); scene.remove(ring); g.dispose(); m.dispose(); ringMat.dispose() } })
  shake = Math.min(1.4, shake + 0.55)
  thump(0.5); note()
  popText(pl)
}

let shake = 0
const popEls = []
function popText(pl) {
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = '+' + DEVS_PER
  document.body.appendChild(el)
  popEls.push({ el, age:0, at:new THREE.Vector3(pl.cx, 3, pl.cz) })
}
function updatePops(dt) {
  for (let i = popEls.length - 1; i >= 0; i--) {
    const p = popEls[i]; p.age += dt
    const v = p.at.clone().add(new THREE.Vector3(0, p.age * 4, 0)).project(camera)
    p.el.style.left = ((v.x * .5 + .5) * innerWidth - 20) + 'px'
    p.el.style.top = ((-v.y * .5 + .5) * innerHeight) + 'px'
    p.el.style.opacity = String(Math.max(0, 1 - p.age / 1.4))
    if (p.age > 1.4) { p.el.remove(); popEls.splice(i, 1) }
  }
}

/* ------------------------------------------------------------------ sound: synthesised, off until M */
// The first cut was a square-wave sweep per unfold plus a sine drop per landing. At speed the sweeps stacked into
// a siren ("duiiii"), because a pitched glide is the one sound that does not get better when it overlaps itself.
// Now each beat is a short, unpitched or plucked sound that DOES stack into texture: paper-soft air for the swing,
// a wooden knock for the slam, and a marimba note per floor that climbs a pentatonic scale, so a stampede reads
// as a run of notes rather than a wail. Everything goes through one lowpass and a compressor, and the notes are
// rate-limited so 12 landings in a burst are a roll, not a wall.
let actx = null, soundOn = false, bus = null, noiseBuf = null, lastNote = 0
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
// The slam: a body knock (sine falling fast) under a short noise tick, like a plank dropped on a deck.
function thump(v = 1) {
  if (!soundOn) return
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain()
  o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(62, t + .12)
  g.gain.setValueAtTime(.5 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .22)
  o.connect(g).connect(bus); o.start(t); o.stop(t + .24)
  noise(t, .06, 'bandpass', 2400, 1200, .22 * v, 0.8)
}
// The swing: soft air, a band-passed noise that rises and settles, no pitch to fight the notes.
function whoosh() {
  if (!soundOn) return
  const t = actx.currentTime
  noise(t, Math.min(UNFOLD, .9), 'bandpass', 380, 1500, .16, 0.6)
}
// A marimba pluck per floor: two sines (fundamental plus the 4th partial a marimba has), fast decay.
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



/* ------------------------------------------------------------------ the ladder above the floor */
// GDD 7.4a's ladder, as this demo reads it: FLOOR (rung 1-2, the room) -> CAMPUS (the tower/block: every plate
// is a lit building) -> CITY (the whole patch, streets between) -> PLANET (the patch is one face of a cube-sphere).
// The same cells at every rung, never a swap of content: the plate you watched swing open is the tower that rises
// in its place, and the tower is the lit patch on the globe. `sc` is the rung as a float; everything below is a
// function of it, so a flight between rungs is one continuous move (7.4a: nothing cuts).
const STAGES = ['FLOOR', 'CAMPUS', 'CITY', 'PLANET']
let sc = 0, scTarget = 0
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const lerp = (a, b, t) => a + (b - a) * t
const hash1 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
const NIGHT = { value: 0 }
const PC = new THREE.Vector3(HQ_AT.x + (N - 1) / 2 * W, LEVEL, HQ_AT.z + (N - 1) / 2 * D)   // the patch's middle, flat

/** Lit windows from the tower's own scale, so a taller tower has more storeys and none of them stretch. */
function windows(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vN; varying float vSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 sc3 = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLoc = (position + 0.5) * sc3; vN = normal;
        #ifdef USE_INSTANCING_COLOR
          vSeed = dot(instanceColor, vec3(12.9, 78.2, 37.7));
        #else
          vSeed = 0.;
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vLoc; varying vec3 vN; varying float vSeed;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float side = 1.0 - abs(vN.y);
          vec2 uv = abs(vN.x) > 0.5 ? vLoc.zy : vLoc.xy;
          vec2 g = uv / vec2(2.6, 3.4); vec2 cell = floor(g); vec2 f = fract(g);
          float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.25, f.y) * step(f.y, 0.75);
          float h = fract(sin(dot(cell + vSeed, vec2(12.9898, 78.233))) * 43758.5453);
          vec3 wc = mix(vec3(1.0, 0.78, 0.38), vec3(0.55, 0.95, 1.0), step(0.85, h));
          totalEmissiveRadiance += side * win * step(0.42, h) * wc * (0.22 + 1.7 * uNight);
        }`)
  }
  return mat
}

const unitBox = new THREE.BoxGeometry(1, 1, 1)
const towers = new THREE.InstancedMesh(unitBox, windows(new THREE.MeshLambertMaterial({ color:0xffffff })), N * N)
const lots = new THREE.InstancedMesh(unitBox, new THREE.MeshLambertMaterial({ color:PAL.n1 }), N * N)
for (const m of [towers, lots]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.visible = false; scene.add(m) }
const cellH = [], claimT = [], flatPos = [], sphPos = [], sphQuat = []
{
  const C = new THREE.Color()
  const down = new THREE.Vector3(0, R, 0)
  const onSphere = (u, v) => new THREE.Vector3(u, 1, v).normalize().multiplyScalar(R).sub(down)
  for (let k = 0; k < N * N; k++) {
    const [i, j] = CELLS[k]
    const near = 1 - (i + j) / (2 * N)
    cellH.push(k === 0 ? 46 : 9 + 24 * Math.pow(hash1(k + 1), 1.4) + 14 * near * hash1(k * 3 + 5))
    claimT.push(-1)
    flatPos.push(new THREE.Vector3(HQ_AT.x + i * W, LEVEL, HQ_AT.z + j * D))
    // The cube-sphere face: cell (i,j) is a patch of the +Y face; +i is +u and +j is +v, so the flat grid and the
    // globe agree about which way is east and which is south, and the HQ corner (0,0) stays the corner.
    const u = ((i + .5) / N) * 2 - 1, v = ((j + .5) / N) * 2 - 1, e = 0.01
    const p = onSphere(u, v)
    const tx = onSphere(u + e, v).sub(p).normalize(), tz0 = onSphere(u, v + e).sub(p).normalize()
    const ty = new THREE.Vector3().crossVectors(tz0, tx).normalize()
    const tz = new THREE.Vector3().crossVectors(tx, ty)
    sphPos.push(p)
    sphQuat.push(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, tz)))
    towers.setColorAt(k, k === 0 ? C.set(PAL.warn2) : C.setHSL(0.52 + hash1(k) * 0.06, 0.08, 0.28 + hash1(k * 7) * 0.2))
  }
}
const planet = new THREE.Mesh(new THREE.SphereGeometry(R - 0.8, 72, 48), new THREE.MeshLambertMaterial({ color:0x2b3130, transparent:true, opacity:0 }))
// Meridians and parallels only: a WireframeGeometry sphere draws every quad's diagonal and reads as a field of crosses.
const graticule = (() => {
  const pts = [], seg = 96, r = R - 0.3
  for (let m = 0; m < 16; m++) for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, th = m / 16 * Math.PI
    for (const a of [a0, a1]) pts.push(r * Math.sin(a) * Math.cos(th), r * Math.cos(a), r * Math.sin(a) * Math.sin(th))
  }
  for (let p = 1; p < 10; p++) { const y = Math.cos(p / 10 * Math.PI) * r, rr = Math.sin(p / 10 * Math.PI) * r
    for (let i = 0; i < seg; i++) for (const a of [i / seg * Math.PI * 2, (i + 1) / seg * Math.PI * 2]) pts.push(rr * Math.cos(a), y, rr * Math.sin(a)) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color:PAL.calm1, transparent:true, opacity:0 }))
})()
planet.visible = graticule.visible = false; scene.add(planet, graticule)

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(), _c = new THREE.Vector3()
const IDQ = new THREE.Quaternion()
let bend = 0
/** Every tower and lot, from sc. Cheap enough (324 x 2) to run every frame the ladder is off the floor. */
function layoutField() {
  const f = lerp(1, 0.82, smooth(.5, 1.3, sc))                // streets open as the plates contract
  const rg = smooth(.5, 1.4, sc)
  for (let k = 0; k < N * N; k++) {
    const [i, j] = CELLS[k]
    const claimed = k < plates.length
    let h = 0.0001
    if (claimed) {
      let r = clamp01(rg * 1.7 - ((i + j) / (2 * N)) * 0.7)        // the rise runs out from the HQ in a wave
      if (claimT[k] >= 0) r = Math.min(r, clamp01((clock - claimT[k]) / 0.9))
      h = 0.4 + cellH[k] * easeOutBack(r)
    }
    _p.copy(flatPos[k]).lerp(_c.copy(PC).add(sphPos[k]), bend)
    _q.copy(IDQ).slerp(sphQuat[k], bend)
    _up.set(0, 1, 0).applyQuaternion(_q)
    const sx = W * f, sz = lerp(D, W, bend) * f
    _s.set(sx, h, sz)
    if (!claimed) _s.set(0, 0, 0)         // nothing is built here yet: a zero-height box would z-fight its own lot
    _m.compose(_c.copy(_p).addScaledVector(_up, h / 2), _q, _s); towers.setMatrixAt(k, _m)
    _s.set(sx, 0.4, sz)
    _m.compose(_c.copy(_p).addScaledVector(_up, -0.2), _q, _s); lots.setMatrixAt(k, _m)
  }
  towers.instanceMatrix.needsUpdate = true; lots.instanceMatrix.needsUpdate = true
}
const pulseRing = (k) => {
  if (bend > 0.3) return
  const m = new THREE.MeshBasicMaterial({ color:PAL.calm3, transparent:true, opacity:.9, depthWrite:false })
  const ring = new THREE.Mesh(ringGeo, m); ring.position.copy(flatPos[k]); ring.position.y = LEVEL + 0.1; scene.add(ring)
  fx.push({ age:0, life:1.0, tick(f) { const t = f.age / f.life, sz = 6 + t * 70; ring.scale.set(sz, sz, sz); m.opacity = .9 * (1 - t) * (1 - t) }, dispose() { scene.remove(ring); m.dispose() } })
}
/** The scene's lamp for each rung: daylight on the floor, dusk by the city so the windows are the light. */
function applyLadder() {
  const onFloor = sc < 0.55
  bend = smooth(2.1, 3.0, sc)
  NIGHT.value = smooth(0.7, 2.2, sc)
  const day = 1 - NIGHT.value * 0.78
  hemi.intensity = 1.25 * day; sun.intensity = 1.25 * (1 - NIGHT.value * 0.7); fill.intensity = 0.30 * day
  towers.visible = !onFloor
  lots.visible = sc > 1.5
  hq.root.visible = sc < 0.95; hq.root.scale.y = Math.max(0.001, 1 - smooth(.55, .95, sc))
  for (let n = 1; n < plates.length; n++) { const pl = plates[n]; if (sc >= 0.55) pl.hinge.visible = false; else if (pl.settled) pl.hinge.visible = true }
  if (sc > 0.4) layoutField()
  planet.visible = graticule.visible = bend > 0.02
  planet.position.copy(PC).addScaledVector(_up.set(0, -R, 0), bend)
  graticule.position.copy(planet.position)
  planet.material.opacity = smooth(0.15, 0.6, bend); graticule.material.opacity = 0.22 * smooth(0.3, 0.9, bend)
}

/* ------------------------------------------------------------------ the home beacon */
// Zoomed out, the HQ is a few pixels in a field of desks. An amber pillar (the scale-continuity demo's "home"
// landmark) keeps it findable, and is sized by the zoom so it is the same width on screen at floor 2 and floor 200.
const beaconMat = new THREE.MeshBasicMaterial({ color:PAL.warn2, transparent:true, opacity:.5, depthWrite:false })
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 400, 16, 1, true), beaconMat)
beacon.position.set(HQ_AT.x, 200, HQ_AT.z); scene.add(beacon)

/* ------------------------------------------------------------------ camera: fit everything, with a spring */
const cam = { cx:0, cz:0, cy:0, zoom:20, zv:0, tcx:0, tcz:0, tcy:0, tzoom:20 }
let fitA = 20, fitB = 20, fitCity = 200, fitPlanet = 500
const claimCentre = new THREE.Vector3()
/** The ortho half-height that frames a ground box up to y1, from the fixed lens. */
function fitBox(x0, x1, z0, z1, y1) {
  const centre = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2)
  camera.position.copy(centre).addScaledVector(VIEW, 600); camera.lookAt(centre); camera.updateMatrixWorld()
  let hw = 0, hh = 0
  for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, y1]) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse); hw = Math.max(hw, Math.abs(v.x)); hh = Math.max(hh, Math.abs(v.y))
  }
  return Math.max(hh, hw / (innerWidth / innerHeight)) * 1.12 + 5
}
function refit() {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9
  for (const p of plates) { x0 = Math.min(x0, p.cx - W/2); x1 = Math.max(x1, p.cx + W/2); z0 = Math.min(z0, p.cz - D/2); z1 = Math.max(z1, p.cz + D/2) }
  claimCentre.set((x0 + x1) / 2, 0, (z0 + z1) / 2)
  fitA = fitBox(x0, x1, z0, z1, 5); fitB = fitBox(x0, x1, z0, z1, 46)
  fitCity = fitBox(HQ_AT.x - W/2, HQ_AT.x + (N - .5) * W, HQ_AT.z - D/2, HQ_AT.z + (N - .5) * D, 46)
  fitPlanet = R * 1.18 * Math.max(1, 1 / (innerWidth / innerHeight))
}
function rungTargets() {
  const ll = (a, b, t) => Math.exp(Math.log(a) * (1 - t) + Math.log(b) * t)
  if (sc < 1) cam.tzoom = ll(fitA, fitB, sc)
  else if (sc < 2) cam.tzoom = ll(fitB, fitCity, sc - 1)
  else cam.tzoom = ll(fitCity, fitPlanet, clamp01(sc - 2))
  const toPatch = smooth(1, 2, sc)
  cam.tcx = lerp(claimCentre.x, PC.x, toPatch); cam.tcz = lerp(claimCentre.z, PC.z, toPatch)
  cam.tcy = -R * 0.5 * bend
}
function applyCamera(dt) {
  rungTargets()
  // Underdamped spring on zoom: each expansion makes the camera lurch out and settle, which is the "oh no, it's bigger" beat.
  const k = 70, c = 11
  cam.zv += ((cam.tzoom - cam.zoom) * k - cam.zv * c) * dt
  cam.zoom += cam.zv * dt
  const e = Math.min(1, dt * 4)
  cam.cx += (cam.tcx - cam.cx) * e; cam.cz += (cam.tcz - cam.cz) * e; cam.cy += (cam.tcy - cam.cy) * e
  const a = innerWidth / innerHeight
  camera.left = -cam.zoom * a; camera.right = cam.zoom * a; camera.top = cam.zoom; camera.bottom = -cam.zoom
  camera.updateProjectionMatrix()
  const bw = Math.max(0.15, cam.zoom * 0.012); beacon.scale.set(bw, 1, bw)
  beaconMat.opacity = plates.length < 3 ? 0 : Math.min(.5, (plates.length - 2) * .08) * (1 - smooth(2.2, 2.9, sc))
  shake *= Math.exp(-6 * dt)
  const centre = new THREE.Vector3(cam.cx, cam.cy, cam.cz)
  camera.position.copy(centre).addScaledVector(VIEW, 900)
  camera.lookAt(centre)
  const s = shake * cam.zoom * 0.012
  camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s)
}

/* ------------------------------------------------------------------ driving it */
const $ = (id) => document.getElementById(id)
let auto = true, autoTimer = 0, autoCount = 0, lastExpandAt = 0, clock = 0
let devsShown = 0, devsTarget = 0
const MILESTONES = { 1:['FLOOR 2', 'it opens like a book'], 4:['FLOOR 5', 'a proper office'], 9:['FLOOR 10', 'the carpet is a continent'], 24:['FLOOR 25', 'a town of desks'], 49:['FLOOR 50', 'WHO IS PAYING FOR THIS'], 99:['FLOOR 100', 'ten thousand people, one floor'], 199:['FLOOR 200', 'the floor has weather now'] }
function toast(a, b) { const t = $('toast'); t.innerHTML = a + '<small>' + b + '</small>'; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go') }

function expand(delay = 0) {
  if (plates.length >= MAX_PLATES) { toast('THE SKY IS THE LIMIT', 'this draft stops at ' + MAX_PLATES + ' floors'); auto = false; sync(); return }
  const n = plates.length
  const inField = sc >= 0.55           // above the floor view nothing swings: the cell lights up in place
  makePlate(n, inField ? 0 : delay, inField)
  if (inField) { claimT[n] = clock; pulseRing(n); thump(0.25); note() }
  devsTarget = HQ_HEADS + (plates.length - 1) * DEVS_PER
  if (MILESTONES[n] && !inField) setTimeout(() => toast(...MILESTONES[n]), delay * 1000 + UNFOLD * 1000)
  const now = clock; if (lastExpandAt) $('pace').textContent = (now - lastExpandAt).toFixed(1); lastExpandAt = now
  $('floors').textContent = plates.length
  refit()
  if (delay === 0 && !inField) whoosh()
}
function reset() {
  noteIx = 0
  for (const p of plates.splice(1)) { root.remove(p.hinge); p.plateMat.dispose(); p.decorMat.dispose(); p.desks.dispose(); p.screens.dispose(); p.people.dispose() }
  claimT.fill(-1); autoCount = 0; lastExpandAt = 0; devsShown = 0; scTarget = 0; sc = 0; journey = null; $('stage').textContent = 'FLOOR'
  devsTarget = HQ_HEADS; $('floors').textContent = '1'; $('pace').textContent = '-'
  refit(); applyLadder(); rungTargets(); cam.zoom = cam.tzoom; cam.zv = 0; cam.cx = cam.tcx; cam.cz = cam.tcz; cam.cy = cam.tcy
}
function burst() { for (let i = 0; i < 12; i++) expand(i * 0.18) }
let journey = null
function setStage(v) { scTarget = Math.max(0, Math.min(3, v)); $('stage').textContent = STAGES[Math.round(scTarget)] }
function startJourney() { journey = { t:0, next:0 }; auto = false; sync() }
function sync() { $('bAuto').classList.toggle('on', auto); $('bSound').classList.toggle('on', soundOn) }

$('bExpand').onclick = () => expand()
$('bBurst').onclick = burst
$('bAuto').onclick = () => { auto = !auto; autoTimer = 0; sync() }
$('bSound').onclick = () => { soundOn = !soundOn; if (soundOn) ensureAudio(); sync() }
$('bReset').onclick = reset
$('bJourney').onclick = startJourney
STAGES.forEach((_, i) => { $('s' + i).onclick = () => { journey = null; setStage(i) } })
addEventListener('wheel', (e) => { journey = null; setStage(scTarget + (e.deltaY > 0 ? 0.5 : -0.5)) }, { passive:true })
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); expand() }
  else if (e.key === 'b') burst()
  else if (e.key === 'a') $('bAuto').click()
  else if (e.key === 'm') $('bSound').click()
  else if (e.key === 'r') reset()
  else if (e.key === 'j') startJourney()
  else if (e.key >= '1' && e.key <= '4') { journey = null; setStage(+e.key - 1) }
})
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); refit() })

/* ------------------------------------------------------------------ loop */
renderer.setSize(innerWidth, innerHeight)
devsTarget = HQ_HEADS; refit(); applyLadder(); rungTargets(); cam.zoom = cam.tzoom; cam.cx = cam.tcx; cam.cz = cam.tcz
sync()
let prev = performance.now()
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now; clock += dt; U.value = clock

  if (journey) {
    // The whole climb on one clock: hold the floor while it swings, then the rungs, with claims accelerating the
    // whole way so the planet is still filling when it is reached.
    journey.t += dt
    const jt = journey.t
    setStage(jt < 5 ? 0 : jt < 8 ? 1 : jt < 11.5 ? 2 : 3)
    journey.next -= dt
    if (journey.next <= 0 && plates.length < MAX_PLATES) { expand(); journey.next = Math.max(0.03, 1.1 * Math.pow(0.72, jt)) }
  }
  if (auto) {
    autoTimer -= dt
    if (autoTimer <= 0) {
      // Cadence: 1.8 s for the first, down to 0.12 s. Below UNFOLD the plates overlap in flight, which is the swarm.
      autoCount++
      autoTimer = Math.max(0.12, 1.8 * Math.pow(0.9, autoCount))
      expand()
    }
  }
  for (const pl of plates) {
    if (pl.settled) continue
    const before = pl.t
    pl.t += dt
    if (!pl.landed && pl.t >= UNFOLD && pl.n !== 0) { pl.landed = true; landingFx(pl) }
    writePlate(pl)
    if (pl.t > SETTLE) { pl.settled = true; pl.plateMat.emissiveIntensity = pl.decorMat.emissiveIntensity = 0 }
  }
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.age += dt; f.tick(f, dt); if (f.age > f.life) { f.dispose(); fx.splice(i, 1) } }

  devsShown += (devsTarget - devsShown) * Math.min(1, dt * 6)
  const shown = Math.round(devsShown); const el = $('devs')
  if (el.textContent !== String(shown)) { el.textContent = shown.toLocaleString(); el.classList.add('hit'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hit'), 90) }

  sc += (scTarget - sc) * Math.min(1, dt * (journey ? 1.4 : 2.2)); if (Math.abs(sc - scTarget) < 0.0005) sc = scTarget
  applyLadder()
  applyCamera(dt); updatePops(dt)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

// Debug seam for the harness: loopback only, this page is a demo.
window.__unfold = { expand, burst, reset, plates, setStage, startJourney, fill:(n) => { while (plates.length < n) expand() }, get sc() { return sc }, setAuto:(v) => { auto = v; sync() } }
