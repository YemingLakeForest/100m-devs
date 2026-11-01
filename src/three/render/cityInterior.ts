import * as T from 'three'
import { RAMPS } from '../../art/palette.ts'
import { batchArt, box, disposeArt, placeInstances, sharedMaterial, showSeatInstances, type SeatInstance } from './worldArt.ts'
import { studioPerson, workerLook, type StudioCast } from './studioPeople.ts'

/** The tile's people and furniture are built at this scale of the metres below (the house's old 1.25, kept: a developer is the garage's size). */
export const INTERIOR_SCALE = 1.25
/**
 * A hundred compact stations on one floor, in twenty-five islands of four (two desks wide, two rows deep, the rows facing).
 *
 * **The islands are spread across the tile** [2026-11-01, at the user's instruction: *"I want the entire place as one big office"*].
 * They stood 3.1 x 2.5 m apart inside a walled house with a ten-metre street round it; the tile has no street, and islands left
 * that close would sit as a block in the middle of a 33 x 25 m carpet, which is a house again. They are 5.0 x 3.2 m apart now
 * (6.3 x 4.0 m on the floor), so the aisles between them are a person wide and the desks reach the strips of rooms along the
 * tile's north and south edges. The islands are all the same width: the centre one is no longer wider, because there is no
 * wall for it to be the centre of.
 */
export function houseSeat(i: number) {
  const col = i % 10, row = Math.floor(i / 10)
  return { y: 0, x: (Math.floor(col / 2) - 2) * 5.0 + (col % 2 ? .72 : -.72), z: (Math.floor(row / 2) - 2) * 3.2 + (row % 2 ? .8 : -.8) }
}

/** A hire falls this far, in this long, onto the desk it was given: the garage's drop (`garageView.ts`), at a house's scale. */
const DROP_HEIGHT = 3.4
const DROP_SECONDS = .45
/** A batch of hires lands a beat apart, as the garage's does; the rest of a very large batch is simply there. */
const DROP_STAGGER = .12
const MAX_DROPS = 12
/**
 * **The desk arrives with its developer** [2026-10-18, at the user's instruction: *"instead of the desk readily be there in the
 * office drop them as the same"*]. An office opened with all hundred desks already standing, so a hire was a person appearing
 * at furniture that had been waiting for them; the garage's hire is the desk falling in and then its developer on top
 * (`garageView.ts`, `HIRE_DROP`). The house does the same now, at the same beat: an empty seat is bare floor on its island's mat.
 */
const DESK_LEAD = .25
/**
 * **A layoff is the drop played backwards, with a gulp in front** [2026-10-19, at the user's instruction: *"I want some game
 * juice to show the layoff as well"*] — the garage's (`garageView.ts`, `GULP`), at a house's scale: a shiver where they sit,
 * then up and out through the open roof, their desk after them, while the islands around them flinch.
 */
const GULP = .42
const LIFT_HEIGHT = 16
const LIFT_SECONDS = .5
const DESK_LAG = .14

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
  /*
   * **The house's shell is gone** [2026-11-01, at the user's instruction: *"I want the entire place as one big office"*]. This was a
   * walled house: a slab, a wood floor, two full-height walls with a ribbon window, two glazed walls round a doorway, a planning
   * board on the domestic wall. A tile has the office's walls instead (`officeTile.ts`), on the outside of the open floor only,
   * and the carpet under it, so what is left here is what stands on the floor: the islands, their mats, the people, and the
   * garage's break area. The root's origin is the tile's centre and the carpet's top.
   */
  const FLOOR = 0
  // Twenty-five four-person islands, alternating woven mats rather than a parade of rows.
  for (let pair = 0; pair < 5; pair++) for (let col = 0; col < 5; col++) {
    if (pair * 20 + col * 2 + 1 < reserved) continue
    const left = houseSeat(pair * 20 + col * 2), right = houseSeat(pair * 20 + col * 2 + 1)
    box(root, (left.x + right.x) / 2, .008, (pair - 2) * 3.2, 3, .018, 2.3, (col + pair) % 2 ? N[3] : W[0], false)
  }
  /*
   * **The garage's twenty are a break area here** [2026-10-18]. The first tile's back row of islands is the garage's seats
   * and is never filled (2026-10-15), so it would be a bare strip of floor that looked like a bug. Three big pieces fill it:
   * a kitchen counter along the back, a ping-pong table, a sofa — all behind the second row.
   */
  if (reserved >= 20) {
    const back = -6.4   // the centre of the back pair of rows
    box(root, -4.2, FLOOR, back - 1.3, 7, .88, .7, N[5])
    box(root, -4.2, FLOOR + .88, back - 1.3, 7.1, .06, .76, W[3])
    box(root, -6.8, FLOOR + .94, back - 1.37, .45, .5, .4, N[1])
    box(root, 4, FLOOR, back + .2, .12, .7, 1.2, N[2])
    box(root, 4, FLOOR + .7, back + .2, 2.74, .06, 1.52, RAMPS.FOLIAGE[1])
    box(root, 4, FLOOR + .76, back + .2, .04, .15, 1.6, N[7])
    box(root, -4.2, FLOOR, back + 1, 2.6, .42, .8, N[3])
    box(root, -4.2, FLOOR, back + 1.3, 2.6, .85, .22, N[3])
    for (const x of [-5.6, -2.8]) box(root, x, FLOOR, back + 1, .22, .6, .8, N[3])
  }
  const furniture = new T.Group(); furniture.position.y = FLOOR; root.add(furniture)
  const peopleRoot = new T.Group(); peopleRoot.position.y = FLOOR; root.add(peopleRoot)
  const people: T.Group[] = []
  const seats = new Map<number, SeatInstance[]>()
  const desks = new Map<number, SeatInstance[]>()
  const hitGeometry = new T.BoxGeometry(.6, 1.4, .65)
  const hitMaterial = new T.MeshBasicMaterial({ visible: false })
  const targets: T.Mesh[] = []
  const screen = sharedMaterial('city:desk-screen', () => new T.MeshBasicMaterial({ color: RAMPS.GLOW[1] }))
  for (let i = 0; i < 100; i++) {
    const at = houseSeat(i)
    if (i >= reserved) {
      const desk = new T.Group(); desk.position.set(at.x, at.y, at.z); furniture.add(desk)
      desk.rotation.y = Math.floor(i / 10) % 2 ? Math.PI : 0
      desk.userData.seat = i
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
    const distance = Math.min(...[-5.5, 5.5].flatMap(x => [-4, 4].map(z => (at.x - x) ** 2 + (at.z - z) ** 2)))
    const pool = Math.round(2 * Math.exp(-distance / 10))
    o.material = sharedMaterial(`city:inside:${source.uuid}:${pool}`, () => {
      const lit = source.clone()
      // Baked pools keep a hundred desks warm without adding a hundred GPU lights.
      lit.emissive.copy(source.color).multiply(new T.Color(1, .82, .58))
      lit.emissiveIntensity = .24 + pool * .27
      return lit
    })
  })
  batchArt(furniture, desks); batchArt(peopleRoot, seats)
  let filled = -1
  /** `again`: hops still to come after this one — a hire's cheer is two. `duck`: a flinch where they sit, for a layoff next door. */
  const hopping = new Map<number, { started: number; mild: boolean; again?: number; duck?: boolean }>()
  /** A hire has hit their desk: the islands around it hop in a ripple out from it, and the hire hops twice once settled (`garageView.welcome`). */
  const welcome = (i: number, now: number) => {
    const at = houseSeat(i)
    people
      .map((_, j) => ({ j, d: Math.hypot(houseSeat(j).x - at.x, houseSeat(j).z - at.z) }))
      .filter(n => n.j !== i && people[n.j].visible && !dropping.has(n.j) && !leaving.has(n.j) && n.d < 4.5)
      .sort((a, b) => a.d - b.d).slice(0, 8)
      .forEach(n => hopping.set(n.j, { started: now + .05 + n.d * .06, mild: false }))
    // The bounce runs to u = 1.5 (.225 s after contact); the cheer starts once it has.
    hopping.set(i, { started: now + .26, mild: false, again: 1 })
  }
  /** A hire on its way down: desk then developer, each hidden until its turn. `deskLanded`/`landed` are so each sound is made once. */
  const dropping = new Map<number, { started: number; deskLanded: boolean; landed: boolean }>()
  let landings = 0, deskLandings = 0
  const identity = new T.Matrix4()
  const lift = (i: number, y: number) => {
    const at = houseSeat(i)
    placeInstances(seats.get(i) ?? [], y ? new T.Matrix4().makeTranslation(0, y, 0) : identity)
    people[i].position.set(at.x, at.y + y, at.z)
  }
  const liftDesk = (i: number, y: number) => placeInstances(desks.get(i) ?? [], y ? new T.Matrix4().makeTranslation(0, y, 0) : identity)
  /** A person raised by `y` and squashed by `s` about their own feet, volume kept: the gulp, the stretch and the flinch. */
  const pose = (i: number, y: number, s: number) => {
    const at = houseSeat(i), sxz = 1 / Math.sqrt(Math.max(.2, s))
    placeInstances(seats.get(i) ?? [], new T.Matrix4().makeTranslation(at.x, y, at.z)
      .multiply(new T.Matrix4().makeScale(sxz, s, sxz)).multiply(new T.Matrix4().makeTranslation(-at.x, 0, -at.z)))
    people[i].position.set(at.x, at.y + y, at.z)
    people[i].scale.set(.8 * sxz, .8 * s, .8 * sxz)
  }
  /** Laid off and on the way out; `gone` once the yank has begun, so the departure is told once. */
  const leaving = new Map<number, { started: number; gone: boolean }>()
  let departures = 0
  /** Somebody has been yanked out: the people around them duck, nearest first. */
  const flinch = (i: number, now: number) => {
    const at = houseSeat(i)
    people
      .map((_, j) => ({ j, d: Math.hypot(houseSeat(j).x - at.x, houseSeat(j).z - at.z) }))
      .filter(n => n.j !== i && people[n.j].visible && !dropping.has(n.j) && !leaving.has(n.j) && n.d < 4.5)
      .sort((a, b) => a.d - b.d).slice(0, 8)
      .forEach(n => hopping.set(n.j, { started: now + .04 + n.d * .05, mild: false, duck: true }))
  }
  /** Free fall, one bounce, rest: the garage's arrival (`garageView.ts`), so the two rooms drop alike. */
  const fall = (u: number) => u < 1 ? DROP_HEIGHT * (1 - u * u) : u < 1.5 ? .32 * Math.sin(Math.PI * (u - 1) / .5) : 0
  return {
    root, targets,
    /**
     * Show seats `reserved..n-1`. With `arrive` (the clock, in seconds) the seats that are new since the last call fall in a
     * beat apart instead of appearing — the interior's half of a hire's drop. A first fill, and a house nobody is looking
     * into, pass nothing: whoever is here is simply here.
     */
    fill(n: number, arrive?: number, leave?: number) {
      if (n === filled) return
      const was = filled
      // Laid off, newest first, a beat apart, while they are still sitting there: not anybody still falling in, and not more
      // than a hire's batch — the rest of a very large cut are simply gone, as the rest of a very large hire are simply there.
      const going = leave === undefined || was < 0 ? [] : Array.from({ length: Math.max(0, was - Math.max(n, reserved)) }, (_, k) => was - 1 - k)
        .filter(i => !dropping.has(i) && !leaving.has(i)).slice(0, MAX_DROPS)
      for (const i of hopping.keys()) if (i >= n) { lift(i, 0); hopping.delete(i) }
      for (const i of dropping.keys()) if (i >= n) { lift(i, 0); liftDesk(i, 0); dropping.delete(i) }
      // Hired back into a seat whose last occupant is still on the way out: the new hire's drop draws it from here.
      for (const i of leaving.keys()) if (i < n) { pose(i, 0, 1); liftDesk(i, 0); leaving.delete(i) }
      going.forEach((i, k) => { pose(i, 0, 1); leaving.set(i, { started: leave! + k * DROP_STAGGER, gone: false }) })
      filled = n
      people.forEach((person, i) => {
        const on = i >= reserved && i < n
        // A seat still falling is drawn by `update`; showing it here would stand a queued desk on the floor before its turn.
        // One still leaving is drawn by `update` too, and nobody can click on somebody who has been let go.
        const drawn = (on && !dropping.has(i)) || leaving.has(i)
        showSeatInstances(seats.get(i) ?? [], drawn); showSeatInstances(desks.get(i) ?? [], drawn); person.visible = on || leaving.has(i); targets[i].visible = on
      })
      if (arrive === undefined || was < 0 || n <= was) return
      for (let i = Math.max(was, reserved), k = 0; i < n && k < MAX_DROPS; i++, k++) {
        // Hidden until its turn: the instances are switched off now and switched on by the first frame of each one's fall.
        showSeatInstances(seats.get(i) ?? [], false); showSeatInstances(desks.get(i) ?? [], false)
        dropping.set(i, { started: arrive + k * DROP_STAGGER, deskLanded: false, landed: false })
      }
    },
    /** How many hires have hit a desk since this was last asked. */
    takeLandings() { const n = landings; landings = 0; return n },
    /** How many hires' desks have hit the floor since this was last asked: the garage's desk thump. */
    takeDeskLandings() { const n = deskLandings; deskLandings = 0; return n },
    /** How many people laid off have been yanked out of their seats since this was last asked. */
    takeDepartures() { const n = departures; departures = 0; return n },
    hop(seat: number, now: number, mild = false) {
      const i = seat % 100
      if (leaving.has(i) || dropping.has(i)) return
      if (mild && hopping.has(i)) return
      hopping.set(i, { started: now, mild })
    },
    update(now: number) {
      const active=hopping.size>0||dropping.size>0||leaving.size>0
      for (const [i, l] of leaving) {
        const t = now - l.started
        if (t < 0) continue
        if (t < GULP) { pose(i, 0, 1 + .08 * Math.sin(Math.PI * 6 * t / GULP) * (1 - t / GULP)); continue }
        if (!l.gone) { l.gone = true; departures += 1; flinch(i, now) }
        // Up and away, accelerating — a free fall reversed — stretched tall, the desk a beat behind.
        const u = (t - GULP) / LIFT_SECONDS, v = (t - GULP - DESK_LAG) / LIFT_SECONDS
        if (u < 1) pose(i, LIFT_HEIGHT * u * u, u < .12 ? 1 - .22 * Math.sin(Math.PI * u / .12) : 1.14)
        else { pose(i, 0, 1); showSeatInstances(seats.get(i) ?? [], false); people[i].visible = false }
        if (v > 0 && v < 1) liftDesk(i, LIFT_HEIGHT * v * v)
        if (v >= 1) { liftDesk(i, 0); showSeatInstances(desks.get(i) ?? [], false); leaving.delete(i) }
      }
      for (const [i, d] of dropping) {
        const desk = (now - d.started) / DROP_SECONDS, u = (now - d.started - DESK_LEAD) / DROP_SECONDS
        if (desk < 0) continue
        liftDesk(i, fall(desk))
        if (desk >= 1 && !d.deskLanded) { d.deskLanded = true; deskLandings += 1 }
        if (u < 0) continue
        lift(i, fall(u))
        if (u >= 1 && !d.landed) { d.landed = true; landings += 1; welcome(i, now) }
        if (u >= 1.5) { liftDesk(i, 0); dropping.delete(i) }
      }
      for(const [i,{ started, mild, again, duck }] of hopping) {
        const t=now-started,at=houseSeat(i),u=Math.max(0,Math.min(1,(t-.05)/.3))
        // Not yet: a hop queued behind a ripple or a landing must not pin the seat to the floor while it waits.
        if(t<0)continue
        // A flinch: down and wide for a third of a second where they sit, and back.
        if(duck){pose(i,0,t<.3?1-.2*Math.sin(Math.PI*t/.3):1);if(t>=.3)hopping.delete(i);continue}
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
