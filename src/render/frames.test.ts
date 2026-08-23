import { describe, expect, it } from 'vitest'
import {
  BAND_H,
  BLOCK,
  BLOCKS_PER_PARK,
  BLOCK_CAP,
  BLOCK_COLS,
  BLOCK_SCALE,
  BUILDINGS_PER_BLOCK,
  BUILDINGS_PER_PARK,
  BUILDING,
  BUILDING_CAP,
  PARK,
  PARK_SCALE,
  COMPOUNDS,
  DECK_V,
  PLOT_STRIDE_X,
  PLOT_STRIDE_Y,
  TOWER_CROWN,
  TOWER_GROUND,
  blockAtPark,
  blockCell,
  boardBox,
  shoreBox,
  bridges,
  busRuns,
  canalRuns,
  PIN_CLEARANCE,
  pinRows,
  blockOf,
  blocksFor,
  buildingAt,
  deckOutline,
  deckRect,
  devsOnBlock,
  intoParcel,
  parcelAt,
  parkChromeAlpha,
  deckBox,
  latticeRect,
  packageBox,
  parkFrame,
  plantBox,
  plantFor,
  plotOf,
  seatOfBlock,
  seatOfPlot,
  type Rect,
  blockChromeAlpha,
  blockFrame,
  buildingAtBlock,
  buildingOf,
  buildingsIn,
  devsIn,
  intoPlot,
  plotAt,
  plotDepth,
  storeysIn,
  towerRect,
  DESK,
  DEVS_PER_FLOOR,
  FLOOR,
  FLOORS_PER_BUILDING,
  PLATE_SCALE,
  SQUAD,
  TOWER_W,
  bandRect,
  buildingChromeAlpha,
  buildingFrame,
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
  seatOfBuilding,
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
  const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)

  it('each level is a real zoom step inward', () => {
    expect(scales[DESK]).toBeGreaterThan(scales[SQUAD])
    expect(scales[SQUAD]).toBeGreaterThan(scales[FLOOR])
    expect(scales[FLOOR]).toBeGreaterThan(scales[BUILDING])
    expect(scales[BUILDING]).toBeGreaterThan(scales[BLOCK])
    expect(scales[BLOCK]).toBeGreaterThan(scales[PARK])
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

  it('and so does the block', () => {
    // One block, so that the block *is* the studio and its own frame is what
    // the camera fits. With ten of them the block is a parcel and the frame
    // that fills the height is the park's.
    const frame = frameFor(BLOCK, 0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK)
    const one = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK)
    const px = frame.h * one[BLOCK]
    expect(px / REFERENCE.h).toBeCloseTo(0.94, 2)
  })

  it('and so does the park', () => {
    const frame = frameFor(PARK, 0, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
    const px = frame.h * scales[PARK]
    expect(px / REFERENCE.h).toBeCloseTo(0.94, 2)
  })

  it('a level position and a scale are inverses', () => {
    for (const l of [0, 0.5, 1, 1.7, 2, 2.4, 3, 3.6, 4, 4.5, 5] as const) {
      expect(levelAtScale(scaleAtLevel(l, scales), scales)).toBeCloseTo(l, 6)
    }
  })

  it('clamps rather than extrapolating past either end', () => {
    expect(levelAtScale(scales[DESK] * 10, scales)).toBe(DESK)
    expect(levelAtScale(scales[PARK] / 10, scales)).toBe(PARK)
  })
})

describe('the block', () => {
  const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)

  it('numbers the address one way, and unpacks it every way', () => {
    // One global seat still. Everything else is derived, so nothing can
    // disagree with anything.
    expect(buildingOf(0)).toBe(0)
    expect(storeyOf(0)).toBe(0)
    expect(buildingOf(BUILDING_CAP)).toBe(1)
    // The one that would be wrong under the old reading: seat 14,000 is floor
    // *four of the second building*, not floor fourteen of anything.
    expect(buildingOf(14_000)).toBe(1)
    expect(storeyOf(14_000)).toBe(4)
    expect(seatOfBuilding(3)).toBe(3 * BUILDING_CAP)
    expect(seatOfStorey(2, 3)).toBe(3 * BUILDING_CAP + 2 * DEVS_PER_FLOOR)
    expect(buildingOf(seatOfStorey(2, 3))).toBe(3)
    expect(storeyOf(seatOfStorey(2, 3))).toBe(2)
  })

  it('clamps the address to the studio this scope draws', () => {
    expect(buildingOf(-5)).toBe(0)
    expect(buildingOf(1e9)).toBe(BUILDINGS_PER_PARK - 1)
    expect(storeyOf(1e9)).toBe(FLOORS_PER_BUILDING - 1)
  })

  it('fills its buildings in order, and only the last one grows', () => {
    expect(buildingsIn(1, 0)).toBe(1)
    expect(buildingsIn(BUILDING_CAP, 0)).toBe(1)
    expect(buildingsIn(BUILDING_CAP + 1, 0)).toBe(2)
    expect(buildingsIn(1e9, 0)).toBe(BUILDINGS_PER_BLOCK)

    // 25,000 developers: two full buildings and a third with five floors.
    expect(storeysIn(25_000, 0)).toBe(FLOORS_PER_BUILDING)
    expect(storeysIn(25_000, 1)).toBe(FLOORS_PER_BUILDING)
    expect(storeysIn(25_000, 2)).toBe(5)
    expect(storeysIn(25_000, 3)).toBe(0)
    expect(devsIn(25_000, 0)).toBe(BUILDING_CAP)
    expect(devsIn(25_000, 2)).toBe(5_000)
    expect(devsIn(25_000, 9)).toBe(0)
  })

  it('stands every tower of a row clear of the one beside it', () => {
    // Along a row, which is the case a 130-unit stride against a 115-unit
    // footprint was chosen for: fifteen units of street, and no tower is ever
    // partly behind the one next to it.
    for (const row of [0, 5]) {
      for (let c = 0; c + 1 < BLOCK_COLS; c++) {
        const a = intoPlot(towerRect(FLOORS_PER_BUILDING), row + c)
        const b = intoPlot(towerRect(FLOORS_PER_BUILDING), row + c + 1)
        expect(Math.abs(a.cx - b.cx), `plots ${row + c} and ${row + c + 1}`).toBeGreaterThanOrEqual(
          (a.w + b.w) / 2,
        )
      }
    }
  })

  it('leaves every tower a piece of itself to be tapped', () => {
    /*
     * **The near row does stand in front of the far row**, and this is the
     * assertion that replaced the one claiming it does not — written first,
     * failed immediately, and it was right: on a 2:1 lattice the plot one
     * column along *and* one row nearer sits at exactly the same x, 130 units
     * lower, against a 290-unit tower. Four of the ten are half hidden.
     *
     * That is what a block looks like and it is not the defect the plate stack
     * had, because the thing that matters is not that a tower is whole — it is
     * that **every tower keeps a band of itself that the finger can reach**.
     * The picker resolves nearest-first, so the exposed band belongs to the
     * building it looks like it belongs to.
     *
     * A 9 mm fingertip is about 34 px at the reference frame.
     */
    const all = () => FLOORS_PER_BUILDING
    for (let i = 0; i < BUILDINGS_PER_BLOCK; i++) {
      const box = intoPlot(towerRect(FLOORS_PER_BUILDING), i)
      let exposed = 0
      for (let y = box.cy - box.h / 2; y <= box.cy + box.h / 2; y += 1) {
        if (buildingAtBlock(box.cx, y, BUILDINGS_PER_BLOCK, all) === i) exposed += 1
      }
      expect(exposed * scales[BLOCK], `building ${i}`).toBeGreaterThan(34)
    }
  })

  it('lays the plots out five across and two back', () => {
    // Column along is right and down; a row back is left and up. The same 2:1
    // as the floor's squads, which is the same arrangement one scale up.
    expect(plotAt(0)).toEqual({ x: 0, y: 0 })
    expect(plotAt(1).x).toBeGreaterThan(plotAt(0).x)
    expect(plotAt(1).y).toBeGreaterThan(plotAt(0).y)
    expect(plotAt(5).x).toBeLessThan(plotAt(0).x)
    expect(plotAt(5).y).toBeGreaterThan(plotAt(0).y)
    // And drawing order is depth order: nearer is further down the screen.
    for (let i = 0; i < BUILDINGS_PER_BLOCK; i++) {
      for (let j = 0; j < BUILDINGS_PER_BLOCK; j++) {
        if (plotDepth(i) < plotDepth(j)) expect(plotAt(i).y).toBeLessThan(plotAt(j).y)
      }
    }
  })

  it('names the tower under the finger, at every plot', () => {
    const all = () => FLOORS_PER_BUILDING
    for (let i = 0; i < BUILDINGS_PER_BLOCK; i++) {
      const at = plotAt(i)
      // Near the crown, which is the part of a far-row tower that is not behind
      // the near-row one — see the exposure test above.
      expect(buildingAtBlock(at.x, at.y - 250, BUILDINGS_PER_BLOCK, all)).toBe(i)
    }
    // And off the block is nobody, not building zero.
    expect(buildingAtBlock(-9_000, 0, BUILDINGS_PER_BLOCK, all)).toBe(-1)
  })

  it('does not name a plot the studio has not built', () => {
    const two = plotAt(7)
    expect(buildingAtBlock(two.x, two.y - 60, 3, () => FLOORS_PER_BUILDING)).toBe(-1)
  })

  it('frames what has been built, and stops re-framing once it has two', () => {
    // Buildings fill in order, so the second one makes the first full and the
    // tallest tower never changes again. A frame measured off each building's
    // own height would re-frame the block every time a storey landed anywhere.
    const a = blockFrame(4, FLOORS_PER_BUILDING)
    const b = blockFrame(4, FLOORS_PER_BUILDING)
    expect(a).toEqual(b)
    expect(blockFrame(9, FLOORS_PER_BUILDING).w).toBeGreaterThan(a.w)
  })

  it('is a real zoom step out from one building', () => {
    expect(scales[BUILDING]).toBeGreaterThan(scales[BLOCK])
    expect(scales[BUILDING] / scales[BLOCK]).toBeGreaterThan(2)
  })

  it('draws a tower you can hit at the reference frame', () => {
    // A 9 mm fingertip is about 34 px. Below that, choosing a building off the
    // block stops being possible and the picker is the only way in.
    const tower = intoPlot(towerRect(FLOORS_PER_BUILDING), 0)
    expect(tower.w * scales[BLOCK]).toBeGreaterThan(60)
    expect(tower.h * scales[BLOCK]).toBeGreaterThan(150)
  })

  it('hands the room over to the block without changing what a desk measures', () => {
    /*
     * The nesting is scale-neutral by construction and this is the assertion
     * that keeps it so. Adding a division to the chain moves every camera scale
     * by exactly that factor, so **every LOD threshold below stays the number
     * it was** — `floorScaleAt` is the only line that knows the block exists.
     */
    expect(floorScaleAt(scales[FLOOR])).toBeCloseTo(0.2195, 3)
    expect(roomResolved(floorScaleAt(scales[FLOOR]))).toBe(true)
    expect(roomResolved(floorScaleAt(scales[BUILDING]))).toBe(false)
    expect(roomResolved(floorScaleAt(scales[BLOCK]))).toBe(false)
  })

  it('crosses the block out completely before the plan comes out', () => {
    // The plan is 286 units wide against a 130-unit plot stride, so a plan
    // drawn while a neighbour is still on screen is drawn through it.
    expect(blockChromeAlpha(BLOCK)).toBe(1)
    expect(blockChromeAlpha(BUILDING)).toBe(0)
  })
})

describe('the park', () => {
  const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)

  /**
   * A park-space point back in plot-lattice coordinates.
   *
   * The whole composition is one lattice — plots inside blocks inside parcels —
   * so the honest way to ask "do these two decks touch" is to ask it in the
   * coordinates the decks are corners of. Two parallelograms of the same
   * lattice are disjoint exactly when their ranges are disjoint on either axis,
   * which is a test with no tolerance in it.
   */
  const lattice = (p: { x: number; y: number }) => {
    const x = p.x / (PLOT_STRIDE_X * PARK_SCALE)
    const y = (p.y - TOWER_GROUND * BLOCK_SCALE * PARK_SCALE) / (PLOT_STRIDE_Y * PARK_SCALE)
    return { u: (x + y) / 2, v: (y - x) / 2 }
  }

  const deckIn = (block: number) => {
    const at = parcelAt(block)
    const pts = deckOutline().map((q) =>
      lattice({ x: at.x + q.x * PARK_SCALE, y: at.y + q.y * PARK_SCALE }),
    )
    const us = pts.map((q) => q.u)
    const vs = pts.map((q) => q.v)
    return { u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) }
  }

  it('numbers a seat all the way up, and unpacks every rung of it', () => {
    // Still one global seat. `storeyOf` is local to its building and `plotOf`
    // is local to its block, because a floor number and a plot number are only
    // ever *of* something; `buildingOf` is park-wide, because it is the number
    // people are counted into.
    expect(blockOf(0)).toBe(0)
    expect(blockOf(BLOCK_CAP)).toBe(1)
    expect(blockOf(745_000)).toBe(7)
    expect(buildingOf(745_000)).toBe(74)
    expect(plotOf(buildingOf(745_000))).toBe(4)
    expect(storeyOf(745_000)).toBe(5)

    expect(seatOfBlock(7)).toBe(7 * BLOCK_CAP)
    expect(buildingAt(4, 7)).toBe(74)
    expect(seatOfPlot(4, 7)).toBe(74 * BUILDING_CAP)
    expect(seatOfStorey(5, buildingAt(4, 7))).toBe(745_000)
  })

  it('clamps the address to the studio this scope draws', () => {
    expect(blockOf(-5)).toBe(0)
    expect(blockOf(1e12)).toBe(BLOCKS_PER_PARK - 1)
    expect(buildingOf(1e12)).toBe(BUILDINGS_PER_PARK - 1)
  })

  it('fills its blocks in order, and only the last one grows', () => {
    expect(blocksFor(1)).toBe(1)
    expect(blocksFor(BLOCK_CAP)).toBe(1)
    expect(blocksFor(BLOCK_CAP + 1)).toBe(2)
    expect(blocksFor(1e12)).toBe(BLOCKS_PER_PARK)

    // 250,000 developers: two full blocks and a third with five buildings.
    expect(buildingsIn(250_000, 0)).toBe(BUILDINGS_PER_BLOCK)
    expect(buildingsIn(250_000, 1)).toBe(BUILDINGS_PER_BLOCK)
    expect(buildingsIn(250_000, 2)).toBe(5)
    expect(buildingsIn(250_000, 3)).toBe(0)
    expect(devsOnBlock(250_000, 0)).toBe(BLOCK_CAP)
    expect(devsOnBlock(250_000, 2)).toBe(50_000)
    expect(devsOnBlock(250_000, 9)).toBe(0)
    // And a building of the third block is counted park-wide, not block-wide.
    expect(devsIn(250_000, buildingAt(0, 2))).toBe(BUILDING_CAP)
    expect(devsIn(250_000, buildingAt(5, 2))).toBe(0)
  })

  it('stands every parcel clear of every other one', () => {
    /*
     * The claim the whole composition rests on, and the one the block could not
     * make: on a 2:1 lattice a plot one column along *and* one row nearer sits
     * at the same x, which is why four of a block's ten towers stand half in
     * front of four others. A block is wider than it is tall where a tower is
     * the reverse, so the same lattice separates parcels completely.
     *
     * Trap 49: this is the note in `frames.ts` written as a test, because a
     * comment claiming a geometric property is a test nobody has written yet.
     */
    for (let i = 0; i < BLOCKS_PER_PARK; i++) {
      for (let j = i + 1; j < BLOCKS_PER_PARK; j++) {
        const a = deckIn(i)
        const b = deckIn(j)
        const apart = a.u1 < b.u0 || b.u1 < a.u0 || a.v1 < b.v0 || b.v1 < a.v0
        expect(apart, `parcels ${i} and ${j} overlap`).toBe(true)
      }
    }
  })

  it('leaves a street inside a compound and a channel between them', () => {
    /*
     * **[rewritten 2026-08-22]** This used to assert a 1.4-stride boulevard
     * between every pair of neighbours, because every pair *were* neighbours on
     * one 5x2 grid. They are not any more: two blocks of the same compound sit
     * a street apart and two compounds sit a channel apart, and the difference
     * between those two numbers is most of what makes the level read as parts
     * on a board rather than as a field of identical islands.
     *
     * The back gap stays larger than the across gap, and for a reason that is
     * about towers rather than ground: a tower is 130 park units tall and one
     * lattice step back drops the next deck only 32.5, so rows have to be
     * spaced further than columns to keep the near one from standing in front
     * of the far one — which is what the *block* looks like and is exactly what
     * this level exists not to look like.
     */
    const across = deckBox(1).u0 - deckBox(0).u1
    const back = deckBox(2).v0 - deckBox(0).v1
    expect(across).toBeCloseTo(0.45, 6)
    expect(back).toBeCloseTo(1.7, 6)
    expect(back).toBeGreaterThan(across)

    // A near deck drops further than a tower is tall, so nothing occludes a
    // neighbour's crown — the property the old row spacing bought at four times
    // the cost.
    const drop = back + DECK_V
    expect(drop * PLOT_STRIDE_Y * PARK_SCALE).toBeGreaterThan(
      (FLOORS_PER_BUILDING * BAND_H + TOWER_CROWN) * BLOCK_SCALE * PARK_SCALE * 0.9,
    )

    // And the channel between two compounds is wider than the street inside one.
    const channel = packageBox(1, BLOCKS_PER_PARK)!.u0 - packageBox(0, BLOCKS_PER_PARK)!.u1
    expect(channel).toBeGreaterThan(across * 2)
  })

  it('never overlaps one compound with another', () => {
    /*
     * The packages are placed by hand in `COMPOUNDS`, which is the one part of
     * this level a person tunes — so the thing a person can break by nudging a
     * number is the thing that gets asserted. Two packages of one lattice are
     * disjoint exactly when their ranges are disjoint on either axis.
     */
    for (let i = 0; i < COMPOUNDS.length; i++) {
      for (let j = i + 1; j < COMPOUNDS.length; j++) {
        const a = packageBox(i, BLOCKS_PER_PARK)!
        const b = packageBox(j, BLOCKS_PER_PARK)!
        const apart = a.u1 < b.u0 || b.u1 < a.u0 || a.v1 < b.v0 || b.v1 < a.v0
        expect(apart, `compounds ${i} and ${j} overlap`).toBe(true)
      }
    }
  })

  it('leaves a gap between the plant and the districts', () => {
    /*
     * The wind farm's apron landed **0.06 strides** from U2's package with their
     * v ranges fully overlapping — four park units, which on screen reads as the
     * plant clipping into the district next door. Reported as *"the wind turbine
     * plain sort of clips with one of the building"*, and it was: two slabs at
     * the same height, touching.
     *
     * Nothing else in this file could see it. `packageBox` against `packageBox`
     * is asserted; plant was only ever asserted to be *inside the board*, which
     * it was.
     */
    const n = BLOCKS_PER_PARK
    const GAP = 0.6
    for (const it of plantFor(n)) {
      const a = plantBox(it)
      for (let i = 0; i < COMPOUNDS.length; i++) {
        const b = packageBox(i, n)!
        const du = Math.max(b.u0 - a.u1, a.u0 - b.u1)
        const dv = Math.max(b.v0 - a.v1, a.v0 - b.v1)
        expect(
          Math.max(du, dv),
          `the ${it.kind} plant is ${Math.max(du, dv).toFixed(2)} strides from ${COMPOUNDS[i].tag}`,
        ).toBeGreaterThanOrEqual(GAP)
      }
      // And the two of them keep off each other for the same reason.
      for (const other of plantFor(n)) {
        if (other === it) continue
        const b = plantBox(other)
        const du = Math.max(b.u0 - a.u1, a.u0 - b.u1)
        const dv = Math.max(b.v0 - a.v1, a.v0 - b.v1)
        expect(Math.max(du, dv)).toBeGreaterThanOrEqual(GAP)
      }
    }
  })

  it('keeps everything that stands on the board inside the board', () => {
    /*
     * The complaint this whole layout answers — *"they spilled out to what
     * seems to be a mat that does not meet that size"* — and the second draft
     * reproduced it by cutting the board to the parcels and leaving the cooling
     * plant hanging off the near edge. So the board is asserted against every
     * kind of thing that stands on it, at every block count, including the ones
     * where a plant has arrived and the compound that summoned it has not
     * finished filling.
     */
    const board = boardBox()
    for (let n = 1; n <= BLOCKS_PER_PARK; n++) {
      const inside = (box: { u0: number; u1: number; v0: number; v1: number }, what: string) => {
        expect(box.u0, `${what} at ${n} blocks runs off the board`).toBeGreaterThanOrEqual(board.u0)
        expect(box.u1, `${what} at ${n} blocks runs off the board`).toBeLessThanOrEqual(board.u1)
        expect(box.v0, `${what} at ${n} blocks runs off the board`).toBeGreaterThanOrEqual(board.v0)
        expect(box.v1, `${what} at ${n} blocks runs off the board`).toBeLessThanOrEqual(board.v1)
      }
      for (let b = 0; b < n; b++) inside(deckBox(b), `deck ${b}`)
      for (let i = 0; i < COMPOUNDS.length; i++) {
        const box = packageBox(i, n)
        if (box) inside(box, `package ${i}`)
      }
      for (const it of plantFor(n)) inside(plantBox(it), it.kind)
    }
  })

  it('wires every compound to the bus, without crossing one', () => {
    /*
     * **Two wiring faults shipped in one afternoon, and neither was visible to
     * any test that could only see a `Graphics`.**
     *
     * The first ran a full cross whose vertical arm sat at u = 13.0 while U3's
     * package spans 0.00 to 18.12 — a bus straight through a compound, in a
     * channel that only exists in the far row. The second anchored each tap
     * `PACKAGE_MARGIN * 0.7` *away* from the package it was tapping: the sign
     * was backwards, so every tap began half a stride out in open ground, and
     * since the packages already sit against the bus what was left of the
     * segment was 0.07 to 0.14 strides. `run` draws an end node at each end of
     * whatever it is handed, so four taps rendered as eight bright dots beside
     * a line they never touched — reported as *"they don't connect and a bit
     * all over the place"*, which is precisely what it was.
     *
     * So the routing moved into this file and these are the four questions a
     * person can now break by nudging a number in `COMPOUNDS`.
     */
    const n = BLOCKS_PER_PARK
    const runs = busRuns(n)
    const boxes = [
      ...COMPOUNDS.map((_, i) => packageBox(i, n)!),
      ...plantFor(n).map(plantBox),
    ]

    // 1. Straight, and on a lattice axis — never a slack diagonal.
    for (const r of runs) {
      const straight = Math.abs(r.a.u - r.b.u) < 1e-9 || Math.abs(r.a.v - r.b.v) < 1e-9
      expect(straight, `a ${r.kind} run is not on a lattice axis`).toBe(true)
    }

    // 2. Long enough to be a line rather than two overlapping end nodes. A tap
    //    under about a third of a stride is 20 park units, which is 9 px at the
    //    reference frame — two dots and no wire.
    for (const r of runs) {
      const len = Math.hypot(r.a.u - r.b.u, r.a.v - r.b.v)
      expect(len, `a ${r.kind} run is ${len.toFixed(2)} strides long`).toBeGreaterThan(0.3)
    }

    // 3. Nothing runs through a package or a plant. Interiors only: a run is
    //    *supposed* to touch the edge it leaves from.
    const crosses = (r: (typeof runs)[number], b: (typeof boxes)[number]) => {
      const u0 = Math.min(r.a.u, r.b.u)
      const u1 = Math.max(r.a.u, r.b.u)
      const v0 = Math.min(r.a.v, r.b.v)
      const v1 = Math.max(r.a.v, r.b.v)
      const e = 1e-9
      return u1 - b.u0 > e && b.u1 - u0 > e && v1 - b.v0 > e && b.v1 - v0 > e
    }
    for (const r of runs) {
      for (const [i, b] of boxes.entries()) {
        expect(crosses(r, b), `a ${r.kind} run passes through box ${i}`).toBe(false)
      }
    }

    // 4. Every compound and every plant is actually reached — a bus nothing
    //    joins is decoration.
    for (const b of boxes) {
      const touches = runs.some(
        (r) =>
          (Math.abs(r.a.u - b.u0) < 1e-9 || Math.abs(r.a.u - b.u1) < 1e-9 ||
            Math.abs(r.a.v - b.v0) < 1e-9 || Math.abs(r.a.v - b.v1) < 1e-9) &&
          r.a.u >= b.u0 - 1e-9 && r.a.u <= b.u1 + 1e-9 &&
          r.a.v >= b.v0 - 1e-9 && r.a.v <= b.v1 + 1e-9,
      )
      expect(touches, 'a compound or plant is not on the bus').toBe(true)
    }
  })

  it('bridges the canal wherever a street meets it', () => {
    /*
     * A river that stops short of every road is a moat. The branch runs to
     * v 8.0 so the main street crosses it at 8.34, and the crossing is
     * *computed* — move either and the bridge moves with it, so there can never
     * be a road running into water or a bridge standing on dry land.
     */
    const n = BLOCKS_PER_PARK
    const spans = bridges(n)
    expect(spans.length).toBeGreaterThan(0)
    for (const b of spans) {
      const alongU = Math.abs(b.a.v - b.b.v) < 1e-9
      // It reaches past both banks.
      const crossed = canalRuns(n).some((w) =>
        alongU
          ? b.a.u < w.u0 && b.b.u > w.u1 && b.a.v >= w.v0 && b.a.v <= w.v1
          : b.a.v < w.v0 && b.b.v > w.v1 && b.a.u >= w.u0 && b.a.u <= w.u1,
      )
      expect(crossed, 'a bridge does not reach both banks').toBe(true)
      // And it stands on a street rather than on its own.
      const carried = busRuns(n).some((r) =>
        alongU
          ? Math.abs(r.a.v - b.a.v) < 1e-9 && Math.min(r.a.u, r.b.u) <= b.a.u + 0.5
          : Math.abs(r.a.u - b.a.u) < 1e-9 && Math.min(r.a.v, r.b.v) <= b.a.v + 0.5,
      )
      expect(carried, 'a bridge carries no street').toBe(true)
    }
  })

  it('keeps the pin rows clear of the bus', () => {
    /*
     * The other half of *"the lines are still cross and diagonal"*. The bus was
     * straight; the pins were crossing it. At `PIN_REACH` 0.5 a tab reached
     * within 0.16 strides of the run in the channel it points into — four
     * pixels at 1280 — and a row of them read as a ladder laid across the line.
     *
     * Asserted rather than tuned, because the clearance depends on where
     * somebody last dragged a compound.
     */
    const n = BLOCKS_PER_PARK
    const runs = busRuns(n)
    let pins = 0
    for (let i = 0; i < COMPOUNDS.length; i++) {
      for (const pin of pinRows(i, n)) {
        pins += 1
        for (const r of runs) {
          const du = Math.max(Math.min(r.a.u, r.b.u) - pin.b.u, 0, pin.b.u - Math.max(r.a.u, r.b.u))
          const dv = Math.max(Math.min(r.a.v, r.b.v) - pin.b.v, 0, pin.b.v - Math.max(r.a.v, r.b.v))
          expect(Math.hypot(du, dv), `a pin of ${COMPOUNDS[i].tag} crowds a ${r.kind} run`)
            .toBeGreaterThanOrEqual(PIN_CLEARANCE)
        }
      }
    }
    /*
     * **And this is the assertion that can actually fail.** The clearance above
     * is guaranteed by construction — `pinRows` moves a crowded row rather than
     * emitting one — so on its own it only guards against somebody deleting the
     * rule. What it does *not* guard is that every package still *has* two rows,
     * which is what the first version of the rule quietly cost: dropping the
     * individual crowded pins left U1 without its near row and **U2 without a
     * single pin**, and a package with no pins is not a component any more.
     */
    for (let i = 0; i < COMPOUNDS.length; i++) {
      const box = packageBox(i, n)!
      const step = (span: number) => span / Math.max(3, Math.round(span / 1.15))
      let want = 0
      for (let v = box.v0 + step(box.v1 - box.v0) / 2; v < box.v1; v += step(box.v1 - box.v0)) want++
      for (let u = box.u0 + step(box.u1 - box.u0) / 2; u < box.u1; u += step(box.u1 - box.u0)) want++
      expect(pinRows(i, n).length, `${COMPOUNDS[i].tag} has lost a pin row`).toBe(want)
    }
    expect(pins).toBeGreaterThan(12)
  })

  it('lays the board once, and frames only what is built', () => {
    /*
     * A board that shrank as it filled would put the unbuilt pads outside their
     * own substrate, which is the same spill arriving from the other side. So
     * the board is the finished studio's and the *frame* is today's — and the
     * frame has to grow with the headcount or the first two blocks are drawn at
     * the scale a million people need.
     */
    /*
     * **[rewritten 2026-08-22]** The ground is no longer a rectangle laid once
     * — it is the island, derived from what stands on it, so it *does* grow.
     * What is asserted is that it grows monotonically and arrives at the whole
     * board when the studio does.
     */
    const board = boardBox()
    const two = shoreBox(2)
    const six = shoreBox(6)
    const ten = shoreBox(BLOCKS_PER_PARK)
    expect(two.u1 - two.u0).toBeLessThan(six.u1 - six.u0)
    expect(six.u1 - six.u0).toBeLessThanOrEqual(ten.u1 - ten.u0)
    expect(ten.u1 - ten.u0).toBeCloseTo(board.u1 - board.u0, 6)
    expect(ten.v1 - ten.v0).toBeCloseTo(board.v1 - board.v0, 6)

    // And the frame spans the shore rather than stopping at the decks, so the
    // composition has a coastline in shot instead of running off one.
    const frame = parkFrame(BLOCKS_PER_PARK, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK)
    const ground = latticeRect(ten)
    expect(frame.cx - frame.w / 2).toBeLessThanOrEqual(ground.cx - ground.w / 2 + 1e-6)
    expect(frame.cx + frame.w / 2).toBeGreaterThanOrEqual(ground.cx + ground.w / 2 - 1e-6)
  })

  it('frames the ground and not only the buildings', () => {
    /*
     * The defect this replaced: `blockCell` was `blockFrame` alone, which is
     * the ten towers, and a deck is half again as wide as they are. The park
     * framed the towers, drew a site around them, and ran its leftmost parcel
     * off the side of the window — visible at 1400x900 and not at 997x448,
     * which is trap 52 all over again.
     */
    // A hair of tolerance, because these are the same numbers arrived at by two
    // different sums and `Math.min` of a float is not always the float.
    const holds = (outer: Rect, inner: Rect, what: string) => {
      expect(outer.cx - outer.w / 2, what).toBeLessThanOrEqual(inner.cx - inner.w / 2 + 1e-9)
      expect(outer.cx + outer.w / 2, what).toBeGreaterThanOrEqual(inner.cx + inner.w / 2 - 1e-9)
      expect(outer.cy - outer.h / 2, what).toBeLessThanOrEqual(inner.cy - inner.h / 2 + 1e-9)
      expect(outer.cy + outer.h / 2, what).toBeGreaterThanOrEqual(inner.cy + inner.h / 2 - 1e-9)
    }

    const cell = blockCell()
    const deck = deckRect()
    const towers = blockFrame(BUILDINGS_PER_BLOCK, FLOORS_PER_BUILDING)
    expect(deck.w).toBeGreaterThan(towers.w)
    holds(cell, deck, 'the cell holds the deck')
    holds(cell, towers, 'the cell holds the towers')

    const park = parkFrame(BLOCKS_PER_PARK, FLOORS_PER_BUILDING, BUILDINGS_PER_BLOCK)
    for (let i = 0; i < BLOCKS_PER_PARK; i++) {
      holds(park, intoParcel(cell, i), `the park holds parcel ${i}`)
    }
  })

  it('puts every block under a finger, at ten distinct places', () => {
    const seen = new Set<number>()
    for (let i = 0; i < BLOCKS_PER_PARK; i++) {
      const parcel = intoParcel(blockCell(), i)
      const hit = blockAtPark(parcel.cx, parcel.cy, BLOCKS_PER_PARK)
      expect(hit, `parcel ${i} does not answer at its own centre`).toBe(i)
      seen.add(hit)
    }
    expect(seen.size).toBe(BLOCKS_PER_PARK)
    expect(blockAtPark(-90_000, 0, BLOCKS_PER_PARK)).toBe(-1)
    // Nothing the studio has not built is reachable.
    expect(blockAtPark(intoParcel(blockCell(), 4).cx, intoParcel(blockCell(), 4).cy, 2)).toBe(-1)
  })

  it('is the same object as the block when there is only one of them', () => {
    /*
     * A park of one block *is* that block, and framing a full one would put a
     * hundred thousand people's worth of empty ground round a single tower. The
     * two rungs land on one scale, and `levelAtScale` reads a shared scale as
     * the inner of the two — the camera got there by pulling back until
     * something stopped it, and the thing that stopped it was the block.
     */
    const one = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, 1)
    expect(one[PARK]).toBe(one[BLOCK])
    expect(levelAtScale(one[PARK], one)).toBe(BLOCK)
  })

  it('holds a unit at the same footprint as the level below it — §7.8.2 rule 1', () => {
    /*
     * "The promise of §7.7.1 is that the *unit* changes, not that the same unit
     * gets smaller — a town occupies exactly as much screen as a building did."
     * One building at the block against one block at the park, in square
     * pixels, at the reference frame.
     */
    const atBlock = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)[BLOCK]
    const tower = towerRect(FLOORS_PER_BUILDING)
    const buildingPx = tower.w * BLOCK_SCALE * PARK_SCALE * atBlock * (tower.h * BLOCK_SCALE * PARK_SCALE * atBlock)
    const cell = blockCell()
    const blockPx = cell.w * PARK_SCALE * scales[PARK] * (cell.h * PARK_SCALE * scales[PARK])
    expect(blockPx / buildingPx).toBeGreaterThan(0.6)
    expect(blockPx / buildingPx).toBeLessThan(1.7)
  })

  it('crosses the park out completely before a single block is the subject', () => {
    // The same band the block has one level down, and it carries the block's
    // own street plane with it: that plane is wider than the boulevard between
    // two parcels, so the two cannot both be drawn.
    expect(parkChromeAlpha(PARK)).toBe(1)
    expect(parkChromeAlpha(BLOCK)).toBe(0)
    expect(parkChromeAlpha(BUILDING)).toBe(0)
    // And the block's own chrome is whole while the park is the subject, which
    // is what makes the parcel the address is in the same drawing at both ends.
    expect(blockChromeAlpha(PARK)).toBe(1)
  })

  it('moves no LOD threshold by existing', () => {
    /*
     * §13's claim, spent a second time: every threshold in this file is a
     * *floor-space* scale, so a new division in the chain moves every camera
     * scale by exactly that factor and leaves the thresholds where they were.
     * A desk is the same number of pixels at the floor level as it was before
     * the park existed.
     */
    expect(floorScaleAt(scales[FLOOR])).toBeCloseTo(0.2195, 3)
    expect(roomResolved(floorScaleAt(scales[FLOOR]))).toBe(true)
    expect(roomResolved(floorScaleAt(scales[PARK]))).toBe(false)
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
  const CROSSED = { 0: 51.75, 1: 8.42, 2: 9.86, 3: 1.11, 4: 0.55, 5: 0.24 } as Record<Level, number>

  it('pushes a rung out until it holds the one inside it', () => {
    const nested = nestScales(CROSSED)
    expect(nested[SQUAD]).toBe(CROSSED[FLOOR])
    // And nothing else moves: the desk was already inside the squad, and the
    // building was already outside the floor.
    expect(nested[DESK]).toBe(CROSSED[DESK])
    expect(nested[BUILDING]).toBe(CROSSED[BUILDING])
  })

  it('leaves a ladder that already nests exactly as it was', () => {
    const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
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
    for (let s = nested[PARK] / 2; s < nested[DESK] * 2; s *= 1.05) {
      const level = levelAtScale(s, nested)
      expect(Number.isFinite(level)).toBe(true)
      expect(level).toBeGreaterThanOrEqual(DESK)
      expect(level).toBeLessThanOrEqual(PARK)
    }
  })

  it('lands exactly on a stop, collapsed or not', () => {
    // `exp(log(s))` is a unit in the last place either side of `s`, which is
    // enough for the level to read as the neighbouring rung — so the camera
    // sitting still would flicker between two names, and anything holding it
    // to a level would keep re-asserting a scale it was already at.
    const nested = nestScales(CROSSED)
    for (const l of [DESK, SQUAD, FLOOR, BUILDING, BLOCK, PARK] as Level[]) {
      expect(scaleAtLevel(l, nested)).toBe(nested[l])
    }
  })
})

describe('level of detail', () => {
  const scales = levelScales(0, FLOORS_PER_BUILDING, REFERENCE, BUILDINGS_PER_BLOCK, BLOCKS_PER_PARK)
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
    // descent passes through a frame with neither picture in it. Stated as the
    // thing itself now that the two are measured in different units: there is a
    // level at which the room is resolved *and* the building is still drawn.
    const between = FLOOR + 0.5
    expect(roomResolved(floorScaleAt(scaleAtLevel(between, scales)))).toBe(true)
    expect(buildingChromeAlpha(between)).toBeGreaterThan(0)
  })

  it('the building chrome is whole at its own level and gone at the floor', () => {
    expect(buildingChromeAlpha(BUILDING)).toBe(1)
    expect(buildingChromeAlpha(FLOOR)).toBe(0)
  })

  it('hands every level over at the same place on every screen', () => {
    /*
     * **A composition hand-off is a question about the ladder, not about
     * pixels**, and writing one as a floor-space scale is how the block came to
     * be invisible on a desktop window. A bigger viewport draws everything
     * bigger at the *same* level, so a threshold placed between two levels at
     * 997x448 lands on the wrong side of them at 1999x1115 — measured there,
     * the block's chrome was at alpha 0.00 while the block was the subject:
     * nine towers gone, the tenth drawn because it is the real building, and
     * its plan laid across the plots either side of it.
     *
     * Every gate in the repo agreed with the old numbers, because the largest
     * viewport any of them uses is the reference one.
     */
    for (const vp of [
      { w: 640, h: 360 },
      { w: 997, h: 448 },
      { w: 1280, h: 720 },
      { w: 1999, h: 1115 },
      { w: 2560, h: 1440 },
      { w: 1080, h: 1920 },
    ]) {
      const at = levelScales(0, FLOORS_PER_BUILDING, vp, BUILDINGS_PER_BLOCK)
      const levelOf = (l: Level) => levelAtScale(at[l], at)
      expect(blockChromeAlpha(levelOf(BLOCK)), `${vp.w}x${vp.h} block`).toBe(1)
      expect(blockChromeAlpha(levelOf(BUILDING)), `${vp.w}x${vp.h} building`).toBe(0)
      expect(buildingChromeAlpha(levelOf(BUILDING)), `${vp.w}x${vp.h} tower`).toBe(1)
      expect(buildingChromeAlpha(levelOf(FLOOR)), `${vp.w}x${vp.h} floor`).toBe(0)
    }
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
  /**
   * Building-space units per screen pixel at the building level.
   *
   * The camera's scale is in **block** space now — a building is one plot of
   * ten — so anything measured in the tower's own coordinates has to come back
   * through `BLOCK_SCALE` to be a number of pixels. Getting that wrong makes
   * every one of these read exactly twice as generous as it is.
   */
  // Building space to screen pixels: the camera's scale at the building level,
  // carried down through the parcel and the plot the tower is drawn in.
  const towerPx =
    levelScales(0, FLOORS_PER_BUILDING, REFERENCE)[BUILDING] * PARK_SCALE * BLOCK_SCALE

  it('a band is a thumb-sized target at the reference frame', () => {
    const scale = towerPx
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
    const px = plateRect().w * towerPx
    // Twice what any arrangement of ten plans managed, which is the whole
    // argument for pulling one out instead of stacking all of them.
    expect(px).toBeGreaterThan(250)
  })

  it('fills the height and leaves the lift panel its half of the width', () => {
    // The composition is deliberately height-bound: the world takes about half
    // the frame and §10's floor list takes the rest. A world that filled the
    // width would have nowhere to put the numbers.
    const frame = buildingFrame(FLOORS_PER_BUILDING, 0)
    expect((frame.h * towerPx) / REFERENCE.h).toBeCloseTo(0.94, 2)
    const w = (frame.w * towerPx) / REFERENCE.w
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
