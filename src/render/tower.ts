/**
 * Rung 3 — the tower. GDD §7.7.1, §7.7.2, §7.8.2.
 *
 * Above a thousand developers one sprite stops being one person and becomes
 * **a floor**: "a tower, 1–10 storeys. Each storey is a lit band of the same
 * crammed floor, seen edge-on. Storeys arrive by dropping onto the stack."
 *
 * Until this existed, hiring past 1,000 produced nothing at all — the level-2
 * swarm saturated at its sprite budget and the picture simply stopped
 * answering. That is the failure §7.7 opens by forbidding: *a counter with a
 * particle effect*, arriving at the exact moment the numbers get interesting.
 *
 * **A storey is not a smaller floor.** It is a band, seen from outside, with
 * lit windows — because the §7.7.1 promise is that the *unit* changes, not
 * that the same unit gets smaller. Shrinking the floor tier would have been
 * cheaper and would have said the opposite thing.
 *
 * Procedural, from the master palette. ART_DIRECTION §4 classes everything at
 * this scale as T0/T3 and §7.8.2 is explicit that no rung above 2 needs a
 * single bespoke sprite — which is the whole reason the §22.7 art budget can
 * be nineteen.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** §7.7.1 — one storey holds a floor's worth of people. */
export const DEVS_PER_STOREY = 1000

/** Rung 3 tops out at 10 storeys; rung 4 makes the whole tower one unit. */
export const MAX_STOREYS = 10

const STOREY_H = 34
const TOWER_W = 210
const TOWER_D = 105

/** How long one storey takes to fall onto the stack. */
export const STOREY_DROP_MS = 700

/**
 * Storeys at this headcount — GDD §7.7.1.
 *
 * Floor, not round: 1,999 developers is one full storey and most of a second,
 * and showing two would be claiming a floor that is half empty. The player
 * counts what they can see.
 */
export function storeysFor(devs: number): number {
  if (!Number.isFinite(devs) || devs < DEVS_PER_STOREY) return 0
  return Math.max(1, Math.min(MAX_STOREYS, Math.floor(devs / DEVS_PER_STOREY)))
}

/**
 * Height of a storey above its resting place at `t` through its arrival.
 *
 * §7.7.2's register is deadpan slapstick: "a complete, furnished, already-
 * populated storey drops out of the sky and lands on top of the tower with a
 * *whump*." So it falls under gravity — distance as t² — and the squash on
 * landing is what sells the weight.
 */
export function storeyDropHeight(t: number): number {
  if (t <= 0) return 520
  if (t >= 1) return 0
  return 520 * (1 - t * t)
}

/**
 * Vertical squash of the whole tower as a storey lands, 1 = unsquashed.
 *
 * "The building squashes, wobbles, and settles one floor taller." A damped
 * oscillation rather than a single dip, because a building that compresses
 * once and stops reads as a lift arriving.
 */
export function towerSquash(t: number): number {
  if (t <= 0.82 || t >= 1) return 1
  const b = (t - 0.82) / 0.18
  return 1 - Math.sin(b * Math.PI * 2) * 0.055 * (1 - b)
}

export interface TowerHandle {
  container: Container
  /** Rebuild for a headcount. Cheap enough on change, far too dear per frame. */
  setHeadcount(devs: number): void
  /** Advance the arrival animation. `now` in ms. */
  update(now: number): void
  /** True while a storey is still in the air. */
  readonly settling: boolean
  /** Live bounding size for the §23.4.1 camera fit. Grows with the tower. */
  readonly extent: { w: number; h: number }
}

/** One storey: a lit band seen edge-on, with windows. */
function drawStorey(g: Graphics, y: number, index: number) {
  const halfW = TOWER_W / 2
  const halfD = TOWER_D / 2

  // The slab top, in the shared 2:1 iso projection.
  g.moveTo(0, y - halfD)
    .lineTo(halfW, y)
    .lineTo(0, y + halfD)
    .lineTo(-halfW, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[3]))

  // Left face catches the light, right face does not — ART_DIRECTION §7's
  // single top-left source, held by hand because no script can check it.
  g.moveTo(-halfW, y)
    .lineTo(0, y + halfD)
    .lineTo(0, y + halfD + STOREY_H)
    .lineTo(-halfW, y + STOREY_H)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[2]))
  g.moveTo(halfW, y)
    .lineTo(0, y + halfD)
    .lineTo(0, y + halfD + STOREY_H)
    .lineTo(halfW, y + STOREY_H)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[1]))

  // Windows. Lit from a deterministic hash of storey and column so the tower
  // looks the same on every run — a randomly lit building flickers its whole
  // facade on any rebuild, which reads as a fault rather than as an office.
  for (let i = 0; i < 6; i++) {
    const lit = ((index * 31 + i * 17) % 5) !== 0
    const wx = -halfW + 14 + i * 16
    const wy = y + STOREY_H * 0.35 + (i % 2) * 3
    g.rect(wx, wy, 9, 7).fill(c(lit ? RAMPS.GLOW[1] : RAMPS.NEUTRAL[0]))
  }
  for (let i = 0; i < 6; i++) {
    const lit = ((index * 13 + i * 23) % 4) !== 0
    const wx = 8 + i * 16
    const wy = y + STOREY_H * 0.35 + ((i + 1) % 2) * 3
    g.rect(wx, wy, 9, 7).fill(c(lit ? RAMPS.GLOW[0] : RAMPS.NEUTRAL[0]))
  }
}

export function buildTower(): TowerHandle {
  const root = new Container()
  const stack = new Container()
  const falling = new Graphics()
  const shadow = new Graphics()
  root.addChild(shadow, stack, falling)

  const built = new Graphics()
  stack.addChild(built)

  let storeys = 0
  let arrivalStart = 0
  let arriving = false
  const extent = { w: TOWER_W, h: STOREY_H * 2 }

  function redraw(n: number) {
    built.clear()
    // Drawn top-down so lower storeys overlap the ones above them, which is
    // what makes a stack read as solid rather than as floating slabs.
    for (let i = n - 1; i >= 0; i--) {
      drawStorey(built, -i * STOREY_H, i)
    }

    shadow.clear()
    shadow
      .ellipse(0, STOREY_H * 0.6, TOWER_W * 0.62, TOWER_D * 0.42)
      .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.55 })

    extent.w = TOWER_W * 1.35
    extent.h = Math.max(STOREY_H * 2, n * STOREY_H + TOWER_D + STOREY_H)
    root.pivot.set(0, (-(n - 1) * STOREY_H) / 2)
  }

  redraw(0)

  return {
    container: root,

    setHeadcount(devs: number) {
      const next = storeysFor(devs)
      if (next === storeys) return
      // Only a *gain* is an arrival. Act V liquidates the studio, and a tower
      // shedding storeys is not a beat anyone should be shown falling.
      const gained = next > storeys
      storeys = next
      redraw(gained ? next - 1 : next)
      if (gained) {
        arriving = true
        arrivalStart = performance.now()
      }
    },

    update(now: number) {
      if (!arriving) return
      const t = (now - arrivalStart) / STOREY_DROP_MS
      falling.clear()

      if (t >= 1) {
        arriving = false
        redraw(storeys)
        stack.scale.set(1, 1)
        return
      }

      // The storey in the air, drawn separately so the settled stack below it
      // can squash without dragging it along.
      const h = storeyDropHeight(t)
      drawStorey(falling, -(storeys - 1) * STOREY_H - h, storeys - 1)
      stack.scale.set(1, towerSquash(t))
    },

    get settling() {
      return arriving
    },

    extent,
  }
}
