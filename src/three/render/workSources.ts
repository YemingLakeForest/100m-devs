import * as T from 'three'
import { leaderSeat } from '../sim/floorPlan.ts'

/**
 * Who the room's unprompted work stream leaves from — GDD §4.5d, *"the founder codes only on clicks"* [amended 2026-10-01].
 *
 * **The founder is never a source** [2026-10-16, at the user's instruction: *"we don't spontaneously code so should not have
 * blobs going out from us to the middle, I said this a few times but always got reverted, fix that properly"*]. The economy has
 * agreed since 2026-10-01 (`founderPassiveVelocity` is 0), and the founder's hop and numeral were gated then. The *picture* kept
 * coming back because the stream's sources were written as "every visible person in the room", once per rebuild of the stream
 * (the juice layer's first pass, its continuous rewrite, the statue): each rebuild re-derived the list from `env.targets` and the
 * founder is one of them. So the rule lives here, once, by name, and `workSources.test.ts` pins it. A click on your own desk still
 * throws its blobs (`pokeStream`), because that is the player coding.
 */
export const FOUNDER_SEAT = leaderSeat('founder')

interface Target { mesh: T.Object3D; index: number }

function shown(o: T.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false
  return true
}

/** The heads the stream leaves from: everyone visible who works without being asked, at a third of their height. */
export function workSources(targets: readonly Target[]): T.Vector3[] {
  return targets
    .filter((t) => t.index !== FOUNDER_SEAT && shown(t.mesh))
    .map((t) => {
      const p = t.mesh.getWorldPosition(new T.Vector3())
      p.y += t.mesh.scale.y * 0.3
      return p
    })
}
