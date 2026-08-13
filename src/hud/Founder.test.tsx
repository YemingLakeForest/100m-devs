import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore } from '../game/store.ts'
import { writeFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
import { FounderDesk, FounderProfilePanel } from './Founder.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playKeyboardClick: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  __resetStore()
})
afterEach(cleanup)

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

  it('opens a personal screen with the saved avatar and Management tree', () => {
    writeFounderProfile({
      name: 'Ada', head: 'buzz', hairColour: 2, skin: 3,
      accessory: 'headphones', facialHair: 'goatee', body: 'knit', bodyColour: 3,
    })
    render(<FounderProfilePanel open onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: 'ADA' })).toBeInTheDocument()
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-head', 'buzz')
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-accessory', 'headphones')
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-facial-hair', 'goatee')
    expect(screen.getByRole('heading', { name: 'MANAGEMENT — YOU' })).toBeInTheDocument()
    expect(screen.getByText('Touch Typing')).toBeInTheDocument()
  })
})
