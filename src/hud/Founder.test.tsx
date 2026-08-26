import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore, __setState } from '../game/store.ts'
import { emptyPermanent, getPermanent, setPermanent } from '../game/save.ts'
import { SCENE_FOUNDER_BOARD } from '../game/scenes.ts'
import { writeFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
import { FounderDesk, FounderProfilePanel } from './Founder.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playKeyboardClick: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  __resetStore()
  setPermanent(emptyPermanent())
})
afterEach(() => {
  cleanup()
  setPermanent(emptyPermanent())
})

describe('manager corner', () => {
  it('routes the CODE button through the stage coding action', () => {
    writeFounderProfile({
      name: 'Ada', head: 'coil', hairColour: 1, skin: 2,
      accessory: 'none', facialHair: 'moustache', body: 'jacket', bodyColour: 0,
    })
    const codeFounder = vi.fn(() => 1)
    const stage = { codeFounder } as unknown as StageHandle

    render(<FounderDesk stage={stage} />)
    expect(screen.getByText('ADA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CODE' }))

    expect(codeFounder).toHaveBeenCalledOnce()
  })

  /**
   * §4.5d — the desk is yours from the garage. The screen behind it opens in
   * Act I and always has, and §21.7.7 does not change that: what it gates is
   * the *board* inside, which is the next test.
   */
  it('opens a personal screen with the saved avatar, board or no board', () => {
    writeFounderProfile({
      name: 'Ada', head: 'buzz', hairColour: 2, skin: 3,
      accessory: 'headphones', facialHair: 'goatee', body: 'knit', bodyColour: 3,
    })
    render(<FounderProfilePanel open onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: 'ADA' })).toBeInTheDocument()
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-head', 'buzz')
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-accessory', 'headphones')
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-facial-hair', 'goatee')
  })

  /**
   * §21.7.7 — **the desk is not gated and the board is.**
   *
   * And the board is not *drawn* before its scene rather than drawn and
   * disabled: §21.7.6b's rule is that a silent row is the loudest kind of
   * furniture, and a greyed skill tree is a shop the game is telling the player
   * to come back to.
   */
  it('draws no Management tree until §21.7.7 has handed it over', () => {
    render(<FounderProfilePanel open onClose={() => {}} />)
    expect(screen.queryByRole('heading', { name: 'MANAGEMENT — YOU' })).toBeNull()
    expect(screen.queryByText('Touch Typing')).toBeNull()
  })

  it('draws it once it has', () => {
    const p = getPermanent()
    setPermanent({
      ...p,
      meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_FOUNDER_BOARD.id] },
    })
    render(<FounderProfilePanel open onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: 'MANAGEMENT — YOU' })).toBeInTheDocument()
    expect(screen.getByText('Touch Typing')).toBeInTheDocument()
  })

  it('offers one first-use purchase and hands control back afterwards', () => {
    const p = getPermanent()
    setPermanent({
      ...p,
      meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_FOUNDER_BOARD.id] },
    })
    __setState({ cash: 1_000 })
    const complete = vi.fn()
    render(
      <FounderProfilePanel
        open
        guided
        onGuidedComplete={complete}
        onClose={() => {}}
      />,
    )

    expect(screen.getByText(/Buy one skill you can afford/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^\$400/ }))
    expect(complete).toHaveBeenCalledOnce()
  })
})
