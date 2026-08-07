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

/** How long one arrival takes, from drop to settle. */
export const ARRIVAL_MS = 620
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
 * Stagger for arrival `i` of `n`, as a fraction of the whole beat.
 *
 * A hundred bodies landing on one frame is a wipe. Derived from the index by a
 * hash rather than a random draw so a bad-looking arrival is reproducible.
 */
export function arrivalDelay(i: number, n: number): number {
  if (n <= 1) return 0
  const scatter = ((i * 2654435761) % 4096) / 4096
  return scatter * 0.55
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
        live.push({ x: desk.x, y: desk.y, born: now, delay: arrivalDelay(i, n), gfx: take() })
      }
      // One sound for the whole batch, not one per body — a hundred overlapping
      // clips is the audio-pool exhaustion §23.3 names as a standing risk.
      playSfx('poke-floor')
    },

    update(now) {
      for (let i = live.length - 1; i >= 0; i--) {
        const a = live[i]
        const raw = (now - a.born) / ARRIVAL_MS
        const t = (raw - a.delay) / (1 - a.delay)

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

        // The falling body. Deliberately a silhouette rather than a copy of
        // the developer sprite: it is in the air for 300 ms and reads as a
        // person arriving, and drawing the real thing would tie this file to
        // the room's art.
        const h = arrivalHeight(t)
        a.gfx.rect(a.x - 7, a.y - 16 - h, 14, 22).fill(c(RAMPS.NEUTRAL[6]))
        a.gfx.rect(a.x - 6, a.y - 30 - h, 12, 12).fill(c(RAMPS.SKIN[0]))

        // The puff, once they have landed.
        if (h <= 0.01) {
          const p = Math.min(1, (t - 0.82) / 0.18)
          if (p > 0) {
            for (let r = 0; r < PUFF_RINGS; r++) {
              const rr = puffRadius(p) * (12 + r * 7)
              a.gfx
                .ellipse(a.x, a.y + 6, rr, rr * 0.5)
                .stroke({ width: 1, color: c(RAMPS.NEUTRAL[5]), alpha: puffAlpha(p) })
            }
          }
        }
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
