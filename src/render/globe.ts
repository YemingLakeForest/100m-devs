/**
 * Level 6 — a spinnable planet made from one hundred city territories.
 *
 * `worldMap.ts` computes the equal-area tetromino tiling once. This file only
 * projects it: territory ground, hairline seams, one radial building for each
 * settled city, and hard screen-fixed form shading. There is no continent
 * layer, no sun, no terminator and no campus footprint to become a sticker.
 */

import { Container, Graphics } from 'pixi.js'
import { hexToRgb, RAMPS } from '../art/palette.ts'
import { GLOBE_SCALE, globeOrigin, globeRadius } from './frames.ts'
import {
  GLOBE_CAMERA_Z,
  GLOBE_PERSPECTIVE,
  SITES_PER_GLOBE,
  SKY,
  TERRAIN,
  TUNDRA,
  WORLD,
  orient,
  orientationFor,
  projectLonLat,
  projectVector,
  siteAtGlobe,
  terrainShade,
  territoryFor,
  type Biome,
  type Orientation,
  type Territory,
  type TerritorySeam,
  type Vec3,
} from './worldMap.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** One complete building's radial height, as a fraction of the planet. */
const CITY_HEIGHT = 0.062
/** Seams and solid outlines, both fractions of the projected silhouette. */
const SEAM_WIDTH = 0.0042
const SOLID_LINE = 0.0022
const MARK_WIDTH = 0.0055

const BUILDING_LIGHT = (() => {
  const light = { x: -0.34, y: 0.42, z: 0.84 }
  const magnitude = Math.hypot(light.x, light.y, light.z)
  return { x: light.x / magnitude, y: light.y / magnitude, z: light.z / magnitude }
})()

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function normalise(v: Vec3): Vec3 {
  const magnitude = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / magnitude, y: v.y / magnitude, z: v.z / magnitude }
}

function shadeNormal(normal: Vec3): string {
  const light = dot(normal, BUILDING_LIGHT)
  if (light > 0.55) return RAMPS.NEUTRAL[6]
  if (light > 0.14) return RAMPS.NEUTRAL[5]
  if (light > -0.24) return RAMPS.NEUTRAL[4]
  return RAMPS.NEUTRAL[3]
}

export interface GlobeHandle {
  container: Container
  /** The focused park and everything below it remain nested here. */
  parkHost: Container
  /** The planet's own layers, excluding the focused park. */
  planet: Container
  setHeadcount(devs: number): void
  /** Changing address recentres the globe and freezes that orientation. */
  setFocus(site: number): void
  setSelected(site: number): void
  /** A top-rung drag is a rotation, in screen pixels. */
  rotateBy(dx: number, dy: number): void
  setChromeAlpha(alpha: number): void
  /** The stable ground the detailed park must use during the hand-off. */
  groundAt(site: number): { biome: Biome; step: number }
  /** Exact territory picking, in globe space. */
  siteUnder(x: number, y: number): number
  readonly sites: number
  readonly orientation: Orientation
}

export function buildGlobe(): GlobeHandle {
  const root = new Container()
  const planet = new Container()
  const surface = new Graphics()
  const seams = new Graphics()
  const buildings = new Graphics()
  const form = new Graphics()
  const marks = new Graphics()
  const formMask = new Graphics()
  const parkHost = new Container()

  planet.addChild(surface, seams, buildings, form, marks, formMask)
  root.addChild(planet, parkHost)
  form.mask = formMask

  const at = globeOrigin()
  const radius = globeRadius()
  for (const layer of [surface, seams, buildings, form, marks, formMask]) {
    layer.position.set(at.x, at.y)
  }
  parkHost.scale.set(GLOBE_SCALE)

  // A new run starts in the garage. Do not build a planet nobody can see.
  planet.visible = false

  let progress = 1 / 1e6
  let built = 1
  let focus = 0
  let selected = -1
  let orientation = orientationFor(0)
  let dirty = true
  let geometryKey = ''
  let formDrawn = false

  const project = (lon: number, lat: number, rho = 1) =>
    projectLonLat(lon, lat, orientation, radius, rho)

  /** A seam's projected path, after visibility has been decided. */
  function seamPath(seam: TerritorySeam): { points: number[]; visible: boolean } {
    const points: number[] = []
    let visible = false
    if (seam.kind === 'meridian') {
      for (let i = 0; i <= 3; i++) {
        const point = project(seam.lon, seam.lat0 + ((seam.lat1 - seam.lat0) * i) / 3)
        if (point.z > GLOBE_PERSPECTIVE + 0.015) visible = true
        points.push(point.x, point.y)
      }
    } else {
      const steps = Math.max(1, Math.ceil((seam.lonB - seam.lonA) / 5))
      for (let i = 0; i <= steps; i++) {
        const point = project(seam.lonA + ((seam.lonB - seam.lonA) * i) / steps, seam.lat)
        if (point.z > GLOBE_PERSPECTIVE + 0.015) visible = true
        points.push(point.x, point.y)
      }
    }
    return { points, visible }
  }

  function strokeSeams(
    graphics: Graphics,
    include: (seam: TerritorySeam) => boolean,
    width: number,
    colour: string,
    alpha: number,
  ): void {
    graphics.beginPath()
    let any = false
    for (const seam of WORLD.seams) {
      if (!include(seam)) continue
      const path = seamPath(seam)
      if (!path.visible) continue
      graphics.moveTo(path.points[0], path.points[1])
      for (let i = 2; i < path.points.length; i += 2) {
        graphics.lineTo(path.points[i], path.points[i + 1])
      }
      any = true
    }
    if (any) graphics.stroke({ width, color: c(colour), alpha, join: 'round' })
  }

  function redrawSurface(): void {
    surface.clear()
    seams.clear()

    // The circle closes the half-cell gaps at the silhouette.
    surface.circle(0, 0, radius + 0.5).fill(c(TERRAIN[TUNDRA][0]))

    for (const run of WORLD.runs) {
      const territory = WORLD.territories[run.owner]
      const steps = Math.max(2, Math.ceil((run.lonB - run.lonA) / 5))
      const points: number[] = []
      let visible = false
      for (let i = 0; i <= steps; i++) {
        const point = project(run.lonA + ((run.lonB - run.lonA) * i) / steps, run.lat1)
        if (point.z > GLOBE_PERSPECTIVE) visible = true
        points.push(point.x, point.y)
      }
      for (let i = steps; i >= 0; i--) {
        const point = project(run.lonA + ((run.lonB - run.lonA) * i) / steps, run.lat0)
        if (point.z > GLOBE_PERSPECTIVE) visible = true
        points.push(point.x, point.y)
      }
      if (visible) surface.poly(points).fill(c(terrainShade(territory.biome, territory.step, 0)))
    }

    strokeSeams(seams, () => true, radius * SEAM_WIDTH, SKY, 0.72)
  }

  function drawBuilding(territory: Territory, growth: number): void {
    const height = territory.city.height * CITY_HEIGHT * growth
    const base = territory.city.corners.map((corner) => projectVector(corner, orientation, radius, 1))
    const roof = territory.city.corners.map((corner) =>
      projectVector(corner, orientation, radius, 1 + height),
    )
    const vectors = territory.city.corners.map((corner) => orient(corner, orientation))
    const up = normalise(
      vectors.reduce(
        (sum, vector) => ({ x: sum.x + vector.x, y: sum.y + vector.y, z: sum.z + vector.z }),
        { x: 0, y: 0, z: 0 },
      ),
    )

    let bestFacing = -Infinity
    let windowEdge: [number, number] | null = null

    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4
      const a = vectors[i]
      const b = vectors[next]
      const edge = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
      let normal = normalise({
        x: edge.y * up.z - edge.z * up.y,
        y: edge.z * up.x - edge.x * up.z,
        z: edge.x * up.y - edge.y * up.x,
      })
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
      if (dot(normal, { x: middle.x - up.x, y: middle.y - up.y, z: middle.z - up.z }) < 0) {
        normal = { x: -normal.x, y: -normal.y, z: -normal.z }
      }
      const eye = { x: -middle.x, y: -middle.y, z: GLOBE_CAMERA_Z - middle.z }
      const facing = dot(normal, eye)
      if (facing <= 0) continue

      buildings
        .poly([
          base[i].x,
          base[i].y,
          base[next].x,
          base[next].y,
          roof[next].x,
          roof[next].y,
          roof[i].x,
          roof[i].y,
        ])
        .fill(c(shadeNormal(normal)))
        .stroke({ width: radius * SOLID_LINE, color: c(SKY), join: 'miter' })

      if (facing > bestFacing) {
        bestFacing = facing
        windowEdge = [i, next]
      }
    }

    buildings
      .poly(roof.flatMap((point) => [point.x, point.y]))
      .fill(c(shadeNormal(up)))
      .stroke({ width: radius * SOLID_LINE, color: c(SKY), join: 'miter' })

    if (windowEdge) {
      const [a, b] = windowEdge
      const x = (base[a].x + base[b].x + roof[a].x + roof[b].x) / 4
      const y = (base[a].y + base[b].y + roof[a].y + roof[b].y) / 4
      const span = Math.abs(roof[a].x - base[a].x) + Math.abs(roof[a].y - base[a].y)
      if (span > radius * 0.006) {
        const size = Math.max(radius * 0.0035, span * 0.15)
        buildings.rect(x - size / 2, y - size / 2, size, size).fill(c(RAMPS.CALM[2]))
      }
    }
  }

  function redrawBuildings(): void {
    buildings.clear()
    const queue: Array<{ territory: Territory; depth: number; growth: number }> = []
    for (let site = 0; site < SITES_PER_GLOBE; site++) {
      const rank = site
      if (rank >= progress) break
      const territory = territoryFor(site)
      const depth = orient(territory.vector, orientation).z
      if (depth <= GLOBE_PERSPECTIVE + 0.015) continue
      const growth = Math.max(0.16, Math.min(1, (progress - rank) / 9))
      queue.push({ territory, depth, growth })
    }
    // Far cities first, so a near tower stands in front of a distant one.
    queue.sort((a, b) => a.depth - b.depth)
    for (const city of queue) drawBuilding(city.territory, city.growth)
  }

  /** Three hard annuli fixed to the screen. They never pop as pieces rotate. */
  function redrawForm(): void {
    if (formDrawn) return
    formDrawn = true
    form.clear()
    formMask.clear()
    // A mask's colour is visually irrelevant, but keeping even invisible
    // drawing inside the master palette makes the art gate literal.
    formMask.circle(0, 0, radius).fill(c(SKY))
    const x = -radius * 0.3
    const y = -radius * 0.3
    const ring = (outer: number, inner: number, alpha: number) => {
      form.circle(x, y, radius * outer).fill({ color: c(SKY), alpha })
      form.circle(x, y, radius * inner).cut()
    }
    ring(2.6, 1.14, 0.44)
    ring(1.14, 0.9, 0.27)
    ring(0.9, 0.62, 0.13)
  }

  function outlineTerritory(site: number, colour: string, alpha: number): void {
    if (!(site >= 0) || site >= SITES_PER_GLOBE) return
    const owner = WORLD.order[site]
    strokeSeams(
      marks,
      (seam) => seam.a === owner || seam.b === owner,
      radius * MARK_WIDTH,
      colour,
      alpha,
    )
  }

  function redrawMarks(): void {
    marks.clear()
    // The next unbuilt territory is the frontier; the current address and a
    // merely selected city remain named without recolouring their ground.
    if (built < SITES_PER_GLOBE) outlineTerritory(built, RAMPS.WARN[2], 0.95)
    if (selected >= 0 && selected !== focus) outlineTerritory(selected, RAMPS.NEUTRAL[7], 0.9)
    outlineTerritory(focus, RAMPS.CALM[2], 0.9)
    marks
      .circle(0, 0, radius)
      .stroke({ width: radius * 0.004, color: c(RAMPS.NEUTRAL[5]), alpha: 0.3 })
  }

  function flush(): void {
    if (!dirty) return
    dirty = false
    const key = `${progress.toFixed(3)}|${orientation.yaw.toFixed(3)}|${orientation.pitch.toFixed(3)}`
    if (key !== geometryKey) {
      geometryKey = key
      redrawSurface()
      redrawBuildings()
    }
    redrawForm()
    redrawMarks()
  }

  function redraw(): void {
    dirty = true
    if (planet.visible) flush()
  }

  return {
    container: root,
    planet,
    parkHost,
    setHeadcount(devs: number) {
      const raw = Number.isFinite(devs) ? devs / 1e6 : 0
      // Twenty growth frames per city are plenty at the globe fit and avoid a
      // 100-shape rebuild for every single late-game hire.
      const nextProgress = Math.round(Math.max(0, Math.min(SITES_PER_GLOBE, raw)) * 20) / 20
      const nextBuilt = Math.max(1, Math.min(SITES_PER_GLOBE, Math.ceil(nextProgress)))
      if (nextProgress === progress && nextBuilt === built) return
      progress = nextProgress
      built = nextBuilt
      redraw()
    },
    setFocus(site: number) {
      const next = Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
      if (next === focus) return
      focus = next
      orientation = orientationFor(next)
      redraw()
    },
    setSelected(site: number) {
      const next = site < 0 ? -1 : Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
      if (next === selected) return
      selected = next
      if (planet.visible) redrawMarks()
      else dirty = true
    },
    rotateBy(dx: number, dy: number) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
      orientation = {
        yaw: orientation.yaw + dx * 0.32,
        pitch: Math.max(-78, Math.min(78, orientation.pitch + dy * 0.28)),
      }
      redraw()
    },
    setChromeAlpha(alpha: number) {
      const value = Math.max(0, Math.min(1, alpha))
      planet.alpha = value
      planet.visible = value > 0.004
      if (planet.visible) flush()
    },
    groundAt(site: number) {
      const territory = territoryFor(site)
      // `park.ts` shades its board by -1; handing it one step above the
      // territory makes the detailed ground exactly the colour it replaces.
      return { biome: territory.biome, step: territory.step + 1 }
    },
    siteUnder(x: number, y: number) {
      return siteAtGlobe(x - at.x, y - at.y, orientation, radius, built)
    },
    get sites() {
      return built
    },
    get orientation() {
      return { ...orientation }
    },
  }
}
