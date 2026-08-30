import { describe, expect, it } from 'vitest'
import { PROXIMA_LY, WORLD_CAP, worldsFor } from './starfield.ts'
import {
  PLANCK_SECONDS,
  RELAY_BASE_LY,
  barrierProgress,
  buildTimeLabel,
  interstellarSync,
  meanLagLy,
  planckLabel,
  planckMultiple,
  relayReachLy,
  relayTiersNeeded,
} from './starbound.ts'

describe('the interstellar half of §4.1', () => {
  it('costs a one-world studio exactly nothing', () => {
    // The property that lets this be added to a balanced game without re-tuning
    // one: below §13.5's gate there is no second world to disagree with, so the
    // term is not small there, it is absent.
    expect(meanLagLy(1)).toBe(0)
    expect(interstellarSync(1)).toBe(1)
    expect(interstellarSync(worldsFor(WORLD_CAP))).toBe(1)
    expect(interstellarSync(worldsFor(1))).toBe(1)
  })

  it('agrees with the star field about how far the second world is', () => {
    // Two worlds means Sol and Proxima, and the mean radius of a disc of
    // uniform areal density is ⅔R. Within a few per cent of the real 4.2465 is
    // the sanity check that the two files are describing one galaxy.
    expect(meanLagLy(2)).toBeGreaterThan(PROXIMA_LY * 0.85)
    expect(meanLagLy(2)).toBeLessThan(PROXIMA_LY * 1.1)
  })

  it('falls as the studio spreads, and keeps falling', () => {
    const sync = [2, 10, 100, 10_000].map((n) => interstellarSync(n))
    for (let i = 1; i < sync.length; i++) expect(sync[i]).toBeLessThan(sync[i - 1])
    expect(sync[sync.length - 1]).toBeGreaterThan(0)
  })

  it('is a hill rather than a wall', () => {
    // ρ = 5 is right for §4.1 because Run 1 is a trap the player is meant to be
    // able to spring. A world cannot be un-settled, so a fifth-power cliff up
    // here would be a state the player enters and never leaves — a new fail
    // state, which §25.3.2 forbids. At twice the reach the studio has lost four
    // fifths of its sync, smoothly.
    // The number of worlds whose mean lag is exactly twice a tier-0 relay's
    // reach, solved out of `meanLagLy` rather than picked: ⅔·P·√n = 2·BASE.
    const worlds = Math.round((3 * RELAY_BASE_LY / PROXIMA_LY) ** 2)
    expect(meanLagLy(worlds) / relayReachLy(0)).toBeCloseTo(2, 2)
    expect(interstellarSync(worlds, 0)).toBeCloseTo(0.2, 2)
  })

  it('is bought back by relays, and says how many are needed', () => {
    expect(relayReachLy(0)).toBe(RELAY_BASE_LY)
    expect(relayReachLy(2)).toBe(RELAY_BASE_LY * 16)
    for (const worlds of [2, 50, 5_000, 1e6]) {
      const tiers = relayTiersNeeded(worlds, 0.5)
      expect(interstellarSync(worlds, tiers)).toBeGreaterThanOrEqual(0.5)
      expect(Number.isInteger(tiers)).toBe(true)
    }
    expect(relayTiersNeeded(1)).toBe(0)
  })
})

describe('§16 — the Planck-time barrier', () => {
  it('measures a build against the smallest interval there is', () => {
    expect(planckMultiple(1)).toBeCloseTo(1 / PLANCK_SECONDS, 0)
    // The floor. Faster than a Planck time is not a faster studio, it is the
    // end of §16, so the ratio never goes below one.
    expect(planckMultiple(PLANCK_SECONDS / 1e9)).toBe(1)
    expect(planckLabel(PLANCK_SECONDS)).toBe('PLANCK TIME')
  })

  it('reads progress on the log, because the endgame is forty-three decades', () => {
    // A linear bar would sit pinned at 100% for the whole endgame and then drop
    // to zero in its last frame. On the log every halving of the build time is
    // the same visible step — §7.7.3's rule about multiplicative progress,
    // applied to a clock instead of to a headcount.
    expect(barrierProgress(2)).toBe(0)
    expect(barrierProgress(1)).toBe(0)
    const steps = [1e-3, 1e-9, 1e-20, 1e-40].map(barrierProgress)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1])
    expect(barrierProgress(PLANCK_SECONDS)).toBeCloseTo(1, 6)
    expect(barrierProgress(PLANCK_SECONDS / 100)).toBe(1)
  })

  it('names a duration in a unit somebody can read', () => {
    expect(buildTimeLabel(4.2)).toBe('4.2 s')
    expect(buildTimeLabel(0.0042)).toBe('4.2 ms')
    expect(buildTimeLabel(8.12e-7)).toBe('812 ns')
    expect(buildTimeLabel(1e-30)).toContain('e-30')
    expect(planckLabel(1e-40)).toContain('t_P')
  })
})
