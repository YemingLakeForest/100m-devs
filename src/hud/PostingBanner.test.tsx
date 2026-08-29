/**
 * §13.8's placement strip — GDD §7.7.6b.
 *
 * The assertion that matters here is the *absent* one: with nobody armed there
 * is no strip at all. §7.7.6b's finding was that a mode nobody announced was
 * unusable; the correction is not a permanent readout saying which mode you are
 * not in, which is §10.6's web-page tell wearing a hint's clothes.
 *
 * **And, since 2026-08-29, a second absent assertion.** The strip was reported
 * as covering the middle of the screen, and the fix was to take three of its
 * five readings away and put them on the plate at the target
 * (`WorldHeroAssignments.tsx`). So the cases below check both halves: what one
 * row still has to say, and what it is no longer allowed to say — because a
 * later change that quietly puts a second line back is exactly how a surface
 * grows into the middle of a screen again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostingBanner } from './PostingBanner.tsx'
import {
  __resetStore,
  __setState,
  beginPosting,
  getState,
  postHeroAt,
  previewHeroAt,
} from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_BILLY_ARRIVES, SCENE_MO_ARRIVES } from '../game/scenes.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

function arrived() {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    // §21.7.6 — Billy is the placement verb, so a fixture without him cannot arm
    // anything at all. See `game/unlocks.ts`.
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [SCENE_MO_ARRIVES.id, SCENE_BILLY_ARRIVES.id],
    },
  })
}

/** How tall the surface is, in lines of copy. The whole point of the rewrite. */
function rows(container: HTMLElement): number {
  const row = container.querySelector('.posting__row')
  return row ? row.querySelectorAll(':scope > span').length : 0
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

  it('names who the next tap will put down, and how to get out', () => {
    arrived()
    __setState({ devs: 40 })
    beginPosting('mo')
    const { container } = render(<PostingBanner state={getState()} />)

    expect(screen.getByText('PLACE MO')).toBeInTheDocument()
    expect(screen.getByText(/TAP ANYONE/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeInTheDocument()

    // The three readings that moved. `BEST POSSIBLE` in particular is decision
    // support for a decision §22.9's card already stated in as many words, and
    // it was the widest line on the old four-line block.
    expect(screen.queryByText(/BEST POSSIBLE/)).not.toBeInTheDocument()
    expect(screen.queryByText(/STEP 2 OF 3/)).not.toBeInTheDocument()
    expect(rows(container)).toBe(3)
  })

  it('states the exact candidate on one line, and offers the transaction', () => {
    arrived()
    __setState({ devs: 40, runSeconds: 100 })
    beginPosting('mo')
    previewHeroAt({ rung: 0, index: 36 })
    const { container } = render(<PostingBanner state={getState()} />)

    expect(screen.getByText('PLACE MO')).toBeInTheDocument()
    // Where, and what it is worth to the hero. What it is worth to the studio
    // is on the plate at the anchor — `WorldHeroAssignments.test.tsx` owns that
    // half, and this asserts the row does *not* try to carry it as well.
    expect(screen.getByText('DESK 37 · XP SHARE 10%')).toBeInTheDocument()
    expect(screen.queryByText(/DEFECT RATE/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRM PLACE' })).toBeInTheDocument()
    // §13.8c — inspecting is free. Nobody has moved yet.
    expect(getState().heroPlacements.mo).toBeUndefined()
    expect(rows(container)).toBe(3)
  })

  it('offers a way out that is not the world', () => {
    arrived()
    beginPosting('mo')
    render(<PostingBanner state={getState()} />)
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(getState().posting).toBeNull()
  })

  it('confirms the remote channel, then the live effect', () => {
    arrived()
    __setState({ devs: 40, runSeconds: 100 })
    beginPosting('mo')
    postHeroAt({ rung: 0, index: 0 })

    const view = render(<PostingBanner state={getState()} />)
    // §13.8 rule 4 — channel setup is real, so the receipt may not claim the
    // effect is live during it.
    expect(screen.getByText('MO IS CONNECTING')).toBeInTheDocument()
    expect(screen.getByText(/ACTIVE IN 8S · WILL COVER 8 \/ 40 DEVS/)).toBeInTheDocument()

    __setState({ runSeconds: 109 })
    view.rerender(<PostingBanner state={getState()} />)
    expect(screen.getByText('MO IS ACTIVE')).toBeInTheDocument()
    expect(screen.getByText(/COVERS 8 \/ 40 DEVS · -8% DEFECT RATE · XP 20%/)).toBeInTheDocument()
  })
})
