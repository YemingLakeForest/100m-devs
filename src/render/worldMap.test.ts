import { describe, expect, it } from 'vitest'
import {
  ARID,
  ICE,
  LANDMASS,
  OFFSHORE,
  POLAR,
  SEA,
  SETTLE_RANK,
  SKY,
  SITES,
  SITES_PER_GLOBE,
  TEMPERATE,
  TERRAIN,
  TUNDRA,
  biomeAt,
  latticeOnGlobe,
  lightOn,
  onPlanet,
  orient,
  orientationFor,
  projectSite,
  siteAt,
  siteAtGlobe,
  sunAt,
  surfaceAt,
  tangentFrame,
  terrainStep,
} from './worldMap.ts'
import { GLOBE_SCALE, PARK_SCALE, PLOT_STRIDE_X, parkLatticeAt } from './frames.ts'
import { MASTER_PALETTE } from '../art/palette.ts'

describe('the map', () => {
  it('puts the continents where somebody could find their own coastline', () => {
    // Not an accurate Earth and not trying to be. The test that matters at the
    // size a campus is drawn is whether the shapes are the ones people know.
    expect(surfaceAt(-100, 45)).toBe(LANDMASS) // North America
    expect(surfaceAt(-55, -12)).toBe(LANDMASS) // Amazonia
    expect(surfaceAt(20, 5)).toBe(LANDMASS) // central Africa
    expect(surfaceAt(10, 25)).toBe(LANDMASS) // the Sahara
    expect(surfaceAt(80, 55)).toBe(LANDMASS) // Siberia
    expect(surfaceAt(134, -25)).toBe(LANDMASS) // Australia
    expect(surfaceAt(-40, 0)).toBe(SEA) // the mid Atlantic
    expect(surfaceAt(-150, 0)).toBe(SEA) // the mid Pacific
    expect(surfaceAt(0, -80)).toBe(ICE) // Antarctica
  })

  it('gives every biome a ramp made only of colours the system already has', () => {
    // ART_DIRECTION §2.2: adding a colour is a deliberate amendment, not a
    // convenience. Nothing here is added - the grass is FOLIAGE, the sand is
    // the WOOD that was already carrying crates, the sea is the GLOW that was
    // already carrying data pipes.
    for (const ramp of Object.values(TERRAIN)) {
      expect(ramp).toHaveLength(5)
      for (const hex of ramp) expect(MASTER_PALETTE).toContain(hex)
    }
  })

  it('never paints the ground the colour of the sky, and always steps', () => {
    /*
     * The two properties the ramps are arranged around, both found by rendering
     * the planet rather than by reading it.
     *
     * A ramp opening on `SKY` makes the unlit half of the world exactly the
     * colour of the gap around it, so a sphere comes out as a dome. And a ramp
     * whose entries 2 and 3 match makes a campus the same colour as the field it
     * stands in, because a campus's ground is its site's ramp one step down.
     */
    for (const ramp of Object.values(TERRAIN)) {
      expect(ramp[0]).not.toBe(SKY)
      expect(ramp[2]).not.toBe(ramp[3])
    }
    // Land and sea have to differ where neither is lit, or the night side is one
    // flat shape and the continents stop existing.
    expect(TERRAIN[TEMPERATE][0]).not.toBe(TERRAIN[OFFSHORE][0])
  })

  it('varies the ground by where on the planet it is', () => {
    expect(biomeAt(10, 25)).toBe(ARID) // the Sahara
    expect(biomeAt(-100, 45)).toBe(TEMPERATE) // the American midwest
    expect(biomeAt(80, 60)).toBe(TUNDRA) // Siberia
    expect(biomeAt(0, -80)).toBe(POLAR)
    expect(biomeAt(-40, 0)).toBe(OFFSHORE) // a platform, not a campus
    // The two desert belts are the same belt, because the mechanism is
    // symmetric and so is the palette.
    expect(biomeAt(20, 25)).toBe(biomeAt(25, -25))
  })
})

describe('the site lattice', () => {
  it('spreads a hundred campuses without crowding the poles', () => {
    expect(SITES).toHaveLength(SITES_PER_GLOBE)
    // A lat/long grid is the obvious alternative and it fills the planet from
    // Antarctica up. Equal-area means the last twenty sites are not all ice.
    const polar = SITES.filter((s) => Math.abs(s.lat) > 60).length
    // The caps above 60 degrees are 13.4% of a sphere's area.
    expect(polar).toBeGreaterThan(6)
    expect(polar).toBeLessThan(22)
  })

  it('opens the studio on good ground and not in Antarctica', () => {
    /*
     * **The regression gate for a bug that every number agreed with.**
     *
     * The lattice was first sorted by `surfaceAt` descending, and `ICE` is 2
     * where `LANDMASS` is 1 — so the ice sorted *first*, site 0 was in
     * Antarctica, and because the planet turns to face the site the address is
     * in, every render of rung 6 opened on the south pole. It cost one look at a
     * picture to find and would never have been found from the arithmetic.
     */
    expect(biomeAt(SITES[0].lon, SITES[0].lat)).toBe(TEMPERATE)
    // And the order is the one a person would guess, all the way down.
    let worst = -1
    for (const s of SITES) {
      const rank = SETTLE_RANK[biomeAt(s.lon, s.lat)]
      expect(rank).toBeGreaterThanOrEqual(worst)
      worst = rank
    }
    expect(worst).toBe(SETTLE_RANK[OFFSHORE])
  })

  it('settles the land before the sea', () => {
    // Sites fill in order, so this is what makes a planet get settled the way a
    // planet gets settled. Ocean platforms are what you build once the
    // continents are used up, which is a thing to arrive at rather than explain.
    const first = surfaceAt(SITES[0].lon, SITES[0].lat)
    const last = surfaceAt(SITES[SITES_PER_GLOBE - 1].lon, SITES[SITES_PER_GLOBE - 1].lat)
    expect(first).not.toBe(SEA)
    expect(last).toBe(SEA)
    let seen = false
    for (const s of SITES) {
      const wet = surfaceAt(s.lon, s.lat) === SEA
      if (wet) seen = true
      // Once the sea starts it does not stop: the list is sorted, so no dry
      // site may appear after a wet one.
      else expect(seen).toBe(false)
    }
  })
})

describe('the planet is turned by the address', () => {
  it('brings the site the camera is in to face the camera', () => {
    for (const site of [0, 7, 42, 99]) {
      const p = projectSite(site, orientationFor(site), 100)
      expect(p.x).toBeCloseTo(0, 9)
      expect(p.y).toBeCloseTo(0, 9)
      expect(p.z).toBeCloseTo(1, 9)
    }
  })

  it('keeps north up whichever site that is', () => {
    // Two angles and no third. A roll would be a planet whose north is
    // somewhere new every time you pick a campus.
    for (const site of [3, 55, 88]) {
      const o = orientationFor(site)
      const s = siteAt(site)
      const f = tangentFrame(s.lon, s.lat)
      const north = orient(f.north, o)
      expect(north.x).toBeCloseTo(0, 9)
      expect(north.y).toBeCloseTo(1, 9)
    }
  })

  it('never picks a site on the back of the planet', () => {
    // A site round the back projects on top of one at the front, and choosing
    // the one you cannot see is the defect the z test exists to prevent.
    const o = orientationFor(0)
    const r = 400
    const here = siteAtGlobe(0, 0, o, r, SITES_PER_GLOBE, 40)
    expect(here).toBe(0)
    for (let i = 0; i < SITES_PER_GLOBE; i++) {
      const p = projectSite(i, o, r)
      if (p.z > 0.02) continue
      // Aim exactly at where a far-side site projects; it must not be returned.
      expect(siteAtGlobe(p.x, p.y, o, r, SITES_PER_GLOBE, 40)).not.toBe(i)
    }
  })

  it('reaches no further than it is told to', () => {
    const o = orientationFor(0)
    expect(siteAtGlobe(0, 0, o, 400, 0, 40)).toBe(-1)
    expect(siteAtGlobe(1e6, 1e6, o, 400, SITES_PER_GLOBE, 40)).toBe(-1)
  })
})

describe('the park, laid on the sphere', () => {
  /*
   * **The claim the whole hand-off rests on**, and the reason it is asserted
   * rather than described: at the site facing the camera, the lattice a campus
   * is drawn on is not *like* the park's own isometric, it **is** it. Term for
   * term, `((u - v) * sx, (u + v) * sy)`.
   *
   * That is what makes `globe.ts` able to swap a campus glyph for `park.ts`'s
   * real park at the hand-off without anything moving. If this test ever goes
   * red, the park is a sticker again.
   */
  const sx = PLOT_STRIDE_X * PARK_SCALE * GLOBE_SCALE
  const sy = sx / 2

  it('reduces to the park’s own projection at the sub-camera point', () => {
    const site = 0
    const o = orientationFor(site)
    const s = siteAt(site)
    const f = tangentFrame(s.lon, s.lat)
    const r = 4899
    const origin = latticeOnGlobe(0, 0, f, sx, sy, o, r)
    const flat0 = parkLatticeAt(0, 0)
    for (const [u, v] of [
      [1, 0],
      [0, 1],
      [3, 2],
      [-2, 4],
    ]) {
      const on = latticeOnGlobe(u, v, f, sx, sy, o, r)
      const flat = parkLatticeAt(u, v)
      // Differences, so the park's own ground constant cancels and what is
      // compared is the projection rather than the origin.
      const wantX = (flat.x - flat0.x) * GLOBE_SCALE
      const wantY = (flat.y - flat0.y) * GLOBE_SCALE
      /*
       * **To first order, and the residual is the planet.**
       *
       * An exact equality would be the wrong assertion and it was the first one
       * written here: these points are genuinely on a sphere, so they differ
       * from the plane touching it by `theta^2/6` of the offset - three parts in
       * a hundred thousand at a plot's distance. That residual is not error, it
       * is the curvature, and the next test is the one that measures it.
       *
       * What this asserts is the thing that has to be true for the hand-off to
       * be a swap: the two projections agree to four digits, so at any scale a
       * park is drawn they are the same picture.
       */
      const size = Math.hypot(wantX, wantY)
      const residual = Math.hypot(on.x - origin.x - wantX, on.y - origin.y - wantY)
      // And the residual is not merely small, it is the *right* residual.
      // Pushing a tangent-plane point onto the sphere shortens it by a factor
      // of `1/sqrt(1 + theta^2)`, so the error is `theta^2/2` of the offset -
      // the gnomonic correction, and not the `theta^2/6` an arc-length mapping
      // would give. Asserting the number rather than a tolerance is what would
      // catch somebody quietly replacing the projection with a different one.
      const theta = size / r
      // As a ratio, because `theta^2/2` is the leading term and the next one is
      // `theta^4`: the closed form is right to four significant figures here and
      // pretending to more would be asserting the rounding.
      expect(residual / ((size * theta * theta) / 2)).toBeCloseTo(1, 2)
    }
  })

  it('bends by about a pixel and a half across a whole park', () => {
    // The sag: a park spans 20 degrees, so its far corner sits below the plane
    // that touches the planet under its middle. Small enough that the swap is
    // invisible, and present, which is what stops the campus being a sticker.
    const o = orientationFor(0)
    const s = siteAt(0)
    const f = tangentFrame(s.lon, s.lat)
    const r = 4899
    // Half a park's width along the lattice, which is its own corner.
    const far = latticeOnGlobe(13.4, 6.7, f, sx, sy, o, r)
    const flatX = (13.4 - 6.7) * sx
    const flatY = (13.4 + 6.7) * sy
    const origin = latticeOnGlobe(0, 0, f, sx, sy, o, r)
    const dx = far.x - origin.x - flatX
    const dy = far.y - origin.y - flatY
    const drift = Math.hypot(dx, dy)
    expect(drift).toBeGreaterThan(0)
    expect(drift).toBeLessThan(Math.hypot(flatX, flatY) * 0.05)
  })
})

describe('the light', () => {
  it('steps hard, and both files step the same way', () => {
    // The one function that makes the hand-off invisible. `globe.ts` shades the
    // planet with it and `park.ts` shades the board standing on the planet with
    // it; the moment they round differently a campus is a rectangle of very
    // slightly the wrong green.
    expect(terrainStep(1)).toBe(3)
    expect(terrainStep(0.2)).toBe(2)
    expect(terrainStep(0)).toBe(1)
    expect(terrainStep(-1)).toBe(0)
    let last = -1
    for (let l = -1; l <= 1; l += 0.01) {
      const step = terrainStep(l)
      expect(step).toBeGreaterThanOrEqual(last)
      last = step
    }
  })

  it('walks the terminator round the planet rather than round the screen', () => {
    // The first version turned the sun about the *camera's* axis and it read as
    // the light being on a turntable. The sun is a unit vector at every hour of
    // the day, and the day it walks is the planet's.
    for (let t = 0; t < 1; t += 0.05) {
      const sun = sunAt(t, orientationFor(0))
      expect(Math.hypot(sun.x, sun.y, sun.z)).toBeCloseTo(1, 9)
    }
    // Somewhere is lit and somewhere is not, at every hour.
    for (let t = 0; t < 1; t += 0.1) {
      const sun = sunAt(t, orientationFor(0))
      const lit = lightOn(onPlanet(0, 0), sun)
      const dark = lightOn(onPlanet(180, 0), sun)
      expect(Math.sign(lit)).toBe(-Math.sign(dark))
    }
  })
})
