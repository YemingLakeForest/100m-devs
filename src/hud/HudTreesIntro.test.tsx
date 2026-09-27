/**
 * §21.6 [2026-09-26] — **James's Instant Messenger is how the trees arrive.**
 *
 * *"the story of james introducing us instant messenger should be how upgrade
 * trees are introduced so we need that back in the new isometric tree."* The
 * scene used to end on the studio board with Instant Messenger at its centre;
 * that board is retired, and Instant Messenger is the root of James's tree. So
 * the scene ends on his tree, opened at that node, over his card.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore, __setState, getState, techOf } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_JAMES_ARRIVES, SCENE_JAMES_INSTANT_MESSENGER } from '../game/scenes.ts'
import { Hud } from './Hud.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
vi.mock('../ui/Dialogue.tsx', () => ({
  Dialogue: ({ onFinished }: { onFinished?: () => void }) => (
    <button type="button" onClick={onFinished}>FINISH JAMES SCENE</button>
  ),
}))

beforeEach(() => {
  __resetStore()
  const permanent = emptyPermanent()
  // Run 2: James arrived in Run 1's Act I, and the first shift has happened.
  setPermanent({
    ...permanent,
    meta: { ...permanent.meta, paradigmShifts: 1, milestones: [SCENE_JAMES_ARRIVES.id] },
  })
  __setState({ scene: SCENE_JAMES_INSTANT_MESSENGER.id })
  // jsdom has no canvas; the board asks for one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
  vi.restoreAllMocks()
})

describe('James hands over Instant Messenger', () => {
  it('opens his tree on it, over his card, on his final tap', () => {
    const { container } = render(<Hud stage={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'FINISH JAMES SCENE' }))

    const titles = [...container.querySelectorAll('.os-window__title')].map((t) => t.textContent)
    expect(titles).toContain('UPGRADES // JAMES')
    expect(container.querySelector('.trees__title')?.textContent).toBe('Instant Messenger')
    expect(container.querySelector('.trees__effect')?.textContent).toContain('Communication load −5%')
    // Closing the tree hands the player back to the person it belongs to.
    expect(getState().selectedHero).toBe('james')
  })

  it('is the same effect the old board granted — communication load −5%', () => {
    expect(techOf().devCapMultiplier).toBeCloseTo(1 / 0.95, 12)
  })

  it('does nothing in Run 1, before the trees open', () => {
    setPermanent(emptyPermanent())
    expect(techOf().devCapMultiplier).toBe(1)
  })
})
