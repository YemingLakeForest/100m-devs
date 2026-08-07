import { describe, expect, it } from 'vitest'
import { BAND_EDGES, zoomLevel } from '../render/omniLens.ts'
import {
  ACT_IV_DROP_MS,
  ACT_IV_GAP_MS,
  STRAIN_LAYERS,
  ZONE_BEDS,
  actIVEnvelope,
  mix,
  strainLayerGains,
  zoneBedGains,
} from './music.ts'

describe('zoneBedGains — GDD §20.7.3, shares the LOD cross-fade weights', () => {
  it('sums to 1 across the whole zoom range, same as the picture', () => {
    // The GDD's whole point in §20.7.3 is that music reuses the exact curve
    // that already drives the picture (src/render/omniLens.ts lodWeights),
    // rather than a second, similar-looking one. BAND_EDGES is imported from
    // the same module, not redeclared here, to keep that honest.
    for (let z = 0; z <= 1.0001; z += 0.02) {
      const total = Object.values(zoneBedGains(z)).reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('peaks on the bed for the band Z is currently in', () => {
    const bedForLevel = {
      1: 'bed-desk',
      2: 'bed-floor',
      3: 'bed-global',
      4: 'bed-cosmic',
    } as const

    for (const z of [0.05, 0.3, 0.65, 0.95]) {
      const gains = zoneBedGains(z)
      const winner = ZONE_BEDS.reduce((a, b) => (gains[b] > gains[a] ? b : a))
      expect(winner).toBe(bedForLevel[zoomLevel(z)])
    }
  })

  it('crossfades at the shared §20.2 band edges instead of swapping', () => {
    for (const edge of BAND_EDGES) {
      const gains = zoneBedGains(edge)
      const nonZero = ZONE_BEDS.filter((b) => gains[b] > 0)
      expect(nonZero.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('strainLayerGains — GDD §20.7.3, calm/strained/collapse mixed by Entropy', () => {
  it('always sums to 1, so escalation never reads as a loudness pulse', () => {
    for (let e = 0; e <= 1.0001; e += 0.02) {
      const total = Object.values(strainLayerGains(e)).reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('calm dominates below 10% Entropy', () => {
    const gains = strainLayerGains(0.05)
    expect(gains['layer-calm']).toBeGreaterThan(gains['layer-strained'])
    expect(gains['layer-calm']).toBeGreaterThan(gains['layer-collapse'])
  })

  it('strained dominates the mix across the 40-70% window the GDD names', () => {
    for (const e of [0.4, 0.5, 0.55, 0.6, 0.7]) {
      const gains = strainLayerGains(e)
      expect(gains['layer-strained']).toBeGreaterThan(gains['layer-calm'])
      expect(gains['layer-strained']).toBeGreaterThan(gains['layer-collapse'])
      expect(gains['layer-strained']).toBeGreaterThan(0.9)
    }
  })

  it('collapse is silent before 90% Entropy, so the Act IV override is the only way to hear it early', () => {
    for (let e = 0; e < 0.85; e += 0.05) {
      expect(strainLayerGains(e)['layer-collapse']).toBe(0)
    }
    expect(strainLayerGains(1)['layer-collapse']).toBeGreaterThan(0.5)
  })

  it('never produces a negative or NaN weight across the whole range', () => {
    for (let e = -0.5; e <= 1.5; e += 0.05) {
      const gains = strainLayerGains(e)
      for (const layer of STRAIN_LAYERS) {
        expect(gains[layer]).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(gains[layer])).toBe(true)
      }
    }
  })
})

describe('actIVEnvelope — GDD §20.7.4, the one scripted override', () => {
  it('leaves the mix untouched before the trigger', () => {
    expect(actIVEnvelope(-1)).toEqual({ bedGain: 1, collapseGain: 0 })
  })

  it('is a drop, not a fade: bed gain reaches zero by ACT_IV_DROP_MS', () => {
    expect(actIVEnvelope(0).bedGain).toBe(1)
    expect(actIVEnvelope(ACT_IV_DROP_MS).bedGain).toBe(0)
    expect(actIVEnvelope(ACT_IV_DROP_MS + 10_000).bedGain).toBe(0)
  })

  it('drops monotonically across the 120 ms window — no bounce', () => {
    let prev = actIVEnvelope(0).bedGain
    for (let t = 1; t <= ACT_IV_DROP_MS; t++) {
      const cur = actIVEnvelope(t).bedGain
      expect(cur).toBeLessThanOrEqual(prev)
      prev = cur
    }
  })

  it('holds ~400 ms of gap with both bed and collapse silent', () => {
    const mid = ACT_IV_DROP_MS + ACT_IV_GAP_MS / 2
    const env = actIVEnvelope(mid)
    expect(env.bedGain).toBe(0)
    expect(env.collapseGain).toBe(0)
  })

  it('brings collapse up alone once the gap ends, and it stays up', () => {
    const collapseStart = ACT_IV_DROP_MS + ACT_IV_GAP_MS
    expect(actIVEnvelope(collapseStart).collapseGain).toBe(0)
    expect(actIVEnvelope(collapseStart + 10_000).collapseGain).toBe(1)
    expect(actIVEnvelope(collapseStart + 10_000).bedGain).toBe(0)
  })
})

describe('mix — the whole score as a pure function of (Z, Entropy, Act IV state)', () => {
  it('matches the un-triggered pure pieces when Act IV has not fired', () => {
    const z = 0.42
    const e = 0.3
    const state = mix(z, e, null)
    expect(state.beds).toEqual(zoneBedGains(z))
    expect(state.layers).toEqual(strainLayerGains(e))
  })

  it('ducks every bed together during the drop, regardless of Z', () => {
    const halfway = ACT_IV_DROP_MS / 2
    for (const z of [0.05, 0.4, 0.7, 0.99]) {
      const state = mix(z, 0.95, halfway)
      const unducked = zoneBedGains(z)
      for (const bed of ZONE_BEDS) {
        expect(state.beds[bed]).toBeCloseTo(unducked[bed] * 0.5, 10)
      }
    }
  })

  it('leaves no bed under collapse once it lands', () => {
    const collapseStart = ACT_IV_DROP_MS + ACT_IV_GAP_MS
    const state = mix(0.5, 0.99, collapseStart + 5_000)
    for (const bed of ZONE_BEDS) expect(state.beds[bed]).toBe(0)
    expect(state.layers['layer-collapse']).toBe(1)
    expect(state.layers['layer-calm']).toBe(0)
    expect(state.layers['layer-strained']).toBe(0)
  })

  it('forces collapse alone during the override even if Entropy has not actually pinned', () => {
    // §20.7.4's override is scripted, not derived — it must not wait on the
    // sim's exact Entropy value to agree with it on the trigger frame.
    const collapseStart = ACT_IV_DROP_MS + ACT_IV_GAP_MS
    const state = mix(0.5, 0.2, collapseStart + 1)
    expect(state.layers['layer-calm']).toBe(0)
    expect(state.layers['layer-strained']).toBe(0)
  })
})
