import * as T from 'three'
import { createStage } from './boot.ts'
import { buildTowers, faceCoords, M, R, FLOOR_H, EARTH_SEATS, HQ_FACE, HQ_BLOCK, GROUND_DROP, rnd } from './grid.ts'
import { createTowers, towerUniforms, type TowerMesh, type TowerSpec } from './towers.ts'
import { createGround, type Ground } from './ground.ts'
import { createGarage } from './garage.ts'
import { LOTS, lotSeats, GARAGE_SEATS, perFloorOf } from './lots.ts'
import { createCrowd, createFurniture, floorLayout } from './people.ts'
import { Lens, clamp, smooth, MAP, type World } from './lens.ts'
import { createHud, short, metres, type CardInfo, type LegendRow } from './hud.ts'
import { developerAt, JAMES, leaderSeat, studioPerson, chair } from './repo.ts'
import { HEX } from './palette.ts'
import { breakdown, cdf, stateOf, describe } from './state.ts'
import { createFx } from './fx.ts'
import { createSpace, filingCabinet } from './space.ts'
import { buildNetwork, worldsSettled, WORLD_SEATS } from './network.ts'
import { createNetView, glyphMask, markMask, LY, REACH } from './netview.ts'
import { bindInput } from './input.ts'
import { createSwarm } from './swarm.ts'
import { clipMaterials, createPlinth, RUNGS } from './dioramas.ts'

export type Mode = 'monitor' | 'planet' | 'swarm' | 'dioramas'
const MODES: readonly Mode[] = ['monitor', 'planet', 'swarm', 'dioramas']

/**
 * Which option and headcount to open on: `?o=planet&n=30000000`, or the same as
 * a hash, `#planet-30000000` — a published page keeps a plain hash where it may
 * drop a query string.
 */
export function startOptions(): { mode: Mode; n: number } {
  const q = new URLSearchParams(location.search)
  let mode = (q.get('o') as Mode | null) ?? null
  let n = Number(q.get('n') ?? NaN)
  const m = /^(monitor|planet|swarm|dioramas)(?:-(\d+))?$/.exec(location.hash.slice(1))
  if (m) { mode = m[1] as Mode; if (m[2]) n = Number(m[2]) }
  return { mode: mode && MODES.includes(mode) ? mode : 'monitor', n: Number.isFinite(n) && n > 0 ? n : 1 }
}

const TITLES: Record<Mode, string> = {
  monitor: 'A // THE MONITOR',
  planet: 'B // LITTLE PLANET',
  swarm: 'C // THE SWARM',
  dioramas: 'D // DIORAMAS',
}
const SEED = 1
/** Below this camera distance, towers near the focus are cut open (the dollhouse). */
const OPEN_DIST = 420
/** A storey falls from this high. */
const DROP_H = 70
const POLE = new T.Vector3(0, 1, 0)
/** The map plane: every world's centre is on it. */
const PLANE = new T.Plane(new T.Vector3(0, 1, 0), 0)

/**
 * One tower set: the plots round the garage, the planet's towers, a colony
 * world's. Everything the renderer and the picker need to find a seat's building.
 */
interface TowerSet {
  /** Unique: 'lots', 'earth', or `w<index>` for a colony world. */
  name: string
  /** What the HUD calls the world it stands on: EARTH, PROXIMA B, WOLF 359 B. */
  label: string
  world: World
  mesh: TowerMesh
  count: number
  w: Float32Array
  d: Float32Array
  floors: Float32Array
  per: Float32Array
  seed: Float32Array
  seatBase: Float64Array
  capacity: Float64Array
  /** Global seat of this set's seat 0 (world w starts at w x 10^8). */
  offset: number
  parent: T.Object3D
  base: T.Matrix4[]
  applied: number
  /** Storeys drawn, where a drop is still catching up with the headcount. */
  anim: Map<number, { shown: number; t: number; falling: boolean; land: number }>
  cut: Map<number, { y: number; target: number; floor: number }>
  blocks?: { of: Int32Array; occ: Float64Array; cap: Float64Array; ground: Ground }
  /** Each block's towers, so the ones near a point are found without walking them all. */
  blockOf?: Int32Array
}

export async function run(mode: Mode): Promise<void> {
  const hud = createHud(mode, TITLES[mode])
  await document.fonts.load('11px "Departure Mono"').catch(() => undefined)
  const host = document.getElementById('stage')!
  const stage = createStage(host)
  const { scene, camera, renderer } = stage
  const time = { t: 0 }

  // ---- the world model -------------------------------------------------------
  const lotInfo = lotSeats()
  const earthTowers = buildTowers(SEED, lotInfo.end)
  const tu = towerUniforms()
  const pu = {
    uTime: tu.uTime, uMoon: tu.uMoon, uCam: tu.uCam, uMode: { value: 0 },
    uP0: tu.uP0, uP2: tu.uP2, uP3: tu.uP3, uFogNear: tu.uFogNear, uFogFar: tu.uFogFar,
  }
  const earth: World = { centre: new T.Vector3(), radius: R }
  const ground = createGround()
  scene.add(ground.mesh, ground.atmosphere)
  const grounds: Ground[] = [ground]
  /** The ground shares the towers' loss-view uniforms, so the colours agree at every distance. */
  const shareLoss = (g: Ground) => {
    const u = (g.mesh.material as T.ShaderMaterial).uniforms
    u.uLoss = tu.uLoss; u.uCdfA = tu.uCdfA; u.uCdfB = tu.uCdfB; u.uStates = tu.uStates
  }
  shareLoss(ground)
  const hq = new T.Group()
  hq.position.set(0, R, 0)
  scene.add(hq)
  const garage = createGarage(renderer)
  hq.add(garage.root)

  // The plots round the garage, plus the garage's own glyph for the monitor.
  const lotKind = new Float32Array(LOTS.length + 1)
  const lotSpec: TowerSpec = {
    count: LOTS.length + 1,
    pos: new Float32Array((LOTS.length + 1) * 3), quat: new Float32Array((LOTS.length + 1) * 4),
    w: new Float32Array(LOTS.length + 1), d: new Float32Array(LOTS.length + 1), floors: new Float32Array(LOTS.length + 1),
    perFloor: new Float32Array(LOTS.length + 1), seed: new Float32Array(LOTS.length + 1), kind: lotKind,
  }
  LOTS.forEach((lot, k) => {
    lotSpec.pos.set([lot.x, -0.5, lot.z], k * 3); lotSpec.quat.set([0, 0, 0, 1], k * 4)
    lotSpec.w[k] = lot.w; lotSpec.d[k] = lot.d; lotSpec.floors[k] = lot.floors
    lotSpec.perFloor[k] = perFloorOf(lot.w, lot.d); lotSpec.seed[k] = 9000 + k * 7919; lotKind[k] = 1
  })
  const G = LOTS.length
  lotSpec.pos.set([-1, -0.4, 0], G * 3); lotSpec.quat.set([0, 0, 0, 1], G * 4)
  lotSpec.w[G] = 20; lotSpec.d[G] = 20; lotSpec.floors[G] = 1; lotSpec.perFloor[G] = 20; lotKind[G] = 2
  const lotMesh = createTowers(lotSpec, tu)
  hq.add(lotMesh.mesh)
  const earthMesh = createTowers({ ...earthTowers, kind: undefined }, tu)
  scene.add(earthMesh.mesh)

  const PB = earthTowers.perBlock
  const blockIndex = (t: { count: number; block: Int32Array }) => {
    const out = new Int32Array(6 * M * M * PB).fill(-1)
    for (let k = 0; k < t.count; k++) {
      const b = t.block[k]
      for (let s = 0; s < PB; s++) if (out[b * PB + s] < 0) { out[b * PB + s] = k; break }
    }
    return out
  }
  const blockOf = blockIndex(earthTowers)
  const baseMatrices = (spec: { count: number; pos: Float32Array; quat: Float32Array }) => {
    const out: T.Matrix4[] = []
    const p = new T.Vector3(), q = new T.Quaternion(), one = new T.Vector3(1, 1, 1)
    for (let k = 0; k < spec.count; k++) {
      p.fromArray(spec.pos, k * 3); q.fromArray(spec.quat, k * 4)
      out.push(new T.Matrix4().compose(p, q, one))
    }
    return out
  }
  const lots: TowerSet = {
    name: 'lots', label: 'EARTH', world: earth, mesh: lotMesh, count: LOTS.length, w: lotSpec.w, d: lotSpec.d, floors: lotSpec.floors, per: lotSpec.perFloor,
    seed: lotSpec.seed, seatBase: Float64Array.from(lotInfo.base), capacity: Float64Array.from(lotInfo.capacity), offset: 0,
    parent: hq, base: baseMatrices(lotSpec), applied: 0, anim: new Map(), cut: new Map(),
  }
  const earthSet: TowerSet = {
    name: 'earth', label: 'EARTH', world: earth, mesh: earthMesh, count: earthTowers.count, w: earthTowers.w, d: earthTowers.d, floors: earthTowers.floors,
    per: earthTowers.perFloor, seed: earthTowers.seed, seatBase: earthTowers.seatBase, capacity: earthTowers.capacity, offset: 0,
    parent: scene, base: baseMatrices(earthTowers), applied: 0, anim: new Map(), cut: new Map(),
    blocks: { of: earthTowers.block, occ: new Float64Array(earthTowers.blocks), cap: earthTowers.blockCapacity, ground },
    blockOf,
  }
  // The HQ block reads as settled from the start: it is the garage's street.
  ground.setBlock(HQ_FACE * M * M + HQ_BLOCK * M + HQ_BLOCK, 1)
  const sets: TowerSet[] = [lots, earthSet]

  const crowd = createCrowd(6000, pu)
  const furn = createFurniture(6000, 120, pu)
  scene.add(crowd.mesh, furn.desks, furn.monitors, furn.slabs)
  const fx = createFx()
  scene.add(fx.group)
  // ---- the colony network: the top of the ladder --------------------------------
  const net = buildNetwork(SEED)
  const netView = createNetView(net)
  scene.add(netView.group)
  /** A demo's ceiling: a hundred worlds, 10,000,000,000 developers. */
  const MAX_WORLDS = Math.min(net.order.length, 100)
  /** Where world `w` stands: its system's point on the map plane (Earth's is the origin). */
  const worldCentre = (w: number) => netView.position(net.order[w])
  const worldName = (w: number) => (w === 0 ? 'EARTH' : w === 1 ? 'PROXIMA B' : `${net.systems[net.order[w]].name.toUpperCase()} B`)
  const PROXIMA_B = worldCentre(1)
  // Proxima Centauri itself, a small red sun a few kilometres off James's world.
  const space = createSpace(stage.sky, PROXIMA_B.clone().add(new T.Vector3(-6500, 0, -3800)))
  scene.add(space.group)
  /** The glyphs' pixel, in screen pixels, outside the monitor: its three, at this pixel ratio. */
  const glyphPx = () => Math.max(1, Math.round(3 * renderer.getPixelRatio()))
  const swarm = mode === 'swarm' ? createSwarm(stage.lite ? 160_000 : 700_000) : null
  if (swarm) scene.add(swarm.points)
  const plinth = mode === 'dioramas' ? createPlinth() : null
  if (plinth) {
    scene.add(plinth.ring)
    clipMaterials(garage.root, plinth.uniform)
    for (const mat of [lotMesh.mesh.material, earthMesh.mesh.material, crowd.mesh.material, furn.desks.material, furn.slabs.material, ground.mesh.material] as T.ShaderMaterial[]) plinth.patch(mat)
  }

  // ---- the lens ------------------------------------------------------------
  const lens = new Lens(earth)
  const garageFocus = new T.Vector3(0, R, 1.3).normalize()
  lens.f.copy(garageFocus)
  lens.h.set(-1, 0, -1).normalize()
  lens.lift = 0.6
  lens.dist = 46
  lens.min = 5
  lens.max = 1.1e7
  let shake = 0
  /** Metres per CSS pixel where the lens is looking. */
  const mpp = () => (2 * (lens.dist + lens.world.radius * lens.far) * Math.tan((camera.fov * Math.PI) / 360)) / stage.height

  // ---- headcount -------------------------------------------------------------
  let N = 1
  let auto = 0
  const AUTO = [0, 1.2, 4, 18]
  const AUTO_LABEL = ['AUTO', 'AUTO >', 'AUTO >>', 'AUTO >>>']
  let worlds = 1
  let launched = false
  let loss = 0
  let lossTarget = 0
  let bd = breakdown(N, worlds)
  /** Colony worlds built so far, by world index: Proxima b for good, and the one being visited. */
  const colonies = new Map<number, TowerSet>()
  let jamesAway = false
  /** Packets to send along the lanes next frame: the hires past Earth. */
  let arrivals = 0

  function towerIndexOf(S: TowerSet, s: number): number {
    if (s < S.seatBase[0]) return -1
    let lo = 0, hi = S.count - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S.seatBase[mid] <= s) lo = mid; else hi = mid - 1 }
    return lo
  }
  const builtOf = (S: TowerSet, k: number, occ: number) => Math.min(S.floors[k], Math.ceil(occ / S.per[k] - 1e-6))

  function applySet(S: TowerSet, n: number, animate: boolean, nearTest: (k: number) => boolean) {
    const prev = S.applied
    if (n === prev) return
    const lowSeat = Math.min(prev, n), highSeat = Math.max(prev, n)
    const lo = Math.max(0, towerIndexOf(S, Math.max(S.seatBase[0], lowSeat - 1)))
    const hi = Math.min(S.count, towerIndexOf(S, Math.max(S.seatBase[0], highSeat)) + 1)
    for (let k = lo; k < hi; k++) {
      const occ = clamp(n - S.seatBase[k], 0, S.capacity[k])
      const was = S.mesh.occ[k]
      const prevTarget = S.mesh.target[k]
      const built = builtOf(S, k, occ)
      let a = S.anim.get(k)
      // The neighbours' houses go the moment a plot has anybody on it, however
      // the headcount got there (a hire, a preset, a link).
      if (S.name === 'lots' && prevTarget <= 0 && occ > 0) {
        garage.clearLot(LOTS[k].clear)
        if (animate) hud.log(`A storey drops on ${LOTS[k].name}.`)
      }
      const animateThis = animate && occ > was && nearTest(k)
      if (animateThis) {
        const shownBefore = a ? a.shown : builtOf(S, k, was)
        if (!a) { a = { shown: shownBefore, t: 0, falling: false, land: -1 }; S.anim.set(k, a) }
      } else if (a && built <= a.shown) {
        a.shown = built
      } else if (!animateThis) {
        S.anim.delete(k)
      }
      S.mesh.occ[k] = a ? Math.min(occ, a.shown * S.per[k]) : occ
      S.mesh.target[k] = occ
      if (S.blocks) {
        const b = S.blocks.of[k]
        S.blocks.occ[b] = Math.max(0, S.blocks.occ[b] + occ - prevTarget)
        S.blocks.ground.setBlock(b, S.blocks.occ[b] / Math.max(1, S.blocks.cap[b]))
      }
    }
    S.mesh.commit(lo, hi)
    if (S.name !== 'lots') S.mesh.mesh.count = Math.max(0, Math.min(S.count, towerIndexOf(S, Math.max(S.seatBase[0], n - 1)) + (n > S.seatBase[0] ? 1 : 0)))
    S.applied = n
  }

  const focusPoint = () => lens.world.centre.clone().addScaledVector(lens.f, lens.world.radius + lens.lift)
  const towerWorld = (S: TowerSet, k: number, out = new T.Matrix4()) => out.multiplyMatrices(S.parent.matrixWorld, S.base[k])
  const towerPos = (S: TowerSet, k: number) => new T.Vector3().setFromMatrixPosition(towerWorld(S, k))

  /** Seats world `w`'s towers hold at the current headcount. */
  const worldFill = (w: number) => clamp(N - w * WORLD_SEATS, 0, WORLD_SEATS)
  function setHeadcount(n: number, animate: boolean) {
    const before = N
    // Earth fills first; past it, a world per hundred million, in lane order.
    const cap = launched ? MAX_WORLDS * WORLD_SEATS : EARTH_SEATS
    N = clamp(Math.floor(n), 1, cap)
    worlds = launched ? Math.min(MAX_WORLDS, worldsSettled(N)) : 1
    const earthN = Math.min(N, EARTH_SEATS)
    garage.setHeadcount(earthN, animate && lens.dist < 300)
    const fp = focusPoint()
    const near = (S: TowerSet) => (k: number) => lens.dist < 2500 && towerPos(S, k).distanceTo(fp) < 900
    applySet(lots, earthN, animate, near(lots))
    applySet(earthSet, earthN, animate, near(earthSet))
    for (const [w, S] of colonies) applySet(S, worldFill(w), animate, near(S))
    if (animate && N > before && N > EARTH_SEATS) arrivals += Math.min(4, 1 + Math.floor(Math.log10(N - before)))
    bd = breakdown(N, worlds)
    const [a, b] = cdf(bd)
    tu.uCdfA.value.copy(a); tu.uCdfB.value.copy(b)
    if (swarm) swarm.dirty = true
    hud.showLaunch(N >= EARTH_SEATS && !launched)
  }

  // ---- storey drops -----------------------------------------------------------
  function updateDrops(dt: number) {
    for (const S of sets) {
      for (const [k, a] of S.anim) {
        const target = S.mesh.target[k]
        const built = builtOf(S, k, target)
        const backlog = built - a.shown
        if (!a.falling && a.land < 0 && backlog > 0) {
          a.shown += 1; a.falling = true; a.t = 0
        }
        const speed = 1 + Math.min(6, Math.max(0, backlog - 1))
        if (a.falling) {
          a.t += dt * speed
          const u = Math.min(1, a.t / 0.55)
          S.mesh.drop[k] = DROP_H * (1 - u * u)
          if (u >= 1) {
            a.falling = false; a.land = 0; S.mesh.drop[k] = 0
            const p = towerPos(S, k)
            const up = p.clone().sub(S.world.centre).normalize()
            fx.dust(p, up, Math.max(S.w[k], S.d[k]) * 0.6)
            if (p.distanceTo(camera.position) < lens.dist * 3) shake = Math.max(shake, 0.25 + (S.name === 'lots' ? 0.35 : 0))
          }
        } else if (a.land >= 0) {
          a.land += dt * speed
          const u = a.land / 0.35
          S.mesh.squash[k] = u < 1 ? 1 - 0.12 * Math.sin(Math.PI * u) * (1 - u) + 0.03 * Math.sin(Math.PI * 2 * u) * u : 1
          if (u >= 1) { a.land = -1; S.mesh.squash[k] = 1 }
        }
        S.mesh.occ[k] = Math.min(target, a.shown * S.per[k])
        S.mesh.commit(k, k + 1)
        S.mesh.touch(k)
        if (!a.falling && a.land < 0 && a.shown >= built) S.anim.delete(k)
      }
    }
  }

  // ---- the dollhouse: towers near the focus are cut open below the eye --------
  let subject: { S: TowerSet; k: number; floor: number; local: number } | null = null
  let interiorKey = ''
  let interiorAt = 0
  const crowdSeat: { S: TowerSet; k: number; local: number }[] = []
  const layoutCache = new Map<string, { x: number; z: number; yaw: number }[]>()

  function nearTowers(S: TowerSet, fp: T.Vector3, radius: number): number[] {
    const out: number[] = []
    if (S.name === 'lots') {
      for (let k = 0; k < S.count; k++) if (S.mesh.occ[k] > 0 && towerPos(S, k).distanceTo(fp) < radius + 30) out.push(k)
      return out
    }
    const of = S.blockOf
    if (!of) return out
    const dir = fp.clone().sub(S.world.centre).normalize()
    const { face, a, b } = faceCoords(dir)
    const i0 = Math.floor(((a + 1) / 2) * M), j0 = Math.floor(((b + 1) / 2) * M)
    const reach = Math.ceil(radius / 120) + 1
    for (let di = -reach; di <= reach; di++) for (let dj = -reach; dj <= reach; dj++) {
      const i = i0 + di, j = j0 + dj
      if (i < 0 || j < 0 || i >= M || j >= M) continue
      const block = face * M * M + j * M + i
      for (let s = 0; s < PB; s++) {
        const k = of[block * PB + s]
        if (k >= 0 && S.mesh.occ[k] > 0 && towerPos(S, k).distanceTo(fp) < radius) out.push(k)
      }
    }
    return out
  }

  /** The tower set of the world under the lens (on the map, the one it rose from). */
  function here(): TowerSet | null {
    for (const S of sets) if (S.blocks && S.world === lens.world) return S
    return null
  }

  function updateOpen(dt: number) {
    const fp = focusPoint()
    const open = lens.dist < OPEN_DIST && !(mode === 'monitor' && monitorT > 0.98)
    const radius = clamp(lens.dist * 1.1, 40, 170)
    const want = new Map<TowerSet, Map<number, number>>()
    for (const S of sets) {
      const m = new Map<number, number>()
      want.set(S, m)
      if (!open && !(subject && subject.S === S)) continue
      const ks = open ? nearTowers(S, fp, radius) : []
      if (subject && subject.S === S && !ks.includes(subject.k)) ks.push(subject.k)
      for (const k of ks) {
        const shown = Math.ceil(S.mesh.occ[k] / S.per[k] - 1e-6)
        if (shown < 1) continue
        const baseP = towerPos(S, k)
        const up = baseP.clone().sub(S.world.centre).normalize()
        const eye = camera.position.clone().sub(baseP).dot(up)
        let floor = clamp(Math.floor((eye - 4) / FLOOR_H), 0, shown - 1)
        if (subject && subject.S === S && subject.k === k) floor = Math.min(subject.floor, shown - 1)
        m.set(k, floor)
      }
    }
    let changed = false
    for (const S of sets) {
      const m = want.get(S)!
      for (const [k, floor] of m) {
        const shown = Math.ceil(S.mesh.occ[k] / S.per[k] - 1e-6)
        const target = floor * FLOOR_H + 1.1
        let c = S.cut.get(k)
        if (!c) { c = { y: shown * FLOOR_H + 0.6, target, floor }; S.cut.set(k, c) }
        c.target = target; c.floor = floor
      }
      for (const [k, c] of S.cut) {
        const shown = Math.ceil(S.mesh.occ[k] / S.per[k] - 1e-6)
        const roof = shown * FLOOR_H + 0.6
        const goal = m.has(k) ? c.target : roof + 0.5
        c.y += (goal - c.y) * Math.min(1, dt * 6)
        if (!m.has(k) && c.y >= roof) { S.cut.delete(k); S.mesh.open[k] = 0; S.mesh.touch(k); changed = true; continue }
        if (Math.abs(S.mesh.open[k] - c.y) > 0.01) { S.mesh.open[k] = c.y; S.mesh.touch(k) }
      }
    }
    // The people on each cut storey, rebuilt when the set of storeys changes.
    const parts: string[] = []
    for (const S of sets) for (const [k, c] of S.cut) {
      if (S.mesh.open[k] > c.target + FLOOR_H * 0.9) continue
      parts.push(`${S.name}:${k}:${c.floor}:${Math.floor(S.mesh.occ[k])}:${S.anim.get(k)?.falling ? 1 : 0}`)
    }
    const key = parts.join('|') + (subject ? `#${subject.k}:${subject.local}` : '')
    if ((key !== interiorKey && time.t - interiorAt > 0.12) || changed || dropsInView()) {
      interiorKey = key
      interiorAt = time.t
      rebuildInteriors()
    }
  }
  const dropsInView = () => [...sets].some((S) => [...S.anim.values()].some((a) => a.falling && S.cut.size > 0))

  function rebuildInteriors() {
    let n = 0, slabs = 0
    crowdSeat.length = 0
    const m = new T.Matrix4(), local = new T.Matrix4(), rot = new T.Matrix4()
    for (const S of sets) for (const [k, c] of S.cut) {
      if (S.mesh.open[k] > c.target + FLOOR_H * 0.9) continue
      const per = S.per[k], w = S.w[k], d = S.d[k]
      const key = `${w.toFixed(1)}:${d.toFixed(1)}:${per}`
      let layout = layoutCache.get(key)
      if (!layout) { layout = floorLayout(w, d, per); layoutCache.set(key, layout) }
      const shown = Math.ceil(S.mesh.occ[k] / per - 1e-6)
      const top = c.floor === shown - 1
      const drop = top ? S.mesh.drop[k] : 0
      const sq = S.mesh.squash[k]
      towerWorld(S, k, m)
      const y = c.floor * FLOOR_H * sq + drop
      if (slabs < 120) {
        local.makeTranslation(0, y, 0).multiply(new T.Matrix4().makeScale(w - 0.5, 1, d - 0.5))
        furn.slabs.setMatrixAt(slabs++, m.clone().multiply(local))
      }
      const from = c.floor * per, to = Math.min(S.mesh.occ[k], from + per)
      for (let s = from; s < to && n < crowd.capacity; s++) {
        const spot = layout[s - from]
        rot.makeRotationY(spot.yaw)
        local.makeTranslation(spot.x, y, spot.z).multiply(rot)
        const world = m.clone().multiply(local)
        const global = S.offset + S.seatBase[k] + s
        const who = developerAt(SEED, global)
        const hi = subject && subject.S === S && subject.k === k && subject.local === s ? 1 : 0
        crowd.set(n, world, who.look, hi ? 0.35 : 0, s * 1.7, 1, hi)
        furn.desks.setMatrixAt(n, world)
        furn.monitors.setMatrixAt(n, world)
        crowdSeat[n] = { S, k, local: s }
        n++
      }
    }
    crowd.count = n
    crowd.commit()
    furn.desks.count = n; furn.monitors.count = n; furn.slabs.count = slabs
    furn.desks.instanceMatrix.needsUpdate = true
    furn.monitors.instanceMatrix.needsUpdate = true
    furn.slabs.instanceMatrix.needsUpdate = true
  }

  /**
   * A building between the lens and whatever it is looking at is drawn as its
   * outline. The garage is framed from the front (§12.1), and by a hundred
   * million the plots across the street stand in the way; nobody should lose
   * the founder behind an office block.
   */
  const xrayed = new Set<string>()
  function xray() {
    const want = new Set<string>()
    if (lens.dist < 500 && !chase) {
      const fp = focusPoint()
      const toFocus = fp.clone().sub(camera.position)
      const reach = toFocus.length()
      const r = new T.Ray(camera.position.clone(), toFocus.normalize())
      const inv = new T.Matrix4(), local = new T.Ray(), box = new T.Box3(), hit = new T.Vector3()
      const test = (S: TowerSet, k: number) => {
        const occ = S.mesh.occ[k]
        if (occ <= 0) return
        const h = Math.ceil(occ / S.per[k] - 1e-6) * FLOOR_H + 0.6
        const m = towerWorld(S, k)
        inv.copy(m).invert()
        local.copy(r).applyMatrix4(inv)
        box.min.set(-S.w[k] / 2 - 1, 0, -S.d[k] / 2 - 1); box.max.set(S.w[k] / 2 + 1, h, S.d[k] / 2 + 1)
        if (local.intersectBox(box, hit) && hit.applyMatrix4(m).distanceTo(camera.position) < reach - 4) want.add(`${S.name}:${k}`)
      }
      if (lens.world === earth) for (let k = 0; k < lots.count; k++) test(lots, k)
      const S = here()
      if (S) for (const k of nearTowers(S, fp, 260)) test(S, k)
    }
    for (const key of new Set([...want, ...xrayed])) {
      const [name, ks] = key.split(':')
      const S = sets.find((x) => x.name === name)
      if (!S) continue
      const k = Number(ks)
      const on = want.has(key) ? 1 : 0
      if (S.mesh.xray[k] !== on) { S.mesh.xray[k] = on; S.mesh.touch(k) }
    }
    xrayed.clear()
    for (const key of want) xrayed.add(key)
  }

  // ---- the alternative layers: the monitor, the swarm -------------------------
  let monitorT = 0
  let swarmT = 0
  const phosphorRT = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType })
  phosphorRT.texture.minFilter = T.NearestFilter
  phosphorRT.texture.magFilter = mode === 'monitor' ? T.NearestFilter : T.LinearFilter
  const PIXEL = 3
  function resizeAlt() {
    const pr = renderer.getPixelRatio()
    const div = mode === 'monitor' ? PIXEL * pr : 1
    phosphorRT.setSize(Math.max(4, Math.round((stage.width * pr) / div)), Math.max(4, Math.round((stage.height * pr) / div)))
  }
  new ResizeObserver(resizeAlt).observe(host)
  resizeAlt()

  const phosphorRamp = (e: number): [T.Color, T.Color, T.Color, T.Color] => {
    const ramps = [HEX.calm, HEX.warn, HEX.alarm]
    const seg = e < 0.5 ? 0 : 1
    const t = e < 0.5 ? e / 0.5 : (e - 0.5) / 0.5
    return [0, 1, 2, 3].map((i) => new T.Color(ramps[seg][i]).lerp(new T.Color(ramps[seg + 1][i]), t)) as [T.Color, T.Color, T.Color, T.Color]
  }

  function renderAlt(amount: number) {
    if (amount <= 0) { stage.overlay(null, 0); return }
    const hideGarage = garage.root.visible
    const saved = { tower: tu.uMode.value, people: pu.uMode.value, sp: space.uniforms.uMode.value, ph: grounds.map((g) => g.uniforms.uPhosphor.value) }
    const sun = space.proxima.material as T.MeshBasicMaterial
    const sunCol = sun.color.clone()
    const nu = netView.uniforms
    nu.uRes.value.set(phosphorRT.width, phosphorRT.height)
    if (mode === 'monitor') {
      tu.uMode.value = 1; pu.uMode.value = 1; space.uniforms.uMode.value = 1
      // Every world goes to phosphor, not only Earth: a colony on the monitor is
      // drawn in the same four values as home.
      for (const g of grounds) { g.uniforms.uPhosphor.value = 1; g.atmosphere.visible = false }
      nu.uMode.value = 1; nu.uPx.value = 1
      sun.color.copy(tu.uP3.value)
      garage.root.visible = false
    } else {
      tu.uMode.value = 2
      for (const g of grounds) g.uniforms.uPhosphor.value = 2
      crowd.mesh.visible = false; furn.desks.visible = false; furn.monitors.visible = false; furn.slabs.visible = false
      garage.root.visible = false
      if (swarm) swarm.points.visible = true
    }
    renderer.setRenderTarget(phosphorRT)
    renderer.setClearColor(mode === 'monitor' ? tu.uP0.value.clone().multiplyScalar(0.35) : new T.Color(HEX.night), 1)
    renderer.clear()
    if (mode === 'monitor') {
      renderer.render(stage.sky, stage.skyCamera)
      renderer.clearDepth()
    }
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    tu.uMode.value = saved.tower; pu.uMode.value = saved.people; space.uniforms.uMode.value = saved.sp
    grounds.forEach((g, i) => { g.uniforms.uPhosphor.value = saved.ph[i]; g.atmosphere.visible = true })
    nu.uMode.value = 0; nu.uPx.value = glyphPx(); nu.uRes.value.set(renderer.domElement.width, renderer.domElement.height)
    sun.color.copy(sunCol)
    garage.root.visible = hideGarage
    crowd.mesh.visible = true; furn.desks.visible = true; furn.monitors.visible = true; furn.slabs.visible = true
    if (swarm) swarm.points.visible = false
    stage.overlay(phosphorRT.texture, amount, mode === 'monitor')
  }
  let monitorGoal = 0
  let swarmGoal = 0

  // ---- dioramas ---------------------------------------------------------------
  let rung = 0
  const anchor = { dir: garageFocus.clone(), world: earth as World }
  function goRung(next: number, dir?: T.Vector3) {
    if (!plinth) return
    rung = clamp(next, 0, RUNGS.length - 1)
    if (dir) anchor.dir.copy(dir)
    const r = RUNGS[rung]
    lens.flyTo(anchor.world, anchor.dir, r.rest)
    hud.log(`${r.label.trim()} // ${r.caption}`)
  }

  // ---- picking and cards ----------------------------------------------------
  const ray = new T.Raycaster()
  let cardSeat: { S: TowerSet | null; k: number; local: number; garageSeat?: number } | null = null
  let cardTower: { S: TowerSet; k: number } | null = null

  function personCard(name: string, global: number, place: string[], seed: number, local: number, trait: string | null): CardInfo {
    const st = describe(stateOf(seed, local, time.t, bd))
    return {
      kicker: 'DEVELOPER', title: name,
      lines: [`DEV #${(global + 1).toLocaleString('en-US')} OF ${N.toLocaleString('en-US')}`, ...place, ...(trait ? [`TRAIT: ${trait.toUpperCase()}`] : [])],
      state: st,
      actions: [{ id: 'poke', label: 'POKE' }, { id: 'close', label: 'CLOSE' }],
    }
  }
  function placeLines(S: TowerSet, k: number, local: number): string[] {
    const floor = Math.floor(local / S.per[k]) + 1
    const desk = (local % S.per[k]) + 1
    if (S.name === 'lots') return [`EARTH > HQ > ${LOTS[k].name}`, `STOREY ${floor} // DESK ${desk}`]
    return [`${S.label} > TOWER ${(k + 1).toLocaleString('en-US')}`, `STOREY ${floor} // DESK ${desk}`]
  }
  function showSeat(S: TowerSet, k: number, local: number) {
    const global = S.offset + S.seatBase[k] + local
    const who = developerAt(SEED, global)
    cardSeat = { S, k, local }
    cardTower = null
    hud.card(personCard(who.name, global, placeLines(S, k, local), S.seed[k], local, who.trait))
  }
  function showGarageSeat(seat: number) {
    cardSeat = { S: null, k: -1, local: seat, garageSeat: seat }
    cardTower = null
    if (seat === leaderSeat('founder')) {
      hud.card({ kicker: 'FOUNDER', title: 'YOU', lines: ['EARTH > HQ > THE GARAGE', 'THE CORNER DESK, FACING THE WRONG WAY'], actions: [{ id: 'poke', label: 'POKE' }, { id: 'close', label: 'CLOSE' }] })
      return
    }
    if (seat === leaderSeat('james')) {
      hud.card({ kicker: 'HERO', title: 'JAMES', lines: [jamesAway ? 'PROXIMA B > THE FIRST DESK' : 'EARTH > HQ > THE GARAGE', 'NO SPECIALITY. DOES IT PROPERLY.'], actions: [{ id: 'poke', label: 'POKE' }, { id: 'close', label: 'CLOSE' }] })
      return
    }
    const who = developerAt(SEED, seat)
    hud.card(personCard(who.name, seat, ['EARTH > HQ > THE GARAGE', `DESK ${seat + 1} OF ${GARAGE_SEATS}`], 777, seat, who.trait))
  }
  function towerCard(S: TowerSet, k: number) {
    cardTower = { S, k }
    cardSeat = null
    const occ = Math.floor(S.mesh.target[k])
    const storeys = Math.ceil(occ / S.per[k] - 1e-6)
    const newest = developerAt(SEED, S.offset + S.seatBase[k] + Math.max(0, occ - 1))
    const name = S.name === 'lots' ? LOTS[k].name : `TOWER ${(k + 1).toLocaleString('en-US')}`
    hud.card({
      kicker: S.name === 'lots' ? 'HQ PLOT' : S.label,
      title: name,
      lines: [`${storeys} STOREYS // ${occ.toLocaleString('en-US')} DEVELOPERS`, `NEWEST: ${newest.name.toUpperCase()}`, `WORKING RIGHT NOW: ${(bd.work * 100).toFixed(bd.work < 0.01 ? 2 : 1)}%`],
      actions: [{ id: 'inside', label: 'LOOK INSIDE' }, { id: 'close', label: 'CLOSE' }],
    })
  }

  function pickTower(r: T.Raycaster): { S: TowerSet; k: number; d: number } | null {
    let best: { S: TowerSet; k: number; d: number } | null = null
    const inv = new T.Matrix4(), local = new T.Ray(), box = new T.Box3(), hit = new T.Vector3()
    const test = (S: TowerSet, k: number) => {
      const occ = S.mesh.occ[k]
      if (occ <= 0) return
      const h = Math.ceil(occ / S.per[k] - 1e-6) * FLOOR_H + 0.6
      inv.copy(towerWorld(S, k)).invert()
      local.copy(r.ray).applyMatrix4(inv)
      box.min.set(-S.w[k] / 2, 0, -S.d[k] / 2); box.max.set(S.w[k] / 2, h, S.d[k] / 2)
      if (local.intersectBox(box, hit)) {
        const d = hit.applyMatrix4(towerWorld(S, k)).distanceTo(r.ray.origin)
        if (!best || d < best.d) best = { S, k, d }
      }
    }
    if (lens.world === earth) for (let k = 0; k < lots.count; k++) test(lots, k)
    const hitP = new T.Vector3()
    const world = lens.world
    if (r.ray.intersectSphere(new T.Sphere(world.centre, world.radius), hitP)) {
      const S = here()
      if (S) {
        const seen = new Set<number>()
        const back = r.ray.direction.clone().negate()
        for (let s = 0; s <= 30; s++) {
          const p = hitP.clone().addScaledVector(back, s * 12)
          for (const k of nearTowers(S, p, 90)) if (!seen.has(k)) { seen.add(k); test(S, k) }
        }
      }
    }
    return best
  }

  function tap(x: number, y: number) {
    const ndc = stage.content(x, y)
    ray.setFromCamera(ndc, camera)
    if (onMap()) {
      // On the map a tap is a system: the nearest glyph within a fingertip.
      const hit = new T.Vector3()
      const s = ray.ray.intersectPlane(PLANE, hit) ? netView.pick(hit, 18 * mpp()) : -1
      if (s >= 0) systemCard(s)
      else { hud.card(null); cardSeat = null; cardTower = null }
      return
    }
    if (lens.dist < 400 && garage.root.visible) {
      const seat = garage.pick(ray)
      if (seat !== null) { garage.hop(seat); showGarageSeat(seat); return }
    }
    // People on open storeys: the nearest head within a finger's reach.
    let bestI = -1, bestD = 18
    const v = new T.Vector3(), m = new T.Matrix4()
    for (let i = 0; i < crowd.count; i++) {
      crowd.mesh.getMatrixAt(i, m)
      v.set(0, 1.35, 0).applyMatrix4(m).project(camera)
      if (v.z > 1) continue
      const dx = (v.x - ndc.x) * stage.width / 2, dy = (v.y - ndc.y) * stage.height / 2
      const d = Math.hypot(dx, dy)
      if (d < bestD) { bestD = d; bestI = i }
    }
    if (bestI >= 0) {
      const s = crowdSeat[bestI]
      subject = { S: s.S, k: s.k, floor: Math.floor(s.local / s.S.per[s.k]), local: s.local }
      showSeat(s.S, s.k, s.local)
      return
    }
    const t = pickTower(ray)
    if (t) {
      if (plinth && rung >= 2) {
        // Dioramas: a tap on a unit dives into it.
        goRung(rung - 1, towerPos(t.S, t.k).sub(lens.world.centre).normalize())
        return
      }
      towerCard(t.S, t.k)
      return
    }
    hud.card(null)
    cardSeat = null
    cardTower = null
  }

  /** Fly to seat `s` (a global index), open its storey, and introduce them. */
  function findSeat(s: number) {
    hud.card(null)
    if (s < GARAGE_SEATS) {
      const p = garage.seatPoint(s)!
      const dir = p.clone().add(hq.position).normalize()
      subject = null
      lens.flyTo(earth, dir, 22, () => { garage.hop(s); showGarageSeat(s) })
      if (plinth) { rung = 0; anchor.dir.copy(dir) }
      return
    }
    let S: TowerSet = s >= EARTH_SEATS ? colonyFor(Math.floor(s / WORLD_SEATS)) : s < lotInfo.end ? lots : earthSet
    if (S === earthSet && s < earthSet.seatBase[0]) S = lots
    const localSeat = s - S.offset
    const k = towerIndexOf(S, localSeat)
    const local = localSeat - S.seatBase[k]
    const floor = Math.floor(local / S.per[k])
    subject = { S, k, floor, local }
    const p = towerPos(S, k)
    const world = S.world
    const up = p.clone().sub(world.centre).normalize()
    const target = p.clone().addScaledVector(up, floor * FLOOR_H).sub(world.centre)
    const dir = target.clone().normalize()
    lens.lift = floor * FLOOR_H + 0.6
    if (plinth) { rung = 0; anchor.dir.copy(dir); anchor.world = world }
    lens.flyTo(world, dir, 34, () => showSeat(S, k, local))
    hud.log(`Finding developer #${(s + 1).toLocaleString('en-US')}...`)
  }

  function home(who: 'founder' | 'james') {
    subject = null
    hud.card(null)
    const pb = colonies.get(1)
    if (who === 'james' && jamesAway && pb) {
      lens.lift = 0.6
      if (plinth) { rung = 0; anchor.dir.copy(POLE); anchor.world = pb.world }
      lens.flyTo(pb.world, POLE, 30, () => hud.log('James, Proxima b. Mending the elbow. He will not.'))
      return
    }
    const seat = leaderSeat(who)
    const p = garage.seatPoint(seat)!
    lens.lift = 0.6
    const dir = p.clone().add(hq.position).normalize()
    if (plinth) { rung = 0; anchor.dir.copy(dir); anchor.world = earth }
    lens.flyTo(earth, dir, 24, () => { garage.hop(seat); showGarageSeat(seat) })
  }

  // ---- the launch (the cinematic can wait: this is its camera path) -----------
  let rocket: { g: T.Group; t: number; from: T.Vector3; to: T.Vector3; trail: T.Line } | null = null
  /** While the cabinet crosses, the camera is the rocket's, not the lens's. */
  let chase = false
  function launch() {
    if (launched) return
    launched = true
    hud.showLaunch(false)
    hud.log('PLANET SATURATED. 100,000,000 DESKS PLACED. 0 REMAINING.')
    setTimeout(() => hud.log('DESK MOVE REQUEST #100,000,001 -- APPROVED. BY THE FORM.'), 1400)
    setTimeout(() => hud.log('STAND CLEAR OF THE FILING CABINET.'), 2800)
    lens.lift = 0.6
    lens.flyTo(earth, new T.Vector3(-3, R, 9).normalize(), 40, () => {
      const g = filingCabinet()
      const from = hq.localToWorld(new T.Vector3(-3, 0, 9))
      g.position.copy(from)
      scene.add(g)
      const trailGeo = new T.BufferGeometry().setFromPoints([from.clone(), from.clone()])
      const trail = new T.Line(trailGeo, new T.LineBasicMaterial({ color: new T.Color(HEX.warn[2]).multiplyScalar(2), transparent: true, opacity: 0.8 }))
      trail.frustumCulled = false
      scene.add(trail)
      rocket = { g, t: 0, from, to: PROXIMA_B.clone().add(new T.Vector3(0, R + 1, 0)), trail }
      jamesAway = true
    })
  }
  function updateRocket(dt: number) {
    if (!rocket) return
    rocket.t += dt
    const t = rocket.t
    const up = new T.Vector3(0, 1, 0)
    const flame = rocket.g.getObjectByName('flame')
    if (flame) flame.scale.setScalar(0.8 + Math.random() * 0.5)
    if (t < 3) {
      // The rocket does not move; the planet does (§21.8) — here, the lens pulls away.
      const h = t < 1 ? 0 : Math.pow(t - 1, 3) * 60
      rocket.g.position.copy(rocket.from).addScaledVector(up, h)
      rocket.g.scale.setScalar(1 + h / 30)
      lens.dist = 40 + h * 1.6
      return
    }
    if (t < 3.05 && !colonies.has(1)) foundProxima()
    const u = clamp((t - 3) / 6, 0, 1)
    const s = u * u * (3 - 2 * u)
    const start = rocket.from.clone().addScaledVector(up, 480)
    rocket.g.position.copy(start).lerp(rocket.to, s)
    const pos = rocket.trail.geometry.getAttribute('position') as T.BufferAttribute
    pos.setXYZ(1, rocket.g.position.x, rocket.g.position.y, rocket.g.position.z)
    pos.needsUpdate = true
    // The crossing, as one camera move: behind the cabinet while Earth drops
    // away, out to the side where Earth, the trail and Proxima are one frame,
    // then in over Proxima b. A quadratic path, looking at the cabinet throughout.
    chase = true
    const dir = rocket.to.clone().sub(start).normalize()
    const side = new T.Vector3().crossVectors(dir, up).normalize()
    const span = rocket.to.distanceTo(start)
    const p0 = start.clone().addScaledVector(dir, -600).addScaledVector(up, 260)
    const p1 = start.clone().lerp(rocket.to, 0.5).addScaledVector(side, span * 1.9).addScaledVector(up, span * 0.35)
    const p2 = rocket.to.clone().addScaledVector(dir, -900).addScaledVector(up, 700)
    const b = (1 - s) * (1 - s), c = 2 * s * (1 - s), d = s * s
    camera.position.set(0, 0, 0).addScaledVector(p0, b).addScaledVector(p1, c).addScaledVector(p2, d)
    // Drawn about twelve pixels high wherever the camera is; the joke is not its size.
    rocket.g.scale.setScalar(Math.max(1, camera.position.distanceTo(rocket.g.position) * 0.0035))
    camera.up.copy(up)
    camera.lookAt(rocket.g.position.clone().lerp(start.clone().lerp(rocket.to, 0.5), Math.sin(s * Math.PI) * 0.7))
    camera.near = Math.max(0.5, camera.position.distanceTo(rocket.g.position) * 0.004)
    camera.far = 5e6
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    if (u >= 1) {
      scene.remove(rocket.g)
      scene.remove(rocket.trail)
      rocket = null
      chase = false
      // The desk move was desk 100,000,001: Proxima is a colony now, on the map too.
      setHeadcount(Math.max(N, EARTH_SEATS + 1), false)
      hud.log('INCOMING -- SENT 4.2 YEARS AGO -- "Morning. Anything blocking?"')
      // Hand the camera back to the lens where the chase left it, on Proxima b's orbit.
      const pw = colonies.get(1)!.world
      const rel = camera.position.clone().sub(pw.centre)
      lens.world = pw
      lens.f.copy(rel.clone().normalize())
      lens.h.set(1, 0, 0).addScaledVector(lens.f, -lens.f.x).normalize()
      lens.dist = Math.max(40, rel.length() - pw.radius)
      home('james')
    }
  }
  /** Proxima b, with James on it: the launch's landing, or a preset's quiet one. */
  function foundProxima() {
    const S = colonyFor(1)
    // James at Proxima b's pole: one (1) developer, one (1) chair, one (1) shirt,
    // white, holed (§21.8). The game's own model of him, the whole figure.
    const station = new T.Group()
    station.position.copy(S.world.centre).add(new T.Vector3(0, R - GROUND_DROP + 0.1, 0))
    chair(station, 0, 0, Math.PI)
    studioPerson(station, 0, 0, Math.PI, JAMES.look, 'james', false, true)
    const lamp = new T.PointLight(HEX.lamp, 30, 12, 2)
    lamp.position.set(0, 3, 0)
    station.add(lamp)
    scene.add(station)
  }
  /** Past a hundred million by a preset or a link: James has gone already, without the film. */
  function launchQuietly() {
    if (launched) return
    launched = true
    jamesAway = true
    hud.showLaunch(false)
    foundProxima()
  }

  /**
   * World `w`'s towers, built the first time anybody looks at it: a zoom down
   * into its system, its card's ZOOM IN, FIND ANYONE landing there. A world is
   * the same pure function of its seed as Earth (grid.ts), so building it late
   * loses nothing. Proxima b stays; any other colony is let go when the next is
   * visited, so the demo never holds more than three planets.
   */
  function colonyFor(w: number): TowerSet {
    const have = colonies.get(w)
    if (have) return have
    if (w >= 2) for (const v of [...colonies.keys()]) if (v >= 2) dropColony(v)
    const centre = worldCentre(w)
    const world: World = { centre, radius: R }
    const t = buildTowers(SEED + w, 0)
    const g = createGround(R, 192, w === 1 ? HEX.alarm[1] : [HEX.calm[1], HEX.warn[1], HEX.glow1][w % 3])
    grounds.push(g)
    shareLoss(g)
    g.mesh.position.copy(centre)
    g.atmosphere.position.copy(centre)
    scene.add(g.mesh, g.atmosphere)
    const mesh = createTowers({ ...t, kind: undefined }, tu)
    mesh.mesh.position.copy(centre)
    scene.add(mesh.mesh)
    const holder = new T.Group()
    holder.position.copy(centre)
    holder.name = `world-${w}`
    scene.add(holder)
    holder.updateMatrixWorld(true)
    const S: TowerSet = {
      name: `w${w}`, label: worldName(w), world, mesh, count: t.count, w: t.w, d: t.d, floors: t.floors, per: t.perFloor, seed: t.seed,
      seatBase: t.seatBase, capacity: t.capacity, offset: w * WORLD_SEATS, parent: holder, base: baseMatrices(t), applied: 0,
      anim: new Map(), cut: new Map(), blocks: { of: t.block, occ: new Float64Array(t.blocks), cap: t.blockCapacity, ground: g },
      blockOf: blockIndex(t),
    }
    sets.push(S)
    colonies.set(w, S)
    if (plinth) for (const mat of [mesh.mesh.material, g.mesh.material] as T.ShaderMaterial[]) plinth.patch(mat)
    applySet(S, worldFill(w), false, () => false)
    return S
  }
  function dropColony(w: number) {
    const S = colonies.get(w)
    if (!S || !S.blocks) return
    colonies.delete(w)
    sets.splice(sets.indexOf(S), 1)
    const g = S.blocks.ground
    grounds.splice(grounds.indexOf(g), 1)
    scene.remove(g.mesh, g.atmosphere, S.mesh.mesh, S.parent)
    for (const o of [g.mesh, g.atmosphere]) { o.geometry.dispose(); (o.material as T.Material).dispose() }
    g.blocks.dispose()
    // The towers' box is one geometry shared by every set: only this set's own
    // attributes may go, or Earth's buildings lose their vertices with it.
    const geo = S.mesh.mesh.geometry
    geo.index = null
    for (const a of ['position', 'normal', 'aSeg']) geo.deleteAttribute(a)
    geo.dispose()
    S.mesh.mesh.dispose()
    ;(S.mesh.mesh.material as T.Material).dispose()
    if (subject?.S === S) subject = null
    if (cardSeat?.S === S || cardTower?.S === S) { cardSeat = null; cardTower = null; hud.card(null) }
  }

  // Down from the map: whichever settled world is under the view, built if it
  // has to be. Empty space stops the zoom at the map, with a word as to why.
  let emptyAt = -10
  lens.descend = (p) => {
    let best = -1, bd2 = (2.6 * LY) ** 2
    for (let w = 0; w < worlds; w++) {
      const c = worldCentre(w)
      const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2
      if (d < bd2) { bd2 = d; best = w }
    }
    if (best < 0) {
      if (time.t - emptyAt > 2) { emptyAt = time.t; hud.log('EMPTY SPACE. NOBODY WORKS HERE YET. ZOOM IN ON A LIT SYSTEM.') }
      return null
    }
    if (best === 0) return earth
    const S = colonyFor(best)
    hud.log(`${S.label}: ${worldFill(best).toLocaleString('en-US')} DEVELOPERS.`)
    return S.world
  }
  const onMap = () => lens.dist >= MAP * 0.95 && !chase
  /** Where a world's story starts: HQ on Earth, the first tower anywhere else. */
  const anchorDir = (S: TowerSet) => (S === earthSet ? garageFocus.clone() : towerPos(S, 0).sub(S.world.centre).normalize())

  /** The address bar: fly to one stop of the zoom, on the world under the lens. */
  function goTo(level: string) {
    subject = null
    hud.card(null)
    const S = here() ?? earthSet
    const dir = lens.dist < MAP * 0.95 ? lens.f.clone() : anchorDir(S)
    lens.lift = 0.6
    if (level === 'network') lens.flyTo(S.world, POLE, networkDist())
    else if (level === 'world') lens.flyTo(S.world, dir, 17000)
    else if (level === 'city') lens.flyTo(S.world, dir, 1600)
    else if (level === 'block') lens.flyTo(S.world, dir, 150)
    else if (S === earthSet) home('founder')
    else if (S === colonies.get(1)) home('james')
    else findSeat(S.offset)
  }
  function visit(w: number) {
    const S = w === 0 ? earthSet : colonyFor(w)
    hud.card(null)
    subject = null
    lens.lift = 0.6
    lens.flyTo(S.world, anchorDir(S), 17000)
    hud.log(`${S.label} // ${worldFill(w).toLocaleString('en-US')} DEVELOPERS`)
  }
  const pct = (f: number) => {
    const p = f * 100
    return `${p < 0.01 ? p.toFixed(4) : p < 1 ? p.toFixed(2) : p.toFixed(1)}%`
  }
  /**
   * A system's card. There is nothing to manage on it — no freight, no
   * buildings, no governor (§7.7.1a: "not a colony manager"). A world fills
   * because the studio hires; the card only says what is there and lets you go
   * and look.
   */
  function systemCard(s: number) {
    cardSeat = null
    cardTower = null
    const sys = net.systems[s]
    const w = net.worldOf[s]
    const st = netView.standing(s)
    const lines: string[] = [s === 0 ? 'THE ORIGIN. HQ IS HERE.' : `${sys.ly.toFixed(2)} LY FROM SOL${sys.real ? '' : ' // CATALOGUE STAR'}`]
    const actions: CardInfo['actions'] = []
    if (st === 'home' || st === 'colony') {
      const here = worldFill(w)
      lines.push(`${worldName(w)} // ${here.toLocaleString('en-US')} DEVELOPERS`, `${pct(here / WORLD_SEATS)} FULL // WORKING RIGHT NOW ${(bd.work * 100).toFixed(bd.work < 0.01 ? 2 : 1)}%`)
      if (w > 0) lines.push(`ITS STANDUP REACHES HQ ${sys.ly.toFixed(1)} YEARS LATE`)
      if (w === 1 && jamesAway) lines.push('JAMES IS HERE. MENDING THE ELBOW.')
      if (here > 0) lines.push(`NEWEST: ${developerAt(SEED, w * WORLD_SEATS + here - 1).name.toUpperCase()}`)
      actions.push({ id: `visit:${w}`, label: 'ZOOM IN' })
    } else if (st === 'frontier') {
      lines.push(!launched ? 'NEXT. EARTH FILLS FIRST: 100,000,000 DESKS, THEN A FILING CABINET.' : `NEXT. OPENS AT DEVELOPER #${(w * WORLD_SEATS + 1).toLocaleString('en-US')}`)
      if (launched) lines.push(`${Math.max(1, w * WORLD_SEATS + 1 - N).toLocaleString('en-US')} HIRES AWAY`)
    } else if (st === 'surveyed') {
      lines.push('SURVEYED. NOBODY THERE YET.')
      if (w >= 0) lines.push(`WORLD ${(w + 1).toLocaleString('en-US')} IN LINE, AT THIS RATE OF HIRING`)
    } else {
      lines.push('PAST THE FRONTIER. NOBODY HAS LOOKED.')
    }
    actions.push({ id: 'close', label: 'CLOSE' })
    hud.card({ kicker: st.toUpperCase(), title: sys.name.toUpperCase(), lines, actions })
  }

  // ---- input --------------------------------------------------------------
  bindInput(stage.renderer.domElement, {
    zoom(factor, x, y) {
      if (plinth) {
        const r = RUNGS[rung]
        const next = lens.dist * factor
        if (factor > 1 && next > r.max && rung < RUNGS.length - 1 && !lens.flying) { goRung(rung + 1); return }
        if (factor < 1 && next < r.min && rung > 0 && !lens.flying) {
          // Down from the map, the rung below is whichever world the lens came down on.
          const S = here()
          if (S) anchor.world = S.world
          const g = lens.ground(camera, stage.content(x, y))
          goRung(rung - 1, g ? g.sub(anchor.world.centre).normalize() : undefined)
          return
        }
        lens.min = r.min; lens.max = r.max
      }
      lens.zoomAt(factor, camera, stage.content(x, y))
      if (lens.dist > 200) lens.lift += (0.6 - lens.lift) * 0.5
    },
    pan(dx, dy) { if (!plinth || rung >= 4) lens.pan(dx, dy, camera, stage.height); else lens.pan(dx * 0.4, dy * 0.4, camera, stage.height) },
    turn(a) { lens.turn(a) },
    tap,
    key(k) {
      if (k === '+' || k === '=') lens.zoomAt(0.8, camera, null)
      else if (k === '-') lens.zoomAt(1.25, camera, null)
      else if (k === 'q') lens.turn(0.1)
      else if (k === 'e') lens.turn(-0.1)
      else if (k === 'h') home('founder')
      else if (k === 'f') action('find')
      else if (k === 'l') action('loss')
      else if (k === ' ') action('auto')
    },
  })

  function action(a: string) {
    if (a === 'hire1') setHeadcount(N + 1, true)
    else if (a === 'hire10') setHeadcount(N + 10, true)
    else if (a === 'x2') setHeadcount(N * 2, true)
    else if (a === 'auto') { auto = (auto + 1) % AUTO.length; hud.setAuto(AUTO_LABEL[auto]) }
    else if (a.startsWith('preset:')) {
      auto = 0
      hud.setAuto(AUTO_LABEL[0])
      const n = Number(a.slice(7))
      if (n > EARTH_SEATS && !launched) { launchQuietly(); hud.log('JAMES WENT FIRST. EVERYBODY ELSE FOLLOWED THE LANES.') }
      setHeadcount(n, false)
      fitView()
    }
    else if (a === 'home') home('founder')
    else if (a === 'james') home('james')
    else if (a === 'find') findSeat(Math.floor(Math.random() * N))
    else if (a === 'loss') { lossTarget = lossTarget > 0.5 ? 0 : 1; hud.log(lossTarget ? 'LOSS VIEW: every light is what that person is doing.' : 'LOSS VIEW OFF.') }
    else if (a === 'back') {
      // A published page lives at a tokenised path, so "up one" is history, not a URL.
      if (history.length > 1) history.back()
      else location.href = './'
    }
    else if (a === 'launch') launch()
    else if (a === 'colonise') {
      // The scene asked for: the planet in frame, and the studio spreading over
      // it at a pace you can watch (about 1.4x a second, 1M to full in ~13 s).
      if (N < 1e6) setHeadcount(1e6, false)
      subject = null
      hud.card(null)
      lens.lift = 0.6
      if (plinth) { rung = 4; anchor.dir.copy(garageFocus); anchor.world = earth }
      lens.flyTo(earth, garageFocus.clone().add(new T.Vector3(0.25, 0, 0.35)).normalize(), 15000, () => {
        auto = 1
        hud.setAuto(AUTO_LABEL[1])
      })
      hud.log('COLONISE: the studio, spreading from the garage to the whole planet.')
    }
    else if (a === 'close') { hud.card(null); cardSeat = null; cardTower = null; subject = null }
    else if (a === 'poke') {
      if (cardSeat?.garageSeat !== undefined) garage.hop(cardSeat.garageSeat)
      else if (cardSeat?.S) { subject = { S: cardSeat.S, k: cardSeat.k, floor: Math.floor(cardSeat.local / cardSeat.S.per[cardSeat.k]), local: cardSeat.local }; interiorKey = '' }
    } else if (a === 'inside' && cardTower) {
      const { S, k } = cardTower
      const occ = Math.floor(S.mesh.target[k])
      findSeat(S.offset + S.seatBase[k] + Math.floor(rnd(Math.floor(time.t * 1000), 3) * occ))
    } else if (a.startsWith('mode:')) {
      // Same headcount, another option: a hash and a reload, which a published page allows.
      location.hash = `${a.slice(5)}-${N}`
      location.reload()
    } else if (a.startsWith('rung:')) {
      const idx = RUNGS.findIndex((r) => r.id === a.slice(5))
      if (idx >= 0) goRung(idx)
    } else if (a.startsWith('goto:')) goTo(a.slice(5))
    else if (a.startsWith('visit:')) visit(Number(a.slice(6)))
  }
  hud.on(action)

  /** A preset headcount frames the studio it made, the way a scenario parks the lens. */
  function fitView() {
    const d = startDist()
    lens.lift = 0.6
    subject = null
    lens.flyTo(earth, N > EARTH_SEATS ? POLE : garageFocus, d)
    if (plinth) {
      const idx = RUNGS.findIndex((r) => d <= r.max)
      rung = idx < 0 ? RUNGS.length - 1 : idx
      anchor.dir.copy(garageFocus); anchor.world = earth
    }
  }
  /** Where a headcount is best seen from: the street, the city, the planet, the map. */
  function startDist(): number {
    if (N > EARTH_SEATS) return networkDist()
    return N <= 20 ? 46 : N <= 400 ? 150 : N <= 4000 ? 360 : N <= 1e5 ? 1600 : N <= 2e6 ? 5200 : 17000
  }
  /** Far enough out to hold every settled world and the next, centred on Sol. */
  function networkDist(): number {
    let r = 6
    for (let w = 0; w <= Math.min(worlds, net.order.length - 1); w++) r = Math.max(r, net.systems[net.order[w]].ly + REACH)
    return clamp((2.3 * r * LY) / (2 * Math.tan((camera.fov * Math.PI) / 360)) - R, MAP * 1.5, lens.max)
  }

  // A handle for driving the demo from a console while it is being built; the
  // game's own debug seams are loopback-only, and so is this.
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    Object.assign(window, { __g2g: { lens, camera, scene, ground, space, stage, tu, setHeadcount, action, get N() { return N }, sets, fx, garage, net, netView, colonies, systemCard, findSeat } })
  }

  // ---- first frame ------------------------------------------------------------
  const start = startOptions().n
  if (start > EARTH_SEATS) launchQuietly()
  setHeadcount(start, false)
  if (N > EARTH_SEATS) lens.f.copy(POLE)
  if (N > 1) {
    const d = startDist()
    lens.dist = d
    if (plinth) { const idx = RUNGS.findIndex((r) => d <= r.max); rung = idx < 0 ? RUNGS.length - 1 : idx }
  }
  hud.log('STUDIO_OS v0.0.1 initialised. One founder, one garage.')
  hud.log('HIRE, or AUTO, and watch the street. SCROLL OUT when it gets big.')
  if (plinth) hud.lift(RUNGS.map((r, i) => ({ id: r.id, label: r.label, active: i === rung, open: true })))

  let hudAt = 0
  let carry = 0
  stage.loop((dt) => {
    time.t += dt
    if (auto > 0 && !rocket) {
      // Growth is geometric: the same number of seconds takes you from 20 to 200
      // as from 2M to 20M, so every scale gets its turn on screen.
      carry += N * (Math.pow(1 + AUTO[auto] * 0.35, dt) - 1) + dt * AUTO[auto] * 2
      if (carry >= 1) {
        const add = Math.floor(carry)
        carry -= add
        const before = N
        setHeadcount(N + add, true)
        rainFor(before, N)
      }
    }
    loss += (lossTarget - loss) * Math.min(1, dt * 3)
    tu.uLoss.value = loss
    lens.update(dt)
    if (plinth) {
      const r = RUNGS[rung]
      if (!lens.flying) { lens.min = r.min; lens.max = r.max; lens.dist = clamp(lens.dist, r.min, r.max) }
      plinth.set(anchor.world.centre.clone().addScaledVector(anchor.dir, anchor.world.radius - GROUND_DROP), anchor.dir, r.radius, dt)
      // Below the planet rung there is no planet: the diorama stands in the dark.
      ground.atmosphere.visible = rung >= 4
    }
    if (!chase) lens.pose(camera)
    if (shake > 0) {
      camera.position.add(new T.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake).multiplyScalar(lens.dist * 0.01))
      shake *= Math.exp(-dt * 9)
      if (shake < 0.01) shake = 0
    }
    camera.updateMatrixWorld()
    updateRocket(dt)

    // Uniforms that follow the camera.
    tu.uTime.value = time.t
    tu.uCam.value.copy(camera.position)
    tu.uCamRight.value.setFromMatrixColumn(camera.matrixWorld, 0)
    tu.uPxScale.value = stage.height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    // During the crossing the camera is the rocket's, hundreds of km out: no haze.
    const fogScale = chase ? 1e7 : lens.dist * (1 + lens.far * 60)
    tu.uFogNear.value = fogScale * 3 + 60
    tu.uFogFar.value = fogScale * 11 + 500
    for (const g of grounds) {
      g.uniforms.uCam.value.copy(camera.position)
      g.uniforms.uTime.value = time.t
      g.uniforms.uFogNear.value = tu.uFogNear.value
      g.uniforms.uFogFar.value = tu.uFogFar.value
    }
    scene.fog = new T.Fog(HEX.n1, tu.uFogNear.value, tu.uFogFar.value)
    // Calm in the garage, amber by a few thousand, red only as the planet fills.
    const e = clamp((Math.log10(Math.max(1, N)) - 1) / 7.6, 0, 1)
    const [p0, p1, p2, p3] = phosphorRamp(e)
    tu.uP0.value.copy(p0); tu.uP1.value.copy(p1); tu.uP2.value.copy(p2); tu.uP3.value.copy(p3)
    for (const gr of grounds) { gr.uniforms.uP0.value.copy(p0); gr.uniforms.uP1.value.copy(p1); gr.uniforms.uP2.value.copy(p2) }
    space.uniforms.uP1.value.copy(p1); space.uniforms.uP2.value.copy(p2); space.uniforms.uP3.value.copy(p3)
    // The map comes in once the lens is looking straight down, and is all there
    // by the time the neighbours are in frame. The sky's stars go as it comes,
    // so a dot on the map is always a system and never a background star.
    const fade = chase ? 0 : smooth(MAP * 0.95, MAP * 3, lens.dist)
    const nu = netView.uniforms
    nu.uFade.value = fade
    nu.uP0.value.copy(p0); nu.uP1.value.copy(p1); nu.uP2.value.copy(p2); nu.uP3.value.copy(p3)
    nu.uPx.value = glyphPx()
    nu.uRes.value.set(renderer.domElement.width, renderer.domElement.height)
    netView.group.visible = fade > 0.001
    // A pixel and a half of the monitor's, so it draws as one or two; outside
    // the monitor, two screen pixels.
    netView.update({ n: N, settled: worlds, dt, arrivals, border: (mode === 'monitor' ? 1.5 * PIXEL : 2) * mpp() })
    arrivals = 0
    space.uniforms.uDim.value = 1 - fade
    space.proxima.visible = fade < 0.5

    garage.root.visible = lens.dist < 900 && lens.world === earth
    xray()
    garage.update(dt)
    updateDrops(dt)
    updateOpen(dt)
    for (const S of sets) S.mesh.flush()
    fx.update(dt, 0, p2, p3)
    if (swarm) swarm.update(sets.map((S) => ({ S, occ: S.mesh.target })), Math.min(N, EARTH_SEATS), bd, tu.uCdfA.value, tu.uCdfB.value, dt, time.t, camera)

    // The alternative layer, by option.
    if (mode === 'monitor') {
      // Past the block the picture becomes the monitor, in one quick refresh;
      // the two thresholds keep a zoom that hovers at the line from flickering.
      if (lens.dist > 430) monitorGoal = 1
      else if (lens.dist < 330) monitorGoal = 0
      monitorT += Math.sign(monitorGoal - monitorT) * Math.min(Math.abs(monitorGoal - monitorT), dt * 1.9)
      renderAlt(monitorT)
      stage.worldVisible(monitorT < 0.999)
      hud.monitor(monitorT, monitorInfo())
    } else if (mode === 'swarm') {
      if (lens.dist > 330) swarmGoal = 1
      else if (lens.dist < 250) swarmGoal = 0
      swarmT += Math.sign(swarmGoal - swarmT) * Math.min(Math.abs(swarmGoal - swarmT), dt * 1.6)
      renderAlt(swarmT)
      stage.worldVisible(swarmT < 0.999)
    }

    if (time.t - hudAt > 0.1) { hudAt = time.t; updateHud() }
    labels.update()
  })

  /**
   * Names on the map: home, the colonies, the next world, and the real stars
   * round the frontier once there is room to read them. From orbit, below the
   * map, the world under the lens is named at its pole instead.
   */
  const labels = (() => {
    const layer = document.createElement('div')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;'
    // Under the HUD: a card or a panel covers the names, never the other way round.
    document.body.insertBefore(layer, hud.root)
    const mk = () => {
      const el = document.createElement('div')
      el.style.cssText = 'position:absolute;font-size:11px;letter-spacing:1px;white-space:nowrap;text-shadow:0 0 4px var(--p0), 0 0 1px var(--n0);'
      layer.appendChild(el)
      return el
    }
    const pool = new Map<number, HTMLDivElement>()
    const worldEl = mk()
    const v = new T.Vector3()
    const place = (el: HTMLDivElement, p: T.Vector3, text: string, colour: string, dx: number) => {
      v.copy(p).project(camera)
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { el.style.display = 'none'; return }
      const s = stage.screen(v.x, v.y)
      el.style.display = 'block'
      el.style.left = `${s.x}px`
      el.style.top = `${s.y}px`
      el.style.transform = `translate(${dx}px, -50%)`
      el.style.color = colour
      if (el.textContent !== text) el.textContent = text
    }
    // Label widths, measured once per text in the HUD's own face.
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = '11px "Departure Mono"'
    const widths = new Map<string, number>()
    const widthOf = (t: string) => {
      let w = widths.get(t)
      if (w === undefined) { w = ctx.measureText(t).width + t.length; widths.set(t, w) }
      return w
    }
    const cands: { s: number; text: string; colour: string; dx: number; pri: number }[] = []
    const boxes: number[][] = []
    return {
      update() {
        const fade = netView.uniforms.uFade.value
        const viewLy = (2 * (lens.dist + lens.world.radius * lens.far) * Math.tan((camera.fov * Math.PI) / 360)) / LY
        const seen = new Set<number>()
        cands.length = 0
        boxes.length = 0
        if (fade > 0.35) {
          const filling = worlds - 1
          for (let s = 0; s < net.systems.length; s++) {
            const st = netView.standing(s)
            const w = net.worldOf[s]
            const sys = net.systems[s]
            let text = sys.name.toUpperCase()
            let colour = 'var(--p3)'
            let dx = 14
            let pri = 3 + w
            if (st === 'home') { text = 'SOL // EARTH // HQ'; dx = 18; pri = 0 }
            else if (st === 'colony') {
              // Past thirty light-years across, only the first few and the one filling.
              if (w > 8 && w !== filling && viewLy > 32) continue
              if (w === 1 && jamesAway) text = 'PROXIMA // JAMES'
              if (w === filling) { text += ` // ${pct(worldFill(w) / WORLD_SEATS)}`; pri = 1 }
            } else if (st === 'frontier') { text = `NEXT: ${text}`; pri = 2 }
            else if (sys.real && viewLy < (st === 'surveyed' ? 36 : 16)) { colour = 'var(--p1)'; dx = st === 'surveyed' ? 8 : 6; pri = 1000 + sys.ly }
            else continue
            cands.push({ s, text, colour, dx, pri })
          }
          // Most important first; a label that would land on one already placed
          // tries the glyph's other side, and is left out if that is taken too.
          cands.sort((a, b) => a.pri - b.pri)
          for (const c of cands) {
            v.copy(netView.position(c.s)).project(camera)
            if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue
            const p = stage.screen(v.x, v.y)
            const w = widthOf(c.text), h = 13, y0 = p.y - h / 2
            const free = (x: number) => !boxes.some(([bx, by, bw, bh]) => x < bx + bw && x + w > bx && y0 < by + bh && y0 + h > by)
            let x0 = p.x + c.dx
            if (!free(x0)) { x0 = p.x - c.dx - w; if (!free(x0)) continue }
            boxes.push([x0, y0, w, h])
            let el = pool.get(c.s)
            if (!el) { el = mk(); pool.set(c.s, el) }
            el.style.display = 'block'
            el.style.left = `${x0}px`
            el.style.top = `${y0}px`
            el.style.transform = 'none'
            el.style.color = c.colour
            if (el.textContent !== c.text) el.textContent = c.text
            el.style.opacity = String(Math.min(1, (fade - 0.35) / 0.3))
            seen.add(c.s)
          }
        }
        for (const [s, el] of pool) if (!seen.has(s)) el.style.display = 'none'
        const S = here()
        if (S && !chase && lens.dist > 25000 && fade <= 0.35) {
          const name = S === earthSet ? 'EARTH // HQ // THE GARAGE' : S === colonies.get(1) && jamesAway ? 'PROXIMA B // JAMES' : S.label
          place(worldEl, S.world.centre.clone().add(new T.Vector3(0, R, 0)), name, 'var(--p3)', 10)
        } else worldEl.style.display = 'none'
      },
    }
  })()

  function rainFor(before: number, after: number) {
    if (lens.dist < 250 || lens.dist >= MAP) return
    // Only the hires landing on the world in view: past a hundred million,
    // Earth is full and the rain is somewhere else.
    const hereS = here()
    if (!hereS) return
    const w0 = Math.round(hereS.offset / WORLD_SEATS)
    const drops = Math.min(24, Math.ceil(Math.log2(1 + (after - before)) * 2))
    for (let i = 0; i < drops; i++) {
      const s = before + Math.floor(Math.random() * (after - before))
      if (Math.floor(s / WORLD_SEATS) !== w0) continue
      const S = w0 > 0 ? hereS : s < earthSet.seatBase[0] ? lots : earthSet
      const k = towerIndexOf(S, s - S.offset)
      if (k < 0) continue
      const p = towerPos(S, k)
      const up = p.clone().sub(S.world.centre).normalize()
      const top = Math.ceil((S.mesh.target[k]) / S.per[k]) * FLOOR_H
      fx.rain(p.addScaledVector(up, top), up, clamp(lens.dist * 0.6, 60, 4000))
    }
  }

  /** Which stop of the zoom the lens is at, by distance. */
  function level(): 'network' | 'world' | 'city' | 'block' | 'desk' {
    const d = lens.dist
    return d >= MAP * 0.95 ? 'network' : d >= 2600 ? 'world' : d >= 430 ? 'city' : d >= 60 ? 'block' : 'desk'
  }
  /**
   * The monitor's title bar is an address: NETWORK > EARTH > CITY > HQ >
   * GARAGE, the current stop lit, every stop a place to jump to. It is §7.4a's
   * lens (discrete, addressable stops) as the one line a terminal would give it.
   */
  function monitorInfo() {
    const S = here() ?? earthSet
    const lv = level()
    const onEarth = S === earthSet
    const ids = ['network', 'world', 'city', 'block', 'desk'] as const
    const names = ['NETWORK', S.label, 'CITY', onEarth ? 'HQ' : 'BLOCK', onEarth ? 'GARAGE' : S === colonies.get(1) ? 'JAMES' : 'FIRST DESK']
    const w = Math.round(S.offset / WORLD_SEATS)
    const right = lv === 'network'
      ? `${worlds} WORLD${worlds > 1 ? 'S' : ''} // ${short(N)} DEVELOPERS`
      : `${pct(worldFill(w) / WORLD_SEATS)} FULL // ${short(worldFill(w))} DEVELOPERS`
    return { crumbs: ids.map((id, i) => ({ id, label: names[i], active: id === lv })), right }
  }
  /** A scale bar at most 120 pixels long, in light-years on the map and metres below it. */
  function scaleBar(map: boolean): { px: number; label: string } {
    const per = mpp() / (map ? LY : 1)
    const target = 120 * per
    const pow = 10 ** Math.floor(Math.log10(target))
    const nice = [5, 2, 1].map((k) => k * pow).find((v) => v <= target) ?? pow
    const px = Math.max(PIXEL, Math.round(nice / per / PIXEL) * PIXEL)
    return { px, label: map ? `${nice >= 1 ? nice : nice.toFixed(1)} LY` : metres(nice) }
  }
  const legendRow = (m: { mask: string; w: number; h: number }, tone: LegendRow['tone'], label: string): LegendRow => ({ ...m, tone, label })
  const glyphRow = (kind: number, tone: LegendRow['tone'], label: string): LegendRow => {
    const size = [1, 3, 7, 7, 9][kind] * 2
    return { mask: glyphMask(kind), w: size, h: size, tone, label }
  }
  const LEGEND: LegendRow[] = [
    glyphRow(4, 'p3', 'HOME: EARTH, HQ'),
    glyphRow(3, 'p3', 'COLONY: 100M DESKS'),
    glyphRow(2, 'p3', 'FRONTIER: NEXT WORLD'),
    glyphRow(1, 'p2', 'SURVEYED'),
    glyphRow(0, 'p1', 'UNCHARTED'),
    legendRow(markMask('territory'), 'p2', 'TERRITORY'),
    legendRow(markMask('lane'), 'p2', 'LANE'),
    legendRow(markMask('transit'), 'p3', 'DEVELOPERS EN ROUTE'),
  ]

  function updateHud() {
    hud.setDevs(N)
    hud.entropy(clamp((Math.log10(Math.max(1, N)) - 1) / 7.6, 0, 1))
    const map = onMap()
    const view = 2 * (lens.dist + lens.world.radius * lens.far) * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
    const ly = view / LY
    hud.setStats([
      ['WORKING', `${(bd.work * 100).toFixed(bd.work < 0.01 ? 2 : 1)}%`],
      ['DOING THE WORK OF', N * bd.work < 10 ? (N * bd.work).toFixed(1) : short(N * bd.work)],
      launched ? ['WORLDS', `${worlds} OF ${MAX_WORLDS}`] : ['EARTH', `${pct(Math.min(N, EARTH_SEATS) / EARTH_SEATS)} FULL`],
      ['VIEW', map ? `${ly < 10 ? ly.toFixed(1) : Math.round(ly)} LY` : metres(view)],
    ])
    const lotsBuilt = LOTS.filter((_, k) => lots.mesh.occ[k] > 0).length
    const S = here()
    const where: string[] = []
    let scale = ''
    if (chase) {
      where.push('DEEP SPACE', 'JAMES, IN A FILING CABINET')
      scale = '4.24 LIGHT-YEARS // ONE DESK MOVE'
    } else if (map) {
      const next = net.systems[net.order[Math.min(worlds, net.order.length - 1)]]
      where.push('THE COLONY NETWORK', `${worlds} WORLD${worlds > 1 ? 'S' : ''} // NEXT: ${next.name.toUpperCase()}`)
      scale = '1 GLYPH = 1 WORLD = 100,000,000 DESKS'
    } else if (S === earthSet && (lens.dist < 120 || (N < lotInfo.end && lens.dist < 900))) {
      where.push('EARTH > HQ', N <= GARAGE_SEATS ? 'THE GARAGE' : `THE GARAGE + ${lotsBuilt} PLOT${lotsBuilt === 1 ? '' : 'S'}`)
      scale = N <= GARAGE_SEATS ? '1 DESK = 1 DEVELOPER' : '1 WINDOW = 1 DEVELOPER'
    } else if (S && lens.dist < 2500) {
      const towers = S.mesh.mesh.count
      where.push(`${S.label} > THE CITY`, `${towers.toLocaleString('en-US')} TOWER${towers === 1 ? '' : 'S'}${S === earthSet ? ' + HQ' : ''}`)
      scale = mode === 'swarm' && swarmT > 0.5 ? '1 DOT = ' + swarmScale() : '1 WINDOW = 1 DEVELOPER'
    } else if (S) {
      where.push(S.label, `${S.mesh.mesh.count.toLocaleString('en-US')} OF ${S.count.toLocaleString('en-US')} TOWERS`)
      scale = mode === 'swarm' ? '1 DOT = ' + swarmScale() : '1 LIT BLOCK = 9 TOWERS'
    } else {
      where.push('DEEP SPACE', 'BETWEEN WORLDS')
    }
    hud.setWhere(TITLES[mode], where, scale)
    const bar = scaleBar(map)
    hud.scaleBar(bar.px, bar.label)
    hud.legend(map ? LEGEND : null)
    hud.hint(map ? 'SCROLL / PINCH TO ZOOM \u00b7 DRAG TO PAN THE MAP \u00b7 TAP A SYSTEM' : 'SCROLL / PINCH TO ZOOM \u00b7 DRAG TO MOVE \u00b7 RIGHT-DRAG TO TURN \u00b7 TAP ANYONE')
    if (plinth) hud.lift(RUNGS.map((r, i) => ({ id: r.id, label: i === 0 && anchor.dir.distanceTo(garageFocus) > 0.01 ? '0  TOWER' : r.label, active: i === rung, open: true })))
  }
  const swarmScale = () => {
    const k = swarm ? swarm.stride : 1
    return k <= 1 ? '1 DEVELOPER' : `${short(k)} DEVELOPERS`
  }
}
