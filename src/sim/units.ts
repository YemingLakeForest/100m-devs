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

import { LEVEL_SIZES } from './aggregate.ts'
import { TOP_RUNG } from './ladder.ts'

export type UnitKind =
  | 'developer'
  | 'floor'
  | 'building'
  | 'campus'
  | 'site'
  | 'world'
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
  // **A site, and not §7.7.1's town.** `HANDOFF-2026-08-23.md` §0 spends rung 6's
  // two decades on the planet, so the thing that arrives at 10^6 is a *site* of
  // it — a whole business park, which is exactly what `BAND_FLOOR[6]` already
  // said it was. Only the word changed, and it is a word the HUD says out loud:
  // a hero placed at this rung read `TOWN 3` over a picture of a world.
  'site',
  // **A world, and not §7.7.1's nation.** §7.7.1a spends rung 7 on the galactic
  // network, so the thing that arrives at 10^8 is a *whole planet* — which is
  // exactly what `BAND_FLOOR[7]` already said it was, and exactly what
  // `frames.GLOBE_CAP` derives from the tiling. Only the word changed, and it
  // is a word the HUD says out loud: a hero placed at this rung read
  // `NATION 3` over a picture of a star field, which is the same defect the
  // town-to-site rename fixed one rung down.
  'world',
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

/**
 * §7.8.1a's **squad**, and §26.2.2's "block of 100" — the grain the aggregate
 * is generated at.
 *
 * Read off `aggregate.ts`'s ladder rather than written down again, because the
 * two have to agree about what a block is: §26.2.5's line 4 asks whether a
 * block's stated output equals the sum of the hundred people it generates, and
 * that question is meaningless if the room's hundred and the arithmetic's
 * hundred are different hundreds.
 */
export const SEAT_WINDOW_GRAIN = LEVEL_SIZES[1]

/**
 * What is on screen at one rung, and where in it the lens is pointed.
 *
 * ## The bug this exists to end
 *
 * Every view above the room was fed the *studio's* headcount and drew units
 * `0..9` of it, at every rung, saturating at ten. So the ladder was not a
 * hierarchy at all — it was five unrelated pictures of the first corner of the
 * studio. Descending into the third town and then into the fifth campus gave
 * campus five **of the studio**, not campus five of town three, and every unit
 * past the tenth at every rung was not merely hard to reach: it had no address
 * and could not be looked at by any sequence of gestures.
 *
 * §7.7.1's ladder is a tree and the branching is already right — a storey is a
 * thousand people, a building is ten storeys, a campus ten buildings, a town
 * ten campuses. What was missing was the **address**: one number saying which
 * part of the studio the lens is over, from which everything else follows.
 *
 * ## The address is a seat
 *
 * Not a path, not a stack, not a per-rung index — a single global seat number.
 * The unit in view at rung `r` is the one holding that seat, its siblings are
 * the other children of its parent, and *nothing has to be kept in sync*.
 * Descending sets the seat; ascending does not touch it; a hire cannot
 * invalidate it. A path would have to be trimmed on every rung change and
 * repaired whenever the studio grew or shrank, and a path that is one entry
 * stale points somewhere real and wrong, which is the worst way to be wrong.
 *
 * The room is the same function with a different `max`: the people are the
 * children of a storey, `nominalUnitSize(3) / nominalUnitSize(2)` of them,
 * which is a thousand — and a thousand is exactly `ROOM_DEV_CAP`. The two
 * numbers agreeing is not a coincidence to be grateful for, it is
 * `DEVS_PER_STOREY`, and it means descending from a tower storey shows that
 * storey's people and no one else's.
 *
 * @param rung  Which §7.7.1 rung the units on screen belong to.
 * @param seat  The address — any seat inside the unit being looked at.
 * @param devs  The studio, for the ragged last unit.
 * @param max   How many the view can draw. Ten for the city and the tower;
 *              `ROOM_DEV_CAP` for the room.
 */
export interface UnitWindow {
  /** Global index of the first unit drawn. */
  from: number
  /** How many are drawn. Never more than `max`; fewer at the end of a studio. */
  count: number
  /** How many children the parent has, drawn or not. `count` when they all fit. */
  total: number
  /** Which drawn unit holds `seat`, as an offset into the window. −1 if none. */
  focus: number
}

export function unitWindow(rung: number, seat: number, devs: number, max: number): UnitWindow {
  const n = headcount(devs)
  const r = clampRung(rung)
  const size = nominalUnitSize(r)
  const cap = Math.max(1, Math.floor(Number.isFinite(max) ? max : 1))
  if (n <= 0) return { from: 0, count: 0, total: 0, focus: -1 }

  // Clamped into the studio, so an address left behind by a studio that has
  // since shrunk lands on the last person rather than on an empty plot.
  const s = Math.min(n - 1, Math.max(0, Number.isFinite(seat) ? Math.floor(seat) : 0))

  // The parent's seats. At the top rung the parent is the studio itself —
  // there is nothing above a galaxy to be a child of.
  const parentSize = r >= TOP_RUNG ? Number.POSITIVE_INFINITY : nominalUnitSize(r + 1)
  const parentFrom = Number.isFinite(parentSize) ? Math.floor(s / parentSize) * parentSize : 0
  const parentTo = Number.isFinite(parentSize) ? Math.min(n, parentFrom + parentSize) : n

  // `parentFrom` is a whole number of parents and a parent is a whole number of
  // children, so this division is exact.
  const first = parentFrom / size
  const total = Math.max(0, Math.ceil((parentTo - parentFrom) / size))

  // Paged, for the one place in the reachable range where a parent has more
  // children than a view can hold: a nation is a hundred towns and the city
  // draws ten. The page holding the focus is the page you are on.
  const offset = Math.max(0, Math.floor(s / size) - first)
  const page = Math.floor(offset / cap) * cap
  const count = Math.max(0, Math.min(cap, total - page))
  return { from: first + page, count, total, focus: count > 0 ? offset - page : -1 }
}

/**
 * The address to move to when the player descends into a unit — GDD §26.2.2.
 *
 * The unit's **first seat**, so descending into the third building lands on the
 * first person in it rather than wherever the previous address happened to be.
 * Clamped back into the studio, because the last unit at any rung is ragged and
 * a rung the studio has only just reached may have units with nobody in them:
 * arriving in an empty room reads as a bug, arriving in the last half-full one
 * is the truth.
 */
export function seatForUnit(rung: number, index: number, devs: number): number {
  const n = headcount(devs)
  if (n <= 0) return 0
  const { from } = unitSeats(rung, index, n)
  return Math.min(n - 1, Math.max(0, from))
}
