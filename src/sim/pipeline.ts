/*
 * Copied from the rebuild (100m-devs-three/src/sim/pipeline.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The build queue** — GDD §10.7 [amended 2026-10-04, Build and Test decommissioned].
 *
 * *"Code, Build, Test should be decommissioned. As soon as one sprint is done,
 * it's in the build queue, waiting to be shipped by the person or
 * automatically."*
 *
 *     Code → the queue → SHIP!
 *
 * A finished project goes **straight into the queue** and the next project
 * starts at once. There is no Build lane and no Test lane any more — they were
 * latency, and latency was only ever a way of making the queue hold builds the
 * player could not yet ship. What is left is the contest the queue was always
 * for, and it is two numbers: how fast the studio turns out games, and how many
 * it can hold while it waits for somebody to ship them. **A full queue stops the
 * floor** (canon since 2026-09-16): velocity, the founder's desk and every poke
 * read zero until something ships.
 *
 * ## SHIP! and auto-ship
 *
 * *"we start of have to manual ship our selves, like the scritchy game, but
 * upgrade from Serena make it auto"*. SHIP! is the player's press until
 * Serena's second rank, Auto-Ship. It then fires on its own clock, and the
 * clock is upgraded separately: an auto-shipper slower than the studio lets the
 * queue creep up and eventually stops the floor, which is the Scritchy Scratchy
 * tension kept after automation. No bonus for shipping by hand (assumed in the
 * handoff; to confirm with the user).
 *
 * ## Serena's pipeline nodes
 *
 * The board is the pipeline half of Serena's tree in the upgrade-trees demo the
 * user approved for its presentation (`docs/design/garage-to-galaxy-2026-09-24/
 * upgrade-trees/`). Its node *contents* are still a proposal. Capacity (the
 * queue gets longer), flow (Auto-Ship, and how often) and quality (a check on
 * the way in, which takes defects off a build as it joins the queue) are what
 * the queue is. **The build-speed node, Faster Laptops, is deleted** [2026-10-04]:
 * its only effect was how long a build spent in Build, and there is no Build.
 * Build Cache and Parallel Tests keep what else they did — they move the
 * coordination ledger (§2.7) — and lose the line about speeds. Canary Worlds and
 * Builds in Flight wait for worlds (phase 7), because a node that changes
 * nothing is a defect.
 *
 * Pure — no store, no clock, no renderer.
 */
import type { CoordKind, Fix } from './dysfunction.ts'

// --- auto-ship --------------------------------------------------------------

/** Seconds between auto-ships at rank II with no speed bought. Slower than a garage build on purpose. */
export const AUTO_SHIP_BASE_SECONDS = 120
/** Each Auto-Ship Speed level divides the interval by this. */
export const AUTO_SHIP_STEP = 1.35

// --- Serena's pipeline nodes ------------------------------------------------

export type PipelineFamily = 'capacity' | 'tooling' | 'quality' | 'flow'

export interface PipelineNode {
  id: string
  name: string
  family: PipelineFamily
  /** The demo's line, or ours where the node is new. */
  effect: string
  flavour: string | null
  /**
   * Board cell — Serena's isometric tree (`sim/upgradeTrees.ts`) reads it from
   * here. [2026-09-26] Orbital Ring turns the corner to (3, 1) and Continuous
   * Everything sits at (4, −2): the demo's cells put the breakthrough where
   * Canary Worlds stands and ran its Build Farm connector through a tile.
   */
  x: number
  y: number
  /** The era (`sim/audience.ts`) the node opens in. */
  era: number
  maxLevel: number
  /** Every one of these must be owned. */
  requires: readonly string[]
  /** Nodes sharing a fork id are a pick-one: owning one closes the others. */
  fork?: string
  /** §2.7 — the move this node makes on the ledger, per level (compounded). */
  fix?: Fix
  /** The slice a breakthrough deletes 70% of. */
  breakthrough?: CoordKind
  /** Serena's rank this node is, for the card's footer. */
  rank?: 'I' | 'II'
}

export const PIPELINE_TREE: readonly PipelineNode[] = [
  // Capacity: the belt gets longer.
  { id: 's1', name: 'Shelf', family: 'capacity', rank: 'I', x: 1, y: 0, era: 0, maxLevel: 5, requires: [],
    effect: 'The buffer holds one more build per level.', flavour: 'Rank I. A full buffer stops the studio, so a longer one is a longer lunch.' },
  { id: 's2', name: 'Rack', family: 'capacity', x: 2, y: 0, era: 1, maxLevel: 5, requires: ['s1'],
    effect: 'Three more builds per level.', flavour: 'The belt in the room gets longer.' },
  { id: 's3', name: 'Build Farm', family: 'capacity', x: 3, y: 0, era: 2, maxLevel: 5, requires: ['s2'],
    effect: 'Twenty more builds per level.', flavour: 'A warehouse of machines nobody is allowed to reboot.' },
  { id: 's4', name: 'Orbital Ring', family: 'capacity', x: 3, y: 1, era: 3, maxLevel: 5, requires: ['s3'],
    effect: 'Five hundred more builds per level.', flavour: 'The belt leaves the atmosphere.' },
  // Coordination: the tooling that moves the §2.7 ledger.
  { id: 'v2', name: 'Build Cache', family: 'tooling', x: 0, y: -1, era: 1, maxLevel: 3, requires: [],
    effect: 'Waiting turns into handoffs.', flavour: 'Builds reuse what they can. Somebody has to find out who poisoned the cache.',
    fix: { cuts: 'wait', feeds: 'handoff', share: 0.15 } },
  { id: 'v3', name: 'Parallel Tests', family: 'tooling', x: 0, y: -2, era: 2, maxLevel: 1, requires: ['v2'],
    effect: 'Some waiting becomes duplicate work.', flavour: 'Tests run side by side, and some of them run twice.',
    fix: { cuts: 'wait', feeds: 'dup', share: 0.3 } },
  // Quality: the queue checks what joins it.
  { id: 'q1', name: 'Quarantine the Flaky Tests', family: 'quality', x: 0, y: 1, era: 0, maxLevel: 3, requires: [],
    effect: 'Catches 15% of a build’s defects per level as it joins the queue.', flavour: 'The test that fails on Tuesdays is moved to a folder called LATER.' },
  // Flow: SHIP! presses itself.
  { id: 'a1', name: 'Auto-Ship', family: 'flow', rank: 'II', x: 1, y: -1, era: 0, maxLevel: 1, requires: ['s1'],
    effect: `SHIP! presses itself, once every ${AUTO_SHIP_BASE_SECONDS} seconds.`, flavour: 'Rank II. You can stop clicking.' },
  { id: 'a2', name: 'Auto-Ship Speed', family: 'flow', x: 2, y: -1, era: 0, maxLevel: 5, requires: ['a1'],
    effect: `Auto-ship fires ${Math.round((AUTO_SHIP_STEP - 1) * 100)}% more often per level.`, flavour: null },
  { id: 'a3a', name: 'Ship on Friday', family: 'flow', x: 3, y: -1, era: 1, maxLevel: 1, requires: ['a2'], fork: 'E',
    effect: 'Nothing waits: auto-ship twice as often. Waiting turns into handoffs.', flavour: 'Monday goes on handing round the pager.',
    fix: { cuts: 'wait', feeds: 'handoff', share: 0.4 } },
  { id: 'a3b', name: 'Ship on Green', family: 'flow', x: 2, y: -2, era: 1, maxLevel: 1, requires: ['a2'], fork: 'E',
    effect: 'Nothing ships twice: duplicate work turns into waiting, and the queue catches another 20% of defects.', flavour: 'Everything waits for green.',
    fix: { cuts: 'dup', feeds: 'wait', share: 0.4 } },
  { id: 'K', name: 'Continuous Everything', family: 'flow', x: 4, y: -2, era: 3, maxLevel: 1, requires: ['s3', 'v3'],
    effect: 'Breakthrough: 70% of all waiting is gone.', flavour: 'The belt never stops. Nobody remembers what waiting was.',
    breakthrough: 'wait' },
]

export const PIPELINE_BY_ID: ReadonlyMap<string, PipelineNode> = new Map(PIPELINE_TREE.map(n => [n.id, n]))

export type PipelineLevels = Readonly<Record<string, number>>

export function pipelineLevel(levels: PipelineLevels | undefined, id: string): number {
  const raw = levels?.[id]
  const node = PIPELINE_BY_ID.get(id)
  if (!node || !Number.isFinite(raw)) return 0
  return Math.min(node.maxLevel, Math.max(0, Math.floor(raw as number)))
}

export interface PipelineEffects {
  /** Extra buffer slots on top of the base shelf. */
  slots: number
  /** Share of a build's defects Test removes, 0..1. */
  catches: number
  autoShip: boolean
  /** Seconds between auto-ships; Infinity without Auto-Ship. */
  autoShipSeconds: number
  fixes: readonly Fix[]
  breakthroughs: readonly CoordKind[]
}

export function pipelineEffects(levels: PipelineLevels | undefined): PipelineEffects {
  const l = (id: string) => pipelineLevel(levels, id)
  const autoShip = l('a1') > 0
  const fixes: Fix[] = []
  const breakthroughs: CoordKind[] = []
  for (const n of PIPELINE_TREE) {
    const level = l(n.id)
    if (level <= 0) continue
    // A levelled fix compounds: two levels of 15% move 1 − 0.85² of the slice.
    if (n.fix) fixes.push({ ...n.fix, share: 1 - (1 - n.fix.share) ** level })
    if (n.breakthrough) breakthroughs.push(n.breakthrough)
  }
  const caught = 1 - (1 - 0.15) ** l('q1') * (l('a3b') > 0 ? 0.8 : 1)
  return {
    slots: l('s1') * 1 + l('s2') * 3 + l('s3') * 20 + l('s4') * 500,
    catches: Math.min(0.95, Math.max(0, caught)),
    autoShip,
    autoShipSeconds: autoShip
      ? AUTO_SHIP_BASE_SECONDS / AUTO_SHIP_STEP ** l('a2') / (l('a3a') > 0 ? 2 : 1)
      : Infinity,
    fixes,
    breakthroughs,
  }
}

// --- buying -----------------------------------------------------------------

/**
 * The demo's price per era, before levels: a garage node is a few minutes of a
 * garage, and each era's is a few minutes of that era. §2.7's income floor
 * (`sim/pricing.ts`) is applied on top by the caller.
 */
export const PIPELINE_ERA_COST = [300, 20_000, 25_000_000, 50_000_000_000, 8_000_000_000_000] as const
/** Each level costs this much more than the last. The demo's number. */
export const PIPELINE_LEVEL_STEP = 1.6

export function pipelineCost(node: PipelineNode, level: number, floor = 0): number {
  const authored = PIPELINE_ERA_COST[Math.min(node.era, PIPELINE_ERA_COST.length - 1)]
    * (node.breakthrough ? 4 : 1) * PIPELINE_LEVEL_STEP ** Math.max(0, level)
  return Math.round(Math.max(authored, Number.isFinite(floor) ? floor : 0))
}

export type PipelineRefusal = 'maxed' | 'era' | 'requires' | 'fork' | 'cash' | null

/** Why a node cannot be bought, or null if it can. The one purchase rule. */
export function pipelineRefusal(node: PipelineNode, levels: PipelineLevels | undefined, cash: number, era: number, floor = 0): PipelineRefusal {
  const level = pipelineLevel(levels, node.id)
  if (level >= node.maxLevel) return 'maxed'
  if (node.era > era) return 'era'
  if (!node.requires.every(id => pipelineLevel(levels, id) > 0)) return 'requires'
  if (node.fork && PIPELINE_TREE.some(o => o !== node && o.fork === node.fork && pipelineLevel(levels, o.id) > 0)) return 'fork'
  if (!(cash >= pipelineCost(node, level, floor))) return 'cash'
  return null
}
