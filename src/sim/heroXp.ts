/**
 * Hero XP — GDD §13.10, R39.
 *
 * §4.5d gave the founder a curve that grows because *you* got better. Heroes
 * need the same thing, and §13.6.5 denied them it: their nodes were bought with
 * GP, which is prestige currency, so a hero could only ever improve *between*
 * runs and never during one.
 *
 * **A placed hero earns XP from the work done under their coverage.**
 *
 * $$\frac{dX_h}{dt} = \xi \cdot V_{\text{covered}(h)}$$
 *
 * `V` is §4.1's velocity, restricted to the developers the coverage rule says
 * the hero reaches. An unplaced hero earns nothing — that is the second reason
 * §13.8's placement matters, and it is a compounding one. Everything here is
 * pure; the store owns the velocity and the placement, this owns the curve.
 */

/**
 * §13.10's rate, `ξ`.
 *
 * A first pass, marked as one. Picked so a hero covering a project completely
 * earns about one node per project shipped early on: a four-hundred-point
 * project at `ξ = 0.025` is ten XP, which is exactly {@link XP_COST_BASE}.
 */
export const XP_RATE = 0.025

/** §13.10 — XP accrued from `velocityCovered` for `dt` seconds. */
export function xpAccrued(velocityCovered: number, dt: number): number {
  if (!(velocityCovered > 0) || !(dt > 0)) return 0
  return XP_RATE * velocityCovered * dt
}

/** §14.5's curve, §13.10's "X₀ κ^n". A first pass. */
export const XP_COST_BASE = 10
export const XP_KAPPA = 1.6

/** The XP price of the *next* node, given how many are already bought. */
export function xpNodeCost(nodesBought: number): number {
  return Math.ceil(XP_COST_BASE * XP_KAPPA ** Math.max(0, Math.floor(nodesBought)))
}

/** Can the hero buy their next tree node? */
export function canBuyNode(nodesBought: number, xp: number): boolean {
  return xp >= xpNodeCost(nodesBought)
}

/**
 * §13.10 — "XP must not make an unplaced hero worthless."
 *
 * The gap between a tended hero and a benched one is a percentage that grows,
 * never a threshold that locks. This is that sentence restated as a predicate
 * the store asks before charging: an unplaced hero contributes zero *new* XP
 * and is never *drained*, so the difference is always one of rate, not of debt.
 */
export function unplacedEarnsNothing(placed: boolean, velocityCovered: number): boolean {
  return !placed || !(velocityCovered > 0)
}
