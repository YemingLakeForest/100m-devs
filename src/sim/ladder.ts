/**
 * The navigation ladder — GDD §7.4a.
 *
 * **§7.4's four levels are a rendering concept and the camera was using them as
 * a navigation one.** Pull back from a floor and you arrived at a *galaxy*,
 * having skipped the building, the campus, the town and the nation that §7.7.1
 * spends ten rungs establishing — the studio the player built was not on screen
 * at any point during the move.
 *
 * So the thing the camera travels along is the **Construction Ladder**, rung by
 * rung, and each rung has a *view*: the picture that rung is a picture of.
 * Three rungs share the room — a desk, a huddle and a full floor are the same
 * room seen from three distances — and two share the cosmic tier; everything
 * between them is one rung, one view, one place the camera can stop.
 *
 * | Rung | §7.7.1 unit | View | §7.4 tier |
 * |---|---|---|---|
 * | 0 | person | `room` | 1 |
 * | 1 | person | `room` | 1 |
 * | 2 | person | `room` | 2 |
 * | 3 | floor | `tower` | 2 |
 * | 4 | building | `block` | 3 |
 * | 5 | campus | `park` | 3 |
 * | 6 | town | `sprawl` | 3 |
 * | 7 | nation | `grid` | 3 |
 * | 8 | planet | `cosmic` | 4 |
 * | 9 | galaxy | `cosmic` | 4 |
 *
 * Pure and dependency-free — deliberately, because `sim/headcount.ts` reads the
 * ladder to work out how far the camera may pull back, and a navigation model
 * that imported a renderer could not be asked that question.
 *
 * The Z parameter is unchanged: §7.2's single continuous [0, 1], now divided
 * into nine equal rung steps rather than four uneven bands.
 */

import type { ZoomLevel } from './poke.ts'

/** The top rung index. Rungs run 0..{@link TOP_RUNG}, so there are ten. */
export const TOP_RUNG = 9

/** What the camera is looking at, at each stop on the ladder. */
export type ViewKind = 'room' | 'tower' | 'block' | 'park' | 'sprawl' | 'grid' | 'cosmic'

export interface LadderView {
  view: ViewKind
  /**
   * The lowest rung this view covers.
   *
   * Separate from {@link stop}, and the separation is load-bearing: `room`
   * spans rungs 0 to 2 and fits at 2, so "is this view earned" cannot be asked
   * of the stop. Deriving the gate from the stop said a one-developer studio
   * had not earned the room it was sitting in.
   */
  from: number
  /**
   * The rung this view is the picture of, and the Z at which it exactly fits
   * the frame. Fractional for the two views that span a pair of rungs, so the
   * fit sits between them rather than favouring one.
   */
  stop: number
  /** Which §7.4 tier's geometry it is drawn from — this is the *rendering* concept. */
  tier: ZoomLevel
  /**
   * How many rungs away the view stays on screen, as the half-width of its
   * cross-fade. Wider than the gap between stops on purpose — §10.5 says
   * nothing cuts, so every stop overlaps its neighbours.
   */
  halfWidth: number
  /**
   * The same, on the way **out**, when it differs.
   *
   * It differs for exactly one view and the asymmetry is the whole point.
   * `room` spans rungs 0–2 and fits at 2, so it needs to stay lit for two rungs
   * *below* its stop — that is three quarters of the game. One symmetric width
   * then kept it lit for two rungs above as well, so at rung 3 the floor's
   * desks were still being drawn at half alpha straight through the building
   * they are inside, and at rung 4 through the block. That is the
   * see-through-floor defect: not a fade that was tuned wrong, a fade that was
   * being asked one question and answering a different one.
   */
  halfWidthOut?: number
}

/** Every stop, in ladder order. */
export const VIEWS: readonly LadderView[] = [
  // **Rungs 0, 1 and 2 are all the room**, and the third of those is the
  // correction. Rung 2 used to be a separate `floor` view — an abstract grid of
  // particles with no walls, no plates and no individuals in it — on the
  // assumption that a thousand real developers could not be drawn. They can:
  // measured at 59 fps, the same figure the particles were getting. So the
  // whole hundred-to-a-thousand band, which is most of the game, is the room
  // the player already knows, seen from further out and fuller.
  //
  // The stop is rung 2 because that is where the *full* floor exactly fits.
  // Pinching in from there over-scales the same geometry toward the desk, which
  // is §7.7.4's Hero Anchor and is exactly how rung 0 already worked.
  { view: 'room', from: 0, stop: 2, tier: 1, halfWidth: 2.1, halfWidthOut: 1 },
  { view: 'tower', from: 3, stop: 3, tier: 2, halfWidth: 1.25 },
  { view: 'block', from: 4, stop: 4, tier: 3, halfWidth: 1.15 },
  { view: 'park', from: 5, stop: 5, tier: 3, halfWidth: 1.15 },
  { view: 'sprawl', from: 6, stop: 6, tier: 3, halfWidth: 1.15 },
  { view: 'grid', from: 7, stop: 7, tier: 3, halfWidth: 1.25 },
  { view: 'cosmic', from: 8, stop: 8.5, tier: 4, halfWidth: 1.9 },
] as const

export const VIEW_KINDS: readonly ViewKind[] = VIEWS.map((v) => v.view)

const BY_KIND = new Map<ViewKind, LadderView>(VIEWS.map((v) => [v.view, v]))

export function viewSpec(view: ViewKind): LadderView {
  const spec = BY_KIND.get(view)
  if (!spec) throw new Error(`unknown ladder view: ${view}`)
  return spec
}

function clamp01(v: number): number {
  // Invalid camera input must fall back to the nearest visible room, never
  // turn every cross-fade weight into NaN and cull the whole visual layer.
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Where on the ladder Z sits, continuously. 0 is the desk, 9 the galaxy. */
export function rungAt(z: number): number {
  return clamp01(z) * TOP_RUNG
}

/** Z at a rung — the inverse. Fractional rungs are legal; this is a ladder, not a lift. */
export function zAtRung(rung: number): number {
  return clamp01(rung / TOP_RUNG)
}

/** Z at which `view` exactly fits the frame. */
export function viewStopZ(view: ViewKind): number {
  return zAtRung(viewSpec(view).stop)
}

/**
 * Which §7.4 tier a rung's geometry comes from.
 *
 * This is the *rendering* half of §7.4a and it is deliberately no longer the
 * navigation half: four tiers still hold the geometry, ten rungs decide where
 * the camera stops, and the two are related by this table rather than confused
 * with each other.
 */
const TIER_OF_RUNG: readonly ZoomLevel[] = [1, 1, 2, 2, 3, 3, 3, 3, 4, 4]

export function tierForRung(rung: number): ZoomLevel {
  const i = Math.max(0, Math.min(TOP_RUNG, Math.round(rung)))
  return TIER_OF_RUNG[i]
}

/**
 * Cross-fade weight per view at a given Z — the §10.5 hand-off, on the ladder.
 *
 * The same smoothstep-and-normalise as the old per-tier fade, measured in rung
 * distance rather than in Z, which is what makes every rung an equal-sized step
 * regardless of how many decades of headcount it happens to cover.
 */
export function viewWeights(z: number): Record<ViewKind, number> {
  const at = rungAt(z)
  const raw = {} as Record<ViewKind, number>
  let total = 0

  for (const spec of VIEWS) {
    const width = at > spec.stop ? (spec.halfWidthOut ?? spec.halfWidth) : spec.halfWidth
    const d = Math.abs(at - spec.stop) / width
    const w = d >= 1 ? 0 : 1 - d * d * (3 - 2 * d)
    raw[spec.view] = w
    total += w
  }

  if (total === 0) {
    // Unreachable with the half-widths above, and a divide by zero here would
    // blank the screen rather than merely look wrong.
    const only = nearestView(at)
    for (const spec of VIEWS) raw[spec.view] = spec.view === only ? 1 : 0
    return raw
  }

  for (const spec of VIEWS) raw[spec.view] /= total
  return raw
}

function nearestView(rung: number): ViewKind {
  let best = VIEWS[0]
  for (const spec of VIEWS) {
    if (Math.abs(rung - spec.stop) < Math.abs(rung - best.stop)) best = spec
  }
  return best.view
}

/** The view the camera is actually looking at — the one with the most weight. */
export function dominantView(z: number): ViewKind {
  return nearestView(rungAt(z))
}

/**
 * §7.4a — how far out the ladder a studio of this rung may be looked at.
 *
 * "A rung the player has not earned is not reachable" — so the ceiling is the
 * player's own rung and not one past it. The floor of 1 is not an exception to
 * that: rungs 0 and 1 are the same room, so a studio of one developer can still
 * pull back far enough to see the room they are sitting in.
 */
export function ceilingZForRung(rung: number): number {
  return zAtRung(Math.max(1, Math.min(TOP_RUNG, Math.floor(rung))))
}

/**
 * Is this view part of the studio the player has actually built? — §7.7.1.
 *
 * The ceiling already stops the camera short of an unearned rung, but the
 * cross-fade reaches a rung past wherever it is parked, so without this the
 * campus the player has not built ghosts in behind the block they have.
 */
export function viewEarnedAt(view: ViewKind, rung: number): boolean {
  return viewSpec(view).from <= Math.max(1, rung)
}

/**
 * The cross-fade with the unearned rungs taken out **and the rest renormalised**.
 *
 * The renormalise is the part that is not obvious and is the part that shows.
 * At the ceiling the rung above is carrying real weight — that is what the gate
 * is for — so simply zeroing it leaves the weights summing to less than one,
 * and the studio fades out by about a tenth at exactly the moment it is at its
 * largest. §10.5's constant-brightness rule is about dollies, but a picture
 * that dims because of what is *not* on screen fails it just as visibly.
 */
export function earnedViewWeights(z: number, rung: number): Record<ViewKind, number> {
  const raw = viewWeights(z)
  let total = 0
  for (const spec of VIEWS) {
    if (!viewEarnedAt(spec.view, rung)) raw[spec.view] = 0
    total += raw[spec.view]
  }
  if (total <= 0) {
    // Only reachable if the camera is somehow parked past the ceiling. Showing
    // the room is wrong; showing nothing is worse.
    raw.room = 1
    return raw
  }
  for (const spec of VIEWS) raw[spec.view] /= total
  return raw
}
