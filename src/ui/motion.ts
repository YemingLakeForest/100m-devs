/**
 * The motion budget — GDD §10.5, enforced as the §10.8 F1/F6 gate.
 *
 * Durations and eases live here rather than in the stylesheet because
 * reduce-motion has to *scale* them (§10.5 rule 3: shorten to ~40%, never turn
 * a transition into a hard cut), and a CSS-only budget cannot be scaled without
 * restating every value a second time under a media query. Components push the
 * resolved number down as an inline custom property; the stylesheet only ever
 * reads `var(--ui-in)` / `var(--ui-out)`.
 *
 * Nothing here may exceed 400 ms except a deliberately scored beat — F6: "if
 * the player is waiting for the game to finish being beautiful, it is not
 * beautiful."
 */

import { useEffect, useState } from 'react'
import { getSettings, resolveReducedMotion, subscribeSettings } from '../settings/settings.ts'

/**
 * The §10.5 curve column, as CSS timing functions.
 *
 * `outBack` is the "slight overshoot" the modal row asks for. Its control
 * points overshoot to ~1.06, which on a 0.94 -> 1 scale lands the panel a
 * few pixels large before it settles — visible on a phone, not comic.
 */
export const EASE = {
  outCubic: 'cubic-bezier(0.33, 1, 0.68, 1)',
  inCubic: 'cubic-bezier(0.32, 0, 0.67, 0)',
  inOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
  inOutQuart: 'cubic-bezier(0.76, 0, 0.24, 1)',
  outBack: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

/** Milliseconds, straight off the §10.5 table. */
export const DURATION = {
  /** Modal open — "scale-and-blur-up over ~320 ms" (§10.6, last row). */
  panelIn: 320,
  /** "Faster out than in — always." */
  panelOut: 180,
  /** The spring return after a press. Not on the §10.5 table; F2 governs it. */
  buttonRelease: 200,
} as const

/** §10.5 rule 3 — reduce-motion shortens to ~40% and drops parallax. */
const REDUCED_SCALE = 0.4

/**
 * A floor, because 40% of a short transition is a cut in everything but name,
 * and F1 does not exempt the accessibility path. Two frames at 60 Hz is the
 * least motion that still reads as motion.
 */
const MIN_MS = 64

const QUERY = '(prefers-reduced-motion: reduce)'

function systemPrefersReducedMotion(): boolean {
  // jsdom has no matchMedia, and neither does a server render. Absence means
  // no stated preference, which is the default: full motion.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(QUERY).matches
}

/**
 * The answer everything in the UI actually asks for — the player's preference
 * resolved against the system's (Appendix F2.1, §10.5 rule 3).
 *
 * The media query used to *be* this function, which meant the accommodation was
 * whatever the operating system said and the game had no opinion. It still
 * defaults to that, and it can now be overridden in both directions, because an
 * OS motion setting is one switch for every app on the device.
 */
export function prefersReducedMotion(): boolean {
  return resolveReducedMotion(getSettings().motion, systemPrefersReducedMotion())
}

/** Scale one duration for the current preference. Pure when `reduced` is passed. */
export function motionMs(ms: number, reduced: boolean = prefersReducedMotion()): number {
  if (!reduced) return ms
  return Math.max(MIN_MS, Math.round(ms * REDUCED_SCALE))
}

/**
 * Subscribed rather than read once: the preference can be toggled while the
 * app is running, and a panel that keeps animating at full length after the
 * user has asked it not to is the failure this accommodation exists to avoid.
 *
 * **Two sources, one answer.** The OS query can change under a running app and
 * so can the F2.1 setting — and the setting's own screen is a panel, so it
 * animates using the value it is in the middle of changing. Both are subscribed
 * so the toggle takes effect on the frame it is pressed rather than at the next
 * launch, which is the only way a player can tell what the control does.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const sync = () => setReduced(prefersReducedMotion())
    const offSettings = subscribeSettings(sync)

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return offSettings
    }
    const mq = window.matchMedia(QUERY)
    mq.addEventListener('change', sync)
    return () => {
      offSettings()
      mq.removeEventListener('change', sync)
    }
  }, [])

  return reduced
}
