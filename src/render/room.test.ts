import { describe, expect, it, vi } from 'vitest'

// arrivals.ts plays a sound on spawn; the Capacitor native-audio plugin cannot
// initialise under jsdom. These tests cover the fall and puff curves, which
// never play anything.
vi.mock('../audio/sfx.ts', () => ({ playSfx: () => {} }))
import { ROOM_DEV_CAP, gridFor, propsAt } from './room.ts'
import { arrivalDelay, arrivalHeight, puffAlpha } from './arrivals.ts'
import { maxZoomFor } from '../sim/headcount.ts'

describe('the room grows with the headcount — GDD §7.8.1', () => {
  it('covers every headcount the §7.7.1 zoom ceiling traps the player at', () => {
    // maxZoomFor keeps the camera in one room below 100 developers, so this
    // tier has to be able to *draw* 99 of them. If the cap were lower the
    // player would be locked into a room that could not show their studio.
    const trappedAt = 99
    expect(ROOM_DEV_CAP).toBeGreaterThanOrEqual(trappedAt)
    expect(maxZoomFor(trappedAt)).toBe(0.2)
  })

  it('lays a huddle out squarish, not as a call-centre row', () => {
    expect(gridFor(1)).toEqual({ cols: 1, rows: 1 })
    expect(gridFor(4)).toEqual({ cols: 2, rows: 2 })
    expect(gridFor(9)).toEqual({ cols: 3, rows: 3 })
  })

  it('never lays out more desks than it will draw', () => {
    const { cols, rows } = gridFor(1e9)
    expect(cols * rows).toBeLessThanOrEqual(ROOM_DEV_CAP + cols)
  })
})

describe('props arrive on the §7.8.1 thresholds', () => {
  it('starts with nothing but a desk in a dark room', () => {
    const p = propsAt(1)
    expect(p.whiteboard).toBe(false)
    expect(p.plant).toBe(false)
    expect(p.coffee).toBe(false)
  })

  it('fills the room out as the studio grows', () => {
    expect(propsAt(3).whiteboard).toBe(true)
    expect(propsAt(3).plant).toBe(true)
    expect(propsAt(6).coffee).toBe(true)
    expect(propsAt(11).dividers).toBe(true)
    expect(propsAt(11).serverRack).toBe(true)
    expect(propsAt(31).cables).toBe(true)
  })

  it('TAKES THINGS AWAY once it crowds — the §6 thesis in set dressing', () => {
    // This is the half of §7.8.1 that matters. The room gets *worse* as it
    // gets fuller: the plant goes unwatered, the dividers have no floor left
    // to stand on, the walkway becomes desks. If this ever reads as monotonic
    // growth, the set dressing has stopped telling the story.
    const roomy = propsAt(20)
    const crowded = propsAt(120)
    expect(roomy.plant).toBe(true)
    expect(crowded.plant).toBe(false)
    expect(roomy.dividers).toBe(true)
    expect(crowded.dividers).toBe(false)
    expect(propsAt(20).walkway).toBe(true)
    expect(propsAt(120).walkway).toBe(false)
  })

  it('keeps the things that do not need floor space', () => {
    // The whiteboard is on a wall and the servers are in a corner. Crowding
    // takes the floor, not the walls.
    expect(propsAt(120).whiteboard).toBe(true)
    expect(propsAt(120).serverRack).toBe(true)
  })
})

describe('arrivals — GDD §7.7.2, hiring is seen', () => {
  it('falls under gravity rather than descending like a lift', () => {
    // Ground covered in the second half of the fall must exceed the first.
    const first = arrivalHeight(0.2) - arrivalHeight(0.5)
    const second = arrivalHeight(0.5) - arrivalHeight(0.8)
    expect(second).toBeGreaterThan(first)
  })

  it('starts in the air and ends on the desk', () => {
    expect(arrivalHeight(0)).toBeGreaterThan(0)
    expect(arrivalHeight(1)).toBe(0)
  })

  it('staggers a batch so it reads as a shower, not a wipe', () => {
    const delays = new Set(Array.from({ length: 60 }, (_, i) => arrivalDelay(i, 60).toFixed(3)))
    expect(delays.size).toBeGreaterThan(20)
  })

  it('lands a single hire immediately — one person does not need a stagger', () => {
    expect(arrivalDelay(0, 1)).toBe(0)
  })

  it('leaves no dust behind', () => {
    expect(puffAlpha(1)).toBe(0)
  })
})
