/**
 * ACT IV — The Entropy Collapse. GDD §21 Act IV, and the trap it scores in §6.2.
 *
 * This is the beat the whole of Run 1 is built to deliver. The player has just
 * been told that 1,000 developers will make games 1,000× faster, has believed
 * it, and has pressed the button. §21 Act IV specifies exactly what happens
 * next, in four parts:
 *
 *   1. A heavy bass-drop THUD shakes the screen as the camera violently zooms
 *      out to Level 2.
 *   2. 1,000 pixel developers drop from the sky, crammed shoulder-to-shoulder.
 *   3. Red `@everyone` bubbles flood the screen, hundreds of overlapping speech
 *      bubbles appear, and red Slack Noise web lines connect every desk.
 *   4. The cozy lofi cuts out for pings, chatter and an alarm siren.
 *
 * Part 1 (the camera) lives in stage.ts, because the camera is the renderer's
 * and there was already a dolly there. Parts 2–4 are here.
 *
 * **On the DOM/canvas boundary.** GDD §23.2 non-negotiable 3 puts "everything
 * with structured text, numbers or navigation" in React. The chatter bubbles
 * carry text and are still drawn in Pixi, which is a deliberate reading of that
 * rule rather than an exception to it. They are scenery: nothing reads them for
 * a value, nothing navigates from them, and there are up to twenty on screen
 * churning several times a second. They also have to sit *under* the glass —
 * a DOM bubble would float above the barrel curvature and break the weld that
 * ART_DIRECTION §6 calls non-negotiable. The HUD, the numbers and the buttons
 * are all still React.
 */

import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Sprite,
  Text,
  type Renderer,
  type Texture,
} from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { playSfx } from '../audio/sfx.ts'
import type { FloorSwarm } from './scene.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

// --- the timeline ----------------------------------------------------------
//
// Milliseconds from the moment the player's thumb leaves the button. Ordered
// as §21 Act IV orders them — impact, then bodies, then noise — because the
// joke only lands if the player sees what arrived before they see what it did.

/** Part 2: the fall. Long enough to watch, short enough not to be a cutscene. */
export const DROP_MS = 2200
/** Part 1: the screen shake riding the THUD. */
export const SHAKE_MS = 1400
/** Part 3: the web snaps in once there are bodies for it to connect. */
export const WEB_START_MS = 900
export const WEB_RAMP_MS = 500
/** Part 3: pings and chatter, once the room is full. */
export const SURGE_START_MS = 1300
export const SURGE_RAMP_MS = 1800

/** Peak shake displacement in screen pixels. */
const SHAKE_PEAK_PX = 22

/**
 * Live `@everyone` badges. §21 says "flood the entire screen"; 160 does that at
 * phone size while staying one draw call in the ParticleContainer.
 */
const MAX_PINGS = 160
/** Live chatter bubbles. §21 says "hundreds"; twenty at a time reads as it. */
const MAX_CHATTER = 20

/** §21 Act IV and §6.2, verbatim. The lines are the joke — do not paraphrase. */
export const CHATTER_LINES = [
  'Who broke the build?',
  "What's the password for the Wi-Fi?",
  'Why are we in a meeting?',
  'Is there oat milk?',
  "Wait, who's writing this function?",
] as const

/**
 * Shake displacement at `elapsed` ms — a decaying oscillation, not noise.
 *
 * Random per-frame jitter reads as a broken renderer; a damped ringing reads as
 * something heavy having landed, which is what the bass drop is selling. The
 * two axes use different frequencies so it never degenerates into a diagonal.
 */
export function shakeOffset(elapsed: number): { x: number; y: number } {
  if (elapsed < 0 || elapsed >= SHAKE_MS) return { x: 0, y: 0 }
  // Exponential decay, normalised so it reaches ~0 exactly at SHAKE_MS rather
  // than being cut off mid-swing — a truncated shake snaps, and §10.5 forbids
  // anything that cuts.
  const k = 1 - elapsed / SHAKE_MS
  const amplitude = SHAKE_PEAK_PX * k * k
  const t = elapsed / 1000
  return {
    x: Math.sin(t * 47) * amplitude,
    y: Math.sin(t * 31 + 1.7) * amplitude * 0.7,
  }
}

/** 0..1 ramp for a stage that starts at `start` and takes `ramp` ms. */
export function rampAt(elapsed: number, start: number, ramp: number): number {
  if (elapsed <= start) return 0
  const u = Math.min(1, (elapsed - start) / ramp)
  // Smoothstep: the surge arriving with a linear ramp reads as a fade-in
  // control rather than as a room filling up.
  return u * u * (3 - 2 * u)
}

/** How far through the drop the swarm is, 0..1. */
export function dropProgress(elapsed: number): number {
  return Math.min(1, Math.max(0, elapsed / DROP_MS))
}

export interface CollapseOptions {
  renderer: Renderer
  floor: FloorSwarm
  /** GDD §10.5 — honours the OS setting. Never disables the beat, only calms it. */
  reduceMotion?: boolean
}

export interface Collapse {
  /**
   * Screen-space layer: pings and chatter. The caller parents this inside the
   * post-process container so it is welded like everything else.
   */
  readonly overlay: Container
  /** Fire Act IV. Idempotent — the trap only springs once per run. */
  trigger(): void
  /**
   * Put the office back. Called when a Paradigm Shift starts a new run, so the
   * trap can be sprung again — Run 2 is a *run*, not an epilogue, and a player
   * who mass-hires a second time must get the same beat rather than silence.
   */
  reset(): void
  readonly active: boolean
  /**
   * Advance one frame. Returns the screen shake the caller should apply.
   *
   * `intensity` is the sustained level once the initial surge has played, and
   * is driven by Entropy: the room does not calm down in Act V, and tying it to
   * the simulation rather than to a timer means the noise is a *reading* of the
   * studio's state rather than a scripted flourish that happens to coincide.
   */
  update(args: {
    dt: number
    width: number
    height: number
    intensity: number
  }): { x: number; y: number }
  destroy(): void
}

export function createCollapse({ renderer, floor, reduceMotion = false }: CollapseOptions): Collapse {
  const overlay = new Container()
  // Nothing renders until the trap springs, and an empty container still costs
  // a visit every frame for the whole of Acts I–III.
  overlay.renderable = false

  // --- part 3a: the Slack spiderweb ---------------------------------------
  //
  // Drawn ONCE into a Graphics and then animated by alpha alone. Rebuilding
  // ~250 stroked lines every frame is a geometry upload every frame, and the
  // web does not actually change — §21 says it connects the desks "instantly"
  // and then glows. Only the glow is animated.

  const web = new Graphics()
  const desks = floor.desks
  for (let i = 0; i < desks.length; i++) {
    const [x1, y1] = desks[i]
    // Three chords per desk at co-prime strides, so the web crosses the floor
    // rather than tracing its perimeter. Every desk ends up connected to
    // everything, which is the point being made: this is not a communication
    // network, it is an all-pairs interrupt.
    for (const stride of [1, 7, 23]) {
      const [x2, y2] = desks[(i + stride) % desks.length]
      web.moveTo(x1, y1).lineTo(x2, y2)
    }
  }
  web.stroke({ width: 1, color: c(RAMPS.ALARM[2]), alpha: 0.5 })
  web.alpha = 0
  web.renderable = false
  floor.webLayer.addChild(web)

  // --- part 3b: the @everyone badges --------------------------------------

  const badge = new Graphics()
  // A red notification badge with an "@" struck through it: outer disc, the
  // ring of the @, and its tail. Drawn rather than typeset so it stays on the
  // pixel grid at every zoom, per ART_DIRECTION §7.
  badge.circle(9, 9, 9).fill(c(RAMPS.ALARM[1]))
  badge.circle(9, 9, 9).stroke({ width: 1, color: c(RAMPS.ALARM[2]) })
  badge.circle(9, 9, 4).stroke({ width: 1.5, color: c(RAMPS.ALARM[3]) })
  badge.moveTo(13, 5).lineTo(13, 11).lineTo(15, 12).stroke({ width: 1.5, color: c(RAMPS.ALARM[3]) })
  const badgeTexture = renderer.generateTexture(badge)
  badge.destroy()

  const pings = new ParticleContainer({
    dynamicProperties: { position: true, scale: false, rotation: false, color: true },
  })

  interface PingState {
    particle: Particle
    vx: number
    vy: number
    age: number
    life: number
    alive: boolean
  }

  const pingPool: PingState[] = []
  for (let i = 0; i < MAX_PINGS; i++) {
    const particle = new Particle({ texture: badgeTexture, x: 0, y: -100, alpha: 0 })
    pings.addParticle(particle)
    pingPool.push({ particle, vx: 0, vy: 0, age: 0, life: 1, alive: false })
  }
  overlay.addChild(pings)

  // --- part 3c: the chatter ------------------------------------------------
  //
  // Each line is typeset ONCE into a texture at construction and then reused by
  // every sprite that shows it. Twenty live Text objects re-laying-out as they
  // churn would put canvas text measurement on the frame path during the single
  // heaviest moment in the game.

  const chatterTextures: Texture[] = CHATTER_LINES.map((line) => {
    const text = new Text({
      text: line,
      style: {
        // The one face in the product (ART_DIRECTION §3). The generic fallback
        // matters: the woff2 may not have finished loading when the textures
        // are baked, and a missing font must degrade to the wrong monospace
        // rather than to no chatter at all.
        fontFamily: 'Departure Mono, monospace',
        fontSize: 13,
        fill: c(RAMPS.NEUTRAL[8]),
        // Not anti-aliased away: the bubbles sit over a red web and need an
        // edge to stay legible against it.
        stroke: { color: c(RAMPS.ALARM[0]), width: 3 },
      },
    })
    const texture = renderer.generateTexture(text)
    text.destroy()
    return texture
  })

  const chatterLayer = new Container()
  overlay.addChild(chatterLayer)

  interface ChatterState {
    sprite: Sprite
    age: number
    life: number
    alive: boolean
  }

  const chatterPool: ChatterState[] = []
  for (let i = 0; i < MAX_CHATTER; i++) {
    const sprite = new Sprite(chatterTextures[i % chatterTextures.length])
    sprite.alpha = 0
    sprite.visible = false
    chatterLayer.addChild(sprite)
    chatterPool.push({ sprite, age: 0, life: 1, alive: false })
  }

  // --- state ---------------------------------------------------------------

  let started = false
  let elapsed = 0
  /** Seconds until the next badge and the next bubble may spawn. */
  let pingCooldown = 0
  let chatterCooldown = 0
  let pingSfxCooldown = 0
  /** Audio cues already fired, so a re-entrant frame cannot double-trigger. */
  const firedCues = new Set<string>()

  function cue(name: string, at: number, id: Parameters<typeof playSfx>[0]) {
    if (elapsed >= at && !firedCues.has(name)) {
      firedCues.add(name)
      playSfx(id)
    }
  }

  return {
    overlay,

    get active() {
      return started
    },

    trigger() {
      if (started) return
      started = true
      elapsed = 0
      overlay.renderable = true
      web.renderable = true
      // §21 Act IV part 1 — "a heavy bass-drop THUD". Fired from trigger()
      // rather than from the first update() so that it starts on the same
      // instant the shake does; a frame's gap between an impact sound and its
      // shake is small enough to pass review and audible enough to read as a
      // flam. The camera's own zoom-out whoosh is a separate sound and stays
      // with the camera, in stage.ts.
      playSfx('collapse-thud')
    },

    reset() {
      if (!started) return
      started = false
      elapsed = 0
      firedCues.clear()
      pingCooldown = 0
      chatterCooldown = 0
      pingSfxCooldown = 0
      overlay.renderable = false
      web.renderable = false
      web.alpha = 0
      // The swarm goes back on its desks, or the next drop starts from wherever
      // the last one was interrupted.
      floor.setDropProgress(1)
      for (const p of pingPool) {
        p.alive = false
        p.particle.alpha = 0
        p.particle.y = -100
      }
      for (const ch of chatterPool) {
        ch.alive = false
        ch.sprite.alpha = 0
        ch.sprite.visible = false
      }
    },

    update({ dt, width, height, intensity }) {
      if (!started) return { x: 0, y: 0 }

      elapsed += dt * 1000

      // Part 2 — the fall.
      floor.setDropProgress(dropProgress(elapsed))

      // Part 4 — the music shift. §21: the lofi "abruptly cuts out, replaced by
      // an overwhelming, chaotic wall of overlapping notification pings, loud
      // overlapping chatter, and an alarm siren."
      cue('siren', 600, 'collapse-siren')
      cue('chatter', SURGE_START_MS, 'collapse-chatter')

      // Part 3a — the web, held at a floor once the surge is up so it never
      // fully fades even if Entropy dips.
      const webRamp = rampAt(elapsed, WEB_START_MS, WEB_RAMP_MS)
      // A slow throb rather than a flicker: the web is meant to look alive and
      // relentless, not faulty.
      const throb = reduceMotion ? 0.85 : 0.78 + Math.sin(elapsed / 260) * 0.12
      web.alpha = webRamp * throb * (0.35 + 0.65 * intensity)

      const surge = rampAt(elapsed, SURGE_START_MS, SURGE_RAMP_MS) * intensity

      // Part 3b — badges. Spawned on a cooldown rather than "n per frame", so
      // the flood rate is the same on a 60 Hz phone and a 120 Hz one.
      pingCooldown -= dt
      if (surge > 0.02 && pingCooldown <= 0) {
        pingCooldown = 0.05 / Math.max(0.15, surge)
        const slot = pingPool.find((p) => !p.alive)
        if (slot) {
          slot.alive = true
          slot.age = 0
          slot.life = 1.6 + Math.random() * 1.2
          slot.particle.x = Math.random() * width
          slot.particle.y = height * (0.25 + Math.random() * 0.75)
          slot.vx = (Math.random() - 0.5) * 40
          // Upward, like a notification stack rising out of the floor.
          slot.vy = -30 - Math.random() * 70
        }
      }

      for (const p of pingPool) {
        if (!p.alive) continue
        p.age += dt
        if (p.age >= p.life) {
          p.alive = false
          p.particle.alpha = 0
          p.particle.y = -100
          continue
        }
        const u = p.age / p.life
        p.particle.x += p.vx * dt
        p.particle.y += p.vy * dt
        // In fast, out slow — a badge that fades in gently reads as a UI
        // animation; one that snaps in reads as an interruption.
        p.particle.alpha = Math.min(1, u * 12) * (1 - u * u)
      }

      // The ping *sound*, throttled hard. One clip per badge would be several
      // hundred voices a second and would exhaust the native pool — the exact
      // failure GDD §23.3 names as a kill criterion. Four a second is already
      // read as "constant".
      pingSfxCooldown -= dt
      if (surge > 0.3 && pingSfxCooldown <= 0) {
        pingSfxCooldown = 0.22 + Math.random() * 0.18
        playSfx('collapse-ping')
      }

      // Part 3c — the overlapping speech bubbles.
      chatterCooldown -= dt
      if (surge > 0.05 && chatterCooldown <= 0) {
        chatterCooldown = 0.28 / Math.max(0.2, surge)
        const slot = chatterPool.find((ch) => !ch.alive)
        if (slot) {
          slot.alive = true
          slot.age = 0
          slot.life = 2.2 + Math.random() * 1.4
          slot.sprite.texture = chatterTextures[Math.floor(Math.random() * chatterTextures.length)]
          slot.sprite.visible = true
          // Anywhere but the very top, where the HUD lives.
          slot.sprite.x = Math.random() * Math.max(1, width - slot.sprite.width)
          slot.sprite.y = height * 0.2 + Math.random() * height * 0.65
        }
      }

      for (const ch of chatterPool) {
        if (!ch.alive) continue
        ch.age += dt
        if (ch.age >= ch.life) {
          ch.alive = false
          ch.sprite.alpha = 0
          ch.sprite.visible = false
          continue
        }
        const u = ch.age / ch.life
        ch.sprite.y -= 14 * dt
        ch.sprite.alpha = Math.min(1, u * 8) * (1 - u * u) * 0.95
      }

      // Part 1 — the shake. reduceMotion halves it rather than removing it:
      // §21 scores an impact here, and no impact at all is a different scene.
      const shake = shakeOffset(elapsed)
      const scale = reduceMotion ? 0.25 : 1
      return { x: shake.x * scale, y: shake.y * scale }
    },

    destroy() {
      // The web lives under the floor tier, not under `overlay`, so it is not
      // covered by the recursive destroy below and has to go on its own.
      web.destroy()
      overlay.destroy({ children: true })
      for (const t of chatterTextures) t.destroy(true)
      badgeTexture.destroy(true)
    },
  }
}
