import { beforeEach, describe, expect, it, vi } from 'vitest'

type Op = {
  kind: string
  fill?: number
  stroke?: number
  alpha?: number
  points?: number[]
  radius?: number
}

class FakeGraphics {
  ops: Op[] = []
  private pending: Op[] = []
  private last: Op[] = []
  private path: number[] = []
  position = { set: vi.fn() }
  mask: unknown = null

  clear() {
    this.ops = []
    this.pending = []
    this.last = []
    this.path = []
    return this
  }
  beginPath() {
    this.path = []
    return this
  }
  circle(_x: number, _y: number, radius: number) {
    this.pending.push({ kind: 'circle', radius })
    return this
  }
  poly(points: number[]) {
    this.pending.push({ kind: 'poly', points: [...points] })
    return this
  }
  rect(_x: number, _y: number, _width: number, _height: number) {
    this.pending.push({ kind: 'rect' })
    return this
  }
  moveTo(x: number, y: number) {
    this.path.push(x, y)
    return this
  }
  lineTo(x: number, y: number) {
    this.path.push(x, y)
    return this
  }
  fill(style: number | { color: number; alpha?: number }) {
    const color = typeof style === 'number' ? style : style.color
    const alpha = typeof style === 'number' ? 1 : style.alpha
    this.last = this.pending.map((shape) => ({ ...shape }))
    for (const shape of this.pending) this.ops.push({ ...shape, fill: color, alpha })
    this.pending = []
    return this
  }
  stroke(style: { color: number; alpha?: number }) {
    const shapes = this.pending.length > 0 ? this.pending : this.last
    for (const shape of shapes) this.ops.push({ ...shape, stroke: style.color, alpha: style.alpha })
    if (this.path.length > 0) {
      this.ops.push({ kind: 'line', stroke: style.color, alpha: style.alpha, points: [...this.path] })
    }
    this.pending = []
    this.last = []
    this.path = []
    return this
  }
  cut() {
    for (const shape of this.pending) this.ops.push({ ...shape, kind: 'cut' })
    this.pending = []
    this.last = []
    return this
  }
}

const made: FakeGraphics[] = []

class FakeContainer {
  children: unknown[] = []
  alpha = 1
  visible = true
  position = { set: vi.fn() }
  scale = { set: vi.fn() }
  addChild(...children: unknown[]) {
    this.children.push(...children)
    return children[0]
  }
}

vi.mock('pixi.js', () => ({
  Container: FakeContainer,
  Graphics: class extends FakeGraphics {
    constructor() {
      super()
      made.push(this)
    }
  },
}))

const { buildGlobe } = await import('./globe.ts')
const { globeOrigin } = await import('./frames.ts')
const { MASTER_PALETTE, RAMPS, hexToRgb } = await import('../art/palette.ts')
const { SITES_PER_GLOBE, SKY, TERRAIN, orientationFor, terrainShade, territoryFor } =
  await import('./worldMap.ts')

function num(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

const PALETTE = new Set(MASTER_PALETTE.map(num))
const layer = { surface: 0, seams: 1, buildings: 2, form: 3, marks: 4, mask: 5 }

describe('the jigsaw planet', () => {
  beforeEach(() => {
    made.length = 0
  })

  it('draws nothing while the top rung is invisible', () => {
    const globe = buildGlobe()
    globe.setHeadcount(100e6)
    globe.setFocus(50)
    globe.rotateBy(30, -15)
    expect(globe.planet.visible).toBe(false)
    for (const graphics of made) expect(graphics.ops).toHaveLength(0)

    globe.setChromeAlpha(1)
    expect(made[layer.surface].ops.length).toBeGreaterThan(0)
    expect(made[layer.buildings].ops.length).toBeGreaterThan(0)
  })

  it('uses only the master palette', () => {
    const globe = buildGlobe()
    globe.setHeadcount(60e6)
    globe.setChromeAlpha(1)
    for (const graphics of made) {
      for (const op of graphics.ops) {
        if (op.fill !== undefined) expect(PALETTE).toContain(op.fill)
        if (op.stroke !== undefined) expect(PALETTE).toContain(op.stroke)
      }
    }
  })

  it('draws territory runs and the computed jigsaw seams', () => {
    const globe = buildGlobe()
    globe.setChromeAlpha(1)
    const surfacePolys = made[layer.surface].ops.filter((op) => op.kind === 'poly' && op.fill !== undefined)
    const seamLines = made[layer.seams].ops.filter((op) => op.kind === 'line')
    expect(surfacePolys.length).toBeGreaterThan(30)
    expect(surfacePolys.length).toBeLessThan(400)
    expect(seamLines).toHaveLength(1)
    expect(seamLines[0].stroke).toBe(num(SKY))
    expect((seamLines[0].points?.length ?? 0)).toBeGreaterThan(100)
  })

  it('adds one coherent solid to a settled territory, not a campus of dots', () => {
    const globe = buildGlobe()
    globe.setHeadcount(1e6)
    globe.setChromeAlpha(1)
    const faces = made[layer.buildings].ops.filter((op) => op.kind === 'poly' && op.fill !== undefined)
    const dots = made[layer.buildings].ops.filter((op) => op.kind === 'circle')
    expect(faces.length).toBeGreaterThanOrEqual(1)
    expect(faces.length).toBeLessThanOrEqual(5)
    expect(dots).toHaveLength(0)
  })

  it('raises the oldest city as the frontier moves away from it', () => {
    const globe = buildGlobe()
    globe.setHeadcount(1e6)
    globe.setChromeAlpha(1)
    const young = made[layer.buildings].ops
      .filter((op) => op.kind === 'poly' && op.fill !== undefined)
      .flatMap((op) => op.points ?? [])
    const youngReach = Math.max(...young.map(Math.abs))

    globe.setHeadcount(10e6)
    const grown = made[layer.buildings].ops
      .filter((op) => op.kind === 'poly' && op.fill !== undefined)
      .flatMap((op) => op.points ?? [])
    const grownReach = Math.max(...grown.map(Math.abs))
    expect(grownReach).toBeGreaterThan(youngReach)
  })

  it('keeps form shading fixed to the screen while the territories rotate', () => {
    const globe = buildGlobe()
    globe.setHeadcount(30e6)
    globe.setChromeAlpha(1)
    const beforeForm = structuredClone(made[layer.form].ops)
    const beforeSurface = structuredClone(
      made[layer.surface].ops.find((op) => op.kind === 'poly')?.points,
    )

    globe.rotateBy(40, 12)
    expect(made[layer.form].ops).toEqual(beforeForm)
    expect(made[layer.surface].ops.find((op) => op.kind === 'poly')?.points).not.toEqual(beforeSurface)
    expect(made[layer.form].ops.filter((op) => op.kind === 'cut')).toHaveLength(3)
    expect(made[layer.mask].ops.some((op) => op.kind === 'circle')).toBe(true)
  })

  it('freezes back to the address orientation when a new city is named', () => {
    const globe = buildGlobe()
    globe.setChromeAlpha(1)
    globe.rotateBy(100, 100)
    expect(globe.orientation).not.toEqual(orientationFor(12))
    globe.setFocus(12)
    expect(globe.orientation.yaw).toBeCloseTo(orientationFor(12).yaw, 9)
    expect(globe.orientation.pitch).toBeCloseTo(orientationFor(12).pitch, 9)
  })

  it('clamps vertical spin before the poles can flip', () => {
    const globe = buildGlobe()
    globe.rotateBy(0, 10_000)
    expect(globe.orientation.pitch).toBe(78)
    globe.rotateBy(0, -20_000)
    expect(globe.orientation.pitch).toBe(-78)
  })

  it('hands the detailed park exactly the territory colour it replaces', () => {
    const globe = buildGlobe()
    for (const site of [0, 12, 55, 99]) {
      const ground = globe.groundAt(site)
      const territory = territoryFor(site)
      expect(terrainShade(ground.biome, ground.step, -1)).toBe(
        terrainShade(territory.biome, territory.step, 0),
      )
      expect(Object.values(TERRAIN).flat()).toContain(
        terrainShade(ground.biome, ground.step, -1),
      )
    }
  })

  it('picks through the territory grid and respects the settled frontier', () => {
    const origin = globeOrigin()
    const globe = buildGlobe()
    globe.setHeadcount(100e6)
    globe.setFocus(31)
    expect(globe.siteUnder(origin.x, origin.y)).toBe(31)

    const one = buildGlobe()
    one.setHeadcount(1e6)
    one.setFocus(0)
    expect(one.siteUnder(origin.x, origin.y)).toBe(0)
    expect(one.sites).toBe(1)
  })

  it('outlines the contiguous frontier without recolouring its ground', () => {
    const globe = buildGlobe()
    globe.setHeadcount(20e6)
    globe.setChromeAlpha(1)
    const frontier = made[layer.marks].ops.filter((op) => op.stroke === num(RAMPS.WARN[2]))
    const address = made[layer.marks].ops.filter((op) => op.stroke === num(RAMPS.CALM[2]))
    expect(frontier.length).toBeGreaterThan(0)
    expect(address.length).toBeGreaterThan(0)
  })

  it('caps growth at one hundred cities', () => {
    const globe = buildGlobe()
    globe.setHeadcount(1e12)
    expect(globe.sites).toBe(SITES_PER_GLOBE)
  })

  it('fades the planet without fading the studio nested inside it', () => {
    const globe = buildGlobe()
    globe.setChromeAlpha(0)
    expect(globe.planet.visible).toBe(false)
    expect(globe.container.visible).toBe(true)
    expect(globe.parkHost.visible).toBe(true)
    globe.setChromeAlpha(1)
    expect(globe.planet.visible).toBe(true)
    expect(globe.planet.alpha).toBe(1)
  })
})
