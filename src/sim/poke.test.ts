import { describe, expect, it } from 'vitest'
import { efficiency } from './entropy.ts'
import {
  FIBONACCI_LADDER,
  STATE_MULTIPLIER,
  ZOOM_YIELD,
  ZOOM_BLAST_RADIUS,
  fibonacciTier,
  pokeEndsFlow,
  pokeReach,
  resolvePoke,
  sizeYield,
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
    expect(resolvePoke({ tier: 5, state: 'overwhelmed', zoom: 1, efficiency: 1, devs: 1 }).sp).toBe(0)
  })

  it('takes points back from a Rogue Refactorer', () => {
    expect(resolvePoke({ tier: 5, state: 'rogue', zoom: 1, efficiency: 1, devs: 1 }).sp).toBeLessThan(0)
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
    // Per *developer*, which is what the Z factor governs. Reach is pinned at
    // one here so the comparison is about yield alone.
    const flowAtDesk = resolvePoke({ tier: 5, state: 'flow', zoom: 1, efficiency: 1, devs: 1 }).sp
    const flowAtCosmic = resolvePoke({ tier: 5, state: 'flow', zoom: 4, efficiency: 1, devs: 1 }).sp
    expect(flowAtDesk).toBeGreaterThan(flowAtCosmic)
  })

  it('multiplies the yield by the blast radius, which is the other half of §4.8', () => {
    // The half that was declared and never applied. `ZOOM_BLAST_RADIUS` existed,
    // was documented, and was read by nothing — so the per-dev penalty was live
    // and the reach that pays for it was not. Zooming out was therefore strictly
    // worse at every headcount, which inverts the entire "zoom out to sweep,
    // punch in to extract" rhythm the section exists to create.
    const at = (zoom: ZoomLevel, devs: number) =>
      resolvePoke({ tier: 1, state: 'working', zoom, efficiency: 1, devs }).sp

    // §4.8: L4 is "highest raw total, lowest respect for the individual".
    expect(at(4, 1_000_000)).toBeGreaterThan(at(1, 1_000_000))
    expect(at(3, 5_000)).toBeGreaterThan(at(2, 5_000))
  })

  it('cannot reach developers who are not there', () => {
    // A cosmic tap on a studio of forty hits forty people. Without the clamp it
    // would pay out as if a million were listening.
    expect(pokeReach(4, 40)).toBe(40)
    expect(pokeReach(4, 5_000_000)).toBe(ZOOM_BLAST_RADIUS[4])
    expect(pokeReach(1, 5_000_000)).toBe(1)
  })

  it('never rounds a real poke down to nothing', () => {
    // The visible symptom of the missing radius: a tap at global zoom yielded
    // 0.08 SP, the floater rounded it to `+0`, and the simulation banked it
    // anyway. Whatever the zoom, a tap that lands must be worth something.
    for (const zoom of [1, 2, 3, 4] as ZoomLevel[]) {
      const sp = resolvePoke({ tier: 1, state: 'working', zoom, efficiency: 1, devs: 60 }).sp
      expect(sp).toBeGreaterThan(0)
    }
  })
})

describe('sizeYield — §4.8’s Z, read continuously (GDD §4.5b)', () => {
  it('agrees with §4.8’s table at every one of its own anchors', () => {
    // The whole reason it is derived rather than written down a second time:
    // R15 needs a Z for a unit of 37,000 people, and §4.8 only names four
    // sizes. A separate curve fitted by eye would be a table that can drift
    // from the canon one silently.
    expect(sizeYield(ZOOM_BLAST_RADIUS[1])).toBeCloseTo(ZOOM_YIELD[1], 10)
    expect(sizeYield(ZOOM_BLAST_RADIUS[2])).toBeCloseTo(ZOOM_YIELD[2], 10)
    expect(sizeYield(ZOOM_BLAST_RADIUS[3])).toBeCloseTo(ZOOM_YIELD[3], 10)
    expect(sizeYield(ZOOM_BLAST_RADIUS[4])).toBeCloseTo(ZOOM_YIELD[4], 10)
  })

  it('falls as the unit grows, without ever reaching zero', () => {
    // §4.5b: "the buff percentage falls as the unit grows". And a rung whose
    // buff is exactly zero is a rung where the primary verb does nothing,
    // which is the thing R15 exists to stop.
    const sizes = [1, 10, 100, 1e3, 1e6, 1e9, 1e13]
    const ys = sizes.map(sizeYield)
    expect(ys).toEqual([...ys].sort((a, b) => b - a))
    expect(ys[ys.length - 1]).toBeGreaterThan(0)
  })

  it('never pays more for a bigger unit than for one person', () => {
    expect(sizeYield(0)).toBe(1)
    expect(sizeYield(0.5)).toBe(1)
  })
})

describe('the unit is the reach (GDD §4.5b, R15)', () => {
  it('agrees with the zoom band when the unit is that band’s size', () => {
    // The generalisation has to contain the thing it generalises, or §4.8's
    // four rows have quietly become five.
    const byZoom = resolvePoke({ tier: 3, state: 'working', zoom: 3, efficiency: 1, devs: 1e9 })
    const byUnit = resolvePoke({
      tier: 3,
      state: 'working',
      zoom: 3,
      efficiency: 1,
      devs: 1e9,
      unitSize: ZOOM_BLAST_RADIUS[3],
    })
    expect(byUnit.sp).toBeCloseTo(byZoom.sp, 8)
  })

  it('reaches exactly the unit, not the zoom band it happens to be seen at', () => {
    // The bug R15 replaces: at tier 2 a tap on one developer was paid for
    // fourteen of them, while §7.7.6 promised it landed on "the actual
    // developer under the thumb". One person is one person at any zoom.
    const one = resolvePoke({
      tier: 1,
      state: 'working',
      zoom: 2,
      efficiency: 1,
      devs: 500,
      unitSize: 1,
    })
    expect(one.sp).toBeCloseTo(1, 10)
  })

  it('is worth more in total for a bigger unit, and less per developer', () => {
    // §4.8's own rhythm, now measured against units rather than bands: "zoom
    // out to sweep for volume, punch in to extract from a specific
    // high-value developer".
    const at = (unitSize: number) =>
      resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1, devs: 1e9, unitSize }).sp

    expect(at(1e4)).toBeGreaterThan(at(1e3))
    expect(at(1e4) / 1e4).toBeLessThan(at(1e3) / 1e3)
  })

  it('cannot reach past the studio', () => {
    const { sp } = resolvePoke({
      tier: 1,
      state: 'working',
      zoom: 1,
      efficiency: 1,
      devs: 40,
      unitSize: 1_000_000,
    })
    expect(sp).toBeCloseTo(sizeYield(40) * 40, 8)
  })
})

describe('SP_poke = F * S * Z * eta (GDD §4.5)', () => {
  it('multiplies all four terms', () => {
    const eta = 0.8
    const { sp } = resolvePoke({ tier: 5, state: 'flow', zoom: 2, efficiency: eta, devs: 1 })
    expect(sp).toBeCloseTo(8 * 3 * 0.4 * eta, 10)
  })

  it('taxes pokes by Entropy exactly like passive output', () => {
    const healthy = resolvePoke({
      tier: 5,
      state: 'working',
      zoom: 1,
      devs: 1,
      efficiency: efficiency(76, 100),
    }).sp
    const trapped = resolvePoke({
      tier: 5,
      state: 'working',
      zoom: 1,
      devs: 1,
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
      devs: 1,
      efficiency: efficiency(10_000, 100),
    })
    expect(sp).toBeLessThan(1e-6)
  })
})

describe('the poke’s side effects (GDD §4.9, §8.2)', () => {
  it('charges local entropy in proportion to what was extracted', () => {
    const small = resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1, devs: 1 })
    const large = resolvePoke({ tier: 7, state: 'working', zoom: 1, efficiency: 1, devs: 1 })
    expect(large.localEntropyAdded).toBeGreaterThan(small.localEntropyAdded)
  })

  it('still charges for interrupting a Rogue Refactorer, despite the negative SP', () => {
    const { localEntropyAdded } = resolvePoke({
      tier: 5,
      state: 'rogue',
      zoom: 1,
      devs: 1,
      efficiency: 1,
    })
    expect(localEntropyAdded).toBeGreaterThan(0)
  })

  it('makes climbing the ladder cost more entropy, not just pay more', () => {
    // "Higher-tier pokes cost proportionally more Entropy" — §4.9.
    const f1 = resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1, devs: 1 })
    const f7 = resolvePoke({ tier: 7, state: 'working', zoom: 1, efficiency: 1, devs: 1 })
    expect(f7.localEntropyAdded / f1.localEntropyAdded).toBeCloseTo(f7.sp / f1.sp, 6)
  })

  it('flags crits for the larger numeral and the chromatic punch', () => {
    const crits: DevState[] = ['flow', 'tenx']
    for (const state of crits) {
      expect(resolvePoke({ tier: 1, state, zoom: 1, efficiency: 1, devs: 1 }).crit).toBe(true)
    }
    expect(resolvePoke({ tier: 1, state: 'working', zoom: 1, efficiency: 1, devs: 1 }).crit).toBe(false)
  })

  it('quits the 10x Engineer on the poke that cashes them out', () => {
    expect(resolvePoke({ tier: 1, state: 'tenx', zoom: 1, efficiency: 1, devs: 1 }).quits).toBe(true)
    expect(resolvePoke({ tier: 1, state: 'flow', zoom: 1, efficiency: 1, devs: 1 }).quits).toBe(false)
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
