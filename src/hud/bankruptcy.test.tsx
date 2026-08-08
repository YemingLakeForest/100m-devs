import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn(), pokeSfxForZoom: () => 'poke-desk' }))
import { cleanup, render, screen, act } from '@testing-library/react'
import { Hud } from './Hud.tsx'
import { __resetStore, jumpToPhase } from '../game/store.ts'

afterEach(() => {
  cleanup()
  __resetStore()
})

describe('the bankruptcy panel — §21 Act V', () => {
  it('offers the Paradigm Shift when the run has ended', async () => {
    // Without this button the run is unwinnable: bankruptcy is terminal, the
    // action bar is empty by design at that phase, and the only route into
    // Run 2 is this panel.
    __resetStore()
    jumpToPhase('bankrupt')
    render(<Hud stage={null} />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(screen.queryByText(/TRIGGER PARADIGM SHIFT/)).not.toBeNull()
  })

  it('mounts without requestAnimationFrame ever firing', async () => {
    // The bug this pins cost the game its only exit from Run 1. Panel used to
    // schedule its mount inside rAF, and Chrome suspends rAF entirely while
    // `document.hidden` is true — so a panel opened in a background tab never
    // appeared, and returning did not fix it because the effect had already
    // run and its callback was queued forever.
    //
    // Stubbing rAF to never call back reproduces a hidden tab exactly.
    const raf = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(() => 0 as unknown as number)
    try {
      __resetStore()
      jumpToPhase('bankrupt')
      render(<Hud stage={null} />)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60))
      })
      expect(screen.queryByText(/TRIGGER PARADIGM SHIFT/)).not.toBeNull()
    } finally {
      raf.mockRestore()
    }
  })
})
