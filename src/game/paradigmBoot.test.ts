import { describe, expect, it } from 'vitest'
import {
  MAX_PAGES,
  duration,
  grouped,
  paradigmBootPages,
  shiftLabel,
  shortMoney,
  type ShiftReport,
} from './paradigmBoot.ts'
import { LESSONS } from './lessons.ts'
import { BOOT_OS_LINE, bootLines } from '../title/studioBoot.ts'

const report: ShiftReport = {
  shift: 2,
  bp: 58,
  revenue: 164_200_000,
  peakDevs: 2_339,
  shipped: 11,
  seconds: 7 * 60 + 4,
  learned: 'lesson.optimum',
  ledger: ['lesson.entropy', 'lesson.optimum'],
  nextProject: 'Untitled Roguelike Deckbuilder',
}

describe('§15.1a — the reboot between two realities', () => {
  it('opens on which shift this is, padded so the width never moves', () => {
    expect(paradigmBootPages(report, 'ADA')[0]).toBe('PARADIGM SHIFT 002')
    expect(shiftLabel(2)).toBe('002')
    expect(shiftLabel(40)).toBe('040')
    expect(shiftLabel(2).length).toBe(shiftLabel(40).length)
  })

  it('accounts for the reality that just ended', () => {
    const receipt = paradigmBootPages(report, 'ADA')[1]
    expect(receipt).toContain('REALITY 002')
    expect(receipt).toContain('$164.2M')
    expect(receipt).toContain('2,339 developers')
    expect(receipt).toContain('11 games')
    expect(receipt).toContain('7m 04s')
    expect(receipt).toContain('+58 BP')
  })

  it('marks the lesson this run taught, and only that one', () => {
    const ledger = paradigmBootPages(report, 'ADA')[2]
    expect(ledger).toContain(`> ${LESSONS['lesson.optimum']}`)
    expect(ledger).toContain(`  ${LESSONS['lesson.entropy']}`)
    expect(ledger).not.toContain(`> ${LESSONS['lesson.entropy']}`)
    // And says how much of the catalogue is known, so the list is a progress
    // bar as well as a list.
    expect(ledger).toContain(`2 OF ${Object.keys(LESSONS).length}`)
  })

  it('ends on §10.9.3’s boot, in the same words the first launch used', () => {
    const last = paradigmBootPages(report, 'ADA')[MAX_PAGES - 1]
    expect(last).toBe(bootLines('ADA', 'Untitled Roguelike Deckbuilder').join('\n'))
    expect(last).toContain(BOOT_OS_LINE)
    expect(last).toContain('project: Untitled Roguelike Deckbuilder')
    expect(last).toContain('founder: ADA')
  })

  it('never grows past its page budget, whatever the career has learned', () => {
    // **The rule this screen lives under.** A cut scene seen once is a beat; one
    // seen forty times is an obstacle, and this one is unavoidable. Anything
    // added here has to take the place of something already on it.
    const everything: ShiftReport = {
      ...report,
      shift: 999,
      ledger: Object.keys(LESSONS) as ShiftReport['ledger'],
    }
    expect(paradigmBootPages(everything, 'ADA')).toHaveLength(MAX_PAGES)
    expect(paradigmBootPages(report, 'ADA')).toHaveLength(MAX_PAGES)
  })

  it('formats a closed book rather than a counting readout', () => {
    // Rounded, because the run is over. §10.1's readouts count; this does not.
    expect(shortMoney(0)).toBe('$0')
    expect(shortMoney(1_500)).toBe('$1.5K')
    expect(shortMoney(2_600_000)).toBe('$2.6M')
    expect(shortMoney(7.1e9)).toBe('$7.1B')
    expect(shortMoney(4.2e12)).toBe('$4.2T')
    // A separator that is the same character on every device — §3 rule 3 is
    // about numerals that do not jitter, and a locale that groups with a space
    // would put a different figure on the paper for a French phone.
    expect(grouped(327_342)).toBe('327,342')
    expect(duration(64)).toBe('1m 04s')
    expect(duration(3 * 3600 + 5 * 60)).toBe('3h 05m')
  })
})
