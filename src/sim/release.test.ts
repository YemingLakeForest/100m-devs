import { describe, expect, it } from 'vitest'
import {
  AUTO_LAUNCH,
  AUTO_LAUNCH_SWEEPS,
  autoLaunchMs,
  LAUNCH_BANDS,
  launchHit,
  markerAt,
  MISSED_MULTIPLIER,
  NEUTRAL_MULTIPLIER,
  offsetFromCentre,
  SWEEP_MS_FIRST_PROJECT,
  SWEEP_MS_LAST_PROJECT,
  sweepPeriodMs,
} from './release.ts'

describe('§10.8b — the launch window', () => {
  /**
   * The load-bearing claim of the whole file, and the one that keeps §21's
   * measured economy true: a player pressing at random earns exactly what a
   * player who never pressed earns.
   */
  it('pays exactly x1 on average across the bar', () => {
    const N = 20_001
    let total = 0
    for (let i = 0; i < N; i++) total += launchHit(i / (N - 1)).multiplier
    expect(total / N).toBeCloseTo(1, 3)
  })

  it('pays exactly x1 for a launch nobody attended', () => {
    expect(AUTO_LAUNCH.multiplier).toBe(NEUTRAL_MULTIPLIER)
    // And it is a *stated* band rather than wherever the needle stopped — see
    // AUTO_LAUNCH's note. The two must not be allowed to drift apart.
    expect(launchHit(AUTO_LAUNCH.at).multiplier).toBe(NEUTRAL_MULTIPLIER)
  })

  /** §25.3.2 — the order is canon, the values are not. This pins the order. */
  it('ranks perfect over the window, the window over soft, and soft over missed', () => {
    const [perfect, window, soft, missed] = LAUNCH_BANDS.map((b) => b.multiplier)
    expect(perfect).toBeGreaterThan(window)
    expect(window).toBeGreaterThan(soft)
    expect(soft).toBeGreaterThan(missed)
    expect(soft).toBe(NEUTRAL_MULTIPLIER)
  })

  /**
   * §4.14's `revenueMultiplier` floors a 0/100 game at x0.55 so that "ships a
   * 12 and makes a fortune" stays funny. A missed launch window may not be
   * harsher than shipping something broken.
   */
  it('never punishes a missed date more than a rotten defect backlog does', () => {
    expect(MISSED_MULTIPLIER).toBeGreaterThan(0.55)
    expect(MISSED_MULTIPLIER).toBeLessThan(NEUTRAL_MULTIPLIER)
  })

  it('reads the centre as perfect and both ends as a miss', () => {
    expect(launchHit(0.5).band).toBe('perfect')
    expect(launchHit(0).band).toBe('missed')
    expect(launchHit(1).band).toBe('missed')
  })

  it('names the two ways to miss differently', () => {
    expect(launchHit(0.01).side).toBe('early')
    expect(launchHit(0.99).side).toBe('late')
    expect(launchHit(0.01).label).not.toBe(launchHit(0.99).label)
    // ...and pays them the same. It is an aim test; only the joke has a side.
    expect(launchHit(0.01).multiplier).toBe(launchHit(0.99).multiplier)
  })

  it('is a linear ping-pong, so the needle never dwells anywhere', () => {
    expect(markerAt(0, 1_000)).toBeCloseTo(0)
    expect(markerAt(250, 1_000)).toBeCloseTo(0.5)
    expect(markerAt(500, 1_000)).toBeCloseTo(1)
    expect(markerAt(750, 1_000)).toBeCloseTo(0.5)
    // And it repeats rather than running off the end.
    expect(markerAt(1_250, 1_000)).toBeCloseTo(markerAt(250, 1_000))
  })

  it('sweeps faster the further up the ladder the studio is', () => {
    expect(sweepPeriodMs(0, 8)).toBe(SWEEP_MS_FIRST_PROJECT)
    expect(sweepPeriodMs(7, 8)).toBe(SWEEP_MS_LAST_PROJECT)
    expect(sweepPeriodMs(3, 8)).toBeLessThan(sweepPeriodMs(2, 8))
    // Clamped at both ends: an index off the ladder is still a real release.
    expect(sweepPeriodMs(-4, 8)).toBe(SWEEP_MS_FIRST_PROJECT)
    expect(sweepPeriodMs(99, 8)).toBe(SWEEP_MS_LAST_PROJECT)
  })

  it('gives the player whole sweeps before it fires itself', () => {
    expect(autoLaunchMs(1_200)).toBe(AUTO_LAUNCH_SWEEPS * 1_200)
  })

  it('treats nonsense as the middle rather than as a crash', () => {
    expect(markerAt(Number.NaN, 1_000)).toBe(0.5)
    expect(markerAt(100, 0)).toBe(0.5)
    expect(offsetFromCentre(Number.NaN)).toBe(0)
    expect(launchHit(Number.NaN).band).toBe('perfect')
  })
})
