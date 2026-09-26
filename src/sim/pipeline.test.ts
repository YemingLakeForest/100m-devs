/*
 * Copied from the rebuild (100m-devs-three/src/sim/pipeline.test.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
import { describe, expect, it } from 'vitest'
import {
  advancePipeline, AUTO_SHIP_BASE_SECONDS, emptyPipeline, jammed, PIPELINE_BY_ID, PIPELINE_TREE, pipelineCost,
  pipelineDrag, pipelineEffects, pipelineRefusal, sizeFactor, stageSeconds,
} from './pipeline.ts'

const secs = (build: number, test: number) => (stage: 'build' | 'test') => (stage === 'build' ? build : test)

describe('the belt — Build then Test, one lane each', () => {
  it('a build takes Build’s seconds and then Test’s', () => {
    let p = emptyPipeline<string>()
    p.build.push({ item: 'a', progress: 0 })
    let r = advancePipeline(p, 3.9, secs(2, 2))
    expect(r.done).toEqual([])
    r = advancePipeline(r.state, 0.2, secs(2, 2))
    expect(r.done).toEqual(['a'])
    p = r.state
    expect(p.build.length + p.test.length).toBe(0)
  })
  it('one long step moves several builds, in order, and never faster than the slowest stage', () => {
    const p = emptyPipeline<number>()
    for (let i = 0; i < 5; i++) p.build.push({ item: i, progress: 0 })
    const r = advancePipeline(p, 20, secs(1, 4))
    // Test is the bottleneck: first out at 5 s, then one every 4 s → 5, 9, 13, 17.
    expect(r.done).toEqual([0, 1, 2, 3])
  })
  it('a stage with somebody waiting is jammed', () => {
    const p = emptyPipeline<number>()
    p.test.push({ item: 1, progress: 0.5 }, { item: 2, progress: 0 })
    expect(jammed(p, 'test')).toBe(true)
    expect(jammed(p, 'build')).toBe(false)
  })
  it('bigger games and more waiting take longer; speed takes less', () => {
    expect(sizeFactor(24_000)).toBeGreaterThan(sizeFactor(240))
    expect(sizeFactor(10)).toBe(1)
    expect(pipelineDrag(0.3)).toBeGreaterThan(pipelineDrag(0))
    expect(pipelineDrag(0)).toBe(1)
    expect(stageSeconds('build', 240, 2, 1)).toBeLessThan(stageSeconds('build', 240, 1, 1))
    expect(stageSeconds('test', 1e6, 1, 1)).toBeGreaterThan(stageSeconds('test', 240, 1, 1))
  })
})

describe('Serena’s pipeline board', () => {
  it('capacity nodes lengthen the buffer, each rung by more', () => {
    expect(pipelineEffects({}).slots).toBe(0)
    const one = (id: string) => pipelineEffects({ [id]: 1 }).slots
    expect(one('s2')).toBeGreaterThan(one('s1'))
    expect(one('s3')).toBeGreaterThan(one('s2'))
    expect(one('s4')).toBeGreaterThan(one('s3'))
  })
  it('SHIP! is manual until Auto-Ship, and Auto-Ship Speed shortens the interval', () => {
    expect(pipelineEffects({}).autoShip).toBe(false)
    expect(pipelineEffects({}).autoShipSeconds).toBe(Infinity)
    expect(pipelineEffects({ a1: 1 }).autoShipSeconds).toBe(AUTO_SHIP_BASE_SECONDS)
    expect(pipelineEffects({ a1: 1, a2: 3 }).autoShipSeconds).toBeLessThan(AUTO_SHIP_BASE_SECONDS)
  })
  it('Auto-Ship needs a longer shelf and faster laptops first — rank II after rank I', () => {
    const a1 = PIPELINE_BY_ID.get('a1')!
    expect(pipelineRefusal(a1, {}, 1e12, 4)).toBe('requires')
    expect(pipelineRefusal(a1, { s1: 1, v1: 1 }, 1e12, 4)).toBe(null)
  })
  it('a fork is pick-one', () => {
    const green = PIPELINE_BY_ID.get('a3b')!
    const levels = { s1: 1, v1: 1, a1: 1, a2: 1, a3a: 1 }
    expect(pipelineRefusal(green, levels, 1e15, 4)).toBe('fork')
  })
  it('a node waits for its era, and for cash', () => {
    const ring = PIPELINE_BY_ID.get('s4')!
    const levels = { s1: 1, s2: 1, s3: 1 }
    expect(pipelineRefusal(ring, levels, 1e18, 2)).toBe('era')
    expect(pipelineRefusal(ring, levels, 1, 3)).toBe('cash')
  })
  it('each level costs more, and the floor is honoured', () => {
    const s1 = PIPELINE_BY_ID.get('s1')!
    expect(pipelineCost(s1, 1)).toBeGreaterThan(pipelineCost(s1, 0))
    expect(pipelineCost(s1, 0, 1e9)).toBe(1e9)
  })
  it('every node with a fix moves loss between two different slices; the breakthrough is on waiting', () => {
    for (const n of PIPELINE_TREE) if (n.fix) expect(n.fix.cuts).not.toBe(n.fix.feeds)
    expect(pipelineEffects({ K: 1 }).breakthroughs).toEqual(['wait'])
  })
  it('quality: Test catches more defects the more you buy, and never all of them', () => {
    expect(pipelineEffects({}).testCatch).toBe(0)
    expect(pipelineEffects({ q1: 2 }).testCatch).toBeGreaterThan(pipelineEffects({ q1: 1 }).testCatch)
    expect(pipelineEffects({ q1: 3, a3b: 1 }).testCatch).toBeLessThan(1)
  })
})
