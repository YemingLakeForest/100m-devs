/**
 * Level 7 — the galactic network. GDD §7.4 Level 4, §7.7.1a, §16.
 *
 * `starfield.ts` says where the worlds are; this projects them. One more link
 * on the chain `globe.ts` ends: the planet the address is on is parented into
 * {@link GalaxyHandle.globeHost} at {@link GALAXY_SCALE}, so descending from the
 * network into a world is the same single affine transform every rung below it
 * is, and the node and the planet are the same object at the same size at the
 * moment they trade places.
 *
 * **This is the one rung that is genuinely three-dimensional**, and that is the
 * whole of what the gesture at the top of the ladder buys. Everything below is
 * a 2:1 isometric drawing with a fixed camera — a floor, a tower, a block seen
 * from one angle forever — and the planet is a sphere that turns about one
 * axis because a sphere looks the same from everywhere. A star field does not:
 * a network drawn flat is a diagram, and a network you can *turn* is a place
 * with depth in it. So a drag up here orbits the neighbourhood rather than
 * panning it, exactly as it spins the globe one rung down, and for a stronger
 * reason.
 *
 * What it deliberately is **not** is an economy. §16's endgame is scale and
 * speed; nothing here is bought, sold, routed or shipped. The relay lines are
 * drawn because §4.1's entropy is a picture of everybody talking to everybody
 * and at this rung the picture is literal — see `sim/starbound.ts` for the one
 * term that costs the player anything.
 */

import { Container, Graphics } from 'pixi.js'
import { hexToRgb, RAMPS } from '../art/palette.ts'
import {
  GALAXY_SCALE,
  WORLDS_FRAMED,
  galaxyOrigin,
  galaxyPerLy,
  galaxyRadius,
  nodeRadius,
} from './frames.ts'
import { SKY, TERRAIN, TEMPERATE, POLAR } from './worldMap.ts'
import { neighbourhood, starAt, worldsFor, WORLD_CAP } from '../sim/starfield.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

const D2R = Math.PI / 180

/**
 * How far the eye is from the neighbourhood's centre, in frame radii.
 *
 * `globe.ts` uses 2.22 and gets a planet that bulges. A star field wants the
 * opposite: strong perspective makes the near half of the disc enormous and the
 * far half a smear, and since every node is meant to be comparable in size —
 * they are all the same planet — the depth cue has to come from *dimming and
 * stacking* rather than from size. Three and a bit radii is enough parallax
 * that turning the field reads as turning something solid, and little enough
 * that a world at the back is still a world.
 */
const CAMERA_REACH = 3.4

/**
 * The default tilt of the disc, in degrees away from face on.
 *
 * Not flat on and not edge on. Face on, a field of dots is a diagram; edge on,
 * it is a line. Thirty-four is enough that the near half passes visibly in
 * front of the far half — the frame says *this has a front and a back* before
 * anybody has thought to drag it — and shallow enough that the vertical
 * foreshortening (`cos 34° ≈ 0.83`) does not squash neighbouring worlds into
 * each other. At the 58° this started on it did exactly that: the packing
 * `starfield.ts` guarantees in the plane was thrown away by the projection.
 */
const DEFAULT_PITCH = 34
const DEFAULT_YAW = -24

/**
 * How far the haze reaches past the frame, in frame radii.
 *
 * Two and a half, so the field runs off every edge rather than ending in a
 * visible disc. Nine — where this started — put nearly all of the dust outside
 * the viewport and left the four hundred points that were inside it spread so
 * thinly that the frame read as empty black, which is the one thing the haze
 * exists to prevent.
 */
const HAZE_REACH = 2.5

/** Points of dust in the haze. Drawn once per orientation, never per frame. */
const DUST = 520

/**
 * How far a link may reach, as a multiple of the mean world spacing.
 *
 * §7.4's "deep-space connection lines represent inter-galactic protocols" — and
 * a line from every world to every other world is `n²` of them, which at
 * {@link WORLDS_FRAMED} nodes is a hundred and twenty lines and reads as a
 * solid sheet. Nearest neighbours only, which is what an actual relay network
 * would be and what a §4.1 picture of everybody talking to everybody looks like
 * when it is drawn honestly rather than exhaustively.
 */
const LINK_REACH = 1.45

export interface GalaxyHandle {
  container: Container
  /** The focused world and everything below it remain nested here. */
  globeHost: Container
  /** The network's own layers, excluding the focused world. */
  field: Container
  setHeadcount(devs: number): void
  /** Changing address recentres the neighbourhood and freezes the tilt back. */
  setFocus(world: number): void
  setSelected(world: number): void
  /** A top-rung drag orbits the field, in screen pixels. */
  rotateBy(dx: number, dy: number): void
  setChromeAlpha(alpha: number): void
  /** Exact node picking, in galaxy space. Returns a world index or −1. */
  worldUnder(x: number, y: number): number
  /** The worlds currently drawn, nearest first — what the HUD lists. */
  readonly drawn: readonly number[]
  readonly worlds: number
}

interface Projected {
  index: number
  x: number
  y: number
  /** Camera-space depth, in galaxy units. Positive is toward the eye. */
  z: number
  /** Perspective magnification at that depth. */
  k: number
}

export function buildGalaxy(): GalaxyHandle {
  const root = new Container()
  const field = new Container()
  const haze = new Graphics()
  const links = new Graphics()
  const nodes = new Graphics()
  const marks = new Graphics()
  const globeHost = new Container()

  field.addChild(haze, links, nodes, marks)
  root.addChild(field, globeHost)

  const at = galaxyOrigin()
  for (const layer of [haze, links, nodes, marks]) layer.position.set(at.x, at.y)
  globeHost.scale.set(GALAXY_SCALE)

  // A new run starts in a garage on one planet. Do not build a galaxy nobody
  // can see — `globe.ts` opens on exactly the same line and for the same reason.
  field.visible = false

  let worlds = 1
  let focus = 0
  let selected = -1
  let yaw = DEFAULT_YAW
  let pitch = DEFAULT_PITCH
  let dirty = true
  let hazeKey = ''
  let drawn: number[] = [0]

  const radius = galaxyRadius()
  const unit = nodeRadius()
  const perLy = galaxyPerLy()
  const eye = radius * CAMERA_REACH

  /**
   * A star's position relative to the focus, rotated and projected.
   *
   * The focus itself projects to exactly (0, 0) at magnification 1 — which is
   * not a happy accident but the property the whole hand-off rests on. The
   * globe is drawn at the origin of this space by `frames.ts`'s nesting, so the
   * node standing for the world the camera is on has to land there too, at the
   * size {@link nodeRadius} says a world is.
   */
  function project(index: number): Projected {
    const here = starAt(focus)
    const there = starAt(index)
    const dx = (there.x - here.x) * perLy
    const dy = (there.y - here.y) * perLy
    const dz = (there.z - here.z) * perLy

    const cy = Math.cos(yaw * D2R)
    const sy = Math.sin(yaw * D2R)
    const x1 = dx * cy + dz * sy
    const z1 = -dx * sy + dz * cy

    const cp = Math.cos(pitch * D2R)
    const sp = Math.sin(pitch * D2R)
    const y2 = dy * cp - z1 * sp
    const z2 = dy * sp + z1 * cp

    // Weak perspective about the focus. Clamped rather than allowed to diverge:
    // a world behind the eye is not a drawing problem to be solved, it is a
    // world that should not be on screen, and `visible` below drops it.
    const k = eye / Math.max(eye * 0.25, eye - z2)
    return { index, x: x1 * k, y: -y2 * k, z: z2, k }
  }

  /** How settled a world is, 0…1 — the last one is ragged and grows. */
  function fillOf(index: number, devs: number): number {
    const left = devs - index * WORLD_CAP
    return Math.max(0, Math.min(1, left / WORLD_CAP))
  }

  /** Depth to ink: the far side of the field is further away, so it is dimmer. */
  function depthAlpha(p: Projected): number {
    const t = (p.z + radius) / (2 * radius)
    return 0.35 + 0.65 * Math.max(0, Math.min(1, t))
  }

  function visible(p: Projected): boolean {
    return p.z < eye * 0.7 && Math.hypot(p.x, p.y) < radius * 2.4
  }

  /**
   * The rest of the galaxy, as dust.
   *
   * Not the settled worlds — those are nodes, and there are at most
   * {@link WORLDS_FRAMED} of them on screen. This is everything the studio has
   * *not* reached, which at every headcount is very nearly all of it, and it is
   * the only honest way to say so: a frame with twenty-five suns in it and
   * black between them would claim the network is the galaxy.
   *
   * Deterministic from the focus, so turning the field moves the dust with it
   * and the haze does not shimmer.
   */
  function redrawHaze(): void {
    haze.clear()
    const reach = HAZE_REACH * radius
    for (let i = 0; i < DUST; i++) {
      // A cheap deterministic scatter in a flattened disc. The salts differ
      // from `starfield.ts`'s so the dust does not sit on the worlds.
      const a = ((i * 2654435761) % 65536) / 65536
      const b = ((i * 40503 + 12345) % 65536) / 65536
      const g = ((i * 2246822519) % 65536) / 65536
      const r = reach * Math.sqrt(0.02 + 0.98 * a)
      const theta = b * 2 * Math.PI + Math.log(1 + r / unit) * 0.9
      const lift = (g - 0.5) * r * 0.14

      const cy = Math.cos(yaw * D2R)
      const sy = Math.sin(yaw * D2R)
      const px = r * Math.cos(theta)
      const py = r * Math.sin(theta)
      const x1 = px * cy + lift * sy
      const z1 = -px * sy + lift * cy
      const cp = Math.cos(pitch * D2R)
      const sp = Math.sin(pitch * D2R)
      const y2 = py * cp - z1 * sp
      const z2 = py * sp + z1 * cp

      const k = eye / Math.max(eye * 0.25, eye - z2)
      const x = x1 * k
      const y = -y2 * k
      if (Math.hypot(x, y) > reach) continue
      const near = Math.max(0, Math.min(1, (z2 + reach) / (2 * reach)))
      haze
        .circle(x, y, unit * (0.05 + 0.07 * near))
        .fill({ color: c(g > 0.72 ? RAMPS.GLOW[1] : RAMPS.NEUTRAL[5]), alpha: 0.22 + 0.4 * near })
    }
  }

  /**
   * One world: a disc the size of the planet it stands for, lit from one side.
   *
   * The lit side is fixed on screen rather than derived from the star, for
   * `globe.ts`'s reason about its own form shading: a hundred worlds each with
   * their own terminator is a hundred different opinions about where the light
   * is, and the eye reads that as noise rather than as depth.
   */
  function drawNode(p: Projected, fill: number, settled: boolean): void {
    const r = unit * p.k
    const alpha = depthAlpha(p)
    // An unsettled world is grey rock rather than black: the frontier has to be
    // *visible* to be aimed at, and §7.7.2's promotion is the arrival — colouring
    // it green before anybody lives there would spend the beat early.
    const ground = settled ? TERRAIN[TEMPERATE][1] : TERRAIN[POLAR][1]
    nodes.circle(p.x, p.y, r).fill({ color: c(ground), alpha })
    // The lit crescent — one offset disc, clipped by nothing, because at these
    // sizes an arc and a circle are the same handful of pixels.
    nodes
      .circle(p.x - r * 0.26, p.y - r * 0.26, r * 0.62)
      .fill({ color: c(settled ? TERRAIN[TEMPERATE][3] : RAMPS.NEUTRAL[4]), alpha: alpha * 0.9 })
    if (settled && fill > 0.02) {
      // The city glow. A settled world that is *filling* says so — this is the
      // only thing on the node that changes as the player hires, and it is the
      // §7.7.2 promotion beat for a rung whose unit is a planet.
      // Kept deliberately dim. §10.6's bloom pass is on at this rung and a
      // bright disc inside a bright disc blooms into a ball of light — measured
      // at 30 px a node, ten worlds read as one smear rather than as ten
      // planets. The glow is a *tint* on the day side, not a light source.
      nodes
        .circle(p.x - r * 0.2, p.y - r * 0.2, r * (0.15 + 0.34 * fill))
        .fill({ color: c(RAMPS.CALM[1]), alpha: alpha * (0.1 + 0.2 * fill) })
    }
    nodes
      .circle(p.x, p.y, r)
      .stroke({ width: Math.max(0.4, r * 0.09), color: c(SKY), alpha: alpha * 0.8 })
  }

  function redrawField(devs: number): void {
    nodes.clear()
    links.clear()

    const projected = drawn.map(project).filter(visible)
    // Far first, so a near world stands in front of a distant one — the same
    // painter's order `globe.ts` sorts its cities into.
    projected.sort((a, b) => a.z - b.z)

    // The relays, under the worlds. Nearest-neighbour only; see LINK_REACH.
    // `radius / √WORLDS_FRAMED` is the pitch the frame was sized from, so a
    // reach of about one and a half of those links each world to its immediate
    // neighbours and to nobody else.
    const reach = LINK_REACH * (radius / Math.sqrt(WORLDS_FRAMED))
    links.beginPath()
    let any = false
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const a = projected[i]
        const b = projected[j]
        if (Math.hypot(a.x - b.x, a.y - b.y) > reach) continue
        links.moveTo(a.x, a.y)
        links.lineTo(b.x, b.y)
        any = true
      }
    }
    if (any) {
      links.stroke({ width: Math.max(0.5, unit * 0.06), color: c(RAMPS.CALM[1]), alpha: 0.3 })
    }

    for (const p of projected) drawNode(p, fillOf(p.index, devs), p.index < worlds)
  }

  function redrawMarks(): void {
    marks.clear()
    const ring = (index: number, colour: string, alpha: number, scale: number) => {
      const p = project(index)
      if (!visible(p)) return
      marks
        .circle(p.x, p.y, unit * p.k * scale)
        .stroke({ width: Math.max(0.6, unit * 0.075), color: c(colour), alpha })
    }
    // The frontier — the next world nobody has settled. Named, never filled in:
    // §7.7.2's promotion is the arrival, and colouring the ground ahead of it
    // would spend the beat before it happens.
    if (drawn.includes(worlds)) ring(worlds, RAMPS.WARN[2], 0.9, 1.35)
    if (selected >= 0 && selected !== focus) ring(selected, RAMPS.NEUTRAL[7], 0.85, 1.5)
    ring(focus, RAMPS.CALM[2], 0.9, 1.6)
  }

  let headcount = 0

  function flush(): void {
    if (!dirty) return
    dirty = false
    const key = `${yaw.toFixed(2)}|${pitch.toFixed(2)}|${focus}`
    if (key !== hazeKey) {
      hazeKey = key
      redrawHaze()
    }
    redrawField(headcount)
    redrawMarks()
  }

  function redraw(): void {
    dirty = true
    if (field.visible) flush()
  }

  function refreshNeighbourhood(): void {
    drawn = neighbourhood(focus, Math.max(worlds, focus + 1), WORLDS_FRAMED)
    // The frontier is drawn even though nobody lives on it yet, so the player
    // can see where the studio goes next — and can aim at it.
    if (!drawn.includes(worlds) && worlds > 0) drawn.push(worlds)
  }

  refreshNeighbourhood()

  return {
    container: root,
    field,
    globeHost,
    setHeadcount(devs: number) {
      const next = Number.isFinite(devs) ? Math.max(0, devs) : 0
      const nextWorlds = worldsFor(next)
      // Twentieths of a world, for `globe.ts`'s reason one rung down: the glow
      // is the only thing a hire moves up here and a full rebuild per hire at a
      // hundred million people per world would be a redraw a frame.
      const quantised = Math.round((next / WORLD_CAP) * 20) / 20
      const wasQuantised = Math.round((headcount / WORLD_CAP) * 20) / 20
      if (quantised === wasQuantised && nextWorlds === worlds) {
        headcount = next
        return
      }
      headcount = next
      if (nextWorlds !== worlds) {
        worlds = nextWorlds
        refreshNeighbourhood()
      }
      redraw()
    },
    setFocus(world: number) {
      const next = Math.max(0, Math.floor(Number.isFinite(world) ? world : 0))
      if (next === focus) return
      focus = next
      // The tilt is frozen back to the authored one on arrival, exactly as
      // entering a city freezes the globe to that site's orientation: every
      // frame below this one is drawn in a space that assumes the network is
      // where `frames.ts` says it is.
      yaw = DEFAULT_YAW
      pitch = DEFAULT_PITCH
      refreshNeighbourhood()
      redraw()
    },
    setSelected(world: number) {
      const next = world < 0 ? -1 : Math.max(0, Math.floor(world))
      if (next === selected) return
      selected = next
      if (field.visible) redrawMarks()
      else dirty = true
    },
    rotateBy(dx: number, dy: number) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
      yaw += dx * 0.3
      // Stopped short of the poles at both ends. Past 88 the disc is a line and
      // the next drag reads as the field flipping over, which is a control that
      // has stopped answering the hand.
      pitch = Math.max(6, Math.min(88, pitch + dy * 0.26))
      redraw()
    },
    setChromeAlpha(alpha: number) {
      const value = Math.max(0, Math.min(1, alpha))
      field.alpha = value
      field.visible = value > 0.004
      if (field.visible) flush()
    },
    worldUnder(x: number, y: number) {
      const px = x - at.x
      const py = y - at.y
      let best = -1
      let bestD = Infinity
      for (const index of drawn) {
        const p = project(index)
        if (!visible(p)) continue
        const d = Math.hypot(p.x - px, p.y - py)
        // A generous target: §23.4.2 wants 44 px and a node at the back of the
        // field is a few. The nearest node wins ties, so an overlap resolves to
        // whichever world the thumb is actually closer to.
        if (d < Math.max(unit * p.k * 1.6, unit * 0.9) && d < bestD) {
          bestD = d
          best = index
        }
      }
      return best
    },
    get drawn() {
      return drawn
    },
    get worlds() {
      return worlds
    },
  }
}
