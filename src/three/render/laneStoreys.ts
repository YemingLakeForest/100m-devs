/**
 * **The storeys across the lane** — GDD §7.7.2 and §7.8.1c [added 2026-09-28].
 *
 * The user, 2026-09-27: *"in our first few expansions we can do a dramatic drop
 * a new office floor across the road"*; and 2026-09-28, after the Pixi office
 * was decommissioned: *"My direction is a dramatic funny expansion of the
 * current scene, either a office floor drops like james across the road or
 * similar"* — *"the old pixi office scene was deprecated and cannot be used as
 * reference for new."*
 *
 * So this is built out of the garage and nothing else: its desks'
 * proportions, its chairs, its people (`studioPerson`, with the face each seat
 * has always had — `workerLook` reads the seat and never the room), and
 * James's physics. §7.7.2 is the brief, verbatim: *"A complete, furnished,
 * already-populated storey drops out of the sky and lands on top of the tower
 * with a whump. The building squashes, wobbles, and settles one floor taller.
 * Dust rings out from the base. Nobody inside reacts."* The comedy is the
 * deadpan — furniture put down by something enormous and bored.
 *
 * **Where.** The prototype's `ACROSS THE LANE` plot (`docs/demos/…/lots.ts`), in
 * the garage's own metres, behind the garage over the back lane, where three
 * houses stand. The camera looks from the front (§12.1's (1, 1, 1)), so a stack
 * there rises *over* the garage's roofline instead of standing between the lens
 * and the founder. The houses go under the first storey's dust. The plot is 36
 * by 14 rather than the prototype's 32 by 13, because the prototype's seats were
 * windows and these are the garage's desks: twenty-five of its pods need that.
 *
 * **How much.** §7.8.0's floor: a hundred seats, twenty-five pods of four,
 * spaced as the garage spaces its five. A storey arrives when the studio needs
 * its first seat, furnished, with whoever the headcount already puts in it;
 * every later hire into it drops in from its ceiling, the way a hire drops into
 * the garage.
 *
 * **Built per storey, batched per storey.** Each storey is one group of ordinary
 * garage boxes, frozen into instanced meshes by `batchArt` as it is built — so a
 * falling storey is one group's transform, and a person nobody has hired yet is
 * a zero instance matrix, the garage's own trick (`worldArt.showSeatInstances`).
 * Nothing is built before it is needed.
 *
 * **Lit without lights.** A point light per desk is how the garage is lit at
 * night, and it cannot be how a hundred desks are: every light is a loop in
 * every fragment of the scene, and a change in their number recompiles every
 * material (`garageView`'s 917 ms hire). A storey's surfaces carry a little of
 * their own colour as emission, and its lamps and screens carry a lot, which is
 * what the bloom picks up — an office lit from its ceiling, seen from the street.
 */

import * as T from 'three'
import { batchArt, box, cylinder, INK, placeInstances, sharedMaterial, showSeatInstances, type SeatInstance } from './worldArt.ts'
import { chair, studioPerson, workerLook, type StudioCast } from './studioPeople.ts'

/** The lot, in the garage's metres: the prototype's ACROSS THE LANE, widened for the garage's pods. */
export const LANE_LOT = { x: 0, z: -28.4, w: 36, d: 14 } as const
/** What stands on the lot and goes when the first storey lands: the three houses at z −25. */
export const LANE_CLEAR = [-19.5, -36, 19.5, -20.6] as const
/** §7.8.0 — a floor is a hundred people. */
export const STOREY_SEATS = 100
/** Floor to floor, in metres. The garage's walls are 3.2; a slab and a ceiling void make the rest. */
export const STOREY_HEIGHT = 3.6
/** The prototype's plot is eighteen storeys; past that the lane is full until the city comes. */
export const LANE_STOREYS = 18
/** Where the ground is on the lot: the neighbourhood is laid half a metre down. */
const GROUND = -0.5
/** How far a storey falls: from well above the top of the frame. */
const DROP_FROM = 70
/** How far a hire falls inside a storey: from its ceiling, like a hire into the garage. */
const HIRE_FROM = 2.6
/** A storey's fall, in seconds — the prototype's, and near enough James's desk's. */
const FALL_S = 0.55
/** A backlog of storeys lands this far apart: a mass hire is floors slammed down in succession. */
const BACKLOG_S = 0.38

/** Twenty-five pods on a 9 × 3 grid; the back row's last two slots are the lift. */
const POD_PITCH_X = 3.9
const POD_PITCH_Z = 4.35
const LIFT_SLOTS = new Set([7, 8])
const POD_SLOTS: readonly number[] = Array.from({ length: 27 }, (_, i) => i).filter((i) => !LIFT_SLOTS.has(i))

/** Where storey-local pod `p` stands, relative to the lot's centre. */
function podAt(p: number): { x: number; z: number } {
  const slot = POD_SLOTS[p]
  return { x: ((slot % 9) - 4) * POD_PITCH_X, z: (Math.floor(slot / 9) - 1) * POD_PITCH_Z }
}

/**
 * Storey-local seat `i`: four to a pod, spaced as `floorPlan.garageSeats`
 * spaces the garage's (0.92 along, 1.38 across), facing across the pod.
 */
export function laneSeat(i: number): { x: number; z: number; facing: number } {
  const pod = podAt(Math.floor(i / 4))
  const k = i % 4
  return {
    x: pod.x + (k % 2 ? 0.92 : -0.92),
    z: pod.z + (k < 2 ? -1.38 : 1.38),
    facing: k < 2 ? Math.PI : 0,
  }
}

const warmed = new Map<T.Material, T.Material>()
/** The storey's own light: a surface's colour, a little of it emitted. See the header. */
function warm(m: T.Material): T.Material {
  let out = warmed.get(m)
  if (!out) {
    if (m instanceof T.MeshStandardMaterial && m.emissive.getHex() === 0) {
      const c = m.clone()
      c.emissive.copy(m.color).multiplyScalar(0.3)
      out = c
    } else out = m
    warmed.set(m, out)
  }
  return out
}
const lamp = () => sharedMaterial('lane:lamp', () => new T.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffe7b8', emissiveIntensity: 1.6, flatShading: true }))
const screen = () => sharedMaterial('lane:screen', () => new T.MeshStandardMaterial({ color: '#172b34', emissive: '#4fb1b0', emissiveIntensity: 1.1, flatShading: true }))

const hitGeometry = new T.BoxGeometry(1, 1, 1)
const hitMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
/** Hit boxes live on their own layer: the camera never draws them, a ray looks only at them. */
export const HIT_LAYER = 1

/** A desk with the garage's proportions and a lit screen (`craftedSingleDesk`, less its printed texture). */
function desk(g: T.Group, index: number): void {
  box(g, 0, .78, .72, 1.64, .12, .88, INK.wood)
  box(g, -.62, .04, .74, .38, .74, .72, INK.woodEdge)
  for (const z of [.38, 1.02]) box(g, .72, .02, z, .07, .76, .07, INK.woodEdge)
  box(g, 0, .9, .85, .27, .035, .18, INK.metal)
  box(g, 0, .93, .85, .055, .16, .06, INK.metal)
  box(g, 0, 1.04, .85, .7, .43, .065, INK.metal)
  box(g, 0, 1.075, .81, .62, .36, .012, INK.glass).material = screen()
  box(g, 0, .905, .45, .52, .025, .19, '#b5b9af')
  cylinder(g, .54, .9, .55, .07, .15, index % 2 ? '#c39955' : '#648079')
}

interface Storey {
  index: number
  group: T.Group
  /** Per storey-local seat, the batched boxes that are its person. */
  seats: Map<number, SeatInstance[]>
  /**
   * Per storey-local seat, the person's own group: whatever the batcher left in
   * it (a box whose colour nobody else on the floor wears is not worth an
   * instanced mesh) hides and moves with the instances, or a rare haircut would
   * float over an empty desk.
   */
  people: T.Group[]
  /** Per storey-local seat, the hit box. */
  targets: T.Mesh[]
  /** How many of its seats have somebody in them. */
  filled: number
  /** Seconds into its fall, counting a backlog's wait; null once it has landed. */
  falling: number | null
  /** How long it waits before it falls. */
  wait: number
}

/** A person's own arrival: dropping into a standing storey, or hopping at a poke. */
interface Motion { seat: number; kind: 'drop' | 'hop'; start: number }

export interface LaneEvents {
  /** A storey has landed: dust rings out from the base, and the camera takes the whump. */
  landed(footprint: T.Box3): void
}

export interface Lane {
  readonly root: T.Group
  /** Storeys standing, counting any still falling. */
  readonly storeys: number
  /** Is a storey still on its way down? */
  readonly dropping: boolean
  /**
   * The studio's ordinary developers, once they have moved out of the garage —
   * zero while they have not. `animate` is false for a headcount that arrived
   * with a save or a jump: that one is simply there.
   */
  setStaff(n: number, animate: boolean): void
  /** Hold seat `seat` empty, and drop its occupant in after `delay` seconds — the move out of the garage. */
  dropIn(seat: number, delay: number): void
  hop(seat: number): void
  /** Advance by the room's clock. True while anything is moving. */
  update(clock: number): boolean
  /** Whose hit box a ray meets first: a global seat, or null. */
  pick(ray: T.Raycaster): number | null
  /** Where a seated person's head is, in the scene; null if nobody is in that seat. */
  headOf(seat: number): T.Vector3 | null
  /** What is standing, for the camera: the lot up to the top storey; null when nothing is. */
  bounds(): T.Box3 | null
  dispose(): void
}

export function createLane(cast: () => StudioCast, events: LaneEvents): Lane {
  const root = new T.Group()
  root.position.set(LANE_LOT.x, GROUND + 0.3, LANE_LOT.z)
  // The squash is the whole building's, about its base (§7.7.2), so the
  // storeys ride in a body that can be squashed without moving the lot.
  const body = new T.Group()
  root.add(body)
  const built: Storey[] = []
  const motions: Motion[] = []
  /** Seats held empty until they drop in on their own (the move). */
  const held = new Map<number, number>()
  let clock = 0
  let wobble: number | null = null

  function build(index: number): Storey {
    const group = new T.Group()
    group.position.y = index * STOREY_HEIGHT
    // Two registers: the building (slab, walls, columns, the lift), lit by the
    // night like the garage's walls; and what is inside it, which carries the
    // storey's own light (see `warm`). A building that glowed would read as a
    // lantern, not as an office with its lights on.
    const shell = new T.Group()
    const inside = new T.Group()
    group.add(shell, inside)
    const w = LANE_LOT.w
    const d = LANE_LOT.d
    /*
     * **The slab is the storey's floor, and the storey below's ceiling.** There
     * is no ceiling of its own: the top storey stands open to the sky, as the
     * garage does, because §12.1's camera looks down into a room from above and
     * a lid is all it would see. Everything lower is read through its cut-down
     * near walls. The lamps hang under the slab for the storey *below*, so the
     * top floor has none floating over it and storey 0's are under the ground.
     */
    box(shell, 0, -0.3, 0, w, 0.3, d, '#a8a497')
    // Office carpet: darker than the desks, so the desks and the people read
    // against it — a pale floor under its own lamps washed the room out.
    box(inside, 0, 0, 0, w - 0.4, 0.02, d - 0.4, '#77736a', false)
    for (let p = 0; p < 25; p++) {
      const at = podAt(p)
      box(shell, at.x, -0.66, at.z, 2.2, 0.06, 0.4, '#fff4dc', false).material = lamp()
      box(shell, at.x, -0.6, at.z, 0.05, 0.3, 0.05, INK.metal, false)
    }
    // The far walls stand full height, with a window between each pair of
    // pods: the camera sees them from inside, as it sees the garage's.
    const wallH = STOREY_HEIGHT - 0.3
    box(shell, 0, 0, -d / 2 + 0.12, w, wallH, 0.24, INK.wall)
    box(shell, -w / 2 + 0.12, 0, 0, 0.24, wallH, d, INK.wall)
    for (let x = -w / 2 + 2.5; x < w / 2 - 6; x += POD_PITCH_X) box(shell, x, 0.9, -d / 2 + 0.25, 2.6, 1.7, 0.04, '#a8c7cf', false)
    for (let z = -d / 2 + 2.5; z < d / 2 - 1.5; z += POD_PITCH_Z) box(shell, -w / 2 + 0.25, 0.9, z, 0.04, 1.7, 2.6, '#a8c7cf', false)
    // The near walls are cut down, as the garage's are (§13.1's cutaway): a
    // parapet and its coping, so the people are what the camera sees.
    box(shell, 0, 0, d / 2 - 0.12, w, 0.55, 0.24, INK.wall)
    box(shell, 0, 0.55, d / 2 - 0.12, w + 0.1, 0.07, 0.33, INK.trim)
    box(shell, w / 2 - 0.12, 0, 0, 0.24, 0.55, d, INK.wall)
    box(shell, w / 2 - 0.12, 0.55, 0, 0.33, 0.07, d + 0.1, INK.trim)
    // Corner columns carry the storey above, so a stack reads as a building.
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
      box(shell, x - Math.sign(x) * 0.25, 0, z - Math.sign(z) * 0.25, 0.5, wallH, 0.5, INK.trim)
    }
    // The lift, in the back row's last two slots.
    const lift = { x: 7.5 * POD_PITCH_X - 4 * POD_PITCH_X, z: -POD_PITCH_Z - 0.6 }
    box(shell, lift.x, 0, lift.z, 3.4, wallH, 3.2, '#b9b2a2')
    box(shell, lift.x, 0.05, lift.z + 1.61, 1.3, 2.1, 0.02, INK.metal, false)

    const targets: T.Mesh[] = []
    const people: T.Group[] = []
    for (let i = 0; i < STOREY_SEATS; i++) {
      const s = laneSeat(i)
      const seat = index * STOREY_SEATS + i
      const station = new T.Group()
      station.position.set(s.x, 0, s.z)
      station.rotation.y = s.facing + Math.PI
      inside.add(station)
      desk(station, seat)
      chair(inside, s.x, s.z, s.facing)
      const person = studioPerson(inside, s.x, s.z, s.facing, workerLook(cast(), seat))
      // The garage keeps its people out of the batch so it can move them one
      // by one; a storey moves as a whole, and a person in it moves through
      // their instance matrices, so they are batched with everything else.
      person.userData.dynamic = false
      person.userData.seat = i
      people.push(person)
      const hit = new T.Mesh(hitGeometry, hitMaterial)
      hit.position.set(s.x, 1, s.z)
      hit.scale.set(1.1, 1.75, 1.1)
      hit.userData.hit = true
      hit.userData.seat = seat
      hit.layers.set(HIT_LAYER)
      group.add(hit)
      targets.push(hit)
    }
    inside.traverse((o) => {
      const m = o as T.Mesh
      if (m.isMesh && m.material && !Array.isArray(m.material)) m.material = warm(m.material)
    })
    const seats = new Map<number, SeatInstance[]>()
    batchArt(group, seats)
    body.add(group)
    return { index, group, seats, people, targets, filled: 0, falling: null, wait: 0 }
  }

  /** Show or hide one person, instances and leftovers together. */
  function show(st: Storey, local: number, on: boolean) {
    showSeatInstances(st.seats.get(local) ?? [], on)
    const person = st.people[local]
    if (person) person.visible = on
  }

  /** Move one person by `delta` about their seat: instances and leftovers together. */
  function move(st: Storey, local: number, y: number, squash: number) {
    const s = laneSeat(local)
    const sxz = 1 / Math.sqrt(Math.max(.2, squash))
    placeInstances(st.seats.get(local) ?? [], new T.Matrix4()
      .makeTranslation(s.x, y, s.z)
      .multiply(new T.Matrix4().makeScale(sxz, squash, sxz))
      .multiply(new T.Matrix4().makeTranslation(-s.x, 0, -s.z)))
    const person = st.people[local]
    if (person) {
      person.visible = true
      person.position.set(s.x, y, s.z)
      person.scale.set(sxz, squash, sxz)
    }
  }

  /** Who is in their chair: seats below `filled`, unless they are held or still dropping in. */
  function sit(st: Storey) {
    for (let i = 0; i < STOREY_SEATS; i++) {
      const global = st.index * STOREY_SEATS + i
      const moving = motions.some((m) => m.seat === global && m.kind === 'drop')
      show(st, i, i < st.filled && !held.has(global) && !moving)
      st.targets[i].visible = i < st.filled && !held.has(global)
    }
  }

  const storeyOf = (seat: number) => built[Math.floor(seat / STOREY_SEATS)]

  const lane: Lane = {
    root,
    get storeys() {
      return built.length
    },
    get dropping() {
      return built.some((st) => st.falling !== null)
    },
    setStaff(n, animate) {
      const next = Math.max(0, Math.min(LANE_STOREYS * STOREY_SEATS, Math.floor(n)))
      const want = Math.ceil(next / STOREY_SEATS)
      // Shrinking takes whole storeys, top first. The staged liquidation that
      // lifts them back into the sky belongs to the first prestige's scene.
      while (built.length > want) {
        const st = built.pop()!
        body.remove(st.group)
        st.group.traverse((o) => { if (o instanceof T.InstancedMesh) o.dispose() })
      }
      for (let i = motions.length - 1; i >= 0; i--) if (motions[i].seat >= next) motions.splice(i, 1)
      for (const seat of [...held.keys()]) if (seat >= next) held.delete(seat)
      // Growing: a storey drops with whoever the headcount already puts in it.
      let queued = built.filter((st) => st.falling !== null).length
      while (built.length < want) {
        const st = build(built.length)
        built.push(st)
        if (animate) {
          st.wait = queued * BACKLOG_S
          st.falling = 0
          st.group.visible = false
          queued += 1
        }
      }
      for (const st of built) {
        const inside = Math.max(0, Math.min(STOREY_SEATS, next - st.index * STOREY_SEATS))
        // A hire into a storey that is already standing drops in from its ceiling.
        if (animate && st.falling === null && inside > st.filled) {
          for (let i = st.filled; i < inside; i++) {
            motions.push({ seat: st.index * STOREY_SEATS + i, kind: 'drop', start: clock + (i - st.filled) * 0.06 })
          }
        }
        st.filled = inside
        sit(st)
      }
    },
    dropIn(seat, delay) {
      const st = storeyOf(seat)
      if (!st) return
      held.set(seat, clock + delay)
      sit(st)
    },
    hop(seat) {
      if (motions.some((m) => m.seat === seat)) return
      motions.push({ seat, kind: 'hop', start: clock })
    },
    update(now) {
      const dt = Math.max(0, Math.min(1 / 30, now - clock))
      clock = now
      let moving = false
      for (const st of built) {
        if (st.falling === null) continue
        moving = true
        st.falling += dt
        const t = st.falling - st.wait
        if (t < 0) continue
        st.group.visible = true
        const u = t / FALL_S
        st.group.position.y = st.index * STOREY_HEIGHT + (u < 1 ? DROP_FROM * (1 - u * u) : 0)
        if (u >= 1) {
          st.falling = null
          st.group.position.y = st.index * STOREY_HEIGHT
          wobble = 0
          const top = (st.index + 1) * STOREY_HEIGHT
          events.landed(new T.Box3(
            new T.Vector3(LANE_LOT.x - LANE_LOT.w / 2, GROUND, LANE_LOT.z - LANE_LOT.d / 2),
            new T.Vector3(LANE_LOT.x + LANE_LOT.w / 2, top, LANE_LOT.z + LANE_LOT.d / 2),
          ))
        }
      }
      // §7.7.2 — the building squashes, wobbles, and settles one floor taller.
      if (wobble !== null) {
        moving = true
        wobble += dt
        const u = wobble / 0.5
        const squash = u < 1 ? 1 - 0.12 * Math.sin(Math.PI * u) * (1 - u) + 0.035 * Math.sin(Math.PI * 2 * u) * u : 1
        body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
        if (u >= 1) { wobble = null; body.scale.set(1, 1, 1) }
      }
      // The move: a held seat's occupant starts dropping in when their time comes.
      for (const [seat, at] of held) {
        if (clock < at) { moving = true; continue }
        held.delete(seat)
        motions.push({ seat, kind: 'drop', start: at })
      }
      for (let i = motions.length - 1; i >= 0; i--) {
        const m = motions[i]
        const st = storeyOf(m.seat)
        if (!st) { motions.splice(i, 1); continue }
        const local = m.seat % STOREY_SEATS
        moving = true
        // Nobody drops into a storey that is still in the air.
        if (st.falling !== null) { show(st, local, false); continue }
        const t = clock - m.start
        if (t < 0) { if (m.kind === 'drop') show(st, local, false); continue }
        let y: number
        let squash: number
        let done: boolean
        if (m.kind === 'hop') {
          // Crouch, spring, fly, land — the garage's hop, under half a second.
          y = t < .07 || t >= .37 ? 0 : .55 * Math.sin(Math.PI * (t - .07) / .3)
          squash = t < .07 ? 1 - .18 * (t / .07) : t < .37 ? 1.08 : t < .47 ? 1 - .14 * Math.sin(Math.PI * (t - .37) / .1) : 1
          done = t >= .47
        } else {
          // Free fall from the ceiling, one bounce, rest — the garage's hire.
          const u = t / .45
          y = u < 1 ? HIRE_FROM * (1 - u * u) : u < 1.5 ? .22 * Math.sin(Math.PI * (u - 1) / .5) : 0
          squash = u >= 1 && u < 1.15 ? 1 - .24 * Math.sin(Math.PI * (u - 1) / .15) : 1
          done = u >= 1.5
        }
        move(st, local, done ? 0 : y, done ? 1 : squash)
        if (done) {
          st.targets[local].visible = local < st.filled && !held.has(m.seat)
          motions.splice(i, 1)
        }
      }
      return moving
    },
    pick(ray) {
      const live: T.Mesh[] = []
      for (const st of built) if (st.falling === null) for (const t of st.targets) if (t.visible) live.push(t)
      const layers = ray.layers.mask
      ray.layers.set(HIT_LAYER)
      const hit = ray.intersectObjects(live, false)[0]
      ray.layers.mask = layers
      return hit ? (hit.object.userData.seat as number) : null
    },
    headOf(seat) {
      const st = storeyOf(seat)
      const t = st?.targets[seat % STOREY_SEATS]
      if (!st || !t?.visible) return null
      const p = t.getWorldPosition(new T.Vector3())
      p.y += 0.5
      return p
    },
    bounds() {
      if (built.length === 0) return null
      return new T.Box3(
        new T.Vector3(LANE_LOT.x - LANE_LOT.w / 2, GROUND, LANE_LOT.z - LANE_LOT.d / 2),
        new T.Vector3(LANE_LOT.x + LANE_LOT.w / 2, GROUND + built.length * STOREY_HEIGHT, LANE_LOT.z + LANE_LOT.d / 2),
      )
    },
    dispose() {
      for (const st of built) st.group.traverse((o) => { if (o instanceof T.InstancedMesh) o.dispose() })
      built.length = 0
    },
  }
  return lane
}
