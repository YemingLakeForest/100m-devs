/**
 * The isometric tree board, painted — GDD §8, ART_DIRECTION §1 [2026-09-26].
 *
 * The rebuild's demo drew its board with canvas paths, and canvas paths are
 * antialiased: every tile edge and every connector came out as a fringe of
 * in-between colours, which at 3× is a soft halo around a hard-pixel look. The
 * interface here is hard 1px rules and nothing between two palette entries
 * (ART_DIRECTION §1, §2), so this paints the same board into a pixel buffer
 * itself, the way the release ring does: a polygon covers a pixel when it
 * covers the pixel's centre, a line is Bresenham's, and an outline is the
 * polygon's own edge pixels. The picture is the demo's; the pixels are ours.
 *
 * **Two registers on one board, deliberately** (§1): the board — tiles, links,
 * forks, pips — is interface, drawn in the live phosphor `--p0..--p3` and the
 * neutral ramp, so it turns amber with the rest of the glass when entropy
 * climbs. The icons standing on it are world objects in the world's colours
 * (`art/voxelIcons.ts`), until they are out of reach: a node you cannot buy yet
 * is drawn as a phosphor ghost of itself, which says *not yet* without a
 * single dimmed colour.
 *
 * Pure — a buffer in, pixels out. No DOM, so the test can paint it.
 */

import { ICONS, MATERIALS, headBoxes, type Box } from '../art/voxelIcons.ts'
import { hexToRgb } from '../art/palette.ts'
import {
  TREES,
  connectorRoute,
  isBreakthrough,
  type TileState,
  type TreeHero,
  type TreeNode,
} from '../sim/upgradeTrees.ts'

/**
 * Board px per grid step: cell (1, 0) is (P, P/2) from (0, 0).
 *
 * Sixty, so a desktop frame shows the board at 1:1 with the demo's own scale
 * (its 30 px cell at 2×), and a phone at three device pixels to the CSS pixel
 * can step down by whole device pixels (ART_DIRECTION §3 rule 2) rather than
 * whole CSS ones. It is also what makes every tile vertex a whole pixel: every
 * vertex offset below is a multiple of 0.1 cells, and 0.1 × P / 2 = 3.
 */
export const P = 60
/** A tile's half-size and corner cut, in cells. Every vertex's x and y offsets sum to a multiple of 0.1. */
export const TILE = 0.3
export const TILE_BIG = 0.35
export const CHAMFER = 0.1
/** How far a tile's side shows below its top. */
export const THICK = 6
/** Icon px per icon unit: the demo's two-thirds of a tile. */
export const ICON_UNIT = 4

// --- colour -----------------------------------------------------------------

/** A colour packed for a little-endian `Uint32Array` over RGBA bytes. */
export type Px = number

export function pack(hex: string, alpha = 255): Px {
  const [r, g, b] = hexToRgb(hex)
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0
}

/** The live phosphor and the neutral ramp, packed. Read from CSS by the caller. */
export interface Ink {
  p: readonly [Px, Px, Px, Px]
  n: readonly Px[]
}

const MATERIAL_PX: Record<string, readonly [Px, Px, Px]> = Object.fromEntries(
  Object.entries(MATERIALS).map(([k, m]) => [k, [pack(m[0]), pack(m[1]), pack(m[2])] as const]),
)

// --- the rasteriser ---------------------------------------------------------

type Pt = readonly [number, number]

export class Raster {
  readonly w: number
  readonly h: number
  readonly px: Uint32Array
  constructor(w: number, h: number, px?: Uint32Array) {
    this.w = w
    this.h = h
    this.px = px ?? new Uint32Array(w * h)
  }

  clear(c: Px = 0) {
    this.px.fill(c)
  }

  dot(x: number, y: number, c: Px) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px[y * this.w + x] = c
  }

  rect(x: number, y: number, w: number, h: number, c: Px) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, c)
  }

  /**
   * The rows a convex polygon covers: row → [first, last] pixel whose centre
   * is inside. Every shape on the board is convex, so a row is one span.
   */
  spans(pts: readonly Pt[]): Map<number, [number, number]> {
    const out = new Map<number, [number, number]>()
    let top = Infinity
    let bottom = -Infinity
    for (const [, y] of pts) {
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
    for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) {
      const yc = y + 0.5
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        if ((a[1] <= yc && yc < b[1]) || (b[1] <= yc && yc < a[1])) {
          const x = a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
          lo = Math.min(lo, x)
          hi = Math.max(hi, x)
        }
      }
      if (lo > hi) continue
      const first = Math.ceil(lo - 0.5)
      const last = Math.ceil(hi - 0.5) - 1
      if (last >= first) out.set(y, [first, last])
    }
    return out
  }

  fillSpans(spans: Map<number, [number, number]>, c: Px, dy = 0) {
    for (const [y, [a, b]] of spans) for (let x = a; x <= b; x++) this.dot(x, y + dy, c)
  }

  /** The polygon's own edge pixels: covered, with an uncovered 4-neighbour. `dash` skips every other pair. */
  edgeSpans(spans: Map<number, [number, number]>, c: Px, dash = false) {
    const covers = (x: number, y: number) => {
      const s = spans.get(y)
      return !!s && x >= s[0] && x <= s[1]
    }
    for (const [y, [a, b]] of spans) {
      for (let x = a; x <= b; x++) {
        if (x !== a && x !== b && covers(x, y - 1) && covers(x, y + 1)) continue
        if (dash && ((x >> 1) + y) % 2 !== 0) continue
        this.dot(x, y, c)
      }
    }
  }

  fillPoly(pts: readonly Pt[], c: Px) {
    this.fillSpans(this.spans(pts), c)
  }

  /** Bresenham, between whole pixels. `dash` is on-and-off run length, 0 for solid. */
  line(x0: number, y0: number, x1: number, y1: number, c: Px, dash = 0) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    let i = 0
    for (;;) {
      if (!dash || Math.floor(i / dash) % 2 === 0) this.dot(x0, y0, c)
      i++
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }
}

// --- geometry ---------------------------------------------------------------

/** A board cell's centre, in board px from the tree's origin. */
export function iso(gx: number, gy: number): [number, number] {
  return [(gx - gy) * P, ((gx + gy) * P) / 2]
}

/** The octagonal tile, the demo's shape: a square cell with its corners cut. */
export function octagon(cx: number, cy: number, s: number, c = CHAMFER): Pt[] {
  const q: Pt[] = [[-s + c, -s], [s - c, -s], [s, -s + c], [s, s - c], [s - c, s], [-s + c, s], [-s, s - c], [-s, -s + c]]
  return q.map(([dx, dy]) => [cx + (dx - dy) * P, cy + ((dx + dy) * P) / 2] as const)
}

/** The board px a tree occupies, with room for the icons standing on its tiles. */
export function treeBounds(hero: TreeHero) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of TREES[hero]) {
    const [x, y] = iso(n.x, n.y)
    minX = Math.min(minX, x - P * 0.8)
    maxX = Math.max(maxX, x + P * 0.8)
    minY = Math.min(minY, y - P * 0.9)
    maxY = Math.max(maxY, y + P * 0.5)
  }
  return { minX, maxX, minY, maxY }
}

/** Which node a board point is over, or null. Tried at the tile, then up where its icon stands. */
export function pickNode(hero: TreeHero, bx: number, by: number): TreeNode | null {
  for (const lift of [0, P * 0.3]) {
    const X = bx / P
    const Y = (by + lift) / (P / 2)
    const gx = (X + Y) / 2
    const gy = (Y - X) / 2
    let best: TreeNode | null = null
    let bd = Infinity
    for (const n of TREES[hero]) {
      const d = Math.max(Math.abs(gx - n.x), Math.abs(gy - n.y))
      const r = isBreakthrough(n) || n.kind === 'root' ? 0.46 : 0.42
      if (d < r && d < bd) { bd = d; best = n }
    }
    if (best) return best
  }
  return null
}

// --- voxels -------------------------------------------------------------------

/**
 * One icon, painted back to front. `ghost` replaces every material with the
 * phosphor's three dimmest steps, so a node out of reach is its own silhouette.
 */
export function paintVoxels(r: Raster, ox: number, oy: number, boxes: readonly Box[], u: number, ghost: readonly [Px, Px, Px] | null) {
  const pr = (x: number, y: number, z: number): Pt => [ox + (x - y) * u, oy + ((x + y - 5) * u) / 2 - z * u]
  const order = boxes.slice().sort((a, b) => a[0] + a[3] / 2 + a[1] + a[4] / 2 + a[2] * 0.02 - (b[0] + b[3] / 2 + b[1] + b[4] / 2 + b[2] * 0.02))
  for (const [x, y, z, w, d, h, m] of order) {
    const [top, front, side] = ghost ?? MATERIAL_PX[m]
    r.fillPoly([pr(x, y + d, z), pr(x + w, y + d, z), pr(x + w, y + d, z + h), pr(x, y + d, z + h)], front)
    r.fillPoly([pr(x + w, y, z), pr(x + w, y + d, z), pr(x + w, y + d, z + h), pr(x + w, y, z + h)], side)
    r.fillPoly([pr(x, y, z + h), pr(x + w, y, z + h), pr(x + w, y + d, z + h), pr(x, y + d, z + h)], top)
  }
}

// --- the board ----------------------------------------------------------------

export interface BoardNode {
  node: TreeNode
  state: TileState
  level: number
}

export interface BoardScene {
  hero: TreeHero
  nodes: readonly BoardNode[]
  selected: string | null
  hover: string | null
  /** The pulse's phase: live tiles alternate between two phosphor steps. */
  blink: boolean
  ink: Ink
  /** Where the tree's origin sits in the buffer. */
  ox: number
  oy: number
}

const OWNED: ReadonlySet<TileState> = new Set(['owned', 'partial', 'partial+', 'root'])
const OUT_OF_REACH: ReadonlySet<TileState> = new Set(['locked', 'era', 'closed'])

export function paintBoard(r: Raster, scene: BoardScene) {
  const { ink, hero } = scene
  const [p0, p1, p2, p3] = ink.p
  const n = ink.n
  const at = (gx: number, gy: number): [number, number] => {
    const [x, y] = iso(gx, gy)
    return [scene.ox + x, scene.oy + y]
  }
  const byId = new Map(scene.nodes.map((b) => [b.node.id, b]))
  const owned = (id: string) => {
    const b = byId.get(id)
    return !!b && (OWNED.has(b.state) || (b.state === 'link' && b.level > 0))
  }

  // The floor: one phosphor dot per cell, faint enough to be the grid and not a pattern.
  for (let gx = -9; gx <= 9; gx++) for (let gy = -9; gy <= 9; gy++) {
    const [x, y] = at(gx, gy)
    r.dot(x, y, p0)
  }

  // Pick-one pairs: a dashed rule between them and a diamond on it.
  const forks = new Set<string>()
  for (const b of scene.nodes) {
    const f = b.node.fork
    if (!f || forks.has(f)) continue
    forks.add(f)
    const pair = scene.nodes.filter((o) => o.node.fork === f)
    if (pair.length < 2) continue
    const [A, B] = [at(pair[0].node.x, pair[0].node.y), at(pair[1].node.x, pair[1].node.y)]
    r.line(A[0], A[1], B[0], B[1], p1, 2)
    const mx = Math.round((A[0] + B[0]) / 2)
    const my = Math.round((A[1] + B[1]) / 2)
    r.fillPoly([[mx, my - 4.5], [mx + 6.5, my], [mx, my + 4.5], [mx - 6.5, my]], p2)
  }

  // Connectors, parent to child, drawn under the tiles.
  for (const b of scene.nodes) {
    for (const pid of b.node.parents) {
      const cells = connectorRoute(hero, b.node, pid)
      if (cells.length < 2) continue
      const po = owned(pid)
      const no = b.node.kind === 'link' ? po : owned(b.node.id)
      const lit = po && no
      const c = lit ? p2 : po && b.state !== 'era' ? p1 : n[2]
      for (let i = 0; i + 1 < cells.length; i++) {
        const [x0, y0] = at(cells[i][0], cells[i][1])
        const [x1, y1] = at(cells[i + 1][0], cells[i + 1][1])
        r.line(x0, y0, x1, y1, c)
        if (lit) r.line(x0, y0 + 1, x1, y1 + 1, c)
      }
      // Needs every link: a dot where each one arrives.
      if (b.node.all) {
        const [lx, ly] = cells[cells.length - 2]
        const dx = Math.sign(lx - b.node.x)
        const dy = Math.sign(ly - b.node.y)
        const [x, y] = at(b.node.x + dx * 0.46, b.node.y + dy * 0.46)
        r.rect(Math.round(x) - 1, Math.round(y) - 1, 3, 3, po ? p3 : p1)
      }
    }
  }

  // Tiles, back to front.
  const order = scene.nodes.slice().sort((a, b) => a.node.x + a.node.y - (b.node.x + b.node.y))
  for (const b of order) paintTile(r, scene, b, at)
}

function paintTile(r: Raster, scene: BoardScene, b: BoardNode, at: (gx: number, gy: number) => [number, number]) {
  const { ink } = scene
  const [p0, p1, p2, p3] = ink.p
  const n = ink.n
  const { node, state, level } = b
  const [cx, cyBase] = at(node.x, node.y)
  const lift = scene.hover === node.id ? 1 : 0
  const cy = cyBase - lift
  const big = isBreakthrough(node) || node.kind === 'root'
  const size = big ? TILE_BIG : TILE
  const top = r.spans(octagon(cx, cy, size))
  const ghost: readonly [Px, Px, Px] = [p1, p0, n[1]]

  if (node.kind === 'link') {
    const on = level > 0
    for (let i = THICK; i > 0; i--) r.fillSpans(top, n[0], i)
    r.fillSpans(top, on ? p0 : n[1])
    r.edgeSpans(top, on ? p2 : p1, true)
    if (node.to) paintVoxels(r, cx, cy - 3, headBoxes(node.to.hero), 3, on ? null : ghost)
    if (scene.selected === node.id) r.edgeSpans(r.spans(octagon(cx, cy, size + 0.1)), p3)
    return
  }

  // [top, side, edge|null]
  let face: [Px, Px, Px | null]
  switch (state) {
    case 'root': face = [p2, p1, p3]; break
    case 'owned':
    case 'partial': face = [p1, p0, p2]; break
    case 'partial+': face = [p1, p0, scene.blink ? p3 : p2]; break
    case 'live': face = [n[2], n[1], scene.blink ? p3 : p2]; break
    case 'short': face = [n[2], n[1], p1]; break
    default: face = [n[1], n[0], null]
  }
  // A breakthrough owned is lit like a root: it is the other kind of end.
  if (isBreakthrough(node) && state === 'owned') face = [p2, p1, p3]

  for (let i = THICK; i > 0; i--) r.fillSpans(top, face[1], i)
  r.fillSpans(top, face[0])
  if (face[2] !== null) r.edgeSpans(top, face[2])
  // A breakthrough not yet owned wears a second ring, so it reads as the goal from across the board.
  if (isBreakthrough(node) && state !== 'owned') {
    r.edgeSpans(r.spans(octagon(cx, cy, size + 0.05)), OUT_OF_REACH.has(state) ? p0 : p1)
  }
  if (scene.selected === node.id) r.edgeSpans(r.spans(octagon(cx, cy, size + 0.1)), p3)

  const boxes = ICONS[node.icon] ?? ICONS.crate
  paintVoxels(r, cx, cy - 3, boxes, ICON_UNIT, OUT_OF_REACH.has(state) ? ghost : null)

  if (state === 'closed') {
    r.line(cx - 10, cy - 5, cx + 10, cy + 5, p1)
    r.line(cx + 10, cy - 5, cx - 10, cy + 5, p1)
  }
  // The tile's right-hand corner is (2s − c)·P from its centre.
  if (state === 'era') lockGlyph(r, cx + Math.round((2 * size - CHAMFER) * P) - 14, cy - 4, p1, n[1])
  if (node.max > 1) {
    const w = node.max * 5 - 2
    const x0 = cx - Math.floor(w / 2)
    const y = cy + Math.round(((2 * size - CHAMFER) * P) / 2) + THICK + 3
    for (let i = 0; i < node.max; i++) r.rect(x0 + i * 5, y, 3, 3, i < level ? p3 : n[3])
  }
}

/** A padlock, seven by eight: the era a node is waiting for. */
function lockGlyph(r: Raster, x: number, y: number, c: Px, hole: Px) {
  r.rect(x, y + 3, 7, 5, c)
  r.rect(x + 1, y, 1, 3, c)
  r.rect(x + 5, y, 1, 3, c)
  r.rect(x + 1, y, 5, 1, c)
  r.rect(x + 3, y + 4, 1, 3, hole)
}
