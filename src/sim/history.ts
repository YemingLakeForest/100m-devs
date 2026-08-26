/**
 * The release history — GDD §10.11, and the memory §4.10e never kept.
 *
 * §4.10e turned the back catalogue into a *rate* — a stack of bands 120 px
 * wide — and that is the right readout for "am I earning" and the wrong one for
 * "what have I made". The instant a project ships, the burn-down resets, the
 * name changes, and four minutes of play becomes a thin band under tomorrow's
 * launch. §4.12's defects, §4.13's tickets and §4.14's rating all attach to a
 * *release*, and until now there was nowhere a release existed after it
 * retired: `revenue.ts` drops a game the moment it stops earning (§4.10e's
 * retire), and only the run-level counters remembered it had been there.
 *
 * This is the permanent record. It is **career-wide** — it survives a Paradigm
 * Shift, a Codebase Fork and a Multiverse Compiler, because §13.2 liquidates
 * *money*, not *memory*, and "what have I made" is the one question the whole
 * prestige ladder is supposed to leave behind it. The `run` field on each
 * record keeps the per-run filter available.
 *
 * ## Scaling to millions of releases
 *
 * A release costs eight numbers, and "a million shipped games" cannot be a
 * million objects. The structure is bounded on both sides:
 *
 * - {@link RECENT_KEEP} individual releases are kept verbatim, newest last.
 *   That is the gallery's "recent" tier — the only tier that needs per-release
 *   fidelity, because it is the only one the player still remembers shipping.
 * - Everything older folds into one {@link TitleAggregate} per *title name*,
 *   summed. The title ladder is a handful of names (§4.10c), so this list is
 *   bounded by how many different games exist in the whole design, however many
 *   million times they are shipped.
 *
 * A record is folded the moment it falls off the recent window, so the
 * invariant is `recent.length ≤ RECENT_KEEP` and `aggregates.length ≤ distinct
 * titles`, for any length of play.
 *
 * ## What is deliberately not here
 *
 * **Labour is a fact about the run, not a number this module derives.** §10.11.2
 * defines it as ∫ headcount dt, NOT divided by efficiency, and the store
 * integrates it (`projectLabourSeconds`) because it needs the live headcount
 * every tick. This module just carries the number.
 *
 * **Offline chain-ships.** §24.8's absence summary ships projects without
 * per-release rating or defect data, and it already bypasses the live catalogue
 * for the same reason. Those ships bump the lifetime counter and do not produce
 * a record here; the trade is documented at the call site.
 *
 * Pure — no store, no clock, no renderer.
 */

/**
 * How many releases the gallery keeps verbatim before folding them away.
 *
 * Twenty-four is a full screen of the drawer §10.11.4 specifies without a
 * scroll, and it is past the point where the tail of §4.10e has retired
 * anything — a player looking back twenty-four ships is looking at history,
 * not at the current run.
 */
export const RECENT_KEEP = 24

/** One shipped game, remembered. Newest records have the highest `ordinal`. */
export interface ReleaseRecord {
  /** Career-wide ship ordinal, 0-based, monotonically increasing. */
  ordinal: number
  /**
   * Which run shipped it — `meta.paradigmShifts` at the moment it landed.
   *
   * The gallery's per-run filter hangs off this. Run 1 is 0.
   */
  run: number
  name: string
  /** §4.14's score out of 100, fixed at ship. */
  rating: number
  /** §13.6 — union of the build team covered by settled hero postings, 0..1. */
  heroCoverage?: number
  /**
   * §4.14's three added inputs, as they stood at ship — 0..1 each.
   *
   * Kept so §10.11.1 can show *why* a game scored what it scored. A rating with
   * no breakdown behind it is a verdict the player cannot argue with, and the
   * gallery is the screen where a run is argued with.
   *
   * Optional, on exactly the rule `heroCoverage` follows: a record written
   * before these terms existed is a record of a release nobody measured them
   * for, and the reader defaults each one to the garage rather than to zero —
   * `rateRelease` documents why that is the honest default and not the
   * convenient one.
   */
  sync?: number
  traits?: number
  luck?: number
  /** §4.10c's ladder payout — the tail's total, exactly. */
  payout: number
  /** Simulated seconds the build took — §10.11.1's "shipped 4 minutes ago". */
  buildSeconds: number
  /** §10.11.2's labour, ∫ headcount dt over the build, in seconds. */
  labourSeconds: number
  /** The run seed at ship, so the cover is deterministic across a reload. */
  seed: number
}

/** Every release of one title that has folded out of `recent`, summed. */
export interface TitleAggregate {
  name: string
  count: number
  ratingSum: number
  payoutSum: number
  buildSecondsSum: number
  labourSecondsSum: number
  /** The seed of the most recent release folded in, for the cover. */
  seed: number
  /** Highest ordinal folded in, so the wall stays newest-last. */
  lastOrdinal: number
  /** Highest run folded in. */
  lastRun: number
}

export interface History {
  /** Newest-last individual releases, length ≤ {@link RECENT_KEEP}. */
  recent: ReleaseRecord[]
  /** One per distinct title ever shipped. */
  aggregates: TitleAggregate[]
}

export function emptyHistory(): History {
  return { recent: [], aggregates: [] }
}

/**
 * The next career ordinal — one past the highest ever recorded.
 *
 * Dense rather than tied to `lifetimeProjectsShipped`, because that counter is
 * a high-water mark incremented by offline ships too, and a history with gaps
 * in it is a history whose "recent" window is not recent. The merge dedupes on
 * this ordinal, so two devices that both assign the same number to different
 * releases collapse to one record rather than to a lie.
 */
export function nextOrdinal(history: History): number {
  let max = -1
  for (const r of history.recent) max = Math.max(max, r.ordinal)
  for (const a of history.aggregates) max = Math.max(max, a.lastOrdinal)
  return max + 1
}

function foldInto(aggregates: TitleAggregate[], record: ReleaseRecord): TitleAggregate[] {
  const hit = aggregates.findIndex((a) => a.name === record.name)
  if (hit === -1) {
    return [
      ...aggregates,
      {
        name: record.name,
        count: 1,
        ratingSum: record.rating,
        payoutSum: record.payout,
        buildSecondsSum: record.buildSeconds,
        labourSecondsSum: record.labourSeconds,
        seed: record.seed,
        lastOrdinal: record.ordinal,
        lastRun: record.run,
      },
    ]
  }
  return aggregates.map((a, i) => {
    if (i !== hit) return a
    return {
      name: a.name,
      count: a.count + 1,
      ratingSum: a.ratingSum + record.rating,
      payoutSum: a.payoutSum + record.payout,
      buildSecondsSum: a.buildSecondsSum + record.buildSeconds,
      labourSecondsSum: a.labourSecondsSum + record.labourSeconds,
      seed: record.seed,
      lastOrdinal: record.ordinal,
      lastRun: record.run,
    }
  })
}

/**
 * Append a shipped release to the history — §10.11.1, newest last.
 *
 * The record lands in `recent`; the moment the window overflows, the oldest
 * entry folds into the per-title aggregate. That is the only place a release
 * leaves `recent`, so the two tiers never double-count a release.
 *
 * Callers hand records in ordinal order — the store derives `ordinal` from
 * {@link nextOrdinal}, which is what keeps the list sorted without a sort.
 */
export function recordRelease(history: History, record: ReleaseRecord): History {
  const recent = [...history.recent, record]
  if (recent.length <= RECENT_KEEP) return { recent, aggregates: history.aggregates }
  const oldest = recent[0]
  return {
    recent: recent.slice(1),
    aggregates: foldInto(history.aggregates, oldest),
  }
}

/** Field-wise max, so two records of one ordinal collapse to the generous one. */
function maxRecord(a: ReleaseRecord, b: ReleaseRecord): ReleaseRecord {
  return {
    ordinal: a.ordinal,
    run: Math.max(a.run, b.run),
    // Two devices that diverged can give one ordinal different names. The tie
    // is broken lexicographically so the answer does not depend on merge order;
    // the case cannot arise in a single-device lineage, where an ordinal names
    // exactly one release.
    name: a.name <= b.name ? a.name : b.name,
    rating: Math.max(a.rating, b.rating),
    heroCoverage: Math.max(a.heroCoverage ?? 0, b.heroCoverage ?? 0),
    // Field-wise max like everything else here — see the function's note. The
    // breakdown is decoration on a rating that is itself maxed, so a merge
    // cannot produce a breakdown that argues with the score beside it by more
    // than the two documents already disagreed.
    sync: Math.max(a.sync ?? 0, b.sync ?? 0),
    traits: Math.max(a.traits ?? 0, b.traits ?? 0),
    luck: Math.max(a.luck ?? 0, b.luck ?? 0),
    payout: Math.max(a.payout, b.payout),
    buildSeconds: Math.max(a.buildSeconds, b.buildSeconds),
    labourSeconds: Math.max(a.labourSeconds, b.labourSeconds),
    seed: Math.max(a.seed, b.seed),
  }
}

function maxAggregate(a: TitleAggregate, b: TitleAggregate): TitleAggregate {
  return {
    name: a.name,
    count: a.count + b.count,
    ratingSum: a.ratingSum + b.ratingSum,
    payoutSum: a.payoutSum + b.payoutSum,
    buildSecondsSum: a.buildSecondsSum + b.buildSecondsSum,
    labourSecondsSum: a.labourSecondsSum + b.labourSecondsSum,
    seed: Math.max(a.seed, b.seed),
    lastOrdinal: Math.max(a.lastOrdinal, b.lastOrdinal),
    lastRun: Math.max(a.lastRun, b.lastRun),
  }
}

/**
 * Merge two histories — SAVE.md §3's permanence rule applied to an ordered log.
 *
 * `recent` unions by ordinal and keeps the highest {@link RECENT_KEEP}, so the
 * window is a pure function of the record set and the merge is commutative and
 * idempotent.
 *
 * `aggregates` union by title and **sum** their counts and totals, which is
 * commutative but not idempotent: a release folded on *both* devices counts
 * twice. That can only happen when two devices independently ship-and-fold the
 * same ordinal — which, like §24.3's BP balance, does not meaningfully
 * parallelise across two devices sharing one save. The deliberate trade is the
 * game's standing one: prefer the player keeping everything to the merge
 * guessing which copy to discard.
 */
export function mergeHistory(a: History, b: History): History {
  const byOrdinal = new Map<number, ReleaseRecord>()
  for (const r of a.recent) byOrdinal.set(r.ordinal, r)
  for (const r of b.recent) {
    const existing = byOrdinal.get(r.ordinal)
    byOrdinal.set(r.ordinal, existing ? maxRecord(existing, r) : r)
  }
  const recent = [...byOrdinal.values()]
    .sort((x, y) => x.ordinal - y.ordinal)
    .slice(-RECENT_KEEP)

  const byName = new Map<string, TitleAggregate>()
  for (const agg of a.aggregates) byName.set(agg.name, agg)
  for (const agg of b.aggregates) {
    const existing = byName.get(agg.name)
    byName.set(agg.name, existing ? maxAggregate(existing, agg) : agg)
  }
  const aggregates = [...byName.values()].sort((x, y) => x.lastOrdinal - y.lastOrdinal)

  return { recent, aggregates }
}

/** §10.11.1 — the average score of a folded title, for the gallery's trend. */
export function aggregateRating(aggregate: TitleAggregate): number {
  return aggregate.count > 0 ? aggregate.ratingSum / aggregate.count : 0
}
