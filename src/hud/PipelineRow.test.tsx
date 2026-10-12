import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { PipelineRow } from './PipelineGraph.tsx'
import type { QueueView } from './queueModel.ts'

afterEach(cleanup)

/*
 * The rail's row is on screen all game, and its QUEUE node is the one bar in it that goes up in
 * whole steps: each finished build lights a slot. The claim pinned here is which slot arrives hot,
 * because that is the logic; the three hard frames are graph.css's.
 */
const view = (games: number, capacity = 6): QueueView => ({
  games: Array.from({ length: games }, () => ({})) as unknown as QueueView['games'],
  used: games, capacity, free: capacity - games,
  coding: 0.4, nextBuildIn: 5, cycle: 10, fullIn: 40, autoShip: false, autoEvery: null, autoIn: null,
  flow: 'steady',
})

const slots = (c: HTMLElement) =>
  [...c.querySelectorAll('.gl__node--queue i')].map((i) => {
    const el = i as HTMLElement
    return `${el.dataset.on === 'true' ? 'on' : 'off'}${el.dataset.hot === 'true' ? '+hot' : ''}`
  })

const row = (games: number) => (
  <PipelineRow v={view(games)} onOpen={() => {}} label="queue"><span /></PipelineRow>
)

describe('the rail row’s QUEUE slots', () => {
  it('shows a queue that was already there as plain slots', () => {
    const { container } = render(row(2))
    expect(slots(container)).toEqual(['on', 'on', 'off', 'off', 'off', 'off'])
  })

  it('lights the new game’s slot hot and leaves the games already waiting alone', () => {
    const { container, rerender } = render(row(2))
    rerender(row(3))
    expect(slots(container)).toEqual(['on', 'on', 'on+hot', 'off', 'off', 'off'])
  })

  it('has nothing hot when the queue is shipped out from under it', () => {
    const { container, rerender } = render(row(4))
    rerender(row(0))
    expect(slots(container)).toEqual(['off', 'off', 'off', 'off', 'off', 'off'])
  })

  it('lets go of the hot slot when its animation ends', () => {
    const { container, rerender } = render(row(0))
    rerender(row(1))
    const hot = container.querySelector('.gl__node--queue i[data-hot="true"]')!
    expect(hot).not.toBeNull()
    fireEvent(hot, new Event('animationend', { bubbles: true }))
    fireEvent(hot, new Event('webkitAnimationEnd', { bubbles: true }))
    expect(container.querySelector('.gl__node--queue i[data-hot="true"]')).toBeNull()
  })
})
