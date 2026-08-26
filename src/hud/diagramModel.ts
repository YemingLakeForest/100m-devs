/**
 * Board geometry — turning §11.4.1's cell paths into a UML class diagram.
 *
 * The `sim/` boards say where things are in **cells** and refuse to know
 * anything else: `connectorPath` returns two or three grid points and
 * `heroBoardBounds` returns an extent. That is the right division and this file
 * is the other half of it — everything about the *picture* that the simulation
 * must not be allowed to learn.
 *
 * ## What the pixels have to do that the cells do not
 *
 * A skill-tree node is a 58 px square and a line to its centre is invisible
 * under it, so the old boards drew centre-to-centre and let the node cover the
 * overlap. A UML class box is 138 px wide with a name in it, and the notation
 * it is drawn in has a **direction**: the connector has to stop at the border
 * and hand over to an arrowhead, or the diagram is a set of boxes with lines
 * behind them rather than a generalisation hierarchy.
 *
 * So three things happen here and nowhere else:
 *
 * - **Trimming.** Both ends of every path retreat to their box's border, along
 *   the axis the last segment runs on. Boxes are axis-aligned and the paths are
 *   right-angled (§11.4.1), so this is an offset rather than a line-rectangle
 *   intersection — the one simplification the "right angles only" rule buys.
 * - **The arrowhead.** A hollow triangle at the child end, apex on the border,
 *   base back along the segment. UML generalisation, pointing the way the board
 *   grows.
 * - **Junctions.** A dot wherever two connectors turn at the same point, which
 *   on §13.9's board is the fork Support and Cloud share on the way south. A
 *   fork that is not marked reads as two lines crossing, and nothing on these
 *   boards ever crosses.
 *
 * Pure — no React, no DOM, no store.
 */

/** A point, in whatever unit the caller is working in. */
export interface Point {
  x: number
  y: number
}

/** Cell size and where cell (0, 0) sits, in cells from the world's top-left. */
export interface BoardMetrics {
  cellX: number
  cellY: number
  originX: number
  originY: number
  nodeW: number
  nodeH: number
}

/** How far back from the border the arrowhead's base sits, in px. */
export const ARROW_LENGTH = 11

/** Half the arrowhead's base, in px. */
export const ARROW_HALF_WIDTH = 6

export function toPixels(cell: Point, m: BoardMetrics): Point {
  return { x: (cell.x + m.originX) * m.cellX, y: (cell.y + m.originY) * m.cellY }
}

/** Half the box, along whichever axis a segment approaches on. */
function inset(from: Point, to: Point, m: BoardMetrics): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  // A segment is axis-aligned by construction (§11.4.1), so exactly one of
  // these is non-zero — except for a degenerate zero-length path, which returns
  // the point unmoved rather than dividing by zero.
  if (dx === 0 && dy === 0) return to
  if (Math.abs(dx) >= Math.abs(dy)) {
    const half = m.nodeW / 2
    return { x: to.x - Math.sign(dx) * half, y: to.y }
  }
  const half = m.nodeH / 2
  return { x: to.x, y: to.y - Math.sign(dy) * half }
}

/** Step `distance` px back from `to` toward `from`. */
function retreat(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (!(len > 0)) return to
  return { x: to.x - (dx / len) * distance, y: to.y - (dy / len) * distance }
}

export interface Connector {
  /** `points` for a `<polyline>`, in px. */
  line: string
  /** `points` for the arrowhead `<polygon>`, in px. Empty for a degenerate path. */
  arrow: string
}

/**
 * One connector, trimmed to both boxes and tipped with a generalisation arrow.
 *
 * The line stops at the arrowhead's *base* rather than at the border, so the
 * hollow triangle is genuinely hollow: a line run all the way to the apex shows
 * through the interior and turns the shape into a filled arrow, which in UML is
 * a different relationship entirely.
 */
export function connector(path: readonly Point[], m: BoardMetrics): Connector {
  if (path.length < 2) return { line: '', arrow: '' }

  const px = path.map((p) => toPixels(p, m))
  const start = inset(px[1], px[0], m)
  const border = inset(px[px.length - 2], px[px.length - 1], m)
  const base = retreat(px[px.length - 2], border, ARROW_LENGTH)

  const middle = px.slice(1, -1)
  const line = [start, ...middle, base].map((p) => `${round(p.x)},${round(p.y)}`).join(' ')

  // The base's two corners, square to the segment the arrow arrives on.
  const dx = border.x - base.x
  const dy = border.y - base.y
  const len = Math.hypot(dx, dy)
  if (!(len > 0)) return { line, arrow: '' }
  const nx = (-dy / len) * ARROW_HALF_WIDTH
  const ny = (dx / len) * ARROW_HALF_WIDTH
  const arrow = [
    { x: border.x, y: border.y },
    { x: base.x + nx, y: base.y + ny },
    { x: base.x - nx, y: base.y - ny },
  ]
    .map((p) => `${round(p.x)},${round(p.y)}`)
    .join(' ')

  return { line, arrow }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Where two or more connectors turn at the same point — §Gliffy's fork dot.
 *
 * Only *elbows* count, not endpoints. Every chain begins at the same trunk, and
 * a dot on the trunk would be a dot underneath a box: the fork worth drawing is
 * the one in open space, where two branches genuinely part company.
 */
export function junctions(paths: ReadonlyArray<readonly Point[]>, m: BoardMetrics): Point[] {
  const seen = new Map<string, number>()
  for (const path of paths) {
    for (const bend of path.slice(1, -1)) {
      const key = `${bend.x},${bend.y}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
  }
  const out: Point[] = []
  for (const [key, count] of seen) {
    if (count < 2) continue
    const [x, y] = key.split(',').map(Number)
    out.push(toPixels({ x, y }, m))
  }
  return out
}

/**
 * The pannable world's size in px, and where cell (0, 0) lands inside it.
 *
 * `pad` is in cells and is deliberately generous: a class box is drawn from its
 * centre, so a node on the extreme edge of the bounds hangs half its width off
 * the world without it, and the outermost node of every chain is exactly that
 * node.
 */
export function worldFor(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  cellX: number,
  cellY: number,
  nodeW: number,
  nodeH: number,
  pad = 1,
): BoardMetrics & { width: number; height: number } {
  const originX = pad - bounds.minX
  const originY = pad - bounds.minY
  return {
    cellX,
    cellY,
    originX,
    originY,
    nodeW,
    nodeH,
    width: (bounds.maxX - bounds.minX + pad * 2 + 1) * cellX,
    height: (bounds.maxY - bounds.minY + pad * 2 + 1) * cellY,
  }
}
