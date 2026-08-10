import { beforeEach, describe, expect, it } from 'vitest'
import {
  JAMES_ROLL,
  OUTPUT_SIGMA,
  ROSTER_CAP,
  __clearRosterCache,
  outputClass,
  outputRoll,
  outputShare,
  rosterMean,
  shareSum,
} from './output.ts'

const SEEDS = [1, 7, 42, 1234, 0x9e3779b9, 2_147_483_647]

beforeEach(() => {
  __clearRosterCache()
})

describe('the spread is WIDE — GDD §4.9a', () => {
  it('puts somebody worth ten of the person next to them on every floor', () => {
    // §4.9a's own sentence, as a measurement. Over a floor of a thousand there
    // has to be at least one person worth ten of at least one other, or the
    // "exaggerate it" instruction has not been followed.
    for (const seed of SEEDS) {
      const rolls = Array.from({ length: 1000 }, (_, i) => outputRoll(seed, i))
      expect(Math.max(...rolls) / Math.min(...rolls)).toBeGreaterThan(20)
    }
  })

  it('lands the 10x Engineer at the top of the roll rather than beside it', () => {
    // §14.4's hero classes are "the tail of this distribution rather than a
    // separate system bolted on". So a 10x has to be *rare* — roughly one in a
    // thousand — and reachable, rather than either commonplace or impossible.
    const rolls = Array.from({ length: 20_000 }, (_, i) => outputRoll(99, i)).sort((a, b) => a - b)
    const p999 = rolls[Math.floor(rolls.length * 0.999)]
    expect(p999).toBeGreaterThan(7)
    expect(p999).toBeLessThan(16)
  })

  it('has somebody worth a tenth at the other end', () => {
    const rolls = Array.from({ length: 20_000 }, (_, i) => outputRoll(99, i)).sort((a, b) => a - b)
    expect(rolls[Math.floor(rolls.length * 0.01)]).toBeLessThan(0.15)
  })

  it('puts the typical developer below the average, which is the thesis', () => {
    // Most of a studio's output comes from a minority of it. A distribution
    // whose median sat on its mean would be saying the opposite, and would make
    // §6's whole premise a rounding error.
    const rolls = Array.from({ length: 20_000 }, (_, i) => outputRoll(5, i)).sort((a, b) => a - b)
    expect(rolls[Math.floor(rolls.length / 2)]).toBeLessThan(0.8)
    expect(rolls[Math.floor(rolls.length / 2)]).toBeGreaterThan(0.5)
  })
})

describe('the mean is PINNED — §4.9a, and this is the constraint that keeps it honest', () => {
  it('holds the distribution mean at 1 whatever sigma is set to', () => {
    // `mu = -sigma^2/2` makes `exp(mu + sigma^2/2)` exactly 1, so widening the
    // spread cannot move the average — the average is not a function of sigma
    // at all. Measured over a large sample rather than asserted from the
    // algebra, because the clamps are applied after it.
    const n = 100_000
    let total = 0
    for (let i = 0; i < n; i++) total += outputRoll(31337, i)
    expect(total / n).toBeCloseTo(1, 1)
  })

  it('makes the realised roster sum to exactly the headcount, for every seed', () => {
    // The half that matters. A pinned *distribution* mean only pins the
    // *expected* sum: at sigma = 0.9 a studio of forty rolls a total anywhere
    // within about +-18% of forty, which is an eighteen per cent swing in Run
    // 1's economy decided by the run seed. Normalising by the mean the roster
    // actually rolled removes it completely.
    for (const seed of SEEDS) {
      for (const devs of [1, 2, 5, 40, 120, 1000, 9999]) {
        let total = 0
        for (let i = 0; i < devs; i++) total += outputShare(seed, devs, i)
        expect(total).toBeCloseTo(devs, 6)
      }
    }
  })

  it('gives a studio of one a share of exactly one', () => {
    // Act I is one developer, and their velocity readout must not be two thirds
    // of what the simulation says the studio is producing.
    for (const seed of SEEDS) expect(outputShare(seed, 1, 0)).toBeCloseTo(1, 12)
  })

  it('does not drift as the studio grows one hire at a time', () => {
    // Every hire renormalises the whole roster, so the invariant has to survive
    // being re-established 200 times rather than only being true at round
    // numbers.
    for (let devs = 1; devs <= 200; devs++) {
      let total = 0
      for (let i = 0; i < devs; i++) total += outputShare(77, devs, i)
      expect(total).toBeCloseTo(devs, 6)
    }
  })
})

describe('generated, never stored — the §7.8.7 contract', () => {
  it('is a pure function of seed and seat', () => {
    expect(outputRoll(4, 9)).toBe(outputRoll(4, 9))
    expect(outputRoll(4, 9)).not.toBe(outputRoll(5, 9))
    expect(outputRoll(4, 9)).not.toBe(outputRoll(4, 10))
  })

  it('survives the memo being dropped mid-run', () => {
    const before = outputShare(12, 500, 37)
    __clearRosterCache()
    expect(outputShare(12, 500, 37)).toBe(before)
  })

  it('holds the same person to the same output across a rebuild of the roster', () => {
    // A hire must not re-roll anybody. The seat is the identity, so seat 3 is
    // the same person's *roll* at four developers and at four hundred — only
    // their share of a bigger studio changes.
    const roll = outputRoll(8, 3)
    expect(outputShare(8, 4, 3) * rosterMean(8, 4)).toBeCloseTo(roll, 10)
    expect(outputShare(8, 400, 3) * rosterMean(8, 400)).toBeCloseTo(roll, 10)
  })

  it('keeps James just under the average rather than rolling him', () => {
    // §21's co-founder spends the whole run being wrong about how big this can
    // get. A James who turned out to be a secret 10x Engineer would be a
    // different joke and a worse one.
    for (const seed of SEEDS) expect(outputRoll(seed, 1)).toBe(JAMES_ROLL)
    expect(JAMES_ROLL).toBeLessThan(1)
  })

  it('never produces a roll that would break a numeral or the economy', () => {
    for (const seed of SEEDS) {
      for (let i = 0; i < 5000; i++) {
        const roll = outputRoll(seed, i)
        expect(Number.isFinite(roll)).toBe(true)
        expect(roll).toBeGreaterThan(0)
        expect(roll).toBeLessThanOrEqual(25)
      }
    }
  })

  it('answers for a seat past the roster cap rather than reading off the end', () => {
    expect(outputShare(3, 1e9, ROSTER_CAP)).toBe(1)
    expect(outputShare(3, 1e9, ROSTER_CAP + 5000)).toBe(1)
    expect(Number.isFinite(rosterMean(3, 1e12))).toBe(true)
  })

  it('survives nonsense', () => {
    expect(Number.isFinite(outputShare(1, 0, 0))).toBe(true)
    expect(Number.isFinite(outputShare(1, -5, -5))).toBe(true)
  })
})

describe('outputClass — §14.4, the hero classes are bands of the roll', () => {
  it('names the tail and the rest', () => {
    expect(outputClass(12)).toBe('10x')
    expect(outputClass(2)).toBe('strong')
    expect(outputClass(1)).toBe('steady')
    expect(outputClass(0.2)).toBe('slow')
  })

  it('keeps the 10x band rare enough to mean something', () => {
    // If one developer in eight is a "10x Engineer" the label is decoration.
    const n = 20_000
    let heroes = 0
    for (let i = 0; i < n; i++) {
      if (outputClass(outputShare(404, n, i)) === '10x') heroes++
    }
    expect(heroes / n).toBeLessThan(0.01)
  })
})

describe('sigma is the knob, and it is documented', () => {
  it('is the value the percentile table in the header was computed at', () => {
    expect(OUTPUT_SIGMA).toBe(0.9)
  })
})

describe('shareSum — a whole unit’s worth, in one query (GDD §4.5b)', () => {
  it('agrees with adding the shares up one at a time', () => {
    for (const seed of SEEDS) {
      let by1 = 0
      for (let i = 120; i < 260; i++) by1 += outputShare(seed, 400, i)
      expect(shareSum(seed, 400, 120, 260)).toBeCloseTo(by1, 8)
    }
  })

  it('sums to the headcount exactly over the whole roster', () => {
    // §4.9a's "hold the average", asked of the range query rather than of the
    // individual one. R14 buffs a *unit*, so this is the path the economy now
    // runs through and it has to carry the same guarantee.
    for (const seed of SEEDS) {
      expect(shareSum(seed, 640, 0, 640)).toBeCloseTo(640, 6)
    }
  })

  it('is nothing across an empty or backwards range', () => {
    expect(shareSum(7, 400, 200, 200)).toBe(0)
    expect(shareSum(7, 400, 260, 120)).toBe(0)
  })

  it('counts a seat past the roster cap as an average developer', () => {
    // `outputShare` returns exactly 1 past ROSTER_CAP — individuals are neither
    // drawn nor pokeable there — so a unit of a million people beyond it is
    // worth a million, and a town-sized buff does not silently evaluate to zero.
    expect(shareSum(7, 2_000_000, ROSTER_CAP, ROSTER_CAP + 5_000)).toBeCloseTo(5_000, 6)
  })

  it('handles a unit straddling the cap', () => {
    const below = shareSum(7, 2_000_000, ROSTER_CAP - 100, ROSTER_CAP)
    expect(shareSum(7, 2_000_000, ROSTER_CAP - 100, ROSTER_CAP + 100)).toBeCloseTo(below + 100, 6)
  })
})
