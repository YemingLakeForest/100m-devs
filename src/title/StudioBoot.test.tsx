import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StudioBoot } from './StudioBoot.tsx'
import { playUi } from '../ui/uiSfx.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

afterEach(cleanup)

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(playUi).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the STUDIO_OS boot cut scene', () => {
  it('moves through the pages one click at a time', () => {
    const onDone = vi.fn()
    const { container } = render(
      <StudioBoot founderName="Anson" projectName="Flappy Square 1.0" onDone={onDone} />,
    )
    const overlay = container.firstElementChild as HTMLElement

    expect(screen.getAllByText(/STUDIO_OS v0\.0\.1 initialized/).length).toBeGreaterThan(0)

    // §10.7 rule 1 — the first click completes the page it interrupts.
    fireEvent.click(overlay)
    expect(screen.getAllByText(/STUDIO_OS v0\.0\.1 initialized/).length).toBeGreaterThan(0)

    // A click on a finished page moves on.
    fireEvent.click(overlay)
    expect(screen.getAllByText(/project: Flappy Square 1\.0/).length).toBeGreaterThan(0)

    fireEvent.click(overlay)
    fireEvent.click(overlay)
    expect(screen.getAllByText(/founder: Anson/).length).toBeGreaterThan(0)

    fireEvent.click(overlay)
    fireEvent.click(overlay)
    expect(screen.getAllByText('ready.').length).toBeGreaterThan(0)
    expect(onDone).not.toHaveBeenCalled()
    expect(vi.mocked(playUi)).not.toHaveBeenCalledWith('start')

    // The last page obeys rule 1 like every other: the first click completes
    // it, and the click on the finished page lights the room up and hands the
    // desk over.
    fireEvent.click(overlay)
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(overlay)
    expect(vi.mocked(playUi)).toHaveBeenCalledWith('start')
    act(() => vi.advanceTimersByTime(340))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('never advances on its own — the player reads the boot at their own pace', () => {
    const onDone = vi.fn()
    render(<StudioBoot founderName="Anson" projectName="Flappy Square 1.0" onDone={onDone} />)

    // Time passes, nothing types past the clock that time owns, and no click
    // has happened — the first page must still be the only page.
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getAllByText(/STUDIO_OS v0\.0\.1 initialized/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/project: Flappy Square 1\.0/)).not.toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
