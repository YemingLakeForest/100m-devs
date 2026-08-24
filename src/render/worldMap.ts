/**
 * The planet — where the land is, where the campuses go, and how a point on a
 * sphere lands on the screen.
 *
 * Pure arithmetic, no Pixi, because every fact in here is one the frame maths,
 * the renderer and the picker all have to agree about. `globe.ts` draws what
 * this describes; `frames.ts` sizes the sphere from {@link SITES_PER_GLOBE};
 * `stage.ts` picks with {@link siteAtGlobe}. Three consumers is exactly the
 * situation `HANDOFF-2026-08-22.md` §3 says a geometry cannot be written down
 * twice in — the deck's margin cost an afternoon for being in two files, and a
 * planet is a bigger thing to have two of.
 *
 * ## The one decision this file makes
 *
 * **The planet does not spin.** It is oriented by the *address* rather than by
 * the clock: {@link orientationFor} turns the site the camera is in to face the
 * camera, and nothing else moves it. Two reasons, and the second is the one
 * that settles it.
 *
 * A clock-driven spin would make {@link projectSite} a function of time, and
 * `frames.ts` needs a park's position inside the globe to be a *constant* —
 * every level below this one is a fixed division, and a rung whose geometry
 * moves is a rung the camera cannot be sent to. Every level below already works
 * this way: a block does not rotate either.
 *
 * And it is better. A planet that turns because you chose somewhere on it is a
 * planet answering you; a planet that turns on its own is a screensaver you have
 * to wait for. The thing that moves is the **sun** (§20.4's day, and the only
 * reason the night side is worth watching), which changes the picture without
 * changing where anything is.
 */

/** Degrees to radians, once. */
const D2R = Math.PI / 180

export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * The land, as ellipses in (longitude, latitude).
 *
 * Each entry is `[lon, lat, lonRadius, latRadius]` and a point is land if it is
 * inside any of them. Ellipses rather than a bitmap for one reason that matters
 * and one that is merely convenient: a bitmap would be a second asset to
 * quantise, ship and keep in step with the palette, and this way the map is
 * something you can read in a diff and move by one number.
 *
 * It is a recognisable Earth and not an accurate one. At the size a continent is
 * drawn — a business park is one pixel at this rung — the test that matters is
 * whether somebody can find the coastline they live on, and the test that does
 * not is whether the Bight is the right shape.
 */
export const LAND: readonly (readonly [number, number, number, number])[] = [
  // North America
  [-100, 50, 32, 22],
  [-90, 36, 22, 13],
  [-142, 63, 17, 9],
  [-86, 21, 13, 8],
  [-80, 11, 8, 5],
  // Greenland
  [-42, 72, 17, 9],
  // South America
  [-60, -8, 17, 14],
  [-64, -30, 11, 14],
  [-71, -45, 5, 9],
  // Africa
  [9, 22, 26, 12],
  [20, 2, 18, 17],
  [25, -20, 13, 14],
  [45, 8, 8, 6],
  [47, -20, 3, 5],
  // Europe
  [16, 50, 21, 11],
  [24, 62, 13, 8],
  [-3, 53, 5, 5],
  // Asia
  [82, 56, 46, 21],
  [102, 32, 26, 17],
  [78, 22, 10, 12],
  [128, 60, 28, 14],
  [140, 44, 7, 10],
  [107, 6, 13, 10],
  // Australasia
  [134, -25, 18, 12],
  [172, -42, 4, 6],
]

/** South of this everything is ice. Antarctica is a band, not an ellipse. */
export const ICE_LAT = -63

/** What is under a point of the map. */
export const SEA = 0
export const LANDMASS = 1
export const ICE = 2
export type Surface = 0 | 1 | 2

/** What the surface is at a longitude and latitude. */
export function surfaceAt(lon: number, lat: number): Surface {
  if (lat < ICE_LAT) return ICE
  for (let i = 0; i < LAND.length; i++) {
    const e = LAND[i]
    const dx = (lon - e[0]) / e[2]
    const dy = (lat - e[1]) / e[3]
    if (dx * dx + dy * dy <= 1) return LANDMASS
  }
  return SEA
}

/**
 * What kind of ground a place is.
 *
 * Five, chosen so that the planet is legibly varied at the size a campus is
 * drawn and no finer. A biome here is not ecology, it is **a reason for the
 * studio to be a different colour in Lagos than in Reykjavik** - which is the
 * whole of what rung 6 has to say that rung 5 could not.
 */
export const TEMPERATE = 0
export const ARID = 1
export const TUNDRA = 2
export const POLAR = 3
export const OFFSHORE = 4
export type Biome = 0 | 1 | 2 | 3 | 4

/** What kind of ground is at a longitude and latitude. */
export function biomeAt(lon: number, lat: number): Biome {
  const s = surfaceAt(lon, lat)
  if (s === ICE) return POLAR
  if (s === SEA) return OFFSHORE
  const a = Math.abs(lat)
  if (a > 66) return POLAR
  if (a > 52) return TUNDRA
  // The two desert belts, where the air that rose at the equator comes back
  // down dry. One band per hemisphere and the same band, because the mechanism
  // is symmetric and so is the palette.
  if (a >= 15 && a <= 33) return ARID
  return TEMPERATE
}


/**
 * The order the planet gets settled in — the good ground first.
 *
 * Ranked rather than sorted by {@link surfaceAt}, because a surface is a fact
 * about a map and this is a decision about a studio. The order is the one a
 * person would guess, which is what makes the arc legible without a word of
 * explanation: temperate, arid, tundra, ice, and then the sea, where a campus
 * has to be a platform.
 */
export const SETTLE_RANK: Record<Biome, number> = {
  [TEMPERATE]: 0,
  [ARID]: 1,
  [TUNDRA]: 2,
  [POLAR]: 3,
  [OFFSHORE]: 4,
}

/**
 * How many campuses fit on one planet.
 *
 * A hundred, and the number is not a round one chosen for looking tidy — it is
 * the whole of §13.5's gate divided by what a park holds. `PARK_CAP` is a
 * million developers, the game is called *100,000,000 Developers*, and a hundred
 * parks is where those two meet. `frames.ts` then sizes the sphere so that a
 * hundred parks **exactly tile it**, which is why the planet is full at the
 * number on the box rather than at a number somebody tuned.
 */
export const SITES_PER_GLOBE = 100

/**
 * Where each campus is, in longitude and latitude.
 *
 * A Fibonacci spiral, which is the standard answer to "spread N points evenly
 * over a sphere" and the only cheap one that is *equal-area*. A latitude/
 * longitude grid is the obvious alternative and it is wrong here for a reason
 * you can see: it crowds the poles, so the last twenty campuses would all be in
 * Antarctica and the planet would fill from the bottom.
 *
 * Then the list is **sorted into the order somebody would actually settle it**
 * — {@link SETTLE_RANK}. Sites fill in order, so this is what makes the planet
 * fill the way a planet fills: the temperate land first, then the deserts, then
 * the tundra, then the ice, and platforms at sea only once the continents are
 * used up. That is a thing worth arriving at rather than a thing to explain.
 *
 * **It was sorted by {@link surfaceAt} first, and that was a bug you could only
 * see by looking at it.** `ICE` is 2 and `LANDMASS` is 1, so descending by the
 * raw enum put the ice *first*: every render had the studio's opening campus in
 * Antarctica and the planet turned to face the south pole, because the planet is
 * turned to face site 0. Every number involved was correct.
 */
function buildLattice(): { lon: number; lat: number }[] {
  const out: { lon: number; lat: number }[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < SITES_PER_GLOBE; i++) {
    const y = 1 - (2 * i + 1) / SITES_PER_GLOBE
    const lat = Math.asin(Math.max(-1, Math.min(1, y))) / D2R
    let lon = ((i * golden) / D2R) % 360
    if (lon > 180) lon -= 360
    out.push({ lon, lat })
  }
  out.sort((a, b) => SETTLE_RANK[biomeAt(a.lon, a.lat)] - SETTLE_RANK[biomeAt(b.lon, b.lat)])
  return out
}

/** The lattice, built once. It is a constant; nothing may mutate it. */
export const SITES: readonly { readonly lon: number; readonly lat: number }[] = buildLattice()

/** Where one site is. Out-of-range indices clamp rather than throw. */
export function siteAt(site: number): { lon: number; lat: number } {
  const i = Math.max(0, Math.min(SITES_PER_GLOBE - 1, Math.floor(site)))
  return SITES[i]
}

/** A longitude and latitude, as a unit vector of the planet's own frame. */
export function onPlanet(lon: number, lat: number): Vec3 {
  const a = lon * D2R
  const b = lat * D2R
  return { x: Math.cos(b) * Math.sin(a), y: Math.sin(b), z: Math.cos(b) * Math.cos(a) }
}

/** The inverse — a unit vector back to a longitude and latitude. */
export function toLonLat(v: Vec3): { lon: number; lat: number } {
  return { lon: Math.atan2(v.x, v.z) / D2R, lat: Math.asin(Math.max(-1, Math.min(1, v.y))) / D2R }
}

/**
 * How the planet is turned, so that `site` faces the camera.
 *
 * Two angles and no third, because the third would be a roll and a rolled planet
 * is a planet whose north is somewhere new every time you pick a campus. Yaw
 * takes the site's meridian to the front; pitch takes its parallel to the middle;
 * north stays up.
 */
export function orientationFor(site: number): { yaw: number; pitch: number } {
  const s = siteAt(site)
  return { yaw: -s.lon, pitch: s.lat }
}

/**
 * Turn a planet-frame vector into the camera's frame.
 *
 * Yaw about the pole first and pitch about the camera's own horizontal second,
 * in that order, because the reverse tilts the axis before it is pointed and the
 * pole ends up leaning by the site's longitude.
 */
export function orient(v: Vec3, o: { yaw: number; pitch: number }): Vec3 {
  const cy = Math.cos(o.yaw * D2R)
  const sy = Math.sin(o.yaw * D2R)
  const x1 = v.x * cy + v.z * sy
  const z1 = -v.x * sy + v.z * cy
  const cp = Math.cos(o.pitch * D2R)
  const sp = Math.sin(o.pitch * D2R)
  return { x: x1, y: v.y * cp - z1 * sp, z: v.y * sp + z1 * cp }
}

/**
 * Where a site lands on screen, in globe space, and whether it is facing us.
 *
 * `z` is the whole of the third dimension in an orthographic projection: it is
 * the cosine of the angle off the sub-camera point, so it is at once *how far
 * round the back a thing is*, *how foreshortened it is*, and *whether it should
 * be drawn at all*. Everything that varies with depth in `globe.ts` reads this
 * one number, which is why nothing there needs a depth buffer.
 */
export function projectSite(
  site: number,
  o: { yaw: number; pitch: number },
  radius: number,
): { x: number; y: number; z: number } {
  const s = siteAt(site)
  const v = orient(onPlanet(s.lon, s.lat), o)
  return { x: v.x * radius, y: -v.y * radius, z: v.z }
}

/**
 * Which site a globe-space point is over, or −1.
 *
 * The inverse of {@link projectSite} and deliberately not analytic: a nearest
 * search over a hundred candidates is a hundred dot products, which is nothing
 * on a tap, and it cannot disagree with the thing that drew them. `built` bounds
 * the search, so tapping empty ground is empty ground rather than the nearest
 * pad the studio has not bought.
 */
export function siteAtGlobe(
  x: number,
  y: number,
  o: { yaw: number; pitch: number },
  radius: number,
  built: number,
  reach: number,
): number {
  const n = Math.max(0, Math.min(SITES_PER_GLOBE, Math.floor(built)))
  let best = -1
  let bestD = reach * reach
  for (let i = 0; i < n; i++) {
    const p = projectSite(i, o, radius)
    // Facing away is not merely far: a site on the back of the planet projects
    // on top of one on the front, and picking the one you cannot see is the
    // defect this line exists to prevent.
    if (p.z <= 0.02) continue
    const dx = x - p.x
    const dy = y - p.y
    const d = dx * dx + dy * dy
    if (d <= bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/**
 * Where the sun is, as a unit vector, at a point in the day.
 *
 * `t` runs 0 to 1 over one whole day. The sun goes round the planet's own polar
 * axis rather than the camera's, so the terminator sweeps across the map the way
 * a terminator does instead of rolling around the screen — which it did in the
 * first version, and which read as the *light* being on a turntable.
 *
 * Tilted 23.4 degrees off the equator because it costs one constant and it is
 * the reason the poles are not both always half lit.
 */
export function sunAt(t: number, o: { yaw: number; pitch: number }): Vec3 {
  const a = (Number.isFinite(t) ? t : 0) * 360
  const tilt = 23.4
  return orient(onPlanet(a, tilt * Math.sin(a * D2R * 0.25)), o)
}

/** How lit a surface point is — the dot with the sun, which on a unit sphere is the point itself. */
export function lightOn(v: Vec3, sun: Vec3): number {
  return v.x * sun.x + v.y * sun.y + v.z * sun.z
}

// ---------------------------------------------------------------------------
// The ground - what a site stands on, and the one function two files share
// ---------------------------------------------------------------------------

/**
 * The ground, by biome, dark to light. Every entry a master-palette colour.
 *
 * Five values: **four are the sun** - deep night, night, dusk, day, indexed by
 * {@link terrainStep} - and the fifth is a rim, used only on an edge the light
 * catches. A rim is desaturated in life, which is why the grey at the top of a
 * green ramp is right rather than a compromise.
 *
 * ART_DIRECTION §2.2 says adding a colour is a deliberate amendment and not a
 * convenience. Nothing is added here: `FOLIAGE` carries the grass, `WOOD` the
 * sand it already carried for crates, `GLOW` the sea it already carried for
 * data pipes, and `NEUTRAL` the ice and the rims.
 */
export const TERRAIN: Record<Biome, readonly string[]> = {
  [TEMPERATE]: ['#241f2e', '#2e4a2c', '#2e4a2c', '#4c7a45', '#968a96'],
  [ARID]: ['#4a2f22', '#6b452c', '#6b452c', '#96683f', '#c19366'],
  [TUNDRA]: ['#241f2e', '#3a3244', '#55495e', '#736579', '#968a96'],
  [POLAR]: ['#3a3244', '#55495e', '#968a96', '#d8d2cf', '#f2eee8'],
  [OFFSHORE]: ['#0a2a30', '#0a2a30', '#2a4a5c', '#4a8fa8', '#7fd4e8'],
}

/*
 * Two properties of the table above are load-bearing, and both were got wrong
 * before they were looked at.
 *
 * **Entry 2 is a visible step below entry 3.** A campus's ground is its site's
 * ramp one step darker than the ground around it (`terrainShade(.., -1)`), so a
 * ramp whose day and dusk entries are the same colour makes the campus
 * *identical* to the field it stands in — invisible in temperate daylight and
 * plainly a dark slab at sea, which is the sticker problem wearing the opposite
 * coat. Every biome now steps.
 *
 * **Entry 0 is not the sea's entry 0.** Unlit land and unlit sea have to differ
 * or the night side is one flat shape and the continents stop existing exactly
 * where the studio's lights are supposed to be drawing them.
 */

/**
 * The one colour a terrain ramp may never contain — the sky behind the planet.
 *
 * The first version of these ramps opened on `NEUTRAL[0]` for four biomes out
 * of five, which is `background: 0x14121a` in `stage.ts`, which is space. Drawn,
 * the night half of the planet was **exactly the colour of the gap around it**,
 * so the terminator read as the edge of the world and a full sphere came out as
 * a dome with a bite taken out of it. It cost one look at a render to find and
 * would have cost a great deal more to find from the numbers, all of which were
 * correct.
 *
 * So the rule is that unlit ground is dark and *never* absent, and the value
 * below is what the test holds every ramp's first entry against.
 */
export const SKY = '#14121a'

/** Which entry of a {@link TERRAIN} ramp is a rim rather than a face. */
export const TERRAIN_RIM = 4

/**
 * Which step of a terrain ramp a light level lands on. Hard steps, no gradient.
 *
 * **This is the function that makes the hand-off invisible**, and it is the
 * reason it lives here rather than in either of the two files that call it.
 * `globe.ts` shades the planet's surface with it and `park.ts` shades the board
 * standing on that surface with it; the moment one of them rounds differently
 * from the other, a campus becomes a sticker again - a rectangle of very
 * slightly the wrong green, which is exactly how the first draft looked and
 * exactly how a reviewer described it.
 *
 * Two derivations of "how lit is this place" is trap 38 with a light on it.
 */
export function terrainStep(light: number): number {
  if (!Number.isFinite(light)) return 1
  if (light > 0.45) return 3
  if (light > 0.08) return 2
  if (light > -0.1) return 1
  return 0
}

/** A ramp entry, offset and clamped - what a face or a rim is, next to a top. */
export function terrainShade(biome: Biome, step: number, delta: number): string {
  const ramp = TERRAIN[biome]
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(step + delta)))]
}

/**
 * The local frame at a point of the planet - up, east and north.
 *
 * What `globe.ts` lays the park's own plot lattice on. It is here rather than
 * there because it is geometry about a sphere and knows nothing about a park;
 * the two lattice strides are the caller's, which is what keeps this file free
 * of `frames.ts` and therefore free of the import cycle that would otherwise
 * close the moment the frame maths needed {@link SITES_PER_GLOBE}.
 */
export function tangentFrame(lon: number, lat: number): { up: Vec3; east: Vec3; north: Vec3 } {
  const a = lon * D2R
  const b = lat * D2R
  return {
    up: onPlanet(lon, lat),
    east: { x: Math.cos(a), y: 0, z: -Math.sin(a) },
    north: { x: -Math.sin(b) * Math.sin(a), y: Math.cos(b), z: -Math.sin(b) * Math.cos(a) },
  }
}

/**
 * A point of a site's plot lattice, on the sphere and on the screen.
 *
 * `sx` and `sy` are the park's own lattice strides, so at the sub-camera point
 * this reduces **term for term** to `parkLatticeAt` - `((u - v) * sx, (u + v) *
 * sy)` - and the campus a site is drawn as is the park's own geometry rather
 * than a picture of one. Away from that point the sphere foreshortens it, which
 * is the only difference and is the one that should exist.
 *
 * The normalise is what puts the patch *on* the planet instead of on a plane
 * touching it. Over a park's 20 degrees the two differ by 1.6% of its width;
 * over the whole sphere they differ by everything.
 */
export function latticeOnGlobe(
  u: number,
  v: number,
  frame: { up: Vec3; east: Vec3; north: Vec3 },
  sx: number,
  sy: number,
  o: { yaw: number; pitch: number },
  radius: number,
): { x: number; y: number; z: number } {
  const eu = (u - v) * sx
  const en = -(u + v) * sy
  const p = {
    x: frame.up.x * radius + frame.east.x * eu + frame.north.x * en,
    y: frame.up.y * radius + frame.east.y * eu + frame.north.y * en,
    z: frame.up.z * radius + frame.east.z * eu + frame.north.z * en,
  }
  const m = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1
  const on = orient({ x: (p.x / m) * radius, y: (p.y / m) * radius, z: (p.z / m) * radius }, o)
  return { x: on.x, y: -on.y, z: on.z }
}
