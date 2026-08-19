/**
 * One layout language for every rung — GDD §7.7.1, §7.7.2, §26.2.2.
 *
 * ## What this replaces, and why it had to go
 *
 * The city laid its units out from a hand-written list of twelve offsets,
 * indexed `i % 12`. That has three consequences and all of them showed:
 *
 * - **No order.** Unit 3 stands wherever entry 3 of the list happens to be, so
 *   the picture is a scatter. Nothing about where a thing is drawn tells you
 *   which thing it is, and a player who descends into one and comes back cannot
 *   find it again.
 * - **No capacity.** Twelve entries with a modulo means the thirteenth unit is
 *   drawn *on top of* the first. A nation is a hundred towns, so the top of the
 *   ladder could not be drawn at all.
 * - **No correspondence between rungs.** Each rung sat in its own arbitrary
 *   arrangement, so zooming out cross-faded between unrelated images. §10.5 says
 *   nothing cuts; two dissolving scatters technically do not cut, and read as a
 *   cut anyway.
 *
 * ## The rule
 *
 * **Every rung lays its children on the same lattice, and the lattice always
 * fills the same screen box.** Zooming out one rung therefore turns the grid you
 * are standing in into a single cell of the grid above, *in the place that cell
 * already occupies*. That is what makes the hand-off a pull-back rather than a
 * dissolve, and it is a property of the geometry rather than of the easing — no
 * amount of tuning a cross-fade produces it, and none destroys it.
 *
 * ## Why the fill order is shells and not rows
 *
 * Two requirements pull against each other, and row-major satisfies exactly one:
 *
 * 1. **An arrival must not move what is already standing.** §7.7.2's promotion
 *    is "a whole tower slams down beside the last one" — the one thing it must
 *    never look like is the scene rearranging to make room. So a unit's place
 *    has to be a function of its index alone, never of how many there are.
 * 2. **Any number of units must read as a block, not a line.** Row-major on a
 *    lattice big enough for a hundred puts the first ten in a single row across
 *    the horizon, which is the shape the room already had and the reason its
 *    squads looked like a conveyor belt.
 *
 * Filling in **square shells** satisfies both. Shell `s` is the L of cells with
 * `max(col, row) === s`, so the first `(s+1)²` indices are exactly the `(s+1)`
 * square: one, then a 2×2, then a 3×3, and a hundred is a clean 10×10. Every
 * prefix is compact, and no index ever changes its cell.
 *
 * Centring is then the *container's* job, not the cells' — {@link gridCentre}
 * gives the pivot. Moving a pivot slides the whole group together, which reads
 * as the camera pulling back; moving the cells would read as the city being
 * rebuilt around the player every time somebody was hired.
 *
 * Pure and rendererless, so the arrangement can be tested without a canvas —
 * which matters, because "is the fourteenth unit on screen" is a question this
 * module used to answer wrongly and silently.
 */

/**
 * Cell pitch, in local pixels: `w` across the lattice, `d` back into it.
 *
 * `d` is not forced to `w / 2`. A true 2:1 iso lattice packs the rows tightly
 * enough that a rung whose unit is *tall* — rung 4's buildings are a hundred and
 * forty pixels of tower on a plot half that — hides its own back rows behind its
 * front ones. Letting depth open up is the difference between a skyline and a
 * wall.
 */
export interface GridPitch {
  w: number
  d: number
}

/**
 * Which lattice square cell `i` sits in — the shell fill, in one line each way.
 *
 * Shell `s = ⌊√i⌋` holds the `2s + 1` cells with `max(col, row) === s`: down the
 * far edge first, then back along the near one. Independent of how many cells
 * there are, which is requirement 1 in the header.
 */
export function cellSquare(i: number): { col: number; row: number } {
  const index = Math.max(0, Math.floor(Number.isFinite(i) ? i : 0))
  const s = Math.floor(Math.sqrt(index))
  const t = index - s * s
  return t <= s ? { col: s, row: t } : { col: 2 * s - t, row: s }
}

/** The inverse: which cell holds lattice square `(col, row)`. */
export function squareCell(col: number, row: number): number {
  const s = Math.max(col, row)
  return col === s ? s * s + row : s * s + 2 * s - col
}

/** How many cells fit in the smallest square holding `n` of them. */
export function gridSide(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(1, Math.floor(n)))))
}

/**
 * Where cell `i` sits, in lattice-local pixels.
 *
 * **Not centred**, and not a function of `n` — see the header. The origin is
 * cell 0's own square, so every rung's lattice shares it and
 * {@link gridCentre} is what puts the picture in the middle of the frame.
 */
export function cellAt(i: number, pitch: GridPitch): { x: number; y: number } {
  const { col, row } = cellSquare(i)
  return { x: (col - row) * (pitch.w / 2), y: (col + row) * (pitch.d / 2) }
}

/**
 * The order to draw `n` cells in, back to front.
 *
 * A cell lower on screen is nearer the camera and must be drawn last, and the
 * shell order is not that order. Sorted by `y` with the index as a tie-break so
 * the arrangement is identical on every rebuild; an unstable order would repaint
 * the overlaps differently each frame and read as flicker.
 */
export function drawOrder(n: number, pitch: GridPitch): number[] {
  const count = Math.max(0, Math.floor(n))
  return Array.from({ length: count }, (_, i) => i).sort((a, b) => {
    const dy = cellAt(a, pitch).y - cellAt(b, pitch).y
    return dy !== 0 ? dy : a - b
  })
}

/**
 * The lattice's own size for `n` cells, before whatever stands on them.
 *
 * Cell centres only. A caller that draws something taller than a cell — every
 * one of them does — grows this by its own overhang, because only the caller
 * knows how tall its unit is.
 */
export function gridExtent(n: number, pitch: GridPitch): { w: number; h: number } {
  const side = gridSide(n)
  return { w: side * pitch.w, h: side * pitch.d }
}

/**
 * Where the middle of `n` cells is, for the container's pivot.
 *
 * The square shell means the occupied cells always fill a `side × side` square
 * (with the last shell part-built), so the middle of the picture is the middle
 * of that square and not the average of the cells actually placed. Using the
 * average would jitter the whole city sideways on every arrival.
 */
export function gridCentre(n: number, pitch: GridPitch): { x: number; y: number } {
  // `col - row` runs from -(side-1) to +(side-1), so the lattice is already
  // centred across. `col + row` runs from 0 to 2(side-1), so it is not centred
  // in depth, and half of that span is the whole of the offset.
  return { x: 0, y: ((gridSide(n) - 1) * pitch.d) / 2 }
}

/**
 * Which cell a local point is in, or −1 for a point off the grid.
 *
 * The inverse of {@link cellAt}, rounded. Rounding rather than a per-cell
 * containment test is deliberate: the lattice tiles with no gaps, so every point
 * inside it belongs to exactly one cell, and a tap on the corridor between two
 * plots should hit the nearer plot rather than nothing. §4.5b's verb is the
 * whole game at this scale and a miss it cannot explain is worse than a
 * neighbour.
 *
 * A cell past `n` is still a miss. Those are the empty corner of a part-built
 * shell — offering one would buff ten thousand developers who are not there,
 * and `sim/units.ts` would clamp the range to nothing, so the poke would do
 * nothing at all rather than visibly miss.
 */
export function cellAtLocal(x: number, y: number, n: number, pitch: GridPitch): number {
  const count = Math.max(0, Math.floor(n))
  if (count <= 0) return -1
  if (!(pitch.w > 0) || !(pitch.d > 0)) return -1
  if (!Number.isFinite(x) || !Number.isFinite(y)) return -1

  const u = x / (pitch.w / 2)
  const v = y / (pitch.d / 2)
  const col = Math.round((v + u) / 2)
  const row = Math.round((v - u) / 2)
  if (col < 0 || row < 0) return -1

  const i = squareCell(col, row)
  return i < count ? i : -1
}
