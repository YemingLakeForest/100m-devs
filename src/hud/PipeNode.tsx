/**
 * One job in a pipeline run — the node GitLab draws as a coloured circle with an
 * icon in it, redrawn in this game's pixels.
 *
 * Shared by the top strip's chips and the queue window's graph so a stage reads
 * the same size and shape in both, and so there is one place that knows what
 * each state *looks* like:
 *
 *  - `pending` — hollow. Nothing has started.
 *  - `run`     — a stepped spinner. This is the stage the build is in.
 *  - `wait`    — a bang, dimmed. Parked behind another build's stage.
 *  - `pass`    — a tick, solid. Done.
 *  - `ready`   — a gold arrow that bobs. Waiting for SHIP!
 *
 * State is said by **shape first** (ART_DIRECTION §2.2's one-hue rule, and so a
 * node reads without colour); colour only reinforces it. The node is keyed on
 * its state by the parent so a change *remounts* it, and the pop animation is
 * simply its mount animation — no timers, no state.
 */

import type { NodeState } from './pipeJobs.ts'

/** Pixel art on a 7 by 7 grid; each pair is an `[x, y]` cell. */
const GLYPHS: Record<'pass' | 'wait' | 'ready', readonly (readonly [number, number])[]> = {
  pass: [[0, 3], [1, 4], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]],
  wait: [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 6]],
  ready: [[3, 0], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [2, 5], [3, 5], [4, 5]],
}

export function PipeNode({ state, label }: { state: NodeState; label?: string }) {
  const glyph = state === 'pass' || state === 'wait' || state === 'ready' ? GLYPHS[state] : null
  return (
    <span className="pnode" data-state={state} title={label} aria-hidden="true">
      {glyph ? (
        <svg viewBox="0 0 7 7" shapeRendering="crispEdges">
          {glyph.map(([x, y]) => (
            <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} />
          ))}
        </svg>
      ) : null}
    </span>
  )
}
