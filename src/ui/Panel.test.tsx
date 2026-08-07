import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { DURATION } from './motion.ts'
import { Panel } from './Panel.tsx'

vi.mock('./uiSfx.ts', () => ({ playUi: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('§10.8 F1 — nothing pops out', () => {
  it('keeps a closing panel mounted for the length of its exit', () => {
    // This is the entire reason Panel exists. React removes an element the
    // frame its condition goes false, so without something holding the mount
    // open there is nothing left on screen to animate, and every overlay in
    // the product fails F1 in the same way for the same reason.
    const { container, rerender } = render(
      <Panel open>
        <p>BANKRUPTCY</p>
      </Panel>,
    )
    expect(container.querySelector('.ui-panel')).not.toBeNull()

    rerender(
      <Panel open={false}>
        <p>BANKRUPTCY</p>
      </Panel>,
    )
    const panel = container.querySelector('.ui-panel')
    expect(panel).not.toBeNull()
    // Still on screen, and now travelling back toward the edge it came from.
    expect(panel?.getAttribute('data-phase')).toBe('exit')
  })

  it('removes it once the exit has actually finished, and says so', () => {
    const onExited = vi.fn()
    const { container, rerender } = render(
      <Panel open onExited={onExited}>
        <p>BANKRUPTCY</p>
      </Panel>,
    )

    rerender(
      <Panel open={false} onExited={onExited}>
        <p>BANKRUPTCY</p>
      </Panel>,
    )
    expect(onExited).not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(DURATION.panelOut))
    expect(container.querySelector('.ui-panel')).toBeNull()
    expect(onExited).toHaveBeenCalledOnce()
  })

  it('renders nothing at all when it was never opened', () => {
    const { container } = render(
      <Panel open={false}>
        <p>BANKRUPTCY</p>
      </Panel>,
    )
    expect(container.querySelector('.ui-panel')).toBeNull()
  })

  it('leaves faster than it arrives — §10.5, always', () => {
    expect(DURATION.panelOut).toBeLessThan(DURATION.panelIn)
  })

  it('puts a scrim behind a modal so the simulation stays visible', () => {
    // §10.6: full-screen opaque menus end the immersion the whole game is
    // built on. The scrim is semi-transparent and blurs up over the same
    // duration as the panel.
    const { container } = render(
      <Panel open modal from="centre">
        <p>BANKRUPTCY</p>
      </Panel>,
    )
    const scrim = container.querySelector('.ui-scrim')
    expect(scrim).not.toBeNull()
    expect(scrim?.getAttribute('data-phase')).toBe('in')
  })

  it('exits toward the edge it belongs to', () => {
    // §10.5 rule 1 — outgoing elements exit toward where they went, which is
    // the origin class the keyframes read their direction from.
    const { container } = render(
      <Panel open from="right">
        <p>NODE INSPECTOR</p>
      </Panel>,
    )
    expect(container.querySelector('.ui-panel')?.className).toContain('ui-panel--right')
  })
})
