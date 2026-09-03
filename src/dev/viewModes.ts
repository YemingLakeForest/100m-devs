/**
 * **Two switches for looking at the scene** — the CRT glass, and the lens's
 * rails.
 *
 * Both exist for the same reason and it is not a preference. §7.8.0c's garage
 * is converged against concept art by *comparing pictures*, and the two things
 * that make that comparison hardest are the two things this file turns off:
 *
 * - **The post chain** (§7.6a) sits between the room and the eye. `?nopost`
 *   could already drop it, but only at load, so answering "is that haze the
 *   bloom or the wall?" cost a reload — and a reload throws away the studio you
 *   were looking at. The same argument `simSpeed.ts` makes about `?speed`.
 * - **The magnetic stops** (§7.2) hold the camera on a rung and refuse to leave
 *   it. That is right for play: nothing between two levels is a picture of
 *   anything. It is exactly wrong for inspection, where the question is usually
 *   "what does that corner of the shell actually look like", and the answer
 *   needs the camera parked half a rung in and off centre, which the settle
 *   undoes about a second after you get there.
 *
 * ## The gate
 *
 * {@link DEBUG_TOOLS_ENABLED} is the sole authority, as it is for every seam in
 * `dev/`. Deployed HTML and a Capacitor-native build cannot reach the setters —
 * they return the shipped value and write nothing — so neither switch can
 * become a shipped cheat by being wired to a control that shipped by accident.
 * Free zoom in particular is a §7.7.1 rule ("the studio you can see is the
 * studio you have"), and a build that let a player past it would be telling
 * them the world is a backdrop they are pointing at.
 *
 * ## Seeded, then live
 *
 * `?nopost` still means what it always did, and is read here as *the initial
 * value of the switch* rather than as a constant. `?freezoom` seeds the other.
 */

import { DEBUG_TOOLS_ENABLED, debugSearchParams } from './debugAccess.ts'

/** The two switches, and the shipped value of each. */
export interface ViewModes {
  /** §7.6a's post chain. On in every build that is not being inspected. */
  readonly crt: boolean
  /**
   * §7.2's rails, off. The camera keeps no magnetic stop, is not held to
   * §7.7.1's ceiling, and may be pushed further in than a desk.
   */
  readonly freeZoom: boolean
}

const SHIPPED: ViewModes = { crt: true, freeZoom: false }

/**
 * What the query string asked for, or the shipped pair.
 *
 * `debugSearchParams` is already empty outside an authorised local browser
 * session, so this needs no second deployment check — which is the whole reason
 * that function exists.
 */
export function initialViewModes(): ViewModes {
  const q = debugSearchParams()
  return {
    // `?nopost` is the old spelling and keeps working; `?crt=off` is the one
    // that reads as a switch rather than as a suppression.
    crt: !q.has('nopost') && q.get('crt') !== 'off',
    freeZoom: q.has('freezoom') && q.get('freezoom') !== 'off',
  }
}

let modes: ViewModes = initialViewModes()
const listeners = new Set<(next: ViewModes) => void>()

/** The switches as they stand. The shipped pair outside a local session. */
export function getViewModes(): ViewModes {
  return DEBUG_TOOLS_ENABLED ? modes : SHIPPED
}

/**
 * Move one or both switches. Returns where they landed, which is not always
 * what was asked — the same contract `setSimSpeed` has, and for the same
 * reason: a control with a readout on it must not be able to disagree with the
 * thing it is reporting.
 */
export function setViewModes(next: Partial<ViewModes>): ViewModes {
  if (!DEBUG_TOOLS_ENABLED) return SHIPPED
  const merged: ViewModes = { ...modes, ...next }
  if (merged.crt === modes.crt && merged.freeZoom === modes.freeZoom) return modes
  modes = merged
  for (const fn of [...listeners]) fn(modes)
  return modes
}

/** Flip one switch. The keyboard's half, and the console's. */
export function toggleViewMode(which: keyof ViewModes): ViewModes {
  return setViewModes({ [which]: !getViewModes()[which] })
}

/** Told when either switch moves. Returns its own unsubscribe. */
export function onViewModes(fn: (next: ViewModes) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * The keys, and the two globals beside them.
 *
 * Installed once from `App.tsx` when the session is an authorised local one, so
 * the switches work in *any* local session rather than only under
 * `?scenarios` — the scenario bar is a tool for choosing a headcount and these
 * are tools for looking at whatever is already on screen.
 *
 * `C` and `V` because the keys that were free are the ones next to each other:
 * §26.2's scenario bar owns the digits, `-`, `=` and the backtick, and the
 * gallery and the release window own Escape and Enter. Ignored while a field
 * has focus, for `ScenarioBar`'s own reason — typing a headcount must not
 * toggle the picture.
 *
 * Returns its own teardown.
 */
export function installViewModeKeys(): () => void {
  if (!DEBUG_TOOLS_ENABLED || typeof window === 'undefined') return () => {}
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.isContentEditable)) return
    if (e.key === 'c' || e.key === 'C') toggleViewMode('crt')
    else if (e.key === 'v' || e.key === 'V') toggleViewMode('freeZoom')
  }
  window.addEventListener('keydown', onKey)
  const g = globalThis as unknown as Record<string, unknown>
  // Same family as `__pick`, `__room` and `__cam`: a question you can ask from
  // a console or a probe without having to synthesise a keystroke.
  g.__crt = (on?: boolean) => setViewModes({ crt: on ?? !getViewModes().crt }).crt
  g.__freeZoom = (on?: boolean) => setViewModes({ freeZoom: on ?? !getViewModes().freeZoom }).freeZoom
  g.__viewModes = () => getViewModes()
  return () => {
    window.removeEventListener('keydown', onKey)
    delete g.__crt
    delete g.__freeZoom
    delete g.__viewModes
  }
}

/** Test seam: put both switches back where a fresh session starts. */
export function __resetViewModes(): void {
  modes = initialViewModes()
  listeners.clear()
}
