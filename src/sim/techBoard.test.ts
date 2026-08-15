import { describe, expect, it } from 'vitest'
import { TECH_BY_ID, TECH_TREE, boardCost, ringOpen, techUnlocked } from './techTree.ts'
import {
  boardBounds,
  boardParent,
  cheapestUnaffordable,
  connectors,
  distanceFromOwned,
  ownedIds,
  visibilityOf,
} from './techBoard.ts'

describe('the board graph — §11.4.1', () => {
  it('roots the culture branch at Instant Messenger', () => {
    // C1 has no `requires`, but on the board it grows out of the centre.
    expect(boardParent('C1')).toBe('B1')
  })

  it('hangs every other node off its prerequisite', () => {
    for (const node of TECH_TREE) {
      if (node.requires !== undefined) expect(boardParent(node.id)).toBe(node.requires)
    }
  })

  it('gives the centre no parent', () => {
    expect(boardParent('B1')).toBeNull()
  })
})

describe('distance from the owned set', () => {
  it('is zero for an owned node', () => {
    expect(distanceFromOwned('B1', new Set(['B1']))).toBe(0)
  })

  it('is one for the next purchase', () => {
    expect(distanceFromOwned('B2', new Set(['B1']))).toBe(1)
    expect(distanceFromOwned('C1', new Set(['B1']))).toBe(1)
  })

  it('grows along the chain', () => {
    expect(distanceFromOwned('B4', new Set(['B1']))).toBe(3)
  })
})

describe('§11.4.2 — the three reveal states', () => {
  const shifts = 5 // every ring open, so only reveal is being tested.

  it('shows an owned node live', () => {
    expect(visibilityOf('B1', { B1: 1 }, 0, shifts)).toBe('live')
  })

  it('shows the next affordable purchase live', () => {
    // C1 is ring 1, root-owned (IM granted), and $100 is affordable at 5 shifts.
    expect(visibilityOf('C1', { B1: 1 }, 1_000, shifts)).toBe('live')
  })

  it('shows the next unaffordable purchase as a silhouette', () => {
    // B2 is adjacent to owned IM but the player cannot afford it yet.
    expect(visibilityOf('B2', { B1: 1 }, 0, shifts)).toBe('silhouette')
  })

  it('shows anything further out dark', () => {
    expect(visibilityOf('B3', { B1: 1 }, 1_000_000, shifts)).toBe('dark')
  })

  it('never shows a node whose ring has not opened as live', () => {
    // B2 is ring 1: before the first shift it is a silhouette at best.
    expect(visibilityOf('B2', { B1: 1 }, 1_000_000, 0)).toBe('silhouette')
  })
})

describe('the connectors — §11.4.1, right angles only', () => {
  it('draws exactly one connector per non-centre node', () => {
    expect(connectors().length).toBe(TECH_TREE.filter((n) => !n.granted).length)
  })

  it('connects each node to its board parent', () => {
    const byChild = new Map(connectors().map((c, i) => [TECH_TREE.filter((n) => !n.granted)[i].id, c]))
    for (const node of TECH_TREE.filter((n) => !n.granted)) {
      const seg = byChild.get(node.id)!
      const parent = TECH_BY_ID.get(boardParent(node.id)!)!
      expect(seg.to).toEqual({ x: node.x, y: node.y })
      expect(seg.from).toEqual({ x: parent.x, y: parent.y })
    }
  })

  it('keeps every connector axis-aligned', () => {
    for (const seg of connectors()) {
      const horizontal = seg.from.y === seg.to.y
      const vertical = seg.from.x === seg.to.x
      expect(horizontal || vertical).toBe(true)
    }
  })

  it('bounds the whole board', () => {
    const b = boardBounds()
    for (const node of TECH_TREE) {
      expect(node.x).toBeGreaterThanOrEqual(b.minX)
      expect(node.x).toBeLessThanOrEqual(b.maxX)
      expect(node.y).toBeGreaterThanOrEqual(b.minY)
      expect(node.y).toBeLessThanOrEqual(b.maxY)
    }
  })
})

describe('ownedIds', () => {
  it('owns the granted centre even on an empty tree', () => {
    expect(ownedIds(undefined).has('B1')).toBe(true)
    expect(ownedIds({}).has('B1')).toBe(true)
  })

  it('counts levels above zero, and never the granted centre twice', () => {
    const owned = ownedIds({ B1: 1, B2: 0, C1: 3 })
    expect(owned.has('B1')).toBe(true)
    expect(owned.has('B2')).toBe(false)
    expect(owned.has('C1')).toBe(true)
  })
})

describe('§3.1.1 — what this player is stuck on', () => {
  const shifts = 9

  it('is null when the player can afford the board', () => {
    expect(cheapestUnaffordable({}, 1e12, shifts)).toBeNull()
  })

  it('names the cheapest thing money alone is blocking', () => {
    const stuck = cheapestUnaffordable({}, 0, shifts)
    expect(stuck).not.toBeNull()
    // Nothing on the board that is reachable is cheaper than what it names.
    for (const node of TECH_TREE) {
      if (node.granted || !techUnlocked(node, {}) || !ringOpen(node.ring, shifts)) continue
      expect(boardCost(node, 0, shifts)).toBeGreaterThanOrEqual(stuck!.cost)
    }
  })

  /**
   * **"Wants" is doing the work.** A node behind a closed ring or an unbought
   * prerequisite is not something the player is short of *cash* for — it is
   * something they are short of progress for, and an offer of money against it
   * would be selling a fix for the wrong problem.
   */
  it('ignores anything a ring or a prerequisite is blocking', () => {
    // Ring 0 only: nothing in ring 1 or beyond may be named, at any price.
    const stuck = cheapestUnaffordable({}, 0, 0)
    if (stuck) expect(ringOpen(stuck.node.ring, 0)).toBe(true)

    const deep = TECH_TREE.find((n) => n.requires && !n.granted)
    if (deep) {
      const named = cheapestUnaffordable({}, 0, shifts)
      // It is only ever named once its prerequisite is owned.
      if (named?.node.id === deep.id) expect(techUnlocked(deep, {})).toBe(true)
    }
  })

  it('moves on as the player buys their way past it', () => {
    const first = cheapestUnaffordable({}, 0, shifts)!
    const after = cheapestUnaffordable({ [first.node.id]: first.node.maxLevel }, 0, shifts)
    expect(after?.node.id).not.toBe(first.node.id)
  })
})
