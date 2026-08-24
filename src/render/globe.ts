/**
 * Level 6 — the planet, and the hundred campuses on it.
 *
 * `docs/PLAN-2026-08-23-globe.md`. `frames.ts` sizes the sphere so that a
 * hundred parks exactly tile it; `worldMap.ts` says where the land and the
 * campuses are; this draws the result and hands `park.ts` a place to stand.
 *
 * ## Graphics, and not a shader
 *
 * A sphere is the first thing on this ladder that a fragment shader would draw
 * more naturally than a polygon list, and it is still drawn with polygons. Three
 * reasons, in the order they mattered:
 *
 *  - **The palette is a gate.** ART_DIRECTION §2.2 makes the master palette the
 *    single source of truth and `npm run art:check` enforces it. A shader that
 *    interpolates is a shader that invents colours between the entries, and the
 *    only way to stop it is to quantise in the shader — which is to say, to
 *    reimplement {@link terrainStep} in GLSL and then have two of it. That is
 *    the exact hazard `worldMap.ts` exists to close.
 *  - **It would be the only WebGL-specific thing in the codebase.** `room.ts`,
 *    `block.ts` and `park.ts` are all `Graphics`; a WebGPU renderer or a
 *    software fallback would lose the planet and nothing else.
 *  - **It is not per-frame work.** Nothing here moves except the sun, and the
 *    sun is quantised to {@link SUN_STEPS} positions a day, so the surface is
 *    rebuilt about every three seconds and not sixty times a second.
 *
 * ## The hand-off, which is the point of the file
 *
 * Every settled site is drawn as a **campus glyph** — its zoned ground, its
 * decks, and at night its lights. The site the camera is in *also* has
 * `park.ts`'s real park parented over the top of it, at the same place, on the
 * same lattice, in the same colour, lit by the same sun.
 *
 * So the two are never blended as *different pictures of different sizes*,
 * which is the artefact §10.5 forbids and the whole reason the lens was rebuilt.
 * They are one picture at two levels of detail, and the cross-fade between them
 * is the honest kind: the glyph is what a park looks like from orbit, and the
 * park is what the glyph looks like when you are standing in it.
 */

import { Container, Graphics } from 'pixi.js'
import { hexToRgb, RAMPS } from '../art/palette.ts'
import {
  BLOCKS_PER_PARK,
  GLOBE_SCALE,
  PARK_SCALE,
  PLOT_STRIDE_X,
  deckBox,
  globeOrigin,
  globeRadius,
  shoreBox,
  type LatticeBox,
} from './frames.ts'
import {
  OFFSHORE,
  SITES_PER_GLOBE,
  TERRAIN,
  TERRAIN_RIM,
  biomeAt,
  latticeOnGlobe,
  lightOn,
  onPlanet,
  orient,
  orientationFor,
  projectSite,
  siteAt,
  siteAtGlobe,
  sunAt,
  type Biome,
  tangentFrame,
  terrainShade,
  terrainStep,
  type Vec3,
} from './worldMap.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * How finely the surface is diced, in cells of longitude and latitude.
 *
 * Eighty by forty puts an equatorial cell at about sixteen pixels when the
 * planet fits the frame, which is the pixel-art grain every level below draws
 * at. Finer is not more detail, it is the same map with smaller stairs.
 */
export const SURFACE_COLS = 80
export const SURFACE_ROWS = 40

/**
 * How many positions the sun takes in a day, and how long a day is.
 *
 * The sun is the only thing on this level that moves, and quantising it is what
 * turns a per-frame redraw into one every three seconds. Ninety-six is a
 * quarter-hour: fine enough that the terminator creeps rather than jumps, coarse
 * enough that {@link terrainStep} — which has four steps — almost never changes
 * twice in one tick.
 */
export const SUN_STEPS = 96
export const DAY_MS = 240_000

/** One plot stride, in globe units — the park's own lattice, one rung out. */
const SX = PLOT_STRIDE_X * PARK_SCALE * GLOBE_SCALE
const SY = SX / 2

/** How far past the built decks a site's zoned ground reaches, in strides. */
const ZONED_MARGIN = 1.4

/*
 * **Everything below is a fraction of the radius, and that is not a style.**
 *
 * This file draws in *globe units*, where the planet is nearly ten thousand
 * across and one unit is a twelfth of a pixel once the lens has fitted it. The
 * first version sized the campus lights and the address bracket in what were
 * plainly meant to be pixels — 11, 4, 20 — and every one of them came out under
 * a pixel wide and simply did not appear. The geometry was right, the colours
 * were right, the tests were green, and the planet had no lights on it.
 *
 * So a size in here is a fraction of `R` or it is a bug. `worldMap.ts` gets to
 * be unitless; this file does not.
 */
/** The lit halo, body and core of one campus at night. */
const LIGHT_HALO = 0.030
const LIGHT_BODY = 0.016
const LIGHT_CORE = 0.008
/** The address bracket, and the wider one on a site merely named. */
const BRACKET = 0.048
const BRACKET_NAMED = 0.062
/** A cable, and the rim on a campus in daylight. */
const HAIRLINE = 0.0026

export interface GlobeHandle {
  container: Container
  /**
   * Where `park.ts` is parented.
   *
   * At the origin and scaled by {@link GLOBE_SCALE}, because `intoGlobe` is a
   * pure scale about the origin and the planet is turned so that the site the
   * address is in is the one facing the camera. The park never moves between
   * sites; the planet moves under it.
   */
  parkHost: Container
  /** Rebuild for a headcount. Cheap on change, far too dear per frame. */
  setHeadcount(devs: number): void
  /** Which site the address is in — the one the planet turns to face. */
  setFocus(site: number): void
  /** Which site has been named but not entered, or −1. */
  setSelected(site: number): void
  /** Advance the day. Milliseconds since the studio started. */
  setClock(ms: number): void
  /** Fade the planet out as the camera descends into one of its sites. */
  setChromeAlpha(alpha: number): void
  /**
   * What the ground at one site is, and how lit it is right now.
   *
   * **The single source of the hand-off.** `park.ts` shades its board with
   * exactly this pair, and this file shades the same site's mark with it, so the
   * two cannot disagree about what colour that place is at that hour. The sun
   * lives here because the planet does; a park that worked out its own daylight
   * would be a second sun, and the first thing two suns do is disagree.
   */
  groundAt(site: number): { biome: Biome; step: number }
  /** The planet's own layers, without the park standing on them. */
  planet: Container
  /** Screen-space picking, in globe units relative to the planet's centre. */
  siteUnder(x: number, y: number): number
  readonly sites: number
}

export function buildGlobe(): GlobeHandle {
  const root = new Container()
  /** The sea, the land and the ice — one polygon per run of like cells. */
  const surface = new Graphics()
  /** The cables between campuses, which lie on the surface. */
  const cables = new Graphics()
  /** The campuses: zoned ground, decks, and at night their lights. */
  const campuses = new Graphics()
  /** The bracket that says which site the address is in. */
  const marks = new Graphics()
  /*
   * **The planet's own layers, in a container of their own, and the park is not
   * one of them.**
   *
   * The first version parented all five straight onto `root` and faded `root`
   * for {@link GlobeHandle.setChromeAlpha} — which hid the planet correctly and
   * took the entire studio with it, because the park is *inside* the globe and
   * a parent's `visible` is not negotiable. At rung 1 the alpha is zero, so a
   * new game opened on a black screen with a HUD over it.
   *
   * Caught by `test:ui-frame`'s degenerate-pinch case, which asserts the game
   * layer is not blank — a check written for an entirely different bug three
   * handoffs ago, and the third time that gate has paid for itself.
   */
  const planet = new Container()
  planet.addChild(surface, cables, campuses, marks)
  const parkHost = new Container()
  root.addChild(planet, parkHost)

  const at = globeOrigin()
  const R = globeRadius()
  surface.position.set(at.x, at.y)
  cables.position.set(at.x, at.y)
  campuses.position.set(at.x, at.y)
  marks.position.set(at.x, at.y)
  parkHost.scale.set(GLOBE_SCALE)
  // **Hidden until asked for.** A studio starts in a garage at rung 1, where the
  // planet's alpha is zero — starting it visible would spend one full rebuild at
  // boot, which is the single worst moment in the run to spend fourteen hundred
  // polygons on something nobody will see for an hour.
  planet.visible = false

  let built = 1
  let focus = 0
  let selected = -1
  let orientation = orientationFor(0)
  let sunTick = -1
  let sun: Vec3 = sunAt(0, orientation)
  /** What the last rebuild was for, so an unchanged frame costs nothing. */
  let drawnFor = ''

  // -------------------------------------------------------------------------
  // The surface
  // -------------------------------------------------------------------------

  /** A point of the map, in the camera's frame and on the screen. */
  function project(lon: number, lat: number): { x: number; y: number; z: number } {
    const v = orient(onPlanet(lon, lat), orientation)
    return { x: v.x * R, y: -v.y * R, z: v.z }
  }

  function redrawSurface() {
    surface.clear()

    /*
     * The base disc, under everything.
     *
     * Cells are culled by the z of their own centre, so the last half-cell
     * before the limb is missing and the silhouette would be a ragged edge
     * against the sky. One circle underneath turns that into a clean rim — and
     * it is the deep-night sea, so what shows through on the unlit side reads as
     * the edge of the world rather than as a gap.
     */
    surface.circle(0, 0, R).fill(c(TERRAIN[OFFSHORE][0]))

    for (let row = 0; row < SURFACE_ROWS; row++) {
      const lat0 = 90 - (row * 180) / SURFACE_ROWS
      const lat1 = 90 - ((row + 1) * 180) / SURFACE_ROWS
      const latC = (lat0 + lat1) / 2

      let runStart = -1
      let runFill = ''

      /** Emit the run `[runStart, end)` as one polygon that follows the sphere. */
      const flush = (end: number) => {
        if (runStart < 0 || end <= runStart) return
        const lonAt = (i: number) => -180 + (i * 360) / SURFACE_COLS
        /*
         * A run is drawn as a band that **follows the curve**, not as a quad
         * between its ends. Ten cells of longitude is a quarter of the way round
         * the planet: a straight edge across that cuts the corner off the
         * silhouette and the sea grows a chord. So the top edge is walked cell
         * by cell and the bottom edge walked back, which costs two points per
         * cell and is the difference between a sphere and a polyhedron.
         */
        const pts: number[] = []
        for (let i = runStart; i <= end; i++) {
          const p = project(lonAt(i), lat0)
          pts.push(p.x, p.y)
        }
        for (let i = end; i >= runStart; i--) {
          const p = project(lonAt(i), lat1)
          pts.push(p.x, p.y)
        }
        surface.poly(pts).fill(c(runFill))
        runStart = -1
      }

      for (let col = 0; col < SURFACE_COLS; col++) {
        const lonC = -180 + ((col + 0.5) * 360) / SURFACE_COLS
        const here = orient(onPlanet(lonC, latC), orientation)
        if (here.z <= 0.02) {
          flush(col)
          continue
        }
        const fill = TERRAIN[biomeAt(lonC, latC)][terrainStep(lightOn(here, sun))]
        if (fill !== runFill) {
          flush(col)
          runFill = fill
          runStart = col
        }
      }
      flush(SURFACE_COLS)
    }
  }

  // -------------------------------------------------------------------------
  // The campuses
  // -------------------------------------------------------------------------

  /** A lattice box of one site, as a screen polygon on the sphere. */
  function boxOnGlobe(
    box: LatticeBox,
    frame: { up: Vec3; east: Vec3; north: Vec3 },
    uc: number,
    vc: number,
  ): { pts: number[]; z: number; minZ: number } {
    const corners = [
      [box.u0, box.v0],
      [box.u1, box.v0],
      [box.u1, box.v1],
      [box.u0, box.v1],
    ]
    const pts: number[] = []
    let z = 0
    let minZ = 1
    for (const [u, v] of corners) {
      const p = latticeOnGlobe(u - uc, v - vc, frame, SX, SY, orientation, R)
      pts.push(p.x, p.y)
      z += p.z / 4
      minZ = Math.min(minZ, p.z)
    }
    return { pts, z, minZ }
  }

  function redrawCampuses() {
    campuses.clear()
    cables.clear()

    const zoned = shoreBox(BLOCKS_PER_PARK)
    const uc = (zoned.u0 + zoned.u1) / 2
    const vc = (zoned.v0 + zoned.v1) / 2
    const pad: LatticeBox = {
      u0: zoned.u0 - ZONED_MARGIN,
      u1: zoned.u1 + ZONED_MARGIN,
      v0: zoned.v0 - ZONED_MARGIN,
      v1: zoned.v1 + ZONED_MARGIN,
    }

    for (let i = 0; i < built && i < SITES_PER_GLOBE; i++) {
      const where = siteAt(i)
      const here = orient(onPlanet(where.lon, where.lat), orientation)
      if (here.z <= 0.04) continue

      const frame = tangentFrame(where.lon, where.lat)
      const biome = biomeAt(where.lon, where.lat)
      const light = lightOn(here, sun)
      const step = terrainStep(light)
      const night = light < 0.08

      /*
       * **The zoned ground, and it is the planet's colour and not the studio's.**
       *
       * One step down the site's own terrain ramp: ground that has been paved
       * is the same ground, darker. Drawing it in `NEUTRAL` — which is what the
       * first pass did — is what made a campus read as a grey sticker laid on a
       * green world, and it is the defect this whole file is arranged around.
       */
      const ground = boxOnGlobe(pad, frame, uc, vc)
      /*
       * **Culled by its far corner, not by its middle.**
       *
       * A park spans twenty degrees, so a site whose centre is barely on the
       * near side has corners that are already round the back — and a point
       * round the back projects onto the front, so the campus arrives inside out
       * and smeared across the limb. The middle passing the test is not the
       * question; the whole of it being in front is.
       */
      if (ground.minZ <= 0.02) continue
      campuses.poly(ground.pts).fill(c(terrainShade(biome, step, -1)))

      /*
       * The decks. **Concrete is grey wherever it is**, so these stay in
       * `NEUTRAL` — which is the other half of the rule and the half that makes
       * the first half mean something: the ground belongs to the planet, and
       * everything the studio put on it belongs to the studio.
       */
      const deckTop = night ? RAMPS.NEUTRAL[2] : RAMPS.NEUTRAL[4]
      for (let b = 0; b < BLOCKS_PER_PARK; b++) {
        const deck = boxOnGlobe(deckBox(b), frame, uc, vc)
        campuses.poly(deck.pts).fill(c(deckTop))
      }

      /*
       * The lights, and they are the same lights `block.ts` puts in the windows
       * one rung down. A million people are still working; from here that is
       * four pixels of phosphor, and it is the only thing on the night side of
       * the planet that is not the planet.
       */
      if (night) {
        // Depth, and nothing else: a light near the limb is smaller because it
        // is turned away, never because it matters less.
        const k = 0.55 + 0.45 * here.z
        const p = projectSite(i, orientation, R)
        const box = (f: number, colour: string) => {
          const w = R * f * k
          campuses.rect(p.x - w / 2, p.y - w / 2, w, w).fill(c(colour))
        }
        box(LIGHT_HALO, RAMPS.CALM[0])
        box(LIGHT_BODY, RAMPS.CALM[1])
        box(LIGHT_CORE, RAMPS.CALM[2])
        box(LIGHT_CORE * 0.5, RAMPS.CALM[3])
      } else {
        // A campus in daylight is a smudge, deliberately. The studio is legible
        // at night and not by day, which is what makes the terminator worth
        // watching rather than decoration.
        const rim = terrainShade(biome, TERRAIN_RIM, 0)
        campuses.poly(ground.pts).stroke({ width: R * HAIRLINE, color: c(rim), alpha: 0.5 })
      }
    }

    redrawCables()
  }

  /**
   * The protocols, drawn.
   *
   * A cable exists between two settled sites close enough to talk, so the planet
   * visibly gets busier as it fills — which is §4.1's communication overhead
   * being charged for in the one place it can be seen from. Only on the night
   * side: in daylight a cable is a trench somebody dug, and a trench does not
   * glow.
   */
  function redrawCables() {
    const n = Math.min(built, SITES_PER_GLOBE)
    let drawn = 0
    for (let i = 0; i < n && drawn < 90; i++) {
      const a = orient(onPlanet(siteAt(i).lon, siteAt(i).lat), orientation)
      if (a.z <= 0.12 || lightOn(a, sun) >= 0.02) continue
      for (let j = i + 1; j < n && drawn < 90; j++) {
        const b = orient(onPlanet(siteAt(j).lon, siteAt(j).lat), orientation)
        if (b.z <= 0.12 || lightOn(b, sun) >= 0.02) continue
        if (a.x * b.x + a.y * b.y + a.z * b.z < 0.93) continue
        for (let t = 0; t <= 6; t++) {
          const f = t / 6
          const v = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f }
          const m = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1
          const px = (v.x / m) * R
          const py = -(v.y / m) * R
          if (t === 0) cables.moveTo(px, py)
          else cables.lineTo(px, py)
        }
        cables.stroke({ width: R * HAIRLINE, color: c(RAMPS.CALM[1]), alpha: 0.85 })
        drawn++
      }
    }
  }

  /**
   * The bracket on the site the address is in.
   *
   * §7.7.6 — the world names things rather than recolouring them. The campus
   * underneath is unchanged; what is added is a frame around it, so "you are
   * here" never costs the picture a colour it would otherwise have used to say
   * something about the ground.
   */
  function redrawMarks() {
    marks.clear()
    const corner = (site: number, size: number, colour: string) => {
      const p = projectSite(site, orientation, R)
      if (p.z <= 0.04) return
      const arm = size / 3
      const t = R * HAIRLINE * 1.6
      const x = p.x - size / 2
      const y = p.y - size / 2
      const seg = [
        [x, y, arm, t],
        [x, y, t, arm],
        [x + size - arm, y, arm, t],
        [x + size - t, y, t, arm],
        [x, y + size - t, arm, t],
        [x, y + size - arm, t, arm],
        [x + size - arm, y + size - t, arm, t],
        [x + size - t, y + size - arm, t, arm],
      ]
      for (const [sx, sy, sw, sh] of seg) marks.rect(sx, sy, sw, sh).fill(c(colour))
    }
    if (selected >= 0 && selected !== focus) corner(selected, R * BRACKET_NAMED, RAMPS.NEUTRAL[7])
    corner(focus, R * BRACKET, RAMPS.WARN[2])
  }

  // -------------------------------------------------------------------------

  /**
   * Rebuild, but **only if anyone can see it.**
   *
   * Two gates, and the second is the one worth the note.
   *
   * The key is the cheap one: the layers are rebuilt against `built | focus |
   * sunTick`, so a frame in which nothing has moved costs a string compare. The
   * sun is in it as a *tick* rather than a time, which is what makes this a few
   * seconds apart instead of sixty times a second.
   *
   * The visibility gate is the one that matters. `HANDOFF-2026-08-22.md`'s trap
   * 62 is *a `Graphics` costs what is in it every frame*, and this is the same
   * lesson one level along: without this, a new game — one developer, the camera
   * on a desk, the planet at alpha zero — spends fourteen hundred polygons every
   * two and a half seconds redrawing a world nobody can see. So a change while
   * hidden only sets the flag, and {@link GlobeHandle.setChromeAlpha} spends it
   * on the frame the planet actually arrives.
   */
  let dirty = true

  function flush() {
    if (!dirty) return
    dirty = false
    const key = `${built}|${focus}|${sunTick}`
    if (key !== drawnFor) {
      drawnFor = key
      redrawSurface()
      redrawCampuses()
    }
    redrawMarks()
  }

  function redraw() {
    dirty = true
    if (planet.visible) flush()
  }

  return {
    container: root,
    planet,
    parkHost,
    setHeadcount(devs: number) {
      const n = Math.max(1, Math.min(SITES_PER_GLOBE, Math.ceil((devs || 0) / 1e6)))
      if (n === built) return
      built = n
      redraw()
    },
    setFocus(site: number) {
      const s = Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
      if (s === focus) return
      focus = s
      orientation = orientationFor(s)
      // The sun is held in the *camera's* frame, so turning the planet turns the
      // light with it. Recomputing it here rather than waiting for the next tick
      // is what stops a site arriving lit from the wrong side for a third of a
      // second, which reads as the sun jumping.
      sun = sunAt(sunTick / SUN_STEPS, orientation)
      redraw()
    },
    setSelected(site: number) {
      const s = site < 0 ? -1 : Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
      if (s === selected) return
      selected = s
      if (planet.visible) redrawMarks()
      else dirty = true
    },
    setClock(ms: number) {
      const tick = Math.floor(((ms % DAY_MS) / DAY_MS) * SUN_STEPS)
      if (tick === sunTick) return
      sunTick = tick
      sun = sunAt(tick / SUN_STEPS, orientation)
      redraw()
    },
    setChromeAlpha(alpha: number) {
      // **The planet, and never the park inside it.** See the note above
      // `planet`: fading `root` fades the whole studio, because the studio is a
      // child of the world it stands on.
      const a = Math.max(0, Math.min(1, alpha))
      planet.alpha = a
      planet.visible = a > 0.004
      // The frame the planet arrives is the frame it is worth drawing on.
      if (planet.visible) flush()
    },
    groundAt(site: number) {
      const where = siteAt(site)
      const here = orient(onPlanet(where.lon, where.lat), orientation)
      return { biome: biomeAt(where.lon, where.lat), step: terrainStep(lightOn(here, sun)) }
    },
    siteUnder(x: number, y: number) {
      // A generous reach, because a site is 37 px tall at the fit and §23.4.2
      // wants a 44 px target. Bounded by `built`, so tapping ground the studio
      // has not bought is tapping nothing rather than the nearest thing it owns.
      return siteAtGlobe(x - at.x, y - at.y, orientation, R, built, R * 0.11)
    },
    get sites() {
      return built
    },
  }
}
