import * as T from 'three'
import { RAMPS } from '../../art/palette.ts'
import { box, cylinder, sphere, line, batchArt, disposeArt, material, sharedMaterial } from './worldArt.ts'
import { HOUSE_CAPACITY } from './cityGrid.ts'
import { createCityInterior } from './cityInterior.ts'
import type { StudioCast } from './studioPeople.ts'

const N = RAMPS.NEUTRAL, W = RAMPS.WOOD, F = RAMPS.FOLIAGE

/** The city is a neighbourhood of converted houses, in the garage's material register. */
export function createCityHouse(index: number, cast: () => StudioCast) {
  const body = new T.Group()
  const variant = index % 3
  const wall = [N[6], N[5], W[3]][variant]
  const roofColour = [N[3], W[1], N[2]][variant]
  const trim = N[7]
  const detail = variant === 1 ? W[2] : N[4]

  function roof(x: number, y: number, z: number, width: number, depth: number, rise: number, hip = false) {
    let geometry: T.BufferGeometry
    if (hip) {
      const a = [-width / 2, 0, -depth / 2], b = [width / 2, 0, -depth / 2]
      const c = [width / 2, 0, depth / 2], d = [-width / 2, 0, depth / 2]
      const p = [0, rise, -depth * .28], q = [0, rise, depth * .28]
      geometry = new T.BufferGeometry()
      geometry.setAttribute('position', new T.Float32BufferAttribute([
        ...a, ...p, ...b, ...b, ...p, ...q, ...b, ...q, ...c,
        ...c, ...q, ...d, ...d, ...q, ...p, ...d, ...p, ...a,
      ], 3))
      geometry.computeVertexNormals()
    } else {
      const shape = new T.Shape()
      shape.moveTo(-width / 2, 0); shape.lineTo(0, rise); shape.lineTo(width / 2, 0); shape.closePath()
      geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
      geometry.translate(0, 0, -depth / 2)
    }
    const mesh = new T.Mesh(geometry, material(roofColour))
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
    mesh.userData.ownGeometry = true; body.add(mesh)
    if (!hip) {
      // Tile courses follow each slope; fascia outlines the gable against the roof.
      for (const side of [-1, 1]) {
        for (let row = 1; row <= 7; row++) {
          const t = row / 8
          line(body, [new T.Vector3(x + side * width / 2 * t, y + rise * (1 - t) + .025, z - depth / 2),
            new T.Vector3(x + side * width / 2 * t, y + rise * (1 - t) + .025, z + depth / 2)], N[1])
        }
        for (const end of [-1, 1]) line(body, [new T.Vector3(x + side * width / 2, y, z + end * (depth / 2 + .025)),
          new T.Vector3(x, y + rise, z + end * (depth / 2 + .025))], N[5])
      }
    }
    box(body, x, y + rise - .04, z, .2, .16, depth * (hip ? .56 : 1.02), detail)
  }

  // The house and porch travel together on a masonry raft; garden beds stay on the lot.
  box(body, 0, 0, 1, 20, .35, 20, N[4])
  box(body, 0, .35, 0, 18, .55, 15, detail)
  box(body, 0, .9, 0, 18, 3.8, 15, wall)
  box(body, 0, 4.65, 0, 18.8, .25, 15.8, trim)
  // Three workshop bays give the timber conversion its own industrial silhouette.
  if (variant === 2) for (const x of [-6.4, 0, 6.4]) roof(x, 4.9, 0, 6.5, 16.5, 2.25)
  else roof(0, 4.9, 0, 19.4, 16.5, 3.3, variant === 1)
  if (variant !== 1) {
    box(body, 0, 5.5, 8.28, 1.65, 1.05, .1, trim)
    box(body, 0, 5.63, 8.35, 1.36, .79, .04, N[1])
    for (let y = 5.72; y < 6.4; y += .17) box(body, 0, y, 8.4, 1.3, .045, .04, detail)
  }
  // Corner quoins and a low masonry course give the wall a readable scale.
  for (const x of [-8.85, 8.85]) for (const z of [-7.4, 7.4]) {
    box(body, x, .9, z, .32, 3.75, .32, trim)
  }
  for (let y = 1.05; y < 4.6; y += .55) {
    box(body, 0, y, 7.51, 17.5, .028, .025, N[5], false)
    box(body, 9.01, y, 0, .025, .028, 14.6, N[5], false)
  }
  // A chimney with a cap and dark flues breaks the large roof silhouette.
  box(body, 5.5, 4.4, -3.8, 1.3, 3.8, 1.3, W[1])
  for (let y = 5; y < 8.15; y += .38) box(body, 5.5, y, -3.8, 1.34, .04, 1.34, W[2])
  box(body, 5.5, 8.15, -3.8, 1.7, .22, 1.7, N[5])
  for (const x of [5.2, 5.8]) cylinder(body, x, 8.37, -3.8, .22, .45, W[2])

  const porchStart = body.children.length
  // A deep, supported porch: doors, steps and lamps make the frontage unmistakable.
  box(body, 0, .35, 9, 6.3, .22, 3.7, N[6])
  for (const [z, y, width] of [[11.1, .08, 3.4], [10.65, .24, 2.9]]) box(body, 0, y, z, width, .15, .65, N[6])
  for (const x of [-2.7, 2.7]) {
    box(body, x, .57, 10.25, .24, 2.8, .24, trim)
    box(body, x, .57, 10.25, .5, .3, .5, N[5])
  }
  const canopyStart = body.children.length
  roof(0, 3.37, 9.2, 6.4, 3.3, 1.35)
  const canopy = body.children.slice(canopyStart)
  box(body, 0, .9, 7.6, 1.65, 2.45, .18, W[0])
  box(body, 0, 1.1, 7.71, 1.25, 1.25, .05, W[2])
  box(body, 0, 2.6, 7.71, 1.05, .5, .05, N[2])
  sphere(body, .5, 2, 7.78, .07, RAMPS.WARN[2])
  for (const x of [-1.45, 1.45]) {
    box(body, x, 2.1, 7.7, .32, .55, .25, N[1])
    box(body, x, 2.2, 7.85, .2, .32, .08, RAMPS.WARN[3], false).material = sharedMaterial('city:porch-lamp', () => new T.MeshBasicMaterial({ color: RAMPS.WARN[3] }))
  }

  // Coffee on the porch and a noticeboard make this a studio someone has moved into.
  box(body, -5.8, .38, 9.4, 3.1, .5, .75, W[1])
  box(body, -5.8, .9, 9.65, 3.1, .65, .15, W[2])
  for (const x of [-7.2, -4.4]) box(body, x, .8, 9.4, .12, .4, .8, W[2])
  cylinder(body, 5.8, .35, 9.4, .6, .1, N[2])
  cylinder(body, 5.8, .45, 9.4, .07, .75, N[3])
  cylinder(body, 5.8, 1.2, 9.4, .9, .08, W[3])
  for (const x of [4.4, 7.2]) {
    box(body, x, .35, 9.4, .65, .55, .65, N[3])
    box(body, x, .9, 9.7, .65, .55, .1, N[4])
  }
  const porch = new T.Group()
  porch.userData.dynamic = true
  for (const piece of body.children.slice(porchStart)) porch.add(piece)
  body.add(porch)
  const windowGeometry = new T.BoxGeometry(1, 1, 1)
  const windowMaterial = new T.MeshBasicMaterial({ color: RAMPS.WARN[3] })
  const windows = new T.InstancedMesh(windowGeometry, windowMaterial, HOUSE_CAPACITY)
  windows.userData.dynamic = true
  let pane = 0
  for (let win = 0; win < 5; win++) for (let face = 0; face < 4; face++) {
    // Interleave front/side/back lights so partially occupied houses still read from every approach.
    const side = face % 2 === 1, sign = face < 2 ? 1 : -1
    const along = (win - 2) * 3.2
    const centre = face === 0 && win === 2 ? 4 : 2.75
    const height = face === 0 && win === 2 ? .65 : 1.45
    const facade = side ? 9 : 7.5
    const at = (offset: number, outward: number) => new T.Vector3(side ? sign * (facade + outward) : along + offset, centre,
      side ? along + offset : sign * (facade + outward))
    const frame = at(0, .05)
    box(body, frame.x, centre - height / 2 - .12, frame.z, side ? .15 : 2.04, height + .24, side ? 2.04 : .15, trim)
    const glass = at(0, .14)
    box(body, glass.x, centre - height / 2, glass.z, side ? .035 : 1.78, height, side ? 1.78 : .035, N[1])
    const sill = at(0, .2)
    box(body, sill.x, centre - height / 2 - .2, sill.z, side ? .4 : 2.25, .12, side ? 2.25 : .4, trim)
    for (let p = 0; p < 5; p++) {
      const pos = at((p - 2) * .34, .17)
      windows.setMatrixAt(pane++, new T.Matrix4().compose(pos, new T.Quaternion(), new T.Vector3(side ? .025 : .27, height - .16, side ? .27 : .025)))
    }
    // Closed shutters frame each front window; the entrance's transom stays clear.
    if (face === 0 && win !== 2) for (const offset of [-1.25, 1.25]) {
      box(body, along + offset, centre - height / 2, 7.65, .37, height, .16, detail)
    }
  }
  body.add(windows)
  body.traverse(o => {
    if (!(o instanceof T.Mesh) || !(o.material instanceof T.MeshStandardMaterial)) return
    const source = o.material
    o.material = sharedMaterial(`city:house:${source.uuid}`, () => {
      const lit = source.clone(); lit.emissive.copy(source.color); lit.emissiveIntensity = .3
      return lit
    })
  })
  batchArt(body)
  const exterior = body
  const whole = new T.Group(); whole.add(exterior, porch); whole.scale.set(1.25, 1, 1.25)
  let interior: ReturnType<typeof createCityInterior> | null = null
  let filled = 0
  return {
    body: whole, exterior, windows,
    get interior() { return interior },
    fill(n: number) { filled = n; windows.count = n; interior?.fill(n) },
    cutaway(on: boolean) {
      if (on && !interior) { interior = createCityInterior(index, cast()); interior.fill(filled); whole.add(interior.root) }
      const changed = exterior.visible === on
      exterior.visible = !on
      canopy.forEach(piece => { piece.visible = !on })
      if (interior) interior.root.visible = on
      return changed
    },
    dispose() { disposeArt(exterior); disposeArt(porch); interior?.dispose(); windowGeometry.dispose(); windowMaterial.dispose() },
  }
}

/** Low garden details belong to the block, outside the descending raft's clearance. */
export function dressCityLot(parent: T.Group, x: number, z: number) {
  const lot = new T.Group(); lot.position.set(x, -.3, z); parent.add(lot)
  box(lot, 0, 0, 14.5, 3.2, .025, 2, N[4], false)
  for (const side of [-1, 1]) {
    box(lot, side * 13.5, .02, 8, 1.4, .3, 8, W[0])
    for (let i = 0; i < 5; i++) {
      const bush = sphere(lot, side * 13.5, .75, 5 + i * 1.5, .8, F[i % 2], true)
      bush.scale.y = .7
    }
    cylinder(lot, side * 13.5, .05, -13.6, .2, 2.7, W[1])
    for (let k = 0; k < 7; k++) {
      const angle = k * 2.4
      sphere(lot, side * 13.5 + Math.cos(angle) * .65, 2.8 + (k % 3) * .55, -13.6 + Math.sin(angle) * .65, .8, F[k % 2], true)
    }
    box(lot, side * 14.7, 0, 0, .22, .6, 28, N[3])
    for (let z = -12; z <= 12; z += 3) box(lot, side * 14.7, .6, z, .32, .45, .32, N[4])
  }
  batchArt(lot)
  return lot
}
