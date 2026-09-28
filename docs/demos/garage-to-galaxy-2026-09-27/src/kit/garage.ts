import * as T from 'three'
import {
  buildGarageEnvironment, showGarageSeats, placeInstances, defaultCast, garageSeats, GARAGE_LEADERS, leaderSeat,
  GARAGE_ASSEMBLED, type Environment, type SeatInstance, type StudioCast,
} from './repo.ts'
import { GARAGE_SEATS } from './lots.ts'

/**
 * **The real garage, at the origin of everything.** `buildGarageEnvironment` is
 * the game's own room, people and street, unmodified; this file only puts it at
 * HQ, drops its hires in the way `garageView.ts` does (desk, then developer,
 * one bounce, a puff), and takes the neighbours' houses away when a dropped
 * storey claims their plot.
 *
 * Its lights are lifted out of their desks and switched by intensity, never by
 * visibility — the lesson `garageView.ts` records: a change in the number of
 * lights recompiles every material (a 917 ms frame on each hire, measured).
 */
export interface Garage {
  root: T.Group
  env: Environment
  cast: StudioCast
  setHeadcount(n: number, animate: boolean): void
  clearLot(rect: readonly [number, number, number, number]): void
  /** Seat under the ray (-1 founder, -2 James) or null. */
  pick(ray: T.Raycaster): number | null
  /** Where a seat's head is, in the garage's own metres. */
  seatPoint(seat: number): T.Vector3 | null
  hop(seat: number): void
  update(dt: number): boolean
}

const DROP_FROM = 3.4

interface Anim { seat: number; kind: 'hop' | 'drop'; t: number; puffed?: boolean[] }

export function createGarage(renderer: T.WebGLRenderer): Garage {
  const cast: StudioCast = { ...defaultCast(), heroes: ['james'], studio: 'Merciless Software' }
  const env = buildGarageEnvironment(0, cast, 'on', false, GARAGE_ASSEMBLED)
  const root = new T.Group()
  root.add(env.root)
  // The garage's 512 m lawn was sized for a camera that never left it. The HQ
  // block is 100 m inside its streets; past that, the planet is the ground.
  env.root.traverse((o) => {
    if (o instanceof T.Mesh && !(o instanceof T.InstancedMesh) && o.scale.x >= 500) o.scale.set(100, o.scale.y, 100)
  })
  // Hit boxes are for rays, never for the picture.
  for (const t of env.targets) t.mesh.layers.set(1)

  const lights: { light: T.PointLight; owner: T.Object3D | null; intensity: number }[] = []
  const found: T.PointLight[] = []
  env.root.traverse((o) => { if (o instanceof T.PointLight) found.push(o) })
  for (const light of found) {
    const owner = light.parent
    env.root.attach(light)
    light.castShadow = false
    lights.push({ light, owner, intensity: light.intensity })
  }

  // The moon over the garage: the game's own dusk rig (garageView, OS skin).
  const moon = new T.DirectionalLight('#8a93c8', 0.7)
  moon.position.set(22, 28, 10)
  moon.target.position.set(0, 0, 0)
  moon.castShadow = true
  moon.shadow.mapSize.setScalar(2048)
  Object.assign(moon.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 })
  moon.shadow.normalBias = 0.025
  moon.shadow.bias = -0.0001
  root.add(moon, moon.target)
  const sky = new T.HemisphereLight('#55495e', '#14121a', 0.55)
  root.add(sky)
  const fill = new T.DirectionalLight('#35c9d9', 0.12)
  fill.position.set(-32, 15, -10)
  root.add(fill)

  const seats = garageSeats()
  let heads = 0
  const anims: Anim[] = []
  const rests = new Map<string, { position: T.Vector3; scale: T.Vector3 }>()
  const puffs: { mesh: T.Mesh; t: number; dir: T.Vector3 }[] = []
  const puffGeo = new T.IcosahedronGeometry(0.28, 0)
  let shadowsDirty = true

  interface Part { key: string; instances: SeatInstance[]; group: T.Object3D | null }
  const leaderId = (seat: number) => GARAGE_LEADERS.find((l) => l.seat === seat)?.id
  const body = (seat: number): Part[] => {
    const id = leaderId(seat)
    if (id) {
      const h = env.props?.get(`body:${id}`)
      return h ? [{ key: `body:${id}`, instances: h.instances, group: h.group }] : []
    }
    return [{ key: `body:${seat}`, instances: env.seatInstances?.get(seat) ?? [], group: env.people.find((p) => Number(p.userData.seat) === seat) ?? null }]
  }
  const prop = (key: string): Part[] => {
    const h = env.props?.get(key)
    return h ? [{ key, instances: h.instances, group: h.group }] : []
  }
  const floorAt = (seat: number) => {
    const t = env.targets.find((x) => x.index === seat)
    return t ? t.mesh.position.clone().setY(0) : null
  }
  function place(part: Part, base: T.Vector3, y: number, squash: number) {
    let r = rests.get(part.key)
    if (!r) {
      r = { position: part.group ? part.group.position.clone() : new T.Vector3(), scale: part.group ? part.group.scale.clone() : new T.Vector3(1, 1, 1) }
      rests.set(part.key, r)
    }
    const sxz = 1 / Math.sqrt(Math.max(0.2, squash))
    const delta = new T.Matrix4().makeTranslation(base.x, base.y + y, base.z)
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
      const a = (k / 8) * Math.PI * 2
      const mesh = new T.Mesh(puffGeo, new T.MeshStandardMaterial({ color: '#d8d2cf', roughness: 1, flatShading: true, transparent: true, opacity: 0.8 }))
      mesh.position.set(at.x + Math.cos(a) * 0.35, 0.15, at.z + Math.sin(a) * 0.35)
      env.root.add(mesh)
      puffs.push({ mesh, t: 0, dir: new T.Vector3(Math.cos(a), 0, Math.sin(a)) })
    }
  }

  const garage: Garage = {
    root, env, cast,
    setHeadcount(n, animate) {
      const next = Math.max(0, Math.min(GARAGE_SEATS, Math.floor(n)))
      if (next === heads) return
      const was = heads
      heads = next
      showGarageSeats(env, heads, was)
      if (animate && next > was) for (let s = was; s < next; s++) anims.push({ seat: s, kind: 'drop', t: -(s - was) * 0.12 })
      shadowsDirty = true
    },
    clearLot([x0, z0, x1, z1]) {
      const inside = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1
      const inv = env.root.matrixWorld.clone().invert()
      const p = new T.Vector3(), s = new T.Vector3(), q = new T.Quaternion(), m = new T.Matrix4()
      env.root.updateMatrixWorld(true)
      env.root.traverse((o) => {
        if (o instanceof T.InstancedMesh) {
          let changed = false
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m)
            m.decompose(p, q, s)
            // Roads and kerbs run the length of the street; they stay.
            if (Math.max(s.x, s.z) > 18) continue
            if (inside(p.x, p.z)) { o.setMatrixAt(i, m.makeScale(0, 0, 0)); changed = true }
          }
          if (changed) o.instanceMatrix.needsUpdate = true
        } else if (o instanceof T.Mesh && !o.layers.isEnabled(1) && o.visible) {
          o.getWorldPosition(p).applyMatrix4(inv)
          const size = o.geometry.boundingSphere?.radius ?? 1
          if (inside(p.x, p.z) && size * Math.max(o.scale.x, o.scale.z) < 18) o.visible = false
        }
      })
      shadowsDirty = true
    },
    pick(ray) {
      ray.layers.set(1)
      const hits = ray.intersectObjects(env.targets.map((t) => t.mesh), false)
      ray.layers.set(0)
      const hit = hits[0]
      if (!hit) return null
      const index = env.targets.find((t) => t.mesh === hit.object)?.index ?? null
      if (index === null) return null
      if (index >= 0 && index >= heads) return null
      return index
    },
    seatPoint(seat) {
      if (seat === leaderSeat('founder') || seat === leaderSeat('james')) {
        const t = env.targets.find((x) => x.index === seat)
        return t ? t.mesh.position.clone().setY(1.6) : null
      }
      const s = seats.find((x) => x.seat === seat)
      return s ? new T.Vector3(s.x, 1.3, s.z) : null
    },
    hop(seat) {
      if (!anims.some((a) => a.seat === seat && a.kind === 'drop')) {
        for (let i = anims.length - 1; i >= 0; i--) if (anims[i].seat === seat) anims.splice(i, 1)
        anims.push({ seat, kind: 'hop', t: 0 })
      }
    },
    update(dt) {
      for (const l of lights) {
        let on = true
        for (let o: T.Object3D | null = l.owner; o; o = o.parent) if (!o.visible) { on = false; break }
        l.light.intensity = on ? l.intensity : 0
      }
      let moving = anims.length > 0 || puffs.length > 0
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i]
        a.t += dt
        const base = floorAt(a.seat)
        if (!base) { anims.splice(i, 1); continue }
        if (a.kind === 'hop') {
          const t = a.t
          const y = t < 0.07 || t >= 0.37 ? 0 : 0.55 * Math.sin((Math.PI * (t - 0.07)) / 0.3)
          const s = t < 0.07 ? 1 - 0.18 * (t / 0.07) : t < 0.37 ? 1.08 : t < 0.47 ? 1 - 0.14 * Math.sin((Math.PI * (t - 0.37)) / 0.1) : 1
          for (const p of body(a.seat)) place(p, base, y, s)
          if (t >= 0.47) { for (const p of body(a.seat)) place(p, base, 0, 1); anims.splice(i, 1) }
          continue
        }
        // Desk, then its developer a beat later: free fall, one bounce, rest.
        const pieces: [Part[], number][] = [[prop(`desk:${a.seat}`), 0], [prop(`chair:${a.seat}`), 0.1], [body(a.seat), 0.25]]
        a.puffed ??= pieces.map(() => false)
        let done = true
        pieces.forEach(([parts, at], k) => {
          const u = (a.t - at) / 0.45
          if (u < 0) { for (const p of parts) { placeInstances(p.instances, new T.Matrix4().makeScale(0, 0, 0)); if (p.group) p.group.visible = false } done = false; return }
          if (u < 1.62) done = false
          const y = u < 1 ? DROP_FROM * (1 - u * u) : u < 1.5 ? 0.32 * Math.sin((Math.PI * (u - 1)) / 0.5) : 0
          const s = u >= 1 && u < 1.15 ? 1 - 0.24 * Math.sin((Math.PI * (u - 1)) / 0.15) : u >= 1.5 && u < 1.62 ? 1 - 0.12 * Math.sin((Math.PI * (u - 1.5)) / 0.12) : 1
          for (const p of parts) place(p, base, u >= 1.62 ? 0 : y, u >= 1.62 ? 1 : s)
          if (u >= 1 && !a.puffed![k]) { a.puffed![k] = true; puff(base) }
        })
        if (done) anims.splice(i, 1)
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]
        p.t += dt
        const u = p.t / 0.55
        p.mesh.position.addScaledVector(p.dir, 0.02)
        p.mesh.scale.setScalar(0.6 + u * 1.2)
        ;(p.mesh.material as T.MeshStandardMaterial).opacity = Math.max(0, 0.8 * (1 - u))
        if (u >= 1) { env.root.remove(p.mesh); (p.mesh.material as T.Material).dispose(); puffs.splice(i, 1) }
      }
      if (moving || shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false }
      moving = moving || false
      return moving
    },
  }
  return garage
}
