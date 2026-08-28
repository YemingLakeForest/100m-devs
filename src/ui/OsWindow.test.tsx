import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OsWindow } from './OsWindow.tsx'

vi.mock('./uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))

afterEach(cleanup)

describe('§10.6a — one frame, and the machine owns it', () => {
  it('names the process in the bar', () => {
    render(
      <OsWindow open title="GALLERY" onClose={() => {}}>
        <p>covers</p>
      </OsWindow>,
    )
    expect(screen.getByText('STUDIO_OS')).toBeInTheDocument()
    expect(screen.getByText('GALLERY')).toBeInTheDocument()
  })

  it('puts the way out in the top right corner, and calls it CLOSE', () => {
    // The glyph is `X`; the *name* is CLOSE, because "X" tells a screen reader
    // nothing and is not a thing the playthrough walk can press for.
    const onClose = vi.fn()
    render(
      <OsWindow open title="UPGRADES" onClose={onClose}>
        <p>board</p>
      </OsWindow>,
    )
    screen.getByRole('button', { name: 'CLOSE' }).click()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('draws no close box on a window that has no exit but its own decisions', () => {
    // §18.0a and §21.0a: the incident card and the term sheet cannot be
    // dismissed. A disabled close box would advertise an exit that is not
    // there, which is worse than not drawing one.
    render(
      <OsWindow open title="TERM SHEET">
        <p>SAFE, uncapped</p>
      </OsWindow>,
    )
    expect(screen.queryByRole('button', { name: 'CLOSE' })).toBeNull()
  })

  it('keeps the footer out of the scroll', () => {
    // §21.0a's defect, as a structural claim: the actions are a sibling of the
    // scrolling body, so no amount of content can push them below the fold.
    const { container } = render(
      <OsWindow open title="PARADIGM TREE" onClose={() => {}} footer={<button type="button">SHIFT</button>}>
        <p>nodes</p>
      </OsWindow>,
    )
    const body = container.querySelector('.os-window__body')!
    expect(body.querySelector('.os-window__foot')).toBeNull()
    expect(container.querySelector('.os-window__foot')?.textContent).toBe('SHIFT')
  })

  it('carries the window into the frame through Panel, so it can leave again', () => {
    // Every overlay animates in and out through one component (§10.8 F1), and
    // an OS window is not an exception to that — it is a caller of it.
    const { container, rerender } = render(
      <OsWindow open title="ROSTER" onClose={() => {}}>
        <p>heroes</p>
      </OsWindow>,
    )
    expect(container.querySelector('.ui-panel.os-frame')).not.toBeNull()

    rerender(
      <OsWindow open={false} title="ROSTER" onClose={() => {}}>
        <p>heroes</p>
      </OsWindow>,
    )
    expect(container.querySelector('.ui-panel')?.getAttribute('data-phase')).toBe('exit')
  })

  it('reports a body with nothing to scroll as having nothing to scroll', () => {
    // jsdom lays nothing out, so every measurement is zero — which is the
    // "not laid out yet" case, and the rail must stay down rather than draw a
    // full-height thumb over a window that has not been measured.
    const { container } = render(
      <OsWindow open title="ROSTER" onClose={() => {}}>
        <p>heroes</p>
      </OsWindow>,
    )
    expect(container.querySelector('.os-window__rail')?.getAttribute('data-on')).toBe('false')
    expect(container.querySelector('.os-window__body')?.getAttribute('data-overflow')).toBe('false')
  })
})
