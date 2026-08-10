import { describe, expect, it } from 'vitest'
import {
  DEFECT_HALVING_QA_SHARE,
  QA_SUPPRESSION,
  ROLES,
  ROLE_LABEL,
  addHires,
  countsOf,
  defectSuppression,
  headcountOf,
  newRoster,
  roleAtSeat,
  roleBands,
  roleShare,
  supportCapacity,
  type Role,
} from './roles.ts'

describe('§4.11 — the roster is a hire history, not a table of seats', () => {
  it('starts with the founders, and they write code', () => {
    const roster = newRoster(2)
    expect(headcountOf(roster)).toBe(2)
    expect(roleAtSeat(roster, 0)).toBe('dev')
    expect(roleAtSeat(roster, 1)).toBe('dev')
  })

  it('appends a hire to the end, so the new seat is the new role', () => {
    const roster = addHires(newRoster(2), 'qa', 1)
    expect(roleAtSeat(roster, 0)).toBe('dev')
    expect(roleAtSeat(roster, 2)).toBe('qa')
    expect(headcountOf(roster)).toBe(3)
  })

  /**
   * The property the whole representation exists for. §7.8.1b's rule is that a
   * seat once taken never moves; this is the same rule for what the person in
   * it *is*. A roster stored as four counts cannot have it — hiring one
   * developer would relabel every QA above them, and §7.8.7 generates the face
   * from the seat, so the studio would watch somebody change jobs.
   */
  it('never changes the role of a seat that is already taken', () => {
    let roster = newRoster(2)
    const roles: Role[] = ['qa', 'dev', 'support', 'dev', 'sre', 'qa', 'dev']

    const seen: Role[] = ['dev', 'dev']
    for (const role of roles) {
      roster = addHires(roster, role, 3)
      for (let i = 0; i < 3; i++) seen.push(role)

      // Everything hired so far still reads as what it was hired as.
      for (let seat = 0; seat < seen.length; seat++) {
        expect(roleAtSeat(roster, seat)).toBe(seen[seat])
      }
    }
  })

  it('merges a repeated role into one run, so a batch hire is one band', () => {
    const roster = addHires(addHires(newRoster(2), 'qa', 4), 'qa', 6)
    expect(roster).toHaveLength(2)
    expect(headcountOf(roster)).toBe(12)
    expect(countsOf(roster).qa).toBe(10)
  })

  it('is compact under the hire pattern the dial actually produces', () => {
    // §10.10's dial hires 1 / 10 / 100 / MAX at a time, so a run is a batch and
    // the roster is a handful of objects however large the studio gets.
    let roster = newRoster(2)
    for (let i = 0; i < 40; i++) roster = addHires(roster, i % 4 === 3 ? 'qa' : 'dev', 100)
    expect(roster.length).toBeLessThanOrEqual(81)
    expect(headcountOf(roster)).toBe(4002)
  })

  it('counts every role, and the counts sum to the headcount', () => {
    let roster = newRoster(2)
    roster = addHires(roster, 'qa', 5)
    roster = addHires(roster, 'support', 3)
    roster = addHires(roster, 'sre', 2)
    roster = addHires(roster, 'dev', 8)

    const counts = countsOf(roster)
    expect(counts).toEqual({ dev: 10, qa: 5, support: 3, sre: 2 })

    let total = 0
    for (const role of ROLES) total += counts[role]
    expect(total).toBe(headcountOf(roster))
  })

  it('ignores a hire of nobody, and refuses a negative one', () => {
    const roster = newRoster(2)
    expect(addHires(roster, 'qa', 0)).toEqual(roster)
    expect(addHires(roster, 'qa', -5)).toEqual(roster)
  })

  it('reads a seat outside the studio as a developer rather than throwing', () => {
    // The renderer asks about seats speculatively — an arrival is drawn before
    // the store publishes it (trap 12). A throw there is a blank frame.
    const roster = newRoster(2)
    expect(roleAtSeat(roster, 99)).toBe('dev')
    expect(roleAtSeat(roster, -1)).toBe('dev')
  })

  it('gives every role a label the HUD can print', () => {
    for (const role of ROLES) {
      expect(ROLE_LABEL[role]).toMatch(/^[A-Z]/)
    }
  })
})

describe('§4.11.2 — the floor reads as bands', () => {
  it('turns the hire history into contiguous seat ranges that tile the studio', () => {
    let roster = newRoster(2)
    roster = addHires(roster, 'qa', 4)
    roster = addHires(roster, 'dev', 6)

    const bands = roleBands(roster)
    expect(bands).toEqual([
      { role: 'dev', from: 0, to: 2 },
      { role: 'qa', from: 2, to: 6 },
      { role: 'dev', from: 6, to: 12 },
    ])

    // No gaps, no overlaps — the same property §4.5b's units are built on.
    let cursor = 0
    for (const band of bands) {
      expect(band.from).toBe(cursor)
      cursor = band.to
    }
    expect(cursor).toBe(headcountOf(roster))
  })
})

describe('§4.12 — QA change how fast defects arrive', () => {
  it('does nothing at all with no QA on the floor', () => {
    expect(defectSuppression(0)).toBe(1)
  })

  it('halves the defect rate at exactly the share it says it does', () => {
    // The anchor. `DEFECT_HALVING_QA_SHARE` is the whole knob — a coefficient
    // nobody can picture, restated as a sentence about a studio.
    expect(defectSuppression(DEFECT_HALVING_QA_SHARE)).toBeCloseTo(0.5, 10)
  })

  it('never reaches zero, however much QA is thrown at it', () => {
    // §4.12: QA "change how fast defects arrive". A studio that is entirely QA
    // still ships bugs, and a suppression that could hit zero would make the
    // defect system switchable-off — which is the one thing §4.12 is for.
    expect(defectSuppression(1)).toBeGreaterThan(0)
    expect(defectSuppression(1)).toBeLessThan(0.5)
    expect(defectSuppression(0.999)).toBeGreaterThan(0)
  })

  it('falls monotonically, so more QA is never worse', () => {
    let last = Infinity
    for (let share = 0; share <= 1; share += 0.05) {
      const value = defectSuppression(share)
      expect(value).toBeLessThan(last)
      last = value
    }
  })

  it('is the same curve QA_SUPPRESSION names', () => {
    expect(QA_SUPPRESSION).toBe(DEFECT_HALVING_QA_SHARE)
  })
})

describe('§4.13 — support capacity is headcount, straightforwardly', () => {
  it('is linear in heads, with no dilution', () => {
    // The deliberate exception: "the one part of the game where throwing people
    // at a problem simply works". Doubling the heads doubles the capacity, at
    // every scale, with no §4.1 term anywhere near it.
    expect(supportCapacity(200)).toBeCloseTo(2 * supportCapacity(100), 9)
    expect(supportCapacity(2e9)).toBeCloseTo(2 * supportCapacity(1e9), 3)
  })

  it('is zero with nobody answering the phone', () => {
    expect(supportCapacity(0)).toBe(0)
  })
})

describe('roleShare', () => {
  it('is the fraction of the studio doing that job', () => {
    let roster = newRoster(2)
    roster = addHires(roster, 'qa', 2)
    expect(roleShare(countsOf(roster), 'qa')).toBeCloseTo(0.5, 10)
    expect(roleShare(countsOf(roster), 'dev')).toBeCloseTo(0.5, 10)
  })

  it('is zero for an empty studio rather than NaN', () => {
    expect(roleShare({ dev: 0, qa: 0, support: 0, sre: 0 }, 'qa')).toBe(0)
  })
})
