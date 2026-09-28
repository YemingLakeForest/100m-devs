/**
 * The storeys across the lane — GDD §7.7.2, §7.8.1c [2026-09-28].
 *
 * 禁止穿模 is checked by looking, and it was (the close-ups of a storey at a
 * thousand developers). What can be pinned without a renderer is the plan the
 * picture is drawn from: a hundred seats, each on its own slab, no two desks on
 * the same floor, and the lift standing where no pod does. A layout edit that
 * breaks any of those draws furniture through furniture, which is exactly the
 * defect nobody can see in a unit test's output and everybody can see on screen.
 */

import { describe, expect, it } from 'vitest'
import { LANE_LOT, STOREY_SEATS, laneSeat } from './laneStoreys.ts'

/** A desk's footprint in lot coordinates: `craftedSingleDesk`'s top, turned to the seat. */
function deskOf(i: number) {
  const s = laneSeat(i)
  // The desk group is turned by facing + π and its top is centred 0.72 m along
  // its own +z. A turn of θ about y sends local +z to (sin θ, cos θ), so facing
  // π puts the desk at +z of the seat and facing 0 at −z: in front of a person
  // whose face is on their own −z.
  const along = s.facing === 0 ? -1 : 1
  return { x: s.x, z: s.z + along * 0.72, hw: 0.82, hd: 0.44 }
}

const overlaps = (a: { x: number; z: number; hw: number; hd: number }, b: { x: number; z: number; hw: number; hd: number }) =>
  Math.abs(a.x - b.x) < a.hw + b.hw - 0.01 && Math.abs(a.z - b.z) < a.hd + b.hd - 0.01

describe('a storey across the lane', () => {
  it('seats a hundred, the garage’s pods of four at the garage’s spacing', () => {
    const seats = Array.from({ length: STOREY_SEATS }, (_, i) => laneSeat(i))
    expect(new Set(seats.map((s) => `${s.x.toFixed(2)},${s.z.toFixed(2)}`)).size).toBe(STOREY_SEATS)
    // Pod mates sit 1.84 apart along the pod and 2.76 across it, as in the garage.
    expect(Math.abs(seats[1].x - seats[0].x)).toBeCloseTo(1.84, 5)
    expect(Math.abs(seats[2].z - seats[0].z)).toBeCloseTo(2.76, 5)
  })

  it('puts every seat, desk and chair on the slab, inside its walls', () => {
    const inX = LANE_LOT.w / 2 - 0.3
    const inZ = LANE_LOT.d / 2 - 0.3
    for (let i = 0; i < STOREY_SEATS; i++) {
      const s = laneSeat(i)
      const d = deskOf(i)
      // The chair's back stands about half a metre behind the seat, away from the desk.
      const back = s.z + (s.facing === 0 ? 1 : -1) * 0.55
      for (const [x, z] of [[s.x, s.z], [s.x, back], [d.x - d.hw, d.z - d.hd], [d.x + d.hw, d.z + d.hd]]) {
        expect(Math.abs(x)).toBeLessThan(inX)
        expect(Math.abs(z)).toBeLessThan(inZ)
      }
    }
  })

  it('never stands a desk on another desk', () => {
    const desks = Array.from({ length: STOREY_SEATS }, (_, i) => deskOf(i))
    for (let a = 0; a < desks.length; a++) {
      for (let b = a + 1; b < desks.length; b++) expect(overlaps(desks[a], desks[b])).toBe(false)
    }
  })

  it('keeps the lift out of every pod', () => {
    // The lift fills the back row's last two slots: 3.4 × 3.2 m, centred there.
    const lift = { x: 3.5 * 3.9, z: -4.35 - 0.6, hw: 1.7, hd: 1.6 }
    for (let i = 0; i < STOREY_SEATS; i++) {
      expect(overlaps(lift, deskOf(i))).toBe(false)
      const s = laneSeat(i)
      expect(overlaps(lift, { x: s.x, z: s.z, hw: 0.4, hd: 0.4 })).toBe(false)
    }
  })

  it('faces everybody at their own desk, across the pod', () => {
    for (let i = 0; i < STOREY_SEATS; i++) {
      const s = laneSeat(i)
      const pod = Math.floor(i / 4)
      const mate = laneSeat(pod * 4 + ((i % 4) + 2) % 4)
      // Facing each other across the pod: opposite facings, and each one's desk
      // lies between them.
      expect(s.facing).not.toBe(mate.facing)
      const d = deskOf(i)
      expect(Math.sign(d.z - s.z)).toBe(Math.sign(mate.z - s.z))
    }
  })
})
