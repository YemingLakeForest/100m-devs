/**
 * §11.4.4's icon grammar, on §13.9's board — one procedural pixel icon per hero
 * node.
 *
 * ART_DIRECTION §3.1 T0, exactly as `techIcons.ts`: geometry from the §2 palette
 * on the integer grid, drawn in code, no emoji anywhere near it. An icon is a
 * **mask** — a 16×16 grid of filled-or-empty cells — and colour is the
 * renderer's business, which is what lets one grid serve §11.4.2's three states.
 *
 * ## Two icons per branch, not thirty-one
 *
 * `techIcons.ts` draws a picture of each specific *thing*, because §11's nodes
 * are specific things — Instant Messenger is a speech bubble, JIRA Ticket
 * Flooding is a stack of tickets deep enough to be a joke about itself.
 *
 * §13.9's nodes are not things, they are **more of what this branch does**. So a
 * branch has one icon and a node wears it; the DEPTH nodes of Quality are all
 * the same magnifying glass because they are all the same act, done harder.
 * Drawing five subtly different magnifying glasses would be five assets nobody
 * can tell apart, which is worse than one nobody has to.
 *
 * **REACH is the exception and it is the same picture everywhere**: an arrow
 * opening outward. It is the one node kind that means the same thing in every
 * branch — §13.6.4's spine — and it reads as the expensive one because it is the
 * only icon on the board that is not about a job.
 */

type Pt = readonly [number, number]

function build(pts: Iterable<Pt>): readonly string[] {
  const grid: string[][] = Array.from({ length: 16 }, () => Array(16).fill('.'))
  for (const [x, y] of pts) {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) grid[y][x] = '#'
  }
  return grid.map((row) => row.join(''))
}

function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const out: Pt[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y])
  return out
}

function frame(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const out: Pt[] = []
  for (let x = x0; x <= x1; x++) out.push([x, y0], [x, y1])
  for (let y = y0 + 1; y < y1; y++) out.push([x0, y], [x1, y])
  return out
}

function line(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const out: Pt[] = []
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  if (steps === 0) return [[x0, y0]]
  for (let i = 0; i <= steps; i++) {
    out.push([Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps)])
  }
  return out
}

function ring(cx: number, cy: number, r: number): Pt[] {
  const out: Pt[] = []
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y
      if (d <= r * r && d > (r - 1) * (r - 1)) out.push([cx + x, cy + y])
    }
  }
  return out
}

const ICONS: Record<string, readonly string[]> = {
  // Engineering, the trunk — a caret and a cursor. What everybody did before
  // they specialised, and the smallest possible picture of writing code.
  engineering: build([
    ...line(4, 5, 8, 8),
    ...line(8, 8, 4, 11),
    ...line(10, 11, 13, 11),
  ]),

  // Quality — a magnifying glass over a line of text. Mo reads everything twice,
  // and the glass is over the line rather than over a bug: she is looking at the
  // thing before it is a bug, which is the entire branch.
  quality: build([
    ...ring(7, 6, 4),
    ...line(10, 10, 13, 13),
    ...line(9, 10, 12, 13),
    ...line(3, 14, 8, 14),
  ]),

  // Reliability — a pulse that dips and recovers. Serena's graph. It has already
  // come back up by the time you are looking at it, which is her whole voice.
  reliability: build([
    ...line(1, 8, 4, 8),
    ...line(4, 8, 6, 13),
    ...line(6, 13, 8, 3),
    ...line(8, 3, 10, 8),
    ...line(10, 8, 14, 8),
  ]),

  // Support — a headset. Matt is the only person in the company who has spoken
  // to a player, and this is the object that makes that true.
  support: build([
    ...ring(8, 8, 6).filter(([, y]) => y <= 8),
    ...rect(1, 7, 3, 12),
    ...rect(13, 7, 15, 12),
    ...line(4, 12, 8, 14),
  ]),

  // Cloud — a cloud with a meter under it. Melany can give you infinite capacity
  // by Thursday; the meter is the part she would like to discuss afterwards.
  cloud: build([
    ...ring(6, 6, 3).filter(([, y]) => y <= 7),
    ...ring(10, 7, 3).filter(([, y]) => y <= 8),
    ...line(3, 8, 13, 8),
    ...line(4, 11, 12, 11),
    ...line(8, 11, 11, 13),
  ]),

  // Cohesion — three figures and the circle they are standing in. Billy has
  // booked fifteen minutes, and it genuinely works, which is the uncomfortable
  // part.
  cohesion: build([
    ...ring(8, 8, 7),
    ...rect(7, 3, 8, 5),
    ...rect(3, 9, 4, 11),
    ...rect(11, 9, 12, 11),
  ]),

  // REACH — an arrow opening outward, in all four directions. The one node kind
  // that means the same thing in every branch, and the only icon on the board
  // that is not about a job.
  reach: build([
    ...line(2, 8, 13, 8),
    ...line(8, 2, 8, 13),
    ...line(2, 8, 5, 5),
    ...line(2, 8, 5, 11),
    ...line(13, 8, 10, 5),
    ...line(13, 8, 10, 11),
    ...line(8, 2, 5, 5),
    ...line(8, 2, 11, 5),
    ...line(8, 13, 5, 10),
    ...line(8, 13, 11, 10),
  ]),

  // The lanyard punch and the frame of §22.9's staff pass, for the roster strip.
  pass: build([
    ...frame(2, 3, 13, 14),
    ...rect(7, 1, 8, 2),
    ...rect(4, 6, 7, 9),
    ...line(9, 6, 11, 6),
    ...line(9, 8, 11, 8),
    ...line(4, 12, 11, 12),
  ]),
}

/** Every key here must resolve, which is what the icon test reads. */
export const HERO_ICON_KEYS = new Set(Object.keys(ICONS))

/**
 * The 16×16 mask for a node of this branch and kind.
 *
 * REACH wins over the branch, deliberately: a player scanning the board is
 * looking for *where the expensive ones are*, and that question is answered by
 * one shape repeated on every heading.
 */
export function heroIcon(branch: string, kind: string): readonly string[] | null {
  if (kind === 'reach') return ICONS.reach
  // §4.14's CRAFT rung keeps its branch's own mark. The kind is already said
  // twice on the box — in the stereotype and in the double rule — and a third
  // glyph for it would cost the one place on the node that says *whose* branch
  // this is, which is the question the board is actually about.
  return ICONS[branch] ?? null
}

/** The staff-pass mark, for §13.11.2's strip. */
export function heroPassIcon(): readonly string[] {
  return ICONS.pass
}
