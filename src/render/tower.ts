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

/**
 * Storey to storey.
 *
 * Raised from 34. At 34 the stack was shorter than one roof diamond is deep, so
 * even with only the top storey capped the faces were a third of their own
 * height and the windows had nowhere to sit. Forty-four gives each floor two
 * rows of windows and a seam, which is what makes ten of them countable.
 */
const STOREY_H = 44
const TOWER_W = 210
const TOWER_D = 105

/**
 * The pitch of the stack, exported for R15's hit test.
 *
 * Which storey a tap landed on is geometry, and geometry lives here — a caller
 * re-deriving it from a screen offset is trap 10's "a prop placed in screen
 * pixels does not know which way the room is facing", one scale up.
 */
export const STOREY_HEIGHT = STOREY_H

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

/**
 * Which storey a tower-local point is on, or −1 for a miss — GDD §4.5b, R15.
 *
 * Rung 3's unit is a *floor*, so a tap has to name which one: storey 6 and
 * storey 1 are two different thousand-person units and §4.5b makes each of them
 * a target with its own buff.
 *
 * The horizontal test is what keeps the sky a miss. §7.7.6 makes the world
 * addressable and an addressable world has places where nothing is standing —
 * the same rule that makes a tap on empty floor a miss rather than a free
 * point.
 */
export function storeyAtLocal(localX: number, localY: number, storeys: number): number {
  if (!(storeys > 0)) return -1
  // A little wider than the slab, because the whole tower is a thumb-sized
  // target at the Z where rung 3 fits the frame.
  if (Math.abs(localX) > TOWER_W * 0.62) return -1

  // Storey `i` is drawn at `y = -i * STOREY_H`, so the index runs *up* the
  // screen. Clamped rather than rejected: a tap above the roof means the top
  // floor, which is what the player was aiming at.
  const i = Math.round(-localY / STOREY_H)
  return Math.max(0, Math.min(Math.floor(storeys) - 1, i))
}

export interface TowerHandle {
  container: Container
  /**
   * Rebuild for a headcount. Cheap enough on change, far too dear per frame.
   *
   * `quiet` suppresses §7.7.2's arrival drop. It is set when the tower has been
   * *re-pointed* at a different building (§26.2.2's address moved), because a
   * building that happens to have more storeys in it than the last one is not a
   * storey arriving — and the drop is a beat the player earns by hiring, not
   * one the camera hands out for navigating.
   */
  setHeadcount(devs: number, quiet?: boolean): void
  /**
   * Which storey the §26.2.2 address is in, so it can be lit — or −1 for none.
   *
   * The building is ten identical slabs; without this there is nothing on
   * screen that says which of them you are about to open, or which one you were
   * standing in a moment ago. "How do I select which floor to go?" was asked of
   * a picture that could not answer it.
   */
  setFocusStorey(index: number): void
  /** Advance the arrival animation. `now` in ms. */
  update(now: number): void
  /** True while a storey is still in the air. */
  readonly settling: boolean
  /** Live bounding size for the §23.4.1 camera fit. Grows with the tower. */
  readonly extent: { w: number; h: number }
}

/**
 * A storey's two visible faces, and the seam under it.
 *
 * **No roof.** Every storey used to draw its own slab top, and the slab top is
 * a diamond `TOWER_D` deep — a hundred and five pixels — while the storeys are
 * only {@link STOREY_H} apart. So each floor's roof covered the two or three
 * above it, and a ten-storey building rendered as one smooth column of
 * overlapping diamonds with the side faces almost entirely hidden. That is the
 * washed-out pale tower: not a lighting or a palette problem, a stack of
 * lids. Only the top storey has a roof now, because in a building only the top
 * storey does.
 */
function drawFaces(g: Graphics, y: number, index: number, lit: boolean) {
  const halfW = TOWER_W / 2
  const halfD = TOWER_D / 2
  const top = y + halfD
  const bot = top + STOREY_H

  // Left face catches the light, right face does not — ART_DIRECTION §7's
  // single top-left source, held by hand because no script can check it. The
  // two are two full steps of the ramp apart rather than one: at this size the
  // corner between them is the only thing giving the building volume, and one
  // step of NEUTRAL is not visible through §6's grade.
  g.moveTo(-halfW, y)
    .lineTo(0, top)
    .lineTo(0, bot)
    .lineTo(-halfW, y + STOREY_H)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[lit ? 4 : 3]))
  g.moveTo(halfW, y)
    .lineTo(0, top)
    .lineTo(0, bot)
    .lineTo(halfW, y + STOREY_H)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[lit ? 2 : 1]))

  // Windows, in a band across each face. Lit from a deterministic hash of
  // storey and column so the facade is identical on every rebuild — a randomly
  // lit building re-rolls its whole face whenever anything else changes, which
  // reads as a fault rather than as an office at night.
  //
  // The row follows the face's own slope instead of sitting level, which is
  // what makes the windows read as being *on* the wall rather than painted over
  // it. Left face slopes down toward the corner, right face up.
  const rows = STOREY_H >= 34 ? 2 : 1
  for (let r = 0; r < rows; r++) {
    const drop = STOREY_H * (0.28 + r * 0.34)
    for (let i = 0; i < 6; i++) {
      const on = ((index * 31 + i * 17 + r * 5) % 5) !== 0
      const wx = -halfW + 14 + i * 16
      g.rect(wx, y + drop + ((wx + halfW) / TOWER_W) * halfD, 9, 6).fill(
        c(on ? RAMPS.GLOW[lit ? 2 : 1] : RAMPS.NEUTRAL[0]),
      )
    }
    for (let i = 0; i < 6; i++) {
      const on = ((index * 13 + i * 23 + r * 7) % 4) !== 0
      const wx = 8 + i * 16
      g.rect(wx, y + drop + ((halfW - wx) / TOWER_W) * halfD, 9, 6).fill(
        c(on ? RAMPS.GLOW[lit ? 1 : 0] : RAMPS.NEUTRAL[0]),
      )
    }
  }

  // **The seam.** A dark line along the bottom of every storey, following the
  // building's own corner. It is the whole reason a stack reads as ten floors
  // rather than as one striped box, and it costs two strokes.
  g.moveTo(-halfW, y + STOREY_H)
    .lineTo(0, bot)
    .lineTo(halfW, y + STOREY_H)
    .stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]) })

  // The vertical corner, so the two planes read as meeting rather than as one
  // folded shape — the same trick the room's walls use.
  g.moveTo(0, top).lineTo(0, bot).stroke({ width: 1, color: c(RAMPS.NEUTRAL[0]), alpha: 0.7 })

  if (lit) {
    // §26.2.2 — the storey the address is in. A rule along its top edge, in the
    // interface's own phosphor rather than the building's palette: this is the
    // game pointing at something, not a feature of the architecture.
    g.moveTo(-halfW, y)
      .lineTo(0, top)
      .lineTo(halfW, y)
      .stroke({ width: 2, color: c(RAMPS.CALM[2]) })
  }
}

/** The roof, drawn once, on the top storey. */
function drawRoof(g: Graphics, y: number) {
  const halfW = TOWER_W / 2
  const halfD = TOWER_D / 2
  g.moveTo(0, y - halfD)
    .lineTo(halfW, y)
    .lineTo(0, y + halfD)
    .lineTo(-halfW, y)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[3]))
  // Plant and a lift overrun, so the top of the building is a place rather
  // than a lid. Two shapes, and they are what stops a ten-storey stack ending
  // in a blank diamond.
  g.moveTo(-halfW * 0.34, y - halfD * 0.2)
    .lineTo(0, y + halfD * 0.14)
    .lineTo(halfW * 0.1, y - halfD * 0.06)
    .lineTo(-halfW * 0.24, y - halfD * 0.4)
    .closePath()
    .fill(c(RAMPS.NEUTRAL[2]))
  g.rect(halfW * 0.18, y - halfD * 0.42, 22, 12).fill(c(RAMPS.NEUTRAL[4]))
  g.moveTo(0, y - halfD).lineTo(halfW, y).lineTo(0, y + halfD).lineTo(-halfW, y).closePath()
    .stroke({ width: 1, color: c(RAMPS.NEUTRAL[5]), alpha: 0.5 })
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
  let focusStorey = -1
  let arrivalStart = 0
  let arriving = false
  const extent = { w: TOWER_W, h: STOREY_H * 2 }

  function redraw(n: number) {
    built.clear()
    // The roof first — it is the furthest thing from the camera and nothing
    // below it may be painted over. Then the faces top-down, so a lower storey
    // overlaps the one above and the stack reads as solid rather than as
    // floating slabs.
    if (n > 0) drawRoof(built, -(n - 1) * STOREY_H)
    for (let i = n - 1; i >= 0; i--) {
      drawFaces(built, -i * STOREY_H, i, i === focusStorey)
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

    setHeadcount(devs: number, quiet = false) {
      const next = storeysFor(devs)
      if (next === storeys) return
      // Only a *gain* is an arrival. Act V liquidates the studio, and a tower
      // shedding storeys is not a beat anyone should be shown falling.
      const gained = next > storeys && !quiet
      storeys = next
      redraw(gained ? next - 1 : next)
      if (gained) {
        arriving = true
        arrivalStart = performance.now()
      }
    },

    setFocusStorey(index: number) {
      const next = Number.isFinite(index) ? Math.floor(index) : -1
      const clamped = next >= 0 && next < storeys ? next : -1
      if (clamped === focusStorey) return
      focusStorey = clamped
      if (!arriving) redraw(storeys)
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
      const fallY = -(storeys - 1) * STOREY_H - h
      drawRoof(falling, fallY)
      drawFaces(falling, fallY, storeys - 1, false)
      stack.scale.set(1, towerSquash(t))
    },

    get settling() {
      return arriving
    },

    extent,
  }
}
