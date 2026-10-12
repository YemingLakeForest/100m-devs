import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { MAX_PACKETS } from '../../sim/juice.ts'
import { createFlow, type FlowLot } from './flow.ts'

/*
 * The claims, not the values (CLAUDE.md): the layer never outgrows its instance budget, what it
 * delivers is the rate it was given, it stops when the work stops, it moves every frame rather
 * than hopping, the gauge is the project's progress, a completion is seen, and it does not leak.
 */

const lot = (n: number, sink = new T.Vector3(10, 1, 0), gauge = false): FlowLot => ({
  sink,
  gauge,
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

describe('the stream (§8.2a)', () => {
  it('never has more points alive than its one instanced mesh can draw, at any rate', () => {
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

  it('has nowhere to send work from nobody: no sources, no points', () => {
    const { flow, peak, arrived } = run(500, 5, [lot(0)])
    expect(peak).toBe(0)
    expect(arrived).toEqual([])
    flow.dispose()
  })

  it('recycles arrived points rather than growing over a long run', () => {
    const { flow, arrived } = run(200, 120, [lot(100)])
    expect(arrived.length).toBeGreaterThan(1000)
    expect(flow.live).toBeLessThanOrEqual(MAX_PACKETS)
    flow.dispose()
  })

  // One point, followed from the desk to the board: a click's single speck is the cleanest thing to follow.
  const follow = (read: (flow: ReturnType<typeof createFlow>) => void) => {
    const flow = createFlow(new T.Group(), undefined, () => 0)
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(12, 1.7, 0), 1, false)
    let frames = 0
    for (let t = 0; t < 3; t += 1 / 60) {
      flow.update(1 / 60, 0, [], false)
      if (flow.live === 0) break
      read(flow); frames++
    }
    flow.dispose()
    return frames
  }

  it('moves continuously: a point is somewhere new on every frame of its flight, not at a handful of places', () => {
    const seen = new Set<number>()
    const m = new T.Matrix4(), p = new T.Vector3()
    const frames = follow(flow => { flow.mesh.getMatrixAt(0, m); p.setFromMatrixPosition(m); seen.add(Math.round(p.x * 1000)) })
    expect(frames).toBeGreaterThan(30)
    expect(seen.size).toBeGreaterThan(frames * 0.9)
  })

  it('turns from code to points on the way: it leaves one colour and arrives another', () => {
    const c = new T.Color(), colours: string[] = []
    const frames = follow(flow => { flow.mesh.getColorAt(0, c); colours.push(c.getHexString()) })
    expect(frames).toBeGreaterThan(30)
    expect(colours[0]).not.toBe(colours.at(-1))
    expect(new Set(colours).size).toBeGreaterThan(5)
  })

  it('under reduced motion draws no point at all and still ticks the arrivals', () => {
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
    expect(parent.children).toContain(flow.gauge)
    expect(parent.children).toContain(flow.rings)
    flow.dispose()
    expect(parent.children).toHaveLength(0)
  })
})

describe('a click is seen to go somewhere', () => {
  it('sends points from the one who coded to the sink, announces nothing (the poke already paid), and is gone after', () => {
    const arrived: number[] = []
    const flow = createFlow(new T.Group(), (_a, v) => arrived.push(v), counter())
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(10, 1, 0), 7, false)
    flow.update(1 / 60, 0, [], false)
    expect(flow.live).toBe(7)
    for (let t = 0; t < 3; t += 1 / 60) flow.update(1 / 60, 0, [], false)
    expect(flow.live).toBe(0)
    expect(arrived).toEqual([])
    flow.dispose()
  })

  it('stacks: a second burst is more points, not the same ones redrawn', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(10, 1, 0), 7, false)
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(10, 1, 0), 7, false)
    flow.update(1 / 60, 0, [], false)
    expect(flow.live).toBe(14)
    flow.dispose()
  })

  it('draws nothing under reduced motion', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.emit(new T.Vector3(), new T.Vector3(5, 0, 0), 7, true)
    expect(flow.live).toBe(0)
    flow.dispose()
  })
})

describe('the gauge: the sink fills as the game is built', () => {
  const lots = [lot(20, new T.Vector3(10, 1, 0), true)]
  const settle = (flow: ReturnType<typeof createFlow>, progress: number, l = lots) => {
    for (let t = 0; t < 3; t += 1 / 60) flow.update(1 / 60, 0, l, false, progress)
  }

  it('is not there where the sink has none (a house door), nor with nobody to build', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    settle(flow, 0.5, [lot(20)])
    expect(flow.gauge.count).toBe(0)
    settle(flow, 0.5, [lot(0, new T.Vector3(10, 1, 0), true)])
    expect(flow.gauge.count).toBe(0)
    flow.dispose()
  })

  it('stands as high as the progress says, and rises with it', () => {
    const fillHeight = (progress: number) => {
      const flow = createFlow(new T.Group(), undefined, counter())
      settle(flow, progress)
      const m = new T.Matrix4(), p = new T.Vector3(), s = new T.Vector3(), q = new T.Quaternion()
      flow.gauge.getMatrixAt(1, m); m.decompose(p, q, s)
      flow.dispose()
      return s.y
    }
    const heights = [0, 0.25, 0.5, 1].map(fillHeight)
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1])
    expect(heights[3] / heights[2]).toBeCloseTo(2, 1)
  })

  it('moves smoothly to a new level rather than jumping, and arrives', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    settle(flow, 0)
    flow.update(1 / 60, 0, lots, false, 1)
    expect(flow.level).toBeGreaterThan(0)
    expect(flow.level).toBeLessThan(1)
    settle(flow, 1)
    expect(flow.level).toBe(1)
    flow.dispose()
  })

  it('rests on the lot floor', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    const l = lot(10, new T.Vector3(10, 1, 0), true); l.floor = 0.2
    settle(flow, 1, [l])
    const m = new T.Matrix4(), p = new T.Vector3(), s = new T.Vector3(), q = new T.Quaternion()
    flow.gauge.getMatrixAt(0, m); m.decompose(p, q, s)
    expect(p.y - s.y / 2).toBeCloseTo(0.2, 6)
    flow.dispose()
  })
})

describe('completion: the game being done is seen (§8.2a)', () => {
  const lots = [lot(20, new T.Vector3(10, 1, 0), true), lot(10, new T.Vector3(-30, 1, 5))]
  const after = (kind: 'build' | 'release') => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.update(1 / 60, 0, lots, false, 0)
    flow.complete(lots, kind, false)
    flow.update(1 / 60, 0, lots, false, 0)
    return flow
  }

  it('throws points and runs a ring out from the sink', () => {
    const flow = after('build')
    expect(flow.live).toBeGreaterThan(20)
    expect(flow.ringsLive).toBeGreaterThan(0)
    flow.dispose()
  })

  it('a release is bigger than a build, and reaches the open houses too', () => {
    const build = after('build'), release = after('release')
    expect(release.live).toBeGreaterThan(build.live)
    expect(release.ringsLive).toBeGreaterThan(build.ringsLive)
    build.dispose(); release.dispose()
  })

  it('flashes the gauge full the moment it lands, then lets it drain, and the fountain falls and ends', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    for (let t = 0; t < 2; t += 1 / 60) flow.update(1 / 60, 0, lots, false, 0.6)
    flow.complete(lots, 'build', false)
    flow.update(1 / 60, 0, lots, false, 0)
    expect(flow.level).toBe(1)
    for (let t = 0; t < 4; t += 1 / 60) flow.update(1 / 60, 0, lots, false, 0)
    expect(flow.level).toBe(0)
    expect(flow.live).toBe(0)
    expect(flow.ringsLive).toBe(0)
    flow.dispose()
  })

  it('stays inside the instance budget however often it is called', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    for (let i = 0; i < 40; i++) flow.complete(lots, 'release', false)
    flow.update(1 / 60, 1e6, lots, false, 0)
    expect(flow.live).toBeLessThanOrEqual(MAX_PACKETS)
    expect(flow.rings.count).toBeLessThanOrEqual(24)
    flow.dispose()
  })

  it('draws nothing under reduced motion: the unit flash and the HUD carry it', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.complete(lots, 'release', true)
    flow.update(1 / 60, 0, lots, true, 0)
    expect(flow.live).toBe(0)
    expect(flow.ringsLive).toBe(0)
    flow.dispose()
  })
})
