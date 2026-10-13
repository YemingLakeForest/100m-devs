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

  it('carries a dark edge on every point, round it and behind it, so it reads on a lit wall', () => {
    const a = new T.Matrix4(), b = new T.Matrix4(), pa = new T.Vector3(), pb = new T.Vector3(), sa = new T.Vector3(), sb = new T.Vector3()
    const seen = { n: 0 }
    follow(flow => {
      expect(flow.outline.count).toBe(flow.mesh.count)
      expect((flow.outline.material as T.MeshBasicMaterial).side).toBe(T.BackSide)
      if (flow.mesh.count === 0) return
      flow.mesh.getMatrixAt(0, a); flow.outline.getMatrixAt(0, b)
      a.decompose(pa, new T.Quaternion(), sa); b.decompose(pb, new T.Quaternion(), sb)
      expect(pb.distanceTo(pa)).toBeLessThan(1e-6)
      expect(sb.x).toBeGreaterThan(sa.x)
      seen.n++
    })
    expect(seen.n).toBeGreaterThan(10)
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
  /** A click's pop of sparks at the person, which is not a blob. */
  const POP = 6

  it('sends one blob a point from the one who coded to the sink, announces nothing (the poke already paid), and is gone after', () => {
    const arrived: number[] = []
    const flow = createFlow(new T.Group(), (_a, v) => arrived.push(v), counter())
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(10, 1, 0), 3, false)
    flow.update(1 / 60, 0, [], false)
    expect(flow.live).toBe(3 + POP)
    for (let t = 0; t < 3; t += 1 / 60) flow.update(1 / 60, 0, [], false)
    expect(flow.live).toBe(0)
    expect(arrived).toEqual([])
    flow.dispose()
  })

  it('stacks: a second burst is more points, not the same ones redrawn', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(10, 1, 0), 2, false)
    flow.emit(new T.Vector3(0, 1.7, 0), new T.Vector3(10, 1, 0), 2, false)
    flow.update(1 / 60, 0, [], false)
    expect(flow.live).toBe(2 * (2 + POP))
    flow.dispose()
  })

  it('draws nothing under reduced motion', () => {
    const flow = createFlow(new T.Group(), undefined, counter())
    flow.emit(new T.Vector3(), new T.Vector3(5, 0, 0), 7, true)
    expect(flow.live).toBe(0)
    flow.dispose()
  })
})

describe('a blob is a story point, and is as big as what it carries', () => {
  const biggest = (rate: number) => {
    const { flow } = run(rate, 6, [lot(40)])
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3()
    let max = 0
    for (let i = 0; i < flow.mesh.count; i++) { flow.mesh.getMatrixAt(i, m); m.decompose(p, q, sc); max = Math.max(max, sc.x) }
    flow.dispose()
    return max
  }

  it('carries exactly one story point while the stream is under its cap', () => {
    for (const rate of [2, 20, 200]) {
      const { flow, arrived } = run(rate, 8, [lot(40)])
      expect(arrived.length).toBeGreaterThan(0)
      for (const v of arrived) expect(v).toBe(1)
      flow.dispose()
    }
  })

  it('draws a blob larger the more it carries, and never past a size the room can hold', () => {
    const sizes = [5, 5e3, 5e6, 5e12].map(biggest)
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1])
    // 1.8 m is the cap on a blob's size; each blob varies by up to 15% either way so a stream is not uniform.
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1.8 * 1.15 + 1e-6)
  })

  it('makes a bigger tap a bigger blob, and a bigger one more of them', () => {
    const scaleOf = (sp: number) => {
      const flow = createFlow(new T.Group(), undefined, counter())
      flow.emit(new T.Vector3(), new T.Vector3(10, 0, 0), sp, false)
      flow.update(0.2, 0, [], false)
      const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3()
      let max = 0
      for (let i = 0; i < flow.mesh.count; i++) { flow.mesh.getMatrixAt(i, m); m.decompose(p, q, sc); max = Math.max(max, sc.x) }
      const live = flow.live
      flow.dispose()
      return { max, live }
    }
    const one = scaleOf(1), four = scaleOf(4), huge = scaleOf(4000)
    expect(four.live).toBeGreaterThan(one.live)
    expect(huge.max).toBeGreaterThan(one.max)
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

  it('treats a sink that is furniture, not a gauge the flow draws, as the studio’s own: it gets the build’s fountain too', () => {
    const furniture: FlowLot = { ...lot(20, new T.Vector3(10, 1, 0)), main: true, top: 3.3 }
    const door = lot(10, new T.Vector3(-30, 1, 5))
    const throwOn = (l: FlowLot) => {
      const flow = createFlow(new T.Group(), undefined, counter())
      flow.complete([l], 'build', false)
      flow.update(1 / 60, 0, [l], false, 0)
      const out = { live: flow.live, rings: flow.ringsLive, gauges: flow.gauge.count }
      flow.dispose()
      return out
    }
    const f = throwOn(furniture)
    expect(f.live).toBeGreaterThan(20)
    expect(f.rings).toBeGreaterThan(0)
    // The furniture draws its own fill; the flow must not draw a second gauge over it.
    expect(f.gauges).toBe(0)
    // A house's door waits for a release.
    expect(throwOn(door).live).toBe(0)
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
