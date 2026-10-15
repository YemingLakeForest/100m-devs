import { describe, expect, it } from 'vitest'

import { BEAT, QUEUE_SCALE, SHIP_SCALE, beatAt, hopAt, queueShown, queueSlot } from './statueBeat.ts'
import { STATUE_PLAZA } from './floorPlan.ts'

/** The order the beat plays in is the claim; the numbers were set by watching it (§25.3.2: test the order, not the value). */
describe('the statue’s completion beat (§8.2a, 2026-10-14)', () => {
  const frames = Array.from({ length: 400 }, (_, i) => ({ t: i * 0.01, f: beatAt(i * 0.01) }))

  it('flashes white, then light amber, then is itself: in that order, once each, and never back', () => {
    const order = frames.map(({ f }) => f.tint === 'white' ? 0 : f.tint === 'lamp' ? 1 : 2)
    expect(order[0]).toBe(0)
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1])
    expect(order.at(-1)).toBe(2)
  })

  it('shows the title only once the flash is over: the name arrives after the picture', () => {
    for (const { f } of frames) if (f.tint !== null) expect(f.plate).toBe(false)
    expect(frames.find(({ f }) => f.plate)!.f.tint).toBeNull()
  })

  it('turns a full circle in hard quarter-turns, and has finished before it leaves', () => {
    let last = 0
    for (const { f } of frames) { expect(f.turns).toBeGreaterThanOrEqual(last); expect(f.turns - last).toBeLessThanOrEqual(1); last = f.turns }
    expect(last).toBe(BEAT.turns)
    expect((BEAT.turns * 90) % 360).toBe(0) // a whole circle, so it faces the lens again
    for (const { f } of frames) if (f.ship >= 0) expect(f.turns).toBe(BEAT.turns)
    expect(BEAT.turnFrom + BEAT.turns * BEAT.turnEvery).toBeLessThanOrEqual(BEAT.shipAt)
  })

  it('leaves the plinth in six hops, none skipped, and is over when the last has been made', () => {
    const steps = [...new Set(frames.map(({ f }) => f.ship))]
    expect(steps).toEqual([-1, 0, 1, 2, 3, 4, 5])
    for (const { t, f } of frames) expect(f.over, `t=${t}`).toBe(t >= BEAT.shipAt + BEAT.shipLen - 1e-9)
    expect(BEAT.shipSteps).toBe(SHIP_SCALE.length)
  })

  it('takes a time before the beat, or nonsense, for its first frame, and never throws', () => {
    expect(beatAt(-3)).toEqual(beatAt(0))
    expect(beatAt(Number.NaN)).toEqual(beatAt(0))
    expect(beatAt(0).tint).toBe('white')
    expect(beatAt(1e6).over).toBe(true)
  })
})

describe('the way to the queue', () => {
  it('never grows on the way, and arrives the size the queue is', () => {
    for (let i = 1; i < SHIP_SCALE.length; i++) expect(SHIP_SCALE[i]).toBeLessThanOrEqual(SHIP_SCALE[i - 1])
    expect(SHIP_SCALE[0]).toBe(1)
    expect(SHIP_SCALE.at(-1)).toBe(QUEUE_SCALE)
  })

  it('starts where it was, ends where it is going, and is highest in the middle', () => {
    const from = { x: 2.5, y: 2, z: 0.8 }, to = { x: 2, y: 0.5, z: -1.3 }
    expect(hopAt(from, to, 0, 2)).toEqual(from)
    const end = hopAt(from, to, BEAT.shipSteps - 1, 2)
    expect(end.x).toBeCloseTo(to.x, 9); expect(end.y).toBeCloseTo(to.y, 9); expect(end.z).toBeCloseTo(to.z, 9)
    const heights = Array.from({ length: BEAT.shipSteps }, (_, s) => hopAt(from, to, s, 2).y)
    expect(Math.max(...heights)).toBeGreaterThan(Math.max(from.y, to.y))
  })

  it('stands the queue up the stem from the plinth toward the heroes, one place a pitch from the next, all on the wood', () => {
    const q = STATUE_PLAZA.queue
    expect(queueShown(0)).toBe(0)
    expect(queueShown(2)).toBe(2)
    expect(queueShown(500)).toBe(q.shown)
    // across the stem's width, and on the plinth's side of nothing: each place is north of the plinth with room to spare. That they are on the
    // wood at every corner, and clear of Billy and the heroes, is `heroRow.test.ts`'s (it has the deck's outline).
    const stem = { x0: 1, x1: 4 }
    for (let i = 0; i < q.shown; i++) {
      const s = queueSlot(i), s2 = queueSlot(i + 1)
      expect(s.z - s2.z).toBeCloseTo(q.pitch, 9)
      expect(s.x - q.width / 2).toBeGreaterThan(stem.x0); expect(s.x + q.width / 2).toBeLessThan(stem.x1)
      expect(s.z + q.width / 2).toBeLessThan(STATUE_PLAZA.plinth.z - STATUE_PLAZA.plinth.apothem)
    }
    // the head is the place by the plinth, and the line grows toward the heroes (north is −z)
    expect(queueSlot(0).z).toBeGreaterThan(queueSlot(q.shown - 1).z)
  })
})
