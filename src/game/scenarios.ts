/**
 * Pre-canned studios, one per decade of headcount — the tool for looking at
 * §7.7.1's ladder without playing to the top of it.
 *
 * §26.2 is a phase about what the game looks like at a hundred million
 * developers, and there is no way to reach a hundred million developers by
 * playing that does not take longer than a session. `?devs=250000` already
 * existed for exactly that reason and is still the right idea; this is the same
 * idea with the two things that made it unusable in practice taken out.
 *
 * ## What a scenario sets, and the two lessons in it
 *
 * **Money**, because §4.10d's payroll is continuous and a studio of forty
 * thousand people handed no cash bankrupts inside one tick. That is correct
 * behaviour and it is not what anybody loading a scenario is trying to look at.
 * `?devs` learned this one already.
 *
 * **Every scene retired**, which `?devs` did *not* know and which cost a
 * measurement. A scene halts the tick and hangs §10.7a.3's scrim over the whole
 * viewport — and that scrim owns the pointer, so on 2026-08-18 a wheel aimed at
 * the middle of the screen landed on a `div` and the camera silently never
 * moved. Loading a headcount without retiring the script therefore hands you a
 * studio of a million people you cannot look at, behind a dialogue box about
 * hiring your second developer. `scripts/scale.probe.mjs` still carries a
 * `settle()` that exists solely to click through that, and the header of that
 * file is the write-up.
 *
 * ## What a scenario deliberately does NOT set
 *
 * A career. No prestige, no tree, no cards, no back catalogue — the flag sets a
 * headcount and the things that would otherwise stop you looking at it, and
 * nothing else. So what is on screen is **the renderer's answer to a
 * headcount**, not a save file somebody has to unpick afterwards, and a
 * scenario cannot quietly become a second definition of what a studio of a
 * million people is. `?full` is the other tool and it does the opposite job:
 * one hand-built frame with everything on it at once, for §23.4.2's rail.
 *
 * Reached three ways, all of them the same list:
 *
 * - `?scenarios` — the picker, and the only one that switches without a reload
 * - `?scenario=town` — one-shot, for scripts and screenshots
 * - {@link applyScenario} — from a test or a console
 */

import { getPermanent, setPermanent } from './save.ts'
import { SCENES } from './scenes.ts'
import { __setState } from './store.ts'
import { rungFor } from '../sim/headcount.ts'
import { newRoster } from '../sim/roles.ts'

export interface Scenario {
  /** Stable, and what `?scenario=` takes. */
  id: string
  /** The headcount, on a button. */
  label: string
  devs: number
  /** One line naming what this one is *for*. Shown in the picker. */
  note: string
}

/**
 * The decades — GDD §7.7.1's ten rungs, sampled once each where they change.
 *
 * Decades rather than round studio sizes because the question a scenario
 * answers is "what does an order of magnitude look like", and because §7.7.1's
 * bands are themselves powers of ten. The list stops at §13.5's gate: a hundred
 * million is the number the game is named after and the largest headcount any
 * part of the design has committed to drawing.
 */
export const SCENARIOS: readonly Scenario[] = [
  { id: 'solo', label: '1', devs: 1, note: 'Act I. You, alone, and the share of one developer is exactly 1.' },
  { id: 'ten', label: '10', devs: 10, note: 'A garage. Every face is a face and every numeral is legible.' },
  { id: 'squad', label: '100', devs: 100, note: '§7.8.1a’s squad — the grain the aggregate is generated at.' },
  { id: 'floor', label: '1 K', devs: 1e3, note: '§7.7.1’s floor arrives, and the room is exactly full at ROOM_DEV_CAP.' },
  { id: 'building', label: '10 K', devs: 1e4, note: 'A building. The last rung where a seat window can hold everybody.' },
  { id: 'campus', label: '100 K', devs: 1e5, note: 'A campus. Past here the people are generated on demand, never stored.' },
  { id: 'town', label: '1 M', devs: 1e6, note: 'One site, on a planet that has not noticed. A park is exactly full here.' },
  { id: 'metro', label: '10 M', devs: 1e7, note: 'Ten sites. The dark side starts being readable as a map.' },
  { id: 'nation', label: '100 M', devs: 1e8, note: '§13.5’s gate. The planet is full and there is nowhere left to put a desk.' },
]

/**
 * Is the picker asked for? Read once — a query string cannot change mid-session.
 *
 * `import.meta.env.DEV` is true under `npm run dev`, and `npm run dev` is what
 * `scripts/ui-frame.acceptance.mjs` starts — so the flag is the load-bearing
 * half of this condition, not the environment. A bar that appeared on every dev
 * build would appear in all 68 of that gate's screens and overlap the things it
 * measures the overlap of.
 *
 * It lives here rather than beside the component because the component file may
 * only export a component; see the `react-refresh` rule.
 */
export const SCENARIOS_UP =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('scenarios')

export function scenarioById(id: string): Scenario | null {
  return SCENARIOS.find((s) => s.id === id) ?? null
}

/**
 * A headcount somebody typed, as a number — or `null` if it was not one.
 *
 * Accepts what a person actually types when they mean a hundred million:
 * `100000000`, `100,000,000`, `100 000 000`, `100m`, `1e8`, `0.1b`. The suffixes
 * are the load-bearing part and the reason this is a function rather than a
 * `Number()` call at the call site — the whole point of the tool is the sizes
 * above a million, and nobody wants to count zeroes to get to one.
 *
 * Rejects rather than clamps, because a typo that silently becomes a studio of
 * zero is worse than a box that stays red until it says something.
 */
export function parseHeadcount(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/[, _]/g, '')
  if (!t) return null
  const m = /^([0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)([kmbt])?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return null
  const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[2] ?? ''] ?? 1
  const devs = Math.floor(n * scale)
  return Number.isSafeInteger(devs) ? devs : null
}

/** The §7.7.1 rung this headcount has earned — how far out the lens may go. */
export function scenarioRung(s: Scenario): number {
  return rungForCount(s.devs)
}

/** The same, for a headcount somebody typed rather than one on a button. */
export function rungForCount(devs: number): number {
  return rungFor(Math.max(0, Math.floor(Number.isFinite(devs) ? devs : 0))).rung
}

/**
 * Cash that survives §4.10d's payroll for long enough to look at something.
 *
 * A million per head is not a number with any meaning in the economy; it is
 * "more than the burn can eat while you are reading the screen". Being obviously
 * arbitrary is the point — a scenario that handed out a *plausible* balance
 * would be inventing an economy nobody asked it to invent.
 */
function fundingFor(devs: number): number {
  return Math.max(1e6, devs * 1e6)
}

/**
 * Put the studio at this scenario. Reversible only by loading another one —
 * this writes over the run.
 *
 * The camera is **not** moved here, and that is deliberate: this module is
 * store-side and the lens belongs to the renderer. The caller pairs it with
 * `camera.set(zAtRung(scenarioRung(s)))`, which is one line and keeps
 * `game/` from importing `render/`.
 */
export function applyScenario(s: Scenario): void {
  applyHeadcount(s.devs)
}

/**
 * Put the studio at **any** headcount — the decades on the buttons, and every
 * number between them.
 *
 * The buttons are a list of interesting sizes and the interesting sizes are not
 * always the decades: rung 6 spans two of them, so "what does 40 million look
 * like" is a real question with no button on it, and "what does the frame after
 * the sixty-first site look like" is a question you can only ask by typing
 * 61,000,001. Everything {@link applyScenario} was doing was already a function
 * of one number; this is that function, with the button taken off the front.
 */
export function applyHeadcount(count: number): void {
  const devs = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0))

  // Every scene, recorded as already seen. Recorded rather than suppressed, on
  // the same argument `?full` records the four arrivals: a career that has a
  // million developers in it has been through all of them, and a suppression
  // flag would be a second code path for the scene system to be wrong in.
  const p = getPermanent()
  const seen = new Set([...p.meta.milestones, ...Object.keys(SCENES)])
  setPermanent({
    ...p,
    meta: { ...p.meta, milestones: [...seen], peakDevs: Math.max(p.meta.peakDevs, devs) },
  })

  __setState({
    devs,
    roster: newRoster(devs),
    // Twice the headcount, so §6's cap is not the thing on screen. A scenario
    // parked exactly on its own ceiling reads as a studio that has stalled.
    devCap: Math.max(2, devs * 2),
    cash: fundingFor(devs),
    peakDevs: devs,
    // The scrim, and anything already holding the pointer under it.
    scene: null,
    event: null,
    // Nothing carried over from whatever was on screen before: a buff or a
    // floater from a studio of ten is a lie about a studio of ten million, and
    // a selected seat may not exist in the new one at all.
    buffs: [],
    floaters: [],
    selected: null,
    pokeRate: 0,
  })
}
