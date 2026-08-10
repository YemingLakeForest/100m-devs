/**
 * The pokeable unit — GDD §4.5b, R15.
 *
 * §4.5 made the poke a thing you do to a *person*, and §7.7.1 then spent ten
 * rungs establishing that a person is only what the camera holds for the first
 * three of them. The consequence was visible and dull: above the room
 * `pickDeveloper` returned −1 and **a tap at rung 4 did nothing at all** — the
 * game's primary verb switched itself off at exactly the headcount where the
 * player has the most developers to be doing something with.
 *
 * §4.5b's answer is not a bigger poke, it is a different one:
 *
 * > Whatever unit §7.7.1 says the camera is currently holding — a person, a
 * > squad, a floor, a building, a campus, a town, a nation, a planet, a galaxy
 * > — **that unit is the thing a tap lands on**, and the buff applies to
 * > everything inside it. [...] This scales the **verb**.
 *
 * So this module answers four questions about a rung, and nothing else: what
 * the unit is called, how many developers are in one, how many there are, and
 * **which seats each one covers**. The last is the one that does the work —
 * §4.5a's buff has to reach the individuals inside the unit, and a range of
 * seats is how a buff on a town of a million people stays one small object.
 *
 * Pure, and deliberately ignorant of both the renderer and the store. The
 * sizes are *read off §7.7.1's own headcount bands* rather than written down a
 * second time, which is the only way a table copied out of a design document
 * cannot drift from it.
 */

import { TOP_RUNG } from './ladder.ts'

export type UnitKind =
  | 'developer'
  | 'floor'
  | 'building'
  | 'campus'
  | 'town'
  | 'nation'
  | 'planet'
  | 'galaxy'

/**
 * §7.7.1's "unit that arrives" column, one entry per rung.
 *
 * Rungs 0, 1 and 2 are all a person, which is §7.7.1's own emphasis — "the same
 * picture at three densities, and that is the point" — and is why this is a
 * per-rung list rather than a per-view one. The three room rungs differ in what
 * the camera holds, not in what a tap lands on.
 *
 * `developer` rather than §7.7.1's "person" because it is the word the HUD
 * already uses everywhere else (§10.2a: if a player would have to be told what
 * it means, it is not ready to be on screen), and DEVS is the readout it sits
 * under.
 */
export const UNIT_KINDS: readonly UnitKind[] = [
  'developer',
  'developer',
  'developer',
  'floor',
  'building',
  'campus',
  'town',
  'nation',
  'planet',
  'galaxy',
]

/**
 * The bottom of each rung's §7.7.1 headcount band — and therefore the size of
 * the unit that arrives at it.
 *
 * The identity is worth stating because it is what makes the table honest
 * rather than arbitrary: rung 3 covers 10³–10⁴ and the thing that arrives is a
 * floor, so **a floor is a thousand people** — the band's lower bound *is* the
 * unit size, at every rung, by construction. Rungs 0–2 cover 1–10³ with a
 * person arriving, so their unit is 1.
 */
const BAND_FLOOR: readonly number[] = [1, 1, 1, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e13]

function clampRung(rung: number): number {
  if (!Number.isFinite(rung)) return 0
  return Math.max(0, Math.min(TOP_RUNG, Math.floor(rung)))
}

/** What §7.7.1 says the camera is holding at this rung. */
export function unitKindAt(rung: number): UnitKind {
  return UNIT_KINDS[clampRung(rung)]
}

/** The same thing, as a word for the HUD. */
export function unitLabel(rung: number): string {
  return unitKindAt(rung)
}

/** How many developers a *full* unit at this rung holds. */
export function nominalUnitSize(rung: number): number {
  return BAND_FLOOR[clampRung(rung)]
}

function headcount(devs: number): number {
  return Number.isFinite(devs) ? Math.max(0, Math.floor(devs)) : 0
}

/**
 * The seats unit `index` covers, as a half-open range.
 *
 * **The ranges tile the studio exactly** — no gaps, no overlaps, `[0, devs)`
 * partitioned — and that is the property everything downstream leans on. It is
 * what lets §4.5a's buff be summed over units or over people and give the same
 * answer, so a poke can never pay for the same developer twice.
 */
export function unitSeats(rung: number, index: number, devs: number): { from: number; to: number } {
  const n = headcount(devs)
  const size = nominalUnitSize(rung)
  const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0

  const from = Math.min(n, i * size)
  const to = Math.min(n, from + size)
  return { from, to }
}

/**
 * How many developers are in *this particular* unit.
 *
 * The last unit at any rung is partial, and it matters: a tower carrying 1,400
 * developers has one full floor and a second with four hundred people on it.
 * Charging §4.5b's size penalty for a thousand either way would scale the buff
 * by people the studio has not hired.
 */
export function unitSizeAt(rung: number, index: number, devs: number): number {
  const { from, to } = unitSeats(rung, index, devs)
  return to - from
}

/**
 * How many units this rung is showing.
 *
 * The partial one counts, because it is on screen and can be poked. At least
 * one always exists — an empty studio still has a thing the camera is holding,
 * and a rung with nothing to tap is the §4.5b hole this module closes.
 */
export function unitCount(rung: number, devs: number): number {
  return Math.max(1, Math.ceil(headcount(devs) / nominalUnitSize(rung)))
}
