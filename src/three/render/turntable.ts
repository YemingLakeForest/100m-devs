/**
 * **The founder you are making, on a turntable** — 2026-09-26.
 *
 * *"character screen, the person too big, also make it we can rotate him."* The
 * character screen showed one still image (`portrait.ts`), rendered from the
 * front and framed to fill its box. This draws the same person, under the same
 * light, into a canvas of its own, and turns them when the player drags.
 *
 * A live renderer rather than a still per angle: a drag wants a new picture
 * every frame, and encoding a PNG per frame is the slow way to get one. It is
 * one WebGL context, for as long as the character screen is open, and it draws
 * only when something changes (the look, a turn, the box's size), so a screen
 * nobody is touching costs nothing.
 *
 * **Framed for any angle, with air round it.** The frame is fitted to the
 * cylinder the figure sweeps as it turns, so turning never changes the size or
 * crops a shoulder, and the figure takes about two thirds of the box's height:
 * the old frame, fitted tight to the front view, was the "too big".
 */
import * as T from 'three'

import { EYE, nightRig, portraitPerson } from './portrait.ts'
import type { Look } from '../sim/identity.ts'
import type { LeaderId } from '../sim/floorPlan.ts'

export interface Turntable {
  setLook(look: Look, id?: LeaderId): void
  /** Turn the figure by `radians` about its own upright. */
  turn(radians: number): void
  /** The canvas's size in CSS pixels. */
  resize(width: number, height: number): void
  dispose(): void
}

/** How much of the box's height the figure takes. */
const FILL = 0.66

/** A turntable drawing into `canvas`, or `null` where WebGL is unavailable. */
export function createTurntable(canvas: HTMLCanvasElement): Turntable | null {
  let renderer: T.WebGLRenderer
  try {
    renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true })
  } catch {
    return null
  }
  renderer.setClearColor(0, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  const scene = new T.Scene()
  nightRig(scene)
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 40)

  let model: T.Object3D | null = null
  /** The swept cylinder: its axis is the model's upright through the origin. */
  let bounds = { radius: 1, bottom: 0, top: 2 }
  let yaw = 0
  let w = 1, h = 1

  function draw() {
    if (!model) return
    model.rotation.y = yaw
    // The eye's pitch decides how much of the cylinder's depth shows above and
    // below it; the width is the cylinder's diameter at any angle.
    const pitch = Math.asin(EYE.y)
    const midY = (bounds.bottom + bounds.top) / 2
    const halfH = ((bounds.top - bounds.bottom) / 2) * Math.cos(pitch) + bounds.radius * Math.sin(pitch)
    const half = Math.max(halfH, bounds.radius * (h / w)) / FILL
    camera.top = half; camera.bottom = -half
    camera.right = half * (w / h); camera.left = -half * (w / h)
    const mid = new T.Vector3(0, midY, 0)
    camera.position.copy(EYE).multiplyScalar(12).add(mid)
    camera.lookAt(mid)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }

  return {
    setLook(look, id) {
      if (model) scene.remove(model)
      model = portraitPerson(scene, look, id)
      model.rotation.y = 0
      model.updateMatrixWorld(true)
      const box = new T.Box3().setFromObject(model)
      const radius = Math.max(
        Math.hypot(box.min.x, box.min.z), Math.hypot(box.max.x, box.max.z),
        Math.hypot(box.min.x, box.max.z), Math.hypot(box.max.x, box.min.z),
      )
      bounds = { radius, bottom: box.min.y, top: box.max.y }
      draw()
    },
    turn(radians) {
      yaw += radians
      draw()
    },
    resize(width, height) {
      w = Math.max(1, width); h = Math.max(1, height)
      renderer.setSize(w, h, false)
      draw()
    },
    dispose() {
      if (model) scene.remove(model)
      renderer.dispose()
    },
  }
}
