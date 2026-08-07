import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { __resetStore, jumpToPhase } from '../game/store.ts'
import { Hud } from './Hud.tsx'

// The kit's sound bank goes through the native path, which has no business
// being loaded by a layout test.
vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

afterEach(() => {
  cleanup()
  __resetStore()
})

/**
 * §23.6: "Nothing currently passes §10.8. The HUD has no press-down state, no
 * overscroll, no panel transitions." These pin the retrofit — the kit is judged
 * on whether it absorbs the buttons that already exist, so the assertions are
 * about the existing HUD rather than about the kit in isolation.
 */
describe('the retrofitted HUD — §10.8 F1 and F2', () => {
  it('gives the Act II hire button a press-down state', () => {
    jumpToPhase('act2_offer_hire')
    render(<Hud stage={null} />)

    const btn = screen.getByRole('button')
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })

  it('gives the Act III mousetrap one too, and keeps it begging', () => {
    jumpToPhase('act3_bait')
    render(<Hud stage={null} />)

    const btn = screen.getByRole('button')
    expect(btn.className).toContain('ui-btn--bait')
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })

  it('brings the bankruptcy screen in through a Panel rather than as a cut', () => {
    // The screen used to appear the frame the phase flipped, which is the F1
    // failure by name. It now enters on the §10.5 modal budget.
    jumpToPhase('bankrupt')
    const { container } = render(<Hud stage={null} />)

    const panel = container.querySelector('.ui-panel')
    expect(panel).not.toBeNull()
    expect(panel?.getAttribute('data-phase')).toBe('in')
    // Semi-transparent and blurred, never an opaque sheet: the simulation
    // keeps running behind it (§10.6).
    expect(container.querySelector('.ui-scrim')).not.toBeNull()
  })
})
