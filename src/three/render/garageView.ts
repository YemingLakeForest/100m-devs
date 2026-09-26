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
 * true-isometric camera. No store, no clock, no Pixi, no HUD. It draws into
 * its own canvas, which the stage takes as a texture under this build's glass.
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
import { buildGarageEnvironment, GARAGE_ASSEMBLED, showGarageSeats, showGarageStations, type GarageStaging } from './garageEnvironment.ts'
import { defaultCast, type StudioCast } from './studioPeople.ts'
import type { Environment, GarageProp } from './worldEnvironments.ts'
import { placeInstances, type SeatInstance } from './worldArt.ts'
import { LEADER_IDS, leaderSeat } from '../sim/floorPlan.ts'
import { OS, OS_SKIN } from '../art/skin.ts'
import type { Look } from '../sim/identity.ts'

export interface GarageView {
  /** What the host draws. Redrawn by `render`. */
  canvas: HTMLCanvasElement
  /** Developers in the room (the founder is not one of them). New ones drop in. */
  setHeadcount(n: number): void
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
  /** A seat (-1 the founder, -2 James) hops, as a poke answers. */
  hop(seat: number): void
  /**
   * Ease the camera to a person — a seat, or -1 the founder, -2 James — for a
   * line of dialogue, and back to where the player had it on `null`. The
   * player's own zoom or pan ends it.
   */
  focus(seat: number | null): void
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

/** How far the player may zoom: well out past the room, and in to a face. */
const ZOOM_MIN = 0.45
const ZOOM_MAX = 7
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
}

type Piece = 'desk' | 'chair' | 'body'
interface Anim {
  seat: number
  kind: 'hop' | 'drop'
  start: number
  delay: number
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
interface Rest { position: T.Vector3; scale: T.Vector3 }
interface Part { key: string; instances: SeatInstance[]; group: T.Object3D | null }

export function createGarageView(width: number, height: number, cast: StudioCast = defaultCast(), options: GarageViewOptions = {}): GarageView {
  const lite = options.lite ?? false
  // No antialias on the canvas itself: the composer draws into its own
  // multisampled targets, and the canvas only ever receives the output quad.
  const renderer = new T.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true })
  renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.5))
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
  const fill = new T.DirectionalLight('#e6effa', 0.55)
  fill.position.set(-32, 15, -10)
  scene.add(fill)
  if (OS_SKIN) {
    sun.color.set('#8a93c8'); sun.intensity = .7
    sky.color.set(OS.n3); sky.groundColor.set(OS.n0); sky.intensity = .55
    fill.color.set(OS.calm2); fill.intensity = .12
    renderer.toneMappingExposure = 1.1
  }

  const composer = new EffectComposer(renderer)
  composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4
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

  let env: Environment
  let heads = 0
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
  const puffs: { mesh: T.Mesh; start: number; dir: T.Vector3 }[] = []
  const puffGeometry = new T.IcosahedronGeometry(0.28, 0)
  // One puff, never seen, so the material is compiled with the room and not on
  // the first landing (it was the rest of that frame's stall).
  const puffWarm = new T.Mesh(puffGeometry, new T.MeshStandardMaterial({ color: '#d8d2cf', roughness: 1, flatShading: true, transparent: true, opacity: 0 }))
  // In the frame, or the frustum culls it and it is never compiled after all.
  puffWarm.position.set(0, 1, 1.3)
  puffWarm.scale.setScalar(0.001)
  puffWarm.frustumCulled = false
  scene.add(puffWarm)

  function build() {
    if (env) {
      scene.remove(env.root)
      env.root.traverse((o) => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose() })
    }
    for (const l of lights) l.light.removeFromParent()
    // James's station is built whether or not he has arrived, and `showGarageStations`
    // decides whether it is drawn: a room whose light count changes when he
    // lands recompiles every material in it.
    env = buildGarageEnvironment(heads, withJames(), 'on', false, staging())
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
    camera.position.copy(focus).addScaledVector(direction, 80)
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
  function axes() {
    frame()
    return {
      right: new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
      up: new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
    }
  }

  /** The pan may reach the room's edge and a little beyond, never off into the dark. */
  function clampPan() {
    const reach = env.extent * 0.7
    if (pan.length() > reach) pan.setLength(reach)
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
    const id = leaderId(seat)
    const handle = id ? env.props?.get(`chair:${id}`) : undefined
    return handle ? { key: `chair:${id}`, instances: handle.instances, group: handle.group } : null
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

  function start(seat: number, kind: 'hop' | 'drop', delay = 0, pieces?: Anim['pieces']) {
    // A hop does not interrupt a landing, and a second hop restarts the first.
    const running = anims.findIndex((a) => a.seat === seat)
    if (running >= 0) {
      if (anims[running].kind === 'drop' && kind === 'hop') return
      anims.splice(running, 1)
    }
    anims.push({ seat, kind, start: clock, delay, pieces: pieces?.map((p) => ({ ...p })) })
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
        parts.forEach((p) => place(p, base, y, s))
        if (t >= .47) { parts.forEach((p) => place(p, base, 0, 1)); anims.splice(i, 1) }
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
        if (u >= 1 && !piece.puffed) { piece.puffed = true; puff(base) }
      }
      if (done) anims.splice(i, 1)
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]
      const u = (clock - p.start) / .55
      p.mesh.position.addScaledVector(p.dir, .02)
      p.mesh.scale.setScalar(.6 + u * 1.2)
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
    setHeadcount(n) {
      const next = Math.max(0, Math.min(20, Math.floor(n)))
      if (next === heads) return
      const was = heads
      heads = next
      showGarageSeats(env, heads, was)
      // A hire is an event: each new desk and developer falls in, a beat apart.
      if (settled && next > was) for (let s = was; s < next; s++) start(s, 'drop', (s - was) * .12)
      renderer.shadowMap.needsUpdate = true
      dirty = true
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
      ao?.setSize(w, h)
      dirty = true
    },
    setLens(z) {
      zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
      dirty = true
    },
    get zoom() { return zoom },
    focus(seat) {
      if (seat === null) {
        if (saved) focusOn = saved
        saved = null
        return
      }
      const t = env.targets.find((target) => target.index === seat)
      if (!t) return
      if (!saved) saved = { pan: pan.clone(), zoom }
      // Look straight at their head; an orthographic view has no distance to fix.
      const at = t.mesh.getWorldPosition(new T.Vector3())
      at.y += t.mesh.scale.y * 0.3
      focusOn = { pan: at.sub(env.focus), zoom: Math.max(zoom, 1.9) }
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
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
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
    hop(seat) {
      start(seat, 'hop')
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
      return hit ? live.find((t) => t.mesh === hit.object)?.index ?? null : null
    },
    screenOf(seat) {
      frame()
      const t = env.targets.find((target) => target.index === seat)
      if (!t) return null
      for (let o: T.Object3D | null = t.mesh; o; o = o.parent) if (!o.visible) return null
      // The hit box is centred on the body: aim a little under its top, which is
      // the head, and inside the box, so a tap at this point is a hit.
      const p = t.mesh.getWorldPosition(new T.Vector3())
      p.y += t.mesh.scale.y * 0.3
      p.project(camera)
      if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1) return null
      return { x: (p.x + 1) * w / 2, y: (1 - p.y) * h / 2 }
    },
    dispose() {
      puffGeometry.dispose()
      composer.dispose()
      renderer.dispose()
    },
  }
  build()
  view.resize(width, height)
  return view
}
