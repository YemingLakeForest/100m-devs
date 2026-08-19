import { beforeEach, describe, expect, it } from 'vitest'
import {
  LEVEL_SIZES,
  __clearAggregateCache,
  outputShare,
  shareSum,
  unitMultiplier,
  unitSigma,
  unitWeight,
} from './aggregate.ts'
import { outputClass, outputRoll } from './output.ts'
import { nominalUnitSize } from './units.ts'

const SEEDS = [1, 7, 42, 1234, 0x9e3779b9, 2_147_483_647]

/** The gate headcount, §13.5. Everything here is expected to hold at it. */
const GATE = 100_000_000

beforeEach(() => {
  __clearAggregateCache()
})

describe('the aggregate equals its parts — GDD §26.2.3, and §26.2.5 line 4', () => {
  it('splits every unit into children that add back up to it, at every level', () => {
    // The acceptance test for the whole phase, asked of the arithmetic before
    // anything is drawn: "the aggregate's numbers have to *equal* the sum of
    // the individuals it generates, or the player catches the game lying the
    // first time they check."
    for (const seed of [7, 1234]) {
      for (const devs of [40, 1000, 12_345, 4_000_000, GATE]) {
        for (let level = 1; level < LEVEL_SIZES.length; level++) {
          const parent = unitWeight(seed, devs, level, 0)
          if (parent <= 0) continue

          const b = Math.round(LEVEL_SIZES[level] / LEVEL_SIZES[level - 1])
          let sum = 0
          for (let j = 0; j < b; j++) sum += unitWeight(seed, devs, level - 1, j)

          // Relative, because these are doubles and the residual trick makes
          // the error one rounding rather than `b` of them — not zero. At the
          // gate headcount a story point is 1e-8 of the number being compared,
          // so "to the last story point" is comfortably inside this.
          expect(Math.abs(sum - parent) / parent).toBeLessThan(1e-12)
        }
      }
    }
  })

  it('makes a block of a hundred equal its hundred people, wherever the block is', () => {
    // §26.2.5's line 4, and the seat that matters is the far one: under the old
    // global normalise every share past ten thousand was exactly 1, so this
    // passed while a block generated a hundred identical people.
    for (const blockIndex of [0, 3, 100, 100_000, 500_000]) {
      const from = blockIndex * 100
      const stated = unitWeight(4242, GATE, 1, blockIndex)
      let sum = 0
      for (let i = from; i < from + 100; i++) sum += outputShare(4242, GATE, i)
      expect(Math.abs(sum - stated) / stated).toBeLessThan(1e-12)
    }
  })

  it('generates a hundred people who are not the same person', () => {
    // The other half of line 4, and the half the old flat tail could not do.
    // A block out past fifty million must have the same spread inside it as the
    // first one does, or "zoom in and it resolves" resolves to a row of clones.
    for (const from of [0, 50_000_000]) {
      const shares = Array.from({ length: 100 }, (_, i) => outputShare(4242, GATE, from + i))
      expect(Math.max(...shares) / Math.min(...shares)).toBeGreaterThan(10)
      expect(new Set(shares).size).toBe(100)
    }
  })
})

describe('the mean is PINNED — §4.9a, now by construction rather than by a table', () => {
  it('makes the realised roster sum to exactly the headcount, for every seed', () => {
    // A pinned *distribution* mean only pins the *expected* sum: at sigma = 0.9
    // a studio of forty rolls a total anywhere within about ±18% of forty,
    // which is an eighteen per cent swing in Run 1's economy decided by the run
    // seed. The recursion removes it — the root *is* the headcount.
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
    // Every hire renormalises the frontier, so the invariant has to survive
    // being re-established 200 times rather than only being true at round
    // numbers. This is also what the fraction cache is checked against: a full
    // sibling group is cached *without* the headcount in its key, so a stale
    // entry would show up here and nowhere else.
    for (let devs = 1; devs <= 200; devs++) {
      let total = 0
      for (let i = 0; i < devs; i++) total += outputShare(77, devs, i)
      expect(total).toBeCloseTo(devs, 6)
    }
  })

  it('holds the total at the gate headcount, without visiting a hundred million seats', () => {
    // Two assertions in one line, and the second is the interesting one: a
    // range query is decomposed against the tree, so this is nine levels of at
    // most a thousand and not 10^8 of anything. If that ever stops being true
    // this test does not fail — it hangs, which is its own kind of report.
    for (const seed of SEEDS) expect(shareSum(seed, GATE, 0, GATE)).toBeCloseTo(GATE, 0)
  })
})

describe('a unit is worth about its headcount, and big units are flat', () => {
  it('values a full unit at roughly the number of people in it', () => {
    for (let level = 0; level < LEVEL_SIZES.length - 3; level++) {
      const size = LEVEL_SIZES[level]
      const w = unitWeight(11, GATE, level, 1)
      // Wide bounds on purpose: this is asking that the units are *headcount*
      // equivalents, not that the roll has been flattened.
      expect(w).toBeGreaterThan(size * 0.2)
      expect(w).toBeLessThan(size * 5)
    }
  })

  it('makes a half-empty squad worth about half a squad', () => {
    // Without occupancy in the raw weight the last unit on every floor would be
    // a freak — a squad of three people worth as much as the ninety-nine-strong
    // one beside it.
    const w = unitWeight(9, 1050, 1, 10)
    expect(w).toBeGreaterThan(20)
    expect(w).toBeLessThan(90)
  })

  it('narrows the spread as the unit grows, the way an average does', () => {
    // sigma / sqrt(size). A town of a million is flat because towns of a
    // million people are; a nation as volatile as a graduate is invisible in a
    // unit test and obvious the moment two of them are on screen together.
    const spreadAt = (level: number) => {
      const m = Array.from({ length: 400 }, (_, i) => unitMultiplier(5, level, i))
      return Math.max(...m) / Math.min(...m)
    }
    expect(spreadAt(1)).toBeGreaterThan(spreadAt(2))
    expect(spreadAt(2)).toBeGreaterThan(spreadAt(4))
    expect(spreadAt(5)).toBeLessThan(1.02)
  })

  it('derives the per-level sigma rather than tabulating it', () => {
    expect(unitSigma(1)).toBeCloseTo(0.9, 12)
    expect(unitSigma(100)).toBeCloseTo(0.09, 12)
    expect(unitSigma(1e6)).toBeCloseTo(0.0009, 12)
  })
})

describe('the ladder is §7.7.1’s with §7.8.1a’s squad under it', () => {
  it('agrees with units.ts about every rung it shares', () => {
    // A table copied out of another table is a table that drifts. Levels 2 and
    // up are `units.ts`'s own sizes, read off §7.7.1's headcount bands, and the
    // offset is one because the squad of 100 is inserted below them.
    for (let rung = 3; rung <= 9; rung++) {
      expect(LEVEL_SIZES[rung - 1]).toBe(nominalUnitSize(rung))
    }
  })

  it('carries both meanings of "a floor" instead of renaming either', () => {
    // §7.7.1's floor is rung 3's unit and is a thousand. §7.8.1a's floor is a
    // hundred squads and is ten thousand. Both are canon, both are built, and
    // the tree simply has a level for each.
    expect(LEVEL_SIZES[1]).toBe(100)
    expect(LEVEL_SIZES[2]).toBe(1_000)
    expect(LEVEL_SIZES[3]).toBe(10_000)
  })
})

describe('generated, never stored — the §7.8.7 contract', () => {
  it('survives the memo being dropped mid-run', () => {
    const before = outputShare(12, 500, 37)
    __clearAggregateCache()
    expect(outputShare(12, 500, 37)).toBe(before)
  })

  it('keeps two people in a squad in the ratio of their rolls', () => {
    // A hire must not re-roll anybody, and the normalise must not reorder them.
    // Shares are squad-local now, so the invariant is the *ratio* rather than
    // the absolute share — and the ratio is what a player can actually see, in
    // two §8.2b numerals side by side.
    for (const devs of [40, 400, 4000, GATE]) {
      const a = outputShare(8, devs, 3)
      const b = outputShare(8, devs, 4)
      expect(a / b).toBeCloseTo(outputRoll(8, 3) / outputRoll(8, 4), 9)
    }
  })

  it('gives the same person the same share whichever way they were asked for', () => {
    expect(shareSum(6, 50_000, 777, 778)).toBeCloseTo(outputShare(6, 50_000, 777), 12)
  })

  it('survives nonsense', () => {
    expect(Number.isFinite(outputShare(1, 0, 0))).toBe(true)
    expect(Number.isFinite(outputShare(1, -5, -5))).toBe(true)
    expect(Number.isFinite(shareSum(1, 0, 0, 10))).toBe(true)
    expect(Number.isFinite(unitWeight(1, Number.NaN, 2, 0))).toBe(true)
    expect(unitWeight(1, 100, 99, 0)).toBe(100)
  })
})

describe('outputClass over the shares — §14.4', () => {
  it('keeps the 10x band rare enough to mean something', () => {
    // If one developer in eight is a "10x Engineer" the label is decoration.
    const n = 20_000
    let heroes = 0
    for (let i = 0; i < n; i++) {
      if (outputClass(outputShare(404, n, i)) === '10x') heroes++
    }
    expect(heroes / n).toBeLessThan(0.01)
    expect(heroes).toBeGreaterThan(0)
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
    // individual one. R14 buffs a *unit*, so this is the path the economy runs
    // through and it has to carry the same guarantee.
    for (const seed of SEEDS) expect(shareSum(seed, 640, 0, 640)).toBeCloseTo(640, 6)
  })

  it('is nothing across an empty or backwards range', () => {
    expect(shareSum(7, 400, 200, 200)).toBe(0)
    expect(shareSum(7, 400, 260, 120)).toBe(0)
  })

  it('answers for a unit past the old roster cap without flattening it', () => {
    // The tail used to be exactly its own length. It is now a real aggregate,
    // so a town-sized buff is still worth about a town — and no longer worth
    // *exactly* a town, which is the point.
    const town = shareSum(7, 2_000_000, 1_000_000, 2_000_000)
    expect(town).toBeGreaterThan(900_000)
    expect(town).toBeLessThan(1_100_000)
    expect(town).not.toBe(1_000_000)
  })

  it('stops at the headcount rather than counting empty seats', () => {
    expect(shareSum(7, 400, 0, 100_000)).toBeCloseTo(400, 6)
  })

  it('handles a range that straddles unit boundaries at several levels', () => {
    const whole = shareSum(3, 250_000, 0, 250_000)
    const a = shareSum(3, 250_000, 0, 7_321)
    const b = shareSum(3, 250_000, 7_321, 199_998)
    const c = shareSum(3, 250_000, 199_998, 250_000)
    expect(a + b + c).toBeCloseTo(whole, 6)
  })
})
