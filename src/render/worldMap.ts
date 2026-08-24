/**
 * Level 6 geometry — one planet cut into one hundred equal-area territories.
 *
 * There are no continents and no separate campus layer. The surface itself is
 * four hundred cells of exactly one area, solved into one hundred wrapped
 * tetrominoes. A settled territory gains one radial building; its ground never
 * changes colour, so growth cannot turn back into a sticker laid over a map.
 *
 * The grid is graded toward the poles. Latitude/longitude cells on an ordinary
 * rectangular grid become splinters there; bands in `z = sin(latitude)` have
 * area linear in `z`, and reducing both the band height and the column count
 * keeps every cell at exactly `pi / 100` steradians.
 */

/** Degrees to radians, once. */
const D2R = Math.PI / 180

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Orientation {
  yaw: number
  pitch: number
}

export const SITES_PER_GLOBE = 100
export const CELLS_PER_TERRITORY = 4
export const CELLS_PER_GLOBE = SITES_PER_GLOBE * CELLS_PER_TERRITORY

/**
 * Perspective strength: planet radius / distance from its centre to the eye.
 *
 * At 0.45 the eye is 2.22 radii away. The silhouette is where `z === 0.45`,
 * rather than the camera equator, so the globe shows honestly less than a
 * hemisphere and radial buildings remain legible away from the limb.
 */
export const GLOBE_PERSPECTIVE = 0.45
export const GLOBE_CAMERA_Z = 1 / GLOBE_PERSPECTIVE

/**
 * How much a tangent at the sub-camera point is enlarged by perspective when
 * the projected silhouette has radius one. `frames.ts` divides the silhouette
 * radius by this so the focused park and its territory still meet exactly.
 */
export const PERSPECTIVE_CENTRE_SCALE =
  Math.sqrt(1 - GLOBE_PERSPECTIVE * GLOBE_PERSPECTIVE) / (1 - GLOBE_PERSPECTIVE)

// ---------------------------------------------------------------------------
// Ground — latitude gives the planet variety without smuggling continents in
// ---------------------------------------------------------------------------

export const TEMPERATE = 0
export const ARID = 1
export const TUNDRA = 2
export const POLAR = 3
export type Biome = 0 | 1 | 2 | 3

/** Latitude alone decides the biome. Longitude deliberately says nothing. */
export function biomeAt(lat: number): Biome {
  const a = Math.abs(lat)
  if (a > 66) return POLAR
  if (a > 52) return TUNDRA
  if (a >= 15 && a <= 33) return ARID
  return TEMPERATE
}

/** Ground ramps, all drawn from the existing 37-colour master palette. */
export const TERRAIN: Record<Biome, readonly string[]> = {
  [TEMPERATE]: ['#241f2e', '#2e4a2c', '#2e4a2c', '#4c7a45', '#968a96'],
  [ARID]: ['#4a2f22', '#6b452c', '#6b452c', '#96683f', '#c19366'],
  [TUNDRA]: ['#241f2e', '#3a3244', '#55495e', '#736579', '#968a96'],
  [POLAR]: ['#3a3244', '#55495e', '#968a96', '#d8d2cf', '#f2eee8'],
}

export const SKY = '#14121a'

/** Where each latitude band sits on its ramp, and how rare pieces vary. */
const BASE_STEP: Record<Biome, number> = {
  [TEMPERATE]: 3,
  [ARID]: 2,
  [TUNDRA]: 3,
  [POLAR]: 2,
}
const STEP_VARY: Record<Biome, number> = {
  [TEMPERATE]: -1,
  [ARID]: 1,
  [TUNDRA]: -1,
  [POLAR]: 1,
}

/** A ramp entry, offset and clamped. */
export function terrainShade(biome: Biome, step: number, delta: number): string {
  const ramp = TERRAIN[biome]
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(step + delta)))]
}

// ---------------------------------------------------------------------------
// The graded equal-area grid
// ---------------------------------------------------------------------------

interface ZoneSpec {
  z0: number
  z1: number
  rows: number
  cols: number
}

export const GLOBE_ZONES: readonly ZoneSpec[] = [
  { z0: -1, z1: -0.9, rows: 2, cols: 10 },
  { z0: -0.9, z1: -0.6, rows: 3, cols: 20 },
  { z0: -0.6, z1: 0.6, rows: 6, cols: 40 },
  { z0: 0.6, z1: 0.9, rows: 3, cols: 20 },
  { z0: 0.9, z1: 1, rows: 2, cols: 10 },
]

export interface GlobeRow {
  readonly z0: number
  readonly z1: number
  readonly lat0: number
  readonly lat1: number
  readonly cols: number
  readonly owners: readonly number[]
}

export interface TerritoryCell {
  readonly row: number
  readonly col: number
}

export interface TerritoryCity {
  /** Four unit vectors on the surface, in winding order. */
  readonly corners: readonly Vec3[]
  /** Per-building height variation; multiplied by the renderer's height. */
  readonly height: number
}

export interface Territory {
  /** Solver identity. Address identity is `WORLD.rank[id]`. */
  readonly id: number
  readonly cells: readonly TerritoryCell[]
  readonly lon: number
  readonly lat: number
  readonly vector: Vec3
  readonly biome: Biome
  readonly step: number
  readonly city: TerritoryCity
}

export interface TerritoryRun {
  readonly row: number
  readonly lonA: number
  readonly lonB: number
  readonly lat0: number
  readonly lat1: number
  readonly owner: number
}

export type TerritorySeam =
  | {
      readonly kind: 'meridian'
      readonly lon: number
      readonly lat0: number
      readonly lat1: number
      readonly a: number
      readonly b: number
    }
  | {
      readonly kind: 'parallel'
      readonly lat: number
      readonly lonA: number
      readonly lonB: number
      readonly a: number
      readonly b: number
    }

export interface WorldModel {
  readonly rows: readonly GlobeRow[]
  readonly territories: readonly Territory[]
  readonly runs: readonly TerritoryRun[]
  readonly seams: readonly TerritorySeam[]
  /** Address index -> solver territory id. */
  readonly order: readonly number[]
  /** Solver territory id -> address index. */
  readonly rank: readonly number[]
  readonly adjacency: readonly (readonly number[])[]
}

interface MutableRow {
  z0: number
  z1: number
  lat0: number
  lat1: number
  cols: number
  owners: number[]
}

interface BuiltRows {
  rows: MutableRow[]
  zones: Array<{ start: number; rows: number; cols: number }>
}

function buildRows(): BuiltRows {
  const rows: MutableRow[] = []
  const zones: BuiltRows['zones'] = []
  for (const zone of GLOBE_ZONES) {
    const start = rows.length
    for (let r = 0; r < zone.rows; r++) {
      const z0 = zone.z0 + ((zone.z1 - zone.z0) * r) / zone.rows
      const z1 = zone.z0 + ((zone.z1 - zone.z0) * (r + 1)) / zone.rows
      rows.push({
        z0,
        z1,
        lat0: Math.asin(Math.max(-1, Math.min(1, z0))) / D2R,
        lat1: Math.asin(Math.max(-1, Math.min(1, z1))) / D2R,
        cols: zone.cols,
        owners: Array(zone.cols).fill(-1),
      })
    }
    zones.push({ start, rows: zone.rows, cols: zone.cols })
  }
  return { rows, zones }
}

function lonEdge(cols: number, col: number): number {
  return -180 + (360 * col) / cols
}

function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash01(a: number, b: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

type Shape = Array<[number, number]>

function normaliseShape(cells: Shape): Shape {
  let minRow = Infinity
  let minCol = Infinity
  for (const [row, col] of cells) {
    minRow = Math.min(minRow, row)
    minCol = Math.min(minCol, col)
  }
  return cells
    .map(([row, col]) => [row - minRow, col - minCol] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function rotateShape(cells: Shape): Shape {
  let maxRow = 0
  for (const [row] of cells) maxRow = Math.max(maxRow, row)
  return normaliseShape(cells.map(([row, col]) => [col, maxRow - row]))
}

/** Every rotational orientation of I, O, T, S, Z, J and L. */
const TETROMINO_ORIENTATIONS: readonly Shape[] = (() => {
  const bases: Shape[] = [
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 2], [1, 0], [1, 1], [1, 2]],
  ]
  const seen = new Set<string>()
  const out: Shape[] = []
  for (const base of bases) {
    let shape = normaliseShape(base)
    for (let turn = 0; turn < 4; turn++) {
      const key = JSON.stringify(shape)
      if (!seen.has(key)) {
        seen.add(key)
        out.push(shape)
      }
      shape = rotateShape(shape)
    }
  }
  return out
})()

/**
 * Tile one short, wide, longitude-wrapped zone.
 *
 * Cell indices are column-major so the search frontier is the height of the
 * zone (at most six), not its width (as much as forty). A flood fill rejects a
 * placement as soon as it leaves a free component whose size is not divisible
 * by four. Together those two rules make the 240-cell belt effectively
 * backtrack-free while retaining a real solver rather than a baked layout.
 */
function tileZone(rows: number, cols: number, seed: number): { owners: Int32Array; pieces: number } {
  const total = rows * cols
  const random = mulberry32(seed)
  const buckets: number[][][] = Array.from({ length: total }, () => [])

  for (const shape of TETROMINO_ORIENTATIONS) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cells: number[] = []
        let valid = true
        for (const [dr, dc] of shape) {
          const rr = row + dr
          if (rr >= rows) {
            valid = false
            break
          }
          cells.push(((col + dc) % cols) * rows + rr)
        }
        if (!valid) continue
        cells.sort((a, b) => a - b)
        if (new Set(cells).size !== CELLS_PER_TERRITORY) continue
        buckets[cells[0]].push(cells)
      }
    }
  }

  for (const bucket of buckets) {
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const item = bucket[i]
      bucket[i] = bucket[j]
      bucket[j] = item
    }
  }

  const owners = new Int32Array(total).fill(-1)
  const stack = new Int32Array(total)
  const marks = new Int32Array(total)
  let epoch = 0
  let budget = 200_000
  let nextPiece = 0

  const feasible = (): boolean => {
    epoch++
    for (let start = 0; start < total; start++) {
      if (owners[start] >= 0 || marks[start] === epoch) continue
      let top = 0
      let size = 0
      stack[top++] = start
      marks[start] = epoch
      while (top > 0) {
        const cell = stack[--top]
        size++
        const col = Math.floor(cell / rows)
        const row = cell % rows
        const neighbours = [
          row > 0 ? cell - 1 : -1,
          row < rows - 1 ? cell + 1 : -1,
          ((col + 1) % cols) * rows + row,
          ((col + cols - 1) % cols) * rows + row,
        ]
        for (const neighbour of neighbours) {
          if (neighbour < 0 || owners[neighbour] >= 0 || marks[neighbour] === epoch) continue
          marks[neighbour] = epoch
          stack[top++] = neighbour
        }
      }
      if (size % CELLS_PER_TERRITORY !== 0) return false
    }
    return true
  }

  const solve = (from: number): boolean => {
    let first = from
    while (first < total && owners[first] >= 0) first++
    if (first >= total) return true
    if (--budget < 0) return false

    for (const placement of buckets[first]) {
      if (placement.some((cell) => owners[cell] >= 0)) continue
      const id = nextPiece++
      for (const cell of placement) owners[cell] = id
      if (feasible() && solve(first + 1)) return true
      for (const cell of placement) owners[cell] = -1
      nextPiece--
    }
    return false
  }

  if (!solve(0)) throw new Error(`Could not tile ${rows}x${cols} globe zone`)
  return { owners, pieces: nextPiece }
}

// ---------------------------------------------------------------------------
// Sphere geometry and the computed world model
// ---------------------------------------------------------------------------

export function onPlanet(lon: number, lat: number): Vec3 {
  const a = lon * D2R
  const b = lat * D2R
  return { x: Math.cos(b) * Math.sin(a), y: Math.sin(b), z: Math.cos(b) * Math.cos(a) }
}

export function toLonLat(v: Vec3): { lon: number; lat: number } {
  return {
    lon: Math.atan2(v.x, v.z) / D2R,
    lat: Math.asin(Math.max(-1, Math.min(1, v.y))) / D2R,
  }
}

export function tangentFrame(lon: number, lat: number): { up: Vec3; east: Vec3; north: Vec3 } {
  const a = lon * D2R
  const b = lat * D2R
  return {
    up: onPlanet(lon, lat),
    east: { x: Math.cos(a), y: 0, z: -Math.sin(a) },
    north: { x: -Math.sin(b) * Math.sin(a), y: Math.cos(b), z: -Math.sin(b) * Math.cos(a) },
  }
}

function offsetOnPlanet(
  frame: { up: Vec3; east: Vec3; north: Vec3 },
  east: number,
  north: number,
): Vec3 {
  const x = frame.up.x + frame.east.x * east + frame.north.x * north
  const y = frame.up.y + frame.east.y * east + frame.north.y * north
  const z = frame.up.z + frame.east.z * east + frame.north.z * north
  const magnitude = Math.hypot(x, y, z) || 1
  return { x: x / magnitude, y: y / magnitude, z: z / magnitude }
}

function buildWorld(): WorldModel {
  const grid = buildRows()
  let pieceCount = 0

  for (let z = 0; z < grid.zones.length; z++) {
    const zone = grid.zones[z]
    const tiling = tileZone(zone.rows, zone.cols, 9001 + z * 131)
    for (let row = 0; row < zone.rows; row++) {
      for (let col = 0; col < zone.cols; col++) {
        grid.rows[zone.start + row].owners[col] =
          pieceCount + tiling.owners[col * zone.rows + row]
      }
    }
    pieceCount += tiling.pieces
  }

  if (pieceCount !== SITES_PER_GLOBE) {
    throw new Error(`Globe tiling produced ${pieceCount} territories, expected ${SITES_PER_GLOBE}`)
  }

  const partial = Array.from({ length: pieceCount }, (_, id) => ({
    id,
    cells: [] as TerritoryCell[],
    x: 0,
    y: 0,
    z: 0,
  }))

  for (let row = 0; row < grid.rows.length; row++) {
    const here = grid.rows[row]
    const z = (here.z0 + here.z1) / 2
    const lat = Math.asin(Math.max(-1, Math.min(1, z))) / D2R
    for (let col = 0; col < here.cols; col++) {
      const territory = partial[here.owners[col]]
      const at = onPlanet((lonEdge(here.cols, col) + lonEdge(here.cols, col + 1)) / 2, lat)
      territory.cells.push({ row, col })
      territory.x += at.x
      territory.y += at.y
      territory.z += at.z
    }
  }

  const territories: Territory[] = partial.map((piece) => {
    const magnitude = Math.hypot(piece.x, piece.y, piece.z) || 1
    const centroid = { x: piece.x / magnitude, y: piece.y / magnitude, z: piece.z / magnitude }
    // A concave tetromino's arithmetic centroid can land across one of its
    // notches, in somebody else's territory. Use the owned cell centre nearest
    // that centroid as the address point: visually central, and guaranteed to
    // make the middle of a focused globe pick the city it is focused on.
    const vector = piece.cells
      .map((cell) => {
        const row = grid.rows[cell.row]
        const lat = Math.asin(Math.max(-1, Math.min(1, (row.z0 + row.z1) / 2))) / D2R
        return onPlanet((lonEdge(row.cols, cell.col) + lonEdge(row.cols, cell.col + 1)) / 2, lat)
      })
      .reduce((best, candidate) => (dotVector(candidate, centroid) > dotVector(best, centroid) ? candidate : best))
    const { lon, lat } = toLonLat(vector)
    const biome = biomeAt(lat)
    const step = BASE_STEP[biome] + (hash01(piece.id, 7) < 0.22 ? STEP_VARY[biome] : 0)

    // One building, large enough to remain one coherent mark at the globe fit.
    const frame = tangentFrame(lon, lat)
    const angle = hash01(piece.id, 19) * 0.6
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const equalAreaRadius = Math.sqrt(4 / SITES_PER_GLOBE) * 0.25
    const width = equalAreaRadius * (0.4 + 0.12 * hash01(piece.id, 23))
    const depth = equalAreaRadius * (0.4 + 0.12 * hash01(piece.id, 29))
    const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) => {
      const east = x * width
      const north = y * depth
      return offsetOnPlanet(frame, east * cos - north * sin, east * sin + north * cos)
    })

    return {
      id: piece.id,
      cells: piece.cells,
      lon,
      lat,
      vector,
      biome,
      step,
      city: { corners, height: 0.72 + 0.56 * hash01(piece.id, 31) },
    }
  })

  const runs: TerritoryRun[] = []
  for (let row = 0; row < grid.rows.length; row++) {
    const here = grid.rows[row]
    let start = 0
    while (start < here.cols) {
      let end = start + 1
      while (end < here.cols && here.owners[end] === here.owners[start]) end++
      runs.push({
        row,
        lonA: lonEdge(here.cols, start),
        lonB: lonEdge(here.cols, end),
        lat0: here.lat0,
        lat1: here.lat1,
        owner: here.owners[start],
      })
      start = end
    }
  }

  const seams: TerritorySeam[] = []
  const adjacency = Array.from({ length: pieceCount }, () => new Set<number>())
  const link = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0) return
    adjacency[a].add(b)
    adjacency[b].add(a)
  }

  for (const row of grid.rows) {
    for (let col = 0; col < row.cols; col++) {
      const a = row.owners[col]
      const b = row.owners[(col + 1) % row.cols]
      if (a === b) continue
      seams.push({
        kind: 'meridian',
        lon: lonEdge(row.cols, col + 1),
        lat0: row.lat0,
        lat1: row.lat1,
        a,
        b,
      })
      link(a, b)
    }
  }

  for (let row = 0; row + 1 < grid.rows.length; row++) {
    const lower = grid.rows[row]
    const upper = grid.rows[row + 1]
    const breaks = [
      ...Array.from({ length: lower.cols + 1 }, (_, col) => lonEdge(lower.cols, col)),
      ...Array.from({ length: upper.cols + 1 }, (_, col) => lonEdge(upper.cols, col)),
    ].sort((a, b) => a - b)
    const unique = breaks.filter((value, index) => index === 0 || Math.abs(value - breaks[index - 1]) > 1e-9)
    for (let i = 0; i + 1 < unique.length; i++) {
      const lonA = unique[i]
      const lonB = unique[i + 1]
      const mid = (lonA + lonB) / 2
      const lowerCol = Math.min(lower.cols - 1, Math.floor(((mid + 180) / 360) * lower.cols))
      const upperCol = Math.min(upper.cols - 1, Math.floor(((mid + 180) / 360) * upper.cols))
      const a = lower.owners[lowerCol]
      const b = upper.owners[upperCol]
      if (a === b) continue
      seams.push({ kind: 'parallel', lat: lower.lat1, lonA, lonB, a, b })
      link(a, b)
    }
  }

  // Start in the temperate northern belt, then grow only through an existing
  // border. The small deterministic wobble keeps the frontier organic without
  // ever breaking contiguity.
  const seedVector = onPlanet(20, 42)
  let seed = 0
  let seedDot = -2
  for (const territory of territories) {
    const dot =
      territory.vector.x * seedVector.x +
      territory.vector.y * seedVector.y +
      territory.vector.z * seedVector.z
    if (dot > seedDot) {
      seedDot = dot
      seed = territory.id
    }
  }

  const order = [seed]
  const included = new Set(order)
  const origin = territories[seed].vector
  while (order.length < territories.length) {
    let candidate = -1
    let candidateScore = Infinity
    for (const settled of order) {
      for (const neighbour of adjacency[settled]) {
        if (included.has(neighbour)) continue
        const territory = territories[neighbour]
        const dot =
          territory.vector.x * origin.x +
          territory.vector.y * origin.y +
          territory.vector.z * origin.z
        const score = Math.acos(Math.max(-1, Math.min(1, dot))) + 0.3 * hash01(neighbour, 17)
        if (score < candidateScore) {
          candidateScore = score
          candidate = neighbour
        }
      }
    }
    if (candidate < 0) {
      candidate = territories.find((territory) => !included.has(territory.id))?.id ?? -1
    }
    if (candidate < 0) break
    included.add(candidate)
    order.push(candidate)
  }

  const rank = Array(pieceCount).fill(Number.MAX_SAFE_INTEGER)
  order.forEach((id, index) => {
    rank[id] = index
  })

  return {
    rows: grid.rows.map((row) => ({ ...row, owners: Object.freeze([...row.owners]) })),
    territories,
    runs,
    seams,
    order,
    rank,
    adjacency: adjacency.map((neighbours) => [...neighbours]),
  }
}

function dotVector(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** The computed planet. It is built once at module load and never mutated. */
export const WORLD: WorldModel = buildWorld()

/** Address-ordered territory centres; site 0 is the first city settled. */
export const SITES: readonly { readonly lon: number; readonly lat: number }[] = WORLD.order.map(
  (id) => ({ lon: WORLD.territories[id].lon, lat: WORLD.territories[id].lat }),
)

/** Where one address-ordered site is. Out-of-range indices clamp. */
export function siteAt(site: number): { lon: number; lat: number } {
  const index = Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
  return SITES[index]
}

/** The complete territory record behind an address-ordered site. */
export function territoryFor(site: number): Territory {
  const index = Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
  return WORLD.territories[WORLD.order[index]]
}

function rowAtZ(z: number): number {
  if (z <= -1) return 0
  if (z >= 1) return WORLD.rows.length - 1
  for (let row = 0; row < WORLD.rows.length; row++) {
    if (z >= WORLD.rows[row].z0 && z < WORLD.rows[row].z1) return row
  }
  return WORLD.rows.length - 1
}

/** Solver territory id at a point on the sphere. */
export function territoryAt(lon: number, lat: number): number {
  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180
  const row = WORLD.rows[rowAtZ(Math.sin(lat * D2R))]
  const col = Math.max(0, Math.min(row.cols - 1, Math.floor(((wrappedLon + 180) / 360) * row.cols)))
  return row.owners[col]
}

// ---------------------------------------------------------------------------
// Orientation, perspective projection and exact territory picking
// ---------------------------------------------------------------------------

/** Bring one site to the sub-camera point while keeping north up. */
export function orientationFor(site: number): Orientation {
  const at = siteAt(site)
  return { yaw: -at.lon, pitch: at.lat }
}

/** Planet frame -> camera frame: yaw about the pole, then pitch. */
export function orient(v: Vec3, orientation: Orientation): Vec3 {
  const cy = Math.cos(orientation.yaw * D2R)
  const sy = Math.sin(orientation.yaw * D2R)
  const x = v.x * cy + v.z * sy
  const z = -v.x * sy + v.z * cy
  const cp = Math.cos(orientation.pitch * D2R)
  const sp = Math.sin(orientation.pitch * D2R)
  return { x, y: v.y * cp - z * sp, z: v.y * sp + z * cp }
}

/** Camera frame -> planet frame, the inverse of {@link orient}. */
export function unorient(v: Vec3, orientation: Orientation): Vec3 {
  const cp = Math.cos(orientation.pitch * D2R)
  const sp = Math.sin(orientation.pitch * D2R)
  const y = v.y * cp + v.z * sp
  const z = -v.y * sp + v.z * cp
  const cy = Math.cos(orientation.yaw * D2R)
  const sy = Math.sin(orientation.yaw * D2R)
  return { x: v.x * cy - z * sy, y, z: v.x * sy + z * cy }
}

/**
 * Project a unit surface vector (or a point radially above it).
 *
 * `radius` is the projected silhouette radius. Ground points behind the
 * silhouette pin to its edge so surface polygons close cleanly rather than
 * folding through the visible side. `z` remains the camera-frame depth; a
 * ground point is visible when it is greater than `GLOBE_PERSPECTIVE`.
 */
export function projectVector(
  vector: Vec3,
  orientation: Orientation,
  radius: number,
  rho = 1,
): { x: number; y: number; z: number } {
  const v = orient(vector, orientation)
  if (v.z <= GLOBE_PERSPECTIVE && rho <= 1.0001) {
    const magnitude = Math.hypot(v.x, v.y) || 1
    return { x: (v.x / magnitude) * radius, y: (-v.y / magnitude) * radius, z: v.z }
  }
  const scale = radius * Math.sqrt(1 - GLOBE_PERSPECTIVE * GLOBE_PERSPECTIVE)
  const denominator = 1 - GLOBE_PERSPECTIVE * rho * v.z
  return {
    x: (scale * rho * v.x) / denominator,
    y: (-scale * rho * v.y) / denominator,
    z: v.z,
  }
}

export function projectLonLat(
  lon: number,
  lat: number,
  orientation: Orientation,
  radius: number,
  rho = 1,
): { x: number; y: number; z: number } {
  return projectVector(onPlanet(lon, lat), orientation, radius, rho)
}

export function projectSite(
  site: number,
  orientation: Orientation,
  radius: number,
): { x: number; y: number; z: number } {
  const at = siteAt(site)
  return projectLonLat(at.lon, at.lat, orientation, radius)
}

/**
 * Exact screen-to-territory picking.
 *
 * A ray is intersected with the unit sphere, unrotated into planet space, and
 * looked up in the same graded cell grid that drew it. The result is therefore
 * the territory under the pointer, not merely the nearest centroid.
 */
export function siteAtGlobe(
  x: number,
  y: number,
  orientation: Orientation,
  radius: number,
  built: number,
  _legacyReach?: number,
): number {
  if (!(radius > 0) || x * x + y * y > radius * radius) return -1
  const projectionScale = radius * Math.sqrt(1 - GLOBE_PERSPECTIVE * GLOBE_PERSPECTIVE)
  const screenX = x / projectionScale
  const screenY = -y / projectionScale
  const q = screenX * screenX + screenY * screenY
  const k = GLOBE_PERSPECTIVE
  const a = 1 + q * k * k
  const b = -2 * q * k
  const c = q - 1
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return -1
  const z = (-b + Math.sqrt(discriminant)) / (2 * a)
  if (z < k - 1e-9) return -1
  const factor = 1 - k * z
  const camera = { x: screenX * factor, y: screenY * factor, z }
  const planet = unorient(camera, orientation)
  const at = toLonLat(planet)
  const owner = territoryAt(at.lon, at.lat)
  const site = WORLD.rank[owner]
  const count = Math.max(0, Math.min(SITES_PER_GLOBE, Math.floor(built)))
  return site < count ? site : -1
}
