/**
 * **The flight from a city to its planet** [2026-10-11 — DEMO, `demo/ladder-jokes`; GDD §7.4a's
 * "cinematic Powers-of-Ten flights remain future work", first built here].
 *
 * The lens used to hand the city to the globe on one frame: the district was drawn up to level 4.5 and
 * the planet from 4.5, two draw functions with nothing between them, so a scroll that had been a
 * smooth dolly through the neighbourhood became a cut. Both pictures are the *same register* (the
 * monitor), so §1.0b's rule — nothing is blended *across* registers, the hand-off is a CRT wipe — does
 * not apply, and this is the one place on the ladder where blending is allowed and wanted.
 *
 * ## What the flight is
 *
 * A *match cut that is also a dolly*. The city shrinks toward the one thing that is the same at both
 * scales — the HQ's garage glyph, which stays at the focus the whole way — while the planet rises behind
 * it from three times its size, turned to face the city you came from, and the city dissolves into the
 * hub's lights. It runs over the band `[BRIDGE_FROM, BRIDGE_TO]` of the lens, so **it is a scrub
 * under the wheel and a timed flight under a tab jump or the dive button** (`studioAtlas.ts` animates the
 * displayed level; this file is only the shape of the flight at a point along it).
 *
 * A physically exact zoom is not on offer and this is not one: the planet's surface is rasterised per
 * pixel at a size tied to its radius (`planetSurface.ts`), and a true city-to-planet ratio is about
 * seventy to one. So the planet comes up from 3× and the city does most of the shrinking — and the
 * pose is chosen so that **there is never a hole**: at every point at least one layer is mostly opaque
 * (the lens ladder's own lesson, `ladder.ts`: *an oversized arrival is a zoom; an empty frame is nothing
 * at all*).
 *
 * Pure — no store, no clock, no renderer. `u` is 0 at the city and 1 at the planet.
 */

/** Where the planet's register begins (§7.4a: every ceiling stops short of it, so a promotion opens it). */
export const BRIDGE_FROM = 4.5
/** Where the flight lands: the planet at the lens level it has always been drawn at its first stop. */
export const BRIDGE_TO = 5.2

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** The classic Hermite ease, 0 at `a` and 1 at `b` (and the other way round if `b < a`). */
export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * **Where a timed flight spends its time.** A jump from the city stop (3.6) to the planet (5) is 1.4 levels,
 * and the first 0.9 of them are the district zooming out the way it always has: ordinary, and not what
 * anyone asked to watch. Timed evenly, the dive itself was a few frames at the end of a long, dull
 * approach. So crossing the bridge band costs `BAND_DWELL` times what crossing the same distance anywhere
 * else does: the flight is brisk to the band, then slow inside it, then brisk again.
 *
 * `flightCost` is the cumulative cost of reaching a lens level (monotone, piecewise linear) and
 * `levelAtCost` is its inverse, so a flight tweens *cost* and the level falls out.
 */
export const BAND_DWELL = 3.5

export function flightCost(level: number): number {
  return level + (BAND_DWELL - 1) * clamp01((level - BRIDGE_FROM) / (BRIDGE_TO - BRIDGE_FROM)) * (BRIDGE_TO - BRIDGE_FROM)
}

export function levelAtCost(cost: number): number {
  const extra = (BAND_DWELL - 1) * (BRIDGE_TO - BRIDGE_FROM)
  const inStart = BRIDGE_FROM, inEnd = flightCost(BRIDGE_TO)
  if (cost <= inStart) return cost
  if (cost >= inEnd) return cost - extra
  return BRIDGE_FROM + (cost - inStart) / BAND_DWELL
}

/** A gentle ease: an overshoot-free start and stop with none of the cubic's long dead lead-in. */
export const easeInOutSine = (t: number): number => (1 - Math.cos(Math.PI * clamp01(t))) / 2

/** How far along the flight a displayed lens level is: 0 is the city, 1 is the planet. */
export function bridgeU(shown: number): number {
  return clamp01((shown - BRIDGE_FROM) / (BRIDGE_TO - BRIDGE_FROM))
}

/** The smallest the city gets before it is gone: a quarter of a screen's worth of district, reduced to a hub's lights. */
export const CITY_MIN_ZOOM = 0.08
/** How much bigger than its resting size the planet is when the flight begins. */
export const GLOBE_START_MUL = 3

export interface FlightPose {
  /** Multiplier on the district's own scale. 1 at the city, shrinking. */
  cityZoom: number
  cityAlpha: number
  globeAlpha: number
  /** Multiplier on the planet's resting radius. `GLOBE_START_MUL` at the city, 1 at the planet. */
  globeMul: number
  /** 0 = the planet is turned however the player left it; 1 = it faces the city. */
  orient: number
  /** 0 = the focus is where the city's centre is; 1 = it is where the planet puts it at rest. */
  pin: number
}

export function flightPose(u: number): FlightPose {
  const t = clamp01(u)
  // The city does nearly all of its shrinking early and then settles, so the eye reads a *fall* toward the pin.
  const fall = smoothstep(0, 0.8, t)
  return {
    cityZoom: Math.exp(Math.log(CITY_MIN_ZOOM) * fall),
    cityAlpha: 1 - smoothstep(0.4, 0.85, t),
    globeAlpha: smoothstep(0.05, 0.55, t),
    globeMul: 1 + (GLOBE_START_MUL - 1) * (1 - smoothstep(0, 1, t)),
    // Facing the city by the time the planet is half there; handing back to the player's own turn only
    // in the last sliver, so a globe the player has turned away does not snap on the first frame of a dive.
    orient: 1 - smoothstep(0.85, 1, t),
    pin: smoothstep(0, 1, t),
  }
}

/* --- the planet, turned to a place ------------------------------------------------------------------- */

export type Vec3 = readonly [number, number, number]

/** The planet's own transform (what `drawGlobe` projects with), restated so a flight can place a point on it. */
export function project(point: Vec3, yaw: number, tilt: number): { x: number; y: number; depth: number } {
  const [a, b, c] = point
  const x = a * Math.cos(yaw) + c * Math.sin(yaw)
  const z = c * Math.cos(yaw) - a * Math.sin(yaw)
  const y = b * Math.cos(tilt) - z * Math.sin(tilt)
  return { x, y, depth: z * Math.cos(tilt) + b * Math.sin(tilt) }
}

/** The turn that brings `point` to the middle of the disc, facing the viewer. The Frontier button's own formula. */
export function facing(point: Vec3): { yaw: number; tilt: number } {
  return { yaw: -Math.atan2(point[0], point[2]), tilt: Math.asin(Math.max(-1, Math.min(1, point[1]))) }
}

/** An angle moved toward another the short way round. */
export function lerpAngle(from: number, to: number, t: number): number {
  const TAU = Math.PI * 2
  const d = ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI
  return from + d * t
}
