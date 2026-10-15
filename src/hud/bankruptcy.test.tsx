import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn(), pokeSfxForZoom: () => 'poke-desk' }))
import { cleanup, render, screen, act } from '@testing-library/react'
import { Hud } from './Hud.tsx'
import { __resetStore, jumpToPhase } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
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

  it('tells a later run about its own payroll, not Run 1’s thousand developers', async () => {
    // The playthrough that found it: a Run 2 studio of twelve went under on
    // payroll and the panel said "Your 1,000 developers spent 100% of their time
    // arguing in Slack" — Run 1's script, printed for every bankruptcy after it.
    __resetStore()
    const p = emptyPermanent()
    setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
    jumpToPhase('bankrupt')
    render(<Hud stage={null} />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    // Plural queries: the lesson is on the modal *and* on the rail's terminal,
    // and both are the thing under test.
    expect(screen.queryAllByText(/Payroll is a clock/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/arguing in Slack/)).toHaveLength(0)
    expect(screen.queryAllByText(/1,000 developers/)).toHaveLength(0)
    expect(screen.queryByText(/TRIGGER PARADIGM SHIFT/)).not.toBeNull()
  })

  it('still tells Run 1 the trap it walked into', async () => {
    __resetStore()
    jumpToPhase('bankrupt')
    render(<Hud stage={null} />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(screen.queryAllByText(/arguing in Slack/).length).toBeGreaterThan(0)
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
