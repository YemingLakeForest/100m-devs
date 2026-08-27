/**
 * The stranded-at-Act-III save, and the load path that lets one exist.
 *
 * Reported three times, and the first two "fixes" were both correct and both
 * useless, which is the lesson worth keeping:
 *
 *  1. `offerFor` was checked and proved right. It was right.
 *  2. `triggerParadigmShift` was fixed to stop *creating* the state. It did.
 *
 * Neither helped, because the broken phase was already **written into the
 * player's save**, and every reload restored it. A code fix that requires the
 * player to clear localStorage is not a fix — for a shipped game there is no
 * one to tell.
 *
 * So the test is written from the save file inwards rather than from the
 * function outwards: this is the state that was on screen, and this is what
 * loading it must produce.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SAVE_KEY, SAVE_VERSION, emptyPermanent, makeSaveData, serialize, setPermanent } from './save.ts'
import { actionFor, offerFor } from '../hud/hudModel.ts'
import { __resetStore, getState, loadGame } from './store.ts'

/**
 * Write a save file directly, the way a previous build would have.
 *
 * `shifts` is the career the save belongs to. §21.0e made it load-bearing: the
 * repair below only fires for a career that has prestiged, because Run 1's own
 * Act III now legitimately holds **one** developer.
 */
function seed(over: Partial<ReturnType<typeof getState>>, shifts = 1) {
  const p = emptyPermanent()
  const save = makeSaveData({ ...getState(), ...over })
  localStorage.setItem(
    SAVE_KEY,
    serialize({
      ...save,
      permanent: { ...p, meta: { ...p.meta, paradigmShifts: shifts } },
      version: SAVE_VERSION,
      savedAt: Date.now(),
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  setPermanent(emptyPermanent())
})

describe('a save stranded at Act III by the old Paradigm Shift', () => {
  it('does not show the mousetrap after loading', () => {
    // The reported screen, exactly: DEVS 2, CASH $0, SHIPPED 1, the offer up
    // and unaffordable, and no way out because act3_bait only exits on
    // `devs > 502`.
    seed({ devs: 2, cash: 0, projectsShipped: 1, phase: 'act3_bait', massHired: false })
    loadGame()

    const s = getState()
    expect(s.phase).not.toBe('act3_bait')
    expect(offerFor(s.phase, s.massHired)).toBeNull()
  })

  it('leaves the player somewhere they can actually play', () => {
    seed({ devs: 2, cash: 0, projectsShipped: 1, phase: 'act3_bait', massHired: false })
    loadGame()

    const s = getState()
    // A verb, and the controls a prestiged player has already earned.
    expect(actionFor(s.phase)?.action).toBe('hire')
    expect(s.dialUnlocked).toBe(true)
    expect(s.seedTaken).toBe(true)
  })

  it('leaves a legitimate Act III alone', () => {
    // The repair has to be narrow. A player who is *genuinely* mid-trap must not
    // have it taken away.
    seed({ devs: 40, cash: 8_000, projectsShipped: 3, phase: 'act3_bait', massHired: false })
    loadGame()

    const s = getState()
    expect(s.phase).toBe('act3_bait')
    expect(offerFor(s.phase, s.massHired)).not.toBeNull()
  })

  it('leaves Run 1’s own Act III alone, at one developer — §21.0e', () => {
    // **The regression this repair would otherwise have become.** Its old test
    // was "a small headcount at Act III can only have arrived by prestige",
    // which was true while Run 1 hired to forty to reach the mousetrap. Run 1
    // now arrives there with James and nobody else, so the headcount test would
    // have caught every legitimate Run 1 save and thrown it into a hiring loop
    // Run 1 does not have. The honest question is whether the career has ever
    // prestiged.
    seed(
      {
        devs: 1,
        cash: 63_550,
        projectsShipped: 3,
        phase: 'act3_bait',
        massHired: false,
        seedTaken: true,
      },
      0,
    )
    loadGame()

    const s = getState()
    expect(s.phase).toBe('act3_bait')
    expect(offerFor(s.phase, s.massHired)).not.toBeNull()
  })

  it('leaves a post-mass-hire Act III alone', () => {
    // Saved in the instant between the Mass Hire and the phase advancing.
    // `massHired` is what says this player pressed it, so nothing is stranded.
    seed({ devs: 1_042, cash: 0, projectsShipped: 3, phase: 'act3_bait', massHired: true })
    loadGame()
    expect(getState().phase).toBe('act3_bait')
  })
})

describe('the load path carries what the save carries', () => {
  it('reads back the flags it writes', () => {
    // `seedTaken` and `dialUnlocked` were persisted and never restored, so a
    // returning player silently lost the hire dial and was offered the term
    // sheet a second time. Found while fixing the above: the save had been
    // carrying both since they existed, and only the restore was missing.
    seed({ devs: 30, phase: 'act2_loop', seedTaken: true, dialUnlocked: true })
    loadGame()

    const s = getState()
    expect(s.seedTaken).toBe(true)
    expect(s.dialUnlocked).toBe(true)
  })
})
