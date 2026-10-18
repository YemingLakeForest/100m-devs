import * as T from 'three'
import { RAMPS } from '../../art/palette.ts'
import { batchArt, box, disposeArt, placeInstances, sharedMaterial, showSeatInstances, type SeatInstance } from './worldArt.ts'
import { studioPerson, workerLook, type StudioCast } from './studioPeople.ts'
import { FRONT_FRAME, frontGlazing } from './garageDetails.ts'

/** A hundred compact stations on one floor, with a centre aisle and cross aisles between the islands. */
export function houseSeat(i: number) {
  const col = i % 10, row = Math.floor(i / 10)
  return { y: 0, x: (col - 4.5) * 1.44 + (Math.floor(col / 2) - 2) * .22 + (col < 5 ? -.4 : .4), z: (Math.floor(row / 2) - 2) * 2.5 + (row % 2 ? .8 : -.8) }
}

/** A hire falls this far, in this long, onto the desk it was given: the garage's drop (`garageView.ts`), at a house's scale. */
const DROP_HEIGHT = 3.4
const DROP_SECONDS = .45
/** A batch of hires lands a beat apart, as the garage's does; the rest of a very large batch is simply there. */
const DROP_STAGGER = .12
const MAX_DROPS = 12

/**
 * `reserved` is how many of this house's first seats belong to somebody else — the garage's twenty, in the first house of the
 * first city (`cityHouses.ts`). Their people are never shown and their desks are never built, so the new space does not open
 * with two empty rows at the back that are really the garage's.
 */
export function createCityInterior(index: number, cast: StudioCast, reserved = 0) {
  const root = new T.Group()
  const N = RAMPS.NEUTRAL, W = RAMPS.WOOD
  /*
   * **One floor, open to the sky, and nothing across it** [2026-10-18, at the user's instruction: *"I am not a big fan of
   * those offices outside our HQ ... I specially hate those beams across, they are very questionable"*]. The cutaway had
   * two timber beams spanning the room at eave height, carrying four pendant lamps; with the ceiling and the near walls
   * cut away they ran from the far wall into thin air, and from the game's camera they were two brown rails ruled
   * diagonally through the desks. Under them was a split level: forty desks on a 1.5 m deck, a stair up its middle and
   * handrails — a lecture theatre seen from above, with a brown cliff face across the room. All of it is gone. A
   * dollhouse with its lid off has no ceiling to hang a lamp from; the warm pools are baked into the materials below and
   * need no fixture to explain them.
   */
  box(root, 0, 0, 1, 20, .35, 20, N[4])
  box(root, 0, .35, 0, 18, .04, 15, W[1])
  for (let x = -8; x < 9; x += .55) box(root, x, .392, 0, .018, .012, 14.6, W[0], false)
  // Twenty-five four-person islands, alternating woven mats rather than a parade of rows.
  for (let pair = 0; pair < 5; pair++) for (let col = 0; col < 5; col++) {
    if (pair * 20 + col * 2 + 1 < reserved) continue
    const left = houseSeat(pair * 20 + col * 2), right = houseSeat(pair * 20 + col * 2 + 1)
    box(root, (left.x + right.x) / 2, .397, (pair - 2) * 2.5, 3, .018, 2.3, (col + pair) % 2 ? N[3] : W[0], false)
  }
  /*
   * **The walls are the garage's walls** (`garageEnvironment.ts`): the two the camera sees the inside of stand the full
   * height, and the two that face it are a low base under glass in graphite frames, with a head along the top. The
   * near side was a 0.45 m kerb — the "unfinished" low perimeter the user already turned down in the garage (§7.8.12) —
   * and the porch's door stood up out of it on its own. The far walls had five small framed holes each, staggered for a
   * deck that is gone; they are one ribbon window now, the band of light the house shows from the street.
   */
  const H = 4.1, BASE = 1.05, FLOOR = .39
  box(root, 0, FLOOR, -7.45, 18, H, .16, N[6])
  box(root, -8.95, FLOOR, 0, .16, H, 15, N[6])
  box(root, 0, FLOOR + H, -7.45, 18.2, .1, .3, N[5])
  box(root, -8.95, FLOOR + H, 0, .3, .1, 15, N[5])
  // A sill, a dark band of glass and a mullion every 1.6 m — the exterior's rhythm (`cityHouse.ts`), from the inside.
  const ribbon = (along: 'x' | 'z', from: number, to: number) => {
    const piece = (u: number, y: number, w: number, h: number, d: number, colour: string) => along === 'x'
      ? box(root, u, y, -7.33, w, h, d, colour) : box(root, -8.83, y, u, d, h, w, colour)
    const mid = (from + to) / 2, len = to - from, bays = Math.round(len / 1.6)
    piece(mid, FLOOR + 1.75, len + .2, .1, .22, N[5])
    piece(mid, FLOOR + 1.85, len, 1.45, .04, N[2])
    for (let j = 0; j <= bays; j++) piece(from + len * j / bays, FLOOR + 1.85, .09, 1.45, .1, N[5])
  }
  ribbon('x', -8, 8)
  ribbon('z', -6.9, 1.4)
  const front: { a: [number, number]; b: [number, number] }[] = [
    { a: [-9, 7.45], b: [-1.15, 7.45] }, { a: [1.15, 7.45], b: [9, 7.45] }, { a: [8.95, -7.5], b: [8.95, 7.5] },
  ]
  const panes: T.Mesh[] = []
  for (const { a, b } of front) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), alongX = a[1] === b[1]
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2
    const dims = (w: number, h: number, d: number) => alongX ? [w, h, d] as const : [d, h, w] as const
    box(root, mx, FLOOR, mz, ...dims(len, BASE, .2), N[6])
    box(root, mx, FLOOR + BASE, mz, ...dims(len + .02, .07, .3), N[5])
    panes.push(box(root, mx, FLOOR + BASE + .07, mz, ...dims(len, H - BASE - .07, .05), N[6], false))
    const bays = Math.ceil(len / 3.2)
    for (let j = 0; j <= bays; j++) {
      const t = j / bays
      box(root, a[0] + (b[0] - a[0]) * t, FLOOR + BASE + .07, a[1] + (b[1] - a[1]) * t, ...dims(.08, H - BASE - .07, .12), FRONT_FRAME)
    }
  }
  // The doorway: the porch's door (`cityHouse.ts`) stands in this gap, between two jambs, under a transom of the same glass.
  for (const x of [-1.15, 1.15]) box(root, x, FLOOR, 7.45, .12, H, .34, FRONT_FRAME)
  panes.push(box(root, 0, FLOOR + 2.96, 7.45, 2.18, H - 2.96, .05, N[6], false))
  box(root, 0, FLOOR + H, 7.45, 18.1, .09, .14, FRONT_FRAME)
  box(root, 8.95, FLOOR + H, 0, .14, .09, 15.1, FRONT_FRAME)
  /*
   * **The garage's twenty are a break area here** [2026-10-18]. The first house's back two rows are the garage's seats
   * and are never filled (2026-10-15), so with the deck gone they were a bare strip of floor that looked like a bug.
   * Three big pieces fill it: a kitchen counter on the back wall, a ping-pong table, a sofa — all behind the third row.
   */
  if (reserved >= 20) {
    box(root, -4.2, FLOOR, -6.98, 7, .88, .7, N[5])
    box(root, -4.2, FLOOR + .88, -6.98, 7.1, .06, .76, W[3])
    box(root, -6.8, FLOOR + .94, -7.05, .45, .5, .4, N[1])
    box(root, 4, FLOOR, -5.7, .12, .7, 1.2, N[2])
    box(root, 4, FLOOR + .7, -5.7, 2.74, .06, 1.52, RAMPS.FOLIAGE[1])
    box(root, 4, FLOOR + .76, -5.7, .04, .15, 1.6, N[7])
    box(root, -4.2, FLOOR, -5.0, 2.6, .42, .8, N[3])
    box(root, -4.2, FLOOR, -4.7, 2.6, .85, .22, N[3])
    for (const x of [-5.6, -2.8]) box(root, x, FLOOR, -5.0, .22, .6, .8, N[3])
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
    if (i >= reserved) {
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
    }
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
  // The garage's own storefront glass, so the two buildings are glazed alike; set after the bake, which would light it.
  for (const pane of panes) pane.material = frontGlazing()
  batchArt(furniture); batchArt(peopleRoot, seats)
  let filled = -1
  /** `again`: hops still to come after this one — a hire's cheer is two. */
  const hopping = new Map<number, { started: number; mild: boolean; again?: number }>()
  /** A hire has hit their desk: the islands around it hop in a ripple out from it, and the hire hops twice once settled (`garageView.welcome`). */
  const welcome = (i: number, now: number) => {
    const at = houseSeat(i)
    people
      .map((_, j) => ({ j, d: Math.hypot(houseSeat(j).x - at.x, houseSeat(j).z - at.z) }))
      .filter(n => n.j !== i && people[n.j].visible && !dropping.has(n.j) && n.d < 4.5)
      .sort((a, b) => a.d - b.d).slice(0, 8)
      .forEach(n => hopping.set(n.j, { started: now + .05 + n.d * .06, mild: false }))
    // The bounce runs to u = 1.5 (.225 s after contact); the cheer starts once it has.
    hopping.set(i, { started: now + .26, mild: false, again: 1 })
  }
  /** A hire on its way down: hidden until `started`, then falling. `landed` is so the sound is made once. */
  const dropping = new Map<number, { started: number; landed: boolean }>()
  let landings = 0
  const identity = new T.Matrix4()
  const lift = (i: number, y: number) => {
    const at = houseSeat(i)
    placeInstances(seats.get(i) ?? [], y ? new T.Matrix4().makeTranslation(0, y, 0) : identity)
    people[i].position.set(at.x, at.y + y, at.z)
  }
  return {
    root, targets,
    /**
     * Show seats `reserved..n-1`. With `arrive` (the clock, in seconds) the seats that are new since the last call fall in a
     * beat apart instead of appearing — the interior's half of a hire's drop. A first fill, and a house nobody is looking
     * into, pass nothing: whoever is here is simply here.
     */
    fill(n: number, arrive?: number) {
      if (n === filled) return
      const was = filled
      for (const i of hopping.keys()) if (i >= n) { lift(i, 0); hopping.delete(i) }
      for (const i of dropping.keys()) if (i >= n) { lift(i, 0); dropping.delete(i) }
      filled = n
      people.forEach((person, i) => { const on = i >= reserved && i < n; showSeatInstances(seats.get(i) ?? [], on); person.visible = on; targets[i].visible = on })
      if (arrive === undefined || was < 0 || n <= was) return
      for (let i = Math.max(was, reserved), k = 0; i < n && k < MAX_DROPS; i++, k++) {
        // Hidden until its turn: the instance is switched off now and switched on by the first frame of its fall.
        showSeatInstances(seats.get(i) ?? [], false)
        dropping.set(i, { started: arrive + k * DROP_STAGGER, landed: false })
      }
    },
    /** How many hires have hit a desk since this was last asked. */
    takeLandings() { const n = landings; landings = 0; return n },
    hop(seat: number, now: number, mild = false) {
      const i = seat % 100
      if (mild && hopping.has(i)) return
      hopping.set(i, { started: now, mild })
    },
    update(now: number) {
      const active=hopping.size>0||dropping.size>0
      for (const [i, d] of dropping) {
        const u = (now - d.started) / DROP_SECONDS
        if (u < 0) continue
        // Free fall, one bounce, rest: the garage's arrival (`garageView.ts`), so the two rooms drop alike.
        lift(i, u < 1 ? DROP_HEIGHT * (1 - u * u) : u < 1.5 ? .32 * Math.sin(Math.PI * (u - 1) / .5) : 0)
        if (u >= 1 && !d.landed) { d.landed = true; landings += 1; welcome(i, now) }
        if (u >= 1.5) dropping.delete(i)
      }
      for(const [i,{ started, mild, again }] of hopping) {
        const t=now-started,at=houseSeat(i),u=Math.max(0,Math.min(1,(t-.05)/.3))
        // Not yet: a hop queued behind a ripple or a landing must not pin the seat to the floor while it waits.
        if(t<0)continue
        // A working hop is .26 m against a click's .38 (2026-10-18: *"hophophop when coding"*; it was .08).
        const y=t<.35?(mild ? .26 : .38)*4*u*(1-u):0
        placeInstances(seats.get(i)??[],y?new T.Matrix4().makeTranslation(0,y,0):identity)
        people[i].position.set(at.x,at.y+y,at.z)
        if(t>=.45){if(again)hopping.set(i,{started:now+.05,mild,again:again-1});else hopping.delete(i)}
      }
      return active
    },
    headOf(seat: number) { const at = houseSeat(seat % 100); return root.localToWorld(new T.Vector3(at.x, 1.7 + at.y, at.z)) },
    dispose() { disposeArt(root); hitGeometry.dispose(); hitMaterial.dispose() },
  }
}
