import { describe, expect, it } from 'vitest'
import { hireCostTotal } from './economy.ts'
import {
  DIAL_UNLOCKS_AT,
  MAX_RESERVE_FRACTION,
  batchCost,
  maxAffordable,
  multiplierLabel,
  quote,
  segmentsFor,
} from './hireDial.ts'

describe('segmentsFor — GDD §10.10.2', () => {
  it('gives no dial at all below 25 developers', () => {
    // Not "a dial with one segment". §21's Act I is a scripted funnel and a
    // multiplier in it would let the player skip the beat where hiring one
    // person is the entire game.
    expect(segmentsFor(1)).toEqual([])
    expect(segmentsFor(24)).toEqual([])
    expect(segmentsFor(DIAL_UNLOCKS_AT).length).toBeGreaterThan(0)
  })

  it('is always exactly four segments once it exists', () => {
    // The single most important property of this control. Never five, never a
    // scrolling list: the window slides up the ladder and the *shape* never
    // changes, which is what lets a player who learned it at fifty developers
    // still recognise it at a billion.
    for (const devs of [25, 100, 249, 250, 9_999, 10_000, 1e6, 1e9, 1e12]) {
      // Including the opening band: `x100` is unaffordable at 25 developers
      // and is offered anyway, so the control never changes shape.
      expect(segmentsFor(devs)).toHaveLength(4)
    }
  })

  it('always ends in MAX', () => {
    for (const devs of [25, 500, 5e5, 5e9]) {
      expect(segmentsFor(devs).at(-1)?.value).toBe('max')
    }
  })

  it('retires the small multipliers instead of accumulating them', () => {
    // The half that a naive implementation gets wrong: it is tempting to keep
    // adding segments as headcount grows, which produces a twelve-button strip
    // by the late game where eight of the buttons are meaningless.
    const early = segmentsFor(100).map((s) => s.label)
    const late = segmentsFor(5_000_000).map((s) => s.label)
    expect(early).toContain('x1')
    expect(late).not.toContain('x1')
    expect(late).not.toContain('x10')
  })

  it('never repeats a label within a dial', () => {
    for (const devs of [25, 250, 10_000, 1e6, 1e9]) {
      const labels = segmentsFor(devs).map((s) => s.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('formats multipliers in whole units', () => {
    expect(multiplierLabel(1)).toBe('x1')
    expect(multiplierLabel(100)).toBe('x100')
    expect(multiplierLabel(1_000)).toBe('x1K')
    expect(multiplierLabel(10_000_000)).toBe('x10M')
  })
})

describe('batchCost', () => {
  it('agrees with summing hireCost one at a time', () => {
    // The reason the closed form is allowed to exist. A geometric-series
    // shortcut that has silently drifted from the per-hire price the rest of
    // the game charges is worse than the loop it replaced, because it would
    // overcharge or undercharge without ever failing.
    for (const [devs, n] of [
      [1, 1],
      [1, 40],
      [2, 10],
      [37, 3],
      [100, 250],
    ] as const) {
      // Compared *relatively*. An absolute tolerance fails on a $5.7tn batch
      // for a discrepancy of one tenth of a cent, which is double rounding
      // rather than a disagreement about the price.
      const closed = batchCost(devs, n)
      const summed = hireCostTotal(devs, devs + n)
      expect(Math.abs(closed - summed) / Math.max(1, summed)).toBeLessThan(1e-12)
    }
  })

  it('is zero for a non-positive batch', () => {
    expect(batchCost(10, 0)).toBe(0)
    expect(batchCost(10, -5)).toBe(0)
  })

  it('costs more than n times the current price', () => {
    // §10.10.1: the button shows the *true* sum, "never `n × current`, which
    // understates it and would read as a lie the first time a player checked".
    const devs = 20
    const n = 25
    expect(batchCost(devs, n)).toBeGreaterThan(n * batchCost(devs, 1))
  })
})

describe('maxAffordable — GDD §10.10.3 rule 2', () => {
  it('buys nothing with nothing', () => {
    expect(maxAffordable(10, 0)).toBe(0)
    expect(maxAffordable(10, -100)).toBe(0)
  })

  it('never spends the last dollar', () => {
    // The rule this whole function exists for. Mass Hire empties the treasury
    // because Act III is *supposed* to ruin you; the ordinary MAX must not, or
    // the trap reads as a bug rather than as a betrayal.
    const devs = 30
    const cash = 5_000
    const n = maxAffordable(devs, cash)
    expect(n).toBeGreaterThan(0)
    expect(cash - batchCost(devs, n)).toBeGreaterThanOrEqual(cash * MAX_RESERVE_FRACTION)
  })

  it('is maximal — one more would break the reserve', () => {
    const devs = 30
    const cash = 5_000
    const n = maxAffordable(devs, cash)
    expect(batchCost(devs, n + 1)).toBeGreaterThan(cash * (1 - MAX_RESERVE_FRACTION))
  })

  it('lights up during Act IIa, which is the act it is introduced in', () => {
    // The regression that a wage-derived reserve caused: MAX was dead for the
    // whole of the act that unlocks it, because five seconds of payroll at
    // thirty developers is more money than an Act IIa player has ever held.
    // A segment that never lights up is worse than one that was not shipped.
    for (const [devs, cash] of [
      [25, 400],
      [30, 900],
      [40, 3_000],
    ] as const) {
      expect(maxAffordable(devs, cash)).toBeGreaterThan(0)
    }
  })

  it('is affordable — the batch it names can actually be bought', () => {
    for (const cash of [100, 1_000, 50_000, 1e6]) {
      const n = maxAffordable(12, cash)
      expect(batchCost(12, n)).toBeLessThanOrEqual(cash)
    }
  })

  it('grows with cash and shrinks with headcount', () => {
    expect(maxAffordable(20, 10_000)).toBeGreaterThan(maxAffordable(20, 1_000))
    expect(maxAffordable(200, 10_000)).toBeLessThan(maxAffordable(20, 10_000))
  })

  it('does not hang or return nonsense at absurd headcounts', () => {
    // 1.08^n overflows to Infinity around n = 9,200. The dial is priced every
    // frame, so this must degrade to "you cannot afford any" rather than to a
    // NaN, a negative, or a loop that never ends.
    const n = maxAffordable(50_000, 1e12)
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBeGreaterThanOrEqual(0)
  })
})

describe('quote — GDD §10.10.3 rule 1', () => {
  it('prices an unaffordable multiplier instead of hiding it', () => {
    // "Shown, priced and disabled — never hidden. Hiding it removes exactly
    // the information the player needs to decide what to save for."
    const q = quote(10, 1, 100)
    expect(q.count).toBe(100)
    expect(q.cost).toBeGreaterThan(1)
    expect(q.affordable).toBe(false)
  })

  it('quotes MAX as whatever is affordable right now', () => {
    const q = quote(10, 5_000, 'max')
    expect(q.count).toBe(maxAffordable(10, 5_000))
    expect(q.affordable).toBe(true)
  })

  it('reports MAX as unaffordable when it buys nobody', () => {
    // A MAX segment that buys zero developers must not look live. It is the
    // one segment whose count moves on its own, so it is the one that can
    // become a no-op without the player doing anything.
    expect(quote(10, 0, 'max')).toMatchObject({ count: 0, affordable: false })
  })
})
