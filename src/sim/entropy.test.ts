import { describe, expect, it } from 'vitest'
import {
  D_BASE,
  RHO,
  bestOutput,
  capacityForEfficiency,
  decayLocalEntropy,
  devCap,
  devEfficiency,
  efficiency,
  entropy,
  isEntropyLocked,
  optimalHeadcount,
  passiveVelocity,
} from './entropy.ts'

/**
 * GDD §4.2 carries a table headed "Verified against the design's own stated
 * figures". These tests are that table, executable. If one of them fails, either
 * the implementation drifted or the design changed — and either way the GDD and
 * the code have stopped agreeing, which is the thing worth catching.
 */
describe('the design’s own stated figures (GDD §4.2)', () => {
  it('solo dev on Run 1 produces the 1 SP/s baseline', () => {
    expect(efficiency(1, 100)).toBeCloseTo(1.0, 4)
    expect(passiveVelocity(1, 100)).toBeCloseTo(1.0, 4)
  })

  it('at the optimum headcount, 76 devs run at ~0.798 efficiency for ~60.6 SP/s', () => {
    expect(efficiency(76, 100)).toBeCloseTo(0.798, 3)
    expect(passiveVelocity(76, 100)).toBeCloseTo(60.6, 1)
  })

  it('at exactly capacity, efficiency is 50%', () => {
    expect(efficiency(100, 100)).toBe(0.5)
    expect(passiveVelocity(100, 100)).toBe(50)
  })

  it('the trap: 1,000 devs against a 100 cap collapses to 0.01 SP/s', () => {
    expect(efficiency(1000, 100)).toBeCloseTo(1e-5, 9)
    expect(passiveVelocity(1000, 100)).toBeCloseTo(0.01, 6)
  })

  it('a solo dev is genuinely 100x faster than the trapped 1,000 (GDD §6.2)', () => {
    expect(passiveVelocity(1, 100) / passiveVelocity(1000, 100)).toBeCloseTo(100, 1)
  })

  it('Run 1 Act V: 10,000 devs read as "Production Speed: 0.00000x"', () => {
    expect(efficiency(10_000, 100)).toBeCloseTo(1e-10, 14)
    expect(passiveVelocity(10_000, 100)).toBeCloseTo(1e-6, 10)
  })
})

describe('the optimum sits below capacity (GDD §4.1)', () => {
  it('is about 76% of the cap', () => {
    expect(optimalHeadcount(100) / 100).toBeCloseTo(0.76, 2)
  })

  it('yields a best output of about 0.61 * D_cap', () => {
    expect(bestOutput(100) / 100).toBeCloseTo(0.61, 2)
  })

  it('really is a maximum — hiring past it makes the company slower', () => {
    const cap = 100
    const peak = optimalHeadcount(cap)
    const at = passiveVelocity(peak, cap)
    expect(passiveVelocity(peak - 5, cap)).toBeLessThan(at)
    expect(passiveVelocity(peak + 5, cap)).toBeLessThan(at)
  })

  it('holds the same shape at every capacity, not just the base one', () => {
    for (const cap of [100, 10_000, 1e6, 1e8]) {
      expect(optimalHeadcount(cap) / cap).toBeCloseTo(0.76, 2)
    }
  })
})

describe('the 100M gate (GDD §4.2)', () => {
  it('is not D_cap = 1e8 — at exactly capacity, efficiency is only 50%', () => {
    expect(efficiency(1e8, 1e8)).toBe(0.5)
  })

  it('needs roughly 2.5x more capacity than headcount', () => {
    const needed = capacityForEfficiency(1e8, 0.99)
    expect(needed / 1e8).toBeCloseTo(2.5, 1)
    expect(efficiency(1e8, needed)).toBeCloseTo(0.99, 6)
  })

  it('exposes the rounding in the GDD’s stated 2.5e8 figure', () => {
    // §4.2 rounds L = 0.39892 to 0.40, which rounds D_cap down past the gate.
    // 2.5e8 lands at 98.99%; the true threshold is 2.5068e8.
    expect(efficiency(1e8, 2.5e8)).toBeLessThan(0.99)
    expect(capacityForEfficiency(1e8, 0.99)).toBeCloseTo(2.5068e8, -5)
  })
})

describe('entropy readout', () => {
  it('is 1 - eta and reads as a percentage of nominal output', () => {
    expect(entropy(1, 100)).toBeCloseTo(0, 4)
    expect(entropy(100, 100)).toBe(0.5)
  })

  it('locks once the studio has effectively seized', () => {
    expect(isEntropyLocked(entropy(1000, 100))).toBe(true)
    expect(isEntropyLocked(entropy(76, 100))).toBe(false)
  })

  it('survives a headcount large enough to overflow L^rho', () => {
    // 1e70 ** 5 is Infinity; the naive form would return NaN, not 0.
    expect(efficiency(1e70, 100)).toBe(0)
    expect(passiveVelocity(1e70, 100)).toBe(0)
    expect(entropy(1e70, 100)).toBe(1)
  })

  it('treats a zero capacity as total collapse rather than NaN', () => {
    expect(efficiency(10, 0)).toBe(0)
  })
})

describe('developer cap (GDD §4.2)', () => {
  it('is the base capacity before any prestige allocation', () => {
    expect(devCap(0)).toBe(D_BASE)
  })

  it('compounds superlinearly with allocated blueprint points', () => {
    const one = devCap(1)
    const ten = devCap(10)
    expect(one).toBeGreaterThan(D_BASE)
    // phi = 1.35, so 10x the points buys more than 10x the capacity.
    expect(ten / one).toBeGreaterThan(10)
  })

  it('can reach the capacity ladder the player is climbing toward', () => {
    // §4.2's ladder tops out at 1e8; the gate proper needs 2.5e8.
    expect(devCap(1000)).toBeGreaterThan(2.5e8)
  })
})

describe('context switch penalty (GDD §4.9)', () => {
  it('makes a poked developer worse than their peers', () => {
    const eta = efficiency(76, 100)
    expect(devEfficiency(eta, 0)).toBe(eta)
    expect(devEfficiency(eta, 0.5)).toBeLessThan(eta)
  })

  it('decays toward baseline over roughly 8 seconds', () => {
    const start = 1
    expect(decayLocalEntropy(start, 0)).toBe(start)
    expect(decayLocalEntropy(start, 4)).toBeLessThan(start * 0.2)
    expect(decayLocalEntropy(start, 8)).toBeLessThan(start * 0.03)
  })

  it('snaps to exactly zero once it is inaudible, so state settles', () => {
    expect(decayLocalEntropy(1, 30)).toBe(0)
    expect(decayLocalEntropy(0, 1)).toBe(0)
  })
})

describe('tuning constants match the GDD', () => {
  it('rho is 5 — the most important knob in the game', () => {
    expect(RHO).toBe(5)
  })
})
