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
 * Serena arrives.
 *
 * [amended 2026-10-16, plan phase 4.2, the user's D4] **Auto-ship comes with
 * Serena, and it is a delay, not a clock.** It was her rank-II node firing once
 * every two minutes, slower than a garage build on purpose; once §14.8.7's
 * cadence curve took a big studio's build towards thirty seconds a clock that
 * slow could not keep up at any price the board sold, so the queue filled, the
 * floor stopped, and the player went back to pressing SHIP! twice a minute for
 * the rest of the run (finding 06). A delay keeps up at every cadence: a build
 * ships {@link AUTO_SHIP_DELAY_SECONDS} after it lands (less with the speed
 * nodes), so a studio whose builds take at least that long never has more than
 * one game waiting and never stops. What the player trades for it is the date:
 * an auto-ship goes out at a neutral RC, and the ring's spotlight (×1.75 at
 * best) is only for a launch somebody plays.
 *
 * That settles the line this header carried since the handoff — *"no bonus for
 * shipping by hand (assumed; to confirm with the user)"*. Confirmed, with the
 * bonus moved where it belongs: **pressing SHIP! is worth nothing over Serena**
 * (it ships the head now, at her terms), and **playing the ring is worth what
 * the ring pays.** Offline, Serena ships every build, because nobody is there
 * to hold one.
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

/**
 * Seconds a build waits in the queue before Serena ships it, with no speed
 * bought. Under every build time §14.8.7's curve produces until its floor, so
 * she keeps up from the day she arrives; long enough that a player who wants to
 * press SHIP! themselves has a moment to.
 */
export const AUTO_SHIP_DELAY_SECONDS = 20
/** Each Auto-Ship Speed level divides the delay by this. */
export const AUTO_SHIP_STEP = 1.35

// --- HOLD and the launch ----------------------------------------------------

/**
 * [plan 2026-10-16, phase 4.5] **The least studio time one launch may cover.**
 *
 * With Serena shipping on her own, the ring is no longer every build's door; it
 * is a held batch the player chooses to launch, LAUNCH ×N, one ring for all of
 * it. A ring is a modal that stops the studio, and §14.8.7's cadence curve puts
 * a big studio's build at twenty seconds: one ring a build would be three a
 * minute (§10.8b's "slideshow of its own celebration", which the old thirty-
 * second train existed to prevent). So a launch must hold at least this much
 * work, which caps rings at 3600 / 240 = 15 an hour at any cadence, while a
 * garage-speed studio (two-minute builds) launches pairs.
 */
export const LAUNCH_HOLD_SECONDS = 240

/**
 * The smallest batch a launch may be, for builds of `buildSeconds` each: enough
 * of them to cover {@link LAUNCH_HOLD_SECONDS}. At least one; a studio with no
 * measurable cadence launches what it has.
 */
export function minimumBatch(buildSeconds: number): number {
  if (!(buildSeconds > 0) || !Number.isFinite(buildSeconds)) return 1
  return Math.max(1, Math.ceil(LAUNCH_HOLD_SECONDS / buildSeconds - 1e-9))
}

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
    effect: 'Hold one more build for a launch, per level.', flavour: 'Rank I. A launch is as big as the queue that holds it.' },
  { id: 's2', name: 'Rack', family: 'capacity', x: 2, y: 0, era: 1, maxLevel: 5, requires: ['s1'],
    effect: 'Hold three more builds for a launch, per level.', flavour: 'The belt in the room gets longer.' },
  { id: 's3', name: 'Build Farm', family: 'capacity', x: 3, y: 0, era: 2, maxLevel: 5, requires: ['s2'],
    effect: 'Hold twenty more builds for a launch, per level.', flavour: 'A warehouse of machines nobody is allowed to reboot.' },
  { id: 's4', name: 'Orbital Ring', family: 'capacity', x: 3, y: 1, era: 3, maxLevel: 5, requires: ['s3'],
    effect: 'Hold five hundred more builds for a launch, per level.', flavour: 'The belt leaves the atmosphere.' },
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
  { id: 'a1', name: 'Launch Day', family: 'flow', rank: 'II', x: 1, y: -1, era: 0, maxLevel: 1, requires: ['s1'],
    effect: 'HOLD: pause Serena and keep what lands, then LAUNCH the held queue as one release.', flavour: 'Rank II. She ships everything anyway. This is for the ones you want to be there for.' },
  { id: 'a2', name: 'Auto-Ship Speed', family: 'flow', x: 2, y: -1, era: 0, maxLevel: 5, requires: ['a1'],
    effect: `Serena ships a build ${Math.round((1 - 1 / AUTO_SHIP_STEP) * 100)}% sooner per level.`, flavour: null },
  { id: 'a3a', name: 'Ship on Friday', family: 'flow', x: 3, y: -1, era: 1, maxLevel: 1, requires: ['a2'], fork: 'E',
    effect: 'Nothing waits: Serena ships in half the time. Waiting turns into handoffs.', flavour: 'Monday goes on handing round the pager.',
    fix: { cuts: 'wait', feeds: 'handoff', share: 0.4 } },
  { id: 'a3b', name: 'Ship on Green', family: 'flow', x: 2, y: -2, era: 1, maxLevel: 1, requires: ['a2'], fork: 'E',
    effect: 'Serena ships one stage further on: GOLD, not RC. Duplicate work turns into waiting, and the queue catches another 20% of defects.', flavour: 'Everything waits for green.',
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
  /** Serena ships on her own — true from the day she arrives (D4). */
  autoShip: boolean
  /** Seconds a build waits before she ships it; Infinity without her. */
  autoShipDelay: number
  /** HOLD exists: the player may pause her and launch the held queue as one ring (a1). */
  launchDay: boolean
  /** Readiness stages her releases go out above RC (`release.pipelineLaunch`) — Ship on Green. */
  stagesUp: number
  fixes: readonly Fix[]
  breakthroughs: readonly CoordKind[]
}

/**
 * The board, folded. `serena` is whether she has arrived: auto-ship is hers,
 * not a node's [amended 2026-10-16], so the nodes only make it faster.
 */
export function pipelineEffects(levels: PipelineLevels | undefined, serena = false): PipelineEffects {
  const l = (id: string) => pipelineLevel(levels, id)
  const autoShip = serena
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
    autoShipDelay: autoShip
      ? AUTO_SHIP_DELAY_SECONDS / AUTO_SHIP_STEP ** l('a2') / (l('a3a') > 0 ? 2 : 1)
      : Infinity,
    launchDay: serena && l('a1') > 0,
    // [2026-10-16, plan phase 4.6] Ship on Green waits for green, so what she
    // ships is one stage further on. It was a catch and a ledger move only.
    stagesUp: l('a3b') > 0 ? 1 : 0,
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
