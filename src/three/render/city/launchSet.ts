/*
 * Copied from the rebuild (100m-devs-three/src/render/city/launchSet.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The James launch** — GDD §5 [amended 2026-09-24, Garage to Galaxy decision
 * 5], phase 8: *"a funny cut scene where James gets blasted off to proxima and
 * says bye, earthling, and we are like "JAMES!!!""*.
 *
 * The storyboard, as a set on HQ's lawn in the endless city:
 *
 *   0 s  a stubby rocket on the launch pad, James in the hatch with a Diet Coke;
 *        the founder on the lawn beside it.            ("Bye, earthling.")
 *   5 s  lift-off, cans tumbling out of the hatch.
 *   8 s  the founder drops to their knees.             ("JAMES!!!")
 *  11 s  the rocket is a dot; the caption card holds.  (UI: `JamesLaunch`)
 *
 * This file is the set and its motion as a pure function of time: `update(t)`
 * places everything for second `t`, so skipping, scrubbing and reduced motion
 * are the same code. The camera follows `focus(t)`.
 */
import * as T from 'three'
import { blockOrigin } from '../../sim/cityGrid.ts'
import { leaderLook, studioPerson, type StudioCast } from '../studioPeople.ts'

/** The pad on HQ's lawn (`cityBlocks.hq`: the amber square at x0+15..25, z0+15..25). */
const [HX, HZ] = blockOrigin(0, 0)
export const PAD = { x: HX + 20, z: HZ + 20, y: .56 }
export const LIFTOFF = 5
export const KNEEL = 8
export const LAUNCH_SECONDS = 15

const mat = (c: string, emissive = false) => new T.MeshStandardMaterial({ color: c, roughness: .8, flatShading: true, ...(emissive ? { emissive: c, emissiveIntensity: .9 } : {}) })

export interface LaunchSet {
  group: T.Group
  update(t: number): void
  /** Where the camera should look at second `t`. */
  focus(t: number): T.Vector3
  dispose(): void
}

/** How high the rocket is at second `t`: still, then an accelerating climb. */
export function rocketHeight(t: number): number {
  const u = Math.max(0, t - LIFTOFF)
  return 3 * u * u + 2 * u
}

export function createLaunchSet(cast: StudioCast): LaunchSet {
  const group = new T.Group(); group.name = 'james-launch'
  const materials: T.Material[] = []
  const m = (c: string, e = false) => { const x = mat(c, e); materials.push(x); return x }
  const white = m('#eeeae0'), red = m('#c8483a'), grey = m('#5c646a'), glass = m('#8fc6e8'), flame = m('#ffb347', true)

  // The rocket: stubby, round, a hatch at the top and fins at the foot.
  const rocket = new T.Group(); group.add(rocket)
  const body = new T.Mesh(new T.CylinderGeometry(2.2, 2.6, 9, 12), white); body.position.y = 4.5; rocket.add(body)
  const band = new T.Mesh(new T.CylinderGeometry(2.25, 2.3, .8, 12), red); band.position.y = 6.2; rocket.add(band)
  const nose = new T.Mesh(new T.ConeGeometry(2.2, 4, 12), red); nose.position.y = 11; rocket.add(nose)
  for (let k = 0; k < 3; k++) {
    const fin = new T.Mesh(new T.BoxGeometry(.3, 3, 2.2), red)
    const a = k * Math.PI * 2 / 3 + .4
    fin.position.set(Math.cos(a) * 2.5, 1.4, Math.sin(a) * 2.5); fin.rotation.y = -a
    rocket.add(fin)
  }
  const nozzle = new T.Mesh(new T.CylinderGeometry(1.2, 1.6, 1, 10), grey); nozzle.position.y = -.4; rocket.add(nozzle)
  const plume = new T.Mesh(new T.ConeGeometry(1.4, 6, 10), flame); plume.rotation.x = Math.PI; plume.position.y = -3.8; rocket.add(plume)
  // The hatch, open, facing the camera's side, with James standing in it.
  // The hatch is a dark opening on the hull; James stands on a ledge in front of it, facing us.
  const hatch = new T.Mesh(new T.BoxGeometry(1.9, 2.6, .3), m('#2d3b42')); hatch.position.set(1.62, 7.6, 1.62); hatch.rotation.y = Math.PI / 4; rocket.add(hatch)
  const frame = new T.Mesh(new T.BoxGeometry(2.3, .25, .45), red); frame.position.set(1.66, 8.95, 1.66); frame.rotation.y = Math.PI / 4; rocket.add(frame)
  const ledge = new T.Mesh(new T.BoxGeometry(2.2, .25, 1.4), grey); ledge.position.set(2.1, 6.2, 2.1); ledge.rotation.y = Math.PI / 4; rocket.add(ledge)
  const window1 = new T.Mesh(new T.CylinderGeometry(.6, .6, .2, 10), glass); window1.rotation.x = Math.PI / 2; window1.position.set(-1.2, 5.2, 2.0); rocket.add(window1)
  const james = studioPerson(rocket, 2.15, 2.15, Math.PI / 4 + Math.PI, leaderLook(cast, 'james'), 'james', true)
  james.position.y = 6.33
  james.scale.setScalar(1.25)
  const can = new T.Mesh(new T.CylinderGeometry(.14, .14, .4, 8), m('#c83a3a'))
  can.position.set(.55, 1.25, -.3); james.add(can)

  // The pad's gantry, which stays behind.
  const gantry = new T.Group(); group.add(gantry)
  for (const [x, z] of [[-4.5, -4.5], [-4.5, -1.5]]) { const leg = new T.Mesh(new T.BoxGeometry(.5, 12, .5), grey); leg.position.set(x, 6, z); gantry.add(leg) }
  const arm = new T.Mesh(new T.BoxGeometry(3, .4, .5), grey); arm.position.set(-3, 8, -3); gantry.add(arm)

  // The founder on the lawn, looking up; they kneel at `KNEEL`.
  const founder = studioPerson(group, -6, 7, Math.PI * .85, cast.founder, 'founder', true)
  founder.scale.setScalar(1.25)

  // Diet Coke cans, tumbling out of the hatch after lift-off.
  const cans: { mesh: T.Mesh; v: T.Vector3; spin: T.Vector3; at: number }[] = []
  for (let k = 0; k < 14; k++) {
    const c = new T.Mesh(new T.CylinderGeometry(.22, .22, .6, 8), k % 3 ? m('#d7d9dc') : m('#c83a3a'))
    c.visible = false; group.add(c)
    const a = k * 2.399
    cans.push({ mesh: c, v: new T.Vector3(Math.cos(a) * (2 + k % 4), 2 + (k % 3), Math.sin(a) * (2 + k % 4)), spin: new T.Vector3(3 + k % 5, 2 + k % 4, 4), at: LIFTOFF + .15 + k * .14 })
  }
  // Smoke puffs at the pad, for the launch.
  const smoke: T.Mesh[] = []
  const smokeMat = new T.MeshStandardMaterial({ color: '#e8e6e0', roughness: 1, flatShading: true, transparent: true, opacity: .85 })
  materials.push(smokeMat)
  for (let k = 0; k < 12; k++) { const p = new T.Mesh(new T.IcosahedronGeometry(1.5, 0), smokeMat); p.visible = false; group.add(p); smoke.push(p) }

  group.position.set(PAD.x, PAD.y, PAD.z)

  const handle: LaunchSet = {
    group,
    update(t) {
      const h = rocketHeight(t)
      rocket.position.y = h
      plume.visible = t > LIFTOFF - .6
      plume.scale.setScalar(t > LIFTOFF - .6 ? .8 + .25 * Math.sin(t * 40) + Math.min(1, Math.max(0, t - LIFTOFF + .6)) : 0)
      rocket.rotation.z = t > LIFTOFF ? Math.sin(t * 22) * .01 : 0
      // James waves before lift-off, then holds on.
      const arm = james.getObjectByName('arm1')
      if (arm) arm.rotation.x = t < LIFTOFF ? -2.4 + Math.sin(t * 7) * .5 : -2.6
      // The founder: watching, then on their knees, then looking up.
      const kneel = Math.min(1, Math.max(0, (t - KNEEL) / .35))
      founder.position.y = -.55 * kneel
      founder.rotation.x = -.18 * kneel
      for (const k of ['arm-1', 'arm1']) {
        const a = founder.getObjectByName(k)
        if (a) a.rotation.x = kneel > 0 ? -2.9 : 0
      }
      for (const c of cans) {
        const u = t - c.at
        if (u < 0) { c.mesh.visible = false; continue }
        c.mesh.visible = true
        const start = rocketHeight(c.at) + 7.5
        const y = Math.max(.3, start + c.v.y * u - 4.9 * u * u)
        const landed = y <= .3
        c.mesh.position.set(1.4 + c.v.x * Math.min(u, 3), y, 1.4 + c.v.z * Math.min(u, 3))
        if (!landed) c.mesh.rotation.set(c.spin.x * u, c.spin.y * u, c.spin.z * u)
        else c.mesh.rotation.set(Math.PI / 2, c.spin.y, 0)
      }
      smoke.forEach((p, k) => {
        const u = t - LIFTOFF + .4 - k * .05
        p.visible = u > 0 && u < 6
        if (!p.visible) return
        const a = k * 0.52
        const r = 2 + u * 2.4
        p.position.set(Math.cos(a) * r, .8 + u * .4, Math.sin(a) * r)
        p.scale.setScalar(.6 + u * .5)
      })
      ;(smokeMat as T.MeshStandardMaterial).opacity = Math.max(0, .85 - Math.max(0, t - LIFTOFF - 2) * .2)
    },
    focus(t) {
      // Hold on the pad; follow the rocket up once it is climbing; let it go at the end.
      const h = Math.min(rocketHeight(t), 90)
      return new T.Vector3(PAD.x, PAD.y + 5 + h * .8, PAD.z)
    },
    dispose() {
      group.traverse(o => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose() })
      materials.forEach(x => x.dispose())
      group.removeFromParent()
    },
  }
  handle.update(0)
  return handle
}
