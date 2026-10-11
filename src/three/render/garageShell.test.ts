import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { GARAGE_ASSEMBLED, buildGarageEnvironment } from './garageEnvironment.ts'
import { defaultCast } from './studioPeople.ts'
import { GARAGE_DECK, GARAGE_OUTLINE, GARAGE_WALLS, STUDIO_DOOR, STUDIO_GABLE, WEST_WALL_END } from '../sim/floorPlan.ts'
import { FRONT_FRAME, frontGlazing } from './garageDetails.ts'

/**
 * The garage's shell, as built [2026-10-11, at the user's instruction: *"the door and the logo wall on the front is not
 * in same size as others, also the wall joints are done badly, I want continuous finish"*].
 *
 * What these pin is the *claim* — one eave for the whole building, and a corner with no bite out of it — and not the
 * numbers it is made of: the coping and the glazing may be re-proportioned without touching them.
 */
const shell = buildGarageEnvironment(0, defaultCast(), 'off', true, GARAGE_ASSEMBLED, true)
shell.root.updateMatrixWorld(true)

/** The first surface a ray meets, or undefined. */
const cast = (from: T.Vector3, toward: T.Vector3) =>
  new T.Raycaster(from, toward).intersectObjects(shell.root.children, true).find((h) => h.object.visible)
/** The height of the highest surface at (x, z): a ray dropped from above the building. Zero if nothing is there. */
const topAt = (x: number, z: number): number => cast(new T.Vector3(x, 20, z), new T.Vector3(0, -1, 0))?.point.y ?? 0
// What stands on top of a wall at the eave: its coping, which is the highest thing the shell has.
const COPING = 0.12

describe('the front stands as tall as the rest of the building', () => {
  it('gives the street gable the hall’s height, so that it is the height of the wall it is built into', () => {
    expect(STUDIO_GABLE.height).toBe(GARAGE_WALLS.height)
    const gable = topAt((STUDIO_GABLE.x0 + STUDIO_GABLE.x1) / 2, STUDIO_GABLE.z)
    expect(gable).toBeCloseTo(GARAGE_WALLS.height + COPING, 2)
    for (const [x, z] of [[-13, 7], [-10, -3], [3, -9.8]] as const) {
      expect(topAt(x, z), `the wall at ${x}, ${z}`).toBeCloseTo(gable, 2)
    }
  })

  it('raises the doorway to the same eave, and leaves the leaf a door’s height', () => {
    const door = shell.root.getObjectByName('studio-entrance')!
    const top = new T.Box3().setFromObject(door).max.y
    expect(top).toBeGreaterThanOrEqual(GARAGE_WALLS.height)
    expect(top).toBeLessThanOrEqual(GARAGE_WALLS.height + COPING)
    // the portal grew; the leaf, the thing a person walks through, did not
    const leaf = new T.Box3().setFromObject(door.getObjectByName('studio-door-leaf')!).max.y
    expect(leaf).toBeLessThan(STUDIO_DOOR.height)
  })

  it('makes the door of the storefront it is set in: above its head there is only glass and the frontage’s graphite', () => {
    // The first cut ran plaster piers up to the eave and capped them, and the user's word for it was *funny*: a gate in
    // a glass wall. Whatever the door is made of above its own head, it is not the wall's plaster.
    const door = shell.root.getObjectByName('studio-entrance')!
    const above: T.Mesh[] = []
    door.traverse((node) => {
      if (node instanceof T.Mesh && new T.Box3().setFromObject(node).min.y >= STUDIO_DOOR.height - 1e-6) above.push(node)
    })
    expect(above.length).toBeGreaterThan(0)
    for (const mesh of above) {
      const finish = mesh.material as T.MeshStandardMaterial
      expect(finish === frontGlazing() || finish.color.getHexString() === FRONT_FRAME.slice(1), 'a plaster member above the door’s head').toBe(true)
    }
    // two leaves meet in the middle where there was one very wide one
    expect(door.getObjectByName('studio-door-leaf-left')).toBeDefined()
    expect(door.getObjectByName('studio-door-leaf-right')).toBeDefined()
  })
})

describe('the project board hangs on the wall', () => {
  // The board is built after the batcher, so it needs the whole room and not the bare shell.
  const full = buildGarageEnvironment(3, defaultCast(), 'on', false, GARAGE_ASSEMBLED, true)
  full.root.updateMatrixWorld(true)

  it('has solid wall behind every point of it, and does not reach into James’s deck', () => {
    // *"the white board is now exceeding and hanging halfly on the wall"* [2026-10-11]: 0.6 m of it stood over the
    // lounge's doorway. Look from the room straight at the wall, at the board's mid-height, all along it: whatever a
    // ray meets first behind the board has to be the west wall's face, not the lounge's far wall twelve feet on.
    const board = full.root.getObjectByName('garage-project-whiteboard')!
    const extent = new T.Box3().setFromObject(board)
    expect(extent.min.z).toBeGreaterThanOrEqual(GARAGE_DECK.z1)
    expect(extent.max.z).toBeLessThanOrEqual(WEST_WALL_END)
    const mid = (extent.min.y + extent.max.y) / 2
    const inBoard = (o: T.Object3D) => { for (let n: T.Object3D | null = o; n; n = n.parent) if (n === board) return true; return false }
    const steps = 16
    for (let i = 0; i <= steps; i++) {
      const z = extent.min.z + 0.005 + ((extent.max.z - extent.min.z - 0.01) * i) / steps
      const behind = new T.Raycaster(new T.Vector3(-9, mid, z), new T.Vector3(-1, 0, 0))
        .intersectObjects(full.root.children, true).find((h) => h.object.visible && !inBoard(h.object))
      expect(behind?.point.x, `what is behind the board at z = ${z.toFixed(2)}`).toBeLessThan(-9.7)
      expect(behind!.point.x, `what is behind the board at z = ${z.toFixed(2)}`).toBeGreaterThan(-10.2)
    }
  })
})

/**
 * Where the outside corner of a wall `half` thick lies at outline vertex `i`: out along the bisector of the angle, on
 * the side the room is not. (Only meaningful at a convex vertex, which is every one these are asked about.)
 */
const outsideCorner = (i: number, half: number): [number, number] => {
  const n = GARAGE_OUTLINE.length
  const v = GARAGE_OUTLINE[i], p = GARAGE_OUTLINE[(i + n - 1) % n], q = GARAGE_OUTLINE[(i + 1) % n]
  const unit = (a: readonly [number, number]) => { const l = Math.hypot(a[0] - v[0], a[1] - v[1]); return [(a[0] - v[0]) / l, (a[1] - v[1]) / l] }
  const [px, pz] = unit(p), [qx, qz] = unit(q)
  const inward = Math.hypot(px + qx, pz + qz)
  const ix = (px + qx) / inward, iz = (pz + qz) / inward
  // The wall's two faces meet `half / sin(half the interior angle)` from the vertex.
  const reach = half / Math.abs(ix * pz - iz * px)
  return [v[0] - ix * reach, v[1] - iz * reach]
}

describe('the corners have nothing missing from them', () => {
  // The vertices where both runs stand at the eave: the lounge's outside corner (−13, 12) and the back wall's two
  // chamfer corners (−10, −7) and (−7.2, −9.8). The coping is 0.35 m thick, so its outside corner is the farthest point
  // of the corner; a hair inside it is where end-to-end boxes left a bite.
  const eaveCorners = GARAGE_OUTLINE.map((v, i) => [v, i] as const)
    .filter(([v]) => (v[0] === -13 && v[1] === 12) || (v[0] === -10 && v[1] === -7) || (v[0] === -7.2 && v[1] === -9.8))

  it('covers the coping’s outside corner, to the eave', () => {
    expect(eaveCorners).toHaveLength(3)
    for (const [v, i] of eaveCorners) {
      const [x, z] = outsideCorner(i, 0.35 / 2)
      // 2 cm in along the bisector, so a point that must be inside the cap and would be outside a butted pair.
      const inward = [v[0] - x, v[1] - z], len = Math.hypot(inward[0], inward[1])
      expect(topAt(x + (inward[0] / len) * 0.02, z + (inward[1] / len) * 0.02), `corner ${v}`)
        .toBeCloseTo(GARAGE_WALLS.height + COPING, 2)
    }
  })

  it('carries the wall itself round the corner, not just the coping over it', () => {
    // From the side, at head height, level with the gable's outside face: the first thing the ray meets is the lounge
    // wall's outside face, 0.12 m out from its centre line — it was the vertex itself when the runs butted.
    const [x, z] = outsideCorner(GARAGE_OUTLINE.findIndex(([vx, vz]) => vx === -13 && vz === 12), 0.12)
    const hit = cast(new T.Vector3(-20, 2, z - 0.01), new T.Vector3(1, 0, 0))
    expect(hit?.point.x, 'where a level ray first meets the building').toBeCloseTo(x, 2)
  })
})
