/**
 * §15.1a — the shift's own receipt, as the store assembles it.
 *
 * The pure halves live in `paradigmBoot.ts` and `lessons.ts` and are tested
 * there. What is tested here is the wiring, and specifically the one thing that
 * is easy to get wrong and impossible to see: **every number on the report
 * belongs to the run that is being thrown away**, and it is read on the frame
 * before that run stops existing.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  dismissShiftReport,
  getState,
  triggerParadigmShift,
} from './store.ts'
import { emptyPermanent, getPermanent, setPermanent } from './save.ts'
import { paradigmBootPages } from './paradigmBoot.ts'
import { BASELINE_RATING } from '../sim/rating.ts'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

/** A reality worth writing a receipt about. */
function aRun() {
  __setState({
    lifetimeRevenue: 164_200_000,
    peakDevs: 2_339,
    devs: 2_339,
    projectsShipped: 11,
    runSeconds: 424,
    cash: 66_900_000,
    reputation: BASELINE_RATING + 5,
    tech: { B1: 1 },
  })
}

describe('the report is about the reality that ended', () => {
  it('reads the run’s numbers, not the fresh one’s', () => {
    aRun()
    triggerParadigmShift()

    const report = getState().pendingShift
    expect(report).not.toBeNull()
    expect(report!.shift).toBe(1)
    expect(report!.revenue).toBe(164_200_000)
    expect(report!.peakDevs).toBe(2_339)
    expect(report!.shipped).toBe(11)
    expect(report!.seconds).toBe(424)

    // And the run underneath it really has been replaced, which is what makes
    // reading these afterwards impossible and the timing load-bearing.
    expect(getState().lifetimeRevenue).toBe(0)
    expect(getState().projectsShipped).toBe(1)
  })

  it('counts shifts from one, and keeps counting', () => {
    aRun()
    triggerParadigmShift()
    expect(getState().pendingShift!.shift).toBe(1)
    dismissShiftReport()

    aRun()
    triggerParadigmShift()
    expect(getState().pendingShift!.shift).toBe(2)
    expect(getPermanent().meta.paradigmShifts).toBe(2)
  })

  it('names the project the next reality actually opens on', () => {
    aRun()
    triggerParadigmShift()
    expect(getState().pendingShift!.nextProject).toBe(getState().sprintName)
  })

  it('gives Run 1 §6’s lesson and banks it', () => {
    aRun()
    triggerParadigmShift()
    expect(getState().pendingShift!.learned).toBe('lesson.entropy')
    expect(getPermanent().meta.lessons).toEqual(['lesson.entropy'])
  })

  it('banks a second lesson without repeating the first', () => {
    aRun()
    triggerParadigmShift()
    dismissShiftReport()

    // A run that went broke, which is a different wall from Run 1's.
    __setState({ ...getState(), cash: -2_000_000, phase: 'bankrupt', devs: 40, tech: { B1: 1 } })
    triggerParadigmShift()

    expect(getState().pendingShift!.learned).toBe('lesson.payroll')
    expect(getPermanent().meta.lessons).toEqual(['lesson.entropy', 'lesson.payroll'])
    // The ledger on the screen is the banked one.
    expect(getState().pendingShift!.ledger).toEqual(['lesson.entropy', 'lesson.payroll'])
  })

  it('draws four pages the player can actually read', () => {
    aRun()
    triggerParadigmShift()
    const pages = paradigmBootPages(getState().pendingShift!, 'ADA')
    expect(pages[0]).toContain('PARADIGM SHIFT 001')
    expect(pages[1]).toContain('$164.2M')
    expect(pages.join('\n')).toContain('Manpower without Communication Infrastructure')
  })
})

describe('the way out of it', () => {
  it('clears on the tap and does not come back', () => {
    aRun()
    triggerParadigmShift()
    expect(getState().pendingShift).not.toBeNull()

    dismissShiftReport()
    expect(getState().pendingShift).toBeNull()

    // Idempotent: the cut scene's exit timer can fire more than once under
    // StrictMode, and a second call must not resurrect anything.
    dismissShiftReport()
    expect(getState().pendingShift).toBeNull()
  })

  it('does not survive a reload — a receipt is not run state worth restoring', () => {
    // `pendingShift` is deliberately absent from `RunSave`: a player who closes
    // the tab mid-cut-scene should come back to their new studio rather than to
    // an interstitial about a run that is already over.
    aRun()
    triggerParadigmShift()
    expect(getState().pendingShift).not.toBeNull()
    __resetStore()
    expect(getState().pendingShift).toBeNull()
  })
})
