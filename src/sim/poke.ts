/**
 * The Poke — GDD §4.5–4.9. The clicker layer.
 *
 *   SP_poke = F(tier) * S(state) * Z(zoom) * eta(E)
 *
 * The last term is load-bearing: at high Entropy, poking stops working too.
 * A player in Entropy Lock cannot tap their way out.
 */

import { CONTEXT_SWITCH_COEFFICIENT } from './entropy.ts'

/**
 * The Fibonacci estimation ladder — GDD §4.6.
 *
 * Upgrades move you *up the ladder* rather than multiplying a float, so
 * progression reads as "we estimate at 8 points now" instead of "+340% click
 * power". Beyond F7 it continues procedurally, so the clicker layer never
 * becomes irrelevant at cosmic scale.
 */
export const FIBONACCI_LADDER = [1, 2, 3, 5, 8, 13, 21] as const

/** SP per poke at a given ladder tier. Tier 1 is F1 = 1. */
export function fibonacciTier(tier: number): number {
  if (tier < 1) return 0
  if (tier <= FIBONACCI_LADDER.length) return FIBONACCI_LADDER[tier - 1]

  // Continue the sequence procedurally past F7 (34, 55, 89, ...).
  let a: number = FIBONACCI_LADDER[FIBONACCI_LADDER.length - 2]
  let b: number = FIBONACCI_LADDER[FIBONACCI_LADDER.length - 1]
  for (let i = FIBONACCI_LADDER.length; i < tier; i++) {
    ;[a, b] = [b, a + b]
  }
  return b
}

/** What a developer is currently doing. GDD §4.7, §8.2. */
export type DevState =
  | 'working'
  | 'slacking'
  | 'flow'
  | 'overwhelmed'
  | 'rogue'
  | 'tenx'

/**
 * S(state) — the poke decision, GDD §4.7.
 *
 * The best targets are the ones that cost you the most to interrupt. Flow State
 * is the biggest single-tap payout in the game *and* poking ends it: you are
 * cashing in a multiplier you were supposed to protect.
 */
export const STATE_MULTIPLIER: Record<DevState, number> = {
  working: 1,
  slacking: 0.5,
  flow: 3,
  /** Zero SP. The poke's value is clearing their lockup, not the points. */
  overwhelmed: 0,
  /** They give back points they already deleted. Poke to cancel, not for profit. */
  rogue: -2,
  /** Enormous — and they quit on the spot. A one-time cash-out. */
  tenx: 10,
}

/** The four canonical zoom levels — GDD §7.4. */
export type ZoomLevel = 1 | 2 | 3 | 4

/**
 * Z(zoom) — GDD §4.8. The tap's blast radius grows with distance and the
 * per-dev yield falls as it does. The further you are from the work, the less
 * each status check is worth, which is both a management truth and a free joke.
 */
export const ZOOM_YIELD: Record<ZoomLevel, number> = {
  1: 1.0,
  2: 0.4,
  3: 0.08,
  4: 0.01,
}

/** How many developers a single tap reaches at each zoom — GDD §4.8. */
export const ZOOM_BLAST_RADIUS: Record<ZoomLevel, number> = {
  1: 1,
  2: 14,
  3: 5_000,
  4: 1_000_000,
}

/**
 * §4.8's `Z` for a unit of any size — GDD §4.5b.
 *
 * §4.5b says the buff percentage falls as the unit grows "on the same shape as
 * 4.8's `Z`", and §4.8 names exactly four sizes. R15 pokes units of 1, 1,000,
 * 10,000, 100,000, a million, a hundred million — so the curve has to be
 * readable between the anchors and past the last one.
 *
 * **It is the same table, interpolated, rather than a second curve.** Fitting a
 * power law by eye was the obvious alternative and it is the wrong one: §4.8's
 * four points are not on a single power law (the log-log slopes are −0.35,
 * −0.27 and −0.39), so any fit disagrees with the canon numbers at three of the
 * four places anybody would check. Interpolating in log-log space passes
 * through all four exactly and cannot drift from them, because there is nothing
 * to drift *from* — {@link ZOOM_YIELD} is the only copy.
 *
 * Past a million it continues on the last segment's slope. That is an
 * extrapolation and it is the honest one: §4.8's own trend, carried on, rather
 * than a floor invented to stop the number getting small. It stays positive at
 * every size — a rung whose buff is exactly zero is a rung where the game's
 * primary verb does nothing, which is what R15 exists to fix.
 */
export function sizeYield(size: number): number {
  if (!(size > 1)) return ZOOM_YIELD[1]

  const levels: ZoomLevel[] = [1, 2, 3, 4]
  const x = Math.log(size)

  for (let i = 1; i < levels.length; i++) {
    const lo = levels[i - 1]
    const hi = levels[i]
    const x0 = Math.log(ZOOM_BLAST_RADIUS[lo])
    const x1 = Math.log(ZOOM_BLAST_RADIUS[hi])
    const y0 = Math.log(ZOOM_YIELD[lo])
    const y1 = Math.log(ZOOM_YIELD[hi])

    // The last segment is not bounded above: it carries the trend onward
    // rather than clamping, so a galaxy is worth less than a town by the same
    // rule that makes a town worth less than a floor.
    if (x <= x1 || i === levels.length - 1) {
      return Math.exp(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0))
    }
  }

  return ZOOM_YIELD[4]
}

export interface PokeInput {
  /** Fibonacci ladder tier, 1-indexed. F1 from the first tap of the game. */
  tier: number
  state: DevState
  zoom: ZoomLevel
  /** Global efficiency eta from GDD §4.1 — pokes are taxed exactly like passive output. */
  efficiency: number
  /** Headcount, so the blast radius cannot reach people who are not there. */
  devs: number
  /**
   * How many developers are in the unit that was actually hit — GDD §4.5b, R15.
   *
   * When given it **replaces both halves of §4.8's `Z`**: the reach becomes the
   * unit's own size and the per-developer yield becomes {@link sizeYield} of it,
   * rather than whichever of four bands the camera happens to be in.
   *
   * That is §4.5b's generalisation rather than a second mechanism — the four
   * band sizes still give the four band yields exactly, because `sizeYield`
   * interpolates that same table. What it fixes is the case in between: §7.4a
   * made rungs 0, 1 and 2 all the room, so at rung 2 a tap on **one** developer
   * was being paid for fourteen while §7.7.6 promised it landed on "the actual
   * developer under the thumb".
   *
   * Omitted only by a caller with no unit to name, which after R15 is nobody in
   * the game — the §4.8 band path stays because it is canon and because
   * `resolvePoke` should still answer the question §4.8 asks.
   */
  unitSize?: number
}

export interface PokeResult {
  /** SP yielded. Negative for a Rogue Refactorer. */
  sp: number
  /** Local entropy this poke adds to the developer — GDD §4.9. */
  localEntropyAdded: number
  /** A crit spawns a larger numeral and a chromatic-aberration punch (GDD §8.2). */
  crit: boolean
  /** The 10x Engineer quits permanently on the poke that pays out (GDD §4.7). */
  quits: boolean
}

/**
 * How many developers this tap actually lands on.
 *
 * The radius is a *ceiling*, not a promise: a cosmic-zoom tap on a studio of
 * forty hits forty people, not a million.
 */
export function pokeReach(zoom: ZoomLevel, devs: number): number {
  return Math.max(1, Math.min(ZOOM_BLAST_RADIUS[zoom], Math.floor(devs)))
}

/**
 * Resolve one tap.
 *
 * **The blast radius multiplies the yield**, and until now it did not — the
 * constant was declared, documented, and read by nothing. Half of §4.8 was
 * therefore live and half was not: the per-dev penalty applied and the reach
 * that pays for it did not, so zooming out was strictly worse at every
 * headcount and the whole "zoom out to sweep, punch in to extract" rhythm the
 * section exists to create was inverted.
 *
 * It also produced the visible symptom: a tap at L3 yielded 0.08 SP, which the
 * floater rounded to `+0` while the simulation quietly banked it. A number that
 * says nothing happened while something happens is worse than no number.
 */
export function resolvePoke({ tier, state, zoom, efficiency, devs, unitSize }: PokeInput): PokeResult {
  // §4.5b — the unit that was hit, clamped to the studio, or §4.8's band for a
  // caller with no unit to name.
  const reach =
    unitSize === undefined
      ? pokeReach(zoom, devs)
      : Math.max(1, Math.min(Math.floor(unitSize), Math.max(1, Math.floor(devs))))
  const z = unitSize === undefined ? ZOOM_YIELD[zoom] : sizeYield(reach)

  const sp = fibonacciTier(tier) * STATE_MULTIPLIER[state] * z * efficiency * reach

  return {
    sp,
    // Entropy is charged on the magnitude of the extraction. A Rogue
    // Refactorer's negative payout is still an interruption, and interrupting
    // them is still a context switch — so the cost uses |sp|.
    localEntropyAdded: CONTEXT_SWITCH_COEFFICIENT * Math.abs(sp),
    crit: state === 'flow' || state === 'tenx',
    quits: state === 'tenx',
  }
}

/**
 * Does poking this developer end something the player wanted?
 *
 * GDD §8.2: poking a Flow State dev *prolongs* it by +5s if the Culture upgrade
 * is owned, and otherwise ends it. The §11 tree does not exist yet, so this
 * defaults to the punishing branch — which is the one that teaches the lesson.
 */
export function pokeEndsFlow(state: DevState, hasCultureUpgrade: boolean): boolean {
  return state === 'flow' && !hasCultureUpgrade
}
