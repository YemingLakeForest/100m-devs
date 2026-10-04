/**
 * §10.7 [2026-10-03] — the pipeline strip on the base HUD, and the window it
 * opens. The claims: a built game is on the plate at once as a run, the plate is
 * the queue's door, a full queue says so, and the window lists every run in the
 * order it will ship.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

import { __resetStore, __setState, getState, type ShelvedBuild } from '../game/store.ts'
import { PipelineStrip } from './PipelineStrip.tsx'
import { QueueWindow } from './QueueWindow.tsx'

const build = (id: number): ShelvedBuild =>
  ({ id, ordinal: id, name: `Velvet ${id}`, genre: 'roguelike', size: 300, shelvedAt: 0 }) as unknown as ShelvedBuild

beforeEach(() => __resetStore())
afterEach(cleanup)

describe('the pipeline strip', () => {
  it('is a button that opens the queue', () => {
    let opened = 0
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => opened++} />)
    const door = container.querySelector<HTMLButtonElement>('.pstrip__main')!
    expect(door.textContent).toContain('PIPELINES')
    act(() => {
      fireEvent.click(door)
    })
    expect(opened).toBe(1)
  })

  it('shows a build as a run the moment it is built, still travelling', () => {
    __setState({ devs: 1, pipeline: { build: [{ item: build(1), progress: 0 }], test: [] } })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    const chips = container.querySelectorAll('.pchip:not(.pchip--empty)')
    expect(chips).toHaveLength(1)
    expect(chips[0].getAttribute('data-stage')).toBe('build')
    // No BUILD / TEST counters any more: the run is the thing.
    expect(container.textContent).not.toMatch(/BUILD\s*\d/)
  })

  it('draws the room that is left as empty slots', () => {
    __setState({ shelf: [build(1)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    expect(container.querySelectorAll('.pchip--empty')).toHaveLength(2)
  })

  it('says FULL, and inverts, when nobody can code', () => {
    __setState({ shelf: [build(1), build(2), build(3)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    expect(container.querySelector('.pstrip')!.getAttribute('data-tone')).toBe('stopped')
    expect(container.textContent).toMatch(/FULL/)
  })

  it('lights the SHIP! key, with a count, once something is ready', () => {
    __setState({ shelf: [build(1), build(2)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    const ship = container.querySelector<HTMLButtonElement>('.pipe__ship')!
    expect(ship.disabled).toBe(false)
    expect(ship.getAttribute('data-ready')).toBe('true')
    expect(container.querySelector('.pstrip__badge')!.textContent).toBe('2')
  })
})

describe('the queue window', () => {
  it('lists every run, ready first, as a graph of three jobs', () => {
    __setState({
      devs: 1,
      shelf: [build(1)],
      pipeline: { build: [{ item: build(3), progress: 0.4 }], test: [{ item: build(2), progress: 0.5 }] },
    })
    const { container } = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    const runs = [...container.querySelectorAll('.queue__run[data-stage]')].map((r) => r.getAttribute('data-stage'))
    expect(runs).toEqual(['ready', 'test', 'build'])
    expect(container.querySelectorAll('.queue__run[data-stage="ready"] .pnode')).toHaveLength(3)
    expect(container.textContent).toContain('3/3')
  })
})
