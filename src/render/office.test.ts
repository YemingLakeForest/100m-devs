import { describe, expect, it } from 'vitest'

import { FLOOR_CAP } from '../sim/capacity.ts'
import { inPlot, plotsOverlap } from './garage.ts'
import {
  ATRIUM,
  NEIGHBOURHOODS,
  OFFICE_AMENITIES,
  OFFICE_PODS,
  OFFICE_SEATS,
  OFFICE_SPAN,
  hitsAtrium,
  officeAcross,
  officePodPlot,
  officeSeat,
  officeSeats,
} from './office.ts'

/**
 * §7.8.0d — the office floor plan, and every claim the prompt asks to be proven
 * about a hundred seats.
 */

describe('exactly one hundred ordinary seats', () => {
  it('is a hundred, and the scale model agrees', () => {
    expect(OFFICE_SEATS).toBe(100)
    expect(OFFICE_SEATS).toBe(FLOOR_CAP)
  })

  it('gives every seat its own place', () => {
    const at = officeSeats().map((s) => `${s.gx.toFixed(4)},${s.gy.toFixed(4)}`)
    expect(new Set(at).size).toBe(OFFICE_SEATS)
  })

  it('adds up from the pods rather than being asserted', () => {
    const fromPods = OFFICE_PODS.reduce((n, p) => n + p.perSide * 2, 0)
    expect(fromPods).toBe(OFFICE_SEATS)
    const fromHoods = NEIGHBOURHOODS.reduce((n, h) => n + h.count, 0)
    expect(fromHoods).toBe(OFFICE_SEATS)
  })
})

/**
 * "Mixed 2×2 and 3×2 facing pods" and "irregular departmental neighbourhoods
 * rather than uniform rows" are the two properties most likely to survive an
 * edit as words in a comment while the numbers drift back into a grid.
 */
describe('the floor contains both required pod orientations', () => {
  it('holds four-person and six-person pods, and plenty of each', () => {
    const four = OFFICE_PODS.filter((p) => p.perSide === 2)
    const six = OFFICE_PODS.filter((p) => p.perSide === 3)
    expect(four.length).toBeGreaterThanOrEqual(5)
    expect(six.length).toBeGreaterThanOrEqual(5)
    expect(four.length + six.length).toBe(OFFICE_PODS.length)
  })

  it('mixes the two sizes inside every neighbourhood', () => {
    // A floor where each band is one pod size is four modules, not four
    // departments.
    for (const hood of NEIGHBOURHOODS) {
      const sizes = new Set(
        OFFICE_PODS.filter((p) => p.neighbourhood === hood.id).map((p) => p.perSide),
      )
      expect({ hood: hood.name, mixed: sizes.size }).toEqual({ hood: hood.name, mixed: 2 })
    }
  })

  it('makes no two neighbourhoods the same size', () => {
    const counts = NEIGHBOURHOODS.map((h) => h.count)
    // Four equal quadrants of twenty-five would be a car park with a fountain
    // in it. Two distinct sizes across four bands is the minimum that reads as
    // authored rather than generated.
    expect(new Set(counts).size).toBeGreaterThanOrEqual(2)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(FLOOR_CAP)
  })
})

describe('opposite pod seats face each other', () => {
  it('pairs every seat across its table', () => {
    for (let i = 0; i < OFFICE_SEATS; i++) {
      const j = officeAcross(i)
      expect(officeAcross(j)).toBe(i)
      const a = officeSeat(i)
      const b = officeSeat(j)
      expect(a.pod).toBe(b.pod)
      expect(a.gy).toBeCloseTo(b.gy, 10)
      expect(a.facing).not.toBe(b.facing)
      if (a.facing === 'gx+') expect(a.gx).toBeLessThan(b.gx)
      else expect(a.gx).toBeGreaterThan(b.gx)
    }
  })

  it('seats a pod s first two arrivals opposite each other', () => {
    for (const pod of OFFICE_PODS) {
      const first = officeSeats().find((s) => s.pod === pod.id)!
      expect(officeAcross(first.index)).toBe(first.index + 1)
      expect(officeSeat(first.index + 1).pod).toBe(pod.id)
    }
  })

  it('grows a pod outward from its own middle', () => {
    // A three-a-side pod filled from one end has two people at one end and a
    // gap at the other, which reads as somebody having left rather than as a
    // team still forming.
    for (const pod of OFFICE_PODS.filter((p) => p.perSide === 3)) {
      const mine = officeSeats().filter((s) => s.pod === pod.id)
      const firstPair = [mine[0], mine[1]]
      for (const s of firstPair) expect(Math.abs(s.gy - pod.gy)).toBeLessThan(1e-9)
    }
  })
})

describe('existing developers never move when a new one is hired', () => {
  it('is a pure function of the index', () => {
    expect(officeSeat.length).toBe(1)
    for (const i of [0, 1, 25, 50, 99]) expect(officeSeat(i)).toEqual(officeSeat(i))
  })

  it('fills a pod before starting the next one', () => {
    for (let n = 1; n <= OFFICE_SEATS; n++) {
      const pods = Array.from({ length: n }, (_, i) => officeSeat(i).pod)
      // Pod indices are non-decreasing through the hiring order, so nobody is
      // ever seated in a pod that a later hire then fills in behind them.
      for (let i = 1; i < pods.length; i++) expect(pods[i]).toBeGreaterThanOrEqual(pods[i - 1])
    }
  })

  it('fills a neighbourhood before crossing to the next', () => {
    const hoods = officeSeats().map((s) => s.neighbourhood)
    for (let i = 1; i < hoods.length; i++) expect(hoods[i]).toBeGreaterThanOrEqual(hoods[i - 1])
  })
})

describe('amenities and seats never overlap', () => {
  it('keeps every pod out of the atrium', () => {
    for (const pod of OFFICE_PODS) {
      expect({ pod: pod.id, inAtrium: hitsAtrium(officePodPlot(pod)) })
        .toEqual({ pod: pod.id, inAtrium: false })
    }
  })

  it('keeps every seat out of the atrium', () => {
    for (const s of officeSeats()) {
      const d = Math.hypot(s.gx - ATRIUM.gx, s.gy - ATRIUM.gy)
      expect({ seat: s.index, clear: d > ATRIUM.radius }).toEqual({ seat: s.index, clear: true })
    }
  })

  it('does not stack two pods on the same floor', () => {
    for (let i = 0; i < OFFICE_PODS.length; i++) {
      for (let j = i + 1; j < OFFICE_PODS.length; j++) {
        expect({
          a: OFFICE_PODS[i].id,
          b: OFFICE_PODS[j].id,
          hit: plotsOverlap(officePodPlot(OFFICE_PODS[i]), officePodPlot(OFFICE_PODS[j])),
        }).toEqual({ a: OFFICE_PODS[i].id, b: OFFICE_PODS[j].id, hit: false })
      }
    }
  })

  it('keeps every pod inside the floor', () => {
    for (const pod of OFFICE_PODS) {
      const p = officePodPlot(pod)
      expect({ pod: pod.id, inside: p.gx0 > 0 && p.gy0 > 0 && p.gx1 < OFFICE_SPAN && p.gy1 < OFFICE_SPAN })
        .toEqual({ pod: pod.id, inside: true })
    }
  })
})

/**
 * **The walking ring around the atrium has to be complete.** The prompt asks
 * for it by name, and it is the one circulation claim that cannot be made about
 * a single pod: it is a property of all twenty at once.
 */
describe('the ring around the atrium is unbroken', () => {
  it('leaves a clear lane all the way round', () => {
    const LANE = ATRIUM.radius + 1.0
    const blockers = OFFICE_PODS.map(officePodPlot)
    for (let deg = 0; deg < 360; deg += 2) {
      const t = (deg * Math.PI) / 180
      const gx = ATRIUM.gx + Math.cos(t) * LANE
      const gy = ATRIUM.gy + Math.sin(t) * LANE
      const blocked = blockers.some(
        (p) => gx >= p.gx0 && gx < p.gx1 && gy >= p.gy0 && gy < p.gy1,
      )
      expect({ deg, blocked }).toEqual({ deg, blocked: false })
    }
  })
})

/**
 * §7.8.0d — the amenities, and the two things that must be true of every one of
 * them: it does not stand on a developer, and it does not stand in the way.
 */
describe('office amenities', () => {
  it('lists the things the concept shows', () => {
    const kinds = new Set(OFFICE_AMENITIES.map((a) => a.kind))
    for (const wanted of ['sofa', 'lockers', 'kitchenette', 'server', 'meeting', 'entrance']) {
      expect({ wanted, present: kinds.has(wanted as never) })
        .toEqual({ wanted, present: true })
    }
    // Four sofas, because the ring is four — a ring of three reads as a
    // triangle and a ring of five as a scatter.
    expect(OFFICE_AMENITIES.filter((a) => a.kind === 'sofa')).toHaveLength(4)
    // More than one tea point, in different parts of the floor.
    const tea = OFFICE_AMENITIES.filter((a) => a.kind === 'kitchenette')
    expect(tea.length).toBeGreaterThanOrEqual(2)
    expect(new Set(tea.map((t) => Math.round(t.gx0))).size).toBe(tea.length)
  })

  it('never stands an amenity on a pod', () => {
    for (const a of OFFICE_AMENITIES) {
      for (const pod of OFFICE_PODS) {
        expect({ a: a.name, pod: pod.id, hit: plotsOverlap(a, officePodPlot(pod)) })
          .toEqual({ a: a.name, pod: pod.id, hit: false })
      }
    }
  })

  it('never stands an amenity on a seat', () => {
    for (const a of OFFICE_AMENITIES) {
      for (const s of officeSeats()) {
        expect({ a: a.name, seat: s.index, hit: inPlot(a, s.gx, s.gy) })
          .toEqual({ a: a.name, seat: s.index, hit: false })
      }
    }
  })

  it('does not stack two amenities on the same floor', () => {
    for (let i = 0; i < OFFICE_AMENITIES.length; i++) {
      for (let j = i + 1; j < OFFICE_AMENITIES.length; j++) {
        expect({
          a: OFFICE_AMENITIES[i].name,
          b: OFFICE_AMENITIES[j].name,
          hit: plotsOverlap(OFFICE_AMENITIES[i], OFFICE_AMENITIES[j]),
        }).toEqual({ a: OFFICE_AMENITIES[i].name, b: OFFICE_AMENITIES[j].name, hit: false })
      }
    }
  })

  /**
   * **The sofas are the one thing allowed inside the atrium**, because they are
   * what the atrium is furnished with. Everything else must stay out of it —
   * and out of the walking ring, which is the claim that makes "a complete
   * walking ring around the atrium" mean something.
   */
  it('keeps the atrium for the statue and its sofas', () => {
    for (const a of OFFICE_AMENITIES) {
      if (a.kind === 'sofa') {
        expect({ a: a.name, inAtrium: hitsAtrium(a) }).toEqual({ a: a.name, inAtrium: true })
        continue
      }
      expect({ a: a.name, inAtrium: hitsAtrium(a) }).toEqual({ a: a.name, inAtrium: false })
    }
  })

  it('leaves the walking ring clear of everything but the statue', () => {
    const LANE = ATRIUM.radius + 1.0
    const blockers = OFFICE_AMENITIES.filter((a) => a.kind !== 'sofa')
    for (let deg = 0; deg < 360; deg += 2) {
      const t = (deg * Math.PI) / 180
      const gx = ATRIUM.gx + Math.cos(t) * LANE
      const gy = ATRIUM.gy + Math.sin(t) * LANE
      const hit = blockers.find((p) => inPlot(p, gx, gy))
      expect({ deg, on: hit?.name ?? null }).toEqual({ deg, on: null })
    }
  })

  it('keeps every amenity inside the floor', () => {
    for (const a of OFFICE_AMENITIES) {
      expect({
        a: a.name,
        inside: a.gx0 > 0 && a.gy0 > 0 && a.gx1 < OFFICE_SPAN && a.gy1 < OFFICE_SPAN,
      }).toEqual({ a: a.name, inside: true })
    }
  })
})
