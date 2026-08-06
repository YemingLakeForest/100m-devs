import { describe, expect, it } from 'vitest'
import {
  BAND_EDGES,
  LensCamera,
  ORDERS_OF_MAGNITUDE,
  lodWeights,
  scaleAt,
  zoomForScale,
  zoomLevel,
} from './omniLens.ts'

describe('the four canonical levels (GDD §7.4)', () => {
  it('bands Z on the §20.2 audio zone edges', () => {
    expect(BAND_EDGES).toEqual([0.2, 0.5, 0.8])
  })

  it('maps each band to its level', () => {
    expect(zoomLevel(0)).toBe(1)
    expect(zoomLevel(0.19)).toBe(1)
    expect(zoomLevel(0.2)).toBe(2)
    expect(zoomLevel(0.49)).toBe(2)
    expect(zoomLevel(0.5)).toBe(3)
    expect(zoomLevel(0.79)).toBe(3)
    expect(zoomLevel(0.8)).toBe(4)
    expect(zoomLevel(1)).toBe(4)
  })
})

describe('scale spans nine orders of magnitude (ADR §2.1)', () => {
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
