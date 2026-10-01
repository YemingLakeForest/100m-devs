import { settlementSites } from './planetTerrain.ts'
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
/** Stable region IDs index the same land addresses at every headcount. */
const sites=settlementSites(WORLD_REGIONS)
export function globeCell(index:number):[number,number,number] { return [...sites[index]] }

/** Stable, readable addresses shared by globe markers and city headers. */
export function cityName(region: number): string { return region===0 ? 'Founders Landing' : 'City '+String(region+1).padStart(4,'0') }
