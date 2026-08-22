/**
 * Level 4 — the block: ten towers on a street, and the one you are in.
 *
 * `docs/HANDOFF-2026-08-20.md` §9-11 built the four levels below this one, and
 * the argument for adding a fifth is the same one that built the fourth: the
 * studio you can see should be the studio you have. Past ten thousand
 * developers a single tower is full, and §7.7.1's answer to a full tower is
 * that you stop adding floors and start adding **buildings**.
 *
 * ## The composition, and why it is not the plate stack again
 *
 * `frames.ts` records the measurement in full. The short version: ten floor
 * plans could not be arranged in a 2.23:1 frame at any useful size, because ten
 * 2:1 rectangles is a packing problem the diamond containment rule wins. Ten
 * *towers* is a different problem — a tower is tall and narrow, so what has to
 * clear its neighbour is a 230-unit footprint rather than a 604-unit plan — and
 * five across by two back comes out at **80 x 194 px a tower**, with fifteen
 * units of street along each row.
 *
 * Across the rows they overlap: four of the ten stand half in front of four
 * others, because a 2:1 lattice puts the plot one along and one nearer at the
 * same x. That is a city block rather than a defect — every tower keeps a band
 * of itself, 89 px on the worst of them, and the picker resolves nearest-first
 * so the band belongs to the building it looks like it belongs to.
 *
 * ## What this file draws, and what it does not
 *
 * It draws the ground, the streets, the plot pads, and a tower for every
 * building **except the one the address is in**. That last one is drawn by
 * `building.ts`, parented into this file's own plot container — which is the
 * nesting rule the whole camera rests on, applied one level out: a child is
 * authored inside its parent's cell, so descending into a building is a single
 * affine transform and there is nothing to cross-fade.
 *
 * The hand-off is invisible for the same reason the plan-to-room swap is
 * invisible: both sides of it are {@link drawTower}, at the same size, in the
 * same place.
 *
 * ## And this block is one of ten
 *
 * `park.ts` builds ten of these and parcels them out across a business park, so
 * nothing here may assume it is *the* block any more. It is told which one it
 * is ({@link BlockHandle.setBlock}) and asks the model about that one; the only
 * thing it draws for the whole studio is its own street plane, and that one
 * fades out when the park's podiums take over ({@link
 * BlockHandle.setGroundAlpha}).
 *
 * Procedural, from the master palette. ART_DIRECTION §7.8.2 — nothing above the
 * room gets a bespoke sprite.
 */

import { Container, Graphics } from 'pixi.js'
import { RAMPS, hexToRgb } from '../art/palette.ts'
import {
  BLOCKS_PER_PARK,
  BLOCK_SCALE,
  BUILDINGS_PER_BLOCK,
  PODIUM_W,
  SHADOW_SPREAD,
  TOWER_GROUND,
  PLOT_STRIDE_X,
  PLOT_STRIDE_Y,
  buildingAt,
  buildingsIn,
  devsIn,
  devsOnBlock,
  plotAt,
  plotDepth,
  storeysIn,
} from './frames.ts'
import { drawTower } from './building.ts'

function c(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/**
 * How far the ground runs past the outermost plot.
 *
 * The towers use 534 px of a 997 px frame — a 2:1 lattice buys one unit across
 * for every half unit back, so ten of them are height-bound long before they
 * are width-bound. The ground is what fills the rest, and §3.3 is explicit that
 * *scenery* may run under the rails where content may not. A block with nothing
 * around it reads as ten towers on a raft.
 */
const GROUND_SPREAD = 520

/** One plot's pad — a 2:1 diamond, a little smaller than the stride. */
const PAD_W = PLOT_STRIDE_X * 1.62
const PAD_D = PAD_W / 2

/** Draw a 2:1 diamond centred on (x, y). */
function diamond(g: Graphics, x: number, y: number, w: number, d: number) {
  g.moveTo(x - w / 2, y)
    .lineTo(x, y - d / 2)
    .lineTo(x + w / 2, y)
    .lineTo(x, y + d / 2)
    .closePath()
}

/**
 * Where a plot's pad sits — on the tower's own ground plane.
 *
 * {@link TOWER_GROUND} is the shaft's near corner, which is where the plinth
 * deck is centred and therefore where the building meets the ground. This was
 * `PLOT_DROP`, a hand-written number ten block units lower, so every pad was
 * drawn *in front of* the building standing on it and the block read as ten
 * towers hovering over their own plots.
 */
const PAD_Y = TOWER_GROUND * BLOCK_SCALE

export interface BlockHandle {
  container: Container
  /**
   * Where a building's own container belongs — its plot, at {@link BLOCK_SCALE}.
   *
   * The focused building is parented in here rather than drawn beside the
   * block, for the same reason the room is parented into a plate: a child
   * authored inside its parent's cell needs no second opinion about where it
   * is.
   */
  plotHost(plot: number): Container
  /**
   * Which of the park's ten blocks this is.
   *
   * Every question this file asks the model — how many buildings stand here,
   * how tall the tower on plot 3 is, how many people are in it — is a question
   * about one block, and the answers differ by a hundred thousand people
   * between the first and the last.
   */
  setBlock(block: number): void
  /** Rebuild for a headcount. Cheap on change, far too dear per frame. */
  setHeadcount(devs: number): void
  /**
   * Which plot the address is on — the one this file does *not* draw — or −1
   * when the address is in another block entirely and every tower here is this
   * file's to draw.
   */
  setFocus(plot: number): void
  /** Which plot has been named but not entered, or −1. */
  setSelected(plot: number): void
  /** Fade the block out as the camera goes into one of its buildings. */
  setChromeAlpha(alpha: number): void
  /**
   * Fade the block's own *ground* — its street plane, not its plots.
   *
   * Separate from {@link setChromeAlpha} because the two answer different
   * questions and they point in opposite directions. The chrome asks "is the
   * block still the subject", and fades as the camera goes indoors. The ground
   * asks "is this block the whole picture": {@link GROUND_SPREAD} runs it far
   * past the outermost plot so that ten towers do not sit on a raft, and at
   * parcel scale that plane is wider than the boulevard between two parcels —
   * so one block's ground would be painted across its neighbours. The park
   * draws matching podiums instead, and this hands over to them.
   */
  setGroundAlpha(alpha: number): void
  readonly buildings: number
}

/**
 * One block. **Ten of these is the park**, which is the whole of what the fifth
 * level cost in this file: a block that used to be the studio is now one of ten
 * and has to be told which one it is, because "how many buildings do I have"
 * and "how tall is my third tower" are questions with ten different answers.
 */
export function buildBlock(): BlockHandle {
  const root = new Container()
  const ground = new Graphics()
  const marks = new Graphics()
  root.addChild(ground, marks)

  /** One container per plot, in drawing order: furthest first. */
  const plots: Container[] = []
  const towers: Graphics[] = []
  for (let i = 0; i < BUILDINGS_PER_BLOCK; i++) {
    const plot = new Container()
    const at = plotAt(i)
    plot.position.set(at.x, at.y)
    plot.scale.set(BLOCK_SCALE)
    const g = new Graphics()
    plot.addChild(g)
    plots.push(plot)
    towers.push(g)
  }
  /*
   * **Nearer plots last.** The scene graph is what puts one tower in front of
   * another, and "nearer" on a 2:1 lattice is simply further down the screen —
   * `plotDepth` is the same `col + row` the y coordinate is built from. Sorting
   * once here means nothing downstream has to think about it, including
   * whichever plot the focused building is parented into.
   */
  const order = [...plots.keys()].sort((a, b) => plotDepth(a) - plotDepth(b))
  for (const i of order) root.addChild(plots[i])

  /** The two fades the ground is subject to, multiplied rather than fought over. */
  let chrome = 1
  let groundFade = 1

  let devs = 0
  let block = 0
  let buildings = 1
  let focus = 0
  let selected = -1

  /**
   * This block's plot `i`, as a building of the park.
   *
   * The one conversion this file needs, and it is here rather than at four call
   * sites: `storeysIn` and `devsIn` count people into a park-wide building
   * number, and every index in this file is a plot of one block.
   */
  const buildingOfPlot = (plot: number) => buildingAt(plot, block)

  function redrawGround() {
    ground.clear()
    const first = plotAt(0)
    const last = plotAt(BUILDINGS_PER_BLOCK - 1)
    const midX = (first.x + last.x) / 2
    const midY = (first.y + last.y) / 2
    // The ground. NEUTRAL[1] and never NEUTRAL[0] — the app's background *is*
    // NEUTRAL[0], so a ground plane painted in it is a hole and the towers
    // stand on nothing.
    diamond(ground, midX, midY + PAD_Y, GROUND_SPREAD * 2.6, GROUND_SPREAD * 1.3)
    ground.fill(c(RAMPS.NEUTRAL[1]))

    // The streets: one line down each row and each column of the lattice, drawn
    // past the plots so the block sits in a city rather than on a raft.
    for (let row = 0; row < 2; row++) {
      const a = plotAt(row * 5)
      const b = plotAt(row * 5 + 4)
      ground
        .moveTo(a.x - PLOT_STRIDE_X * 2.2, a.y - PLOT_STRIDE_Y * 2.2 + PAD_Y)
        .lineTo(b.x + PLOT_STRIDE_X * 2.2, b.y + PLOT_STRIDE_Y * 2.2 + PAD_Y)
        .stroke({ width: 3, color: c(RAMPS.NEUTRAL[2]), alpha: 0.55 })
    }
    for (let col = 0; col < 5; col++) {
      const a = plotAt(col)
      const b = plotAt(col + 5)
      ground
        .moveTo(a.x + PLOT_STRIDE_X * 1.6, a.y - PLOT_STRIDE_Y * 1.6 + PAD_Y)
        .lineTo(b.x - PLOT_STRIDE_X * 1.6, b.y + PLOT_STRIDE_Y * 1.6 + PAD_Y)
        .stroke({ width: 3, color: c(RAMPS.NEUTRAL[2]), alpha: 0.55 })
    }
  }

  function redrawMarks() {
    marks.clear()
    // A pad under every plot the studio has built, and nothing under the ones
    // it has not: §7.7.1 again, at the scale where it is a vacant lot.
    for (let i = 0; i < buildings; i++) {
      const at = plotAt(i)
      diamond(marks, at.x, at.y + PAD_Y, PAD_W, PAD_D)
      marks.fill(c(RAMPS.NEUTRAL[2]))
      /*
       * The contact shadow, centred on the plinth and oversailing it — so what
       * shows is a **rim** around the deck rather than a smear under it. That
       * rim is the whole of what says a heavy object is resting on something,
       * and drawing it anywhere but under the plinth is what made the towers
       * look as though they were hanging above their plots.
       */
      marks
        .ellipse(
          at.x,
          at.y + PAD_Y,
          PODIUM_W * SHADOW_SPREAD * BLOCK_SCALE,
          (PODIUM_W / 2) * SHADOW_SPREAD * BLOCK_SCALE,
        )
        .fill({ color: c(RAMPS.NEUTRAL[0]), alpha: 0.65 })
    }
    if (selected >= 0 && selected < buildings) {
      /*
       * **The named building says so three ways**, which is the lesson §7's
       * selection feedback learned one level down: a thin outline on a picture
       * already made of outlines is one more outline. A phosphor wash on the
       * pad, a heavier ring round it, and a tick standing off the near corner.
       */
      const at = plotAt(selected)
      diamond(marks, at.x, at.y + PAD_Y, PAD_W, PAD_D)
      marks.fill({ color: c(RAMPS.CALM[1]), alpha: 0.22 })
      diamond(marks, at.x, at.y + PAD_Y, PAD_W, PAD_D)
      marks.stroke({ width: 3, color: c(RAMPS.CALM[2]), alpha: 0.9 })
      marks
        .moveTo(at.x, at.y + PAD_Y + PAD_D / 2)
        .lineTo(at.x, at.y + PAD_Y + PAD_D / 2 + 16)
        .stroke({ width: 3, color: c(RAMPS.CALM[2]) })
    }
  }

  function redrawTowers() {
    for (let i = 0; i < BUILDINGS_PER_BLOCK; i++) {
      const g = towers[i]
      g.clear()
      // The focused building draws itself, in this same plot. Drawing it twice
      // would be two pictures of one object, at the same size, in the same
      // place — which is not a cross-fade only because it never moves.
      if (i >= buildings || i === focus) continue
      const b = buildingOfPlot(i)
      drawTower(g, storeysIn(devs, b), devsIn(devs, b))
    }
  }

  function redrawAll() {
    redrawGround()
    redrawMarks()
    redrawTowers()
  }

  redrawAll()

  return {
    container: root,

    plotHost(plot: number) {
      return plots[Math.max(0, Math.min(BUILDINGS_PER_BLOCK - 1, Math.floor(plot)))]
    },

    setBlock(next: number) {
      const b = Math.max(0, Math.min(BLOCKS_PER_PARK - 1, Math.floor(next)))
      if (b === block) return
      block = b
      buildings = buildingsIn(devs, block)
      redrawAll()
    },

    setHeadcount(next: number) {
      const n = Math.max(0, Math.floor(Number.isFinite(next) ? next : 0))
      if (n === devs) return
      /*
       * **Only the block that changed redraws**, and at a hundred towers that
       * is the difference between a hire costing ten of them and ninety. It
       * falls out of §7.7.1's fill order for free: blocks fill in order, so
       * every block below the last one is full and its answer to
       * `buildingsIn`/`devsIn` never moves again. The comparison is on this
       * block's own occupancy rather than on the studio's.
       */
      const before = devsOnBlock(devs, block)
      devs = n
      if (devsOnBlock(devs, block) === before) return
      buildings = buildingsIn(devs, block)
      redrawAll()
    },

    setFocus(plot: number) {
      const p = Math.floor(plot)
      const b = p < 0 ? -1 : Math.min(BUILDINGS_PER_BLOCK - 1, p)
      if (b === focus) return
      focus = b
      redrawTowers()
    },

    setSelected(plot: number) {
      const b = Math.floor(plot)
      if (b === selected) return
      selected = b
      redrawMarks()
    },

    setChromeAlpha(alpha: number) {
      const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1))
      chrome = a
      ground.alpha = a * groundFade
      marks.alpha = a
      // Only the towers this file draws. The focused plot's container holds the
      // real building, and that one has its own chrome fade — dimming it from
      // here would dim it twice on the way in.
      for (const g of towers) g.alpha = a
    },

    setGroundAlpha(alpha: number) {
      const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1))
      groundFade = a
      ground.alpha = chrome * a
    },

    get buildings() {
      return buildings
    },
  }
}
