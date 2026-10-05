import { describe, expect, it } from 'vitest'
import {
  GARAGE_DECK,
  GARAGE_FURNITURE,
  GARAGE_LEADERS,
  GARAGE_PODS,
  LEADER_IDS,
  HERO_ROW_Z,
  leaderDesks,
  leaderSeat,
  studioFloorContains,
  walkableRegions,
} from './floorPlan.ts'

/**
 * The HQ has a desk for everybody who works there [2026-10-04, GDD §7.8.12].
 *
 * Found by playing: Billy, Serena and Matt arrived in a dialogue and then had
 * nowhere to sit, because the garage only seated the founder and James. These
 * pin the claims, not the coordinates — every person has a station, no station
 * is on top of anything, and the floor is still one place you can walk across.
 * (禁止穿模 itself is looked at, not tested: `CLAUDE.md` says so.)
 */

type Rect = { x: number; z: number; w: number; d: number }
const overlap = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2

describe('the hero row', () => {
  it('seats everybody the cast names, and nobody twice', () => {
    expect(GARAGE_LEADERS.map((s) => s.id).sort()).toEqual([...LEADER_IDS].sort())
    expect(new Set(GARAGE_LEADERS.map((s) => s.seat)).size).toBe(LEADER_IDS.length)
    for (const s of GARAGE_LEADERS) expect(s.seat).toBe(leaderSeat(s.id))
  })

  it('stands behind the founder and James, facing the lens', () => {
    const front = GARAGE_LEADERS.filter((s) => s.id === 'founder' || s.id === 'james')
    for (const s of GARAGE_LEADERS.filter((l) => !front.includes(l))) {
      expect(s.z).toBe(HERO_ROW_Z)
      expect(s.rot).toBe(0)
      for (const f of front) expect(s.z).toBeLessThan(f.z)
    }
  })

  it('puts every desk on the deck, and the deck inside the building', () => {
    const d = GARAGE_DECK
    for (const desk of leaderDesks('garage')) {
      expect(desk.x - desk.w / 2).toBeGreaterThanOrEqual(d.x0 - 1e-9)
      expect(desk.x + desk.w / 2).toBeLessThanOrEqual(d.x1 + 1e-9)
      expect(desk.z - desk.d / 2).toBeGreaterThanOrEqual(d.z0 - 1e-9)
      expect(desk.z + desk.d / 2).toBeLessThanOrEqual(d.z1 + 1e-9)
      for (const [x, z] of [
        [desk.x - desk.w / 2, desk.z - desk.d / 2],
        [desk.x + desk.w / 2, desk.z + desk.d / 2],
      ]) expect(studioFloorContains(x, z)).toBe(true)
    }
  })

  it('has no desk on top of another desk, a pod, or a piece of furniture', () => {
    const desks = leaderDesks('garage')
    for (let i = 0; i < desks.length; i++) {
      for (let j = i + 1; j < desks.length; j++) expect(overlap(desks[i], desks[j]), `${i}/${j}`).toBe(false)
      for (const f of GARAGE_FURNITURE) {
        const swap = f.facing !== undefined && Math.abs(Math.sin(f.facing)) === 1
        const r = { x: f.x, z: f.z, w: swap ? f.d : f.w, d: swap ? f.w : f.d }
        expect(overlap(desks[i], r), `desk ${i} / ${f.kind}`).toBe(false)
      }
      for (const p of GARAGE_PODS) {
        const r = { x: p.x, z: p.z, w: p.rot === 90 ? 1.45 : 3.05, d: p.rot === 90 ? 3.05 : 1.45 }
        expect(overlap(desks[i], r), `desk ${i} / pod`).toBe(false)
      }
    }
  })

  it('leaves the floor one place you can walk across', () => {
    expect(walkableRegions('garage')).toHaveLength(1)
  })
})
