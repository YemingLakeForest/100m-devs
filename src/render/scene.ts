/**
 * The four LOD tiers — GDD §7.5.
 *
 * Everything here is drawn in code from the master palette rather than loaded
 * from assets/. That is deliberate and is not a placeholder shortcut: §7.5 states that at Global and Cosmic zoom "developers fuse into a
 * geometric grid with no individual sprites remaining", and ART_DIRECTION §4
 * classes those tiers as T0 — Procedural. They are shaders and geometry, not
 * art. The desk tier's props are T3 commodity and stand in until authored
 * pixels land; the palette is enforced by construction because every colour
 * below comes from src/art/palette.ts.
 */

import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Texture,
  type Renderer,
} from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'

/** Palette colour as the 0xrrggbb number Pixi wants. */
function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** 2:1 isometric — ART_DIRECTION §1, "Projection: 2:1 isometric". */
const TILE_W = 64
const TILE_H = 32

/** GDD §23.3 criterion 4: floor zoom must hold 55 fps with 1,000 sprites. */
export const FLOOR_SPRITE_COUNT = 1000

/**
 * How large each tier is, in world units — GDD §23.4.1.
 *
 * The camera fits the dominant tier to the viewport (see `fitScale` in
 * omniLens.ts), so it has to know how big each tier actually is. These are
 * measured from the geometry built below, not guessed, and the comment on each
 * says where the number comes from so a change to the scene is caught here.
 *
 * The floor's 2:1 ratio is the whole reason the game is landscape (§23.4):
 * a 2:1 object in a portrait window can never fill more than 22% of it.
 */
export const TIER_EXTENTS: Record<1 | 2 | 3 | 4, { w: number; h: number }> = {
  // Desk: floor tile is TILE_W*3 wide; vertical span is the monitor top
  // (y = -66) to the bottom of the chair and floor tile (y ≈ +88).
  1: { w: TILE_W * 3, h: 156 },
  // Floor: a 32x32 iso grid at TILE_W/4 x TILE_H/4 spacing. Exactly 2:1.
  2: {
    w: (Math.ceil(Math.sqrt(FLOOR_SPRITE_COUNT)) - 1) * (TILE_W / 4) * 2,
    h: (Math.ceil(Math.sqrt(FLOOR_SPRITE_COUNT)) - 1) * (TILE_H / 4) * 2,
  },
  // Global: the grid disc, radius 260, squashed 2:1 into the iso projection.
  3: { w: 520, h: 260 },
  // Cosmic: the bounding box of the five planets plus their radii.
  4: { w: 480, h: 300 },
}

function isoQuad(g: Graphics, cx: number, cy: number, w: number, h: number, fill: number) {
  g.moveTo(cx, cy - h / 2)
    .lineTo(cx + w / 2, cy)
    .lineTo(cx, cy + h / 2)
    .lineTo(cx - w / 2, cy)
    .closePath()
    .fill(fill)
}

/**
 * Level 1 — the desk (GDD §7.4).
 *
 * One developer at a messy desk with a glowing CRT monitor and a mug. Light is
 * a single top-left source, which is the one rule that has to hold here by
 * hand: ART_DIRECTION §7 cannot automate it, so it is built into the draw
 * order — left faces take the lighter neutral, right faces the darker.
 */
function buildDesk(): Container {
  const root = new Container()
  const g = new Graphics()

  // Floor tile the desk sits on.
  isoQuad(g, 0, 40, TILE_W * 3, TILE_H * 3, c(RAMPS.NEUTRAL[1]))
  isoQuad(g, 0, 40, TILE_W * 3 - 8, TILE_H * 3 - 4, c(RAMPS.NEUTRAL[2]))

  // Desk surface, then the two visible sides. Left catches the light.
  isoQuad(g, 0, 0, TILE_W * 2, TILE_H * 2, c(RAMPS.WOOD[2]))
  g.moveTo(-TILE_W, 0)
    .lineTo(0, TILE_H)
    .lineTo(0, TILE_H + 18)
    .lineTo(-TILE_W, 18)
    .closePath()
    .fill(c(RAMPS.WOOD[1]))
  g.moveTo(TILE_W, 0)
    .lineTo(0, TILE_H)
    .lineTo(0, TILE_H + 18)
    .lineTo(TILE_W, 18)
    .closePath()
    .fill(c(RAMPS.WOOD[0]))

  // Monitor: bezel, then the screen. The screen is the one emissive thing in
  // the world layer, so it uses the GLOW ramp rather than a phosphor one —
  // phosphor belongs to the interface, and mixing them would blur the two
  // registers ART_DIRECTION §1 exists to keep apart.
  g.rect(-26, -66, 52, 40).fill(c(RAMPS.NEUTRAL[2]))
  g.rect(-22, -62, 44, 32).fill(c(RAMPS.GLOW[0]))
  for (let i = 0; i < 6; i++) {
    // Fake code, scrolling in the real thing (§7.5 L1).
    const w = 8 + ((i * 13) % 26)
    g.rect(-18, -58 + i * 5, w, 2).fill(c(i % 3 === 0 ? RAMPS.GLOW[2] : RAMPS.GLOW[1]))
  }
  g.rect(-6, -26, 12, 6).fill(c(RAMPS.NEUTRAL[2]))
  g.rect(-14, -20, 28, 4).fill(c(RAMPS.NEUTRAL[3]))

  // Mug.
  g.rect(34, -20, 12, 14).fill(c(RAMPS.NEUTRAL[7]))
  g.rect(36, -18, 8, 4).fill(c(RAMPS.WOOD[0]))
  g.rect(46, -17, 4, 8).fill(c(RAMPS.NEUTRAL[6]))

  // Chair back, behind the developer.
  g.rect(-10, 34, 20, 26).fill(c(RAMPS.NEUTRAL[2]))

  root.addChild(g)
  root.addChild(buildDeveloper())
  return root
}

/**
 * The developer — a PLACEHOLDER, drawn from rectangles.
 *
 * This is not the parts-library method from ART_DIRECTION §4.1 and should not
 * be mistaken for it. None of that exists yet: no head, no wardrobe, no recipe
 * format, no compositor, and no authored pixels. The §22.7 budget is 19
 * sprites and the current count is zero.
 *
 * It is here so the poke has something to land on while the feel is measured,
 * and it should be deleted the moment a real bust exists.
 */
function buildDeveloper(): Container {
  const dev = new Container()
  const g = new Graphics()

  // Torso — James's white shirt. The elbow hole is a torso variant, so it does
  // not appear on this stand-in.
  g.rect(-11, 6, 22, 24).fill(c(RAMPS.NEUTRAL[7]))
  // Arms forward, as if at the desk.
  g.rect(-16, 10, 6, 16).fill(c(RAMPS.NEUTRAL[6]))
  g.rect(10, 10, 6, 16).fill(c(RAMPS.NEUTRAL[6]))
  // Hands.
  g.rect(-16, 24, 6, 5).fill(c(RAMPS.SKIN[1]))
  g.rect(10, 24, 6, 5).fill(c(RAMPS.SKIN[1]))
  // Head and hair.
  g.rect(-9, -12, 18, 18).fill(c(RAMPS.SKIN[0]))
  g.rect(-10, -14, 20, 7).fill(c(RAMPS.WOOD[0]))
  // Glasses.
  g.rect(-8, -4, 6, 4).fill(c(RAMPS.NEUTRAL[1]))
  g.rect(2, -4, 6, 4).fill(c(RAMPS.NEUTRAL[1]))
  g.rect(-2, -3, 4, 1).fill(c(RAMPS.NEUTRAL[1]))

  dev.addChild(g)
  dev.position.set(0, 4)
  // Named so the poke hit-test can find it without walking the tree.
  dev.label = 'developer'
  return dev
}

/**
 * How far above its desk particle `i` is at drop progress `t`, in world units.
 *
 * §21 Act IV asks for 1,000 developers dropping "from the sky", which is a
 * different thing from 1,000 developers appearing. Two properties make it read
 * that way, and both are here rather than in the caller so they are testable:
 *
 *  - **Stagger.** Every particle landing on the same frame is a wipe, not a
 *    fall. Each gets its own start delay, so the floor fills in as a shower.
 *    The delay is derived from the index by a hash rather than a random draw,
 *    so the drop looks identical on every run and a failure is reproducible.
 *  - **A hard landing.** Ease-out alone reads as a lift descending. The curve
 *    overshoots slightly past the desk and settles back, which is the impact
 *    the bass-drop THUD is scoring.
 */
export const DROP_HEIGHT = 2600
/** Fraction of the drop window spent releasing particles, not falling. */
const DROP_STAGGER_SPAN = 0.45
/** Fraction of one particle's own window spent airborne; the rest is the settle. */
const FALL_FRACTION = 0.85
/** Depth of the landing dip, as a fraction of the fall height. */
const LANDING_DIP = 0.006

export function dropOffset(index: number, t: number): number {
  if (t >= 1) return 0
  if (t <= 0) return DROP_HEIGHT

  // Deterministic per-index scatter in [0, 1). A plain `index / count` ramp
  // would release the swarm in iso-grid order, which reads as a diagonal wipe
  // sweeping the floor — the one thing the stagger exists to avoid.
  const scatter = ((index * 2654435761) % 4096) / 4096
  const delay = scatter * DROP_STAGGER_SPAN
  const u = (t - delay) / (1 - DROP_STAGGER_SPAN)

  if (u <= 0) return DROP_HEIGHT
  if (u >= 1) return 0

  if (u < FALL_FRACTION) {
    // Free fall: distance covered goes as t², so the swarm is moving fastest
    // at the instant it lands. An ease-out here — which is the reflex, and
    // what the first version of this did — decelerates into the floor and
    // reads as a thousand lifts descending in unison.
    const v = u / FALL_FRACTION
    return DROP_HEIGHT * (1 - v * v)
  }

  // Landing: one damped dip below the desk and back. This is what the
  // bass-drop THUD is scoring, and without it the impact is only audible.
  const b = (u - FALL_FRACTION) / (1 - FALL_FRACTION)
  return -DROP_HEIGHT * LANDING_DIP * Math.sin(b * Math.PI) * (1 - b)
}

/**
 * The Level 2 floor, plus the handles §21 Act IV needs to wreck it.
 *
 * The collapse does not build a swarm of its own — it animates *this* one. That
 * matters for more than tidiness: GDD §23.3 criterion 4 measures 1,000 sprites
 * at floor zoom, and a second thousand spawned for the drop would mean the
 * spectacle runs at double the sprite cost the gate ever measured.
 */
export interface FloorSwarm {
  /** The tier container — the same object as `tiers[2]`. */
  readonly container: Container
  /** Desk positions in floor-local coordinates; the Slack web anchors to these. */
  readonly desks: readonly (readonly [number, number])[]
  /** Parent for the Slack web, above the particles. */
  readonly webLayer: Container
  /**
   * §21 Act IV — "1,000 pixel developers drop from the sky".
   *
   * `t` runs 0 (all airborne) to 1 (all landed) and is clamped, so calling it
   * with 1 forever after the drop is a no-op rather than a per-frame upload.
   */
  setDropProgress(t: number): void
}

/**
 * Level 2 — the open office floor (GDD §7.4).
 *
 * Built as a real ParticleContainer at FLOOR_SPRITE_COUNT, because GDD §23.3
 * criterion 4 measures exactly this: 1,000 sprites at floor zoom, 55 fps
 * 5th percentile. A prettier scene with 40 sprites would pass the eye and fail
 * the gate it exists to answer. GDD §23.2 non-negotiable 2 names ParticleContainer
 * as the committed approach.
 */
function buildFloor(renderer: Renderer): FloorSwarm {
  const root = new Container()

  // One tiny desk-and-body texture, reused by every particle.
  const proto = new Graphics()
  proto.rect(0, 3, 10, 4).fill(c(RAMPS.WOOD[1]))
  proto.rect(3, 0, 4, 4).fill(c(RAMPS.NEUTRAL[6]))
  proto.rect(4, 4, 2, 2).fill(c(RAMPS.GLOW[1]))
  const texture = renderer.generateTexture(proto)
  proto.destroy()

  // Position stays STATIC even though the Act IV drop moves every particle.
  // Static means the buffer uploads only when update() is called, so the drop
  // pays for the ~2 s it is animating and the other 99% of the run — including
  // the criterion-4 measurement — costs exactly what it did before the
  // spectacle existed. Making it dynamic would have moved that cost onto every
  // frame of the game to serve two seconds of it.
  const particles = new ParticleContainer({
    dynamicProperties: { position: false, scale: false, rotation: false, color: true },
  })

  // Laid out on the iso grid rather than a square one, so the floor reads as
  // the same space as the desk seen from further away.
  const cols = Math.ceil(Math.sqrt(FLOOR_SPRITE_COUNT))
  const restY = new Float64Array(FLOOR_SPRITE_COUNT)
  const desks: Array<readonly [number, number]> = []

  for (let i = 0; i < FLOOR_SPRITE_COUNT; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = (col - row) * (TILE_W / 4)
    const y = (col + row) * (TILE_H / 4)
    restY[i] = y
    // Every 12th desk anchors the web. All 1,000 would be an opaque red sheet
    // rather than a web, and 83 endpoints already reads as "everyone".
    if (i % 12 === 0) desks.push([x, y])
    particles.addParticle(
      new Particle({
        texture,
        x,
        y,
        // A little variation so it does not read as wallpaper.
        tint: i % 7 === 0 ? c(RAMPS.NEUTRAL[5]) : c(RAMPS.NEUTRAL[6]),
      }),
    )
  }

  const webLayer = new Container()
  root.addChild(particles)
  root.addChild(webLayer)
  root.pivot.set(0, (cols * TILE_H) / 4)

  let lastT = 1

  return {
    container: root,
    desks,
    webLayer,
    setDropProgress(t: number) {
      const clamped = Math.min(1, Math.max(0, t))
      // Landed and already settled — skip the upload entirely.
      if (clamped === 1 && lastT === 1) return
      lastT = clamped

      const children = particles.particleChildren
      for (let i = 0; i < children.length; i++) {
        children[i].y = restY[i] - dropOffset(i, clamped)
      }
      // Static positions were mutated directly, so the buffer has to be told.
      particles.update()
    },
  }
}

/**
 * Level 3 — the Global Grid (GDD §7.4, §7.5).
 *
 * "Developers fuse into a colourful, geometric Dev Grid. No individual sprites
 * remain." So this is geometry, not a sprite field: neon data pipes between
 * glowing hubs, with high-entropy sectors reading hot.
 */
function buildGlobal(): Container {
  const root = new Container()
  const g = new Graphics()
  const R = 260

  // The grid disc.
  g.circle(0, 0, R).fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.9 })
  g.circle(0, 0, R).stroke({ width: 2, color: c(RAMPS.GLOW[0]) })

  // Latitude rings, squashed to 2:1 so the globe sits in the same projection.
  for (let i = 1; i <= 4; i++) {
    g.ellipse(0, 0, R * (i / 5), R * (i / 5) * 0.5).stroke({
      width: 1,
      color: c(RAMPS.GLOW[0]),
      alpha: 0.5,
    })
  }

  // Sector hubs and the pipes between them.
  const hubs: Array<[number, number]> = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const r = R * (0.3 + ((i * 37) % 60) / 100)
    hubs.push([Math.cos(a) * r, Math.sin(a) * r * 0.5])
  }

  for (let i = 0; i < hubs.length; i++) {
    const [x1, y1] = hubs[i]
    const [x2, y2] = hubs[(i + 5) % hubs.length]
    g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1, color: c(RAMPS.GLOW[1]), alpha: 0.6 })
  }
  for (const [x, y] of hubs) {
    g.circle(x, y, 5).fill(c(RAMPS.GLOW[2]))
    g.circle(x, y, 9).stroke({ width: 1, color: c(RAMPS.GLOW[1]), alpha: 0.7 })
  }

  root.addChild(g)
  return root
}

/**
 * Level 4 — the Galactic Network (GDD §7.4).
 *
 * Planets connected by laser relay paths. The scale here is nominal: at
 * 1:10^9 the world container is scaled down past the point where its own
 * units mean anything, so this tier is authored at screen scale and rides the
 * cross-fade rather than the camera.
 */
function buildCosmic(): Container {
  const root = new Container()
  const g = new Graphics()

  const planets: Array<[number, number, number]> = [
    [-180, -60, 34],
    [120, -110, 22],
    [40, 90, 44],
    [-90, 130, 18],
    [230, 60, 26],
  ]

  // Relay lines first, so they pass behind the planets.
  for (let i = 0; i < planets.length; i++) {
    const [x1, y1] = planets[i]
    const [x2, y2] = planets[(i + 1) % planets.length]
    g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1, color: c(RAMPS.CALM[1]), alpha: 0.7 })
  }

  for (const [x, y, r] of planets) {
    g.circle(x, y, r).fill(c(RAMPS.NEUTRAL[1]))
    // The lit limb — same top-left source as everything else.
    g.circle(x - r * 0.25, y - r * 0.25, r * 0.7).fill({ color: c(RAMPS.GLOW[0]), alpha: 0.55 })
    g.circle(x, y, r).stroke({ width: 1, color: c(RAMPS.GLOW[1]) })
    // Surface swarm glow — the hive visible from orbit.
    for (let i = 0; i < 5; i++) {
      const a = i * 1.9
      g.circle(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, 1.5).fill(c(RAMPS.GLOW[2]))
    }
  }

  root.addChild(g)
  return root
}

export interface LodTiers {
  1: Container
  2: Container
  3: Container
  4: Container
}

export interface Scene {
  tiers: LodTiers
  /** The Level 2 swarm, exposed so §21 Act IV can drop it out of the sky. */
  floor: FloorSwarm
}

/** Build all four tiers. The caller parents them and drives their alpha. */
export function buildScene(renderer: Renderer): Scene {
  const floor = buildFloor(renderer)
  return {
    tiers: {
      1: buildDesk(),
      2: floor.container,
      3: buildGlobal(),
      4: buildCosmic(),
    },
    floor,
  }
}

export { Texture }
