import { describe, expect, it } from 'vitest'
import { efficiency } from './entropy.ts'
import {
  FIBONACCI_LADDER,
  STATE_MULTIPLIER,
  ZOOM_YIELD,
  fibonacciTier,
  pokeEndsFlow,
  resolvePoke,
  type DevState,
  type ZoomLevel,
} from './poke.ts'

describe('the Fibonacci estimation ladder (GDD §4.6)', () => {
  it('runs 1, 2, 3, 5, 8, 13, 21 across F1–F7', () => {
    expect(FIBONACCI_LADDER).toEqual([1, 2, 3, 5, 8, 13, 21])
    expect([1, 2, 3, 4, 5, 6, 7].map(fibonacciTier)).toEqual([1, 2, 3, 5, 8, 13, 21])
  })

  it('continues procedurally past F7, so the clicker survives cosmic scale', () => {
    expect([8, 9, 10].map(fibonacciTier)).toEqual([34, 55, 89])
  })

  it('yields nothing below F1', () => {
    expect(fibonacciTier(0)).toBe(0)
  })
})

describe('dev state multipliers (GDD §4.7)', () => {
  it('makes Flow State the biggest single-tap payout short of a 10x', () => {
    expect(STATE_MULTIPLIER.flow).toBe(3)
    expect(STATE_MULTIPLIER.tenx).toBe(10)
    expect(STATE_MULTIPLIER.flow).toBeGreaterThan(STATE_MULTIPLIER.working)
  })

  it('pays nothing for an Overwhelmed dev — the value is clearing the lockup', () => {
    expect(resolvePoke({ tier: 5, state: 'overwhelmed', zoom: 1, efficiency: 1 }).sp).toBe(0)
  })

  it('takes points back from a Rogue Refactorer', () => {
    expect(resolvePoke({ tier: 5, state: 'rogue', zoom: 1, efficiency: 1 }).sp).toBeLessThan(0)
  })
})

describe('zoom-scaled poking (GDD §4.8)', () => {
  it('falls monotonically as the camera pulls away from the work', () => {
    const levels: ZoomLevel[] = [1, 2, 3, 4]
    const yields = levels.map((z) => ZOOM_YIELD[z])
    expect(yields).toEqual([...yields].sort((a, b) => b - a))
    expect(ZOOM_YIELD[1]).toBe(1)
  })

  it('makes desk zoom the surgical choice for a high-value target', () => {
    const flowAtDesk = resolvePoke({ tier: 5, state: 'flow', zoom: 1, efficiency: 1 }).sp
    const flowAtCosmic = resolvePoke({ tier: 5, state: 'flow', zoom: 4, efficiency: 1 }).sp
    expect(flowAtDesk).toBeGreaterThan(flowAtCosmic)
  })
})

describe('SP_poke = F * S * Z * eta (GDD §4.5)', () => {
  it('multiplies all four terms', () => {
    const eta = 0.8
    const { sp } = resolvePoke({ tier: 5, state: 'flow', zoom: 2, efficiency: eta })
    expect(sp).toBeCloseTo(8 * 3 * 0.4 * eta, 10)
  })

  it('taxes pokes by Entropy exactly like passive output', () => {
    const healthy = resolvePoke({
      tier: 5,
      state: 'working',
      zoom: 1,
      efficiency: efficiency(76, 100),
    }).sp
    const trapped = resolvePoke({
      tier: 5,
      state: 'working',
      zoom: 1,
      efficiency: efficiency(1000, 100),
    }).sp
    expect(trapped).toBeLessThan(healthy)
  })

  it('means a locked player cannot tap their way out (GDD §4.5, §6.3)', () => {
    // Act V: 10,000 devs against a cap of 100.
    const { sp } = resolvePoke({
      tier: 7,
      state: 'flow',
      zoom: 1,
      efficiency: efficiency(10_000, 100),
    })
    expect(sp).toBeLessThan(1e-6)
  })
})

describe('the poke’s side effects (GDD §4.9, §8.2)', () => {
  it('charges local entropy in proportion to what was extracted', () => {
    const small = resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1 })
    const large = resolvePoke({ tier: 7, state: 'working', zoom: 1, efficiency: 1 })
    expect(large.localEntropyAdded).toBeGreaterThan(small.localEntropyAdded)
  })

  it('still charges for interrupting a Rogue Refactorer, despite the negative SP', () => {
    const { localEntropyAdded } = resolvePoke({
      tier: 5,
      state: 'rogue',
      zoom: 1,
      efficiency: 1,
    })
    expect(localEntropyAdded).toBeGreaterThan(0)
  })

  it('makes climbing the ladder cost more entropy, not just pay more', () => {
    // "Higher-tier pokes cost proportionally more Entropy" — §4.9.
    const f1 = resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1 })
    const f7 = resolvePoke({ tier: 7, state: 'working', zoom: 1, efficiency: 1 })
    expect(f7.localEntropyAdded / f1.localEntropyAdded).toBeCloseTo(f7.sp / f1.sp, 6)
  })

  it('flags crits for the larger numeral and the chromatic punch', () => {
    const crits: DevState[] = ['flow', 'tenx']
    for (const state of crits) {
      expect(resolvePoke({ tier: 1, state, zoom: 1, efficiency: 1 }).crit).toBe(true)
    }
    expect(resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1 }).crit).toBe(false)
  })

  it('quits the 10x Engineer on the poke that cashes them out', () => {
    expect(resolvePoke({ tier: 1, state: 'tenx', zoom: 1, efficiency: 1 }).quits).toBe(true)
    expect(resolvePoke({ tier: 1, state: 'flow', zoom: 1, efficiency: 1 }).quits).toBe(false)
  })
})

describe('Flow State is cashed in, not protected (GDD §8.2)', () => {
  it('ends Flow without the Culture upgrade', () => {
    expect(pokeEndsFlow('flow', false)).toBe(true)
  })

  it('prolongs it once the Culture upgrade is owned', () => {
    expect(pokeEndsFlow('flow', true)).toBe(false)
  })

  it('does not apply to anyone else', () => {
    expect(pokeEndsFlow('working', false)).toBe(false)
  })
})
