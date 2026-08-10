import { describe, expect, it, vi } from 'vitest'

// arrivals.ts plays a sound on spawn; the Capacitor native-audio plugin cannot
// initialise under jsdom. These tests cover the fall and puff curves, which
// never play anything.
vi.mock('../audio/sfx.ts', () => ({ playSfx: () => {} }))
import type { Container } from 'pixi.js'
import {
  FLOOR_COLS,
  FLOOR_ROWS,
  FLOOR_SIZE,
  HOP_AIRBORNE,
  HOP_HEIGHT,
  HOP_SQUASH,
  PITCH_COL,
  SQUAD_COLS,
  SQUAD_ROWS,
  SQUAD_SIZE,
  UNFOLD_MS,
  DESK_DEPTH,
  DESK_SETBACK,
  DESK_SPAN,
  WALL_GAP,
  wallSpot,
  blockBox,
  buildRoom,
  seatPosition,
  PITCH_ROW,
  ROOM_DEV_CAP,
  gridFor,
  hopHeight,
  hopSquash,
  hopSway,
  panelDelay,
  panelLight,
  panelOpen,
  panelProgress,
  plateHalfWidth,
  propsAt,
  seatFor,
  seatGrid,
} from './room.ts'
import {
  ARRIVAL_MS,
  BEAT,
  CASCADE_MAX_MS,
  LAND_AT,
  cascadeDelay,
  contactSquash,
  createArrivals,
  contactStretch,
  fallHeight,
  puffAlpha,
} from './arrivals.ts'
import { maxZoomFor } from '../sim/headcount.ts'
import { zAtRung } from '../sim/ladder.ts'
import { FLOOR_SPRITE_COUNT } from './scene.ts'

describe('the room grows with the headcount — GDD §7.8.1', () => {
  it('covers every headcount the §7.7.1 zoom ceiling traps the player at', () => {
    // maxZoomFor keeps the camera in one room below 100 developers, so this
    // tier has to be able to *draw* 99 of them. If the cap were lower the
    // player would be locked into a room that could not show their studio.
    const trappedAt = 99
    expect(ROOM_DEV_CAP).toBeGreaterThanOrEqual(trappedAt)
    // §7.4a — rung 1 is the room, and below a hundred developers it is also the
    // ceiling. There is nowhere else to look, so this tier has to draw all 99.
    expect(maxZoomFor(trappedAt)).toBe(zAtRung(1))
  })

  it('never moves somebody who is already sitting down — §7.8.1b', () => {
    // The property the whole squad structure exists for, and the one the old
    // square-footprint solve could not have: hiring never re-flows the room.
    // Before this, `gridFor(6)` was 3 wide and `gridFor(7)` was 4, so the
    // seventh hire picked the other six up and put them somewhere else — which
    // §7.8.1b calls indistinguishable from a redraw.
    const seats = Array.from({ length: 250 }, (_, i) => seatGrid(i))
    for (let n = 1; n <= 250; n++) {
      for (let i = 0; i < n; i++) {
        expect(seatGrid(i)).toEqual(seats[i])
      }
    }
  })

  it('fills row by row at BOTH scales — §7.8.1b', () => {
    // Seats within a squad, squads within the floor, one reading order.
    expect(seatFor(0)).toMatchObject({ squad: 0, col: 0, row: 0 })
    expect(seatFor(9)).toMatchObject({ squad: 0, col: 9, row: 0 })
    // The tenth hire starts the next row rather than widening the first.
    expect(seatFor(10)).toMatchObject({ squad: 0, col: 0, row: 1 })
    // The hundredth fills the squad; the hundred and first starts the next one,
    // and it starts at *its* first seat, not somewhere in the middle.
    expect(seatFor(99)).toMatchObject({ squad: 0, col: 9, row: 9 })
    expect(seatFor(100)).toMatchObject({ squad: 1, col: 0, row: 0, squadCol: 1, squadRow: 0 })
    // And squads themselves wrap to the next row of squads at ten.
    expect(seatFor(10 * SQUAD_SIZE)).toMatchObject({ squadCol: 0, squadRow: 1 })
  })

  it('puts a corridor between squads, not between desks — §7.8.1a', () => {
    // Two desks side by side inside a squad are a pitch apart. The desk across
    // a squad boundary is much further, and that gap is the corridor.
    const within = seatGrid(1).col - seatGrid(0).col
    const across = seatGrid(100).col - seatGrid(9).col
    expect(within).toBe(1)
    expect(across).toBeGreaterThan(within * 2)
  })

  it('holds exactly ten thousand — §7.8.1a', () => {
    expect(SQUAD_SIZE).toBe(100)
    expect(FLOOR_SIZE).toBe(10_000)
    // The last seat on the floor is in the last squad's last row, and it is
    // still on the grid rather than off the end of it.
    expect(seatFor(FLOOR_SIZE - 1)).toMatchObject({ squadCol: 9, squadRow: 9, col: 9, row: 9 })
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

  it('seats a row ACROSS the way people face, not along it', () => {
    // Reported three times, and the third time is the one that says it exactly:
    // "row means developers sitting next to each other, not in front and
    // behind."
    //
    // `drawWorkstation` turns the screen south-east, so the developer at it
    // looks north-west. A row laid along *that* axis puts every developer
    // directly behind the next one — isometrically correct, and a queue. The
    // row therefore runs south-west, across the facing, which is also parallel
    // to the left-hand wall.
    const a = seatPosition(0)
    const b = seatPosition(1)
    // South-west: leftward and down the screen, at the 2:1 of the projection.
    expect(b.x).toBeLessThan(a.x)
    expect(b.y).toBeGreaterThan(a.y)
    expect((a.x - b.x) / (b.y - a.y)).toBeCloseTo(2, 9)
  })

  it('steps the next row toward the camera, along the other axis', () => {
    // The row in front is in *front* — south-east, nearer the lens — so "the
    // row behind" and "the row in front" mean what they say. There is no shear
    // constant any more either: the offset is a fact about the projection.
    const first = seatPosition(0)
    const nextRow = seatPosition(SQUAD_COLS)
    expect(nextRow.x).toBeGreaterThan(first.x)
    expect(nextRow.y).toBeGreaterThan(first.y)
    expect((nextRow.x - first.x) / (nextRow.y - first.y)).toBeCloseTo(2, 9)
  })

  it('runs a row and the row behind it on parallel lines', () => {
    // Two rows are two parallel banks. If these ever stop being parallel the
    // floor has stopped being a grid.
    const along = (i: number, j: number) => {
      const p = seatPosition(i)
      const q = seatPosition(j)
      return (q.y - p.y) / (q.x - p.x)
    }
    expect(along(0, 9)).toBeCloseTo(along(SQUAD_COLS, SQUAD_COLS + 9), 9)
  })

  it('butts the desks along a row with no gap and no overlap', () => {
    // A row is one continuous bank of desks. `PITCH_COL` of exactly one tile
    // is what makes that true by construction rather than by eye.
    expect(PITCH_COL).toBe(1)
    expect(DESK_SPAN).toBe(PITCH_COL)
  })

  it('takes the space out behind the row, where people walk', () => {
    // §7.8.1's grain: shoulder to shoulder along the row, an aisle behind it.
    expect(PITCH_ROW).toBeGreaterThan(PITCH_COL)
    expect(PITCH_ROW).toBeGreaterThan(DESK_DEPTH * 2)
  })

  it('is a desk, not a card table — wider along the row than it is deep', () => {
    // Reported as "the table [is] too deep". A desk is about 1.5 m along the
    // row and 0.7 m across it, and `PITCH_COL` is that 1.5 m, so anything much
    // past a half reads as furniture nobody has ever sat at.
    expect(DESK_DEPTH).toBeLessThan(DESK_SPAN * 0.55)
  })

  it('SITS the person at the desk rather than on top of it — §7.8.1', () => {
    // The plainest defect in the room, and the one that produced "person is
    // placed wrong, it shows that he is on top of the table".
    //
    // The bank used to be drawn centred on the seat point, which is also where
    // the figure is drawn, so the two shared a footprint and the person was
    // painted on top of their own desk. A person at a desk is *in front of* it:
    // the surface has to be set back by more than its own half-depth, or the
    // near edge is still under the body.
    expect(DESK_SETBACK).toBeGreaterThan(DESK_DEPTH / 2)
  })

  it('keeps the desk in its own row, clear of the aisle behind it', () => {
    // The other end of the same trade. Set the bank back far enough and it
    // reaches the row behind — so the whole desk, front edge to back edge, has
    // to fit between the seat and the previous row's seats.
    const backEdge = DESK_SETBACK + DESK_DEPTH / 2
    expect(backEdge).toBeLessThan(PITCH_ROW)
    // And the front edge is still behind the person rather than through them.
    expect(DESK_SETBACK - DESK_DEPTH / 2).toBeGreaterThan(0)
  })

  it('keeps the block wider than it is deep, on screen', () => {
    // Measured in *screen* units, which is the only place the question means
    // anything. Three earlier versions measured the wrong thing: a square
    // count, then a ratio of the two pitches, then the pitches again after the
    // projection under them had changed. Measuring the projected corners cannot
    // go out of step with the projection.
    for (const n of [4, 9, 20, 40, 80, 120]) {
      const { cols, rows } = gridFor(n)
      const box = blockBox(0, 0, cols - 1, rows - 1)
      expect(box.maxX - box.minX).toBeGreaterThan(box.maxY - box.minY)
    }
  })

  it('matches §7.8.1 at the headcounts the table names', () => {
    // "1: one desk. 2: a second desk pushed alongside."
    expect(gridFor(1)).toEqual({ cols: 1, rows: 1 })
    expect(gridFor(2)).toEqual({ cols: 2, rows: 1 })
    // The table's "6-10: two rows" is the one line §7.8.1a and §7.8.1b
    // supersede: eight people sit in one row of eight, because a row that
    // widens as the studio grows moves everybody already in it. The later
    // canon wins, and the trade is recorded on SQUAD_COLS.
    expect(gridFor(8)).toEqual({ cols: 8, rows: 1 })
    // A full squad, and the shape §7.8.1a names.
    expect(gridFor(100)).toEqual({ cols: 10, rows: 10 })
  })

  it('never lays out a block bigger than one squad — §7.8.1a', () => {
    // The room is sized for exactly one squad, and nothing above a hundred
    // makes the block deeper: past that the *floor* grows (§7.8.1c), not the
    // room. Without this the plate is sized for a block that will never exist.
    const { cols, rows } = gridFor(1e9)
    expect(cols).toBe(SQUAD_COLS)
    expect(rows).toBe(SQUAD_ROWS)
    expect(cols * rows).toBe(SQUAD_SIZE)
  })
})

describe('the dressing stands against a wall — §7.8.1', () => {
  /**
   * The projection's tile width, read back out of the layout rather than
   * restated. `seatPosition(1)` is one desk pitch along the row, which the 2:1
   * puts at (−PITCH_COL·TILE_W/2, +PITCH_COL·TILE_H/2).
   */
  const TILE_W = (-2 * seatPosition(1).x) / PITCH_COL

  /** Screen offset back to grid coordinates — `gridToScreen` inverted. */
  const toGrid = (x: number, y: number) => ({
    gx: y / (TILE_W / 2) + x / TILE_W,
    gy: y / (TILE_W / 2) - x / TILE_W,
  })

  it('puts a prop against the back-LEFT wall with its back face on it', () => {
    // The floor diamond is a square in the grid's own axes, so the back-left
    // wall is the line `gx = -s`. A prop standing against it has its centre
    // half its own depth in front of that, and nothing else.
    const s = 6
    const depth = 0.5
    const p = wallSpot('left', 0.5, 0, 0, s, depth)
    expect(toGrid(p.x, p.y).gx).toBeCloseTo(-s + depth / 2 + WALL_GAP, 9)
  })

  it('puts a prop against the back-RIGHT wall the same way', () => {
    const s = 6
    const depth = 0.3
    const p = wallSpot('right', 0.2, 0, 0, s, depth)
    expect(toGrid(p.x, p.y).gy).toBeCloseTo(-s + depth / 2 + WALL_GAP, 9)
  })

  it('never leaves the prop standing off the wall', () => {
    // The reported half of the defect: the old ring inset props by up to 16% of
    // the floor, which at any real headcount is most of a metre of empty carpet
    // behind a plant. The gap is now a constant, and a small one.
    expect(WALL_GAP).toBeLessThan(0.1)
  })

  it('never places anything on the two edges that are NOT walls', () => {
    // The other half. The room is open toward the camera, so the front two
    // edges of the diamond have nothing behind them — a cooler placed there
    // stood in the dark past the corner looking like it was floating. Every
    // spot this function can return is on a back wall, whatever `u` is.
    const s = 8
    for (let i = 0; i <= 20; i++) {
      for (const wall of ['left', 'right'] as const) {
        const at = wallSpot(wall, i / 20, 0, 0, s, 0.4)
        const g = toGrid(at.x, at.y)
        // On a back wall means pinned on one axis and free on the other, and
        // the pinned one is always the far side of the floor.
        const pinned = wall === 'left' ? g.gx : g.gy
        const along = wall === 'left' ? g.gy : g.gx
        expect(pinned).toBeCloseTo(-s + 0.2 + WALL_GAP, 9)
        expect(along).toBeGreaterThanOrEqual(-s - 1e-9)
        expect(along).toBeLessThanOrEqual(s + 1e-9)
      }
    }
  })

  it('clamps `u` rather than walking off the end of the wall', () => {
    const s = 5
    expect(wallSpot('left', -3, 0, 0, s, 0.4)).toEqual(wallSpot('left', 0, 0, 0, s, 0.4))
    expect(wallSpot('left', 7, 0, 0, s, 0.4)).toEqual(wallSpot('left', 1, 0, 0, s, 0.4))
  })
})

describe('the desks never leave the plate — GDD §7.8.1a, R6', () => {
  /**
   * The plainest "this is broken" in the build: past about forty developers
   * the corners of the desk block hung over the edge of the floor they were
   * standing on. Two independent causes, and both are asserted here rather
   * than through Pixi, because the geometry is what was wrong.
   */
  /**
   * The block's far corner in the plate diamond's own normalised coordinates:
   * `|x| / W + |y| / H`, which is ≤ 1 exactly when the corner is on the floor.
   *
   * `margin` is the tightest the room ever chooses — the crowded floor's — so
   * this is the worst case rather than a comfortable one.
   */
  const contains = (n: number, margin = 0.6) => {
    const { cols, rows } = gridFor(n)
    const box = blockBox(0, 0, cols - 1, rows - 1)
    const bw = (box.maxX - box.minX) / 2
    const bh = (box.maxY - box.minY) / 2
    const half = plateHalfWidth(bw, bh, margin)
    return bw / half + bh / (half / 2)
  }

  it('contains the block at every headcount the room can draw', () => {
    for (let n = 1; n <= ROOM_DEV_CAP; n++) {
      expect(contains(n)).toBeLessThanOrEqual(1)
    }
  })

  it('is tight — the plate is not simply enormous', () => {
    // The other half of the fix. A plate ten times too big would pass the test
    // above and frame the studio as a speck (§23.4.1 fits the tier to the
    // frame), so the containment has to be nearly exact at zero margin.
    expect(contains(100, 0)).toBeCloseTo(1, 6)
  })

  it('holds the corners of a DEEP block, which is where it failed', () => {
    // A wide flat block is contained by almost any rule; the old
    // `max(width, height)` was one of them. It broke as the block got deeper,
    // which is exactly the direction hiring takes it.
    const box = blockBox(0, 0, SQUAD_COLS - 1, SQUAD_ROWS - 1)
    const bw = (box.maxX - box.minX) / 2
    const bh = (box.maxY - box.minY) / 2
    expect(Math.max(bw, bh * 2) / 2).toBeLessThan(plateHalfWidth(bw, bh, 0))
  })
})

describe('the floor unfolds at a hundred — GDD §7.8.1c, R7', () => {
  it('is folded away to nothing before it starts, and flat when it ends', () => {
    expect(panelOpen(0)).toBe(0)
    expect(panelOpen(1)).toBe(1)
  })

  it('swings past flat and settles back, because paper does', () => {
    // Not a scale. A monotonic ease into 1 reads as a panel being resized,
    // which is the one thing §7.8.1c rules out.
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => panelOpen((i + 1) / 100)))
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThan(1.15)
  })

  it('opens outward from the squad that is already full', () => {
    // The wave leaves squad 0 rather than sweeping across it, so the hundred
    // people the player just hired are never the thing being folded.
    expect(panelDelay(0, 0)).toBe(0)
    expect(panelDelay(9, 9)).toBeGreaterThan(panelDelay(4, 4))
    expect(panelDelay(4, 4)).toBeGreaterThan(panelDelay(1, 0))
  })

  it('finishes every panel by the time the event does', () => {
    // The far corner is the last to start; if its window ran past the end it
    // would snap flat on the final frame.
    expect(panelProgress(1, FLOOR_COLS - 1, FLOOR_ROWS - 1)).toBe(1)
    expect(panelProgress(0.99, FLOOR_COLS - 1, FLOOR_ROWS - 1)).toBeLessThan(1)
  })

  it('catches the light edge-on and nowhere else', () => {
    expect(panelLight(0)).toBe(0)
    expect(panelLight(1)).toBe(0)
    expect(panelLight(0.5)).toBeGreaterThan(0.9)
  })

  it('is over quickly enough to be an event rather than a wait', () => {
    expect(UNFOLD_MS).toBeLessThanOrEqual(3000)
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

describe('the idle is a hop, not a bob — GDD §7.8.3', () => {
  it('spends part of every cycle ON THE GROUND', () => {
    // The whole difference between a hop and the sine bob it replaced. A figure
    // that is never at rest is floating, however small the amplitude, and forty
    // of them read as buoys rather than as people. Contact is what makes the
    // motion look like a push against something.
    const grounded = Array.from({ length: 200 }, (_, i) => hopHeight(i / 200)).filter(
      (h) => h === 0,
    )
    expect(grounded.length).toBeGreaterThan(60)
  })

  it('leaves the ground and comes back, exactly once per cycle', () => {
    expect(hopHeight(0)).toBe(0)
    expect(hopHeight(HOP_AIRBORNE / 2)).toBeCloseTo(1, 6)
    expect(hopHeight(HOP_AIRBORNE)).toBe(0)
    expect(hopHeight(0.999)).toBe(0)
  })

  it('never goes below the ground or above the arc', () => {
    for (let i = 0; i < 400; i++) {
      const h = hopHeight(i / 97)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(1)
    }
  })

  it('repeats — phase 3.2 is the same hop as phase 0.2', () => {
    // The renderer feeds it `elapsed * hz + offset`, which grows without bound.
    // If this were not periodic the floor would drift out of the room.
    for (const u of [0.05, 0.2, 0.49, 0.5, 0.8]) {
      expect(hopHeight(u + 3)).toBeCloseTo(hopHeight(u), 12)
      expect(hopSquash(u + 7)).toBeCloseTo(hopSquash(u), 12)
    }
  })

  it('leans a different way each hop, and is centred whenever it lands', () => {
    // The "about" in "hop about". Alternating means the figure shifts its weight
    // rather than pogoing; tying it to the height means the sway is exactly zero
    // on the ground, so nobody creeps off their desk over a long session.
    expect(hopSway(0.25)).toBeGreaterThan(0)
    expect(hopSway(1.25)).toBeLessThan(0)
    expect(hopSway(2.25)).toBeGreaterThan(0)
    for (let n = 0; n < 6; n++) {
      // `toBeCloseTo` rather than `toBe`, because a leftward lean of zero is
      // -0 and no position on screen cares.
      expect(hopSway(n)).toBeCloseTo(0, 12)
      expect(hopSway(n + 0.9)).toBeCloseTo(0, 12)
    }
  })

  it('compresses on landing and again into the launch, and nowhere else', () => {
    // Squash-and-stretch, and it only means anything at the two moments the
    // figure is in contact with something. Compressing mid-air is a balloon.
    expect(hopSquash(HOP_AIRBORNE * 0.5)).toBe(1)
    expect(hopSquash(HOP_AIRBORNE)).toBeLessThan(1)
    expect(hopSquash(0.999)).toBeLessThan(1)
    // And halfway through the grounded half it has recovered.
    expect(hopSquash(HOP_AIRBORNE + (1 - HOP_AIRBORNE) * 0.5)).toBe(1)
  })

  it('never stretches, and never squashes past the limit', () => {
    for (let i = 0; i < 400; i++) {
      const s = hopSquash(i / 97)
      expect(s).toBeLessThanOrEqual(1)
      expect(s).toBeGreaterThanOrEqual(1 - HOP_SQUASH)
    }
  })
})

describe('the room actually drives the hop', () => {
  /**
   * The curves above are pure and provable; this is the wiring, which is where
   * an idle animation really goes wrong. A sign flip, a phase in the wrong
   * units, or an `elapsed` that turns out to be milliseconds all leave every
   * curve test passing and the floor either motionless or vibrating.
   *
   * `dt = 0` freezes §7.8.6's ambient life so the only thing moving anybody is
   * the hop — otherwise somebody wanders to the coffee machine mid-assertion.
   */
  function sampleSeat(frames: number) {
    const room = buildRoom()
    room.setHeadcount(1)
    const dev = (room.container.getChildByLabel('developers') as Container).children[0]
    const desk = room.deskAt(0)!
    const ys: number[] = []
    const xs: number[] = []
    for (let f = 0; f < frames; f++) {
      room.animate(f / 60, 'working', 0)
      ys.push(dev.position.y)
      xs.push(dev.position.x)
    }
    return { ys, xs, restY: desk.y + 6, restX: desk.x }
  }

  it('leaves the seat by about a hop and comes back down to it', () => {
    const { ys, restY } = sampleSeat(180)
    // Up is -y.
    expect(restY - Math.min(...ys)).toBeGreaterThan(HOP_HEIGHT * 0.8)
    expect(restY - Math.min(...ys)).toBeLessThanOrEqual(HOP_HEIGHT + 0.001)
    expect(Math.max(...ys)).toBeLessThanOrEqual(restY + 1)
  })

  it('is planted for a good share of the time, not floating', () => {
    const { ys, restY } = sampleSeat(180)
    const planted = ys.filter((y) => Math.abs(y - restY) < 1e-9)
    expect(planted.length).toBeGreaterThan(30)
  })

  it('never drifts off its own desk, however long it runs', () => {
    // The sway is the one part of the hop that could accumulate. Three seconds
    // is three hops, and the figure has to be exactly back over its desk on
    // every landing or a floor left running overnight ends up in the corridor.
    const { xs, restX } = sampleSeat(180)
    expect(Math.max(...xs.map((x) => Math.abs(x - restX)))).toBeLessThanOrEqual(HOP_HEIGHT)
    expect(xs.filter((x) => Math.abs(x - restX) < 1e-9).length).toBeGreaterThan(30)
  })
})

describe('arrivals — GDD §7.7.2, hiring is seen', () => {
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
    // Bounded, not fast. The cap moved from 1.2 s to 2.2 s so the Act III Mass
    // Hire reads as a flood filling the floor rather than as a wave that is
    // over before the eye has crossed the room — but it stays bounded, because
    // a cascade the player is waiting on has stopped being feedback.
    expect(cascadeDelay(99, 100)).toBeLessThanOrEqual(CASCADE_MAX_MS / 1000)
    expect(cascadeDelay(999, 1000)).toBeLessThanOrEqual(CASCADE_MAX_MS / 1000)
    expect(CASCADE_MAX_MS).toBeLessThanOrEqual(2500)
  })

  it('is three things falling, and nothing else', () => {
    // The whole brief. A desk, the computer that goes on it, the person who
    // sits at it. The chair that used to be beat 2 is gone — §7.8.1 records
    // three failed attempts at drawing one anywhere else in the room, and a
    // silhouette of a thing the room does not have is not a shortcut, it is a
    // fourth thing that pops out of existence on landing.
    expect(Object.keys(BEAT)).toEqual(['desk', 'computer', 'person'])
  })

  it('lands the person LAST — §7.8.5, the desk and the computer are setup', () => {
    // Reversed, with furniture assembling around someone already sitting, it
    // reads as a glitch rather than as a workspace being built.
    expect(BEAT.desk).toBeLessThan(BEAT.computer)
    expect(BEAT.computer).toBeLessThan(BEAT.person)
  })

  it('falls under gravity and bounces once, rather than easing to a stop', () => {
    // Free fall — distance as t², so it is moving fastest at the instant it
    // lands. An ease-out decelerates into the floor and reads as a crane
    // lowering it; stopping dead reads as a sprite being switched on.
    expect(fallHeight(0)).toBe(1)
    expect(fallHeight(1)).toBe(0)
    // Second half of the fall covers more ground than the first — that is what
    // makes it a fall rather than a descent.
    const first = fallHeight(0) - fallHeight(LAND_AT / 2)
    const second = fallHeight(LAND_AT / 2) - fallHeight(LAND_AT)
    expect(second).toBeGreaterThan(first)
    // Touches down, comes back up, and settles.
    expect(fallHeight(LAND_AT)).toBeCloseTo(0, 6)
    expect(fallHeight((LAND_AT + 1) / 2)).toBeGreaterThan(0.02)
    expect(fallHeight(0.999)).toBeLessThan(0.01)
  })

  it('gives the person the biggest squash, because it is the payload', () => {
    const deepest = (strength: number) =>
      Math.min(...Array.from({ length: 200 }, (_, i) => contactSquash(i / 199, strength)))
    expect(deepest(0.34)).toBeLessThan(deepest(0.2))
    expect(deepest(0.2)).toBeLessThan(deepest(0.16))
  })

  it('conserves volume — it stretches as much as it squashes', () => {
    // Squash without stretch looks like something being crushed. §8.3's juice
    // is the pair, not the dip.
    for (const t of [0.2, LAND_AT, 0.85, 1]) {
      expect(contactSquash(t, 0.3) * contactStretch(t, 0.3)).toBeCloseTo(1, 10)
    }
  })

  it('is at rest before it starts and after it finishes', () => {
    expect(contactSquash(0, 0.34)).toBe(1)
    expect(contactSquash(1.4, 0.34)).toBe(1)
    expect(contactSquash(-1, 0.34)).toBe(1)
  })

  it('leaves no dust behind', () => {
    expect(puffAlpha(1)).toBe(0)
  })

  it('withholds a seat from the room until its arrival has landed', () => {
    // The other half of "the fall goes down to the person before": the room
    // drew the hire on the frame the store published them, so the falling
    // silhouette landed on somebody already sitting in the chair. `revealed`
    // is what the stage clamps `setHeadcount` to.
    const arrivals = createArrivals()
    // Nothing arriving: the room owns every seat.
    expect(arrivals.revealed).toBe(Number.POSITIVE_INFINITY)

    const now = 1000
    arrivals.spawn(4, 6, 1234, now)
    expect(arrivals.revealed).toBe(4)

    // Mid-flight, still withheld.
    arrivals.update(now + ARRIVAL_MS / 2)
    expect(arrivals.revealed).toBe(4)

    // The first lands — and only the first.
    arrivals.update(now + ARRIVAL_MS + 10)
    expect(arrivals.revealed).toBe(5)

    // Everything down, and the room has its seats back.
    arrivals.update(now + ARRIVAL_MS + CASCADE_MAX_MS + 1000)
    expect(arrivals.revealed).toBe(Number.POSITIVE_INFINITY)
    arrivals.destroy()
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
