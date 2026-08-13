/**
 * §13.11.1 — "who covers this?", the pure half.
 *
 * The renderer draws badges on a unit's face and tints exactly the developers a
 * hero reaches. This file is the arithmetic it tints *by*: given the heroes
 * placed on a unit, which of them reach it, how much of it, and where two
 * heroes of one branch waste coverage on each other (§13.8 rule 3 — two of a
 * class over the same rows do not stack).
 *
 * The Pixi drawing (badges, tinted footprints, cross-hatching, the fading
 * settle) is not here, and that is deliberate: hero placement is gated behind
 * §13.6.7a's Layer 2, which does not exist yet, so a renderer built today would
 * be drawing a floor that can never hold a hero. What *is* testable now is the
 * overlap and fraction maths, which is the part that has been wrong before.
 */

import type { HeroBranch } from '../sim/heroTree.ts'
import { coverage } from '../sim/heroes.ts'
import type { HeroState } from '../sim/heroes.ts'

/** One hero's claim over one unit. */
export interface CoverageClaim {
  heroId: string
  branch: HeroBranch
  /** §13.6.2 — the fraction of the unit the hero actually reaches. */
  fraction: number
  complete: boolean
}

/** §13.11.1 — who covers this unit, and where coverage is wasted. */
export interface UnitFootprint {
  claims: readonly CoverageClaim[]
  /** Branches with two or more heroes over the same unit — the cross-hatch. */
  overlapped: ReadonlySet<HeroBranch>
}

/**
 * Fold a unit's placements into what the badge layer draws.
 *
 * A hero reaches a fraction of the unit per §13.6.2; two heroes of one branch
 * do not stack, so where they overlap the second one is *visibly wasted*
 * (§13.11.1's cross-hatching rather than a scolding).
 */
export function unitFootprint(
  placements: ReadonlyArray<{ heroId: string; branch: HeroBranch; state: HeroState }>,
  devsAtSlot: number,
): UnitFootprint {
  const claims: CoverageClaim[] = []
  const seen = new Map<HeroBranch, number>()

  for (const p of placements) {
    const cov = coverage(p.state, devsAtSlot)
    claims.push({ heroId: p.heroId, branch: p.branch, fraction: cov.fraction, complete: cov.complete })
    seen.set(p.branch, (seen.get(p.branch) ?? 0) + 1)
  }

  const overlapped = new Set<HeroBranch>()
  for (const [branch, count] of seen) if (count > 1) overlapped.add(branch)

  return { claims, overlapped }
}
