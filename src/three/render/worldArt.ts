/*
 * Copied from the rebuild (100m-devs-three/src/render/worldArt.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/** A single material/light vocabulary for the approved September 5 concept set. */
import * as T from 'three'

export const INK = {
  paper: '#f3f0e8', wall: '#ced9dc', trim: '#e7eeed', floor: '#78868a',
  grout: '#a5b1b3', glass: '#344c56', glassLight: '#688f9a', wood: '#ba9263',
  woodEdge: '#76583d', metal: '#273941', leaf: '#416652', leafLight: '#63836a',
  lawn: '#a3ac72', earth: '#6d7151', water: '#91adbe', land: '#d8d3a7',
  teal: '#368c87', amber: '#d4a24e', navy: '#101e2b', skin: '#d7a87b', hair: '#393329',
  /*
   * **Selection, which used to be `teal` and was never a material.** One
   * colour was answering two questions: what a plant, a shirt and a pane of
   * glass are made of, and which station the player has hold of (§9.2).
   * Splitting them is what lets §12.3 take the hue off the interface without
   * taking the leaves off the plants. It is --ink rather than a hue because a
   * graphite primary leaves nothing saturated to inherit, and on a daylight
   * floor ink is the highest-contrast mark available anyway.
   */
  select: '#24333b',
} as const
const materials = new Map<string, T.MeshStandardMaterial>()
export function material(colour: string): T.MeshStandardMaterial {
  let m = materials.get(colour)
  if (!m) {
    m = new T.MeshStandardMaterial({ color: colour, roughness: .94,
      metalness: colour === INK.metal ? .05 : 0, flatShading: true })
    materials.set(colour, m)
  }
  return m
}
/**
 * **A finish that is not the flat-shaded default, asked for rather than made.**
 *
 * [2026-09-22] `material()` above is the cache for the ordinary case; this is
 * the same idea for the handful of surfaces that need their own parameters —
 * glass, a role chair, a lit bulb. They used to be built with `new` at the call
 * site and flagged `ownMaterial`, which meant `disposeArt` destroyed them and
 * the next build made them again.
 *
 * **That was the price of a hire.** A rebuild in place is how the room answers
 * a hire (§12.6), and the office floor was handing the renderer about 110
 * brand-new `Material` objects every time — thirty-one identical window panes
 * and seventy identical chair parts among them. Three has to run `initMaterial`
 * for each one on the next draw, and the panes' transparent double-sided
 * program was the last owner of its `WebGLProgram`, so disposing them *deleted*
 * the compiled shader and the rebuild stalled recompiling it. Measured on the
 * office floor at 30 developers: 105 ms in a single `render()` against 6 ms to
 * draw the identical scene a second time.
 *
 * Shared, the material survives the dispose, its program is never released, and
 * the draw after a rebuild is an ordinary frame. The rule that comes with it:
 * **a shared material must not be mutated per object.** Nothing in `render/`
 * writes a colour or an opacity into a material today — selection is drawn with
 * geometry — and this is the reason to keep it that way.
 */
const finishes = new Map<string, T.Material>()
export function sharedMaterial<M extends T.Material>(key: string, build: () => M): M {
  let m = finishes.get(key) as M | undefined
  if (!m) { m = build(); finishes.set(key, m) }
  return m
}
const cube = new T.BoxGeometry(1, 1, 1)
const round = new T.CylinderGeometry(1, 1, 1, 8)
const leaf = new T.IcosahedronGeometry(1, 0)
const ball = new T.IcosahedronGeometry(1, 1)
export function box(parent: T.Object3D, x: number, y: number, z: number,
  w: number, h: number, d: number, colour: string, shadow = true): T.Mesh {
  const mesh = new T.Mesh(cube, material(colour))
  mesh.position.set(x, y + h / 2, z)
  mesh.scale.set(w, h, d)
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
export function cylinder(parent: T.Object3D, x: number, y: number, z: number,
  radius: number, height: number, colour: string): T.Mesh {
  const mesh = new T.Mesh(round, material(colour))
  mesh.position.set(x, y + height / 2, z)
  mesh.scale.set(radius, height, radius)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
export function sphere(parent: T.Object3D, x: number, y: number, z: number,
  radius: number, colour: string, faceted = false): T.Mesh {
  const mesh = new T.Mesh(faceted ? leaf : ball, material(colour))
  mesh.position.set(x, y, z)
  mesh.scale.setScalar(radius)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
export function tree(parent: T.Object3D, x: number, z: number, size = 1): void {
  // §7.4a [2026-10-07]: stepped foliage belongs to the same block kit as people;
  // triangular crowns made the office read as a low-poly architectural model.
  box(parent, x, 0, z, size * .22, size * .85, size * .22, INK.woodEdge)
  // Offset clusters make a grown silhouette rather than three centred toy cubes.
  box(parent, x, size * .65, z, size * .86, size * .60, size * .82, INK.leaf)
  box(parent, x - size * .22, size * 1.18, z + size * .10, size * .62, size * .48, size * .66, INK.leafLight)
  box(parent, x + size * .36, size * .92, z - size * .18, size * .58, size * .54, size * .54, INK.leaf)
  box(parent, x - size * .40, size * .83, z - size * .20, size * .38, size * .38, size * .48, INK.leafLight)
  box(parent, x + size * .08, size * 1.55, z + size * .04, size * .38, size * .26, size * .42, INK.leafLight)
}
export function planter(parent: T.Object3D, x: number, z: number, size = 0.55): void {
  box(parent, x, 0, z, size, size * 0.55, size, INK.trim)
  box(parent, x, size * .55, z, size * .9, size * .65, size * .9, INK.leaf)
  box(parent, x - size * .12, size * 1.2, z, size * .55, size * .3, size * .55, INK.leafLight)
}
export function hedge(parent: T.Object3D, x: number, z: number, w: number, d: number): void {
  box(parent, x, 0, z, w + 0.15, 0.22, d + 0.15, INK.trim)
  box(parent, x, 0.22, z, w, 0.43, d, INK.leaf)
}
export function line(parent: T.Object3D, points: T.Vector3[], colour: string, opacity = 1): T.Line {
  const geometry = new T.BufferGeometry().setFromPoints(points)
  const mesh = new T.Line(geometry, new T.LineBasicMaterial({ color: colour, transparent: true, opacity }))
  mesh.userData.ownGeometry = true
  mesh.userData.ownMaterial = true
  parent.add(mesh)
  return mesh
}

/**
 * A floor plate from a polygon, extruded downward into a slab.
 *
 * Rooms stopped being rectangles, and a rectangle is the one shape `box` can
 * draw. Holes are cut rather than overdrawn — the office's meeting point is a
 * pit in the slab, and a second plate laid over the first z-fights with it at
 * the exact zoom the game is played at.
 */
export function slab(parent: T.Object3D, poly: readonly (readonly [number, number])[],
  y: number, thickness: number, colour: string,
  holes: readonly (readonly (readonly [number, number])[])[] = []): T.Mesh {
  const shape = new T.Shape(poly.map(([x, z]) => new T.Vector2(x, z)))
  for (const hole of holes) shape.holes.push(new T.Path(hole.map(([x, z]) => new T.Vector2(x, z))))
  const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geometry.rotateX(Math.PI / 2)
  const mesh = new T.Mesh(geometry, material(colour))
  mesh.position.y = y + thickness
  mesh.receiveShadow = true
  mesh.userData.ownGeometry = true
  parent.add(mesh)
  return mesh
}

/** A wall as a segment, so a canted one is authored exactly like a square one. */
export function wall(parent: T.Object3D, a: readonly [number, number], b: readonly [number, number],
  y: number, h: number, t: number, colour: string, lit = true): T.Mesh {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const mesh = box(parent, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.hypot(dx, dz), h, t, colour, lit)
  mesh.rotation.y = -Math.atan2(dz, dx)
  return mesh
}

export function worktable(parent: T.Object3D, x: number, z: number, w = 2.65, d = 1.45): T.Group {
  const g = new T.Group()
  g.position.set(x, 0, z)
  parent.add(g)
  box(g, 0, 0.79, 0, w, 0.13, d, INK.wood)
  box(g, 0, 0.72, 0, w - .12, .07, d - .10, INK.metal)
  for (const dx of [-w / 2 + 0.12, w / 2 - 0.12]) {
    for (const dz of [-d / 2 + 0.12, d / 2 - 0.12]) {
      box(g, dx, .05, dz, 0.16, 0.67, 0.16, INK.metal)
      box(g, dx, .015, dz, .22, .035, .22, INK.metal)
    }
  }
  for (const dx of [-0.66, 0.66]) for (const s of [-1, 1]) {
    box(g, dx, 0.92, s * 0.11, 0.12, 0.2, 0.14, INK.metal)
    box(g, dx, 1.05, s * 0.16, 0.57, 0.38, 0.09, INK.metal)
    box(g, dx, 1.08, s * 0.20, 0.49, 0.29, 0.015, INK.glassLight)
    // A small back badge and lower trim make recognisable hardware at game scale.
    box(g, dx, 1.19, s * .107, .12, .035, .008, INK.grout)
    box(g, dx, 1.045, s * .208, .54, .025, .012, '#556870')
    box(g, dx, 0.923, s * 0.53, 0.42, 0.018, 0.15, INK.grout)
    cylinder(g, dx + 0.32, 0.923, s * 0.48, 0.055, 0.12, s > 0 ? INK.teal : INK.amber)
  }
  return g
}

/** Shared geometry/materials are retained; scene-local line and sphere meshes are released. */
export function disposeArt(root: T.Object3D): void {
  root.traverse((node) => {
    const mesh = node as T.Mesh
    if (node instanceof T.InstancedMesh) node.dispose()
    if (mesh.userData.ownGeometry) mesh.geometry?.dispose()
    if (mesh.userData.ownMaterial && mesh.material) {
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (mesh.userData.ownTexture && mat instanceof T.MeshBasicMaterial) mat.map?.dispose()
        mat.dispose()
      }
    }
  })
}

/** Freeze commodity geometry into material batches. Selection volumes and animated people stay separate. */
/**
 * One batched box, remembered so it can be taken away again.
 *
 * §18 needs exactly one thing from the batcher that it did not used to give:
 * the ability to make a *particular* seated body disappear when its occupant
 * stands up. On the office floor most people are instanced — a hundred bodies
 * at thirty boxes each is three thousand draw calls, which is why they are
 * batched in the first place — so `.visible = false` is not available: there is
 * no object left to hide.
 *
 * An instance matrix is, though. Collapsing one to zero scale removes it from
 * the picture at the cost of one matrix write, and putting the original back
 * restores it exactly. That is the whole of {@link SeatInstances}.
 */
export interface SeatInstance {
  mesh: T.InstancedMesh
  index: number
  matrix: T.Matrix4
}

const EMPTY = new T.Matrix4().makeScale(0, 0, 0)

/**
 * Hide or show every batched box belonging to one seat.
 *
 * Idempotent, because the caller is a per-frame loop comparing an away roster
 * against what is currently drawn, and making it safe to call twice is cheaper
 * than making the caller remember.
 */
export function showSeatInstances(instances: readonly SeatInstance[], visible: boolean): void {
  const touched = new Set<T.InstancedMesh>()
  for (const at of instances) {
    at.mesh.setMatrixAt(at.index, visible ? at.matrix : EMPTY)
    touched.add(at.mesh)
  }
  for (const mesh of touched) {
    mesh.instanceMatrix.needsUpdate = true
    // Hidden instances collapse to the origin. Cached bounds from that frame
    // would keep an arriving console culled even after its matrices are restored.
    mesh.boundingSphere = null
    mesh.boundingBox = null
  }
}

export type SeatInstances = Map<number, SeatInstance[]>
/** The same handles, keyed by a prop's name rather than a seat's number. */
export type PropInstances = Map<string, SeatInstance[]>

/**
 * **Move every batched box belonging to one prop, together.**
 *
 * [2026-09-22] {@link showSeatInstances} above writes one of two matrices; this
 * writes any of them, which is the difference between *hiding* a batched object
 * and *animating* one. §12.6's delivery needs the second: a desk has to fall,
 * squash and settle, and until now the only way to move it was to keep it out
 * of the batch — which meant rebuilding the room to take it out and rebuilding
 * again to put it back, four times per hire.
 *
 * `delta` is in the room's own frame and pre-multiplies the box's resting
 * matrix, so nothing accumulates: the same `delta` twice is the same picture
 * twice, and the identity restores the prop exactly. `turnSeat` in `worldScene`
 * has worked this way since §18.2 and this is that trick given a name.
 */
export function placeInstances(instances: readonly SeatInstance[], delta: T.Matrix4): void {
  const touched = new Set<T.InstancedMesh>()
  const out = new T.Matrix4()
  for (const at of instances) {
    at.mesh.setMatrixAt(at.index, out.multiplyMatrices(delta, at.matrix))
    touched.add(at.mesh)
  }
  for (const mesh of touched) {
    mesh.instanceMatrix.needsUpdate = true
    // Hidden instances collapse to the origin. Cached bounds from that frame
    // would keep an arriving console culled even after its matrices are restored.
    mesh.boundingSphere = null
    mesh.boundingBox = null
  }
}

export function batchArt(root: T.Group, seats?: SeatInstances, props?: PropInstances): void {
  root.updateMatrixWorld(true)
  const batches = new Map<string, { geometry: T.BufferGeometry; material: T.Material; meshes: T.Mesh[] }>()
  // Which seat, and which prop, each batched box belongs to. Both are read off
  // the ancestor chain during the same walk rather than in a second traversal.
  //
  // They are two registers and not one on purpose (§9.2 cuts the other way
  // here): a seat means *the person sitting there*, so §18's away layer can
  // take them out of the chair, and a prop means *a piece of furniture*. Folding
  // a desk into its occupant's seat would send the desk to the water cooler.
  const owner = new Map<T.Mesh, number>()
  const part = new Map<T.Mesh, string>()
  root.traverse((node) => {
    if (!(node instanceof T.Mesh) || node.userData.dynamic || node.userData.hit) return
    let p: T.Object3D | null = node.parent
    let seat: number | undefined
    let prop: string | undefined
    while (p && p !== root) {
      if (p.userData.dynamic) return
      if (seat === undefined && typeof p.userData.seat === 'number') seat = p.userData.seat
      if (prop === undefined && typeof p.userData.prop === 'string') prop = p.userData.prop
      p = p.parent
    }
    if (node.userData.ownGeometry || Array.isArray(node.material)) return
    if (seat !== undefined) owner.set(node, seat)
    if (prop !== undefined) part.set(node, prop)
    const key = `${node.geometry.uuid}:${node.material.uuid}:${node.castShadow}:${node.receiveShadow}`
    if (!batches.has(key)) batches.set(key, { geometry: node.geometry, material: node.material, meshes: [] })
    batches.get(key)!.meshes.push(node)
  })
  const inverse = root.matrixWorld.clone().invert()
  for (const batch of batches.values()) {
    if (batch.meshes.length < 2) continue
    const instanced = new T.InstancedMesh(batch.geometry, batch.material, batch.meshes.length)
    instanced.castShadow = batch.meshes[0].castShadow
    instanced.receiveShadow = batch.meshes[0].receiveShadow
    batch.meshes.forEach((mesh, i) => {
      const matrix = inverse.clone().multiply(mesh.matrixWorld)
      instanced.setMatrixAt(i, matrix)
      const seat = owner.get(mesh)
      if (seats && seat !== undefined) {
        const list = seats.get(seat) ?? []
        list.push({ mesh: instanced, index: i, matrix })
        seats.set(seat, list)
      }
      const prop = part.get(mesh)
      if (props && prop !== undefined) {
        const list = props.get(prop) ?? []
        list.push({ mesh: instanced, index: i, matrix })
        props.set(prop, list)
      }
      mesh.removeFromParent()
    })
    instanced.instanceMatrix.needsUpdate = true
    root.add(instanced)
  }
}
