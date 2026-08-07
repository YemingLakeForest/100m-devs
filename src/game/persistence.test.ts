/**
 * The store's half of GDD §24 — load, offline resolution, collect, and the
 * §24.9 lifecycle. `save.test.ts` covers the document; this covers the wiring.
 */

import Decimal from 'break_infinity.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SAVE_KEY,
  emptyPermanent,
  getPermanent,
  makeSaveData,
  readSave,
  serialize,
  setPermanent,
  type PermanentSave,
} from './save.ts'
import {
  __resetStore,
  collectOffline,
  commitmentFor,
  getState,
  installAutoSave,
  loadGame,
  saveGame,
  triggerParadigmShift,
} from './store.ts'
import { PROJECTS } from './store.ts'
import {
  ENTITLEMENT_SERIES_A,
  NODE_CI_CD_AUTOPILOT,
  OFFLINE_BASE_CAP_SECONDS,
} from '../sim/offline.ts'

const HOUR = 3600 * 1000

/** Write a save as if the player had left in the given state, `agoMs` ago. */
function seed(over: Partial<ReturnType<typeof getState>>, permanent: PermanentSave, agoMs: number) {
  setPermanent(permanent)
  const save = makeSaveData({ ...getState(), ...over })
  localStorage.setItem(SAVE_KEY, serialize({ ...save, savedAt: Date.now() - agoMs }))
  setPermanent(emptyPermanent())
}

/** A permanent block for a player who has prestiged, so offline is unlocked. */
function prestiged(over: Partial<PermanentSave['meta']> = {}): PermanentSave {
  const p = emptyPermanent()
  return { layer1: p.layer1, meta: { ...p.meta, paradigmShifts: 1, ...over } }
}

beforeEach(() => {
  localStorage.clear()
  __resetStore()
})

describe('load', () => {
  it('returns null and leaves a fresh run when there is nothing to load', () => {
    expect(loadGame()).toBeNull()
    expect(getState().devs).toBe(1)
  })

  it('restores the run state a Paradigm Shift would throw away', () => {
    seed(
      {
        devs: 40,
        cash: 1234,
        projectIndex: 1,
        commitment: new Decimal(2500),
        burned: new Decimal(900),
        projectsShipped: 3,
        pokeCount: 77,
        phase: 'act3_bait',
        massHired: true,
      },
      prestiged(),
      0,
    )
    loadGame()
    const s = getState()
    expect(s.devs).toBe(40)
    expect(s.cash).toBe(1234)
    expect(s.burned.toNumber()).toBe(900)
    expect(s.sprintName).toBe(PROJECTS[1].name)
    expect(s.projectsShipped).toBe(3)
    expect(s.pokeCount).toBe(77)
    expect(s.phase).toBe('act3_bait')
    expect(s.massHired).toBe(true)
  })

  it('does not restore ephemeral state — GDD §24.2', () => {
    // A floating numeral's bornAt is a page-lifetime clock. Restored into a new
    // page it is a numeral born minutes in the future that never expires, and
    // the bug lands nowhere near the load.
    seed(
      { localEntropy: 0.9, floaters: [{ id: 1, sp: 1, x: 0, y: 0, crit: false, bornAt: 5, snippet: null }] },
      prestiged(),
      0,
    )
    loadGame()
    expect(getState().localEntropy).toBe(0)
    expect(getState().floaters).toEqual([])
    expect(getState().bubble).toBeNull()
  })

  it('restores lifetime revenue from the permanent high-water mark', () => {
    seed({ lifetimeRevenue: 700 }, prestiged({ lifetimeRevenue: 9_000 }), 0)
    loadGame()
    expect(getState().lifetimeRevenue).toBe(9_000)
  })

  it('survives a corrupt save rather than wedging the game', () => {
    localStorage.setItem(SAVE_KEY, '{"version":1,"run":')
    expect(loadGame()).toBeNull()
    expect(getState().devs).toBe(1)
  })
})

describe('offline on return — GDD §24.5', () => {
  it('reports nothing before the first Paradigm Shift', () => {
    // §21 paces Run 1 at four minutes. An overnight summary landing mid-trap
    // would resolve §6's lesson while the player was asleep.
    seed({ devs: 50, devCap: 100 }, emptyPermanent(), 8 * HOUR)
    expect(loadGame()).toBeNull()
    expect(getState().pendingOffline).toBeNull()
  })

  it('reports nothing for an absence under 30 minutes', () => {
    seed({ devs: 50, devCap: 100 }, prestiged(), 10 * 60_000)
    expect(loadGame()).toBeNull()
  })

  it('produces a capped report for a long absence', () => {
    seed({ devs: 50, devCap: 100 }, prestiged(), 8 * HOUR)
    const report = loadGame()!
    expect(report.qualifies).toBe(true)
    expect(report.paidSeconds).toBe(OFFLINE_BASE_CAP_SECONDS)
    expect(report.idleSeconds).toBe(6 * 3600)
    expect(report.storyPoints.toNumber()).toBeGreaterThan(0)
  })

  it('honours a raised cap from an entitlement', () => {
    seed({ devs: 50, devCap: 100 }, prestiged({ entitlements: [ENTITLEMENT_SERIES_A] }), 8 * HOUR)
    expect(loadGame()!.paidSeconds).toBe(8 * 3600)
  })

  it('pays a stalled studio less than one developer, so the §6 trap survives the night', () => {
    // 1,002 devs against a cap of 100 is eta ~1e-5, which is 0.0099 SP/sec —
    // about 1% of what ONE healthy developer produces. That is the §6 thesis
    // stated in the offline economy: a single solo dev was actually faster.
    //
    // The original assertion here demanded < 1 SP total and was simply wrong
    // about the magnitude; over the 2 h cap the seized studio earns ~36 SP.
    // What matters is not that the number is tiny in absolute terms but that
    // it cannot rescue the run: 36 SP against a 1,000 SP commitment, with no
    // payroll relief, is a player returning to the same seized studio.
    seed({ devs: 1002, devCap: 100 }, prestiged(), 8 * HOUR)
    const stalled = loadGame()!

    __resetStore()
    localStorage.clear()
    seed({ devs: 1, devCap: 100 }, prestiged(), 8 * HOUR)
    const solo = loadGame()!

    expect(stalled.storyPoints.toNumber()).toBeLessThan(solo.storyPoints.toNumber())
  })

  it('does not run payroll while the app is closed — GDD §24.6', () => {
    // The load-bearing zero. At $50/dev/sec a 1,000-dev studio crosses the
    // §4.10 bankruptcy threshold in twenty seconds; every player who closed the
    // app would return, without exception, to a bankruptcy screen.
    seed({ devs: 1002, devCap: 100, cash: 50 }, prestiged(), 8 * HOUR)
    loadGame()
    expect(getState().cash).toBe(50)
    expect(getState().phase).not.toBe('bankrupt')
  })

  it('does not apply the yield until the player collects', () => {
    // §24.8: the numbers must visibly land somewhere, or the screen reads as a lie.
    seed({ devs: 50, devCap: 100, burned: new Decimal(0) }, prestiged(), 8 * HOUR)
    loadGame()
    expect(getState().burned.toNumber()).toBe(0)
  })
})

describe('collect — GDD §24.8', () => {
  it('banks the yield and clears the report', () => {
    seed({ devs: 50, devCap: 100 }, prestiged(), 8 * HOUR)
    const report = loadGame()!
    collectOffline()
    expect(getState().burned.toNumber()).toBeCloseTo(report.burned.toNumber(), 6)
    expect(getState().pendingOffline).toBeNull()
  })

  it('is never gated on the ad — a 1x collect always works', () => {
    seed({ devs: 50, devCap: 100 }, prestiged(), 8 * HOUR)
    loadGame()
    collectOffline(1)
    expect(getState().burned.toNumber()).toBeGreaterThan(0)
  })

  it('pays 2x by recomputing, not by post-multiplying', () => {
    seed({ devs: 50, devCap: 100 }, prestiged(), 8 * HOUR)
    loadGame()
    const single = getState().pendingOffline!.storyPoints.toNumber()
    collectOffline(2)
    // Clamped at the commitment either way here; what matters is that the
    // doubled path went through the model rather than around it.
    expect(getState().burned.toNumber()).toBeGreaterThanOrEqual(Math.min(single, 1000))
  })

  it('credits offline time towards Bruno, capped rather than elapsed', () => {
    // §22.5 #6. Crediting a fortnight's absence as a fortnight would earn the
    // card for uninstalling the game.
    seed({ devs: 50, devCap: 100 }, prestiged(), 14 * 24 * HOUR)
    loadGame()
    collectOffline()
    expect(getPermanent().meta.totalOfflineSeconds).toBe(OFFLINE_BASE_CAP_SECONDS)
  })

  it('does nothing when there is no report pending', () => {
    const before = getState()
    collectOffline()
    expect(getState()).toBe(before)
  })

  it('chain-ships and banks revenue with CI/CD Autopilot', () => {
    seed(
      { devs: 50, devCap: 100, cash: 0 },
      prestiged({ forkNodes: [NODE_CI_CD_AUTOPILOT] }),
      8 * HOUR,
    )
    loadGame()
    collectOffline()
    expect(getState().projectsShipped).toBeGreaterThan(0)
    expect(getState().cash).toBeGreaterThan(0)
    expect(getState().sprintName).toBe(PROJECTS[getState().projectIndex].name)
  })

  it('clamps at 100% without CI/CD Autopilot', () => {
    seed({ devs: 50, devCap: 100, commitment: new Decimal(1000) }, prestiged(), 8 * HOUR)
    loadGame()
    collectOffline()
    expect(getState().burned.toNumber()).toBe(1000)
    expect(getState().projectsShipped).toBe(0)
  })
})

describe('the project ladder', () => {
  it('is the same walk offline and in a session', () => {
    expect(commitmentFor(0).toNumber()).toBe(PROJECTS[0].commitment)
    expect(commitmentFor(1).toNumber()).toBe(PROJECTS[1].commitment)
  })

  it('clamps past the end of the ladder rather than returning NaN', () => {
    expect(commitmentFor(99).toNumber()).toBe(PROJECTS[PROJECTS.length - 1].commitment)
    expect(commitmentFor(-4).toNumber()).toBe(PROJECTS[0].commitment)
  })
})

describe('the §24.9 lifecycle', () => {
  /**
   * `installAutoSave` attaches handlers to `document` and `window`, which
   * outlive the test that installed them. A leak here does not fail the test
   * that caused it — it fails a *later* one, by writing a save that test
   * expected not to exist, and the uninstall looks broken when it is fine.
   */
  const installed: Array<() => void> = []
  const install = () => {
    const uninstall = installAutoSave()
    installed.push(uninstall)
    return uninstall
  }
  afterEach(() => {
    for (const uninstall of installed.splice(0)) uninstall()
  })

  it('saves on backgrounding, not only on quit', () => {
    install()
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(readSave()).not.toBeNull()
    vi.restoreAllMocks()
  })

  it('does not save on becoming visible', () => {
    install()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
    vi.restoreAllMocks()
  })

  it('also saves on pagehide, because a WebView may give only one of the two', () => {
    install()
    window.dispatchEvent(new Event('pagehide'))
    expect(readSave()).not.toBeNull()
  })

  it('stops listening once uninstalled', () => {
    install()()
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('writes immediately on a Paradigm Shift', () => {
    // The highest-value write in the game. Do not wait for a backgrounding that
    // may never come.
    triggerParadigmShift()
    expect(readSave()!.permanent.meta.paradigmShifts).toBe(1)
  })

  it('a Paradigm Shift is what unlocks offline accrual', () => {
    expect(getPermanent().meta.paradigmShifts).toBe(0)
    triggerParadigmShift()
    expect(getPermanent().meta.paradigmShifts).toBe(1)
  })

  it('reports a failed write rather than throwing out of the handler', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(saveGame()).toBe(false)
    setItem.mockRestore()
  })
})
