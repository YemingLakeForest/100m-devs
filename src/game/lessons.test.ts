import { describe, expect, it } from 'vitest'
import { LESSONS, OPTIMUM_LOAD, ledgerWith, lessonFor, type LessonId, type RunEnding } from './lessons.ts'
import { BASELINE_RATING } from '../sim/rating.ts'
import { D_BASE, optimalHeadcount } from '../sim/entropy.ts'

/** A run that ended with nothing wrong with it. Each test bends one thing. */
const clean: RunEnding = {
  shift: 4,
  bankrupt: false,
  load: 0.5,
  cash: 1_000_000,
  reputation: BASELINE_RATING + 5,
  techNodesBought: 3,
}

const at = (over: Partial<RunEnding>): RunEnding => ({ ...clean, ...over })

describe('§15.1a — what a run taught', () => {
  it('gives Run 1 §6’s line, whatever its final state looked like', () => {
    // The trap is scripted: James signs the Mass Hire, the studio seizes, and
    // the player had no say in any of it. Reading their final state would
    // produce a lesson about a decision somebody else made for them.
    expect(lessonFor(at({ shift: 1 }))).toBe('lesson.entropy')
    expect(lessonFor(at({ shift: 1, bankrupt: true, load: 10 }))).toBe('lesson.entropy')
    expect(LESSONS['lesson.entropy']).toContain('Communication Infrastructure')
  })

  it('puts going broke above everything else that was wrong', () => {
    // A studio that ran out of money has one fact about it that outranks its
    // headcount, its board and its reviews.
    expect(lessonFor(at({ bankrupt: true, load: 2, techNodesBought: 0 }))).toBe('lesson.payroll')
  })

  it('names the board when the run never opened it', () => {
    expect(lessonFor(at({ techNodesBought: 0 }))).toBe('lesson.protocol')
  })

  it('names §4.1’s falling half when the studio was hired past its optimum', () => {
    expect(lessonFor(at({ load: OPTIMUM_LOAD + 0.01 }))).toBe('lesson.optimum')
    expect(lessonFor(at({ load: OPTIMUM_LOAD - 0.2 }))).not.toBe('lesson.optimum')
  })

  it('agrees with §4.1 about where the optimum is', () => {
    // The rule is about a *ratio* and `optimalHeadcount` answers in people, so
    // the two are stated separately and pinned together here. If ρ ever moves,
    // a lesson that kept teaching 0.758 would be teaching a curve the game no
    // longer runs.
    expect(OPTIMUM_LOAD).toBeCloseTo(optimalHeadcount(D_BASE) / D_BASE, 12)
  })

  it('names capacity when the studio was pressed against its cap with money spare', () => {
    expect(lessonFor(at({ load: OPTIMUM_LOAD - 0.01, cash: 5_000 }))).toBe('lesson.capacity')
    // Not when there was no money to have spent on a bigger cap.
    expect(lessonFor(at({ load: OPTIMUM_LOAD - 0.01, cash: 0 }))).not.toBe('lesson.capacity')
  })

  it('names quality when the run was the right size and shipped badly', () => {
    expect(lessonFor(at({ reputation: BASELINE_RATING - 10 }))).toBe('lesson.quality')
  })

  it('shrugs rather than inventing a mistake', () => {
    // §13.12's stall is a real way for a run to end. A screen that insisted on a
    // culprit would be lying to the one player who did everything right.
    expect(lessonFor(clean)).toBe('lesson.patience')
  })

  it('has a line for every id, and no orphan lines', () => {
    const ids = Object.keys(LESSONS) as LessonId[]
    expect(ids.length).toBeGreaterThan(1)
    for (const id of ids) {
      expect(LESSONS[id].length).toBeGreaterThan(10)
      // One sentence. A lesson that needs a second one is a paragraph, and a
      // paragraph on a screen the player is leaving is a paragraph nobody reads.
      expect(LESSONS[id].split('. ').length).toBeLessThanOrEqual(2)
    }
  })
})

describe('the ledger', () => {
  it('is a set — the same wall twice is not two lessons', () => {
    const once = ledgerWith([], 'lesson.payroll')
    expect(once).toEqual(['lesson.payroll'])
    expect(ledgerWith(once, 'lesson.payroll')).toEqual(['lesson.payroll'])
  })

  it('is in catalogue order, not order learned', () => {
    // A ledger that reshuffles between shifts is a ledger you have to re-read.
    const order = Object.keys(LESSONS) as LessonId[]
    const learnedBackwards = ledgerWith(['lesson.quality', 'lesson.entropy'], 'lesson.optimum')
    expect(learnedBackwards).toEqual(
      order.filter((id) => ['lesson.quality', 'lesson.entropy', 'lesson.optimum'].includes(id)),
    )
  })

  it('is bounded by the catalogue, however many shifts happen', () => {
    let known: string[] = []
    for (const id of Object.keys(LESSONS) as LessonId[]) known = ledgerWith(known, id)
    for (let i = 0; i < 100; i++) known = ledgerWith(known, 'lesson.patience')
    expect(known).toHaveLength(Object.keys(LESSONS).length)
  })

  it('ignores an id it does not know — a save from a later build', () => {
    expect(ledgerWith(['lesson.invented-later'], 'lesson.payroll')).toEqual(['lesson.payroll'])
  })
})
