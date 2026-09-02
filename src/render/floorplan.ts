/**
 * The floor plan — GDD §7.8.1e [CANON - added 2026-08-31].
 *
 * ## What was wrong
 *
 * Reported as *"still rank and file desks… way too boring"*, and the report is
 * exact. The floor was **one thing repeated at every scale**: a desk is a desk,
 * a row is ten of them, a squad is ten rows, a floor is ten squads on a five by
 * two grid. Nothing anywhere in that hierarchy varied, so a thousand developers
 * came out as a car park of car parks — which is the failure §7.8.1's own "the
 * floor has a grain" section diagnoses one scale down and then commits at the
 * scale above.
 *
 * Three fixes were considered and two rejected:
 *
 * - **Turn people round.** Rejected: §7.8.8 spends the front pose on one thing,
 *   the turn a *selected* developer makes, and says so — "nobody else ever
 *   does. That is what makes it worth something rather than a style choice." A
 *   floor where half the faces are already visible spends that for nothing.
 * - **Rotate some blocks onto the other floor axis.** Rejected: §7.8.1's grain
 *   fixes which axis a row runs on, and it is not a free choice — a row laid
 *   along the way people face puts every developer directly behind the next
 *   one, which is a queue.
 * - **Author the plan.** Taken. The grain *inside* a bank of desks was always
 *   right; what read as a formation was the **outline** of the bank and the
 *   fact that there were ten identical ones. So the floor stops being generated
 *   from a stride and becomes a hand-drawn plan: ten banks of different sizes,
 *   in three different arrangements, with ragged ends, hallways between them,
 *   and amenities standing in the holes.
 *
 * ## The one rule this may not break
 *
 * §7.8.1b: **seat *n* is always the same seat.** Everything here is a pure
 * function of the seat index and a static table, so hiring somebody can never
 * move anybody. The plan is authored once and read; it is never solved for a
 * headcount. `floorplan.test.ts` pins that, and pins that seat 0 is still the
 * plot §7.8.12 holds for the suite's threshold.
 *
 * ## And the first hundred do not move
 *
 * Block 0 is the garage's own squad — ten rows of ten at the origin, exactly
 * where it has always been. §7.8.1c says the unfold leaves the first squad
 * "where it is and the size it is", so the new plan starts *after* it. That
 * also keeps every headcount below a hundred byte-identical, which is the whole
 * opening of the game and not a thing to redesign on the way past.
 *
 * ## Units
 *
 * Seat units throughout — `col` across a row, `row` back into the floor. One
 * col is one tile; one row is {@link PITCH_ROW}'s 2.1 tiles. Nothing in this
 * file is a screen pixel, for the reason §7.8.12 records at length.
 */

/**
 * How a bank of desks is arranged. All three run their rows on the same floor
 * axis — §7.8.1's grain is not negotiable — and vary the *outline* instead.
 */
export type Arrangement =
  /** Continuous rows with ragged ends. The big engineering banks. */
  | 'runs'
  /** Islands of six or eight with real gaps between them. */
  | 'clusters'
  /** Rows in close pairs with a wide aisle between pairs. */
  | 'spine'

/** One continuous run of desks along `col`, at a fixed `row`. */
export interface PlanRun {
  readonly block: number
  readonly col: number
  readonly row: number
  readonly len: number
  /** Global seat index of this run's first seat. */
  readonly from: number
}

export interface PlanBlock {
  readonly name: string
  readonly kind: Arrangement
  /** Seat index of this block's first seat, and how many it holds. */
  readonly from: number
  readonly count: number
  /** Index into {@link PLAN_RUNS} of this block's first run. */
  readonly firstRun: number
  readonly minCol: number
  readonly maxCol: number
  readonly minRow: number
  readonly maxRow: number
}

/** A row's worth of seats, before indices are assigned. */
interface RawRun {
  col: number
  row: number
  len: number
}

interface BlockSpec {
  name: string
  kind: Arrangement
  build(): RawRun[]
}

/**
 * A bank of continuous rows, one length per row, starting at `col`.
 *
 * `lens` is a literal list rather than a width and a count, and that is the
 * point: **the ragged end is authored.** A bank whose rows are 14, 14, 13, 13,
 * 12 long has a silhouette; one whose rows are all ten long is a rectangle, and
 * ten rectangles is the thing being fixed.
 */
function runs(col: number, row: number, step: number, lens: readonly number[]): RawRun[] {
  return lens.map((len, i) => ({ col, row: row + i * step, len }))
}

/**
 * Rows in close pairs — two rows almost touching, then a wide aisle.
 *
 * The pitch alternates instead of being constant, which gives a bank an
 * internal rhythm at no cost to the grain: the row still runs on `col` and
 * still steps on `row`, and only the size of the step changes. Two people
 * back to back with a walkway behind them is also how an office actually
 * arranges a long thin bay.
 */
function spine(col: number, row: number, pairs: number, len: number, tight: number, wide: number): RawRun[] {
  const out: RawRun[] = []
  let r = row
  for (let i = 0; i < pairs; i++) {
    out.push({ col, row: r, len })
    out.push({ col, row: r + tight, len })
    r += tight + wide
  }
  return out
}

/**
 * Islands of desks with real gaps between them.
 *
 * The single biggest change to how a floor reads. A bank of clusters has holes
 * in it, and holes are what the eye uses to tell one bank from another — a
 * continuous field of desks has no features at all above the scale of one desk.
 * The gaps are also where the floor props end up standing.
 */
function clusters(
  col: number,
  row: number,
  across: number,
  down: number,
  islandCols: number,
  islandRows: number,
  gapCol: number,
  gapRow: number,
): RawRun[] {
  const out: RawRun[] = []
  for (let j = 0; j < down; j++) {
    for (let i = 0; i < across; i++) {
      const c = col + i * (islandCols + gapCol)
      const r = row + j * (islandRows + gapRow)
      for (let k = 0; k < islandRows; k++) out.push({ col: c, row: r + k, len: islandCols })
    }
  }
  return out
}

/**
 * **The plan.**
 *
 * Authored, not generated. Read it as a floor plan. Three bands of desks
 * separated by two clear bands, four hallways running the depth of the floor,
 * and the amenities in {@link PLAN_AMENITIES} standing in the gaps:
 *
 *     rows -3.1..-1.1   the back band: the suite, then meeting rooms and the
 *                       quiet end along the back wall
 *     rows  0 ..  9.9   the north band: FIRST HUNDRED | PLATFORM | GROWTH |
 *                       INFRASTRUCTURE
 *     rows 10.3.. 12.7  THE SPINE: kitchenette, plaza, kitchenette, the core
 *     rows 13 .. 20.5   the south band: WINDOW ROW | QUALITY | DATA |
 *                       RELIABILITY
 *     rows 21.4..24.8   the front band, on the street: cafeteria | OVERFLOW |
 *                       SUPPORT
 *
 * The order is the hiring order (§7.8.1b), and it is a **route through the
 * building** rather than a raster scan: fill the block you are in, then the one
 * next door, then cross the floor. That is why the fifth hundred lands across
 * the spine rather than four columns to the right — you can see the studio
 * spread, which a scan cannot show.
 *
 * No two blocks have the same outline, and no two neighbours share an
 * arrangement. That second rule is the one doing the work: a clusters bank next
 * to a runs bank is two different textures meeting at a hallway, which is what
 * an office looks like from above and what ten identical plates never could.
 */
const SPECS: readonly BlockSpec[] = [
  // Block 0 — the garage's own squad. Ten rows of ten at the origin, and it
  // does not move: §7.8.1c leaves the first squad where it is, and every
  // headcount below a hundred is byte-identical to what shipped before.
  { name: 'THE FIRST HUNDRED', kind: 'runs', build: () => runs(0, 0, 1, [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]) },
  // North band, west to east. Clusters first, because the block next to the
  // origin is the one seen at the same time as it and has to look different.
  { name: 'PLATFORM', kind: 'clusters', build: () => clusters(12.5, 0, 4, 4, 4, 2, 1.3, 0.95) },
  { name: 'GROWTH', kind: 'runs', build: () => runs(34, 0, 1.05, [14, 14, 13, 13, 12, 12, 11, 11, 10, 9]) },
  { name: 'INFRASTRUCTURE', kind: 'spine', build: () => spine(49.5, 0, 4, 13, 0.85, 2.1) },
  // South band, west to east again — but entered from the window end, because
  // the route crosses the spine at the plaza and carries on down the far side.
  { name: 'THE WINDOW ROW', kind: 'spine', build: () => spine(0, 13, 4, 8, 0.85, 1.35) },
  { name: 'QUALITY', kind: 'clusters', build: () => clusters(12.5, 13, 4, 3, 4, 2, 1.3, 0.95) },
  { name: 'DATA', kind: 'runs', build: () => runs(34, 13, 1.02, [14, 14, 13, 13, 12, 12, 11, 10]) },
  { name: 'RELIABILITY', kind: 'clusters', build: () => clusters(49.5, 13, 3, 3, 4, 2, 1.0, 0.95) },
  // The front band, along the street, taken last and packed tighter than
  // anything else on the floor — the row step is 0.85 where the rest of the
  // floor uses 1.0. §7.8.1's crowding, expressed as *where the last hires go*
  // rather than as props disappearing.
  { name: 'OVERFLOW', kind: 'runs', build: () => runs(12, 21.4, 0.85, [34, 33, 33, 32, 31, 30]) },
  { name: 'SUPPORT', kind: 'clusters', build: () => clusters(49.5, 21.4, 2, 2, 6, 2, 1.5, 0.9) },
]

/**
 * What stands in the holes — GDD §7.8.1e, and the reason the plan owns them.
 *
 * An amenity placed by the renderer is an amenity that will eventually be
 * placed on somebody's desk. These are rectangles reserved *in the same table
 * the seats come out of*, so the two cannot disagree; `floorplan.test.ts`
 * asserts that no seat is inside one.
 *
 * The back band is free floor that was already reserved: {@link
 * FLOOR_BACK_ROWS} is 3.3 rows deep and §7.8.12's suite only uses the western
 * end of it, so everything east of the suite's glass is two clear rows against
 * the back wall — which is exactly where an office puts its meeting rooms.
 * **They cost no seats**, the same argument the plaza makes in §7.8.1d.
 */
export type AmenityKind =
  /** A glass box against the back wall. Table, chairs, a lit screen. */
  | 'meeting'
  /** Shelves, two armchairs and a lamp. The quiet end. */
  | 'library'
  /** A tea point along the back wall — counter, urn, mugs. */
  | 'pantry'
  /** An island with stools, in the spine. The kitchenette. */
  | 'kitchenette'
  /** Lifts, risers and the WCs — the one solid volume on the floor. */
  | 'core'
  /** Rug, two sofas, a low table and a floor lamp. */
  | 'breakout'
  /** Tables, a counter and plants, at the street end. */
  | 'cafeteria'

export interface AmenityPlot {
  readonly kind: AmenityKind
  readonly name: string
  readonly minCol: number
  readonly maxCol: number
  readonly minRow: number
  readonly maxRow: number
}

/**
 * The amenities, in seat units.
 *
 * Named, because a room with a name on the plan is a room somebody decided to
 * build. The names are also what the caps on the partitions are for: §0's
 * `isoCap` puts three pixels of colour on a partition's top edge, and that is
 * how a 960-pixel frame tells one of these apart from another.
 */
export const PLAN_AMENITIES: readonly AmenityPlot[] = [
  // --- the back band, east of the suite's glass --------------------------
  //
  // Four rooms, the lift core and a tea point, in the 2 clear rows between the
  // back wall and row 0. Two arguments for putting them here rather than in the
  // middle of the floor. They cost no seats — this band was already reserved.
  // And they are the only landmarks with a **wall behind them**, so the core can
  // be two and a half tiles tall without standing in front of the desks one band
  // back: there are no desks one band back, there is brick.
  { kind: 'meeting', name: 'FOCUS', minCol: 6.5, maxCol: 13, minRow: -3.1, maxRow: -1.15 },
  { kind: 'meeting', name: 'THE SNUG', minCol: 14.5, maxCol: 21, minRow: -3.1, maxRow: -1.15 },
  { kind: 'meeting', name: 'BOARD', minCol: 22.5, maxCol: 31.4, minRow: -3.1, maxRow: -1.15 },
  { kind: 'library', name: 'THE QUIET END', minCol: 33, maxCol: 43, minRow: -3.1, maxRow: -1.15 },
  { kind: 'core', name: 'THE CORE', minCol: 44.5, maxCol: 54, minRow: -3.1, maxRow: -1.15 },
  { kind: 'pantry', name: 'TEA POINT', minCol: 55.5, maxCol: 62.5, minRow: -3.1, maxRow: -1.5 },
  // --- the spine ---------------------------------------------------------
  //
  // The plaza is not listed here: `plaza.ts` owns it and draws itself, and
  // duplicating its footprint in this table is how the two start to disagree.
  // Its centre is {@link PLAN_PLAZA}, below, which both of them read.
  { kind: 'kitchenette', name: 'THE KITCHENETTE', minCol: 3, maxCol: 9.4, minRow: 10.4, maxRow: 12.4 },
  { kind: 'kitchenette', name: 'THE SECOND KITCHEN', minCol: 33.5, maxCol: 39.5, minRow: 10.4, maxRow: 12.4 },
  { kind: 'breakout', name: 'THE SPINE NOOK', minCol: 44, maxCol: 52.5, minRow: 10.4, maxRow: 12.5 },
  // --- the nooks between the banks ---------------------------------------
  { kind: 'breakout', name: 'THE WINDOW NOOK', minCol: 8.6, maxCol: 11.8, minRow: 13.2, maxRow: 15.6 },
  { kind: 'breakout', name: 'THE SECOND NOOK', minCol: 8.6, maxCol: 11.8, minRow: 17.4, maxRow: 19.8 },
  { kind: 'breakout', name: 'THE LONG NOOK', minCol: 46, maxCol: 48.6, minRow: 21.4, maxRow: 24 },
  // --- the street end ----------------------------------------------------
  { kind: 'cafeteria', name: 'THE CANTEEN', minCol: 0, maxCol: 10.4, minRow: 21, maxRow: 25.4 },
]

/**
 * Where §7.8.1d's plaza stands, in seat units.
 *
 * In the spine, west of the core and east of the second kitchenette, on the
 * axis of the hallway that runs down from the origin block — so the statue is
 * at the end of a sightline rather than in the middle of a field. It does not
 * move as the studio grows: at a hundred and one developers it is an empty ring
 * on an empty floor, which is honest. The building is built for a thousand and
 * there are a hundred of you.
 */
export const PLAN_PLAZA = { col: 21.7, row: 11.5 } as const

function assemble() {
  const blocks: PlanBlock[] = []
  const planRuns: PlanRun[] = []
  let seat = 0
  SPECS.forEach((spec, b) => {
    const raw = spec.build()
    const from = seat
    const firstRun = planRuns.length
    let minCol = Infinity
    let maxCol = -Infinity
    let minRow = Infinity
    let maxRow = -Infinity
    for (const r of raw) {
      planRuns.push({ block: b, col: r.col, row: r.row, len: r.len, from: seat })
      seat += r.len
      minCol = Math.min(minCol, r.col)
      maxCol = Math.max(maxCol, r.col + r.len - 1)
      minRow = Math.min(minRow, r.row)
      maxRow = Math.max(maxRow, r.row)
    }
    blocks.push({ name: spec.name, kind: spec.kind, from, count: seat - from, firstRun, minCol, maxCol, minRow, maxRow })
  })
  return { blocks, planRuns, capacity: seat }
}

const ASSEMBLED = assemble()

/** Every bank on the floor, in hiring order. */
export const PLAN_BLOCKS: readonly PlanBlock[] = ASSEMBLED.blocks
/** Every run of desks, in hiring order. */
export const PLAN_RUNS: readonly PlanRun[] = ASSEMBLED.planRuns
/** How many seats the plan holds. Must cover `ROOM_DEV_CAP`. */
export const PLAN_CAPACITY = ASSEMBLED.capacity

/** The plan's extent on the floor lattice, in seat units — desks only. */
export const PLAN_BOUNDS = {
  minCol: Math.min(...PLAN_BLOCKS.map((b) => b.minCol)),
  maxCol: Math.max(...PLAN_BLOCKS.map((b) => b.maxCol)),
  minRow: Math.min(...PLAN_BLOCKS.map((b) => b.minRow)),
  maxRow: Math.max(...PLAN_BLOCKS.map((b) => b.maxRow)),
}

/**
 * A flat index from seat to run, built once.
 *
 * Ten blocks of a hundred-odd runs is small enough to search, and this is
 * called once per developer per rebuild at a thousand developers — which is the
 * one place in this file where a linear scan would actually show up.
 */
const RUN_OF_SEAT: number[] = (() => {
  const out: number[] = new Array(PLAN_CAPACITY)
  PLAN_RUNS.forEach((r, i) => {
    for (let k = 0; k < r.len; k++) out[r.from + k] = i
  })
  return out
})()

export interface PlanSeat {
  readonly col: number
  readonly row: number
  /** Which bank this seat belongs to, and which run inside it. */
  readonly block: number
  readonly run: number
  /** Position along the run, so a divider knows whether it has a neighbour. */
  readonly inRun: number
  readonly runLen: number
}

/**
 * Where seat `index` sits. §7.8.1b's reading order, read out of the plan.
 *
 * Past the plan's capacity the last seat is repeated rather than throwing: the
 * room is capped at `ROOM_DEV_CAP` and a renderer is the wrong place to
 * discover that a cap has been raised without the plan being widened. The test
 * that the plan covers the cap is in `floorplan.test.ts`, where it can fail
 * loudly instead.
 */
export function planSeat(index: number): PlanSeat {
  const i = Math.max(0, Math.min(PLAN_CAPACITY - 1, Math.floor(index)))
  const run = PLAN_RUNS[RUN_OF_SEAT[i]]
  const inRun = i - run.from
  return { col: run.col + inRun, row: run.row, block: run.block, run: RUN_OF_SEAT[i], inRun, runLen: run.len }
}

/**
 * The runs that are at least partly occupied at this headcount, clipped.
 *
 * Desks are drawn a run at a time — one call per continuous bank rather than
 * one per seat — so this is the shape the renderer actually wants, and it keeps
 * the clipping arithmetic in the module that owns the plan.
 */
export function occupiedRuns(devs: number): Array<{ run: PlanRun; len: number }> {
  const n = Math.max(0, Math.min(PLAN_CAPACITY, Math.floor(devs)))
  const out: Array<{ run: PlanRun; len: number }> = []
  for (const run of PLAN_RUNS) {
    if (run.from >= n) break
    out.push({ run, len: Math.min(run.len, n - run.from) })
  }
  return out
}

/**
 * **A plate.** One island of desks, with the outline the desks actually have.
 *
 * §7.8.1c's unfold needs something to turn, and what it used to turn was ten
 * identical rectangles on a five-by-two grid — half the reason a full floor
 * read as a parade ground, since the *plates* were the largest shapes in the
 * frame and they were all the same shape.
 *
 * An island is a maximal group of runs that touch: their column ranges overlap
 * and their rows are within a row-step of each other. That definition falls out
 * differently for each arrangement, which is the whole point — a `runs` bank is
 * one island with a staircase edge, a `clusters` bank is sixteen small ones with
 * real gaps between them, a `spine` bank is four long thin pairs. Fifty plates
 * of five different sizes, instead of ten of one.
 */
export interface PlanPlate {
  readonly block: number
  /**
   * The seats standing on this plate — a contiguous span.
   *
   * Contiguous is not an accident and is worth stating: every builder emits an
   * island's runs consecutively, and the grouping rule below only ever joins
   * runs that a builder emitted together. So a plate is a seat *range*, which is
   * what lets the room tint the one plate the next hire lands on rather than the
   * whole bank it belongs to.
   */
  readonly from: number
  readonly count: number
  /** The outline in seat units, as `[col, row]`, running clockwise. */
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly minCol: number
  readonly maxCol: number
  readonly minRow: number
  readonly maxRow: number
  /** The corner nearest the origin — §7.8.1c hinges the panel on it. */
  readonly hinge: readonly [number, number]
}

/** How far past the desks a plate reaches, in seat units. */
const PLATE_PAD_COL = 0.85
const PLATE_PAD_ROW = 0.42
/** Two runs are on the same island if they are no further apart than this. */
const ISLAND_ROW_GAP = 1.12
const ISLAND_COL_GAP = 0.4

function buildPlates(): PlanPlate[] {
  const plates: PlanPlate[] = []
  PLAN_BLOCKS.forEach((block, b) => {
    const mine = PLAN_RUNS.filter((r) => r.block === b)
    // Union-find over runs, so the arrangement does not have to be special-cased
    // here. Three arrangements and one grouping rule beats three groupers.
    const parent = mine.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i]
        const c = mine[j]
        const colsTouch =
          a.col <= c.col + c.len - 1 + ISLAND_COL_GAP && c.col <= a.col + a.len - 1 + ISLAND_COL_GAP
        if (colsTouch && Math.abs(a.row - c.row) <= ISLAND_ROW_GAP) parent[find(i)] = find(j)
      }
    }
    const groups = new Map<number, PlanRun[]>()
    mine.forEach((run, i) => {
      const key = find(i)
      const g = groups.get(key)
      if (g) g.push(run)
      else groups.set(key, [run])
    })

    for (const group of groups.values()) {
      /*
       * The outline, and **every edge of it has to lie on a floor axis.**
       *
       * §7.8.12's rule one scale down: in this projection an edge runs at a
       * screen slope of ±0.50 or it is not on the ground, and there is no third
       * direction available. So the walk is: down the near side, one row-
       * constant step across the bottom, back up the far side, one row-constant
       * step across the top. Each row's side edge is extended to meet the *next*
       * row's, which both closes the aisle gap (a plate with slots cut out of it
       * is not a plate) and keeps the corner steps square.
       *
       * The first version pushed the two sides in the same row order and then
       * reversed the flat array, which reverses inside each pair as well — so
       * the polygon jumped from the near-right corner to the far-left one and
       * every plate on the floor had a diagonal in it.
       */
      const rows = [...group].sort((p, q) => p.row - q.row)
      const edge = (i: number) => {
        const run = rows[i]
        const next = rows[i + 1]
        return {
          c0: run.col - PLATE_PAD_COL,
          c1: run.col + run.len - 1 + PLATE_PAD_COL,
          top: run.row - PLATE_PAD_ROW,
          bottom: next ? next.row - PLATE_PAD_ROW : run.row + PLATE_PAD_ROW,
        }
      }
      const points: Array<readonly [number, number]> = []
      for (let i = 0; i < rows.length; i++) {
        const e = edge(i)
        points.push([e.c1, e.top], [e.c1, e.bottom])
      }
      for (let i = rows.length - 1; i >= 0; i--) {
        const e = edge(i)
        points.push([e.c0, e.bottom], [e.c0, e.top])
      }
      let minCol = Infinity
      let maxCol = -Infinity
      let minRow = Infinity
      let maxRow = -Infinity
      for (const [col, row] of points) {
        minCol = Math.min(minCol, col)
        maxCol = Math.max(maxCol, col)
        minRow = Math.min(minRow, row)
        maxRow = Math.max(maxRow, row)
      }
      const first = Math.min(...group.map((r) => r.from))
      const count = group.reduce((sum, r) => sum + r.len, 0)
      plates.push({ block: b, from: first, count, points, minCol, maxCol, minRow, maxRow, hinge: [minCol, minRow] })
    }
    void block
  })
  return plates
}

/** Every plate on the floor, in hiring order — §7.8.1c turns these. */
export const PLAN_PLATES: readonly PlanPlate[] = buildPlates().sort((a, b) => a.from - b.from)

/**
 * Which plate seat `index` stands on.
 *
 * Used for one thing and it is worth the lookup: §7.8.1d put the warning ramp on
 * the lip of the plate the next hire lands on, because §7.8.1b has always
 * promised that hire *n* takes the next seat and nothing on screen ever said
 * which one. Under the old five-by-two grid that was one plate in ten; here it
 * can be one island of six, which says it far more precisely.
 */
export function plateOfSeat(index: number): number {
  const i = Math.max(0, Math.min(PLAN_CAPACITY - 1, Math.floor(index)))
  for (let k = 0; k < PLAN_PLATES.length; k++) {
    const plate = PLAN_PLATES[k]
    if (i >= plate.from && i < plate.from + plate.count) return k
  }
  return PLAN_PLATES.length - 1
}

/**
 * §7.8.6 — the walkable lattice, read off the plan.
 *
 * Two kinds of line, and both are facts about the plan rather than about the
 * headcount: an **aisle** behind every row of desks (the row runs on `col`, so
 * an aisle is a row value), and a **hallway** in every column gap wide enough
 * to walk down. The hallways are the ones the old lattice could not have had:
 * a stride-generated floor has corridors where the arithmetic puts them, and an
 * authored one has them where the plan drew them.
 */
export interface PlanLattice {
  /** Row values, in seat units, with clear floor along them. */
  readonly aisles: readonly number[]
  /** Column values, in seat units, with clear floor down them. */
  readonly hallways: readonly number[]
}

/** How wide a column gap has to be before somebody can walk down it. */
const HALLWAY_MIN = 1.3

/**
 * The lattice **at a headcount**, not in general — and that is the point.
 *
 * §7.8.1's crowding, told in the one place it can be told without deleting
 * anything: the hallway between PLATFORM and GROWTH runs the full depth of the
 * north and south bands, and then the front band fills, and OVERFLOW is drawn
 * straight across the end of it. Past about eight hundred developers **that
 * hallway is no longer a hallway**, because there are desks in the way — so
 * §7.8.6's walkers stop using it, without a rule anywhere saying they should.
 *
 * A router holding last headcount's lanes walks somebody down a corridor that
 * is now four desks, which is the defect `roomLanes` was written to fix; this
 * is the same guarantee moved into the module that owns the floor.
 */
export function planLattice(devs: number): PlanLattice {
  const occupied = occupiedRuns(devs)
  // Already offset by `walkPath.ts`'s LANE_BEHIND — a lane sits half a row
  // pitch behind the desks it serves, so these are row *positions* and not row
  // indices. The perimeter lane in front of row zero is the same half step on
  // the other side of it.
  const aisleSet = new Set<number>([-0.5])
  let deepest = 0
  for (const { run } of occupied) {
    aisleSet.add(Math.round((run.row + 0.5) * 100) / 100)
    deepest = Math.max(deepest, run.row)
  }
  aisleSet.add(Math.round((deepest + 1.5) * 100) / 100)
  // The spine is not behind any row — it is the clear band between the two deep
  // bands, and it is the widest walkable thing on the floor.
  aisleSet.add(PLAN_PLAZA.row)

  // Hallways: scan the occupied column intervals and take the gaps. Computed
  // rather than listed, so moving a block moves the hallway beside it — and so
  // that building over one closes it.
  const spans = occupied
    .map(({ run, len }) => [run.col - 0.5, run.col + len - 0.5] as const)
    .sort((a, b) => a[0] - b[0])
  const hallways: number[] = []
  if (spans.length === 0) return { aisles: [...aisleSet].sort((a, b) => a - b), hallways: [-2, 2] }
  let reach = spans[0][1]
  let widest = spans[0][1]
  for (const [from, to] of spans) {
    if (from - reach >= HALLWAY_MIN) hallways.push(Math.round(((reach + from) / 2) * 100) / 100)
    reach = Math.max(reach, to)
    widest = Math.max(widest, to)
  }
  hallways.push(spans[0][0] - 1.5, widest + 1.5)
  return { aisles: [...aisleSet].sort((a, b) => a - b), hallways: hallways.sort((a, b) => a - b) }
}
