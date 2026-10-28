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
import { REVEAL_MS, Raster, iso, octagon, pack, paintBoard, paintVoxels, pickNode, revealedIds, treeBounds, type BoardNode, type Ink } from './isoBoard.ts'

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

describe('§13.6.4 [2026-10-28] — a tree is shown a step at a time', () => {
  const tree = (hero: (typeof TREE_HEROES)[number], owned: ReadonlySet<string>): BoardNode[] =>
    TREES[hero].map((node) => ({ node, state: node.kind === 'root' ? 'root' : owned.has(node.id) ? 'owned' : 'locked', level: owned.has(node.id) ? 1 : 0 }))

  it('shows the root and what hangs from it, and not the rest, on an empty save', () => {
    for (const hero of TREE_HEROES) {
      const shown = revealedIds(tree(hero, new Set()))
      const root = TREES[hero].find((n) => n.kind === 'root')!
      expect(shown.has(root.id)).toBe(true)
      expect(shown.size, hero).toBeLessThan(TREES[hero].length)
      // Everything shown is the root, or hangs from it, or is the other half of a pick-one pair.
      for (const id of shown) {
        const n = TREES[hero].find((o) => o.id === id)!
        const pair = n.fork && TREES[hero].some((o) => o.fork === n.fork && o.parents.includes(root.id))
        expect(n.id === root.id || n.parents.includes(root.id) || !!pair, `${hero}:${id}`).toBe(true)
      }
    }
  })

  it('opens the next step when a node is owned, and never hides one that is owned', () => {
    for (const hero of TREE_HEROES) {
      const before = revealedIds(tree(hero, new Set()))
      const next = TREES[hero].find((n) => n.kind !== 'root' && before.has(n.id) && TREES[hero].some((c) => c.parents.includes(n.id) && !before.has(c.id)))
      if (!next) continue
      const after = revealedIds(tree(hero, new Set([next.id])))
      for (const id of before) expect(after.has(id), `${hero}:${id}`).toBe(true)
      expect(after.size).toBeGreaterThan(before.size)
    }
  })

  it('cannot be tapped where nothing is drawn, and has no bounds for it', () => {
    const hero = TREE_HEROES[0]
    const shown = revealedIds(tree(hero, new Set()))
    const hidden = TREES[hero].find((n) => !shown.has(n.id))!
    const [bx, by] = iso(hidden.x, hidden.y)
    expect(pickNode(hero, bx, by)?.id).toBe(hidden.id)
    expect(pickNode(hero, bx, by, shown)?.id).not.toBe(hidden.id)
    expect(treeBounds(hero, shown).maxX - treeBounds(hero, shown).minX).toBeLessThan(treeBounds(hero).maxX - treeBounds(hero).minX)
  })

  it('paints an entrance in palette colours only, and draws nothing under the first of the smoke', () => {
    const hero = TREE_HEROES[0]
    const nodes = tree(hero, new Set())
    const shown = nodes.filter((b) => revealedIds(nodes).has(b.node.id))
    const target = shown.find((b) => b.node.kind !== 'root')!
    const b = treeBounds(hero)
    const W = Math.ceil(b.maxX - b.minX) + 4
    const H = Math.ceil(b.maxY - b.minY) + 4
    const paint = (age: number | null) => {
      const r = new Raster(W, H)
      paintBoard(r, { hero, nodes: shown, selected: null, hover: null, blink: false, ink: inkOf(RAMPS.CALM), ox: Math.round(-b.minX) + 2, oy: Math.round(-b.minY) + 2, fx: age === null ? undefined : new Map([[target.node.id, age]]) })
      return r
    }
    const plain = paint(null)
    const smoking = paint(40)
    const landing = paint(REVEAL_MS * 0.6)
    expect(smoking.px.some((p, i) => p !== plain.px[i])).toBe(true)
    expect(landing.px.some((p, i) => p !== plain.px[i])).toBe(true)
    for (const r of [smoking, landing]) for (const p of r.px) if (p !== 0) expect(PALETTE.has(p)).toBe(true)
    // Once the entrance is over the tile is painted as any other.
    const done = paint(REVEAL_MS)
    expect(done.px.every((p, i) => p === plain.px[i])).toBe(true)
  })
})
