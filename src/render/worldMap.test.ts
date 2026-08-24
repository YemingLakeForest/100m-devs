import { describe, expect, it } from 'vitest'
import { MASTER_PALETTE } from '../art/palette.ts'
import {
  ARID,
  CELLS_PER_GLOBE,
  CELLS_PER_TERRITORY,
  GLOBE_PERSPECTIVE,
  GLOBE_ZONES,
  POLAR,
  PERSPECTIVE_CENTRE_SCALE,
  SITES,
  SITES_PER_GLOBE,
  SKY,
  TEMPERATE,
  TERRAIN,
  TUNDRA,
  WORLD,
  biomeAt,
  onPlanet,
  orient,
  orientationFor,
  projectSite,
  projectVector,
  siteAt,
  siteAtGlobe,
  tangentFrame,
  territoryAt,
  territoryFor,
} from './worldMap.ts'

describe('the equal-area cut', () => {
  it('is four hundred identical cells grouped four at a time', () => {
    expect(WORLD.rows).toHaveLength(16)
    expect(WORLD.rows.reduce((sum, row) => sum + row.cols, 0)).toBe(CELLS_PER_GLOBE)
    expect(WORLD.territories).toHaveLength(SITES_PER_GLOBE)
    for (const territory of WORLD.territories) {
      expect(territory.cells).toHaveLength(CELLS_PER_TERRITORY)
    }

    const areas = WORLD.rows.map((row) => (2 * Math.PI * (row.z1 - row.z0)) / row.cols)
    for (const area of areas) expect(area).toBeCloseTo(Math.PI / 100, 12)
  })

  it('steps the column count down toward both poles without changing area', () => {
    expect(GLOBE_ZONES.map(({ rows, cols }) => [rows, cols])).toEqual([
      [2, 10],
      [3, 20],
      [6, 40],
      [3, 20],
      [2, 10],
    ])
    expect(WORLD.rows.map((row) => row.cols)).toEqual([
      10, 10, 20, 20, 20, 40, 40, 40, 40, 40, 40, 20, 20, 20, 10, 10,
    ])
  })

  it('solves real wrapped tetrominoes rather than merely labelling four cells', () => {
    const shapes = new Set<string>()
    const normalise = (cells: Array<[number, number]>) => {
      const minRow = Math.min(...cells.map(([row]) => row))
      const minCol = Math.min(...cells.map(([, col]) => col))
      return cells
        .map(([row, col]) => [row - minRow, col - minCol] as [number, number])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    }
    const shapeKey = (cells: Array<[number, number]>) => {
      const turns: string[] = []
      let shape = normalise(cells)
      for (let turn = 0; turn < 4; turn++) {
        turns.push(JSON.stringify(shape))
        const maxRow = Math.max(...shape.map(([row]) => row))
        shape = normalise(shape.map(([row, col]) => [col, maxRow - row]))
      }
      return turns.sort()[0]
    }

    for (const territory of WORLD.territories) {
      const cells = new Set(territory.cells.map((cell) => `${cell.row}:${cell.col}`))
      const reached = new Set<string>()
      const queue = [territory.cells[0]]
      while (queue.length > 0) {
        const cell = queue.shift()!
        const key = `${cell.row}:${cell.col}`
        if (reached.has(key)) continue
        reached.add(key)
        const row = WORLD.rows[cell.row]
        const neighbours = [
          { row: cell.row - 1, col: cell.col },
          { row: cell.row + 1, col: cell.col },
          { row: cell.row, col: (cell.col + 1) % row.cols },
          { row: cell.row, col: (cell.col + row.cols - 1) % row.cols },
        ]
        for (const neighbour of neighbours) {
          if (cells.has(`${neighbour.row}:${neighbour.col}`)) queue.push(neighbour)
        }
      }
      expect(reached.size).toBe(CELLS_PER_TERRITORY)

      const cols = WORLD.rows[territory.cells[0].row].cols
      // Try every possible longitude cut and keep the unwrapping with the
      // shortest span; a tetromino crossing ±180 is still an ordinary shape.
      let unwrapped: Array<[number, number]> = []
      let bestSpan = Infinity
      for (let cut = 0; cut < cols; cut++) {
        const candidate = territory.cells.map(
          (cell) => [cell.row, (cell.col - cut + cols) % cols] as [number, number],
        )
        const values = candidate.map(([, col]) => col)
        const span = Math.max(...values) - Math.min(...values)
        if (span < bestSpan) {
          bestSpan = span
          unwrapped = candidate
        }
      }
      shapes.add(shapeKey(unwrapped))
    }
    expect(shapes.size).toBe(7)
  })
})

describe('the world without continents', () => {
  it('varies only with latitude', () => {
    expect(biomeAt(0)).toBe(TEMPERATE)
    expect(biomeAt(25)).toBe(ARID)
    expect(biomeAt(-25)).toBe(ARID)
    expect(biomeAt(58)).toBe(TUNDRA)
    expect(biomeAt(-80)).toBe(POLAR)
  })

  it('uses only existing colours and never erases ground into the sky', () => {
    for (const ramp of Object.values(TERRAIN)) {
      expect(ramp).toHaveLength(5)
      expect(ramp[0]).not.toBe(SKY)
      for (const colour of ramp) expect(MASTER_PALETTE).toContain(colour)
    }
  })

  it('grows through one contiguous frontier', () => {
    expect(WORLD.order).toHaveLength(SITES_PER_GLOBE)
    const settled = new Set([WORLD.order[0]])
    for (let site = 1; site < WORLD.order.length; site++) {
      const territory = WORLD.order[site]
      expect(WORLD.adjacency[territory].some((neighbour) => settled.has(neighbour))).toBe(true)
      settled.add(territory)
    }
    expect(biomeAt(siteAt(0).lat)).toBe(TEMPERATE)
  })

  it('makes the cell grid authoritative for territory membership', () => {
    for (let site = 0; site < SITES.length; site++) {
      const territory = territoryFor(site)
      expect(WORLD.rank[territoryAt(territory.lon, territory.lat)]).toBe(site)
    }
  })
})

describe('the perspective globe', () => {
  it('brings the address to the middle and keeps north up', () => {
    for (const site of [0, 7, 42, 99]) {
      const orientation = orientationFor(site)
      const point = projectSite(site, orientation, 100)
      expect(point.x).toBeCloseTo(0, 9)
      expect(point.y).toBeCloseTo(0, 9)
      expect(point.z).toBeCloseTo(1, 9)

      const at = siteAt(site)
      const north = orient(tangentFrame(at.lon, at.lat).north, orientation)
      expect(north.x).toBeCloseTo(0, 9)
      expect(north.y).toBeCloseTo(1, 9)
    }
  })

  it('puts the honest silhouette at z = the perspective strength', () => {
    const z = GLOBE_PERSPECTIVE
    const edge = projectVector({ x: Math.sqrt(1 - z * z), y: 0, z }, { yaw: 0, pitch: 0 }, 100)
    expect(edge.x).toBeCloseTo(100, 9)
    expect(edge.y).toBeCloseTo(0, 9)

    const epsilon = 1e-5
    const centre = projectVector(onPlanet(0, 0), { yaw: 0, pitch: 0 }, 100)
    const east = projectVector(onPlanet(epsilon, 0), { yaw: 0, pitch: 0 }, 100)
    const radians = (epsilon * Math.PI) / 180
    expect((east.x - centre.x) / (100 * radians)).toBeCloseTo(PERSPECTIVE_CENTRE_SCALE, 4)
  })

  it('picks the exact drawn territory and never an unbuilt neighbour', () => {
    const radius = 400
    for (const focus of [0, 17, 63, 99]) {
      const orientation = orientationFor(focus)
      const point = projectSite(focus, orientation, radius)
      expect(siteAtGlobe(point.x, point.y, orientation, radius, SITES_PER_GLOBE)).toBe(focus)
      expect(siteAtGlobe(point.x, point.y, orientation, radius, focus)).toBe(-1)
    }
    expect(siteAtGlobe(radius * 2, 0, orientationFor(0), radius, SITES_PER_GLOBE)).toBe(-1)
  })
})
