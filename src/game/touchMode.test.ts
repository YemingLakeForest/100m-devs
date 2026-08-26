/**
 * What the finger does — GDD §7.7.6b.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  INITIAL_TOUCH_MODE,
  ROOM_TOP_RUNG,
  TOUCH_HINT,
  TOUCH_ICON,
  TOUCH_LABEL,
  TOUCH_LATCHES,
  touchHint,
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

describe('the caption above the room — GDD §7.7.1, §4.5b', () => {
  it('stops talking about people where there are none', () => {
    // Rungs 0–2 are the room. From 3 up a unit is a floor, a building, a town,
    // and all three latch captions are false: there is nobody to tap, nobody to
    // drag, and nobody whose card to open.
    for (const mode of MODES) {
      expect(touchHint(mode, 0)).toBe(TOUCH_HINT[mode])
      expect(touchHint(mode, ROOM_TOP_RUNG)).toBe(TOUCH_HINT[mode])
      expect(touchHint(mode, 3)).not.toBe(TOUCH_HINT[mode])
    }
  })

  it('names the gesture that gets you back down', () => {
    // The question this exists to answer: *"at the 10k view, how do I select
    // which floor to go?"* The double tap worked; nothing on screen had ever
    // said so, which makes it not a feature. Both verbs are named, because both
    // exist at every rung above the room.
    const hint = touchHint('poke', 4)
    expect(hint).toMatch(/2/)
    expect(hint.length).toBeLessThanOrEqual(24)
  })

  it('says the same thing whatever the latch, because the latch is inert', () => {
    // `tapVerb` forces `poke` above the room, so a caption that changed with
    // the switch would be describing a control that is not doing anything.
    const hints = new Set(MODES.map((mode) => touchHint(mode, 5)))
    expect(hints.size).toBe(1)
  })

  it('survives nonsense', () => {
    expect(touchHint('poke', Number.NaN)).toBe(TOUCH_HINT.poke)
    expect(touchHint('poke', -3)).toBe(TOUCH_HINT.poke)
  })
})

describe('the DRAG latch — [2026-08-26]', () => {
  it('is called DRAG, not MOVE', () => {
    // MOVE is the roster's verb: §13.8's banner says MOVE HERO and `Roster.tsx`
    // says PLACE, MOVE, OR REVIEW. Two different gestures wearing one word.
    expect(TOUCH_LABEL.grab).toBe('DRAG')
  })

  it('agrees with the caption underneath it', () => {
    // The caption has said DRAG A DEVELOPER since the day it shipped and the
    // button above it said something else.
    expect(TOUCH_HINT.grab).toContain(TOUCH_LABEL.grab)
  })

  it('draws the four-direction move cursor everyone already knows', () => {
    expect(TOUCH_ICON.grab).toBe('\u2190\u2195\u2192')
    // Three answers it beat: a plus sign that said "add" and "medical" and
    // mostly nothing, a cheering man that reads as celebration or as nothing,
    // and a drag handle that was fine but not this obvious.
    expect(TOUCH_ICON.grab).not.toBe('+')
    expect(TOUCH_ICON.grab).not.toBe('\\o/')
    expect(TOUCH_ICON.grab).not.toBe(':::')
  })

  it('keeps the two latches the same width, so the rail does not reflow', () => {
    expect(TOUCH_ICON.grab.length).toBe(TOUCH_ICON.poke.length)
  })

  it('never asks the pixel font for a glyph it does not have', () => {
    /**
     * **The real constraint, and the one the old assertion missed.** This used
     * to demand printable ASCII, which is a proxy for "in the font" that is
     * wrong in both directions: it forbids the arrows Departure Mono certainly
     * has, and it would happily pass a Latin-1 character it does not.
     *
     * A missing glyph never fails loudly. The browser substitutes a system face
     * and one icon in the rail is silently drawn in a different typeface at a
     * different weight — and on Capacitor-Android, with nothing to fall back
     * to, it is a tofu box. So the list below is the font's actual coverage for
     * the ranges these icons draw from, read out of
     * `src/assets/fonts/DepartureMono-Regular.woff2`'s own `cmap`.
     *
     * Notably absent, and the reason the move cursor is spelled from three
     * glyphs rather than one: U+2725, U+271C, U+2B0C and U+2B0D.
     */
    const IN_FONT = (cp: number) =>
      // ASCII, which the font covers in full.
      (cp >= 0x20 && cp <= 0x7e) ||
      // The arrows it has: U+2190..U+2193 and U+2195..U+2199.
      (cp >= 0x2190 && cp <= 0x2193) ||
      (cp >= 0x2195 && cp <= 0x2199)

    for (const [latch, icon] of Object.entries(TOUCH_ICON)) {
      for (const ch of icon) {
        expect(IN_FONT(ch.codePointAt(0) ?? 0), `${latch}: ${ch}`).toBe(true)
      }
    }
  })

  it('rejects the one-codepoint move arrow, which this font does not carry', () => {
    // Kept as a named fact rather than a comment, because the next person to
    // reach for it will reach for exactly these.
    for (const missing of ['\u2725', '\u271c', '\u2b0c', '\u2b0d']) {
      expect(Object.values(TOUCH_ICON).join('')).not.toContain(missing)
    }
  })
})
