import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore, __setState } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_JAMES_INSTANT_MESSENGER } from '../game/scenes.ts'
import { Hud } from './Hud.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
vi.mock('../ui/Dialogue.tsx', () => ({
  Dialogue: ({ onFinished }: { onFinished?: () => void }) => (
    <button type="button" onClick={onFinished}>FINISH JAMES SCENE</button>
  ),
}))

beforeEach(() => {
  const permanent = emptyPermanent()
  setPermanent({ ...permanent, meta: { ...permanent.meta, paradigmShifts: 1 } })
  __resetStore()
  __setState({ scene: SCENE_JAMES_INSTANT_MESSENGER.id, tech: { B1: 1 } })
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
  vi.clearAllMocks()
})

describe('James hands over Instant Messenger', () => {
  it('opens the company board and proves the granted multiplier on his final tap', () => {
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'FINISH JAMES SCENE' }))

    const board = container.querySelector('.hud__upgrades')
    expect(board).not.toBeNull()
    expect(board?.className).toContain('ui-panel--right')
    expect(screen.getByText('EFFECT APPLIED')).toBeInTheDocument()
    expect(screen.getByText('COMMUNICATION LOAD')).toBeInTheDocument()
    expect(screen.getByText('→ 95%')).toBeInTheDocument()
    expect(container.querySelector('.upgrade-board__node[data-flash="true"]'))
      .toHaveAttribute('aria-label', 'Instant Messenger')
  })
})
