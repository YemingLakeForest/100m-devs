/**
 * The Omni-Lens camera — GDD §7.
 *
 * One continuous zoom parameter Z in [0, 1] spans roughly nine orders of
 * magnitude, desk (1:1) to galactic (1:10^9). This is the game's visual hook
 * and, per GDD §7, its hardest technical requirement.
 *
 * The four canonical levels (§7.4) are bands of Z, not separate cameras. They
 * cross-fade, so nothing ever cuts (§10.5). The band edges are shared with the
 * audio zones in §20.2 — deliberately, so the picture and the sound change
 * register at the same instant rather than a beat apart.
 */

import type { ZoomLevel } from '../sim/poke.ts'

/** Z at which each level's band ends — GDD §20.2 zone boundaries. */
export const BAND_EDGES = [0.2, 0.5, 0.8] as const

/** The scale span the lens covers: 1:1 at the desk to 1:10^9 at galactic. */
export const ORDERS_OF_MAGNITUDE = 9

/** Which canonical level Z currently sits in — GDD §7.4. */
export function zoomLevel(z: number): ZoomLevel {
  if (z < BAND_EDGES[0]) return 1
  if (z < BAND_EDGES[1]) return 2
  if (z < BAND_EDGES[2]) return 3
  return 4
}

/**
 * World scale at Z. Logarithmic, because the thing being spanned is nine
 * orders of magnitude — a linear map would spend almost the whole gesture in
 * the last decade and make the desk unreachable.
 */
export function scaleAt(z: number): number {
  return 10 ** (-ORDERS_OF_MAGNITUDE * clamp01(z))
}

/** Inverse of {@link scaleAt} — useful when a target scale is what is known. */
export function zoomForScale(scale: number): number {
  return clamp01(-Math.log10(scale) / ORDERS_OF_MAGNITUDE)
}

/** Centre of each level's band, used as the peak of its cross-fade. */
const CENTRES: Record<ZoomLevel, number> = {
  1: 0.1,
  2: 0.35,
  3: 0.65,
  4: 0.9,
}

/**
 * Half-width of each level's visibility window. Wider than the band itself so
 * neighbours overlap and the hand-off is a fade rather than a swap.
 */
const HALF_WIDTHS: Record<ZoomLevel, number> = {
  1: 0.22,
  2: 0.26,
  3: 0.26,
  4: 0.22,
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

/**
 * Tracks Z and its velocity across frames.
 *
 * Velocity drives the radial smear (ART_DIRECTION §6 pass 2) and the §20.4
 * doppler whoosh, so it has to be measured rather than inferred from the
 * gesture — a pinch and a programmatic dolly should smear identically.
 */
export class LensCamera {
  private _z: number
  private _velocity = 0
  /** Z at the last sampled frame, for the finite difference. */
  private lastZ: number

  constructor(z = 0) {
    this._z = clamp01(z)
    this.lastZ = this._z
  }

  get z(): number {
    return this._z
  }

  /** |dZ/dt| in Z-units per second. */
  get velocity(): number {
    return this._velocity
  }

  get level(): ZoomLevel {
    return zoomLevel(this._z)
  }

  get scale(): number {
    return scaleAt(this._z)
  }

  set(z: number): void {
    this._z = clamp01(z)
  }

  /** Relative zoom, as a pinch produces. Positive pulls the camera out. */
  nudge(dz: number): void {
    this.set(this._z + dz)
  }

  /** Call once per frame, before reading {@link velocity}. */
  sample(dtSeconds: number): void {
    if (dtSeconds <= 0) return
    const instantaneous = Math.abs(this._z - this.lastZ) / dtSeconds
    // Smoothed, because a single dropped frame otherwise reads as a huge
    // velocity spike and fires a smear the player did not ask for.
    this._velocity += (instantaneous - this._velocity) * Math.min(1, dtSeconds * 12)
    this.lastZ = this._z
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}
