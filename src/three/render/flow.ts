import * as T from 'three'
import { OS } from '../art/skin.ts'
import { MAX_PACKETS, backlogLevel, numeralTier, packetSpec } from '../../sim/juice.ts'
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
  /** The floor the lot's heap stands on, in world y. Defaults to a metre under the sink. */
  floor?: number
  /** Where the heap stands, when beside the sink toward the workers would be out of sight (a house's wall). */
  heapAt?: T.Vector3
  /** Where it leaves from — one per worker who sends to this sink, in world space. */
  sources: readonly T.Vector3[]
}

/** Crates in the heap: four levels above empty, two columns wide, a lot's worth for sixteen lots. */
const CRATE = 0.42
const HEAP_LEVELS = 5
const MAX_HEAP_LOTS = 16
const MAX_CRATES = MAX_HEAP_LOTS * (HEAP_LEVELS - 1)
/** How far from the sink, toward its workers, the heap stands. */
const HEAP_OFFSET = 1.9

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
  const heap = new T.InstancedMesh(geometry, sharedMaterial('flow:heap', () => new T.MeshBasicMaterial({ color: OS.glow1 })), MAX_CRATES)
  heap.count = 0
  heap.frustumCulled = false
  parent.add(heap)

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

  const toward = new T.Vector3()
  const crate = new T.Vector3(CRATE, CRATE, CRATE)

  /**
   * The heap beside each sink: crates stacked two to a row, as many as {@link backlogLevel} says.
   * It stands between the sink and its workers, so it reads as the in-tray work comes out of and
   * drains as the queue does; a heap that vanished while work was waiting would say it was done.
   */
  function stand(lots: readonly FlowLot[], backlog: number) {
    const level = backlogLevel(backlog, HEAP_LEVELS)
    let n = 0
    if (level > 0) for (const lot of lots.slice(0, MAX_HEAP_LOTS)) {
      if (lot.sources.length === 0) continue
      toward.set(0, 0, 0)
      for (const src of lot.sources) toward.add(src)
      toward.divideScalar(lot.sources.length).sub(lot.sink)
      toward.y = 0
      if (toward.length() > 1e-6) toward.normalize()
      else toward.set(1, 0, 0)
      const floor = lot.floor ?? lot.sink.y - 1
      const hx = lot.heapAt?.x ?? lot.sink.x + toward.x * HEAP_OFFSET
      const hz = lot.heapAt?.z ?? lot.sink.z + toward.z * HEAP_OFFSET
      for (let i = 0; i < level; i++) {
        at.set(hx + (i % 2) * CRATE * 1.1, floor + CRATE / 2 + Math.floor(i / 2) * CRATE, hz)
        heap.setMatrixAt(n++, matrix.compose(at, identity, crate))
      }
    }
    heap.count = n
    heap.instanceMatrix.needsUpdate = true
  }

  return {
    mesh, heap,
    /** Packets in the air. */
    get live() { return packets.length },
    /**
     * @param rate  Story points per second the workers on screen are making. The layer delivers
     *              this and no more: {@link packetSpec} splits it into a countable number of
     *              packets, fatter as the rate grows.
     */
    update(dt: number, rate: number, lots: readonly FlowLot[], reduced: boolean, backlog = 0) {
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
      stand(lots, backlog)
    },
    dispose() {
      parent.remove(mesh)
      parent.remove(heap)
      heap.dispose()
      mesh.dispose()
      geometry.dispose()
    },
  }
}
