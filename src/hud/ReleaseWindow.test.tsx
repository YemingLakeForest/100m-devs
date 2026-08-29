import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
// The Capacitor native-audio plugin cannot initialise under jsdom — see the
// same mock in Hud.test.tsx.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
import { ReleaseWindow, LOCK_HOLD_MS } from './ReleaseWindow.tsx'
import { __resetStore, __setState, getState } from '../game/store.ts'
import { LAUNCH_BANDS, MISSED_MULTIPLIER, NEUTRAL_MULTIPLIER } from '../sim/release.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  __resetStore()
})

/**
 * Put a build on the shelf with a needle the test can aim.
 *
 * `openedAt` is set relative to a pinned `performance.now()` so the position at
 * press time is a *choice* rather than whatever the machine was doing. A quarter
 * of a sweep from the open is the centre of the bar — see `markerAt`.
 */
function shelve(sweepMs: number, offsetMs: number) {
  const now = 10_000
  vi.spyOn(performance, 'now').mockReturnValue(now)
  __setState({
    pendingRelease: {
      id: 1,
      name: 'Flappy Square 1.0',
      sweepMs,
      openedAt: now - offsetMs,
      hit: null,
    },
  })
}

describe('§10.8b — the launch window', () => {
  it('draws the whole calendar, both ways to miss included', () => {
    shelve(1_200, 0)
    const { container } = render(<ReleaseWindow state={getState()} />)

    // Four rings, folded about the centre, minus the centre's own duplicate:
    // early ×4 and late ×4 with the two halves of PERFECT drawn as one plate.
    expect(container.querySelectorAll('.release__zone').length).toBe(LAUNCH_BANDS.length * 2)
    expect(container.querySelector('.release__needle')).not.toBeNull()
    expect(container.textContent).toContain('TOO EARLY')
    expect(container.textContent).toContain('TOO LATE')
    expect(container.textContent).toContain('Flappy Square 1.0')
    // §10.6a — this window has no close box. The decision *is* the exit.
    expect(container.querySelector('.os-window__close')).toBeNull()
  })

  it('scores a press dead centre as the perfect window', () => {
    vi.useFakeTimers()
    // A quarter of a sweep in, the needle is exactly on the release date.
    shelve(1_200, 300)
    const { container } = render(<ReleaseWindow state={getState()} />)

    fireEvent.pointerDown(container.querySelector('.release__catch') as Element)
    expect(container.textContent).toContain('PERFECT WINDOW')

    // The verdict holds, and only then does the studio move on.
    expect(getState().pendingRelease).not.toBeNull()
    act(() => void vi.advanceTimersByTime(LOCK_HOLD_MS + 20))
    expect(getState().pendingRelease).toBeNull()
    expect(getState().ship?.timing).toBe(LAUNCH_BANDS[0].multiplier)
  })

  it('scores a press at the end of the sweep as a missed season', () => {
    vi.useFakeTimers()
    // Half a sweep in, the needle is hard against the late end of the bar.
    shelve(1_200, 600)
    const { container } = render(<ReleaseWindow state={getState()} />)

    fireEvent.pointerDown(container.querySelector('.release__catch') as Element)
    expect(container.textContent).toContain('MISSED THE SEASON')

    act(() => void vi.advanceTimersByTime(LOCK_HOLD_MS + 20))
    expect(getState().ship?.timing).toBeCloseTo(MISSED_MULTIPLIER)
  })

  it('takes a press once, however many arrive', () => {
    vi.useFakeTimers()
    shelve(1_200, 300)
    const { container } = render(<ReleaseWindow state={getState()} />)
    const catcher = container.querySelector('.release__catch') as Element

    fireEvent.pointerDown(catcher)
    fireEvent.pointerDown(catcher)
    fireEvent.pointerDown(catcher)
    act(() => void vi.advanceTimersByTime(LOCK_HOLD_MS + 20))

    // One ship, at the band the *first* press earned. A second press landing
    // during the hold would otherwise re-score a release already on sale.
    expect(getState().projectsShipped).toBe(1)
    expect(getState().ship?.timing).toBe(LAUNCH_BANDS[0].multiplier)
  })

  it('takes SPACE, so the window is operable without aiming a mouse', () => {
    vi.useFakeTimers()
    shelve(1_200, 300)
    render(<ReleaseWindow state={getState()} />)

    fireEvent.keyDown(window, { key: ' ' })
    act(() => void vi.advanceTimersByTime(LOCK_HOLD_MS + 20))
    expect(getState().ship?.timing).toBe(LAUNCH_BANDS[0].multiplier)
  })

  /**
   * §26.3.4 — a minigame may never be mandatory. A window nobody attends must
   * close itself, and it must pay the neutral rate rather than whichever ring
   * the needle happened to be parked in when the clock ran out.
   */
  it('closes itself at the neutral rate when nobody attends', () => {
    vi.useFakeTimers()
    // Already past the three-sweep deadline, so the first frame fires it.
    shelve(1_200, 4_000)
    render(<ReleaseWindow state={getState()} />)

    act(() => void vi.advanceTimersByTime(LOCK_HOLD_MS + 40))
    expect(getState().pendingRelease).toBeNull()
    expect(getState().ship?.timing).toBe(NEUTRAL_MULTIPLIER)
    // ...and says nothing about a date, because nobody picked one.
    expect(getState().ship?.timingLabel).toBeNull()
  })
})
