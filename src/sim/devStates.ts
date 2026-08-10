/**
 * What a developer is doing, and when it changes — GDD §4.7, §8.2.
 *
 * Poking is not mashing: what the developer is currently doing decides whether
 * the tap is worth it, and the best targets are the ones that cost you the
 * most to interrupt. That decision only exists if states arrive on their own
 * and expire on their own, so the player has to *watch* rather than tap
 * blindly.
 *
 * Pure and deterministic given an RNG, so the distribution is testable rather
 * than a thing that "feels about right".
 */

import type { DevState } from './poke.ts'

/** Mean seconds a developer spends in a state before rolling for a new one. */
export const DWELL_SECONDS: Record<DevState, number> = {
  working: 9,
  slacking: 6,
  // Flow is the prize: long enough to be worth protecting, short enough that
  // "cash it in or let it ride" is a real question rather than a formality.
  flow: 12,
  // Entropy Lock is a symptom, not a mood — it clears when the studio's load
  // does, or when someone pokes them out of it.
  overwhelmed: 15,
  rogue: 8,
  // A 10x Engineer who is never poked stays. They only leave if you cash them.
  tenx: Infinity,
}

/**
 * Relative likelihood of entering each state, before entropy weighting.
 *
 * `working` dominates because the baseline has to be the common case — if
 * interesting states were common they would stop being decisions.
 */
const BASE_WEIGHTS: Record<DevState, number> = {
  working: 60,
  slacking: 18,
  flow: 12,
  overwhelmed: 0, // entropy-gated, see below
  rogue: 4,
  // Appendix C #6 puts the 10x spawn chance at 1–5%. The low end is the
  // unupgraded Run 1 value.
  tenx: 1,
}

export interface TransitionContext {
  /** Studio-wide Communication Entropy, GDD §4.3. */
  entropy: number
  /** 0–1. Rises with prestige upgrades; Run 1 is 0. */
  tenxBonus?: number
  /**
   * §11.3 C2, Ergonomic Chairs — scales how long the Overwhelmed lockup lasts.
   *
   * Only that state, and deliberately so. The node's line is "reduces developer
   * Overwhelmed lockup duration by 30%", and a general dwell scale would also
   * shorten Flow — selling the player a chair that takes away the one state
   * they were trying to protect.
   */
  overwhelmedScale?: number
}

/**
 * Weighted state distribution at a given Entropy.
 *
 * Entropy does two things here, and both are the design speaking rather than
 * balance: it makes `overwhelmed` possible at all, and it crowds out `flow`.
 * Nobody reaches flow state in a studio that is 90% meetings.
 */
export function stateWeights({ entropy, tenxBonus = 0 }: TransitionContext): Record<DevState, number> {
  const e = Math.min(1, Math.max(0, entropy))

  return {
    working: BASE_WEIGHTS.working,
    slacking: BASE_WEIGHTS.slacking,
    // Flow decays to nothing as the studio strains.
    flow: BASE_WEIGHTS.flow * (1 - e) ** 2,
    // Overwhelmed is purely a function of load — it is Entropy Lock, locally.
    overwhelmed: 90 * e ** 3,
    rogue: BASE_WEIGHTS.rogue,
    tenx: BASE_WEIGHTS.tenx * (1 + tenxBonus * 4),
  }
}

/** Pick a state from the weighted distribution. `roll` is in [0, 1). */
export function pickState(ctx: TransitionContext, roll: number): DevState {
  const weights = stateWeights(ctx)
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total <= 0) return 'working'

  let acc = 0
  const target = roll * total
  for (const state of Object.keys(weights) as DevState[]) {
    acc += weights[state]
    if (target < acc) return state
  }
  return 'working'
}

export interface DevStateMachine {
  state: DevState
  /** Seconds spent in the current state. */
  elapsed: number
}

export function initialDevState(): DevStateMachine {
  return { state: 'working', elapsed: 0 }
}

/**
 * Advance one developer's state.
 *
 * Returns a new machine; never mutates. `rng` is injected so tests can pin the
 * distribution and so a replay could be made deterministic later.
 */
export function advanceDevState(
  machine: DevStateMachine,
  dtSeconds: number,
  ctx: TransitionContext,
  rng: () => number = Math.random,
): DevStateMachine {
  const elapsed = machine.elapsed + dtSeconds
  const scale = machine.state === 'overwhelmed' ? Math.max(0, ctx.overwhelmedScale ?? 1) : 1
  const dwell = DWELL_SECONDS[machine.state] * scale

  if (!Number.isFinite(dwell) || elapsed < dwell) {
    return { state: machine.state, elapsed }
  }

  const next = pickState(ctx, rng())
  // Re-rolling the same state resets the dwell rather than being a no-op,
  // which keeps `working` from looking like a stuck machine.
  return { state: next, elapsed: 0 }
}

/**
 * Apply a poke's consequences to the machine — GDD §4.7, §8.2.
 *
 * Poking is the only thing that can end a state early, and every case here is
 * a design beat rather than bookkeeping: the 10x quits, Flow is spent,
 * Overwhelmed is cleared, the rogue refactor is cancelled.
 */
export function pokeDevState(
  machine: DevStateMachine,
  hasCultureUpgrade: boolean,
): { machine: DevStateMachine; devLeaves: boolean } {
  switch (machine.state) {
    case 'tenx':
      // "They quit permanently. A one-time cash-out of a rare unit."
      return { machine: initialDevState(), devLeaves: true }

    case 'flow':
      // Without the Culture upgrade the poke ends Flow; with it, +5 seconds.
      return hasCultureUpgrade
        ? { machine: { state: 'flow', elapsed: Math.max(0, machine.elapsed - 5) }, devLeaves: false }
        : { machine: initialDevState(), devLeaves: false }

    case 'overwhelmed':
      // Zero SP, but it "temporarily clears their local communication lockup".
      return { machine: initialDevState(), devLeaves: false }

    case 'rogue':
      // "Cancels their rogue refactor that was about to break the build."
      return { machine: initialDevState(), devLeaves: false }

    case 'slacking':
      // Back to work, and §8.2 grants +50% speed for 10s on top.
      return { machine: initialDevState(), devLeaves: false }

    case 'working':
      // A poke on a working dev jolts them but does not change what they are
      // doing — the dwell timer keeps running.
      return { machine, devLeaves: false }
  }
}
