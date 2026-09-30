/** §7.7: aggregate cells own exact ranges of hundred-person houses. */
export const WORLD_CAPACITY = 100_000_000
export const WORLD_REGIONS = 2400
export const HOUSES_PER_WORLD = WORLD_CAPACITY / 100
export function regionHouses(region: number) {
  const first = Math.floor(region * HOUSES_PER_WORLD / WORLD_REGIONS)
  const end = Math.floor((region + 1) * HOUSES_PER_WORLD / WORLD_REGIONS)
  return { first, end }
}
export function worldPopulation(total: number, world: number) {
  return Math.max(0, Math.min(WORLD_CAPACITY, Math.floor(total) - world * WORLD_CAPACITY))
}
export function houseAddress(world: number, house: number) { return world * WORLD_CAPACITY + house * 100 }
export function regionPopulation(total: number, world: number, region: number) {
  const { first, end } = regionHouses(region)
  return Math.max(0, Math.min((end - first) * 100, worldPopulation(total, world) - first * 100))
}
/** Index, rather than a rounded coordinate, is the address even on cube seams. */
export function globeCell(index: number): [number, number, number] {
  const face = Math.floor(index / 400), cell = index % 400
  const a = ((cell % 20) + .5) / 10 - 1, b = (Math.floor(cell / 20) + .5) / 10 - 1
  const v = [[a, b, 1], [1, b, -a], [-a, b, -1], [-1, b, a], [a, 1, -b], [a, -1, b]][face]
  const length = Math.hypot(...v)
  return v.map(n => n / length) as [number, number, number]
}
