/*
 * Copied from the rebuild (100m-devs-three/src/sim/cityGrid.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **The endless city** — GDD §6 [amended 2026-09-24, Garage to Galaxy decision
 * 4], phase 5.
 *
 * *"I want the infinit vibe so we can't just scrow out to see the work and
 * that's it … we can drag and drag there are still people when we hire them …
 * fog or fade out to represend the vastness of our swarm."* and *"after seeing
 * I am now not big fan of hex"*.
 *
 * Every scale nests as rectangles on one **street grid**: a floor of a
 * hundred seats, a tower of ten floors, a block of four towers, and the city
 * of blocks. Blocks fill outward from HQ in **square rings**; past the
 * frontier stand building sites with cranes; past those, the old suburb waits
 * to be eaten, for ever, in every direction. Nothing here is stored: a block's
 * contents are a pure function of where it is and how many people the studio
 * has, so dragging never runs out and never allocates a world.
 *
 * Units are metres, the same as the garage's, so the HQ block can hold the
 * authored room at true scale. The numbers are the prototype's (v5), which the
 * user played: a 96 × 86 m pitch, 72 × 64 m lots, four 22 × 17 m towers.
 *
 * Pure — no store, no clock, no renderer.
 */

/** Grid pitch: lot plus street, east–west and north–south. */
export const PITCH_X = 96
export const PITCH_Z = 86
/** The buildable lot inside each pitch. */
export const LOT_W = 72
export const LOT_D = 64
/** One tower's footprint, and where the four sit on a lot. */
export const TOWER_W = 22
export const TOWER_D = 17
export const TOWER_SLOTS: readonly (readonly [number, number])[] = [[6, 6], [42, 6], [6, 40], [42, 40]]
export const FLOORS = 10
export const SEATS = 100
/** Storey height. Offices are tall; this reads as a tower at a glance. */
export const FLOOR_H = 5.2
export const TOWER_SEATS = FLOORS * SEATS
export const BLOCK_SEATS = TOWER_SLOTS.length * TOWER_SEATS
/** The garage's twenty never leave it; everybody after them lives in the city. */
export const GARAGE_SEATS = 20

/**
 * The block's place in the fill order: HQ is 0, then square rings outward,
 * each ring walked the same way round. Every integer ≥ 0 names exactly one
 * block, which is what the tests pin.
 */
export function ringIndex(i: number, j: number): number {
  const r = Math.max(Math.abs(i), Math.abs(j))
  if (r === 0) return 0
  const b = (2 * r - 1) * (2 * r - 1)
  if (j === -r && i < r) return b + (i + r)
  if (i === r && j < r) return b + 2 * r + (j + r)
  if (j === r && i > -r) return b + 4 * r + (r - i)
  return b + 6 * r + (r - j)
}

function hash(a: number, b: number): number {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return (x ^ (x >>> 16)) >>> 0
}

/** One block in eleven is a park, so a full city still has somewhere to eat lunch. Never HQ. */
export function isPark(i: number, j: number): boolean {
  return (i !== 0 || j !== 0) && hash(i * 7919 + j, 3) % 11 === 0
}

/**
 * **The river** [added 2026-09-24, at the user's instruction: *"The scenes are
 * ugly make them more interesting"*]. A grid of identical blocks has nothing
 * to find in it; a river that wanders through it is a landmark at every
 * distance, a reason to drag, and a line the city visibly grows across. One
 * block wide, running north–south a dozen blocks east of HQ, meandering on two
 * sines so it never repeats, and continuous: every row's cells cover the span
 * from its own centre to the next row's.
 */
export function riverCentre(j: number): number {
  return Math.round(12 + 6 * Math.sin(j / 11) + 3 * Math.sin(j / 5.3 + 1.7))
}
export function isRiver(i: number, j: number): boolean {
  const a = riverCentre(j), b = riverCentre(j + 1)
  return i >= Math.min(a, b) && i <= Math.max(a, b)
}

/** Blocks nobody works on: parks and the river. HQ is its own case. */
export function isOpen(i: number, j: number): boolean {
  return isRiver(i, j) || isPark(i, j)
}

/** People who work in the city: everybody past the garage's twenty. */
export function cityPeople(heads: number): number {
  return Math.max(0, Math.floor(Number.isFinite(heads) ? heads : 0) - GARAGE_SEATS)
}

/**
 * Housing blocks (not HQ, not parks) among ring indices 1 … n−1, grown on
 * demand. Parks are a pure function of position, so this is a fact about the
 * grid and never changes; caching it is what makes a block's population O(1)
 * when the renderer asks for two hundred of them a frame.
 */
let housing = new Uint32Array(1024)
let housingKnown = 1 // housing[n] is valid for n < housingKnown; housing[1] = 0
function housedBefore(n: number): number {
  const want = Math.max(1, Math.floor(n))
  if (want >= housing.length) {
    let size = housing.length
    while (size <= want) size *= 2
    const grown = new Uint32Array(size)
    grown.set(housing)
    housing = grown
  }
  while (housingKnown <= want) {
    const k = housingKnown
    if (k <= 1) housing[k] = 0
    else { const [a, b] = ringCell(k - 1); housing[k] = housing[k - 1] + (isOpen(a, b) ? 0 : 1) }
    housingKnown++
  }
  return housing[want]
}

/**
 * The first ring index past the last occupied block — where the next hire
 * would land. Binary search on the housing prefix: 100M people is about
 * 25,000 blocks, a radius of about 80, and a search of fifteen steps.
 */
export function frontierIndex(heads: number): number {
  const people = cityPeople(heads)
  if (people <= 0) return 1
  const blocks = Math.ceil(people / BLOCK_SEATS)
  let lo = 1
  let hi = 2
  while (housedBefore(hi) < blocks) hi *= 2
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (housedBefore(mid) >= blocks) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** The inverse of {@link ringIndex}: which block is n-th. */
export function ringCell(n: number): [number, number] {
  if (n <= 0) return [0, 0]
  const r = Math.ceil((Math.sqrt(n + 1) - 1) / 2)
  const b = (2 * r - 1) * (2 * r - 1)
  const k = n - b
  const side = 2 * r
  if (k < side) return [k - r, -r]
  if (k < 2 * side) return [r, k - side - r]
  if (k < 3 * side) return [r - (k - 2 * side), r]
  return [-r, r - (k - 3 * side)]
}

export type BlockKind = 'hq' | 'park' | 'river' | 'built' | 'site' | 'suburb'

/**
 * How many people work on block (i, j): every housing block before the
 * frontier is full, the frontier block holds the remainder, and parks, HQ and
 * everything past it hold nobody (HQ's people are in the authored room, §5).
 * Exact and O(1): a block's share is what is left when every earlier housing
 * block has been filled.
 */
export function blockPeople(i: number, j: number, heads: number): number {
  if ((i === 0 && j === 0) || isOpen(i, j)) return 0
  const before = housedBefore(ringIndex(i, j))
  return Math.max(0, Math.min(BLOCK_SEATS, cityPeople(heads) - before * BLOCK_SEATS))
}

/**
 * Which of the studio's offices block (i, j) is, counting from 1 in the order
 * the studio moved in — §6 [2026-09-26], so an office can be named. Zero for
 * HQ, parks and rivers, which are nobody's desk.
 */
export function officeOrdinal(i: number, j: number): number {
  if ((i === 0 && j === 0) || isOpen(i, j)) return 0
  return housedBefore(ringIndex(i, j)) + 1
}

/** The inverse of {@link officeOrdinal}: where the studio's k-th office stands. */
export function officeCell(k: number): [number, number] {
  const want = Math.max(1, Math.floor(k))
  let lo = 1, hi = 2
  while (housedBefore(hi) < want) hi *= 2
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (housedBefore(mid) >= want) hi = mid
    else lo = mid + 1
  }
  return ringCell(lo - 1)
}

/** How many offices the studio has opened: every block with somebody in it. */
export function officesOpen(heads: number): number {
  return Math.ceil(cityPeople(heads) / BLOCK_SEATS)
}

/** The building sites past the frontier: a band that widens as the city does. */
export function siteBand(frontier: number): number {
  return 8 * Math.max(1, Math.ceil(Math.sqrt(frontier) / 2))
}

export function blockKind(i: number, j: number, heads: number, frontier = frontierIndex(heads)): BlockKind {
  if (i === 0 && j === 0) return 'hq'
  if (isRiver(i, j)) return 'river'
  if (cityPeople(heads) <= 0) return isPark(i, j) ? 'park' : 'suburb'
  const idx = ringIndex(i, j)
  if (idx < frontier) return isPark(i, j) ? 'park' : 'built'
  if (idx < frontier + siteBand(frontier)) return 'site'
  return isPark(i, j) ? 'park' : 'suburb'
}

/** Where seat `s` of a floor sits, in metres from the tower's corner. Ten rows of ten, with an aisle. */
export function seatAt(s: number): [number, number] {
  const i = s % 10
  const j = Math.floor(s / 10) % 10
  return [1.2 + i * 1.5 + (i >= 5 ? 1.2 : 0) + 0.5, 1.4 + j * 1.35 + Math.floor(j / 2) * 0.1]
}

/** A block's corner in world metres, with HQ's lot centred on the origin. */
export function blockOrigin(i: number, j: number): [number, number] {
  return [i * PITCH_X - LOT_W / 2, j * PITCH_Z - LOT_D / 2]
}

/** The block under a world point. */
export function blockUnder(x: number, z: number): [number, number] {
  return [Math.floor((x + LOT_W / 2 + (PITCH_X - LOT_W) / 2) / PITCH_X), Math.floor((z + LOT_D / 2 + (PITCH_Z - LOT_D) / 2) / PITCH_Z)]
}

/** A stable per-block number for the renderer's dice. */
export function blockSeed(i: number, j: number): number {
  return hash(i * 73856093, j * 19349663)
}
