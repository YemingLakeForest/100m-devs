import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, getState } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import ScenarioBar from './ScenarioBar.tsx'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('the scenario batch dial', () => {
  it('selects an order of magnitude and adds it through the scenario hire path', () => {
    render(<ScenarioBar stage={null} />)

    const dial = screen.getByRole('slider', { name: 'Developer batch size' })
    fireEvent.input(dial, { target: { value: '3' } })

    expect(dial).toHaveAttribute('aria-valuetext', '1,000 developers')
    expect(screen.getByText('+1K')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add 1,000 developers' }))

    expect(getState().devs).toBe(1_000)
    expect(getState().spawn?.from).toBe(0)
    expect(getState().spawn?.to).toBe(1_000)
    expect(screen.getByText('added 1,000 developers')).toBeInTheDocument()
  })

  it('uses singular language at the first stop', () => {
    render(<ScenarioBar stage={null} />)

    expect(screen.getByRole('button', { name: 'Add 1 developer' })).toBeInTheDocument()
  })
})
