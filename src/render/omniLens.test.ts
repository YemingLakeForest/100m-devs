import { describe, expect, it } from 'vitest'
import { TIER_EXTENTS } from './scene.ts'
import { zAtRung } from '../sim/ladder.ts'
import {
  BAND_EDGES,
  CENTRES,
  LensCamera,
  FIT_MARGIN,
  ORDERS_OF_MAGNITUDE,
  tierScale,
  lodWeights,
  scaleAt,
  zoomForScale,
  zoomLevel,
} from './omniLens.ts'

describe('the four canonical levels (GDD §7.4)', () => {
  it('bands Z where the §7.4a ladder changes tier, not on round numbers', () => {
    // The bands used to be [0.2, 0.5, 0.8] — three round numbers with nothing
    // underneath them, which is the visible half of §7.4a's complaint: the
    // bands *were* the navigation, so a pull-back crossed four of them and
    // arrived at a galaxy. A band edge is now the midpoint between the last
    // rung one tier's geometry draws and the first rung the next one does.
    expect(BAND_EDGES).toEqual([zAtRung(1.5), zAtRung(3.5), zAtRung(7.5)])
  })

  it('maps each band to its level', () => {
    // Rungs 0–1 are the room, 2–3 the floor and the tower, 4–7 the city and the
    // grid, 8–9 the cosmos. Sampled just inside each rung stop rather than at
    // the edges, because an edge is a cross-fade and belongs to both.
    expect(zoomLevel(zAtRung(0))).toBe(1)
    expect(zoomLevel(zAtRung(1))).toBe(1)
    expect(zoomLevel(zAtRung(2))).toBe(2)
    expect(zoomLevel(zAtRung(3))).toBe(2)
    expect(zoomLevel(zAtRung(4))).toBe(3)
    expect(zoomLevel(zAtRung(7))).toBe(3)
    expect(zoomLevel(zAtRung(8))).toBe(4)
    expect(zoomLevel(1)).toBe(4)
  })
})

describe('scale spans nine orders of magnitude (GDD §7.2)', () => {
  it('is 1:1 at the desk and 1:1e9 at galactic', () => {
    expect(scaleAt(0)).toBe(1)
    expect(scaleAt(1)).toBeCloseTo(1e-9, 12)
    expect(ORDERS_OF_MAGNITUDE).toBe(9)
  })

  it('is logarithmic, so the desk stays reachable across the whole gesture', () => {
    // Half the gesture covers half the orders of magnitude, not half the scale.
    expect(scaleAt(0.5)).toBeCloseTo(10 ** -4.5, 10)
  })

  it('round-trips through zoomForScale', () => {
    for (const z of [0, 0.13, 0.5, 0.77, 1]) {
      expect(zoomForScale(scaleAt(z))).toBeCloseTo(z, 10)
    }
  })

  it('clamps beyond the ends rather than running off the ladder', () => {
    expect(scaleAt(-1)).toBe(1)
    expect(scaleAt(2)).toBeCloseTo(1e-9, 12)
  })
})

describe('LOD cross-fade (GDD §10.5 — nothing cuts)', () => {
  it('always sums to 1, so a dolly holds constant brightness', () => {
    for (let z = 0; z <= 1.0001; z += 0.01) {
      const total = Object.values(lodWeights(z)).reduce((a, b) => a + b, 0)
      expect(total).toBeCloseTo(1, 10)
    }
  })

  it('peaks on the level whose band Z is in', () => {
    for (const z of [0.05, 0.3, 0.65, 0.95]) {
      const w = lodWeights(z)
      const winner = ([1, 2, 3, 4] as const).reduce((a, b) => (w[b] > w[a] ? b : a))
      expect(winner).toBe(zoomLevel(z))
    }
  })

  it('overlaps neighbours at a band edge rather than swapping', () => {
    const w = lodWeights(BAND_EDGES[0])
    expect(w[1]).toBeGreaterThan(0)
    expect(w[2]).toBeGreaterThan(0)
  })

  it('never lights a tier three bands away', () => {
    expect(lodWeights(0)[4]).toBe(0)
    expect(lodWeights(1)[1]).toBe(0)
  })

  it('falls back to a visible room when gesture input is not finite', () => {
    const weights = lodWeights(Number.NaN)
    expect(Object.values(weights).every(Number.isFinite)).toBe(true)
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(weights[1]).toBeGreaterThan(0)
  })

  it('is continuous — no weight jumps between adjacent samples', () => {
    let prev = lodWeights(0)
    for (let z = 0.005; z <= 1; z += 0.005) {
      const next = lodWeights(z)
      for (const level of [1, 2, 3, 4] as const) {
        expect(Math.abs(next[level] - prev[level])).toBeLessThan(0.05)
      }
      prev = next
    }
  })
})

describe('LensCamera', () => {
  it('clamps Z to the ladder', () => {
    const cam = new LensCamera()
    cam.set(-3)
    expect(cam.z).toBe(0)
    cam.set(7)
    expect(cam.z).toBe(1)
  })

  it('nudges relatively, as a pinch does', () => {
    const cam = new LensCamera(0.4)
    cam.nudge(0.15)
    expect(cam.z).toBeCloseTo(0.55, 10)
    expect(cam.level).toBe(3)
  })

  it('rejects invalid pinch results instead of blanking every scene layer', () => {
    const cam = new LensCamera(0.4)
    cam.set(Number.NaN)
    cam.nudge(Number.POSITIVE_INFINITY)
    expect(cam.z).toBe(0.4)
    expect(Number.isFinite(cam.scale)).toBe(true)
  })

  it('measures velocity so a pinch and a programmatic dolly smear alike', () => {
    const cam = new LensCamera(0)
    expect(cam.velocity).toBe(0)
    for (let i = 0; i < 40; i++) {
      cam.nudge(0.01)
      cam.sample(1 / 60)
    }
    expect(cam.velocity).toBeGreaterThan(0)
  })

  it('settles back to zero velocity once the camera stops', () => {
    const cam = new LensCamera(0)
    for (let i = 0; i < 20; i++) {
      cam.nudge(0.02)
      cam.sample(1 / 60)
    }
    const moving = cam.velocity
    for (let i = 0; i < 120; i++) cam.sample(1 / 60)
    expect(cam.velocity).toBeLessThan(moving * 0.05)
  })

  it('ignores a zero-length frame rather than dividing by it', () => {
    const cam = new LensCamera(0.5)
    cam.sample(0)
    expect(Number.isFinite(cam.velocity)).toBe(true)
  })
})

describe('tierScale — GDD §23.4.1, the camera answers to the viewport', () => {
  const LANDSCAPE = { w: 997, h: 448 }
  const PORTRAIT = { w: 448, h: 997 }
  const LEVELS = [1, 2, 3, 4] as const
  // Imported rather than restated: the fit normalises by the band centre, so a
  // test keeping its own copy would silently stop testing the thing it names
  // the moment §7.4a moved the bands — which it did.
  const CENTRE = CENTRES

  /** Fraction of the display the tier occupies at scale `s`. */
  function coverage(level: 1 | 2 | 3 | 4, s: number, vp: { w: number; h: number }) {
    const e = TIER_EXTENTS[level]
    return ((e.w * s) / vp.w) * ((e.h * s) / vp.h)
  }

  it('makes the floor fill the frame at its band centre', () => {
    // The bug this pins is the one that shipped: world scale was
    // `1/(1 + z*9)` with no screen term, so the swarm rendered at a fixed
    // 239x120 px and filled 6.4% of the display in EITHER orientation. The
    // landscape decision delivered nothing until this function existed.
    const s = tierScale(2, CENTRE[2], LANDSCAPE, TIER_EXTENTS)
    expect(coverage(2, s, LANDSCAPE)).toBeGreaterThan(0.65)
  })

  it('fills the constrained axis at every band centre, not just the floor', () => {
    // The invariant is "fits the shorter axis" (§23.4.1), NOT "covers N% of
    // the display". Those differ, and the difference is a feature: the desk
    // tier is 1.23:1 in a 2.23:1 window, so filling the height still leaves
    // a wide side margin. §23.4.2 puts the HUD there. An area threshold here
    // would have been a wrong test failing right code.
    for (const level of LEVELS) {
      const s = tierScale(level, CENTRE[level], LANDSCAPE, TIER_EXTENTS)
      const e = TIER_EXTENTS[level]
      const filled = Math.max((e.w * s) / LANDSCAPE.w, (e.h * s) / LANDSCAPE.h)
      expect(filled).toBeCloseTo(FIT_MARGIN, 2)
    }
  })

  it('never renders a visible tier grossly oversized — the shared-scale bug', () => {
    // Scale used to be ONE value for all four tiers, blended by LOD weight.
    // The tiers differ in intrinsic size by more than 5x, so the blend fitted
    // neither: at desk zoom the cross-fading floor tier rendered 3,780 px wide
    // inside a 1,023 px viewport. Any tier the player can actually see must
    // stay within a sane multiple of the frame.
    for (let z = 0; z <= 1; z += 0.01) {
      const w = lodWeights(z)
      for (const level of LEVELS) {
        if (w[level] <= 0.002) continue
        const s = tierScale(level, z, LANDSCAPE, TIER_EXTENTS)
        expect((TIER_EXTENTS[level].w * s) / LANDSCAPE.w).toBeLessThan(2)
      }
    }
  })

  it('gives the 2:1 floor far more of a landscape display than a portrait one', () => {
    // §23.4's entire argument, now exercised rather than asserted in a
    // document. Same tier, same pixel count, different shape of window.
    const land = coverage(2, tierScale(2, 0.35, LANDSCAPE, TIER_EXTENTS), LANDSCAPE)
    const port = coverage(2, tierScale(2, 0.35, PORTRAIT, TIER_EXTENTS), PORTRAIT)
    expect(land).toBeGreaterThan(port * 2.5)
  })

  it('is continuous in Z for every tier — no step at a band edge', () => {
    // §10.5: nothing cuts. A scale that jumped would be the most visible cut
    // the renderer could produce.
    for (const level of LEVELS) {
      let previous = tierScale(level, 0, LANDSCAPE, TIER_EXTENTS)
      for (let z = 0.005; z <= 1; z += 0.005) {
        const s = tierScale(level, z, LANDSCAPE, TIER_EXTENTS)
        expect(Math.abs(s - previous) / previous).toBeLessThan(0.05)
        previous = s
      }
    }
  })

  it('still zooms within a band, so pinching does something', () => {
    // A pure fit would make the camera cross-fade and never zoom, which reads
    // as the gesture being ignored.
    expect(tierScale(2, 0.28, LANDSCAPE, TIER_EXTENTS)).toBeGreaterThan(
      tierScale(2, 0.35, LANDSCAPE, TIER_EXTENTS),
    )
    expect(tierScale(2, 0.42, LANDSCAPE, TIER_EXTENTS)).toBeLessThan(
      tierScale(2, 0.35, LANDSCAPE, TIER_EXTENTS),
    )
  })

  it('pulls back monotonically across the whole dolly, for every tier', () => {
    // The tiers are framed independently now, so "it still reads as one
    // continuous pull-back" is a claim worth pinning: on the way out, every
    // tier must be shrinking, never one growing while another shrinks.
    for (const level of LEVELS) {
      let previous = Number.POSITIVE_INFINITY
      for (let z = 0; z <= 1; z += 0.01) {
        const s = tierScale(level, z, LANDSCAPE, TIER_EXTENTS)
        expect(s).toBeLessThanOrEqual(previous + 1e-9)
        previous = s
      }
    }
  })

  it('survives a zero-sized viewport rather than poisoning every transform', () => {
    // Happens for a frame during startup and on some rotation paths.
    expect(tierScale(2, 0.35, { w: 0, h: 0 }, TIER_EXTENTS)).toBe(1)
    expect(Number.isFinite(tierScale(2, 0.35, { w: 997, h: 0 }, TIER_EXTENTS))).toBe(true)
  })
})
