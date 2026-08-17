/**
 * §13.8's placement banner — GDD §7.7.6b.
 *
 * The assertion that matters here is the *absent* one: with nobody armed there
 * is no banner at all. §7.7.6b's finding was that a mode nobody announced was
 * unusable; the correction is not a permanent readout saying which mode you are
 * not in, which is §10.6's web-page tell wearing a hint's clothes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostingBanner } from './PostingBanner.tsx'
import { __resetStore, beginPosting, getState } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_MO_ARRIVES } from '../game/scenes.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

function arrived() {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_MO_ARRIVES.id] },
  })
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§7.7.6b — the armed gesture is said out loud', () => {
  it('is not on screen with nobody armed', () => {
    const { container } = render(<PostingBanner state={getState()} />)
    expect(container.querySelector('.posting')).toBeNull()
  })

  it('names who the next tap will put down', () => {
    arrived()
    beginPosting('mo')
    render(<PostingBanner state={getState()} />)
    // Trap 31 — one string, so the sentence is findable as a sentence.
    expect(screen.getByText('TAP A UNIT TO POST MO')).toBeInTheDocument()
  })

  it('offers a way out that is not the world', () => {
    arrived()
    beginPosting('mo')
    render(<PostingBanner state={getState()} />)
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(getState().posting).toBeNull()
  })
})
