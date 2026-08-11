/**
 * Defects — a shipped game keeps costing you. GDD §4.12, R21, R29.
 *
 * **Shipping was the end of a project's story and it is the wrong end.** §4.10e
 * made revenue a long tail; this makes *quality* one. A game goes out, and then
 * it starts breaking.
 *
 * Defects are not an event and not bad luck — they are a by-product of
 * production, in proportion to it:
 *
 * $$\\frac{dB}{dt} = \\beta \\cdot V \\cdot \\eta_{\\text{def}}(\\text{QA})$$
 *
 * **The faster you go, the more you break**, which is §6's thesis restated in a
 * second currency and the only reason this system belongs in the game.
 *
 * ---
 *
 * ## β is not a coefficient anybody picked
 *
 * §4.14.1 is emphatic about this and it is the load-bearing fact in the file:
 * **`β` *is* `rating.ts`'s {@link DEFECT_DENSITY_ANCHOR}.** It is imported, not
 * restated, and the arithmetic that makes that work is one line long:
 *
 * - With no QA, {@link defectSuppression} is exactly 1.
 * - So `dB/dt = β·V` and `dSP/dt = V`, and the density a studio ships at is
 *   `β`, exactly, at every velocity.
 * - `rating.ts` scores that density at exactly ½.
 *
 * Which means **a studio with no QA always scores exactly half on defects
 * whatever β is.** Retuning how fast bugs arrive changes how quickly a studio
 * reaches §4.12a's incidents and changes *nothing* about what a shipped game is
 * worth. §25.3.2 names β as the batch's one genuinely load-bearing number and
 * this is what stops it being load-bearing in two places at once.
 *
 * The direction of that dependency is the whole point, and it is easy to get
 * backwards: the rating is not calibrated against β. **β is defined by the
 * rating.** Anyone tempted to give this module its own constant should read
 * §25.3.1 first.
 *
 * ## Poking writes bugs
 *
 * §4.12: "§4.5's interruption is exactly how defects get written, so a poke adds
 * defects on the same coefficient §4.9 uses for Entropy." Taken literally —
 * {@link CONTEXT_SWITCH_COEFFICIENT}, the same constant, not a second one that
 * happens to have the same value today.
 *
 * A poked Story Point therefore carries `β + ε` defects against a passive one's
 * `β`. At today's values that is exactly double, and the sentence a player would
 * say out loud is the design: **interrupting somebody doubles the bugs in what
 * they write.**
 *
 * Pure. No store, no clock, no renderer.
 */

import { DEFECT_DENSITY_ANCHOR } from './rating.ts'
import { CONTEXT_SWITCH_COEFFICIENT } from './entropy.ts'
import { defectSuppression } from './roles.ts'

/**
 * §4.12's `β` — defects per Story Point of ordinary, uninterrupted work.
 *
 * **Imported from the rating, never chosen here.** See the file header; this
 * alias exists so §4.12's equation can be read in its own notation, and it is
 * deliberately not a `const` with a number on the right-hand side.
 */
export const BETA = DEFECT_DENSITY_ANCHOR

/**
 * What a poke adds on top of `β`, per Story Point — §4.12 via §4.9.
 *
 * The Entropy coefficient itself. If §4.9's context switch is ever retuned this
 * follows it, which is the behaviour §4.12 asked for when it said "the same
 * coefficient" rather than "a similar amount".
 */
export const POKE_BETA = CONTEXT_SWITCH_COEFFICIENT

function finite(x: number, fallback = 0): number {
  return Number.isFinite(x) ? x : fallback
}

/**
 * Defects arriving per second — §4.12's `dB/dt`.
 *
 * `velocity` is §4.1's `V`, in Story Points a second, *after* Entropy. That is
 * deliberate and it is the humane reading of the equation: a studio in §6.3's
 * lock produces nothing and therefore breaks nothing. Charging defects against
 * intended output rather than realised output would make the Entropy collapse
 * generate bugs at full rate while producing zero code, which is a second
 * punishment for a state that is already the game's one seizure.
 */
export function defectRate(velocity: number, qaShare: number): number {
  const v = Math.max(0, finite(velocity))
  return BETA * v * defectSuppression(qaShare)
}

/**
 * Defects written by one poke worth `sp` Story Points.
 *
 * Charged at `β + ε` rather than at `β`, and suppressed by QA on the same curve
 * as everything else — QA read the code whether a human was interrupted while
 * writing it or not.
 */
export function defectsFromPoke(sp: number, qaShare: number): number {
  const points = Math.max(0, finite(sp))
  return (BETA + POKE_BETA) * points * defectSuppression(qaShare)
}

/**
 * Integrate the backlog forward one step.
 *
 * Separate from {@link defectRate} so the caller can add poke defects in the
 * same step without the two paths disagreeing about clamping, and so §24.5's
 * offline resolver can advance a backlog by an hour in one call.
 */
export function advanceDefects(backlog: number, velocity: number, qaShare: number, dt: number): number {
  const b = Math.max(0, finite(backlog))
  const step = Math.max(0, finite(dt))
  if (step === 0) return b
  return b + defectRate(velocity, qaShare) * step
}

/**
 * §4.12's backlog at ship, per Story Point — what §4.14 scores.
 *
 * A project with no Story Points behind it has no density rather than an
 * infinite one: dividing a backlog by zero work is a question about a game
 * nobody built, and `rateRelease` already answers it by returning the baseline.
 */
export function defectDensity(backlog: number, storyPoints: number): number {
  const sp = finite(storyPoints)
  if (!(sp > 0)) return 0
  return Math.max(0, finite(backlog)) / sp
}

/**
 * What the studio ships at when nobody is checking — {@link BETA}, by
 * construction.
 *
 * Exported because it is the number §4.15's HUD compares against to decide
 * whether the density readout is good news, and because a test that asserts the
 * identity is worth more than a comment claiming it.
 */
export const GARAGE_DENSITY = BETA

/**
 * How the defect counter should read — §4.15.
 *
 * "1 per 21 SP" rather than a raw ratio, because a density of 0.047 is a number
 * nobody can hold and "one bug every twenty-one points" is a sentence. Returns
 * `null` when there is nothing to divide, so the HUD can render the count alone
 * rather than a placeholder.
 */
export function densityLine(backlog: number, storyPoints: number): string | null {
  const d = defectDensity(backlog, storyPoints)
  if (!(d > 0)) return null
  return `1 per ${Math.max(1, Math.round(1 / d))} SP`
}

/**
 * Clear defects with QA capacity over `dt`.
 *
 * **QA do not clear the backlog and this is not that function.** §4.12 is
 * explicit — "QA reduce the rate; SRE clear the backlog" — and the thing QA
 * clear is the work in front of them, which is what {@link defectSuppression}
 * already models by slowing arrival. What this exists for is the *ship* moment:
 * a project's backlog leaves with the project.
 *
 * Shipping resets the bench to zero and hands the density to the release, where
 * §4.12a charges it forever. The backlog is not forgiven — it is **transferred**,
 * which is the entire relationship between the two sections.
 */
export function shipDefects(backlog: number, storyPoints: number): { density: number; remaining: number } {
  return { density: defectDensity(backlog, storyPoints), remaining: 0 }
}
