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
 * ## It is the **run's** record, not the career's [amended 2026-08-27]
 *
 * This was career-wide and said so at length: it survived a Paradigm Shift "because
 * §13.2 liquidates *money*, not *memory*". That is a good sentence about a shelf
 * of trophies and the wrong one about this shelf, because §10.11's gallery is not
 * a trophy cabinet — it is **the catalogue this studio is currently selling**.
 * §4.10e's tail, §4.12's defects and §4.14's reception all attach to a release,
 * and a Paradigm Shift liquidates every one of those. A gallery that outlives the
 * studio is a wall of games nobody in this reality has made, with no tail, no
 * standing and no way to tell which of them are *yours*.
 *
 * So the history lives in the run save now, and a shift clears it the same way it
 * clears the treasury: not by a special case, but because `freshRun()` starts an
 * empty one. §15.1a's cut scene is where the run that made them is accounted for.
 *
 * The `run` field on each record is kept. It is one number, it is what a §17
 * Multiverse view would need to put two realities side by side, and every record
 * already carries it.
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
 * in it is a history whose "recent" window is not recent.
 *
 * It restarts at 1 every run, which is the point of the amendment above: an
 * ordinal names a release *in this catalogue*, and §4.14's reception roll is
 * drawn from it against a run seed that is itself re-rolled at every shift.
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

/*
 * **`mergeHistory` lived here and is gone** [removed 2026-08-27].
 *
 * It was SAVE.md §3's monotonic-permanence rule applied to an ordered log: union
 * `recent` by ordinal, sum the aggregates, and accept that a release folded on
 * two devices counts twice. That contract belongs to things a player *earns* and
 * may never lose. A catalogue is not one of those any more — it belongs to the
 * run, and run state is resolved by `savedAt` last-write-wins, which is the whole
 * of the answer. A merge function with no caller is the next contributor's
 * afternoon, so it left with its reason.
 */

/** §10.11.1 — the average score of a folded title, for the gallery's trend. */
export function aggregateRating(aggregate: TitleAggregate): number {
  return aggregate.count > 0 ? aggregate.ratingSum / aggregate.count : 0
}
