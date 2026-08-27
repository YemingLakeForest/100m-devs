import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ParadigmCutScene } from './ParadigmCutScene.tsx'
import type { ShiftReport } from '../game/paradigmBoot.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

afterEach(cleanup)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const report: ShiftReport = {
  shift: 3,
  bp: 21,
  revenue: 11_900_000,
  peakDevs: 133,
  shipped: 9,
  seconds: 372,
  learned: 'lesson.capacity',
  ledger: ['lesson.entropy', 'lesson.capacity'],
  nextProject: 'Untitled Roguelike Deckbuilder',
}

/** One page turn: §10.7 rule 1 completes the reveal, the next click advances. */
function turn(overlay: HTMLElement) {
  fireEvent.click(overlay)
  fireEvent.click(overlay)
}

describe('§15.1a — the reboot between two realities', () => {
  it('is not on screen at all until a shift has happened', () => {
    const { container } = render(<ParadigmCutScene report={null} onDone={vi.fn()} />)
    expect(container.querySelector('.studio-boot')).toBeNull()
  })

  it('walks the receipt, the ledger and the boot, one tap at a time', () => {
    const onDone = vi.fn()
    const { container } = render(<ParadigmCutScene report={report} onDone={onDone} />)
    const overlay = container.querySelector('.studio-boot') as HTMLElement

    expect(screen.getAllByText(/PARADIGM SHIFT 003/).length).toBeGreaterThan(0)
    turn(overlay)
    expect(screen.getAllByText(/REALITY 003/).length).toBeGreaterThan(0)
    turn(overlay)
    expect(screen.getAllByText(/LESSONS LEARNT/).length).toBeGreaterThan(0)
    turn(overlay)
    // §10.9.3's boot, back for the first time since the install's first launch.
    expect(screen.getAllByText(/STUDIO_OS v0\.0\.1 initialized/).length).toBeGreaterThan(0)

    // Nothing has handed the studio over yet — the last page is a page like any
    // other, and it obeys §10.7 rule 1 before it lifts.
    expect(onDone).not.toHaveBeenCalled()
    turn(overlay)
    act(() => vi.advanceTimersByTime(340))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('never advances on its own — the player reads it at their own pace', () => {
    const onDone = vi.fn()
    render(<ParadigmCutScene report={report} onDone={onDone} />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getAllByText(/PARADIGM SHIFT 003/).length).toBeGreaterThan(0)
    expect(onDone).not.toHaveBeenCalled()
  })
})
