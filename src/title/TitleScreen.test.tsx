import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TitleScreen } from './TitleScreen.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

afterEach(cleanup)

describe('landing-screen game choices', () => {
  it('labels the existing-run action CONTINUE', () => {
    const onStart = vi.fn()
    render(
      <TitleScreen
        stage={null}
        firstLaunch={false}
        onStart={onStart}
        onNewGame={() => {}}
        onExited={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'CONTINUE' }))
    expect(onStart).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'START' })).not.toBeInTheDocument()
  })

  it('guards New Game behind an explicit destructive confirmation', () => {
    const onStart = vi.fn()
    const onNewGame = vi.fn()
    render(
      <TitleScreen
        stage={null}
        firstLaunch={false}
        onStart={onStart}
        onNewGame={onNewGame}
        onExited={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'NEW GAME' }))
    expect(onNewGame).not.toHaveBeenCalled()
    expect(screen.getByText('START A NEW GAME?')).toBeInTheDocument()
    expect(screen.getByText(/choose your founder again/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ERASE & START' }))
    expect(onNewGame).toHaveBeenCalledOnce()
    expect(onStart).not.toHaveBeenCalled()
  })
})
