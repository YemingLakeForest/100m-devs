import { describe, expect, it } from 'vitest'
import { newHero } from '../sim/heroes.ts'
import { roomSeatMarks, unitFootprint, type RoomPosting } from './heroBadges.ts'

describe('§13.11.1 — who covers this?', () => {
  it('folds each hero to a coverage claim over the unit', () => {
    const fp = unitFootprint(
      [
        { heroId: 'mo', branch: 'quality', state: newHero('james') },
        { heroId: 'melany', branch: 'cloud', state: newHero('james') },
      ],
      8,
    )
    expect(fp.claims).toHaveLength(2)
    for (const claim of fp.claims) expect(claim.fraction).toBeGreaterThan(0)
  })

  it('cross-hatches when two heroes of one branch overlap — §13.8 rule 3', () => {
    const fp = unitFootprint(
      [
        { heroId: 'a', branch: 'quality', state: newHero('james') },
        { heroId: 'b', branch: 'quality', state: newHero('james') },
        { heroId: 'c', branch: 'cloud', state: newHero('james') },
      ],
      8,
    )
    expect(fp.overlapped.has('quality')).toBe(true)
    expect(fp.overlapped.has('cloud')).toBe(false)
  })

  it('flags nothing wasted on a unit with one hero per branch', () => {
    const fp = unitFootprint(
      [
        { heroId: 'mo', branch: 'quality', state: newHero('james') },
        { heroId: 'serena', branch: 'reliability', state: newHero('james') },
      ],
      8,
    )
    expect(fp.overlapped.size).toBe(0)
  })
})

describe('§13.11.1 — the footprint on the room floor', () => {
  function posting(over: Partial<RoomPosting> = {}): RoomPosting {
    return {
      branch: 'quality',
      colour: '#8fd6a0',
      index: 0,
      reachDevs: 4,
      settling: false,
      ...over,
    }
  }

  it('covers upward from the seat the hero stands on — §13.6.2', () => {
    const marks = roomSeatMarks([posting({ index: 2, reachDevs: 3 })], 10)
    expect([...marks.keys()].sort((a, b) => a - b)).toEqual([2, 3, 4])
  })

  it('never reaches past the last person hired', () => {
    // A reach of forty on the eighth desk of a room of ten covers two people.
    const marks = roomSeatMarks([posting({ index: 8, reachDevs: 40 })], 10)
    expect(marks.size).toBe(2)
  })

  it('draws nobody for a hero standing past the end of the room', () => {
    expect(roomSeatMarks([posting({ index: 20 })], 10).size).toBe(0)
  })

  it('hatches only the seats two of one branch actually share — §13.8 rule 3', () => {
    const marks = roomSeatMarks(
      [
        posting({ index: 0, reachDevs: 4 }),
        posting({ index: 2, reachDevs: 4 }),
      ],
      10,
    )
    // Seats 2 and 3 are covered twice by the same branch; 0, 1, 4 and 5 once.
    expect(marks.get(2)?.wasted).toBe(true)
    expect(marks.get(3)?.wasted).toBe(true)
    expect(marks.get(0)?.wasted).toBe(false)
    expect(marks.get(5)?.wasted).toBe(false)
  })

  it('lets two branches share a seat without calling it waste', () => {
    const marks = roomSeatMarks(
      [
        posting({ branch: 'quality', colour: '#8fd6a0', index: 0, reachDevs: 4 }),
        posting({ branch: 'cloud', colour: '#6fb7e8', index: 0, reachDevs: 4 }),
      ],
      10,
    )
    expect(marks.get(0)?.wasted).toBe(false)
    // One tile, and the first posting keeps it. Splitting the diamond is four
    // pixels of stripe at desk zoom.
    expect(marks.get(0)?.colour).toBe('#8fd6a0')
  })

  it('marks a walking hero settling, and stops as soon as anybody has arrived', () => {
    const walking = roomSeatMarks([posting({ settling: true })], 10)
    expect(walking.get(0)?.settling).toBe(true)

    const both = roomSeatMarks(
      [
        posting({ branch: 'quality', index: 0, reachDevs: 4, settling: true }),
        posting({ branch: 'cloud', index: 0, reachDevs: 4, settling: false }),
      ],
      10,
    )
    expect(both.get(0)?.settling).toBe(false)
  })

  it('draws nothing on an empty studio', () => {
    expect(roomSeatMarks([posting()], 0).size).toBe(0)
  })
})
