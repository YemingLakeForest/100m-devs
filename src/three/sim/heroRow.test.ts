import { describe, expect, it } from 'vitest'
import {
  GARAGE_DECK,
  GARAGE_FURNITURE,
  GARAGE_LEADERS,
  GARAGE_PODS,
  GARAGE_STAGE,
  HERO_SLOTS,
  LEADER_IDS,
  heroDesktop,
  leaderDesks,
  leaderSeat,
  studioFloorContains,
  walkable,
  walkableRegions,
} from './floorPlan.ts'

/**
 * The HQ has a place for everybody who works there [2026-10-04, GDD §7.8.12].
 *
 * Found by playing: Billy, Serena and Matt arrived in a dialogue and then had
 * nowhere to sit, because the garage only seated the founder and James. And then,
 * on being sent a screenshot with no heroes in it, that a row of desks behind
 * James's was not a place anybody could *see*. These pin the claims, not the
 * coordinates — every person has a station, the heroes are on a stage of their own
 * with a slot each, no station is on top of anything, and the floor is still one
 * place you can walk across. (禁止穿模 itself is looked at, and for the sets'
 * own geometry measured, in `render/hqSets.test.ts`.)
 */

type Rect = { x: number; z: number; w: number; d: number }
const overlap = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2

const HEROES = ['matt', 'serena', 'billy'] as const

describe('the hero stage', () => {
  it('seats everybody the cast names, and nobody twice', () => {
    expect(GARAGE_LEADERS.map((s) => s.id).sort()).toEqual([...LEADER_IDS].sort())
    expect(new Set(GARAGE_LEADERS.map((s) => s.seat)).size).toBe(LEADER_IDS.length)
    for (const s of GARAGE_LEADERS) expect(s.seat).toBe(leaderSeat(s.id))
  })

  it('is a terrace along the far wall, higher than the deck and flush against it', () => {
    expect(GARAGE_STAGE.rise).toBeGreaterThan(GARAGE_DECK.rise)
    // No trench between them: where the stage ends the deck begins.
    expect(GARAGE_STAGE.z1).toBe(GARAGE_DECK.z0)
    expect(GARAGE_STAGE.z0).toBeLessThan(GARAGE_STAGE.z1)
  })

  it('stands every hero on it, inside their own slot, facing the lens', () => {
    for (const id of HEROES) {
      const s = GARAGE_LEADERS.find((l) => l.id === id)!
      const slot = HERO_SLOTS[id]
      expect(s.rot).toBe(0)
      expect(s.x).toBeGreaterThan(slot.x0)
      expect(s.x).toBeLessThan(slot.x1)
      expect(s.z).toBeGreaterThan(GARAGE_STAGE.z0)
      expect(s.z).toBeLessThan(GARAGE_STAGE.z1)
    }
  })

  it('gives each hero an interval of the stage, and the intervals are disjoint and inside it', () => {
    const slots = HEROES.map((id) => HERO_SLOTS[id]).sort((a, b) => a.x0 - b.x0)
    for (const s of slots) {
      expect(s.x0).toBeGreaterThanOrEqual(GARAGE_STAGE.x0)
      expect(s.x1).toBeLessThanOrEqual(GARAGE_STAGE.x1)
      expect(s.x1).toBeGreaterThan(s.x0)
    }
    for (let i = 1; i < slots.length; i++) expect(slots[i].x0).toBeGreaterThanOrEqual(slots[i - 1].x1)
  })

  it('puts the hero stations on the stage and nobody else’s', () => {
    const behind = GARAGE_LEADERS.filter((s) => (HEROES as readonly string[]).includes(s.id))
    const front = GARAGE_LEADERS.filter((s) => !(HEROES as readonly string[]).includes(s.id))
    expect(behind).toHaveLength(HEROES.length)
    // The founder and James are on the deck, in front of the stage, on the camera's near side of it.
    for (const f of front) for (const h of behind) expect(f.z).toBeGreaterThan(h.z)
  })

  it('puts the founder’s and James’s desks on the deck, and the deck inside the building', () => {
    const d = GARAGE_DECK
    const desks = leaderDesks('garage')
    expect(desks.map((x) => x.seat).sort()).toEqual([leaderSeat('founder'), leaderSeat('james')].sort())
    for (const routing of desks) {
      // The *desktop* is what has to sit on the deck; `leaderDesks` is the padded rectangle the
      // desk and its chair close to walking, which overhangs a deck's edge by design.
      const desk = heroDesktop('garage', routing.seat)!
      expect(desk).not.toBeNull()
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

  it('keeps the furniture off the stage: nothing the room stands there blocks a hero’s set', () => {
    for (const f of GARAGE_FURNITURE) {
      const swap = f.facing !== undefined && Math.abs(Math.sin(f.facing)) === 1
      const r = { x: f.x, z: f.z, w: swap ? f.d : f.w, d: swap ? f.w : f.d }
      const stage = {
        x: (GARAGE_STAGE.x0 + GARAGE_STAGE.x1) / 2, z: (GARAGE_STAGE.z0 + GARAGE_STAGE.z1) / 2,
        w: GARAGE_STAGE.x1 - GARAGE_STAGE.x0, d: GARAGE_STAGE.z1 - GARAGE_STAGE.z0,
      }
      expect(overlap(r, stage), f.kind).toBe(false)
    }
  })

  it('closes the stage to routing, and leaves the floor one place you can walk across', () => {
    // Nobody walks on to it: the heroes are pinned (§18.1) and it is a step up.
    expect(walkable('garage', -7.5, -8)).toBe(false)
    expect(walkable('garage', 1, -8)).toBe(false)
    expect(walkableRegions('garage')).toHaveLength(1)
  })
})
