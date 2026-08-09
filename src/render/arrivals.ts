/**
 * Hiring, made visible — GDD §7.7.2 and §7.7.3.
 *
 * §7.7 opens with the requirement this file exists to meet: "Adding a
 * developer is the game's primary verb, and it must be seen, not read off a
 * counter." Until this existed the store published a `SpawnEvent` on every
 * hire and **nothing consumed it** — the headcount changed and the screen did
 * not, which is the exact failure §7.7.6 names: *a counter with a particle
 * effect*, except without the particle effect.
 *
 * Two beats, and they are different sizes on purpose:
 *
 *  - **Every hire** lands bodies with a dust puff at the desks they took. How
 *    many is `spawnBurst`'s ratio-scaled weight (§7.7.3), so doubling the
 *    studio punches the same at 1 → 2 and at 10¹² → 2×10¹².
 *  - **A hire that lifts the §7.7.1 zoom ceiling** additionally gets a reveal:
 *    the camera is allowed somewhere it has never been, and being shown that
 *    is the reward. `maxZoomFor` gates the lens; this scores the moment it
 *    opens.
 *
 * What is NOT here, and is not a bug: the rung-3-and-above construction gag —
 * floors slapping onto towers, buildings slamming down beside each other.
 * That needs tower and city geometry that does not exist yet (§7.8.2).
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { playSfx } from '../audio/sfx.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** How long one seat's full assembly takes — GDD §7.8.5, desk to lit monitor. */
export const ARRIVAL_MS = 560

/**
 * §7.8.5 — a hire is three beats, not one.
 *
 * A body fading in at a desk that was always there tells the player a number
 * changed. Watching the workspace get built tells them they bought something,
 * and **beat 3 must land last**: the desk and chair are setup, the person
 * arriving is the payload. Reversed, with furniture assembling around someone
 * already sitting, it reads as a glitch.
 */
export const BEAT = {
  desk: 0,
  chair: 120 / ARRIVAL_MS,
  person: 240 / ARRIVAL_MS,
  monitor: 380 / ARRIVAL_MS,
} as const
/** How far above its desk an arriving body starts, in room units. */
export const ARRIVAL_HEIGHT = 190
/** Puff rings per arrival. Three reads as dust; more reads as an explosion. */
const PUFF_RINGS = 3

/**
 * Height above the desk at `t` through one arrival, 0..1.
 *
 * Free fall — distance goes as t² — so the body is moving fastest when it
 * lands. An ease-out reads as a lift descending, which was already learned
 * once on the §21 Act IV drop and is not worth learning twice.
 */
export function arrivalHeight(t: number): number {
  if (t <= 0) return ARRIVAL_HEIGHT
  if (t >= 1) return 0
  return ARRIVAL_HEIGHT * (1 - t * t)
}

/** Puff radius at `t`, 0..1. Expands fast, thins out slowly. */
export function puffRadius(t: number): number {
  return Math.min(1, Math.max(0, t)) ** 0.55
}

/** Puff opacity at `t`. Nothing lingers — dust is a punctuation mark. */
export function puffAlpha(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return (1 - u) * (1 - u) * 0.5
}

/**
 * §7.8.5 — a batch cascades across the room in **seat order**.
 *
 * Deliberately the opposite of §21 Act IV's swarm drop, which scatters by hash.
 * The difference is the batch size: at counts the eye can actually follow,
 * order reads as a row being placed and looks intentional; at swarm sizes the
 * same ordering sweeps the iso grid corner to corner and reads as a diagonal
 * wipe. Legible order and a thousand bodies want opposite treatments.
 *
 * Returns a delay in *seconds*, compressing as the batch grows so a hundred
 * arrivals do not take seven seconds.
 */
export const CASCADE_STEP_MS = 70
/**
 * The longest a cascade may take.
 *
 * Raised for the Mass Hire. At 1.2 s a hundred and twenty bodies land in under
 * ten frames each and the wave is over before the eye has followed it across
 * the room; at 2.2 s it reads as a *flood* filling the floor, which is what
 * §21's Act IV is for. Still bounded, because a cascade the player is waiting
 * on has stopped being feedback.
 */
export const CASCADE_MAX_MS = 2200

export function cascadeDelay(i: number, n: number): number {
  if (n <= 1) return 0
  const span = Math.min(CASCADE_MAX_MS, (n - 1) * CASCADE_STEP_MS)
  return (i / (n - 1)) * (span / 1000)
}

/** Squash on landing, 1 = at rest. The person gets the biggest — §7.8.5. */
export function landingSquash(t: number, strength: number): number {
  if (t <= 0 || t >= 1) return 1
  const impact = Math.max(0, (t - 0.62) / 0.38)
  if (impact <= 0) return 1
  return 1 - Math.sin(impact * Math.PI) * strength * (1 - impact * 0.4)
}

/**
 * Run one beat of the assembly if its start has passed.
 *
 * `t` is progress through the whole seat; `start` is where this beat begins.
 * The beat is handed its own 0..1 so each one falls and squashes independently
 * rather than sharing a single curve.
 */
function drawBeat(
  g: Graphics,
  x: number,
  y: number,
  t: number,
  start: number,
  draw: (g: Graphics, x: number, y: number, u: number) => void,
) {
  if (t < start) return
  draw(g, x, y, Math.min(1, (t - start) / (1 - start)))
}

function puff(g: Graphics, x: number, y: number, u: number, from: number) {
  const p = Math.min(1, (u - from) / (1 - from))
  if (p <= 0) return
  for (let r = 0; r < PUFF_RINGS; r++) {
    const rr = puffRadius(p) * (10 + r * 6)
    g.ellipse(x, y, rr, rr * 0.5).stroke({
      width: 1,
      color: c(RAMPS.NEUTRAL[5]),
      alpha: puffAlpha(p),
    })
  }
}

interface Live {
  /** Room-local position of the desk being filled. */
  x: number
  y: number
  born: number
  delay: number
  gfx: Graphics
}

export interface Arrivals {
  /** Parented into the room so arrivals share its transform and cross-fade. */
  readonly layer: Container
  /**
   * Land `count` bodies at the given desks. Desks are room-local positions —
   * the caller knows the layout, this only knows how to drop things onto it.
   */
  spawn(desks: Array<{ x: number; y: number }>, count: number, now: number): void
  /** Advance. Returns true while anything is still falling. */
  update(now: number): boolean
  destroy(): void
}

export function createArrivals(): Arrivals {
  const layer = new Container()
  const live: Live[] = []
  const pool: Graphics[] = []

  function take(): Graphics {
    const g = pool.pop() ?? new Graphics()
    g.visible = true
    layer.addChild(g)
    return g
  }

  return {
    layer,

    spawn(desks, count, now) {
      if (desks.length === 0 || count <= 0) return
      const n = Math.min(count, desks.length)
      // Fill from the END of the desk list: those are the desks the new hires
      // just took. Filling from the start would land bodies on top of people
      // who were already sitting there.
      for (let i = 0; i < n; i++) {
        const desk = desks[desks.length - n + i]
        live.push({ x: desk.x, y: desk.y, born: now, delay: cascadeDelay(i, n), gfx: take() })
      }
      // One sound for the whole batch, not one per body — a hundred overlapping
      // clips is the audio-pool exhaustion §23.3 names as a standing risk.
      playSfx('poke-floor')
    },

    update(now) {
      for (let i = live.length - 1; i >= 0; i--) {
        const a = live[i]
        // `delay` is a wall-clock offset in seconds (§7.8.5's cascade), not a
        // fraction of the beat: each seat runs its own full assembly, they are
        // merely started at different times.
        const t = (now - a.born - a.delay * 1000) / ARRIVAL_MS

        if (t >= 1) {
          a.gfx.clear()
          a.gfx.visible = false
          layer.removeChild(a.gfx)
          pool.push(a.gfx)
          live.splice(i, 1)
          continue
        }

        a.gfx.clear()
        if (t <= 0) continue

        // §7.8.5's three beats, each running its own fall from its own start.
        // Everything here is a silhouette rather than a copy of the room's
        // sprites: these are in frame for a few hundred milliseconds, and
        // drawing the real thing would tie this file to the room's art.
        drawBeat(a.gfx, a.x, a.y, t, BEAT.desk, (g, x, y, u) => {
          const h = arrivalHeight(u)
          const sq = landingSquash(u, 0.18)
          g.moveTo(x - 26, y - h)
            .lineTo(x, y + 13 * sq - h)
            .lineTo(x + 26, y - h)
            .lineTo(x, y - 13 * sq - h)
            .closePath()
            .fill(c(RAMPS.WOOD[2]))
          if (h <= 0.01) puff(g, x, y + 6, u, 0.82)
        })

        drawBeat(a.gfx, a.x, a.y, t, BEAT.chair, (g, x, y, u) => {
          const h = arrivalHeight(u) * 0.7
          const sq = landingSquash(u, 0.22)
          // Sized and placed to land where `drawChair` will draw the real one.
          // A silhouette does not have to be the same art, but it does have to
          // stop in the same place, or the seat visibly jumps on the frame the
          // assembly hands over to the room.
          g.rect(x - 11, y + 17 - 30 * sq - h, 22, 30 * sq).fill(c(RAMPS.NEUTRAL[1]))
        })

        // Beat 3 is the payload: the biggest squash, and the reason the other
        // two exist. §7.8.5 — "the bum-hits-seat beat".
        drawBeat(a.gfx, a.x, a.y, t, BEAT.person, (g, x, y, u) => {
          const h = arrivalHeight(u)
          const sq = landingSquash(u, 0.34)
          g.rect(x - 7, y - 14 - h, 14, 20 * sq).fill(c(RAMPS.NEUTRAL[6]))
          g.rect(x - 6, y - 28 - h, 12, 12).fill(c(RAMPS.SKIN[0]))
          if (h <= 0.01) puff(g, x, y + 6, u, 0.7)
        })

        drawBeat(a.gfx, a.x, a.y, t, BEAT.monitor, (g, x, y, u) => {
          // Dark, then a flicker, then code — a monitor waking, not appearing.
          const on = u > 0.35 && (u > 0.55 || Math.floor(u * 40) % 2 === 0)
          g.rect(x - 11, y - 44, 22, 15).fill(c(RAMPS.NEUTRAL[2]))
          g.rect(x - 9, y - 42, 18, 11).fill(c(on ? RAMPS.GLOW[0] : RAMPS.NEUTRAL[0]))
          if (on) g.rect(x - 7, y - 39, 9, 1.5).fill(c(RAMPS.GLOW[2]))
        })
      }
      return live.length > 0
    },

    destroy() {
      layer.destroy({ children: true })
      live.length = 0
      pool.length = 0
    },
  }
}
