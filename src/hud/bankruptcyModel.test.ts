import { describe, expect, it } from 'vitest'
import { LESSONS, RUN_ONE_WAY_OUT } from '../game/lessons.ts'
import { bankruptcyReceipt, type BankruptcyInput } from './bankruptcyModel.ts'

/** A Run 2 studio that hired hard: twenty-three on the payroll, held at a quarter. */
const RUN_TWO: BankruptcyInput = {
  prestiged: true,
  devs: 23,
  cap: 100,
  revenue: 143_500,
  payroll: 1_100,
  work: 5.75,
}

const RUN_ONE: BankruptcyInput = { ...RUN_TWO, prestiged: false, devs: 1_002, payroll: 50_000, revenue: 0 }

describe('the liquidation receipt — §21 Act V, §15.1a', () => {
  it('keeps Run 1 exactly the scripted trap it always was', () => {
    // §6 is true of Run 1 and only Run 1: a thousand people did arrive, nobody
    // coded, and nothing was earned. The script must not move.
    const r = bankruptcyReceipt(RUN_ONE)
    expect(r.story).toMatch(/1,000 developers/)
    expect(r.result).toBe('$0 REVENUE — TOTAL LIQUIDATION')
    expect(r.lesson).toEqual([LESSONS['lesson.entropy'], RUN_ONE_WAY_OUT])
  })

  it('does not tell a Run 2 studio it had a thousand developers arguing in Slack', () => {
    // The bug: every bankruptcy printed Run 1's copy. A player who went under at
    // twenty-three developers was told they had a thousand and had earned
    // nothing — about a studio that was not theirs.
    const r = bankruptcyReceipt(RUN_TWO)
    const everything = [r.story, r.result, ...r.sums, ...r.lesson].join('\n')
    expect(everything).not.toMatch(/1,000/)
    expect(everything).not.toMatch(/Slack/)
  })

  it('reads the studio that ended: its headcount, its payroll, what it earned', () => {
    const r = bankruptcyReceipt(RUN_TWO)
    expect(r.story).toContain('23 developers')
    expect(r.story).toContain('$1.1K')
    // It earned something, and says so — "$0 REVENUE" would be a lie here.
    expect(r.result).toContain('$143.5K')
    expect(r.result).not.toMatch(/^\$0 /)
    expect(r.sums[0]).toContain('23 DEVELOPERS')
    expect(r.sums[0]).toContain('5.8')
    expect(r.sums[1]).toContain('$1.1K/SEC')
  })

  it('fits the box — no line of a later run’s receipt is longer than the modal holds', () => {
    // About forty-two glyphs across, measured on the panel: the first draft's
    // "12 DEVELOPERS: 3.0 DEVELOPERS’ WORTH OF WORK" was forty-four and left
    // "WORK" alone on a line. A thousand-odd heads with a comma in the count and
    // a six-figure revenue is the longest a run that bankrupts on payroll gets.
    const r = bankruptcyReceipt({ ...RUN_TWO, devs: 1_234, revenue: 987_654, payroll: 61_650, work: 306 })
    for (const line of [r.result, ...r.sums]) expect(line.length).toBeLessThanOrEqual(42)
  })

  it('teaches the payroll lesson — the one lessonFor picks for a bankrupt studio after Run 1', () => {
    expect(bankruptcyReceipt(RUN_TWO).lesson).toEqual([LESSONS['lesson.payroll']])
  })

  it('reports the output the studio really had, not the textbook curve at its headcount', () => {
    // 23 developers on a cap of 100 are worth 23 on §4.1 alone. This studio was
    // held at a quarter, and the receipt prints what was on the speedometer.
    const r = bankruptcyReceipt(RUN_TWO)
    expect(r.sums[0]).not.toContain('23 DEVELOPERS’ WORTH')
  })
})
