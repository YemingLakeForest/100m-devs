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
 * How fast the field flies to a world the player has named, per second.
 *
 * A little faster than the lens's own {@link EASE_RATE} of 3.4, so the travel
 * lands *before* the camera finishes descending into the planet — otherwise the
 * globe fades up at the origin while the star it belongs to is still on its way
 * there, which is one object in two places.
 */
const TRAVEL_RATE = 5.5

/** Below this, in galaxy units, the travel is over and the focus is exact. */
const TRAVEL_SETTLED = 0.5

/**
 * The core of a star, as a fraction of {@link nodeRadius}.
 *
 * **The node is a star, not the planet**, and that is the correction rather
 * than a restyle. Drawn as a lit sphere the size of the globe it hands over to,
 * sixteen worlds read as a bowl of tennis balls: the discs are enormous against
 * their own spacing, the fixed screen-space crescent skews them all the same
 * way, and §10.6's CRT pass lays scanlines across every one. §7.4 asked for
 * *dev stars* and it was right — at four light-years apart, what you see of a
 * world is its sun.
 *
 * The *footprint* is unchanged, and that is what keeps §10.5's hand-off: the
 * glow still reaches {@link nodeRadius}, so the thing that fades out as the
 * network arrives is the same size as the thing that fades in. A planet and a
 * star are different objects trading places at one size, which §10.5 allows —
 * the same licence `blockChromeAlpha` takes for the park's ground.
 */
const STAR_CORE = 0.2

/** How far the glow reaches, as a fraction of {@link nodeRadius}. */
const STAR_GLOW = 0.95

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
  /** Advance the travel between worlds — see {@link GalaxyHandle.setFocus}. */
  update(dt: number): void
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
  /**
   * **Where the camera actually is, in light-years — and it is not the focus.**
   *
   * Naming a world used to move the address and the picture in the same frame:
   * the whole field jumped so the new star was in the middle, which is a cut,
   * and at this rung a cut across four light-years is the largest one in the
   * game. Reported as *"it should focus there smoothly like a travel"*.
   *
   * So the focus is the *destination* and this is the position, eased toward
   * `starAt(focus)` at {@link TRAVEL_RATE}. Everything projects relative to
   * this, so at rest the focused world still lands exactly on the origin —
   * which is the property §10.5's hand-off with the globe depends on — and in
   * between, the network slides past like something being crossed.
   */
  let eyeAt = { x: 0, y: 0, z: 0 }
  /** True while {@link eyeAt} has not caught up. Drives the per-frame redraw. */
  let travelling = false

  const radius = galaxyRadius()
  const unit = nodeRadius()
  const perLy = galaxyPerLy()
  const eye = radius * CAMERA_REACH

  /**
   * A star's position relative to {@link eyeAt}, rotated and projected.
   *
   * The world under the camera projects to exactly (0, 0) at magnification 1 —
   * which is not a happy accident but the property the whole hand-off rests on.
   * The globe is drawn at the origin of this space by `frames.ts`'s nesting, so
   * the node standing for the world the camera is on has to land there too, at
   * the size {@link nodeRadius} says a world is.
   */
  function project(index: number): Projected {
    const there = starAt(index)
    const dx = (there.x - eyeAt.x) * perLy
    const dy = (there.y - eyeAt.y) * perLy
    const dz = (there.z - eyeAt.z) * perLy

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
    return (0.35 + 0.65 * Math.max(0, Math.min(1, t))) * edgeFade(p)
  }

  /**
   * How lit a star is by how near the edge of the frame it has got.
   *
   * Two jobs, and the second is why it is not optional. A field that stops at a
   * hard circle reads as a disc of stars rather than as a place that carries
   * on — the haze already runs off every edge and the worlds have to as well.
   *
   * And it is what makes the neighbourhood's own boundary invisible. Sixteen
   * worlds are drawn and a travel changes which sixteen; the ones that drop out
   * are always at the far edge, so by the time the list is trimmed they are
   * already at zero. Without this they blink out on the frame the travel lands,
   * which is §10.8's F1 — *anything pops in or out* — with a stopwatch on it.
   */
  function edgeFade(p: Projected): number {
    const d = Math.hypot(p.x, p.y) / radius
    const t = (1.45 - d) / 0.45
    const u = Math.max(0, Math.min(1, t))
    return u * u * (3 - 2 * u)
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
   * A star's colour, from its index.
   *
   * Deterministic like everything else at this rung, and weighted the way a
   * real field is: mostly white and blue-white, a few ambers, the occasional
   * red. It is the one place the network is allowed to be more than one colour,
   * and it is what stops sixteen identical dots reading as a diagram.
   */
  const CLASSES: readonly string[] = [
    RAMPS.NEUTRAL[8],
    RAMPS.NEUTRAL[8],
    RAMPS.CALM[3],
    RAMPS.GLOW[2],
    RAMPS.NEUTRAL[7],
    RAMPS.WARN[3],
    RAMPS.CALM[3],
    RAMPS.ALARM[3],
  ]

  function classOf(index: number): string {
    const h = Math.imul(Math.floor(index) ^ 0x2545f491, 0x9e3779b1) >>> 0
    return CLASSES[(h >>> 27) % CLASSES.length]
  }

  /**
   * One world, drawn as the star you would actually see from four light-years.
   *
   * A hard core and three widening rings of falling alpha — a cheap glow, and
   * cheap is the point: sixteen of these are redrawn on every frame of a drag,
   * and §10.6's bloom is doing the expensive half already.
   *
   * What changes as the studio hires is the **glow**, and only the glow. That
   * is §7.7.2's promotion at a rung whose unit is a whole planet: the core is
   * the star, which was there before anybody arrived, and the halo is the
   * hundred million people who now live under it.
   */
  function drawNode(p: Projected, fill: number, settled: boolean): void {
    const r = unit * p.k
    const alpha = depthAlpha(p)
    const tint = settled ? classOf(p.index) : RAMPS.NEUTRAL[5]
    // An unsettled world is a cold star, not a black one: the frontier has to
    // be visible to be aimed at, and §7.7.2's promotion is the arrival — a
    // world that lit up before anybody moved there would spend the beat early.
    const lit = settled ? 0.35 + 0.65 * fill : 0.28

    const halo = r * STAR_GLOW * (settled ? 0.55 + 0.45 * fill : 0.4)
    for (const ring of [1, 0.62, 0.34]) {
      nodes
        .circle(p.x, p.y, halo * ring)
        .fill({ color: c(tint), alpha: alpha * lit * 0.16 })
    }
    nodes
      .circle(p.x, p.y, Math.max(0.8, r * STAR_CORE))
      .fill({ color: c(tint), alpha: Math.min(1, alpha * (0.5 + 0.5 * lit)) })
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
        // A relay to a star that is fading out at the frame edge fades with it,
        // or the line outlives the world at either end of it.
        if (Math.min(edgeFade(a), edgeFade(b)) < 0.35) continue
        links.moveTo(a.x, a.y)
        links.lineTo(b.x, b.y)
        any = true
      }
    }
    if (any) {
      // Two passes: a wide dim one for the glow and a hairline for the line
      // itself. Without the first the relays vanish under §10.6's bloom, which
      // is busy blowing the stars out either side of them.
      links.stroke({ width: Math.max(1.5, unit * 0.14), color: c(RAMPS.CALM[1]), alpha: 0.16 })
      links.stroke({ width: Math.max(0.5, unit * 0.045), color: c(RAMPS.CALM[2]), alpha: 0.4 })
    }

    for (const p of projected) drawNode(p, fillOf(p.index, devs), p.index < worlds)
  }

  function redrawMarks(): void {
    marks.clear()
    const ring = (index: number, colour: string, alpha: number, scale: number) => {
      const p = project(index)
      if (!visible(p)) return
      // Faded with its own star, or the ring outlives the world it is naming as
      // the field slides past — see `edgeFade`.
      marks
        .circle(p.x, p.y, unit * p.k * scale)
        .stroke({
          width: Math.max(0.6, unit * 0.075),
          color: c(colour),
          alpha: alpha * edgeFade(p),
        })
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
    // Keyed on the orientation alone: the haze is a backdrop at infinity, so
    // crossing four light-years does not move it and a travel must not pay for
    // five hundred redrawn points a frame.
    const key = `${yaw.toFixed(2)}|${pitch.toFixed(2)}`
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

  /**
   * Which worlds are on screen.
   *
   * `from` is the world the camera is leaving, and while it is given the list
   * is the **union of both neighbourhoods** — otherwise the sixteen stars
   * around the old sun would vanish on the frame the travel started, which is
   * the cut the travel exists to avoid, moved one step earlier.
   */
  function refreshNeighbourhood(from?: number): void {
    const reach = Math.max(worlds, focus + 1)
    const next = neighbourhood(focus, reach, WORLDS_FRAMED)
    if (from !== undefined) {
      for (const w of neighbourhood(from, Math.max(reach, from + 1), WORLDS_FRAMED)) {
        if (!next.includes(w)) next.push(w)
      }
    }
    // The frontier is drawn even though nobody lives on it yet, so the player
    // can see where the studio goes next — and can aim at it.
    if (!next.includes(worlds) && worlds > 0) next.push(worlds)
    drawn = next
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
      const from = focus
      focus = next
      /*
       * **The tilt is not reset, and that is a decision rather than an
       * omission.** `globe.ts` freezes its orientation on entering a city
       * because `frames.ts` needs a site's park to sit at a known place. Nothing
       * below this rung depends on which way the network is turned —
       * `intoGalaxy` is a pure scale with no index and no angle in it — so
       * snapping the field back to the authored tilt would throw away a view
       * the player set, for nothing.
       */
      refreshNeighbourhood(from)
      // The picture does not jump; `update` walks it there. See `eyeAt`.
      travelling = true
      redraw()
    },
    /**
     * Advance the travel one frame — see {@link eyeAt}.
     *
     * Called from the stage ticker rather than driven by a clock of its own,
     * for the same reason every other animation in the renderer is: there is
     * one ticker, it is the one §23.3 measures, and a second one is a second
     * thing to be paused wrongly.
     */
    update(dt: number) {
      if (!travelling) return
      const to = starAt(focus)
      const k = Math.min(1, Math.max(0, dt) * TRAVEL_RATE)
      eyeAt = {
        x: eyeAt.x + (to.x - eyeAt.x) * k,
        y: eyeAt.y + (to.y - eyeAt.y) * k,
        z: eyeAt.z + (to.z - eyeAt.z) * k,
      }
      const left = Math.hypot(to.x - eyeAt.x, to.y - eyeAt.y, to.z - eyeAt.z) * perLy
      if (left < TRAVEL_SETTLED) {
        // Landed. Snapped exactly, because "the focused world is at the origin"
        // is the hand-off's precondition and not a thing to be nearly true.
        eyeAt = { x: to.x, y: to.y, z: to.z }
        travelling = false
        refreshNeighbourhood()
      }
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
      /*
       * **Free in both axes, and the clamp that was here is gone.**
       *
       * It stopped the pitch at 6° and 88° on the argument that an edge-on disc
       * is a line and flipping past it reads as the control letting go. In the
       * hand it read as the opposite: the field came to rest flat, the drag hit
       * a wall, and a gesture that had been answering suddenly stopped — which
       * is the one thing a direct-manipulation control may never do.
       *
       * The globe one rung down keeps its clamp for a reason that does not
       * apply here: `frames.ts` needs a site's park to sit at a known place, so
       * the planet's orientation is load-bearing. `intoGalaxy` carries no index
       * and no angle, so nothing below this rung cares which way the network is
       * turned. Free is therefore free — the disc may go over the top, and on
       * the way it is a line, which is what a disc seen edge on is.
       */
      yaw = (yaw + dx * 0.3) % 360
      pitch = (pitch + dy * 0.26) % 360
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
