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
export const BAND_EDGES = [zAtRung(1.5), zAtRung(3.5), zAtRung(7.5)] as const

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

/**
 * Centre of each level's band, used as the peak of its cross-fade.
 *
 * The midpoint of the band, which is now a fact about the §7.4a ladder rather
 * than a hand-picked number: level 3 is wide because four rungs — block,
 * campus, town, nation — are all drawn from the same tier's geometry.
 *
 * Exported because the fit normalises by it, so a test that asserts "a tier
 * exactly fills the frame at its own centre" has to be able to ask where that
 * is rather than keeping its own copy.
 */
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
  return fitScale(extents[level], viewport, z, CENTRES[level])
}

/**
 * The same framing, for one object at one stop on the §7.4a ladder.
 *
 * {@link tierScale} was written when a tier and a navigation stop were the same
 * thing. They are not — §7.4a — and level 2 alone now holds two stops while
 * level 3 holds four, so the normalising point has to be the *stop's* Z rather
 * than the tier's band centre. Framed at its own stop and only its own stop, a
 * town fills the frame exactly as a floor did, which is §7.7.1's promise that
 * the unit changes rather than the studio receding.
 *
 * `tierScale` is now a thin call into this and is kept because §23.3's bench,
 * the debug snapshot and the tests all still reason in tiers.
 */
export function fitScale(
  extent: Extent,
  viewport: Extent,
  z: number,
  stopZ: number,
): number {
  // A zero-sized viewport happens for a frame during startup and on some
  // rotation paths. Returning 0 would collapse the world to a point and
  // returning NaN would poison every transform downstream.
  if (!(viewport.w > 0) || !(viewport.h > 0)) return 1
  if (!(extent.w > 0) || !(extent.h > 0)) return 1

  const fit = Math.min(viewport.w / extent.w, viewport.h / extent.h) * FIT_MARGIN

  return fit * (relativeCurve(z) / relativeCurve(stopZ))
}

/**
 * How much closer than "the whole view fits" a view may be pushed at the
 * bottom of its own band — GDD §7.7.1, and the second half of §26.2.2.
 *
 * {@link fitScale} frames a view's *whole extent* at its stop and then follows
 * one fixed curve inwards, which makes the range across a band a constant: for
 * the room, exactly 3x. That was right while the room was Act I's forty desks,
 * where three times "the room fits" genuinely is a desk.
 *
 * It stops being right the moment the room holds a thousand people. §7.7.1 says
 * rungs 0–2 are "the same picture at three densities" and names rung 0 **the
 * desk** — but three times a full room is still a quarter of a full room, so
 * the bottom of the ladder arrived somewhere between "a floor" and "most of a
 * floor" and never reached anybody. The complaint that produced this function
 * was exactly that: *"it's not zooming down to desk level just yet."*
 *
 * So the range is a *quantity of people* rather than a constant. The caller
 * asks for the room to frame one §7.8.1a squad at rung 0 whatever is in it, and
 * a room holding fewer than a squad or three asks for nothing at all — which is
 * what keeps every Run 1 frame pixel-identical to the one before this existed.
 *
 * Eased on the same curve as the fit it multiplies, so the dolly is still one
 * continuous motion rather than a fit with a second acceleration bolted on.
 *
 * @param range How many times "the whole view fits" the bottom of the band
 *              should be. Values at or below the band's natural range do
 *              nothing.
 */
export function closeUp(z: number, stopZ: number, range: number): number {
  const natural = relativeCurve(0) / relativeCurve(stopZ)
  if (!(range > natural) || !Number.isFinite(range)) return 1
  const at = relativeCurve(z) / relativeCurve(stopZ)
  // 0 at the stop, 1 at the bottom of the band. Clamped because the camera is
  // allowed above its own stop, where this must be exactly 1 and not less.
  const u = Math.min(1, Math.max(0, (at - 1) / (natural - 1)))
  return 1 + u * (range / natural - 1)
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
    // A cancelled/degenerate pinch can briefly produce NaN (two touch points
    // on exactly the same pixel gives a 0/0 ratio). Never let that poison the
    // LOD weights: NaN makes every view non-renderable while the DOM HUD keeps
    // drawing, which presents as a completely dark game screen.
    if (!Number.isFinite(z)) return
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
  // Pure camera helpers are also called directly by visual tests and debug
  // paths, so they need the same fail-visible guarantee as LensCamera.set().
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}
