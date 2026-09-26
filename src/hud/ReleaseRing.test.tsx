/**
 * The release ring — §10.7 [2026-09-26]. `sim/release.ts` owns the rules and
 * `pipelineStore.test.ts` the seam; this pins the surface: it is up exactly
 * while the store says the studio is at the launch, it waits for the player
 * before the clock starts, a press in the window is scored where the head was
 * when the finger came down, and ESC leaves without shipping.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The Capacitor native-audio plugin cannot initialise under jsdom — see the
// same mock in Hud.test.tsx.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
import { ReleaseRing, VERDICT_HOLD_MS } from './ReleaseRing.tsx'
import { PROJECTS, __parkBuild, __resetStore, getState, ringDefectCount } from '../game/store.ts'
import { SHIP_ZONE, turnPeriodMs } from '../sim/release.ts'

beforeEach(() => {
  __resetStore()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function ring() {
  return render(<ReleaseRing state={getState()} />)
}

describe('§10.7 — the release ring', () => {
  it('is not drawn while nobody is at the launch', () => {
    __parkBuild(false)
    const { container } = ring()
    expect(container.querySelector('.ring__canvas')).toBeNull()
  })

  it('opens on the shelf head, waiting for the player', () => {
    __parkBuild()
    const build = getState().shelf[0]
    ring()
    expect(screen.getByText(build.name)).toBeTruthy()
    expect(screen.getByText('START')).toBeTruthy()
    expect(document.querySelector('.ring__left')?.textContent).toBe(String(ringDefectCount(build)))
  })

  it('leaves without shipping on ESC', () => {
    __parkBuild()
    ring()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(getState().launching).toBe(false)
    expect(getState().shelf).toHaveLength(1)
    expect(getState().projectsShipped).toBe(0)
  })

  it('ships in the window when pressed there, and hands over after the verdict', () => {
    vi.useFakeTimers()
    __parkBuild()
    const build = getState().shelf[0]
    const period = turnPeriodMs(build.projectIndex, PROJECTS.length, ringDefectCount(build))
    let now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    ring()
    const catcher = document.querySelector('.ring__catch')!
    // The first press starts the clock; the head sets off just past the window.
    fireEvent.pointerDown(catcher, { button: 0 })
    // A full turn later, less the head's head start, it is back at the date.
    now += period * (1 - (SHIP_ZONE + 0.01))
    fireEvent.pointerDown(catcher, { button: 0 })
    expect(document.querySelector('.ring__say')?.textContent).toContain('PERFECT WINDOW')
    act(() => {
      vi.advanceTimersByTime(VERDICT_HOLD_MS + 10)
    })
    expect(getState().launching).toBe(false)
    expect(getState().projectsShipped).toBe(1)
    expect(getState().ship?.timingLabel).toBe('PERFECT WINDOW')
  })
})
