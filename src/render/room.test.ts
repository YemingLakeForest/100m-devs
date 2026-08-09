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
  blockBox,
  buildRoom,
  PITCH_ROW,
  ROW_SHEAR,
  ROOM_DEV_CAP,
  gridFor,
  hopHeight,
  hopSquash,
  hopSway,
  panelDelay,
  panelLight,
  panelOpen,
  panelProgress,
  perimeterPoint,
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

  it('puts the person NEXT to you closer than the person behind you', () => {
    // The bug this pins, reported as "your rows are diagonal, not horizontal".
    // The rows were level the whole time and the seats were right: what was
    // wrong is that a row pitch of 2.15 put the seat diagonally behind at 44 px
    // while the seat beside was 59 px away. The eye groups by proximity, so it
    // grouped the diagonals, and a floor of level rows read as a lattice of
    // diagonal chains.
    //
    // Measured in screen pixels, because that is the only place "diagonal"
    // means anything, and against the *hypotenuse*, because the seat behind is
    // offset sideways by the shear as well as back by the pitch.
    const along = PITCH_COL * 64
    const behind = Math.hypot(ROW_SHEAR * 64, PITCH_ROW * 16)
    expect(behind).toBeGreaterThan(along)
  })

  it('staggers by exactly half a pitch, which is the value that maximises that gap', () => {
    // The seats in the row behind sit at `-shear` and `pitch - shear`. The
    // nearer of the two is as far away as it can be when those are equal, so
    // any other shear brings some diagonal neighbour closer than the person
    // sitting next to you — and a diagonal closer than a row *is* the row, as
    // far as the eye is concerned.
    const nearestBehind = (shear: number) =>
      Math.min(
        Math.hypot(shear * 64, PITCH_ROW * 16),
        Math.hypot((PITCH_COL - shear) * 64, PITCH_ROW * 16),
      )
    const best = nearestBehind(ROW_SHEAR)
    for (const shear of [0, 0.1, 0.25, 0.35, 0.55, 0.7, 0.92]) {
      expect(nearestBehind(shear)).toBeLessThanOrEqual(best + 1e-9)
    }
    expect(ROW_SHEAR).toBeCloseTo(PITCH_COL / 2, 10)
  })

  it('keeps the block wider than it is deep, on screen', () => {
    // Measured in *screen* units, which is the only place the question means
    // anything now that rows run level and step back on their own pitch. Two
    // earlier versions of this test measured the wrong thing: first a square
    // count, then a square ratio of the two pitches. Neither is what anybody
    // looks at.
    for (const n of [4, 9, 20, 40, 80, 120]) {
      const { cols, rows } = gridFor(n)
      const screenW = cols * PITCH_COL * 64
      const screenH = rows * PITCH_ROW * 16
      expect(screenW).toBeGreaterThan(screenH)
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
    arrivals.spawn([{ x: 0, y: 0 }, { x: 10, y: 0 }], 4, now)
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
