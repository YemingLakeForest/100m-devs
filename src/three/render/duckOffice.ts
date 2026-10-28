/**
 * The CTO, in the corner of the office — GDD §11.7.2 [amended 2026-10-22].
 *
 * *"8 bit it is, otherwise it plunges deep into uncanny valley."* He is
 * `art/duckVoxels.ts`'s grid, drawn here as one mesh of unit cubes: no bath, no
 * plinth, no podium (*"lose the podium idea"*), just a duck the size of a
 * child sitting on the floor north of the east pods, turned three-quarters to
 * the lens so the room sees his profile and his beak. The same grid is his
 * portrait and the app icon, so what the player dresses him in here is what
 * every picture of him wears.
 *
 * **Where, and why there.** The clear floor at {@link DUCK_SPOT}, which is where
 * the bath stood (2026-10-21) and keeps that spot's measurement: west of
 * x 11.4, or the east wall's top rail draws through him.
 *
 * **How.** The grid becomes one `BufferGeometry` with a face only where a cube
 * meets air, each face one flat colour from {@link INK_HEX} and lit by the room
 * like everything else (`flatShading`), so a voxel reads as a block and not as a
 * texture. He and what he wears are a `dynamic` group the batcher skips, rebuilt
 * when his look changes; he is not in `env.targets` because he does not code.
 */

import * as T from 'three'
import { box, sharedMaterial } from './worldArt.ts'
import { nameSign } from './garageDetails.ts'
import { NO_DUCK_LOOK, lookKey, type DuckLook } from '../../sim/duck.ts'
import { DUCK_HEAD, INK_HEX, duckVoxels, type Voxel } from '../../art/duckVoxels.ts'
import { DUCK_SPOT } from '../sim/floorPlan.ts'

/**
 * A voxel's edge, in metres. A decimetre makes him a metre to the top of his
 * head — a seated developer's height, so he is the biggest thing on the floor
 * that is not furniture, which a motif has to be (three-quarters of a decimetre
 * was tried first and he was the size of a developer's head).
 */
export const VOXEL = 0.1

/**
 * Facing west, square to the room's walls. His beak is +x in his own grid, so a half turn points it at -x: along
 * the floor, into the studio he is the CTO of. Round 3's icon was drawn at 0.7 rad, which put the beak at an odd
 * angle (east-north-east, out at the east wall), and *"put it to face one of standard direction"* is the answer:
 * a cardinal, because the room is built on a grid and a duck at 0.7 rad is the only thing in it that is not.
 * The lens looks along the room's diagonal, so a cardinal still shows him in profile.
 * [2026-10-28, at the user's instruction]
 */
const TURN = Math.PI

/** The middle of his body in grid cells, which sits on the spot. */
const CENTRE_X = 4.5

const FACES: readonly { n: readonly [number, number, number]; c: readonly (readonly [number, number, number])[] }[] = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
]

/** A grid as one mesh: a quad per face that meets air, in its ink's colour. */
function voxelGeometry(voxels: readonly Voxel[]): T.BufferGeometry {
  const filled = new Set(voxels.map(([x, y, z]) => `${x},${y},${z}`))
  const pos: number[] = [], nrm: number[] = [], col: number[] = []
  const colour = new T.Color()
  for (const [x, y, z, ink] of voxels) {
    colour.set(INK_HEX[ink])
    for (const { n, c } of FACES) {
      if (filled.has(`${x + n[0]},${y + n[1]},${z + n[2]}`)) continue
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push((x + c[i][0] - CENTRE_X) * VOXEL, (y + c[i][1]) * VOXEL, (z + c[i][2]) * VOXEL)
        nrm.push(...n)
        col.push(colour.r, colour.g, colour.b)
      }
    }
  }
  const g = new T.BufferGeometry()
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3))
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3))
  g.computeBoundingSphere()
  return g
}

const voxelMaterial = () => sharedMaterial('duck-voxels', () => new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true }))

/** A brass stand with his title on it, at his feet once he is CTO. */
function standPlate(g: T.Object3D, x: number, z: number): void {
  box(g, x, 0, z, 0.2, 0.03, 0.2, '#c49b3c')
  box(g, x, 0.03, z, 0.04, 0.4, 0.04, '#c49b3c')
  box(g, x, 0.39, z, 0.42, 0.15, 0.04, '#5f4c2c')
  nameSign(g, 'CTO', x, 0.465, z + 0.025, 0.38, 0, '#5f4c2c')
}

export interface DuckOffice {
  /** Redraw him for a look. True when anything changed (the room must redraw). */
  setLook(look: DuckLook): boolean
  /** A tap landed on him: a squeak, which is a squash and a stretch. */
  squeak(now: number): void
  /** Advance the squeak. True while he is moving. */
  update(now: number): boolean
  /** The invisible volume a tap has to land in. */
  readonly hit: T.Mesh
  /** His head, in the world, for the dialogue's lens. */
  head(out: T.Vector3): T.Vector3
}

const hitMaterial = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })

export function duckOffice(parent: T.Object3D): DuckOffice {
  const root = new T.Group()
  root.name = 'duck'
  root.position.set(DUCK_SPOT.x, 0, DUCK_SPOT.z)
  root.rotation.y = TURN
  parent.add(root)

  const live = new T.Group()
  live.userData.dynamic = true
  root.add(live)
  const body = new T.Group()
  live.add(body)
  const mesh = new T.Mesh(new T.BufferGeometry(), voxelMaterial())
  mesh.castShadow = true
  mesh.receiveShadow = true
  body.add(mesh)
  const plate = new T.Group()
  live.add(plate)

  const hit = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1, 12), hitMaterial)
  hit.position.set(0, 0.6, 0)
  hit.scale.set(1.25, 1.2, 0.85)
  hit.userData.hit = true
  root.add(hit)

  let shown = ''
  let squeakAt = -1

  const setLook = (look: DuckLook): boolean => {
    const key = lookKey(look)
    if (key === shown) return false
    shown = key
    mesh.geometry.dispose()
    mesh.geometry = voxelGeometry(duckVoxels(look.outfit, { ducklings: look.ducklings, printouts: look.printouts }))
    plate.clear()
    // Beside his tail, toward the lens: in front of him it stood across his chest.
    if (look.promoted) standPlate(plate, -0.85, 0.45)
    return true
  }
  setLook(NO_DUCK_LOOK)

  return {
    setLook,
    squeak(now) { squeakAt = now },
    update(now) {
      if (squeakAt < 0) return false
      const t = now - squeakAt
      // Down and wide for a tenth of a second, up and thin for a tenth, and back: the squeak is the squash.
      const u = t < 0.1 ? t / 0.1 : t < 0.2 ? 1 - (t - 0.1) / 0.1 * 2 : t < 0.32 ? -1 + (t - 0.2) / 0.12 : 0
      body.scale.set(1 + 0.14 * u, 1 - 0.22 * u, 1 + 0.14 * u)
      if (t >= 0.32) { squeakAt = -1; body.scale.set(1, 1, 1) }
      return true
    },
    hit,
    head(out) {
      root.updateMatrixWorld(true)
      return body.localToWorld(out.set((DUCK_HEAD[0] + 0.5 - CENTRE_X) * VOXEL, (DUCK_HEAD[1] + 0.5) * VOXEL, (DUCK_HEAD[2] + 0.5) * VOXEL))
    },
  }
}
