/**
 * The floating poke feedback — GDD §8.2 (the numeral) and §8.2a (the code line).
 *
 * Every tap throws off `+8` and a short line of source. They are drawn onto
 * their own 2D canvas, which the glass composites *under* its lines
 * (`three/render/glass.ts`) — ART_DIRECTION §6's weld: a numeral floating
 * above the scanlines reads as a sticker on the screen rather than as
 * something the studio did.
 *
 * [2026-09-28] **Canvas, not Pixi.** This file baked every digit and every
 * snippet into Pixi textures at startup, because typesetting a Pixi `Text` on
 * the tap frame put texture generation inside §23.3 criterion 1's 80 ms. The
 * Pixi stage is decommissioned (the user: *"pixi scenes are supposed to be
 * completed decommissioned"*), and a canvas `fillText` of a dozen glyphs is a
 * fraction of a millisecond — there is no texture to generate, so there is
 * nothing to bake. What the numerals look like did not change: the same face,
 * sizes, palette entries, outline, lanes and rise.
 */

import { RAMPS } from '../art/palette.ts'

const NUMERAL_SIZE = 20
const CRIT_SIZE = 30
const SNIPPET_SIZE = 12

/** How far a floater rises over its life, in CSS pixels. */
const RISE = 58
/** The last fraction of its life over which a floater fades. */
const FADE = 0.3

export interface PokeTextOffsets {
  numeralX: number
  numeralY: number
  snippetX: number
  snippetY: number
}

/**
 * Five callout lanes around the point that was coded. Adjacent lanes are never
 * the same, so rapid taps cannot place two successive messages on top of one
 * another. The line of code and its numeral share one anchor inside the lane:
 * they are one event and rise together as one unit.
 */
export function pokeTextOffsets(
  numeralSize: number,
  sequence = 0,
): PokeTextOffsets {
  const lanes = [
    { x: 0, y: -100 },
    { x: -18, y: -50 },
    { x: 18, y: 0 },
    { x: -10, y: 50 },
    { x: 10, y: 100 },
  ] as const
  const lane = lanes[((Math.floor(sequence) % lanes.length) + lanes.length) % lanes.length]
  return {
    numeralX: lane.x,
    numeralY: lane.y,
    snippetX: lane.x,
    snippetY: lane.y + numeralSize + 8,
  }
}

/** `+8`, `-2`, `+1.2M` — short forms only; a floater is not a readout. */
export function formatPokeNumeral(sp: number): string {
  const sign = sp < 0 ? '-' : '+'
  const n = Math.abs(sp)
  if (n >= 1e12) return `${sign}${(n / 1e12).toFixed(1)}T`
  if (n >= 1e9) return `${sign}${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${sign}${(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${sign}${(n / 1e3).toFixed(0)}K`
  // Below ten, round to a decimal rather than to an integer. `Math.round`
  // turned every fractional yield into `+0` — a floater announcing that
  // nothing happened while the simulation banked the points, which is the one
  // thing a feedback numeral must never do.
  if (n >= 10) return `${sign}${Math.round(n)}`
  if (n >= 1) return `${sign}${n.toFixed(1).replace(/\.0$/, '')}`
  return `${sign}${n.toFixed(2)}`
}

/** Which palette entry a numeral takes — GDD §8.2. */
function numeralColour(sp: number, crit: boolean, unblocked: boolean): string {
  // §25.1, R11 — an Overwhelmed developer pays nothing and that is the design
  // (§4.7), so the floater reports what the poke *achieved*: UNBLOCKED, in WARN
  // amber, a different kind of event the player can tell at a glance.
  if (unblocked) return RAMPS.WARN[2]
  // A Rogue Refactorer gives back points they already deleted, so a negative
  // numeral is alarm red rather than a smaller version of the good news.
  if (sp < 0) return RAMPS.ALARM[2]
  return crit ? RAMPS.CALM[3] : RAMPS.CALM[2]
}

/** One floater, as the store holds it. */
export interface PokeFloater {
  id: number
  sp: number
  /** Where it was thrown from, in the canvas's CSS pixels. */
  x: number
  y: number
  crit: boolean
  /** `performance.now()` at the tap. */
  bornAt: number
  snippet: string | null
  unblocked: boolean
}

export interface PokeCanvas {
  readonly canvas: HTMLCanvasElement
  /** Match the frame: CSS size and the device pixel ratio the glass samples at. */
  resize(width: number, height: number, pixelRatio: number): void
  /**
   * Draw this frame's floaters. True when the canvas changed — including the
   * frame it is cleared on — so the texture over it is only re-uploaded when
   * there is something new to see.
   */
  draw(floaters: readonly PokeFloater[], now: number, lifeMs: number): boolean
}

export function createPokeCanvas(): PokeCanvas {
  const canvas = document.createElement('canvas')
  let ctx: CanvasRenderingContext2D | null = null
  let ratio = 1
  let shown = false

  // The one face in the product (ART_DIRECTION §3). The generic fallback
  // matters: the woff2 may not have loaded yet, and a missing font has to
  // degrade to the wrong monospace rather than to no feedback at all.
  const font = (size: number) => `${size}px "Departure Mono", monospace`

  /** Outline then fill: the numeral flies over lit monitors and has to stay legible on both. */
  function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, fill: string, stroke: number) {
    c.font = font(size)
    c.lineWidth = stroke
    c.strokeStyle = RAMPS.NEUTRAL[0]
    c.fillStyle = fill
    c.strokeText(s, x, y)
    c.fillText(s, x, y)
  }

  return {
    canvas,
    resize(width, height, pixelRatio) {
      ratio = pixelRatio
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      ctx = null
      shown = true
    },
    draw(floaters, now, lifeMs) {
      if (floaters.length === 0 && !shown) return false
      ctx ??= canvas.getContext('2d')
      if (!ctx) return false
      const c = ctx
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.clearRect(0, 0, canvas.width, canvas.height)
      shown = floaters.length > 0
      c.setTransform(ratio, 0, 0, ratio, 0, 0)
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.lineJoin = 'round'
      for (const f of floaters) {
        const age = (now - f.bornAt) / lifeMs
        // §8.2a — the snippet is a joke, and a joke has to finish being read:
        // full opacity for most of the life, then the fade.
        const alpha = Math.max(0, Math.min(1, (1 - age) / FADE))
        if (alpha <= 0) continue
        const size = f.crit ? CRIT_SIZE : NUMERAL_SIZE
        const lane = pokeTextOffsets(size, f.id - 1)
        const x = f.x
        const y = f.y - age * RISE
        c.globalAlpha = alpha
        text(c, f.unblocked ? 'UNBLOCKED' : formatPokeNumeral(f.sp), x + lane.numeralX, y + lane.numeralY, size, numeralColour(f.sp, f.crit, f.unblocked), 4)
        // §8.2a. Null for an Overwhelmed developer, who has nothing to say —
        // and that silence is the joke, so it is not filled with a default.
        if (f.snippet) {
          c.globalAlpha = alpha * 0.85
          text(c, f.snippet, x + lane.snippetX, y + lane.snippetY, SNIPPET_SIZE, RAMPS.GLOW[2], 3)
        }
      }
      c.globalAlpha = 1
      return true
    },
  }
}
