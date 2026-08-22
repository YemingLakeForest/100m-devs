/**
 * Level 5 — the business park: ten blocks on their own parcels, and the one you
 * are in.
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
 * - **Every parcel stands on a visible plinth.** GDD's own phrase, and it is
 *   what turns a cluster of towers into a *site*: a raised deck with a lit
 *   edge, drawn as the sheared rectangle the lattice actually projects to
 *   rather than as the diamond that contains it — `floorOutline`'s lesson, two
 *   levels up.
 * - **The ground between them is furniture, not emptiness.** Boulevards along
 *   both lattice axes, a car-park apron on the near edge of each deck, and a
 *   walkway between every pair of neighbours that both exist. A block level
 *   drawn without its streets read as ten towers on a raft; a park drawn
 *   without these reads as ten blocks on one.
 *
 * ## What this file draws, and what it does not
 *
 * The ground, the boulevards, the decks, the aprons, the walkways — and it owns
 * **ten `block.ts` handles**, one per parcel, exactly as `block.ts` owns ten
 * plots. The address's own block is one of those ten and is the container the
 * focused building is parented into, so descending the whole five-level ladder
 * is still a single affine transform and there is nothing at any hand-off to
 * cross-fade.
 *
 * The one thing that trades places is the block's *street plane*: it runs far
 * past its own plots so that ten towers do not sit on a raft, and at parcel
 * scale it is wider than the boulevard between two parcels. It fades out as the
 * decks fade in — two different objects trading places, which §10.5 allows.
 *
 * Procedural, from the master palette. ART_DIRECTION §7.8.2 — nothing above the
 * room gets a bespoke sprite.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import {
  BLOCKS_PER_PARK,
  BLOCK_COLS,
  BLOCK_ROWS,
  BLOCK_SCALE,
  DECK_FAR,
  DECK_LEFT,
  DECK_LIP,
  DECK_MARGIN,
  DECK_NEAR,
  DECK_RIGHT,
  PARK_COLS,
  PARK_ROWS,
  PARK_SCALE,
  PARCEL_STRIDE_X,
  PARCEL_STRIDE_Y,
  TOWER_GROUND,
  blocksFor,
  deckOutline,
  parcelAt,
  parcelDepth,
  plotLatticeAt,
} from './frames.ts'
import { buildBlock, type BlockHandle } from './block.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * How far the park's ground runs past the outermost parcel.
 *
 * Ten parcels use 768 px of a 997 px frame — the same 2:1 lattice buys one unit
 * across for every half unit back, so ten blocks are height-bound long before
 * they are width-bound, exactly as ten towers were. §3.3 lets *scenery* run
 * under the rails where content may not, and a park with nothing around it is
 * the raft problem one level up.
 */
const GROUND_SPREAD = 1600

/** Where a block's plots sit on their own ground plane — `block.ts`'s `PAD_Y`. */
const PAD_Y = TOWER_GROUND * BLOCK_SCALE

/**
 * One parcel's deck, as four points in **park** space.
 *
 * The shape itself is `frames.ts`'s, because the park's own *frame* has to span
 * it: a deck is half again as wide as the ten towers standing on it, so a park
 * framed on the towers alone runs its leftmost parcel off the side of the
 * window. All this does is carry it into the parcel.
 */
function deckPoints(block: number): Array<{ x: number; y: number }> {
  const at = parcelAt(block)
  return deckOutline().map((p) => intoParcelSpace(p, at))
}

function intoParcelSpace(
  p: { x: number; y: number },
  at: { x: number; y: number },
): { x: number; y: number } {
  return { x: at.x + p.x * PARK_SCALE, y: at.y + p.y * PARK_SCALE }
}

/**
 * A point on one parcel's own plot lattice, in park space.
 *
 * What the walkways are anchored to: a path leaves a deck at the middle of the
 * edge it shares with its neighbour, and "the middle of that edge" is a lattice
 * coordinate rather than a fraction of a bounding box.
 */
function parcelLatticeAt(block: number, col: number, row: number): { x: number; y: number } {
  return intoParcelSpace(plotLatticeAt(col, row), parcelAt(block))
}

function polygon(g: Graphics, pts: Array<{ x: number; y: number }>) {
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
  g.closePath()
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
  const ground = new Graphics()
  const marks = new Graphics()
  root.addChild(ground, marks)

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
   * **Nearer parcels last**, the same sort `block.ts` does one level down. It
   * cannot matter while the lattice separates every pair — `frames.ts` measures
   * the clearances — and it is written anyway, so that tightening the lattice
   * later changes how much street there is and not which block is in front.
   */
  const order = [...parcels.keys()].sort((a, b) => parcelDepth(a) - parcelDepth(b))
  for (const i of order) root.addChild(parcels[i])

  let devs = 0
  let built = 1
  let focus = 0
  let selected = -1
  let chrome = 1

  function redrawGround() {
    ground.clear()
    const first = parcelAt(0)
    const last = parcelAt(BLOCKS_PER_PARK - 1)
    const midX = (first.x + last.x) / 2
    const midY = (first.y + last.y) / 2 + PAD_Y * PARK_SCALE
    // NEUTRAL[1] and never NEUTRAL[0] — the app's background *is* NEUTRAL[0], so
    // a ground plane painted in it is a hole with the park hanging over it.
    ground
      .moveTo(midX - GROUND_SPREAD, midY)
      .lineTo(midX, midY - GROUND_SPREAD / 2)
      .lineTo(midX + GROUND_SPREAD, midY)
      .lineTo(midX, midY + GROUND_SPREAD / 2)
      .closePath()
      .fill(c(RAMPS.NEUTRAL[1]))

    /*
     * The boulevards. One down each row and each column of the parcel lattice,
     * run well past the parcels so the park sits in a landscape rather than on
     * a raft — `block.ts`'s streets at the scale where a street is a dual
     * carriageway. Two rules, wider than the block's: they carry a centre line,
     * because a road with no markings at this size is a scratch, and they are
     * drawn under the decks so a deck always wins the edge it shares with one.
     */
    for (let row = 0; row < PARK_ROWS; row++) {
      const a = parcelAt(row * PARK_COLS)
      const b = parcelAt(row * PARK_COLS + PARK_COLS - 1)
      const x0 = a.x - PARCEL_STRIDE_X * 1.6
      const y0 = a.y - PARCEL_STRIDE_Y * 1.6 + PAD_Y * PARK_SCALE
      const x1 = b.x + PARCEL_STRIDE_X * 1.6
      const y1 = b.y + PARCEL_STRIDE_Y * 1.6 + PAD_Y * PARK_SCALE
      ground.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 15, color: c(RAMPS.NEUTRAL[2]), alpha: 0.6 })
      ground.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.5, color: c(RAMPS.NEUTRAL[4]), alpha: 0.4 })
    }
    for (let col = 0; col < PARK_COLS; col++) {
      const a = parcelAt(col)
      const b = parcelAt(col + PARK_COLS)
      const x0 = a.x + PARCEL_STRIDE_X * 1.2
      const y0 = a.y - PARCEL_STRIDE_Y * 1.2 + PAD_Y * PARK_SCALE
      const x1 = b.x - PARCEL_STRIDE_X * 1.2
      const y1 = b.y + PARCEL_STRIDE_Y * 1.2 + PAD_Y * PARK_SCALE
      ground.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 15, color: c(RAMPS.NEUTRAL[2]), alpha: 0.6 })
      ground.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 1.5, color: c(RAMPS.NEUTRAL[4]), alpha: 0.4 })
    }
  }

  /**
   * The walkway between two parcels that both exist — GDD §7.8.2's "connecting
   * walkways", which is the word that separates a campus from a city.
   *
   * **Edge to edge, across the boulevard, and nothing else.** The first version
   * ran from one deck's centre to the next one's, which is a longer and simpler
   * line and was completely invisible: it is drawn before the decks, so all of
   * it except the 1.4 strides of gap was painted over. Drawing it *after* them
   * instead would have put a stripe across two decks. What is wanted is the
   * short piece nobody else is drawing.
   */
  function walkway(g: Graphics, a: number, b: number, along: 'col' | 'row') {
    const m = DECK_MARGIN
    const mid = { col: (BLOCK_COLS - 1) / 2, row: (BLOCK_ROWS - 1) / 2 }
    const [p, q] =
      along === 'col'
        ? [
            parcelLatticeAt(a, BLOCK_COLS - 1 + m, mid.row),
            parcelLatticeAt(b, -m, mid.row),
          ]
        : [
            parcelLatticeAt(a, mid.col, BLOCK_ROWS - 1 + m),
            parcelLatticeAt(b, mid.col, -m),
          ]
    g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ width: 6, color: c(RAMPS.NEUTRAL[3]), alpha: 0.9 })
  }

  function redrawMarks() {
    marks.clear()

    // The walkways go down first: they run out of one deck and into the next,
    // and the deck edge they leave from should cover the joint.
    for (let i = 0; i < built; i++) {
      const col = i % PARK_COLS
      const row = Math.floor(i / PARK_COLS)
      if (col + 1 < PARK_COLS && i + 1 < built) walkway(marks, i, i + 1, 'col')
      if (row + 1 < PARK_ROWS && i + PARK_COLS < built) walkway(marks, i, i + PARK_COLS, 'row')
    }

    for (let i = 0; i < built; i++) {
      const deck = deckPoints(i)
      /*
       * **The plinth, and it is the silhouette change.** The lip is a face, not
       * a shadow: the deck's two near edges are extruded downward and filled
       * darker than the top, so a parcel reads as a raised site with towers on
       * it rather than as a patch of lighter ground. §7.8.2 asks for "low-rise
       * on a visible plinth" and this is the visible part.
       */
      const lip = DECK_LIP * PARK_SCALE
      // **The two edges that run down to the near corner**, and only those: in
      // a 2:1 projection they are the faces a slab shows, and extruding any
      // other one puts a face on the back of the plinth.
      for (const side of [DECK_LEFT, DECK_RIGHT]) {
        marks
          .moveTo(deck[side].x, deck[side].y)
          .lineTo(deck[DECK_NEAR].x, deck[DECK_NEAR].y)
          .lineTo(deck[DECK_NEAR].x, deck[DECK_NEAR].y + lip)
          .lineTo(deck[side].x, deck[side].y + lip)
          .closePath()
          .fill(c(RAMPS.NEUTRAL[1]))
      }

      polygon(marks, deck)
      marks.fill(c(RAMPS.NEUTRAL[2]))
      // The lit rim. A deck with no rim is a colour change; a bright rule along
      // the top of both visible faces is what says there is a step there.
      marks
        .moveTo(deck[DECK_LEFT].x, deck[DECK_LEFT].y)
        .lineTo(deck[DECK_NEAR].x, deck[DECK_NEAR].y)
        .lineTo(deck[DECK_RIGHT].x, deck[DECK_RIGHT].y)
        .stroke({ width: 2, color: c(RAMPS.NEUTRAL[4]), alpha: 0.55 })

      /*
       * The car park, on the near edge of the deck. "Car parks that are always
       * full" (§7.8.2), which at 116 px a parcel is four bay lines and their
       * shadow — the information is *that the ground is used*, and any more
       * detail than that is invisible at this size and dear at every other.
       */
      const bays = 5
      for (let k = 1; k <= bays; k++) {
        const t = k / (bays + 1)
        const a = {
          x: deck[DECK_LEFT].x + (deck[DECK_NEAR].x - deck[DECK_LEFT].x) * t,
          y: deck[DECK_LEFT].y + (deck[DECK_NEAR].y - deck[DECK_LEFT].y) * t,
        }
        const b = {
          x: a.x + (deck[DECK_FAR].x - deck[DECK_LEFT].x) * 0.13,
          y: a.y + (deck[DECK_FAR].y - deck[DECK_LEFT].y) * 0.13,
        }
        marks.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 2, color: c(RAMPS.NEUTRAL[3]), alpha: 0.95 })
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
      const deck = deckPoints(selected)
      polygon(marks, deck)
      marks.fill({ color: c(RAMPS.CALM[1]), alpha: 0.22 })
      polygon(marks, deck)
      marks.stroke({ width: 3, color: c(RAMPS.CALM[2]), alpha: 0.9 })
      const near = deck[DECK_NEAR]
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
    ground.alpha = chrome
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
    redrawGround()
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
