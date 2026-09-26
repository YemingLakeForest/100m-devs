/*
 * Copied from the rebuild (100m-devs-three/src/sim/dysfunction.ts) on 2026-09-26 with the
 * release ring and the pipeline, when the work moved back here: the rebuild is
 * read-only reference now, so this copy is the one that changes. See
 * docs/PLAN-2026-09-26-return.md.
 */
/**
 * **Dysfunction is conserved** — GDD §2.7 [amended 2026-09-24, Garage to Galaxy].
 *
 * *"I want to make it money still is a concern … while the manage of efficiency
 * loss is the key point ehre too."* The square root in `sim/entropy.ts` sets
 * *how much* coordination loss a studio has. This sets *where it sits*, and it
 * is the one place an upgrade's effect on the loss bar is decided.
 *
 * Three things can happen to the coordination loss, and only three:
 *
 * - **The coordination value rises** (k and the cap together, `entropy.ts`).
 *   That shrinks the whole pie, with the diminishing return the √ gives it.
 * - **A fix moves it.** Every coordination upgrade names the slice it cuts and
 *   the slice it feeds, and the share it moves. Written Culture ends the
 *   meeting and starts the wait for somebody to read the document. The pie is
 *   the same size afterwards — that is the conservation, and it is what the
 *   tests pin — so a fix is never a straight discount; it is a choice about
 *   *which* dysfunction to keep.
 * - **A breakthrough deletes 70% of one slice.** Rare, and the only thing that
 *   removes loss without raising the coordination value. It is what makes a
 *   fix worth buying: piling the loss into the slice you can delete.
 *
 * The slices here are the four §2.1 splits the coordination term into
 * (`sim/losses.ts`): meetings, waiting, duplicate work and handoffs. Slacking
 * and onboarding are measured, not modelled, so they are not on this ledger;
 * lag arrives with worlds (phase 7).
 *
 * Pure — no store, no clock, no renderer.
 */
import { coordinationWeights } from '../three/sim/losses.ts'

export const COORD_KINDS = ['meet', 'wait', 'dup', 'handoff'] as const
export type CoordKind = typeof COORD_KINDS[number]

/** One upgrade's declared move. `share` of what sits in `cuts` goes to `feeds`. */
export interface Fix {
  cuts: CoordKind
  feeds: CoordKind
  share: number
}

/** What a breakthrough leaves of the slice it targets. */
export const BREAKTHROUGH_KEEPS = 0.3

export interface Ledger {
  /** Where the coordination loss sits, summing to 1 (or all zero if nothing is left). */
  weights: Record<CoordKind, number>
  /**
   * How much of the coordination loss survives, 0..1. Fixes leave it at 1;
   * only breakthroughs lower it.
   */
  scale: number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0))

/**
 * Apply every fix, in the order given, to the scale's natural split, then every
 * breakthrough. Order matters for fixes (moving meetings into waiting and then
 * waiting into handoffs is not the reverse), so the caller passes them in the
 * order the upgrades were defined — which is stable across saves.
 */
export function coordinationLedger(heads: number, fixes: readonly Fix[], breakthroughs: readonly CoordKind[] = []): Ledger {
  const w: Record<CoordKind, number> = { ...coordinationWeights(heads) }
  for (const f of fixes) {
    if (f.cuts === f.feeds) continue
    const moved = w[f.cuts] * clamp01(f.share)
    w[f.cuts] -= moved
    w[f.feeds] += moved
  }
  for (const k of new Set(breakthroughs)) w[k] *= BREAKTHROUGH_KEEPS
  const total = COORD_KINDS.reduce((a, k) => a + w[k], 0)
  if (!(total > 0)) return { weights: { meet: 0, wait: 0, dup: 0, handoff: 0 }, scale: 0 }
  const weights = { meet: w.meet / total, wait: w.wait / total, dup: w.dup / total, handoff: w.handoff / total }
  return { weights, scale: Math.min(1, total) }
}
