import { RAMPS } from '../../art/palette.ts'

const N = RAMPS.NEUTRAL, A = RAMPS.WARN

/**
 * **The roll-up door's glyph** — the HQ's mark on every map [2026-10-11, demo; GDD §7.8.12's
 * *"what never changes is short: the roll-up door's silhouette"*, canon since 2026-10-04 and never drawn].
 *
 * The survey marked the HQ with a box that said `HQ` and the network marked Sol with a ring, so the one
 * place the game began had no picture past the block. This is its picture: a gabled garage, a shuttered
 * door, and a lamp that stays on. It is nine map pixels wide at *every* scale — it does not grow with the
 * studio, which is the joke: a hundred million developers and the founder is still in the garage. What
 * grows is the frame round it (`hqMarker`'s borders and crown), and that was always the right thing to grow.
 *
 * `#` is the ink the caller is drawing in (the live phosphor), `=` the door's slats, `L` the lamp.
 */
export const GARAGE_GLYPH = [
  '....#....',
  '...###...',
  '..#####..',
  '.#######.',
  '.#=====#.',
  '.#=L===#.',
] as const

export const GARAGE_GLYPH_W = GARAGE_GLYPH[0].length
export const GARAGE_GLYPH_H = GARAGE_GLYPH.length

/**
 * The lamp's phase. A lamp that blinks like a beacon is a different joke; this is a desk lamp drawing
 * a breath, once every couple of seconds. With reduced motion it simply stays on: it is on.
 */
export function lampLit(seconds: number, reduced: boolean): boolean {
  return reduced || Math.floor(seconds * 0.8) % 2 === 0
}

/** Draw the glyph centred on (`cx`, `cy`), on the map's own pixel grid, in `ink`. */
export function drawGarageGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, ink: string, lit: boolean): void {
  const x0 = Math.round(cx - GARAGE_GLYPH_W / 2), y0 = Math.round(cy - GARAGE_GLYPH_H / 2)
  GARAGE_GLYPH.forEach((row, j) => {
    for (let i = 0; i < GARAGE_GLYPH_W; i++) {
      const c = row[i]
      if (c === '.') continue
      ctx.fillStyle = c === '#' ? ink : c === '=' ? N[4] : lit ? A[3] : N[3]
      ctx.fillRect(x0 + i, y0 + j, 1, 1)
    }
  })
}
