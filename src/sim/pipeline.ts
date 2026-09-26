/*
 * Copied from the rebuild (100m-devs-three/src/sim/pipeline.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The build pipeline** — GDD §10.7 [amended 2026-09-24, Garage to Galaxy, phase 2].
 *
 * *"I want the build pipeline to be a key part of the game, as it's a active
 * thing user had to manage for generation of revenue and a key upgradable
 * mechanism."* and *"the pipeline size is sort of provide some buffer so people
 * can leave more there like teh queue in scrichty scratch"*.
 *
 *     Code → Build → Test → buffer → SHIP!
 *
 * ## The buffer is one number
 *
 * A finished project enters Build, then Test, then waits on the shelf for
 * SHIP!. **Everything past Code counts against one capacity** — the buffer —
 * and a full buffer stops the studio writing code (§10.7, canon since
 * 2026-09-16). One number rather than a queue limit per stage, because the
 * question the player is asking is one question: *how long can I walk away?*
 * Build and Test do not add storage; they add **latency**, and a slow stage
 * holds builds inside the buffer where SHIP! cannot reach them. That is how
 * speed matters without a second capacity: a jammed Test is a shorter buffer.
 *
 * Each stage is a single lane: its head progresses, the rest wait. A stage with
 * somebody waiting is **jammed**, and the Ledger draws it orange (§11.4).
 *
 * ## What slows a stage
 *
 * Its base seconds, stretched by the size of the game (a bigger game builds
 * longer, as the log of its size, so an Earth-era build is minutes and not
 * weeks), divided by the speed bought, and multiplied by the **drag**: the
 * waiting and handoff slices of §2.1's loss. A studio that piled its
 * dysfunction into waiting (Written Culture does) feels it here — which is
 * what makes conservation (§2.7) a trade rather than a label.
 *
 * ## SHIP! and auto-ship
 *
 * *"we start of have to manual ship our selves, like the scritchy game, but
 * upgrade from Serena make it auto"*. SHIP! is the player's press until
 * Serena's second rank, Auto-Ship. It then fires on its own clock, and the
 * clock is upgraded separately: an auto-shipper slower than the studio lets the
 * buffer creep up and eventually stops the floor, which is the Scritchy
 * Scratchy tension kept after automation. No bonus for shipping by hand
 * (assumed in the handoff; to confirm with the user).
 *
 * ## Serena's pipeline nodes
 *
 * The board is the pipeline half of Serena's tree in the upgrade-trees demo the
 * user approved for its presentation (`docs/design/garage-to-galaxy-2026-09-24/
 * upgrade-trees/`). Its node *contents* are still a proposal, so this is that
 * proposal taken as phase 2's first pass, with three changes, each recorded:
 * Auto-Ship does not wait for the founder's Big Red Button (the founder's tree
 * has not been rewritten, and a link to a node that does not exist would lock
 * the node for ever); Canary Worlds and Builds in Flight wait for worlds
 * (phase 7), because a node that changes nothing is a defect; and a quality
 * node, Quarantine the Flaky Tests, is added, because the plan names quality as
 * one of the four families and the demo had none on this half.
 *
 * Pure — no store, no clock, no renderer.
 */
import type { CoordKind, Fix } from './dysfunction.ts'

// --- the stages -------------------------------------------------------------

export type Stage = 'build' | 'test'
export const STAGES: readonly Stage[] = ['build', 'test']

/**
 * Seconds a garage-sized game spends in each stage at base speed. Short on
 * purpose: the opening's *"on the shelf"* beat must not wait behind a progress
 * bar, and a laptop building a 240-point game is a few seconds.
 */
export const STAGE_BASE_SECONDS: Record<Stage, number> = { build: 4, test: 6 }

/** The game size the base seconds are for — the first rung of §4.4's ladder. */
const REFERENCE_SIZE = 240

/** How much longer a bigger game takes: 1 + log10(size / 240), never below 1. */
export function sizeFactor(size: number): number {
  const s = Number.isFinite(size) ? size : REFERENCE_SIZE
  return 1 + Math.log10(Math.max(1, s / REFERENCE_SIZE))
}

/**
 * How much the waiting and handoff slices stretch a stage. `waitingShare` is
 * the share of the headcount lost to those two slices, 0..1. Three times it,
 * so a studio losing a third of its heads to waiting builds at half speed.
 */
export function pipelineDrag(waitingShare: number): number {
  const w = Number.isFinite(waitingShare) ? Math.min(1, Math.max(0, waitingShare)) : 0
  return 1 + 3 * w
}

export function stageSeconds(stage: Stage, size: number, speed: number, drag: number): number {
  const v = Number.isFinite(speed) && speed > 0 ? speed : 1
  const d = Number.isFinite(drag) && drag >= 1 ? drag : 1
  return STAGE_BASE_SECONDS[stage] * sizeFactor(size) * d / v
}

/** One build moving through a stage. `progress` runs 0..1 on the head only. */
export interface InFlight<T> {
  item: T
  progress: number
}

export interface PipelineState<T> {
  build: InFlight<T>[]
  test: InFlight<T>[]
}

export function emptyPipeline<T>(): PipelineState<T> {
  return { build: [], test: [] }
}

export function inFlight(p: PipelineState<unknown>): number {
  return p.build.length + p.test.length
}

/** A stage with somebody waiting behind its head. §11.4 draws it orange. */
export function jammed(p: PipelineState<unknown>, stage: Stage): boolean {
  return p[stage].length > 1
}

/**
 * Advance both lanes by `dt` seconds. Returns the new state and every build
 * that left Test, in the order it left — the caller shelves them.
 *
 * `secondsFor` is asked per item and per stage, so the stage time is fixed by
 * the item's own size and by whatever speed and drag hold *now*: a speed
 * bought mid-build speeds up the rest of that build, which is what a player
 * who just paid for it expects to see.
 *
 * A build that finishes Build part-way through the step carries the rest of
 * the step into Test, and a lane that empties passes its leftover time to the
 * next head, so one long step (a backgrounded tab) moves several builds rather
 * than one per frame.
 */
export function advancePipeline<T>(
  p: PipelineState<T>,
  dt: number,
  secondsFor: (stage: Stage, item: T) => number,
): { state: PipelineState<T>; done: T[] } {
  const build = p.build.map(f => ({ ...f }))
  const test = p.test.map(f => ({ ...f }))
  const done: T[] = []
  if (!(dt > 0)) return { state: { build, test }, done }

  // Build first: what it finishes joins Test with the time left over.
  const entering: { item: T; spare: number }[] = []
  let spare = dt
  while (build.length && spare > 0) {
    const head = build[0]
    const need = (1 - head.progress) * Math.max(1e-6, secondsFor('build', head.item))
    if (need > spare) { head.progress += spare / Math.max(1e-6, secondsFor('build', head.item)); spare = 0; break }
    spare -= need
    build.shift()
    entering.push({ item: head.item, spare })
  }

  // Test runs for the whole step on whatever it already held, and each
  // arrival from Build can only start once it has arrived.
  let clock = 0
  const queue: { item: T; progress: number; readyAt: number }[] = test.map(f => ({ item: f.item, progress: f.progress, readyAt: 0 }))
  for (const e of entering) queue.push({ item: e.item, progress: 0, readyAt: dt - e.spare })
  while (queue.length && clock < dt) {
    const head = queue[0]
    clock = Math.max(clock, head.readyAt)
    if (clock >= dt) break
    const seconds = Math.max(1e-6, secondsFor('test', head.item))
    const need = (1 - head.progress) * seconds
    if (need > dt - clock) { head.progress += (dt - clock) / seconds; clock = dt; break }
    clock += need
    queue.shift()
    done.push(head.item)
  }
  return { state: { build, test: queue.map(q => ({ item: q.item, progress: q.progress })) }, done }
}

// --- auto-ship --------------------------------------------------------------

/** Seconds between auto-ships at rank II with no speed bought. Slower than a garage build on purpose. */
export const AUTO_SHIP_BASE_SECONDS = 120
/** Each Auto-Ship Speed level divides the interval by this. */
export const AUTO_SHIP_STEP = 1.35

// --- Serena's pipeline nodes ------------------------------------------------

export type PipelineFamily = 'capacity' | 'speed' | 'quality' | 'flow'

export interface PipelineNode {
  id: string
  name: string
  family: PipelineFamily
  /** The demo's line, or ours where the node is new. */
  effect: string
  flavour: string | null
  /** Board cell. */
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
  { id: 's4', name: 'Orbital Ring', family: 'capacity', x: 4, y: 0, era: 3, maxLevel: 5, requires: ['s3'],
    effect: 'Five hundred more builds per level.', flavour: 'The belt leaves the atmosphere.' },
  // Speed: the stages get faster.
  { id: 'v1', name: 'Faster Laptops', family: 'speed', x: 0, y: -1, era: 0, maxLevel: 5, requires: [],
    effect: 'Builds run 20% faster per level.', flavour: null },
  { id: 'v2', name: 'Build Cache', family: 'speed', x: 0, y: -2, era: 1, maxLevel: 3, requires: ['v1'],
    effect: 'Builds run 25% faster per level. Waiting turns into handoffs.', flavour: 'Builds reuse what they can. Somebody has to find out who poisoned the cache.',
    fix: { cuts: 'wait', feeds: 'handoff', share: 0.15 } },
  { id: 'v3', name: 'Parallel Tests', family: 'speed', x: 0, y: -3, era: 2, maxLevel: 1, requires: ['v2'],
    effect: 'Tests run twice as fast. Some waiting becomes duplicate work.', flavour: 'Tests run side by side, and some of them run twice.',
    fix: { cuts: 'wait', feeds: 'dup', share: 0.3 } },
  // Quality: Test catches what it can.
  { id: 'q1', name: 'Quarantine the Flaky Tests', family: 'quality', x: -1, y: -1, era: 0, maxLevel: 3, requires: ['v1'],
    effect: 'Test catches 15% of a build’s defects per level before it ships.', flavour: 'The test that fails on Tuesdays is moved to a folder called LATER.' },
  // Flow: SHIP! presses itself.
  { id: 'a1', name: 'Auto-Ship', family: 'flow', rank: 'II', x: 1, y: -1, era: 0, maxLevel: 1, requires: ['s1', 'v1'],
    effect: `SHIP! presses itself, once every ${AUTO_SHIP_BASE_SECONDS} seconds.`, flavour: 'Rank II. You can stop clicking.' },
  { id: 'a2', name: 'Auto-Ship Speed', family: 'flow', x: 2, y: -1, era: 0, maxLevel: 5, requires: ['a1'],
    effect: `Auto-ship fires ${Math.round((AUTO_SHIP_STEP - 1) * 100)}% more often per level.`, flavour: null },
  { id: 'a3a', name: 'Ship on Friday', family: 'flow', x: 3, y: -1, era: 1, maxLevel: 1, requires: ['a2'], fork: 'E',
    effect: 'Nothing waits: auto-ship twice as often. Waiting turns into handoffs.', flavour: 'Monday goes on handing round the pager.',
    fix: { cuts: 'wait', feeds: 'handoff', share: 0.4 } },
  { id: 'a3b', name: 'Ship on Green', family: 'flow', x: 2, y: -2, era: 1, maxLevel: 1, requires: ['a2'], fork: 'E',
    effect: 'Nothing ships twice: duplicate work turns into waiting, and Test catches another 20% of defects.', flavour: 'Everything waits for green.',
    fix: { cuts: 'dup', feeds: 'wait', share: 0.4 } },
  { id: 'K', name: 'Continuous Everything', family: 'flow', x: 3, y: -2, era: 3, maxLevel: 1, requires: ['s3', 'v3'],
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
  buildSpeed: number
  testSpeed: number
  /** Share of a build's defects Test removes, 0..1. */
  testCatch: number
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
    buildSpeed: 1.2 ** l('v1') * 1.25 ** l('v2'),
    testSpeed: l('v3') > 0 ? 2 : 1,
    testCatch: Math.min(0.95, Math.max(0, caught)),
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
