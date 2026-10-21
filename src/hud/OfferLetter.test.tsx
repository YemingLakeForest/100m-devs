/**
 * §22.9.4 — the offer letter [2026-10-21]. It pins the claim, not the layout:
 * the letter carries the same two bands as the pass the hero keeps, the reason
 * is the player's problem, and SIGN is the only way out.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OfferLetter } from './OfferLetter.tsx'
import { __resetStore, getState, heroById } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_SERENA_ARRIVES } from '../game/scenes.ts'
import { HERO_BY_ID } from '../sim/storyHeroes.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

beforeEach(() => {
  __resetStore()
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_SERENA_ARRIVES.id] } })
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
})

it('prints the pass she will keep, the reason she was hired, and signs on one press', () => {
  const onSign = vi.fn()
  const { container } = render(<OfferLetter hero={heroById('serena')} state={getState()} treesOpen onSign={onSign} />)
  expect(screen.getByText('KEEPER OF THE QUEUE')).toBeInTheDocument()
  expect(screen.getByText(HERO_BY_ID.get('serena')!.hiredFor)).toBeInTheDocument()
  expect(container.querySelector('.pass-always')).not.toBeNull()
  expect(container.querySelector('.pass-coming')).not.toBeNull()
  expect(screen.getByText('HIRED')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'SIGN' }))
  expect(onSign).toHaveBeenCalledOnce()
})

it('is not on screen when nobody is waiting to sign', () => {
  const { container } = render(<OfferLetter hero={null} state={getState()} treesOpen onSign={() => {}} />)
  expect(container.querySelector('.offer__form')).toBeNull()
})
