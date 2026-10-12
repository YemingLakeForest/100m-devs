import * as T from 'three'
import { OS } from '../art/skin.ts'
import { MAX_PACKETS, numeralTier, packetSpec } from '../../sim/juice.ts'
import { sharedMaterial } from './worldArt.ts'

/**
 * Work made visible as flow to a sink — move 1 of the juice layer
 * (docs/PLAN-2026-10-11-juice-layer.md, GDD §8.2a). The 1 Million Books study's answer to
 * automation is not a number over every worker but things leaving them and arriving somewhere:
 * you watch the work go.
 *
 * One lot is one place work ends up — the project board in the garage, the front door of an open
 * house — and the workers who send to it. The layer owns one instanced mesh of small flat boxes,
 * so a thousand developers cost the same single draw call as one.
 *
 * Everything the juice kit forbids is absent on purpose: no trail, no easing, no glow. A packet
 * is at one of {@link HOPS} places along its way and jumps between them, the same hard-stepped
 * grammar as the HUD's `steps(n, end)`; it is the palette's amber and nothing else (not the lamp colour, which is bright enough to bloom into a halo on the glass).
 */

/** How long a packet is in the air. Under F6's 400 ms only matters for a beat; this is a stream. */
const FLIGHT_S = 1.2
/** Places a packet stops at on its way. Six, so the jumps read as a conveyor, not as a glide. */
const HOPS = 6
/** Edge of a one-point packet, in metres, and what each decade of value adds (a hard size step). */
const SIZE = 0.3
const SIZE_STEP = 0.1
/** A frame that took longer than this (a throttled tab) launches no more than a short burst. */
const MAX_FRAME_S = 0.25

export interface FlowLot {
  /** Where the work lands, in world space. */
  sink: T.Vector3
  /** Where it leaves from — one per worker who sends to this sink, in world space. */
  sources: readonly T.Vector3[]
}

interface Packet { from: T.Vector3; to: T.Vector3; age: number; value: number }

/**
 * @param onArrive  Called once per packet at its sink with what it carried: the arrival tick
 *                  (slice B3). Under reduced motion it is the *only* thing that happens.
 * @param random    Injected so tests can visit every source deterministically.
 */
export function createFlow(
  parent: T.Object3D,
  onArrive?: (at: T.Vector3, value: number) => void,
  random: () => number = Math.random,
) {
  const geometry = new T.BoxGeometry(1, 1, 1)
  const material = sharedMaterial('flow:packet', () => new T.MeshBasicMaterial({ color: OS.warm }))
  const mesh = new T.InstancedMesh(geometry, material, MAX_PACKETS)
  mesh.count = 0
  // Instances span the whole studio; the mesh's own bounds are the origin's and would cull them.
  mesh.frustumCulled = false
  parent.add(mesh)

  const packets: Packet[] = []
  const matrix = new T.Matrix4()
  const at = new T.Vector3()
  const scale = new T.Vector3()
  const identity = new T.Quaternion()
  let owed = 0

  function launch(lots: readonly FlowLot[], total: number, value: number, reduced: boolean) {
    // Weighted by how many workers send to a lot, so a big house sends more than a small one.
    let pick = random() * total
    let lot = lots[0]
    for (const l of lots) { lot = l; if ((pick -= l.sources.length) < 0) break }
    if (lot.sources.length === 0) return
    if (reduced) { onArrive?.(lot.sink, value); return }
    const from = lot.sources[Math.min(lot.sources.length - 1, Math.floor(random() * lot.sources.length))]
    packets.push({ from: from.clone(), to: lot.sink.clone(), age: 0, value })
  }

  return {
    mesh,
    /** Packets in the air. */
    get live() { return packets.length },
    /**
     * @param rate  Story points per second the workers on screen are making. The layer delivers
     *              this and no more: {@link packetSpec} splits it into a countable number of
     *              packets, fatter as the rate grows.
     */
    update(dt: number, rate: number, lots: readonly FlowLot[], reduced: boolean) {
      dt = Math.min(MAX_FRAME_S, Math.max(0, dt))
      const total = lots.reduce((n, l) => n + l.sources.length, 0)
      // Reduced motion keeps the ticks and drops the movement, at a pace a tick can be read at.
      const spec = total > 0 ? packetSpec(rate, reduced ? 2 : undefined) : { perSecond: 0, value: 0 }
      owed = spec.perSecond > 0 ? Math.min(owed + spec.perSecond * dt, 4) : 0
      while (owed >= 1 && (reduced || packets.length < MAX_PACKETS)) { owed -= 1; launch(lots, total, spec.value, reduced) }

      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        p.age += dt
        if (p.age >= FLIGHT_S) {
          onArrive?.(p.to, p.value)
          packets[i] = packets[packets.length - 1]
          packets.pop()
        }
      }
      packets.forEach((p, i) => {
        const step = Math.floor(Math.min(1, p.age / FLIGHT_S) * HOPS) / HOPS
        at.lerpVectors(p.from, p.to, step)
        scale.setScalar(SIZE + SIZE_STEP * numeralTier(p.value))
        mesh.setMatrixAt(i, matrix.compose(at, identity, scale))
      })
      mesh.count = packets.length
      mesh.instanceMatrix.needsUpdate = true
    },
    dispose() {
      parent.remove(mesh)
      mesh.dispose()
      geometry.dispose()
    },
  }
}
