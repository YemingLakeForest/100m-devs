/**
 * §10.7 [2026-10-04] — the queue as a GitLab-style pipeline: the gauge on the base
 * HUD and the graph in the window it opens. The claims: a finished game is in the
 * QUEUE stage at once (there is no Build or Test), the gauge is the queue's door,
 * every slot is a job card, the front game is marked as the one that ships next,
 * the SHIP job is the control, and a full queue says so.
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

describe('the queue gauge', () => {
  it('opens the queue from its CODE and QUEUE nodes', () => {
    let opened = 0
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => opened++} />)
    const door = container.querySelector<HTMLButtonElement>('.gl__open')!
    expect(container.textContent).toContain('QUEUE')
    act(() => {
      fireEvent.click(door)
    })
    expect(opened).toBe(1)
  })

  it('is the three stages as a row of nodes, and has no BUILD or TEST anywhere', () => {
    __setState({ devs: 1, shelf: [build(1)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    expect(container.querySelector('.gl--row .gl__node--code')).not.toBeNull()
    expect(container.querySelector('.gl--row .gl__node--queue')).not.toBeNull()
    expect(container.querySelector('.gl--row .pipe__ship')).not.toBeNull()
    expect(container.textContent).not.toMatch(/BUILD|TEST/)
  })

  it('fills one pip of the QUEUE node for each game waiting', () => {
    __setState({ shelf: [build(1), build(2)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    expect(container.querySelector('.qgauge__count')!.textContent).toBe('2/3')
    expect(container.querySelectorAll('.gl__node--queue i')).toHaveLength(3)
    expect(container.querySelectorAll('.gl__node--queue i[data-on="true"]')).toHaveLength(2)
  })

  it('says FULL, and goes to the stopped tone, when nobody can code', () => {
    __setState({ shelf: [build(1), build(2), build(3)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    expect(container.querySelector('.qgauge')!.getAttribute('data-tone')).toBe('stopped')
    expect(container.textContent).toMatch(/FULL/)
    expect(container.querySelector('.gl__node--queue')!.getAttribute('data-full')).toBe('true')
  })

  it('lights the SHIP! key, with a count, once something is ready', () => {
    __setState({ shelf: [build(1), build(2)] })
    const { container } = render(<PipelineStrip state={getState()} onOpen={() => {}} />)
    const ship = container.querySelector<HTMLButtonElement>('.pipe__ship')!
    expect(ship.disabled).toBe(false)
    expect(ship.getAttribute('data-ready')).toBe('true')
    expect(container.querySelector('.qgauge__badge')!.textContent).toBe('2')
  })
})

describe('the queue window', () => {
  it('draws GitLab’s layout: CODE, QUEUE and SHIP stages, a job card for every slot', () => {
    __setState({ devs: 1, shelf: [build(1), build(2)] })
    const { container } = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    const heads = [...container.querySelectorAll('.gl__head')].map((h) => h.textContent)
    expect(heads).toEqual(['CODE', 'QUEUE 2/3', 'SHIP'])
    const queue = container.querySelectorAll('.gl__col--queue .gl__job')
    expect([...queue].map((j) => j.getAttribute('data-state'))).toEqual(['pass', 'pass', 'none'])
    expect(container.textContent).toContain('Velvet 1')
  })

  it('marks the front game as the one that ships next', () => {
    __setState({ shelf: [build(1), build(2)] })
    const { container } = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    const marked = [...container.querySelectorAll('.gl__col--queue .gl__job')].map((j) => j.getAttribute('data-front'))
    expect(marked).toEqual(['true', null, null])
    expect(container.textContent).toContain('NEXT OUT')
  })

  it('joins each stage to the next with a line to every job', () => {
    __setState({ shelf: [build(1)] })
    const { container } = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    const links = container.querySelectorAll('.gl__link')
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.querySelectorAll('i')).toHaveLength(3)
  })

  it('shows the game being made, with the cover it will ship with', () => {
    __setState({ devs: 1 })
    const { container } = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    expect(container.textContent).toContain('NOW MAKING')
    expect(container.querySelector('.ring__shelf .cover')).not.toBeNull()
    expect(container.querySelector('.gl__job[data-state="run"], .gl__job[data-state="idle"]')).not.toBeNull()
  })

  it('ships the front game when the SHIP job is pressed, and not on an empty queue', () => {
    __setState({ devs: 1 })
    const empty = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    expect(empty.container.querySelector<HTMLButtonElement>('.gl__job--button')!.disabled).toBe(true)
    cleanup()
    __setState({ shelf: [build(1)] })
    let closed = 0
    const { container } = render(<QueueWindow open state={getState()} onClose={() => closed++} onBoard={() => {}} />)
    act(() => {
      fireEvent.click(container.querySelector('.gl__job--button')!)
    })
    expect(getState().launching).toBe(true)
    expect(closed).toBe(1)
  })

  it('blocks the CODE job and goes to the stopped tone when nobody can code', () => {
    __setState({ shelf: [build(1), build(2), build(3)] })
    const { container } = render(<QueueWindow open state={getState()} onClose={() => {}} onBoard={() => {}} />)
    expect(container.querySelector('.queue__catch')!.getAttribute('data-tone')).toBe('stopped')
    expect(container.querySelector('.gl__job[data-state="block"]')).not.toBeNull()
    expect(container.textContent).toContain('BLOCKED')
  })
})
