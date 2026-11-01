/** §7.7.2: addresses survive growth; the garage owns the origin. */
export const BLOCK_SIZE = 30
export const STREET_WIDTH = 3
export const BLOCK_PITCH = BLOCK_SIZE + STREET_WIDTH
export const HOUSE_CAPACITY = 100
/** The existing visual ceiling, pending density and the region view. */
export const CITY_CAPACITY = 1800
export interface CityBlock { x: number; z: number }

// Sort a large enough square, then take its inscribed circle. Sorting each
// requested prefix separately would move already occupied addresses on growth.
/** Every third row opens a pedestrian avenue while the first neighbourhood stays familiar. */
export function streetAxis(index:number) { return index*BLOCK_PITCH+Math.trunc(index/3)*8 }
const addresses: (CityBlock & { ix: number; iz: number })[] = []
for (let z = -16; z <= 16; z++) for (let x = -16; x <= 16; x++) addresses.push({ x: streetAxis(x), z: streetAxis(z), ix: x, iz: z })
addresses.sort((a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z || a.z - b.z || a.x - b.x)
export function cityBlock(index: number): CityBlock {
  if (!Number.isInteger(index) || index < 0 || index > CITY_CAPACITY / HOUSE_CAPACITY) throw new RangeError('Unknown city block')
  const at = addresses[index]
  return { x: at.x, z: at.z }
}

/** Both distances use one ordering: zooming out must not reshuffle the first
 * eighteen addresses into a different diagram. The district reserves HQ too. */
export function districtBlock(index: number): CityBlock {
  if (!Number.isInteger(index) || index < 0 || index > 417) throw new RangeError('Unknown district block')
  const at = addresses[index]
  return { x: at.x, z: at.z }
}

const addressRank = new Map<string, number>()
addresses.forEach((a, i) => addressRank.set(a.ix + ',' + a.iz, i))

/**
 * **The unfold's hinge** [2026-10-31, at the user's instruction: *"each office expansion it's a unfold and expand to a
 * new office space"*, then *"don't just unfold from one direction, the headquarter should be in the center"*]. A new
 * block is hinged on the edge it shares with its oldest standing neighbour, so the city opens outward from the garage
 * in every direction the sort reaches, and every block always has something to be glued to. The neighbour is the next
 * address along an axis, across a street or an avenue alike; the unit step (`dx`, `dz`) points at it.
 */
export function cityHinge(index: number): { dx: number; dz: number } {
  if (!Number.isInteger(index) || index < 1 || index > CITY_CAPACITY / HOUSE_CAPACITY) throw new RangeError('Unknown city block')
  const at = addresses[index]
  let best = Infinity, dx = 0, dz = 0
  for (const [sx, sz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const k = addressRank.get((at.ix + sx) + ',' + (at.iz + sz))
    if (k !== undefined && k < best) { best = k; dx = sx; dz = sz }
  }
  return { dx, dz }
}

/** How long a house takes to swing open, and how long until nothing is left of its settle. */
export const UNFOLD_SECONDS = 1.6
export const UNFOLD_SETTLE = 0.9
/** The hinge sits this far under the floor, so the folded house lies below its neighbour's ground, out of sight. */
export const UNFOLD_SINK = 0.7

/**
 * A house's pose at `seconds` since it was ordered, after `wait` seconds in a queue. `phi` is the signed swing about the
 * hinge: it starts folded (a half turn under the neighbour), sweeps up through hanging straight down, arrives flat,
 * and overshoots a few degrees above flat once before settling. The overshoot is small because a house is nine
 * metres tall: 0.2 rad, which a flat floor plate carried, would throw the far wall six metres into the air.
 */
export function houseUnfold(seconds: number, wait = 0) {
  const t = seconds - wait
  const ease = (x: number) => x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2
  const folded = -(Math.PI - .06)
  let phi: number
  if (t < 0) phi = folded
  else if (t < UNFOLD_SECONDS) phi = folded * (1 - ease(t / UNFOLD_SECONDS))
  else { const tau = t - UNFOLD_SECONDS; phi = tau >= UNFOLD_SETTLE ? 0 : .09 * Math.exp(-7 * tau) * Math.abs(Math.sin(15 * tau)) }
  return { phi, started: t >= 0, landed: t >= UNFOLD_SECONDS, done: t >= UNFOLD_SECONDS + UNFOLD_SETTLE }
}
