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
import { TECH_BY_ID } from '../sim/techTree.ts'
import { BASELINE_RATING, DEFECT_DENSITY_ANCHOR, LUCK_NEUTRAL } from '../sim/rating.ts'
import { UNKNOWN_ORDINAL } from '../sim/revenue.ts'
import { GARAGE_SYNC } from '../sim/teamSync.ts'
import { ROLES, type Role } from '../sim/roles.ts'
import { INCIDENT_WORK_SECONDS } from '../sim/incidents.ts'
import { STORY_HEROES } from '../sim/storyHeroes.ts'
import { EVENTS } from '../sim/events.ts'
import { DEBUG_TOOLS_ENABLED } from '../dev/debugAccess.ts'
import {
  emptyHistory,
  mergeHistory,
  type History,
  type ReleaseRecord,
  type TitleAggregate,
} from '../sim/history.ts'

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
  /**
   * §4.10e — the back catalogue: every game still on sale and what it has paid.
   *
   * Optional, because saves written before §4.10e existed do not have it and a
   * missing catalogue is a correct description of a studio that shipped its
   * games under the old lump-payout rule — they were paid in full on ship, so
   * there is nothing outstanding. That makes this an additive field rather than
   * a reinterpreted one, which is the test `SAVE_VERSION` asks (rule 1).
   */
  releases?: ReleaseSave[]
  /**
   * §11 — levels bought in the in-run tech tree, by node id.
   *
   * Additive and optional, on the same rule `releases` follows: a save written
   * before the tree existed describes a studio that bought nothing, which is
   * exactly what an absent field means. No `SAVE_VERSION` bump — nothing that
   * was already written has been reinterpreted.
   */
  tech?: Record<string, number>
  /** §11.2 B2's meeting clock, in simulated seconds. Optional for the same reason. */
  runSeconds?: number
  /**
   * §4.11 — the hire history, run-length encoded, and the dial's role.
   *
   * Additive on the same rule as `releases` and `tech`. **An absent roster is a
   * studio of developers**, which is exactly what every save written before
   * roles existed describes, so `normaliseRoster` fills it from `devs` rather
   * than leaving it empty — an empty roster against a non-zero `devs` would put
   * every existing player's whole studio on the floor with no job.
   */
  roster?: { role: string; count: number }[]
  hireRole?: string
  /**
   * §4.12, §4.12a, §4.13, §4.14 — the three backlogs and the studio's standing.
   *
   * Absent means zero for the three queues, which is the honest reading: a save
   * from before quality existed is a studio that had not yet been charged for
   * any of it. Reputation defaults to the §4.14.1 baseline rather than to zero,
   * because a studio that has shipped nothing has a garage's reputation and
   * starting at zero would tax it for the crime of being first.
   */
  defects?: number
  tickets?: number
  reputation?: number
  incidents?: IncidentSave[]
  /**
   * §13.8 — where each hero is standing, this run.
   *
   * **Run state, not permanent**, and the split is the design rather than an
   * implementation detail: a Paradigm Shift liquidates the studio, so every rung
   * a hero was placed on stops existing. What survives is the *person* —
   * `meta.heroXp` and `meta.heroNodes`, §13.10's "a hero you have carried
   * through nine runs is better than one you just met". Where you put them is a
   * fact about a floor that no longer exists.
   *
   * Additive and optional on the same rule `releases` and `tech` follow: an
   * absent list is a studio with nobody placed, which is exactly what every save
   * written before §13.8 describes, and is also the correct opening state of
   * every run. No `SAVE_VERSION` bump.
   */
  heroPlacements?: HeroPlacementSave[]
  /**
   * §18.0 — the event on the floor, if one is.
   *
   * Persisted for the reason `incidents` is and `buffs` are not: an event is a
   * **state of the world**. It holds the studio's output at a ceiling until
   * somebody acts, so a reload that dropped it would be a reload that repaired
   * the company — and it carries the player's choice of exit, so a reload that
   * dropped that would put a modal back over somebody who had already decided.
   *
   * Additive and optional on the same rule as `releases`, `tech` and
   * `heroPlacements`: absent means a quiet floor, which is exactly what every
   * save written before §18.0 describes. No `SAVE_VERSION` bump.
   */
  event?: LiveEventSave
}

/** §18.0 — the live event, flattened. */
export interface LiveEventSave {
  id: string
  remaining: number
  age: number
  routed: boolean
}

/** §13.8 — one hero, and the rung they are standing on. */
export interface HeroPlacementSave {
  id: string
  rung: number
  index: number
  /** Simulated seconds, for §13.8's settling period. */
  placedAt: number
}

/** §4.12a — one open page, as §24 stores it. */
export interface IncidentSave {
  id: number
  releaseId: number
  releaseName: string
  age: number
  work: number
}

/** One game on sale, as §24 stores it. The shape is rolled once and kept. */
export interface ReleaseSave {
  id: number
  name: string
  payout: number
  age: number
  paid: number
  spikeShare: number
  spikeTau: number
  tailTau: number
  /**
   * §4.12a — the defect density this game shipped with, and §4.14's score.
   *
   * **Optional, and a document without them is a document from before quality
   * existed.** They default to the garage figures on load rather than to zero:
   * a release restored with `defectDensity: 0` would be a *flawless* game, so a
   * player reloading an old save would find their entire back catalogue
   * silently upgraded to perfect and their pager silent forever. The honest
   * default for "we do not know what this shipped at" is what a studio with
   * nobody checking ships at, which is exactly what §4.14.1's baseline is for.
   */
  defectDensity?: number
  rating?: number
  /**
   * §10.11 — the career ship ordinal, so the gallery can join a remembered
   * release to the money still arriving for it.
   *
   * Optional on the same additive rule as the two above. Absent means
   * `UNKNOWN_ORDINAL`: the release is still paid out exactly as before, and the
   * gallery simply falls back to the recorded payout for it rather than
   * inventing a join.
   */
  ordinal?: number
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

  /**
   * §13.7.1's Management tree — levels per node, merged by **max**.
   *
   * In `meta` rather than `layer1`, so it survives a Codebase Fork as well as a
   * Paradigm Shift. §4.5d is explicit that this curve "grows only because *you*
   * got better", and a skill you learned is not something a rewrite of the
   * company's architecture takes away. It is bought with cash — the currency
   * that is reachable in Run 1, where your desk is sometimes the only thing on
   * screen — and what persists is the *level*, never the money.
   */
  founderLevels?: Record<string, number>
  /**
   * §13.10 — hero XP, per hero id, merged by **max**.
   *
   * Permanent, beside `founderLevels`, so it survives a Paradigm Shift *and* a
   * Codebase Fork: a hero you have carried through nine runs is better than one
   * you just met. XP is the in-run currency of §13.9's tree, but the *total* is
   * a fact about the person, not about the run.
   */
  heroXp?: Record<string, number>
  /**
   * §13.9 — which tree nodes each hero owns, per hero id, merged by **union**.
   *
   * The pre-bought starting positions and every purchase since. A node is never
   * taken away; the hero only ever grows.
   */
  heroNodes?: Record<string, string[]>
  /**
   * §10.11 — the release history: what the player has actually made, career-wide.
   *
   * In `meta` rather than `layer1` so it survives a Codebase Fork and a
   * Multiverse Compiler as well as a Paradigm Shift. A release record is a
   * memory, not a currency or an unlock, and §10.11's whole premise is that the
   * gallery is where a *career* acquires a history.
   *
   * Bounded by construction: the recent window caps at {@link RECENT_KEEP} and
   * the aggregates are one per distinct title, so a million shipped games cost
   * a few dozen objects. See `sim/history.ts`.
   */
  history: History
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
    founderLevels: {},
    heroXp: {},
    heroNodes: {},
    history: emptyHistory(),
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
  // Local-browser-only inspection seam, the twin of `store.ts`'s `__store` and here for
  // the same reason. The run is visible in the HUD and the *career* is not:
  // "has this event been retired for good, or merely cleared by hand?" and
  // "which scenes has this player seen?" are both answered only in here, and
  // §26.1.8's walk has to be able to say which of the two it just watched
  // happen. Diagnosis only — the walk asserts against what is on screen.
  if (DEBUG_TOOLS_ENABLED) {
    ;(globalThis as unknown as Record<string, unknown>).__permanent = permanent
  }
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
      tech: { ...state.tech },
      runSeconds: state.runSeconds,
      // §4.10e — flattened rather than nested, so the shape cannot arrive back
      // as a half-object that `collectedFraction` would turn into NaN dollars.
      releases: state.releases.map((r) => ({
        id: r.id,
        name: r.name,
        payout: r.payout,
        age: r.age,
        paid: r.paid,
        spikeShare: r.shape.spikeShare,
        spikeTau: r.shape.spikeTau,
        tailTau: r.shape.tailTau,
        defectDensity: r.defectDensity,
        rating: r.rating,
        ordinal: r.ordinal,
      })),
      // §4.11 — the shape of the studio, not just its size.
      roster: state.roster.map((run) => ({ role: run.role, count: run.count })),
      hireRole: state.hireRole,
      // §4.12–§4.14. `incidentPending` is deliberately absent: it is at most one
      // incident's worth of fraction and §24.2 ephemeral, and restoring it would
      // be restoring a state the player cannot see the cause of.
      defects: state.defects,
      tickets: state.tickets,
      reputation: state.reputation,
      incidents: state.incidents.map((i) => ({ ...i })),
      // §13.8 — flattened out of the map, for the same reason `releases` is
      // flattened: a nested shape can come back half-formed and a half-formed
      // placement is a hero covering NaN developers.
      heroPlacements: Object.entries(state.heroPlacements).map(([id, p]) => ({
        id,
        rung: p.rung,
        index: p.index,
        placedAt: p.placedAt,
      })),
      // §18.0 — omitted entirely when the floor is quiet, so a save is not
      // carrying `event: null` for the 99% of the game where nothing is
      // happening. An absent key and a null are the same statement here and
      // the absent one is smaller.
      ...(state.event ? { event: { ...state.event } } : {}),
    },
    permanent: {
      layer1: { ...permanent.layer1 },
      meta: {
        ...permanent.meta,
        // Fold the run's lifetime figures into their high-water marks at write
        // time, so a device that never reconciles still records them.
        lifetimeRevenue: Math.max(permanent.meta.lifetimeRevenue, state.lifetimeRevenue),
        peakDevs: Math.max(permanent.meta.peakDevs, state.peakDevs, state.devs),
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

/** §13.9 — a map of hero id to owned node ids, each list defended like `stringList`. */
function stringListMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = stringList(v)
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
  // Read once, because the roster has to be reconciled *against* it — see
  // `normaliseRoster`. Recomputing the expression there would be two places
  // that have to agree about what a headcount is.
  const devs = Math.max(0, Math.floor(nonNegative(r.devs, 0)))
  return {
    devs,
    devCap: Math.max(1, nonNegative(r.devCap, D_BASE)),
    cash: num(r.cash, 0),
    projectIndex: Math.max(0, Math.floor(nonNegative(r.projectIndex, 0))),
    commitment: typeof r.commitment === 'string' ? r.commitment : '300',
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
    releases: normaliseReleases(r.releases),
    tech: normaliseTech(r.tech),
    runSeconds: nonNegative(r.runSeconds, 0),
    roster: normaliseRoster(r.roster, devs),
    hireRole: ROLE_SET.has(r.hireRole as Role) ? (r.hireRole as Role) : 'dev',
    defects: nonNegative(r.defects, 0),
    tickets: nonNegative(r.tickets, 0),
    reputation: Math.min(100, nonNegative(r.reputation, BASELINE_RATING)),
    incidents: normaliseIncidents(r.incidents),
    heroPlacements: normaliseHeroPlacements(r.heroPlacements),
    ...(normaliseEvent(r.event) ? { event: normaliseEvent(r.event)! } : {}),
  }
}

/**
 * §18.0 — the live event, validated against the events this build has.
 *
 * **An id this build does not know is dropped**, not defaulted. `eventCeiling`
 * already refuses to hold a studio down for an unknown id, and this is the
 * second half of the same guarantee: a save naming an event that has since been
 * retired from the registry comes back as a quiet floor rather than as a banner
 * with no card behind it.
 */
function normaliseEvent(value: unknown): LiveEventSave | null {
  if (typeof value !== 'object' || value === null) return null
  const e = value as Partial<LiveEventSave>
  if (typeof e.id !== 'string' || !EVENT_ID_SET.has(e.id)) return null
  // A remaining of zero is a studio held at a ceiling with nothing left to tap
  // — `clearOne` returns null rather than producing one, so a stored zero is a
  // corrupt document and the honest repair is one more reply.
  const remaining = Math.max(1, Math.floor(nonNegative(e.remaining, 1)))
  return { id: e.id, remaining, age: nonNegative(e.age, 0), routed: bool(e.routed, false) }
}

const EVENT_ID_SET = new Set<string>(EVENTS.map((e) => e.id))

/**
 * §13.8 — the placements, filtered to people who exist.
 *
 * An id that is not one of §22.8's six is dropped rather than defaulted: a
 * placement is a claim about a specific person, and there is no sensible person
 * to substitute. A duplicate id is dropped for the same reason a duplicate
 * incident is — a hero cannot be in two places, and silently keeping the last
 * one would make the answer depend on serialisation order.
 */
function normaliseHeroPlacements(value: unknown): HeroPlacementSave[] {
  if (!Array.isArray(value)) return []
  const out: HeroPlacementSave[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    const p = (raw ?? {}) as Partial<HeroPlacementSave>
    if (typeof p.id !== 'string' || !HERO_ID_SET.has(p.id) || seen.has(p.id)) continue
    seen.add(p.id)
    out.push({
      id: p.id,
      rung: Math.max(0, Math.floor(nonNegative(p.rung, 0))),
      index: Math.max(0, Math.floor(nonNegative(p.index, 0))),
      placedAt: nonNegative(p.placedAt, 0),
    })
  }
  return out
}

const HERO_ID_SET = new Set<string>(STORY_HEROES.map((h) => h.id))

const ROLE_SET = new Set<Role>(ROLES)

/**
 * §4.11 — the hire history, repaired against the headcount it has to describe.
 *
 * Two things can be wrong with a stored roster and both are silent:
 *
 * 1. **It is missing**, because the document predates roles. Every such studio
 *    was all developers, so that is what it becomes — filling it from `devs`
 *    rather than leaving it empty, which would put an existing player's entire
 *    company on the floor with no job.
 * 2. **It does not sum to `devs`.** The two are kept equal by `hire` being the
 *    only writer, but a save is the one input in this game that can contain
 *    anything at all, and `roleAtSeat` scans the roster while everything else
 *    reads the count. A short roster means seats past the end silently read as
 *    developers; a long one means people who are not there. Reconciled here, by
 *    trimming or by appending developers, so the invariant holds from the first
 *    frame after a load rather than approximately.
 */
function normaliseRoster(value: unknown, devs: number): { role: Role; count: number }[] {
  const target = Math.max(0, Math.floor(devs))
  const out: { role: Role; count: number }[] = []
  let total = 0

  if (Array.isArray(value)) {
    for (const raw of value) {
      const run = (raw ?? {}) as { role?: string; count?: number }
      const role = ROLE_SET.has(run.role as Role) ? (run.role as Role) : 'dev'
      const count = Math.min(target - total, Math.max(0, Math.floor(nonNegative(run.count, 0))))
      if (count <= 0) continue
      total += count
      const last = out[out.length - 1]
      if (last && last.role === role) last.count += count
      else out.push({ role, count })
      if (total >= target) break
    }
  }

  if (total < target) {
    const last = out[out.length - 1]
    if (last && last.role === 'dev') last.count += target - total
    else out.push({ role: 'dev', count: target - total })
  }
  return out
}

/** §4.12a — open pages, dropped rather than repaired when they name nothing. */
function normaliseIncidents(value: unknown): IncidentSave[] {
  if (!Array.isArray(value)) return []
  const out: IncidentSave[] = []
  const seen = new Set<number>()
  for (const raw of value) {
    const i = (raw ?? {}) as Partial<IncidentSave>
    const releaseId = Math.floor(nonNegative(i.releaseId, -1))
    // A page about no release cannot be shown, cleared, or attached to a frozen
    // tail — §4.15's chip has nothing to name. Dropped, not defaulted.
    if (!(releaseId >= 0) || seen.has(releaseId)) continue
    seen.add(releaseId)
    out.push({
      id: Math.max(0, Math.floor(nonNegative(i.id, 0))),
      releaseId,
      releaseName: typeof i.releaseName === 'string' ? i.releaseName : 'A Shipped Game',
      age: nonNegative(i.age, 0),
      // Clamped above zero: an incident stored with no work left would never
      // close on its own and would freeze its release for the rest of the run.
      work: Math.max(1, nonNegative(i.work, INCIDENT_WORK_SECONDS)),
    })
  }
  return out
}

/**
 * §11 — the tech levels, defended.
 *
 * Unknown ids are dropped rather than carried. A save naming a node this build
 * does not have is either hand-edited or written by a *newer* build, and in
 * both cases the honest answer is that this game does not know what it does —
 * keeping it would mean `techEffects` silently ignoring a level the save
 * screen would still have to price. Levels are floored at zero and left
 * unclamped at the top, because the node's own `maxLevel` is what clamps them
 * and `techEffects` already clamps every effect it derives.
 */
function normaliseTech(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, number> = {}
  for (const [id, level] of Object.entries(value as Record<string, unknown>)) {
    if (!TECH_BY_ID.has(id)) continue
    const n = Math.floor(nonNegative(level, 0))
    if (n > 0) out[id] = n
  }
  return out
}

/**
 * §4.10e — the back catalogue, defended field by field.
 *
 * Every number here divides or exponentiates something. A `tailTau` of zero
 * out of a truncated or hand-edited save is `exp(-t/0)` and then `NaN` dollars,
 * and cash is one of the few values in this game that a single NaN destroys
 * permanently — it propagates into the treasury on the next tick and every
 * readout afterwards reads `$NaN`. So the taus have floors rather than
 * defaults, and a release that cannot be repaired is dropped: losing one game's
 * tail costs the player money they can see, which is recoverable, and a
 * poisoned treasury is not.
 */
function normaliseReleases(value: unknown): ReleaseSave[] {
  if (!Array.isArray(value)) return []
  const out: ReleaseSave[] = []
  for (const raw of value) {
    const r = (raw ?? {}) as Partial<ReleaseSave>
    const payout = nonNegative(r.payout, 0)
    if (!(payout > 0)) continue
    out.push({
      id: Math.max(0, Math.floor(nonNegative(r.id, 0))),
      name: typeof r.name === 'string' ? r.name : 'A Shipped Game',
      payout,
      age: nonNegative(r.age, 0),
      // Clamped to the payout: a `paid` above it would make the next tick's
      // difference negative and *charge* the player for owning a back catalogue.
      paid: Math.min(payout, nonNegative(r.paid, 0)),
      spikeShare: Math.min(1, Math.max(0, num(r.spikeShare, 0.6))),
      spikeTau: Math.max(0.5, nonNegative(r.spikeTau, 6)),
      tailTau: Math.max(1, nonNegative(r.tailTau, 50)),
      // Defaulted to the garage, never to zero — see `ReleaseSave`. A missing
      // density is "we do not know", and the honest guess for an unknown game
      // is what a studio with nobody checking ships at.
      defectDensity: nonNegative(r.defectDensity, DEFECT_DENSITY_ANCHOR),
      rating: Math.min(100, nonNegative(r.rating, BASELINE_RATING)),
      // Floored at `UNKNOWN_ORDINAL` rather than at zero: zero is a real
      // ordinal — the first game anybody ever ships — and defaulting to it
      // would make every pre-ordinal release claim to be that game and
      // subtract its tail from the wrong row of the gallery.
      ordinal:
        typeof r.ordinal === 'number' && Number.isFinite(r.ordinal) && r.ordinal >= 0
          ? Math.floor(r.ordinal)
          : UNKNOWN_ORDINAL,
    })
  }
  return out
}

/**
 * §10.11 — the release history, defended field by field.
 *
 * A name is load-bearing: the aggregates are keyed on it and the gallery's
 * whole wall-of-covers reads *off* it, so a record without one is dropped
 * rather than defaulted to a placeholder that would invent a title the player
 * never shipped. Numbers floor at zero; a rating clamps to 100 and a count to
 * at least 1, so a folded title cannot report "0 times" and divide its own
 * average by nothing.
 */
function normaliseHistory(value: unknown): History {
  const h = (value ?? {}) as Partial<History>
  const recent: ReleaseRecord[] = []
  if (Array.isArray(h.recent)) {
    for (const raw of h.recent) {
      const r = (raw ?? {}) as Partial<ReleaseRecord>
      if (typeof r.name !== 'string' || r.name.length === 0) continue
      recent.push({
        ordinal: Math.floor(nonNegative(r.ordinal, 0)),
        run: Math.floor(nonNegative(r.run, 0)),
        name: r.name,
        rating: Math.min(100, nonNegative(r.rating, 0)),
        heroCoverage: Math.min(1, nonNegative(r.heroCoverage, 0)),
        // §4.14's breakdown, defaulted to the garage rather than to zero. A
        // record from before these terms existed describes a release nobody
        // measured them for, and reading that as "perfectly out of sync,
        // catastrophically unlucky" would rewrite the player's history into
        // one where every old game was a disaster.
        sync: Math.min(1, nonNegative(r.sync, GARAGE_SYNC)),
        traits: Math.min(1, nonNegative(r.traits, 0)),
        luck: Math.min(1, nonNegative(r.luck, LUCK_NEUTRAL)),
        payout: nonNegative(r.payout, 0),
        buildSeconds: nonNegative(r.buildSeconds, 0),
        labourSeconds: nonNegative(r.labourSeconds, 0),
        seed: typeof r.seed === 'number' && r.seed > 0 ? r.seed : 1,
      })
    }
  }
  const aggregates: TitleAggregate[] = []
  if (Array.isArray(h.aggregates)) {
    for (const raw of h.aggregates) {
      const a = (raw ?? {}) as Partial<TitleAggregate>
      if (typeof a.name !== 'string' || a.name.length === 0) continue
      aggregates.push({
        name: a.name,
        count: Math.max(1, Math.floor(nonNegative(a.count, 1))),
        ratingSum: nonNegative(a.ratingSum, 0),
        payoutSum: nonNegative(a.payoutSum, 0),
        buildSecondsSum: nonNegative(a.buildSecondsSum, 0),
        labourSecondsSum: nonNegative(a.labourSecondsSum, 0),
        seed: typeof a.seed === 'number' && a.seed > 0 ? a.seed : 1,
        lastOrdinal: Math.floor(nonNegative(a.lastOrdinal, 0)),
        lastRun: Math.floor(nonNegative(a.lastRun, 0)),
      })
    }
  }
  return { recent, aggregates }
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
      // §13.7.1. Absent on every save written before the Management tree, which
      // correctly describes a founder who has learned nothing yet.
      founderLevels: numberMap(m.founderLevels),
      // §13.10, §13.9. Absent means no XP earned and no hero nodes bought.
      heroXp: numberMap(m.heroXp),
      heroNodes: stringListMap(m.heroNodes),
      history: normaliseHistory(m.history),
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

/** Union merge of a `Record<string, string[]>` — per hero, the node sets join. */
function unionMap(
  a: Readonly<Record<string, string[]>>,
  b: Readonly<Record<string, string[]>>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) out[k] = union(a[k] ?? [], b[k] ?? [])
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
      // §13.7.1 — max per node, like every other levels map. A skill learned on
      // one device is learned.
      founderLevels: maxMap(a.founderLevels ?? {}, b.founderLevels ?? {}),
      // §13.10 — max per hero. §13.9 — union per hero, because a node bought on
      // one device is bought.
      heroXp: maxMap(a.heroXp ?? {}, b.heroXp ?? {}),
      heroNodes: unionMap(a.heroNodes ?? {}, b.heroNodes ?? {}),
      // §10.11 — see `sim/history.ts`. Recent unions by ordinal (commutative and
      // idempotent); aggregates sum per title (commutative, generously
      // double-counting only a release folded on two devices at once, which does
      // not parallelise). The trade is the game's standing one: keep everything.
      history: mergeHistory(a.history, b.history),
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
export function paradigmShiftPermanent(
  p: PermanentSave,
  bpEarned = 0,
  marks?: { lifetimeRevenue: number; peakDevs: number },
): PermanentSave {
  const earned = Math.max(0, Math.floor(bpEarned))
  const lifetimeRevenue = Math.max(
    p.meta.lifetimeRevenue,
    Number.isFinite(marks?.lifetimeRevenue) ? Math.max(0, marks!.lifetimeRevenue) : 0,
  )
  const peakDevs = Math.max(
    p.meta.peakDevs,
    Number.isFinite(marks?.peakDevs) ? Math.max(0, marks!.peakDevs) : 0,
  )
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
      // Committed in the same permanent write as the award. Saving the fresh
      // run afterwards can no longer erase the run whose high-water produced
      // these points.
      lifetimeRevenue,
      peakDevs,
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
