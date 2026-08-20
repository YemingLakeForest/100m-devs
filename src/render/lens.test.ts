import { describe, expect, it } from 'vitest'
import {
  Lens,
  SETTLE_DELAY_MS,
  anchorCentre,
  panBounds,
  panRange,
  settleLevel,
} from './lens.ts'
import {
  BUILDING,
  DESK,
  FLOOR,
  FLOORS_PER_BUILDING,
  SQUAD,
  fitScaleFor,
  floorFrame,
  floorScaleAt,
  intoPlate,
  roomResolved,
} from './frames.ts'

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

describe('settleLevel', () => {
  it('rounds, and stays on the ladder', () => {
    expect(settleLevel(2.4)).toBe(FLOOR)
    expect(settleLevel(2.6)).toBe(BUILDING)
    expect(settleLevel(-4)).toBe(DESK)
    expect(settleLevel(99)).toBe(BUILDING)
  })
})
