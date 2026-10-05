/**
 * The five trees — GDD §8 [2026-09-26]. The catalogue is the demo's proposal
 * and its numbers will move, so this pins what the board has to be true about
 * any catalogue: every edge lands on something, a link points at a real node
 * in a real tree, no two tiles share a cell, **no connector runs under a tile
 * it does not join**, and Serena's wired half is the pipeline's catalogue and
 * not a copy of it.
 */

import { describe, expect, it } from 'vitest'
import {
  BILLY_ARRIVAL_POINTS,
  COORD_LOAD_STEP,
  TREE_HEROES,
  TREES,
  connectorRoute,
  isBuilt,
  levelOf,
  syncCapMultiplier,
  tileStateOf,
  treeNode,
  treePrice,
  treeRefusal,
  type TreeHero,
  type TreeNode,
  type TreeView,
} from './upgradeTrees.ts'
import { PIPELINE_TREE } from './pipeline.ts'
import { ICONS } from '../art/voxelIcons.ts'

function view(levels: Record<string, number> = {}, over: Partial<TreeView> = {}): TreeView {
  return {
    level: (hero, id) => levels[`${hero}:${id}`] ?? 0,
    era: 4,
    cash: 1e18,
    price: (_hero, node) => treePrice(node, levels[node.id] ?? 0),
    ...over,
  }
}

const node = (hero: TreeHero, id: string): TreeNode => {
  const n = treeNode(hero, id)
  if (!n) throw new Error(`${hero}:${id}`)
  return n
}

/**
 * The demo's rules (parents, forks, eras, cash) are about the *board*, not about
 * what a node does, so they are tested on a node dressed as a built one. Whether
 * a node is built is its own claim, below.
 */
const asBuilt = (n: TreeNode): TreeNode => ({ ...n, coord: n.coord ?? 1 })

describe('§8 — the five trees are well formed', () => {
  for (const hero of TREE_HEROES) {
    const tree = TREES[hero]
    it(`${hero}: one root, unique ids and cells`, () => {
      expect(tree.filter((n) => n.kind === 'root')).toHaveLength(1)
      expect(new Set(tree.map((n) => n.id)).size).toBe(tree.length)
      expect(new Set(tree.map((n) => `${n.x},${n.y}`)).size).toBe(tree.length)
    })

    it(`${hero}: every edge and link lands on a real node`, () => {
      for (const n of tree) {
        for (const p of n.parents) expect(treeNode(hero, p), `${n.id} ← ${p}`).toBeDefined()
        if (n.kind === 'link') {
          const target = n.to && treeNode(n.to.hero, n.to.id)
          expect(target, n.id).toBeDefined()
          expect(target!.kind).not.toBe('link')
          expect(n.to!.hero).not.toBe(hero)
        } else {
          expect(ICONS[n.icon], `${hero}:${n.id} icon ${n.icon}`).toBeDefined()
        }
      }
    })

    it(`${hero}: a pick-one is at least two nodes`, () => {
      const forks = new Map<string, number>()
      for (const n of tree) if (n.fork) forks.set(n.fork, (forks.get(n.fork) ?? 0) + 1)
      for (const [, count] of forks) expect(count).toBeGreaterThanOrEqual(2)
    })

    it(`${hero}: no connector runs under a tile it does not join`, () => {
      const occupied = new Set(tree.map((n) => `${n.x},${n.y}`))
      for (const n of tree) {
        for (const p of n.parents) {
          const cells = connectorRoute(hero, n, p)
          expect(cells.length, `${p} → ${n.id}`).toBeGreaterThanOrEqual(2)
          for (let i = 0; i + 1 < cells.length; i++) {
            const [a, b] = [cells[i], cells[i + 1]]
            // Right angles only.
            expect(a[0] === b[0] || a[1] === b[1], `${p} → ${n.id} is diagonal`).toBe(true)
            const steps = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
            for (let k = 1; k < steps; k++) {
              const x = a[0] + Math.sign(b[0] - a[0]) * k
              const y = a[1] + Math.sign(b[1] - a[1]) * k
              expect(occupied.has(`${x},${y}`), `${p} → ${n.id} crosses ${x},${y}`).toBe(false)
            }
            if (i > 0) expect(occupied.has(`${a[0]},${a[1]}`), `${p} → ${n.id} turns on a tile`).toBe(false)
          }
        }
      }
    })
  }

  it('Serena’s wired nodes are the pipeline’s catalogue, read and not copied', () => {
    for (const p of PIPELINE_TREE) {
      const n = node('serena', p.id)
      expect(n.wired).toBe(true)
      expect([n.x, n.y, n.era, n.max, n.fork, n.name]).toEqual([p.x, p.y, p.era, p.maxLevel, p.fork, p.name])
      expect(n.parents).toEqual(p.requires.length ? p.requires : ['R'])
      expect(n.all).toBe(p.requires.length > 1)
    }
    const wired = TREE_HEROES.flatMap((h) => TREES[h].filter((n) => n.wired))
    expect(wired).toHaveLength(PIPELINE_TREE.length)
  })
})

describe('§8 — the demo’s rules', () => {
  it('a root is owned, and a link is owned when its target is', () => {
    expect(levelOf(view(), 'you', node('you', 'R'))).toBe(1)
    const link = node('you', 'gJ')
    expect(levelOf(view(), 'you', link)).toBe(0)
    expect(levelOf(view({ 'james:L': 1 }), 'you', link)).toBe(1)
  })

  it('opens from its parents: any one, or every one where the tile says so', () => {
    // The Big Red Button needs Second Monitor *or* Beanbag Row.
    expect(treeRefusal(view(), 'you', asBuilt(node('you', 'y3')))).toBe('requires')
    expect(treeRefusal(view({ 'you:y2': 1 }), 'you', asBuilt(node('you', 'y3')))).toBeNull()
    // Leave Them Alone needs Hologram Founder *and* Take a Holiday.
    const both = { 'you:p5': 1 }
    expect(treeRefusal(view(both), 'you', asBuilt(node('you', 'K1')))).toBe('requires')
    expect(treeRefusal(view({ ...both, 'you:p6': 1 }), 'you', asBuilt(node('you', 'K1')))).toBeNull()
  })

  it('a pick-one closes the other side', () => {
    const taken = view({ 'you:p2': 1, 'you:p3a': 1 })
    expect(treeRefusal(taken, 'you', asBuilt(node('you', 'p3b')))).toBe('fork')
    expect(tileStateOf('fork', 0)).toBe('closed')
  })

  it('waits for its era, and for the cash', () => {
    expect(treeRefusal(view({}, { era: 0 }), 'you', asBuilt(node('you', 'm2')))).toBe('era')
    expect(treeRefusal(view({}, { cash: 0 }), 'you', asBuilt(node('you', 'y1')))).toBe('cash')
  })

  it('a levelled node stays itself while it has levels to buy', () => {
    expect(tileStateOf(null, 0)).toBe('live')
    expect(tileStateOf(null, 2)).toBe('partial+')
    expect(tileStateOf('cash', 2)).toBe('partial')
    expect(tileStateOf('maxed', 3)).toBe('owned')
  })

  it('prices a breakthrough at four nodes and a level at 1.6 more', () => {
    const plain = node('you', 'y1')
    const key = node('you', 'K1')
    expect(treePrice(plain, 1)).toBe(Math.round(treePrice(plain, 0) * 1.6))
    expect(treePrice(key, 0)).toBe(treePrice({ ...key, kind: 'node' }, 0) * 4)
  })
})

/**
 * Billy's meeting tree is the sync lever [2026-10-04, GDD §21.7.3]. The claims
 * are about shape, not about how much: buying a coordination point never lowers
 * sync, a node with no coordination does not move it, and nothing can take the
 * load to zero.
 */
describe('Billy’s coordination points raise sync', () => {
  const coordNodes = TREES.billy.filter((n) => n.coord)
  const levelsWith = (take: (n: TreeNode) => number) =>
    Object.fromEntries(coordNodes.map((n) => [`billy:${n.id}`, take(n)]))

  it('is exactly 1 with nothing bought, and for a save that has no tree levels', () => {
    expect(syncCapMultiplier({})).toBe(1)
    expect(syncCapMultiplier(undefined)).toBe(1)
  })

  it('rises with every coordination point', () => {
    expect(coordNodes.length).toBeGreaterThan(0)
    for (const n of coordNodes) {
      const next = syncCapMultiplier({ [`billy:${n.id}`]: 1 })
      expect(next).toBeGreaterThan(1)
      expect(next).toBeCloseTo(1 / COORD_LOAD_STEP ** n.coord!, 12)
    }
  })

  it('ignores nodes that carry no coordination, and levels past the maximum', () => {
    const other = TREES.billy.find((n) => !n.coord && n.kind === 'node')!
    expect(syncCapMultiplier({ [`billy:${other.id}`]: 3 })).toBe(1)
    const first = coordNodes[0]
    expect(syncCapMultiplier({ [`billy:${first.id}`]: 99 })).toBe(
      syncCapMultiplier({ [`billy:${first.id}`]: first.max }),
    )
  })

  it('compounds, so the whole column is a big cap and still finite', () => {
    const all = syncCapMultiplier(levelsWith((n) => n.max))
    expect(all).toBeGreaterThan(1.5)
    expect(all).toBeLessThan(4)
  })

  it('says what it does in the player’s words, so the board does not call it unwired', () => {
    for (const n of coordNodes) expect(n.effect).toMatch(/Sync up/)
  })
})

/**
 * §8 [2026-10-04] — **a node that takes the player's money and changes nothing
 * is a defect**, and the board used to sell dozens of them. Found by playing.
 */
describe('the board sells nothing that does nothing', () => {
  const sellable = TREE_HEROES.flatMap((h) =>
    TREES[h].filter((n) => n.kind !== 'root' && n.kind !== 'link').map((n) => [h, n] as const),
  )

  it('refuses every node that is not built, however rich the studio is and however far along', () => {
    for (const [hero, n] of sellable) {
      if (isBuilt(n)) continue
      expect(treeRefusal(view({}, { cash: 1e18, era: 4 }), hero, n), `${hero}:${n.id}`).toBe('unbuilt')
    }
  })

  it('never refuses a built node as unbuilt', () => {
    for (const [hero, n] of sellable) {
      if (!isBuilt(n)) continue
      expect(treeRefusal(view({}, { cash: 1e18, era: 4 }), hero, n), `${hero}:${n.id}`).not.toBe('unbuilt')
    }
  })

  it('leaves something to buy before Billy or Serena are in the building — THE THREAD’s cure', () => {
    // James says "open UPGRADES, buy anything". At the garage's era and the
    // price of a garage node, James's own tree has to have something for sale.
    const early = TREES.james.filter((n) => isBuilt(n) && n.era === 0 && n.kind === 'node')
    expect(early.length).toBeGreaterThan(0)
    for (const n of early) {
      expect(treeRefusal(view({}, { cash: 1e6, era: 0 }), 'james', n), n.id).toBeNull()
    }
  })

  it('counts Billy’s arrival as a point, so his root is a net gain for the careful player', () => {
    expect(syncCapMultiplier({}, true)).toBeCloseTo(1 / COORD_LOAD_STEP ** BILLY_ARRIVAL_POINTS, 12)
    expect(syncCapMultiplier({}, true)).toBeGreaterThan(syncCapMultiplier({}, false))
  })

  it('counts every tree’s coordination, James’s included', () => {
    const j = TREES.james.find((n) => n.coord)!
    expect(syncCapMultiplier({ [`james:${j.id}`]: 1 })).toBeGreaterThan(1)
  })
})
