/**
 * The interface sound bank — GDD §10.8 F3, "a screen the player can operate in
 * silence fails".
 *
 * This is an API and a routing table, not a new audio layer. Playback goes
 * through the §23.2 non-negotiable-1 native path in src/audio/sfx.ts, because
 * a second Web Audio path for interface clicks would be exactly the 100–300 ms
 * WebView latency that non-negotiable is there to keep out of the product.
 *
 * TODO(sfx): four clips are owed and none exist yet. Add these stems to
 * `SOUNDS` in scripts/generate-sfx.ts and to `SFX` in src/audio/sfx.ts, then
 * delete the corresponding row from FALLBACK below:
 *
 *   ui-click.mp3   0.15s  a short dry interface click, one press, no tail
 *   ui-whoosh.mp3  0.30s  a soft panel-open air movement, no pitch
 *   ui-close.mp3   0.25s  the same, reversed and shorter
 *   ui-tick.mp3    0.05s  a very quiet typewriter tick, the §10.7 letter sound
 *
 * Until they land, every sound below routes to an existing clip that is close
 * enough to be right rather than to nothing — F3 is failed by silence, not by
 * approximation. Anything with no honest stand-in resolves to null and no-ops.
 */

import { playSfx, type SfxId } from '../audio/sfx.ts'

export type UiSound =
  /** Button press-down. F2: on down, never on up. */
  | 'click'
  /** A panel arriving. */
  | 'whoosh'
  /** A panel leaving. */
  | 'close'
  /** One revealed character — §10.7, "letters land with a tick". */
  | 'tick'

/**
 * Interim routing. `poke-desk` is a single sharp mechanical keycap click, which
 * is both the right sound for a UI press and, at a lower rate, the right sound
 * for a letter landing in a terminal — a Game Boy text tick is a click. The
 * zoom whooshes are longer than an interface transition wants but they are
 * directional air movement, which is the property that matters.
 */
const FALLBACK: Record<UiSound, SfxId | null> = {
  click: 'poke-desk',
  whoosh: 'zoom-in',
  close: 'zoom-out',
  tick: 'poke-desk',
}

/**
 * §10.7: "throttled so a fast line does not become a buzz."
 *
 * 90 ms caps the tick at ~11/sec against a reveal running at 28 chars/sec, so
 * roughly every third letter sounds. Faster than this and the stand-in clip's
 * 0.5 s tail overlaps itself into a drone; slower and the tick stops reading as
 * belonging to the text. Revisit once ui-tick.mp3 exists — a 50 ms clip can be
 * driven considerably harder.
 */
export const TICK_THROTTLE_MS = 90

/** Pure half of the throttle, so the rate can be pinned in a test. */
export function shouldTick(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= TICK_THROTTLE_MS
}

export function resolveUiSound(sound: UiSound): SfxId | null {
  return FALLBACK[sound]
}

let lastTickAt: number | null = null
let enabled = true

/**
 * Fire an interface sound. Never awaited and never throws: a missing clip is a
 * no-op, because a broken sound bank must not be able to take a button with it.
 */
export function playUi(sound: UiSound, now: number = performance.now()): void {
  if (!enabled) return

  if (sound === 'tick') {
    if (!shouldTick(lastTickAt, now)) return
    lastTickAt = now
  }

  const id = resolveUiSound(sound)
  if (id === null) return
  playSfx(id)
}

/** For a settings toggle, and for tests that would rather not hear the bank. */
export function setUiSfxEnabled(value: boolean): void {
  enabled = value
}

export function __resetUiSfx(): void {
  lastTickAt = null
  enabled = true
}
