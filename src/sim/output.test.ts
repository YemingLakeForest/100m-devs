import { describe, expect, it } from 'vitest'
import { JAMES_ROLL, OUTPUT_SIGMA, outputClass, outputRoll } from './output.ts'

const SEEDS = [1, 7, 42, 1234, 0x9e3779b9, 2_147_483_647]

// The normalise moved to `aggregate.ts` on 2026-08-18 (§26.2) and its tests
// went with it. What is left here is the half this module was always about:
// what one person is worth, before anybody has divided anything up.

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

describe('the distribution mean is pinned — §4.9a', () => {
  it('holds the distribution mean at 1 whatever sigma is set to', () => {
    // `mu = -sigma^2/2` makes `exp(mu + sigma^2/2)` exactly 1, so widening the
    // spread cannot move the average — the average is not a function of sigma
    // at all. Measured over a large sample rather than asserted from the
    // algebra, because the clamps are applied after it.
    //
    // This pins the *expected* sum only, which is why `aggregate.ts` exists:
    // see its header for the half that a pinned distribution cannot deliver.
    const n = 100_000
    let total = 0
    for (let i = 0; i < n; i++) total += outputRoll(31337, i)
    expect(total / n).toBeCloseTo(1, 1)
  })
})

describe('generated, never stored — the §7.8.7 contract', () => {
  it('is a pure function of seed and seat', () => {
    expect(outputRoll(4, 9)).toBe(outputRoll(4, 9))
    expect(outputRoll(4, 9)).not.toBe(outputRoll(5, 9))
    expect(outputRoll(4, 9)).not.toBe(outputRoll(4, 10))
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

  it('rolls a seat past the old roster cap like any other seat', () => {
    // The cap used to make every seat past ten thousand worth exactly the
    // average. §26.2 gave those seats somebody to be compared with, so the
    // roll out there has to be a roll — see `aggregate.test.ts` for the share.
    const far = Array.from({ length: 2000 }, (_, i) => outputRoll(3, 50_000_000 + i))
    expect(Math.max(...far) / Math.min(...far)).toBeGreaterThan(20)
  })
})

describe('outputClass — §14.4, the hero classes are bands of the roll', () => {
  it('names the tail and the rest', () => {
    expect(outputClass(12)).toBe('10x')
    expect(outputClass(2)).toBe('strong')
    expect(outputClass(1)).toBe('steady')
    expect(outputClass(0.2)).toBe('slow')
  })
})

describe('sigma is the knob, and it is documented', () => {
  it('is the value the percentile table in the header was computed at', () => {
    expect(OUTPUT_SIGMA).toBe(0.9)
  })
})
