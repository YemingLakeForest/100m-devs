/**
 * Level 5 — the business park: ten blocks grouped into four compounds on one
 * board, and the one you are in.
 *
 * `docs/HANDOFF-2026-08-20.md` §13 built the block and recorded what a level
 * costs once the nesting is right: one more division and a new `TOP_LEVEL`.
 * This is that claim being spent. §7.7.1 rung 5 says that past a hundred
 * thousand developers a block is full and the thing that arrives is another
 * **block**, and ten of those is a million people — which is where this scope
 * stops.
 *
 * ## What makes it a park and not more city
 *
 * §7.8.2 rule 2 is unusually specific, and it is the one rule this level had to
 * be designed around rather than tuned into: *"a business park drawn with
 * towers the height of rung 4's reads as more towers, closer together, which is
 * the one thing a rung change must never look like."* Three things answer it,
 * and none of them is a smaller tower:
 *
 * - **The parcels do not touch.** `frames.ts` records the arithmetic: a block
 *   is wider than it is tall where a tower is the reverse, so the same 2:1
 *   lattice that makes four towers stand half in front of four others separates
 *   blocks completely. Ten islands, and nothing hides behind anything.
 * - **Every parcel stands on a visible plinth**, and every *compound* stands on
 *   a package above that. Three steps of one ramp, so depth is doing the work
 *   that a second hue would otherwise have to.
 * - **The ground between them is furniture, not emptiness.** A board with an
 *   edge, a bus in the channels between the packages, pin rows, a substation
 *   and a cooling plant, and a silkscreened pad wherever a block is not built
 *   yet.
 *
 * ## The rewrite, and the three rules it left — **2026-08-22**
 *
 * The first version laid the ten parcels in a 5x2 grid on a 1600-unit ground
 * diamond with boulevards ruled across it. The complaint that retired it was
 * exact: *"they spilled out to what seems to be a mat that does not meet that
 * size."* The mat was not cut to the parcels, could not be, and never stopped.
 *
 * 1. **Everything is authored in the plot lattice and projected once.** The
 *    first draft of the board built its packages from a bounding box in *park*
 *    space, and a park-space box projects to a screen-aligned rectangle — which
 *    in a 2:1 world reads as a sticker stuck on the picture rather than as
 *    ground under it. {@link latticeCorners} is the only way a quad is made in
 *    this file.
 * 2. **Anything standing on the board is inside the board.** The second draft
 *    cut the board to the parcels and left the cooling plant hanging off its
 *    near edge — the original complaint reproduced inside its own fix. So
 *    `frames.ts` owns the plant's footprint for the same reason it owns the
 *    deck's: geometry the frame and the drawing both need cannot be written
 *    down twice, which is trap 53 and has now cost three separate afternoons.
 * 3. **A run that lies on the ground goes down before the towers.** The bus is
 *    occluded by whatever stands on it. Drawn last it reads as a light show
 *    hung in front of the park; drawn first it reads as wiring in a street.
 *
 * ## What this file draws, and what it does not
 *
 * The board, the packages, the bus, the plant, the decks, the aprons — and it
 * owns **ten `block.ts` handles**, one per parcel, exactly as `block.ts` owns
 * ten plots. The address's own block is one of those ten and is the container
 * the focused building is parented into, so descending the whole five-level
 * ladder is still a single affine transform with nothing to cross-fade.
 *
 * The one thing that trades places is the block's *street plane*: it runs far
 * past its own plots so that ten towers do not sit on a raft, and at parcel
 * scale it is wider than the channel between two packages. It fades out as the
 * board fades in — two different objects trading places, which §10.5 allows.
 *
 * Procedural, from the master palette. ART_DIRECTION §7.8.2 — nothing above the
 * room gets a bespoke sprite. And §2.1a: the board is `NEUTRAL[1]`, not the
 * green that passed `art:check` and still did not belong.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import {
  BLOCKS_PER_PARK,
  COMPOUNDS,
  DECK_LIP,
  DECK_FAR,
  DECK_LEFT,
  DECK_NEAR,
  DECK_RIGHT,
  PARK_SCALE,
  PLOT_STRIDE_X,
  type LatticeBox,
  type Plant,
  blocksFor,
  busRuns,
  plantBox,
  plantFor,
  boardBox,
  deckBox,
  latticeCorners,
  packageBox,
  parcelAt,
  parcelDepth,
  parkLatticeAt,
} from './frames.ts'
import { buildBlock, type BlockHandle } from './block.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** One plot stride, in park units — the scale everything on the board is in. */
const S = PLOT_STRIDE_X * PARK_SCALE

/** How tall the board's own near face is — park units. */
const BOARD_DROP = 40
/** How tall a package's edge is. */
const PACKAGE_LIP = 16

type Pt = { x: number; y: number }

function polygon(g: Graphics, pts: Pt[]) {
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  g.closePath()
}

/**
 * Extrude one edge downward into a visible face.
 *
 * **The two edges that run down to the near corner, and only those**: in a 2:1
 * projection those are the faces a slab shows, and extruding any other one puts
 * a lit face on the back of the thing.
 */
function faceDown(g: Graphics, a: Pt, b: Pt, h: number, colour: string, alpha = 1) {
  g.moveTo(a.x, a.y)
    .lineTo(b.x, b.y)
    .lineTo(b.x, b.y + h)
    .lineTo(a.x, a.y + h)
    .closePath()
    .fill({ color: c(colour), alpha })
}

/** A lattice box drawn as a slab: near faces, top, and a lit rim along both. */
function slab(g: Graphics, box: LatticeBox, drop: number, top: string, rim: string, alpha = 1): void {
  const q = latticeCorners(box)
  faceDown(g, q[DECK_LEFT], q[DECK_NEAR], drop, RAMPS.NEUTRAL[0], 0.95)
  faceDown(g, q[DECK_NEAR], q[DECK_RIGHT], drop, RAMPS.NEUTRAL[0], 0.95)
  polygon(g, q)
  g.fill({ color: c(top), alpha })
  g.moveTo(q[DECK_LEFT].x, q[DECK_LEFT].y)
    .lineTo(q[DECK_NEAR].x, q[DECK_NEAR].y)
    .lineTo(q[DECK_RIGHT].x, q[DECK_RIGHT].y)
    .stroke({ width: 2.4, color: c(rim), alpha: 0.8 })
}

export interface ParkHandle {
  container: Container
  /** The block on parcel `block` — where a building of it is parented. */
  blockAt(block: number): BlockHandle
  /** Rebuild for a headcount. Cheap on change, far too dear per frame. */
  setHeadcount(devs: number): void
  /** Which block the address is in — the one that keeps its own ground. */
  setFocus(block: number, plot: number): void
  /** Which block has been named but not entered, or −1. */
  setSelected(block: number): void
  /**
   * Fade the park out as the camera descends into one of its blocks.
   *
   * Everything this file draws, **and the nine blocks that are not the
   * address's**. The focused block keeps its own chrome fade — dimming it from
   * here would dim it twice on the way in — and gains back its own street plane
   * on the inverse of this, so a camera arriving at the block level finds the
   * picture the block level has always drawn.
   */
  setChromeAlpha(alpha: number): void
  readonly blocks: number
}

export function buildPark(): ParkHandle {
  const root = new Container()
  /** The board and its silkscreen — under everything. */
  const board = new Graphics()
  /** The bus, which lies on the board and is occluded by what stands on it. */
  const wiring = new Graphics()
  /** Packages, decks, plant, pads — the things that stand. */
  const marks = new Graphics()
  root.addChild(board, wiring, marks)

  /** One container per parcel, in drawing order: furthest first. */
  const parcels: Container[] = []
  const blocks: BlockHandle[] = []
  for (let i = 0; i < BLOCKS_PER_PARK; i++) {
    const parcel = new Container()
    const at = parcelAt(i)
    parcel.position.set(at.x, at.y)
    parcel.scale.set(PARK_SCALE)
    const b = buildBlock()
    b.setBlock(i)
    // A neighbour never shows its own street plane: it is drawn to fill a whole
    // frame and would be painted across this parcel's neighbours. The focused
    // one gets it back in `setFocus`.
    b.setGroundAlpha(0)
    // Every tower is this block's to draw. Only the parcel the address is in
    // hands one of its plots over to `building.ts`.
    b.setFocus(-1)
    parcel.addChild(b.container)
    parcels.push(parcel)
    blocks.push(b)
  }
  /*
   * **Nearer parcels last.** Depth on this lattice is `u + v`, and unlike the
   * old grid the compounds interleave — a block of U3 can stand in front of a
   * block of U1 — so this sort is load-bearing now rather than defensive.
   */
  const order = [...parcels.keys()].sort((a, b) => parcelDepth(a) - parcelDepth(b))
  for (const i of order) root.addChild(parcels[i])

  let devs = 0
  let built = 1
  let focus = 0
  let selected = -1
  let chrome = 1

  /* ---- the board ---------------------------------------------------------- */

  function redrawBoard() {
    board.clear()
    const box = boardBox()
    const q = latticeCorners(box)
    // NEUTRAL[1] and never NEUTRAL[0] — the app's background *is* NEUTRAL[0], so
    // a ground plane painted in it is a hole with the park hanging over it.
    faceDown(board, q[DECK_LEFT], q[DECK_NEAR], BOARD_DROP, RAMPS.NEUTRAL[0])
    faceDown(board, q[DECK_NEAR], q[DECK_RIGHT], BOARD_DROP, RAMPS.NEUTRAL[0])
    polygon(board, q)
    board.fill(c(RAMPS.NEUTRAL[1]))
    // A shade over the whole board, so the three ground values are still three
    // after §6's bloom has lifted every one of them toward white. Without it the
    // board, the packages and the decks arrive on screen as one flat sheet —
    // which is what the mat looked like, in different geometry.
    polygon(board, q)
    board.fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.45 })
    board
      .moveTo(q[DECK_LEFT].x, q[DECK_LEFT].y)
      .lineTo(q[DECK_NEAR].x, q[DECK_NEAR].y)
      .lineTo(q[DECK_RIGHT].x, q[DECK_RIGHT].y)
      .stroke({ width: 2.6, color: c(RAMPS.NEUTRAL[3]), alpha: 0.85 })
    polygon(board, q)
    board.stroke({ width: 1.6, color: c(RAMPS.NEUTRAL[2]), alpha: 0.7 })

    /*
     * Silkscreen: the lattice, made faintly visible. It is the one thing on the
     * board that says the whole composition is on a grid — without it the
     * packages read as objects floating on a plane rather than as parts placed
     * on one.
     */
    for (let u = Math.ceil(box.u0); u <= box.u1; u += 2) {
      const a = parkLatticeAt(u, box.v0)
      const b = parkLatticeAt(u, box.v1)
      board.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: c(RAMPS.NEUTRAL[2]), alpha: 0.5 })
    }
    for (let v = Math.ceil(box.v0); v <= box.v1; v += 2) {
      const a = parkLatticeAt(box.u0, v)
      const b = parkLatticeAt(box.u1, v)
      board.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1, color: c(RAMPS.NEUTRAL[2]), alpha: 0.5 })
    }

    // Mounting holes, one per corner — the detail that makes it a board rather
    // than a rectangle of ground.
    for (const [u, v] of [
      [box.u0 + 1.6, box.v0 + 1.6],
      [box.u1 - 1.6, box.v0 + 1.6],
      [box.u1 - 1.6, box.v1 - 1.6],
      [box.u0 + 1.6, box.v1 - 1.6],
    ]) {
      const at = parkLatticeAt(u, v)
      board.ellipse(at.x, at.y, 0.95 * S, 0.48 * S).fill(c(RAMPS.NEUTRAL[2]))
      board.ellipse(at.x, at.y, 0.52 * S, 0.26 * S).fill(c(RAMPS.NEUTRAL[0]))
    }
  }

  /* ---- the bus ------------------------------------------------------------ */

  /**
   * One straight run, with a lump wherever something happens to it.
   *
   * Not a catenary. A cable sagging between two pylons is a *picture* of a power
   * line, and at this size it crosses the composition as a slack diagonal
   * belonging to no grid in the drawing. What a board wants is the symbolic
   * thing: one width, straight segments, square corners on the lattice, and a
   * node, a hop or an inline bulge at intervals.
   */
  function run(g: Graphics, pts: Pt[], seed: number) {
    const w = 0.115 * S
    const trace = (colour: string, width: number, alpha: number) => {
      g.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
      g.stroke({ width, color: c(colour), alpha, cap: 'butt', join: 'miter' })
    }
    trace(RAMPS.NEUTRAL[0], w + 5, 0.8)
    trace(RAMPS.NEUTRAL[3], w + 2, 0.95)
    trace(RAMPS.GLOW[1], w, 0.9)

    let s = seed
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const node = (p: Pt, r: number, colour: string) => {
      g.circle(p.x, p.y, r).fill(c(RAMPS.NEUTRAL[0]))
      g.circle(p.x, p.y, r * 0.72).fill(c(colour))
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const n = Math.floor(len / (1.2 * S))
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1)
        const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        const r = rnd()
        if (r > 0.62) {
          // A hop: the symbol for one run passing over another.
          const ang = Math.atan2(b.y - a.y, b.x - a.x)
          g.arc(at.x, at.y, w * 2.1, ang + Math.PI, ang)
          g.stroke({ width: w, color: c(RAMPS.GLOW[1]), alpha: 0.95, cap: 'butt' })
        } else if (r > 0.34) {
          // A bulge: a part sitting inline on the run.
          g.ellipse(at.x, at.y, w * 1.9, w * 1.1).fill(c(RAMPS.NEUTRAL[0]))
          g.ellipse(at.x, at.y, w * 1.9, w * 1.1).stroke({ width: w * 0.6, color: c(RAMPS.NEUTRAL[4]) })
        } else {
          node(at, w * 1.15, RAMPS.NEUTRAL[4])
        }
      }
      if (i > 0) node(a, w * 1.5, RAMPS.GLOW[2])
    }
    node(pts[0], w * 1.9, RAMPS.GLOW[2])
    node(pts[pts.length - 1], w * 1.9, RAMPS.GLOW[2])
  }

  function redrawWiring() {
    wiring.clear()
    // The routing is `frames.ts`'s, because it has been wrong twice and neither
    // fault was visible to anything that could only see a `Graphics`.
    for (const [i, r] of busRuns(built).entries()) {
      run(wiring, [parkLatticeAt(r.a.u, r.a.v), parkLatticeAt(r.b.u, r.b.v)], i * 7717 + 101)
    }
  }

  /* ---- plant -------------------------------------------------------------- */

  /** An iso cylinder standing on the lattice — a transformer, or a capacitor. */
  function canister(g: Graphics, at: Pt, r: number, h: number, band: string | null) {
    g.moveTo(at.x - r, at.y)
      .lineTo(at.x - r, at.y - h)
      .lineTo(at.x + r, at.y - h)
      .lineTo(at.x + r, at.y)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[2]))
    g.ellipse(at.x, at.y, r, r / 2).fill(c(RAMPS.NEUTRAL[1]))
    g.ellipse(at.x, at.y - h, r, r / 2).fill(c(RAMPS.NEUTRAL[4]))
    if (band) {
      g.moveTo(at.x - r, at.y - h * 0.62)
        .lineTo(at.x + r, at.y - h * 0.62)
        .lineTo(at.x + r, at.y - h * 0.5)
        .lineTo(at.x - r, at.y - h * 0.5)
        .closePath()
        .fill({ color: c(band), alpha: 0.9 })
    }
  }

  function drawPlant(g: Graphics, it: Plant) {
    const box = plantBox(it)
    slab(g, box, 9, RAMPS.NEUTRAL[2], RAMPS.NEUTRAL[4], 0.9)
    if (it.kind === 'substation') {
      // Three transformers in a row, one striped. A capacitor bank either way,
      // which is the joke the layout is built on and also just what a park has.
      for (let k = 0; k < 3; k++) {
        canister(
          g,
          parkLatticeAt(it.u + 0.3 + k * 1.25, it.v + 0.9),
          0.44 * S,
          1.5 * S,
          k === 1 ? RAMPS.WARN[2] : null,
        )
      }
      return
    }
    // Cooling: a fin row. Thin slabs standing along v, stepped along u — the
    // classic heatsink read, and a plant room at the same time.
    for (let k = 0; k <= 10; k++) {
      const u = it.u + 0.1 + k * 0.38
      const a = parkLatticeAt(u, it.v + 0.1)
      const b = parkLatticeAt(u, it.v + 1.9)
      const h = 0.95 * S
      g.moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .lineTo(b.x, b.y - h)
        .lineTo(a.x, a.y - h)
        .closePath()
        .fill(c(k % 2 ? RAMPS.NEUTRAL[3] : RAMPS.NEUTRAL[2]))
      g.moveTo(a.x, a.y - h)
        .lineTo(b.x, b.y - h)
        .stroke({ width: 0.05 * S, color: c(RAMPS.NEUTRAL[5]), alpha: 0.85 })
    }
  }

  /* ---- packages, pads and decks ------------------------------------------- */

  function redrawMarks() {
    marks.clear()

    // Unbuilt parcels: a silkscreened pad. The same trick the block plays with
    // an empty plot — it says *this is where the next hundred thousand go*,
    // which turns dead board into a promise.
    for (let i = built; i < BLOCKS_PER_PARK; i++) {
      const q = latticeCorners(deckBox(i))
      polygon(marks, q)
      marks.stroke({ width: 1.4, color: c(RAMPS.NEUTRAL[2]), alpha: 0.9 })
    }

    // Packages, under the decks they hold.
    for (let i = 0; i < COMPOUNDS.length; i++) {
      const box = packageBox(i, built)
      if (!box) continue
      slab(marks, box, PACKAGE_LIP, RAMPS.NEUTRAL[2], RAMPS.NEUTRAL[4])

      /*
       * **Pin rows.** The one detail that says *component* rather than *plot of
       * land*, and in 2:1 iso it is a segment and a pad per pin. They run out of
       * the two faces pointing at the camera, along the lattice, so they lean
       * the way everything else does.
       */
      const step = (span: number) => span / Math.max(3, Math.round(span / 1.15))
      const pin = (u: number, v: number, du: number, dv: number) => {
        const a = parkLatticeAt(u, v)
        const b = parkLatticeAt(u + du, v + dv)
        const lift = PACKAGE_LIP * 0.6
        marks
          .moveTo(a.x, a.y + lift)
          .lineTo(b.x, b.y + lift)
          .stroke({ width: 0.11 * S, color: c(RAMPS.NEUTRAL[5]), alpha: 0.95 })
        marks.ellipse(b.x, b.y + lift, 0.2 * S, 0.1 * S).fill(c(RAMPS.NEUTRAL[4]))
      }
      const su = step(box.u1 - box.u0)
      const sv = step(box.v1 - box.v0)
      for (let v = box.v0 + sv / 2; v < box.v1; v += sv) pin(box.u0, v, -0.5, 0)
      for (let u = box.u0 + su / 2; u < box.u1; u += su) pin(u, box.v1, 0, 0.5)
    }

    for (const it of plantFor(built)) drawPlant(marks, it)

    // The decks, on top of their packages.
    for (let i = 0; i < built; i++) {
      const q = latticeCorners(deckBox(i))
      /*
       * **The plinth, and it is the silhouette change.** The lip is a face, not
       * a shadow: the deck's two near edges are extruded downward and filled
       * darker than the top, so a parcel reads as a raised site with towers on
       * it rather than as a patch of lighter ground. §7.8.2 asks for "low-rise
       * on a visible plinth" and this is the visible part.
       */
      const lip = DECK_LIP * PARK_SCALE
      for (const side of [DECK_LEFT, DECK_RIGHT]) {
        faceDown(marks, q[side], q[DECK_NEAR], lip, RAMPS.NEUTRAL[2])
      }
      polygon(marks, q)
      marks.fill(c(RAMPS.NEUTRAL[3]))
      marks
        .moveTo(q[DECK_LEFT].x, q[DECK_LEFT].y)
        .lineTo(q[DECK_NEAR].x, q[DECK_NEAR].y)
        .lineTo(q[DECK_RIGHT].x, q[DECK_RIGHT].y)
        .stroke({ width: 2, color: c(RAMPS.NEUTRAL[6]), alpha: 0.6 })

      /*
       * The car park, on the near edge of the deck. "Car parks that are always
       * full" (§7.8.2), which at this size is four bay lines and their shadow —
       * the information is *that the ground is used*, and any more detail than
       * that is invisible at this size and dear at every other.
       */
      const bays = 5
      for (let k = 1; k <= bays; k++) {
        const t = k / (bays + 1)
        const a = {
          x: q[DECK_LEFT].x + (q[DECK_NEAR].x - q[DECK_LEFT].x) * t,
          y: q[DECK_LEFT].y + (q[DECK_NEAR].y - q[DECK_LEFT].y) * t,
        }
        const b = {
          x: a.x + (q[DECK_FAR].x - q[DECK_LEFT].x) * 0.13,
          y: a.y + (q[DECK_FAR].y - q[DECK_LEFT].y) * 0.13,
        }
        marks.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 2, color: c(RAMPS.NEUTRAL[5]), alpha: 0.85 })
      }
    }

    if (selected >= 0 && selected < built) {
      /*
       * **The named block says so three ways**, which is §7's selection lesson
       * repeated at each level because it is true at each level: one more
       * outline on a picture made of outlines is not feedback. A phosphor wash
       * over the deck, a heavier rule round it, and a tick standing off the
       * near corner where nothing else in the picture lives.
       */
      const q = latticeCorners(deckBox(selected))
      polygon(marks, q)
      marks.fill({ color: c(RAMPS.CALM[1]), alpha: 0.22 })
      polygon(marks, q)
      marks.stroke({ width: 3, color: c(RAMPS.CALM[2]), alpha: 0.9 })
      const near = q[DECK_NEAR]
      marks
        .moveTo(near.x, near.y)
        .lineTo(near.x, near.y + 30)
        .stroke({ width: 3, color: c(RAMPS.CALM[2]) })
    }
  }

  function applyVisibility() {
    for (let i = 0; i < BLOCKS_PER_PARK; i++) parcels[i].visible = i < built
  }

  function applyChrome() {
    board.alpha = chrome
    wiring.alpha = chrome
    marks.alpha = chrome
    for (let i = 0; i < BLOCKS_PER_PARK; i++) {
      // The focused block is the one the camera is descending into. It owns its
      // own fade and gains its street plane back as this one leaves.
      if (i === focus) {
        blocks[i].setGroundAlpha(1 - chrome)
        continue
      }
      blocks[i].setChromeAlpha(chrome)
    }
  }

  function redrawAll() {
    redrawBoard()
    redrawWiring()
    redrawMarks()
    applyVisibility()
  }

  redrawAll()
  applyChrome()

  return {
    container: root,

    blockAt(block: number) {
      return blocks[Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))]
    },

    setHeadcount(next: number) {
      const n = Math.max(0, Math.floor(Number.isFinite(next) ? next : 0))
      // Every block is told, every time. Each one early-returns unless its own
      // occupancy moved, and since blocks fill in order that is at most one of
      // the ten — which is what keeps a hire at nine hundred thousand
      // developers costing the same ten towers it costs at nine thousand.
      for (const b of blocks) b.setHeadcount(n)
      if (n === devs) return
      devs = n
      built = blocksFor(n)
      redrawAll()
    },

    setFocus(block: number, plot: number) {
      const b = Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(block)))
      if (b !== focus) {
        // The block being left is a neighbour again: it draws all ten of its
        // towers, and it loses the street plane that only the focused one has.
        blocks[focus].setFocus(-1)
        blocks[focus].setGroundAlpha(0)
        focus = b
        applyChrome()
      }
      blocks[focus].setFocus(plot)
    },

    setSelected(block: number) {
      const b = Math.floor(block)
      if (b === selected) return
      selected = b
      redrawMarks()
    },

    setChromeAlpha(alpha: number) {
      const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1))
      if (a === chrome) return
      chrome = a
      applyChrome()
    },

    get blocks() {
      return built
    },
  }
}
