import { describe, it, expect } from 'vitest'
import { globeCell, houseAddress, regionHouses, regionPopulation, worldPopulation, WORLD_CAPACITY, WORLD_REGIONS } from './worldAddress.ts'
import { buildNetwork, extendNetwork } from './colonyNetwork.ts'

describe('the monitor keeps people addressable', () => {
  it('partitions exactly one hundred million people without gaps or duplicate houses', () => {
    let end = 0, capacity = 0
    for (let region = 0; region < WORLD_REGIONS; region++) {
      const range = regionHouses(region)
      expect(range.first).toBe(end); end = range.end
      capacity += regionPopulation(WORLD_CAPACITY, 0, region)
      expect(Math.hypot(...globeCell(region))).toBeCloseTo(1)
    }
    expect(end * 100).toBe(WORLD_CAPACITY)
    expect(capacity).toBe(WORLD_CAPACITY)
  })
  it('does not manufacture population at an unearned zoom or on another world', () => {
    for (const n of [0, 1, 20, 21, 100, 101, 1801, 30_000_000, 100_000_001]) {
      let sum = 0
      for (let w = 0; w < 2; w++) for (let r = 0; r < WORLD_REGIONS; r++) sum += regionPopulation(n, w, r)
      expect(sum).toBe(n)
    }
    expect(worldPopulation(100_000_001, 1)).toBe(1)
    expect(houseAddress(1, 0)).toBe(100_000_000)
    expect(houseAddress(1, regionHouses(12).first) % 100).toBe(0)
  })
  it('preserves the reference network: connected, planar, deterministic, Sol then Proxima', () => {
    const net = buildNetwork(73)
    expect(net.order).toHaveLength(net.systems.length)
    expect(net.systems[net.order[0]].name).toBe('Sol')
    expect(net.systems[net.order[1]].name).toBe('Proxima Centauri')
    expect(buildNetwork(73).order).toEqual(net.order)
    const side = (a: number, b: number, c: number) => {
      const u = net.systems[a], v = net.systems[b], w = net.systems[c]
      return (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x)
    }
    net.lanes.forEach(([a, b], i) => net.lanes.slice(i + 1).forEach(([c, d]) => {
      if (new Set([a, b, c, d]).size < 4) return
      expect(side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0).toBe(false)
    }))
  })
  it('extends beyond the prototype without changing an occupied address', () => {
    const net = buildNetwork(73)
    const original = [...net.order], positions = net.systems.map(s => [s.x, s.z])
    extendNetwork(net, 550)
    expect(net.order.length).toBeGreaterThanOrEqual(550)
    expect(net.order.slice(0, original.length)).toEqual(original)
    expect(net.systems.slice(0, positions.length).map(s => [s.x, s.z])).toEqual(positions)
    for (let w = original.length; w < net.order.length; w++) {
      const id = net.order[w]
      expect(net.worldOf[id]).toBe(w)
      expect(net.neighbours[id]).toContain(net.parent[id])
    }
  })
})
