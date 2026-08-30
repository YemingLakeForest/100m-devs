import { describe, expect, it } from 'vitest'
import {
  Lens,
  SETTLE_DELAY_MS,
  SETTLE_INTENT,
  anchorCentre,
  panBounds,
  panRange,
  settleLevel,
  settleTowards,
} from './lens.ts'
import {
  BLOCK,
  BLOCKS_PER_PARK,
  BUILDING,
  DESK,
  FLOOR,
  BUILDINGS_PER_BLOCK,
  FLOORS_PER_BUILDING,
  SQUAD,
  seatOfBlock,
  fitScaleFor,
  floorFrame,
  floorToPark,
  GALAXY,
  GLOBE,
  globeToGalaxy,
  intoGalaxy,
  intoGlobe,
  parkToGlobe,
  floorScaleAt,
  intoPlate,
  PARK,
  intoParcel,
  intoPlot,
  roomResolved,
} from './frames.ts'
import { maxZoomFor } from '../sim/headcount.ts'

const REFERENCE = { w: 997, h: 448 }

/** Run the camera forward at 60 fps until it stops moving, or give up. */
function settle(lens: Lens, seconds = 4): number {
  let now = 10_000
  const dt = 1 / 60
  for (let i = 0; i < seconds * 60; i++) {
    now += dt * 1000
    lens.update(dt, now)
  }
  return now
}

/**
 * A hand on the wheel: `n` notches, a frame apart, then let go.
 *
 * Positive is *out*, the way a mouse wheel is: the browser sends `deltaY`
 * away from the user and `stage.ts` turns it into a factor below one. 1.212
 * is one notch of a real wheel — `exp(120 * 0.0016)`.
 */
function spin(lens: Lens, notches: number, per = 1.212, from = 1_000): number {
  let now = from
  for (let i = 0; i < Math.abs(notches); i++) {
    lens.zoomBy(notches > 0 ? 1 / per : per, null, now)
    lens.update(1 / 60, now)
    now += 1000 / 60
  }
  lens.update(1 / 60, now + SETTLE_DELAY_MS + 20)
  return settle(lens)
}

function make(storeys = FLOORS_PER_BUILDING, seat = 0): Lens {
  const lens = new Lens(REFERENCE)
  lens.setAddress(seat, storeys)
  lens.reframe(BUILDING, true)
  return lens
}

describe('where the camera starts', () => {
  it('opens among the people, not on the building', () => {
    // The building is the one level of the four with nobody on it: past a
    // second storey the pulled-out plan drops under the room's resolve scale
    // and the floor is not drawn at all. Resting there opens the game on an
    // empty tower with §7.8.10's corner desk nowhere on the frame — which is
    // exactly what `test:walk` found, by sweeping five hundred taps looking
    // for a founder the camera had left behind while payroll ran.
    const lens = new Lens(REFERENCE)
    lens.setAddress(0, FLOORS_PER_BUILDING)
    expect(lens.level).toBeCloseTo(FLOOR, 6)
    expect(roomResolved(floorScaleAt(lens.scale))).toBe(true)
  })

  it('goes to the whole building when it is sent there', () => {
    const lens = make()
    expect(lens.level).toBeCloseTo(BUILDING, 6)
  })

  it('reports the simulation Z the store and the score already read', () => {
    const lens = make()
    expect(lens.z).toBeCloseTo(3 / 9, 6)
    lens.reframe(DESK, true)
    expect(lens.z).toBeCloseTo(0, 6)
  })
})

describe('commanded flight', () => {
  it('arrives at the level it was sent to', () => {
    const lens = make()
    lens.reframe(FLOOR)
    settle(lens)
    expect(lens.level).toBeCloseTo(FLOOR, 3)
    expect(lens.settling).toBe(false)
  })

  it('arrives centred on the frame it named', () => {
    const lens = make(FLOORS_PER_BUILDING, 7_450)
    lens.reframe(SQUAD)
    settle(lens)
    const frame = lens.frameOf(SQUAD)
    expect(lens.centre.cx).toBeCloseTo(frame.cx, 1)
    expect(lens.centre.cy).toBeCloseTo(frame.cy, 1)
  })

  it('resolves the room by the time it reaches the floor', () => {
    const lens = make()
    lens.reframe(FLOOR)
    settle(lens)
    expect(roomResolved(floorScaleAt(lens.scale))).toBe(true)
  })

  it('does not resolve the room while the building is the subject', () => {
    const lens = make()
    expect(roomResolved(floorScaleAt(lens.scale))).toBe(false)
  })
})

describe('the magnetic stop', () => {
  it('never leaves the camera between two levels', () => {
    // The whole reason it exists: a lens parked half way between a floor and a
    // building is showing neither.
    for (const factor of [1.4, 2.2, 3.4, 5.5, 9]) {
      const lens = make()
      lens.zoomBy(factor, null, 1000)
      lens.update(1 / 60, 1000 + SETTLE_DELAY_MS + 20)
      settle(lens)
      expect(lens.level).toBeCloseTo(Math.round(lens.level), 3)
    }
  })

  it('settles to the nearest level, not always to the same one', () => {
    const nudged = (factor: number) => {
      const lens = make()
      lens.zoomBy(factor, null, 1000)
      lens.update(1 / 60, 1000 + SETTLE_DELAY_MS + 20)
      settle(lens)
      return Math.round(lens.level)
    }
    expect(nudged(1.2)).toBe(BUILDING)
    expect(nudged(3)).toBe(FLOOR)
    expect(nudged(12)).toBe(SQUAD)
    expect(nudged(40)).toBe(DESK)
  })

  it('waits for the gesture to finish before it settles', () => {
    const lens = make()
    lens.zoomBy(2, null, 1000)
    const before = lens.scale
    // Still inside the window, and still arriving in bursts: hands off.
    lens.update(1 / 60, 1000 + 40)
    lens.zoomBy(1.2, null, 1000 + 40)
    lens.update(1 / 60, 1000 + 80)
    expect(lens.scale).toBeGreaterThan(before)
    expect(lens.settling).toBe(false)
  })
})

describe('zooming about a point', () => {
  it('holds the world point under the focal pixel still', () => {
    const focal = { x: 720, y: 120 }
    const before = { cx: 40, cy: -300 }
    const from = 0.6
    const to = 1.9
    const after = anchorCentre(before, from, to, focal, REFERENCE)
    const worldBefore = {
      x: before.cx + (focal.x - REFERENCE.w / 2) / from,
      y: before.cy + (focal.y - REFERENCE.h / 2) / from,
    }
    const worldAfter = {
      x: after.cx + (focal.x - REFERENCE.w / 2) / to,
      y: after.cy + (focal.y - REFERENCE.h / 2) / to,
    }
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9)
  })

  it('cannot be zoomed out past the building or in past the desk', () => {
    const lens = make()
    lens.zoomBy(1 / 1000, null, 1000)
    lens.update(1 / 60, 1000)
    expect(lens.level).toBeCloseTo(BUILDING, 1)

    lens.zoomBy(100_000, null, 2000)
    lens.update(1 / 60, 2000)
    expect(lens.level).toBeLessThan(0.6)
  })
})

describe('panning', () => {
  it('a subject that fits does not slide around', () => {
    const bounds = intoPlate(floorFrame(), 0)
    const fits = fitScaleFor(bounds, REFERENCE)
    const range = panRange(bounds, fits, REFERENCE)
    // The fit leaves a margin, so the frame is a little smaller than the
    // viewport on its binding axis and the range there is zero.
    expect(Math.min(range.x, range.y)).toBeCloseTo(0, 6)
  })

  it('there is somewhere to drag once you are inside a floor', () => {
    const lens = make()
    lens.reframe(SQUAD)
    settle(lens)
    const range = panRange(panBounds(lens.level, 0, 1), lens.scale, REFERENCE)
    expect(range.x).toBeGreaterThan(0)
    expect(range.y).toBeGreaterThan(0)
  })

  it('cannot drag the floor off the screen', () => {
    const lens = make()
    lens.reframe(SQUAD)
    settle(lens)
    lens.panBy(-100_000, -100_000, 20_000)
    lens.update(1 / 60, 20_000)
    const bounds = panBounds(lens.level, 0, FLOORS_PER_BUILDING)
    expect(lens.centre.cx).toBeLessThanOrEqual(bounds.cx + bounds.w / 2 + 1e-6)
    expect(lens.centre.cy).toBeLessThanOrEqual(bounds.cy + bounds.h / 2 + 1e-6)
  })

  it('roams the floor below it and the building above it', () => {
    expect(panBounds(SQUAD, 0, 10).w).toBeLessThan(panBounds(BUILDING, 0, 10).w)
  })
})

describe('the park, one rung further out', () => {
  /** A studio of a million: ten full blocks, a hundred full buildings. */
  const millions = (seat = 0) => {
    const lens = new Lens(REFERENCE)
    lens.setAddress(seat, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
    lens.setCeiling(PARK)
    lens.reframe(PARK, true)
    settle(lens)
    return lens
  }

  it('is reachable once the studio has earned it, and not before', () => {
    const lens = millions()
    expect(settleLevel(lens.level)).toBe(PARK)

    // §7.7.1 — a studio with one block has no park to look at, and the ceiling
    // is what says so. `maxZoomFor` returns rung 4 below a hundred thousand.
    const smaller = new Lens(REFERENCE)
    smaller.setAddress(0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
    smaller.setCeiling(maxZoomFor(50_000) * 9)
    smaller.reframe(PARK, true)
    settle(smaller)
    expect(settleLevel(smaller.level)).toBe(BLOCK)
  })

  it('walks the whole six-rung ladder on the wheel alone', () => {
    // The row that matters most now that no tap changes the level: every rung
    // has to be reachable by pinching, and the park added one to reach.
    const lens = millions()
    const seen = [settleLevel(lens.level)]
    for (let i = 0; i < 5; i++) {
      spin(lens, -4)
      settle(lens)
      seen.push(settleLevel(lens.level))
    }
    expect(seen).toEqual([PARK, BLOCK, BUILDING, FLOOR, SQUAD, DESK])
  })

  it('roams the block below it and the park above it', () => {
    const args = [0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK] as const
    expect(panBounds(BLOCK, ...args).w).toBeLessThan(panBounds(PARK, ...args).w)
  })

  it('does not slide around, because the park fits the frame', () => {
    // `panRange`'s rule from the start, at the top of the ladder: every level is
    // fitted to its subject by definition, so there is nowhere for a drag to go.
    const lens = millions()
    const before = { ...lens.centre }
    lens.panBy(-400, -400, 20_000)
    settle(lens)
    expect(lens.centre.cx).toBeCloseTo(before.cx, 6)
    expect(lens.centre.cy).toBeCloseTo(before.cy, 6)
  })

  it('follows the address into another block without changing how close in it is', () => {
    // The same promise `setAddress` already made about storeys and buildings,
    // one rung out: a new block moves the frames further than either, because
    // every level below the park is authored inside a parcel.
    const lens = millions()
    lens.reframe(BLOCK)
    settle(lens)
    const scale = lens.scale
    const before = { ...lens.centre }
    lens.setAddress(seatOfBlock(7, 0, 0), FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
    settle(lens)
    expect(lens.scale).toBeCloseTo(scale, 4)
    // And it *did* move — a parcel eight blocks along is a long way from parcel
    // one, and a camera that stayed put would be framing somebody else's block.
    expect(Math.hypot(lens.centre.cx - before.cx, lens.centre.cy - before.cy)).toBeGreaterThan(100)
  })
})

describe('the address', () => {
  it('following a new storey keeps the camera at the same distance', () => {
    const lens = make()
    lens.reframe(FLOOR)
    settle(lens)
    const scale = lens.scale
    lens.setAddress(6_200, FLOORS_PER_BUILDING)
    lens.update(1 / 60, 30_000)
    expect(lens.scale).toBeCloseTo(scale, 4)
  })

  it('changing storey does not move the frame', () => {
    // The plan is pulled out into the *same slot* whichever floor is open, so
    // choosing another one slides the contents rather than the camera. The
    // first composition moved the plate with the floor, and picking your way
    // up a building lurched the frame sideways ten times.
    const lens = make()
    lens.reframe(FLOOR)
    settle(lens)
    const before = { ...lens.centre, scale: lens.scale }
    lens.setAddress(6_200, FLOORS_PER_BUILDING)
    settle(lens)
    expect(lens.centre.cx).toBeCloseTo(before.cx, 6)
    expect(lens.centre.cy).toBeCloseTo(before.cy, 6)
    expect(lens.scale).toBeCloseTo(before.scale, 6)
  })
})

describe('a gesture arrives where it was going', () => {
  /*
   * **The clunkiness, and it was one call to `Math.round`.**
   *
   * Nearest-level settling means a pinch has to travel more than *half a level
   * in log space* — a factor of about 1.8 — before it lands anywhere new.
   * Anything less and the magnetic stop hauls the camera back to where it
   * started, so a deliberate, visible zoom is silently undone. Reported as "the
   * zoom in got reversed forcibly back", which is exactly what it was.
   */
  it('moves at least one level once the gesture means something', () => {
    // Zooming in is a *decrease*: Desk is 0 and Building is 3.
    expect(settleTowards(2.8, 3)).toBe(FLOOR)
    expect(settleTowards(2.6, 3)).toBe(FLOOR)
    // And out, the same distance the other way.
    expect(settleTowards(1.25, 1)).toBe(FLOOR)
    expect(settleTowards(2.25, 2)).toBe(BUILDING)
  })

  it('leaves a nudge alone', () => {
    // A stray wheel notch or a two-finger wobble is not a decision.
    expect(settleTowards(3 - SETTLE_INTENT / 2, 3)).toBe(BUILDING)
    expect(settleTowards(1 + SETTLE_INTENT / 2, 1)).toBe(SQUAD)
    expect(settleTowards(1 - SETTLE_INTENT / 2, 1)).toBe(SQUAD)
  })

  it('lets a long gesture keep everything it earned', () => {
    // One level is the floor, not the ceiling. A shove that crosses two levels
    // arrives two levels away rather than being held to the first.
    expect(settleTowards(0.3, 3)).toBe(DESK)
    expect(settleTowards(1.1, 3)).toBe(SQUAD)
    expect(settleTowards(3, 0.2)).toBe(BUILDING)
  })

  it('stays on the ladder at both ends', () => {
    expect(settleTowards(-2, 0)).toBe(DESK)
    expect(settleTowards(9, 4)).toBe(GALAXY)
  })

  it('falls back to nearest when nothing started the gesture', () => {
    expect(settleTowards(2.4, null)).toBe(settleLevel(2.4))
    expect(settleTowards(2.6, null)).toBe(settleLevel(2.6))
  })

  it('carries that through the camera: a small pinch in still arrives', () => {
    // The end-to-end version of the complaint. 1.6x is well short of the 1.8x
    // that nearest-level settling demanded, and it used to spring back.
    const lens = make()
    lens.reframe(BUILDING, true)
    lens.zoomBy(1.6, null, 1000)
    lens.update(1 / 60, 1000 + SETTLE_DELAY_MS + 20)
    settle(lens)
    expect(lens.level).toBeCloseTo(FLOOR, 3)
  })

  it('and a small pinch out arrives too', () => {
    const lens = make(FLOORS_PER_BUILDING, 4_200)
    lens.reframe(SQUAD, true)
    lens.zoomBy(1 / 1.6, null, 1000)
    lens.update(1 / 60, 1000 + SETTLE_DELAY_MS + 20)
    settle(lens)
    expect(lens.level).toBeCloseTo(FLOOR, 3)
  })

  it('measures a pinch that interrupts a flight from where the camera is', () => {
    // `parked` during a commanded flight is the *destination*, so measuring
    // from it would score a pinch against a level the camera has not reached —
    // fingers moving inward, arithmetic reading outward, and the camera
    // arriving one level further out than the gesture asked for. The player
    // sees where the camera is, not where it was going.
    const lens = make()
    lens.reframe(FLOOR)
    // Part way through the flight, and still moving.
    for (let i = 0; i < 6; i++) lens.update(1 / 60, 10_000 + i * 16)
    expect(lens.settling).toBe(true)
    expect(lens.level).toBeGreaterThan(FLOOR)
    lens.zoomBy(1.6, null, 11_000)
    lens.update(1 / 60, 11_000 + SETTLE_DELAY_MS + 20)
    settle(lens)
    expect(lens.level).toBeCloseTo(FLOOR, 3)
  })
})

describe("§7.7.1's ceiling", () => {
  /**
   * §7.8.1's garage at one developer, measured on the reference frame.
   *
   * 730 x 448 of floor space, which through the plate fits at 9.86 — smaller
   * than the squad that is meant to contain it, and the reason the ladder has
   * to be told to nest. By ten developers the walls have pushed out past a
   * squad and the crossing is gone, so the whole of this is about the opening
   * minutes of a new game.
   */
  const GARAGE = { cx: 0, cy: -56.83, w: 729.76, h: 448.37 }
  /** The garage where the camera actually sees it: plate, plot, parcel. */
  // `Lens.roomFrame`'s chain, and it has to stay its mirror image: the room's
  // rectangle carried out through the plate, the plot, the parcel and now the
  // site. When the globe arrived this was the one line in the file that had to
  // move, which is the same claim `roomFrame`'s own note makes about itself.
  const garageFrame = () =>
    intoGalaxy(intoGlobe(intoParcel(intoPlot(intoPlate(GARAGE, 0), 0), 0)))

  /** A studio of one: the garage, one storey, and the ceiling it has earned. */
  function newGame(): Lens {
    const lens = new Lens(REFERENCE)
    lens.setAddress(0, 1)
    lens.setFloorRect(GARAGE)
    lens.setCeiling(maxZoomFor(1) * 9)
    lens.update(1 / 60, 0)
    return lens
  }

  it('lets a new game zoom out and come back', () => {
    /*
     * **The bug, end to end.** Reported as "when there's only me on a new
     * game, when I zoomed out, I can't zoom back in", and it was two things
     * meeting: the garage crossed the ladder's rungs (see `nestScales`), and
     * the ceiling was held from outside the lens as `if (camera.z > ceiling)
     * camera.set(ceiling)` once a frame. With the rungs crossed that assertion
     * reported a level above the ceiling for the very scale it had just
     * asserted, so it fired again on the next frame and every frame after —
     * and each firing threw away the gesture. Measured in a browser: thirty
     * wheel notches, in and out, moved the camera from 8.42048 to 8.42048.
     */
    const lens = newGame()
    spin(lens, 10)
    const out = lens.scale
    expect(lens.level).toBeCloseTo(SQUAD, 3)

    spin(lens, -10, 1.212, 20_000)
    expect(lens.scale).toBeGreaterThan(out * 2)
    expect(lens.level).toBeCloseTo(DESK, 3)
  })

  it('nests the ladder rather than letting the garage cross it', () => {
    const scales = newGame().scales()
    expect(scales[DESK]).toBeGreaterThanOrEqual(scales[SQUAD])
    expect(scales[SQUAD]).toBeGreaterThanOrEqual(scales[FLOOR])
    expect(scales[FLOOR]).toBeGreaterThanOrEqual(scales[BUILDING])
    // And the outermost rung the player may reach frames the room they are
    // sitting in — which is what the garage rectangle was for.
    expect(scales[SQUAD]).toBeCloseTo(fitScaleFor(garageFrame(), REFERENCE), 5)
  })

  it('stops the zoom at the ceiling instead of past it', () => {
    const lens = newGame()
    const stop = lens.scales()[SQUAD]
    // A shove far bigger than the ladder has room for.
    spin(lens, 30)
    expect(lens.scale).toBeCloseTo(stop, 5)
    expect(lens.level).toBeCloseTo(SQUAD, 3)
  })

  it('will not settle past it either', () => {
    // `settleTowards` promises a gesture at least one level in the direction
    // it was going. Outward, at a ceiling, that promise runs off the end of
    // the studio the player has built.
    const lens = newGame()
    lens.reframe(DESK, true)
    spin(lens, 12)
    expect(lens.level).toBeCloseTo(SQUAD, 3)
  })

  it('is a stop, never a place between two', () => {
    // It arrives as a Z on §7.2's ten-rung ladder and is read back as a level
    // by one multiplication, and a rung has to survive that round trip: a
    // ceiling of 0.9 is not "nine tenths of the way to the squad", it is a
    // studio that may see its squad.
    expect(maxZoomFor(1) * 9).toBe(SQUAD)
    for (const asked of [SQUAD, 0.9, 1.4]) {
      const lens = newGame()
      lens.setCeiling(asked)
      spin(lens, 10)
      expect(lens.level).toBeCloseTo(SQUAD, 3)
    }
  })

  it('does not clamp a Z against a ceiling the studio has already outgrown', () => {
    /*
     * **The ceiling arrives a frame after the headcount that earned it.**
     *
     * Everything that changes how big the studio is — the scenario bar, `?z`,
     * the §23.3 bench — sets the store and the camera in the same breath, and
     * the ceiling is derived from the store *by the ticker*, on the next frame.
     * So a `set` that clamps here clamps against the studio the player had a
     * moment ago: the bar's 100 K button put a hundred thousand developers on
     * the block and then asked for rung 5, and the lens — still holding an
     * empty studio's ceiling — parked it on a squad. Two levels below the ten
     * towers it had just built, and reported as "100k view does not have any
     * more than 1 building".
     *
     * §7.7.1 is not weakened by being applied a frame late. `update` holds the
     * ceiling every frame, so a Z past it is pulled in on the next one with the
     * right headcount in hand — which the second half of this test is.
     */
    const lens = new Lens(REFERENCE)
    lens.setAddress(0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK)
    lens.setCeiling(maxZoomFor(1) * 9)
    lens.set(BLOCK / 9)
    lens.setCeiling(maxZoomFor(100_000) * 9)
    settle(lens)
    expect(lens.level).toBeCloseTo(BLOCK, 3)

    // And the other way round: a Z past a ceiling the studio has *not* earned
    // is still pulled in, one frame later.
    const small = new Lens(REFERENCE)
    small.setAddress(0, 1, 1)
    small.set(BLOCK / 9)
    small.setCeiling(maxZoomFor(1) * 9)
    settle(small)
    expect(small.level).toBeCloseTo(SQUAD, 3)
  })

  it('holds a commanded flight to it', () => {
    // The lift panel, the breadcrumb and §7.7.2's reveal all fly the camera by
    // name, and a name is not a permission.
    const lens = newGame()
    lens.flyTo(BUILDING)
    settle(lens)
    expect(lens.level).toBeCloseTo(SQUAD, 3)
  })

  it('pulls a resting camera in when the ceiling comes down', () => {
    // A new career after a §13 shift: the studio is one person again, and the
    // camera is still standing outside a building that no longer exists.
    const lens = make()
    expect(lens.level).toBeCloseTo(BUILDING, 3)
    lens.setAddress(0, 1)
    lens.setFloorRect(GARAGE)
    lens.setCeiling(maxZoomFor(1) * 9)
    settle(lens)
    expect(lens.level).toBeCloseTo(SQUAD, 3)
  })

  it('frames the room when a level would frame more than the room', () => {
    // The scale and the centre have to come from the same rectangle. `nestScales`
    // pushes the squad's *scale* out to the garage's; if the *frame* stayed the
    // 10x10 block, the camera would sit at the garage's scale looking at the
    // middle of a block the garage is one corner of.
    const lens = newGame()
    const room = garageFrame()
    expect(lens.frameOf(SQUAD)).toEqual(room)
    expect(lens.frameOf(FLOOR)).toEqual(room)
    // The desk is genuinely inside the garage and keeps its own frame.
    expect(lens.frameOf(DESK)).not.toEqual(room)
  })

  it('keeps its aim when the frames move underneath it', () => {
    /*
     * **A camera sent to a person is parked on the person.**
     *
     * A level names a frame and a frame has a centre, so re-deriving a parked
     * camera from the level alone throws the aim away. §7.8.10's founder sits
     * *outside* the seat lattice, so the Desk level's own frame is seat 0 — the
     * first developer's chair — and a two-person studio that re-derived came to
     * rest with the player's own avatar 395 px above the top of the screen.
     */
    const lens = newGame()
    const founder = { x: -260, y: -120 }
    lens.flyTo(DESK, founder)
    settle(lens)
    const aimed = lens.centre
    expect(aimed.cx).toBeCloseTo(globeToGalaxy(parkToGlobe(floorToPark(founder, 0, 0, 0))).x, 3)

    // The frames move: the garage grows, and the canvas is laid out again.
    lens.setFloorRect({ ...GARAGE, w: GARAGE.w * 1.2, h: GARAGE.h * 1.2 })
    lens.setViewport({ w: REFERENCE.w, h: REFERENCE.h - 40 })
    settle(lens)
    expect(lens.centre.cx).toBeCloseTo(aimed.cx, 3)
    expect(lens.centre.cy).toBeCloseTo(aimed.cy, 3)
  })

  it('leaves a studio that has earned the whole ladder alone', () => {
    const lens = make()
    lens.setCeiling(maxZoomFor(10_000) * 9)
    lens.reframe(BUILDING, true)
    expect(lens.level).toBeCloseTo(BUILDING, 3)
    spin(lens, -20)
    expect(lens.level).toBeCloseTo(DESK, 3)
  })
})

describe('settleLevel', () => {
  it('rounds, and stays on the ladder', () => {
    expect(settleLevel(2.4)).toBe(FLOOR)
    expect(settleLevel(2.6)).toBe(BUILDING)
    expect(settleLevel(-4)).toBe(DESK)
    expect(settleLevel(99)).toBe(GALAXY)
  })
})

describe('the top of the ladder', () => {
  const REFERENCE = { w: 997, h: 448 }

  /** A studio that has filled its own planet and started on the next one. */
  function starbound(): Lens {
    const lens = new Lens(REFERENCE)
    lens.setAddress(0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK, 100, 40)
    lens.setCeiling(GALAXY)
    lens.reframe(GALAXY, true)
    lens.update(1 / 60, 0)
    return lens
  }

  it('lets a studio that has left its own world pull back to the network', () => {
    const lens = starbound()
    expect(lens.settledLevel).toBe(GALAXY)
    // §7.2's Z is still one division of the level, so the ladder's rung 7 and
    // the camera's level 7 are the same place — which is what keeps the §20.2
    // audio zones and `sim/units.ts` reading the number they always read.
    expect(lens.z).toBeCloseTo(7 / 9, 6)
  })

  it('holds a one-world studio to its own planet', () => {
    // §7.7.1 at the top: the studio you can see is the studio you have. A
    // hundred million developers have filled a world and settled no others, so
    // there is no network to pull back to.
    const lens = new Lens(REFERENCE)
    lens.setAddress(0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK, 100, 1)
    lens.setCeiling(GLOBE)
    lens.reframe(GALAXY, true)
    lens.update(1 / 60, 0)
    expect(lens.settledLevel).toBe(GLOBE)
    spin(lens, 30)
    expect(lens.settledLevel).toBe(GLOBE)
  })

  it('frames the same sky however far the studio has spread', () => {
    // `WORLDS_FRAMED` is a neighbourhood, so the top rung does not recede. The
    // studio grows by *entering* nodes, which recentres it.
    const near = new Lens(REFERENCE)
    near.setAddress(0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK, 100, 40)
    const far = new Lens(REFERENCE)
    far.setAddress(0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK, 100, 1e9)
    expect(near.scales()[GALAXY]).toBeCloseTo(far.scales()[GALAXY], 9)
  })
})
