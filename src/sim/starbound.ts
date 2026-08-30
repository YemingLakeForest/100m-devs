/**
 * The starbound endgame — GDD §16, and the same struggle one rung further out.
 *
 * §25.3.2's warning about the top of the ladder is that it is where a design
 * quietly becomes a different game: a galaxy invites freight, trade routes,
 * colony management, a second economy with its own verbs. **None of that is
 * here, deliberately.** The network above a hundred million developers is
 * scenery and navigation; what it costs the player is the thing the whole game
 * has always cost them.
 *
 * > *The struggle is the inefficiency of too many people.*
 *
 * §4.1 writes that as `η = 1 / (1 + (D/D_cap)^ρ)` — output falls because
 * everybody is talking to everybody. Nothing about that sentence mentions a
 * building, and that is why it survives the move to a galaxy without becoming a
 * new mechanic: at interstellar distance the people are still talking to each
 * other, and the only thing that changed is **how long a sentence takes to
 * arrive**. So this file adds exactly one term, of exactly the same shape, in
 * the one unit the new rung introduces:
 *
 *   `σ = 1 / (1 + (lag / reach)²)`
 *
 * A second curve, not a second system. Multiply it into §4.1's η and the
 * speedometer keeps meaning what it has always meant.
 *
 * The other half of §16 is the direction of travel: past the gate the metric
 * the player is pushing on stops being *how many* and becomes **how fast**,
 * down to one project per Planck time. That readout is here too, because it is
 * arithmetic about the same run and because putting it anywhere else would mean
 * a component deriving it.
 *
 * Pure: no store, no clock, no renderer.
 */

import { settledRadiusLy } from './starfield.ts'

/**
 * Mean one-way light-lag across the settled worlds, in light-years.
 *
 * **Zero at one world, and that is a fact rather than a convenience.** The lag
 * is what it costs two worlds to agree; a studio that has never left Sol has no
 * second world to disagree with, so the term is not "small" there, it is
 * absent. Everything below §13.5's gate is therefore untouched by this file,
 * which is what lets it be added to a balanced game without re-tuning one.
 *
 * Above one world it is the mean radius of a disc of uniform areal density —
 * `⅔R` — which is exact for the law `starfield.ts` generates positions from
 * rather than a fit to it. At two worlds it reads 4.0 light-years against
 * Proxima's real 4.2, which is the sanity check that the two files agree.
 */
export function meanLagLy(worlds: number): number {
  const n = Math.max(1, Math.floor(Number.isFinite(worlds) ? worlds : 1))
  if (n <= 1) return 0
  return (2 / 3) * settledRadiusLy(n)
}

/**
 * How far a relay tier keeps a conversation feeling local, in light-years.
 *
 * §16's "Quantum Relays", as a reach rather than as a speed, because a reach is
 * the thing that goes in the denominator of the curve above and a speed is not.
 * Eight light-years at tier 0 covers the first handful of worlds and then
 * stops; each tier is four times the reach, which is sixteen times the worlds,
 * because the number of worlds inside a radius goes as `r²`.
 *
 * **A tier is not a thing the player buys, and that is the point.** §11's tree
 * is already the answer to *"they cannot hear each other"* — every node on it
 * raises `D_cap`, which is the number of people who can work together before
 * the talking eats the work. Interstellar distance is the same sentence with a
 * different unit, so the reach is derived from the capacity the studio has
 * already earned rather than sold separately: `store.relayTier`. A second
 * upgrade board for the same problem would be §25.3.2's warning arriving on
 * schedule — the galaxy quietly becoming a different game.
 *
 * Continuous, deliberately: the capacity it is derived from is, and a reach
 * that stepped would make a smooth purchase land as a jolt in the gauge.
 */
export const RELAY_BASE_LY = 8
export const RELAY_STEP = 4

export function relayReachLy(tier: number): number {
  const t = Math.max(0, Number.isFinite(tier) ? tier : 0)
  return RELAY_BASE_LY * RELAY_STEP ** t
}

/**
 * The exponent on the interstellar curve — **two, where §4.1 uses five.**
 *
 * ρ = 5 is described in `entropy.ts` as "how violently the studio collapses past
 * capacity", and the violence is the point there: Run 1 is a trap and the
 * player is meant to be able to bankrupt themselves with one bad hire. Up here
 * neither half of that applies. A world cannot be un-settled, so a fifth-power
 * cliff would be a state the player can enter and never leave, which is a new
 * fail state — and §25.3.2 is explicit that the endgame may not add one.
 *
 * Two still bites: at twice the reach the studio has lost four fifths of its
 * sync. It bites *smoothly*, which is the difference between a wall and a hill.
 */
export const LAG_EXPONENT = 2

/**
 * §16 — the interstellar half of §4.1's efficiency, as a multiplier on it.
 *
 * 1 while the studio is one world, so nothing below the gate can feel it.
 */
export function interstellarSync(worlds: number, relayTier = 0): number {
  const lag = meanLagLy(worlds)
  if (lag <= 0) return 1
  const reach = relayReachLy(relayTier)
  if (!(reach > 0)) return 0
  const overhead = (lag / reach) ** LAG_EXPONENT
  if (!Number.isFinite(overhead)) return 0
  return 1 / (1 + overhead)
}

/**
 * How many relay tiers a studio of this size would need to hold sync at `floor`.
 *
 * The inverse of the curve, for the HUD: a player looking at a falling gauge
 * should be able to be told what the fix is measured in, and "two more tiers"
 * is a sentence. Rounded up, because a fraction of a relay is not a relay.
 */
export function relayTiersNeeded(worlds: number, floor = 0.5): number {
  const lag = meanLagLy(worlds)
  if (lag <= 0) return 0
  const f = Math.min(0.999999, Math.max(1e-9, floor))
  // σ = floor  ⇒  reach = lag / (1/floor − 1)^(1/LAG_EXPONENT)
  const reach = lag / (1 / f - 1) ** (1 / LAG_EXPONENT)
  if (!(reach > 0)) return 0
  const tiers = Math.log(reach / RELAY_BASE_LY) / Math.log(RELAY_STEP)
  return Math.max(0, Math.ceil(tiers))
}

// ---------------------------------------------------------------------------
// §16 — the Planck-time speed barrier
// ---------------------------------------------------------------------------

/** The Planck time, in seconds. §16's floor, and the number on the last readout. */
export const PLANCK_SECONDS = 5.391247e-44

/**
 * A project's build time, in Planck times.
 *
 * The endgame metric §16 asks for, and it is a *ratio* rather than a duration
 * because the barrier is not a deadline the player misses — it is a floor they
 * approach and cannot cross. One is the end of the game.
 */
export function planckMultiple(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1
  return Math.max(1, seconds / PLANCK_SECONDS)
}

/**
 * How far down §16's barrier a build time has come, as 0…1.
 *
 * **Logarithmic, and the log is the honest scale rather than a presentational
 * choice.** From one second to one Planck time is forty-three and a bit orders
 * of magnitude; a linear bar would sit pinned at 100% for the entire endgame
 * and then drop to zero in the last frame of it. On the log every halving of
 * the build time is the same visible step, which is §7.7.3's rule about
 * multiplicative progress applied to a clock instead of to a headcount.
 *
 * Zero at one second and slower, because §16 is a thing that begins somewhere.
 */
export function barrierProgress(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1
  if (seconds >= 1) return 0
  const decades = -Math.log10(seconds)
  const total = -Math.log10(PLANCK_SECONDS)
  return Math.min(1, Math.max(0, decades / total))
}

/** A build time as an SI-ish string — `4.20 ms`, `812 ns`, `3.1e-31 s`. */
const TIME_UNITS: readonly { at: number; suffix: string }[] = [
  { at: 1, suffix: 's' },
  { at: 1e-3, suffix: 'ms' },
  { at: 1e-6, suffix: 'µs' },
  { at: 1e-9, suffix: 'ns' },
  { at: 1e-12, suffix: 'ps' },
  { at: 1e-15, suffix: 'fs' },
  { at: 1e-18, suffix: 'as' },
  { at: 1e-21, suffix: 'zs' },
  { at: 1e-24, suffix: 'ys' },
]

export function buildTimeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 s'
  for (const { at, suffix } of TIME_UNITS) {
    if (seconds >= at) {
      const scaled = seconds / at
      return `${scaled < 100 ? scaled.toFixed(1) : Math.round(scaled)} ${suffix}`
    }
  }
  // Past yoctoseconds there is no prefix left and inventing one would be worse
  // than saying the exponent out loud, which is what physics does anyway.
  return `${seconds.toExponential(1)} s`
}

/**
 * §16's own readout — how many Planck times one project still takes.
 *
 * At one, the sentence stops being a number: the studio is shipping a game
 * every Planck time and there is no smaller interval for it to be measured
 * against, which is the end of §16 and the trigger §13.4 is waiting for.
 */
export function planckLabel(seconds: number): string {
  const multiple = planckMultiple(seconds)
  if (multiple <= 1) return 'PLANCK TIME'
  if (multiple < 1e4) return `${Math.round(multiple)} t_P`
  const exponent = Math.floor(Math.log10(multiple))
  const mantissa = multiple / 10 ** exponent
  return `${mantissa.toFixed(1)}e${exponent} t_P`
}
