/*
 * Copied from the rebuild (100m-devs-three/src/render/garageView.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The garage, on its own** — 2026-09-26.
 *
 * *"The UI port did not land sadly. Can you do me a proof of old game in
 * threejs with the current game garage?"* — then, playing it: *"I want people
 * to hop when I click on them, including me"*, *"the zoom should not resist me,
 * I should be able to zoom in"* and *"james drop scenes are not there neither"*.
 *
 * Everything the garage is, with nothing of the rebuild's shell around it: its
 * geometry and people (`garageEnvironment`), a night rig, SSAO and a
 * true-isometric camera. No store, no clock, no HUD. It draws into its
 * composer's targets, and the stage's glass (`glass.ts`) puts that on its
 * canvas — the screen, since the Pixi stage it used to be a texture inside was
 * decommissioned on 2026-09-28.
 *
 * **The camera belongs to the player.** Zoom is anchored at the pointer and is
 * never pulled back: no magnetic stops, no settle, only a floor and a ceiling a
 * long way apart. Pan is free within the room's reach.
 *
 * **People move by transform, not by rebuild.** The garage is batched, so a
 * body is a set of instance matrices (`worldArt.placeInstances`) plus the few
 * pieces the batcher declined; a hop or a drop writes a transform over both
 * every frame and puts the identity back when it lands. A hire drops its desk
 * and then its developer out of the ceiling; James drops in the same way when
 * he arrives, which is the joke the legacy build told with a falling silhouette.
 *
 * **[2026-09-26] It draws only when something changed** — *"The conversation in
 * phone is very clunky, it comes out slow, and sound effects lag, also the click
 * to skip lags too."* Measured on a landscape phone emulation (844 × 390 at 3×,
 * CPU slowed 4×), the dialogue ran at 30 fps over this room and 60 over the old
 * Pixi one, and nearly all of the difference was this file redrawing a still
 * room every frame: the shadow map re-rendered (three's `autoUpdate`), the SSAO
 * pass drawing the whole scene a second time, then the canvas copied into Pixi.
 * A dialogue is a still room for seconds at a time, so the room is drawn when
 * the camera, a light or a person moves, and otherwise only as often as the
 * typing arms need ({@link AMBIENT_HZ}). James no longer rebuilds the room either:
 * his station is built with it and shown when he lands (3.7 s frozen on the tap
 * that brings him in, measured, from every shader recompiling for his lights).
 */
import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { buildGarageEnvironment, GARAGE_ASSEMBLED, placeProp, showGarageSeats, showGarageStations, type GarageStaging } from './garageEnvironment.ts'
import { defaultCast, type StudioCast } from './studioPeople.ts'
import type { Environment, GarageProp } from './worldEnvironments.ts'
import { placeInstances, showSeatInstances, type SeatInstance } from './worldArt.ts'
import { LEADER_IDS, leaderSeat } from '../sim/floorPlan.ts'
import { createCityHouses } from './cityHouses.ts'
import { CITY_CAPACITY } from './cityGrid.ts'
import { OS, OS_SKIN } from '../art/skin.ts'
import type { Look } from '../sim/identity.ts'
import type { HeroTag } from '../../render/heroTags.ts'

export interface GarageView {
  /**
   * The renderer's canvas — the screen, since the Pixi stage went on
   * 2026-09-28. `render` draws the room into {@link output}; the stage's glass
   * (`glass.ts`) is what puts it on this canvas, every frame.
   */
  canvas: HTMLCanvasElement
  /** The renderer, for the stage's glass to draw the last pass with. */
  readonly renderer: T.WebGLRenderer
  /** The room as last drawn, tone-mapped and bloomed: the glass's input. */
  readonly output: T.Texture
  /**
   * §6 pass 3 — how much of the room's highlights come back as bloom (0 is
   * off). Moves with the studio's strain; see `glass.ts`.
   */
  setBloom(strength: number): void
  /** Ease the camera back to the room framed at rest — TEAM's way home. */
  home(): void
  /** Open an address on demand, keeping global developer identities. */
  visit(seat: number): void
  /** Houses landed since the room was made; the stage plays each contact once. */
  readonly landings: number
  readonly ignitions: number
  /** Ordinary hires fill the garage to twenty, then move to hundred-person houses (§7.7.2). */
  setHeadcount(n: number): void
  setRunSeed(seed: number): void
  /** Whether James has arrived; he drops in when he does. */
  setJames(here: boolean): void
  /** The founder the player made, and the studio's name on the gable. Rebuild only on change. */
  setIdentity(founder: Look, studio: string | null): void
  resize(width: number, height: number): void
  /** The resting zoom, 1 = the room framed. */
  setLens(zoom: number): void
  /** Zoom by `factor` about canvas point (x, y), in CSS pixels. */
  zoomAt(factor: number, x: number, y: number): void
  /** Zoom to an absolute value about canvas point (x, y) — a pinch's baseline times its ratio. */
  zoomTo(zoom: number, x: number, y: number): void
  readonly zoom: number
  /** Pan by a drag of (dx, dy) CSS pixels: the room follows the finger. */
  panBy(dx: number, dy: number): void
  /** Click hops include the founder; spontaneous work never does. */
  hop(seat: number, mild?: boolean): void
  nameTags(): HeroTag[]
  setProject(spec: import('../sim/cover.ts').CoverSpec, title: string, progress: number): void
  codingSeats(): number[]
  /**
   * Ease the camera to a person — a seat, or -1 the founder, -2 James — for a
   * line of dialogue, and back to where the player had it on `null`. The
   * player's own zoom or pan ends it.
   */
  focus(seat: number | null, screenY?: number): void
  /**
   * Turn a person to face the lens while they speak, and back to the desk when
   * somebody else does or on `null` — the old room's `setSpeaker`. Separate from
   * `focus` on purpose: the founder is framed for CODE too, and coding is done
   * with your back to the camera.
   */
  setSpeaker(seat: number | null): void
  /** Is anybody at this seat still falling or hopping? */
  animating(seat: number): boolean
  /** Is the camera still on its way to a `focus`? A drop waits for it to arrive. */
  readonly easing: boolean
  /** Advance and, if anything changed, draw. True when the canvas was redrawn. */
  render(seconds: number): boolean
  /**
   * Who is under canvas point (x, y), in CSS pixels: a seat index, -1 for the
   * founder, or null for floor, furniture and sky.
   */
  pick(x: number, y: number): number | null
  /** Where a person is on the canvas, in CSS pixels, or null if absent or off the frame. */
  screenOf(seat: number): { x: number; y: number } | null
  dispose(): void
}

/**
 * How far the player may zoom: well out past the room, and in to a face.
 *
 * Exported because the stage reads the lens off them: §7.2's Z, which the
 * music, the poke sounds and the store's tier all still speak, is the garage's
 * zoom mapped onto the room's three stops (`render/stage.ts`).
 */
export const GARAGE_ZOOM_MIN = 0.45
export const GARAGE_ZOOM_MAX = 7
/**
 * The room framed at rest: pulled back a little from 1, which frames the room
 * edge to edge. The margin was first given to the Pixi glass, on the belief
 * that its curvature magnified the middle; it never did (`glass.ts`), but the
 * framing is the one the game has been played at, and a room with a little
 * street around it reads as a place rather than a diagram.
 */
export const GARAGE_REST_ZOOM = 0.8
const ZOOM_MAX = GARAGE_ZOOM_MAX
/** How far a hire falls, in metres — the rebuild's DROP_FROM. */
const DROP_FROM = 3.4
/**
 * How often a room where nothing but the typing arms moves is redrawn. The arms
 * swing at under 1.5 Hz through eight hundredths of a radian; 24 frames a second
 * is film's rate and more than that motion can show, and it is the whole of the
 * room's cost while a conversation is on screen.
 */
const AMBIENT_HZ = 24

export interface GarageViewOptions {
  /**
   * A phone: no SSAO pass, one pixel per CSS pixel, a 1024 shadow map. The
   * glass (CRT lines, curvature, bloom) goes over the room afterwards at the
   * stage's own resolution, which is what hides the difference.
   */
  lite?: boolean
  /**
   * A piece of a drop has hit the floor — the desk, the chair or the person. The
   * view draws; what it sounds like is the stage's, so `three/` stays free of
   * the audio layer.
   */
  onLand?: (piece: 'desk' | 'chair' | 'body') => void
}

type Piece = 'desk' | 'chair' | 'body'
interface Anim {
  seat: number
  /**
   * `lift` is a drop run backwards: the person, then their desk, then their
   * chair, yanked up out of the roof. It is how the garage's twenty leave for
   * the house on the next block, and it is the move the first Paradigm Shift's
   * liquidation will play (GDD §15.1a).
   */
  kind: 'hop' | 'drop' | 'lift'
  start: number
  delay: number
  mild?: boolean
  /** A drop's pieces, each falling at its own offset: a hire is desk then person. */
  pieces?: { piece: Piece; at: number; puffed?: boolean }[]
}
/** A hire: the desk, then its developer a beat later. */
const HIRE_DROP: NonNullable<Anim['pieces']> = [{ piece: 'desk', at: 0 }, { piece: 'body', at: .25 }]
/**
 * James: *"me: what? then james desk, then chair, then james fall, then, he
 * said, ouch"* — three landings, each heard before the next begins.
 */
const JAMES_DROP: NonNullable<Anim['pieces']> = [{ piece: 'desk', at: 0 }, { piece: 'chair', at: .55 }, { piece: 'body', at: 1.1 }]
/** A departure: the developer, then their desk, then their chair — a hire played backwards. */
const LIFT_OUT: NonNullable<Anim['pieces']> = [{ piece: 'body', at: 0 }, { piece: 'desk', at: .14 }, { piece: 'chair', at: .24 }]
/** How high a departure is yanked before it is out of the picture, in metres. */
const LIFT_TO = 26
/** Moving day: the garage starts emptying this long after the house is told to fall — once it has landed. */
const MOVE_AFTER = 1.6
/** …one developer this far after the last. */
const MOVE_STEP = 0.07
/** The studio a garage holds: five pods of four (§7.8.0). */
const GARAGE_CAP = 20
/**
 * Device pixels per pixel of the 3D picture at the resting zoom. The grid
 * follows the lens (zoomed out it shrinks to one device pixel, so the city
 * stays readable) but is *capped* at PIXEL_MAX: a grid that kept growing with
 * the zoom turned the two founders' faces into blobs at the closest lens, so
 * the finest grain the game has is held there. Whole numbers only: a
 * fractional ratio magnified with nearest sampling gives uneven pixels.
 */
const PIXEL_AT_REST = 2
const PIXEL_MAX = 2
const pixelFor = (zoom: number) => Math.max(1, Math.min(PIXEL_MAX, Math.round(PIXEL_AT_REST * zoom / GARAGE_REST_ZOOM)))
interface Rest { position: T.Vector3; scale: T.Vector3 }
interface Part { key: string; instances: SeatInstance[]; group: T.Object3D | null }

export function createGarageView(width: number, height: number, cast: StudioCast = defaultCast(), options: GarageViewOptions = {}): GarageView {
  const lite = options.lite ?? false
  // No antialias on the canvas itself: the composer draws into its own
  // multisampled targets, and the canvas only ever receives the glass's quad.
  // Nothing copies it any more (the Pixi stage did, as a texture, until
  // 2026-09-28), so it keeps no drawing buffer between frames.
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false })
  renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.03
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap
  // Redrawn when something that casts a shadow moves (`needsUpdate`), not every
  // frame: three's default re-rendered the 2048² map sixty times a second over a
  // room that was standing still.
  renderer.shadowMap.autoUpdate = false

  const scene = new T.Scene()
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 300)

  // The rebuild's rank-0 rig, turned to dusk for this build's glass: a low
  // violet key placed by where its shadow lands, the legacy neutral sky, and the
  // room's own screens and lamps doing the rest (`garageCraft`, `garageEnvironment`).
  const sky = new T.HemisphereLight('#fffdf8', '#a5a59a', 1.15)
  scene.add(sky)
  const sun = new T.DirectionalLight('#fff0d6', 2.7)
  sun.position.set(22, 28, 10)
  sun.castShadow = true
  sun.shadow.mapSize.setScalar(lite ? 1024 : 2048)
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 120 })
  sun.shadow.normalBias = 0.025
  sun.shadow.bias = -0.0001
  scene.add(sun)
  scene.add(sun.target)
  const fill = new T.DirectionalLight('#e6effa', 0.55)
  fill.position.set(-32, 15, -10)
  scene.add(fill)
  if (OS_SKIN) {
    sun.color.set('#bdc6cb'); sun.intensity = .7
    sky.color.set(OS.n3); sky.groundColor.set(OS.n0); sky.intensity = .55
    fill.color.set(OS.calm2); fill.intensity = .12
    renderer.toneMappingExposure = 1.1
  }

  const composer = new EffectComposer(renderer)
  /*
   * Pixel-art 3D: the room is drawn into targets `pixel` CSS pixels to the
   * texel and the glass magnifies them with nearest-neighbour sampling, so the
   * 3D geometry resolves into chunky, hard-edged pixels. No MSAA for the same
   * reason — multisampling would blend the stair-stepped edges back to smooth.
   * `pixel` follows the zoom (`pixelFor`), so the grid is fixed in the world.
   * At `pixel` 1 there is no grid left to show: the targets go back to the
   * screen's own device resolution, smoothed and multisampled, so the zoomed-
   * out city is as sharp as it was before the pixel look, not a 1×-CSS-pixel
   * picture doubled up on a high-density screen.
   */
  let pixel = PIXEL_AT_REST
  // `pixel` counts device pixels, so a retina screen gets a finer grid than a 1× one.
  const grainRatio = () => renderer.getPixelRatio() / pixel
  function setGrain(next: number) {
    pixel = next
    composer.setPixelRatio(grainRatio())
    for (const target of [composer.renderTarget1, composer.renderTarget2]) {
      const filter = pixel === 1 ? T.LinearFilter : T.NearestFilter
      target.texture.minFilter = filter
      target.texture.magFilter = filter
      target.samples = pixel === 1 ? 4 : 0
      // A new sample count only takes on a freshly allocated framebuffer.
      target.dispose()
    }
    ao?.setSize(w * grainRatio(), h * grainRatio())
    bloom.setSize(w * grainRatio(), h * grainRatio())
  }
  // The first frame's grain; `setGrain` takes over from the first render.
  composer.setPixelRatio(grainRatio())
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    target.samples = 0
    target.texture.minFilter = T.NearestFilter
    target.texture.magFilter = T.NearestFilter
  }
  composer.addPass(new RenderPass(scene, camera))
  // Off on a phone: it draws the whole scene a second time (normals and depth)
  // and then samples it sixteen times a pixel, and at night under the glass it
  // is the contact shade under a desk that nobody on a six-inch screen can see.
  const ao = lite ? null : new SSAOPass(scene, camera, width, height, 16)
  if (ao) {
    ao.kernelRadius = .65; ao.minDistance = .00012; ao.maxDistance = .009
    ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA = 0
    ao.ssaoMaterial.needsUpdate = true
    composer.addPass(ao)
  }
  composer.addPass(new OutputPass())
  /*
   * §6 pass 3, moved here from the Pixi glass (2026-09-28). After the output
   * pass, so it thresholds brightness as displayed — AdvancedBloomFilter's
   * 0.74 kept its meaning: the lamps, the screens and the sign bloom, the
   * concrete does not (§7.8.0c). The stage sets its strength from entropy.
   */
  const bloom = new UnrealBloomPass(new T.Vector2(width, height), 0, 0.2, 0.74)
  composer.addPass(bloom)
  // Into the composer's own targets: the stage's glass puts the result on
  // screen every frame, and this only redraws when the room changed.
  composer.renderToScreen = false

  let env: Environment
  let heads = 0
  let addressOffset = 0, visiting: number | null = null
  let james = false
  /** The first headcount and James arrive with the save, not as events: no drop. */
  let settled = false
  let w = width, h = height
  let zoom = 1
  const pan = new T.Vector3()
  /**
   * The animations' clock: frame time, capped. A stall (the first hire compiles
   * a puff's material; James's arrival rebuilds the room) must not eat the
   * drop it happened during — on the wall clock the whole fall was over before
   * the next frame was drawn, and the room just had more people in it.
   */
  let clock = 0
  let lastSeconds: number | null = null
  /**
   * A dialogue's focus: the camera eases to the speaker (§10.7a.1, *"camera
   * should focus on the person when their turn of speech"*), and `saved` is
   * where the player had it, to go back to when the scene ends.
   */
  let focusOn: { pan: T.Vector3; zoom: number } | null = null
  /**
   * People turned toward the lens for a line, by the group that turns, with the
   * yaw it had at its desk. A released one eases home and is dropped once there.
   */
  let speaking: T.Object3D | null = null
  const turned = new Map<T.Object3D, number>()
  const FACE_RATE = 9
  let saved: { pan: T.Vector3; zoom: number } | null = null
  let shake = 0
  /** Something the picture shows has changed since it was last drawn. */
  let dirty = true
  let drawnAt = -Infinity
  /**
   * Every screen and lamp light, lifted out of its desk into the scene when the
   * room is built, and switched by intensity rather than visibility. A hidden
   * desk's light used to leave the scene with it, and a change in the number of
   * lights recompiles every material: measured, a 917 ms frame on each hire.
   */
  let lights: { light: T.PointLight; owner: T.Object3D | null; intensity: number }[] = []
  /** Seated arms, for the typing: the room is not a photograph. */
  let arms: { arm: T.Object3D; offset: number; side: number }[] = []
  const anims: Anim[] = []
  const rests = new Map<string, Rest>()
  /** Dust: a hire's small puff, or `size` times it, rung out round a house's base. */
  const puffs: { mesh: T.Mesh; start: number; dir: T.Vector3; size?: number }[] = []
  const puffGeometry = new T.IcosahedronGeometry(0.28, 0)
  // One puff, never seen, so the material is compiled with the room and not on
  // the first landing (it was the rest of that frame's stall).
  const puffWarm = new T.Mesh(puffGeometry, new T.MeshStandardMaterial({ color: '#d8d2cf', roughness: 1, flatShading: true, transparent: true, opacity: 0 }))
  // In the frame, or the frustum culls it and it is never compiled after all.
  puffWarm.position.set(0, 1, 1.3)
  puffWarm.scale.setScalar(0.001)
  puffWarm.frustumCulled = false
  scene.add(puffWarm)

  /** §7.7.2: each house owns one block, and shares the garage's light and clock. */
  let landings = 0, ignitions = 0
  const city = createCityHouses({
    landed(footprint) { dustRing(footprint); landings += 1 },
    ignited() { ignitions += 1 },
    exhaust(footprint) { dustRing(footprint, true) },
  }, () => cast)
  scene.add(city.root)
  /** How far out the lens may go, and how far the pan may reach: wider as the city grows. */
  let zoomFloor = .005
  let cityReach = 0
  /** The garage and its street, for framing it together with the city. */
  const GARAGE_BOX = new T.Box3(new T.Vector3(-12.5, -0.5, -11), new T.Vector3(12.5, 4.2, 12.5))

  function build() {
    if (env) {
      scene.remove(env.root)
      env.root.traverse((o) => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose() })
    }
    for (const l of lights) l.light.removeFromParent()
    // James's station is built whether or not he has arrived, and `showGarageStations`
    // decides whether it is drawn: a room whose light count changes when he
    // lands recompiles every material in it.
    env = buildGarageEnvironment(heads, withJames(), 'on', false, staging(), true)
    scene.add(env.root)
    env.root.updateMatrixWorld(true)
    lights = []
    const found: T.PointLight[] = []
    env.root.traverse((o) => { if (o instanceof T.PointLight) found.push(o) })
    for (const light of found) {
      const owner = light.parent
      scene.attach(light)
      lights.push({ light, owner, intensity: light.intensity })
    }
    scene.background = new T.Color(OS_SKIN ? OS.n0 : env.background)
    // Compile every seat's materials now, with the room, rather than on the frame
    // a hire first reveals them: three compiles what it has drawn, and an unhired
    // desk has never been drawn (measured: a 283 ms frame on the first hire).
    showGarageSeats(env, 20, 0)
    showGarageStations(env, GARAGE_ASSEMBLED, withJames())
    frame()
    renderer.compile(scene, camera)
    showGarageSeats(env, heads, 20)
    showGarageStations(env, staging(), withJames())
    arms = []
    rests.clear()
    anims.length = 0
    env.root.traverse((o) => {
      const side = o.name === 'arm-1' ? -1 : o.name === 'arm1' ? 1 : 0
      if (side && !o.parent?.userData.standing) arms.push({ arm: o, offset: arms.length * 1.7, side })
    })
    renderer.shadowMap.needsUpdate = true
    dirty = true
  }

  /** The cast the room is built for: whoever the player is, and James's station either way. */
  function withJames(): StudioCast {
    return { ...cast, heroes: ['james'] }
  }

  /** How much of the hero stations is standing: the founder's always, James's once he is here. */
  function staging(): GarageStaging {
    return { founder: true, james: james ? 3 : 0 }
  }

  /** The frame's width in world units, at the current zoom. */
  const span = () => env.extent / Math.min(1, (w / h) / 1.35) / zoom

  function frame() {
    const focus = env.focus.clone().add(pan)
    const direction = new T.Vector3(1, 1, 1).normalize()
    camera.position.copy(focus).addScaledVector(direction, Math.max(80, span() * 1.5))
    camera.far = Math.max(300, span() * 3)
    camera.up.set(0, 1, 0)
    camera.lookAt(focus)
    if (shake > 0) camera.position.add(new T.Vector3((Math.random() - .5) * shake, (Math.random() - .5) * shake, 0))
    const aspect = w / h
    const s = span()
    camera.left = -s / 2; camera.right = s / 2
    camera.top = s / 2 / aspect; camera.bottom = -s / 2 / aspect
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  /** The camera's own right and up, in the world — a drag and a zoom anchor move along these. */
  /**
   * Ease the speaker round to face the lens and everyone released back to their
   * desk. The camera looks along a fixed (1, 1, 1), so "toward the lens" is one
   * world heading, and a figure's front is local -Z (its face is built at
   * z -0.2). The turning group sits under a station that is itself turned and
   * holds the person at a yaw of its own, so the heading is worked out against
   * both rather than assumed.
   */
  const FACING = Math.atan2(-1, -1)
  function turnPeople(dt: number) {
    const k = 1 - Math.exp(-FACE_RATE * dt)
    for (const [group, rest] of turned) {
      let to = rest
      if (group === speaking) {
        const parent = group.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion()
        const parentYaw = new T.Euler().setFromQuaternion(parent, 'YXZ').y
        const person = group.children.find((c) => c.userData.dynamic) ?? group.children[0]
        to = FACING - parentYaw - (person?.rotation.y ?? 0)
      }
      // The short way round, whatever the angles have accumulated to.
      const delta = Math.atan2(Math.sin(to - group.rotation.y), Math.cos(to - group.rotation.y))
      if (Math.abs(delta) < .002) {
        group.rotation.y = to
        if (group !== speaking) turned.delete(group)
      } else {
        group.rotation.y += delta * k
        dirty = true
      }
    }
  }

  function axes() {
    frame()
    return {
      right: new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
      up: new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
    }
  }

  /** The pan may reach the room's edge and a little beyond, never off into the dark — or the occupied blocks, once there is one. */
  function clampPan() {
    const reach = Math.max(env.extent * 0.7, cityReach)
    if (pan.length() > reach) pan.setLength(reach)
  }

  /**
   * The camera that frames `box`: where to pan and how far to zoom out. The
   * view is orthographic along (1, 1, 1), so the box's corners project
   * linearly onto the camera's right and up, and the centre of that projection
   * is where the focus has to be.
   */
  function fitTo(box: T.Box3, margin = 1.12): { pan: T.Vector3; zoom: number } {
    const { right, up } = axes()
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    const c = new T.Vector3()
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      c.set(x, y, z)
      const px = c.dot(right), py = c.dot(up)
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
    }
    const aspect = w / h
    const f = env.focus
    const target = new T.Vector3()
      .addScaledVector(right, (x0 + x1) / 2 - f.dot(right))
      .addScaledVector(up, (y0 + y1) / 2 - f.dot(up))
    const across = Math.max((x1 - x0) * margin, (y1 - y0) * margin * aspect)
    return { pan: target, zoom: env.extent / Math.min(1, aspect / 1.35) / across }
  }

  /** The garage with whatever stands in the city. */
  function studioBox(): T.Box3 {
    const box = GARAGE_BOX.clone()
    const lot = city.bounds()
    if (lot) box.union(lot)
    return box
  }

  /** Let the lens out as far as the whole studio, and the pan as far as the city. */
  function reframeLimits() {
    if (city.count === 0) {
      zoomFloor = .005; cityReach = 0
      sun.position.set(22, 28, 10); sun.target.position.set(0, 0, 0)
      Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 120 })
      sun.shadow.camera.updateProjectionMatrix()
      renderer.shadowMap.needsUpdate = true
      return
    }
    const occupied = studioBox()
    const fit = fitTo(occupied)
    zoomFloor = Math.min(.005, fit.zoom * .85)
    // A city grows on every side; distance to its centre is not its reach.
    cityReach = Math.max(occupied.min.distanceTo(env.focus), occupied.max.distanceTo(env.focus)) + 14
    const centre = occupied.getCenter(new T.Vector3())
    const radius = Math.max(35, occupied.getSize(new T.Vector3()).length() / 2)
    sun.target.position.copy(centre)
    sun.position.copy(centre).add(new T.Vector3(radius * .7, radius * 1.3, radius * .4))
    Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: radius * 4 })
    sun.shadow.camera.updateProjectionMatrix()
    renderer.shadowMap.needsUpdate = true
  }

  /** A house is on its way: the camera eases out to show where it will land, and the garage with it. */
  function frameStudio() {
    const fit = fitTo(studioBox())
    saved = null
    focusOn = { pan: fit.pan, zoom: Math.max(zoomFloor, Math.min(ZOOM_MAX, fit.zoom)) }
    dirty = true
  }

  // --- who is where: a person is some instances, a group, and a desk -----------

  const leaderId = (seat: number) => LEADER_IDS.find((id) => leaderSeat(id) === seat)

  function body(seat: number): Part[] {
    const id = leaderId(seat)
    if (id) {
      const handle: GarageProp | undefined = env.props?.get(`body:${id}`)
      return handle ? [{ key: `body:${id}`, instances: handle.instances, group: handle.group }] : []
    }
    return [{
      key: `body:${seat}`,
      instances: env.seatInstances?.get(seat) ?? [],
      group: env.people.find((p) => Number(p.userData.seat) === seat) ?? null,
    }]
  }

  function desk(seat: number): Part | null {
    const key = `desk:${leaderId(seat) ?? seat}`
    const handle = env.props?.get(key)
    return handle ? { key, instances: handle.instances, group: handle.group } : null
  }

  function chair(seat: number): Part | null {
    // A leader's chair is a prop by name; an ordinary seat's by number, and it
    // only ever moves when its owner leaves for the house on the next block.
    const key = `chair:${leaderId(seat) ?? seat}`
    const handle = env.props?.get(key)
    return handle ? { key, instances: handle.instances, group: handle.group } : null
  }

  function pieceParts(seat: number, piece: Piece): Part[] {
    if (piece === 'body') return body(seat)
    const part = piece === 'desk' ? desk(seat) : chair(seat)
    return part ? [part] : []
  }

  /** Out of the picture until its turn: a desk hanging in the air is not a desk arriving. */
  function hide(part: Part) {
    placeInstances(part.instances, new T.Matrix4().makeScale(0, 0, 0))
    if (part.group) part.group.visible = false
  }

  /** Where a seat stands on the floor, from its hit box: the base a squash is about. */
  function floorAt(seat: number): T.Vector3 | null {
    const t = env.targets.find((target) => target.index === seat)
    return t ? t.mesh.getWorldPosition(new T.Vector3()).setY(0) : null
  }

  /** Lift a part by `y` and squash it by `squash` (volume kept) about `base`. */
  function place(part: Part, base: T.Vector3, y: number, squash: number) {
    let r = rests.get(part.key)
    if (!r) {
      r = { position: part.group ? part.group.position.clone() : new T.Vector3(), scale: part.group ? part.group.scale.clone() : new T.Vector3(1, 1, 1) }
      rests.set(part.key, r)
    }
    const sxz = 1 / Math.sqrt(Math.max(.2, squash))
    const delta = new T.Matrix4()
      .makeTranslation(base.x, base.y + y, base.z)
      .multiply(new T.Matrix4().makeScale(sxz, squash, sxz))
      .multiply(new T.Matrix4().makeTranslation(-base.x, -base.y, -base.z))
    placeInstances(part.instances, delta)
    if (part.group) {
      part.group.visible = true
      part.group.position.set(r.position.x, r.position.y + y, r.position.z)
      part.group.scale.set(r.scale.x * sxz, r.scale.y * squash, r.scale.z * sxz)
    }
  }

  function puff(at: T.Vector3) {
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2
      const mesh = new T.Mesh(puffGeometry, new T.MeshStandardMaterial({ color: '#d8d2cf', roughness: 1, flatShading: true, transparent: true, opacity: .8 }))
      mesh.position.set(at.x + Math.cos(a) * .35, .15, at.z + Math.sin(a) * .35)
      scene.add(mesh)
      puffs.push({ mesh, start: clock, dir: new T.Vector3(Math.cos(a), 0, Math.sin(a)) })
    }
    shake = Math.max(shake, .12)
  }

  /**
   * One ordinary seat, empty: its desk, chair, person and hit box out of the
   * picture. `showGarageSeats` does this for a range and sweeps the pods'
   * planters with it, which is right for a headcount and wrong for a seat
   * whose neighbours are still sitting there.
   */
  function vacate(seat: number) {
    placeProp(env.props?.get(`desk:${seat}`), null)
    placeProp(env.props?.get(`chair:${seat}`), null)
    const person = env.people.find((p) => Number(p.userData.seat) === seat)
    if (person) person.visible = false
    showSeatInstances(env.seatInstances?.get(seat) ?? [], false)
    const hit = env.targets.find((t) => t.rank === 0 && t.index === seat)
    if (hit) hit.mesh.visible = false
  }

  /**
   * §7.7.2 — *"Dust rings out from the base."* A ring of the hire's puffs round
   * the house's footprint, bigger and quicker, pushed outwards, and the
   * camera takes the whump.
   */
  function dustRing(footprint: T.Box3, exhaust = false) {
    const c = footprint.getCenter(new T.Vector3())
    const hw = (footprint.max.x - footprint.min.x) / 2 + .6
    const hd = (footprint.max.z - footprint.min.z) / 2 + .6
    const perimeter = 4 * (hw + hd)
    const n = 30
    for (let k = 0; k < n; k++) {
      // Round the rectangle at an even spacing, pushed out along its normal.
      let s = (k / n) * perimeter
      let x: number, z: number, dir: T.Vector3
      if (s < 2 * hw) { x = c.x - hw + s; z = c.z + hd; dir = new T.Vector3(0, 0, 1) }
      else if ((s -= 2 * hw) < 2 * hd) { x = c.x + hw; z = c.z + hd - s; dir = new T.Vector3(1, 0, 0) }
      else if ((s -= 2 * hd) < 2 * hw) { x = c.x + hw - s; z = c.z - hd; dir = new T.Vector3(0, 0, -1) }
      else { s -= 2 * hw; x = c.x - hw; z = c.z - hd + s; dir = new T.Vector3(-1, 0, 0) }
      const mesh = new T.Mesh(puffGeometry, new T.MeshStandardMaterial({ color: '#d8d2cf', roughness: 1, flatShading: true, transparent: true, opacity: .8 }))
      mesh.position.set(x, footprint.min.y + .35, z)
      scene.add(mesh)
      puffs.push({ mesh, start: clock, dir: dir.multiplyScalar(3.2), size: 2.6 })
    }
    shake = Math.max(shake, exhaust ? .025 : .12)
  }

  function start(seat: number, kind: 'hop' | 'drop' | 'lift', delay = 0, pieces?: Anim['pieces'], mild = false) {
    // A hop does not interrupt a landing, and a second hop restarts the first.
    const running = anims.findIndex((a) => a.seat === seat)
    if (running >= 0) {
      if (anims[running].kind === 'drop' && kind === 'hop') return
      anims.splice(running, 1)
    }
    anims.push({ seat, kind, start: clock, delay, mild, pieces: pieces?.map((p) => ({ ...p })) })
  }

  function animate() {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]
      const t = clock - a.start - a.delay
      const base = floorAt(a.seat)
      if (!base) { anims.splice(i, 1); continue }
      if (a.kind === 'hop') {
        const parts = body(a.seat)
        if (t < 0) continue
        // Crouch, spring, fly, land: under half a second.
        const y = t < .07 || t >= .37 ? 0 : .55 * Math.sin(Math.PI * (t - .07) / .3)
        const s = t < .07 ? 1 - .18 * (t / .07) : t < .37 ? 1.08 : t < .47 ? 1 - .14 * Math.sin(Math.PI * (t - .37) / .1) : 1
        const strength = a.mild ? .22 : 1
        parts.forEach((p) => place(p, base, y * strength, 1 + (s - 1) * strength))
        if (t >= .47) { parts.forEach((p) => place(p, base, 0, 1)); anims.splice(i, 1) }
        continue
      }
      if (a.kind === 'lift') {
        /*
         * A hire played backwards: a crouch, then up and away through the roof,
         * accelerating — the reverse of a free fall — with a puff where each
         * piece left the floor. Nobody reacts (§7.7.2). A piece that is gone is
         * put back at rest *and* hidden, so the seat is ordinary empty floor
         * when somebody is next hired into it.
         */
        let done = true
        for (const piece of a.pieces ?? LIFT_OUT) {
          const u = (t - piece.at) / .5
          const these = pieceParts(a.seat, piece.piece)
          if (u < 0) { done = false; continue }
          if (u >= 1) { these.forEach((p) => { place(p, base, 0, 1); hide(p) }); continue }
          done = false
          const stretch = u < .12 ? 1 - .22 * Math.sin(Math.PI * u / .12) : 1.14
          these.forEach((p) => place(p, base, LIFT_TO * u * u, stretch))
          if (!piece.puffed) { piece.puffed = true; puff(base) }
        }
        if (done) {
          anims.splice(i, 1)
          vacate(a.seat)
          // The pods' planters go with the last of their people, not the first.
          if (!anims.some((x) => x.kind === 'lift')) showGarageSeats(env, heads, heads)
        }
        continue
      }
      /*
       * A drop: the desk lands first, then its developer on top of it. Free
       * fall (distance as t², fastest at the floor), **one bounce**, then rest,
       * with a squash at each contact — the legacy arrivals' physics
       * (`render/arrivals.ts`): an object that eases into the floor reads as a
       * crane lowering it, one that stops dead as a sprite switched on.
       */
      const fall = (u: number) =>
        u < 1 ? DROP_FROM * (1 - u * u) : u < 1.5 ? .32 * Math.sin(Math.PI * (u - 1) / .5) : 0
      const land = (u: number) =>
        u >= 1 && u < 1.15 ? 1 - .24 * Math.sin(Math.PI * (u - 1) / .15)
          : u >= 1.5 && u < 1.62 ? 1 - .12 * Math.sin(Math.PI * (u - 1.5) / .12) : 1
      let done = true
      for (const piece of a.pieces ?? HIRE_DROP) {
        const u = (t - piece.at) / .45
        const these = pieceParts(a.seat, piece.piece)
        if (u < 0) { these.forEach(hide); done = false; continue }
        if (u < 1.62) done = false
        these.forEach((p) => place(p, base, u >= 1.62 ? 0 : fall(u), u >= 1.62 ? 1 : land(u)))
        if (u >= 1 && !piece.puffed) { piece.puffed = true; puff(base); options.onLand?.(piece.piece) }
      }
      if (done) anims.splice(i, 1)
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]
      const u = (clock - p.start) / .55
      p.mesh.position.addScaledVector(p.dir, .02)
      p.mesh.scale.setScalar((.6 + u * 1.2) * (p.size ?? 1))
      ;(p.mesh.material as T.MeshStandardMaterial).opacity = Math.max(0, .8 * (1 - u))
      if (u >= 1) { scene.remove(p.mesh); (p.mesh.material as T.Material).dispose(); puffs.splice(i, 1) }
    }
    shake *= .85
    if (shake < .005) shake = 0
    if (anims.length || puffs.length) renderer.shadowMap.needsUpdate = true
    if (anims.length || puffs.length || shake > 0) dirty = true
  }

  const view: GarageView = {
    canvas: renderer.domElement,
    renderer,
    get output() {
      // After a render, the composer's last pass has left the frame in the read
      // buffer; between renders it is still there.
      return composer.readBuffer.texture
    },
    setBloom(strength) {
      const next = Math.max(0, strength)
      // A change nobody could see is not a reason to redraw the room.
      if (Math.abs(next - bloom.strength) < 0.01) return
      bloom.strength = next
      bloom.enabled = next > 0
      dirty = true
    },
    visit(seat) {
      const worldBase = Math.floor(Math.max(0, seat) / 100_000_000) * 100_000_000
      addressOffset = seat < 0 ? 0 : worldBase + Math.floor((seat - worldBase) / CITY_CAPACITY) * CITY_CAPACITY
      city.setOffset(addressOffset); visiting = seat
      env.root.visible = addressOffset === 0
      settled = false
      dirty = true
    },
    home() {
      if (addressOffset !== 0) view.visit(-1)
      saved = null
      focusOn = { pan: new T.Vector3(), zoom: GARAGE_REST_ZOOM }
      dirty = true
    },
    get landings() { return landings },
    get ignitions() { return ignitions },
    setRunSeed(seed) {
      if (cast.seed === seed) return
      cast = { ...cast, seed }; city.reset(); settled = false; build()
    },
    setHeadcount(n) {
      const total = Math.max(0, Math.floor(n))
      const inGarage = addressOffset === 0 && total <= GARAGE_CAP ? total : 0
      const remaining = 100_000_000 - addressOffset % 100_000_000
      const across = total > GARAGE_CAP ? Math.max(0, Math.min(total - addressOffset, CITY_CAPACITY, remaining)) : 0
      const hadHouses = city.count
      const wasHeads = heads
      if (inGarage !== heads) {
        heads = inGarage
        if (inGarage > wasHeads) {
          showGarageSeats(env, heads, wasHeads)
          // A hire is an event: each new desk and developer falls in, a beat apart.
          if (settled) for (let s = wasHeads; s < inGarage; s++) start(s, 'drop', (s - wasHeads) * .12)
        } else if (settled && across > 0) {
          // The house lands first; the ordinary staff leave, leadership stays.
          for (let s = inGarage; s < wasHeads; s++) start(s, 'lift', MOVE_AFTER + s * MOVE_STEP, LIFT_OUT)
        } else {
          for (let i = anims.length - 1; i >= 0; i--) if (anims[i].seat >= inGarage) anims.splice(i, 1)
          showGarageSeats(env, heads, wasHeads)
        }
        renderer.shadowMap.needsUpdate = true
        dirty = true
      }
      city.setStaff(across, settled)
      if (city.count !== hadHouses) {
        reframeLimits()
        if (settled && city.count > hadHouses) frameStudio()
        else if (!settled && city.count > 0) {
          // Opened in the city: the studio is the picture, not an empty garage in front of it.
          const fit = fitTo(studioBox())
          pan.copy(fit.pan)
          zoom = Math.max(zoomFloor, Math.min(ZOOM_MAX, fit.zoom))
        }
        dirty = true
      }
      if (visiting !== null) {
        const seat = visiting; visiting = null
        if (seat >= 0) {
          const at = city.headOf(seat)
          if (at) { pan.copy(at.sub(env.focus)); zoom = .95; focusOn = null }
        } else { pan.set(0, 0, 0); zoom = GARAGE_REST_ZOOM }
      }
    },
    setJames(here) {
      if (james === here) { settled = true; return }
      james = here
      const seat = leaderSeat('james')
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].seat === seat) anims.splice(i, 1)
      showGarageStations(env, staging(), withJames())
      if (settled && here) start(seat, 'drop', 0, JAMES_DROP)
      settled = true
      renderer.shadowMap.needsUpdate = true
      dirty = true
    },
    setIdentity(founder, studio) {
      const next = { ...cast, founder, studio: studio ?? undefined }
      if (JSON.stringify(next.founder) === JSON.stringify(cast.founder) && next.studio === cast.studio) return
      cast = next
      build()
    },
    resize(width, height) {
      w = Math.max(1, width); h = Math.max(1, height)
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
      ao?.setSize(w * grainRatio(), h * grainRatio())
      bloom.setSize(w * grainRatio(), h * grainRatio())
      // The frame's shape decides how far out the whole studio needs.
      if (env) reframeLimits()
      dirty = true
    },
    setLens(z) {
      zoom = Math.max(zoomFloor, Math.min(ZOOM_MAX, z))
      dirty = true
    },
    get zoom() { return zoom },
    focus(seat, screenY = 0.5) {
      if (seat === null) {
        if (saved) focusOn = saved
        saved = null
        return
      }
      const t = env.targets.find((target) => target.index === seat)
      const cityAt = seat >= 0 && heads === 0 ? city.headOf(seat) : null
      if (!t && !cityAt) return
      if (!saved) saved = { pan: pan.clone(), zoom }
      // Look straight at their head; an orthographic view has no distance to fix.
      const at = cityAt ?? t!.mesh.getWorldPosition(new T.Vector3())
      if (!cityAt) at.y += t!.mesh.scale.y * 0.3
      const targetZoom = Math.max(zoom, 1.9)
      // The opening leaves the lower part of the frame for instructions.
      // Offset in camera-up space so the founder stays horizontally centred
      // at every landscape aspect ratio, without changing dialogue framing.
      const viewHeight = span() * zoom / targetZoom * h / w
      const targetPan = at.sub(env.focus)
      if (screenY !== 0.5) targetPan.addScaledVector(axes().up, (screenY - 0.5) * viewHeight)
      focusOn = { pan: targetPan, zoom: targetZoom }
      dirty = true
    },
    setSpeaker(seat) {
      const group = seat === null ? null : body(seat)[0]?.group ?? null
      if (group === speaking) return
      speaking = group
      if (group && !turned.has(group)) turned.set(group, group.rotation.y)
      dirty = true
    },
    animating(seat) {
      return anims.some((a) => a.seat === seat)
    },
    get easing() {
      return focusOn !== null && (pan.distanceTo(focusOn.pan) >= .01 || Math.abs(zoom - focusOn.zoom) >= .005)
    },
    zoomTo(z, x, y) {
      focusOn = null; saved = null
      const next = Math.max(zoomFloor, Math.min(ZOOM_MAX, z))
      if (next === zoom) return
      const { right, up } = axes()
      const before = span() / w
      zoom = next
      const after = span() / w
      // Keep the point under the pointer where it is.
      pan.addScaledVector(right, (x - w / 2) * (before - after))
      pan.addScaledVector(up, -(y - h / 2) * (before - after))
      clampPan()
      dirty = true
    },
    zoomAt(factor, x, y) {
      view.zoomTo(zoom * factor, x, y)
    },
    panBy(dx, dy) {
      focusOn = null; saved = null
      const { right, up } = axes()
      const u = span() / w
      pan.addScaledVector(right, -dx * u)
      pan.addScaledVector(up, dy * u)
      clampPan()
      dirty = true
    },
    codingSeats() {
      if(w/span()<10)return []
      const seats=env.targets.filter(t=>{for(let o:T.Object3D|null=t.mesh;o;o=o.parent)if(!o.visible)return false;return true}).map(t=>t.index)
      return [...seats,...city.codingSeats()]
    },
    setProject(spec, title, progress) {
      env.projectPlate?.update(spec, title, progress)
    },
    hop(seat, mild = false) {
      if (seat === -1 && mild) return
      // Past twenty an ordinary seat is in the city.
      if (seat >= 0 && heads === 0 && city.count > 0) city.hop(seat, mild)
      else start(seat, 'hop', 0, undefined, mild)
      dirty = true
    },
    render(seconds) {
      clock += lastSeconds === null ? 0 : Math.min(1 / 30, Math.max(0, seconds - lastSeconds))
      lastSeconds = seconds
      for (const l of lights) {
        let on = true
        for (let o: T.Object3D | null = l.owner; o; o = o.parent) if (!o.visible) { on = false; break }
        const intensity = on ? l.intensity : 0
        if (l.light.intensity !== intensity) { l.light.intensity = intensity; dirty = true }
      }
      animate()
      // Houses and their jets move on the same clock as garage arrivals.
      if (city.update(clock)) {
        dirty = true
        renderer.shadowMap.needsUpdate = true
      }
      if (focusOn) {
        // A quick ease rather than a cut: the move and the name plate are one event.
        const k = 1 - Math.exp(-6 * (1 / 60))
        pan.lerp(focusOn.pan, k)
        zoom += (focusOn.zoom - zoom) * k
        // Arrived: snap the last hair, and stop asking for frames — a camera held
        // on a speaker is a still picture, however long they talk.
        if (pan.distanceTo(focusOn.pan) < .01 && Math.abs(zoom - focusOn.zoom) < .005) {
          pan.copy(focusOn.pan); zoom = focusOn.zoom
          if (!saved) focusOn = null
        } else dirty = true
      }
      if (turned.size > 0) turnPeople(1 / 60)
      frame()
      if (city.setView(camera, w / span())) { dirty = true; renderer.shadowMap.needsUpdate = true }
      // Nothing moved but the typing: draw at the ambient rate, and leave the
      // canvas (and the texture the stage made of it) as it is in between.
      if (!dirty && seconds - drawnAt < 1 / AMBIENT_HZ) return false
      dirty = false
      drawnAt = seconds
      frame()
      for (const { arm, offset, side } of arms) {
        if (!arm.visible || !arm.parent?.visible) continue
        arm.rotation.x = Math.sin(seconds * 9 + offset + (side > 0 ? Math.PI : 0)) * 0.08
      }
      if (ao) {
        const range = camera.far - camera.near
        ao.minDistance = 0.00012 * 300 / range
        ao.maxDistance = 0.009 * 300 / range
        ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix)
        ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse)
      }
      const wanted = pixelFor(zoom)
      if (wanted !== pixel) setGrain(wanted)
      const hidden = env.targets.map((t) => t.mesh.visible)
      env.targets.forEach((t) => { t.mesh.visible = false })
      composer.render()
      env.targets.forEach((t, i) => { t.mesh.visible = hidden[i] })
      return true
    },
    pick(x, y) {
      frame()
      const ray = new T.Raycaster()
      ray.setFromCamera(new T.Vector2((x / w) * 2 - 1, 1 - (y / h) * 2), camera)
      const live = env.targets.filter((t) => {
        for (let o: T.Object3D | null = t.mesh; o; o = o.parent) if (!o.visible) return false
        return true
      })
      const hit = ray.intersectObjects(live.map((t) => t.mesh), false)[0]
      if (hit) return live.find((t) => t.mesh === hit.object)?.index ?? null
      // Nobody in the garage under the finger: perhaps somebody in the city.
      return city.pick(ray)
    },
    nameTags() {
      const tags: HeroTag[] = []
      const project = (p: T.Vector3) => {
        p.project(camera)
        return { x: (p.x + 1) * w / 2, y: (1 - p.y) * h / 2 }
      }
      for (const [key, prop] of env.props ?? []) {
        if (!key.startsWith('name:')) continue
        const anchor = prop.group
        let visible = true
        for (let o: T.Object3D | null = anchor; o; o = o.parent) if (!o.visible) visible = false
        const scale = anchor.getWorldScale(new T.Vector3()).y
        const ppm = w / span() * scale
        if (!visible || ppm < 14) continue
        // The bottom of the HUD label stays above the maximum click hop.
        // Its anchor belongs to the station, never to the animated body.
        const world = anchor.localToWorld(new T.Vector3(0, 2.3, 0))
        const at = project(world.clone())
        if (at.x < 0 || at.x > w || at.y < -40 || at.y > h) continue
        const right = project(world.clone().add(new T.Vector3(1, 0, 0)))
        tags.push({ ...at, label: anchor.userData.label, colour: anchor.userData.colour,
          slope: (right.y - at.y) / (right.x - at.x), size: Math.max(10, Math.min(16, ppm * .26)) })
      }
      return tags
    },
    screenOf(seat) {
      frame()
      let p: T.Vector3 | null = null
      if (seat >= 0 && heads === 0 && city.count > 0) {
        p = city.headOf(seat)
      } else {
        const t = env.targets.find((target) => target.index === seat)
        if (!t) return null
        for (let o: T.Object3D | null = t.mesh; o; o = o.parent) if (!o.visible) return null
        // The hit box is centred on the body: aim a little under its top, which
        // is the head, and inside the box, so a tap at this point is a hit.
        p = t.mesh.getWorldPosition(new T.Vector3())
        p.y += t.mesh.scale.y * 0.3
      }
      if (!p) return null
      p.project(camera)
      if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) return null
      return { x: (p.x + 1) * w / 2, y: (1 - p.y) * h / 2 }
    },
    dispose() {
      city.dispose()
      puffGeometry.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
  build()
  view.resize(width, height)
  return view
}
