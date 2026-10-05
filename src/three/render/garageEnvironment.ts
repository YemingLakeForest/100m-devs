/*
 * Copied from the rebuild (100m-devs-three/src/render/garageEnvironment.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import * as T from 'three'
import { OS, OS_SKIN } from '../art/skin.ts'
import type { Environment, GarageProp } from './worldEnvironments.ts'
import { batchArt, box, cylinder, hedge, INK, line, placeInstances, planter, showSeatInstances, slab, tree, wall, type PropInstances } from './worldArt.ts'
import { projectBoard } from './projectPlate.ts'
import { garageNeighborhood } from './garageNeighborhood.ts'
import { garageBackyard } from './garageBackyard.ts'
import { GARAGE_DECK, GARAGE_STAGE, GARAGE_HERO_SCALE, GARAGE_FURNITURE, GARAGE_OUTLINE, GARAGE_PODS, garageSeats, GARAGE_LEADERS, STUDIO, STUDIO_GABLE, type Furniture } from '../sim/floorPlan.ts'
import { HERO_LABELS, LEADER_COLOURS, leaderLook, studioPerson, workerLook, type StudioCast } from './studioPeople.ts'
import { entrance, gableSign, garageDeskStory, garageForecourt, street } from './garageDetails.ts'
import { buildHqSets } from './hqSets.ts'
import { craftedChair as chair, craftedHeroDesk, craftedSingleDesk, finishGarage, garagePlatformFloor, garageSurfaceDetails, leafyPlanter, loungeDressing } from './garageCraft.ts'

const hitGeometry = new T.BoxGeometry(1, 1, 1)
// Round hero pick volumes avoid grazing an exact box corner in the isometric ray.
const heroHitGeometry = new T.CylinderGeometry(.5, .5, 1, 12)
const hitMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

/**
 * The invisible volume a press has to land in to mean "this person".
 *
 * **1.1 m wide since 2026-09-14** (0.78 before), at the user's instruction. A
 * body is 0.45 m across and the box used to be barely wider than one, which at
 * the default office zoom is 17 px of glass and about 5 px on a phone — a
 * target most presses miss. Two seats in a pod are 1.32 m apart, so 1.1 leaves
 * 0.22 m of gap: wider than a person, narrower than the space between two of
 * them, which is the whole constraint. §18.2's `pickNear` adds a pixel-space
 * fallback on top of this for the zoom levels where even 1.1 m is small.
 */
export function studioTarget(env: Environment, x: number, z: number, seat: number, label: string, scale = 1, elevation = 0): void {
  const mesh = new T.Mesh(seat < 0 ? heroHitGeometry : hitGeometry, hitMaterial)
  mesh.position.set(x, scale + elevation, z); mesh.scale.set(1.1 * scale, 1.75 * scale, 1.1 * scale); mesh.userData.hit = true
  // The floor under them, for a landing's squash to pivot on (`garageView.floorAt`).
  mesh.userData.floor = elevation
  env.root.add(mesh)
  env.targets.push({ mesh, rank: 0, index: seat, label, population: 1, radius: 0.4 })
}

/**
 * A furniture entry's **own frame**: a group where the plan says, turned to its
 * `facing`, with the length and depth its footprint implies.
 *
 * §18.3 authors furniture as an axis-aligned rectangle — `w` by `d` in world
 * metres — because that is what the walk grid blocks, and the shapes are drawn
 * in the piece's own frame because a sofa is a sofa whichever wall it is
 * against. A quarter turn swaps the two extents, so the pair comes back out of
 * the footprint here. One place does that arithmetic; nothing downstream has to
 * know which way round its numbers are.
 *
 * `|cos|` and `|sin|` rather than a right-angle table because they are the
 * right answer at a right angle and a defensible one in between — a piece
 * turned 30° gets the bounding extents it actually occupies.
 */
function placed(parent: T.Object3D, f: Furniture): { g: T.Group; len: number; dep: number } {
  const turn = f.facing ?? 0
  const g = new T.Group()
  g.position.set(f.x, 0, f.z)
  g.rotation.y = turn
  parent.add(g)
  const cs = Math.abs(Math.cos(turn)), sn = Math.abs(Math.sin(turn))
  return { g, len: cs * f.w + sn * f.d, dep: sn * f.w + cs * f.d }
}

/**
 * A floor from an outline. The garage is an L with a corner cut off it now, and
 * a stepped plan cannot be drawn out of boxes without the joins showing.
 */
function shelving(g: T.Group, x: number, z: number, rotation = 0): void {
  const shelf = new T.Group(); shelf.position.set(x, 0, z); shelf.rotation.y = rotation; g.add(shelf)
  for (const dx of [-0.75, 0.75]) box(shelf, dx, 0, 0, 0.09, 2.3, 0.65, INK.woodEdge)
  for (let i = 0; i < 4; i++) {
    box(shelf, 0, 0.12 + i * 0.64, 0, 1.6, 0.08, 0.65, INK.wood)
    for (let j = 0; j < 3; j++) {
      const colour = [INK.glassLight, '#61988a', INK.trim, INK.wood][(i + j) % 4]
      box(shelf, -0.5 + j * 0.49, 0.2 + i * 0.64, 0, 0.39, 0.35, 0.50, colour)
      box(shelf, -0.5 + j * 0.49, 0.3 + i * 0.64, 0.255, 0.16, 0.075, 0.01, INK.paper)
    }
  }
}

/** Scripted hero arrivals and loose groups used by the delivery animation.
 * Individual workstations furnish the redesigned room; occupants still follow
 * hires, while the founder and James retain their scripted station arrivals. */
export interface GarageStaging {
  /** Has the founder's desk come out of the box? */
  founder: boolean
  /** How much of James's station stands: 0 nothing, 1 desk, 2 and chair, 3 and him. */
  james: number
  /**
   * The heroes of the hero row who are in the building [2026-10-04]: their
   * station stands, whole, from the moment they are listed. The drop that
   * delivers it piece by piece is the view's, not the plan's.
   */
  heroes: readonly string[]
}

/** A garage that has finished arriving — what every non-playing caller wants. */
export const GARAGE_ASSEMBLED: GarageStaging = { founder: true, james: 3, heroes: ['billy', 'serena', 'matt'] }

/**
 * A sub-group for one prop, registered so the scene can deliver it later.
 *
 * **The group stands where the prop stands**, which is why the caller passes
 * the anchor here and draws at its own origin rather than drawing at `(x, z)`
 * inside a group at the room's. It is not tidiness: the landing squash scales
 * the group, and a scale is about the group's origin, so a bench island anchored
 * at the middle of the room would have slid four metres sideways every time it
 * flattened.
 *
 * **[2026-09-22] Every prop is registered, and none of them is `dynamic`.**
 * Registration used to mean "keep this one out of `batchArt` so it can be
 * animated", which cost a rebuild of the whole room each time the set changed.
 * The boxes go into the batch now and the prop moves through their instance
 * matrices instead; `GarageProp.group` holds only what the batcher declined,
 * and that moves with them. Nothing here decides *when* a prop is visible —
 * {@link showGarageSeats} and {@link showGarageStations} do, after the batch.
 */
function prop(env: Environment, parent: T.Object3D, key: string,
  x = 0, z = 0): T.Group {
  const g = new T.Group()
  g.position.set(x, 0, z)
  g.userData.prop = key
  parent.add(g)
  env.props!.set(key, { rest: new T.Matrix4(), centre: new T.Vector3(x, 0, z), group: g, instances: [] })
  return g
}

/**
 * **Show a prop, hide it, or move it** — the one writer for a garage prop's
 * place in the picture. [2026-09-22]
 *
 * `delta` is the transform against the prop's resting matrix: `null` takes it
 * out of the picture entirely, the identity puts it back exactly where it
 * belongs. The batched boxes go through `placeInstances`; the few pieces the
 * batcher declined — a desk's screen is a textured plane with its own geometry
 * — ride along on the group, which is their actual parent.
 *
 * Everything that used to need a rebuild goes through here: a seat nobody has
 * been hired into, a station being held back for its scene, and a desk in
 * mid-air on its way down.
 */
export function placeProp(handle: GarageProp | undefined, delta: T.Matrix4 | null): void {
  if (!handle) return
  handle.group.visible = delta !== null
  // Two different questions, and collapsing them is a bug I actually shipped
  // for a frame: `null` means *not in the room*, which for a batched box is the
  // zero matrix, and it is not the same as "back where it belongs", which is
  // the identity. A garage at zero hires came out fully furnished.
  if (delta === null) showSeatInstances(handle.instances, false)
  else placeInstances(handle.instances, delta)
}

/**
 * §12.6 — **how much of the room has been hired**, and nothing else decides it.
 *
 * The desks, chairs and planters for all twenty seats are built; this is what
 * makes an un-hired one bare floor. The planter is shown on the third seat of
 * its pod for the geometric reason given at the seat loop: it rests between two
 * facing desktops and the third seat is the first at which both exist.
 *
 * The occupant goes with the furniture, through the *seat* register rather than
 * the prop one, because a body is what §18's away layer takes out of a chair
 * and the desk must stay behind when they walk off.
 */
export function showGarageSeats(env: Environment, count: number, drawn: number): void {
  const seats = garageSeats()
  const n = Math.max(0, Math.min(seats.length, Math.floor(count)))
  const was = Math.max(0, Math.min(seats.length, Math.floor(drawn)))
  /*
   * **Only the seats that crossed the line**, for the reason `showFloorSeats`
   * gives at length: §18's away layer owns whether a *hired* developer is in
   * their chair, and a full sweep here would put the seated copy of somebody
   * who is at the water cooler back at their desk on the next hire — with
   * `errands` believing it had already hidden them, so it would never take the
   * copy out again. Nobody crossing this line can be away; they were hired a
   * moment ago.
   *
   * The planters are swept every time regardless. They belong to a pod rather
   * than a seat, nothing else ever touches them, and there are five.
   */
  const lo = Math.min(was, n)
  const hi = Math.max(was, n)
  const shown = n > was
  for (const s of seats) {
    if (s.seat < lo || s.seat >= hi) continue
    placeProp(env.props?.get(`desk:${s.seat}`), shown ? IDENTITY : null)
    placeProp(env.props?.get(`chair:${s.seat}`), shown ? IDENTITY : null)
    const body = env.people.find(p => Number(p.userData.seat) === s.seat)
    if (body) body.visible = shown
    showSeatInstances(env.seatInstances?.get(s.seat) ?? [], shown)
    const hit = env.targets.find(t => t.rank === 0 && t.index === s.seat)
    if (hit) hit.mesh.visible = shown
  }
  for (const [i] of GARAGE_PODS.entries()) {
    placeProp(env.props?.get(`pod:${i}`), n > i * 4 + 2 ? IDENTITY : null)
  }
}

/** A garage is twenty chairs; `showGarageSeats` counts down from that at build. */
export const GARAGE_SEATS_BUILT = 20

/**
 * §12.6 — **how much of each hero station has arrived.**
 *
 * The founder's is all-or-nothing because their desk comes out of the boxes as
 * one gag; James's is a count because the whole point of his is that it lands
 * in three pieces. The founder's *body* is the exception the old builder made
 * too: they are the one person who was in the room before the furniture, and
 * the opening has them walking in carrying it.
 *
 * A hero who is not in the cast has no station built at all, so every lookup
 * here misses and `placeProp` does nothing — which is the right answer, because
 * their station is not late, it does not exist.
 */
export function showGarageStations(env: Environment, staging: GarageStaging, cast: StudioCast): void {
  for (const bay of HERO_BAYS) {
    // The wall stands until its hero is here, and then it is gone.
    placeProp(env.props?.get(`partition:${bay.id}`), staging.heroes.includes(bay.id) ? null : IDENTITY)
  }
  for (const station of GARAGE_LEADERS) {
    const present = station.id === 'founder' ? (staging.founder ? 3 : 0)
      : !cast.heroes.includes(station.id) ? 0
      : station.id === 'james' ? staging.james
      : staging.heroes.includes(station.id) ? 3 : 0
    placeProp(env.props?.get(`desk:${station.id}`), present >= 1 ? IDENTITY : null)
    placeProp(env.props?.get(`chair:${station.id}`), present >= 2 ? IDENTITY : null)
    const shown = station.id === 'founder' || present >= 3
    placeProp(env.props?.get(`body:${station.id}`), shown ? IDENTITY : null)
    placeProp(env.props?.get(`name:${station.id}`), shown ? IDENTITY : null)
    const body = env.people.find(p => Number(p.userData.seat) === station.seat)
    if (body) body.visible = shown
    const hit = env.targets.find(t => t.rank === 0 && t.index === station.seat)
    if (hit) hit.mesh.visible = shown
  }
}

const IDENTITY = new T.Matrix4()

/**
 * The three lengths of wall that stood at z = −6.5, one per bay of the hero row,
 * west to east (Matt, Serena, Billy — see `floorPlan.GARAGE_LEADERS` for why that
 * way round) — the bay each hero's station is in.
 * Serena's keeps the low window the whole run had.
 */
export const HERO_BAYS = [
  { id: 'matt', x0: -10, x1: -5.0, window: false },
  { id: 'serena', x0: -5.0, x1: -0.4, window: false },
  { id: 'billy', x0: -0.4, x1: 4.4, window: false },
] as const

/** GDD §§6, 7, 13.1. Architecture is authored geometry, never an atlas plane.
 * The original art supplies plaster, shutter, workshop, blue lounge and planted
 * entrance; the garage mechanics determine five pods and only two leader desks.
 */
export function buildGarageEnvironment(count: number, cast: StudioCast, scenery: 'on' | 'off' | 'far' = 'on', shellOnly = false,
  staging: GarageStaging = GARAGE_ASSEMBLED, cityGrid = false): Environment {
  const env: Environment = { root: new T.Group(), targets: [], occluders: [], people: [],
    focus: new T.Vector3(-1.3, 0.6, -2.9), extent: 27, background: cityGrid ? OS.n2 : '#87966c', seatInstances: new Map(), props: new Map() }
  const g = env.root
  // Continuous ground and two joined slabs leave a genuine recessed doorway.
  // A cheap continuous ground plane hides the horizon even on tall screens;
  // camera travel is bounded independently of the scenery's backing surface.
  box(g, 0, -0.6, 0, 512, .1, 512, env.background, false)
  if (OS_SKIN) {
    // STUDIO_OS: two warm ceiling lamps over the hall and the annex — the room
    // is a lit box in a dark street, which is the legacy garage's whole picture.
    for (const [x, z] of [[-3.5, -0.5], [5, -5.5], [-4.3, -8]]) {
      const lamp = new T.PointLight(OS.lamp, 16, 13, 2)
      lamp.position.set(x, 3.1, z)
      g.add(lamp)
    }
  }
  box(g, 0, -0.48, 1.7, 24, 0.16, 21.2, '#d3d1c5')
  if (!cityGrid) street(g)
  for (let x = -12; x <= 12; x += 1.2) box(g, x, -0.315, 10, 0.012, 0.005, 4.5, '#bcbeb6', false)
  for (let z = 8; z <= 12.2; z += 1.2) box(g, 0, -0.315, z, 24, 0.005, 0.012, '#bcbeb6', false)
  slab(g, GARAGE_OUTLINE, -0.3, 0.3, '#e8e2d4')
  /*
   * The far wall, stepped. Clerestory over the hall as far as x = 1.5, then the
   * annex takes over 3.3 m further back. The step is the whole reason the
   * silhouette stopped being one straight edge across the top of the frame.
   */
  /*
   * [2026-10-04] **The far wall is one straight run now, at the annex's depth**,
   * and the hero row (Billy, Serena, Matt) stands in front of it — see
   * `floorPlan.HERO_ROW_Z`. Where this wall used to step at x = 1.5 it keeps the
   * rhythm it had: solid workshop walls either side of a low-sill window, the
   * same clerestory header and coping, moved back 3.3 m. The annex's return
   * wall at x = 1.5 is gone with the step, since there is no annex to return.
   */
  // [2026-10-04] Solid from the corner to the annex: the stage hangs the heroes' work on this
  // wall (the whiteboard, the dashboards, the ticket wall), and a window in the middle of
  // it was daylight nobody could see for the screens.
  box(g, -2.8, 0, -9.8, 14.4, 3.2, .24, INK.wall)
  box(g, -4.25, 3.2, -9.8, 11.9, 0.12, 0.35, INK.trim)
  /*
   * **The old back wall is still standing, in three pieces, until each hero
   * arrives** [2026-10-04] — the gag §7.8.12 asked for: *the room cannot make
   * space by shuffling anybody along, so it makes space by pushing the back wall
   * out.* Each bay is hidden behind its own length of the wall that stood at
   * z = −6.5 (solid, solid-with-a-window, solid, as it was), and when somebody
   * arrives the view yanks that length up through the roof, with dust, and the
   * desk drops into the room it has just opened. Built into the shell rather
   * than moved, because a room whose walls change recompiles every material in
   * it; the piece is a prop like the desk is, and `showGarageStations` hides it
   * for whoever is already here.
   */
  for (const bay of HERO_BAYS) {
    const w = bay.x1 - bay.x0
    const wall = prop(env, g, `partition:${bay.id}`, (bay.x0 + bay.x1) / 2, -6.5)
    if (bay.window) {
      box(wall, 0, 0, 0, w, .9, .24, INK.wall)
      box(wall, 0, 2.8, 0, w, .4, .24, INK.wall)
      box(wall, 0, .9, 0, w, 1.9, .04, '#a8c7cf', false)
      for (const dx of [-w / 3, 0, w / 3]) box(wall, dx, .9, .03, .10, 1.9, .18, INK.trim)
      box(wall, 0, .86, .07, w + .15, .08, .38, INK.trim)
    } else {
      box(wall, 0, 0, 0, w, 3.9, .24, INK.wall)
    }
    box(wall, 0, 3.9, 0, w + .05, .12, .35, INK.trim)
  }
  box(g, 7.26, 0, -9.8, 5.72, STUDIO.wallHeight, 0.24, INK.wall)
  box(g, 7.0, 2.05, -9.68, 4.8, 0.85, 0.06, '#a8c7cf', false)
  for (const x of [4.7, 6.2, 7.8, 9.2]) box(g, x, 2.05, -9.7, 0.13, 0.85, 0.1, INK.trim)
  box(g, 5.75, 3.2, -9.8, 8.9, 0.12, 0.35, INK.trim)
  // Low glazing over the annex's east flank. It was cut down for the kitchen,
  // which stood against it; the kitchen turned on to the back wall in 2026-09,
  // and the glazing stays because what it now keeps visible is the run itself
  // and whoever is standing at it — a full-height near wall here would put the
  // one lit corner of the room behind a slab.
  box(g, 10, 0, -8.15, 0.24, 0.55, 3.54, INK.wall)
  box(g, 10, 0.55, -8.15, 0.33, 0.07, 3.54, INK.trim)
  box(g, 9.98, 0.62, -8.15, 0.05, 1.0, 3.4, '#a8c7cf', false)
  box(g, 10, 1.62, -8.15, 0.3, 0.08, 3.6, INK.trim)
  // Cutaway near walls: low enough to read seated bodies and leave the door open.
  box(g, 10, 0, 0.75, 0.24, 0.55, 14.5, INK.wall)
  box(g, 10, 0.55, 0.75, 0.33, 0.07, 14.5, INK.trim)
  // The left entry wing projects beyond the hall. Its diagonal opening faces
  // +X/+Z, so both the door and the printed sign are frontal in the game view.
  // Only the opaque perimeter gets a parapet: never bridge the opening in trim.
  for (const [from, to] of [[[STUDIO_GABLE.x1, 8], [10, 8]]] as const) {
    wall(g, from, to, 0, 0.55, 0.24, INK.wall)
    wall(g, from, to, 0.55, 0.07, 0.33, INK.trim)
  }
  /*
   * **The two runs left of the door stand full height** — §13.1, amended
   * 2026-09-14 at the user's instruction, against "other near walls remain cut
   * down".
   *
   * A parapet is a cutaway: you cut a wall down because the camera has to see
   * over it, and what it has to see is people at desks. There is nobody behind
   * these two. The wing's return at x = −10 is a *far* wall — its inner face
   * points +X, straight at the lens — so its height costs the picture nothing
   * at all, and cutting it produced the one thing the rule exists to prevent:
   * the west wall arrived full height from the back of the hall, stopped dead
   * at z = 5.5, and carried on as a knee-high tray. The run at z = 11 closes
   * the wing over four metres of empty paving; measured along §12.1's (1,1,1)
   * a 3.2 m wall there sweeps back to (x − 3.2, z − 3.2), which is floor
   * inside the wing and nothing else.
   *
   * That band is why the lounge below stops at z = 7.4 rather than running up
   * to the corner — see `GARAGE_FURNITURE`.
   */
  const gable = STUDIO_GABLE
  for (const [from, to] of [
    [[gable.x1, gable.z], [gable.x0, gable.z]],
    [[gable.x0, gable.z], [gable.x0, 5.5]],
  ] as [readonly [number, number], readonly [number, number]][]) {
    wall(g, from, to, 0, STUDIO.wallHeight, gable.thickness, INK.wall)
    wall(g, from, to, STUDIO.wallHeight, 0.12, 0.35, INK.trim)
  }
  // The former garage gate becomes the project wall, with an oak base.
  box(g, -10, 0, -2.15, .24, STUDIO.wallHeight, 15.3, INK.wall)
  box(g, -9.84, 0, .5, .10, .7, 5.3, INK.wood)
  // Runs to z = 5.5, where the wing's own coping above takes over: the west
  // wall is one unbroken head now rather than stopping short of its own corner.
  box(g, -10, 3.2, -2.2, 0.35, 0.12, 15.4, INK.trim)
  // A plain, straight portal faces the east pavement; no overhead signage.
  const door = entrance(g)
  gableSign(g, cast.studio ?? 'Merciless Software')
  // Retain the actual door meshes for both selection occlusion and projected
  // frame checks. Batched geometry would lose the individually testable portal.
  door.userData.dynamic = true
  door.traverse(node => { if (node instanceof T.Mesh) env.occluders.push(node) })
  // Frame-gate isolation: planter foliage is deliberately enclosed by pale
  // concrete too, so detecting architectural holes requires the bare shell.
  if (shellOnly) { finishGarage(g); batchArt(g, env.seatInstances); return env }
  // One solid, level oak platform supports both complete desk/chair stations.
  const d = GARAGE_DECK
  slab(g, [[d.x0, d.z0], [d.x1, d.z0], [d.x1, d.z1], [d.x0, d.z1]], 0, d.rise - .014, INK.woodEdge)
  garagePlatformFloor(g, d)
  const deck = new T.Group(); deck.position.y = d.rise; g.add(deck)
  // The stage: the higher terrace along the north wall, and where the heroes stand.
  const st = GARAGE_STAGE
  slab(g, [[st.x0, st.z0], [st.x1, st.z0], [st.x1, st.z1], [st.x0, st.z1]], 0, st.rise - .014, INK.woodEdge)
  garagePlatformFloor(g, st)
  // Its front edge: a trim line along the lip, so the step reads as a step.
  box(g, (st.x0 + st.x1) / 2, st.rise - .02, st.z1 - .02, st.x1 - st.x0, .06, .06, INK.trim, false)
  const stage = new T.Group(); stage.position.y = st.rise; g.add(stage)
  // The workshop wall is reserved for the project drawing board.
  const heroBodies: Partial<Record<'billy' | 'serena' | 'matt', T.Group>> = {}
  for (const station of GARAGE_LEADERS) {
    /*
     * §12.6 — how much of this station has turned up.
     *
     * The founder is all-or-nothing because their desk arrives as one gag; the
     * whole point of James's is that it arrives in three pieces, so his is a
     * count rather than a flag. A hero who is not in the cast has nothing at
     * all, which is the pre-existing rule and is why `staging.james` is only
     * consulted for someone already on the roster.
     */
    /*
     * **[2026-09-22] Built whether or not it has arrived; `showGarageStations`
     * decides what is drawn.** A hero who is not in the cast is the exception
     * and still builds nothing: their station is not *late*, it does not exist,
     * and nothing in the game will ever deliver it.
     */
    const cast_in = station.id === 'founder' || cast.heroes.includes(station.id)
    const spot = new T.Group()
    spot.position.set(station.x, 0, station.z)
    spot.scale.setScalar(GARAGE_HERO_SCALE)
    spot.rotation.y = (station.rot * Math.PI) / 180
    // The heroes stand on the stage; the founder and James on the deck below it.
    const onStage = station.id !== 'founder' && station.id !== 'james'
    ;(onStage ? stage : deck).add(spot)
    if (!cast_in) continue
    // [2026-10-04] Billy stands: his station is the easel and the person at it, and
    // has no desk or chair (he is the one hero who is always at the whiteboard,
    // §7.8.13). The easel is what drops in first on his arrival.
    // [2026-10-04] The heroes' sets are `hqSets.ts`'s: Billy's board and audience, Serena's
    // wall of dashboards, Matt's phones and ticket wall. Only the founder and James still
    // have the desk that the loop draws; Serena and Matt keep their chair in it.
    if (!onStage) {
      const desk = prop(env, spot, `desk:${station.id}`)
      craftedHeroDesk(desk, station.id)
      garageDeskStory(desk, station.id)
      chair(prop(env, spot, `chair:${station.id}`), 0, 0, Math.PI, true)
    } else if (station.id !== 'billy') chair(prop(env, spot, `chair:${station.id}`), 0, 0, Math.PI, true)
    {
      const seat = prop(env, spot, `body:${station.id}`)
      const body = studioPerson(seat, 0, 0, Math.PI, leaderLook(cast, station.id), station.id)
      body.userData.seat = station.seat; env.people.push(body)
      if (station.id === 'billy' || station.id === 'serena' || station.id === 'matt') heroBodies[station.id] = body
      /*
       * §12.11 — the name over their head, on a plate built into the room.
       *
       * The name belongs to the station, so coding hops cannot shake the text.
       * Its visibility follows the person through showGarageStations.
       *
       * `HERO_LABELS` rather than the target's label: the person at this desk is
       * the player, and the game calls the player YOU everywhere else it speaks
       * — `scenes.PLAYER`, the dialogue's speaker plate, the portrait dock.
       */
      // A transform-only anchor: the HUD paints the tag, so a jumping body
      // cannot intersect a sign mesh or hide its lettering.
      const tag = prop(env, spot, `name:${station.id}`)
      tag.userData.label = HERO_LABELS[station.id] ?? station.id.toUpperCase()
      tag.userData.colour = LEADER_COLOURS[station.id] ?? INK.teal
      // On the stage the plate is the set's marquee, above the wall and clear of the work.
      if (onStage) tag.userData.tagOffset = [0, (3.3 - st.rise) / GARAGE_HERO_SCALE, (st.z0 + 0.1 - station.z) / GARAGE_HERO_SCALE]
      studioTarget(env, station.x, station.z, station.seat, station.id === 'founder' ? 'Founder' : station.id[0].toUpperCase() + station.id.slice(1), GARAGE_HERO_SCALE, onStage ? st.rise : d.rise)
    }
  }
  /*
   * The heroes' sets, now that their people exist to be moved. Built for whoever is in
   * the cast; `showGarageStations` decides what has arrived.
   */
  {
    const present = new Set((['billy', 'serena', 'matt'] as const).filter((id) => cast.heroes.includes(id)))
    const pos = (id: 'billy' | 'serena' | 'matt') => { const l = GARAGE_LEADERS.find((q) => q.id === id)!; return { x: l.x, z: l.z } }
    env.hq = buildHqSets({ env, stage, cast, at: { billy: pos('billy'), serena: pos('serena'), matt: pos('matt') }, bodies: heroBodies, present })
  }
  /*
   * §12.6 — **the room is furnished by hiring, not by the lease.**
   *
   * Every seat's desk, drawers and chair used to be built at any `count`, so a
   * cold start drew twenty complete workstations under a scene whose own
   * caption is "one founder, two boxes, absolutely no business plan", and the
   * delivery a hire triggers was a chair landing beside furniture that had
   * stood there since the first frame. A seat nobody has been hired into is
   * bare floor now, and the workstation arrives with its occupant — the rule
   * the founder's and James's stations have always followed above.
   *
   * **[2026-09-22] Built for twenty, drawn for `count`.** The rule above is
   * unchanged and it is still the rule: an empty seat is bare floor. What
   * changed is that "bare floor" is now a zero-scaled instance matrix rather
   * than an object that was never made, because *the only way to animate a desk
   * falling used to be to rebuild the room around it*. {@link showGarageSeats}
   * is the one authority for how much of the room is drawn, and the garage
   * screenshot at zero hires is identical either way.
   *
   * The pod's planter is the exception, and the reason is geometric rather
   * than editorial: it sits at desktop height in the 0.44 m gap between the
   * two rows of desktops, so it needs a desk on each side to rest between.
   * The third seat of a pod is the first at which both rows exist, which is
   * why it is shown on `seat % 4 === 2` and not on the first.
   */
  for (const [i, pod] of GARAGE_PODS.entries()) {
    {
      const group = prop(env, g, `pod:${i}`, pod.x, pod.z)
      const greenery = new T.Group(); greenery.position.y = .9; group.add(greenery)
      leafyPlanter(greenery, 0, 0, .25)
    }
    for (const s of garageSeats().filter(s => s.pod === i)) {
      // Anchored at the seat rather than parented to the pod: a falling prop is
      // scaled about its own group's origin, and a desk hung off the middle of
      // a four-desk island would slide a metre and a half as it landed.
      const desk = prop(env, g, `desk:${s.seat}`, s.x, s.z)
      desk.rotation.y = s.facing + Math.PI
      craftedSingleDesk(desk, s.seat)
      chair(prop(env, g, `chair:${s.seat}`, s.x, s.z), 0, 0, s.facing)
      const body = studioPerson(g, s.x, s.z, s.facing, workerLook(cast, s.seat))
      body.userData.seat = s.seat; env.people.push(body)
      studioTarget(env, s.x, s.z, s.seat, `Developer ${s.seat + 1}`)
    }
  }
  /*
   * Everything below is *placed* from `sim/floorPlan.GARAGE_FURNITURE`.
   *
   * The shapes are still authored here, because a kitchen run is a dozen boxes
   * and reducing it to a rectangle would lose the room. What moved is the
   * decision about *where*: a sofa that moves in the picture now moves in the
   * walkability graph on the same edit, which is the whole point of §18.3
   * keeping the layout in `sim/`.
   */
  // Low book storage and framed notices dress the wall behind James.
  box(deck, -.65, 0, -6.02, 3.4, .68, .55, INK.wood)
  for (let i = 0; i < 13; i++) box(deck, -2.1 + i * .23, .12, -5.72, .16, .42 + i % 3 * .06, .28, ['#648079', '#c39955', '#7593a0'][i % 3])
  for (const x of [-1.9, -.5, .9]) {
    box(g, x, 1.5, -6.34, .86, .72, .07, INK.wood)
    box(g, x, 1.57, -6.29, .7, .56, .025, INK.paper)
    box(g, x, 1.72, -6.265, .43, .2, .012, '#648079')
  }
  const at = (kind: string) => GARAGE_FURNITURE.find(f => f.kind === kind)!
  const shared = at('island')
  box(g, shared.x, .018, shared.z, shared.w + .25, .016, shared.d + .2, '#a8c2ba')
  box(g, shared.x, .82, shared.z, shared.w - .8, .12, shared.d - 1.25, INK.wood)
  for (const dx of [-.8, .8]) for (const dz of [-.8, .8]) box(g, shared.x + dx, .03, shared.z + dz, .10, .8, .10, INK.woodEdge)
  for (const dz of [-1.35, 1.35]) for (const dx of [-.66, .66]) {
    cylinder(g, shared.x + dx, .08, shared.z + dz, .07, .43, INK.metal)
    cylinder(g, shared.x + dx, .51, shared.z + dz, .26, .12, '#648079')
  }
  for (let i = 0; i < 3; i++) box(g, shared.x - .45, .95 + i * .055, shared.z + .1, .48, .05, .35, i % 2 ? INK.paper : '#7593a0')
  box(g, shared.x + .35, .95, shared.z - .3, .58, .025, .44, INK.paper)
  for (const dx of [-.6, .6]) cylinder(g, shared.x + dx, .95, shared.z + .6, .075, .16, '#c39955')
  const { g: library, len: libraryLen, dep: libraryDep } = placed(g, at('locker'))
  box(library, 0, 0, 0, libraryLen, .9, libraryDep, INK.woodEdge)
  for (let i = 0; i < 11; i++) for (const y of [.12, .52]) box(library, -libraryLen / 2 + .22 + i * .3, y, libraryDep / 2, .21, .3, .06, ['#648079', '#c39955', '#7593a0'][i % 3])
  box(library, 0, .9, 0, libraryLen + .08, .08, libraryDep + .08, INK.wood)
  const libraryPlant = new T.Group(); libraryPlant.position.y = .98; library.add(libraryPlant)
  leafyPlanter(libraryPlant, -libraryLen / 2 + .4, 0, .32)
  const readingBench = at('bench')
  box(g, readingBench.x, 0, readingBench.z, readingBench.w, .55, readingBench.d, INK.wood)
  box(g, readingBench.x, .55, readingBench.z, readingBench.w + .08, .12, readingBench.d + .06, '#829caa')
  for (let i = 0; i < 9; i++) box(g, readingBench.x - 1.25 + i * .29, .08, readingBench.z - .32, .2, .36, .23, ['#648079', '#c39955', '#7593a0'][i % 3])
  /*
   * The kitchen run, drawn in the piece's own frame — see {@link placed}.
   *
   * [2026-09-21] It used to be authored straight into world axes, which meant
   * it could only ever be the east wall's run: turning it on to the annex's
   * back wall meant rewriting seventeen boxes and hoping the footprint in
   * `sim/floorPlan` was rewritten to match. That is exactly the drift §18.3
   * exists to stop, and it is why the sofa already worked this way.
   *
   * `len` is along the run and `dep` is across it, whichever way the piece is
   * turned, so nothing below knows or cares which wall it is standing on.
   *
   * **Two pieces of the old hand-authored run hung off the end of it.** The
   * doors were pitched at a flat 1.1 m from `0.9` in, which put the fourth one
   * 0.33 m past the worktop, and the second mug stood 0.18 m past it in mid
   * air. Neither was visible against the east wall's glazing from §12.1's
   * angle; both are obvious against a full-height wall. The doors are pitched
   * `len / 4` now, so they divide the run however long it is.
   */
  const { g: kit, len: kitLen, dep: kitDep } = placed(g, at('counter'))
  /*
   * The footprint is the *worktop*, which oversails its cupboards by 0.1 at
   * the front and 0.06 at the open west end — so the carcass is set back
   * inside it rather than sharing its centre, and `front` is the one number
   * the doors and handles are hung off. The oversail used to be symmetrical,
   * which put 0.05 of worktop inside whatever wall the run backed on to. That
   * was invisible against the east wall, because the east wall is cut down to
   * 0.55 and the lip passed over it; against a full-height wall it is 4.4 m of
   * stone tray buried in the plaster.
   */
  const front = kitDep / 2 - 0.1
  box(kit, 0, 0, -0.05, kitLen, 0.90, kitDep - 0.1, INK.wood)
  box(kit, -0.03, 0.9, 0, kitLen + 0.06, 0.08, kitDep, INK.trim)
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5 - 2) * (kitLen / 4)
    box(kit, x, 0.08, front + 0.01, 0.86, 0.72, 0.014, INK.woodEdge)
    box(kit, x, 0.67, front + 0.04, 0.27, 0.045, 0.045, INK.metal)
  }
  const kitchenPlant = new T.Group(); kitchenPlant.position.y = .98; kit.add(kitchenPlant)
  leafyPlanter(kitchenPlant, -1.4, -0.25, .3)
  box(kit, -0.3, 0.98, -0.05, 0.9, 0.03, 0.65, INK.glassLight)
  cylinder(kit, 1.2, 0.98, -0.15, 0.18, 0.45, INK.metal)
  for (const dx of [1.55, 1.85]) cylinder(kit, dx, 0.98, -0.25, 0.075, 0.14, INK.amber)
  /*
   * The tall unit turns the corner and stops the run at the east wall.
   *
   * **2.0 m, not the 2.25 it was.** The wall it now backs on to carries the
   * clerestory band, whose sill is at 2.05 (see the annex above), and 2.25
   * drove the carcass 0.20 m up through the glass. Trimming the unit is the
   * cheaper half of that trade: the band is four mullions and a sill line the
   * eye reads as the building, and the unit is a box.
   *
   * **Open, and a judgement rather than a defect:** in `INK.trim` and stood in
   * the corner it now reads as a pale box against the pale east parapet behind
   * it, which is to say it reads as more wall rather than as a fridge. It had
   * the same two details on the east wall and they were enough there, because
   * the wall behind it was glazed. Giving it its own colour is a design call
   * and has not been made — see `docs/validation/garage-kitchen-2026-09-21.md`.
   */
  const { g: tall, len: tallLen, dep: tallDep } = placed(g, at('unit'))
  box(tall, 0, 0, 0, tallLen, 2.0, tallDep, INK.trim)
  box(tall, 0, 1.4, tallDep / 2 + 0.008, tallLen - 0.1, 0.025, 0.015, INK.grout)
  box(tall, -0.35, 0.7, tallDep / 2 + 0.02, 0.05, 0.48, 0.06, INK.metal)
  const shelf = at('shelving')
  for (let i = 0; i < Math.round(shelf.d / 1.6); i++) {
    shelving(deck, shelf.x, shelf.z - shelf.d / 2 + 0.8 + i * 1.6, Math.PI / 2)
  }
  /*
   * The lounge, backed onto the west wall and looking across the floor.
   *
   * Drawn in the piece's own frame rather than in the room's — see
   * {@link placed}. It used to be authored straight into world axes, which is
   * why it could only ever face −z: turning it meant rewriting nine boxes and
   * hoping the footprint in `sim/floorPlan` was rewritten to match, which is
   * the drift §18.3 exists to prevent.
   */
  const { g: lounge, len: sofaLen, dep: sofaDep } = placed(g, at('sofa'))
  box(lounge, 0, 0.01, 0.95, sofaLen + 0.3, 0.018, 2.65, '#829caa')
  box(lounge, 0, 0.2, 0, sofaLen, 0.4, sofaDep, '#3c6591')
  box(lounge, 0, 0.6, -0.3, sofaLen, 0.52, 0.22, '#345b86')
  for (const dx of [-sofaLen / 2 + 0.16, sofaLen / 2 - 0.16]) {
    box(lounge, dx, 0.55, 0.01, 0.28, 0.35, 0.88, '#3c6591')
  }
  loungeDressing(lounge, sofaLen)
  const { g: table, len: tableLen, dep: tableDep } = placed(g, at('coffee-table'))
  box(table, 0, 0.48, 0, tableLen, 0.1, tableDep, INK.wood)
  for (const dx of [-tableLen / 2 + 0.2, tableLen / 2 - 0.2]) box(table, dx, 0, 0, 0.08, 0.48, 0.6, INK.metal)
  cylinder(table, 0.4, 0.58, -0.05, 0.065, 0.13, INK.trim)
  box(table, -0.3, 0.58, 0, 0.45, 0.045, 0.30, INK.paper)
  /*
   * §18.1 — the planter moved off the sprint board's face.
   *
   * It stood at (9, 5.9), which is a metre in front of the board and exactly
   * where two or three people have to be for a huddle to read as a huddle. A
   * prop standing in the one spot the game wants bodies is a prop winning an
   * argument against a mechanic; `sim/floorPlan.GARAGE_FURNITURE` carries the
   * new position, so the graph and the picture agree about where it is.
   */
  for (const f of GARAGE_FURNITURE) if (f.kind === 'planter') leafyPlanter(g, f.x, f.z, f.w)
  if (scenery === 'on') {
    if (!cityGrid) garageNeighborhood(g)
    garageForecourt(g)
    garageBackyard(g)
    const lawn = new T.Group(); lawn.position.y = -.5; g.add(lawn)
    const pavement = new T.Group(); pavement.position.y = -.32; g.add(pavement)
    // The helpers grow upward from their parent's origin. Exterior paving
    // and lawn are below the interior floor, and must supply their own origin.
    const groundAt = (x: number, z: number) => Math.abs(x) <= 12 && z >= -8.9 && z <= 12.3 ? pavement : lawn
    for (const [x, z, size] of [[-12.4, -6, 3.1], [-12.8, -1, 2.7], [-12.5, 4.4, 2.4], [3, -11.7, 2.8], [8, -12, 3.2], [12.8, -7.8, 2.6], [13.3, 1, 2.3]]) {
      tree(groundAt(x, z), x, z, size)
      // Leave the foreground-right tree free of the two small pots.
      if (x !== 13.3) for (const dx of [-.9, .8]) planter(groundAt(x + dx, z + .7), x + dx, z + .7, .6)
    }
    hedge(lawn, 5.7, -10.8, 8.8, .75)

    hedge(pavement, 3.4, 8.85, 11.4, 0.65)
    hedge(pavement, -8.2, 11.65, 3.5, 0.65)
    hedge(pavement, 10.8, -0.6, 0.65, 13)
    planter(pavement, 10.9, 9, 0.8)
    for (let x = 0; x <= 2.3; x += 1.1) {
      line(g, [new T.Vector3(x, -0.3, 9.6), new T.Vector3(x, 0.8, 9.6),
        new T.Vector3(x + 0.65, 0.8, 9.6), new T.Vector3(x + 0.65, -0.3, 9.6)], INK.metal)
      for (const dx of [0, 0.65]) cylinder(g, x + dx, -0.3, 9.6, 0.035, 1.05, INK.metal)
    }
  }
  garageSurfaceDetails(g)
  finishGarage(g)
  /*
   * Each prop's own extents, measured while it is still a group of meshes.
   *
   * §12.6's smoke goes over *the middle of what landed*, which is neither the
   * group's origin nor the seat's: a hero desk's wrapper sits at the station's
   * origin and the desk it holds is two and a half metres long. This used to be
   * a `Box3` taken at the moment the prop was staged, off the live group — and
   * after `batchArt` there is no live group left to measure. It does not need
   * to be late: a prop does not move between being built and being delivered.
   */
  g.updateMatrixWorld(true)
  const bounds = new T.Box3()
  for (const handle of env.props!.values()) {
    handle.rest.copy(handle.group.matrixWorld)
    bounds.setFromObject(handle.group)
    if (!bounds.isEmpty()) bounds.getCenter(handle.centre)
  }
  // `batchArt` fills a plain `Map<string, SeatInstance[]>` — it does not know
  // what a garage prop is and should not — so the lists are married up to their
  // handles here rather than teaching the batcher a second vocabulary.
  const batched: PropInstances = new Map()
  batchArt(g, env.seatInstances, batched)
  for (const [key, list] of batched) {
    const handle = env.props!.get(key)
    if (handle) handle.instances = list
  }
  // Clear drawing wall, without the overlapping bench, posters and sprint board.
  const drawingBoard = at('board')
  const boardMount = new T.Group(); boardMount.position.set(drawingBoard.x, 0, drawingBoard.z); boardMount.rotation.y = drawingBoard.facing ?? 0; g.add(boardMount)
  env.projectPlate = projectBoard(boardMount, 0, .3, 0, drawingBoard.d - .22, false)
  // The room is built whole; these two say how much of it has arrived.
  showGarageStations(env, staging, cast)
  // The room is built for twenty; this empties the seats nobody has been hired
  // into, the same way `showFloorSeats` empties the office's hundred.
  showGarageSeats(env, count, GARAGE_SEATS_BUILT)
  return env
}

