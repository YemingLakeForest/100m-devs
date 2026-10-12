import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Segs } from './PipelineGraph.tsx'

afterEach(cleanup)

/*
 * The CODE job's bar is six hard segments. The reference game's progress bar arrives white-hot
 * and cools; in this interface the newly lit segments arrive in the ramp's lightest value
 * (`--p3`) and settle in steps (graph.css `gl-hot`). The claim pinned here is *which* segments are
 * hot, because that is the logic; how hot is the stylesheet's.
 */
const state = (c: HTMLElement) =>
  [...c.querySelectorAll('i')].map((i) => `${i.dataset.on === 'true' ? 'on' : 'off'}${i.dataset.hot === 'true' ? '+hot' : ''}`)

describe('the CODE bar’s hot edge', () => {
  it('shows a bar that has only ever sat there as plain segments', () => {
    const { container } = render(<Segs progress={0.5} />)
    expect(state(container)).toEqual(['on', 'on', 'on', 'off', 'off', 'off'])
  })

  it('marks exactly the segments that just lit, and none of the ones that were already on', () => {
    const { container, rerender } = render(<Segs progress={0.5} />)
    rerender(<Segs progress={4 / 6} />)
    expect(state(container)).toEqual(['on', 'on', 'on', 'on+hot', 'off', 'off'])
    rerender(<Segs progress={1} />)
    expect(state(container)).toEqual(['on', 'on', 'on', 'on', 'on+hot', 'on+hot'])
  })

  it('has no hot edge when the sprint resets or drains', () => {
    const { container, rerender } = render(<Segs progress={1} />)
    rerender(<Segs progress={0} />)
    expect(state(container)).toEqual(['off', 'off', 'off', 'off', 'off', 'off'])
  })

  it('lets go of the hot edge once its animation has finished', () => {
    const { container, rerender } = render(<Segs progress={0} />)
    rerender(<Segs progress={1 / 6} />)
    const hot = container.querySelector('i[data-hot="true"]')!
    expect(hot).not.toBeNull()
    // jsdom has no `AnimationEvent`, so React listens for the vendor-prefixed name there; a real
    // browser sends the plain one. The handler is idempotent, so the test sends both.
    fireEvent(hot, new Event('animationend', { bubbles: true }))
    fireEvent(hot, new Event('webkitAnimationEnd', { bubbles: true }))
    expect(container.querySelector('i[data-hot="true"]')).toBeNull()
  })

  it('does not light a segment that a bar of no progress never reached', () => {
    const { container } = render(<Segs progress={-0.4} />)
    expect(state(container).every((s) => s === 'off')).toBe(true)
  })
})
