/**
 * **Every face is the rebuild's person** — 2026-09-26.
 *
 * *"any scenes with arvatar should be the 3d model not the old 2d"*, then, on
 * a head-and-body preview that read as a bear: *"Why can't you port the exact
 * same character creation models?"* So this is the rebuild's
 * `render/founderPortrait.ts`, ported as it is — the same `studioPerson()`
 * figure with arms and legs (`full`), the same camera, the same light, one
 * still image per look — and grown only to head-and-shoulders for hero faces.
 *
 * The rebuild's argument carries over whole: the preview used to be a second
 * construction of a person (`div`s and an SVG face), which drifted from the
 * room's; now it is the room's own model code, rendered to an image. One
 * offscreen renderer, kept, because a character screen fires on every chip the
 * player taps and a context per image would spend the browser's budget (about
 * sixteen) in seconds.
 */
import * as T from 'three'

import { studioPerson } from './studioPeople.ts'
import type { Look } from '../sim/identity.ts'
import type { LeaderId } from '../sim/floorPlan.ts'

export type PortraitFrame = 'figure' | 'head'

/** Portrait-shaped for a standing person; square for a face. */
const SIZE: Record<PortraitFrame, [number, number]> = { figure: [360, 480], head: [256, 256] }

/** The rebuild's eye: gently off the front, so both held-forward arms read as one pose. */
export const EYE = new T.Vector3(1.15, 1.55, -4).normalize()

let kit: { renderer: T.WebGLRenderer; scene: T.Scene; camera: T.OrthographicCamera } | null = null
const cache = new Map<string, string>()

/**
 * The character screen's light, shared by the still portraits and the
 * turntable (`turntable.ts`) so the card and the figure you turn are one person.
 */
export function nightRig(scene: T.Scene): void {
  /*
   * [2026-09-26] **The room's night, not a studio flash** — *"the white light
   * too stabbing"*. The rebuild's rig (a white sky at 2.6 and a white key at 3)
   * was lit for its daylight garage, and on this build's dark screens it came
   * out as a figure under a photographer's strobe. This is the garage at dusk:
   * a warm lamp key from the front, the cool of a monitor on the other cheek, a
   * dim violet sky, so the person on the card is the person at the desk.
   */
  scene.add(new T.HemisphereLight('#8f9ac8', '#241f2e', 1.1))
  const lamp = new T.DirectionalLight('#ffd68c', 1.7)
  lamp.position.set(-3, 4, -4)
  scene.add(lamp)
  const screen = new T.DirectionalLight('#7fd4e8', 0.9)
  screen.position.set(4, 2, -3)
  scene.add(screen)
}

/**
 * The person as the room draws them, head and body: the rebuild's figure less
 * the limbs this world does not have (*"legs not belong to this world"*, then
 * *"Hands don't belong in character creation neither, given they are not in
 * game."*). Added to `parent`; the caller removes it.
 */
export function portraitPerson(parent: T.Object3D, look: Look, id?: LeaderId): T.Object3D {
  // §7.4a [2026-10-07]: use the actual standing bean, including its new bulk.
  // Removing limbs from the full figure left a different torso/head construction.
  return studioPerson(parent, 0, 0, 0, look, id, true)
}

function ensureKit() {
  if (kit) return kit
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setClearColor(0, 0)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  const scene = new T.Scene()
  nightRig(scene)
  kit = { renderer, scene, camera: new T.OrthographicCamera(-1, 1, 1, -1, .1, 40) }
  return kit
}

/**
 * A transparent PNG of this look — standing (`figure`) or head and shoulders
 * (`head`) — or `null` where WebGL is unavailable (a unit environment, or a
 * browser out of contexts): the caller draws nothing rather than a stand-in
 * person on the screen where you choose your person.
 */
export function personPortrait(look: Look, id?: LeaderId, shot: PortraitFrame = 'figure'): string | null {
  const key = JSON.stringify([look, id ?? null, shot])
  const hit = cache.get(key)
  if (hit) return hit
  let built
  try {
    built = ensureKit()
  } catch {
    return null
  }
  const { renderer, scene, camera } = built
  const [W, H] = SIZE[shot]
  renderer.setSize(W, H)
  // Built as who they are — the founder's shirt ramp, a hero's own head — and
  // as the room draws them: head and body.
  const model = portraitPerson(scene, look, id)
  try {
    model.updateMatrixWorld(true)
    // Framed from the model's own bounds, so a collar added in `studioPeople`
    // cannot crop here without anyone noticing.
    const target = shot === 'head' ? model.getObjectByName('head') ?? model : model
    const box = new T.Box3().setFromObject(target)
    const size = new T.Vector3(), mid = new T.Vector3()
    box.getSize(size); box.getCenter(mid)
    if (shot === 'head') { mid.y -= size.y * 0.18; size.multiplyScalar(1.55) }
    const half = Math.max(size.y, size.x * (H / W)) * 0.5 * 1.12
    camera.top = half; camera.bottom = -half
    camera.right = half * (W / H); camera.left = -half * (W / H)
    camera.position.copy(EYE).multiplyScalar(12).add(mid)
    camera.lookAt(mid)
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL()
    cache.set(key, url)
    while (cache.size > 96) cache.delete(cache.keys().next().value!)
    return url
  } finally {
    scene.remove(model)
  }
}
