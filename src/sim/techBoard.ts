/**
 * The §11.4 board — the tree's *shape*, as opposed to its arithmetic.
 *
 * `techTree.ts` owns what a node costs and what owning it does; this file owns
 * how the tree is laid out, how it reveals itself and how a purchase is gated by
 * ring. It is pure so the three visibility states and the connector routing can
 * be pinned in tests without standing up a renderer — §11.4.2's whole argument
 * is a *reveal*, and a reveal that cannot be tested is a reveal that will regress
 * silently.
 *
 * ## The board is centre-out (§11.4.1)
 *
 * Instant Messenger is the origin, the only node the player is ever *given*. A
 * branch is a compass heading, not a column: protocol runs west, culture runs
 * north, and §11.3's estimation fork runs east out of the culture root. Every
 * connector is a straight axis-aligned segment — the degenerate case of §11.4.1's
 * "right angles only", satisfied because no two connected nodes share a diagonal.
 */

import {
  FIRST_PROTOCOL_NODE,
  TECH_BY_ID,
  TECH_TREE,
  canBuyTech,
  techLevel,
  type TechLevels,
} from './techTree.ts'

/** §11.4.2 — the three reveal states. */
export type Visibility = 'live' | 'silhouette' | 'dark'

/**
 * The node this one hangs off, on the board.
 *
 * For a node with a prerequisite that is the prerequisite. For a branch root
 * (the culture node C1 has no `requires`) it is the centre: the branch grows
 * out of Instant Messenger, which is what "centre-out" means. The centre itself
 * has no parent.
 */
export function boardParent(id: string): string | null {
  const node = TECH_BY_ID.get(id)
  if (!node || node.granted) return null
  return node.requires ?? FIRST_PROTOCOL_NODE
}

/**
 * The ids actually owned — a level above zero counts, a missing one does not.
 *
 * The granted centre is always owned: §11.5 gives Instant Messenger rather than
 * selling it, so it is the anchor the reveal grows out of whether or not a
 * `tech` map happens to spell it out (the board only ever opens post-prestige,
 * but a test or a hand-built save may present an empty map).
 */
export function ownedIds(levels: TechLevels): Set<string> {
  const out = new Set<string>()
  for (const node of TECH_TREE) {
    if (node.granted) {
      out.add(node.id)
      continue
    }
    if (levels && techLevel(levels, node.id) > 0) out.add(node.id)
  }
  return out
}

/**
 * Graph distance from the owned set, walking board parents outward.
 *
 * 0 for an owned node, 1 for a node one purchase from something owned, and so
 * on. A cycle (impossible from authored data, but the save is an input) returns
 * infinity rather than looping.
 */
export function distanceFromOwned(id: string, owned: ReadonlySet<string>): number {
  if (owned.has(id)) return 0
  let cursor: string | null = id
  let d = 0
  const seen = new Set<string>()
  while (cursor !== null) {
    if (seen.has(cursor)) return Number.POSITIVE_INFINITY
    seen.add(cursor)
    if (owned.has(cursor)) return d
    cursor = boardParent(cursor)
    d += 1
  }
  return Number.POSITIVE_INFINITY
}

/**
 * §11.4.2 — what the player sees of a node.
 *
 * | State | Meaning |
 * |---|---|
 * | `live` | Owned, or the very next purchase (prerequisite owned, ring open, affordable). Everything is shown. |
 * | `silhouette` | One node from something owned but not yet buyable — icon and price in outline, no text. |
 * | `dark` | Further out — the connector and a stub, nothing about what is on it. |
 *
 * The `live` branch delegates to {@link canBuyTech} rather than re-deriving its
 * conditions: ring gating, the granted refusal and affordability are the
 * purchase rule, and a reveal that disagreed with it would show a price on a
 * node the store refuses to sell.
 */
export function visibilityOf(
  id: string,
  levels: TechLevels,
  cash: number,
  shifts: number,
): Visibility {
  const owned = ownedIds(levels)
  if (owned.has(id)) return 'live'
  const node = TECH_BY_ID.get(id)
  if (!node) return 'dark'
  if (distanceFromOwned(id, owned) === 1) {
    return canBuyTech(node, levels, cash, shifts) ? 'live' : 'silhouette'
  }
  return 'dark'
}

/** One straight connector, in board cell units. */
export interface BoardSegment {
  from: { x: number; y: number }
  to: { x: number; y: number }
}

/**
 * The connectors, one per non-centre node, drawn from its board parent.
 *
 * Straight axis-aligned segments only. A dark node still shows its connector
 * (§11.4.2) — the board's *shape* is never hidden, only its contents — so the
 * renderer draws these before it decides what else to show.
 */
export function connectors(): BoardSegment[] {
  const out: BoardSegment[] = []
  for (const node of TECH_TREE) {
    if (node.granted) continue
    const parentId = boardParent(node.id)
    const parent = parentId ? TECH_BY_ID.get(parentId) : null
    if (!parent) continue
    out.push({ from: { x: parent.x, y: parent.y }, to: { x: node.x, y: node.y } })
  }
  return out
}

/** The board's grid extent, in cells, for sizing the pannable world. */
export function boardBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = 0
  let maxX = 0
  let minY = 0
  let maxY = 0
  for (const node of TECH_TREE) {
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x)
    minY = Math.min(minY, node.y)
    maxY = Math.max(maxY, node.y)
  }
  return { minX, maxX, minY, maxY }
}
