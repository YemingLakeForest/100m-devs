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
 * **All five are wired.** Three of them said "not yet implemented" on the card
 * for as long as the tree existed, which was the honest thing to do at the time
 * and a bad thing to ship: a tree whose top half is a promise is a tree the
 * player stops climbing. Meeting Ban needed §11's standup to exist before it
 * had anything to cancel, and now it does.
 *
 * Two §13.2 nodes are still absent rather than inert — L1-3B Subatomic
 * Auto-Poker and L1-4B Story Point Inflation. The auto-poker is an idle layer
 * for the clicker and wants §4.9's context-switch penalty measured against it
 * before it is priced; Story Point Inflation moves the §4.6 ladder that §11.3's
 * estimation sub-branch now owns, and two systems raising the same tier is how
 * a player ends up paying twice for one step. Both are deferred decisions, not
 * forgotten ones.
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
    effect: 'Cancels the Daily Standups pause — you keep the ceiling, they lose the meeting',
  },
  {
    id: 'L1-3A',
    name: 'Zero-Trust Architecture',
    branch: 'async',
    depth: 2,
    baseCost: 2_500,
    maxLevel: 1,
    effect: 'Nobody goes rogue. The refactor into a dead language never happens again',
  },
  {
    id: 'L1-1B',
    name: 'Telepathic Compression',
    branch: 'protocol',
    depth: 0,
    baseCost: 25,
    maxLevel: 10,
    effect: '+10× developer capacity per level',
  },
  {
    id: 'L1-2B',
    name: 'Chained Poke Reaction',
    branch: 'protocol',
    depth: 1,
    baseCost: 500,
    maxLevel: 3,
    effect: 'A poke shockwaves into 1 more row of developers per level',
  },
]

/**
 * The nodes whose effects are actually wired — now all of them.
 *
 * Kept rather than deleted, and kept as a *set of ids* rather than a boolean
 * flag on the node, because it is the thing `ParadigmTree.tsx` asks before it
 * prints a warning on a card. Emptying it silently would remove the mechanism
 * that made shipping an inert node visible; a test asserts it covers the tree,
 * so the next node added to `PARADIGM_TREE` without an effect fails the build
 * rather than taking somebody's Bandwidth Points.
 */
export const EFFECTIVE = new Set(['L1-1A', 'L1-1B', 'L1-2A', 'L1-2B', 'L1-3A'])

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

/** The cheapest thing the player cannot buy yet, and how far off it is. */
export interface NextRung {
  node: ParadigmNode
  cost: number
  /** Bandwidth Points still needed. Always at least 1 — an affordable node is not a rung. */
  short: number
}

/**
 * **What you are saving for, and how close you are** — §13.12.4, §3.1.1.
 *
 * The prestige screen already shows a live *"THIS RUN IS WORTH n BP"* quote, and
 * its own note says why: watching that number climb is the argument for playing
 * another twenty minutes. What it never showed is the other half of the
 * sentence — *worth n BP **towards what***. The player was left holding a number
 * and a tree of prices and doing the subtraction themselves, on a screen whose
 * entire job is to make them want one more run.
 *
 * Ending a run a little short of something you want is the thing that starts the
 * next one. It cannot do that while it is arithmetic homework.
 *
 * Returns the **cheapest unaffordable** node rather than the deepest or the best.
 * That is deliberate and it is not a recommendation engine: the cheapest thing
 * out of reach is the one a near-miss is actually about, and picking a "best"
 * node would mean this file having an opinion about how to play, which §13.2's
 * two branches exist to leave open.
 *
 * Null when the tree is maxed, or when the player can already afford something —
 * a screen that says "you are 0 short" is a screen shouting at somebody who has
 * already won. `ParadigmTree` renders nothing in that case and lets the lit,
 * buyable nodes speak for themselves.
 */
/**
 * The cheapest node this many Bandwidth Points **would** buy, or null.
 *
 * The other side of {@link nextRung}, and the two are exhaustive: at any wallet
 * and any tree exactly one of them is non-null, unless the tree is maxed. The
 * prestige screen uses this to finish the sentence when a shift crosses the
 * line — *"NEW BP THIS SHIFT 16 · THAT BUYS TELEPATHIC COMPRESSION"* — which
 * is the version of the offer that is about the decision rather than about
 * arithmetic.
 *
 * Cheapest rather than best, for the same reason {@link nextRung} is: naming a
 * "best" node would be this file having an opinion about how to play, and
 * §13.2's two branches exist precisely to leave that to the player.
 */
export function cheapestAffordable(
  levels: Readonly<Record<string, number>>,
  bp: number,
): ParadigmNode | null {
  const held = Number.isFinite(bp) ? Math.max(0, bp) : 0
  let best: { node: ParadigmNode; cost: number } | null = null
  for (const node of PARADIGM_TREE) {
    const level = Math.max(0, levels[node.id] ?? 0)
    if (level >= node.maxLevel) continue
    const cost = nodeCost(node, level)
    if (cost > held) continue
    if (!best || cost < best.cost) best = { node, cost }
  }
  return best?.node ?? null
}

export function nextRung(levels: Readonly<Record<string, number>>, bp: number): NextRung | null {
  const held = Number.isFinite(bp) ? Math.max(0, bp) : 0
  let best: NextRung | null = null
  for (const node of PARADIGM_TREE) {
    const level = Math.max(0, levels[node.id] ?? 0)
    if (level >= node.maxLevel) continue
    const cost = nodeCost(node, level)
    // Something affordable is not a near miss; it is a purchase the player has
    // not made yet, and the board already draws it lit.
    if (cost <= held) return null
    if (!best || cost < best.cost) best = { node, cost, short: cost - held }
  }
  return best
}

/** §4.2's tuning. */
export const D_BASE = 100

/**
 * §4.2 — **what one level of Telepathic Compression multiplies the cap by.**
 *
 * It was `D_BASE * (1 + 1000 * L^1.35)`, and that curve is a cliff followed by a
 * plateau: level 1 is ×1,001, level 2 adds ×2.5, and by level 5 a level is worth
 * ×1.2. Only the first one ever mattered.
 *
 * Measured (§14.8, `pacing.test.ts`), that reads as a pacing hole you can see
 * from orbit. Runs 2 to 6 crawled at ×1.1 a run — cap 100, 116, 116, 131, 150,
 * 150 — because a shift yielded 12 BP and this node costs 25, so the player
 * bought Async-First levels instead. Then run 7 bought it, the cap went to
 * 150,526 in a single purchase, and the run outgrew a two-hour horizon.
 * **Six four-minute runs and then a two-hour one, with nothing in between**,
 * against §13.12.1's fifteen-to-forty-five-minute early loop.
 *
 * Geometric instead: every level is one clean order of magnitude, and every
 * level is *fillable*, which the old level 1 emphatically was not. It also keeps
 * the tree solvent — §14.1's BP grows as `R^0.2 · log10(peak)`, so a ×10 cap is
 * worth about ×2.1 BP against §14.2's ×1.5 per level. The tree stays slightly
 * ahead of its own prices for ever, which is the property a prestige ladder
 * needs and the old curve lost after its first rung.
 */
export const CAP_STEP = 10

/**
 * The developer cap after prestige — §4.2, **the only defence against §4.1**.
 *
 * $$D_{cap} = D_{base}\\,(1 + \\mu \\cdot \\text{BP}_{alloc}^{\\phi})$$
 *
 * `L` is levels of Telepathic Compression, not BP spent. **One level is one
 * order of magnitude**, replacing "+1,000× for the first level and a rounding
 * error thereafter" — {@link CAP_STEP} carries the measurement that condemned
 * that curve.
 *
 * The claim it gives up is worth naming, because it was a good one: the old
 * shape made *the second prestige the one that changes the game*, which beats
 * ten that each change it slightly. That is still true and it is now true ten
 * times rather than once — the run after every level is visibly a different
 * game, instead of one enormous step and a long silence.
 *
 * Async-First divides the communication load, and dividing the load is exactly
 * multiplying the cap — §4.1 only ever sees the ratio — so it lands here rather
 * than in a second, parallel adjustment nobody would remember to apply.
 */
export function devCapFor(levels: Readonly<Record<string, number>>): number {
  const compression = Math.max(0, Math.floor(levels['L1-1B'] ?? 0))
  const async = Math.min(5, Math.max(0, levels['L1-1A'] ?? 0))
  const base = D_BASE * CAP_STEP ** compression
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
  // Floor first, then reject a non-finite result: `Math.max(0, NaN)` is `NaN`,
  // so a corrupt save level would otherwise become a `NaN` loop bound.
  const n = Math.floor(levels['L1-2B'] ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(3, n))
}
