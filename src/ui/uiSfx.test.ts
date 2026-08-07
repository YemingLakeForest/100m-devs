import { beforeEach, describe, expect, it, vi } from 'vitest'
import { playSfx } from '../audio/sfx.ts'
import {
  TICK_THROTTLE_MS,
  __resetUiSfx,
  playUi,
  resolveUiSound,
  setUiSfxEnabled,
  shouldTick,
  type UiSound,
} from './uiSfx.ts'
import { CHARS_PER_SECOND } from './typewriter.ts'

// Replaced whole rather than partially: importing the real module pulls in the
// Capacitor native-audio plugin, which does not survive being loaded outside a
// WebView. What the fallback table names is checked against the shipped files
// on disk instead, which is the stronger test anyway.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

const SOUNDS: UiSound[] = ['click', 'whoosh', 'close', 'tick']

/**
 * The clips that actually ship, read off the filesystem at transform time.
 * Vite's glob rather than node:fs because src/ is typed against vite/client
 * only, and widening it so a test can stat a file is the wrong trade.
 */
const SHIPPED = Object.keys(import.meta.glob('../../public/sfx/*.mp3'))

beforeEach(() => {
  __resetUiSfx()
  vi.mocked(playSfx).mockClear()
})

describe('the sound bank routes to clips that exist — §10.8 F3', () => {
  it('names only clips that are actually on disk', () => {
    // The dedicated ui-* clips do not exist yet and cost money to generate, so
    // every entry stands in with a clip that is already in public/sfx. A stem
    // that is in neither place is a silent failure at runtime, which is the one
    // thing a fallback table must not produce.
    for (const sound of SOUNDS) {
      const id = resolveUiSound(sound)
      if (id === null) continue
      expect(SHIPPED.some((file) => file.endsWith(`/${id}.mp3`))).toBe(true)
    }
  })

  it('leaves no state change silent', () => {
    // F3: "a screen the player can operate in silence fails."
    for (const sound of SOUNDS) expect(resolveUiSound(sound)).not.toBeNull()
  })
})

describe('the §10.7 letter tick is throttled', () => {
  it('sounds the first character of a page', () => {
    expect(shouldTick(null, 0)).toBe(true)
  })

  it('does not become a buzz at the 28 char/sec base rate', () => {
    // §10.7: "throttled so a fast line does not become a buzz." A window
    // shorter than the reveal step is not a throttle at all.
    const perCharacterMs = 1000 / CHARS_PER_SECOND
    expect(TICK_THROTTLE_MS).toBeGreaterThan(perCharacterMs)
    expect(shouldTick(0, perCharacterMs)).toBe(false)
  })

  it('sounds again once the window has passed', () => {
    expect(shouldTick(0, TICK_THROTTLE_MS)).toBe(true)
  })

  it('drops the ticks inside the window and keeps the ones outside it', () => {
    playUi('tick', 0)
    playUi('tick', 10)
    playUi('tick', TICK_THROTTLE_MS)
    expect(playSfx).toHaveBeenCalledTimes(2)
  })

  it('throttles only the tick — a button press is never dropped', () => {
    // F2 puts the click on pointer-down. A press swallowed because the last
    // press was recent is a control that did not respond to being touched, and
    // §21 Act I is four minutes of presses arriving 200 ms apart.
    playUi('click', 0)
    playUi('click', 1)
    expect(playSfx).toHaveBeenCalledTimes(2)
  })
})

describe('the bank can be silenced without taking a control with it', () => {
  it('no-ops when disabled', () => {
    setUiSfxEnabled(false)
    expect(() => playUi('click')).not.toThrow()
    expect(playSfx).not.toHaveBeenCalled()
  })
})
