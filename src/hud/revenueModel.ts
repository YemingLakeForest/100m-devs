/**
 * What the §4.10e revenue graph draws, without the drawing.
 *
 * Split out for the same reason `hudModel.ts` and `overnightModel.ts` are: the
 * two decisions in this chart that can be *wrong* — how a rate is spelled, and
 * which releases get a band of their own — are answerable without a DOM, and a
 * test that has to mount a component to ask them is a test nobody writes.
 */

import type { GameState } from '../game/store.ts'
import { earningRate } from '../sim/revenue.ts'

/** Most bands drawn. Past this the oldest are folded into one. */
export const MAX_BANDS = 4

/** Shortest honest form of a per-second figure — `$1.2K/s`, `$40/s`. */
export function formatRate(dollars: number): string {
  const n = Math.abs(dollars)
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B/s`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M/s`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K/s`
  if (n >= 10) return `$${Math.round(n)}/s`
  return `$${n.toFixed(1)}/s`
}

/**
 * The per-release rates for one sample, folded down to {@link MAX_BANDS}.
 *
 * The **oldest** are folded rather than the smallest, and the two are nearly
 * the same set — but only nearly, and the difference is what keeps the chart
 * readable. Folding by size would move a band's colour and stacking position
 * whenever two releases crossed, which reads as the graph rearranging itself.
 * Folding by age never does: a band is laid down, is covered by the next one,
 * and eventually merges downward into the catalogue underneath.
 */
export function bandsFor(state: GameState): number[] {
  const rates = state.releases.map(earningRate)
  if (rates.length <= MAX_BANDS) return rates
  const folded = rates.slice(0, rates.length - MAX_BANDS + 1).reduce((a, b) => a + b, 0)
  return [folded, ...rates.slice(rates.length - MAX_BANDS + 1)]
}
