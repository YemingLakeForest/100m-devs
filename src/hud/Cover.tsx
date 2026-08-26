/**
 * The generated cover tile — GDD §10.11.3.
 *
 * A 48×48 square drawn in code from a {@link CoverSpec}. The spec is the
 * grammar (`sim/cover.ts`), `render/coverArt.ts` is the key art, and this file
 * is the **composition** — which is the part that decides whether it reads as a
 * game cover or as an icon on a field.
 *
 * ## What a cover is, as opposed to a logo
 *
 * The first pass drew one flat silhouette in the middle of a patterned square,
 * and it read as random pixel blocks because that is what it was. A cover is
 * not a mark on a background. It is a **scene with a subject in it and a title
 * plate under it**, and the four things that carry that are always the same:
 *
 * 1. **A sky** — banded, so the tile has a top and a bottom before anything is
 *    drawn on it. Flat backdrops are what make pixel art read as clip art.
 * 2. **A ground** the subject stands on, in half the compositions. Something to
 *    stand on is the single cheapest cue that a shape is *in* a picture.
 * 3. **The subject**, two-toned, at 16×16 and two pixels a cell — see
 *    `coverArt.ts` for why the resolution and the second tone are the fix.
 * 4. **A title plate** — a solid bar with dash-lettering. §10.11.3 already
 *    said "title lettering at that size is dashes"; what it did not have was
 *    anywhere for the lettering to *sit*. A plate is what turns four marks into
 *    a logo.
 *
 * `spec.layout` picks between four arrangements of those and `spec.pattern`
 * picks what the sky is doing, so the same genre never comes back looking like
 * the same box.
 *
 * Every shape is an axis-aligned rectangle on the integer grid, rendered with
 * `shape-rendering="crispEdges"`, so nothing here anti-aliases: ART_DIRECTION
 * §3 rule 1 forbids a smooth curve beside a hard pixel edge. Colours are the
 * renderer's business (ART_DIRECTION §4), the same contract §7.8.7's part
 * tables follow — the spec carries indices and this file resolves them.
 */

import type { CoverSpec } from '../sim/cover.ts'
import { RAMPS } from '../art/palette.ts'
import { COVER_SPRITES, spriteCells } from '../render/coverArt.ts'
import '../styles/cover.css'

const SIZE = 48
/** Frame thickness, in pixels. The rating tint lives on this border. */
const FRAME = 2
/** The drawable interior, inside the frame. */
const IN = FRAME
const SPAN = SIZE - FRAME * 2
/** Pixels per sprite cell. 16 × 2 = 32, two thirds of the interior. */
const CELL = 2

/** The very dark backdrop every cover sits on. */
const BG = RAMPS.NEUTRAL[0]

/**
 * §10.11.3's frame ramp, band 0..3. All palette entries, so a wall of covers
 * reads as a quality history without introducing a colour outside §2.2: dim
 * grey, plain steel, gold, cyan.
 */
const FRAME_INK = [
  RAMPS.NEUTRAL[2],
  RAMPS.NEUTRAL[4],
  RAMPS.WARN[2],
  RAMPS.CALM[2],
] as const

/**
 * The genre accents, `[light, dark]` per index.
 *
 * **Both halves are used now.** The light is the subject's lit face and the
 * dark is its shade — the pair that made the art stop reading as a symbol. The
 * dark also tints the sky, which is what ties a cover to its genre at a glance
 * across a wall of them.
 */
const ACCENT_INK: ReadonlyArray<readonly [string, string]> = [
  [RAMPS.GLOW[2], RAMPS.GLOW[0]], // 0 cyan
  [RAMPS.WARN[2], RAMPS.WARN[0]], // 1 gold
  [RAMPS.FOLIAGE[1], RAMPS.FOLIAGE[0]], // 2 green
  [RAMPS.ALARM[2], RAMPS.ALARM[0]], // 3 red
  [RAMPS.RARITY[0], RAMPS.NEUTRAL[1]], // 4 violet
  [RAMPS.WOOD[3], RAMPS.WOOD[0]], // 5 brown
]

interface Rect {
  x: number
  y: number
  w: number
  h: number
  fill: string
}

/**
 * §10.11.3's four compositions.
 *
 * `art` is where the sprite's *bounding box* is placed, so a subject with empty
 * rows under it still stands on the ground rather than floating above it. `sky`
 * and `ground` split the tile; `plate` is the title bar.
 */
interface Composition {
  /** Where the horizon sits, as a fraction of the interior. 1 means no ground. */
  horizon: number
  /** The title plate's band, in interior pixels from the top. */
  plateY: number
  plateH: number
  /** Where the art's baseline sits, in interior pixels from the top. */
  baseline: number
  /** Nudge the art off centre, in interior pixels. */
  offsetX: number
  /** A drawn inner border, the way a boxed game has one. */
  inner: boolean
}

const COMPOSITIONS: readonly Composition[] = [
  // 0 — portrait. Subject centred, title along the bottom.
  { horizon: 1, plateY: 33, plateH: 9, baseline: 32, offsetX: 0, inner: false },
  // 1 — landscape. Horizon two thirds down, subject standing on it, title on top.
  { horizon: 0.66, plateY: 1, plateH: 8, baseline: 30, offsetX: 0, inner: false },
  // 2 — emblem. An inner rule, subject inside it, title under the box.
  { horizon: 1, plateY: 35, plateH: 8, baseline: 32, offsetX: 0, inner: true },
  // 3 — split. Subject pushed right, the title stacked down the left.
  { horizon: 0.78, plateY: 4, plateH: 8, baseline: 34, offsetX: 6, inner: false },
]

/**
 * The sky — §10.11.3's pattern roll, and the reason a tile has a top.
 *
 * Every variant is horizontal or vertical bands of the genre's *dark* accent
 * over the neutral backdrop, so it never competes with the subject drawn in the
 * light one. A backdrop that can be read as a shape is a backdrop fighting the
 * art.
 */
function skyRects(pattern: number, dark: string, height: number): Rect[] {
  const out: Rect[] = []
  switch (pattern) {
    case 1: {
      // Bands, densest at the horizon — the cheapest sky there is.
      for (let i = 0; i < 5; i += 1) {
        const y = IN + Math.round((height * (i + 1)) / 6)
        out.push({ x: IN, y, w: SPAN, h: 1 + (i % 2), fill: dark })
      }
      return out
    }
    case 2: {
      // Stars. Fixed positions rather than rolled: the roll that chose this
      // pattern has already done its work, and a second roll inside a renderer
      // is a cover that changes when nothing about the release did.
      const stars = [
        [6, 5], [14, 9], [22, 4], [30, 8], [38, 6],
        [10, 14], [26, 13], [34, 16], [18, 18], [42, 12],
      ]
      for (const [x, y] of stars) {
        if (y > IN + height) continue
        out.push({ x, y, w: 2, h: 2, fill: dark })
      }
      return out
    }
    case 3: {
      // Vertical columns — a skyline, or a stage.
      for (let x = IN + 3; x < IN + SPAN - 2; x += 7) {
        out.push({ x, y: IN, w: 2, h: height, fill: dark })
      }
      return out
    }
    default:
      // A single wash across the upper half. Plain, and the one that lets a
      // busy sprite be the only thing on the tile.
      out.push({ x: IN, y: IN, w: SPAN, h: Math.round(height * 0.55), fill: dark })
      return out
  }
}

/**
 * §10.11.3's "title lettering at that size is dashes" — now with a plate.
 *
 * Two rows of marks of uneven length, because a title is words and words are
 * not all the same size. Even dashes read as a progress bar.
 */
function titleRects(comp: Composition, light: string, dark: string): Rect[] {
  const out: Rect[] = []
  if (comp.offsetX > 0) {
    // Split composition — the title stacks down the left column.
    const widths = [9, 7, 10, 5]
    widths.forEach((w, i) => {
      out.push({ x: IN + 2, y: comp.plateY + i * 4, w, h: 2, fill: i === 0 ? light : dark })
    })
    return out
  }

  out.push({ x: IN, y: comp.plateY, w: SPAN, h: comp.plateH, fill: BG })
  out.push({ x: IN, y: comp.plateY, w: SPAN, h: 1, fill: dark })

  const top = [10, 6, 13]
  let x = IN + 3
  for (const w of top) {
    out.push({ x, y: comp.plateY + 3, w, h: 3, fill: light })
    x += w + 3
  }
  return out
}

export function Cover({ spec }: { spec: CoverSpec }) {
  const comp = COMPOSITIONS[spec.layout % COMPOSITIONS.length]
  const [light, dark] = ACCENT_INK[spec.accent % ACCENT_INK.length]
  const frame = FRAME_INK[spec.band % FRAME_INK.length]
  const sprite = COVER_SPRITES[spec.glyph] ?? COVER_SPRITES.pixel
  const art = spriteCells(sprite)

  const skyHeight = Math.round(SPAN * comp.horizon)
  const rects: Rect[] = [...skyRects(spec.pattern, dark, skyHeight)]

  // The ground, when there is one. A solid slab with a lit lip, which is what
  // makes it read as a surface rather than as a second sky.
  if (comp.horizon < 1) {
    const y = IN + skyHeight
    rects.push({ x: IN, y, w: SPAN, h: SPAN - skyHeight, fill: RAMPS.NEUTRAL[1] })
    rects.push({ x: IN, y, w: SPAN, h: 1, fill: dark })
  }

  if (comp.inner) {
    const inset = 5
    const x = IN + inset
    const y = IN + inset
    const w = SPAN - inset * 2
    const h = SPAN - inset * 2 - 8
    rects.push({ x, y, w, h: 1, fill: dark })
    rects.push({ x, y: y + h - 1, w, h: 1, fill: dark })
    rects.push({ x, y, w: 1, h, fill: dark })
    rects.push({ x: x + w - 1, y, w: 1, h, fill: dark })
  }

  rects.push(...titleRects(comp, light, dark))

  // The art's own box, placed by its baseline so a sprite with empty rows below
  // it still stands on the ground rather than hovering over it.
  const artX = IN + Math.round((SPAN - art.width * CELL) / 2) + comp.offsetX
  const artY = IN + comp.baseline - art.height * CELL

  return (
    <svg
      className="cover"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden="true"
      role="img"
    >
      {/* The frame is the rating tint (§10.11.3) — drawn full-tile, then the
          background sits inside it, so the border reads as a solid band. */}
      <rect className="cover__frame" x={0} y={0} width={SIZE} height={SIZE} fill={frame} />
      <rect className="cover__bg" x={IN} y={IN} width={SPAN} height={SPAN} fill={BG} />
      {rects.map((r, i) => (
        <rect
          key={`s${i}`}
          className="cover__scene"
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={r.fill}
        />
      ))}
      {art.cells.map((c, i) => (
        <rect
          key={`g${i}`}
          className="cover__glyph"
          x={artX + (c.x - art.minX) * CELL}
          y={artY + (c.y - art.minY) * CELL}
          width={CELL}
          height={CELL}
          fill={c.lit ? light : dark}
        />
      ))}
    </svg>
  )
}
