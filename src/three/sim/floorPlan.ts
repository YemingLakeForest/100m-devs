/*
 * Copied from the rebuild (100m-devs-three/src/sim/floorPlan.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import { crossesFurniture } from './routeGeometry.ts'

/**
 * Where everything on a playable floor is, and which parts of it you can walk
 * on — GDD §§6, 7, 18.3.
 *
 * **This file exists because §18.3 refuses to let the renderer own the clock.**
 * Its words are "pass route length/waypoints into the simulation so travel time
 * equals visible travel. Do not let the renderer decide when production
 * restarts." A simulation that charges a flat five seconds for a walk while the
 * renderer draws a fourteen-second one is two answers to one question, and the
 * player believes the picture. So the layout lives here, in `sim/`, where the
 * economy can reach it, and `render/` reads the same numbers to draw the room.
 *
 * That is a move: this used to be `render/studioPlan.ts`. Nothing about it was
 * ever renderer-specific — it is metres and furniture — and leaving it there
 * meant the only module allowed to answer "how far is the water cooler" was the
 * one module the simulation may not import (house rule: `sim/` is pure).
 *
 * ## What is authored and what is derived
 *
 * Seats, pods and leader stations are authored: §6's twentieth hire has to
 * visibly complete the fifth pod, and that only works if the order is fixed.
 * {@link FURNITURE} is authored once and *drawn* from these numbers by
 * `render/garageEnvironment.ts` and `render/worldEnvironments.ts`, so a sofa
 * that moves in the picture moves in the graph on the same edit.
 *
 * The walkability grid is derived from both, at half-metre cells, and is only
 * ever consulted through {@link route}. Nothing outside this file should be
 * deciding whether a point is somewhere a person can stand.
 *
 * Metres, Y-up, camera from +X/+Z. The garage has only founder and James; the
 * office adds Billy, Serena and Matt outside its ordinary benches.
 */

/** The two scales that draw individual bodies. §18.3 leaves the rest to arithmetic. */
export type Place = 'garage' | 'office'

/** Where somebody has gone instead of working. §18.1's table, plus `loiter`. */
export type Errand = 'water' | 'whiteboard' | 'window' | 'sofa' | 'loiter'

export interface Point { readonly x: number; readonly z: number }

export const STUDIO = { width: 20, depth: 16, wallHeight: 3.2, entrance: [-6, -4] } as const

/**
 * **The hall's back walls** [2026-10-05, at the user's instruction: *"I see the wall are tool low, make them
 * higher"*] — the north and the west, the two whose inner faces the camera sees. They were 3.2 m, the height of the
 * walls round the entry wing (`STUDIO.wallHeight`, which stays: the wing is an annex and a lower roofline is what an
 * annex has), and everything the heroes hang on them — the ticket wall, the dashboards, the name plates, the studio's
 * sign — came to the top of the wall or past it: the plates floated in the dark above the building. 4.6 m is a loft's
 * height, a metre and four tenths more than before; the camera is re-framed for it (`Environment.focus`), because
 * on §12.1's lens a metre of wall is fifty pixels of picture and the corner at the top of the frame was already
 * at the top edge.
 *
 * The near walls (east and south) are untouched: §13.1 cuts them down so that the camera can see seated bodies, and
 * a back wall costs the picture nothing however high it goes — it is behind everything along (−1, −1).
 */
export const GARAGE_WALLS = { height: 4.6 } as const

/**
 * The entry wing's east edge — the one number the outline, the gable and the
 * portal all stand on.
 *
 * **It was −4, and the wing was six metres wide.** Three things in this build
 * were already written for four: §13.1 calls the street gable "4 × 3.2 m",
 * {@link STUDIO_GABLE}'s own note says "the same four metres", and
 * `gableSign` measures a wall that "only has 3.4" (4 − 0.6 of margin). The
 * two extra metres pushed the portal two metres east, and on §12.1's camera
 * east is *down the screen*: a 2.75 m opening in the near-left foreground
 * sweeps about 5.5 projected units up the frame, so everything within that
 * reach in the same screen column is drawn behind it. Seat 6 — pod 1's
 * south-west chair — was 1.7 units off the portal's column and needs 2.3, and
 * the developer sitting there was drawn across the door head. Measured, then
 * looked at: the frame shows his shoulder cutting the lintel in half.
 *
 * The wing is furniture-free and the pods are not, so the wing moved. At −6
 * the nearest seat clears the portal by 1.4 units, the gable is the 4 m the
 * document always claimed, and the street hedge in front of it (x −9.95…−6.45)
 * finally covers the wall it was cut for instead of stopping two metres short.
 */
export const GARAGE_WING_EAST = -6

/**
 * §7.8.12 [redesigned again 2026-10-07]: a courtyard cut into the frontage,
 * a chamfered east wing and a projecting west lounge. The former little garden
 * bay still read as a rectangular hall, and the user found its desks cramped.
 * More floor only helps if the pods move into it: five teams now spread across
 * the wings around Billy, while the established leadership stations stay put.
 * The south-west chamfer's outward normal (+X,+Z) faces the camera and carries
 * the entrance; drawing every edge from this polygon keeps doors and routes
 * on the actual shell, rather than the obsolete rectangular wall runs.
 */
export const GARAGE_OUTLINE: readonly (readonly [number, number])[] = [
  [-10, -9.8], [10, -9.8], [16, -3.8], [16, 4], [11, 9],
  [4, 9], [4, 5], [-2, 5], [-2, 8], [-6, 8], [-10, 12],
  [-13, 12], [-13, 2], [-10, 2],
] as const

/** The six-metre outdoor court is a void in the work floor, not another indoor bay. */
export const HQ_GARDEN = { x0: -2, x1: 4, z0: 5, z1: 9 } as const

/** Flush finishes organise the workshop without adding an obstacle to its two Billy lanes. */
export const HQ_FINISHES = [
  { x0: -6.8, x1: 9.8, z0: -5.95, z1: -3.5, colour: '#a2ada5', name: 'Hero gallery' },
  { x0: -2.6, x1: 2.6, z0: -3.5, z1: 4.85, colour: '#a2ada5', name: 'Meeting avenue' },
  { x0: -12.85, x1: -3.0, z0: 2.5, z1: 4.4, colour: '#a2ada5', name: 'West promenade' },
  { x0: 3.1, x1: 13.0, z0: 2.8, z1: 4.5, colour: '#a2ada5', name: 'East promenade' },
] as const

/**
 * **The hero quarter** [re-planned 2026-10-05, GDD §7.8.12, at the user's instruction]. It has been
 * answered six times, and the answers are the argument:
 *
 * 1. *"I don't see any heroes"* — the first row of desks stood behind James's, at the top edge of the
 *    frame. Answered with one terrace along the whole north wall and three sets on it in a row.
 * 2. *"just line them up like that is boring. can you redesign the room and put them in properly, assume
 *    you are an architect and interior designer"* — three frontages of one width and depth are a shop
 *    window. Answered with a plan: each hero where their work belongs.
 * 3. *"a bit too clustered, the ME should still be top left as the boss, james next to us. Billy is too
 *    clusterd you can put him a side, he doesn't need a crowd."* — answered by leaving the pair alone.
 * 4. *"I asked founder on top right, his desk redesigned, mat got so sqaushed and we can do without the
 *    kitchen now. I still don't like all of these, do another version"* — the boss to the north-east
 *    corner; the kitchen gone; a redesigned desk; Matt given room.
 * 5. *"I want to be at top left, at the top of the topology"* — the boss to the north-west corner, on the
 *    west wall, with James beside; the heroes along the north wall.
 * 6. *"I want the me even more promenant, on a platform. also I see the wall are tool low, make them
 *    higher. billy should face us and he's too short, design again, they don't have to be all around
 *    the wall, put billy in the mix of devs so he's not just meetinging himself, do another cut, you can
 *    enlarge the room if it make sense"* — **this one.**
 *
 * - **The boss has a podium.** The north-west corner is a block 1.2 m high and 4.6 m square, the highest thing in
 *   the room, with a stair on its east face and a brass rail on the two faces the camera sees; the founder's desk
 *   stands on it **on the diagonal, facing the lens** — a corner office, which is what a corner is for — with the
 *   credenza across the corner behind. James is *next to* the boss, on an oak deck at its foot along the west
 *   wall, a step down. (`GARAGE_PODIUM`, `GARAGE_DECK`.)
 * - **The walls are 4.6 m** (`GARAGE_WALLS`), so what hangs on them — the studio's sign above the boss, the ticket
 *   wall, the dashboards, the name plates — hangs *on* them.
 * - **Billy is on the floor, among the developers.** The pods are spread to leave a plaza between the two columns —
 *   the avenue — and he stands at the mouth of it between the two north pods, at a rolling whiteboard whose face is
 *   turned to the lens, facing it himself. Not against a wall, not in a corner, not at a podium: *in the mix.* (He
 *   was against a wall in every cut before this one, and talking to it.)
 * - **Matt and Serena stay on the north wall**, which is where a wall-hung ticket board and a wall of dashboards
 *   belong; they are bigger (Matt 4.0 × 3.7 m, Serena 4.8 × 3.3 m) because the wall behind them is.
 *
 * *The room was not enlarged.* It was considered, and the camera decides: the HUD's message log covers the bottom
 * third of the picture, so a floor added toward the lens would be drawn under it, and a floor added behind the walls
 * is the backyard. What the plan needed was not more floor but the floor re-spent — the pods spread a metre and a
 * half either side of the avenue, the island, the locker and the hub planters gone, the project board shortened by
 * a metre — and that is what happened.
 *
 * *Tried and rejected, by measurement against the real camera.* The boss pair side by side along the north wall
 * (four sets in a line again). Matt in the entry wing (its far corner projects behind the HUD's left column).
 * A hero in the east bay (no back wall, so his back would be to the lens). Billy at the crossing's exact centre (the
 * assembly closes the east–west aisle, and a studio whose west half cannot walk to its east half is two studios).
 *
 * **Arrival order and the old wall.** Billy arrives first, then Serena, then Matt. Only Serena has a wall to hide
 * behind: on §12.1's camera a wall hides what is behind it along (−1, −1), so the partition east of a bay is the one
 * in front of it — and Matt, west of her, comes after it has gone. Billy is on the open floor and his board, rug and
 * lamp drop in with him; the boss is there from the first frame.
 */

/** The inner faces of the two back walls, the two the camera sees. Every site is built against one. */
export const GARAGE_WALL_FACES = { north: -9.68, west: -9.88 } as const

/**
 * **The founder's podium** [2026-10-05, *"I want the me even more promenant, on a platform"*] — the north-west
 * corner, 1.2 m up: 4.58 m along the north wall and 4.48 m along the west one. It was sized for a desk on the diagonal —
 * a 2.9 m desk with a rug turned 45° reaches 2.2 m from the station in each of two directions, with a credenza across
 * the corner behind that reaches 2.0 m back — and the desk is square to the walls now, facing the room as Matt's and
 * Serena's do (see {@link GARAGE_LEADERS}): the assembly is 2.9 m wide and 3.1 m deep, with a rug a hand beyond it, on a
 * podium of 4.6 by 4.5 — the same podium holds it with most of a metre of floor either side of the desk, which is the
 * boss's own lobby.
 */
export const GARAGE_PODIUM = { x0: GARAGE_WALL_FACES.west, z0: GARAGE_WALL_FACES.north, x1: -5.3, z1: -5.2, rise: 1.2 } as const

/**
 * **James's deck** — the oak terrace at the podium's foot, along the west wall: 2.9 m wide, which holds a desk, the
 * chair behind it and nothing else, and 4.6 m long, from the podium's south face to a hand short of the project
 * board's base. One step up (0.24 m), against the podium's four: the boss is *above* James, and James is above the
 * floor, which is the org chart.
 */
export const GARAGE_DECK = { x0: GARAGE_WALL_FACES.west, z0: -5.2, x1: -7.0, z1: -0.6, rise: 0.24 } as const

export type HeroSiteId = 'matt' | 'serena' | 'billy'

/**
 * **Where each hero's set stands, and nothing of it leaves.** A site is the floor the
 * set owns — against one of the two back walls, on its own platform, or (Billy) free on the
 * floor — and `hqSets.test.ts` builds the sets and *measures* them against these: inside the
 * rectangle, in front of the wall, under the ceiling, clear of their neighbours.
 *
 * `rise` is the platform's height above the studio floor: Serena's is the Ops Room's plinth,
 * Matt's is a riser a hand high, Billy has none (he is standing on the floor, with the rest of
 * the studio). `round` is Billy's octagon of rug: its centre and *apothem* (flat to centre).
 */
export interface HeroSite {
  /** The back wall the set hangs on: the north wall (its set faces +z), the west one (faces +x), or none (free). */
  readonly wall: 'north' | 'west' | 'free'
  readonly x0: number
  readonly x1: number
  readonly z0: number
  readonly z1: number
  readonly rise: number
  readonly round?: { readonly x: number; readonly z: number; readonly apothem: number }
}
export const HERO_SITES: Readonly<Record<HeroSiteId, HeroSite>> = {
  // The north wall's west part, 4.0 m along it and 3.7 m out, 1.9 m east of the podium's stair: a front desk the size of
  // a front desk, with a lobby in front of it.
  matt: { wall: 'north', x0: -3.6, x1: 0.4, z0: GARAGE_WALL_FACES.north, z1: -6.0, rise: 0.2 },
  // 4.8 m of plinth and glass, 1.6 m east of Matt's riser, with 3.1 m to the east wall for the water cooler and the
  // corner it makes. The wall of six is as wide as the plinth, and the clerestory is above it.
  serena: { wall: 'north', x0: 2.0, x1: 6.8, z0: GARAGE_WALL_FACES.north, z1: -6.38, rise: 0.9 },
  // The mouth of the avenue between the two north pods, on the open floor: an octagon of rug 3.2 m across with a
  // rolling board on it facing the lens and a man on a dais facing it too (`BILLY_PLAZA`). The rectangle is the rug's
  // bounding square, which holds the board and the dais with a hand to spare.
  billy: { wall: 'free', x0: -2.35, x1: 0.95, z0: -1.0, z1: 2.3, rise: 0, round: { x: -0.7, z: 0.65, apothem: 1.6 } },
}

/**
 * **Billy's plaza, in his station's own frame** [2026-10-05] — unscaled metres, +z toward the lens, +x screen right, the
 * station at the origin. These are the numbers the set is drawn from (`render/hqSets.ts`) and the footprint the walk
 * grid closes is derived from (`billyFootprint`), so a board that moves in the picture moves in the graph on the same
 * edit: the dais he stands on (an octagon, flats to the axes) and the rolling whiteboard — its centre, its width and the
 * half-length of the feet that carry it. The board is a step behind him and a metre and a fifth to his left, its
 * right-hand end a hand behind his shoulder.
 *
 * **They are as small as they are because of the avenue** [found by `walkableRegions`, not by looking]. The avenue is
 * 4.96 m between the pods' tables, the walk grid pads every table and the board's footprint by a quarter metre and
 * samples at half-metre cells, so a lane beside the board is open only if it is a metre wide. The first cut of the
 * plaza (a 2.0 m board and a 1.3 m dais) was 3.3 m across, left 0.9 on one side and 0.6 on the other, and shut the
 * avenue's mouth altogether: the north half of the studio could not walk to the south half. At 2.67 m across, each
 * lane is 1.1 m and the studio is one place again. (A board turned to the lens is a diagonal bar whose bounding
 * square is twice its length on a side, which is why a shorter board buys a lane and not a shorter wall.)
 */
export const BILLY_PLAZA = {
  dais: { apothem: 0.52, rise: 0.16 },
  board: { x: -1.2, z: -0.55, w: 1.8, feet: 0.35 },
} as const
/** The terraces the walk grid is closed over: reached by a step, which a flat half-metre grid cannot say. */
export const GARAGE_PLATFORMS = [GARAGE_PODIUM, GARAGE_DECK, HERO_SITES.serena, HERO_SITES.matt] as const
export const GARAGE_HERO_SCALE = 1.25

/** Five teams spread across the courtyard's two wings; twenty hires retain their pod order (§6). */
export const GARAGE_PODS: readonly { x: number; z: number; rot: 0 | 90 }[] = [
  { x: 5.0, z: -1.0, rot: 0 }, { x: -9.0, z: 6.4, rot: 0 }, { x: -5.0, z: -0.8, rot: 0 },
  { x: 12.0, z: 0.1, rot: 90 }, { x: 7.2, z: 6.4, rot: 0 },
] as const

export const LEADER_IDS = ['founder', 'james', 'billy', 'serena', 'matt'] as const
export type LeaderId = typeof LEADER_IDS[number]
export const leaderSeat = (id: LeaderId): number => -1 - LEADER_IDS.indexOf(id)
/**
 * The roster, and the garage's two stations.
 *
 * Every id and seat number in the game comes from here; the coordinates are the
 * garage's, which is why only `GARAGE_LEADERS` reads them. §13.1: "Garage
 * leadership is exclusively the founder and James, with two desks total."
 */
export const LEADER_STATIONS = LEADER_IDS.map((id, i) => ({ id, seat: leaderSeat(id), x: -8.1 + i * 2.7, z: -5.9 }))

/**
 * **The stations.** `rot` is the station's yaw in degrees: 0 faces +z, 90 faces +x, and **45 faces the lens** —
 * the diagonal (+x, +z) that §12.1's camera looks back along. Every set is authored in its station's own frame
 * (the person at the origin facing local +z, the desk in front of them), so a turn costs a set nothing.
 *
 * - **The founder** (−7.6, −7.9), rot 0: **the whole station — desk, credenza, rug, chair and person — faces the room the
 *   isometric way, as Matt's and Serena's do.** It was turned to the lens (rot 45: a corner office on the diagonal, which
 *   read as a different language from the other four stations); then, on *"turn ME towards James so looking at the west
 *   direction"*, toward James's deck, and the user's answer to that was *"not toward james, I mean facing down right, the
 *   isometric way, like matt and serena"* [2026-10-07]. The credenza stands 0.32 m off the north wall behind the desk, the
 *   rug clears both walls and both rails by 0.3 m and more, and the lane from the stair runs behind the desk to the chair.
 * - **James** (−9.0, −3.4), rot 90: on the deck, the desk running along the wall from z −4.8 to −2.0 and his Diet
 *   Coke cabinet at its south end to −1.37. (He was at (−8.4, −4.4), and before that at (−0.7, −4.5).)
 * - **Matt** (−1.6, −8.4) and **Serena** (4.4, −8.3), rot 0, at the middles of their sites.
 * - **Billy** (0.1, 0.19), rot 45: on his dais at the east end of his board, with the lens in front of him. The
 *   assembly (board, feet and dais) is centred in the avenue to within a tenth: 1.1 m from the west pods' tables and
 *   1.2 m from the east ones, so there is a lane either side of it.
 */
export const GARAGE_LEADERS = [
  { id: 'founder' as LeaderId, seat: leaderSeat('founder'), x: -7.6, z: -7.9, rot: 0 },
  { id: 'james' as LeaderId, seat: leaderSeat('james'), x: -9.0, z: -3.4, rot: 90 },
  { id: 'matt' as LeaderId, seat: leaderSeat('matt'), x: -1.6, z: -8.4, rot: 0 },
  { id: 'serena' as LeaderId, seat: leaderSeat('serena'), x: 4.4, z: -8.3, rot: 0 },
  { id: 'billy' as LeaderId, seat: leaderSeat('billy'), x: 0.1, z: 0.19, rot: 45 },
]

/**
 * **The HQ floor** — GDD §5 [redesigned 2026-09-25, at the user's instruction:
 * *"Office scene needs redesign, do it, fitting of the game"*, then *"I don't
 * want my garage moved to a building, the office scene takes a new floor
 * layout design"*].
 *
 * The retired office was a 500-seat plate eighty metres across: five
 * neighbourhoods of identical pods that read as a chart at the only zoom that
 * showed all of it. This is the concept the user reviewed (`docs/assets/
 * concepts/empire-2026-09-24/hq-floor-v1.png`): the top storey of the first
 * tower, small enough to know everybody on it, with **the hero row along the
 * back wall** — the founder and James side by side, Billy at the board, Serena
 * among her dashboards, Matt in front of his ticket wall — pods in front of
 * them, a kitchen, a sofa corner, a glass meeting room, the lift, and glazing
 * on the two near sides with the city in the haze below.
 *
 * 36 × 26 m. Forty ordinary desks in ten pods of four, in two groups with a
 * cross aisle, so every desk is reachable without walking round a 24 m bench.
 * Everybody past the fortieth works in the city's towers (`sim/cityGrid.ts`).
 *
 * Every piece that is drawn is here with its footprint (§18.3, 禁止穿模): the
 * walk grid is derived from this list and nothing else, and the renderer draws
 * from it.
 */
export const OFFICE_OUTLINE: readonly (readonly [number, number])[] = [[-18, -13], [18, -13], [18, 13], [-18, 13]]

/** The raised hero row along the back wall: a timber deck, drawn only. */
export const OFFICE_DECK = { x0: -15.2, z0: -13, x1: 18, z1: -7.6 }
/** The lift, in the back-west corner; its doors open onto +z. */
export const OFFICE_CORE = { x0: -18, z0: -13, x1: -15.4, z1: -9.6 }
export const OFFICE_ROOMS = [
  { x0: -18, z0: -7.4, x1: -12.8, z1: -1.6, label: 'Sync', door: 'east' },
] as const
/** Ten pods of four: two groups per row, a cross aisle between them. */
export const OFFICE_PODS: readonly { x: number; z: number; rot: 0 | 90 }[] = [-3.9, 3.6].flatMap(z =>
  [-8.4, -3.6, 3.0, 7.8, 12.6].map(x => ({ x, z, rot: 0 as const })))
export const OFFICE_HERO_SCALE = 1.3
/**
 * The hero row. Every station faces the room (rot 0: the desk on local +z,
 * the occupant facing the camera), with a walkway between the chairs and the
 * back wall so everybody reaches their seat from behind (§18.3). Each plot's depth is its own — Billy
 * stands at his board and needs less floor than a desk does, which is what
 * leaves room for the huddle in front of him.
 */
export const OFFICE_LEADERS = [
  { id: 'founder' as LeaderId, seat: leaderSeat('founder'), x: -11.2, z: -10.4, rot: 0, standing: false },
  { id: 'james' as LeaderId, seat: leaderSeat('james'), x: -6.6, z: -10.4, rot: 0, standing: false },
  { id: 'billy' as LeaderId, seat: leaderSeat('billy'), x: 0, z: -11.9, rot: 0, standing: true },
  { id: 'serena' as LeaderId, seat: leaderSeat('serena'), x: 6.6, z: -10.4, rot: 0, standing: false },
  { id: 'matt' as LeaderId, seat: leaderSeat('matt'), x: 11.8, z: -10.4, rot: 0, standing: false },
]
export const OFFICE_PLOTS = OFFICE_LEADERS.map(s => s.standing
  ? { id: s.id, x0: s.x - 1.2, x1: s.x + 1.2, z0: -12.6, z1: -11.2 }
  : { id: s.id, x0: s.x - 2.2, x1: s.x + 2.2, z0: s.z - .8, z1: s.z + 2.25 })
/** The lift's doors, and an open spot in the aisle below the founder's desk. */
export const OFFICE_ARRIVAL = { start: { x: -16.7, z: -8.9 }, landing: { x: -10.4, z: -6.9 } }
export const OFFICE_DROP_ZONES = [{ x: .1, z: -.7 }, { x: -6, z: 7.6 }, { x: 15.6, z: 7.6 }] as const
/** The lounge rug, drawn under the sofa corner. */
export const OFFICE_MAT = { x: -15.1, z: 10.6, w: 5.6, d: 4.4 }
/** §9 — the empty base a prestige reward will stand on: front right, by the glass. */
export const OFFICE_PRESTIGE_RESERVE = { x: 9.5, z: 10, w: 2.4, d: 2.4 }

/** Which stations the floor being drawn actually has. One authority per room. */
/** `rot` is published because an arrival has to know which side of a station
 * the chair is on — see {@link stationApproach}. */
export const leadersIn = (place: Place): readonly { id: LeaderId; seat: number; x: number; z: number; rot: number }[] =>
  place === 'garage' ? GARAGE_LEADERS : OFFICE_LEADERS

/**
 * Where somebody stands to sit down at a hero station: **behind the chair**.
 *
 * A station's `rot` turns its whole group, and every station is authored with
 * the desk on its local +z — so the occupant's back is toward `rot + 180°` and
 * that is the only side of the plot you can walk in from without walking
 * through the desktop.
 *
 * It is a function rather than four hand-written offsets because the garage
 * redesign turned the founder from `rot: 180` to `rot: 0` and the arrival kept
 * its hard-coded `home.z + .55`, which had been *behind* the old chair and was
 * now the middle of the new desk: the opening walked the founder through his
 * own monitor to sit down (§9.2 — two answers to one question).
 */
export function stationApproach(place: Place, seat: number, back: number): Point {
  const station = leadersIn(place).find(s => s.seat === seat)
  if (!station) return { x: 0, z: 0 }
  const radians = ((station.rot ?? 0) * Math.PI) / 180
  return { x: station.x - Math.sin(radians) * back, z: station.z - Math.cos(radians) * back }
}
/** The entry faces (+X,+Z), square to the fixed camera [2026-10-07, §7.8.12]. */
export const STUDIO_DOOR = { x: -8, z: 10, width: 3, height: 2.75, yaw: Math.PI / 4 } as const

/**
 * The entry wing's street gable — the run of wall to the left of the door.
 *
 * It is here rather than in the renderer because two things now depend on the
 * same four metres and they must not drift (§9.2): the wall is *drawn* from
 * these numbers, and §13.1's studio name is *mounted on it*. It became a
 * surface worth naming on 2026-09-14, when it stopped being a knee-high
 * parapet — a 4 × 3.2 m blank plane facing the street is the only tall
 * camera-side wall the building has, and leaving it empty was the cost of
 * raising it.
 */
export const STUDIO_GABLE = { x0: -13, x1: -10, z: 12, thickness: 0.24 } as const
/** Just inside the diagonal portal, 0.9 m along its inward normal. */
export const GARAGE_ENTRY_START = { x: STUDIO_DOOR.x - .9 / Math.SQRT2, z: STUDIO_DOOR.z - .9 / Math.SQRT2 } as const
/**
 * Where the founder puts the boxes down — the garage's half of
 * {@link OFFICE_ARRIVAL}, and here for the same reason that is.
 *
 * It lived in `render/arrivalDirector.ts` as `{ x: 1.5, z: 3.0 }`, which was
 * the middle of the floor until the 2026-09-20 redesign moved the pods. After
 * it, `walkable('garage', 1.5, 3)` is `false`: the landing was inside pod 4's
 * reserved footprint, so the boxes were set down on a desk, the founder stood
 * in one, and the route's last leg was a straight line into blocked ground.
 * That is exactly the drift §18.3 keeps the layout in `sim/` to prevent — the
 * pods moved in the plan and the one number that had to move with them was in
 * the other module.
 *
 * This is the crossing of the two aisles, south of Billy's rug: the north pods end at z = 0.5 and the south
 * ones begin at 3.0, and x = −1.7 is in the avenue between the columns (−3.2…1.8), clear of the easel's
 * footprint to its east.
 */
export const GARAGE_ARRIVAL_LANDING = { x: -1.7, z: 2.55 } as const
/**
 * The foot of the founder's stair: the way on to the podium, from the north court. The stair is on the podium's
 * east face (x = −5.3) at z −8.0…−6.2, three treads of 0.4 m, so a walker stepping up from here at x = −4.7 comes
 * out east of the desk's end (x −6.2) and walks west along the lane behind the desk, between it and the credenza, to the
 * chair: 1.3 m wide. Straight from the aisle to the chair — which is what {@link route} draws across closed ground —
 * would walk the founder through their own desk. (Nothing in the game uses this yet; it is the lane the opening will want.)
 */
export const GARAGE_DECK_ENTRY = { x: -4.7, z: -7.1 } as const

/**
 * The four seats at a pod, on whichever axis the pod is turned to.
 *
 * **A body's face is its local −z**, which is why the yaw that *faces* a
 * direction is {@link yawToward} rather than the direction's own angle. The
 * turned case is a half turn out from the obvious answer in both directions,
 * and getting it wrong seats everybody with their back to their monitor —
 * legible in a still frame and invisible to any test that only checks where
 * the chairs are.
 */
export function seatsAtPod(pod: { x: number; z: number; rot: number }, first: number, index: number) {
  return Array.from({ length: 4 }, (_, i) => {
    const along = i % 2 ? 0.66 : -0.66
    const across = i < 2 ? -1.02 : 1.02
    return pod.rot === 90
      ? { seat: first + i, pod: index, x: pod.x + across, z: pod.z + along,
        facing: i < 2 ? -Math.PI / 2 : Math.PI / 2 }
      : { seat: first + i, pod: index, x: pod.x + along, z: pod.z + across,
        facing: i < 2 ? Math.PI : 0 }
  })
}

/** Four independent desks per staggered team, with a visible gap between tops. */
export const garageSeats = () => GARAGE_PODS.flatMap((pod, p) =>
  seatsAtPod(pod, p * 4, p).map((seat, i) => {
    const along = i % 2 ? .92 : -.92, across = i < 2 ? -1.38 : 1.38
    return { ...seat, x: pod.x + (pod.rot === 90 ? across : along),
      z: pod.z + (pod.rot === 90 ? along : across) }
  }))

/**
 * Which desk group a seat belongs to — GDD §6.1, and the authority for it.
 *
 * Both floors number their seats pod by pod, four at a time, which is what
 * {@link seatsAtPod}'s `first = p * 4` says; this is that same fact asked the
 * other way round. It exists because the renderer now groups output callouts
 * by desk group (§8.2a, amended 2026-09-14) and a second `Math.floor(seat / 4)`
 * in `render/` would be a second answer to a question this file already owns.
 */
export const podOf = (seat: number): number => Math.floor(seat / 4)

/** Crossing count against a closed outline. Both rooms are polygons now. */
function inPolygon(poly: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Is this point on the garage slab? The outline is a polygon now, not a box. */
export const studioFloorContains = (x: number, z: number): boolean => inPolygon(GARAGE_OUTLINE, x, z)

/** Is this point on the office slab? */
export const officeFloorContains = (x: number, z: number): boolean => inPolygon(OFFICE_OUTLINE, x, z)

/**
 * The office floor's hundred seats, from the same function the garage uses.
 *
 * This was a pair of `for` loops with two magic numbers — `-8.6 + col * 4.3`,
 * `-5.2 + row * 4.1` — and the loops were the layout. A grid cannot express a
 * pod that is turned, which is why every desk on the old floor pointed the same
 * way and why the room read as a rank however it was dressed. {@link OFFICE_PODS}
 * is authored, and everything below is derived from it.
 *
 * Cached because a hundred seats are rebuilt on every call otherwise, and
 * `benches` alone asks twenty-five times per grid.
 */
let officeSeatCache: ReturnType<typeof seatsAtPod> | null = null
export const officeSeats = (): ReturnType<typeof seatsAtPod> =>
  (officeSeatCache ??= OFFICE_PODS.flatMap((pod, p) => seatsAtPod(pod, p * 4, p).map((seat,i)=>({...seat,x:pod.x+(pod.rot===90?(i<2?-1.38:1.38):(i%2?.92:-.92)),z:pod.z+(pod.rot===90?(i%2?.92:-.92):(i<2?-1.38:1.38))}))))

/** How many pods this floor has. §6.1: twenty-five of four. */
export const OFFICE_POD_COUNT = OFFICE_PODS.length

/** Where a pod is. Kept as a function because callers ask by number, not by index. */
export const officePod = (pod: number): Point => OFFICE_PODS[pod] ?? { x: 0, z: 0 }

/** A seat on the office floor, in the same local order the garage uses. */
export function officeSeat(local: number): { x: number; z: number; facing: number; pod: number } {
  const s = officeSeats()[local]
  return s ? { x: s.x, z: s.z, facing: s.facing, pod: s.pod } : { x: 0, z: 0, facing: 0, pod: 0 }
}

/** Where a seat is, on whichever floor is drawing bodies. */
export function seatAt(place: Place, seat: number): Point | null {
  if (seat < 0) {
    // The floor's own station, falling back to the roster for a hero this room
    // does not have — the garage has no Billy, and a caller asking anyway
    // should get the old answer rather than a null it never handled before.
    const station = leadersIn(place).find(s => s.seat === seat)
      ?? LEADER_STATIONS.find(s => s.seat === seat)
    return station ? { x: station.x, z: station.z } : null
  }
  if (place === 'garage') {
    const s = garageSeats()[seat]
    return s ? { x: s.x, z: s.z } : null
  }
  const s = officeSeats()[seat]
  return s ? { x: s.x, z: s.z } : null
}

/** Which floor a studio of this size is drawn on. Mirrors `worldScale.worldRank`. */
export function placeFor(headcount: number): Place {
  return headcount <= 20 ? 'garage' : 'office'
}

// ---------------------------------------------------------------------------
// Furniture — drawn from here, and blocking because it is drawn
// ---------------------------------------------------------------------------

/**
 * A piece of furniture, as a footprint on the floor.
 *
 * `kind` is what the renderer switches on to draw it; `w`/`d` are the full
 * extents, so the rectangle it blocks is `x ± w/2` by `z ± d/2`. A `facing` of
 * 0 looks toward +z.
 *
 * **Only the pieces that stand in circulation are here.** Wall dressing, art,
 * crates against a shelf and the pegboard over a workbench never change whether
 * a route exists, and listing them would be a second copy of the room that has
 * to be kept in step for no gain.
 */
export interface Furniture {
  readonly kind: 'counter' | 'sofa' | 'coffee-table' | 'board' | 'shelving' | 'unit' | 'planter'
    | 'bench' | 'locker' | 'island' | 'screen' | 'banner' | 'cooler' | 'easel'
  readonly x: number
  readonly z: number
  readonly w: number
  readonly d: number
  readonly facing?: number
  /**
   * How tall it stands, where that matters.
   *
   * Only three pieces care, and they all care for the same reason: §13.1 says a
   * prop's "screen silhouette must not hide any workstation", and on §12.1's
   * fixed camera a thing of height *h* hides exactly the band of floor swept
   * *h* metres along (−1, −1). A 1.8 m locker run, a 2.75 m banner gantry and a
   * 2.8 m glazed screen are the only office pieces tall enough for that band to
   * reach a seat, so their heights are written down where the layout can be
   * checked against them rather than left to the geometry that draws them.
   */
  readonly h?: number
  /**
   * Knee-high rather than shoulder-high, so it claims no {@link CLEARANCE}.
   *
   * The distinction earns its keep in the garage's break corner, which is the
   * tightest metre of either room. A coffee table is 0.42 m tall: you walk
   * round it, but you walk round it *closely*, and charging it the same
   * quarter-metre of elbow room as a kitchen counter sealed the sofa into a
   * pocket — a developer three metres from the sofa walked sixteen metres
   * round the whole floor to sit on it. Clearance exists so a shoulder does
   * not pass through a worktop; a shin has different rules.
   */
  readonly low?: boolean
}

/**
 * The garage's obstacles, mirroring `render/garageEnvironment.ts`.
 *
 * The cooler, the sofa group and the sprint board are *drawn* from these
 * entries. The workshop bench and the shelving are drawn in place — they are
 * built out of a dozen boxes each and reducing them to a rectangle would lose
 * the room — so their footprints are restated here with the geometry cited.
 */
export const GARAGE_FURNITURE: readonly Furniture[] = [
  /*
   * **There is no kitchen** [2026-10-05, at the user's instruction: *"we can do without the kitchen
   * now"*]. A 4.3 m run of cupboards and a tall unit stood on the north wall's east end from
   * 2026-09-21; the boss's deck is there now. The water errand has a cooler (below) and nothing
   * else of the kitchen is missed by the walk grid, which only ever read two rectangles of it.
   */
  // One wall-mounted project board replaces the bench and freestanding sprint board. Its tray is included in the
  // walking footprint; huddle slots stay on its +x side. **3.8 m, not 4.82, and a metre south of where it was**
  // [2026-10-05]: the podium and James's deck took the west wall's north end, and the board's base now starts
  // 0.1 m south of the deck's.
  { kind: 'board', x: -9.72, z: 0.7, w: .55, d: 2.4, h: 3.2, facing: Math.PI / 2 },
  /*
   * The lounge, backed onto the west wall and looking across the floor.
   *
   * [amended 2026-09-14, at the user's instruction.] It stood a metre off the
   * canted glazed corner, facing −z, which put it *in the entrance*: the one
   * piece of furniture in the room whose whole job is to be somewhere to sit and
   * watch the studio was parked in the draught between the door and the street,
   * with its back to a doorway and nothing behind it. A sofa wants a wall.
   *
   * This one is the wall the camera looks straight at — the west run, whose
   * inner face points +X — so the lounge reads front-on at the top left of the
   * frame and the people on it face the room. The turn is why the footprint
   * below is 0.84 by 3.1 rather than 3.1 by 0.84: §18.3 blocks an *axis-aligned*
   * rectangle, so a quarter turn swaps `w` and `d`, and the renderer takes the
   * piece's own length and depth back out of the pair through `facing`.
   *
   * It stops at z = 6.95 and not at the wing's corner: the wing's wall at z = 11 sweeps its silhouette back along
   * (−1, −1) over the floor from z = 7.8 to the corner, and furniture parked in that band is drawn with its feet cut off.
   */
  { kind: 'sofa', x: -12.46, z: 5.8, w: 0.84, d: 3.1, facing: Math.PI / 2 },
  { kind: 'coffee-table', x: -11.3, z: 5.8, w: 0.6, d: 1.5, low: true, facing: Math.PI / 2 },
  /*
   * **Billy's easel and Billy** [2026-10-05]: the rolling whiteboard (1.8 m of board, turned to the lens) and the man
   * on his dais beside it, as one footprint — the smallest axis-aligned rectangle that holds both, derived from
   * `BILLY_PLAZA` and not typed. The walk grid pads it by a quarter metre. The rug is flat and walkable.
   */
  { kind: 'easel', ...billyFootprint() },
  // Planting: one by the south pods' east end; the hub planters are gone (the hub is Billy's).
  { kind: 'planter', x: 3.4, z: 4.1, w: .7, d: .7, low: true },
  { kind: 'planter', x: 14.7, z: -2.5, w: .8, d: .8, low: true },
  // **The planter that stood in the south corridor, at (4.1, 7.2), is gone, and the reading bench is half a metre further
  // east**: together they shut the corridor between the south-east pod and the wall, and the south-east corner — four
  // metres square, with the other planter and the bench in it — was a room of its own that nobody could walk to
  // (`walkableRegions` said four).
  // The water cooler, in the north-east corner past Serena's plinth: it was against the east wall, and the pod there
  // is where it was.
  { kind: 'cooler', x: 9.3, z: -9.25, w: .7, d: .7 },
  { kind: 'bench', x: 10.5, z: 7.8, w: 1.8, d: .62, low: true },
]

/**
 * The office floor's obstacles, mirroring `render/officeEnvironment.ts`.
 *
 * Everything here is *drawn* from these entries, so a sofa that moves in the
 * picture moves in the walkability graph on the same edit — which is the whole
 * reason §18.3 keeps the layout in `sim/`. The shapes are still authored in the
 * renderer, because a kitchen run is a dozen boxes and reducing it to a
 * rectangle would lose the room; what lives here is the decision about *where*.
 */
export const OFFICE_FURNITURE: readonly Furniture[] = [
  // Billy's board, on the back wall behind him: the project, drawn (§12.4).
  { kind: 'board', x: 0, z: -12.72, w: 5.2, d: .28, h: 3.2 },
  // The kitchen, along the west wall: counter, fridge and coffee at its south end.
  { kind: 'counter', x: -17.3, z: 4.2, w: 1.2, d: 6.4, facing: Math.PI / 2 },
  // The sofa corner.
  { kind: 'sofa', x: -17.2, z: 10.6, w: .9, d: 3.6, facing: Math.PI / 2 },
  { kind: 'coffee-table', x: -14.9, z: 10.6, w: 1, d: 2, low: true },
  { kind: 'sofa', x: -12.7, z: 10.6, w: .9, d: 3.6, facing: -Math.PI / 2 },
  // The front lounge: where the room meets the glass — two sofas, a low table.
  { kind: 'sofa', x: 1.2, z: 8.6, w: 3.6, d: .9, facing: Math.PI },
  { kind: 'coffee-table', x: 1.2, z: 10.4, w: 2.2, d: 1, low: true },
  { kind: 'sofa', x: -3.1, z: 10.4, w: .9, d: 3.2, facing: Math.PI / 2 },
  // The reserved base (§9) — knee-high and empty until a reward stands on it.
  { kind: 'coffee-table', ...OFFICE_PRESTIGE_RESERVE, h: .06, low: true },
  // Planters: along the front glass, and at the ends of the cross aisle.
  ...[-9.5, -6, 5.5, 13.5, 16.8].map(x => ({ kind: 'planter' as const, x, z: 12.3, w: 1, d: 1 })),
  { kind: 'planter' as const, x: 16.9, z: -7.6, w: 1, d: 1 },
  { kind: 'planter' as const, x: 16.9, z: 1.4, w: 1, d: 1 },
]

export const furnitureIn = (place: Place): readonly Furniture[] =>
  place === 'garage' ? GARAGE_FURNITURE : OFFICE_FURNITURE

// ---------------------------------------------------------------------------
// Destinations — §18.1
// ---------------------------------------------------------------------------

/**
 * Somewhere to be, and how many people can be there at once.
 *
 * `slots` is §18.1's "at most 2–3 reserved participants" generalised: an errand
 * picks a destination *with a free slot*, and a floor whose only cooler is busy
 * sends the next person somewhere else rather than stacking two bodies in one
 * square metre. It is also the mechanism behind "Do not send a body to an
 * invisible prop": every slot below is a place the renderer actually draws.
 */
export interface Destination {
  readonly kind: Errand
  /** Standing positions, in the order they are claimed. */
  readonly slots: readonly Point[]
  /** Which way to look once you arrive, as a yaw. See {@link yawToward}. */
  readonly facing: number
  /**
   * The walkable spot in front of this destination, when the slots themselves
   * are not walkable.
   *
   * **A sofa needs one and nothing else does.** Sitting on a sofa means
   * finishing inside a blocked rectangle, and {@link route} handles that by
   * snapping the end of the walk outward to the nearest open cell — which is
   * geometry, not intent, and geometry does not know that the *back* of a sofa
   * is nearer to some seats than the front. It picked the back, twice, in two
   * different rooms, and the symptom both times was a developer walking twenty
   * metres round the floor to sit down two metres away.
   *
   * Authoring the approach says which side is the front, once, where the sofa
   * is defined. The last step from here onto the cushion is a stub, exactly as
   * the first step out from under a desk is.
   */
  readonly approach?: Point
}

/**
 * The yaw that points a body's face along `(dx, dz)`.
 *
 * **A body's face is its local −z**, which is where `studioPeople.ts` puts the
 * eyes, and `garageSeats` already encodes that: a seat on the −z side of a
 * table has `facing: Math.PI`, because a half turn is what swings local −z
 * round to world +z so the occupant looks at the desk.
 *
 * Written down as a function because it was got wrong first: the obvious
 * `atan2(dx, dz)` is the yaw of the direction, which is exactly a half turn
 * from the yaw that *faces* it, and the symptom is an entire floor of people
 * walking backwards — legible enough in a still frame that a screenshot review
 * would have passed it.
 */
export function yawToward(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/**
 * The garage's four destinations and its loitering spots.
 *
 * Every one of these is measured against `garageEnvironment.ts`: the water
 * point is the cooler against the east wall, the whiteboard is the sprint board,
 * the window is the street door's glass and the sofa is the blue two-seater in
 * the break corner. The loiter spots are the crossing south of Billy's rug, the north court and the
 * corner by the fifth pod, which is where you meet anyone in a room this shape.
 */
const garageCooler = GARAGE_FURNITURE.find(f => f.kind === 'cooler')!
const GARAGE_DESTINATIONS: readonly Destination[] = [
  // Facing the cooler, which is against the north wall: the standing spots are south of it, 0.95 m off its
  // centre, an arm's length from the front of it and clear of the 0.25 the piece claims.
  { kind: 'water', facing: yawToward(0, -1),
    slots: [{ x: garageCooler.x, z: garageCooler.z + 0.95 }, { x: garageCooler.x - 0.75, z: garageCooler.z + 0.95 }] },
  // Huddles stand in the clear aisle beside the board, facing it.
  { kind: 'whiteboard', facing: yawToward(-1, 0),
    slots: [{ x: -8.5, z: -0.5 }, { x: -8.5, z: 0.5 }, { x: -8.5, z: 1.5 }] },
  /*
   * The street door's glass: you stand just inside it and look out. **It was the clerestory band on
   * the far wall**, and then the east glazing past the kitchen; the first was under the first hero terrace (two
   * developers on a window errand walked up an invisible stair and stood sunk in it) and the second is
   * under the boss's deck. A destination is a place the room draws and the walk reaches, and the
   * entry wing's door is both — it is also the one place in the room nobody is built over.
   */
  { kind: 'window', facing: yawToward(1, 1), slots: [
    { x: GARAGE_ENTRY_START.x - .45, z: GARAGE_ENTRY_START.z + .45 },
    { x: GARAGE_ENTRY_START.x + .45, z: GARAGE_ENTRY_START.z - .45 },
  ] },
  // Sitting with your back to the west wall, looking across the floor.
  // Approached between the sofa and its coffee table — see `approach`. The
  // approach is a cell centre on purpose: the gap between the two is 0.7 m and
  // the grid is 0.5, so a spot chosen by eye lands in the sofa's clearance.
  { kind: 'sofa', facing: yawToward(1, 0), approach: { x: -11.95, z: 5.8 },
    slots: [{ x: -12.76, z: 5.0 }, { x: -12.76, z: 6.6 }] },
  // The hub. Where you stand about in a room shaped like this, because it is
  // the one place every route passes.
  { kind: 'loiter', facing: 0, slots: [{ x: -2.4, z: 2.5 }, { x: 2.0, z: -4.2 }, { x: 6.7, z: 4.7 }] },
]

/** Office destinations are off the main loop: occupied slots never own a junction.
 * Sofa approaches reach the cushion from the front; Billy owns his own space,
 * and only actual away developers occupy the four whiteboard slots. */
const OFFICE_DESTINATIONS: readonly Destination[] = [
  // The coffee machine at the kitchen's south end, facing the counter (−x).
  { kind: 'water', facing: yawToward(-1, 0), slots: [{ x: -15.9, z: 5.6 }, { x: -15.9, z: 6.6 }] },
  // Billy's standup: a huddle in front of his board, facing it.
  { kind: 'whiteboard', facing: yawToward(0, -1), slots: [{ x: -1.1, z: -9.6 }, { x: 0, z: -9.3 }, { x: 1.1, z: -9.6 }] },
  // The east glazing, looking down at the city.
  { kind: 'window', facing: yawToward(1, 0), slots: [{ x: 17.3, z: -3.2 }, { x: 17.3, z: -2.2 }] },
  // The west sofa, approached from the gap between it and the coffee table.
  { kind: 'sofa', facing: yawToward(1, 0), approach: { x: -16.15, z: 10.85 }, slots: [{ x: -17.2, z: 9.9 }, { x: -17.2, z: 11.3 }] },
  // Where you stand about: the cross aisle's two ends and the front commons.
  { kind: 'loiter', facing: 0, slots: [{ x: -.2, z: -1 }, { x: -.2, z: 7.8 }, { x: 15.6, z: 7.6 }] },
]

export const destinationsIn = (place: Place): readonly Destination[] =>
  place === 'garage' ? GARAGE_DESTINATIONS : OFFICE_DESTINATIONS

export function destination(place: Place, kind: Errand): Destination | undefined {
  return destinationsIn(place).find(d => d.kind === kind)
}

/** How many people this floor can send to that errand at once. */
export function slotsFor(place: Place, kind: Errand): number {
  return destination(place, kind)?.slots.length ?? 0
}

/** Which spot a given claim on a destination lands on. Wraps rather than failing. */
export function slotAt(place: Place, kind: Errand, slot: number): Point {
  const d = destination(place, kind)
  if (!d || d.slots.length === 0) return { x: 0, z: 0 }
  return d.slots[Math.abs(Math.floor(slot)) % d.slots.length]
}

// ---------------------------------------------------------------------------
// Walkability and routes
// ---------------------------------------------------------------------------

/**
 * Half a metre.
 *
 * A metre was the first try and it is too coarse by exactly the margin that
 * matters: the gap between a bench row and the next is about 1.5 m, so a
 * one-metre cell either swallows the aisle or swallows the desk depending on
 * where its centre falls, and the floor came out with rows of benches that had
 * no gaps between them. At half a metre every aisle in both rooms is at least
 * two cells wide, which is what makes a route look like a walkway rather than a
 * diagonal across the furniture.
 */
export const CELL = 0.5

/**
 * How fast people walk, in metres per second.
 *
 * **§18.1 said 1.2 and this is 2.2** [amended 2026-09-14, at the user's
 * instruction]. The old number was set in a 24.5 m garage and never re-asked
 * when the studio moved into a 40 × 39 m floor. Measured over all 100 office
 * seats × all five destinations, the walk home ran to a median of 20.7 s and a
 * worst case of 38.2 s — so one trip to the water cooler cost about 48 seconds
 * of zero output, and a developer the player put down in the wrong place cost
 * another twenty. That is not a pace, it is a punishment for touching the toy.
 *
 * 2.2 m/s is a brisk office walk and puts the median back at 9.4 s, which is
 * roughly what the garage felt like at 1.2.
 */
export const WALK_SPEED = 2.2

/**
 * §18.2 [added 2026-09-14] — how fast somebody the *player* put down walks home.
 *
 * They jog, and the reason is characterisation rather than tuning: a developer
 * carried across the office by their manager and set down in the middle of the
 * floor does not stroll back. It also halves the one wait the player caused
 * themselves, which is the wait they resent.
 */
export const RETURN_SPEED = 3.4

interface Grid {
  readonly preciseBlocks?: readonly {x:number;z:number;w:number;d:number}[]
  readonly x0: number
  readonly z0: number
  readonly cols: number
  readonly rows: number
  readonly open: Uint8Array
}

/**
 * The slab, in from the inside face of the walls.
 *
 * **These have to be wider than the furthest destination slot, not merely wide
 * enough for the room**, because a point outside the grid is a point the graph
 * says nobody can stand on — and the first version put the garage's edge at
 * ±9.5, which is exactly where the far end of the sprint board's huddle stands.
 * The symptom was one unreachable whiteboard slot and no error anywhere. The
 * garage's parapet has its inner face at 9.88 and the office's low wall at
 * 12.2, so there is room to be generous, and being generous is free.
 */
const BOUNDS: Record<Place, { x0: number; z0: number; x1: number; z1: number }> = {
  garage: { x0: -12.9, z0: -10.7, x1: 15.9, z1: 11.9 },
  office: { x0: -17.9, z0: -12.9, x1: 17.9, z1: 12.9 },
}

/**
 * How much clearance a body needs beyond a footprint's own edge.
 *
 * A person is about 0.45 m across the shoulders. Blocking the exact rectangle
 * lets a route hug a counter closely enough that the shoulder passes through
 * it, which reads as clipping rather than as tight; a quarter metre is half a
 * body and is the smallest value at which no walk in either room touches
 * anything. It is deliberately *not* a full body width: at 0.45 the office's
 * bench aisles close entirely and the floor becomes unwalkable.
 */
export const CLEARANCE = 0.25

/** The bench footprints, which are the only obstacle both rooms generate rather than author. */
/** Exported for the same reason {@link leaderDesks} is: the hero deck is closed
 * to routing, so only the rectangles themselves can answer whether a station
 * and a pod are clear of each other. {@link CLEARANCE} is the pad the grid puts
 * either side of both. */
export function benches(place: Place): { x: number; z: number; w: number; d: number }[] {
  // `worktable(g, pod.x, pod.z, w, d)`, and a turned pod is the same table with
  // its axes swapped. The garage's tables are 3.05 long, the office's 2.65.
  if (place === 'garage') return GARAGE_PODS.map(p => ({ x: p.x, z: p.z, w: p.rot === 90 ? 3.4 : 3.64, d: p.rot === 90 ? 3.64 : 3.4 }))
  return OFFICE_PODS.map(p=>({x:p.x,z:p.z,w:p.rot===90?3.4:3.64,d:p.rot===90?3.64:3.4}))
}

/**
 * Leader desks, which are 2.05 x 0.95 set 0.8 in front of the station — plus
 * the leader's own chair behind it.
 *
 * The garage only. The office reserves whole plots instead
 * ({@link OFFICE_PLOTS}): a station there is a shelf, a rack, a gantry and a
 * desk, and a desk-sized rectangle under all of it is a half-answer.
 */
/** Exported so a test can ask the question the walk grid cannot: the garage
 * deck is closed to routing, so nothing derived from it can say whether a
 * scripted walk on to it passes through a station. */
/**
 * **The founder's desk is the boss's** [2026-10-05, *"his desk redesigned"*]: an executive desk with a pedestal either
 * side, a leather chair and a credenza behind. In the station's own frame (x along the desk, z toward the room): the
 * pedestals at ±1.15, the back of the chair at −0.45 and the front of the desk at +1.33.
 * `garageCraft.craftedBossDesk` is drawn to these.
 */
const BOSS_DESK = { x0: -1.15, x1: 1.15, zBack: -0.45, zFront: 1.33, zDesktop: 0.27 } as const

/**
 * A rectangle in a station's own frame, as the axis-aligned world rectangle that holds it. **A station's `rot` is its
 * yaw in degrees** (0 faces +z, 90 faces +x, 45 faces the lens), and a point at (lx, lz) in its frame is at
 * (x + k·(lx·cos + lz·sin), z + k·(−lx·sin + lz·cos)) in the world, with k = {@link GARAGE_HERO_SCALE}, which every
 * station is. At a quarter turn that is the rectangle itself; at 45° it is the rectangle's bounding box, which is what
 * the walk grid and the overlap tests (both axis-aligned) can use.
 */
function stationRect(s: { x: number; z: number; rot: number }, r: { x0: number; x1: number; z0: number; z1: number }, k = GARAGE_HERO_SCALE): { x: number; z: number; w: number; d: number } {
  const a = (s.rot * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a)
  const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]].map(([lx, lz]) => ({ x: s.x + k * (lx * c + lz * n), z: s.z + k * (-lx * n + lz * c) }))
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x))
  const z0 = Math.min(...pts.map((p) => p.z)), z1 = Math.max(...pts.map((p) => p.z))
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }
}

/**
 * **Billy's footprint**: the board with its feet, and the dais, as one axis-aligned world rectangle. The set is built in
 * its own *unscaled* metres (it is not in the scaled group the people are), turned an eighth about the station, so the
 * board goes through {@link stationRect} at `k = 1`; the dais is an octagon with its flats to the axes, which an eighth
 * turn leaves where it was (a square of the same apothem, turned, would be a third wider than it is).
 */
function billyFootprint(): { x: number; z: number; w: number; d: number } {
  const s = GARAGE_LEADERS.find((l) => l.id === 'billy')!
  const { board, dais } = BILLY_PLAZA
  const half = board.w / 2 + 0.01
  const b = stationRect(s, { x0: board.x - half, x1: board.x + half, z0: board.z - board.feet, z1: board.z + board.feet }, 1)
  const d = { x: s.x, z: s.z, w: 2 * dais.apothem, d: 2 * dais.apothem }
  const x0 = Math.min(b.x - b.w / 2, d.x - d.w / 2), x1 = Math.max(b.x + b.w / 2, d.x + d.w / 2)
  const z0 = Math.min(b.z - b.d / 2, d.z - d.d / 2), z1 = Math.max(b.z + b.d / 2, d.z + d.d / 2)
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }
}

/**
 * Leader desks, which are 2.05 x 0.95 set 0.8 in front of the station — plus
 * the leader's own chair behind it.
 *
 * The garage only. The office reserves whole plots instead
 * ({@link OFFICE_PLOTS}): a station there is a shelf, a rack, a gantry and a
 * desk, and a desk-sized rectangle under all of it is a half-answer.
 */
/** Exported so a test can ask the question the walk grid cannot: the garage
 * deck is closed to routing, so nothing derived from it can say whether a
 * scripted walk on to it passes through a station. */
export function leaderDesks(place: Place): { seat: number; x: number; z: number; w: number; d: number }[] {
  if (place === 'office') return []
  // The founder's and James's, on the boss's deck. The heroes' sets (`render/hqSets.ts`) are their own
  // footprints, on platforms of their own, closed to routing as a whole.
  return GARAGE_LEADERS.filter(s => s.id === 'founder' || s.id === 'james').map(s => {
    // From the back of the chair (station − 0.45) to the far edge of the desk
    // (station + 1.275): centre 0.41 forward, 1.73 deep — along whichever axis
    // the station is turned to.
    const scale = GARAGE_HERO_SCALE, yaw = s.rot * Math.PI / 180
    if (s.id === 'founder') {
      const b = BOSS_DESK
      return { seat: s.seat, ...stationRect(s, { x0: b.x0, x1: b.x1, z0: b.zBack, z1: b.zFront }) }
    }
    return { seat: s.seat, x: s.x + Math.sin(yaw) * .41 * scale, z: s.z + Math.cos(yaw) * .41 * scale,
      w: (s.rot === 90 ? 1.73 : 2.24) * scale, d: (s.rot === 90 ? 3.3 : 1.73) * scale }
  })
}

/**
 * **Where the desktop itself is**, as opposed to the rectangle the desk and its
 * chair between them close to walking.
 *
 * {@link leaderDesks} answers the routing question and so reserves the chair
 * behind the station as well; its centre is therefore 0.5 m short of the
 * desktop and a caller that wants to *put something on the desk* would put it
 * on the occupant's lap. The opening scene is that caller — §12.6's boxes are
 * set down on the founder's desk footprint and the desk is what was in them
 * (§12.6, amended 2026-09-21) — and this is the one authority for the spot, so
 * the choreography cannot drift from the plan the way the old hard-coded
 * landing did.
 *
 * `0.8` forward and `2.24 × 1.03` are `garageCraft.craftedHeroDesk`'s own
 * desktop slab, in the station's local axes, read off the box it draws.
 */
export function heroDesktop(place: Place, seat: number): { x: number; z: number; w: number; d: number } | null {
  if (place === 'office') return null
  const s = GARAGE_LEADERS.find(l => l.seat === seat)
  if (!s) return null
  const scale = GARAGE_HERO_SCALE, yaw = s.rot * Math.PI / 180
  if (s.id === 'founder') {
    // The boss's desktop, from its back edge to its front.
    const b = BOSS_DESK
    return stationRect(s, { x0: b.x0, x1: b.x1, z0: b.zDesktop, z1: b.zFront })
  }
  return { x: s.x + Math.sin(yaw) * .8 * scale, z: s.z + Math.cos(yaw) * .8 * scale,
    w: (s.rot === 90 ? 1.03 : 2.24) * scale, d: (s.rot === 90 ? 2.24 : 1.03) * scale }
}

/** Rooms and full hero prop plots are closed to slackoff shortcuts.
 * The commons is level and open; only its authored furniture blocks walking. */
function officeClosed(x: number, z: number): boolean {
  if (!officeFloorContains(x, z)) return true
  return [...OFFICE_ROOMS, OFFICE_CORE, ...OFFICE_PLOTS]
    .some(r => x > r.x0-.45 && x < r.x1+.45 && z > r.z0-.45 && z < r.z1+.45)
}

const grids = new Map<Place, Grid>()

function gridFor(place: Place): Grid {
  const cached = grids.get(place)
  if (cached) return cached
  const b = BOUNDS[place]
  const cols = Math.ceil((b.x1 - b.x0) / CELL)
  const rows = Math.ceil((b.z1 - b.z0) / CELL)
  const open = new Uint8Array(cols * rows).fill(1)
  const blocks = [
    ...furnitureIn(place).map(f => ({ x: f.x, z: f.z, w: f.w, d: f.d, pad: f.low ? 0 : CLEARANCE })),
    ...benches(place).map(b => ({ ...b, pad: CLEARANCE })),
    ...leaderDesks(place).map(b => ({ ...b, pad: CLEARANCE })),
  ]
  // Office cells may be traversed right up to their edges. Reserve the half-cell
  // as well as the torso radius, including low tables that can catch a leg.
  if (place === 'office') for (const block of blocks) block.pad = .45
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = b.x0 + (c + 0.5) * CELL
      const z = b.z0 + (r + 0.5) * CELL
      /*
       * The garage is a polygon, and one of its corners is the entry wing's notch: a cell at
       * (0, 10) is inside the bounding box and outside the building. The terraces are closed
       * too — each is a step or two up, which a flat half-metre grid has no way to express,
       * and the only people on them are pinned (§18.1) and never ask for a route.
       */
      if (place === 'garage') {
        if (!studioFloorContains(x, z)) { open[r * cols + c] = 0; continue }
        // The wall-side half cells are not an aisle behind the flush platform.
        if (GARAGE_PLATFORMS.some((d) => d.rise > 0.1 && x > d.x0 - CELL / 2 && x < d.x1 && z > d.z0 - CELL / 2 && z < d.z1)) { open[r * cols + c] = 0; continue }
      } else if (officeClosed(x, z)) { open[r * cols + c] = 0; continue }
      for (const k of blocks) {
        if (Math.abs(x - k.x) < k.w / 2 + k.pad && Math.abs(z - k.z) < k.d / 2 + k.pad) {
          open[r * cols + c] = 0
          break
        }
      }
    }
  }
  const preciseBlocks = place === 'office' ? [...OFFICE_FURNITURE, ...benches(place),
    ...[...OFFICE_ROOMS,OFFICE_CORE,...OFFICE_PLOTS].map(r=>({x:(r.x0+r.x1)/2,z:(r.z0+r.z1)/2,w:r.x1-r.x0,d:r.z1-r.z0})),
    ...officeSeats().map(s=>({x:s.x,z:s.z+Math.cos(s.facing)*.13,w:.65,d:.72}))] : undefined
  const grid: Grid = { x0: b.x0, z0: b.z0, cols, rows, open, preciseBlocks }
  grids.set(place, grid)
  return grid
}

const cellOf = (g: Grid, p: Point) => ({
  c: Math.floor((p.x - g.x0) / CELL),
  r: Math.floor((p.z - g.z0) / CELL),
})
const centreOf = (g: Grid, c: number, r: number): Point => ({
  x: g.x0 + (c + 0.5) * CELL,
  z: g.z0 + (r + 0.5) * CELL,
})
const isOpen = (g: Grid, c: number, r: number) =>
  c >= 0 && r >= 0 && c < g.cols && r < g.rows && g.open[r * g.cols + c] === 1

/**
 * May a walker take this step, from an open cell to the one beside it?
 *
 * The corner rule is the whole of it: a diagonal past a blocked cell slices
 * through the corner of a desk, which looks wrong immediately and is invisible
 * to any test that only asks whether a route exists. It is a named predicate
 * rather than two lines inside A* because {@link walkableRegions} has to ask the
 * identical question, and a flood fill one step more generous than the
 * pathfinder would certify a floor as crossable that nobody can cross.
 */
const canStep = (g: Grid, c: number, r: number, dc: number, dr: number): boolean =>
  isOpen(g, c + dc, r + dr)
  && (dc === 0 || dr === 0 || (isOpen(g, c + dc, r) && isOpen(g, c, r + dr)))

/** Can somebody stand here? The one question the rest of the build must not answer itself. */
export function walkable(place: Place, x: number, z: number): boolean {
  const g = gridFor(place)
  const { c, r } = cellOf(g, { x, z })
  return isOpen(g, c, r)
}

/**
 * The nearest cell somebody could actually stand in.
 *
 * A seat is under a desk and a sofa slot is on a sofa: both are deliberately
 * *not* walkable, because the graph exists to keep people out of the furniture.
 * So a route's ends are snapped outward to the first open cell, and the exact
 * start and finish are stitched back on as stubs — §18.1's "Stand up" and
 * "Settle" are precisely the moments those stubs describe.
 */
function nearestOpen(g: Grid, p: Point): { c: number; r: number } | null {
  const from = cellOf(g, p)
  if (isOpen(g, from.c, from.r)) return from
  for (let ring = 1; ring <= 8; ring++) {
    let best: { c: number; r: number } | null = null
    let bestD = Infinity
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue
        const c = from.c + dc, r = from.r + dr
        if (!isOpen(g, c, r)) continue
        const at = centreOf(g, c, r)
        const d = (at.x - p.x) ** 2 + (at.z - p.z) ** 2
        if (d < bestD) { bestD = d; best = { c, r } }
      }
    }
    if (best) return best
  }
  return null
}

/**
 * The floor, split into the pieces a walker can actually get between.
 *
 * **The cheap form of the expensive claim.** `floorPlan.test.ts` proves the
 * office is crossable by running some 2,600 A* searches; this answers the same
 * question with one flood fill, and names the islands — which is what was
 * actually wanted the day the office had three of them.
 *
 * The defect it exists for: a planter 1.35 m from a pod, on a floor that gives a
 * body 0.45 m and its clearance 0.45 m either side, was exactly at tolerance,
 * and the half-metre grid rounded it shut. Seven seats could reach nothing, a
 * hundred routes came back zero-length, and every gate that noticed it said only
 * "expected 0 to be greater than 0" — after two minutes of looking.
 *
 * Regions rather than a boolean, because a count says something is wrong and a
 * list of extents says where to go and look.
 */
export function walkableRegions(place: Place): { cells: number; x0: number; z0: number; x1: number; z1: number }[] {
  const g = gridFor(place)
  const seen = new Int32Array(g.cols * g.rows).fill(-1)
  const regions: { cells: number; x0: number; z0: number; x1: number; z1: number }[] = []
  for (let from = 0; from < seen.length; from++) {
    if (seen[from] >= 0 || g.open[from] !== 1) continue
    const id = regions.length
    const region = { cells: 0, x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity }
    const stack = [from]
    seen[from] = id
    while (stack.length > 0) {
      const at = stack.pop()!
      const c = at % g.cols, r = (at - c) / g.cols
      const p = centreOf(g, c, r)
      region.cells++
      region.x0 = Math.min(region.x0, p.x); region.x1 = Math.max(region.x1, p.x)
      region.z0 = Math.min(region.z0, p.z); region.z1 = Math.max(region.z1, p.z)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue
          if (!canStep(g, c, r, dc, dr)) continue
          const next = (r + dr) * g.cols + (c + dc)
          if (seen[next] >= 0) continue
          seen[next] = id
          stack.push(next)
        }
      }
    }
    regions.push(region)
  }
  return regions.sort((a, b) => b.cells - a.cells)
}

export interface Route {
  readonly points: readonly Point[]
  readonly length: number
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

function measure(points: readonly Point[]): Route {
  let length = 0
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i])
  return { points, length }
}

/** Is the straight line between two points clear? Used to pull the A* staircase straight. */
/**
 * Does this straight segment stay on open floor for its whole length?
 *
 * **It is walked cell by cell rather than sampled** [fixed 2026-09-14]. It used
 * to step along the line at a quarter of a cell and ask what was under each
 * point, which is the obvious implementation and is wrong for the obvious
 * reason: a segment can clip the corner of a blocked cell for less than the
 * sample step and never be asked about it. In the garage it did — the walk
 * from seat 2 to the window grazed nine centimetres of a blocked cell at 70%
 * of its length, and the only reason no gate had ever caught it is that the one
 * test that samples a walk sampled at 1.2 m/s and stepped straight over the
 * gap. Raising the walk speed to 2.2 moved the samples and the graze appeared,
 * which is the whole argument for §9.1: the defect was always there and the
 * green tests were measuring their own stride length.
 *
 * So: a grid traversal (Amanatides–Woo) that visits every cell the segment
 * actually enters, corners included. Exact, and the same cost — a segment
 * crossing n cells does n steps rather than four samples per cell.
 *
 * The precise-block pass stays a sample, and stays honest about being one: it
 * tests continuous rectangles rather than grid cells, at 8 cm against pads that
 * are never thinner than 0.5 m.
 */
function clearLine(g: Grid, a: Point, b: Point): boolean {
  const start = cellOf(g, a)
  const end = cellOf(g, b)
  if (!isOpen(g, start.c, start.r)) return false
  let { c, r } = start
  const dx = b.x - a.x
  const dz = b.z - a.z
  const stepC = Math.sign(dx)
  const stepR = Math.sign(dz)
  // Distance along the segment, as a fraction of it, to the next cell boundary
  // in each axis, and the fraction one whole cell costs. Infinite for an axis
  // the segment does not move along, so that axis never wins the comparison.
  const spanC = dx === 0 ? Infinity : CELL / Math.abs(dx)
  const spanR = dz === 0 ? Infinity : CELL / Math.abs(dz)
  const edgeC = g.x0 + (c + (stepC > 0 ? 1 : 0)) * CELL
  const edgeR = g.z0 + (r + (stepR > 0 ? 1 : 0)) * CELL
  let nextC = dx === 0 ? Infinity : (edgeC - a.x) / dx
  let nextR = dz === 0 ? Infinity : (edgeR - a.z) / dz
  // One step per cell boundary crossed, plus slack: a segment cannot enter more
  // cells than it crosses boundaries, and the bound stops a degenerate input
  // spinning here.
  const limit = Math.abs(end.c - start.c) + Math.abs(end.r - start.r) + 2
  for (let i = 0; i < limit; i++) {
    if (c === end.c && r === end.r) break
    if (nextC < nextR) { c += stepC; nextC += spanC } else { r += stepR; nextR += spanR }
    if (!isOpen(g, c, r)) return false
  }
  if (!g.preciseBlocks) return true
  return !g.preciseBlocks.some(k=>crossesFurniture(a,b,k))
}

/**
 * A walk from one point to another, along the walkways.
 *
 * A* on the half-metre grid, eight-way, refusing to cut a corner diagonally
 * past a blocked cell — that last rule is what keeps people from slicing
 * through the corner of a desk, which looked wrong immediately and is invisible
 * in any test that only asserts the route exists.
 *
 * The staircase A* produces is then pulled straight: each waypoint is dropped
 * if the line from the last kept one to the next is clear. §26.3.1's complaint
 * about the legacy floor was that movement "drifts"; a route made of long
 * straight legs along and across the desk grain is the opposite of a drift, and
 * it is also two-thirds fewer waypoints for the renderer to interpolate.
 *
 * **Garage legacy fallback only: a straight line if no route exists.** A floor with no path is a
 * layout bug, not a runtime condition, and it is caught by
 * `floorPlan.test.ts` rather than handled here — office failures stay at the starting point; a garage scenario that reaches
 * this anyway gets a walk that is too short rather than a person frozen in a
 * doorway forever.
 */
/**
 * Routes are asked for once per frame per walker and change once per leg, so
 * they are remembered.
 *
 * The key is the request rounded to a centimetre: a drop point comes from a
 * pointer and is never twice the same float, which would make a cache that
 * keyed on the raw numbers a memory leak with a hit rate of zero. Two hundred
 * entries is about thirteen walkers' worth of legs at both scales, and the map
 * is cleared wholesale rather than aged — a stale route costs a recomputation,
 * never a wrong answer, because the layout is constant within a run.
 */
const routes = new Map<string, Route>()
const ROUTE_CACHE = 200

export function route(place: Place, from: Point, to: Point): Route {
  const key = `${place}|${from.x.toFixed(2)},${from.z.toFixed(2)}|${to.x.toFixed(2)},${to.z.toFixed(2)}`
  const hit = routes.get(key)
  if (hit) return hit
  // Leave a seated pose sideways before joining the aisle. Snapping straight
  // backwards would send the standing body's legs through its own chair back.
  const escape = (p: Point): Point[] => {
    const seat = place === 'office' ? officeSeats().find(s=>distance(s,p)<.001) : undefined
    if (!seat) return [p]
    const pod = OFFICE_PODS[seat.pod]
    if(pod.rot===90) { const z=p.z+Math.sign(p.z-pod.z)*.65; return [p,{x:p.x,z},{x:p.x+Math.sign(p.x-pod.x)*.9,z}] }
    const x = p.x + Math.sign(p.x-pod.x)*.65
    return [p,{x,z:p.z},{x,z:p.z+Math.sign(p.z-pod.z)*.9}]
  }
  const start = escape(from), end = escape(to)
  const middle = findRoute(place,start[start.length-1],end[end.length-1])
  const found = middle.length > 0 ? measure(dedupe([...start,...middle.points,...end.reverse()])) : middle
  if (routes.size >= ROUTE_CACHE) routes.clear()
  routes.set(key, found)
  return found
}

function findRoute(place: Place, from: Point, to: Point): Route {
  const g = gridFor(place)
  const a = nearestOpen(g, from)
  const b = nearestOpen(g, to)
  if (!a || !b) return measure(place === 'office' ? [from] : [from, to])
  if (a.c === b.c && a.r === b.r) return measure(dedupe([from, to]))

  const size = g.cols * g.rows
  // Keep the same precision as `through`: Float32 rounded a diagonal cost up,
  // making identical paths look cheaper repeatedly on the larger office grid.
  const cost = new Float64Array(size).fill(Infinity)
  const cameFrom = new Int32Array(size).fill(-1)
  const start = a.r * g.cols + a.c
  const goal = b.r * g.cols + b.c
  cost[start] = 0
  // A binary heap would be faster and is not worth the code yet: the office is
  // about 5,700 cells, the garage 1,400, and at most fifteen routes are asked
  // for per second — every one of which is then remembered by `route`.
  const frontier: { index: number; priority: number }[] = [{ index: start, priority: 0 }]
  const heuristic = (i: number) =>
    Math.hypot((i % g.cols) - b.c, Math.floor(i / g.cols) - b.r) * CELL
  let found = false
  while (frontier.length > 0) {
    let pick = 0
    for (let i = 1; i < frontier.length; i++) if (frontier[i].priority < frontier[pick].priority) pick = i
    const current = frontier.splice(pick, 1)[0].index
    if (current === goal) { found = true; break }
    const cc = current % g.cols
    const cr = Math.floor(current / g.cols)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dc === 0 && dr === 0) continue
        if (!canStep(g, cc, cr, dc, dr)) continue
        const nc = cc + dc, nr = cr + dr
        const step = (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1) * CELL
        const next = nr * g.cols + nc
        const through = cost[current] + step
        if (through >= cost[next]) continue
        cost[next] = through
        cameFrom[next] = current
        frontier.push({ index: next, priority: through + heuristic(next) })
      }
    }
  }
  // An impossible office route must never become a straight line through desks.
  if (!found) return measure(place === 'office' ? [from] : [from, to])

  const cells: Point[] = []
  for (let at = goal; at !== -1; at = cameFrom[at]) {
    cells.push(centreOf(g, at % g.cols, Math.floor(at / g.cols)))
    if (at === start) break
  }
  cells.reverse()

  const raw = dedupe([from, ...cells, to])
  const pulled: Point[] = [raw[0]]
  let i = 0
  while (i < raw.length - 1) {
    let j = raw.length - 1
    while (j > i + 1 && !clearLine(g, raw[i], raw[j])) j--
    pulled.push(raw[j])
    i = j
  }
  return measure(dedupe(pulled))
}

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || distance(last, p) > 1e-4) out.push(p)
  }
  return out.length > 0 ? out : [...points.slice(0, 1)]
}

/**
 * The walk out to a destination slot, and the walk back from one.
 *
 * A pair rather than one function with a flag, because the two are not
 * symmetrical in the one way that matters: the walk out always starts at a
 * desk, and the walk back may start anywhere the player dropped somebody.
 *
 * Both stitch the approach in when the destination has one, so a sofa is
 * reached across its own front and left the same way.
 */
/**
 * A walk that has to pass through authored waypoints on its way.
 *
 * The garage's hero platform is *closed* to the walk grid on purpose — it is
 * 0.24 m up, reached by a step, and a flat half-metre grid has no way to say
 * so — which is fine for everybody who lives on it, because §18.1 pins them
 * there and they never ask for a route. The scripted arrival does walk on to
 * it, and {@link route} answers that by drawing a straight line from the last
 * open cell to the target: from the central aisle, that line goes through the
 * founder's own desktop.
 *
 * So the last legs are authored. Everything up to the first waypoint is a real
 * route through the grid; from there the points are joined as given, and the
 * whole thing is measured once so travel time still equals visible travel.
 */
export function routeVia(place: Place, from: Point, vias: readonly Point[], to: Point): Route {
  if (vias.length === 0) return route(place, from, to)
  return measure(dedupe([...route(place, from, vias[0]).points, ...vias.slice(1), to]))
}

export function routeOut(place: Place, from: Point, kind: Errand, slot: number): Route {
  const spot = slotAt(place, kind, slot)
  const approach = destination(place, kind)?.approach
  if (!approach) return route(place, from, spot)
  return measure(dedupe([...route(place, from, approach).points, spot]))
}

export function routeBack(place: Place, kind: Errand, slot: number, to: Point): Route {
  const spot = slotAt(place, kind, slot)
  const approach = destination(place, kind)?.approach
  if (!approach) return route(place, spot, to)
  return measure(dedupe([spot, ...route(place, approach, to).points]))
}

/**
 * How long this walk takes, in seconds. The only conversion from metres to time.
 *
 * `speed` is a parameter rather than a second constant read inside, because
 * §18.2's return jog is the *same* question asked about a different walker —
 * and a `returnSeconds()` beside this one would be two answers to it.
 */
export const walkSeconds = (r: Route, speed: number = WALK_SPEED): number => r.length / speed

/**
 * Where somebody is, `t` of the way along a route, and which way they face.
 *
 * `t` is clamped rather than wrapped: a walker whose phase has overrun by a
 * frame should be standing at the far end, not back at the near one.
 */
export function pointAlong(r: Route, t: number): { x: number; z: number; facing: number } {
  const points = r.points
  if (points.length === 0) return { x: 0, z: 0, facing: 0 }
  if (points.length === 1 || r.length <= 0) return { ...points[0], facing: 0 }
  let want = Math.max(0, Math.min(1, t)) * r.length
  for (let i = 1; i < points.length; i++) {
    const seg = distance(points[i - 1], points[i])
    if (want > seg && i < points.length - 1) { want -= seg; continue }
    const f = seg <= 0 ? 0 : Math.min(1, want / seg)
    const a = points[i - 1], b = points[i]
    return {
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      facing: yawToward(b.x - a.x, b.z - a.z),
    }
  }
  return { ...points[points.length - 1], facing: 0 }
}

/** Only for tests and the layout gate: forget everything derived from the layout. */
export function resetFloorPlan(): void { grids.clear(); routes.clear(); officeSeatCache = null }
