/**
 * What the monitor says — the captions under the survey, the voice of STUDIO_OS past the block.
 * [2026-10-11; GDD §7.7.2's "only if those stops acquire mechanics of their own".]
 *
 * Up to the neighbourhood every object in the game is a gag (a name plate, a mug, a house that
 * arrives on thrusters); past the hand-off the captions were sincere telemetry — `10,000 DEVELOPERS
 * ONLINE`, `TAP A WORLD · DRAG TO EXPLORE` — and the picture read as a different, serious game.
 * The thesis (§7.7.2: *the studio is no longer a place where anyone thinks about people*) is the
 * monitor's whole reason to exist, but it was played straight, so it never landed as the punchline.
 *
 * The rule this file keeps is **the dashboard is deadpan, and every number in it is true**. A caption
 * may be dry about a fact; it may not invent one. The jokes are the facts put side by side:
 *
 * - **One constant goes all the way up: the app.** The studio has exactly one project in flight at
 *   a time (§3), so every title on the survey says `1 APP`, and the network, where the numbers are
 *   largest, says how done that app is: at a hundred worlds the title still reads `1 APP, 2% DONE`.
 *   The HUD has always carried the project on the left; this is the monitor admitting it can see it.
 * - **The bands are the scenario picker's own notes, shipped.** `game/scenarios.ts` has had *"One
 *   site, on a planet that has not noticed"* and *"the planet is full and there is nowhere left to put
 *   a desk"* since the picker was written, visible only to someone who loads `?scenarios`.
 * - **The affordance never goes.** Every caption keeps its verb (SELECT / TAP): a joke that costs the
 *   player the instruction for the control is not a joke, it is a bug.
 *
 * Pure — no store, no clock, no renderer. The survey passes facts in and paints what comes back.
 */

import { formatCount } from './headcount.ts'

export interface Caption {
  /** The big line: the true number and the constant. */
  title: string
  /** The small line: the band's remark, then the instruction. */
  detail: string
}

/** The widest a caption line may be, in map glyphs: the survey frame is 62% of the width at 4 px a glyph. */
export const CAPTION_MAX = 62

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** `7.9M`, `100M`: what the globe's population readout has always said (it spelt the capacity out by hand). */
export function compactPopulation(n: number): string {
  return n < 1e6 ? Math.floor(n).toLocaleString() : (n / 1e6).toFixed(1).replace(/.0$/, '') + 'M'
}

/** How much of the project in flight is burned, as a whole per cent; `null` when there is nothing true to say. */
export function percentDone(burned: number | null | undefined): number | null {
  if (burned === null || burned === undefined || !Number.isFinite(burned)) return null
  return Math.min(100, Math.max(0, Math.floor(burned * 100)))
}

const appClause = (done: number | null) => (done === null ? '1 APP' : `1 APP, ${done}% DONE`)

/**
 * What a locked stop on the address bar says when it is pressed [2026-10-11]. It is the interface's
 * own idiom for a link that is down, it names the price, and it is true to the headcount: the figure
 * comes from `headcountToReach`, the same table the lens's ceiling reads, so the sign cannot disagree
 * with the door.
 */
export function lockNote(needs: number, has: number): string {
  const n = (v: number) => (Number.isFinite(v) ? formatCount(v).toUpperCase() : 'MORE')
  return `NO SIGNAL · NEEDS ${n(needs)} DEVELOPERS, HAS ${n(has)}`
}

export interface CityFacts {
  /** Developers in this city — `regionPopulation`. */
  population: number
  /** Developers in the studio — the HUD's number. */
  total: number
  /** Offices lit, and offices there are. */
  occupied: number
  offices: number
  /** The hub's name, as the address bar says it. */
  city: string
}

/**
 * The district survey. The title says *how much of the studio this is*: a city holds 41,600 and the HUD
 * said 100 K, which read as a contradiction when it was only a map of one city, not the studio.
 */
export function cityCaption(f: CityFacts): Caption {
  const of = f.population < f.total ? ` OF ${f.total.toLocaleString()}` : ''
  const full = f.occupied >= f.offices
  return {
    title: `${f.population.toLocaleString()}${of} DEVELOPERS · 1 APP`,
    detail: full
      ? `${f.offices} / ${f.offices} OFFICES · ${f.city.toUpperCase()} IS FULL · SELECT TO VISIT`
      : `${f.occupied} / ${f.offices} OFFICES ONLINE · SELECT TO VISIT`,
  }
}

export interface GlobeFacts {
  /** Developers on this world, of `WORLD_CAPACITY`. */
  population: number
  capacity: number
  hubs: number
  /** The selected city, if there is one: a selection is the player's, and the survey says so plainly. */
  selected: string | null
}

/** The planet's remarks, by how full it is — the scenario picker's notes (`game/scenarios.ts`), shipped. */
export const GLOBE_BANDS = [
  { upTo: 0.02, text: 'ONE PLANET, NOBODY HAS NOTICED' },
  { upTo: 0.2, text: 'THE DARK SIDE READS AS A MAP NOW' },
  { upTo: 1, text: 'RUNNING OUT OF PLANET' },
  { upTo: Infinity, text: 'EARTH IS FULL. NO DESKS LEFT' },
] as const

export function globeBand(population: number, capacity: number): string {
  const fill = capacity > 0 ? population / capacity : 0
  return (GLOBE_BANDS.find((b) => fill < b.upTo) ?? GLOBE_BANDS[GLOBE_BANDS.length - 1]).text
}

export function globeCaption(f: GlobeFacts): Caption {
  return {
    title: `${compactPopulation(f.population)} / ${compactPopulation(f.capacity)} DEVELOPERS · ${f.hubs} ${plural(f.hubs, 'HUB', 'HUBS')} · 1 APP`,
    detail: f.selected ? `SELECTED: ${f.selected}` : `${globeBand(f.population, f.capacity)} · > SELECT A CITY`,
  }
}

export interface NetworkFacts {
  /** Worlds the studio fills, Earth included. */
  worlds: number
  /** The project's burned fraction (0–1), or `null` if the store has none to give. */
  burned: number | null
  /** How far the next system to settle is, in light-years — the chart's own figure — or `null` if there is no next. */
  nextLy?: number | null
}

/**
 * The network's remarks, by how many worlds there are. Dry about distance, because distance is the only
 * cost. The first quotes the chart's own figure for the next system (Proxima is 4.24 light-years in
 * `colonyNetwork.ts`), so the dryness is a measurement and not a rounding.
 */
export const NETWORK_BANDS = [
  { upTo: 1, text: (ly: number | null | undefined) => (ly ? `EARTH IS FULL. NEXT DESK: ${ly.toFixed(1)} LIGHT-YEARS` : 'EARTH IS FULL. THE NEXT DESK IS FAR') },
  { upTo: 10, text: () => 'EVERY WORLD STILL SHARES ONE BACKLOG' },
  { upTo: 100, text: () => 'LIGHT-LAG IS NOW PART OF STANDUP' },
  { upTo: Infinity, text: () => 'A HUNDRED WORLDS. THE APP DOES NOT KNOW' },
] as const

export function networkBand(worlds: number, nextLy?: number | null): string {
  return (NETWORK_BANDS.find((b) => worlds <= b.upTo) ?? NETWORK_BANDS[NETWORK_BANDS.length - 1]).text(nextLy)
}

export function networkCaption(f: NetworkFacts): Caption {
  return {
    title: `${f.worlds} ${plural(f.worlds, 'WORLD', 'WORLDS')} CONNECTED · ${appClause(percentDone(f.burned))}`,
    detail: `${networkBand(f.worlds, f.nextLy)} · TAP A WORLD`,
  }
}
