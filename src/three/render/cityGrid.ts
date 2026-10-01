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
const addresses: CityBlock[] = []
for (let z = -16; z <= 16; z++) for (let x = -16; x <= 16; x++) addresses.push({ x: streetAxis(x), z: streetAxis(z) })
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

/** A continuous retro-burn, with a queued hover before the final approach. */
export function houseLanding(seconds: number, wait = 0) {
  const t = Math.max(0, seconds)
  let height: number
  if (t < .4) height = 30 - 22 * (t / .4) ** 2
  else if (t < 1.2) height = 1 + 7 * (1 - (t - .4) / .8) ** 3
  else if (t < 1.2 + wait) height = 1
  else height = Math.max(0, 1 - (t - 1.2 - wait) / .3)
  const landed = t >= 1.5 + wait
  const contact = t - 1.5 - wait
  return { height, burning: t >= .4 && !landed, landed,
    squash: landed && contact < .2 ? 1 - .06 * Math.sin(Math.PI * contact / .2) : 1 }
}
