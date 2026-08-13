/**
 * §11.4.4 — one procedural pixel icon per tech node.
 *
 * ART_DIRECTION §3.1 T0: geometry from the §2 palette on the integer grid,
 * drawn in code, no emoji anywhere near it. A node's icon is a picture of the
 * *thing*, not of its category — Instant Messenger is a speech bubble with a
 * lightning bolt through it, Daily Standups is three figures and a clock.
 *
 * An icon is a **mask**, not a picture: a 16×16 grid of filled-or-empty cells.
 * Colour and outline state are the renderer's business (§11.4.4's three
 * renderings — outline, filled, flash — are one grid, recoloured). Kept as data
 * rather than Pixi or SVG so a test can pin that every node has an icon and
 * none of them is blank.
 */

type Pt = readonly [number, number]

function build(pts: Iterable<Pt>): readonly string[] {
  const grid: string[][] = Array.from({ length: 16 }, () => Array(16).fill('.'))
  for (const [x, y] of pts) {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) grid[y][x] = '#'
  }
  return grid.map((row) => row.join(''))
}

/** Axis-aligned filled rectangle, inclusive of both ends. */
function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const out: Pt[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y])
  return out
}

/** The outline of a rectangle — the four edges only. */
function frame(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const out: Pt[] = []
  for (let x = x0; x <= x1; x++) {
    out.push([x, y0], [x, y1])
  }
  for (let y = y0 + 1; y < y1; y++) out.push([x0, y], [x1, y])
  return out
}

function line(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const out: Pt[] = []
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  for (let i = 0; i <= steps; i++) {
    out.push([Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)])
  }
  return out
}

function disc(cx: number, cy: number, r: number): Pt[] {
  const out: Pt[] = []
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) out.push([cx + x, cy + y])
    }
  }
  return out
}

/** Pairs of `x, y`, for a handful of one-off points. */
function pts(...xy: number[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i + 1 < xy.length; i += 2) out.push([xy[i], xy[i + 1]])
  return out
}

/** A stick figure, head at top, facing out. */
function figure(px: number, py: number): Pt[] {
  return [
    ...disc(px, py, 2),
    ...line(px, py + 2, px, py + 7),
    ...line(px - 3, py + 4, px + 3, py + 4),
    ...line(px, py + 7, px - 2, py + 11),
    ...line(px, py + 7, px + 2, py + 11),
  ]
}

const ICONS: Record<string, readonly string[]> = {
  // §11.5 — a speech bubble with a lightning bolt through it.
  B1: build([
    ...frame(2, 2, 13, 10),
    ...pts(3, 1, 4, 1, 11, 1, 12, 1),
    ...pts(5, 11, 8, 11, 9, 11),
    ...line(7, 3, 5, 9),
    ...line(5, 9, 8, 9),
    ...line(8, 9, 6, 3),
    ...line(6, 3, 7, 3),
  ]),
  // §11.2 B2 — three figures in front of a clock face.
  B2: build([
    ...disc(12, 4, 2),
    ...frame(9, 1, 15, 7),
    ...line(12, 4, 12, 2),
    ...line(12, 4, 13, 5),
    ...figure(2, 4),
    ...figure(5, 4),
    ...figure(8, 4),
  ]),
  // §11.2 B3 — two figures, one keyboard between them.
  B3: build([
    ...figure(3, 3),
    ...figure(12, 3),
    ...rect(6, 9, 11, 12),
    ...line(3, 12, 6, 11),
    ...line(12, 12, 9, 11),
  ]),
  // §11.2 B4 — a stack of tickets, deep enough to be a joke.
  B4: build([
    ...frame(3, 2, 13, 4),
    ...frame(3, 5, 13, 7),
    ...frame(3, 8, 13, 10),
    ...frame(3, 11, 13, 13),
    ...rect(3, 2, 3, 13),
  ]),
  // §11.3 C1 — a cup, and the drip above it.
  C1: build([
    ...rect(4, 8, 11, 12),
    ...line(4, 8, 4, 6),
    ...line(11, 8, 11, 6),
    ...line(2, 3, 4, 3),
    ...line(3, 2, 3, 4),
    ...pts(4, 14, 11, 14),
  ]),
  // §11.3 C2 — a chair, back and seat and four legs.
  C2: build([
    ...rect(3, 2, 12, 4),
    ...rect(3, 6, 12, 8),
    ...line(3, 8, 3, 12),
    ...line(12, 8, 12, 12),
    ...line(3, 6, 3, 8),
    ...line(12, 6, 12, 8),
  ]),
  // §11.3 C6 — a sandbag, laced at the top.
  C6: build([
    ...disc(7, 7, 5),
    ...rect(5, 2, 9, 3),
    ...line(5, 2, 4, 5),
    ...line(9, 2, 10, 5),
  ]),
  // §11.3 C7 — three fanned cards.
  C7: build([
    ...frame(2, 4, 7, 12),
    ...frame(5, 3, 10, 11),
    ...frame(8, 2, 13, 10),
  ]),
  // §11.3 C8 — a bar chart climbing to the right.
  C8: build([
    ...rect(2, 9, 4, 13),
    ...rect(5, 6, 7, 13),
    ...rect(8, 4, 10, 13),
    ...rect(11, 2, 13, 13),
  ]),
  // §11.3 C9 — an invoice, rows of line items.
  C9: build([
    ...frame(2, 2, 13, 13),
    ...line(4, 4, 11, 4),
    ...line(4, 6, 11, 6),
    ...line(4, 8, 9, 8),
    ...line(4, 11, 11, 11),
  ]),
  // §11.3 C10 — a checkbox, and the check that never quite happens.
  C10: build([
    ...frame(2, 3, 13, 13),
    ...line(4, 8, 7, 11),
    ...line(7, 11, 11, 5),
  ]),
}

/** Every node id must have an icon. This is what `art:check`-style tests read. */
export const TECH_ICON_IDS = new Set(Object.keys(ICONS))

/** The 16×16 mask for a node, or null if the id has none. */
export function techIcon(id: string): readonly string[] | null {
  return ICONS[id] ?? null
}
