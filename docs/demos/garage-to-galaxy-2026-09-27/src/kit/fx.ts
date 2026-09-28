import * as T from 'three'
import { HEX } from './palette.ts'

/**
 * Two effects, both about arrival.
 *
 * **Dust** rings out from the base when a storey lands (§7.7.2: "dust rings out
 * from the base. Nobody inside reacts").
 *
 * **Rain** is the swarm coming in, from far away: when people are hired, streaks
 * of light fall out of the sky onto the frontier towers that take them, and
 * flash where they land. Up close a hire is a person dropping into a chair (the
 * garage's own gag); from a city away it is this. Same verb, drawn at the scale
 * it is seen at.
 */
export interface Fx {
  group: T.Group
  dust(at: T.Vector3, up: T.Vector3, radius: number): void
  rain(at: T.Vector3, up: T.Vector3, height: number): void
  update(dt: number, mode: number, p2: T.Color, p3: T.Color): void
}

const MAX_DUST = 600
const MAX_RAIN = 900

export function createFx(): Fx {
  const group = new T.Group()
  const puffGeo = new T.IcosahedronGeometry(1, 0)
  const puffMat = new T.MeshBasicMaterial({ color: new T.Color(HEX.n4), transparent: true, opacity: 0.35, depthWrite: false })
  const puffs = new T.InstancedMesh(puffGeo, puffMat, MAX_DUST)
  puffs.frustumCulled = false
  puffs.count = 0
  group.add(puffs)
  const dust: { p: T.Vector3; v: T.Vector3; t: number; life: number; size: number }[] = []

  // Streaks: a line segment per drop, head and tail.
  const pos = new Float32Array(MAX_RAIN * 2 * 3)
  const col = new Float32Array(MAX_RAIN * 2 * 3)
  const geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage))
  geo.setAttribute('color', new T.BufferAttribute(col, 3).setUsage(T.DynamicDrawUsage))
  const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }))
  lines.frustumCulled = false
  group.add(lines)
  const drops: { at: T.Vector3; up: T.Vector3; h: number; t: number; dur: number }[] = []
  const flashGeo = new T.SphereGeometry(1, 8, 6)
  const flashMat = new T.MeshBasicMaterial({ color: new T.Color(HEX.lamp).multiplyScalar(3), transparent: true, blending: T.AdditiveBlending, depthWrite: false })
  const flashes = new T.InstancedMesh(flashGeo, flashMat, MAX_RAIN)
  flashes.frustumCulled = false
  flashes.count = 0
  group.add(flashes)
  const flashList: { at: T.Vector3; t: number; size: number }[] = []
  const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3()
  const lamp = new T.Color(HEX.lamp).multiplyScalar(2.2)

  return {
    group,
    dust(at, up, radius) {
      const tangent = new T.Vector3(1, 0, 0).addScaledVector(up, -up.x).normalize()
      const bi = new T.Vector3().crossVectors(up, tangent)
      for (let k = 0; k < 18 && dust.length < MAX_DUST; k++) {
        const a = (k / 18) * Math.PI * 2
        const dir = tangent.clone().multiplyScalar(Math.cos(a)).addScaledVector(bi, Math.sin(a))
        dust.push({
          p: at.clone().addScaledVector(dir, radius * 0.55).addScaledVector(up, 0.8),
          v: dir.multiplyScalar(radius * 0.7 + 3).addScaledVector(up, 1.2),
          t: 0, life: 0.7 + Math.random() * 0.3, size: 0.8 + radius * 0.035,
        })
      }
    },
    rain(at, up, height) {
      if (drops.length >= MAX_RAIN) return
      drops.push({ at: at.clone(), up: up.clone(), h: height, t: 0, dur: 0.55 + Math.random() * 0.35 })
    },
    update(dt, mode, p2, p3) {
      let n = 0
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i]
        d.t += dt
        if (d.t > d.life) { dust.splice(i, 1); continue }
        d.p.addScaledVector(d.v, dt)
        d.v.multiplyScalar(Math.exp(-3 * dt))
        const u = d.t / d.life
        s.setScalar(d.size * (0.6 + u * 1.6))
        m.compose(d.p, q, s)
        puffs.setMatrixAt(n++, m)
      }
      puffs.count = n
      puffs.instanceMatrix.needsUpdate = true
      puffMat.color.set(mode > 0.5 ? p2 : new T.Color(HEX.n4))
      puffMat.opacity = mode > 0.5 ? 0.8 : 0.35 * (dust.length ? 1 : 0)

      const c = mode > 0.5 ? p3.clone().multiplyScalar(1.6) : lamp
      let k = 0
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.t += dt
        const u = d.t / d.dur
        if (u >= 1) {
          if (flashList.length < MAX_RAIN) flashList.push({ at: d.at, t: 0, size: Math.max(2, d.h * 0.012) })
          drops.splice(i, 1)
          continue
        }
        const y = d.h * (1 - u * u)
        const head = d.at.clone().addScaledVector(d.up, y)
        const tail = d.at.clone().addScaledVector(d.up, Math.min(d.h, y + d.h * 0.18))
        pos.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], k * 6)
        col.set([c.r, c.g, c.b, 0, 0, 0], k * 6)
        k++
      }
      geo.setDrawRange(0, k * 2)
      ;(geo.getAttribute('position') as T.BufferAttribute).needsUpdate = true
      ;(geo.getAttribute('color') as T.BufferAttribute).needsUpdate = true
      let f = 0
      for (let i = flashList.length - 1; i >= 0; i--) {
        const fl = flashList[i]
        fl.t += dt
        if (fl.t > 0.35) { flashList.splice(i, 1); continue }
        s.setScalar(fl.size * (1 - fl.t / 0.35))
        m.compose(fl.at, q, s)
        flashes.setMatrixAt(f++, m)
      }
      flashes.count = f
      flashes.instanceMatrix.needsUpdate = true
      flashMat.color.copy(mode > 0.5 ? p3.clone().multiplyScalar(2) : new T.Color(HEX.lamp).multiplyScalar(3))
    },
  }
}
