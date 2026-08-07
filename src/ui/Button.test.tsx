import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from './Button.tsx'
import { playUi } from './uiSfx.ts'

vi.mock('./uiSfx.ts', () => ({ playUi: vi.fn() }))

beforeEach(() => {
  vi.mocked(playUi).mockClear()
})

// Vitest runs without `globals`, so testing-library's own auto-cleanup hook is
// never registered and every render would stack up in the same document.
afterEach(cleanup)

describe('§10.8 F2 — the button acknowledges the finger before the action', () => {
  it('depresses on press-down, with nothing released yet', () => {
    // F2's test verbatim: "press and hold every interactive element without
    // releasing. If nothing changed, fail."
    render(<Button>HIRE DEVELOPER</Button>)
    const btn = screen.getByRole('button')

    expect(btn.className).not.toContain('is-pressed')
    fireEvent.pointerDown(btn)
    expect(btn.className).toContain('is-pressed')
  })

  it('sounds on down, not on up', () => {
    render(<Button>HIRE DEVELOPER</Button>)
    const btn = screen.getByRole('button')

    fireEvent.pointerDown(btn)
    expect(playUi).toHaveBeenCalledExactlyOnceWith('click')

    fireEvent.pointerUp(btn)
    // Still once. A second click on release would be the "reports on the
    // finger afterwards" failure wearing the right sound.
    expect(playUi).toHaveBeenCalledTimes(1)
  })

  it('springs back on release rather than snapping', () => {
    render(<Button>HIRE DEVELOPER</Button>)
    const btn = screen.getByRole('button')

    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)
    expect(btn.className).not.toContain('is-pressed')
    // The overshoot keyframe; a release with no animation is the linear return.
    expect(btn.className).toContain('is-releasing')
  })

  it('releases when the thumb slides off instead of staying stuck down', () => {
    render(<Button>HIRE DEVELOPER</Button>)
    const btn = screen.getByRole('button')

    fireEvent.pointerDown(btn)
    fireEvent.pointerLeave(btn)
    expect(btn.className).not.toContain('is-pressed')
  })

  it('does not spring a button that was never pressed', () => {
    render(<Button>HIRE DEVELOPER</Button>)
    const btn = screen.getByRole('button')

    fireEvent.pointerLeave(btn)
    expect(btn.className).not.toContain('is-releasing')
  })
})

describe('the frame is a terminal control, not a web one', () => {
  it('wraps the label in brackets — §10.6', () => {
    render(<Button>HIRE DEVELOPER</Button>)
    expect(screen.getByRole('button').textContent).toBe('[HIRE DEVELOPER]')
  })

  it('carries the bait variant through', () => {
    render(<Button variant="bait">HIRE 1,000 DEVS NOW</Button>)
    expect(screen.getByRole('button').className).toContain('ui-btn--bait')
  })

  it('still calls onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>HIRE DEVELOPER</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
