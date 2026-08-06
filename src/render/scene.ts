/**
 * The four LOD tiers — GDD §7.5.
 *
 * Everything here is drawn in code from the master palette rather than loaded
 * from assets/. That is deliberate for the spike and is not a placeholder
 * shortcut: §7.5 states that at Global and Cosmic zoom "developers fuse into a
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

/** ADR §7.5 criterion 4: floor zoom must hold 55 fps with 1,000 sprites. */
export const FLOOR_SPRITE_COUNT = 1000

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
 * Level 2 — the open office floor (GDD §7.4).
 *
 * Built as a real ParticleContainer at FLOOR_SPRITE_COUNT, because ADR §7.5
 * criterion 4 measures exactly this: 1,000 sprites at floor zoom, 55 fps
 * 5th percentile. A prettier scene with 40 sprites would pass the eye and fail
 * the gate it exists to answer. ADR §5 mitigation 2 names ParticleContainer
 * as the committed approach.
 */
function buildFloor(renderer: Renderer): Container {
  const root = new Container()

  // One tiny desk-and-body texture, reused by every particle.
  const proto = new Graphics()
  proto.rect(0, 3, 10, 4).fill(c(RAMPS.WOOD[1]))
  proto.rect(3, 0, 4, 4).fill(c(RAMPS.NEUTRAL[6]))
  proto.rect(4, 4, 2, 2).fill(c(RAMPS.GLOW[1]))
  const texture = renderer.generateTexture(proto)
  proto.destroy()

  const particles = new ParticleContainer({
    dynamicProperties: { position: false, scale: false, rotation: false, color: true },
  })

  // Laid out on the iso grid rather than a square one, so the floor reads as
  // the same space as the desk seen from further away.
  const cols = Math.ceil(Math.sqrt(FLOOR_SPRITE_COUNT))
  for (let i = 0; i < FLOOR_SPRITE_COUNT; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    particles.addParticle(
      new Particle({
        texture,
        x: (col - row) * (TILE_W / 4),
        y: (col + row) * (TILE_H / 4),
        // A little variation so it does not read as wallpaper.
        tint: i % 7 === 0 ? c(RAMPS.NEUTRAL[5]) : c(RAMPS.NEUTRAL[6]),
      }),
    )
  }

  root.addChild(particles)
  root.pivot.set(0, (cols * TILE_H) / 4)
  return root
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

/** Build all four tiers. The caller parents them and drives their alpha. */
export function buildScene(renderer: Renderer): LodTiers {
  return {
    1: buildDesk(),
    2: buildFloor(renderer),
    3: buildGlobal(),
    4: buildCosmic(),
  }
}

export { Texture }
