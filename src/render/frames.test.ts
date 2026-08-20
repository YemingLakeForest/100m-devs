import { describe, expect, it } from 'vitest'
import {
  BAND_H,
  BUILDING,
  BUILDING_FADE_END,
  DESK,
  DEVS_PER_FLOOR,
  FLOOR,
  FLOORS_PER_BUILDING,
  PLATE_SCALE,
  ROOM_RESOLVE_SCALE,
  SQUAD,
  TOWER_W,
  bandRect,
  buildingChromeAlpha,
  buildingFrame,
  descendOnDoubleTap,
  deskFrame,
  fitScaleFor,
  floorFrame,
  floorScaleAt,
  floorSeatRect,
  frameFor,
  intoPlate,
  levelAtScale,
  levelScales,
  nestScales,
  plateRect,
  roomResolved,
  scaleAtLevel,
  seatOfStorey,
  squadAtFloor,
  squadFrame,
  squadOf,
  storeyAtBuilding,
  storeyOf,
  towerSurfaceY,
  type Level,
} from './frames.ts'
import { ROOM_SQUAD_COLS, ROOM_SQUAD_ROWS, SQUAD_SIZE, seatPosition } from './room.ts'

/** §23.4.2's largest frame, and the one every measurement in the plan was taken at. */
const REFERENCE = { w: 997, h: 448 }

const contains = (
  outer: { cx: number; cy: number; w: number; h: number },
  inner: { cx: number; cy: number; w: number; h: number },
) =>
  inner.cx - inner.w / 2 >= outer.cx - outer.w / 2 - 1e-6 &&
  inner.cx + inner.w / 2 <= outer.cx + outer.w / 2 + 1e-6 &&
  inner.cy - inner.h / 2 >= outer.cy - outer.h / 2 - 1e-6 &&
  inner.cy + inner.h / 2 <= outer.cy + outer.h / 2 + 1e-6

describe('floor space', () => {
  it('the seat lattice of a full floor is exactly 2:1', () => {
    // The shape the landscape decision (§23.4) exists for. A 2:1 subject is the
    // only one that can fill a landscape frame on both axes at once.
    const seats = floorSeatRect()
    expect(seats.w / seats.h).toBeCloseTo(2, 6)
    expect(Math.round(seats.w)).toBe(3312)
    expect(Math.round(seats.h)).toBe(1656)
  })

  it('the framed floor is 2:1 as well, so the aisle does not skew it', () => {
    const frame = floorFrame()
    expect(frame.w / frame.h).toBeCloseTo(2, 2)
  })

  it('the aisle is a surround, not a second room', () => {
    // The measured defect: `pad = SQUAD_COLS * 0.45` left the seats covering
    // 74% of the shell at a full floor and 44% at one squad. A constant aisle
    // holds the ratio wherever the studio is.
    const seats = floorSeatRect()
    const frame = floorFrame()
    expect(seats.w / frame.w).toBeGreaterThan(0.85)
    expect(seats.h / frame.h).toBeGreaterThan(0.85)
  })

  it('holds every seat of the thousand', () => {
    const frame = floorFrame()
    for (let i = 0; i < DEVS_PER_FLOOR; i += 7) {
      const at = seatPosition(i)
      expect(at.x).toBeGreaterThanOrEqual(frame.cx - frame.w / 2)
      expect(at.x).toBeLessThanOrEqual(frame.cx + frame.w / 2)
      expect(at.y).toBeGreaterThanOrEqual(frame.cy - frame.h / 2)
      expect(at.y).toBeLessThanOrEqual(frame.cy + frame.h / 2)
    }
  })

  it('every squad frame sits inside the floor frame', () => {
    const floor = floorFrame()
    for (let s = 0; s < ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS; s++) {
      expect(contains(floor, squadFrame(s))).toBe(true)
    }
  })

  it('a squad frame holds its own hundred and nobody else', () => {
    for (let s = 0; s < ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS; s++) {
      const frame = squadFrame(s)
      for (let i = 0; i < SQUAD_SIZE; i++) {
        const at = seatPosition(s * SQUAD_SIZE + i)
        expect(contains(frame, { cx: at.x, cy: at.y, w: 0, h: 0 })).toBe(true)
      }
    }
  })

  it('a desk frame is centred on its own seat', () => {
    for (const seat of [0, 1, 57, 99, 100, 543, 999]) {
      const at = seatPosition(seat)
      const frame = deskFrame(seat)
      expect(frame.cx).toBeCloseTo(at.x, 6)
      expect(frame.cy).toBeCloseTo(at.y, 6)
    }
  })
})

describe('the nesting', () => {
  it('a plate is the floor frame, at plate scale, in the plate', () => {
    // The rule the whole camera rests on: a child is drawn inside its parent's
    // cell, so descending is one affine transform and there is nothing to
    // cross-fade. If this ever stops holding, the zoom stops being a zoom.
    for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
      const viaPlate = plateRect(f, f)
      const viaMap = intoPlate(floorFrame(), f)
      expect(viaMap.cx).toBeCloseTo(viaPlate.cx, 9)
      expect(viaMap.cy).toBeCloseTo(viaPlate.cy, 9)
      expect(viaMap.w).toBeCloseTo(viaPlate.w, 9)
      expect(viaMap.h).toBeCloseTo(viaPlate.h, 9)
    }
  })

  it('scales the floor by exactly the plate divisor', () => {
    const floor = floorFrame()
    const plate = plateRect(3, 3)
    expect(plate.w / floor.w).toBeCloseTo(PLATE_SCALE, 12)
  })

  it('every plate of a built storey is inside the building frame', () => {
    const focus = 4
    const frame = buildingFrame(FLOORS_PER_BUILDING, focus)
    for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
      expect(contains(frame, plateRect(f, focus))).toBe(true)
    }
  })

  it('the tower is as tall as the studio has built, and the plan never shrinks', () => {
    // The frame holds two things and only one of them grows. A two-storey
    // studio has a two-storey tower — the studio you can see is the studio you
    // have — while the plan is always one floor at full size, because the point
    // of pulling it out is that it is readable.
    expect(bandRect(1).cy).toBeGreaterThan(bandRect(9).cy)
    const small = buildingFrame(2, 0)
    const full = buildingFrame(FLOORS_PER_BUILDING, 0)
    expect(small.h).toBeLessThan(full.h)
    // The plan sets the floor under how small the frame can get.
    expect(small.h).toBeGreaterThanOrEqual(plateRect().h)
  })
})

describe('the address', () => {
  it('a seat names its storey and its squad', () => {
    expect(storeyOf(0)).toBe(0)
    expect(storeyOf(999)).toBe(0)
    expect(storeyOf(1000)).toBe(1)
    expect(storeyOf(7_400)).toBe(7)
    expect(seatOfStorey(7)).toBe(7000)
    expect(squadOf(0)).toBe(0)
    expect(squadOf(99)).toBe(0)
    expect(squadOf(100)).toBe(1)
    expect(squadOf(7_450)).toBe(4)
  })

  it('every level names a frame, and the inner ones nest', () => {
    const seat = 7_450
    const storeys = FLOORS_PER_BUILDING
    const desk = frameFor(DESK, seat, storeys)
    const squad = frameFor(SQUAD, seat, storeys)
    const floor = frameFor(FLOOR, seat, storeys)
    const building = frameFor(BUILDING, seat, storeys)
    expect(contains(squad, desk)).toBe(true)
    expect(contains(floor, squad)).toBe(true)
    expect(contains(building, floor)).toBe(true)
  })
})

describe('fitting, at the reference frame', () => {
  const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)

  it('each level is a real zoom step inward', () => {
    expect(scales[DESK]).toBeGreaterThan(scales[SQUAD])
    expect(scales[SQUAD]).toBeGreaterThan(scales[FLOOR])
    expect(scales[FLOOR]).toBeGreaterThan(scales[BUILDING])
    // No step smaller than a doubling: a level the player cannot feel arriving
    // is a level that should not be a stop.
    expect(scales[SQUAD] / scales[FLOOR]).toBeGreaterThan(2)
    expect(scales[FLOOR] / scales[BUILDING]).toBeGreaterThan(2)
  })

  it('the developers fill the frame at floor level', () => {
    // The measurement this whole change answers. It was 483 px of 997 — 48% —
    // and the plan's target is 70%+.
    const scale = scales[FLOOR]
    const seatsPx = floorSeatRect().w * PLATE_SCALE * scale
    expect(seatsPx / REFERENCE.w).toBeGreaterThan(0.7)
  })

  it('the developers fill the frame at squad level too', () => {
    const at = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)[SQUAD]
    // One squad's seat block is 893 x 446 in floor space.
    const seatsPx = 893 * PLATE_SCALE * at
    expect(seatsPx / REFERENCE.w).toBeGreaterThan(0.7)
  })

  it('the building fills the height it is given', () => {
    const frame = frameFor(BUILDING, 0, FLOORS_PER_BUILDING)
    const px = frame.h * scales[BUILDING]
    expect(px / REFERENCE.h).toBeCloseTo(0.94, 2)
  })

  it('a level position and a scale are inverses', () => {
    for (const l of [0, 0.5, 1, 1.7, 2, 2.4, 3] as const) {
      expect(levelAtScale(scaleAtLevel(l, scales), scales)).toBeCloseTo(l, 6)
    }
  })

  it('clamps rather than extrapolating past either end', () => {
    expect(levelAtScale(scales[DESK] * 10, scales)).toBe(DESK)
    expect(levelAtScale(scales[BUILDING] / 10, scales)).toBe(BUILDING)
  })
})

describe('the double tap descends', () => {
  it('only from a level with something under it', () => {
    // The building has its own two-tap picker and the desk is the bottom.
    expect(descendOnDoubleTap(BUILDING, 10_000)).toBe(false)
    expect(descendOnDoubleTap(DESK, 10_000)).toBe(false)
    expect(descendOnDoubleTap(FLOOR, 10_000)).toBe(true)
    expect(descendOnDoubleTap(SQUAD, 10_000)).toBe(true)
  })

  it('and only once there is more than one squad to choose between', () => {
    // §21 Act I boots with POKE latched over a script that reads TAP TO CODE,
    // and a descend consumes the tap — so a studio of two people clicking at
    // the speed a clicker is played at loses every second click to navigation,
    // and the navigation flies the camera onto the person being coded at.
    expect(descendOnDoubleTap(SQUAD, 2)).toBe(false)
    expect(descendOnDoubleTap(SQUAD, SQUAD_SIZE)).toBe(false)
    expect(descendOnDoubleTap(SQUAD, SQUAD_SIZE + 1)).toBe(true)
    expect(descendOnDoubleTap(FLOOR, 2)).toBe(false)
  })
})

describe('the ladder nests', () => {
  /*
   * §7.8.1's garage at one developer, measured on the reference frame: the
   * room is 730 x 448 of floor space, which through the plate fits at 9.86 —
   * *inside* the squad's 8.42, and the squad is supposed to contain it.
   *
   * This is the arithmetic behind "when there's only me on a new game, when I
   * zoomed out, I can't zoom back in". An out-of-order rung is not a rung that
   * is the wrong size, it is a rung that does not exist: `levelAtScale` walks
   * the bands in order, so the band between the squad and the floor inverted
   * and every scale in it fell through to a level a level and a half away.
   */
  const CROSSED = { 0: 51.75, 1: 8.42, 2: 9.86, 3: 1.11 } as Record<Level, number>

  it('pushes a rung out until it holds the one inside it', () => {
    const nested = nestScales(CROSSED)
    expect(nested[SQUAD]).toBe(CROSSED[FLOOR])
    // And nothing else moves: the desk was already inside the squad, and the
    // building was already outside the floor.
    expect(nested[DESK]).toBe(CROSSED[DESK])
    expect(nested[BUILDING]).toBe(CROSSED[BUILDING])
  })

  it('leaves a ladder that already nests exactly as it was', () => {
    const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)
    expect(nestScales(scales)).toEqual(scales)
  })

  it('reads a scale two rungs share as the inner one', () => {
    // The squad and the floor are the same picture in a garage, and the camera
    // sitting on their shared scale got there by pulling back until it
    // stopped. What stopped it was the squad's own ceiling, so that is where
    // it is.
    const nested = nestScales(CROSSED)
    expect(levelAtScale(nested[SQUAD], nested)).toBe(SQUAD)
    expect(Number.isNaN(levelAtScale(nested[FLOOR], nested))).toBe(false)
  })

  it('stays continuous and on the ladder across a collapsed rung', () => {
    const nested = nestScales(CROSSED)
    for (let s = nested[BUILDING] / 2; s < nested[DESK] * 2; s *= 1.05) {
      const level = levelAtScale(s, nested)
      expect(Number.isFinite(level)).toBe(true)
      expect(level).toBeGreaterThanOrEqual(DESK)
      expect(level).toBeLessThanOrEqual(BUILDING)
    }
  })

  it('lands exactly on a stop, collapsed or not', () => {
    // `exp(log(s))` is a unit in the last place either side of `s`, which is
    // enough for the level to read as the neighbouring rung — so the camera
    // sitting still would flicker between two names, and anything holding it
    // to a level would keep re-asserting a scale it was already at.
    const nested = nestScales(CROSSED)
    for (const l of [DESK, SQUAD, FLOOR, BUILDING] as Level[]) {
      expect(scaleAtLevel(l, nested)).toBe(nested[l])
    }
  })
})

describe('level of detail', () => {
  const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)
  const floorScaleOf = (l: Level) => floorScaleAt(scales[l])

  it('the room is not resolved while the building is the subject', () => {
    expect(roomResolved(floorScaleOf(BUILDING))).toBe(false)
  })

  it('the room is resolved at floor level and below', () => {
    expect(roomResolved(floorScaleOf(FLOOR))).toBe(true)
    expect(roomResolved(floorScaleOf(SQUAD))).toBe(true)
    expect(roomResolved(floorScaleOf(DESK))).toBe(true)
  })

  it('the room arrives before the building leaves', () => {
    // The overlap the old cross-fade could not have. If these ever cross, the
    // descent passes through a frame with neither picture in it.
    expect(ROOM_RESOLVE_SCALE).toBeLessThan(BUILDING_FADE_END)
  })

  it('the building chrome is whole at its own level and gone at the floor', () => {
    expect(buildingChromeAlpha(floorScaleOf(BUILDING))).toBe(1)
    expect(buildingChromeAlpha(floorScaleOf(FLOOR))).toBe(0)
  })

  it('the descent is one continuous magnification, with no jump at the swap', () => {
    // The measured defect stated as a property. The old lens drew the room at
    // 649 px and the tower at 1831 px on the same frame, because the two were
    // fitted independently; here the subject's on-screen size is a single
    // monotone function of camera scale and the LOD swap is invisible to it.
    let last = 0
    for (let l = 3; l >= 0; l -= 0.02) {
      const px = floorSeatRect().w * floorScaleAt(scaleAtLevel(l, scales))
      expect(px).toBeGreaterThan(last)
      // No step bigger than a few per cent, so nothing on screen can pop.
      if (last > 0) expect(px / last).toBeLessThan(1.1)
      last = px
    }
  })

  it('the room resolves exactly once on the way in, and never flickers', () => {
    let swaps = 0
    let was = roomResolved(floorScaleAt(scaleAtLevel(3, scales)))
    expect(was).toBe(false)
    for (let l = 3; l >= 0; l -= 0.01) {
      const now = roomResolved(floorScaleAt(scaleAtLevel(l, scales)))
      if (now !== was) swaps++
      was = now
    }
    expect(swaps).toBe(1)
    expect(was).toBe(true)
  })
})

describe('picking', () => {
  it('a seat is over its own squad', () => {
    for (let s = 0; s < ROOM_SQUAD_COLS * ROOM_SQUAD_ROWS; s++) {
      for (const i of [0, 45, 99]) {
        const at = seatPosition(s * SQUAD_SIZE + i)
        expect(squadAtFloor(at.x, at.y)).toBe(s)
      }
    }
  })

  it("the founder's corner is off the squad lattice, not on squad zero", () => {
    // §7.8.10's desk sits at a negative coordinate outside the grid entirely.
    // Returning 0 for it would make every tap on the manager buff the first
    // hundred developers instead.
    expect(squadAtFloor(-400, -300)).toBe(-1)
  })

  it('every band on the tower can be picked, and none of them overlap', () => {
    /*
     * **Aimed at where the storey is painted, not at `bandRect`.**
     *
     * This used to press `(bandRect(f).cx, bandRect(f).cy)` — the near corner
     * of the tower at the outer-edge midline — and assert it returned `f`. It
     * did, because `storeyAtBuilding` was testing the same upright rectangle
     * the assertion was built from, and both of them were wrong about the
     * building: the storeys are drawn on a 2:1 rake that drops `TOWER_D / 2`
     * toward the camera, which is four fifths of a storey. The test and the code
     * agreed with each other and neither agreed with the picture.
     *
     * So the aim points come from `towerSurfaceY`, which is what draws the
     * thing. That is the only definition of "under the finger" worth asserting.
     */
    for (const focus of [0, 3, 9]) {
      for (let f = 0; f < FLOORS_PER_BUILDING; f++) {
        for (const x of [-TOWER_W / 2 + 1, -34, 0, 34, TOWER_W / 2 - 1]) {
          const ceiling = towerSurfaceY(x, f + 1)
          const mid = ceiling + BAND_H / 2
          expect(storeyAtBuilding(x, mid, FLOORS_PER_BUILDING, focus)).toBe(f)
          // And the very top and bottom of each band, which is where a thumb
          // aimed at a 36 px target actually lands.
          expect(storeyAtBuilding(x, ceiling + BAND_H * 0.05, FLOORS_PER_BUILDING, focus)).toBe(f)
          expect(storeyAtBuilding(x, ceiling + BAND_H * 0.95, FLOORS_PER_BUILDING, focus)).toBe(f)
        }
      }
    }
  })

  it('the pulled-out plan names the floor it is a plan of', () => {
    // Tapping the big drawing has to mean the same thing as tapping its band,
    // or "tap it again to go in" only works on the small target.
    for (const focus of [0, 4, 9]) {
      const r = plateRect()
      expect(storeyAtBuilding(r.cx, r.cy, FLOORS_PER_BUILDING, focus)).toBe(focus)
    }
  })

  it('empty sky is a miss', () => {
    expect(storeyAtBuilding(0, -100_000, FLOORS_PER_BUILDING, 0)).toBe(-1)
  })

  it('an unbuilt storey cannot be picked', () => {
    const r = bandRect(8)
    expect(storeyAtBuilding(r.cx, r.cy, 3, 0)).toBe(-1)
  })
})

describe('the plates are worth looking at', () => {
  it('a band is a thumb-sized target at the reference frame', () => {
    const scale = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)[BUILDING]
    // A 9 mm fingertip is about 34 px. Below that, choosing a floor from the
    // tower stops being possible and the lift panel is the only way in.
    expect(bandRect(0).h * scale).toBeGreaterThan(30)
  })

  it('the plan is legible at the reference frame', () => {
    // The geometric limit: ten 2:1 plates that do not *hide each other* inside
    // a 2.23:1 frame cap out around 145 px wide. Below about 120 the five-by-two
    // arrangement stops being readable and the level stops meaning anything —
    // and hiding them to make them bigger is the trade the first pass made, and
    // it produced one continuous ramp.
    const scale = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)[BUILDING]
    const px = plateRect().w * scale
    // Twice what any arrangement of ten plans managed, which is the whole
    // argument for pulling one out instead of stacking all of them.
    expect(px).toBeGreaterThan(250)
  })

  it('fills the height and leaves the lift panel its half of the width', () => {
    // The composition is deliberately height-bound: the world takes about half
    // the frame and §10's floor list takes the rest. A world that filled the
    // width would have nowhere to put the numbers.
    const scale = levelScales(0, FLOORS_PER_BUILDING, REFERENCE)[BUILDING]
    const frame = buildingFrame(FLOORS_PER_BUILDING, 0)
    expect((frame.h * scale) / REFERENCE.h).toBeCloseTo(0.94, 2)
    const w = (frame.w * scale) / REFERENCE.w
    expect(w).toBeGreaterThan(0.35)
    expect(w).toBeLessThan(0.7)
  })
})

describe('the fit is viewport-aware', () => {
  it('a taller frame gives the building more scale', () => {
    const wide = fitScaleFor(buildingFrame(10, 0), { w: 997, h: 448 })
    const tall = fitScaleFor(buildingFrame(10, 0), { w: 997, h: 700 })
    expect(tall).toBeGreaterThan(wide)
  })

  it('survives a zero-sized viewport during startup', () => {
    expect(fitScaleFor(floorFrame(), { w: 0, h: 0 })).toBe(1)
  })
})
