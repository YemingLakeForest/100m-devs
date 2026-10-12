import * as T from 'three'
import { RAMPS } from '../art/palette.ts'
import { OS } from '../art/skin.ts'
import { unitFlash } from '../../sim/juice.ts'
import { sharedMaterial } from './worldArt.ts'

/**
 * Flash the unit, not the person — move 3 of the juice layer (docs/PLAN-2026-10-11-juice-layer.md).
 * When a build finishes the whole lot it was built in steps through the three flat colours the
 * HUD's queue slots take — white, light amber, amber — for 270 ms and stops. The reference game
 * flashes the finished column; this is that, at the scale the lens is showing (a lot, in a world
 * of lots).
 *
 * It is a slab on the ground under the unit, not a light: opaque, hard-edged, one colour at a
 * time, thinner than the paving it lies on. No glow and no fade, because ART_DIRECTION §3 has none.
 */

/** A lot's footprint: where it is, and how far its slab reaches each way from the centre. */
export interface FlashPad { x: number; z: number; y: number; half: number }

/** One slab per lot, nearest first; a city has more lots than the screen can tell apart. */
export const MAX_FLASH_PADS = 17

const SLAB = 0.03
/** The sim's three steps, as colours: white, light amber, amber (`gl-hot-slot` in graph.css). */
const STEPS = [new T.Color(RAMPS.NEUTRAL[8]), new T.Color(RAMPS.WARN[3]), new T.Color(OS.warm)]

export function createUnitFlash(parent: T.Object3D) {
  const geometry = new T.BoxGeometry(1, 1, 1)
  const material = sharedMaterial('flash:slab', () => new T.MeshBasicMaterial({ color: '#ffffff' }))
  const mesh = new T.InstancedMesh(geometry, material, MAX_FLASH_PADS)
  mesh.count = 0
  mesh.frustumCulled = false
  parent.add(mesh)

  let pads: FlashPad[] = []
  let since = -Infinity
  const matrix = new T.Matrix4()
  const at = new T.Vector3()
  const scale = new T.Vector3()
  const identity = new T.Quaternion()

  return {
    mesh,
    /** Begin flashing these units at `clock` (seconds). A flash in progress is replaced, not stacked. */
    start(next: readonly FlashPad[], clock: number) {
      pads = next.slice(0, MAX_FLASH_PADS)
      since = clock
    },
    /** Returns whether anything is still lit, so the view knows to keep drawing. */
    update(clock: number, reduced: boolean): boolean {
      const step = unitFlash((clock - since) * 1000, reduced)
      if (step === null || pads.length === 0) {
        if (mesh.count !== 0) { mesh.count = 0; mesh.instanceMatrix.needsUpdate = true }
        return false
      }
      pads.forEach((p, i) => {
        at.set(p.x, p.y + SLAB / 2, p.z)
        scale.set(p.half * 2, SLAB, p.half * 2)
        mesh.setMatrixAt(i, matrix.compose(at, identity, scale))
        mesh.setColorAt(i, STEPS[step])
      })
      mesh.count = pads.length
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      return true
    },
    dispose() {
      parent.remove(mesh)
      mesh.dispose()
      geometry.dispose()
    },
  }
}
