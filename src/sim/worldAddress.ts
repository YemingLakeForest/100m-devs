import { settlementLayout, planetHubs } from './planetTerrain.ts'
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
const layouts=new Map<number,ReturnType<typeof settlementLayout>>()
function layout(world:number) {
  let sites=layouts.get(world)
  if(!sites){sites=settlementLayout(WORLD_REGIONS,world);layouts.set(world,sites)}
  return sites
}
export function globeHub(index:number,world=0){return layout(world)[index].hub}
export function globeCell(index:number,world=0):[number,number,number] { return [...layout(world)[index].point] }

/** Stable addresses include the colony's own settlement names. */
export function cityName(region:number,world=0):string {return planetHubs(world)[globeHub(region,world)][0]+' / '+String(region+1).padStart(4,'0')}
