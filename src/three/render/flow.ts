import * as T from 'three'
import { RAMPS } from '../art/palette.ts'
import { OS } from '../art/skin.ts'
import { MAX_PACKETS, packetSpec } from '../../sim/juice.ts'
import { sharedMaterial } from './worldArt.ts'

/**
 * Work made visible as a stream into the thing it builds — move 1 of the juice layer
 * (docs/PLAN-2026-10-11-juice-layer.md, GDD §8.2a), and the completion that ends it.
 *
 * **Rebuilt 2026-10-12, on the user's play of the first version:** *"just some random block flying
 * in the air, there's no any relation to coding"*, then *"I want continuous moving points not just
 * discrete blocks blinking"*. The first version launched a few amber boxes that hopped between six
 * places, which is the juice kit's hard-stepped grammar applied to the wrong thing: a stepped box
 * reads as an object appearing and disappearing, not as work going anywhere. So this is the other
 * thing — a stream. Many small points, moving every frame, leaving each worker's desk the colour
 * of the code on their screen (phosphor cyan) and arriving at the project the colour of the story
 * points it has become (amber), so the relation to coding is in the colour of the thing itself.
 * The motion is continuous; what stays hard-edged is the shape (flat cubes), the palette and the
 * absence of glow, as everywhere else.
 *
 * The sink is a thing that fills. The garage's project board (and the HQ's) stands a gauge beside
 * it whose level is how much of the game is built, and it is the same number the HUD's progress
 * reads, so a point arriving is a point of the bar. When the build completes the gauge flashes
 * full, the sink throws a fountain of points and a ring runs out across the lot; a release throws
 * a bigger one and rings at every open house. Nothing here is a decision the sim makes: it is all
 * picture, fed a rate, a progress and two events.
 *
 * One lot is one place work ends up — the project board, the front door of an open house — and
 * the workers who send to it. A thousand developers cost the same three draw calls as one.
 */

/** How long a point is in the air, and how much that varies so a stream is a river and not a march. */
const FLIGHT_S = 1.5
const FLIGHT_JITTER = 0.35
/** …and a click's, which is nearly none: see `stream`. */
const HAND_JITTER = 0.06
/**
 * Edge of a one-point blob, in metres, and how a blob grows with what it carries: *"I want the blob scaled
 * by story point, roughly 1 point per blob."* Under the stream's cap a blob IS one story point, so the
 * count on screen is the work being done; past it a blob carries a decade (10, 100, 1,000…) and is larger
 * by the same measure, so 1,000 points reads as bigger than 1 and never as the same dot a thousand times.
 */
const SIZE = 0.4
const GROWTH = 0.6
const MAX_SIZE = 1.8
function blobSize(value: number): number {
  return Math.min(MAX_SIZE, SIZE * (1 + GROWTH * Math.log10(Math.max(1, value))))
}
/** A stream's arc: its apex stands this fraction of the run above a straight line, and it bows this far to a side. */
const ARC = 0.16
const MIN_ARC = 0.8
const SWAY = 0.45
/** A frame that took longer than this (a throttled tab) launches no more than a short burst. */
const MAX_FRAME_S = 0.25
/** The colour the code leaves the desk in, the colour it arrives in, and where along the run it turns. */
const CODE = new T.Color(OS.glow2)
const POINTS = new T.Color(OS.warm)
const FLASH = new T.Color(RAMPS.NEUTRAL[8])
/**
 * The outline [2026-10-13, *"with the lighting changes the things are a lot less visible now, can you make the flowing blobs
 * more visible"*]. Lifting the room (`NIGHT` in skin.ts) put a cyan and an amber cube on pale teal walls and a wooden floor, where
 * they had been lit points on a dark one. A brighter blob would only meet the wall halfway, so each carries its own dark edge:
 * the same cube drawn again, bigger, back faces only, in the interface's black — the one-pixel rule the HUD draws round
 * everything, at a thickness that follows the blob.
 */
const OUTLINE = new T.Color(OS.n0)
const OUTLINE_GROW = 1.28
const OUTLINE_PAD = 0.045
const TURN_FROM = 0.3
const TURN_TO = 0.8

/** A completion's fountain: how many points, how fast they leave, and how hard gravity takes them back. */
const SPARKS = { build: 70, release: 160, house: 36 }
const SPARK_SPEED = { build: [4, 8], release: [6, 13] } as const
const GRAVITY = 15
const SPARK_LIFE = 1.15
const SPARK_SIZE = 0.15
/** The ring that runs out across a lot: how far, how long, and how many may be alive. */
const RING_LIFE = 0.75
const RING_REACH = { build: 7, release: 12 }
const MAX_RINGS = 24

export interface FlowLot {
  /** Where the work lands, in world space. */
  sink: T.Vector3
  /**
   * A name for this sink that does not change while `sink` moves. The arrival numerals sum per sink and are keyed by where they
   * landed; a statue's sink is the voxel being built, which moves up the sprite a cell at a time, and would split one beat's
   * numeral between two keys. A lot that stands still leaves it out and is keyed by its place, as before.
   */
  key?: string
  /** The floor the lot stands on, in world y. Defaults to a metre under the sink. */
  floor?: number
  /** Where the lot's gauge and rings stand, when beside the sink toward the workers would be out of sight (a house's wall). */
  standAt?: T.Vector3
  /** How high the sink stands above its floor, where its fountain leaves from. Defaults to the flow's own gauge. */
  top?: number
  /** Whether this is the studio's own project sink (a completion throws its big fountain here), as against a house's door. Defaults to whether the flow draws a gauge at it. */
  main?: boolean
  /** Whether the sink has a gauge: the studio's project board does, a house's door does not (a project is studio-wide). */
  gauge?: boolean
  /** Where it leaves from — one per worker who sends to this sink, in world space. */
  sources: readonly T.Vector3[]
}

/** The gauge: a dark slab the height of the whole game, and the fill that rises in it. */
const GAUGE_H = 2.6
const GAUGE_W = 0.46
const FILL_W = 0.6
const MAX_GAUGE_LOTS = 16
/** How hard the shown level chases the true one, per second. Continuous, and quick enough that a drain after completion is seen. */
const GAUGE_FOLLOW = 7
/** How long the gauge holds white at full after a completion before it drains. */
const GAUGE_FLASH_S = 0.3
/** How far from the sink, toward its workers, the gauge stands. */
const STAND_OFFSET = 1.9

interface Point {
  /** 0 a stream, 1 a spark thrown from a completion. */
  kind: 0 | 1
  fx: number; fy: number; fz: number
  tx: number; ty: number; tz: number
  vx: number; vy: number; vz: number
  age: number; life: number
  value: number
  /** The lot's own key, when it has one, handed back with the arrival. */
  key?: string
  /** A point a click made: announced to `onHand` where it lands, and never to `onArrive`. */
  hand?: boolean
  /** A stream's sideways bow, signed, in metres. */
  sway: number
  size: number
  /** A spark's floor: it is gone when it reaches it. */
  floor: number
}
interface Ring { x: number; y: number; z: number; age: number; reach: number }

/**
 * @param onArrive  Called once per point at its sink with what it carried (and the lot's `key`, if it has one): the
 *                  arrival tick (slice B3). A point that carries nothing (a click's) is not announced here.
 * @param random    Injected so tests can visit every source deterministically.
 * @param onHand    Called once per point a click made, **as it lands at the sink** [2026-10-15, *"currently when I spam clicks the
 *                  notes are played when I click, not when received, should be received"*]. The note a click sings is sung
 *                  where its points arrive, so the sound is the thing the eye is following and not a second event at the
 *                  fingertip. Under reduced motion there is no flight and the points land at once.
 */
export function createFlow(
  parent: T.Object3D,
  onArrive?: (at: T.Vector3, value: number, key?: string) => void,
  random: () => number = Math.random,
  onHand?: (at: T.Vector3) => void,
) {
  const geometry = new T.BoxGeometry(1, 1, 1)
  const material = sharedMaterial('flow:point', () => new T.MeshBasicMaterial({ color: 0xffffff }))
  const mesh = new T.InstancedMesh(geometry, material, MAX_PACKETS)
  mesh.count = 0
  mesh.setColorAt(0, CODE)
  const outline = new T.InstancedMesh(geometry, sharedMaterial('flow:outline', () => new T.MeshBasicMaterial({ color: OUTLINE, side: T.BackSide })), MAX_PACKETS)
  outline.count = 0
  outline.frustumCulled = false
  parent.add(outline)
  const halo = new T.Vector3()
  // Instances span the whole studio; the mesh's own bounds are the origin's and would cull them.
  mesh.frustumCulled = false
  parent.add(mesh)

  const ringGeometry = new T.RingGeometry(0.975, 1, 64)
  ringGeometry.rotateX(-Math.PI / 2)
  const rings = new T.InstancedMesh(ringGeometry, sharedMaterial('flow:ring', () => new T.MeshBasicMaterial({ color: 0xffffff })), MAX_RINGS)
  rings.count = 0
  rings.setColorAt(0, POINTS)
  rings.frustumCulled = false
  parent.add(rings)

  // Two instances a lot: the slab and the fill. Both are a unit box scaled, like everything here.
  const gauge = new T.InstancedMesh(geometry, sharedMaterial('flow:gauge', () => new T.MeshBasicMaterial({ color: 0xffffff })), MAX_GAUGE_LOTS * 2)
  gauge.count = 0
  gauge.setColorAt(0, POINTS)
  gauge.frustumCulled = false
  parent.add(gauge)

  const points: Point[] = []
  const ringList: Ring[] = []
  const matrix = new T.Matrix4()
  const at = new T.Vector3()
  const scale = new T.Vector3()
  const identity = new T.Quaternion()
  const colour = new T.Color()
  let owed = 0
  let shown = 0
  let flash = 0

  function spawn(p: Point) { if (points.length < MAX_PACKETS) points.push(p) }

  function stream(from: T.Vector3, to: T.Vector3, value: number, size: number, age = 0, life = FLIGHT_S, key?: string, hand = false) {
    // A river's points vary in flight so it is not a march; a click's hardly do, because their landings are the notes and the notes
    // are the player's own rhythm, which a quarter-second of scatter in the flight would turn into somebody else's.
    const jitter = hand ? HAND_JITTER : FLIGHT_JITTER
    spawn({
      kind: 0, fx: from.x, fy: from.y, fz: from.z, tx: to.x, ty: to.y, tz: to.z, vx: 0, vy: 0, vz: 0,
      age, life: life * (1 - jitter / 2 + random() * jitter), value, sway: (random() * 2 - 1) * SWAY,
      size: size * (0.85 + random() * 0.3), floor: 0, key, hand,
    })
  }

  function launch(lots: readonly FlowLot[], total: number, value: number, reduced: boolean, age: number) {
    // Weighted by how many workers send to a lot, so a big house sends more than a small one.
    let pick = random() * total
    let lot = lots[0]
    for (const l of lots) { lot = l; if ((pick -= l.sources.length) < 0) break }
    if (lot.sources.length === 0) return
    if (reduced) { onArrive?.(lot.sink, value, lot.key); return }
    const from = lot.sources[Math.min(lot.sources.length - 1, Math.floor(random() * lot.sources.length))]
    stream(from, lot.sink, value, blobSize(value), age, FLIGHT_S, lot.key)
  }

  /** Where a lot's gauge stands, on its floor: toward its workers from the sink, or where the lot says. */
  const stand = new T.Vector3()
  const toward = new T.Vector3()
  function standOf(lot: FlowLot): T.Vector3 {
    const floor = lot.floor ?? lot.sink.y - 1
    if (lot.standAt) return stand.set(lot.standAt.x, floor, lot.standAt.z)
    toward.set(0, 0, 0)
    for (const src of lot.sources) toward.add(src)
    if (lot.sources.length > 0) toward.divideScalar(lot.sources.length).sub(lot.sink)
    toward.y = 0
    if (toward.length() > 1e-6) toward.normalize()
    else toward.set(1, 0, 0)
    return stand.set(lot.sink.x + toward.x * STAND_OFFSET, floor, lot.sink.z + toward.z * STAND_OFFSET)
  }

  function standGauges(lots: readonly FlowLot[], level: number, white: boolean) {
    let n = 0
    for (const lot of lots.slice(0, MAX_GAUGE_LOTS)) {
      if (!lot.gauge || lot.sources.length === 0) continue
      const s = standOf(lot)
      scale.set(GAUGE_W, GAUGE_H, GAUGE_W)
      at.set(s.x, s.y + GAUGE_H / 2, s.z)
      gauge.setMatrixAt(n, matrix.compose(at, identity, scale))
      gauge.setColorAt(n++, colour.set(OS.n2))
      const h = Math.max(0.001, (GAUGE_H - 0.12) * level)
      scale.set(FILL_W, h, FILL_W)
      at.set(s.x, s.y + 0.06 + h / 2, s.z)
      gauge.setMatrixAt(n, matrix.compose(at, identity, scale))
      gauge.setColorAt(n++, white ? FLASH : POINTS)
    }
    gauge.count = n
    gauge.instanceMatrix.needsUpdate = true
    if (gauge.instanceColor) gauge.instanceColor.needsUpdate = true
  }

  function fountain(from: T.Vector3, floor: number, n: number, [lo, hi]: readonly [number, number]) {
    for (let i = 0; i < n; i++) {
      // A cone about the vertical, wide enough to read as a burst and narrow enough to read as a fountain.
      const tilt = random() * 0.95
      const turn = random() * Math.PI * 2
      const speed = lo + random() * (hi - lo)
      spawn({
        kind: 1, fx: from.x, fy: from.y, fz: from.z, tx: 0, ty: 0, tz: 0,
        vx: Math.sin(tilt) * Math.cos(turn) * speed, vy: Math.cos(tilt) * speed, vz: Math.sin(tilt) * Math.sin(turn) * speed,
        age: 0, life: SPARK_LIFE * (0.7 + random() * 0.5), value: 0, sway: 0, size: SPARK_SIZE * (0.8 + random() * 0.5), floor,
      })
    }
  }

  function ring(x: number, y: number, z: number, reach: number, delay = 0) {
    if (ringList.length < MAX_RINGS) ringList.push({ x, y, z, age: -delay, reach })
  }

  return {
    mesh, outline, rings, gauge,
    /** Points in the air, streams and sparks together. */
    get live() { return points.length },
    get ringsLive() { return ringList.length },
    /** Where the gauge's fill stands now, 0 to 1. */
    get level() { return shown },
    /** Whether a completion is holding the gauge white. */
    get flashing() { return flash > 0 },
    /**
     * @param rate      Story points per second the workers on screen are making. The layer delivers
     *                  this and no more: {@link packetSpec} splits it into a countable number of
     *                  points, fatter as the rate grows.
     * @param progress  How much of the game being built is built, 0 to 1: the gauge's level.
     */
    update(dt: number, rate: number, lots: readonly FlowLot[], reduced: boolean, progress = 0) {
      dt = Math.min(MAX_FRAME_S, Math.max(0, dt))
      const total = lots.reduce((n, l) => n + l.sources.length, 0)
      // Reduced motion keeps the ticks and drops the movement, at a pace a tick can be read at.
      const spec = total > 0 ? packetSpec(rate, reduced ? 2 : undefined) : { perSecond: 0, value: 0 }
      const perSecond = spec.perSecond, value = spec.value
      owed = perSecond > 0 ? Math.min(owed + perSecond * dt, 12) : 0
      // Each point is born part-way through the frame it was owed in, so a stream is not a row of
      // frame-locked clumps.
      while (owed >= 1 && (reduced || points.length < MAX_PACKETS)) { owed -= 1; launch(lots, total, value, reduced, random() * dt) }

      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i]
        p.age += dt
        const done = p.age >= p.life || (p.kind === 1 && p.age > 0.05 && p.fy + p.vy * p.age - 0.5 * GRAVITY * p.age * p.age < p.floor)
        if (done) {
          if (p.kind === 0 && p.value > 0) onArrive?.(new T.Vector3(p.tx, p.ty, p.tz), p.value, p.key)
          else if (p.kind === 0 && p.hand) onHand?.(new T.Vector3(p.tx, p.ty, p.tz))
          points[i] = points[points.length - 1]
          points.pop()
        }
      }
      points.forEach((p, i) => {
        const u = Math.max(0, Math.min(1, p.age / p.life))
        if (p.kind === 0) {
          const dx = p.tx - p.fx, dz = p.tz - p.fz
          const run = Math.hypot(dx, dz)
          const lift = 4 * u * (1 - u)
          const bow = lift * p.sway
          const arc = Math.max(MIN_ARC, run * ARC) * lift
          // The bow is sideways in the ground plane: perpendicular to the run.
          const px = run > 1e-6 ? -dz / run : 0, pz = run > 1e-6 ? dx / run : 0
          at.set(p.fx + dx * u + px * bow, p.fy + (p.ty - p.fy) * u + arc, p.fz + dz * u + pz * bow)
          scale.setScalar(p.size)
          colour.copy(CODE).lerp(POINTS, Math.max(0, Math.min(1, (u - TURN_FROM) / (TURN_TO - TURN_FROM))))
        } else {
          at.set(p.fx + p.vx * p.age, p.fy + p.vy * p.age - 0.5 * GRAVITY * p.age * p.age, p.fz + p.vz * p.age)
          // White for the first instant, then the points' own amber; shrinking as it falls.
          scale.setScalar(p.size * (1 - u * u * 0.8))
          colour.copy(p.age < 0.12 ? FLASH : POINTS)
        }
        mesh.setMatrixAt(i, matrix.compose(at, identity, scale))
        mesh.setColorAt(i, colour)
        outline.setMatrixAt(i, matrix.compose(at, identity, halo.setScalar(scale.x * OUTLINE_GROW + OUTLINE_PAD)))
      })
      mesh.count = points.length
      outline.count = points.length
      outline.instanceMatrix.needsUpdate = true
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

      for (let i = ringList.length - 1; i >= 0; i--) {
        ringList[i].age += dt
        if (ringList[i].age >= RING_LIFE) { ringList[i] = ringList[ringList.length - 1]; ringList.pop() }
      }
      let r = 0
      for (const g of ringList) {
        if (g.age < 0) continue
        const u = g.age / RING_LIFE
        // Out fast, then slowing: a wave leaving its source.
        const out = 1 - (1 - u) * (1 - u)
        scale.set(Math.max(0.01, g.reach * out), 1, Math.max(0.01, g.reach * out))
        at.set(g.x, g.y, g.z)
        rings.setMatrixAt(r, matrix.compose(at, identity, scale))
        rings.setColorAt(r++, g.age < 0.1 ? FLASH : POINTS)
      }
      rings.count = r
      rings.instanceMatrix.needsUpdate = true
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true

      flash = Math.max(0, flash - dt)
      const target = Math.max(0, Math.min(1, progress))
      // Held full and white through the flash, then the level follows the truth, which has just gone back to nothing.
      shown = flash > 0 ? 1 : shown + (target - shown) * (1 - Math.exp(-GAUGE_FOLLOW * dt))
      if (Math.abs(target - shown) < 0.002) shown = target
      standGauges(lots, shown, flash > 0)
    },
    /**
     * The game is done: a build has landed in the queue (`'build'`) or a release has gone on sale
     * (`'release'`). The sink throws a fountain of points and a ring runs out from it; a release
     * is bigger and every open house does it too. Reduced motion gets none of it — the unit flash
     * and the HUD carry the event.
     */
    complete(lots: readonly FlowLot[], kind: 'build' | 'release', reduced: boolean) {
      if (reduced) return
      for (const lot of lots) {
        const main = lot.main ?? lot.gauge === true
        if (!main && kind === 'build') continue
        const s = standOf(lot)
        const y = s.y + 0.05
        ring(s.x, y, s.z, RING_REACH[kind] * (main ? 1 : 0.6))
        if (main) {
          ring(s.x, y, s.z, RING_REACH[kind] * 1.5, 0.12)
          if (kind === 'release') ring(s.x, y, s.z, RING_REACH[kind] * 2.1, 0.26)
          // From the top of the sink itself when it is a piece of furniture (`top`), else from over its gauge.
          fountain(lot.top === undefined ? at.set(s.x, s.y + GAUGE_H, s.z) : at.set(lot.sink.x, s.y + lot.top, lot.sink.z), s.y, SPARKS[kind], SPARK_SPEED[kind])
        } else fountain(at.set(s.x, s.y + 1, s.z), s.y, SPARKS.house, SPARK_SPEED.build)
      }
      flash = GAUGE_FLASH_S
    },
    /**
     * A click: the story points it paid, as blobs from the one who coded to the sink — one a point, up to
     * eight, each as large as what it carries — and a small pop of sparks at the person, so the tap is seen
     * to *make* something and not only to send it. They carry nothing to the sink (the poke already paid, and
     * said so in its own numeral), so spam stacks into more blobs rather than into more numerals.
     */
    emit(from: T.Vector3, to: T.Vector3, sp: number, reduced: boolean) {
      const n = Math.max(1, Math.min(8, Math.round(sp)))
      // No flight under reduced motion, so the points have landed already; the sound does not depend on the picture.
      if (reduced) { for (let i = 0; i < n; i++) onHand?.(to); return }
      for (let i = 0; i < n; i++) stream(from, to, 0, blobSize(sp / n), -i * 0.06, FLIGHT_S * 0.8, undefined, true)
      fountain(from, from.y - 0.4, 6, [1.6, 3.2])
    },
    dispose() {
      parent.remove(mesh)
      parent.remove(outline)
      outline.dispose()
      parent.remove(rings)
      parent.remove(gauge)
      gauge.dispose()
      rings.dispose()
      mesh.dispose()
      ringGeometry.dispose()
      geometry.dispose()
    },
  }
}
