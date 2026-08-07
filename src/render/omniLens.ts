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
 * Fraction of the shorter viewport axis the dominant tier fills — GDD §23.4.2.
 *
 * Not 1.0: §23.4.2 keeps the margin on the wider axis for the HUD, and a tier
 * pressed flush to two edges reads as cropped rather than framed.
 */
export const FIT_MARGIN = 0.88

export interface Extent {
  w: number
  h: number
}

/**
 * World scale at Z, for a given viewport — GDD §23.4.1.
 *
 * **This replaced a viewport-independent `1 / (1 + z·9)`.** That formula had no
 * screen dimension in it at all, so the swarm rendered at a fixed 239 × 120 px
 * on every display and filled 6.4% of *either* orientation, identically. The
 * landscape decision (§23.4) delivered nothing visible until this existed,
 * because there was no code path by which the viewport could affect the
 * picture.
 *
 * **Scale is PER TIER, not one world scale**, and that is the whole trick. The
 * four tiers differ in intrinsic size by more than 5× — the desk is 192 world
 * units across, the floor is 992. A single shared scale cannot frame both, and
 * the first version of this function tried: blending the per-tier fits by LOD
 * weight produced a scale that fitted neither, and at desk zoom it rendered the
 * cross-fading floor tier **3,780 px wide inside a 1,023 px viewport**.
 *
 * So each tier is framed independently and the cross-fade does opacity only,
 * which is also a truer reading of §7.5: the tiers are four *representations of
 * the same space*, not four objects in one space.
 *
 * Two parts:
 *
 *  1. **Fit.** `min(vw/w, vh/h)` — the tier fills the shorter axis, leaving the
 *     margin on the wider one for the HUD (§23.4.2).
 *  2. **Modulation.** A fit alone would make pinching within a band do nothing
 *     but cross-fade, which reads as the gesture being ignored. The old
 *     relative curve is kept and *normalised by its value at this tier's own
 *     band centre*: exactly 1 at the centre, so the tier exactly fits there,
 *     and drifting either side zooms as the thumb expects.
 *
 * The dolly still reads as one continuous pull-back, because on the way out the
 * near tier shrinks below its fit while the far tier arrives above its fit and
 * settles into frame — the two motions are in the same direction.
 *
 * Pure, so the framing can be tested without a renderer — which matters,
 * because "the game fills the screen" was asserted rather than measured once
 * already.
 */
export function tierScale(
  level: ZoomLevel,
  z: number,
  viewport: Extent,
  extents: Record<ZoomLevel, Extent>,
): number {
  // A zero-sized viewport happens for a frame during startup and on some
  // rotation paths. Returning 0 would collapse the world to a point and
  // returning NaN would poison every transform downstream.
  if (!(viewport.w > 0) || !(viewport.h > 0)) return 1

  const e = extents[level]
  const fit = Math.min(viewport.w / e.w, viewport.h / e.h) * FIT_MARGIN

  return fit * (relativeCurve(z) / relativeCurve(CENTRES[level]))
}

/**
 * The pre-§23.4.1 zoom curve, kept only as the *shape* of within-band zoom.
 * Its absolute value no longer means anything — {@link fitScale} divides it by
 * its own value at the band centre, so only its slope survives.
 */
function relativeCurve(z: number): number {
  return 1 / (1 + clamp01(z) * 9)
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
