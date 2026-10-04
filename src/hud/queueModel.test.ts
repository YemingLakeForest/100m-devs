/**
 * §10.7 [2026-10-04] — the queue is read as a contest between how fast the
 * studio turns out games and how many it can hold. Tests pin the order of that
 * contest, not the seconds.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, __setState, type ShelvedBuild } from '../game/store.ts'
import { queueLine, queueTone, queueView } from './queueModel.ts'

beforeEach(() => __resetStore())

const build = (id: number): ShelvedBuild => ({ id, ordinal: id, name: `B${id}`, size: 300 }) as unknown as ShelvedBuild

describe('queueView', () => {
  it('is stopped, at zero seconds, when the queue is full', () => {
    const cap = queueView().capacity
    __setState({ shelf: Array.from({ length: cap }, (_, i) => build(i)) })
    const v = queueView()
    expect(v.flow).toBe('stopped')
    expect(v.fullIn).toBe(0)
    expect(queueTone(v)).toBe('stopped')
    expect(queueLine(v)).toMatch(/FULL/)
  })

  it('lists the games oldest first: the front is the one SHIP! sends', () => {
    __setState({ devs: 1, shelf: [build(7), build(9)] })
    expect(queueView().games.map((g) => g.id)).toEqual([7, 9])
  })

  it('fills sooner as the studio gets faster, and later as the queue gets longer', () => {
    __setState({ devs: 1 })
    const base = queueView()
    __setState({ devs: 20 })
    const faster = queueView()
    expect(base.fullIn).not.toBeNull()
    expect(faster.fullIn!).toBeLessThan(base.fullIn!)

    __setState({ devs: 1, pipelineNodes: { s1: 3 } })
    const roomier = queueView()
    expect(roomier.capacity).toBeGreaterThan(base.capacity)
    expect(roomier.fullIn!).toBeGreaterThan(base.fullIn!)
  })

  it('reads Auto-Ship as a drain, and a faster one as a shorter interval', () => {
    __setState({ devs: 1, pipelineNodes: { s1: 1, a1: 1 } })
    const v = queueView()
    expect(v.autoShip).toBe(true)
    expect(v.autoEvery).not.toBeNull()
    __setState({ devs: 1, pipelineNodes: { s1: 1, a1: 1, a2: 5 } })
    expect(queueView().autoEvery!).toBeLessThan(v.autoEvery!)
  })
})
