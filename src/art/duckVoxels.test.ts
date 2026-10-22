/**
 * GDD §11.7.2 [2026-10-22] — the eight-bit duck. The claims: every item the
 * catalogue sells or hands over has a picture, the picture changes the duck,
 * and the duck stays on the integer grid (a half-size cube is the end of
 * eight-bit). The portrait and the room draw this grid, so this is their test too.
 */

import { describe, expect, it } from 'vitest'
import { DUCK_ITEMS } from '../sim/duck.ts'
import { WEARABLE_IDS, duckVoxels, itemVoxels } from './duckVoxels.ts'
import { duckBoxes } from './voxelIcons.ts'

const key = (v: readonly (readonly [number, number, number, string])[]) => v.map((c) => c.join(',')).sort().join(';')

describe('§11.7.2 — one grid for every picture of him', () => {
  it('can draw every item in the catalogue, and every item it draws is in the catalogue', () => {
    const catalogue = DUCK_ITEMS.map((i) => i.id).sort()
    expect([...WEARABLE_IDS].sort()).toEqual(catalogue)
  })

  it('changes the duck for every item, and gives every item a tile picture', () => {
    const bare = key(duckVoxels({}))
    for (const item of DUCK_ITEMS) {
      const worn = item.id === 'ducklings' ? duckVoxels({}, { ducklings: 1 }) : duckVoxels({ [item.slot]: item.id })
      expect(key(worn), item.id).not.toBe(bare)
      expect(itemVoxels(item.id).length, item.id).toBeGreaterThan(0)
    }
  })

  it('keeps him on the integer grid, in whatever he wears', () => {
    const outfit = { head: 'tophat', face: 'shades', neck: 'bowtie', tub: 'mug' }
    for (const [x, y, z] of duckVoxels(outfit, { ducklings: 5, printouts: 3 })) {
      expect([x, y, z].every(Number.isInteger)).toBe(true)
      expect(y).toBeGreaterThanOrEqual(0)
    }
  })

  it('paints the portrait from the same grid, a box a voxel', () => {
    expect(duckBoxes({ head: 'crown' }).length).toBe(duckVoxels({ head: 'crown' }).length)
  })
})
