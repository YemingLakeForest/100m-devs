/**
 * The statue a game is built as — GDD §8.2a, §7.8.12 [CANON - added 2026-10-14].
 *
 * *"voxel statue! put it in the middle of the room"* — the user's pick from five concepts for what the story
 * points build instead of a whiteboard's picture. The statue is the game's own cover subject (the rocket, the
 * ghost, the sword: `coverPixels.ts`'s twelve) standing up out of its sprite, one voxel to each cell, built from
 * the floor up as the project is. This module is the part of that which is a fact and not a picture: which
 * voxels there are, in what order they stand, how many stand at a given progress, how big a cell is. The
 * renderer (`render/statue.ts`) reads it and draws nothing it did not say.
 *
 * **Bottom row first, left to right.** A statue that grew from its top would hang in the air; this is the order a
 * mason would lay it in, and it is also the order the eye reads a sprite in once it is the right way up. The test
 * pins the order, because the order is the whole of the claim: the numbers (how big a cell is, how deep) were set
 * by looking.
 *
 * **One voxel to a cell, not one to a story point.** The concept page had a voxel per point at a one-person
 * studio, and the game's project is 200 to 300 points against a sprite of 60 to 190 cells, so a voxel stands for
 * a share of the build and not for a point: `voxelsBuilt` is the share. What stays true is the reading: the
 * number of voxels standing is the share of the game built, the same number the HUD's project bar says.
 *
 * Pure — no canvas, no renderer. `art/` may be imported by the renderer and by tests, and by nothing in `sim/`.
 */

import type { CoverSpec } from '../sim/cover.ts'
import { subjectSprite } from './coverPixels.ts'

export interface Voxel {
  /** Columns from the sprite's left edge. */
  col: number
  /** Rows from the sprite's *bottom* edge: row 0 stands on the plinth. */
  row: number
  /** The sprite's own colour for this cell, as `#rrggbb`. */
  colour: string
}

export interface StatueModel {
  /** Sprite width and height, in cells. */
  cols: number
  rows: number
  /** In the order they are built: row by row from the bottom, each row left to right. */
  voxels: readonly Voxel[]
}

const cache = new Map<string, StatueModel>()

/** The voxels of a game's statue. Memoised by the subject alone: the sky and the ground are the cover's, and the statue has neither. */
export function statueModel(spec: CoverSpec): StatueModel {
  const key = `${spec.genre}/${spec.subject}`
  let model = cache.get(key)
  if (model) return model
  const { rows, colours } = subjectSprite(spec)
  const cols = Math.max(...rows.map((r) => r.length))
  const voxels: Voxel[] = []
  for (let i = rows.length - 1; i >= 0; i--) {
    for (let col = 0; col < rows[i].length; col++) {
      const colour = colours[rows[i][col]]
      if (colour) voxels.push({ col, row: rows.length - 1 - i, colour })
    }
  }
  model = { cols, rows: rows.length, voxels }
  cache.set(key, model)
  return model
}

/**
 * How many of `count` voxels stand at `progress` (0 to 1): a bottom-up share of the build, rounded down, so the last
 * voxel stands only when the game is done and never a frame before. Anything that is not a number stands none.
 */
export function voxelsBuilt(count: number, progress: number): number {
  if (!Number.isFinite(progress) || count <= 0) return 0
  return Math.min(count, Math.max(0, Math.floor(progress * count)))
}

/** The statue's size, in metres: the height every subject is stood at, and the widest any may be. A cell follows from them. */
export const STATUE = { height: 2.7, width: 2.1, depthCells: 3 } as const

/**
 * The edge of one cell for this sprite, in metres: the tallest subject and the broadest each fill the box they are
 * allowed (`STATUE`), and the compact ones (a die is ten cells square) are not blown up past the width they may take.
 */
export function cellSize(model: StatueModel): number {
  return Math.min(STATUE.height / model.rows, STATUE.width / model.cols)
}
