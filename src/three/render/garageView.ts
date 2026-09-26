/*
 * Copied from the rebuild (100m-devs-three/src/render/garageView.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The garage, on its own** — a proof, 2026-09-26.
 *
 * *"The UI port did not land sadly. Can you do me a proof of old game in
 * threejs with the current game garage?"*
 *
 * Everything the garage is, with nothing of this build's shell around it: its
 * geometry and people (`garageEnvironment`), the warm daylight rig and SSAO
 * `worldScene` gives it, and §12.1's true-isometric camera. No store, no clock,
 * no Pixi, no HUD. It draws into its own canvas, which a host — the legacy
 * build's Pixi stage — takes as a texture, so the legacy glass (its bloom,
 * scanlines and curvature) and its whole interface go on over it untouched.
 *
 * Bundled for the legacy repo with `three` left external (see that repo's
 * `src/vendor/garageView.js`). The numbers below are copied from `worldScene`
 * rather than imported, because that module is the whole application; a real
 * port would give both one home.
 */
import * as T from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { buildGarageEnvironment, showGarageSeats } from './garageEnvironment.ts'
import { defaultCast, type StudioCast } from './studioPeople.ts'
import type { Environment } from './worldEnvironments.ts'
import { OS, OS_SKIN } from '../art/skin.ts'

export interface GarageView {
  /** What the host draws. Redrawn by `render`. */
  canvas: HTMLCanvasElement
  /** Developers in the room (the founder is not one of them). */
  setHeadcount(n: number): void
  /** Whether James has arrived; rebuilds the room, as it does in this build. */
  setJames(here: boolean): void
  resize(width: number, height: number): void
  /** Zoom about the room, 1 = framed; and a pan in world metres on the ground. */
  setLens(zoom: number, panX?: number, panZ?: number): void
  render(seconds: number): void
  /**
   * Who is under canvas point (x, y), in CSS pixels: a seat index, -1 for the
   * founder (`garage.FOUNDER_SEAT`), or null for floor, furniture and sky. The
   * garage's own invisible hit boxes answer it, so a tap means what it means in
   * this build.
   */
  pick(x: number, y: number): number | null
  /**
   * Where a person is on the canvas, in CSS pixels — a seat, or -1 for the
   * founder — at head height, or null if that seat is empty or off the frame.
   * The host anchors its interface here (a poke's numeral, a hero card's pin),
   * so it has to be the drawn person, not a position re-derived from a plan.
   */
  screenOf(seat: number): { x: number; y: number } | null
  dispose(): void
}

export function createGarageView(width: number, height: number, cast: StudioCast = defaultCast()): GarageView {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = T.SRGBColorSpace
  // The garage's own grade: ACES and a little over unity (`worldScene`, "warm").
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.03
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap

  const scene = new T.Scene()
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 300)

  // The rig `worldScene` gives rank 0: warm key placed by where its shadow lands
  // (up and to the left), a soft sky, and a cool fill across the room.
  const sky = new T.HemisphereLight('#fffdf8', '#a5a59a', 1.15)
  scene.add(sky)
  const sun = new T.DirectionalLight('#fff0d6', 2.7)
  sun.position.set(22, 28, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 120 })
  sun.shadow.normalBias = 0.025
  sun.shadow.bias = -0.0001
  scene.add(sun)
  const fill = new T.DirectionalLight('#e6effa', 0.55)
  fill.position.set(-32, 15, -10)
  scene.add(fill)
  if (OS_SKIN) {
    // Dusk, as `worldScene` gives the STUDIO_OS skin: a low violet key, the
    // legacy neutral sky, and the room's own screens and lamps doing the rest.
    sun.color.set('#8a93c8'); sun.intensity = .7
    sky.color.set(OS.n3); sky.groundColor.set(OS.n0); sky.intensity = .55
    fill.color.set(OS.calm2); fill.intensity = .12
    renderer.toneMappingExposure = 1.1
  }

  const composer = new EffectComposer(renderer)
  composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4
  composer.addPass(new RenderPass(scene, camera))
  const ao = new SSAOPass(scene, camera, width, height, 16)
  ao.kernelRadius = .65; ao.minDistance = .00012; ao.maxDistance = .009
  ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA = 0
  ao.ssaoMaterial.needsUpdate = true
  composer.addPass(ao)
  composer.addPass(new OutputPass())

  let env: Environment
  let heads = 0
  let w = width, h = height
  let zoom = 1
  const pan = new T.Vector3()
  /** Seated arms, for the typing: the room is not a photograph. */
  let arms: { arm: T.Object3D; offset: number; side: number }[] = []

  function build() {
    if (env) {
      scene.remove(env.root)
      env.root.traverse((o) => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose() })
    }
    env = buildGarageEnvironment(heads, cast)
    scene.add(env.root)
    scene.background = new T.Color(OS_SKIN ? OS.n0 : env.background)
    showGarageSeats(env, heads, 20)
    arms = []
    env.root.traverse((o) => {
      const side = o.name === 'arm-1' ? -1 : o.name === 'arm1' ? 1 : 0
      if (side && !o.parent?.userData.standing) arms.push({ arm: o, offset: arms.length * 1.7, side })
    })
    renderer.shadowMap.needsUpdate = true
  }

  function frame() {
    const focus = env.focus.clone().add(pan)
    const direction = new T.Vector3(1, 1, 1).normalize()
    camera.position.copy(focus).addScaledVector(direction, 80)
    camera.up.set(0, 1, 0)
    camera.lookAt(focus)
    const aspect = w / h
    // `worldScene`'s framing: fit the room's extent, wider screens see more ground.
    const span = env.extent / Math.min(1, aspect / 1.35) / zoom
    camera.left = -span / 2; camera.right = span / 2
    camera.top = span / 2 / aspect; camera.bottom = -span / 2 / aspect
    camera.updateProjectionMatrix()
  }

  const view: GarageView = {
    canvas: renderer.domElement,
    setHeadcount(n) {
      const next = Math.max(0, Math.floor(n))
      if (next === heads) return
      const was = heads
      heads = next
      showGarageSeats(env, heads, was)
      renderer.shadowMap.needsUpdate = true
    },
    setJames(here) {
      const has = cast.heroes.includes('james')
      if (has === here) return
      cast = { ...cast, heroes: here ? ['james'] : [] }
      build()
    },
    resize(width, height) {
      w = Math.max(1, width); h = Math.max(1, height)
      renderer.setSize(w, h, false)
      composer.setSize(w, h)
      ao.setSize(w, h)
    },
    setLens(z, panX = 0, panZ = 0) {
      zoom = Math.max(0.2, z)
      pan.set(panX, 0, panZ)
    },
    render(seconds) {
      frame()
      for (const { arm, offset, side } of arms) {
        if (!arm.visible || !arm.parent?.visible) continue
        arm.rotation.x = Math.sin(seconds * 9 + offset + (side > 0 ? Math.PI : 0)) * 0.08
      }
      const range = camera.far - camera.near
      ao.minDistance = 0.00012 * 300 / range
      ao.maxDistance = 0.009 * 300 / range
      ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix)
      ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse)
      const hidden = env.targets.map((t) => t.mesh.visible)
      env.targets.forEach((t) => { t.mesh.visible = false })
      composer.render()
      env.targets.forEach((t, i) => { t.mesh.visible = hidden[i] })
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
      composer.dispose()
      renderer.dispose()
    },
  }
  build()
  view.resize(width, height)
  return view
}
