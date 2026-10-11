import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { placeInstances, showSeatInstances, wallCorners, wallRuns, type Plan, type SeatInstance } from './worldArt.ts'
import { GARAGE_OUTLINE } from '../sim/floorPlan.ts'

/**
 * Wall joints [2026-10-11, at the user's instruction: *"I want continuous finish, I see wall corners are just chipped
 * into each other"*]. Run against the garage's own outline rather than a square, because the claim is about every angle
 * the building turns through (90°, 135°, a chamfer into a jog), and the notches were worst where it turns least tidily.
 */
const ring = GARAGE_OUTLINE
const runAt = (i: number, t: number) => {
  const n = ring.length
  return wallCorners(ring[i], ring[(i + 1) % n], t, ring[(i + n - 1) % n], ring[(i + 2) % n])
}
const away = (p: Plan, q: Plan) => Math.hypot(p[0] - q[0], p[1] - q[1])
/** Distance from `p` to the infinite line through `a` and `b`. */
const toLine = (p: Plan, a: Plan, b: Plan) =>
  Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1])

describe('a wall turns a corner without a seam', () => {
  it('ends every run on exactly the corners the next one starts on', () => {
    for (const t of [.24, .35, .12, .055]) {
      for (let i = 0; i < ring.length; i++) {
        const here = runAt(i, t), next = runAt((i + 1) % ring.length, t)
        // [start-left, end-left, end-right, start-right]: this run's end is the next run's start, left and right.
        expect(away(here[1], next[0]), `left, vertex ${i + 1}, t ${t}`).toBeLessThan(1e-9)
        expect(away(here[2], next[3]), `right, vertex ${i + 1}, t ${t}`).toBeLessThan(1e-9)
      }
    }
  })

  it('keeps both faces of both runs a half-thickness from their own centre line, at the joint', () => {
    // The corner is where the two *faces* cross, so it is half a wall from each run's line. A mitre cut anywhere else
    // would thicken or thin the wall near the corner.
    const t = .24
    for (let i = 0; i < ring.length; i++) {
      const n = ring.length, a = ring[i], b = ring[(i + 1) % n], c = ring[(i + 2) % n]
      const here = runAt(i, t)
      for (const corner of [here[1], here[2]]) {
        expect(toLine(corner, a, b), `vertex ${i + 1}, own face`).toBeCloseTo(t / 2, 9)
        expect(toLine(corner, b, c), `vertex ${i + 1}, neighbour's face`).toBeCloseTo(t / 2, 9)
      }
    }
  })

  it('cuts a coping and the wall under it on the same plane, whatever their thickness', () => {
    // The 0.35 m coping is wider than the 0.24 m wall, and a wall that bites differently from its cap is the chip.
    // Both corners lie on the line through the vertex that bisects the turn, so the three points are collinear.
    for (let i = 0; i < ring.length; i++) {
      const v = ring[(i + 1) % ring.length]
      const wall = runAt(i, .24)[1], cap = runAt(i, .35)[1]
      const cross = (wall[0] - v[0]) * (cap[1] - v[1]) - (wall[1] - v[1]) * (cap[0] - v[0])
      expect(Math.abs(cross), `vertex ${i + 1}`).toBeLessThan(1e-9)
    }
  })

  it('cuts a run with no neighbour square, against whatever it abuts', () => {
    const [aL, bL, bR, aR] = wallCorners([0, 0], [4, 0], .24)
    expect([aL, bL, bR, aR].map(([x, z]) => [x, Math.abs(z)])).toEqual([[0, .12], [4, .12], [4, .12], [0, .12]])
  })

  it('merges a colour’s runs into one mesh, and stands each between its own heights', () => {
    const parent = new T.Group()
    const meshes = wallRuns(parent, [
      { a: [0, 0], b: [4, 0], y: 0, h: 3, t: .24, colour: '#ced9dc', after: [4, 4] },
      { a: [4, 0], b: [4, 4], y: 0, h: 1, t: .24, colour: '#ced9dc', before: [0, 0] },
      { a: [0, 0], b: [4, 0], y: 3, h: .1, t: .35, colour: '#e7eeed', after: [4, 4] },
    ])
    expect(meshes).toHaveLength(2)
    const wall = meshes.find((m) => (m.material as T.MeshStandardMaterial).color.getHexString() === 'ced9dc')!
    const box = new T.Box3().setFromObject(wall)
    expect([box.min.y, box.max.y]).toEqual([0, 3])
    // the taller run's end stands on the cut it shares with the shorter one, so nothing sticks out past the corner
    expect(box.max.x).toBeCloseTo(4.12, 5)
    expect(box.max.z).toBeCloseTo(4, 5)
    for (const m of meshes) m.geometry.dispose()
  })
})

describe('arriving furniture remains in the camera frustum', () => {
  it('recovers from bounds computed while its instances were hidden', () => {
    const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial(), 1)
    const matrix = new T.Matrix4().makeTranslation(20, 0, 0)
    const parts: SeatInstance[] = [{ mesh, index: 0, matrix }]
    const camera = new T.OrthographicCamera(-2, 2, 2, -2, .1, 100)
    camera.position.set(20, 0, 10); camera.lookAt(20, 0, 0); camera.updateMatrixWorld(true)
    const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    showSeatInstances(parts, false)
    expect(frustum.intersectsObject(mesh)).toBe(false)
    placeInstances(parts, new T.Matrix4())
    expect(frustum.intersectsObject(mesh)).toBe(true)
    showSeatInstances(parts, false)
    expect(frustum.intersectsObject(mesh)).toBe(false)
    showSeatInstances(parts, true)
    expect(frustum.intersectsObject(mesh)).toBe(true)
    mesh.geometry.dispose(); (mesh.material as T.Material).dispose()
  })
})
