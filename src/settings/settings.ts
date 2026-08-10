/**
 * Player preferences — GDD Appendix F2.1, and the §20 mixer nothing exposed.
 *
 * **Every accommodation in this game was, until now, a thing the operating
 * system decided.** Reduce motion came from a media query, volume came from the
 * hardware keys, and haptics could not be turned off at all. That is defensible
 * for motion and indefensible for the other two: a phone's volume rocker is a
 * *single* control, so a player who wants the music down and the pokes loud has
 * no way to say so, and F2.1 lists the mixer as the first missing thing in a
 * screen that does not exist.
 *
 * F2.1's full list is settled here except for the two that need a store this
 * app has not built yet — restore purchases (F1.5) needs RevenueCat and data
 * deletion (F1.4) needs a cloud document. Reset progress is the local half of
 * F1.4 and it *is* here, because a save that cannot be cleared is a game that
 * can only be reviewed once.
 *
 * ---
 *
 * **Held outside the game store on purpose.** §24's save document is the run
 * and the prestige layers; it is merged, migrated and reset by prestige. A
 * volume slider is none of those things — it belongs to the *device*, it must
 * survive a Codebase Fork that deliberately erases everything else, and it must
 * be readable before the store has loaded so the first sound the game makes is
 * already at the volume the player chose. Putting it in `SaveData` would make
 * "what does a prestige reset" a harder question for no gain.
 */

/** §10.5 rule 3 is the *system's* answer. These are the player's three. */
export type MotionPreference = 'system' | 'full' | 'reduced'

export interface Settings {
  /** §20.1's music bus, 0–1. */
  music: number
  /** §20.5's interaction layer, 0–1. */
  sfx: number
  /** §8.3. A phone in a quiet room, and some people simply hate it. */
  haptics: boolean
  motion: MotionPreference
}

/**
 * Music sits under the effects because §20.1 makes it a bed, not a foreground
 * layer, and a bed mixed level with the pokes is a bed you notice. Neither
 * starts at 1: the first launch should sound like a mix somebody made, and a
 * player who wants it louder has a control now.
 */
export const DEFAULT_SETTINGS: Settings = {
  music: 0.6,
  sfx: 0.8,
  haptics: true,
  motion: 'system',
}

/**
 * `m100devs_` prefixed for the same reason `SAVE_KEY` is — SAVE.md §4 records
 * key collision across games on a shared web origin as a trap, and a browser
 * build shares an origin with every other studio game. A collision here would
 * be quieter and worse than one on the save: another game's settings object
 * would parse, coerce to something plausible, and silently re-mix this one.
 */
export const SETTINGS_KEY = 'm100devs_settings'

/** The OPTIONS meter is ten cells, and the volume has exactly that resolution. */
export const VOLUME_STEPS = 10
export const VOLUME_STEP = 1 / VOLUME_STEPS

/**
 * Snap to the meter's own resolution, so the number and the bar cannot disagree.
 *
 * **Multiply by the step count; never divide by the step size.** `0.1` is
 * slightly *above* a true tenth in binary, so `0.95 / 0.1` is `9.4999…` and
 * rounds down — a value sitting exactly on a half-step gets decided by floating
 * point rather than by the rounding rule, and it disagrees with the arithmetic
 * the meter itself does. Multiplying by 10 puts the same value at `9.5` and it
 * rounds the way anybody reading the code would expect.
 */
export function quantiseVolume(v: number): number {
  if (!Number.isFinite(v)) return 0
  const clamped = Math.min(1, Math.max(0, v))
  return Math.round(clamped * VOLUME_STEPS) / VOLUME_STEPS
}

/**
 * Read an unknown blob into a valid {@link Settings} — total, never throws.
 *
 * The same discipline `save.ts` applies to a save document, for the same
 * reason: this parses JSON written by an older build, by a different game that
 * won a key collision, or by a user who opened devtools. **A settings object
 * that fails to load must degrade to the defaults silently**, because the
 * alternative is a black screen over a volume slider.
 */
export function coerceSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }
  const r = raw as Record<string, unknown>

  const volume = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? quantiseVolume(value) : fallback

  const motion: MotionPreference =
    r.motion === 'full' || r.motion === 'reduced' || r.motion === 'system'
      ? r.motion
      : DEFAULT_SETTINGS.motion

  return {
    music: volume(r.music, DEFAULT_SETTINGS.music),
    sfx: volume(r.sfx, DEFAULT_SETTINGS.sfx),
    haptics: typeof r.haptics === 'boolean' ? r.haptics : DEFAULT_SETTINGS.haptics,
    motion,
  }
}

/**
 * The player's motion answer, resolved against the system's — §10.5 rule 3.
 *
 * `system` defers, which is the default and the right one: somebody who has set
 * the preference at OS level has already answered this question once and should
 * not have to answer it again per app. The two explicit values exist because
 * the OS setting is all-or-nothing across every app on the device, and "I want
 * reduced motion in my email client and the full thing in my game" is a
 * coherent position that the media query alone cannot express.
 */
export function resolveReducedMotion(pref: MotionPreference, systemPrefers: boolean): boolean {
  if (pref === 'reduced') return true
  if (pref === 'full') return false
  return systemPrefers
}

// --- the live value --------------------------------------------------------

let current: Settings = { ...DEFAULT_SETTINGS }
const listeners = new Set<(s: Settings) => void>()

export function getSettings(): Settings {
  return current
}

/**
 * Subscribe to changes.
 *
 * The audio layer uses this rather than reading the value per sound: `playSfx`
 * runs inside the tap handler that §23.3 criterion 1 measures, and a native
 * volume call across the Capacitor bridge on every poke would put bridge
 * latency inside that measurement. Push on change, read a local number on play.
 */
export function subscribeSettings(fn: (s: Settings) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function publish(): void {
  for (const fn of listeners) fn(current)
}

/**
 * Change one or more preferences and persist immediately.
 *
 * Written on every change rather than on backgrounding, unlike §24.9's save.
 * The volumes are the exception that proves that rule: a player drags a slider
 * and force-quits to check whether it stuck, and the settings document is four
 * fields rather than a run.
 */
export function setSettings(patch: Partial<Settings>): void {
  const next = coerceSettings({ ...current, ...patch })
  current = next
  writeSettings(next)
  publish()
}

/** Read storage into the live value. Call once, at boot, before any sound. */
export function loadSettings(): Settings {
  current = coerceSettings(readRaw())
  publish()
  return current
}

function readRaw(): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY)
    return raw === null || raw === undefined ? null : JSON.parse(raw)
  } catch {
    // Private browsing, a disabled storage API, or malformed JSON. All three
    // mean "no stated preference", which is exactly the defaults.
    return null
  }
}

function writeSettings(s: Settings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // Storage full or unavailable. The session keeps the setting; the next
    // launch does not. Failing loudly here would be a modal over a volume knob.
  }
}

/** Test seam, in the same family as the store's `__resetStore`. */
export function __resetSettings(): void {
  current = { ...DEFAULT_SETTINGS }
  try {
    globalThis.localStorage?.removeItem(SETTINGS_KEY)
  } catch {
    /* see writeSettings */
  }
  publish()
}
