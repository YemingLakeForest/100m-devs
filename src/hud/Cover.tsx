/**
 * The generated cover tile — GDD §10.11.3.
 *
 * A 48×48 square drawn in code from a {@link CoverSpec}. The spec is the
 * grammar (`sim/cover.ts`); this file is the drawing. It maps the spec's
 * *indices* to palette colours — the accent and the rating frame — because
 * ART_DIRECTION §4 keeps the palette the renderer's business, the same
 * contract §7.8.7's part tables follow.
 *
 * Every shape is an axis-aligned rectangle on the integer grid, rendered with
 * `shape-rendering="crispEdges"`, so nothing here anti-aliases: ART_DIRECTION
 * §3 rule 1 forbids a smooth curve beside a hard pixel edge, and a cover is
 * nothing but hard edges. The rating band tints the frame (§10.11.3), the
 * accent colours the glyph, and the seed rolls the layout and pattern.
 */

import type { CoverSpec, Glyph } from '../sim/cover.ts'
import { RAMPS } from '../art/palette.ts'
import '../styles/cover.css'

const SIZE = 48
/** Frame thickness, in pixels. The rating tint lives on this border. */
const FRAME = 2

/** The very dark backdrop every cover sits on. */
const BG = RAMPS.NEUTRAL[0]
/** The subtle neutral the background pattern is drawn in. */
const PATTERN_INK = RAMPS.NEUTRAL[2]

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
 * The genre accents, `[light, dark]` per index. The light is the glyph's ink,
 * the dark is unused here but kept so the pair is one decision in one place.
 */
const ACCENT_INK: ReadonlyArray<readonly [string, string]> = [
  [RAMPS.GLOW[2], RAMPS.GLOW[0]], // 0 cyan
  [RAMPS.WARN[2], RAMPS.WARN[0]], // 1 gold
  [RAMPS.FOLIAGE[1], RAMPS.FOLIAGE[0]], // 2 green
  [RAMPS.ALARM[2], RAMPS.ALARM[0]], // 3 red
  [RAMPS.RARITY[0], RAMPS.NEUTRAL[1]], // 4 violet
  [RAMPS.WOOD[3], RAMPS.WOOD[0]], // 5 brown
]

/**
 * One glyph = one 8×8 grid of `#` cells. Authored here rather than as assets
 * (§10.11.3's "a die, a sword, a rocket, a spreadsheet"), and read back as
 * rectangles so the drawing is a table walk rather than a pixel editor.
 */
const GLYPH_MAP: Record<Glyph, readonly string[]> = {
  rocket: [
    '....#...',
    '...###..',
    '..#####.',
    '..#####.',
    '..#####.',
    '...###..',
    '..##.##.',
    '.#....#.',
  ],
  die: [
    '........',
    '.######.',
    '#.#..#.#',
    '#......#',
    '#...#...#',
    '#......#',
    '#.#..#.#',
    '.######.',
  ],
  sword: [
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '..####..',
    '...##...',
    '...##...',
  ],
  spreadsheet: [
    '.######.',
    '#.#####.',
    '#.#....#',
    '#.#####.',
    '#.#....#',
    '#.#....#',
    '#.#####.',
    '.######.',
  ],
  castle: [
    '.#..#.#.',
    '.#..#.#.',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
  ],
  gear: [
    '.##.##..',
    '#.##.##.',
    '########',
    '.######.',
    '.######.',
    '########',
    '#.##.##.',
    '.##.##..',
  ],
  heart: [
    '..##.##.',
    '.######.',
    '.######.',
    '.######.',
    '..####..',
    '...##...',
    '........',
    '........',
  ],
  pixel: [
    '###.....',
    '#.##....',
    '#..##...',
    '#...##..',
    '#....##.',
    '#.....##',
    '########',
    '########',
  ],
}

/**
 * §10.11.3's layout — where the glyph sits, how large, and whether the title's
 * dashes appear. Four variants, all on the integer grid, none scaling.
 */
const LAYOUTS: ReadonlyArray<{ cell: number; x: number; y: number; title: boolean }> = [
  { cell: 5, x: 4, y: 4, title: false },
  { cell: 4, x: 8, y: 8, title: true },
  { cell: 4, x: 3, y: 12, title: false },
  { cell: 4, x: 12, y: 5, title: false },
]

function glyphCells(glyph: Glyph): Array<{ x: number; y: number }> {
  const rows = GLYPH_MAP[glyph]
  const cells: Array<{ x: number; y: number }> = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') cells.push({ x, y })
    }
  })
  return cells
}

/**
 * The background pattern, 0..3. Kept dim — the glyph and the frame are the
 * cover's voice, and a loud backdrop would fight both.
 */
function patternRects(pattern: number): Array<{ x: number; y: number; w: number; h: number }> {
  switch (pattern) {
    case 1: {
      // Horizontal bands.
      const out: Array<{ x: number; y: number; w: number; h: number }> = []
      for (let y = FRAME + 2; y < SIZE - FRAME; y += 12) out.push({ x: FRAME, y, w: SIZE - FRAME * 2, h: 2 })
      return out
    }
    case 2: {
      // Checkerboard over the interior.
      const cell = 11
      const out: Array<{ x: number; y: number; w: number; h: number }> = []
      for (let gy = 0; gy < 4; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          if ((gx + gy) % 2 === 0) out.push({ x: FRAME + gx * cell, y: FRAME + gy * cell, w: cell, h: cell })
        }
      }
      return out
    }
    case 3: {
      // An inset outline, like the spine of a box.
      const t = 1
      const inset = 6
      return [
        { x: inset, y: inset, w: SIZE - inset * 2, h: t },
        { x: inset, y: SIZE - inset - t, w: SIZE - inset * 2, h: t },
        { x: inset, y: inset, w: t, h: SIZE - inset * 2 },
        { x: SIZE - inset - t, y: inset, w: t, h: SIZE - inset * 2 },
      ]
    }
    default:
      return []
  }
}

/** §10.11.3's "title lettering at that size is dashes" — a row of short marks. */
function titleDashes(): Array<{ x: number; y: number; w: number; h: number }> {
  const out: Array<{ x: number; y: number; w: number; h: number }> = []
  for (let i = 0; i < 5; i++) out.push({ x: 4 + i * 9, y: 4, w: 5, h: 2 })
  return out
}

export function Cover({ spec }: { spec: CoverSpec }) {
  const layout = LAYOUTS[spec.layout % LAYOUTS.length]
  const ink = ACCENT_INK[spec.accent % ACCENT_INK.length]
  const frame = FRAME_INK[spec.band % FRAME_INK.length]

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
      <rect
        className="cover__bg"
        x={FRAME}
        y={FRAME}
        width={SIZE - FRAME * 2}
        height={SIZE - FRAME * 2}
        fill={BG}
      />
      {patternRects(spec.pattern).map((r, i) => (
        <rect
          key={`p${i}`}
          className="cover__pattern"
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill={PATTERN_INK}
        />
      ))}
      {layout.title &&
        titleDashes().map((r, i) => (
          <rect key={`t${i}`} className="cover__title" x={r.x} y={r.y} width={r.w} height={r.h} fill={ink[0]} />
        ))}
      {glyphCells(spec.glyph).map((c, i) => (
        <rect
          key={`g${i}`}
          className="cover__glyph"
          x={layout.x + c.x * layout.cell}
          y={layout.y + c.y * layout.cell}
          width={layout.cell}
          height={layout.cell}
          fill={ink[0]}
        />
      ))}
    </svg>
  )
}
