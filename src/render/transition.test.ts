import { describe, expect, it } from 'vitest'

import { GARAGE_CAP, sceneFor } from '../sim/capacity.ts'
import { developerAt } from '../sim/identity.ts'
import { GARAGE_SEATS } from './garage.ts'
import { drawnSeatPlot } from './room.ts'

/**
 * §7.8.0 Loop 4 — **the move out of the garage.**
 *
 * The prompt this implements asks for three things to be proven about the
 * twenty-first hire, and all three are claims about *identity across a change
 * of room*. They are tested here rather than in either room's own file because
 * that is exactly the point: neither room can make this claim alone.
 *
 * The room the developers are drawn in is the only thing that changes. Their
 * indices do not, their generated looks do not, and the count does not.
 */

/** How the room resolves a seat: the studio's window, and which room is drawn. */
const inGarage = (seat: number) => drawnSeatPlot(seat, 0, true)
const inOffice = (seat: number) => drawnSeatPlot(seat, 0, false)

describe('the twentieth hire triggers expansion once', () => {
  /**
   * Once, and on the hire after the one that fills the garage. The garage is
   * complete at twenty ordinary developers and the twenty-first is the one with
   * nowhere to sit — so the boundary is *between* them, and a player who has
   * just watched the twentieth sit down is still looking at the room they sat
   * down in.
   */
  it('crosses out of the garage exactly once, on the twenty-first', () => {
    let crossings = 0
    let previous = sceneFor(0)
    const at: number[] = []
    for (let n = 1; n <= 400; n++) {
      const now = sceneFor(n)
      if (now !== previous) {
        crossings += 1
        at.push(n)
      }
      previous = now
    }
    // Two changes of picture in the whole range — garage to floor, floor to
    // building — and nothing else. A scene model that flickered would show up
    // here as a crossing count in the dozens.
    expect(crossings).toBe(2)
    expect(at).toEqual([GARAGE_CAP + 1, 101])
  })

  it('leaves the garage complete at twenty and not before', () => {
    expect(sceneFor(GARAGE_CAP - 1)).toBe('garage')
    expect(sceneFor(GARAGE_CAP)).toBe('garage')
    expect(sceneFor(GARAGE_CAP + 1)).toBe('floor')
    expect(GARAGE_SEATS).toBe(GARAGE_CAP)
  })
})

describe('the transition preserves roster identity and count', () => {
  /**
   * **The move does not manufacture a twenty-first developer**, and the way to
   * prove it is to show that the two rooms address the *same set of indices*:
   * every seat below the headcount is drawn exactly once in each, none is
   * skipped and none appears twice. A move that invented somebody would show up
   * as a gap or a duplicate in one of the two lists.
   */
  it('draws the same seat indices in both rooms, with no gap and no duplicate', () => {
    for (const n of [1, 5, GARAGE_CAP, GARAGE_CAP + 1]) {
      const garage = Array.from({ length: n }, (_, i) => i).map(inGarage)
      const office = Array.from({ length: n }, (_, i) => i).map(inOffice)
      expect(garage).toHaveLength(n)
      expect(office).toHaveLength(n)
      // Distinct plots within each room — nobody is drawn on top of anybody.
      const key = (p: { col: number; row: number }) => `${p.col.toFixed(4)},${p.row.toFixed(4)}`
      expect(new Set(garage.map(key)).size).toBe(n)
      expect(new Set(office.map(key)).size).toBe(n)
    }
  })

  /**
   * **Identity is generated from the seat index and nothing else**, so it
   * cannot notice the move. This is the assertion that makes "the same roster"
   * mean something: the person in seat 7 has the same face, the same costume
   * and the same name in both buildings, because the room was never an input.
   */
  it('gives every developer the same face in both rooms', () => {
    const seed = 4242
    for (let i = 0; i < GARAGE_CAP + 1; i++) {
      const before = developerAt(seed, i)
      const after = developerAt(seed, i)
      expect(after).toEqual(before)
    }
    // And two different seats are two different people, or the claim above is
    // vacuous — a generator that returned one look for everybody would pass it.
    const looks = new Set(
      Array.from({ length: GARAGE_CAP }, (_, i) => JSON.stringify(developerAt(seed, i).look)),
    )
    expect(looks.size).toBeGreaterThan(GARAGE_CAP / 2)
  })

  /**
   * The seats *move*, and that is the point of there being two plans at all.
   * Without this the two rooms could be the same room and every assertion above
   * would still pass.
   */
  it('does move everybody, because it is a different building', () => {
    let moved = 0
    for (let i = 1; i < GARAGE_CAP; i++) {
      const a = inGarage(i)
      const b = inOffice(i)
      if (a.col !== b.col || a.row !== b.row) moved += 1
    }
    expect(moved).toBe(GARAGE_CAP - 1)
  })

  /**
   * §7.8.12 outranks both plans. A seat the suite holds resolves to the suite's
   * desk in either room, so the leadership roster does not move house at all —
   * which is the physical form of "leadership plots do not consume ordinary
   * capacity".
   */
  it('leaves the suite where it is through the move', () => {
    expect(inGarage(0)).toEqual(inOffice(0))
  })
})
