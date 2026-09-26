/*
 * Copied from the rebuild (100m-devs-three/src/render/garageNeighborhood.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
import * as T from 'three'
import { OS, OS_SKIN } from '../art/skin.ts'
import { box, cylinder, hedge, material, tree } from './worldArt.ts'

/** Quiet residential context around the playable workshop. No interactive props. */
export function garageNeighborhood(parent: T.Group): void {
  const g = new T.Group(); g.position.y = -.5; parent.add(g)
  // A back lane and two side streets join the road in front of the garage.
  box(g, 0, .02, -18, 96, .08, 4.4, '#808783', false)
  for (const x of [-19, 19]) {
    box(g, x, .02, -1.7, 4.4, .08, 28.2, '#808783', false)
    for (const dx of [-2.4, 2.4]) box(g, x + dx, .04, -1.7, .55, .1, 28.2, '#c5c5b5', false)
  }
  box(g, 0, .04, 18.6, 120, .1, 1.1, '#c5c5b5', false)
  for (const [x, width] of [[-35.3, 49.4], [25.3, 69.4]]) box(g, x, .04, -20.75, width, .1, 1.1, '#c5c5b5', false)
  for (const [x, width] of [[-35, 26], [-13.3, 5.4], [3.3, 25.4], [35, 26]]) box(g, x, .04, -15.55, width, .1, .55, '#c5c5b5', false)
  // The courtyard path crosses the lane and meets the house's front-door path.
  box(g, -10, 0, -20.75, 1.2, .1, 1.1, '#c6c4b2', false)
  for (let z = -19.9; z <= -16.1; z += .65) box(g, -10, .104, z, 1.2, .008, .28, '#d8d9cd', false)
  for (let x = -42; x <= 42; x += 4) box(g, x, .105, -18, 1.4, .006, .07, '#c7c8b6', false)

  const house = (x: number, z: number, turn: number, colour: string, roof: string) => {
    const h = new T.Group(); h.position.set(x, 0, z); h.rotation.y = turn; g.add(h)
    box(h, 0, -.04, 0, 8.7, .04, 7.6, '#919a76', false)
    box(h, 0, 0, 3.7, 1.2, .1, 2.5, '#c6c4b2', false)
    box(h, 0, 0, 0, 6.8, .2, 5.5, '#a4a799')
    box(h, 0, .2, 0, 6.6, 2.6, 5.3, colour)
    // A plain pitched roof: low contrast and lower than the garage's walls.
    const section = new T.Shape()
    section.moveTo(-3.6, 0); section.lineTo(0, 1.25); section.lineTo(3.6, 0); section.closePath()
    const geometry = new T.ExtrudeGeometry(section, { depth: 5.9, bevelEnabled: false })
    const mesh = new T.Mesh(geometry, material(roof))
    mesh.position.set(0, 2.8, -2.95); mesh.castShadow = true; mesh.receiveShadow = true
    mesh.userData.ownGeometry = true; h.add(mesh)
    box(h, 1.9, 2.9, -.8, .55, 1.05, .6, '#96998b')
    box(h, 0, .2, 2.67, .95, 1.85, .08, '#748279')
    for (const wx of [-2.05, 2.05]) {
      box(h, wx, 1.1, 2.68, 1.3, 1.05, .09, '#c2c6b7')
      box(h, wx, 1.2, 2.74, 1.08, .83, .025, '#839995', false)
      box(h, wx, 1.2, 2.76, .055, .83, .03, '#b8bfaf', false)
    }
    for (const wz of [-1.25, 1.25]) box(h, 3.32, 1.2, wz, .035, .85, 1.05, '#839995', false)
    box(h, 0, .02, 2.95, 1.4, .15, .5, '#bcbcae')
    hedge(h, -2.9, 3.6, 2.4, .5)
    hedge(h, 2.9, 3.6, 2.4, .5)
  }
  house(-10, -25, 0, '#b7b9a6', '#7f897c')
  house(2, -25, 0, '#b9b39f', '#8f8878')
  house(14, -25, 0, '#aab4a5', '#7d8982')
  house(-27, -7, Math.PI / 2, '#b9b6a4', '#8d8a79')
  house(-27, 6, Math.PI / 2, '#aeb6a4', '#818b7c')
  house(27, -7, -Math.PI / 2, '#b7b8a6', '#868b7c')
  house(27, 6, -Math.PI / 2, '#b8b09e', '#938b7d')
  house(-11, 26, Math.PI, '#aeb5a5', '#818b7f')
  house(4, 26, Math.PI, '#b7b6a2', '#8a8c7b')
  house(19, 27, Math.PI, '#b6b7a5', '#838d82')
  // A sparse second row supplies context above/below the studio on tall screens.
  for (const z of [-38, 38]) {
    box(g, 0, .02, z, 120, .08, 4.4, '#808783', false)
    for (const dz of [-2.65, 2.65]) box(g, 0, .04, z + dz, 120, .1, .9, '#c5c5b5', false)
    for (const x of [-26, -12, 2, 16, 30]) {
      house(x, z + Math.sign(z) * 8, z < 0 ? 0 : Math.PI, '#adb39f', '#818b7c')
      tree(g, x + 5, z + Math.sign(z) * 7, 2.6)
    }
  }
  // Small planted gaps, rather than an empty lawn between identical houses.
  for (const [x, z, size] of [[-16, -26, 2.3], [-4, -26, 2.6], [8, -27, 2.4],
    [-27, -15, 2.8], [-28, 0, 2.3], [27, 0, 2.5], [28, -15, 2.7],
    [-19, 24, 2.2], [-3, 26, 2.3], [12, 26, 2.6], [-15, -12, 1.8], [15, -12, 2]]) tree(g, x, z, size)
  // Street lamps remain at the perimeter, clear of the room's silhouette.
  for (const [x, z] of [[-15.5, 11], [15.5, 11], [-15.5, -14], [15.5, -14]]) {
    cylinder(g, x, 0, z, .055, 2.7, '#737e72')
    box(g, x, 2.7, z, .32, .15, .5, OS_SKIN ? OS.lamp : '#bfc6b1')
    if (OS_SKIN) {
      // STUDIO_OS: the street is dark, so its lamps make the only pools outside.
      const pool = new T.PointLight(OS.lamp, 9, 8, 2)
      pool.position.set(x, 2.5, z)
      g.add(pool)
    }
  }
}
