import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))
import { Gallery } from './Gallery.tsx'
import { __resetStore, getPermanent } from '../game/store.ts'
import { setPermanent } from '../game/save.ts'
import { RECENT_KEEP, emptyHistory, recordRelease, type ReleaseRecord } from '../sim/history.ts'

afterEach(cleanup)

function record(ordinal: number, over: Partial<ReleaseRecord> = {}): ReleaseRecord {
  return {
    ordinal,
    run: 0,
    name: 'Flappy Square 1.0',
    rating: 50,
    payout: 50,
    buildSeconds: 120,
    labourSeconds: 120,
    seed: 1,
    ...over,
  }
}

function seed(history: ReturnType<typeof emptyHistory>) {
  setPermanent({ ...getPermanent(), meta: { ...getPermanent().meta, history } })
}

beforeEach(() => {
  __resetStore()
})

describe('§10.11 — the release gallery', () => {
  it('shows a recent release with its money and dev time', () => {
    seed(recordRelease(emptyHistory(), record(0)))
    const { container } = render(<Gallery open onClose={() => {}} />)

    expect(container.textContent).toContain('RECENT')
    expect(container.textContent).toContain('Flappy Square 1.0')
    expect(container.textContent).toContain('#1')
    expect(container.textContent).toContain('2m') // 120 simulated seconds
    expect(container.textContent).toContain('man-hours')
  })

  it('shows a cover for every row', () => {
    seed(recordRelease(recordRelease(emptyHistory(), record(0)), record(1, { name: 'Untitled Roguelike Deckbuilder' })))
    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.querySelectorAll('.cover').length).toBe(2)
  })

  it('folds overflow into a per-title aggregate with a count', () => {
    let h = emptyHistory()
    for (let i = 0; i < RECENT_KEEP + 2; i++) h = recordRelease(h, record(i, { name: 'Same' }))
    seed(h)

    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('BACK CATALOGUE')
    expect(container.textContent).toContain('×2 shipped')
    // The recent window is bounded even though two fell out of it.
    expect(container.querySelectorAll('.gallery__row').length).toBe(RECENT_KEEP + 1)
  })

  it('reads empty rather than apologising for itself', () => {
    seed(emptyHistory())
    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('Nothing shipped yet')
  })
})
