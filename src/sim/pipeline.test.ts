/*
 * Copied from the rebuild (100m-devs-three/src/sim/pipeline.test.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
import { describe, expect, it } from 'vitest'
import {
  AUTO_SHIP_BASE_SECONDS, PIPELINE_BY_ID, PIPELINE_TREE, pipelineCost, pipelineEffects, pipelineRefusal,
} from './pipeline.ts'

describe('the queue — Build and Test are decommissioned [2026-10-04]', () => {
  it('has no stage to speed up: no Build or Test speed, and no node whose only job was one', () => {
    const fx = pipelineEffects({ s1: 5, v2: 3, v3: 1, a1: 1, a2: 5 })
    expect(Object.keys(fx)).not.toContain('buildSpeed')
    expect(Object.keys(fx)).not.toContain('testSpeed')
    expect(PIPELINE_BY_ID.has('v1')).toBe(false)
    // What is left of the old speed family still does something: it moves the ledger.
    for (const id of ['v2', 'v3']) expect(PIPELINE_BY_ID.get(id)!.fix).toBeDefined()
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
  it('Auto-Ship needs a longer queue first — rank II after rank I', () => {
    const a1 = PIPELINE_BY_ID.get('a1')!
    expect(pipelineRefusal(a1, {}, 1e12, 4)).toBe('requires')
    expect(pipelineRefusal(a1, { s1: 1 }, 1e12, 4)).toBe(null)
  })
  it('a fork is pick-one', () => {
    const green = PIPELINE_BY_ID.get('a3b')!
    const levels = { s1: 1, a1: 1, a2: 1, a3a: 1 }
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
  it('quality: the queue catches more defects the more you buy, and never all of them', () => {
    expect(pipelineEffects({}).catches).toBe(0)
    expect(pipelineEffects({ q1: 2 }).catches).toBeGreaterThan(pipelineEffects({ q1: 1 }).catches)
    expect(pipelineEffects({ q1: 3, a3b: 1 }).catches).toBeLessThan(1)
  })
})
