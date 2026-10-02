import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StageHandle } from '../render/stage.ts'
import { StudioBoot } from './StudioBoot.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

afterEach(() => { cleanup(); vi.useRealTimers() })

function setup(value = 1) {
  vi.useFakeTimers()
  const stage = { focusFounder: vi.fn(), codeFounder: vi.fn(() => value) }
  const onDone = vi.fn()
  render(<StudioBoot founderName="Anson" projectName="Tiny Moon" stage={stage as unknown as StageHandle} onDone={onDone} />)
  expect(screen.getAllByText('You had an idea for an app.').length).toBeGreaterThan(0)
  const prologue = document.querySelector('.studio-boot')!
  for (let i = 0; i < 6; i++) fireEvent.click(prologue)
  act(() => vi.advanceTimersByTime(400))
  return { stage, onDone }
}

describe('first app opening', () => {
  it('centres the founder and teaches with real coding before handing over', () => {
    const { stage, onDone } = setup()
    expect(stage.focusFounder).toHaveBeenCalledOnce()
    expect(screen.getByText('Tiny Moon')).toBeInTheDocument()
    expect(screen.getByText(/Anson, founder/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Let’s write this app' }))
    expect(stage.codeFounder).not.toHaveBeenCalled()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'CODE' }))
    expect(stage.codeFounder).toHaveBeenCalledTimes(3)
    expect(screen.getByText(/Build and Test run automatically/)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep coding' }))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('does not claim progress when the game refuses a coding action', () => {
    const { stage, onDone } = setup(0)
    fireEvent.click(screen.getByRole('button', { name: 'Let’s write this app' }))
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'CODE' }))
    expect(stage.codeFounder).toHaveBeenCalledTimes(3)
    expect(screen.getByText(/0 \/ 3 lines/)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
