import * as T from 'three'
import { RAMPS } from '../../art/palette.ts'
import { box, cylinder, sphere, batchArt, disposeArt, sharedMaterial } from './worldArt.ts'
import { HOUSE_CAPACITY } from './cityGrid.ts'
import { createCityInterior } from './cityInterior.ts'
import type { StudioCast } from './studioPeople.ts'

const N = RAMPS.NEUTRAL, W = RAMPS.WOOD, F = RAMPS.FOLIAGE, G = RAMPS.GLOW

/** One hundred people, three small office campuses. Shared geometry is also the
 * district's art, so a roof terrace remains a terrace at the next scale. */
export function createCityHouse(index: number, cast: () => StudioCast) {
  const body = new T.Group()
  const variant = index % 3
  const wall = [N[6], N[4], N[5]][variant], trim = N[6]
  box(body,0,0,1,20,.35,20,N[4])
  box(body,0,.35,0,18,.55,15,N[2])
  box(body,0,.9,0,18,3.8,15,wall)
  // Recessed glazing, concrete floor bands and slender mullions read as an
  // office facade. Domestic gables, chimneys and shutters were reading as sheds.
  for(const z of [-7.52,7.52]) {
    box(body,0,3.55,z,17.7,.8,.08,G[0])
    box(body,0,3.45,z,18,.12,.22,N[2])
    for(let x=-8;x<=8;x+=1.6)box(body,x,3.52,z,.09,.87,.18,N[5])
  }
  for(const x of [-9.02,9.02]) {
    box(body,x,3.55,0,.08,.8,14.8,G[0])
    for(let z=-6.4;z<=6.4;z+=1.6)box(body,x,3.52,z,.18,.87,.09,N[5])
  }
  box(body,0,4.65,0,18.8,.32,15.8,N[5])
  box(body,0,4.97,0,18.3,.12,15.3,N[2])
  for(const z of [-7.6,7.6])box(body,0,5.09,z,18.6,.48,.22,N[4])
  for(const x of [-9.2,9.2])box(body,x,5.09,0,.22,.48,15.2,N[4])
  function planter(x:number,z:number,w:number,d:number) {
    box(body,x,5.1,z,w,.45,d,N[3]);box(body,x,5.55,z,w-.2,.22,d-.2,F[1])
  }
  function solar(x:number,z:number,rows:number) {
    for(let row=0;row<rows;row++)for(let col=0;col<3;col++) {
      box(body,x+col*1.8,5.15,z+row*1.25,1.65,.12,1.1,N[5])
      const panel=box(body,x+col*1.8,5.29,z+row*1.25,1.5,.07,1,G[0]);panel.rotation.x=-.16
      box(body,x+col*1.8,5.36,z+row*1.25,.045,.02,1,N[4])
    }
  }
  if(variant===0) {
    // Courtyard studio: sunken roof garden, clerestory and a shaded terrace.
    planter(-5,-3.8,4.5,4.2);planter(5.8,4.8,3.5,1.6)
    box(body,1,5.1,-2.8,6,.8,4,N[4]);box(body,1,5.9,-2.8,5.7,.18,3.7,G[0])
    for(let x=-1.5;x<=3.5;x++)box(body,x,6.1,-2.8,.06,.08,3.7,N[5])
    for(const x of [-6.8,-2.2])for(const z of [1.8,5.7])box(body,x,5.1,z,.13,1.8,.13,W[1])
    for(let x=-7;x<=-2;x+=.65)box(body,x,6.9,3.8,.22,.12,4.4,W[2])
    box(body,-4.5,5.1,4.5,3,.6,.7,W[2]);solar(3.2,-6,2)
  } else if(variant===1) {
    // Research office: a stepped rooftop meeting room and a solar field.
    box(body,-3,5.1,-2.7,9,2.2,6.5,N[5])
    box(body,-3,5.6,.59,8.4,1.3,.06,G[0])
    for(let x=-6.8;x<1.1;x+=1.3)box(body,x,5.55,.66,.1,1.4,.1,N[3])
    box(body,-3,7.3,-2.7,9.6,.25,7,N[3]);solar(3.4,-5,4)
    planter(-6,4.8,4,1.8);box(body,-.5,5.1,4.5,4,.65,.7,W[2])
  } else {
    // Engineering studio: long glass atrium with copper fins, green roof wings.
    box(body,0,5.1,-.6,4,1.3,12,N[4]);box(body,0,6.4,-.6,3.8,.15,11.8,G[0])
    for(let z=-6;z<=5;z+=1.4)box(body,0,6.58,z,4.2,.15,.1,W[2])
    planter(-6,-2,3.2,8);solar(4,-5,3)
    for(const x of [-6,6])box(body,x,5.1,5.5,3,.6,.65,W[2])
  }
  // A narrow vertical service core breaks each silhouette at district scale.
  box(body,-8,1, -6.5,1.1,5.1,1.3,variant===1?W[1]:N[3])

  const porchStart = body.children.length
  // A deep, supported porch: doors, steps and lamps make the frontage unmistakable.
  box(body, 0, .35, 9, 6.3, .22, 3.7, N[6])
  for (const [z, y, width] of [[11.1, .08, 3.4], [10.65, .24, 2.9]]) box(body, 0, y, z, width, .15, .65, N[6])
  for (const x of [-2.7, 2.7]) {
    box(body, x, .57, 10.25, .24, 2.8, .24, trim)
    box(body, x, .57, 10.25, .5, .3, .5, N[5])
  }
  const canopyStart = body.children.length
  box(body,0,3.65,9.2,6.4,.18,3.8,N[5])
  box(body,0,3.83,9.2,5.8,.04,3.2,G[0])
  const canopy = body.children.slice(canopyStart)
  box(body, 0, .9, 7.6, 2.1, 2.45, .18, N[2])
  box(body, 0, 1.1, 7.71, 1.8, 1.65, .05, G[0])
  box(body, 0, 2.6, 7.71, 1.8, .45, .05, G[0])
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
