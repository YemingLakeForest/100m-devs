import { describe, expect, it } from 'vitest'
import {
  CARRIAGEWAY,
  FOOTWAY,
  FORECOURT,
  KERB,
  districtDepth,
  districtFitTiles,
  skylineSetback,
} from './district.ts'

describe('districtDepth', () => {
  it('gives the garage a drive, a kerb and one carriageway', () => {
    // §7.8.1's first frame is a two-desk garage. Anything less than this and the
    // ground reads as a shelf the building is standing on.
    expect(districtDepth(3, 3)).toBeGreaterThanOrEqual(6.3)
  })

  it('grows with the room and then stops', () => {
    // The road is the same road at every headcount — that is the whole idea the
    // district exists to carry. So it must not scale forever, or a floor of a
    // thousand gets a forty-tile motorway nobody asked for.
    const garage = districtDepth(3, 3)
    const floor = districtDepth(30, 40)
    const absurd = districtDepth(300, 400)
    expect(floor).toBeGreaterThan(garage)
    expect(absurd).toBe(floor)
    expect(absurd).toBeLessThanOrEqual(15)
  })

  it('is monotonic in the room it rings', () => {
    let last = 0
    for (let span = 1; span < 120; span += 3) {
      const d = districtDepth(span, span)
      expect(d).toBeGreaterThanOrEqual(last)
      last = d
    }
  })

  it('lays the four bands out in order and leaves a carriageway', () => {
    // The bands are fractions of one depth and the far footway is the
    // remainder. If any pair crossed, the kerb would be in the road.
    expect(FORECOURT).toBeLessThan(KERB)
    expect(KERB).toBeLessThan(FOOTWAY)
    expect(FOOTWAY).toBeLessThan(CARRIAGEWAY)
    expect(CARRIAGEWAY).toBeLessThan(1)
  })
})

describe('the far side is shallower than the near one — §7.8.1e', () => {
  it('sets the neighbours back about half as far', () => {
    // Seen almost edge-on and foreshortened into the top corners of the frame,
    // so every tile of tarmac up there is a tile of skyline pushed out of shot.
    // A service lane and a footway is enough road to read.
    for (const span of [3, 12, 40, 400]) {
      const back = skylineSetback(span, span)
      const near = districtDepth(span, span)
      expect(back).toBeLessThan(near)
      expect(back).toBeGreaterThan(near * 0.3)
    }
  })

  it('still leaves the garage room for a street behind it', () => {
    // The smallest room in the game has to have somewhere for the city to
    // stand, or the immersion arrives only once the studio is big.
    expect(skylineSetback(3, 3)).toBeGreaterThan(2.5)
  })
})

describe('districtFitTiles', () => {
  it('never asks the camera for the whole district', () => {
    // Framing all of it would shrink a full floor by about a fifth to show a
    // road nobody is looking at. The forecourt and the kerb are what read as
    // "standing on something"; the carriageway is allowed to bleed off frame.
    for (const span of [3, 8, 20, 60, 400]) {
      expect(districtFitTiles(span, span)).toBeLessThan(districtDepth(span, span))
    }
  })

  it('is capped, so the frame does not grow with the studio', () => {
    expect(districtFitTiles(400, 400)).toBeLessThanOrEqual(3.6)
    expect(districtFitTiles(400, 400)).toBe(districtFitTiles(60, 60))
  })

  it('still gives the smallest garage some ground to stand on', () => {
    expect(districtFitTiles(3, 3)).toBeGreaterThan(1)
  })

  it('costs the room a sliver of fill, not a fifth of it', () => {
    // The whole price of the section, stated as a number: at a full floor the
    // pad is a few per cent of the width, not the twenty per cent that framing
    // the road would have cost.
    const fullFloorHalfWidth = 60
    expect(districtFitTiles(30, fullFloorHalfWidth) / fullFloorHalfWidth).toBeLessThan(0.08)
  })
})
