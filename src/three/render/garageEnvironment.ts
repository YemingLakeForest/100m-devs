/*
 * Copied from the rebuild (100m-devs-three/src/render/garageEnvironment.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import * as T from 'three'
import { OS } from '../art/skin.ts'
import type { Environment, GarageProp } from './worldEnvironments.ts'
import { batchArt, box, cylinder, hedge, INK, line, placeInstances, planter, sharedMaterial, showSeatInstances, slab, tree, wall, type PropInstances } from './worldArt.ts'
import { projectBoard } from './projectPlate.ts'
import { garageNeighborhood } from './garageNeighborhood.ts'
import { garageBackyard } from './garageBackyard.ts'
import { BILLY_PLAZA, GARAGE_WALLS, GARAGE_DECK, GARAGE_PODIUM, GARAGE_HERO_SCALE, GARAGE_FURNITURE, GARAGE_OUTLINE, GARAGE_PODS, HERO_SITES, garageSeats, GARAGE_LEADERS, STUDIO, STUDIO_DOOR, type Furniture, type HeroSite, type HeroSiteId } from '../sim/floorPlan.ts'
import { HERO_LABELS, LEADER_COLOURS, leaderLook, studioPerson, workerLook, type StudioCast } from './studioPeople.ts'
import { entrance, gableSign, garageDeskStory, garageForecourt, street, studioSign } from './garageDetails.ts'
import { sconce, standingLamp } from './glowArt.ts'
import { hqInterior } from './hqInterior.ts'
import { buildHqSets } from './hqSets.ts'
import { OPS_STEP, heroRiser, opsPlinth, opsStep, ziggurat } from './hqShell.ts'
import { bossChair, craftedBossDesk, craftedChair as chair, craftedHeroDesk, craftedSingleDesk, finishGarage, garageSurfaceDetails, leafyPlanter, loungeDressing } from './garageCraft.ts'

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
export function studioTarget(env: Environment, x: number, z: number, seat: number, label: string, scale = 1, elevation = 0, height = 1.75): void {
  const mesh = new T.Mesh(seat < 0 ? heroHitGeometry : hitGeometry, hitMaterial)
  mesh.position.set(x, (1 + (height - 1.75) / 2) * scale + elevation, z); mesh.scale.set(1.1 * scale, height * scale, 1.1 * scale); mesh.userData.hit = true
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

/** Scripted hero arrivals and loose groups used by the delivery animation.
 * Individual workstations furnish the redesigned room; occupants still follow
 * hires, while the founder and James retain their scripted station arrivals. */
export interface GarageStaging {
  /** Has the founder's desk come out of the box? */
  founder: boolean
  /** How much of James's station stands: 0 nothing, 1 desk, 2 and chair, 3 and him. */
  james: number
  /**
   * The heroes (Billy, Serena, Matt) who are in the building [2026-10-04]: their
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
  // The Ops Room's step stands in front of the old wall, so the wall cannot hide it: it comes with her. So does
  // Matt's riser, who has no wall at all (and Billy has no riser: he is on the floor).
  placeProp(env.props?.get('step:serena'), staging.heroes.includes('serena') ? IDENTITY : null)
  placeProp(env.props?.get('riser:matt'), staging.heroes.includes('matt') ? IDENTITY : null)
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
 * The glass in the clerestory ribbons, which is the one surface in the room that is brighter than the room. It is not
 * lit by the lamps (a basic material, shared), so a lamp over it cannot make it dull and a shadow cannot darken it:
 * what it says is *there is a sky out there*, and the sky is a dusk blue a step lighter than the walls it is set in.
 */
const SKY = '#6f95a8'
const skyMaterial = () => sharedMaterial('garage-sky', () => new T.MeshBasicMaterial({ color: SKY }))
/** A pane of that glass: a box that is not lit. */
function skyPane(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number): T.Mesh {
  const pane = box(parent, x, y, z, w, h, d, SKY, false)
  pane.material = skyMaterial()
  return pane
}

/**
 * **The old back wall, in one piece**, in front of the Ops Room. It stood at z = −6.5 across the whole of
 * the room's back until the heroes arrived, and a hero's arrival was that length of it going up through
 * the roof. It is the Ops Room's alone now: Matt's front desk is *west* of her and comes last, and Billy's
 * corner is *east* of her and so never behind her wall, so neither needs one — they are risers that come with
 * them; and the boss is on the west wall, there from the first frame.
 *
 * **The wall has an east return**, running back to the north wall, so the bay is a box and not a screen: on
 * §12.1's camera a sight line from the east end of a plinth passes *east of a wall that stops at the bay's
 * edge* — the first cut showed a hero's dais, lit foot and all, round the end of the old wall. The return is
 * the wall's height (3.2 m, not the screen's 3.9): at 3.9 its far end stands 0.7 m up above the north wall's
 * own top edge, a stub on the skyline.
 */
export const HERO_BAYS = [
  { id: 'serena', x0: 1.98, x1: 6.82 },
] as const

/** GDD §§6, 7, 13.1. Architecture is authored geometry, never an atlas plane.
 * The original art supplies plaster, shutter, workshop, blue lounge and planted
 * entrance; the garage mechanics determine five pods and only two leader desks.
 */
export function buildGarageEnvironment(count: number, cast: StudioCast, scenery: 'on' | 'off' | 'far' = 'on', shellOnly = false,
  staging: GarageStaging = GARAGE_ASSEMBLED, cityGrid = false): Environment {
  const env: Environment = { root: new T.Group(), targets: [], occluders: [], people: [],
    focus: new T.Vector3(1.0, 3.0, -1.5), extent: 34, background: cityGrid ? OS.n2 : '#87966c', seatInstances: new Map(), props: new Map() }
  const g = env.root
  // Continuous ground and two joined slabs leave a genuine recessed doorway.
  // A cheap continuous ground plane hides the horizon even on tall screens;
  // camera travel is bounded independently of the scenery's backing surface.
  box(g, 0, -0.6, 0, 512, .1, 512, env.background, false)
  // §7.8.12 [2026-10-07]: the shared sky/key/fill rig lights the entire room.
  // Visible diffusers and sconces remain art, so arrivals cannot change a face's illumination.
  box(g, 1.5, -0.48, 1.1, 33, 0.16, 25, '#d3d1c5')
  if (!cityGrid) street(g)
  for (let x = -12; x <= 12; x += 1.2) box(g, x, -0.315, 10, 0.012, 0.005, 4.5, '#bcbeb6', false)
  for (let z = 8; z <= 12.2; z += 1.2) box(g, 0, -0.315, z, 24, 0.005, 0.012, '#bcbeb6', false)
  slab(g, GARAGE_OUTLINE, -0.3, 0.3, '#e8e2d4')
  /*
   * [2026-10-04] **The far wall is one straight run, at z = −9.8.** It stepped back 3.3 m at x = 1.5 over the
   * right-hand 42% of the frontage, to an annex that held a developer pod and the kitchen; the step went when
   * the back wall was pushed out for the heroes, and the kitchen went on 2026-10-05 (*"we can do without the
   * kitchen now"*) — the boss's deck is in that corner now, under the same clerestory.
   */
  // **One run, the full height of the hall** (4.6 m: `GARAGE_WALLS`). The heroes hang their work on this wall — the
  // dashboards, the ticket wall, the studio's sign — so the glazing is a *ribbon above all of it* (a clerestory, which is
  // what the word means), not a band the work has to dodge: it was a band from x = 4.4 east, and Serena's wall of
  // dashboards would have been hung across its panes.
  const WALL = GARAGE_WALLS.height
  box(g, 0.06, 0, -9.8, 20.12, WALL, .24, INK.wall)
  box(g, 0, WALL, -9.8, 20.4, 0.12, 0.35, INK.trim)
  skyPane(g, 2.4, WALL - 1.0, -9.68, 14.0, 0.8, 0.06)
  for (let x = -4.4; x <= 9.4; x += 1.4) box(g, x, WALL - 1.0, -9.7, 0.12, 0.8, 0.1, INK.trim)
  box(g, 2.4, WALL - 1.04, -9.62, 14.2, 0.06, 0.2, INK.trim)
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
    // One centimetre proud of the plinth's front face, which is at −6.38: a wall exactly on it would
    // have its south face and the slab's coplanar for the first 0.9 m, and two colours fight there.
    const wall = prop(env, g, `partition:${bay.id}`, (bay.x0 + bay.x1) / 2, -6.49)
    // The screen is a hand lower than the wall behind it: its job is to hide the plinth, whose far edge is 3.2 m back, and
    // a point 0.9 m up and 3.2 m behind the screen is seen over its top unless the top is above 4.1 m.
    box(wall, 0, 0, 0, w, WALL - 0.2, .24, INK.wall)
    box(wall, 0, WALL - 0.2, 0, w + .05, .12, .35, INK.trim)
    // the east return: from the screen's south-east corner back to the north wall's inner face
    const ret = -9.68 + 6.49 // local z of the north wall's face, relative to the screen at z = −6.49
    box(wall, w / 2 - .12, 0, ret / 2 - .06, .24, WALL - 0.2, -ret - .24, INK.wall)
    box(wall, w / 2 - .12, WALL - 0.2, ret / 2 - .06, .35, .12, -ret - .24, INK.trim)
    for (let y = .45; y < WALL - 0.2; y += .45) box(wall, w / 2, y, ret / 2 - .06, .007, .009, -ret - .24, '#bfb6a5', false)
    // The mortar joints are the wall's, so they go up with it: they were hung on the room, in the air
    // at z = −6.372, and stayed behind as lines across nothing once the wall had left.
    for (let y = .45; y < WALL - 0.2; y += .45) {
      box(wall, 0, y, .123, w, .009, .007, '#bfb6a5', false)
      for (let x = -w / 2 + (Math.round(y / .45) % 2 ? .5 : 1); x < w / 2; x += 1) box(wall, x, y - .43, .124, .008, .43, .008, '#c6bdac', false)
    }
  }
  // §7.8.12: the courtyard and both work wings share the simulation's perimeter.
  // Only the west back faces and the sign's gable stand tall; camera-side edges stay cut away.
  const edge = (from: readonly [number, number], to: readonly [number, number], h: number) => {
    wall(g, from, to, 0, h, .24, INK.wall)
    wall(g, from, to, h, .07, .33, INK.trim)
  }
  for (let i = 1; i < GARAGE_OUTLINE.length; i++) {
    const from = GARAGE_OUTLINE[i], to = GARAGE_OUTLINE[(i + 1) % GARAGE_OUTLINE.length]
    if (from[0] === -6 && to[0] === -10 && from[1] === 8) {
      const half = STUDIO_DOOR.width / (2 * Math.SQRT2)
      edge(from, [STUDIO_DOOR.x + half, STUDIO_DOOR.z - half], .55)
      edge([STUDIO_DOOR.x - half, STUDIO_DOOR.z + half], to, .55)
    } else {
      const west = from[0] === to[0] && (from[0] === -10 || from[0] === -13)
      const gable = from[1] === 12 && to[1] === 12
      edge(from, to, west ? WALL : gable ? STUDIO.wallHeight : .55)
    }
  }
  box(g, -9.84, 0, .7, .10, .7, 2.4, INK.wood)
  // A ribbon of glazing above the leaders, the west wall's half of the north wall's clerestory.
  skyPane(g, -9.88, WALL - 1.0, -6.0, 0.06, 0.8, 7.4)
  for (let z = -9.2; z <= -2.8; z += 1.4) box(g, -9.86, WALL - 1.0, z, 0.1, 0.8, 0.12, INK.trim)
  box(g, -9.8, WALL - 1.04, -6.0, 0.2, 0.06, 7.6, INK.trim)
  // The chamfered portal faces the lens along (+X,+Z), rather than showing its side.
  const door = entrance(g)
  gableSign(g, cast.studio ?? 'Merciless Software')
  // Retain the actual door meshes for both selection occlusion and projected
  // frame checks. Batched geometry would lose the individually testable portal.
  door.userData.dynamic = true
  door.traverse(node => { if (node instanceof T.Mesh) env.occluders.push(node) })
  // Frame-gate isolation: planter foliage is deliberately enclosed by pale
  // concrete too, so detecting architectural holes requires the bare shell.
  if (shellOnly) { finishGarage(g); batchArt(g, env.seatInstances); return env }
  // The ziggurat (`hqShell.ts`): the founder's podium and, at its foot, James's deck; and the platform each hero's set
  // stands on — Serena's is the plinth, Matt's his riser (a prop of its own, so that it comes with him: neither has
  // an old wall to hide behind), Billy's the floor itself, because he is standing on it with everybody else.
  const { podium, deck } = ziggurat(g)
  const platformOf: Record<HeroSiteId, T.Group> = {
    matt: heroRiser(g, prop(env, g, 'riser:matt'), 'matt'),
    serena: opsPlinth(g),
    billy: g,
  }
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
    // Each hero stands on their own platform (`floorPlan.HERO_SITES`); the founder on the podium, James on the deck.
    const site = (HERO_SITES as Record<string, HeroSite | undefined>)[station.id]
    const onStage = site !== undefined
    ;(site ? platformOf[station.id as HeroSiteId] : station.id === 'founder' ? podium : deck).add(spot)
    if (!cast_in) continue
    // [2026-10-04] Billy stands: his station is the easel and the person at it, and
    // has no desk or chair (he is the one hero who is always at the whiteboard,
    // §7.8.13). The easel is what drops in first on his arrival.
    // [2026-10-04] The heroes' sets are `hqSets.ts`'s: Billy's board and audience, Serena's
    // wall of dashboards, Matt's phones and ticket wall. Only the founder and James still
    // have the desk that the loop draws; Serena and Matt keep their chair in it.
    if (!onStage) {
      const desk = prop(env, spot, `desk:${station.id}`)
      // [2026-10-05] The founder's desk is his own design now (*"his desk redesigned"*); James's is the oak one.
      if (station.id === 'founder') craftedBossDesk(desk)
      else craftedHeroDesk(desk, station.id)
      garageDeskStory(desk, station.id)
      if (station.id === 'founder') bossChair(prop(env, spot, `chair:${station.id}`), 0, 0, Math.PI)
      else chair(prop(env, spot, `chair:${station.id}`), 0, 0, Math.PI, true)
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
      // A hero's plate on a wall is the set's marquee: over the middle of its wall, above it and clear of the work,
      // and lying along the wall it hangs on — the north wall's runs along +x, the west one's along −z. The offset is
      // in the station's own frame, which is turned and scaled, hence the division. A free-standing hero (Billy) and the
      // two on the podium and the deck have their plate over their heads, laid *across the screen*: the diagonal's
      // own axis, (1, −1), which is what every sign facing the lens is set along.
      if (site && site.wall !== 'free') {
        const along = site.wall === 'north' ? (site.x0 + site.x1) / 2 - station.x : -((site.z0 + site.z1) / 2 - station.z)
        const toWall = site.wall === 'north' ? site.z0 - station.z : site.x0 - station.x
        tag.userData.tagOffset = [along / GARAGE_HERO_SCALE, (3.9 - site.rise) / GARAGE_HERO_SCALE, (toWall + 0.1) / GARAGE_HERO_SCALE]
        tag.userData.tagAxis = site.wall === 'north' ? [1, 0] : [0, -1]
      } else {
        // James stands on the west wall facing +x (rot 90), and his plate lies along the wall at his back: toward −z, up and
        // to the right on §12.1's camera. The others face the lens.
        tag.userData.tagAxis = station.rot === 90 ? [0, -1] : [1, -1]
        // The enlarged legless Billy needs his plate above his crown, too.
        if (station.id === 'billy') tag.userData.tagOffset = [0, 2.75, 0]
      }
      // The floor they stand on: the podium's, the deck's, a plinth's or a riser's — and Billy's is his dais, which is not
      // a platform (the walk grid is closed under it by the easel's footprint, not by a terrace) but is what his feet are on.
      const floor = station.id === 'founder' ? GARAGE_PODIUM.rise : station.id === 'james' ? GARAGE_DECK.rise
        : station.id === 'billy' ? BILLY_PLAZA.dais.rise : site!.rise
      studioTarget(env, station.x, station.z, station.seat, station.id === 'founder' ? 'Founder' : station.id[0].toUpperCase() + station.id.slice(1), GARAGE_HERO_SCALE, floor, station.id === 'billy' ? 2.3 : 1.75)
    }
  }
  /*
   * The heroes' sets, now that their people exist to be moved. Built for whoever is in
   * the cast; `showGarageStations` decides what has arrived.
   */
  {
    const present = new Set((['billy', 'serena', 'matt'] as const).filter((id) => cast.heroes.includes(id)))
    const pos = (id: HeroSiteId) => { const l = GARAGE_LEADERS.find((q) => q.id === id)!; return { parent: platformOf[id], x: l.x, z: l.z, rot: l.rot } }
    env.hq = buildHqSets({ env, at: { billy: pos('billy'), serena: pos('serena'), matt: pos('matt') }, bodies: heroBodies, present })
  }
  /*
   * **The room's own light, drawn** [2026-10-05, *"make brighter and don't have the screens to be only light emitter,
   * the company sign needs to be ligth up too"*]: the studio's sign over the founder, lit; a standing lamp at each side
   * of the podium (on it: the group is at its height); and a sconce on the north wall between each pair of sets and at
   * the corner, with its wash up the plaster. None adds a light to the scene (`glowArt.ts`).
   */
  studioSign(g, cast.studio ?? 'Merciless Software', { wall: 'north', along: -7.6, width: 2.8, y: 2.7, height: 1.2 })
  standingLamp(podium, -5.95, -9.25)
  standingLamp(podium, -9.3, -9.25)
  for (const x of [-4.4, 1.2, 8.4]) sconce(g, x, 2.9, -9.64, 0)
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
   * The shapes are still authored here, because a sofa group is a dozen boxes
   * and reducing it to a rectangle would lose the room. What moved is the
   * decision about *where*: a sofa that moves in the picture now moves in the
   * walkability graph on the same edit, which is the whole point of §18.3
   * keeping the layout in `sim/`.
   */
  // [2026-10-05] **The low book storage and the three framed notices that dressed "the wall behind James"
  // are gone.** That wall is the Ops Room's plinth now, and they stood in the air at z = −6.34: the notices
  // hung on nothing in front of its face (found by looking at the first screenshot of the plan).
  const at = (kind: string) => GARAGE_FURNITURE.find(f => f.kind === kind)!
  for (const bench of GARAGE_FURNITURE.filter(f => f.kind === 'bench')) {
    const { g: seat, len, dep } = placed(g, bench)
    box(seat, 0, 0, 0, len, .55, dep, INK.wood)
    box(seat, 0, .55, 0, len + .08, .12, dep + .06, '#829caa')
    for (let i = 0; i < 5; i++) box(seat, -len / 2 + .2 + i * (len - .4) / 4, .08, -.2, .18, .36, .23, ['#648079', '#c39955', '#7593a0'][i % 3])
  }
  /*
   * **There is no kitchen** [2026-10-05, at the user's instruction: *"we can do without the kitchen now"*]. A 4.3 m
   * run of cupboards, a tall unit and a clerestory over them stood on the north wall's east end. The water errand has a
   * cooler, in the north-east corner now (it was against the east wall until the fifth pod took the place), with its
   * taps on the side that faces the room.
   */
  const cooler = at('cooler')
  box(g, cooler.x, 0, cooler.z, 0.46, 0.95, 0.46, '#d9dedd')
  box(g, cooler.x, 0.95, cooler.z, 0.5, 0.03, 0.5, '#b7bfbd')
  cylinder(g, cooler.x, 0.98, cooler.z, 0.17, 0.42, '#8dc3da')
  box(g, cooler.x - 0.1, 0.6, cooler.z + 0.24, 0.05, 0.05, 0.05, '#d1473b')
  box(g, cooler.x + 0.1, 0.6, cooler.z + 0.24, 0.05, 0.05, 0.05, '#4a7fb0')
  box(g, cooler.x, 0.4, cooler.z + 0.25, 0.26, 0.03, 0.08, '#8d9594')
  opsStep(prop(env, g, 'step:serena', OPS_STEP.x, OPS_STEP.z))
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
    for (const [x, z, size] of [[-15.4, -6, 3.1], [-15.8, -1, 2.7], [-15.5, 4.4, 2.4], [3, -11.7, 2.8], [8, -12, 3.2], [15.2, -7.8, 2.6], [17.5, 2, 2.3]]) {
      tree(groundAt(x, z), x, z, size)
      // Leave the foreground-right tree free of the two small pots.
      if (x !== 13.3) for (const dx of [-.9, .8]) planter(groundAt(x + dx, z + .7), x + dx, z + .7, .6)
    }
    hedge(lawn, 5.7, -10.8, 8.8, .75)

    hedge(pavement, 8.0, 9.85, 6.0, 0.65)
    hedge(pavement, -11.6, 12.65, 2.6, 0.65)
    hedge(pavement, 16.8, .1, .65, 7.0)
    planter(pavement, 10.9, 9, 0.8)
    for (let x = 0; x <= 2.3; x += 1.1) {
      line(g, [new T.Vector3(x, -0.3, 9.6), new T.Vector3(x, 0.8, 9.6),
        new T.Vector3(x + 0.65, 0.8, 9.6), new T.Vector3(x + 0.65, -0.3, 9.6)], INK.metal)
      for (const dx of [0, 0.65]) cylinder(g, x + dx, -0.3, 9.6, 0.035, 1.05, INK.metal)
    }
  }
  garageSurfaceDetails(g)
  hqInterior(g)
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
