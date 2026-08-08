/**
 * The hire multiplier dial — GDD §10.10.
 *
 * Hiring is the game's primary verb and until now it had exactly one shape: a
 * button that hires one developer. §10.10 opens with why that is not a small
 * problem — "correct at two developers and absurd at two million" — and rules
 * out every soft fix. Not a stepper (forty taps to reach a million), not a
 * slider (continuous input for a quantity thought about in orders of
 * magnitude), not hold-to-repeat (a held thumb is not a decision).
 *
 * What is left is a four-segment dial whose window slides up the ladder.
 *
 * Everything here is pure and closed-form. The naive `hireCostTotal` loop is
 * fine for the forty hires of Act IIa and is a hang at `x1M`, and this control
 * prices **every** segment on **every** frame — so a linear sum is not a slow
 * path here, it is the main path.
 */

import { HIRE_BASE_COST, HIRE_COST_GROWTH } from './economy.ts'

/**
 * §10.10.2 — four segments, always. Never five, never a scrolling list.
 *
 * The window slides and **the small multipliers retire**: an `x1` at ten
 * million developers is not a choice, it is clutter. Retiring them is what
 * keeps the control the same shape at every scale, which is what lets a player
 * who learned it at fifty developers still recognise it at a billion.
 */
export const DIAL_UNLOCKS_AT = 25

const BANDS: ReadonlyArray<{ from: number; steps: readonly number[] }> = [
  // The opening band offers `x100` long before it is affordable, on purpose.
  // §10.10.3 rule 1 wants unaffordable multipliers **shown and priced** — that
  // is how a player learns what to save for — and a three-segment first band
  // would have made the control change shape once, at 250, for no reason the
  // player could see.
  { from: DIAL_UNLOCKS_AT, steps: [1, 10, 100] },
  { from: 10_000, steps: [10, 100, 1_000] },
  { from: 1_000_000, steps: [1_000, 10_000, 100_000] },
  { from: 1_000_000_000, steps: [100_000, 1_000_000, 10_000_000] },
]

/** `'max'` is a count that changes without the player touching anything. */
export type Multiplier = number | 'max'

export interface Segment {
  /** `x10`, `x1K`, `MAX`. */
  label: string
  value: Multiplier
}

/** `1000` -> `1K`. Whole units only — this is a button face, not a readout. */
export function multiplierLabel(n: number): string {
  if (n >= 1_000_000) return `x${n / 1_000_000}M`
  if (n >= 1_000) return `x${n / 1_000}K`
  return `x${n}`
}

/**
 * The dial as it stands at this headcount, or **empty below
 * {@link DIAL_UNLOCKS_AT}**.
 *
 * §10.10.2: the dial does not appear until 25 developers, "because §21's Run 1
 * is a scripted funnel and a multiplier in Act I would let the player skip the
 * beat where hiring one person is the whole game." It arrives during Act IIa,
 * unannounced — the first thing the game gives the player that it did not
 * narrate.
 */
export function segmentsFor(devs: number): readonly Segment[] {
  if (devs < DIAL_UNLOCKS_AT) return []
  let band = BANDS[0]
  for (const b of BANDS) if (devs >= b.from) band = b
  return [
    ...band.steps.map((n) => ({ label: multiplierLabel(n), value: n as Multiplier })),
    { label: 'MAX', value: 'max' as Multiplier },
  ]
}

/**
 * What it costs to go from `devs` to `devs + count`, in closed form.
 *
 * §4.10a prices hire *n* at `base · growth^(n−1)`, so a batch is a geometric
 * series and its sum has an exact expression. Same value as summing
 * `hireCost`, without the loop — asserted against it by test, because a closed
 * form that has silently drifted from the thing it replaced is worse than the
 * loop it replaced.
 */
export function batchCost(devs: number, count: number): number {
  const n = Math.floor(count)
  if (n <= 0) return 0
  const from = Math.max(1, Math.floor(devs))
  const first = HIRE_BASE_COST * HIRE_COST_GROWTH ** (from - 1)
  return (first * (HIRE_COST_GROWTH ** n - 1)) / (HIRE_COST_GROWTH - 1)
}

/**
 * §10.10.3 rule 2 — **MAX never spends the last dollar.**
 *
 * §4.10a's Mass Hire deliberately takes the entire treasury, because that is
 * Act III's trap and it is *supposed* to ruin you. The ordinary MAX is not
 * that, and the two must not behave alike: two controls that look the same and
 * differ in whether they bankrupt you would make Act III's trap feel like a
 * bug rather than a betrayal.
 *
 * "Leaves the player solvent" is made concrete as **a tenth of the treasury,
 * kept back**.
 *
 * The first attempt derived it from §4.10's wage instead — five seconds of the
 * payroll the player would have *after* the hire — which reads better and is
 * wrong. At thirty developers that reserve is $7,000, and an Act IIa player
 * has a few thousand at most, so MAX would have been **dead for the whole of
 * the act it was introduced in**: a segment that never lights up, which is
 * worse than not shipping it. Caught by a test whose numbers were realistic;
 * it would not have been caught by one whose numbers were convenient.
 *
 * A fraction cannot do that. It is always satisfiable, it scales without
 * tuning, and it is unmistakably not §4.10a's Mass Hire, which takes
 * everything.
 */
export const MAX_RESERVE_FRACTION = 0.1

/**
 * The largest batch affordable right now.
 *
 * Solved rather than searched. Inverting {@link batchCost} gives a logarithm,
 * so this is O(1) at any headcount — then the reserve is applied by walking
 * *down* from that ceiling, which terminates immediately in practice because
 * the reserve moves the answer by one or two.
 */
export function maxAffordable(devs: number, cash: number, reserve = MAX_RESERVE_FRACTION): number {
  if (cash <= 0) return 0
  const budget = cash * (1 - reserve)
  const from = Math.max(1, Math.floor(devs))
  const first = HIRE_BASE_COST * HIRE_COST_GROWTH ** (from - 1)
  if (!Number.isFinite(first) || first <= 0) return 0

  const ratio = 1 + (budget * (HIRE_COST_GROWTH - 1)) / first
  if (ratio <= 1) return 0
  let n = Math.floor(Math.log(ratio) / Math.log(HIRE_COST_GROWTH))
  if (!Number.isFinite(n) || n <= 0) return 0

  // The logarithm can land one over on the boundary through float rounding, so
  // it is trimmed rather than trusted. One step, in practice.
  while (n > 0 && batchCost(devs, n) > budget) n--
  return n
}

/**
 * How many a segment actually buys, and what it costs.
 *
 * §10.10.3 rule 1: a multiplier the player cannot afford is **shown, priced and
 * disabled** — never hidden. Hiding it removes exactly the information the
 * player needs to decide what to save for. So this returns the true count and
 * the true cost of a fixed multiplier even when it is unaffordable, and the
 * caller renders it dead rather than absent.
 */
export interface Quote {
  count: number
  cost: number
  affordable: boolean
}

export function quote(devs: number, cash: number, value: Multiplier): Quote {
  if (value === 'max') {
    const count = maxAffordable(devs, cash)
    return { count, cost: batchCost(devs, count), affordable: count > 0 }
  }
  const cost = batchCost(devs, value)
  return { count: value, cost, affordable: cash >= cost }
}
