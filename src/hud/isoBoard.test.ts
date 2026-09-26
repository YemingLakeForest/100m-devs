/**
 * The board, painted — GDD §8, ART_DIRECTION §1–2 [2026-09-26]. The claims the
 * picture rests on, checked on a plain buffer: nothing is antialiased (every
 * pixel painted is a palette colour, in whichever phosphor the glass is in),
 * a tile is a whole-pixel shape, and a tap on a tile's centre picks that tile.
 */

import { describe, expect, it } from 'vitest'
import { MASTER_PALETTE, RAMPS } from '../art/palette.ts'
import { ICONS, headBoxes } from '../art/voxelIcons.ts'
import { TREE_HEROES, TREES, type TileState } from '../sim/upgradeTrees.ts'
import { Raster, iso, octagon, pack, paintBoard, paintVoxels, pickNode, treeBounds, type Ink } from './isoBoard.ts'

const PALETTE = new Set(MASTER_PALETTE.map((hex) => pack(hex)))

function inkOf(ramp: readonly string[]): Ink {
  return { p: [pack(ramp[0]), pack(ramp[1]), pack(ramp[2]), pack(ramp[3])], n: RAMPS.NEUTRAL.map((hex) => pack(hex)) }
}

const STATES: TileState[] = ['owned', 'partial', 'partial+', 'live', 'short', 'locked', 'era', 'closed']

describe('§8 — the board is pixels from the palette', () => {
  for (const phosphor of ['CALM', 'WARN', 'ALARM'] as const) {
    it(`paints every tree in ${phosphor} with nothing between two palette entries`, () => {
      for (const hero of TREE_HEROES) {
        const b = treeBounds(hero)
        const W = Math.ceil(b.maxX - b.minX) + 4
        const H = Math.ceil(b.maxY - b.minY) + 4
        const r = new Raster(W, H)
        // Every state appears somewhere on every board.
        const nodes = TREES[hero].map((node, i) => ({
          node,
          state: node.kind === 'root' ? 'root' : node.kind === 'link' ? 'link' : STATES[i % STATES.length],
          level: i % 2,
        }) as const)
        paintBoard(r, { hero, nodes, selected: TREES[hero][1].id, hover: TREES[hero][2].id, blink: true, ink: inkOf(RAMPS[phosphor]), ox: -b.minX + 2, oy: -b.minY + 2 })
        const painted = r.px.filter((c) => c !== 0)
        expect(painted.length, hero).toBeGreaterThan(1000)
        for (const c of new Set(painted)) expect(PALETTE.has(c), `${hero} painted ${c.toString(16)}`).toBe(true)
      }
    })
  }

  it('draws every icon and every head from the palette', () => {
    const r = new Raster(64, 64)
    for (const boxes of [...Object.values(ICONS), ...TREE_HEROES.map(headBoxes)]) {
      r.clear()
      paintVoxels(r, 32, 40, boxes, 4, null)
      for (const c of new Set(r.px.filter((c) => c !== 0))) expect(PALETTE.has(c)).toBe(true)
    }
  })

  it('puts every tile vertex on a whole pixel', () => {
    for (const s of [0.3, 0.35, 0.4, 0.45]) {
      for (const [x, y] of octagon(0, 0, s)) {
        expect(Number.isInteger(Math.round(x * 1e9) / 1e9)).toBe(true)
        expect(Number.isInteger(Math.round(y * 1e9) / 1e9)).toBe(true)
      }
    }
  })

  it('picks the tile under a tap on its centre', () => {
    for (const hero of TREE_HEROES) {
      for (const n of TREES[hero]) {
        const [x, y] = iso(n.x, n.y)
        expect(pickNode(hero, x, y)?.id, `${hero}:${n.id}`).toBe(n.id)
      }
    }
  })
})
