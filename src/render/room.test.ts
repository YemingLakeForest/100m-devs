import { describe, expect, it, vi } from 'vitest'

// arrivals.ts plays a sound on spawn; the Capacitor native-audio plugin cannot
// initialise under jsdom. These tests cover the fall and puff curves, which
// never play anything.
vi.mock('../audio/sfx.ts', () => ({ playSfx: () => {} }))
import { PITCH_COL, PITCH_ROW, ROOM_DEV_CAP, gridFor, perimeterPoint, propsAt } from './room.ts'
import { BEAT, cascadeDelay, arrivalHeight, landingSquash, puffAlpha } from './arrivals.ts'
import { maxZoomFor } from '../sim/headcount.ts'
import { FLOOR_SPRITE_COUNT } from './scene.ts'

describe('the room grows with the headcount — GDD §7.8.1', () => {
  it('covers every headcount the §7.7.1 zoom ceiling traps the player at', () => {
    // maxZoomFor keeps the camera in one room below 100 developers, so this
    // tier has to be able to *draw* 99 of them. If the cap were lower the
    // player would be locked into a room that could not show their studio.
    const trappedAt = 99
    expect(ROOM_DEV_CAP).toBeGreaterThanOrEqual(trappedAt)
    expect(maxZoomFor(trappedAt)).toBe(0.2)
  })

  it('lays the floor out in rows — wider than it is deep, always', () => {
    // A floor has a grain. Desks go shoulder to shoulder along a row and the
    // space is taken out behind it, so there are always at least as many desks
    // per row as there are rows. A grid deeper than it is wide is a corridor.
    for (const n of [1, 2, 4, 8, 12, 26, 40, 77, 120]) {
      const { cols, rows } = gridFor(n)
      expect(cols).toBeGreaterThanOrEqual(rows)
    }
  })

  it('keeps the footprint squarish, which is not the same as the count', () => {
    // The invariant that replaced "cols === rows". A literally square *count*
    // was right when the spacing was uniform in both axes and became wrong the
    // moment rows were set 1.7x further apart than desks within a row: an n x n
    // grid then draws a floor half again as deep as it is wide. What §7.8.1
    // actually wants — "a huddle at 3-5, a floor at 31+" — is a square
    // footprint, so that is what is pinned.
    for (const n of [4, 9, 20, 40, 80, 120]) {
      const { cols, rows } = gridFor(n)
      const aspect = (cols * PITCH_COL) / (rows * PITCH_ROW)
      expect(aspect).toBeGreaterThan(0.6)
      expect(aspect).toBeLessThan(1.9)
    }
  })

  it('matches §7.8.1 at the headcounts the table names', () => {
    // "1: one desk. 2: a second desk pushed alongside. 6-10: two rows."
    expect(gridFor(1)).toEqual({ cols: 1, rows: 1 })
    expect(gridFor(2)).toEqual({ cols: 2, rows: 1 })
    expect(gridFor(8).rows).toBe(2)
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
    expect(p.plants).toBe(0)
    expect(p.coffee).toBe(false)
    expect(p.waterCooler).toBe(false)
  })

  it('keeps the rug only while this is still a bedroom', () => {
    // A rug is a bedroom thing. It is the one prop that leaves early rather
    // than at the crowding threshold, because an office simply never has one.
    expect(propsAt(1).rug).toBe(true)
    expect(propsAt(20).rug).toBe(false)
  })

  it('fills the room out as the studio grows', () => {
    expect(propsAt(3).whiteboard).toBe(true)
    expect(propsAt(3).plants).toBeGreaterThan(0)
    expect(propsAt(6).coffee).toBe(true)
    expect(propsAt(8).waterCooler).toBe(true)
    expect(propsAt(11).dividers).toBe(true)
    expect(propsAt(11).serverRack).toBe(true)
    expect(propsAt(11).whiteboardRight).toBe(true)
    expect(propsAt(14).filingCabinet).toBe(true)
    expect(propsAt(18).printer).toBe(true)
    expect(propsAt(20).sofa).toBe(true)
    expect(propsAt(31).cables).toBe(true)
  })

  it('adds plants and posters as there is room for them', () => {
    // They multiply rather than appearing once, so the room reads as being
    // lived in for longer as it grows.
    expect(propsAt(6).plants).toBeGreaterThan(propsAt(3).plants)
    expect(propsAt(24).plants).toBeGreaterThan(propsAt(6).plants)
    expect(propsAt(24).posters).toBeGreaterThan(propsAt(5).posters)
  })

  it('TAKES THINGS AWAY once it crowds — the §6 thesis in set dressing', () => {
    // This is the half of §7.8.1 that matters. The room gets *worse* as it
    // gets fuller: the plant goes unwatered, the dividers have no floor left
    // to stand on, the walkway becomes desks. If this ever reads as monotonic
    // growth, the set dressing has stopped telling the story.
    const roomy = propsAt(20)
    const crowded = propsAt(120)
    expect(roomy.plants).toBeGreaterThan(0)
    expect(crowded.plants).toBe(0)
    expect(roomy.dividers).toBe(true)
    expect(crowded.dividers).toBe(false)
    expect(roomy.sofa).toBe(true)
    expect(crowded.sofa).toBe(false)
    expect(propsAt(20).walkway).toBe(true)
    expect(propsAt(120).walkway).toBe(false)
  })

  it('keeps the mess nobody chose while removing the things they did', () => {
    // The cruellest half of §7.8.1. Crowding takes the plants and the sofa —
    // things somebody decided to put there — and leaves more cardboard, which
    // nobody decided anything about.
    expect(propsAt(120).boxes).toBeGreaterThan(propsAt(31).boxes)
    expect(propsAt(120).plants).toBe(0)
  })

  it('keeps the things that do not need floor space', () => {
    // The whiteboard is on a wall and the servers are in a corner. Crowding
    // takes the floor, not the walls — which is why the two are drawn from
    // separate budgets rather than one list of booleans.
    expect(propsAt(120).whiteboard).toBe(true)
    expect(propsAt(120).whiteboardRight).toBe(true)
    expect(propsAt(120).posters).toBeGreaterThan(0)
    expect(propsAt(120).serverRack).toBe(true)
  })
})

describe('perimeter placement', () => {
  it('walks all the way round without repeating a position', () => {
    const seen = new Set(
      Array.from({ length: 12 }, (_, i) =>
        JSON.stringify(perimeterPoint(i / 12, 0, 0, 100, 50, 10)),
      ),
    )
    expect(seen.size).toBe(12)
  })

  it('closes the loop, so a full turn returns to the start', () => {
    const a = perimeterPoint(0, 0, 0, 100, 50, 10)
    const b = perimeterPoint(1, 0, 0, 100, 50, 10)
    expect(b.x).toBeCloseTo(a.x, 6)
    expect(b.y).toBeCloseTo(a.y, 6)
  })

  it('stays inside the floor, so nothing is embedded in a wall', () => {
    for (let i = 0; i < 40; i++) {
      const p = perimeterPoint(i / 40, 0, 0, 100, 50, 12)
      // Inside the diamond |x|/w + |y|/h <= 1, with a little slack for the inset.
      expect(Math.abs(p.x) / 100 + Math.abs(p.y) / 50).toBeLessThanOrEqual(1.001)
    }
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

  it('cascades a batch across the room in seat order — GDD §7.8.5', () => {
    // Deliberately ordered, unlike Act IV's hashed swarm drop. At counts the
    // eye can follow, order reads as a row being placed; the hash is for a
    // thousand bodies, where the same ordering sweeps the grid diagonally.
    const delays = Array.from({ length: 8 }, (_, i) => cascadeDelay(i, 8))
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1])
    }
  })

  it('lands a single hire immediately — one person does not need a cascade', () => {
    expect(cascadeDelay(0, 1)).toBe(0)
  })

  it('caps the cascade so a big hire is not a seven-second queue', () => {
    expect(cascadeDelay(99, 100)).toBeLessThanOrEqual(1.2)
    expect(cascadeDelay(999, 1000)).toBeLessThanOrEqual(1.2)
  })

  it('lands the person LAST — §7.8.5, the desk and chair are setup', () => {
    // Reversed, with furniture assembling around someone already sitting, it
    // reads as a glitch rather than as a workspace being built.
    expect(BEAT.desk).toBeLessThan(BEAT.chair)
    expect(BEAT.chair).toBeLessThan(BEAT.person)
    expect(BEAT.person).toBeLessThan(BEAT.monitor)
  })

  it('gives the person the biggest squash, because it is the payload', () => {
    const at = (strength: number) =>
      Math.min(...Array.from({ length: 60 }, (_, i) => landingSquash(0.6 + i * 0.0066, strength)))
    expect(at(0.34)).toBeLessThan(at(0.22))
    expect(at(0.22)).toBeLessThan(at(0.18))
  })

  it('leaves no dust behind', () => {
    expect(puffAlpha(1)).toBe(0)
  })
})

describe('the floor tier shows the studio you have — GDD §7.7.1', () => {
  it('does not put a thousand strangers behind two developers', () => {
    // The complaint that produced this: at the zoom ceiling the level-2 tier
    // cross-fades in at ~40% alpha, and it used to render all 1,000 particles
    // whatever the headcount — so two developers had a ghost of a full office
    // standing behind them. Population is now min(devs, budget).
    //
    // Asserted on the pure rule rather than through Pixi, because the renderer
    // needs a WebGL context that jsdom does not have.
    const shown = (devs: number) => Math.max(0, Math.min(FLOOR_SPRITE_COUNT, Math.floor(devs)))
    expect(shown(2)).toBe(2)
    expect(shown(40)).toBe(40)
    expect(shown(1002)).toBe(FLOOR_SPRITE_COUNT)
    expect(shown(0)).toBe(0)
  })

  it('still has a full thousand available for §23.3 criterion 4', () => {
    // The tier must be able to render the load the criterion names even when
    // the player has hired one person, or the benchmark silently measures a
    // scene a thousandth of the intended weight.
    expect(FLOOR_SPRITE_COUNT).toBe(1000)
  })
})
