import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore } from '../game/store.ts'
import { writeFounderProfile } from '../game/founderProfile.ts'
import type { StageHandle } from '../render/stage.ts'
import { FounderDesk, FounderProfilePanel } from './Founder.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

beforeEach(() => {
  localStorage.clear()
  __resetStore()
})
afterEach(cleanup)

describe('manager corner', () => {
  it('routes the CODE button through the stage coding action', () => {
    writeFounderProfile({ name: 'Ada', head: 'coil', body: 'jacket' })
    const codeFounder = vi.fn(() => 1)
    const stage = { codeFounder } as unknown as StageHandle

    render(<FounderDesk stage={stage} />)
    expect(screen.getByText('ADA')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'CODE — YOU' }))

    expect(codeFounder).toHaveBeenCalledOnce()
  })

  it('opens a personal screen with the saved avatar and Management tree', () => {
    writeFounderProfile({ name: 'Ada', head: 'phones', body: 'knit' })
    render(<FounderProfilePanel open onClose={() => {}} />)

    expect(screen.getByRole('heading', { name: 'ADA' })).toBeInTheDocument()
    expect(screen.getByLabelText('Your block avatar')).toHaveAttribute('data-head', 'phones')
    expect(screen.getByRole('heading', { name: 'MANAGEMENT — YOU' })).toBeInTheDocument()
    expect(screen.getByText('Touch Typing')).toBeInTheDocument()
  })
})
