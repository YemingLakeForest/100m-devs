import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore,
  __setState,
  beginLiquidation,
  finishLiquidation,
  getState,
  jumpToPhase,
} from './store.ts'
import { emptyPermanent, getPermanent, setPermanent } from './save.ts'

/**
 * §15.1a [2026-10-04] — the first death's last scene is a scene, not a cut.
 *
 * The bankruptcy panel's button used to *be* the shift: one press and the
 * studio was simply somewhere else. It now begins the liquidation — the panel
 * goes, James says his line, the garage empties and the houses lift off on the
 * stage — and the stage takes the shift when the last of them has gone. The
 * claims are about the order, because the order is the scene.
 */
beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})
afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('the liquidation', () => {
  it('does nothing before the studio has gone under', () => {
    beginLiquidation()
    expect(getState().liquidating).toBe(false)
  })

  it('begins on the bankruptcy panel, with James’s line and *no shift yet*', () => {
    jumpToPhase('bankrupt')
    const devs = getState().devs
    beginLiquidation()
    expect(getState().liquidating).toBe(true)
    expect(getState().bubble?.text).toBe('So. Same time tomorrow?')
    // The studio is still there to be seen leaving.
    expect(getState().devs).toBe(devs)
    expect(getPermanent().meta.paradigmShifts).toBe(0)
    expect(getState().pendingShift).toBeNull()
  })

  it('takes the shift only when the stage says the studio has left', () => {
    jumpToPhase('bankrupt')
    beginLiquidation()
    finishLiquidation()
    expect(getState().liquidating).toBe(false)
    expect(getPermanent().meta.paradigmShifts).toBe(1)
    expect(getState().pendingShift).not.toBeNull()
  })

  it('is idempotent, and finishing without beginning is nothing', () => {
    finishLiquidation()
    expect(getPermanent().meta.paradigmShifts).toBe(0)
    jumpToPhase('bankrupt')
    beginLiquidation()
    beginLiquidation()
    __setState({})
    finishLiquidation()
    finishLiquidation()
    expect(getPermanent().meta.paradigmShifts).toBe(1)
  })
})
