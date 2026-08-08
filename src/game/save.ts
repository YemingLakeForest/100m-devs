/**
 * The save document — GDD §24, against `playbook/SAVE.md`.
 *
 * The studio playbook owns the *mechanism* (§23.1b): the `SaveData` shape,
 * the `SAVE_VERSION` migration rules, last-write-wins on `savedAt`, and the
 * two-tier reconciliation. This file owns the *values* and the one decision
 * SAVE.md §3 explicitly hands back to each game — **which of our state is
 * permanent** — because "monotonic" means four different things across a set of
 * unlocked cards, a high-water headcount, a currency balance and an org chart.
 *
 * `@mercilessstudio/game-cloud` is deliberately **not wired here.** That needs
 * Firebase credentials and is its own task. What is guaranteed today is the
 * seam: {@link makeSaveData} is exactly the `serialize: (state) => SaveData`
 * contract `useGameCloud` calls, so wiring it is a `useGameCloud({ saveKey:
 * SAVE_KEY, serialize: makeSaveData })` plus a `pullAndReconcile` that runs
 * `cloud.reconcile()` -> {@link migrate} -> {@link mergePermanent} -> push the
 * union back up, in that order (SAVE.md §3). Until then, localStorage only.
 */

import Decimal from 'break_infinity.js'
import type { GameState } from './store.ts'
import type { Phase } from './onboarding.ts'
import { PHASE_ORDER } from './onboarding.ts'
import { D_BASE } from '../sim/entropy.ts'

/**
 * **1.** This game has never shipped a save, so there is no history to migrate
 * from. Inventing prior versions to look thorough would be a lie in the one
 * place a lie corrupts data. {@link migrate} still has the cumulative-block
 * shape SAVE.md §2 rule 4 requires, so the first real bump has somewhere to go.
 *
 * Bump this **whenever a field's meaning changes**, not only when one is added
 * (rule 1). A silently reinterpreted field is worse than a missing one, because
 * the defensive defaults below cannot catch it.
 */
export const SAVE_VERSION = 1

/**
 * The localStorage key, and the `game-cloud` save key.
 *
 * The `m100devs_` prefix is not decoration: SAVE.md §4 lists key collision
 * across games on a shared web origin as a trap, and in a browser build we
 * share an origin with every other studio game.
 */
export const SAVE_KEY = 'm100devs_save'

// --- the document ----------------------------------------------------------

/**
 * Run state — **last-write-wins** (SAVE.md §3). One device's session is the
 * truth, and losing this race costs a session, which is recoverable.
 *
 * This is also exactly what a Paradigm Shift throws away (§24.4). That is not a
 * coincidence; it is the reason the block exists as its own object, and it
 * makes "what does a prestige reset" a statement about a type rather than a
 * list that can drift.
 *
 * `commitment` and `burned` are **decimal strings**, never floats. They are
 * `Decimal` in the store and a 1e308 overflow written into a save is not
 * something a migration can undo.
 */
export interface RunSave {
  devs: number
  devCap: number
  cash: number
  projectIndex: number
  commitment: string
  burned: string
  /** This run only. The lifetime figure is a high-water mark in {@link MetaSave}. */
  projectsShipped: number
  hasCultureUpgrade: boolean
  tier: number
  pokeCount: number
  desperateTaps: number
  phase: Phase
  massHired: boolean
  hireMultiplier: number | 'max'
  runSeed: number
  seedTaken: boolean
  dialUnlocked: boolean
}

/**
 * Layer 1 permanence — survives a sync race and a Paradigm Shift, and is
 * **cleared by a Codebase Fork** (§13.3, §24.4).
 *
 * Permanent does not mean immortal: these are permanent against a *race* and
 * impermanent against a *player decision*. Those are different questions, and a
 * single flat "permanent" bag conflates them.
 */
export interface Layer1Save {
  /**
   * Spendable Bandwidth Points — §14.1.
   *
   * The *balance*, which a Codebase Fork clears; `meta.bpEarnedLifetime` is the
   * total, which nothing clears, because §14.3 computes GP from it and total
   * has to mean total.
   *
   * Merges by **max**, like every other high-water mark. It is not strictly a
   * high-water mark — spending lowers it — but §24.3's alternative is worse:
   * last-write-wins on a balance loses whichever device prestiged, and a player
   * who earned BP on a phone and spent it on a tablet should keep both the
   * purchase and the points.
   */
  bp: number
  /** Unlocked Paradigm Tree node IDs — merges by **union**. */
  paradigmNodes: string[]
  /** Level per node — merges by **max**. */
  paradigmLevels: Record<string, number>
}

/**
 * Meta permanence — cleared by nothing. Not a Paradigm Shift, not a Codebase
 * Fork, not a Multiverse Compiler.
 */
export interface MetaSave {
  /** Owned Hero Card IDs (§22) — union. §22.6 earns them; nothing takes them. */
  heroCards: string[]
  /** §22.4 promotion tier per card — max. */
  heroTiers: Record<string, number>
  /** §22.6 duplicates held per card — max. */
  heroDuplicates: Record<string, number>
  /**
   * §22.5 #11 — Yuki has quit "until the next Codebase Fork". Union, because
   * she is not un-owned, she is refusing to work; {@link forkPermanent} clears
   * it. This is the one piece of card state a prestige may touch, and it is a
   * repair rather than a loss.
   */
  heroQuit: string[]
  /** §22.2 slot index -> card ID. The `savedAt` winner's layout, filtered. */
  orgChart: Record<string, string>
  /** Unlocked Codebase Fork node IDs — union. */
  forkNodes: string[]
  /** Unlocked Multiverse dimensions (§17) — union. */
  dimensions: string[]
  /** §22.6 milestone flags — union. */
  milestones: string[]
  /** Purchased entitlements (MONETISATION §6–7) — union. */
  entitlements: string[]

  /** All of the following are high-water marks and merge by **max**. */
  lifetimeRevenue: number
  /** §14.1 needs D_peak for the BP yield. */
  peakDevs: number
  lifetimeProjectsShipped: number
  /**
   * §22.5 #6, *Bruno, On-Call*, is earned by accumulating 24 hours of offline
   * time. A player who banks 20 hours on a phone and 6 on a tablet has earned
   * him, and last-write-wins loses him. That is the only reason this is here.
   */
  totalOfflineSeconds: number
  /**
   * §14.3 computes GP from sqrt(BP_total), and *total* must mean total — so
   * lifetime BP survives a Codebase Fork even though the BP *balance* does not.
   * It lives here rather than in {@link Layer1Save} for exactly that reason.
   */
  bpEarnedLifetime: number
  gpEarnedLifetime: number
  pcEarnedLifetime: number
  /** §24.5 gates offline accrual on the first Paradigm Shift. Also §22.6's "every 5th". */
  paradigmShifts: number
}

export interface PermanentSave {
  layer1: Layer1Save
  meta: MetaSave
}

export interface SaveData {
  /** ALWAYS first, ALWAYS present. */
  version: number
  /**
   * Epoch ms. Load-bearing twice: it is the last-write-wins input *and* it is
   * the offline clock (§24.5). **Stamped at serialize time, never carried over
   * from a loaded save** — carrying it makes a device permanently lose every
   * race and look like its saves are being ignored (SAVE.md §4).
   */
  savedAt: number
  run: RunSave
  permanent: PermanentSave
}

// --- defaults --------------------------------------------------------------

export function emptyLayer1(): Layer1Save {
  return { bp: 0, paradigmNodes: [], paradigmLevels: {} }
}

export function emptyMeta(): MetaSave {
  return {
    heroCards: [],
    heroTiers: {},
    heroDuplicates: {},
    heroQuit: [],
    orgChart: {},
    forkNodes: [],
    dimensions: [],
    milestones: [],
    entitlements: [],
    lifetimeRevenue: 0,
    peakDevs: 0,
    lifetimeProjectsShipped: 0,
    totalOfflineSeconds: 0,
    bpEarnedLifetime: 0,
    gpEarnedLifetime: 0,
    pcEarnedLifetime: 0,
    paradigmShifts: 0,
  }
}

export function emptyPermanent(): PermanentSave {
  return { layer1: emptyLayer1(), meta: emptyMeta() }
}

// --- the permanent block's home --------------------------------------------

/**
 * The live permanent state.
 *
 * Held here rather than in `GameState` because `game-cloud` calls
 * `serialize: (state) => SaveData` and only passes the game state — so anything
 * not in `GameState` has to be pulled in by {@link makeSaveData} itself.
 * `mind-the-gap` sources its collection from storage inside `makeSaveData` for
 * exactly this reason and comments it, because it looks like a mistake
 * otherwise. This is the same shape with the storage read hoisted to a module
 * variable, since our permanent block is loaded and written as one document.
 *
 * It is deliberately mostly empty today: §11's tech tree, §13's prestige and
 * §22's cards do not exist yet. The *shape* and the merge exist now because
 * F1.1 is closed by deciding them, and because retrofitting a monotonic merge
 * onto a shipped save is how a collection gets lost.
 */
let permanent: PermanentSave = emptyPermanent()

export function getPermanent(): PermanentSave {
  return permanent
}

export function setPermanent(next: PermanentSave): void {
  permanent = next
}

// --- serialize -------------------------------------------------------------

/**
 * **The `serialize` contract `useGameCloud` calls.** Do not change its
 * signature without changing the cloud wiring with it.
 */
export function makeSaveData(state: GameState): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    run: {
      devs: state.devs,
      devCap: state.devCap,
      cash: state.cash,
      projectIndex: state.projectIndex,
      commitment: state.commitment.toString(),
      burned: state.burned.toString(),
      projectsShipped: state.projectsShipped,
      hasCultureUpgrade: state.hasCultureUpgrade,
      tier: state.tier,
      pokeCount: state.pokeCount,
      desperateTaps: state.desperateTaps,
      phase: state.phase,
      massHired: state.massHired,
      hireMultiplier: state.hireMultiplier,
      runSeed: state.runSeed,
      seedTaken: state.seedTaken,
      dialUnlocked: state.dialUnlocked,
    },
    permanent: {
      layer1: { ...permanent.layer1 },
      meta: {
        ...permanent.meta,
        // Fold the run's lifetime figures into their high-water marks at write
        // time, so a device that never reconciles still records them.
        lifetimeRevenue: Math.max(permanent.meta.lifetimeRevenue, state.lifetimeRevenue),
        peakDevs: Math.max(permanent.meta.peakDevs, state.devs),
      },
    },
  }
}

export function serialize(data: SaveData): string {
  return JSON.stringify(data)
}

/**
 * Parse, validate and migrate. Returns null for anything we will not touch —
 * unparseable, wrong shape, or from a newer client.
 */
export function deserialize(raw: string): SaveData | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const candidate = parsed as Partial<SaveData>
  // A save with no version number is not a save from version zero — it is not
  // one of ours, or it is truncated. Either way we cannot reason about it.
  if (typeof candidate.version !== 'number' || !Number.isFinite(candidate.version)) return null
  return migrate(candidate as SaveData)
}

// --- migration -------------------------------------------------------------

/**
 * Upgrade a save written by an older client — SAVE.md §2.
 *
 * **A save from a newer client returns null, never a guess.** A player on two
 * devices updates one first; the old client must decline rather than write a
 * downgraded document over a good one. Losing a session is recoverable and
 * truncating a save is not.
 *
 * New migrations slot in as **cumulative `if (version < N)` blocks, never a
 * switch** — a save can be any age, and a switch handles exactly one hop. There
 * are none yet because {@link SAVE_VERSION} is 1; the normalisers below run
 * regardless, because migrations catch known shape changes and defaults catch
 * the ones that shipped by accident.
 */
export function migrate(data: SaveData): SaveData | null {
  if (data.version > SAVE_VERSION) return null

  // v1 -> v2 and onward go here, each as its own `if (data.version < N)` block.

  return {
    version: SAVE_VERSION,
    savedAt: typeof data.savedAt === 'number' && Number.isFinite(data.savedAt) ? data.savedAt : 0,
    run: repairStrandedBait(normaliseRun(data.run)),
    permanent: normalisePermanent(data.permanent),
  }
}

/**
 * Rescue a save stranded at Act III by the old Paradigm Shift.
 *
 * `triggerParadigmShift` used to set `phase: 'act3_bait'` with **two
 * developers and no money**, so Run 2 opened at the mousetrap: the offer on
 * screen, priced at a treasury the player did not have, and the only exit from
 * that phase being `devs > 502`. The shift is fixed, and that fixes nothing for
 * anybody who already prestiged — the broken phase is *written into their save*
 * and every reload restores it.
 *
 * **A code fix that requires the player to clear localStorage is not a fix.**
 * This is the repair, and it belongs on the load path rather than in a version
 * migration because the saves are not a different *version*, they are a
 * different *shape* that the current version can still produce a file in.
 *
 * The condition is deliberately narrow. A legitimate Act III has around forty
 * developers, because that is the only way the phase machine reaches it; two
 * developers who have never mass-hired can only have arrived by prestige.
 */
function repairStrandedBait(run: RunSave): RunSave {
  const stranded = run.phase === 'act3_bait' && !run.massHired && run.devs < 10
  if (!stranded) return run
  return {
    ...run,
    phase: 'act2b_loop',
    // §10.10.2 — a prestiged player does not get the funnel again.
    seedTaken: true,
    dialUnlocked: true,
  }
}

// --- defensive defaults ----------------------------------------------------
//
// SAVE.md §2 rule 3: load defensively *within* a version too. These run on
// every load, migrated or not. They are cheap, and the alternative is a crash
// somewhere far from the load with no clue that a save caused it.

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegative(value: unknown, fallback: number): number {
  const n = num(value, fallback)
  return n < 0 ? fallback : n
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * A `Decimal` from a save string.
 *
 * `new Decimal(undefined)` yields NaN rather than throwing, and a NaN
 * commitment makes the burn-down bar silently never fill — a bug that presents
 * as "the game is broken" three screens away from its cause.
 */
export function toDecimal(value: unknown, fallback: Decimal): Decimal {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  let d: Decimal
  try {
    // break_infinity *throws* on an unparseable string and returns NaN for a
    // NaN input. Both have to be caught, and neither is obvious from the type.
    d = new Decimal(value)
  } catch {
    return fallback
  }
  return Number.isFinite(d.mantissa) && Number.isFinite(d.exponent) ? d : fallback
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  // Deduplicated: every one of these is a set (§24.3), and a duplicate entry
  // would double-count against a cost table or a milestone threshold.
  return [...new Set(value.filter((v): v is string => typeof v === 'string'))]
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/**
 * §21's phase is a closed union driving a switch with no default. A phase name
 * from a build that had different acts would fall through every case and leave
 * the script wedged, so an unrecognised one restarts the script rather than
 * trusting it.
 */
function phase(value: unknown): Phase {
  return PHASE_ORDER.includes(value as Phase) ? (value as Phase) : 'act1_poke'
}

function normaliseRun(value: unknown): RunSave {
  const r = (value ?? {}) as Partial<RunSave>
  return {
    devs: Math.max(1, Math.floor(nonNegative(r.devs, 1))),
    devCap: Math.max(1, nonNegative(r.devCap, D_BASE)),
    cash: num(r.cash, 0),
    projectIndex: Math.max(0, Math.floor(nonNegative(r.projectIndex, 0))),
    commitment: typeof r.commitment === 'string' ? r.commitment : '1000',
    burned: typeof r.burned === 'string' ? r.burned : '0',
    projectsShipped: Math.max(0, Math.floor(nonNegative(r.projectsShipped, 0))),
    hasCultureUpgrade: bool(r.hasCultureUpgrade, false),
    tier: Math.max(1, Math.floor(nonNegative(r.tier, 1))),
    pokeCount: Math.max(0, Math.floor(nonNegative(r.pokeCount, 0))),
    desperateTaps: Math.max(0, Math.floor(nonNegative(r.desperateTaps, 0))),
    phase: phase(r.phase),
    massHired: bool(r.massHired, false),
    // §10.10 — the dial's selection survives a session. Validated rather than
    // trusted: a hand-edited save naming a multiplier the dial never offers
    // would price a batch nothing in the interface can explain.
    hireMultiplier:
      r.hireMultiplier === 'max' || typeof r.hireMultiplier === 'number' ? r.hireMultiplier : 1,
    // §7.8.7 — a save without a seed is one written before identities existed.
    // It gets a fresh studio rather than a crash, which is the correct
    // migration: nobody had names to lose.
    runSeed: typeof r.runSeed === 'number' && r.runSeed > 0 ? r.runSeed : (Date.now() >>> 0),
    seedTaken: bool(r.seedTaken, false),
    dialUnlocked: bool(r.dialUnlocked, false),
  }
}

function normalisePermanent(value: unknown): PermanentSave {
  const p = (value ?? {}) as Partial<PermanentSave>
  const l1 = (p.layer1 ?? {}) as Partial<Layer1Save>
  const m = (p.meta ?? {}) as Partial<MetaSave>
  const base = emptyMeta()
  return {
    layer1: {
      bp: Math.max(0, Number(l1.bp) || 0),
      paradigmNodes: stringList(l1.paradigmNodes),
      paradigmLevels: numberMap(l1.paradigmLevels),
    },
    meta: {
      heroCards: stringList(m.heroCards),
      heroTiers: numberMap(m.heroTiers),
      heroDuplicates: numberMap(m.heroDuplicates),
      heroQuit: stringList(m.heroQuit),
      orgChart: stringMap(m.orgChart),
      forkNodes: stringList(m.forkNodes),
      dimensions: stringList(m.dimensions),
      milestones: stringList(m.milestones),
      entitlements: stringList(m.entitlements),
      lifetimeRevenue: nonNegative(m.lifetimeRevenue, base.lifetimeRevenue),
      peakDevs: nonNegative(m.peakDevs, base.peakDevs),
      lifetimeProjectsShipped: nonNegative(m.lifetimeProjectsShipped, 0),
      totalOfflineSeconds: nonNegative(m.totalOfflineSeconds, 0),
      bpEarnedLifetime: nonNegative(m.bpEarnedLifetime, 0),
      gpEarnedLifetime: nonNegative(m.gpEarnedLifetime, 0),
      pcEarnedLifetime: nonNegative(m.pcEarnedLifetime, 0),
      paradigmShifts: nonNegative(m.paradigmShifts, 0),
    },
  }
}

// --- the monotonic merge ---------------------------------------------------
//
// SAVE.md §3: `cloud.reconcile()` resolves last-write-wins, which is correct
// for run state and wrong for everything permanent, because the device that
// lost the race also loses everything it unlocked. This is our half of that
// contract — and the playbook is explicit that it cannot be inferred.

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])]
}

/** High-water merge of a `Record<string, number>` — per key, the larger wins. */
function maxMap(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
  return out
}

/**
 * Merge two permanent blocks. **Commutative and idempotent** — merging in
 * either order, any number of times, gives the same answer. Anything that is
 * not is a merge that depends on which device happened to sync first, which is
 * the bug the merge exists to prevent.
 *
 * `winner` is the last-write-wins side, and it is used for exactly one field:
 * the §22.2 org chart, which is a *layout* rather than an accumulation. Two
 * different arrangements cannot be unioned into a third that either player
 * chose, so the most recent one wins and is then filtered to the cards the
 * merge actually produced.
 */
export function mergePermanent(
  local: PermanentSave,
  remote: PermanentSave,
  winner: 'local' | 'remote' = 'remote',
): PermanentSave {
  const a = local.meta
  const b = remote.meta
  const heroCards = union(a.heroCards, b.heroCards)
  const layout = winner === 'local' ? a.orgChart : b.orgChart

  const orgChart: Record<string, string> = {}
  for (const [slot, cardId] of Object.entries(layout)) {
    // Prune placements referring to a card the merge did not produce. SAVE.md
    // §2 rule 5: a save holding IDs the build cannot resolve crashes somewhere
    // far from the load.
    if (heroCards.includes(cardId)) orgChart[slot] = cardId
  }

  return {
    layer1: {
      // §24.3 — max, like every other permanent figure. Not strictly a
      // high-water mark (spending lowers it) and the alternative is worse:
      // last-write-wins on a balance loses whichever device prestiged, and a
      // player who earned BP on a phone and spent it on a tablet should end up
      // with the purchase *and* the points rather than neither.
      bp: Math.max(local.layer1.bp, remote.layer1.bp),
      paradigmNodes: union(local.layer1.paradigmNodes, remote.layer1.paradigmNodes),
      paradigmLevels: maxMap(local.layer1.paradigmLevels, remote.layer1.paradigmLevels),
    },
    meta: {
      heroCards,
      heroTiers: maxMap(a.heroTiers, b.heroTiers),
      heroDuplicates: maxMap(a.heroDuplicates, b.heroDuplicates),
      // Union is the harsh direction for a quit flag and it is the right one:
      // Yuki quit on one device, and un-quitting her by syncing the other would
      // make §22.5's "permanently, until the next Codebase Fork" a lie.
      heroQuit: union(a.heroQuit, b.heroQuit),
      orgChart,
      forkNodes: union(a.forkNodes, b.forkNodes),
      dimensions: union(a.dimensions, b.dimensions),
      milestones: union(a.milestones, b.milestones),
      entitlements: union(a.entitlements, b.entitlements),
      lifetimeRevenue: Math.max(a.lifetimeRevenue, b.lifetimeRevenue),
      peakDevs: Math.max(a.peakDevs, b.peakDevs),
      lifetimeProjectsShipped: Math.max(a.lifetimeProjectsShipped, b.lifetimeProjectsShipped),
      totalOfflineSeconds: Math.max(a.totalOfflineSeconds, b.totalOfflineSeconds),
      bpEarnedLifetime: Math.max(a.bpEarnedLifetime, b.bpEarnedLifetime),
      gpEarnedLifetime: Math.max(a.gpEarnedLifetime, b.gpEarnedLifetime),
      pcEarnedLifetime: Math.max(a.pcEarnedLifetime, b.pcEarnedLifetime),
      paradigmShifts: Math.max(a.paradigmShifts, b.paradigmShifts),
    },
  }
}

/**
 * A spendable balance is **derived, never merged** — GDD §24.3.
 *
 * It is the one field that is neither a union nor a maximum. Two devices each
 * spend 10 BP on a different node: `max` on the balance hands back both nodes
 * *and* keeps the money, `min` confiscates a node the player legitimately
 * bought. So the balance is not stored at all. Lifetime *earned* is a
 * high-water mark; spend is **recomputed** from the merged unlock set against
 * §14.2's deterministic cost table; the remainder is clamped at zero.
 *
 * The player therefore keeps every node either device bought and pays for both
 * out of one earning history. That is deliberately generous — §22.6 already
 * establishes this game does not take things away — and it is bounded: earning
 * BP requires finishing runs, which does not parallelise across two devices
 * sharing one save.
 */
export function spendableBalance(earnedLifetime: number, spent: number): number {
  return Math.max(0, earnedLifetime - spent)
}

/** Total cost of an unlock set, at the levels held. Feeds {@link spendableBalance}. */
export function nodeSpend(
  nodes: readonly string[],
  levels: Readonly<Record<string, number>>,
  costOf: (nodeId: string, level: number) => number,
): number {
  let total = 0
  for (const id of nodes) {
    const level = Math.max(1, Math.floor(levels[id] ?? 1))
    // Levels are cumulative: owning level 3 means levels 1, 2 and 3 were paid.
    for (let l = 1; l <= level; l++) total += costOf(id, l)
  }
  return total
}

// --- prestige resets -------------------------------------------------------
//
// GDD §24.4. Each is one line because the document shape already encodes the
// answer — which is the point of splitting `permanent` by layer.

/**
 * §13.2 — a Paradigm Shift clears the run and **touches nothing permanent.**
 * That invariant is the whole reason the blocks are separate: every future
 * field only has to answer "run or permanent", and its prestige behaviour
 * follows without anyone editing this function.
 */
export function paradigmShiftPermanent(p: PermanentSave, bpEarned = 0): PermanentSave {
  const earned = Math.max(0, Math.floor(bpEarned))
  return {
    // §14.1 — the shift *pays*. Until this argument existed the function bumped
    // a counter and handed the player nothing, so Run 2 was Run 1 again.
    layer1: { ...p.layer1, bp: p.layer1.bp + earned },
    meta: {
      ...p.meta,
      paradigmShifts: p.meta.paradigmShifts + 1,
      // The balance is spendable and clearable; the lifetime total is neither,
      // because §14.3 computes GP from it.
      bpEarnedLifetime: p.meta.bpEarnedLifetime + earned,
    },
  }
}

/**
 * §13.3 — a Codebase Fork clears Layer 1 in full, and repairs Yuki (§22.5 #11,
 * who quits "permanently, until the next Codebase Fork").
 */
export function forkPermanent(p: PermanentSave): PermanentSave {
  return { layer1: emptyLayer1(), meta: { ...p.meta, heroQuit: [] } }
}

/** §13.4 — Layer 3 additionally clears the Fork node set. Cards always survive. */
export function compilerPermanent(p: PermanentSave): PermanentSave {
  const forked = forkPermanent(p)
  return { layer1: forked.layer1, meta: { ...forked.meta, forkNodes: [] } }
}

// --- localStorage ----------------------------------------------------------
//
// The transport is `game-cloud`'s job and is not wired. Local is the fallback
// path either way: SAVE.md's reconcile writes the winner to local, and a player
// with no network still has to keep their progress.

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Private-browsing modes and locked-down WebViews throw on *access*, not on
    // use. A save system that cannot save is a degraded game; one that throws
    // during module init is no game at all.
    return null
  }
}

export function readSave(): SaveData | null {
  const raw = storage()?.getItem(SAVE_KEY)
  return raw ? deserialize(raw) : null
}

export function writeSave(data: SaveData): boolean {
  try {
    storage()?.setItem(SAVE_KEY, serialize(data))
    return true
  } catch {
    // Quota exceeded, or storage disabled mid-session. Swallowed deliberately:
    // there is nothing useful the caller can do, and throwing out of a
    // `visibilitychange` handler takes the page down as the player leaves it.
    return false
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY)
  } catch {
    // See writeSave.
  }
}
