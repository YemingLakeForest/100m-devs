/**
 * **The office floor** — GDD §7.8.0d [CANON - added 2026-09-01].
 *
 * A hundred ordinary developers in twenty facing pods, arranged in four
 * irregular neighbourhoods around a central atrium. The authored plan for the
 * room the studio moves into on the twenty-first hire.
 *
 * ## Why this is not `floorplan.ts`
 *
 * `floorplan.ts` is the thousand-seat floor §7.8.1e authored, and it is a
 * different building: ten banks of rank-and-file rows, every desk facing the
 * same way, sized for a capacity §7.8.0 has since cut by a factor of ten. Its
 * *reasoning* survives almost intact — ragged ends, no two neighbours sharing an
 * arrangement, amenities in authored holes rather than placed by the renderer —
 * and this file inherits all of it. What could not survive is the shape.
 *
 * The two live side by side while the office is migrated, for the reason
 * §7.8.0c gives about the garage: a table forced to be both plans at once is a
 * compromise between them and is neither.
 *
 * ## What was measured off the canonical concept
 *
 * `docs/assets/concepts/office-layout-concept-100-devs-v2.png`, read as a
 * composition:
 *
 * - **The atrium is not a decoration.** It occupies about a third of the
 *   building's width and sits dead centre, and every desk in the room is
 *   arranged around it. A small statue in a corner of an open floor would have
 *   the right nouns and the wrong picture entirely.
 * - **Two pod sizes, mixed.** Four-person pods (two a side) and six-person pods
 *   (three a side), in the same neighbourhood, so no bank reads as a module
 *   repeated.
 * - **Neighbourhoods are irregular.** Twenty-six, twenty, twenty-six,
 *   twenty-eight — and the sizes are *read off the space* rather than the space
 *   carved to fit a quota. GROWTH is the smallest because its edge is the one
 *   the atrium's walking ring comes closest to, so it has room for a single
 *   rank of pods where the others take two. Four equal quadrants of twenty-five
 *   would be a car park with a fountain in it, and would have put GROWTH's
 *   second rank in the walkway.
 * - **Broad circulation.** The ring round the atrium is continuous and every
 *   pod is reachable from it, which is what makes a hundred people tappable.
 *
 * ## Units
 *
 * Tiles, from the room's inner back corner — the same frame `garage.ts` uses
 * and for the same reason. §7.8.0c records at length what happens when two
 * plans in one room disagree about where the origin is.
 */

import { FLOOR_CAP } from '../sim/capacity.ts'
import { POD_REACH, POD_STRIDE, type Facing, type Plot } from './garage.ts'

/** How deep and wide the office floor's interior is, in tiles. */
export const OFFICE_SPAN = 33

/**
 * **The atrium** — §7.8.0d's centre, and the thing the whole plan is arranged
 * around.
 *
 * **It sits at `gx` 18 rather than at the floor's midpoint, and that is the
 * suite's doing.** §7.8.12's glass takes the first five tiles of depth against
 * the back wall — the `test:room` gate found rank-and-file seats standing
 * inside it, which is the one thing that plot may never allow — so the whole
 * plan is set five tiles clear of it and the atrium travels with the desks it
 * is the centre of. A geometric centre with a third of the room walled off
 * behind glass is not the centre of anything the player can see.
 *
 * A disc in the plan even though it is drawn as an octagon, because containment
 * is the only question this table is asked and a disc answers it exactly while
 * an octagon answers it approximately. The drawn shape is `plaza.ts`'s business.
 *
 * Radius 4.5 of a 33-tile floor is a third of the width, which is what the
 * concept gives it. It is centred, and it does not move as the floor fills: at
 * twenty-one developers it is an empty ring on an empty floor, which is honest.
 */
export const ATRIUM = { gx: 18, gy: 13, radius: 4.5 } as const
/** How much floor is kept clear outside the atrium's edge, in tiles. */
export const ATRIUM_CLEAR = 0.5

/** One pod: a table with `perSide` seats each side, facing across it. */
export interface OfficePod {
  readonly id: number
  readonly neighbourhood: number
  readonly gx: number
  readonly gy: number
  /** 2 for a four-person pod, 3 for a six-person one. */
  readonly perSide: 2 | 3
}

export interface Neighbourhood {
  readonly id: number
  readonly name: string
  readonly from: number
  readonly count: number
}

/**
 * **The plan.**
 *
 * Read it as a floor plan: four bands of desks around a central atrium, each
 * band a named neighbourhood, and no two bands the same size or the same mix.
 *
 * The order is the hiring order (§7.8.1b) and it is a **route through the
 * building** rather than a raster scan: fill the neighbourhood you are in, then
 * cross to the next one. That is why the fiftieth hire lands on the far side of
 * the atrium rather than four columns to the right — you can watch the studio
 * spread round the ring, which a scan cannot show.
 */
const PODS: ReadonlyArray<Omit<OfficePod, 'id'>> = [
  // --- PLATFORM, the far band. Twenty-six, in five pods. -----------------
  //
  // Two ranks against the back wall. It is the only band with room for two,
  // which is why it is the largest — the plan is read off the space rather
  // than the space carved to fit a quota.
  { neighbourhood: 0, gx: 7.6, gy: 4.0, perSide: 3 },
  { neighbourhood: 0, gx: 7.6, gy: 9.5, perSide: 3 },
  { neighbourhood: 0, gx: 7.6, gy: 14.5, perSide: 2 },
  { neighbourhood: 0, gx: 11.2, gy: 5.5, perSide: 3 },
  { neighbourhood: 0, gx: 10.9, gy: 11.5, perSide: 2 },
  // --- GROWTH, the far-right band. Twenty, in four. ----------------------
  //
  // **The smallest band, and the atrium is why.** This edge is the one the
  // ring comes closest to, so there is room for a single rank here and the
  // second rank the other bands get would stand in the walkway. A quota of
  // twenty-five per band would have put it there anyway.
  { neighbourhood: 1, gx: 15.5, gy: 3.0, perSide: 3 },
  { neighbourhood: 1, gx: 19.5, gy: 2.8, perSide: 2 },
  { neighbourhood: 1, gx: 23.0, gy: 3.2, perSide: 3 },
  { neighbourhood: 1, gx: 27.0, gy: 1.9, perSide: 2 },
  // --- QUALITY, the near-right band. Twenty-six. -------------------------
  { neighbourhood: 2, gx: 26.0, gy: 6.4, perSide: 3 },
  { neighbourhood: 2, gx: 25.5, gy: 11.9, perSide: 3 },
  { neighbourhood: 2, gx: 25.5, gy: 17.0, perSide: 2 },
  { neighbourhood: 2, gx: 29.0, gy: 8.5, perSide: 3 },
  { neighbourhood: 2, gx: 29.0, gy: 14.5, perSide: 2 },
  // --- RELIABILITY, the near band, along the street. Twenty-eight. -------
  //
  // The biggest, and the last to fill. §7.8.1's crowding stated as *where the
  // late hires go*: the band nearest the street takes six pods where the rest
  // take four or five.
  { neighbourhood: 3, gx: 15.0, gy: 20.8, perSide: 2 },
  { neighbourhood: 3, gx: 18.5, gy: 21.4, perSide: 3 },
  { neighbourhood: 3, gx: 22.0, gy: 21.2, perSide: 2 },
  { neighbourhood: 3, gx: 15.3, gy: 25.3, perSide: 3 },
  { neighbourhood: 3, gx: 20.5, gy: 25.9, perSide: 2 },
  { neighbourhood: 3, gx: 24.5, gy: 25.2, perSide: 2 },
]

const NAMES = ['PLATFORM', 'GROWTH', 'QUALITY', 'RELIABILITY'] as const

function assemble() {
  const pods: OfficePod[] = PODS.map((p, id) => ({ ...p, id }))
  const hoods: Neighbourhood[] = []
  let seat = 0
  for (let h = 0; h < NAMES.length; h++) {
    const from = seat
    for (const pod of pods) if (pod.neighbourhood === h) seat += pod.perSide * 2
    hoods.push({ id: h, name: NAMES[h], from, count: seat - from })
  }
  return { pods, hoods, capacity: seat }
}

const ASSEMBLED = assemble()

/** Every pod on the floor, in hiring order. */
export const OFFICE_PODS: readonly OfficePod[] = ASSEMBLED.pods
/** The four bands, in hiring order. */
export const NEIGHBOURHOODS: readonly Neighbourhood[] = ASSEMBLED.hoods
/** How many ordinary seats the plan holds. Must be exactly {@link FLOOR_CAP}. */
export const OFFICE_SEATS = ASSEMBLED.capacity

/** Where a pod's seats start in the hiring order, and how many it holds. */
const POD_FROM: number[] = (() => {
  const out: number[] = []
  let seat = 0
  for (const pod of OFFICE_PODS) {
    out.push(seat)
    seat += pod.perSide * 2
  }
  return out
})()

export interface OfficeSeat {
  readonly index: number
  readonly pod: number
  readonly neighbourhood: number
  readonly inPod: number
  readonly gx: number
  readonly gy: number
  readonly facing: Facing
}

/**
 * Where ordinary developer `index` sits on the floor.
 *
 * **Pure, and the same rule the garage uses one room down**: even seats take
 * the far side of the table and odd the near, so consecutive arrivals sit
 * opposite each other and a pod holding two people is a pair rather than two
 * strangers looking at an empty bench. A pod fills before the next one starts,
 * so a half-filled floor is a set of complete teams and one team forming — not
 * a hundred desks each with somebody at every third one.
 */
export function officeSeat(index: number): OfficeSeat {
  const i = Math.max(0, Math.min(OFFICE_SEATS - 1, Math.floor(index)))
  let p = 0
  while (p + 1 < OFFICE_PODS.length && POD_FROM[p + 1] <= i) p++
  const pod = OFFICE_PODS[p]
  const inPod = i - POD_FROM[p]
  const far = inPod % 2 === 0
  // Which pair along the table, **ordered from the middle outward**. A pod
  // filled from one end puts two people at one end of a six-seat table with a
  // gap at the other, which reads as somebody having left rather than as a team
  // still forming. This was written as a plain left-to-right index first and
  // `office.test.ts` caught it.
  const along = alongOrder(pod.perSide)[Math.floor(inPod / 2)]
  return {
    index: i,
    pod: pod.id,
    neighbourhood: pod.neighbourhood,
    inPod,
    gx: pod.gx + (far ? -POD_REACH : POD_REACH),
    gy: pod.gy + along * POD_STRIDE,
    facing: far ? 'gx+' : 'gx-',
  }
}

/**
 * The positions along a table, ordered middle-first.
 *
 * Two a side is `[-0.5, +0.5]` — both equally central, so the order is just the
 * two of them. Three a side is `[0, -1, +1]`: the middle chair, then the two
 * either side of it.
 */
function alongOrder(perSide: 2 | 3): number[] {
  const all = Array.from({ length: perSide }, (_, j) => j - (perSide - 1) / 2)
  return all.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
}

/**
 * How many pods have somebody in them at this headcount.
 *
 * A pod fills before the next starts, so this is a lookup rather than a scan —
 * and it is the count of `Graphics` the room allocates, which is why it lives
 * here rather than being re-derived from a seat index at the call site.
 */
export function podsUsedFor(ordinary: number): number {
  const n = Math.max(0, Math.min(OFFICE_SEATS, Math.floor(ordinary)))
  if (n === 0) return 0
  return officeSeat(n - 1).pod + 1
}

/** Every seat, in hiring order. */
export function officeSeats(): OfficeSeat[] {
  return Array.from({ length: OFFICE_SEATS }, (_, i) => officeSeat(i))
}

/** The seat directly across the table from this one. */
export function officeAcross(index: number): number {
  const i = Math.max(0, Math.min(OFFICE_SEATS - 1, Math.floor(index)))
  let p = 0
  while (p + 1 < OFFICE_PODS.length && POD_FROM[p + 1] <= i) p++
  const inPod = i - POD_FROM[p]
  return POD_FROM[p] + (inPod % 2 === 0 ? inPod + 1 : inPod - 1)
}

/** Half a pod's footprint on each axis, chairs included. */
export const POD_HALF_GX = 1.5
export function podHalfGy(perSide: 2 | 3): number {
  return (perSide * POD_STRIDE) / 2 + 0.35
}

export function officePodPlot(pod: OfficePod): Plot {
  const hy = podHalfGy(pod.perSide)
  return {
    name: `POD ${pod.id}`,
    gx0: pod.gx - POD_HALF_GX,
    gy0: pod.gy - hy,
    gx1: pod.gx + POD_HALF_GX,
    gy1: pod.gy + hy,
  }
}

/**
 * Does a rectangle reach into the atrium? Rectangle-versus-disc rather than
 * centre-distance, because a pod is long in one axis and the crude test rejects
 * pods that are comfortably clear at their nearest corner.
 */
export function hitsAtrium(p: Plot): boolean {
  const nx = Math.max(p.gx0, Math.min(ATRIUM.gx, p.gx1))
  const ny = Math.max(p.gy0, Math.min(ATRIUM.gy, p.gy1))
  return Math.hypot(nx - ATRIUM.gx, ny - ATRIUM.gy) < ATRIUM.radius + ATRIUM_CLEAR
}

/** The capacity claim, stated where the plan can be checked against it. */
export const OFFICE_FULL_AT = FLOOR_CAP

// ---------------------------------------------------------------------------
// The amenities — GDD §7.8.0d
// ---------------------------------------------------------------------------

/**
 * What stands in the holes the pods leave.
 *
 * The same discipline `floorplan.ts` established one plan ago and §7.8.0c
 * repeated in the garage: **an amenity placed by the renderer is an amenity
 * that will eventually be placed on somebody's desk.** These are rectangles
 * reserved in the same table the seats come out of, so the two cannot disagree,
 * and `office.test.ts` asserts it before anything is drawn.
 *
 * Where they are is read off the canonical concept, and the placement rule is
 * the concept's rather than a tidy one: **amenities line the walls and the
 * lanes, and the middle of the floor is the atrium.** An office puts its
 * lockers where a corridor needs an edge and its tea point where two
 * neighbourhoods meet, not on a grid of service islands.
 */
export type OfficeAmenityKind =
  /** A glass box with a table in it. Cyan-tinted, dark mullions. */
  | 'meeting'
  /** A counter with stools and a pendant over it. */
  | 'kitchenette'
  /** A run of tall lockers. The strongest rhythm on the floor. */
  | 'lockers'
  /** Dark racks with blue LED strips. The one near-black object. */
  | 'server'
  /** A sofa in the atrium, facing the statue. */
  | 'sofa'
  /** A planter. The cheap punctuation between everything else. */
  | 'planter'
  /** The front doors, with the sign over them. */
  | 'entrance'

export interface OfficeAmenity extends Plot {
  readonly kind: OfficeAmenityKind
}

/** How far out from the statue the sofas sit, in tiles. */
const SOFA_RING = 2.6

function sofa(dx: number, dy: number): OfficeAmenity {
  const cx = ATRIUM.gx + dx * SOFA_RING
  const cy = ATRIUM.gy + dy * SOFA_RING
  // Long across the direction it faces, so it presents its back to the walk and
  // its seat to the statue — which is the whole reason four of them read as a
  // ring rather than as four benches.
  const halfX = Math.abs(dx) > Math.abs(dy) ? 0.4 : 1.3
  const halfY = Math.abs(dx) > Math.abs(dy) ? 1.3 : 0.4
  return {
    kind: 'sofa',
    name: `SOFA ${dx},${dy}`,
    gx0: cx - halfX,
    gy0: cy - halfY,
    gx1: cx + halfX,
    gy1: cy + halfY,
  }
}

export const OFFICE_AMENITIES: readonly OfficeAmenity[] = [
  // --- the atrium: four sofas facing the statue -------------------------
  //
  // On the axes rather than the diagonals, because a ring of four on the
  // diagonals reads as a diamond and a ring of four on the axes reads as a
  // square — and a square is what a room's furniture makes when it is arranged
  // around something.
  sofa(-1, 0),
  sofa(1, 0),
  sofa(0, -1),
  sofa(0, 1),
  // --- the near-right wall: lockers, and the server room at the end ------
  //
  // Long runs against the wall, which is what gives that whole edge a rhythm
  // to read the floor's depth against. Broken into three so the gaps between
  // them are doors out to the desks.
  { kind: 'server', name: 'THE SERVER ROOM', gx0: 31.2, gy0: 1.6, gx1: 32.6, gy1: 5.4 },
  { kind: 'lockers', name: 'LOCKERS A', gx0: 31.4, gy0: 6.6, gx1: 32.6, gy1: 13.2 },
  { kind: 'lockers', name: 'LOCKERS B', gx0: 31.4, gy0: 14.6, gx1: 32.6, gy1: 21.0 },
  { kind: 'lockers', name: 'LOCKERS C', gx0: 31.4, gy0: 22.4, gx1: 32.6, gy1: 27.0 },
  // --- the spine between the south band and the atrium -------------------
  //
  // Two tea points where the neighbourhoods meet, which is where an office
  // actually puts them: not in the middle of anybody's floor, on the way
  // between two of them.
  // Not in the lane between the south band and the atrium, which is where they
  // went first: that lane *is* the walking ring, and a counter standing in it
  // closes the one circulation claim §7.8.0d makes about the whole floor. They
  // go against the two walls instead, which is where an office puts them.
  { kind: 'kitchenette', name: 'THE TEA POINT', gx0: 4.8, gy0: 8.0, gx1: 6.0, gy1: 13.0 },
  { kind: 'kitchenette', name: 'THE SECOND KITCHEN', gx0: 8.0, gy0: 0.2, gx1: 13.0, gy1: 1.3 },
  // --- the street band: the entrance, with a meeting room either side -----
  { kind: 'meeting', name: 'FOCUS', gx0: 6.4, gy0: 28.8, gx1: 12.6, gy1: 32.4 },
  { kind: 'entrance', name: 'STUDIO_01', gx0: 14.4, gy0: 29.6, gx1: 20.6, gy1: 32.6 },
  { kind: 'meeting', name: 'THE BOARD', gx0: 22.4, gy0: 28.8, gx1: 29.6, gy1: 32.4 },
  // --- planters, in the corners nothing else wants -----------------------
  { kind: 'planter', name: 'PLANTER N', gx0: 4.8, gy0: 1.0, gx1: 6.0, gy1: 2.2 },
  { kind: 'planter', name: 'PLANTER W', gx0: 6.2, gy0: 24.0, gx1: 7.4, gy1: 25.2 },
  { kind: 'planter', name: 'PLANTER E', gx0: 30.0, gy0: 29.0, gx1: 31.2, gy1: 30.2 },
]
