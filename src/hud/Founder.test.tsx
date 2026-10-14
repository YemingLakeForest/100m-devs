import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore, __setState } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { writeFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
import { FounderDesk, FounderProfilePanel } from './Founder.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playKeyboardClick: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  __resetStore()
  setPermanent(emptyPermanent())
})
afterEach(() => {
  cleanup()
  setPermanent(emptyPermanent())
  vi.useRealTimers()
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

    // §10.6a — who this is, in the window's title bar rather than in a masthead.
    expect(screen.getByRole('heading', { name: 'PERSONNEL // ADA' })).toBeInTheDocument()
    // The same pass the heroes wear (heroes.css), with the person's face on it.
    expect(document.querySelector('.herocard__pass')).not.toBeNull()
    expect(screen.getByText('FOUNDER')).toBeInTheDocument()
  })

  /**
   * [2026-10-13] — your tree is on your own screen, not behind an UPGRADES door:
   * there is no second window, and before the first Paradigm Shift the tree's
   * place says so.
   */
  it('has no UPGRADES door, and says when the tree is not open yet', () => {
    render(<FounderProfilePanel open onClose={() => {}} />)
    expect(screen.queryByText('Touch Typing')).toBeNull()
    expect(screen.queryByRole('button', { name: 'UPGRADES' })).toBeNull()
    expect(screen.getByText('UPGRADES OPEN AFTER YOUR FIRST PARADIGM SHIFT')).toBeInTheDocument()
  })
})
