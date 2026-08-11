import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOUNDER_PROFILE_KEY } from '../game/founderProfile.ts'
import { FounderSetup } from './FounderSetup.tsx'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('first-start founder setup', () => {
  it('requires a name and returns the chosen head and body', () => {
    const complete = vi.fn()
    render(<FounderSetup onComplete={complete} />)

    const enter = screen.getByRole('button', { name: 'ENTER THE STUDIO' })
    expect(enter).toBeDisabled()

    fireEvent.change(screen.getByLabelText('YOUR NAME'), { target: { value: '  Ada   Lovelace ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hair shape WIDE' }))
    fireEvent.click(screen.getByRole('button', { name: 'MOUSTACHE' }))
    fireEvent.click(screen.getByRole('button', { name: 'Body shape JACKET' }))
    fireEvent.click(enter)

    expect(complete).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      head: 'wave',
      hairColour: 0,
      skin: 2,
      accessory: 'none',
      facialHair: 'moustache',
      body: 'jacket',
      bodyColour: 1,
    })
    expect(JSON.parse(localStorage.getItem(FOUNDER_PROFILE_KEY)!)).toEqual({
      name: 'Ada Lovelace',
      head: 'wave',
      hairColour: 0,
      skin: 2,
      accessory: 'none',
      facialHair: 'moustache',
      body: 'jacket',
      bodyColour: 1,
    })
  })

  it('offers independent dice for the name and full avatar', () => {
    render(<FounderSetup onComplete={() => {}} />)
    expect(screen.getByRole('button', { name: 'Randomise name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RANDOMISE LOOK' })).toBeInTheDocument()
  })
})
