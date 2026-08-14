import { describe, expect, it } from 'vitest'
import {
  RECENT_KEEP,
  aggregateRating,
  emptyHistory,
  mergeHistory,
  nextOrdinal,
  recordRelease,
  type History,
  type ReleaseRecord,
  type TitleAggregate,
} from './history.ts'

function record(ordinal: number, over: Partial<ReleaseRecord> = {}): ReleaseRecord {
  return {
    ordinal,
    run: 0,
    name: `Game ${ordinal}`,
    rating: 50,
    payout: 100,
    buildSeconds: 60,
    labourSeconds: 120,
    seed: 1,
    ...over,
  }
}

function aggregate(name: string, over: Partial<TitleAggregate> = {}): TitleAggregate {
  return {
    name,
    count: 1,
    ratingSum: 50,
    payoutSum: 100,
    buildSecondsSum: 60,
    labourSecondsSum: 120,
    seed: 1,
    lastOrdinal: 0,
    lastRun: 0,
    ...over,
  }
}

function history(recent: ReleaseRecord[], aggregates: TitleAggregate[] = []): History {
  return { recent, aggregates }
}

describe('§10.11 — the release history', () => {
  it('starts empty', () => {
    expect(emptyHistory()).toEqual({ recent: [], aggregates: [] })
  })

  it('numbers releases densely from zero', () => {
    expect(nextOrdinal(emptyHistory())).toBe(0)
    expect(nextOrdinal(history([record(0), record(1)]))).toBe(2)
    expect(nextOrdinal(history([], [aggregate('x', { lastOrdinal: 4 })]))).toBe(5)
  })

  it('holds the recent window verbatim until it overflows', () => {
    let h = emptyHistory()
    for (let i = 0; i < RECENT_KEEP; i++) h = recordRelease(h, record(i))
    expect(h.recent).toHaveLength(RECENT_KEEP)
    expect(h.aggregates).toHaveLength(0)
  })

  it('folds the oldest release into a per-title aggregate on overflow', () => {
    let h = emptyHistory()
    for (let i = 0; i < RECENT_KEEP; i++) h = recordRelease(h, record(i, { name: 'Same' }))
    h = recordRelease(h, record(RECENT_KEEP, { name: 'Same', rating: 80, payout: 500 }))

    expect(h.recent).toHaveLength(RECENT_KEEP)
    expect(h.recent[0].ordinal).toBe(1)
    expect(h.recent[h.recent.length - 1].ordinal).toBe(RECENT_KEEP)
    expect(h.aggregates).toHaveLength(1)
    expect(h.aggregates[0]).toMatchObject({ name: 'Same', count: 1, lastOrdinal: 0 })
  })

  it('keeps one aggregate per distinct title, never one per ship', () => {
    let h = emptyHistory()
    for (let i = 0; i < RECENT_KEEP + 50; i++) {
      h = recordRelease(h, record(i, { name: i % 2 ? 'A' : 'B', payout: i }))
    }
    expect(h.aggregates.map((a) => a.name).sort()).toEqual(['A', 'B'])
    const a = h.aggregates.find((x) => x.name === 'A')!
    const b = h.aggregates.find((x) => x.name === 'B')!
    // Fifty releases folded: the evens to B, the odds to A, payouts summed.
    expect(a.count + b.count).toBe(50)
    expect(a.payoutSum).toBe(625) // 1 + 3 + ... + 49
    expect(b.payoutSum).toBe(600) // 0 + 2 + ... + 48
  })

  it('reports the average rating of a folded title', () => {
    expect(aggregateRating(aggregate('x', { count: 2, ratingSum: 90 }))).toBe(45)
  })

  it('is bounded however many releases ship', () => {
    let h = emptyHistory()
    for (let i = 0; i < 1_000_000; i++) h = recordRelease(h, record(i, { name: 'Same' }))
    expect(h.recent.length).toBeLessThanOrEqual(RECENT_KEEP)
    expect(h.aggregates).toHaveLength(1)
  })
})

describe('§24.3 — merging two histories', () => {
  it('unions the recent window by ordinal and keeps the highest', () => {
    const a = history([record(0), record(1)])
    const b = history([record(1, { payout: 999 }), record(2)])
    const m = mergeHistory(a, b)
    expect(m.recent.map((r) => r.ordinal)).toEqual([0, 1, 2])
    expect(m.recent.find((r) => r.ordinal === 1)!.payout).toBe(999)
  })

  it('is commutative', () => {
    const a = history([record(0), record(1)], [aggregate('A', { count: 2 })])
    const b = history([record(1), record(2)], [aggregate('A', { count: 3 })])
    const ab = mergeHistory(a, b)
    const ba = mergeHistory(b, a)
    expect(ab.recent.map((r) => r.ordinal)).toEqual(ba.recent.map((r) => r.ordinal))
    expect(ab.aggregates).toEqual(ba.aggregates)
  })

  it('sums per-title aggregates across devices', () => {
    const a = history([], [aggregate('A', { count: 2, payoutSum: 20, lastOrdinal: 1 })])
    const b = history([], [aggregate('A', { count: 3, payoutSum: 30, seed: 2, lastOrdinal: 5, lastRun: 1 })])
    const m = mergeHistory(a, b)
    expect(m.aggregates[0]).toMatchObject({ count: 5, payoutSum: 50, seed: 2, lastOrdinal: 5 })
  })

  it('keeps the recent window bounded after a merge', () => {
    let a = emptyHistory()
    let b = emptyHistory()
    for (let i = 0; i < RECENT_KEEP + 10; i++) a = recordRelease(a, record(i))
    for (let i = RECENT_KEEP - 5; i < RECENT_KEEP + 20; i++) b = recordRelease(b, record(i))
    const m = mergeHistory(a, b)
    expect(m.recent.length).toBeLessThanOrEqual(RECENT_KEEP)
  })
})
