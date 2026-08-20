import { describe, expect, it } from 'vitest'
import {
  BAYS,
  BAY_PITCH,
  PANE_W,
  PODIUM_H,
  devsOnStorey,
  paneTone,
  squadsOnStorey,
  storeyDropHeight,
  surfaceY,
} from './building.ts'
import {
  BAND_H,
  DEVS_PER_FLOOR,
  FLOORS_PER_BUILDING,
  PLOT_DROP,
  TOWER_CROWN,
  TOWER_W,
  bandRect,
  buildingFrame,
  storeyAtBuilding,
} from './frames.ts'
import { ROOM_SQUAD_COLS, ROOM_SQUAD_ROWS } from './room.ts'

const HALF_W = TOWER_W / 2

describe('the facade rakes one way, and everything on it agrees', () => {
  // This is the defect that made the old tower look wrong, and it was one
  // divisor: the windows were offset by `(x + halfW) / TOWER_W * halfD`, which
  // is *half* the slope the facade actually has. Every row of glass sagged away
  // from its own floor, so the stack read as a shallow V fighting an inverted V
  // of floor seams. Nothing else about it was wrong and no amount of retinting
  // would have helped.

  it('is 2:1 isometric, which is one unit down for two across', () => {
    const drop = surfaceY(0, 0) - surfaceY(HALF_W, 0)
    expect(drop / HALF_W).toBeCloseTo(0.5, 12)
  })

  it('is symmetric about the near corner', () => {
    for (const x of [0, 12, 37, HALF_W]) {
      expect(surfaceY(-x, 3)).toBeCloseTo(surfaceY(x, 3), 12)
    }
  })

  it('puts the near corner lower than the outer ones, never the reverse', () => {
    // The corner nearest the camera is the *bottom* of the diamond. Getting the
    // sign wrong turns a building inside out and it still looks like a building.
    expect(surfaceY(0, 4)).toBeGreaterThan(surfaceY(HALF_W, 4))
  })

  it('stacks storeys exactly BAND_H apart at every point of the facade', () => {
    for (const x of [-HALF_W, -30, 0, 30, HALF_W]) {
      expect(surfaceY(x, 5) - surfaceY(x, 6)).toBeCloseTo(BAND_H, 12)
    }
  })

  it('agrees with the band rectangles the lift line and the frame are hung on', () => {
    // `bandRect` is measured at the tower's *outer* corners, which is where the
    // lift line leaves the building and where `buildingFrame` finds its top.
    for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
      const band = bandRect(f)
      const mid = (surfaceY(HALF_W, f) + surfaceY(HALF_W, f + 1)) / 2
      expect(mid).toBeCloseTo(band.cy, 6)
    }
  })

  it('resolves a tap to the storey that is painted under it, not beside it', () => {
    // The defect this exists for: `storeyAtBuilding` walked `bandRect` down the
    // tower, and an upright rectangle against a band sheared by TOWER_D / 2 is
    // four fifths of a storey out at the near corner. Pressing the middle of a
    // floor you can see hit the one below it.
    for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
      for (const x of [-HALF_W + 1, -40, 0, 40, HALF_W - 1]) {
        const mid = (surfaceY(x, f) + surfaceY(x, f + 1)) / 2
        expect(storeyAtBuilding(x, mid, FLOORS_PER_BUILDING, 0)).toBe(f)
      }
    }
  })

  it('does not claim a tap that is off the shaft altogether', () => {
    expect(storeyAtBuilding(HALF_W + 30, 0, FLOORS_PER_BUILDING, 0)).toBe(-1)
    // Above the roof, and below the ground.
    expect(storeyAtBuilding(0, surfaceY(0, FLOORS_PER_BUILDING) - 8, FLOORS_PER_BUILDING, 0)).toBe(-1)
    expect(storeyAtBuilding(0, surfaceY(0, 0) + 8, FLOORS_PER_BUILDING, 0)).toBe(-1)
  })

  it('only offers the storeys the studio has actually built', () => {
    const mid = (surfaceY(0, 5) + surfaceY(0, 6)) / 2
    expect(storeyAtBuilding(0, mid, FLOORS_PER_BUILDING, 0)).toBe(5)
    expect(storeyAtBuilding(0, mid, 3, 0)).toBe(-1)
  })

  it('continues past the shaft, so the plinth sits on the same ground', () => {
    // The podium oversails the tower, and its outer corners are simply this
    // plane evaluated further out. A separate formula for the wider box is a
    // second chance to get the slope wrong.
    const wide = HALF_W * 1.09
    expect(surfaceY(wide, 0)).toBeLessThan(surfaceY(HALF_W, 0))
    expect(surfaceY(HALF_W, 0) - surfaceY(wide, 0)).toBeCloseTo((wide - HALF_W) / 2, 12)
  })
})

describe('the curtain wall', () => {
  it('gives every squad of the floor below it exactly one window', () => {
    // Not a bar chart drawn as windows: the left face is the floor's front row
    // of squads and the right face its back row, so the tower is a true picture
    // of the plan pulled out beside it.
    expect(BAYS * 2).toBe(ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS)
  })

  it('leaves a mullion between every pane and at both ends of the face', () => {
    expect(PANE_W).toBeLessThan(BAY_PITCH)
    const last = 2 + (BAYS - 1) * BAY_PITCH + PANE_W
    expect(last).toBeLessThanOrEqual(HALF_W)
    expect(BAYS * BAY_PITCH).toBeCloseTo(HALF_W, 12)
  })

  it('lights one window per squad that has anybody in it', () => {
    expect(squadsOnStorey(0, 0)).toBe(0)
    expect(squadsOnStorey(1, 0)).toBe(1)
    expect(squadsOnStorey(DEVS_PER_FLOOR, 0)).toBe(BAYS * 2)
    // A second storey lights from its own headcount, not the studio's.
    expect(squadsOnStorey(DEVS_PER_FLOOR + 1, 1)).toBe(1)
    expect(squadsOnStorey(DEVS_PER_FLOOR, 1)).toBe(0)
  })

  it('never lights more windows than it has', () => {
    for (const devs of [0, 1, 99, 100, 999, 1000, 9_999, 10_000]) {
      for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
        const on = squadsOnStorey(devs, f)
        expect(on).toBeGreaterThanOrEqual(0)
        expect(on).toBeLessThanOrEqual(BAYS * 2)
      }
    }
  })

  it('picks a pane tone that does not change between redraws', () => {
    // `redrawTower` runs on every hire. A pane that re-rolls its tone each time
    // is not variety, it is a fault light.
    for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
      for (let s = 0; s < BAYS * 2; s++) {
        expect(paneTone(f, s)).toBe(paneTone(f, s))
      }
    }
  })

  it('keeps most of the glass on monitor light and only a little on the overheads', () => {
    const tally: Record<string, number> = {}
    for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
      for (let s = 0; s < BAYS * 2; s++) tally[paneTone(f, s)] = (tally[paneTone(f, s)] ?? 0) + 1
    }
    expect(tally.lit).toBeGreaterThan(50)
    expect(tally.late ?? 0).toBeGreaterThan(0)
    expect(tally.late ?? 0).toBeLessThan(15)
  })
})

describe('the crown and the plinth fit the frame that reserves them', () => {
  it('leaves the mast enough headroom to be drawn', () => {
    // It was 18 units — a parapet and nothing else — so the mast and its
    // aviation light were drawn and then cropped off by their own viewport.
    const frame = buildingFrame(FLOORS_PER_BUILDING, 0)
    const roof = surfaceY(HALF_W, FLOORS_PER_BUILDING)
    const mastTop = roof - (TOWER_CROWN - 18)
    expect(mastTop).toBeGreaterThan(frame.cy - frame.h / 2)
  })

  it('leaves the plinth enough room to stand on', () => {
    expect(surfaceY(0, 0) + PODIUM_H).toBeLessThanOrEqual(PLOT_DROP)
  })

  it('frames a taller studio taller', () => {
    expect(buildingFrame(2, 0).h).toBeLessThan(buildingFrame(FLOORS_PER_BUILDING, 0).h)
  })
})

describe('a storey arriving', () => {
  it('falls, and is moving fastest when it lands', () => {
    expect(storeyDropHeight(0)).toBeGreaterThan(0)
    expect(storeyDropHeight(1)).toBe(0)
    const late = storeyDropHeight(0.9) - storeyDropHeight(1)
    const early = storeyDropHeight(0) - storeyDropHeight(0.1)
    expect(late).toBeGreaterThan(early)
  })

  it('holds the headcount split the tower is drawn from', () => {
    expect(devsOnStorey(6_400, 0)).toBe(DEVS_PER_FLOOR)
    expect(devsOnStorey(6_400, 6)).toBe(400)
    expect(devsOnStorey(6_400, 7)).toBe(0)
  })
})
