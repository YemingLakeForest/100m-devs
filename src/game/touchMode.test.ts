/**
 * What the finger does — GDD §7.7.6b.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  INITIAL_TOUCH_MODE,
  TOUCH_HINT,
  TOUCH_LABEL,
  TOUCH_LATCHES,
  tapVerb,
  toggleTouch,
  type TouchMode,
} from './touchMode.ts'
import {
  __resetStore,
  getState,
  loadGame,
  saveGame,
  selectDeveloper,
  setTouchMode,
} from './store.ts'

const MODES: TouchMode[] = ['poke', 'grab', 'inspect']

beforeEach(() => {
  __resetStore()
})

describe('the latches', () => {
  it('lights the one that was pressed', () => {
    expect(toggleTouch('inspect', 'poke')).toBe('poke')
    expect(toggleTouch('inspect', 'grab')).toBe('grab')
    expect(toggleTouch('grab', 'poke')).toBe('poke')
    expect(toggleTouch('poke', 'grab')).toBe('grab')
  })

  it('keeps the selected tool selected when pressed again', () => {
    expect(toggleTouch('poke', 'poke')).toBe('poke')
    expect(toggleTouch('grab', 'grab')).toBe('grab')
    expect(toggleTouch('inspect', 'inspect')).toBe('inspect')
  })

  it('never lands anywhere that is not a mode', () => {
    for (const from of MODES) {
      for (const latch of TOUCH_LATCHES) {
        expect(MODES).toContain(toggleTouch(from, latch))
      }
    }
  })

  it('is an explicit, idempotent tool selector', () => {
    for (const from of MODES) {
      for (const latch of TOUCH_LATCHES) {
        expect(toggleTouch(toggleTouch(from, latch), latch)).toBe(latch)
      }
    }
  })
})

describe('what a tap means', () => {
  it('is the mode, in the room', () => {
    for (const mode of MODES) expect(tapVerb(mode, true)).toBe(mode)
  })

  it('is always a poke above the room', () => {
    // §4.5b — a unit at rung 4 is a building. There is nobody to pick up and
    // nobody whose card to open, and a mode that silently switched the game's
    // primary verb off at the top of the ladder is the exact failure §4.5b was
    // written to have fixed.
    for (const mode of MODES) expect(tapVerb(mode, false)).toBe('poke')
  })
})

describe('the mode the game opens in', () => {
  it('is POKE, because Act I says TAP TO CODE', () => {
    // The one place "default to checking people" cannot be taken literally: a
    // first tap that opened a personnel card would leave a new player looking
    // at a stat block with no evidence the game had started.
    expect(INITIAL_TOUCH_MODE).toBe('poke')
    expect(getState().touchMode).toBe('poke')
  })

  it('is not restored from a previous session', () => {
    // An input mode carried across a reload is a control the player did not set
    // looking exactly like a game that has stopped responding. `loadGame`
    // rebuilds from `freshRun()`, so the guarantee is that nothing in the save
    // path can reach this field — including a save written while GRAB was lit.
    setTouchMode('grab')
    saveGame()
    __resetStore()
    setTouchMode('grab')
    loadGame()
    expect(getState().touchMode).toBe(INITIAL_TOUCH_MODE)
  })
})

describe('the store', () => {
  it('selects a tool directly', () => {
    setTouchMode('grab')
    expect(getState().touchMode).toBe('grab')
    setTouchMode('grab')
    expect(getState().touchMode).toBe('grab')
  })

  it('closes the card when the mode stops being the one that opened it', () => {
    // The panel is a consequence of the neutral mode, so it must not outlive
    // it — otherwise a card sits over the floor with no gesture left that could
    // have dismissed it.
    setTouchMode('inspect')
    selectDeveloper(4)
    expect(getState().selected).toBe(4)
    setTouchMode('grab')
    expect(getState().selected).toBeNull()
  })

  it('leaves the selection alone while the info tool is being entered', () => {
    setTouchMode('inspect')
    expect(getState().touchMode).toBe('inspect')
    selectDeveloper(2)
    expect(getState().selected).toBe(2)
  })
})

describe('the copy', () => {
  it('names a consequence for every mode, including the neutral one', () => {
    // An unlit pair of latches with no caption is a control that looks switched
    // off rather than one that is in its third state.
    for (const mode of MODES) expect(TOUCH_HINT[mode]).toBeTruthy()
  })

  it('fits the rail — §10.1, and the labels are the whole control', () => {
    for (const latch of TOUCH_LATCHES) {
      expect(TOUCH_LABEL[latch].length).toBeLessThanOrEqual(6)
    }
    for (const mode of MODES) expect(TOUCH_HINT[mode].length).toBeLessThanOrEqual(24)
  })

  it('never writes "SP" — R12', () => {
    const all = [...Object.values(TOUCH_LABEL), ...Object.values(TOUCH_HINT)].join(' ')
    expect(/\bSP\b/.test(all)).toBe(false)
  })
})
