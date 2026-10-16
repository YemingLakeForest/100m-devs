/**
 * GDD §4.5d — the founder codes only on clicks. [2026-10-16] *"we don't spontaneously code so should not have blobs going out from
 * us to the middle, I said this a few times but always got reverted, fix that properly."* The stream's sources were re-derived from
 * every visible person on each rebuild of the stream, and the founder is one of them; this pins the rule where the list is made.
 */
import * as T from 'three'
import { describe, expect, it } from 'vitest'
import { leaderSeat } from '../sim/floorPlan.ts'
import { FOUNDER_SEAT, workSources } from './workSources.ts'

function person(index: number, x: number, visible = true) {
  const mesh = new T.Mesh()
  mesh.position.set(x, 0, 0)
  mesh.visible = visible
  mesh.updateMatrixWorld()
  return { mesh, index }
}

describe('§4.5d — who the work stream leaves from', () => {
  it('never leaves from the founder, however visible', () => {
    expect(FOUNDER_SEAT).toBe(leaderSeat('founder'))
    const sources = workSources([person(FOUNDER_SEAT, 1), person(leaderSeat('james'), 2), person(0, 3), person(5, 4)])
    expect(sources.map((p) => p.x)).toEqual([2, 3, 4])
  })

  it('leaves from nobody when the founder is alone in the garage', () => {
    expect(workSources([person(FOUNDER_SEAT, 1)])).toEqual([])
  })

  it('skips anyone not shown', () => {
    expect(workSources([person(0, 1, false), person(1, 2)]).map((p) => p.x)).toEqual([2])
  })
})
