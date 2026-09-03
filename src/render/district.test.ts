import { describe, expect, it } from 'vitest'
import {
  CARRIAGEWAY,
  FOOTWAY,
  FORECOURT,
  FRONTAGE_LAMPS,
  KERB,
  PLANTERS_PER_LAMP,
  RETURN_LAMPS,
  crossingSpan,
  curbStations,
  districtVehicles,
  garageRearPlan,
  districtDepth,
  districtFitTiles,
  garageKerbFor,
  garageKerbRuns,
  skylineSetback,
  type CurbRun,
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


/**
 * §7.8.0c [added 2026-09-03] — **the kerb's rhythm.**
 *
 * The canonical garage's exterior is two straight runs with one light to three
 * bushes on each, and the counts are authored rather than emergent: two lights
 * and six planters on the gate frontage, three and nine on the right return.
 * Every claim below is one sentence of that requirement, made against the
 * function the renderer actually calls.
 */
describe('the garage kerb', () => {
  const run = (over: Partial<CurbRun> = {}): CurbRun => ({
    from: 0,
    to: 40,
    lamps: FRONTAGE_LAMPS,
    exclusions: [],
    ...over,
  })

  it('puts exactly three planters on every lamp', () => {
    for (const lamps of [1, 2, 3, 5]) {
      const stations = curbStations(run({ lamps }))
      const lit = stations.filter((s) => s.kind === 'lamp')
      const green = stations.filter((s) => s.kind === 'planter')
      expect({ lamps, lit: lit.length, green: green.length })
        .toEqual({ lamps, lit: lamps, green: lamps * PLANTERS_PER_LAMP })
    }
  })

  it('repeats one lamp then three planters, in that order', () => {
    const kinds = curbStations(run({ lamps: 3 })).map((s) => s.kind)
    expect(kinds).toEqual([
      'lamp', 'planter', 'planter', 'planter',
      'lamp', 'planter', 'planter', 'planter',
      'lamp', 'planter', 'planter', 'planter',
    ])
  })

  it('spaces them evenly along the free measure', () => {
    const along = curbStations(run({ lamps: 3 })).map((s) => s.along)
    const gaps = along.slice(1).map((v, i) => v - along[i])
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 9)
  })

  /**
   * The claim the whole construction exists for. An exclusion is a driveway, a
   * threshold or a pier footprint, and the naive answer — lay a uniform pitch
   * and drop what lands in one — makes the *count* depend on where the gate
   * happens to be. Here the gap appears in the rhythm and the objects do not.
   */
  it('keeps every station out of every exclusion, without losing one', () => {
    const exclusions = [[12, 20], [26, 29]] as ReadonlyArray<readonly [number, number]>
    const stations = curbStations(run({ lamps: 3, exclusions }))
    expect(stations).toHaveLength(3 * (1 + PLANTERS_PER_LAMP))
    for (const s of stations) {
      for (const [a, b] of exclusions) {
        expect({ along: s.along, inside: s.along > a && s.along < b })
          .toEqual({ along: s.along, inside: false })
      }
    }
  })

  it('stays inside the run it was given', () => {
    for (const s of curbStations(run({ from: -6, to: 11, lamps: 2 }))) {
      expect(s.along).toBeGreaterThan(-6)
      expect(s.along).toBeLessThan(11)
    }
  })

  it('is deterministic', () => {
    const a = curbStations(run({ lamps: 3, exclusions: [[9, 14]] }))
    const b = curbStations(run({ lamps: 3, exclusions: [[9, 14]] }))
    expect(a).toEqual(b)
  })

  it('draws nothing at all if the exclusions swallow the run', () => {
    expect(curbStations(run({ lamps: 2, exclusions: [[-10, 60]] }))).toEqual([])
  })
})

/**
 * And the two runs the garage actually gets — the concept's own counts, and the
 * spans they have to miss.
 */
describe('the garage frontage and its return', () => {
  const hb = 8.63
  const ha = 8.63
  const depth = districtDepth(hb, ha)
  const back = skylineSetback(hb, ha)
  const kerb = garageKerbFor(hb, ha, { at: 1.2, width: 4.8 }, { at: 7.5, width: 1.1 }, 0.47)
  const runs = garageKerbRuns(hb, ha, depth, back, kerb)

  it('gives the frontage two lights and six planters and the return three and nine', () => {
    const front = curbStations(runs.frontage.run)
    const ret = curbStations(runs.return_.run)
    expect(front.filter((s) => s.kind === 'lamp')).toHaveLength(FRONTAGE_LAMPS)
    expect(front.filter((s) => s.kind === 'planter')).toHaveLength(FRONTAGE_LAMPS * PLANTERS_PER_LAMP)
    expect(ret.filter((s) => s.kind === 'lamp')).toHaveLength(RETURN_LAMPS)
    expect(ret.filter((s) => s.kind === 'planter')).toHaveLength(RETURN_LAMPS * PLANTERS_PER_LAMP)
  })

  /**
   * **Each side independently**, which is the half of the rule that is easy to
   * satisfy by accident and easy to break by accident: a total of five lights
   * and fifteen planters is also what you get from four and one.
   */
  it('never balances one side by borrowing from the other', () => {
    for (const side of [runs.frontage.run, runs.return_.run]) {
      const stations = curbStations(side)
      const lit = stations.filter((s) => s.kind === 'lamp').length
      const green = stations.filter((s) => s.kind === 'planter').length
      expect(green).toBe(lit * PLANTERS_PER_LAMP)
    }
  })

  it('holds one setback for a whole side', () => {
    // A single number per side, by construction — which is the claim. Stated
    // here so that turning it into a per-station offset fails a test rather
    // than quietly producing a wobbly kerb.
    expect(runs.frontage.setback).toBeGreaterThan(ha)
    expect(runs.return_.setback).toBeGreaterThan(hb)
    expect(runs.frontage.setback - ha).toBeCloseTo(runs.return_.setback - hb, 9)
  })

  it('misses the driveway, the threshold, the crossing and both piers', () => {
    const spans = [
      ...kerb.frontageExclusions.map((e) => ['frontage', e] as const),
      ...kerb.returnExclusions.map((e) => ['return', e] as const),
    ]
    for (const [side, [a, b]] of spans) {
      const stations = curbStations(side === 'frontage' ? runs.frontage.run : runs.return_.run)
      for (const s of stations) {
        expect({ side, along: s.along, inside: s.along > a && s.along < b })
          .toEqual({ side, along: s.along, inside: false })
      }
    }
  })

  it('excludes the gate driveway with a splay either side of it', () => {
    const [gate] = kerb.frontageExclusions
    expect(gate[0]).toBeLessThan(1.2)
    expect(gate[1]).toBeGreaterThan(1.2 + 4.8)
  })

  it('puts the crossing where the stripes are', () => {
    const [a, b] = crossingSpan(hb)
    expect(a).toBeLessThan(-hb * 0.1)
    expect(b).toBeGreaterThan(-hb * 0.1 + 6 * 0.34)
  })
})


/**
 * §7.8.0c [added 2026-09-03] — **no vehicle is emitted for the garage stop.**
 *
 * Stated against the list rather than against the picture, because "the frame
 * contains no vehicles" is a claim about what the renderer *produces* and a
 * screenshot cannot tell an absent car from one drawn in the dark.
 */
describe('vehicles', () => {
  it('emits none at all for the garage', () => {
    expect(
      districtVehicles({
        halfBack: 8.63,
        halfAcross: 8.63,
        garage: { frontageExclusions: [], returnExclusions: [] },
      }),
    ).toEqual([])
  })

  it('still parks the office floor s forecourt', () => {
    const cars = districtVehicles({ halfBack: 30, halfAcross: 40 })
    expect(cars.length).toBeGreaterThan(3)
  })

  it('is deterministic, so the street does not reshuffle on every hire', () => {
    expect(districtVehicles({ halfBack: 30, halfAcross: 40 }))
      .toEqual(districtVehicles({ halfBack: 30, halfAcross: 40 }))
  })
})


/**
 * §7.8.0c [added 2026-09-03] — **the neighbourhood behind the rear walls.**
 *
 * Three claims, and the third is the one that matters: the band is scenery. It
 * is behind both full-height rear walls by construction, so nothing in it can
 * stand on the floor, block a lane or take a tap — which is why the drawing
 * needs no clearance rule and why this asserts the geometry instead.
 */
describe('the garage rear band', () => {
  const hb = 8.63
  const ha = 8.63
  const back = 3.71

  it('is not empty, and has all three depth bands in it', () => {
    const plan = garageRearPlan(hb, ha, back)
    expect(plan.length).toBeGreaterThan(20)
    for (const band of ['shrub', 'tree', 'building'] as const) {
      expect({ band, some: plan.some((prop) => prop.band === band) })
        .toEqual({ band, some: true })
    }
    // Trees are the mass: more of them than of either other band.
    const count = (b: string) => plan.filter((prop) => prop.band === b).length
    expect(count('tree')).toBeGreaterThan(count('shrub'))
    expect(count('tree')).toBeGreaterThan(count('building'))
  })

  it('is deterministic, so the street does not reshuffle on every hire', () => {
    expect(garageRearPlan(hb, ha, back)).toEqual(garageRearPlan(hb, ha, back))
  })

  /**
   * **Everything is behind a rear wall.** The two rear walls stand at `gx =
   * -hb` and `gy = -ha`; a prop is behind one of them when it is outside that
   * line on the axis its run is set back along. Nothing may be inside both, and
   * inside both is exactly the playable floor.
   */
  it('never puts anything on the playable floor', () => {
    for (const prop of garageRearPlan(hb, ha, back)) {
      const behind = prop.gx < -hb || prop.gy < -ha
      expect({ band: prop.band, gx: prop.gx, gy: prop.gy, behind })
        .toEqual({ band: prop.band, gx: prop.gx, gy: prop.gy, behind: true })
    }
  })

  /**
   * And it stays low. A rear band taller than the wall it stands behind is not
   * behind it any more — it is over the roofline, and the garage stops being
   * the tallest thing in its own picture.
   */
  it('keeps the buildings lower than the rear wall they stand behind', () => {
    for (const prop of garageRearPlan(hb, ha, back)) {
      if (prop.band !== 'building') continue
      expect(prop.height).toBeLessThan(4.23)
    }
  })
})
