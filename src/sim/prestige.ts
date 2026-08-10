/**
 * Layer 1 prestige — GDD §13.2, §14.1, §14.2, §4.2.
 *
 * **Until this existed, a Paradigm Shift was a reset with a counter.** It
 * cleared the run, bumped `paradigmShifts`, played §21.6's James scene and gave
 * the player *nothing* — no currency was computed, none was stored, and there
 * was nothing to spend it on. Run 2 was Run 1 again, which means the game had a
 * first hour and no second one.
 *
 * Everything here is pure. The store owns when a shift happens; this owns what
 * it is worth and what that buys.
 */

/** §14.1 — the BP yield's tuning parameters. */
export const BP_REVENUE_NORMALISER = 1e12
export const BP_YIELD_SCALAR = 100
export const BP_GROWTH_EXPONENT = 0.2

/**
 * What a run was worth — §14.1.
 *
 * $$\\text{BP} = \\lfloor \\alpha \\cdot (\\$_{total} / \\$_0)^{\\gamma} \\cdot \\log_{10}(D_{peak}) \\rfloor$$
 *
 * The revenue normaliser is a **trillion**, which looks absurd against a Run 1
 * that earns about a million — and is the point. §14.1: it "ensures no
 * significant BP is earned before breaking into the mid-game corporate era".
 * The 0.2 exponent is what stops that being a wall: a millionth of the
 * normaliser still yields a sixteenth of the scalar, so a first run pays about
 * twenty BP rather than zero.
 *
 * Both terms matter and they measure different things. Revenue is *how well the
 * run went*; peak headcount is *how far it got*. A player who banks a fortune
 * at forty developers has not earned a prestige, and the logarithm is what says
 * so.
 */
export function bpFor(lifetimeRevenue: number, peakDevs: number): number {
  const revenue = Math.max(0, lifetimeRevenue)
  const peak = Math.max(1, Math.floor(peakDevs))
  if (revenue <= 0 || peak <= 1) return 0
  const scaled = (revenue / BP_REVENUE_NORMALISER) ** BP_GROWTH_EXPONENT
  const value = BP_YIELD_SCALAR * scaled * Math.log10(peak)
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/** §13.2's two branches. */
export type Branch = 'async' | 'protocol'

export interface ParadigmNode {
  id: string
  name: string
  branch: Branch
  /** §14.2's `d`. Zero is the branch root. */
  depth: number
  baseCost: number
  maxLevel: number
  /** What it says on the tin, for the tree screen. */
  effect: string
}

/**
 * The Paradigm Talent Tree — §13.2, verbatim on names, costs and max levels.
 *
 * Only the two level-one nodes have their effects wired so far, and they are
 * the two that matter: everything else in this list is a cost and a promise.
 * Shipping the tree with four inert nodes would be worse than shipping two, so
 * `effect` says plainly which is which and `EFFECTIVE` is the list that is
 * actually live.
 */
export const PARADIGM_TREE: readonly ParadigmNode[] = [
  {
    id: 'L1-1A',
    name: 'Async-First Culture',
    branch: 'async',
    depth: 0,
    baseCost: 10,
    maxLevel: 5,
    effect: '−10% communication load per level',
  },
  {
    id: 'L1-2A',
    name: 'Meeting Ban',
    branch: 'async',
    depth: 1,
    baseCost: 150,
    maxLevel: 1,
    effect: 'Removes the daily standup pause — not yet implemented',
  },
  {
    id: 'L1-3A',
    name: 'Zero-Trust Architecture',
    branch: 'async',
    depth: 2,
    baseCost: 2_500,
    maxLevel: 1,
    effect: 'Eliminates the Rogue Refactorer — not yet implemented',
  },
  {
    id: 'L1-1B',
    name: 'Telepathic Compression',
    branch: 'protocol',
    depth: 0,
    baseCost: 25,
    maxLevel: 10,
    effect: '+1,000× developer capacity per level',
  },
  {
    id: 'L1-2B',
    name: 'Chained Poke Reaction',
    branch: 'protocol',
    depth: 1,
    baseCost: 500,
    maxLevel: 3,
    effect: 'One poke wakes a row — not yet implemented',
  },
]

/** The nodes whose effects are actually wired. */
export const EFFECTIVE = new Set(['L1-1A', 'L1-1B'])

export const NODE_BY_ID = new Map(PARADIGM_TREE.map((n) => [n.id, n]))

/** §14.2 — cost of the *next* level of a node. */
export const LEVEL_MULTIPLIER = 1.5
export const DEPTH_MULTIPLIER = 2.2

export function nodeCost(node: ParadigmNode, currentLevel: number): number {
  return Math.round(
    node.baseCost * LEVEL_MULTIPLIER ** currentLevel * DEPTH_MULTIPLIER ** node.depth,
  )
}

export function canAfford(node: ParadigmNode, currentLevel: number, bp: number): boolean {
  return currentLevel < node.maxLevel && bp >= nodeCost(node, currentLevel)
}

/** §4.2's tuning. */
export const D_BASE = 100
export const CAP_MULTIPLIER = 1000
export const CAP_EXPONENT = 1.35

/**
 * The developer cap after prestige — §4.2, **the only defence against §4.1**.
 *
 * $$D_{cap} = D_{base}\\,(1 + \\mu \\cdot \\text{BP}_{alloc}^{\\phi})$$
 *
 * `BP_alloc` is levels of Telepathic Compression, not BP spent, which is what
 * §13.2's "+1,000× per level" means once μ is 1000. One level takes the cap
 * from 100 to 100,100 — an enormous jump, and correctly so: a first shift
 * yields about twenty BP and the node costs twenty-five, so nobody reaches it
 * until their *second*. **The second prestige is the one that changes the
 * game**, which is a better arc than ten that each change it slightly.
 *
 * Async-First divides the communication load, and dividing the load is exactly
 * multiplying the cap — §4.1 only ever sees the ratio — so it lands here rather
 * than in a second, parallel adjustment nobody would remember to apply.
 */
export function devCapFor(levels: Readonly<Record<string, number>>): number {
  const compression = Math.max(0, levels['L1-1B'] ?? 0)
  const async = Math.min(5, Math.max(0, levels['L1-1A'] ?? 0))
  const base = D_BASE * (1 + CAP_MULTIPLIER * compression ** CAP_EXPONENT)
  // −10% load per level, capped at −50% by §13.2's max level of 5.
  return base / (1 - 0.1 * async)
}

/** Total levels bought, for the tree screen's header. */
export function totalLevels(levels: Readonly<Record<string, number>>): number {
  let n = 0
  for (const node of PARADIGM_TREE) n += Math.max(0, levels[node.id] ?? 0)
  return n
}

// --- what the tree does to the rest of the game ----------------------------

/**
 * The queries every *other* system asks of the tree — §13.2.
 *
 * They live here, as pure functions of the levels map, for one reason: a
 * Paradigm node's effect is almost never felt in the prestige screen. Meeting
 * Ban cancels a pause that §11's tech tree creates; Zero-Trust deletes a §18
 * event; Chained Poke changes what `store.poke` lands on. If each of those
 * systems read `levels['L1-2A']` for itself, the node IDs would be spread
 * across the codebase and renaming one would be a five-file change with no
 * compiler help.
 *
 * So the tree exports *verbs*, and the ID stays in this file.
 */

/** §13.2 L1-2A — the §11 B2 standup pause is cancelled outright. */
export function meetingBanActive(levels: Readonly<Record<string, number>>): boolean {
  return (levels['L1-2A'] ?? 0) > 0
}

/** §13.2 L1-3A — the §18 Rogue Refactorer never fires again. */
export function zeroTrustActive(levels: Readonly<Record<string, number>>): boolean {
  return (levels['L1-3A'] ?? 0) > 0
}

/** §13.2 L1-2B — extra rows of developers a single poke reaches. */
export function chainedPokeRows(levels: Readonly<Record<string, number>>): number {
  return Math.max(0, Math.min(3, Math.floor(levels['L1-2B'] ?? 0)))
}
