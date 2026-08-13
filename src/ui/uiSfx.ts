/**
 * The interface sound bank — GDD §10.8 F3, "a screen the player can operate in
 * silence fails".
 *
 * This is an API and a routing table, not a new audio layer. Playback goes
 * through the §23.2 non-negotiable-1 native path in src/audio/sfx.ts, because
 * a second Web Audio path for interface clicks would be exactly the 100–300 ms
 * WebView latency that non-negotiable is there to keep out of the product.
 *
 * The four interface clips now exist and each sound has its own. They used to
 * borrow from the gameplay bank, and it was wrong in a way that only becomes
 * obvious out loud: opening a panel played `zoom-in`, a 1.2 s rising suction
 * whoosh written for a camera crossing nine orders of magnitude. It sang, and
 * it was still singing after the 320 ms panel had settled.
 *
 * The lesson is worth keeping even though the TODO is gone: **a sound borrowed
 * from another context brings that context's length with it.** A whoosh built
 * for a camera move is not a short whoosh, and no amount of it being the right
 * *kind* of sound fixes being four times too long.
 *
 * FALLBACK still exists and still points at gameplay clips, because a missing
 * file must degrade to something rather than to nothing — F3 is failed by
 * silence, not by
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
   * §10.9.4 — START pressed, the lights coming up and the camera pushing in.
   *
   * **The same trap this file's header describes, found a second time and in
   * the worst possible place.** The title screen fired `zoom-in` — 1.2 seconds
   * of "down-pitched laser chirp rushing toward the listener", written for a
   * camera crossing nine orders of magnitude — over a push-in that is
   * `PUSH_IN_MS = 420 ms`. It was still swooping most of a second after the
   * title had gone, and it is the **first sound anybody ever hears from this
   * game**.
   *
   * It had a comment defending it: "this is the camera moving, not a control
   * acknowledging a finger." That reasoning is right and the conclusion did not
   * follow — the camera move is 420 ms, so a 1.2 s clip is not this camera's
   * voice either. Being the right *kind* of sound never fixes being three times
   * too long.
   */
  | 'start'

/**
 * Which clips are actually in the bundle.
 *
 * Vite's glob rather than `node:fs` because this is shipped code, and a clip
 * that is listed in `SFX` but absent from `public/sfx` would otherwise route a
 * sound to silence with nothing to say so.
 */
const SHIPPED = new Set(
  Object.keys(import.meta.glob('../../public/sfx/*.{mp3,wav}')).map((f) => {
    const name = f.slice(f.lastIndexOf('/') + 1)
    return name.slice(0, name.lastIndexOf('.'))
  }),
)

function hasClip(id: SfxId): boolean {
  return SHIPPED.has(id)
}

/** Each interface sound has its own clip — GDD §10.7, §10.8 F2 and F3. */
const UI_CLIP: Record<UiSound, SfxId> = {
  click: 'ui-click',
  whoosh: 'ui-whoosh',
  close: 'ui-close',
  tick: 'ui-tick',
  // Not generated yet — `scripts/generate-sfx.ts` carries the spec and it needs
  // an ElevenLabs key. Until somebody has one this resolves through FALLBACK,
  // which is exactly what the fallback table is for: the clip can be dropped in
  // later and picked up with no code change.
  start: 'title-start',
}

/**
 * Where each sound goes if its clip is missing from the bank.
 *
 * Deliberately *not* the zoom whooshes any more. A panel falling back to a
 * 1.2 s camera sweep is worse than a panel falling back to a click: the click
 * is merely plain, and the sweep is a different scene arriving.
 */
const FALLBACK: Record<UiSound, SfxId | null> = {
  click: 'poke-desk',
  whoosh: 'poke-desk',
  close: 'poke-desk',
  tick: 'poke-desk',
  // **Not a zoom**, which is the whole point of this entry existing. `ui-whoosh`
  // is half a second and is prompted "no pitch sweep, no whistle, no tail" —
  // the three properties that made the old sound a swoop rather than a start.
  start: 'ui-whoosh',
}

/**
 * §10.7: "throttled so a fast line does not become a buzz."
 *
 * Was 90 ms, which capped the tick at ~11/sec and sounded detached from a
 * reveal running at 28 chars/sec — roughly every third letter. That rate was
 * not a choice about how text should sound; it was the shortest interval at
 * which the stand-in clip's half-second tail stopped overlapping itself into a
 * drone. The clip was setting the design.
 *
 * With a real tick, 55 ms puts it at ~18/sec — about every other letter, which
 * is where a Game Boy text box sits. Still throttled, because §10.7 asks for
 * exactly that: one tick per character at 28/sec is a buzz, not a voice.
 */
export const TICK_THROTTLE_MS = 55

/** Pure half of the throttle, so the rate can be pinned in a test. */
export function shouldTick(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= TICK_THROTTLE_MS
}

export function resolveUiSound(sound: UiSound): SfxId | null {
  const clip = UI_CLIP[sound]
  return hasClip(clip) ? clip : FALLBACK[sound]
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

/**
 * §11.4.5 — the two-part purchase cue.
 *
 * A short mechanical latch on the press, and a resolving tone on the unlock,
 * {@link PURCHASE_RESOLVE_MS} apart. The gap is what makes it read as *cause
 * and effect* rather than as one doubled noise. Both halves borrow the
 * interface bank — dedicated `ui-latch` / `ui-resolve` clips are an ElevenLabs
 * item and fall back like everything else, so the rhythm ships even while the
 * bespoke clips do not.
 */
export const PURCHASE_RESOLVE_MS = 120

export function playPurchase(now: number = performance.now()): void {
  playUi('click', now)
  setTimeout(() => playUi('whoosh', performance.now()), PURCHASE_RESOLVE_MS)
}

export function __resetUiSfx(): void {
  lastTickAt = null
  enabled = true
}
