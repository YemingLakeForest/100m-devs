/**
 * The floating poke feedback — GDD §8.2 (the numeral) and §8.2a (the code line).
 *
 * Every tap throws off `+8` and a short line of source. Both are typeset ONCE
 * at construction and reused as texture references thereafter, which is the
 * only structure that is safe on this path: GDD §23.3 criterion 1 measures
 * tap → numeral visible at an 80 ms p95, and laying out canvas text on the tap
 * frame would put font measurement inside the exact number being gated.
 *
 * So the numeral is composed from pre-rendered digit glyphs, and each snippet
 * has its own texture. Building one floater is then a handful of Sprite
 * allocations with no layout at all.
 *
 * These are drawn in Pixi rather than the DOM deliberately. GDD §23.2 non-negotiable 3
 * puts structured text in React, and this is not structured text — it is
 * scenery that churns five times a second and has to sit *under* the CRT glass
 * to be welded (ART_DIRECTION §6). A DOM numeral would float above the barrel
 * curvature.
 */

import { Container, Sprite, Text, type Renderer, type Texture } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import { ALL_SNIPPETS } from '../game/snippets.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * Glyphs the numeral can be built from.
 *
 * Digits, the magnitude suffixes, and the seven extra letters that spell
 * UNBLOCKED (§25.1) — an unbaked glyph is skipped *silently* by `build`, so a
 * word added without its letters renders as nothing at all rather than as a
 * visible mistake. That is the one failure mode this list has.
 */
const GLYPHS = '0123456789+-.KMBTUNLOCED' as const

const NUMERAL_SIZE = 20
const CRIT_SIZE = 30
const SNIPPET_SIZE = 12

export interface PokeTypeset {
  /**
   * A floater: the SP numeral, with the §8.2a code line beneath it.
   *
   * Returns a fresh Container each call — the caller pools by floater id and
   * destroys on expiry, which it already does for the numerals it replaced.
   */
  build(
    sp: number,
    crit: boolean,
    snippet: string | null,
    unblocked?: boolean,
    sequence?: number,
  ): Container
  destroy(): void
}

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

/** Which palette entry a numeral takes — GDD §8.2. */
function numeralColour(sp: number, crit: boolean): number {
  // A Rogue Refactorer gives back points they already deleted, so a negative
  // numeral is alarm red rather than a smaller version of the good news.
  if (sp < 0) return c(RAMPS.ALARM[2])
  return crit ? c(RAMPS.CALM[3]) : c(RAMPS.CALM[2])
}

export function createPokeTypeset(renderer: Renderer): PokeTypeset {
  /** `${size}:${colour}:${glyph}` -> texture. */
  const glyphs = new Map<string, Texture>()
  const snippets = new Map<string, Texture>()
  const owned: Texture[] = []

  function bake(
    content: string,
    size: number,
    colour: number,
    strokeWidth: number,
  ): Texture {
    const text = new Text({
      text: content,
      style: {
        // The one face in the product (ART_DIRECTION §3). The generic fallback
        // matters: the woff2 may not have finished loading when these are
        // baked, and a missing font must degrade to the wrong monospace rather
        // than to no feedback at all.
        fontFamily: 'Departure Mono, monospace',
        fontSize: size,
        fill: colour,
        // An outline, not a shadow: the numeral flies over a lit monitor and a
        // red Slack web, and it has to stay legible against both.
        stroke: { color: c(RAMPS.NEUTRAL[0]), width: strokeWidth },
      },
    })
    const texture = renderer.generateTexture(text)
    text.destroy()
    owned.push(texture)
    return texture
  }

  // Pre-bake the digit set at both sizes and all three colours. That is
  // 17 glyphs x 2 sizes x 3 colours = 102 small textures, paid once at startup
  // and never on a tap.
  for (const size of [NUMERAL_SIZE, CRIT_SIZE]) {
    for (const colour of [c(RAMPS.CALM[2]), c(RAMPS.CALM[3]), c(RAMPS.ALARM[2])]) {
      for (const glyph of GLYPHS) {
        glyphs.set(`${size}:${colour}:${glyph}`, bake(glyph, size, colour, 4))
      }
    }
  }

  // §8.2a — every line in the product, baked once. The set is fixed and small,
  // which is precisely why the snippets are authored as a list rather than
  // generated.
  for (const line of ALL_SNIPPETS) {
    snippets.set(line, bake(line, SNIPPET_SIZE, c(RAMPS.GLOW[2]), 3))
  }

  /** `+8`, `-2`, `+1.2M` — short forms only; a floater is not a readout. */
  function format(sp: number): string {
    const sign = sp < 0 ? '-' : '+'
    const n = Math.abs(sp)
    if (n >= 1e12) return `${sign}${(n / 1e12).toFixed(1)}T`
    if (n >= 1e9) return `${sign}${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `${sign}${(n / 1e6).toFixed(1)}M`
    if (n >= 1e4) return `${sign}${(n / 1e3).toFixed(0)}K`
    // Below ten, round to a decimal rather than to an integer. `Math.round`
    // turned every fractional yield into `+0` — a floater announcing that
    // nothing happened while the simulation banked the points, which is the
    // one thing a feedback numeral must never do.
    if (n >= 10) return `${sign}${Math.round(n)}`
    if (n >= 1) return `${sign}${n.toFixed(1).replace(/\.0$/, '')}`
    return `${sign}${n.toFixed(2)}`
  }

  return {
    build(sp, crit, snippet, unblocked = false, sequence = 0) {
      const root = new Container()
      const size = crit ? CRIT_SIZE : NUMERAL_SIZE
      const colour = unblocked ? c(RAMPS.WARN[2]) : numeralColour(sp, crit)
      const offsets = pokeTextOffsets(size, sequence)

      // §25.1, R11 — an Overwhelmed developer pays nothing and that is the
      // design (§4.7). So the floater reports what the poke **achieved**
      // instead of what it paid: `+0` announces that nothing happened, which
      // is the one thing a feedback numeral must never do.
      //
      // WARN amber rather than the CALM phosphor of a points numeral, because
      // it is a different kind of event and the player should be able to tell
      // at a glance without reading it.
      let width = 0
      const numeral: Sprite[] = []
      for (const glyph of unblocked ? 'UNBLOCKED' : format(sp)) {
        const texture = glyphs.get(`${size}:${colour}:${glyph}`)
        // A glyph outside GLYPHS would be a formatting bug rather than a
        // reason to drop the whole numeral, so it is skipped silently.
        if (!texture) continue
        const sprite = new Sprite(texture)
        sprite.x = width
        sprite.y = offsets.numeralY
        root.addChild(sprite)
        numeral.push(sprite)
        width += texture.width - size * 0.28 // tighten the outline padding
      }
      // Both rows use the lane centre. A longer number stays attached to the
      // same hit point instead of walking sideways as it gains digits.
      const numeralLeft = offsets.numeralX - width / 2
      for (const sprite of numeral) sprite.x += numeralLeft

      // §8.2a. Null for an Overwhelmed developer, who has nothing to say — and
      // that silence is the joke, so it must not be filled with a default.
      if (snippet) {
        const texture = snippets.get(snippet)
        if (texture) {
          const line = new Sprite(texture)
          // One compact two-line callout. No independent jitter: the snippet
          // stays registered to the numeral for the whole rise and fade.
          line.x = offsets.snippetX - texture.width / 2
          line.y = offsets.snippetY
          line.alpha = 0.85
          root.addChild(line)
        }
      }

      return root
    },

    destroy() {
      for (const texture of owned) texture.destroy(true)
      glyphs.clear()
      snippets.clear()
      owned.length = 0
    },
  }
}
