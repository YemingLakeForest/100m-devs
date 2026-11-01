import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RAMPS } from '../../art/palette.ts'
import { sharedMaterial } from './worldArt.ts'
import { TILE_W, TILE_D, HOUSE_CAPACITY, tileAt } from './cityGrid.ts'
import { createCityInterior, houseSeat, INTERIOR_SCALE } from './cityInterior.ts'
import type { StudioCast } from './studioPeople.ts'

const N = RAMPS.NEUTRAL, W = RAMPS.WOOD, F = RAMPS.FOLIAGE, G = RAMPS.GLOW, C = RAMPS.CALM

export type Side = 'N' | 'S' | 'W' | 'E'
/** The way each side of a tile faces, on the lattice: north is -z, east is +x. */
export const SIDES: Record<Side, readonly [number, number]> = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }
/** The floor's carpet top, in the tile's own frame: everything stands on it. */
export const CARPET = .03
/** The strips of rooms along a tile's north and south edges begin this far from its centre, so the desks stop before them. */
export const STRIP = 10.2

const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const easeInOut = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2

/** How long a wall takes to fold down into the floor, or come back up out of it. */
const WALL_SECONDS = .5

/**
 * **A tile's furniture rises in a wave that runs away from its seam** [2026-11-01]. Every architectural vertex carries `aDist`, the
 * distance of its part's centre from the tile's hinge edge. Until the tile's wave front (`wave`) passes, a part has no height;
 * then it rises with a little overshoot. The wave starts at the edge the tile hangs from, so the new floor grows away from the
 * old one and the office is never seen to start over. `aDist < 0` is the carpet itself, always up. The front is a hard cyan band
 * on the carpet (`band`), hard-edged by the house rule: no gradients, no glows. Everything gets the baked moonlight the garage's
 * other surfaces have (`cityHouses.ts` used to clone a lit material per surface; a vertex-coloured one takes it from its own colour).
 */
function waved(wave: { value: number }, hinge: { value: T.Vector2 }, axis: { value: T.Vector2 }, band: boolean, glow: number, glass = false) {
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .94, flatShading: true, ...(glass ? { transparent: true, opacity: .22, depthWrite: false } : {}) })
  mat.onBeforeCompile = sh => {
    sh.uniforms.uWave = wave; sh.uniforms.uHinge = hinge; sh.uniforms.uAxis = axis
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDist; uniform float uWave; varying vec2 vF;')
      .replace('#include <begin_vertex>', `
        float pp = aDist < 0.0 ? 1.0 : clamp((uWave - aDist) / 7.0, 0.0, 1.0);
        float ee = pp >= 1.0 ? 1.0 : 1.0 + 2.7 * pow(pp - 1.0, 3.0) + 1.7 * pow(pp - 1.0, 2.0);
        vec3 transformed = vec3(position.x, position.y * ee, position.z);
        vF = position.xz;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWave; uniform vec2 uHinge; uniform vec2 uAxis; varying vec2 vF;
        float frontBand() { float dd = abs(dot(vF - uHinge, uAxis)); return step(uWave, dd) * step(dd, uWave + 1.3) * step(-5.0, uWave); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(2)};${band ? '\n        totalEmissiveRadiance += frontBand() * vec3(0.21, 0.79, 0.85);' : ''}`)
  }
  return mat
}

/* The far field: what a tile shows of its hundred seats until somebody looks into it. One instance per desk, screen and person,
 * shared geometry and materials across every tile, so a whole floor of them is a handful of draw calls. */
const deskGeometry = new T.BoxGeometry(1.43, .78, .75).translate(0, .39, 0)
const screenGeometry = new T.BoxGeometry(.62, .4, .05).translate(0, 1.0, -.22)
const personGeometry = new T.CapsuleGeometry(.26, .55, 3, 8).translate(0, .66, 0)
const padGeometry = new T.BoxGeometry(1.7, .02, 1.0)
const SHIRTS = [C[1], RAMPS.WARN[1], RAMPS.ALARM[1], N[5], C[2], F[1], '#7a4f96'].map(c => new T.Color(c))

/**
 * One tile of the office: a 33 x 25 m slice of one floor, the origin at its centre and the top of its carpet at y = 0.
 *
 * - **The architecture** (carpet, aisles, strips of rooms, planters, columns, and four sides of glass wall) is merged into a few
 *   meshes and always there.
 * - **The far field** is the hundred seats as instances, shown until the lens is close enough to look into the tile.
 * - **The interior** is the game's own hundred-seat office (`cityInterior.ts`), built the first time the lens gets close.
 *
 * Each side of the wall is its own group because a side stands only while nothing is open beyond it (`setWall`): when the tile
 * next door opens, the wall between them folds down into the floor, and when it goes (a layoff) the wall comes back.
 */
export function createOfficeTile(index: number, cast: () => StudioCast, reserved: number,
    address: { k: number; ix: number; iz: number }, hinge: { dx: number; dz: number }) {
  const { k, ix, iz } = address
  const body = new T.Group()
  const wave = { value: 400 }
  const hingeAt = { value: new T.Vector2(hinge.dx * TILE_W / 2, hinge.dz * TILE_D / 2) }
  const axis = { value: hinge.dx ? new T.Vector2(1, 0) : new T.Vector2(0, 1) }
  const distance = (x: number, z: number) => hinge.dx ? Math.abs(x - hinge.dx * TILE_W / 2) : Math.abs(z - hinge.dz * TILE_D / 2)

  type Lists = { carpet: T.BufferGeometry[]; deco: T.BufferGeometry[]; glass: T.BufferGeometry[]; lines: number[] }
  const fresh = (): Lists => ({ carpet: [], deco: [], glass: [], lines: [] })
  let into = fresh()
  const bodyLists = into
  /** One box in the tile's frame, y up from the carpet. `pop` false makes it carpet: always up. */
  function part(kind: 'carpet' | 'deco' | 'glass', w: number, h: number, d: number, x: number, y: number, z: number, colour: string, pop = true) {
    const g = new T.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
    const c = new T.Color(colour), n = g.attributes.position.count, rgb = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { rgb[i * 3] = c.r; rgb[i * 3 + 1] = c.g; rgb[i * 3 + 2] = c.b }
    g.setAttribute('color', new T.BufferAttribute(rgb, 3))
    g.setAttribute('aDist', new T.BufferAttribute(new Float32Array(n).fill(pop ? distance(x, z) : -1), 1))
    g.deleteAttribute('uv')
    into[kind].push(g)
  }

  /* --- the carpet and the aisles ---------------------------------------------------------------------------------- */
  part('carpet', TILE_W, CARPET, TILE_D, 0, 0, 0, N[2], false)
  // An aisle between every column of islands (6.25 m apart, so at x = ±3.1 and ±9.4), and a cross aisle between the pairs of
  // rows (4 m apart, at z = ±2 and ±6). Each is a darker runner with a thin inlay. The two avenues that lead from the garage to the
  // office's doors are the same aisles with a bright inlay: the N-S ones in the column of tiles above and below the garage, the
  // E-W ones in the row of tiles beside it.
  const pitchX = 5.0 * INTERIOR_SCALE, pitchZ = 3.2 * INTERIOR_SCALE
  const avenueNS = ix === 0, avenueEW = iz === 0
  for (const x of [-1.5, -.5, .5, 1.5].map(u => u * pitchX)) {
    const bright = avenueNS && Math.abs(x) < pitchX
    part('carpet', 2.2, .006, TILE_D - 2.4, x, CARPET, 0, N[1], false)
    for (const s of [-1, 1]) part('carpet', .1, .012, TILE_D - 2.4, x + s * 1.15, CARPET, 0, bright ? C[2] : C[1], false)
  }
  for (const z of [-1.5, -.5, .5, 1.5].map(u => u * pitchZ)) {
    const bright = avenueEW && Math.abs(z) < pitchZ
    part('carpet', TILE_W - 3, .006, 1.0, 0, CARPET + .002, z, N[1], false)
    for (const s of [-1, 1]) part('carpet', TILE_W - 3, .012, .1, 0, CARPET + .002, z + s * .55, bright ? C[2] : C[1], false)
  }

  /* --- what makes it an office: the two strips of rooms --------------------------------------------------------------- */
  // Four programmes, chosen by the tile's address, so a walk across the floor is not one tile repeated eighteen times.
  const prog = Math.floor(hash(ix * 7.3 + iz * 13.1 + 4) * 4)
  const meeting = (mx: number, mz: number) => {
    part('deco', 3.4, .08, 1.0, mx, .72, mz, W[2]); part('deco', .2, .72, .2, mx, 0, mz, N[2])
    for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) part('deco', .5, .5, .5, mx - 1.2 + i * .8, 0, mz + sz * .85, C[1])
    part('glass', 7, 2.5, .06, mx, 0, mz - 1.1, C[2]); part('glass', 7, 2.5, .06, mx, 0, mz + 1.1, C[2])
    part('glass', .06, 2.5, 2.2, mx - 3.5, 0, mz, C[2]); part('glass', .06, 2.5, 2.2, mx + 3.5, 0, mz, C[2])
  }
  const pantry = (px: number, pz: number) => { part('deco', 6, .9, 1, px, 0, pz, N[3]); part('deco', 6.1, .06, 1.1, px, .9, pz, N[5]) }
  const lounge = (lx: number, lz: number) => {
    part('deco', 5, .45, .9, lx, 0, lz, C[1]); part('deco', 5, .55, .22, lx, .45, lz + (lz > 0 ? .34 : -.34), C[1])
    part('deco', 1.4, .4, 1.0, lx - 3.4, 0, lz, N[2]); part('deco', 1.4, .4, 1.0, lx + 3.4, 0, lz, N[2])   // an end table either side
  }
  const booths = (bx: number, bz: number, n: number) => { for (let i = 0; i < n; i++) { part('glass', 1.8, 2.4, 1.8, bx + i * 2.3, 0, bz, C[2]); part('deco', 1.9, .1, 1.9, bx + i * 2.3, 2.4, bz, N[2]) } }
  const s = 11.3
  if (prog === 0) { meeting(-9.5, s); pantry(9.5, s); pantry(-9.5, -s); meeting(9.5, -s) }
  else if (prog === 1) { meeting(-9.5, s); meeting(9.5, s); meeting(-9.5, -s); meeting(9.5, -s) }
  else if (prog === 2) { lounge(-9.5, s); pantry(9.5, s); pantry(-9.5, -s); lounge(9.5, -s) }
  else { booths(-12.5, s, 4); booths(4.5, s, 4); pantry(-9.5, -s); meeting(9.5, -s) }
  // Planters at the strips' free ends, never in an aisle.
  for (const [px, pz] of [[-15, -11.2], [15, -11.2], [-15, 11.2], [15, 11.2], [-4.2, -11.2], [4.2, 11.2]]) {
    part('deco', .55, .5, .55, px, 0, pz, W[0]); part('deco', .9, 1.1, .9, px, .5, pz, F[1])
  }
  // Columns on the tile's corners: one structural grid across the whole floor, the thing that says this is one building. A corner
  // is shared by up to four tiles and belongs to the first of them to open, so it is there whenever anything beside it is. The four
  // round the garage's own lot are the garage's walls' business.
  const cornerOwner = (i: number, j: number) => {
    if (i >= 0 && i <= 1 && j >= 0 && j <= 1) return null
    let best = Infinity
    for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) { const r = tileAt(a, b); if (r !== undefined && r > 0 && r < best) best = r }
    return best
  }
  for (const [i, j] of [[ix, iz], [ix + 1, iz], [ix, iz + 1], [ix + 1, iz + 1]]) {
    if (cornerOwner(i, j) !== k) continue
    const x = (i - ix - .5) * TILE_W, z = (j - iz - .5) * TILE_D
    part('deco', .8, 3.2, .8, x, 0, z, N[4]); part('deco', .9, .14, .9, x, 2.7, z, C[1])
  }

  /* --- the glass wall: four sides, each there only while nothing is open beyond it -------------------------------- */
  // Back walls (north, west) stand full height and the front ones (south, east) are a low parapet, so the camera looks over them
  // into the floor: the garage's own dollhouse convention. The two front walls have a door each, where the avenues end, with a
  // canopy and an amber sign; the door is in whichever tile is last on its avenue, so it walks outward with the floor.
  function wallSide(side: Side, lines: number[]) {
    const front = side === 'S' || side === 'E', sill = front ? .9 : 1.0, glassH = front ? 1.0 : 2.5
    const alongX = side === 'N' || side === 'S'
    const half = alongX ? TILE_W / 2 : TILE_D / 2
    // The wall stands a quarter metre inside the tile's edge; `sign` is which edge.
    const sign = side === 'N' || side === 'W' ? -1 : 1
    const edgeAt = (alongX ? TILE_D : TILE_W) / 2 * sign
    const fixed = edgeAt - sign * .25
    // Mullions every 3.3 m on the floor's own grid, not the tile's, so two tiles' walls in a line keep one rhythm.
    const origin = alongX ? ix * TILE_W : iz * TILE_D
    const door = (side === 'S' && ix === 0) || (side === 'E' && iz === 0)
    const runs = door ? [[-half, -5], [5, half]] : [[-half, half]]
    for (const [p, q] of runs) {
      const len = q - p, mid = (p + q) / 2
      const box = (h: number, t: number, y: number, colour: string, kind: 'deco' | 'glass') => alongX ? part(kind, len, h, t, mid, y, fixed, colour) : part(kind, t, h, len, fixed, y, mid, colour)
      box(sill, .5, 0, N[4], 'deco'); box(glassH, .08, sill, C[2], 'glass'); box(.12, .56, sill + glassH, N[5], 'deco')
      for (let g = Math.ceil((p + origin) / 3.3 - 1e-6) * 3.3; g <= q + origin + 1e-6; g += 3.3) {
        const m = g - origin
        if (alongX) part('deco', .14, sill + glassH, .2, m, 0, fixed, N[3]); else part('deco', .2, sill + glassH, .14, fixed, 0, m, N[3])
      }
    }
    if (door && side === 'S') {
      part('deco', 12.4, .2, 3, 0, 3.2, TILE_D / 2 - 1.7, N[3]); part('deco', 12.4, .5, .22, 0, 3.45, TILE_D / 2 - .3, RAMPS.WARN[1])
      for (const sg of [-1, 1]) part('deco', .3, 3.2, .3, sg * 5.8, 0, TILE_D / 2 - 1.2, N[4])
    }
    if (door && side === 'E') {
      part('deco', 3, .2, 12.4, TILE_W / 2 - 1.7, 3.2, 0, N[3]); part('deco', .22, .5, 12.4, TILE_W / 2 - .3, 3.45, 0, RAMPS.WARN[1])
      for (const sg of [-1, 1]) part('deco', .3, 3.2, .3, TILE_W / 2 - 1.2, 0, sg * 5.8, N[4])
    }
    // The floor's one hairline: its edge, in cyan, where this wall stands.
    if (alongX) lines.push(-half, .07, edgeAt, half, .07, edgeAt); else lines.push(edgeAt, .07, -half, edgeAt, .07, half)
  }
  const sideLists = {} as Record<Side, Lists>
  for (const side of Object.keys(SIDES) as Side[]) { into = sideLists[side] = fresh(); wallSide(side, into.lines) }
  into = bodyLists

  /* --- the objects ----------------------------------------------------------------------------------------------- */
  // How much of its own colour each surface gives back, baked: the carpet least (it is most of the picture, and the bloom takes anything bright).
  const materials = { carpet: waved(wave, hingeAt, axis, true, .2), deco: waved(wave, hingeAt, axis, false, .28), glass: waved(wave, hingeAt, axis, false, .1, true) }
  const edgeMaterial = new T.LineBasicMaterial({ color: C[1] })
  const geometries: T.BufferGeometry[] = []
  const merged = (list: T.BufferGeometry[], material: T.Material, renderOrder = 0) => {
    if (!list.length) return null
    const geometry = mergeGeometries(list); list.forEach(g => g.dispose()); geometries.push(geometry)
    const mesh = new T.Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = renderOrder
    return mesh
  }
  // The slab under the carpet is what folds up out of sight under its neighbour, so it is opaque and as big as the tile.
  const slabMaterial = sharedMaterial('office:slab', () => new T.MeshStandardMaterial({ color: N[2], emissive: N[2], emissiveIntensity: .6, roughness: 1, flatShading: true }))
  const slab = new T.Mesh(new T.BoxGeometry(TILE_W, .3, TILE_D), slabMaterial); slab.position.y = -.15; geometries.push(slab.geometry)
  body.add(slab)
  for (const m of [merged(bodyLists.carpet, materials.carpet), merged(bodyLists.deco, materials.deco), merged(bodyLists.glass, materials.glass, 2)]) if (m) body.add(m)
  const walls = {} as Record<Side, { group: T.Group; k: number; from: number; to: number; at: number }>
  for (const side of Object.keys(SIDES) as Side[]) {
    const l = sideLists[side], group = new T.Group(); body.add(group)
    for (const m of [merged(l.deco, materials.deco), merged(l.glass, materials.glass, 2)]) if (m) group.add(m)
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(l.lines, 3)); geometries.push(lg)
    group.add(new T.LineSegments(lg, edgeMaterial))
    walls[side] = { group, k: 1, from: 1, to: 1, at: 0 }
  }

  /* --- the far field ------------------------------------------------------------------------------------------------- */
  const field = new T.Group(); field.position.y = CARPET; body.add(field)
  const deskMaterial = sharedMaterial('office:desk', () => new T.MeshStandardMaterial({ color: N[4], emissive: N[4], emissiveIntensity: .22, roughness: .94, flatShading: true }))
  const screenMaterial = sharedMaterial('city:desk-screen', () => new T.MeshBasicMaterial({ color: G[1] }))
  const personMaterial = sharedMaterial('office:person', () => new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .12, roughness: .94, flatShading: true }))
  const padMaterial = sharedMaterial('office:pad', () => new T.MeshStandardMaterial({ color: N[3], emissive: N[3], emissiveIntensity: .25, roughness: 1 }))
  const desks = new T.InstancedMesh(deskGeometry, deskMaterial, HOUSE_CAPACITY), screens = new T.InstancedMesh(screenGeometry, screenMaterial, HOUSE_CAPACITY)
  const people = new T.InstancedMesh(personGeometry, personMaterial, HOUSE_CAPACITY), pads = new T.InstancedMesh(padGeometry, padMaterial, HOUSE_CAPACITY)
  for (const m of [desks, screens, people, pads]) { m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); field.add(m) }
  people.instanceColor = new T.InstancedBufferAttribute(new Float32Array(HOUSE_CAPACITY * 3), 3)
  const dummy = new T.Object3D()
  /** Seat `i` in the field: present (desk, screen, person) or an empty footprint. */
  function setSeat(i: number, present: boolean) {
    const at = houseSeat(i), facing = Math.floor(i / 10) % 2, x = at.x * INTERIOR_SCALE, z = at.z * INTERIOR_SCALE
    const on = (m: T.InstancedMesh, px: number, pz: number, ry: number, scale: number) => {
      dummy.position.set(px, 0, pz); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(scale); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix)
    }
    const deskZ = z + (facing ? -.58 : .58), ry = facing ? Math.PI : 0
    on(desks, x, deskZ, ry, present ? 1 : 0); on(screens, x, deskZ, ry, present ? 1 : 0); on(people, x, z, 0, present ? 1 : 0); on(pads, x, deskZ, 0, present ? 0 : 1)
    if (present) people.setColorAt(i, SHIRTS[Math.floor(hash(index * 100 + i) * SHIRTS.length)])
  }
  for (let i = 0; i < HOUSE_CAPACITY; i++) setSeat(i, false)
  for (const m of [desks, screens, people, pads]) m.instanceMatrix.needsUpdate = true
  if (people.instanceColor) people.instanceColor.needsUpdate = true

  let interior: ReturnType<typeof createCityInterior> | null = null
  let filled = 0
  return {
    body, field, wave,
    /** A getter, because the interior is built the first time the lens gets close: a spread of this object would freeze it at null. */
    get interior() { return interior },
    /** The metres across the tile in the direction its wave runs, from the hinge edge to the far one. */
    depth: hinge.dx ? TILE_W : TILE_D,
    /**
     * `n` seats are taken, the first `reserved` of them by the garage. `arrive` (the clock) is a hire arriving into a tile that is
     * open: the interior drops them in. A tile nobody is looking into has no interior to fall into, and its hire is told by the
     * city (`cityHouses.ts`). `leave` is the same for a layoff.
     */
    fill(n: number, arrive?: number, leave?: number) {
      const was = filled; filled = n
      for (let i = Math.min(was, n); i < Math.max(was, n); i++) if (i >= reserved) setSeat(i, i < n)
      for (const m of [desks, screens, people, pads]) m.instanceMatrix.needsUpdate = true
      if (people.instanceColor) people.instanceColor.needsUpdate = true
      interior?.fill(n, interior.root.visible ? arrive : undefined, interior.root.visible ? leave : undefined)
    },
    /** Hires that have landed on a desk inside since this was last asked. */
    takeLandings() { return interior?.takeLandings() ?? 0 },
    takeDepartures() { return interior?.takeDepartures() ?? 0 },
    takeDeskLandings() { return interior?.takeDeskLandings() ?? 0 },
    /** Open the tile to the lens (the game's own interior, built the first time) or close it back to its far field. True when that changed anything. */
    cutaway(on: boolean) {
      if (on && !interior) {
        interior = createCityInterior(index, cast(), reserved)
        interior.root.scale.set(INTERIOR_SCALE, 1, INTERIOR_SCALE); interior.root.position.y = CARPET
        interior.fill(filled); body.add(interior.root)
      }
      const changed = field.visible === on
      field.visible = !on
      if (interior) interior.root.visible = on
      return changed
    },
    /**
     * Stand the wall on `side` up or take it down, over half a second beginning `delay` from `now`; `now` omitted does it at once
     * (a tile built into a floor that is already there). The HQ's side and a side with a tile open beyond it are down.
     */
    setWall(side: Side, up: boolean, now?: number, delay = 0) {
      const w = walls[side], to = up ? 1 : 0
      if (w.to === to && now !== undefined) return
      w.to = to
      if (now === undefined) { w.k = w.from = to; w.at = 0; apply(w) } else { w.from = w.k; w.at = now + delay }
    },
    /** How far up each wall is, 0 to 1. */
    wallHeights(): Record<Side, number> { return { N: walls.N.k, S: walls.S.k, W: walls.W.k, E: walls.E.k } },
    /** Walls still moving. */
    update(now: number) {
      let moving = false
      for (const w of Object.values(walls)) {
        if (w.k === w.to) continue
        w.k = w.from + (w.to - w.from) * easeInOut(clamp01((now - w.at) / WALL_SECONDS))
        if (now - w.at >= WALL_SECONDS) w.k = w.to
        apply(w); moving = true
      }
      return moving
    },
    dispose() {
      geometries.forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose()); edgeMaterial.dispose()
      desks.dispose(); screens.dispose(); people.dispose(); pads.dispose()
      interior?.dispose()
    },
  }
  function apply(w: { group: T.Group; k: number }) { w.group.scale.y = Math.max(.001, w.k); w.group.visible = w.k > .002 }
}
