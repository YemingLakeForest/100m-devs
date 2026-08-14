import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { GainStack, MAX_GAINS } from './GainStack.tsx'
import type { GameState } from '../game/store.ts'

afterEach(cleanup)

function ship(id: number, revenue: number): GameState {
  return { ship: { id, name: 'Game', revenue, at: 0 } } as unknown as GameState
}

describe('§10.8a — the gain stack', () => {
  it('is absent while nothing has shipped', () => {
    const { container } = render(<GainStack state={{} as GameState} />)
    expect(container.querySelector('.hud__gains')).toBeNull()
  })

  it('shows the money that just landed, newest first', () => {
    const { container, rerender } = render(<GainStack state={ship(1, 50)} />)
    rerender(<GainStack state={ship(2, 5000)} />)

    const gains = container.querySelectorAll('.hud__gain')
    expect(gains).toHaveLength(2)
    // Newest first: the second ship reads above the first.
    expect(gains[0].textContent).toContain('5.0K')
    expect(gains[1].textContent).toContain('50')
  })

  it('caps the column at MAX_GAINS', () => {
    let state = ship(1, 10)
    const { container, rerender } = render(<GainStack state={state} />)
    for (let id = 2; id <= 5; id++) {
      state = ship(id, 10)
      rerender(<GainStack state={state} />)
    }
    expect(container.querySelectorAll('.hud__gain').length).toBe(MAX_GAINS)
  })
})
