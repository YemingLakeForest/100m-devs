import { describe, expect, it } from 'vitest'
import { zAtRung } from '../sim/ladder.ts'
import { BAND_EDGES, lodWeights, zoomLevel } from './omniLens.ts'

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
