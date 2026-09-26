/**
 * A release's cover — GDD §10.11.3, drawn [replaced 2026-09-26].
 *
 * *"Also the art and name generation on the new game should be ported."* This
 * build's covers were one sprite per project type on a banded swatch with a
 * dash-lettered plate (`render/coverArt.ts`, now deleted). The rebuild's are a
 * 32 × 32 painting per release — a genre subject, a scene, a ground and a
 * horizon, rolled from `(seed, ordinal)` by `three/sim/cover.ts` and painted by
 * `three/art/coverPixels.ts` — and they are what the gallery, the reel and the
 * release ring now show. The genre comes from the title (`three/sim/titles.ts`),
 * so *Velvet Dungeon* is a roguelike on its box before anyone reads the name.
 *
 * `shape-rendering: crispEdges` on an SVG of run-length rectangles scales the
 * bitmap to any size with hard pixel edges and no resampling, so the same
 * picture is 33 px on the ring and fills the wall's slot with no canvas and no
 * cache (ART_DIRECTION §3 rule 1). The bitmap is memoised on the spec's key,
 * because the HUD re-renders several times a second.
 *
 * **The rating tints the frame and nothing else** (§10.5): a wall of covers
 * reads as a quality history before a number is read, and the art of a game is
 * the same art whatever it scored. The frame keeps this build's ramp — dim
 * grey, plain steel, gold, cyan — so it stays on §2.2's palette.
 */

import { useMemo } from 'react'

import { RAMPS } from '../art/palette.ts'
import { COVER_SIZE, paintCover, runsOf } from '../three/art/coverPixels.ts'
import { coverKey, type CoverSpec } from '../three/sim/cover.ts'

import '../styles/cover.css'

/** §10.11.3's frame ramp, band 0..3. */
const FRAME_INK = [RAMPS.NEUTRAL[2], RAMPS.NEUTRAL[4], RAMPS.WARN[2], RAMPS.CALM[2]] as const

/**
 * `unrated` — the box before the game is in it. The ring carries the cover of
 * a game nobody has reviewed, so its frame steps out of the rating ramp and
 * becomes the interface's own hairline, in the live phosphor: reusing band 0
 * would tell the player their game was shovelware before anyone had played it.
 */
export function Cover({ spec, title = '', unrated = false }: { spec: CoverSpec; title?: string; unrated?: boolean }) {
  const key = coverKey(spec)
  // Keyed on the spec's fields rather than its identity: callers hand over a
  // fresh object on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runs = useMemo(() => runsOf(paintCover(spec)), [key])
  const n = COVER_SIZE

  return (
    <svg
      className="cover"
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title ? `Cover for ${title}` : undefined}
      aria-hidden={title ? undefined : true}
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.colour} />
      ))}
      {/* The frame is the score, drawn last, one cell wide and inset by half
          its width so it sits on the cover rather than outside it. */}
      <rect
        className="cover__frame"
        x="0.5"
        y="0.5"
        width={n - 1}
        height={n - 1}
        fill="none"
        strokeWidth="1"
        style={{ stroke: unrated ? 'var(--p1)' : FRAME_INK[Math.min(FRAME_INK.length - 1, Math.max(0, spec.band))] }}
      />
    </svg>
  )
}
