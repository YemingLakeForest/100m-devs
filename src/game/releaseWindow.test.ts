/**
 * §10.8b — the wiring between a finished build and a game on sale.
 *
 * `sim/release.ts` owns the bar and is tested there; `hud/ReleaseWindow.tsx`
 * owns the needle and is tested there. What is tested here is the seam: that a
 * finished build stops rather than ships, that the studio stops with it, that
 * the launch date reaches the payout, and that nothing can leave the shelf
 * without a way off it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetStore,
  __setState,
  getState,
  lockRelease,
  poke,
  releaseNow,
  tick,
} from './store.ts'
import {
  AUTO_LAUNCH_SWEEPS,
  LAUNCH_BANDS,
  LAUNCH_WINDOW_COOLDOWN_SECONDS,
  NEUTRAL_MULTIPLIER,
  stallSeconds,
} from '../sim/release.ts'

beforeEach(() => {
  __resetStore()
  vi.restoreAllMocks()
})

/** Put the run a hair from shipping. */
function aboutToShip() {
  __setState({ devs: 1, burned: getState().commitment.minus(0.1) })
}

/**
 * Let the window's own patience run out.
 *
 * **Wall clock, not ticks** — `stallSeconds` explains why the backstop reads
 * elapsed time rather than accumulated `dtSeconds`, and this is the test that
 * would pass either way if it pumped the simulation instead of the clock.
 */
function waitOutTheWindow(seconds: number) {
  const shelf = getState().pendingRelease
  if (!shelf) return
  vi.spyOn(performance, 'now').mockReturnValue(shelf.openedAt + seconds * 1000)
  tick(1)
}

describe('§10.8b — a finished build goes on the shelf', () => {
  it('shelves rather than ships when the burn-down reaches zero', () => {
    aboutToShip()
    tick(1)

    const shelf = getState().pendingRelease
    expect(shelf).not.toBeNull()
    expect(shelf?.name).toBe('Flappy Square 1.0')
    // Nothing is on sale yet, and the catalogue has not moved.
    expect(getState().projectsShipped).toBe(0)
    expect(getState().releases).toHaveLength(0)
    expect(getState().ship).toBeNull()
  })

  it('stops the studio while the decision is open', () => {
    aboutToShip()
    tick(1)
    const before = getState()

    tick(1)
    // §10.7a.3's rule, applied to a launch: payroll does not run, the clock
    // does not move, and a tap banks nothing.
    expect(getState().cash).toBe(before.cash)
    expect(getState().runSeconds).toBe(before.runSeconds)
    expect(poke(0, 0).sp).toBe(0)
  })

  it('puts the game on sale at the date the player picked', () => {
    aboutToShip()
    tick(1)
    // Dead centre of the bar.
    lockRelease(0.5)
    releaseNow()

    const s = getState()
    expect(s.pendingRelease).toBeNull()
    expect(s.projectsShipped).toBe(1)
    expect(s.ship?.timing).toBe(LAUNCH_BANDS[0].multiplier)
    expect(s.ship?.timingLabel).toBe('PERFECT WINDOW')
  })

  /**
   * The claim the whole ramp rests on, read at the seam rather than in the
   * model: a perfect launch is worth exactly its multiplier more than a
   * neutral one, on the same project, in the same run.
   */
  it('carries the launch date all the way through to the payout', () => {
    aboutToShip()
    tick(1)
    releaseNow()
    const neutral = getState().ship?.revenue ?? 0

    __resetStore()
    aboutToShip()
    tick(1)
    lockRelease(0.5)
    releaseNow()
    const perfect = getState().ship?.revenue ?? 0

    expect(perfect / neutral).toBeCloseTo(LAUNCH_BANDS[0].multiplier, 6)
  })

  it('releases itself if nobody ever answers the window', () => {
    aboutToShip()
    tick(1)
    const shelf = getState().pendingRelease
    expect(shelf).not.toBeNull()

    waitOutTheWindow(stallSeconds(shelf!.sweepMs) + 1)

    expect(getState().pendingRelease).toBeNull()
    expect(getState().projectsShipped).toBe(1)
    // Neutral, and unlabelled: nobody picked a date, so the reel has nothing
    // to report back about one.
    expect(getState().ship?.timing).toBe(NEUTRAL_MULTIPLIER)
    expect(getState().ship?.timingLabel).toBeNull()
  })

  /**
   * The backstop must not be able to overwrite a date the player has already
   * chosen — a press on the last frame of the window is still a press.
   */
  it('stops counting the moment a date is locked in', () => {
    aboutToShip()
    tick(1)
    lockRelease(0.5)

    const shelf = getState().pendingRelease
    waitOutTheWindow(stallSeconds(shelf!.sweepMs) * 2)

    expect(getState().pendingRelease).not.toBeNull()
    expect(getState().pendingRelease?.hit?.band).toBe('perfect')
  })

  it('takes the first date offered and refuses the rest', () => {
    aboutToShip()
    tick(1)
    lockRelease(0.5)
    lockRelease(0)
    expect(getState().pendingRelease?.hit?.band).toBe('perfect')
  })

  /**
   * §10.8b — a studio shipping every few seconds is not attending its own
   * launches. The window has a floor under how often it is a window at all,
   * and everything inside that floor goes out on the train at ×1.
   */
  it('sends a release straight out when the last launch was moments ago', () => {
    aboutToShip()
    tick(1)
    lockRelease(0.5)
    releaseNow()
    expect(getState().projectsShipped).toBe(1)

    // The next build finishes inside the cooldown, so there is no second bar.
    __setState({ burned: getState().commitment.minus(0.1) })
    tick(1)
    expect(getState().pendingRelease).toBeNull()
    expect(getState().projectsShipped).toBe(2)
    expect(getState().ship?.timing).toBe(NEUTRAL_MULTIPLIER)
    expect(getState().ship?.timingLabel).toBeNull()
  })

  it('gives the window back once the studio has stopped shipping quite so fast', () => {
    const clock = vi.spyOn(performance, 'now')
    clock.mockReturnValue(0)
    aboutToShip()
    tick(1)
    releaseNow()

    clock.mockReturnValue(LAUNCH_WINDOW_COOLDOWN_SECONDS * 1000 + 1)
    __setState({ burned: getState().commitment.minus(0.1) })
    tick(1)
    expect(getState().pendingRelease).not.toBeNull()
  })

  it('sweeps faster the further up the ladder the release is', () => {
    aboutToShip()
    tick(1)
    const garage = getState().pendingRelease!.sweepMs
    releaseNow()

    __resetStore()
    __setState({ devs: 1, projectIndex: 6 })
    __setState({ burned: getState().commitment.minus(0.1) })
    tick(1)
    expect(getState().pendingRelease!.sweepMs).toBeLessThan(garage)
  })

  /**
   * The defect the playthrough walk found: the backstop counted `dtSeconds`,
   * and §26.1.8's `?speed` accelerates the simulation by repeating whole ticks,
   * so at ×40 the window opened and closed itself inside a quarter of a second.
   * A studio can be run forty times too fast; a decision cannot.
   */
  it('is not hurried by a simulation running forty times too fast', () => {
    aboutToShip()
    tick(1)
    const shelf = getState().pendingRelease
    expect(shelf).not.toBeNull()

    // A frame's worth of `?speed=40`: forty whole ticks, no elapsed time.
    vi.spyOn(performance, 'now').mockReturnValue(shelf!.openedAt + 16)
    for (let i = 0; i < 40; i++) tick(1 / 60)
    expect(getState().pendingRelease).not.toBeNull()
  })

  it('gives the player whole sweeps before the simulation steps in', () => {
    aboutToShip()
    tick(1)
    const shelf = getState().pendingRelease!
    // The renderer gets first refusal — see `STALL_MARGIN_MS`. The simulation's
    // patience must outlast the needle's own deadline, or a window would be
    // taken away while it was still sweeping.
    expect(stallSeconds(shelf.sweepMs)).toBeGreaterThan(
      (AUTO_LAUNCH_SWEEPS * shelf.sweepMs) / 1000,
    )
  })
})
