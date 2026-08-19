/**
 * What a *unit* is worth — GDD §26.2.2, and the arithmetic §26.2.5 line 4 asks
 * for.
 *
 * `output.ts` answers what one person is worth. This answers the same question
 * about a squad, a floor, a town and a nation, and it has to answer it in a way
 * that satisfies two requirements that pull against each other hard.
 *
 * ## 1. The aggregate must equal its parts, and "to the last story point"
 *
 * §26.2.3: *"The aggregate's numbers have to **equal** the sum of the
 * individuals it generates, or the player catches the game lying the first time
 * they check. That equality is the acceptance test for the whole phase."*
 *
 * The obvious implementation is bottom-up — roll every person, add them up —
 * and it is not available at the scale the phase is named after: a hundred
 * million `exp` calls is not a thing to do on a tick, and §26.2.2's whole rule
 * is that the people *do not exist* until somebody looks.
 *
 * So the sum runs the other way. **A unit's weight is divided among its
 * children, normalised within the parent**, so
 *
 * > `weight(unit) = Σ weight(children)`
 *
 * holds **by construction, at every level, at every headcount**, and opening one
 * unit costs one sibling group — never a headcount. Nothing here ever loops
 * over more than {@link MAX_GROUP} objects, at any studio size.
 *
 * ## 2. §4.9a's spread has to survive, and its mean has to stay pinned
 *
 * The old {@link module:sim/output} normalised globally, against a prefix table
 * of the first ten thousand rolls, and returned **exactly 1** for every seat
 * past it. That was correct while nothing above the room could be looked at:
 * *"past it individual developers are not drawn, not pokeable and not shown a
 * numeral, so their rolls have nobody to be compared with."*
 *
 * §26.2 is precisely the phase that gives them somebody to be compared with,
 * and the flat tail would have made its gate line vacuous — a block past seat
 * ten thousand would state 100, generate a hundred *identical* people, and sum
 * to 100. It would pass while nothing had been built, which is the worst kind
 * of green.
 *
 * Under top-down normalisation the mean is pinned **without a table at all**:
 * the root's weight is the headcount, every level divides it exactly, so the
 * shares over any roster sum to the headcount for free. Not "to within a
 * percent over ten thousand samples" — by definition of the recursion, at a
 * hundred million seats as much as at forty.
 *
 * ## Why big units are nearly identical and people are not
 *
 * A unit's multiplier is drawn at `σ / √size` (see {@link unitSigma}), which is
 * not a taste decision — it is the standard error of the mean of `size` draws
 * from §4.9a's distribution. A squad of a hundred really is the average of a
 * hundred people and really does vary about a tenth as much as one of them; a
 * town of a million is flat to four decimal places, because towns of a million
 * people are. Giving every rung the same σ would have made a nation as volatile
 * as a graduate, which is the sort of thing that is invisible in a unit test and
 * obvious the moment two towns are on screen together.
 *
 * Pure, deterministic, and dependency-free apart from the shared hash — so the
 * rule that decides what a nation is worth is testable without a store, a
 * renderer, or a save.
 */

import { draw } from './identity.ts'
import { OUTPUT_SIGMA, outputRoll } from './output.ts'

/**
 * The aggregation ladder, in seats.
 *
 * **This is §7.7.1's unit ladder with §7.8.1a's squad inserted underneath it**,
 * and carrying both is the resolution of a collision this document has had for
 * a while: §7.7.1's *floor* is the unit arriving in the 10³–10⁴ band and is
 * therefore **1,000**, while §7.8.1a's *floor* is a hundred squads and is
 * therefore **10,000**. Both are canon, both are built (`tower.ts`'s
 * `DEVS_PER_STOREY` is the first, `room.ts`'s `FLOOR_SIZE` is the second), and
 * §26.2.2's own level-of-detail table is written in the second vocabulary while
 * `units.ts` implements the first.
 *
 * Renaming either one touches four modules and a dozen sections to buy what a
 * table buys. So the tree simply has a level for each, and every level is
 * labelled with which section named it:
 *
 * | Level | Seats | Named by |
 * |---|---|---|
 * | 0 | 1 | a person |
 * | 1 | 100 | §7.8.1a's **squad** — §26.2.2's "block of 100" |
 * | 2 | 1,000 | §7.7.1's **floor**, rung 3's unit |
 * | 3 | 10,000 | §7.8.1a's **floor**; §7.7.1's **building**, rung 4's unit |
 * | 4 | 10⁵ | campus, rung 5 |
 * | 5 | 10⁶ | town, rung 6 |
 * | 6 | 10⁸ | nation, rung 7 |
 * | 7 | 10¹⁰ | planet, rung 8 |
 * | 8 | 10¹³ | galaxy, rung 9 |
 *
 * Levels 2 upward are `units.ts`'s `BAND_FLOOR` exactly, and there is a test
 * that says so — a table copied out of another table is a table that drifts.
 */
export const LEVEL_SIZES: readonly number[] = [1, 100, 1e3, 1e4, 1e5, 1e6, 1e8, 1e10, 1e13]

/** The largest level index. Above it the studio is more than one galaxy. */
const TOP_LEVEL = LEVEL_SIZES.length - 1

/**
 * The most children any one normalise ever walks.
 *
 * Every real branching factor is at most a thousand (the ladder's steps are
 * ×100, ×10, ×10, ×10, ×10, ×100, ×100, ×1000), so this only ever binds on the
 * virtual root above the top level — a studio of more than 4×10¹⁶ developers,
 * which is four hundred million times §13.5's gate and past the point where
 * §16's Planck barrier has ended the game twice over. Past it the multipliers
 * are dropped and weight is exactly proportional to headcount, which is both
 * the honest limit of this construction and completely unobservable.
 */
export const MAX_GROUP = 4096

/** Children per parent, stepping from `level` up to `level + 1`. */
function branching(level: number): number {
  if (level >= TOP_LEVEL) return MAX_GROUP
  return Math.round(LEVEL_SIZES[level + 1] / LEVEL_SIZES[level])
}

/** Seats one unit at `level` covers. The virtual root covers everything. */
function sizeOf(level: number): number {
  return level > TOP_LEVEL ? Number.POSITIVE_INFINITY : LEVEL_SIZES[level]
}

/**
 * How wide a unit of `size` people varies, in log space.
 *
 * `σ / √size` — the standard error of the mean of `size` draws. See the file
 * header: this is the reason a town is flat and a person is not, and it is
 * derived rather than chosen so it cannot drift away from {@link OUTPUT_SIGMA}
 * when §4.9a's knob is turned.
 */
export function unitSigma(size: number): number {
  return OUTPUT_SIGMA / Math.sqrt(Math.max(1, size))
}

/** Draw channels, past the ones `identity.ts` and `output.ts` use. */
const CH_UNIT_U1 = 60
const CH_UNIT_U2 = 90

/**
 * Box-Muller for a unit, keyed so no two levels share a draw.
 *
 * The level goes into the *channel* rather than into the index, because two
 * units at different levels routinely share an index — squad 3, floor 3 and
 * town 3 all exist — and keying on the index alone would have made a floor's
 * multiplier a copy of its own first squad's.
 */
function unitNormal(seed: number, level: number, index: number): number {
  const u1 = Math.max(1e-12, draw(seed, index, CH_UNIT_U1 + level))
  const u2 = draw(seed, index, CH_UNIT_U2 + level)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/** Bounds, in the same spirit as `output.ts`'s and for the same reason. */
const MIN_MULT = 0.02
const MAX_MULT = 25

/**
 * How good this unit is, as a multiple of an average unit its size.
 *
 * Log-normal with the mean pinned at 1 by `μ = −σ²/2`, exactly as §4.9a pins an
 * individual's. The pinning is belt and braces here — the normalise below makes
 * the total exact whatever this returns — but a multiplier whose mean drifted
 * would still be wrong in a way a player could see: every unit on screen would
 * be quietly above or below the average of the studio containing it.
 */
export function unitMultiplier(seed: number, level: number, index: number): number {
  const sigma = unitSigma(LEVEL_SIZES[Math.min(TOP_LEVEL, level)])
  const mult = Math.exp(-(sigma * sigma) / 2 + sigma * unitNormal(seed, level, index))
  return Math.min(MAX_MULT, Math.max(MIN_MULT, mult))
}

/** Seats of unit `(level, index)` that actually have somebody in them. */
function occupied(level: number, index: number, devs: number): number {
  const size = sizeOf(level)
  // The virtual root has no finite size, and `0 * Infinity` is `NaN` rather
  // than the zero the arithmetic below wants. It holds everybody by definition.
  if (!Number.isFinite(size)) return index === 0 ? devs : 0
  const start = index * size
  if (!(devs > start)) return 0
  return Math.min(size, devs - start)
}

/**
 * The level at which one unit holds the whole studio — where the recursion
 * bottoms out and the weight is simply the headcount.
 */
function rootLevel(devs: number): number {
  for (let l = 0; l <= TOP_LEVEL; l++) if (LEVEL_SIZES[l] >= devs) return l
  return TOP_LEVEL + 1
}

/**
 * Each child's share **of its parent**, summing to exactly 1.
 *
 * Fractions rather than absolute weights, and the difference is what makes the
 * memo below possible: a fully-occupied group's fractions do not depend on the
 * headcount at all, so they survive every hire.
 *
 * ## The memo has to be split, and this is the expensive lesson
 *
 * The first version of this file keyed one `Map` on
 * `` `${seed}|${level}|${parent}|${devs}` `` with plain insertion-order
 * eviction, and it made the game unplayable — a pacing run that had taken
 * seconds did not finish in twenty-five minutes. The arithmetic was fine. The
 * memo ate itself:
 *
 * - `devs` moves nearly every tick, so every partly-filled group minted a *new*
 *   key sixty times a second;
 * - those keys entered a fixed-size FIFO, and the entries they evicted were the
 *   **full** groups — the only ones with any reuse in them;
 * - so within a couple of seconds every lookup missed, and a miss is up to a
 *   thousand `exp`/`log`/`cos` calls, on a path `currentVelocity` walks once per
 *   buff per tick.
 *
 * A cache whose misses are that expensive cannot be allowed to evict the wrong
 * thing, so the two populations are stored apart and never compete:
 *
 * **Full groups** live in a per-level `Map` keyed by parent index alone, with no
 * headcount in the key, because they have none in their value.
 *
 * **The frontier is one slot per level** — nine in total — which is not a budget
 * but a fact about the shape: for a given headcount, at each level there is
 * *exactly one* group that is partly filled, the one holding seat `devs - 1`.
 * Everything below it is full and everything above it is empty, and an empty
 * group is never asked for because {@link unitWeight} returns 0 before it gets
 * here. So the frontier needs no eviction policy at all: the next headcount
 * overwrites the previous one in place, and nothing reusable is ever in the way.
 *
 * Keys are numbers throughout. The seed is the outer dimension rather than part
 * of a key, so a run change drops its memo whole instead of leaving it to age
 * out one entry at a time.
 */
type LevelMemo = {
  /** Full sibling groups by parent index. No headcount in the key or value. */
  full: Map<number, Float64Array>
  /** The single partly-filled group, and the headcount it was computed for. */
  edge: Float64Array | null
  edgeParent: number
  edgeDevs: number
}

type SeedMemo = { seed: number; levels: LevelMemo[] }

/**
 * Full groups kept per level, before the oldest is dropped.
 *
 * A screen's worth of units with room to pan, at nine levels. Each is a
 * `Float64Array` of at most a thousand doubles, so the ceiling is single-digit
 * megabytes in the pathological case of a session that has panned across a
 * galaxy, and a few kilobytes in every real one.
 */
const FULL_PER_LEVEL = 128

/**
 * Runs whose memo is kept. One is the answer during play; the spare slots are
 * for the save-import and test paths that ask about two seeds in a row.
 */
const SEED_SLOTS = 4

const seedMemos: SeedMemo[] = []

function memoFor(seed: number): SeedMemo {
  for (const m of seedMemos) if (m.seed === seed) return m
  const levels: LevelMemo[] = []
  for (let l = 0; l <= TOP_LEVEL; l++) {
    levels.push({ full: new Map(), edge: null, edgeParent: -1, edgeDevs: -1 })
  }
  const made: SeedMemo = { seed, levels }
  seedMemos.push(made)
  if (seedMemos.length > SEED_SLOTS) seedMemos.shift()
  return made
}

function fractions(seed: number, level: number, parent: number, devs: number): Float64Array {
  const b = Math.min(MAX_GROUP, branching(level))
  const base = parent * b
  const size = sizeOf(level)
  const full = devs >= (base + b) * size

  const memo = memoFor(seed).levels[Math.min(TOP_LEVEL, level)]
  if (full) {
    const hit = memo.full.get(parent)
    if (hit !== undefined) return hit
  } else if (memo.edge !== null && memo.edgeParent === parent && memo.edgeDevs === devs) {
    return memo.edge
  }

  const raw = new Float64Array(b)
  let total = 0
  let last = -1
  for (let j = 0; j < b; j++) {
    const occ = occupied(level, base + j, devs)
    if (occ <= 0) continue
    // A person's own weight is §4.9a's roll — this is where the two modules
    // meet, and it is the only place they do. Above a person, occupancy is what
    // carries the scale and the multiplier is only the seasoning: a half-empty
    // squad must be worth about half a squad, or the last unit on every floor
    // would be a freak.
    raw[j] = level === 0 ? outputRoll(seed, base + j) : occ * unitMultiplier(seed, level, base + j)
    total += raw[j]
    last = j
  }

  const out = new Float64Array(b)
  if (last >= 0 && total > 0) {
    // **The residual goes to the last occupied child.** `Σ (r/total)` in floating
    // point is not 1 — it is 1 plus up to `b` roundings — and §26.2.5 line 4 says
    // "to the last story point". Handing the remainder to the last child makes
    // the group sum exact to one rounding instead of to `b` of them, and it does
    // it without a second pass or a compensated sum.
    let running = 0
    for (let j = 0; j < b; j++) {
      if (j === last || raw[j] === 0) continue
      out[j] = raw[j] / total
      running += out[j]
    }
    out[last] = 1 - running
  }

  if (full) {
    if (memo.full.size >= FULL_PER_LEVEL) {
      const oldest = memo.full.keys().next().value
      if (oldest !== undefined) memo.full.delete(oldest)
    }
    memo.full.set(parent, out)
  } else {
    memo.edge = out
    memo.edgeParent = parent
    memo.edgeDevs = devs
  }
  return out
}

/**
 * What unit `(level, index)` is worth, in developers — GDD §26.2.2.
 *
 * The number a unit *states*: what the block says it is producing before
 * anybody has opened it. Its units are headcount-equivalents, so a fully-
 * occupied average squad is worth about 100 and the studio is worth exactly
 * `devs`; multiply by the studio's per-developer velocity to get story points.
 */
export function unitWeight(seed: number, devs: number, level: number, index: number): number {
  const n = headcount(devs)
  if (n <= 0) return 0

  const l = Math.max(0, Math.floor(level))
  const i = Math.max(0, Math.floor(index))
  const root = rootLevel(n)

  if (l >= root) return i === 0 ? n : 0
  if (occupied(l, i, n) <= 0) return 0

  const b = Math.min(MAX_GROUP, branching(l))
  const parent = Math.floor(i / b)
  return unitWeight(seed, n, l + 1, parent) * fractions(seed, l, parent, n)[i - parent * b]
}

/**
 * Seat `index`'s share of the studio, as a multiple of the average developer —
 * GDD §4.9a.
 *
 * **The shares over a roster sum to exactly the headcount**, which is §4.9a's
 * "hold the average" and is now true by construction rather than by a table:
 * the root is the headcount and every level divides it exactly. Widening
 * {@link OUTPUT_SIGMA} cannot move the total by a single point at any studio
 * size, including the ones no table could have covered.
 */
export function outputShare(seed: number, devs: number, index: number): number {
  return unitWeight(seed, devs, 0, index)
}

/**
 * The shares of a whole seat range, summed — GDD §4.5b.
 *
 * R14 buffs a **unit**, and above the room a unit is a floor, a building, a
 * town. Asking {@link outputShare} a million times to find out what a town is
 * worth is not a thing to do on a tick, so the range is decomposed against the
 * tree instead: a sub-unit that lies entirely inside the range answers with one
 * multiply, and only the two ragged edges are ever walked child by child.
 *
 * The cost is therefore the *depth* times the branching — nine levels of at
 * most a thousand — and never the length of the range. A buff on a nation of a
 * hundred million costs the same as a buff on a squad.
 */
export function shareSum(seed: number, devs: number, from: number, to: number): number {
  const n = headcount(devs)
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.min(n, Math.floor(to))
  if (hi <= lo) return 0
  return sumRange(seed, n, rootLevel(n), 0, lo, hi)
}

function sumRange(
  seed: number,
  devs: number,
  level: number,
  index: number,
  lo: number,
  hi: number,
): number {
  const size = sizeOf(level)
  const start = level > TOP_LEVEL ? 0 : index * size
  const end = Math.min(start + size, devs)
  if (end <= lo || start >= hi) return 0
  if (lo <= start && end <= hi) return unitWeight(seed, devs, level, index)
  // A single seat is either wholly in the range or wholly out, so the guard
  // above has already answered for it. Reaching here at level 0 would be a bug
  // in the arithmetic above rather than a case to handle.
  if (level <= 0) return 0

  const b = Math.min(MAX_GROUP, branching(level - 1))
  const childSize = sizeOf(level - 1)
  const base = index * b
  // Only the children the range actually touches. Without this a partial hit at
  // the top of the ladder would walk a thousand galaxies to find the two that
  // overlap, at every level, on every query.
  const firstChild = Math.max(0, Math.floor((lo - start) / childSize))
  const lastChild = Math.min(b - 1, Math.floor((hi - 1 - start) / childSize))

  let sum = 0
  for (let j = firstChild; j <= lastChild; j++) {
    sum += sumRange(seed, devs, level - 1, base + j, lo, hi)
  }
  return sum
}

/** A headcount that is a whole number of people and not a surprise. */
function headcount(devs: number): number {
  return Number.isFinite(devs) ? Math.max(0, Math.floor(devs)) : 0
}

/** Reset the memo — test seam, and the only reason this module has state. */
export function __clearAggregateCache(): void {
  seedMemos.length = 0
}
