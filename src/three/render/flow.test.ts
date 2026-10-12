import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { MAX_PACKETS } from '../../sim/juice.ts'
import { createFlow, type FlowLot } from './flow.ts'

/*
 * The claims, not the values (CLAUDE.md): the layer never outgrows its instance budget, what it
 * delivers is the rate it was given, it stops when the work stops, and it does not leak.
 */

const lot = (n: number, sink = new T.Vector3(10, 1, 0)): FlowLot => ({
  sink,
  sources: Array.from({ length: n }, (_, i) => new T.Vector3(-i, 1.7, i)),
})
/** A deterministic stand-in for Math.random that still visits every source. */
const counter = () => { let i = 0; return () => ((i++ * 0.618033) % 1) }

function run(rate: number, seconds: number, lots: FlowLot[], reduced = false) {
  const arrived: number[] = []
  const flow = createFlow(new T.Group(), (_at, value) => arrived.push(value), counter())
  let peak = 0
  for (let t = 0; t < seconds; t += 1 / 60) {
    flow.update(1 / 60, rate, lots, reduced)
    peak = Math.max(peak, flow.live)
  }
  return { flow, arrived, peak }
}

describe('the packet layer (§8.2a, slice B)', () => {
  it('never has more packets alive than its one instanced mesh can draw, at any rate', () => {
    for (const rate of [1, 90, 1e3, 1e6, 1e12]) {
      const { flow, peak } = run(rate, 20, [lot(100)])
      expect(peak).toBeLessThanOrEqual(MAX_PACKETS)
      expect(flow.mesh.count).toBeLessThanOrEqual(MAX_PACKETS)
      flow.dispose()
    }
  })

  it('delivers the rate it was given: what lands at the sink is what the workers made', () => {
    for (const rate of [3, 90, 5_000, 2e6]) {
      const { flow, arrived } = run(rate, 30, [lot(40)])
      const delivered = arrived.reduce((a, b) => a + b, 0)
      // Thirty seconds of work, less at most the couple of seconds still in the air.
      expect(delivered).toBeLessThanOrEqual(rate * 30 * 1.05)
      expect(delivered).toBeGreaterThan(rate * 30 * 0.85)
      flow.dispose()
    }
  })

  it('stops launching when the work stops, and the sky empties', () => {
    const { flow } = run(50, 5, [lot(20)])
    expect(flow.live).toBeGreaterThan(0)
    for (let t = 0; t < 3; t += 1 / 60) flow.update(1 / 60, 0, [lot(20)], false)
    expect(flow.live).toBe(0)
    expect(flow.mesh.count).toBe(0)
    flow.dispose()
  })

  it('has nowhere to send work from nobody: no sources, no packets', () => {
    const { flow, peak, arrived } = run(500, 5, [lot(0)])
    expect(peak).toBe(0)
    expect(arrived).toEqual([])
    flow.dispose()
  })

  it('recycles arrived packets rather than growing over a long run', () => {
    const { flow, arrived } = run(200, 120, [lot(100)])
    expect(arrived.length).toBeGreaterThan(1000)
    expect(flow.live).toBeLessThanOrEqual(MAX_PACKETS)
    flow.dispose()
  })

  it('moves in hard steps: a packet is only ever at a handful of places along its way', () => {
    const flow = createFlow(new T.Group(), undefined, () => 0)
    const l = lot(1, new T.Vector3(12, 1.7, 0))
    l.sources[0].set(0, 1.7, 0)
    const seen = new Set<number>()
    const m = new T.Matrix4(), p = new T.Vector3()
    for (let t = 0; t < 2.5; t += 1 / 120) {
      flow.update(1 / 120, 3, [l], false)
      if (flow.live > 0) { flow.mesh.getMatrixAt(0, m); p.setFromMatrixPosition(m); seen.add(Math.round(p.x * 100)) }
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(seen.size).toBeLessThanOrEqual(7)
    flow.dispose()
  })

  it('under reduced motion draws no packet at all and still ticks the arrivals', () => {
    const { flow, arrived, peak } = run(90, 10, [lot(30)], true)
    expect(peak).toBe(0)
    expect(arrived.length).toBeGreaterThan(0)
    expect(arrived.reduce((a, b) => a + b, 0)).toBeGreaterThan(90 * 10 * 0.8)
    flow.dispose()
  })

  it('takes itself off the scene when disposed', () => {
    const parent = new T.Group()
    const flow = createFlow(parent)
    expect(parent.children).toContain(flow.mesh)
    flow.dispose()
    expect(parent.children).not.toContain(flow.mesh)
  })
})

describe('the backlog heap (§8.2a, slice B)', () => {
  const lots = [lot(20), lot(20, new T.Vector3(-30, 1, 5))]
  const heapOf = (backlog: number, l: FlowLot[] = lots) => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.update(1 / 60, 0, l, false, backlog)
    const n = flow.heap.count
    flow.dispose()
    return n
  }

  it('is not there when nothing is waiting, and not there with nowhere to stand', () => {
    expect(heapOf(0)).toBe(0)
    expect(heapOf(500, [])).toBe(0)
  })

  it('stands taller with more waiting, in whole crates, and stops at the top level', () => {
    const counts = [1, 10, 100, 1e4, 1e8, 1e300].map(q => heapOf(q))
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    expect(Math.min(...counts)).toBeGreaterThan(0)
    expect(counts.at(-1)).toBe(counts.at(-2))
  })

  it('never needs more instances than it has, however many houses are open', () => {
    const many = Array.from({ length: 200 }, (_, i) => lot(5, new T.Vector3(i * 30, 1, 0)))
    expect(heapOf(1e9, many)).toBeLessThanOrEqual(64)
  })

  it('drains: the heap falls as the queue does', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.update(1 / 60, 0, lots, false, 1e6)
    const full = flow.heap.count
    flow.update(1 / 60, 0, lots, false, 3)
    expect(flow.heap.count).toBeLessThan(full)
    flow.update(1 / 60, 0, lots, false, 0)
    expect(flow.heap.count).toBe(0)
    flow.dispose()
  })

  it('sits level, not floating: every crate rests on the lot floor or another crate', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    const l = lot(10); l.floor = 0.2
    flow.update(1 / 60, 0, [l], false, 1e6)
    const m = new T.Matrix4(), p = new T.Vector3(), s = new T.Vector3(), q = new T.Quaternion()
    const bottoms: number[] = []
    for (let i = 0; i < flow.heap.count; i++) { flow.heap.getMatrixAt(i, m); m.decompose(p, q, s); bottoms.push(p.y - s.y / 2) }
    expect(Math.min(...bottoms)).toBeCloseTo(0.2, 6)
    flow.dispose()
  })

  it('goes with the scene when disposed', () => {
    const parent = new T.Group()
    const flow = createFlow(parent)
    expect(parent.children).toContain(flow.heap)
    flow.dispose()
    expect(parent.children).not.toContain(flow.heap)
  })
})
