import * as T from 'three'
import { RAMPS } from '../../art/palette.ts'
import { batchArt, box, cylinder, disposeArt, placeInstances, sharedMaterial, showSeatInstances, type SeatInstance } from './worldArt.ts'
import { studioPerson, workerLook, type StudioCast } from './studioPeople.ts'

/** A hundred compact stations with two cross aisles, inside one converted house. */
export function houseSeat(i: number) {
  const col = i % 10, row = Math.floor(i / 10)
  return { y: row < 4 ? 1.5 : 0, x: (col - 4.5) * 1.44 + (Math.floor(col / 2) - 2) * .22 + (col < 5 ? -.4 : .4), z: (Math.floor(row / 2) - 2) * 2.5 + (row % 2 ? .8 : -.8) }
}

export function createCityInterior(index: number, cast: StudioCast) {
  const root = new T.Group()
  const N = RAMPS.NEUTRAL, W = RAMPS.WOOD
  box(root, 0, 0, 1, 20, .35, 20, N[4])
  box(root, 0, .35, 0, 18, .04, 15, W[1])
  // A split-level conversion: forty desks on the old rear workshop's raised floor.
  for (const x of [-4.65, 4.65]) box(root, x, .39, -4.35, 8.5, 1.5, 6.3, W[1])
  box(root, 0, .39, -4.9, .8, 1.5, 5, W[1])
  for (let step = 0; step < 10; step++) box(root, 0, .39, .9 - step * .35, .76, (step + 1) * .15, .36, W[2])
  for (const x of [-.48, .48]) for (let step = 0; step < 10; step += 3) {
    box(root, x, .39 + (step + 1) * .15, .9 - step * .35, .055, .7, .055, N[3])
  }
  // Twenty-five four-person islands, alternating woven mats rather than a parade of rows.
  for (let pair = 0; pair < 5; pair++) for (let col = 0; col < 5; col++) {
    const left = houseSeat(pair * 20 + col * 2), right = houseSeat(pair * 20 + col * 2 + 1)
    box(root, (left.x + right.x) / 2, .397 + left.y, (pair - 2) * 2.5, 3, .018, 2.3, (col + pair) % 2 ? N[3] : W[0], false)
  }
  // Only the far walls stand tall. The near parapets preserve the house boundary.
  box(root, 0, .39, -7.45, 18, 4.1, .16, N[6])
  box(root, -8.95, .39, 0, .16, 4.1, 15, N[6])
  box(root, 0, .39, 7.45, 18, .45, .16, N[6])
  box(root, 8.95, .39, 0, .16, .45, 15, N[6])
  for (let x = -8; x < 9; x += .55) {
    box(root, x, .392, 3.1, .018, .012, 8.5, W[0], false)
    box(root, x, 1.892, -4.4, .018, .012, 6.1, W[0], false)
  }
  for (const x of [-6.4, -3.2, 0, 3.2, 6.4]) {
    box(root, x, 2.8, -7.33, 2.05, 1.25, .12, N[7])
    box(root, x, 2.93, -7.24, 1.79, .99, .04, N[2])
    box(root, x, 2.93, -7.19, .055, .99, .04, N[6])
    box(root, -8.82, 1.3 + (x < -1.25 ? 1.5 : 0), x, .12, 1.25, 2.05, N[7])
    box(root, -8.73, 1.43 + (x < -1.25 ? 1.5 : 0), x, .04, .99, 1.79, N[2])
  }
  box(root, 0, 4.45, -7.4, 18, .18, .3, W[1])
  box(root, -8.9, 4.45, 0, .3, .18, 15, W[1])
  const lampFinish = sharedMaterial('city:work-lamp', () => new T.MeshBasicMaterial({ color: RAMPS.WARN[3] }))
  for (const z of [-4.5, 3.5]) {
    box(root, 0, 4.45, z, 18, .2, .18, W[1])
    for (const x of [-4.5, 4.5]) {
      cylinder(root, x, 3.85, z, .025, .6, N[2])
      cylinder(root, x, 3.77, z, .25, .12, N[3])
      cylinder(root, x, 3.73, z, .2, .04, RAMPS.WARN[3]).material = lampFinish
    }
  }
  // The domestic wall has become the team's planning board, above chair height.
  box(root, -8.78, 2.5, 3.2, .12, 1.3, 2.5, W[1])
  box(root, -8.69, 2.59, 3.2, .04, 1.12, 2.3, N[7])
  for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) {
    box(root, -8.65, 2.72 + row * .27, 2.4 + col * .5, .015, .18, .28,
      col === 3 ? RAMPS.GLOW[1] : W[3], false)
  }
  const furniture = new T.Group(); furniture.position.y = .39; root.add(furniture)
  const peopleRoot = new T.Group(); peopleRoot.position.y = .39; root.add(peopleRoot)
  const people: T.Group[] = []
  const seats = new Map<number, SeatInstance[]>()
  const hitGeometry = new T.BoxGeometry(.6, 1.4, .65)
  const hitMaterial = new T.MeshBasicMaterial({ visible: false })
  const targets: T.Mesh[] = []
  const screen = sharedMaterial('city:desk-screen', () => new T.MeshBasicMaterial({ color: RAMPS.GLOW[1] }))
  for (let i = 0; i < 100; i++) {
    const at = houseSeat(i)
    const desk = new T.Group(); desk.position.set(at.x, at.y, at.z); furniture.add(desk)
    desk.rotation.y = Math.floor(i / 10) % 2 ? Math.PI : 0
    // Compact house desks, with the same head-and-body developers as the garage.
    box(desk, 0, .56, .46, 1.14, .08, .6, W[3])
    for (const x of [-.47, .47]) box(desk, x, 0, .46, .075, .56, .075, W[1])
    box(desk, 0, .64, .58, .4, .34, .06, N[1])
    box(desk, 0, .68, .543, .34, .25, .014, RAMPS.GLOW[1], false).material = screen
    box(desk, 0, .642, .26, .4, .025, .16, N[5])
    box(desk, 0, .32, -.08, .46, .09, .4, N[2])
    box(desk, 0, .4, -.25, .46, .42, .075, N[3])
    const person = studioPerson(peopleRoot, at.x, at.z, Math.floor(i / 10) % 2 ? 0 : Math.PI, workerLook(cast, index * 100 + i))
    person.position.y = at.y
    person.scale.setScalar(.8)
    person.userData.dynamic = false; person.userData.seat = i
    people.push(person)
    const hit = new T.Mesh(hitGeometry, hitMaterial)
    hit.position.set(at.x, 1.1 + at.y, at.z); hit.userData.seat = index * 100 + i
    root.add(hit); targets.push(hit)
  }
  root.updateMatrixWorld(true)
  root.traverse(o => {
    if (!(o instanceof T.Mesh) || !(o.material instanceof T.MeshStandardMaterial)) return
    const source = o.material
    const at = o.getWorldPosition(new T.Vector3())
    const distance = Math.min(...[-4.5, 4.5].flatMap(x => [-4.5, 3.5].map(z => (at.x - x) ** 2 + (at.z - z) ** 2)))
    const pool = Math.round(2 * Math.exp(-distance / 10))
    o.material = sharedMaterial(`city:inside:${source.uuid}:${pool}`, () => {
      const lit = source.clone()
      // Baked pools keep a hundred desks warm without adding a hundred GPU lights.
      lit.emissive.copy(source.color).multiply(new T.Color(1, .82, .58))
      lit.emissiveIntensity = .24 + pool * .27
      return lit
    })
  })
  batchArt(furniture); batchArt(peopleRoot, seats)
  let filled = -1
  const hopping = new Map<number, number>()
  const identity = new T.Matrix4()
  return {
    root, targets,
    fill(n: number) {
      if (n === filled) return
      for(const i of hopping.keys())if(i>=n){placeInstances(seats.get(i)??[],identity);const at=houseSeat(i);people[i].position.set(at.x,at.y,at.z);hopping.delete(i)}
      filled = n
      people.forEach((person, i) => { showSeatInstances(seats.get(i) ?? [], i < n); person.visible = i < n; targets[i].visible = i < n })
    },
    hop(seat: number, now: number) { hopping.set(seat % 100, now) },
    update(now: number) {
      const active=hopping.size>0
      for(const [i,started] of hopping) {
        const t=now-started,at=houseSeat(i),u=Math.max(0,Math.min(1,(t-.05)/.3))
        const y=t<.35?.38*4*u*(1-u):0
        placeInstances(seats.get(i)??[],y?new T.Matrix4().makeTranslation(0,y,0):identity)
        people[i].position.set(at.x,at.y+y,at.z)
        if(t>=.45)hopping.delete(i)
      }
      return active
    },
    headOf(seat: number) { const at = houseSeat(seat % 100); return root.localToWorld(new T.Vector3(at.x, 1.7 + at.y, at.z)) },
    dispose() { disposeArt(root); hitGeometry.dispose(); hitMaterial.dispose() },
  }
}
