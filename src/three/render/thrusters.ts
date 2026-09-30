import * as T from 'three'
import { OS } from '../art/skin.ts'

/** Shared landing/lift rig. The cone's tip always ends above the ground. */
export function createThrusters(width: number, depth: number) {
  const root = new T.Group()
  const geometry = new T.ConeGeometry(1, 1, 8)
  geometry.translate(0, -.5, 0)
  const outer = new T.MeshBasicMaterial({ color: OS.warm, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false })
  const core = new T.MeshBasicMaterial({ color: OS.lamp, transparent: true, opacity: .95, blending: T.AdditiveBlending, depthWrite: false })
  const nozzleGeometry = new T.CylinderGeometry(.35, .48, .3, 8)
  const nozzleMaterial = new T.MeshStandardMaterial({ color: OS.n4, metalness: .65, roughness: .4 })
  const jets: T.Mesh[] = []
  for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) {
    const nozzle = new T.Mesh(nozzleGeometry, nozzleMaterial)
    nozzle.position.set(x, .15, z); root.add(nozzle)
    for (const m of [outer, core]) {
      const jet = new T.Mesh(geometry, m)
      // ConeGeometry points upward; turn it so its broad mouth meets the nozzle.
      jet.rotation.z = Math.PI
      jet.position.set(x, 0, z)
      root.add(jet); jets.push(jet)
    }
  }
  return { root,
    update(gap: number, burning: boolean, clock: number) {
      root.visible = burning
      jets.forEach((jet, i) => {
        const length = Math.min(Math.max(0, gap - .03), (i % 2 ? 1.9 : 3.2) * (1 + .12 * Math.sin(clock * 49 + i)))
        jet.scale.set(i % 2 ? .23 : .48, length, i % 2 ? .23 : .48)
        jet.position.y = -length
      })
    },
    dispose() { geometry.dispose(); nozzleGeometry.dispose(); outer.dispose(); core.dispose(); nozzleMaterial.dispose() },
  }
}
