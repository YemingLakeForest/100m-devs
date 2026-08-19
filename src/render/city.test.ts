/**
 * Rungs 4–6 — the city. GDD §7.7.1, §7.7.2, §7.8.2.
 *
 * The gap this closes is the point of the file: `tower.ts` caps at ten storeys,
 * so from ten thousand developers upward the studio grew and **the screen did
 * not**. That is §7.7's opening prohibition — *a counter with a particle
 * effect* — arriving at exactly the headcount where the numbers get
 * interesting.
 */

import { describe, expect, it } from 'vitest'
import {
  CITY_FIRST_RUNG,
  capacityAt,
  unitAtLocal,
  CITY_LAST_RUNG,
  MAX_UNITS,
  neighbourSway,
  slotAt,
  unitDropHeight,
  unitsAtRung,
  unitsFor,
} from './city.ts'
import { DEVS_PER_STOREY, MAX_STOREYS, storeysFor } from './tower.ts'
import { RUNGS, rungFor } from '../sim/headcount.ts'

describe('the picture keeps answering above ten thousand', () => {
  it('takes over exactly where the tower stops', () => {
    // The seam, and the reason this module exists. One developer either side of
    // it: the tower is saturated, and the city has something to draw.
    const capped = DEVS_PER_STOREY * MAX_STOREYS
    expect(storeysFor(capped)).toBe(MAX_STOREYS)
    expect(storeysFor(capped * 5)).toBe(MAX_STOREYS)
    expect(unitsFor(capped).count).toBeGreaterThan(0)
  })

  it('draws nothing while the tower still has the picture', () => {
    // Below the seam this tier must be empty rather than "one small building",
    // or the two representations are both claiming the same studio.
    expect(unitsFor(999).count).toBe(0)
    expect(unitsFor(9_999).count).toBe(0)
  })

  it('grows through four decades instead of one', () => {
    // 10⁴ to 10⁸. Every one of these headcounts used to produce the same
    // ten-storey tower.
    const seen = new Set<string>()
    for (const devs of [1e4, 5e4, 1e5, 4e5, 1e6, 2e7, 9e7]) {
      const { rung, count } = unitsFor(devs)
      seen.add(`${rung}:${count}`)
      expect(count).toBeGreaterThan(0)
    }
    expect(seen.size).toBeGreaterThanOrEqual(6)
  })

  it('counts the unit §7.7.1 says it is counting', () => {
    // A building is 10⁴ developers, a campus 10⁵, a town 10⁶ — read off the
    // Construction Ladder rather than restated here, because a second copy of
    // those numbers is a second thing that can drift.
    for (const rung of RUNGS) {
      if (rung.rung < CITY_FIRST_RUNG || rung.rung > CITY_LAST_RUNG) continue
      const devs = rung.unitSize * 3
      expect(rungFor(devs).rung).toBe(rung.rung)
      expect(unitsFor(devs)).toEqual({ rung: rung.rung, count: 3 })
    }
  })

  it('floors rather than rounds — you count what you can see', () => {
    // 4.9 buildings is four buildings and most of a fifth. Drawing five claims
    // one that is nearly empty, which is the same lie `tower.ts` refuses.
    expect(unitsFor(4.9e4).count).toBe(4)
    expect(unitsFor(1.999e4).count).toBe(1)
  })

  it('saturates at a countable number rather than drawing a thousand towns', () => {
    // Past roughly a dozen objects the eye stops counting, so an eleventh costs
    // real geometry and adds nothing. Within a rung the count saturates and the
    // *next rung* moves the picture on, which is what makes a promotion worth
    // scoring.
    expect(unitsFor(1e9).count).toBeLessThanOrEqual(MAX_UNITS)
    expect(unitsFor(1e30).count).toBeLessThanOrEqual(MAX_UNITS)
  })

  it('keeps drawing something above its last rung rather than going blank', () => {
    // §7.4's Level 3 and 4 tiers hold the scale above a town, but the Level 2
    // slot still has to contain *something* when the camera is pulled in. A
    // saturated sprawl is honest; an empty slot is a bug.
    expect(unitsFor(1e12).rung).toBe(CITY_LAST_RUNG)
    expect(unitsFor(1e12).count).toBe(MAX_UNITS)
  })
})

describe('unitsAtRung — §7.4a, the camera chooses the rung, not the headcount', () => {
  it('answers for any rung, so one studio can be looked at three ways', () => {
    // Three million developers. As a sprawl that is three towns; as a business
    // park it is thirty campuses; as a block it is three hundred buildings,
    // saturating at what a campus can actually hold. All three are true and,
    // before §7.4a, only the first could ever be seen.
    //
    // The saturation point is §7.7.1's own branching now rather than one shared
    // cap: a campus holds ten buildings because 10^5 / 10^4 is ten, and a
    // nation holds a hundred towns because the bands step 10^6 to 10^8 with
    // nothing between them.
    expect(unitsAtRung(3e6, 6)).toBe(3)
    expect(unitsAtRung(3e6, 5)).toBe(capacityAt(5))
    expect(unitsAtRung(3e6, 4)).toBe(capacityAt(4))
    expect(capacityAt(4)).toBe(10)
    expect(capacityAt(6)).toBe(100)
  })

  it('draws nothing at a rung the studio has not reached', () => {
    // The camera ceiling should never let an unearned rung be looked at. A
    // picture that is honest without the ceiling is one less thing that can
    // quietly disagree with it.
    expect(unitsAtRung(5_000, 4)).toBe(0)
    expect(unitsAtRung(50_000, 5)).toBe(0)
    expect(unitsAtRung(50_000, 4)).toBe(5)
  })

  it('survives nonsense rather than drawing NaN buildings', () => {
    expect(unitsAtRung(Number.NaN, 4)).toBe(0)
    expect(unitsAtRung(-5, 4)).toBe(0)
    expect(unitsAtRung(1e6, 99)).toBe(0)
  })
})

describe('the arrival — §7.7.2', () => {
  it('falls under gravity, so it is fastest when it lands', () => {
    // An ease-out reads as a crane lowering it. That is a different joke and a
    // worse one, and it has been learned twice already — on the Act IV drop and
    // on the storey stack.
    const first = unitDropHeight(0.2) - unitDropHeight(0.5)
    const second = unitDropHeight(0.5) - unitDropHeight(0.8)
    expect(second).toBeGreaterThan(first)
  })

  it('starts in the sky and ends on the ground', () => {
    expect(unitDropHeight(0)).toBeGreaterThan(0)
    expect(unitDropHeight(1)).toBe(0)
    expect(unitDropHeight(2)).toBe(0)
  })

  it('makes the neighbours sway, and then stop', () => {
    // §7.7.2 — "hard enough to make the neighbours sway". A lean that does not
    // return is a hinge; one that never happens is a sticker being placed.
    expect(neighbourSway(0.5)).toBe(0)
    expect(neighbourSway(1)).toBe(0)
    const during = Array.from({ length: 20 }, (_, i) => Math.abs(neighbourSway(0.8 + i * 0.01)))
    expect(Math.max(...during)).toBeGreaterThan(0.005)
    expect(Math.max(...during)).toBeLessThan(0.1)
  })
})

describe('the formation — §7.7.2, a thing lands rather than a scene rearranging', () => {
  it('never moves a unit that is already standing', () => {
    // The whole reason `slotAt` takes an index and not a count. A formation
    // solved from `n` re-centres every object each time one arrives, so a hire
    // slides the entire block sideways — and the one thing an arrival must do
    // is let the player watch something *land*.
    const before = Array.from({ length: 5 }, (_, i) => slotAt(i))
    const after = Array.from({ length: 9 }, (_, i) => slotAt(i))
    for (let i = 0; i < before.length; i++) {
      expect(after[i]).toEqual(before[i])
    }
  })

  it('fills a square from the back corner rather than a row along the horizon', () => {
    // The formation is `grid.ts`'s square shells now. Unit 0 is the far corner
    // and the studio grows *towards* the camera, which is what makes a
    // §7.7.2 arrival land in front of what is already standing rather than
    // behind it. It also means any number of units reads as a block: ten drawn
    // row-major into a lattice built for a hundred is a line, and a line is
    // what the room's squads looked like.
    expect(slotAt(0)).toEqual({ x: 0, y: 0 })
    const spread = Array.from({ length: MAX_UNITS }, (_, i) => slotAt(i))
    expect(Math.min(...spread.map((s) => s.x))).toBeLessThan(0)
    expect(Math.max(...spread.map((s) => s.x))).toBeGreaterThan(0)
    // Rows step *towards* the camera, which is down the screen.
    expect(Math.min(...spread.map((s) => s.y))).toBe(0)
    expect(Math.max(...spread.map((s) => s.y))).toBeGreaterThan(0)
    // Ten units are a 4x4 block's worth of ground, not a row of ten.
    const ten = spread.slice(0, 10)
    const across = Math.max(...ten.map((s) => s.x)) - Math.min(...ten.map((s) => s.x))
    const deep = Math.max(...ten.map((s) => s.y)) - Math.min(...ten.map((s) => s.y))
    expect(deep).toBeGreaterThan(across * 0.3)
  })

  it('gives every unit its own plot', () => {
    const seen = new Set(
      Array.from({ length: MAX_UNITS }, (_, i) => JSON.stringify(slotAt(i, CITY_FIRST_RUNG))),
    )
    expect(seen.size).toBe(MAX_UNITS)
  })

  it('never puts two units at the same screen x in the same row', () => {
    // The bug this shape exists to prevent, and it is invisible in a table.
    // Projecting a square plan puts two units on the SAME screen x whenever
    // their plan coordinates differ by (1, 1) — and at these heights that reads
    // as one building stacked on top of another rather than as two standing
    // apart. It was on screen before it was caught.
    const byRow = new Map<number, number[]>()
    for (let i = 0; i < MAX_UNITS; i++) {
      const at = slotAt(i, CITY_FIRST_RUNG)
      const row = byRow.get(at.y) ?? []
      row.push(at.x)
      byRow.set(at.y, row)
    }
    for (const xs of byRow.values()) {
      expect(new Set(xs).size).toBe(xs.length)
    }
  })

  it('runs rows level across the screen and steps them back', () => {
    // §7.8.1's grain rule, at four orders of magnitude more people. A formation
    // that climbs an isometric axis reads as a queue; one that runs level reads
    // as a block.
    const spread = Array.from({ length: MAX_UNITS }, (_, i) => slotAt(i, CITY_FIRST_RUNG))
    const w = Math.max(...spread.map((s) => s.x)) - Math.min(...spread.map((s) => s.x))
    const h = Math.max(...spread.map((s) => s.y)) - Math.min(...spread.map((s) => s.y))
    expect(w).toBeGreaterThan(h)
    // Rows are discrete, and there are at least two of them by ten units.
    expect(new Set(spread.map((s) => s.y)).size).toBeGreaterThanOrEqual(2)
  })

  it('staggers ADJACENT rows, so nobody is eclipsed by the unit in front', () => {
    // Adjacent, not all: row two shares its x positions with row zero and that
    // is fine — it stands two rows and a hundred and twenty pixels higher, with
    // a whole row of buildings in between. The eclipse only ever comes from the
    // row immediately in front.
    const rows = new Map<number, Set<number>>()
    for (let i = 0; i < MAX_UNITS; i++) {
      const at = slotAt(i, CITY_FIRST_RUNG)
      if (!rows.has(at.y)) rows.set(at.y, new Set())
      rows.get(at.y)!.add(at.x)
    }
    const ys = [...rows.keys()].sort((a, b) => b - a)
    expect(ys.length).toBeGreaterThanOrEqual(2)
    for (let r = 1; r < ys.length; r++) {
      const front = rows.get(ys[r - 1])!
      for (const x of rows.get(ys[r])!) expect(front.has(x)).toBe(false)
    }
  })

  it('spaces the wider units further apart', () => {
    // A town fills its plot to the edge and a building is a narrow tower on a
    // wide one. One shared pitch either packs the towns into each other or
    // scatters the buildings across a car park.
    expect(Math.abs(slotAt(1, CITY_LAST_RUNG).x)).toBeGreaterThan(
      Math.abs(slotAt(1, CITY_FIRST_RUNG).x),
    )
  })
})

describe('which unit is under the thumb (GDD §4.5b, R15)', () => {
  it('finds the unit standing nearest the tap', () => {
    for (const i of [0, 1, 4, 7]) {
      const at = slotAt(i, CITY_FIRST_RUNG)
      expect(unitAtLocal(at.x, at.y, MAX_UNITS, CITY_FIRST_RUNG)).toBe(i)
    }
  })

  it('only offers the units that have actually been built', () => {
    // Three towers on the block means three things to poke. Returning slot 7
    // for a tap on empty ground would buff ten thousand developers who are not
    // there — and `units.ts` would clamp the range to nothing, so the poke
    // would silently do nothing at all.
    const at = slotAt(7, CITY_FIRST_RUNG)
    expect(unitAtLocal(at.x, at.y, 3, CITY_FIRST_RUNG)).toBe(-1)
  })

  it('misses on open ground between the units', () => {
    expect(unitAtLocal(4000, 4000, MAX_UNITS, CITY_FIRST_RUNG)).toBe(-1)
  })
})
