/**
 * The in-run tech tree — GDD §11, bought with cash.
 *
 * **Until this existed, cash had one sink: people.** Every dollar the studio
 * earned could only be spent making the studio worse, which is a joke that
 * lands exactly once and then leaves the player holding a treasury with nothing
 * to do about the thing that is killing them. §11's opening line is the whole
 * design — *"upgrading Workforce without Communication Infra rapidly triggers
 * the Communication Entropy Trap"* — and it only means anything if
 * Communication Infra is something you can actually buy.
 *
 * Everything here is pure. The store owns *when* a node is bought; this owns
 * what the tree costs and what owning it does.
 *
 * ---
 *
 * ## What is not here, and why
 *
 * **§11.1's Branch A — Workforce Scale — is deliberately not shipped.** Its five
 * nodes add developers on their own (*"+10 Devs/sec"*, *"+1,000,000 Devs/sec"*),
 * and in this build hiring is §10.10's dial: a chosen act, priced by §4.10a and
 * paid for forever by §4.10d's payroll. An upgrade that spawns free developers
 * per second deletes the price of a hire, and with it §6's trap — which only
 * works because the player *decides* to hire the hundredth person. Branch A is a
 * different game's idle layer wearing this game's names, and adding it would
 * quietly repeal the thesis. The hire dial **is** the workforce branch.
 *
 * The late nodes of the two shipped branches (B5 Anti-AI Slop Filter, B6 Quantum
 * Entanglement Sync, C3–C5) are also absent, for the ordinary reason: they act
 * on systems that do not exist — code-bloat entropy, notification bubbles you
 * can swipe, frame stutter at relativistic ship rates. **A node that takes the
 * player's money and changes nothing is a defect**, and this project already
 * refuses to ship one (see `EFFECTIVE` in `prestige.ts`). A shorter honest tree
 * beats a complete inert one.
 *
 * ## The one documented conflict
 *
 * §11.2's B4 row says the entropy cap is 60% and is marked `[CONFLICT: elsewhere
 * 75%]`. Resolved to **60%**, because the table is the specific statement and
 * because B4 costs four thousand times what B2 does — a cap that only improved
 * from 80% to 75% for that money would be the most expensive node in the branch
 * doing the least. Recorded here rather than silently picked.
 */

/** §11's two shipped branches. Branch A is discussed in the module note. */
export type TechBranch = 'protocol' | 'culture'

export interface TechNode {
  /** §11's own node label — `B1`, `C6`. Stable; it is what the save stores. */
  id: string
  branch: TechBranch
  name: string
  /** §11's flavour column, verbatim. It is half the reason the tree exists. */
  flavour: string
  /** What it does, in the player's language. */
  effect: string
  baseCost: number
  /** §11.0's multiplier. */
  mult: number
  maxLevel: number
  /** The node that must be owned first. Branch chains, not a shop. */
  requires?: string
}

/**
 * The tree — §11.2 and §11.3, with costs and multipliers verbatim.
 *
 * The prerequisites are not decoration. §11.3's estimation sub-branch is a
 * *ladder* (F1 → F2 → F3 …), so it can only be climbed in order, and §11.2's
 * protocol branch is drawn as a chain in the section's own diagram. Making them
 * chains is also what stops the tree being a list of things to buy in cost
 * order, which is what a flat shop degenerates into.
 */
export const TECH_TREE: readonly TechNode[] = [
  // --- Branch B — Communication Protocols (§11.2) --------------------------
  {
    id: 'B1',
    branch: 'protocol',
    name: 'Voice Shouting',
    flavour: 'Yelling across the desk cluster. Cheap, loud, horribly inefficient.',
    effect: 'Communication load −5% per level',
    baseCost: 50,
    mult: 1.08,
    maxLevel: 5,
  },
  {
    id: 'B2',
    branch: 'protocol',
    name: 'Daily Standups',
    flavour: 'Force developers to stand up so meetings end faster.',
    effect: 'Entropy can never pass 80% — but every minute, a fifth of the studio stops for 5s',
    baseCost: 2_500,
    mult: 1.12,
    maxLevel: 1,
    requires: 'B1',
  },
  {
    id: 'B3',
    branch: 'protocol',
    name: 'Pair Programming',
    flavour: 'Two coders, one keyboard. Half the typing, twice the passive-aggressive commentary.',
    effect: 'Half the studio codes — communication load −60%, and every game earns double',
    baseCost: 75_000,
    mult: 1.14,
    maxLevel: 1,
    requires: 'B2',
  },
  {
    id: 'B4',
    branch: 'protocol',
    name: 'JIRA Ticket Flooding',
    flavour: 'Requires three approvals, an epic, and a sprint planning session to change a button colour.',
    effect: 'Entropy can never pass 60%',
    baseCost: 10_000_000,
    mult: 1.15,
    maxLevel: 1,
    requires: 'B3',
  },

  // --- Branch C — Culture & Juice (§11.3) ----------------------------------
  {
    id: 'C1',
    branch: 'culture',
    name: 'Nitro Cold Brew Drips',
    flavour: 'Direct intravenous caffeine delivery.',
    effect: 'Poking a developer in Flow no longer breaks it',
    baseCost: 100,
    mult: 1.09,
    maxLevel: 1,
  },
  {
    id: 'C2',
    branch: 'culture',
    name: 'Ergonomic Chairs',
    flavour: 'Mesh lumbar support delays existential corporate dread.',
    effect: 'Overwhelmed developers recover 30% faster',
    baseCost: 10_000,
    mult: 1.11,
    maxLevel: 1,
    requires: 'C1',
  },
  {
    id: 'C6',
    branch: 'culture',
    name: 'Sandbagging',
    flavour: 'Every estimate doubles on the way to the planning meeting, as tradition demands.',
    effect: 'Estimates climb to 2 story points a poke',
    baseCost: 2_000,
    mult: 1.1,
    maxLevel: 1,
    requires: 'C1',
  },
  {
    id: 'C7',
    branch: 'culture',
    name: 'Planning Poker',
    flavour: 'Everyone reveals a card at once so nobody can be individually blamed for the number.',
    effect: 'Estimates climb to 3 story points a poke',
    baseCost: 250_000,
    mult: 1.13,
    maxLevel: 1,
    requires: 'C6',
  },
  {
    id: 'C8',
    branch: 'culture',
    name: 'Velocity Inflation',
    flavour:
      'Last sprint we did 40 points. This sprint we will also do 40 points. The points are smaller now.',
    effect: 'Estimates climb to 5 story points a poke, and the velocity readout reads 10% higher',
    baseCost: 80_000_000,
    mult: 1.17,
    maxLevel: 1,
    requires: 'C7',
  },
  {
    id: 'C9',
    branch: 'culture',
    name: 'Consultant Estimates',
    flavour: 'An external firm assessed the work at eight points and invoiced for eleven.',
    effect: 'Estimates climb to 8 story points a poke — and they take 10% of all revenue',
    baseCost: 400_000_000,
    mult: 1.21,
    maxLevel: 1,
    requires: 'C8',
  },
  {
    id: 'C10',
    branch: 'culture',
    name: 'Definition of Done (Ambiguous)',
    flavour: "It's basically done. It just needs testing, documentation, and to actually work.",
    effect: 'Every game ships at 95% of its commitment',
    baseCost: 100_000_000_000_000,
    mult: 1.24,
    maxLevel: 1,
    requires: 'C9',
  },
]

export const TECH_BY_ID = new Map(TECH_TREE.map((n) => [n.id, n]))

/** §11.0 — `Cost(N) = BaseCost × Multiplier^N`, for the *next* level. */
export function techCost(node: TechNode, currentLevel: number): number {
  return Math.round(node.baseCost * node.mult ** Math.max(0, currentLevel))
}

/**
 * Levels by node id.
 *
 * Optional, and every reader here tolerates its absence. Not defensive
 * programming for its own sake: this is read from `GameState` on the hot path
 * by `currentEfficiency`, and §24's restore, the offline resolver and every
 * test that builds a partial state can all present a state object assembled
 * before this field existed. An absent tree means an empty one, and the
 * alternative is a `TypeError` thrown from inside the entropy equation.
 */
export type TechLevels = Readonly<Record<string, number>> | undefined

export function techLevel(levels: TechLevels, id: string): number {
  return Math.max(0, Math.floor(levels?.[id] ?? 0))
}

/** Is this node's prerequisite satisfied? */
export function techUnlocked(node: TechNode, levels: TechLevels): boolean {
  return node.requires === undefined || techLevel(levels, node.requires) > 0
}

export function canBuyTech(node: TechNode, levels: TechLevels, cash: number): boolean {
  const level = techLevel(levels, node.id)
  if (level >= node.maxLevel) return false
  if (!techUnlocked(node, levels)) return false
  return cash >= techCost(node, level)
}

// --- what the tree does ----------------------------------------------------

/**
 * Everything the rest of the simulation needs to know about the tree, as one
 * object computed in one place.
 *
 * A single derived struct rather than a query per node, because these are read
 * on the hot path — `currentEfficiency` runs several times a frame — and
 * because it puts every §11 effect on one screen where a reader can see them
 * interact. Node IDs stay inside this file for the same reason `prestige.ts`
 * exports verbs.
 */
export interface TechEffects {
  /**
   * Multiplies §4.2's developer capacity.
   *
   * **Reducing communication load and raising the cap are the same operation.**
   * §4.1 only ever sees the ratio `D / D_cap`, so a node that says "−5%
   * communication load" is a node that says "×1/0.95 capacity", and expressing
   * it as a capacity keeps every §11 protocol node in one term instead of
   * adding a second, parallel adjustment somewhere else in the equation. It is
   * the same move `prestige.ts` makes for Async-First Culture.
   */
  devCapMultiplier: number
  /** §11.2 — entropy is not allowed above this. 1 is uncapped. */
  entropyCap: number
  /** §11.2 B3 — the fraction of the studio actually at a keyboard. */
  activeDevFraction: number
  /** §11.2 B3 and §11.3 C9, multiplied together. */
  revenueMultiplier: number
  /** §4.6's ladder tier, 1-indexed. */
  estimationTier: number
  /** §11.3 C1 — a poke no longer ends Flow. This is the old `hasCultureUpgrade`. */
  flowSurvivesPoke: boolean
  /** §11.3 C2 — scales the Overwhelmed lockup's duration. */
  overwhelmedScale: number
  /** §11.3 C8 — cosmetic only, and deliberately so. */
  velocityDisplayScale: number
  /** §11.3 C10 — a game ships at this fraction of its commitment. */
  commitmentFraction: number
  /** §11.2 B2 — the studio stops for a meeting on a cycle. */
  standups: boolean
}

/** Nothing bought. Every field is its own identity, so an empty tree changes nothing. */
export const NO_TECH: TechEffects = {
  devCapMultiplier: 1,
  entropyCap: 1,
  activeDevFraction: 1,
  revenueMultiplier: 1,
  estimationTier: 1,
  flowSurvivesPoke: false,
  overwhelmedScale: 1,
  velocityDisplayScale: 1,
  commitmentFraction: 1,
  standups: false,
}

export function techEffects(levels: TechLevels): TechEffects {
  if (levels === undefined) return NO_TECH
  const b1 = techLevel(levels, 'B1')
  const b2 = techLevel(levels, 'B2') > 0
  const b3 = techLevel(levels, 'B3') > 0
  const b4 = techLevel(levels, 'B4') > 0
  const c1 = techLevel(levels, 'C1') > 0
  const c2 = techLevel(levels, 'C2') > 0
  const c8 = techLevel(levels, 'C8') > 0
  const c9 = techLevel(levels, 'C9') > 0
  const c10 = techLevel(levels, 'C10') > 0

  // −5% load per level compounds: five levels is 0.95^5 of the load, which is
  // a 1.29x capacity and not a 1.25x one. Compounding rather than summing also
  // means the node can never reach zero load, which a summed −5%×20 would.
  const b1Cap = 1 / 0.95 ** Math.min(b1, 5)
  // §11.2 B3 — "cuts Entropy growth by 60%", so 40% of the load remains.
  const b3Cap = b3 ? 1 / 0.4 : 1

  // The tightest cap wins. They are not multiplied: two caps are two ceilings,
  // and the lower ceiling is simply the ceiling.
  const entropyCap = b4 ? 0.6 : b2 ? 0.8 : 1

  /**
   * §11.3's estimation ladder. Each node states its own absolute tier rather
   * than "+1", so buying out of order — which the prerequisites forbid, but
   * which a loaded save from a future build could still present — cannot
   * produce a tier nobody designed.
   */
  const estimationTier = c9 ? 5 : c8 ? 4 : techLevel(levels, 'C7') > 0 ? 3 : techLevel(levels, 'C6') > 0 ? 2 : 1

  return {
    devCapMultiplier: b1Cap * b3Cap,
    entropyCap,
    activeDevFraction: b3 ? 0.5 : 1,
    revenueMultiplier: (b3 ? 2 : 1) * (c9 ? 0.9 : 1),
    estimationTier,
    flowSurvivesPoke: c1,
    overwhelmedScale: c2 ? 0.7 : 1,
    velocityDisplayScale: c8 ? 1.1 : 1,
    commitmentFraction: c10 ? 0.95 : 1,
    standups: b2,
  }
}

// --- §11.2 B2, the standup pause -------------------------------------------

/** The meeting comes round this often. §11.2: "every 60s". */
export const STANDUP_PERIOD_S = 60
/** And lasts this long. §11.2: "20% of devs freeze for 5s". */
export const STANDUP_LENGTH_S = 5
export const STANDUP_SHARE = 0.2

/**
 * The fraction of the studio at a keyboard right now — §11.2 B2.
 *
 * **This is the satire made mechanical**, and it is the reason B2 is worth
 * building rather than stubbing: the node's headline is a hard ceiling on
 * Entropy, which is enormous, and its cost is that the company stops to talk
 * about itself on a timer forever. A player who buys it feels the velocity
 * readout dip every minute and can do nothing about it — until §13.2's Meeting
 * Ban, which is the single most satisfying purchase the prestige tree offers
 * precisely because the pause was real.
 *
 * Pure in the elapsed time so it can be tested without a clock, and phase-based
 * rather than event-based so a reload mid-meeting resolves to the same answer
 * the simulation would have reached.
 */
export function standupFactor(elapsedSeconds: number, active: boolean): number {
  if (!active || !Number.isFinite(elapsedSeconds)) return 1
  const phase = elapsedSeconds % STANDUP_PERIOD_S
  return phase < STANDUP_LENGTH_S ? 1 - STANDUP_SHARE : 1
}

/** Whether a meeting is happening — for the HUD to say so. */
export function inStandup(elapsedSeconds: number, active: boolean): boolean {
  return standupFactor(elapsedSeconds, active) < 1
}
