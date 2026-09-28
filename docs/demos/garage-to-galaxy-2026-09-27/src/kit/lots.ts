import { WIN } from './grid.ts'

/**
 * **The first expansions: office storeys dropped onto the neighbours' plots.**
 *
 * The user, 2026-09-27: *"in our first few expansions we can do a dramatic drop a
 * new office floor across the road"*. It is GDD §7.7.2 verbatim — *"a complete,
 * furnished, already-populated storey drops out of the sky and lands … with a
 * whump"* — and it keeps the other instruction on file, 2026-09-25: *"I don't
 * want my garage moved to a building."* The garage never moves and never gets a
 * roof put over it. The street around it becomes the studio, plot by plot.
 *
 * **Across the lane first, not across the street.** The camera looks at the
 * garage from the front (§12.1's (1,1,1)), so a tower across the front street
 * stands between the lens and the founder. The lane behind puts the first tower
 * *behind* the garage in the picture: the garage stays in front, the storeys
 * stack up over its roofline. The front plots come last, when the camera is far
 * enough out that nothing is hidden by them.
 *
 * Plots are in the garage's own metres (the garage's origin is the HQ block's
 * centre). `clear` is the rectangle of the neighbourhood that goes when the
 * first storey lands.
 */
export interface Lot {
  name: string
  x: number
  z: number
  w: number
  d: number
  floors: number
  clear: readonly [number, number, number, number]
}

export const LOTS: readonly Lot[] = [
  { name: 'ACROSS THE LANE', x: 0, z: -28.4, w: 32, d: 13, floors: 18, clear: [-19.5, -36, 19.5, -20.6] },
  { name: 'THE WEST PLOT', x: -33.5, z: -1.5, w: 21, d: 25, floors: 12, clear: [-47, -16, -21.4, 14.5] },
  { name: 'NORTH-WEST CORNER', x: -33.5, z: -32.5, w: 21, d: 18, floors: 15, clear: [-47, -44, -21.4, -20.6] },
  { name: 'THE BACK ROW', x: 0, z: -46.5, w: 34, d: 8, floors: 11, clear: [-19.5, -50, 19.5, -40.6] },
  { name: 'NORTH-EAST CORNER', x: 33.5, z: -32.5, w: 21, d: 18, floors: 14, clear: [21.4, -44, 47, -20.6] },
  { name: 'THE EAST PLOT', x: 33.5, z: -1.5, w: 21, d: 25, floors: 12, clear: [21.4, -16, 47, 14.5] },
  { name: 'SOUTH-WEST CORNER', x: -33.5, z: 34, w: 21, d: 20, floors: 10, clear: [-47, 20, -21.4, 50] },
  { name: 'ACROSS THE STREET', x: 0, z: 30, w: 32, d: 13, floors: 10, clear: [-19.5, 20.2, 19.5, 37] },
  { name: 'SOUTH-EAST CORNER', x: 33.5, z: 34, w: 21, d: 20, floors: 10, clear: [21.4, 20, 47, 50] },
]

export const perFloorOf = (w: number, d: number): number =>
  2 * (Math.max(1, Math.floor(w / WIN)) + Math.max(1, Math.floor(d / WIN)))

/** The garage's twenty, then the plots in order: where each plot's seats begin. */
export const GARAGE_SEATS = 20
export function lotSeats(): { base: number[]; per: number[]; capacity: number[]; end: number } {
  const base: number[] = [], per: number[] = [], capacity: number[] = []
  let s = GARAGE_SEATS
  for (const lot of LOTS) {
    const p = perFloorOf(lot.w, lot.d)
    base.push(s); per.push(p); capacity.push(p * lot.floors)
    s += p * lot.floors
  }
  return { base, per, capacity, end: s }
}
