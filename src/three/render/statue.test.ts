import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { cellSize, statueModel, voxelsBuilt } from '../art/statueModel.ts'
import { coverFor } from '../sim/cover.ts'
import { createStatue, grown } from './statue.ts'

/*
 * The statue grows; it does not reveal (GDD §8.2a [amended 2026-10-15], at the user's instruction: *"to voxel statue, make it grow
 * instead of scratching out the shade?"*). The claims: nothing is drawn for a voxel that has not been built, a voxel that has just
 * been built is smaller than its place and is full size a moment later in hard steps, and a statue that is loaded is simply there.
 */

const spec = coverFor(1, 0, 0, 'Test')
const model = statueModel(spec)
const total = model.voxels.length
const cell = cellSize(model)

function meshes(root: T.Object3D): T.InstancedMesh[] {
  const found: T.InstancedMesh[] = []
  root.traverse((o) => { if (o instanceof T.InstancedMesh) found.push(o) })
  return found
}
const drawn = (root: T.Object3D) => meshes(root).reduce((n, m) => n + m.count, 0)

/** How large voxel `i` is drawn, as a share of its cell. */
function sizeOf(root: T.Object3D, i: number): number {
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
  meshes(root)[0].getMatrixAt(i, m)
  m.decompose(p, q, s)
  return s.x / cell
}

function statue() {
  const parent = new T.Group()
  const st = createStatue(parent)
  st.tick(0)
  return st
}

describe('the statue grows (§8.2a)', () => {
  it('draws nothing for a voxel that has not been built: no blueprint, no shade, only what stands', () => {
    const st = statue()
    st.update(spec, 'Test', 0)
    expect(drawn(st.root)).toBe(0)
    st.update(spec, 'Test', 0.5)
    expect(drawn(st.root)).toBe(voxelsBuilt(total, 0.5))
    // one mesh of cubes, not a second of the ones to come
    expect(meshes(st.root)).toHaveLength(1)
    st.update(spec, 'Test', 1)
    expect(drawn(st.root)).toBe(total)
    st.dispose()
  })

  it('stands as far as it has got without growing, when it is loaded rather than built', () => {
    const st = statue()
    st.update(spec, 'Test', 0.5)
    const built = voxelsBuilt(total, 0.5)
    for (let i = 0; i < built; i++) expect(sizeOf(st.root, i)).toBeCloseTo(1, 5)
    st.dispose()
  })

  it('shows a voxel that has just been built smaller than its place, and full size a moment later', () => {
    const st = statue()
    st.update(spec, 'Test', 0)
    st.tick(0.1)
    // exactly one more voxel
    st.update(spec, 'Test', 1.001 / total)
    expect(drawn(st.root)).toBe(1)
    // already small on the frame it stands, and not a frame at full size first
    const arriving = sizeOf(st.root, 0)
    expect(arriving).toBeGreaterThan(0)
    expect(arriving).toBeLessThan(1)
    const seen: number[] = [arriving]
    for (const at of [0.16, 0.24, 0.32, 0.4]) { st.tick(at); seen.push(sizeOf(st.root, 0)) }
    // it only ever gets bigger, it gets there, and it does so in a few hard steps and not a smooth ramp
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] - 1e-9)
    expect(seen.at(-1)).toBeCloseTo(1, 5)
    expect(new Set(seen.map((v) => v.toFixed(3))).size).toBeLessThanOrEqual(3)
    st.dispose()
  })

  it('is whole again when the beat tints it: a voxel still growing is stood at full size', () => {
    const st = statue()
    st.update(spec, 'Test', 0)
    st.tick(0.1)
    st.update(spec, 'Test', 1.001 / total)
    expect(sizeOf(st.root, 0)).toBeLessThan(1)
    // a build landing tints the figure; nothing may be left small under the flash
    st.update(spec, 'Test', 1)
    st.complete('build', false)
    for (let i = 0; i < total; i++) expect(sizeOf(st.root, i)).toBeCloseTo(1, 5)
    st.dispose()
  })

  it('grows in hard steps: smaller at first, full before the hot edge has cooled, never shrinking', () => {
    const ages = Array.from({ length: 60 }, (_, i) => i * 0.005)
    const sizes = ages.map(grown)
    expect(sizes[0]).toBeLessThan(1)
    expect(grown(0.25)).toBe(1)
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1])
    expect(new Set(sizes).size).toBeLessThanOrEqual(3)
  })
})
