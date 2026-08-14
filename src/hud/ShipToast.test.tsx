import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
// The Capacitor native-audio plugin cannot initialise under jsdom — see the
// same mock in Hud.test.tsx.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))
import { ShipToast } from './ShipToast.tsx'
import { __resetStore, __setState, getPermanent, getState } from '../game/store.ts'
import { setPermanent } from '../game/save.ts'
import { recordRelease } from '../sim/history.ts'

afterEach(cleanup)

beforeEach(() => {
  __resetStore()
})

function shipEvent(id: number, name: string, revenue: number) {
  __setState({ ship: { id, name, revenue, at: 0 } })
}

function seedHistory(name: string) {
  const p = getPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      history: recordRelease(p.meta.history, {
        ordinal: 0,
        run: 0,
        name,
        rating: 50,
        payout: 50,
        buildSeconds: 60,
        labourSeconds: 120,
        seed: 1,
      }),
    },
  })
}

describe('§10.8a / §10.11 — the ship celebration', () => {
  it('plays the launch flash and stamps the cover of the thing that shipped', () => {
    seedHistory('Flappy Square 1.0')
    shipEvent(1, 'Flappy Square 1.0', 50)
    const { container } = render(<ShipToast state={getState()} />)

    expect(container.querySelector('.ship-flash')).not.toBeNull()
    expect(container.querySelector('.ship-toast')).not.toBeNull()
    // The cover is read back from the history record written at ship, so the
    // tile here is the same one the gallery will render.
    expect(container.querySelector('.cover')).not.toBeNull()
    expect(container.textContent).toContain('SHIPPED')
    expect(container.textContent).toContain('Flappy Square 1.0')
  })

  it('still celebrates a ship that has no history record', () => {
    shipEvent(1, 'Flappy Square 1.0', 50)
    const { container } = render(<ShipToast state={getState()} />)

    expect(container.querySelector('.cover')).toBeNull()
    expect(container.querySelector('.ship-toast')).not.toBeNull()
    expect(container.textContent).toContain('SHIPPED')
  })
})
