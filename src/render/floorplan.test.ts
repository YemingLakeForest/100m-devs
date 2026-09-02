import { describe, expect, it } from 'vitest'
import {
  PLAN_AMENITIES,
  PLAN_BLOCKS,
  PLAN_BOUNDS,
  PLAN_CAPACITY,
  PLAN_PLATES,
  PLAN_PLAZA,
  PLAN_RUNS,
  occupiedRuns,
  planLattice,
  planSeat,
} from './floorplan.ts'
import { ROOM_DEV_CAP, SQUAD_COLS, SQUAD_SIZE } from './room.ts'

/** Every seat the plan holds, resolved once. */
const SEATS = Array.from({ length: PLAN_CAPACITY }, (_, i) => planSeat(i))

describe('the plan holds the floor it claims to — §7.8.1e', () => {
  it('seats a full floor', () => {
    // The one number that can silently break the room: a plan that runs out of
    // desks repeats its last seat rather than throwing, because a renderer is
    // the wrong place to discover a cap has been raised. So it fails here.
    expect(PLAN_CAPACITY).toBeGreaterThanOrEqual(ROOM_DEV_CAP)
  })

  it('is FULL at a thousand, not half empty', () => {
    // §7.8.1's Act IV image is a floor with nothing left. A plan with two
    // hundred spare desks at the cap would draw a studio of a thousand standing
    // in a building sized for twelve hundred, which is the opposite picture.
    expect(PLAN_CAPACITY).toBeLessThan(ROOM_DEV_CAP * 1.1)
  })

  it('lays the floor out wider than it is deep', () => {
    // §7.8.1's grain at the scale of the building. Rows run on `col`, so a plan
    // deeper than it is wide is a corridor rather than an office — and the
    // depth costs 2.1 tiles a row against the column's one.
    expect(PLAN_BOUNDS.maxCol).toBeGreaterThan(PLAN_BOUNDS.maxRow * 2.1)
  })
})

describe('nobody who is sitting down ever moves — §7.8.1b', () => {
  it('resolves a seat from the seat index alone', () => {
    // The property the whole module exists to keep. The plan is a static table
    // read by index; it is never solved for a headcount, so there is no input
    // that could move somebody. Asserted by asking at wildly different
    // "headcounts" and getting the same answer.
    for (const i of [0, 1, 9, 99, 100, 451, 789, 790, 999]) {
      expect(planSeat(i)).toEqual(SEATS[i])
      expect(planSeat(i)).toEqual(planSeat(i))
    }
  })

  it('keeps the first hundred exactly where the garage put them', () => {
    // §7.8.1c leaves the first squad "where it is and the size it is", so every
    // headcount below a hundred has to be byte-identical to what shipped before
    // this plan existed — the whole opening of the game, not a thing to
    // redesign on the way past.
    for (let i = 0; i < SQUAD_SIZE; i++) {
      expect(SEATS[i].col).toBe(i % SQUAD_COLS)
      expect(SEATS[i].row).toBe(Math.floor(i / SQUAD_COLS))
    }
  })

  it('starts at the plot §7.8.12 holds for the suite doorway', () => {
    // The room draws James inside the glass and leaves this plot bare; it is
    // the threshold the door opens onto. `room.acceptance.mjs` fails if
    // anything is ever drawn on it.
    expect(SEATS[0]).toMatchObject({ col: 0, row: 0 })
  })

  it('never trespasses into the back band', () => {
    // Rows below zero are the suite and the meeting rooms. A seat up there
    // would put a developer inside the executive suite, which §7.8.12's "behind
    // row 0" rule exists to make impossible.
    for (const seat of SEATS) expect(seat.row).toBeGreaterThanOrEqual(0)
  })

  it('seats no two people in the same place', () => {
    // Cheap to get wrong when the plan is authored by hand: one block starting
    // two columns further west than intended puts a hundred people inside
    // another hundred. Bucketed rather than compared pairwise — a million
    // comparisons is a slow test nobody runs.
    const grid = new Map<string, number>()
    for (const [i, seat] of SEATS.entries()) {
      const key = `${Math.round(seat.col * 4)},${Math.round(seat.row * 4)}`
      const prev = grid.get(key)
      expect(prev, `seat ${i} sits on seat ${prev}`).toBeUndefined()
      grid.set(key, i)
    }
  })
})

describe('the floor stops being one thing repeated — §7.8.1e', () => {
  it('is ten banks, not ten copies of one bank', () => {
    expect(PLAN_BLOCKS.length).toBeGreaterThanOrEqual(8)
    // No two blocks the same size. Reported as "still rank and file desks", and
    // the report was about the outline of the bank rather than the grain inside
    // it: ten identical rectangles read as a formation whatever is on them.
    const sizes = new Set(PLAN_BLOCKS.map((b) => b.count))
    expect(sizes.size).toBe(PLAN_BLOCKS.length)
  })

  it('never puts two banks of the same arrangement side by side', () => {
    // The rule doing the actual work. A clusters bank next to a runs bank is
    // two textures meeting at a hallway; two runs banks next to each other is
    // one bigger runs bank with a line down it.
    for (let i = 1; i < PLAN_BLOCKS.length; i++) {
      const a = PLAN_BLOCKS[i - 1]
      const b = PLAN_BLOCKS[i]
      const sameBand = Math.abs(a.minRow - b.minRow) < 1
      if (sameBand) expect(a.kind, `${a.name} then ${b.name}`).not.toBe(b.kind)
    }
  })

  it('authors ragged ends rather than rectangles', () => {
    // A `runs` bank whose rows are all the same length is a rectangle, and
    // rectangles are what this replaced. **Every one of them tapers except the
    // first**, which is exempt because it is the garage's own squad and
    // §7.8.1c leaves that where it is and the size it is.
    const tapers = (b: number) => new Set(PLAN_RUNS.filter((r) => r.block === b).map((r) => r.len)).size > 1
    const banks = PLAN_BLOCKS.map((block, b) => ({ block, b })).filter(({ block }) => block.kind === 'runs')
    expect(banks.length).toBeGreaterThanOrEqual(3)
    for (const { block, b } of banks) {
      if (b === 0) expect(tapers(b)).toBe(false)
      else expect(tapers(b), `${block.name} is a rectangle`).toBe(true)
    }
  })

  it('hires along a route through the building, not a raster scan', () => {
    // Successive hundreds land in different parts of the floor, so the studio
    // is seen to *spread*. A scan fills left to right and the picture at five
    // hundred is the picture at four hundred with a column added.
    const bandOf = (i: number) => (SEATS[i].row < 10 ? 'north' : SEATS[i].row < 21 ? 'south' : 'front')
    expect(bandOf(0)).toBe('north')
    expect(bandOf(500)).toBe('south')
    expect(bandOf(999)).toBe('front')
  })
})

describe('the amenities stand in the holes, not on the desks — §7.8.1e', () => {
  it('reserves a room of every kind', () => {
    const kinds = new Set(PLAN_AMENITIES.map((a) => a.kind))
    for (const kind of ['meeting', 'library', 'pantry', 'kitchenette', 'core', 'breakout', 'cafeteria']) {
      expect(kinds, `no ${kind} on the plan`).toContain(kind)
    }
  })

  it('never reserves floor a seat is on', () => {
    // The reason the plan owns the amenities rather than the renderer: an
    // amenity placed by eye is an amenity that eventually lands on somebody's
    // desk, and nothing else in the build would notice.
    for (const plot of PLAN_AMENITIES) {
      const inside = SEATS.filter(
        (s) => s.col >= plot.minCol && s.col <= plot.maxCol && s.row >= plot.minRow && s.row <= plot.maxRow,
      )
      expect(inside.length, `${plot.name} covers ${inside.length} seat(s)`).toBe(0)
    }
  })

  it('leaves the plaza the clear floor §7.8.1d promised it', () => {
    // The plaza costs no seats — it stands in the spine, which is the gap
    // between the two deep bands and is floor the plan has never put a desk on.
    const near = SEATS.filter(
      (s) => Math.abs(s.col - PLAN_PLAZA.col) < 2.4 && Math.abs(s.row - PLAN_PLAZA.row) < 1.2,
    )
    expect(near.length).toBe(0)
  })

  it('puts the meeting rooms behind row zero, where the floor was already clear', () => {
    // The back band is §7.8.12's own 3.3 rows and the suite only uses its
    // western end. Everything east of the glass is two clear rows against the
    // back wall, which is where an office puts its meeting rooms — and it costs
    // nothing, the same argument the plaza makes.
    const back = PLAN_AMENITIES.filter((a) => a.maxRow < 0)
    expect(back.length).toBeGreaterThanOrEqual(4)
    // Clear of the suite's glass, which reaches col 3.64 at its widest.
    for (const plot of back) expect(plot.minCol).toBeGreaterThan(3.64)
  })
})

describe('the plates have the shape the desks have — §7.8.1c', () => {
  it('is many plates of many sizes, not ten of one', () => {
    expect(PLAN_PLATES.length).toBeGreaterThan(PLAN_BLOCKS.length * 2)
    const areas = new Set(
      PLAN_PLATES.map((p) => Math.round((p.maxCol - p.minCol) * (p.maxRow - p.minRow) * 10)),
    )
    expect(areas.size).toBeGreaterThanOrEqual(5)
  })

  it('runs every plate edge on a floor axis', () => {
    // The §7.8.12 rule, applied one scale down. An edge that is neither
    // col-constant nor row-constant does not lie in the floor plane, and in
    // this projection there is no third direction available.
    for (const plate of PLAN_PLATES) {
      for (let i = 0; i < plate.points.length; i++) {
        const [c0, r0] = plate.points[i]
        const [c1, r1] = plate.points[(i + 1) % plate.points.length]
        const axis = Math.abs(c1 - c0) < 1e-9 || Math.abs(r1 - r0) < 1e-9
        expect(axis, `plate on block ${plate.block} has a diagonal edge`).toBe(true)
      }
    }
  })

  it('covers every desk it is under', () => {
    for (const seat of SEATS) {
      const on = PLAN_PLATES.some(
        (p) =>
          p.block === seat.block &&
          seat.col >= p.minCol - 1e-9 &&
          seat.col <= p.maxCol + 1e-9 &&
          seat.row >= p.minRow - 1e-9 &&
          seat.row <= p.maxRow + 1e-9,
      )
      expect(on, `seat at (${seat.col}, ${seat.row}) is on no plate`).toBe(true)
    }
  })

  it('hinges each plate on its own corner nearest the origin', () => {
    // §7.8.1c swings a panel out of its neighbour rather than growing it out of
    // its own middle, so the hinge is the corner facing the block already open.
    for (const plate of PLAN_PLATES) {
      expect(plate.hinge[0]).toBeCloseTo(plate.minCol, 9)
      expect(plate.hinge[1]).toBeCloseTo(plate.minRow, 9)
    }
  })
})

describe('the walkable lattice comes off the plan — §7.8.6', () => {
  const full = planLattice(PLAN_CAPACITY)

  it('puts an aisle behind every row of desks', () => {
    // A seat with no aisle behind it walks out through its own monitor.
    for (const run of PLAN_RUNS) {
      const behind = full.aisles.some((a) => a > run.row && a - run.row < 1.2)
      expect(behind, `no aisle behind the row at ${run.row}`).toBe(true)
    }
  })

  it('opens a hallway in every gap wide enough to walk down', () => {
    // The lines a stride-generated floor could not have: these are where the
    // *plan* left space, so moving a block moves the hallway beside it.
    expect(full.hallways.length).toBeGreaterThanOrEqual(4)
    for (const hall of full.hallways) {
      const blocked = occupiedRuns(PLAN_CAPACITY).some(
        ({ run, len }) => hall > run.col - 0.5 && hall < run.col + len - 0.5,
      )
      expect(blocked, `the hallway at col ${hall} runs through desks`).toBe(false)
    }
  })

  it('closes a hallway the studio has built over — §7.8.1 crowding', () => {
    // The best thing this module can do with §7.8.1's "the room gets worse as
    // it gets fuller": the middle hallway runs the whole depth of the two big
    // bands, and then the front band fills and OVERFLOW is laid straight across
    // the end of it. Nothing deletes the hallway. It simply stops being one,
    // and §7.8.6's walkers stop routing down it without a rule saying so.
    const roomy = planLattice(700).hallways
    const packed = full.hallways
    const mid = (halls: readonly number[]) => halls.filter((h) => h > 30 && h < 34).length
    expect(mid(roomy)).toBe(1)
    expect(mid(packed)).toBe(0)
    expect(packed.length).toBeLessThan(roomy.length)
  })

  it('keeps a lane outside the front row and the back one', () => {
    expect(Math.min(...full.aisles)).toBeLessThan(0)
    expect(Math.max(...full.aisles)).toBeGreaterThan(PLAN_BOUNDS.maxRow)
  })
})

describe('occupiedRuns clips the plan to the headcount', () => {
  it('draws nothing for an empty room and everything for a full one', () => {
    expect(occupiedRuns(0)).toEqual([])
    expect(occupiedRuns(PLAN_CAPACITY).length).toBe(PLAN_RUNS.length)
  })

  it('accounts for exactly the people who are there', () => {
    for (const n of [1, 7, 99, 100, 137, 451, 790, 999, 1000]) {
      const total = occupiedRuns(n).reduce((sum, r) => sum + r.len, 0)
      expect(total).toBe(n)
    }
  })

  it('never draws a desk past the end of its own run', () => {
    for (const n of [3, 88, 233, 617, 951]) {
      for (const { run, len } of occupiedRuns(n)) {
        expect(len).toBeGreaterThan(0)
        expect(len).toBeLessThanOrEqual(run.len)
      }
    }
  })
})
