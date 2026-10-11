import { describe, expect, it } from 'vitest'
import {
  BRIDGE_FROM,
  BRIDGE_TO,
  CITY_MIN_ZOOM,
  GLOBE_START_MUL,
  bridgeU,
  easeInOutSine,
  facing,
  flightCost,
  flightPose,
  lerpAngle,
  levelAtCost,
  project,
  smoothstep,
  type Vec3,
} from './lensFlight.ts'
import { maxLensLevelFor, rungFor } from './headcount.ts'
import { globeCell, WORLD_REGIONS } from './worldAddress.ts'

/**
 * The flight from a city to its planet [2026-10-11]. Claims about the *shape* of the flight, not
 * its numbers (§25.3.2): that it starts and ends on the plain pictures so nothing pops, never leaves a
 * hole, and only ever moves one way along its length.
 */
const STEPS = Array.from({ length: 101 }, (_, i) => i / 100)

describe('where the flight is', () => {
  it('is the city below the planet’s register and the planet above its first stop', () => {
    expect(bridgeU(BRIDGE_FROM - 1)).toBe(0)
    expect(bridgeU(BRIDGE_FROM)).toBe(0)
    expect(bridgeU(BRIDGE_TO)).toBe(1)
    expect(bridgeU(BRIDGE_TO + 1)).toBe(1)
  })

  it('only ever moves on with the lens', () => {
    let last = 0
    for (let level = 4; level <= 6; level += 0.05) {
      const u = bridgeU(level)
      expect(u).toBeGreaterThanOrEqual(last)
      last = u
    }
  })

  it('begins where the planet’s register does, so a promotion is what opens it (§7.4a)', () => {
    // headcount.ts: "every ceiling stops short of the next register's first frame". A rung that has not
    // earned the planet may never see any of the flight; the first that has may see all of it.
    for (const devs of [1, 20, 100, 1e3, 1e4, 99_999]) expect(bridgeU(maxLensLevelFor(devs)), `${devs} developers`).toBe(0)
    expect(bridgeU(maxLensLevelFor(1e5))).toBe(1)
    expect(rungFor(1e5).rung).toBeGreaterThan(rungFor(99_999).rung)
  })
})

describe('the pose along the flight', () => {
  it('starts on the plain city and ends on the plain planet, so nothing pops at either hand-off', () => {
    const start = flightPose(0), end = flightPose(1)
    expect(start.cityZoom).toBe(1)
    expect(start.cityAlpha).toBe(1)
    expect(start.globeAlpha).toBe(0)
    expect(start.pin).toBe(0)
    expect(end.cityAlpha).toBe(0)
    expect(end.globeAlpha).toBe(1)
    expect(end.globeMul).toBe(1)
    expect(end.pin).toBe(1)
    // At rest the planet is turned however the player left it.
    expect(end.orient).toBe(0)
  })

  it('never leaves a hole: at every point at least one of the two pictures is mostly there', () => {
    for (const u of STEPS) {
      const p = flightPose(u)
      expect(Math.max(p.cityAlpha, p.globeAlpha), `u = ${u}`).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('only ever moves one way: the city shrinks and fades, the planet comes up and settles', () => {
    let last = flightPose(0)
    for (const u of STEPS.slice(1)) {
      const p = flightPose(u)
      expect(p.cityZoom).toBeLessThanOrEqual(last.cityZoom + 1e-12)
      expect(p.cityAlpha).toBeLessThanOrEqual(last.cityAlpha + 1e-12)
      expect(p.globeAlpha).toBeGreaterThanOrEqual(last.globeAlpha - 1e-12)
      expect(p.globeMul).toBeLessThanOrEqual(last.globeMul + 1e-12)
      expect(p.pin).toBeGreaterThanOrEqual(last.pin - 1e-12)
      last = p
    }
  })

  it('keeps the city above its floor and the planet inside the size it has a raster for', () => {
    for (const u of STEPS) {
      const p = flightPose(u)
      expect(p.cityZoom).toBeGreaterThanOrEqual(CITY_MIN_ZOOM - 1e-12)
      expect(p.globeMul).toBeLessThanOrEqual(GLOBE_START_MUL + 1e-12)
      expect(p.globeMul).toBeGreaterThanOrEqual(1)
    }
  })

  it('faces the city for nearly all of the flight and hands back to the player’s turn only at the very end', () => {
    expect(flightPose(0).orient).toBe(1)
    expect(flightPose(0.5).orient).toBe(1)
    expect(flightPose(0.85).orient).toBe(1)
    expect(flightPose(0.95).orient).toBeLessThan(1)
    expect(flightPose(1).orient).toBe(0)
  })

  it('has no city left by the time it has shrunk to a hub’s lights', () => {
    // The city is gone before it is a speck, so a speck of district never sits on the planet as a smudge.
    const u = STEPS.find((v) => flightPose(v).cityAlpha === 0)
    expect(u).toBeDefined()
    expect(flightPose(u!).cityZoom).toBeLessThan(0.25)
  })
})

describe('turning the planet to a place', () => {
  const cells: Vec3[] = [0, 1, 17, 400, 1200, WORLD_REGIONS - 1].flatMap((region) => [globeCell(region, 0), globeCell(region, 3)])

  it('puts the place in the middle of the disc and facing us, wherever on the planet it is', () => {
    for (const cell of cells) {
      const { yaw, tilt } = facing(cell)
      const at = project(cell, yaw, tilt)
      expect(at.x).toBeCloseTo(0, 6)
      expect(at.y).toBeCloseTo(0, 6)
      expect(at.depth).toBeCloseTo(1, 6)
    }
  })

  it('is the Frontier button’s own formula, so the two can never disagree about "facing"', () => {
    // studioAtlas.ts's frontierButton: yaw = -atan2(x, z); tilt = asin(y).
    const [x, y, z] = globeCell(5, 0)
    expect(facing([x, y, z])).toEqual({ yaw: -Math.atan2(x, z), tilt: Math.asin(y) })
  })

  it('turns the short way round', () => {
    // 3 and -3 are a third of a radian apart across the back of the circle, not six radians apart through 0:
    // the halfway turn is π, and cos π = -1 (the long way round would give cos 0 = +1).
    expect(Math.cos(lerpAngle(3, -3, 0.5))).toBeCloseTo(-1, 6)
    expect(lerpAngle(0.1, 0.3, 0.5)).toBeCloseTo(0.2)
    expect(lerpAngle(-3.1, 3.1, 1)).toBeCloseTo(3.1 - 2 * Math.PI, 6)
    for (const [a, b] of [[0, 1], [3, -3], [-2, 2], [1, 1]]) {
      expect(lerpAngle(a, b, 0)).toBeCloseTo(a)
      // The far end is the same direction as `b`, modulo a turn.
      expect(Math.cos(lerpAngle(a, b, 1))).toBeCloseTo(Math.cos(b))
      expect(Math.sin(lerpAngle(a, b, 1))).toBeCloseTo(Math.sin(b))
    }
  })
})

describe('where a timed flight spends its time', () => {
  const levels = Array.from({ length: 141 }, (_, i) => 1 + i * 0.05)

  it('costs more the further out you go, and levelAtCost undoes it exactly', () => {
    let last = -Infinity
    for (const level of levels) {
      const cost = flightCost(level)
      expect(cost).toBeGreaterThan(last)
      last = cost
      expect(levelAtCost(cost)).toBeCloseTo(level, 9)
    }
  })

  it('is plain distance everywhere the band is not, so only the dive is slowed', () => {
    // Two stretches wholly on either side of the band cost exactly their length.
    expect(flightCost(4.4) - flightCost(3.6)).toBeCloseTo(0.8, 9)
    expect(flightCost(6.3) - flightCost(5.5)).toBeCloseTo(0.8, 9)
  })

  it('spends most of a crossing flight inside the band: more than half the time for the city-to-globe jump', () => {
    // 3.6 (the City stop) to 5 (the World stop), timed evenly in cost: the share of the clock spent with the
    // picture inside the band is what the flight is *for*.
    const from = flightCost(3.6), to = flightCost(5)
    let inside = 0
    const n = 1000
    for (let i = 0; i < n; i++) {
      const level = levelAtCost(from + (to - from) * ((i + 0.5) / n))
      if (level > BRIDGE_FROM && level < BRIDGE_TO) inside++
    }
    expect(inside / n).toBeGreaterThan(0.5)
  })

  it('has the same clock coming back: the dive runs backwards at the same cost', () => {
    expect(flightCost(3.6) - flightCost(5)).toBeCloseTo(-(flightCost(5) - flightCost(3.6)), 9)
  })

  it('eases in and out without overshoot', () => {
    expect(easeInOutSine(0)).toBe(0)
    expect(easeInOutSine(1)).toBe(1)
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5)
    let last = 0
    for (let t = 0; t <= 1; t += 0.01) {
      const v = easeInOutSine(t)
      expect(v).toBeGreaterThanOrEqual(last - 1e-12)
      expect(v).toBeLessThanOrEqual(1)
      last = v
    }
  })
})

describe('smoothstep', () => {
  it('runs either way and is flat at both ends', () => {
    expect(smoothstep(0, 1, -5)).toBe(0)
    expect(smoothstep(0, 1, 5)).toBe(1)
    expect(smoothstep(1, 0, 1)).toBe(0)
    expect(smoothstep(1, 0, 0)).toBe(1)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5)
  })
})
