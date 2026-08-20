/**
 * The Z bands — GDD §7.4 and §20.2.
 *
 * **What is left of the Omni-Lens after the lens rebuild.** This file used to
 * hold the camera as well: a per-tier fit (`tierScale`) plus an alpha
 * cross-fade between four representations of the same space. That is the thing
 * §7.5 asked for and the thing the room could not survive — the neighbouring
 * tier was always drawn about 3.16x off its own scale, so every dolly was a
 * dissolve and no two levels ever agreed on where anything was. `lens.ts` and
 * `frames.ts` replaced it with one camera and nested frames, where descending
 * is a single affine transform and there is nothing to cross-fade.
 *
 * The bands survive because §20.2's audio zones are defined on them, and a
 * zone boundary is a real thing whatever draws the picture: the sound changes
 * register where the ladder's tier changes, which is still where the picture
 * does. {@link BAND_EDGES}, {@link zoomLevel} and {@link lodWeights} are the
 * whole of what music.ts needs, and they are the whole of what is here.
 */

import type { ZoomLevel } from '../sim/poke.ts'
import { zAtRung } from '../sim/ladder.ts'

/**
 * Z at which each level's band ends — GDD §20.2 zone boundaries.
 *
 * **Derived from the §7.4a ladder rather than chosen.** These used to be
 * `[0.2, 0.5, 0.8]`, three round numbers with nothing under them, and that was
 * the visible half of the bug §7.4a names: the bands *were* the navigation, so
 * pulling back crossed four of them and arrived at a galaxy. The bands are now
 * where the ladder's tier changes — halfway between the last rung drawn from
 * one tier's geometry and the first rung drawn from the next — so the picture's
 * register and the sound's still change on the same frame (§20.2) and both now
 * change at a rung boundary rather than at a round number.
 */
function clamp01(v: number): number {
  // Pure camera helpers are also called directly by visual tests and debug
  // paths, so they need the same fail-visible guarantee the camera had: a NaN Z
  // that quietly propagated blanked the screen.
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

export const BAND_EDGES = [zAtRung(1.5), zAtRung(3.5), zAtRung(7.5)] as const

/** The scale span the lens covers: 1:1 at the desk to 1:10^9 at galactic. */
/** Which canonical level Z currently sits in — GDD §7.4. */
export function zoomLevel(z: number): ZoomLevel {
  if (z < BAND_EDGES[0]) return 1
  if (z < BAND_EDGES[1]) return 2
  if (z < BAND_EDGES[2]) return 3
  return 4
}

export const CENTRES: Record<ZoomLevel, number> = {
  1: (0 + BAND_EDGES[0]) / 2,
  2: (BAND_EDGES[0] + BAND_EDGES[1]) / 2,
  3: (BAND_EDGES[1] + BAND_EDGES[2]) / 2,
  4: (BAND_EDGES[2] + 1) / 2,
}

/**
 * Half-width of each level's visibility window. Wider than the band itself so
 * neighbours overlap and the hand-off is a fade rather than a swap.
 */
const HALF_WIDTHS: Record<ZoomLevel, number> = {
  1: 0.19,
  2: 0.24,
  3: 0.3,
  4: 0.2,
}

/**
 * Cross-fade opacity for each LOD tier at a given Z.
 *
 * Weights are normalised to sum to 1, which is what keeps total scene
 * brightness constant through a dolly. Without it the overlap regions read as
 * a brightness pulse at every band edge — the exact "something cut" artefact
 * §10.5 forbids.
 */
export function lodWeights(z: number): Record<ZoomLevel, number> {
  const zc = clamp01(z)
  const raw = {} as Record<ZoomLevel, number>
  let total = 0

  for (const level of [1, 2, 3, 4] as const) {
    const d = Math.abs(zc - CENTRES[level]) / HALF_WIDTHS[level]
    // Smoothstep falloff — continuous in both value and slope at the edges, so
    // no tier appears or disappears with a visible kink.
    const w = d >= 1 ? 0 : 1 - d * d * (3 - 2 * d)
    raw[level] = w
    total += w
  }

  if (total === 0) {
    // Unreachable with the windows above, but a divide-by-zero here would
    // blank the screen, so fall back to the band's own level.
    const only = zoomLevel(zc)
    return { 1: 0, 2: 0, 3: 0, 4: 0, [only]: 1 } as Record<ZoomLevel, number>
  }

  for (const level of [1, 2, 3, 4] as const) raw[level] /= total
  return raw
}
