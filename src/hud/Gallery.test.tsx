import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))
import { Gallery } from './Gallery.tsx'
import { __resetStore, __setState, getPermanent } from '../game/store.ts'
import { setPermanent } from '../game/save.ts'
import { UNKNOWN_ORDINAL, rollShape } from '../sim/revenue.ts'
import { RECENT_KEEP, emptyHistory, recordRelease, type ReleaseRecord } from '../sim/history.ts'
import { BASELINE_RATING, revenueMultiplier } from '../sim/rating.ts'

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

/** A release still on sale, having paid part of what it is worth. */
function onSale(ordinal: number, payout: number, paid: number) {
  __setState({
    releases: [
      {
        id: ordinal,
        ordinal,
        name: 'Flappy Square 1.0',
        payout,
        age: 3,
        paid,
        shape: rollShape(1, ordinal),
        defectDensity: 0.02,
        rating: 50,
      },
    ],
  })
}

beforeEach(() => {
  __resetStore()
})

describe('§10.11 — the wall', () => {
  it('puts one cover on the wall per thing ever shipped', () => {
    seed(
      recordRelease(
        recordRelease(emptyHistory(), record(0)),
        record(1, { name: 'Untitled Roguelike Deckbuilder' }),
      ),
    )
    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.querySelectorAll('.gallery__slide')).toHaveLength(2)
    // Two per slide: the cover and its reflection. §10.11.3's tile is the
    // screen, so it is drawn twice and masked rather than faked with a shadow.
    expect(container.querySelectorAll('.cover')).toHaveLength(4)
  })

  it('opens on the newest release, because that is the one just shipped', () => {
    let h = emptyHistory()
    h = recordRelease(h, record(0, { name: 'Flappy Square 1.0' }))
    h = recordRelease(h, record(1, { name: 'Untitled Roguelike Deckbuilder' }))
    seed(h)

    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.querySelector('.gallery__now-title')?.textContent).toBe(
      'Untitled Roguelike Deckbuilder',
    )
    expect(container.querySelector('.gallery__count')?.textContent).toBe('1 / 2')
  })

  it('slides to another release when its cover is picked', () => {
    let h = emptyHistory()
    h = recordRelease(h, record(0, { name: 'Flappy Square 1.0' }))
    h = recordRelease(h, record(1, { name: 'Untitled Roguelike Deckbuilder' }))
    seed(h)

    const { container } = render(<Gallery open onClose={() => {}} />)
    const slides = container.querySelectorAll<HTMLButtonElement>('.gallery__slide')
    fireEvent.click(slides[1])

    expect(container.querySelector('.gallery__now-title')?.textContent).toBe('Flappy Square 1.0')
    expect(slides[1].getAttribute('data-focused')).toBe('true')
    expect(slides[0].getAttribute('data-focused')).toBe('false')
  })

  it('folds overflow into a per-title aggregate with a count', () => {
    let h = emptyHistory()
    for (let i = 0; i < RECENT_KEEP + 2; i++) h = recordRelease(h, record(i, { name: 'Same' }))
    seed(h)

    const { container } = render(<Gallery open onClose={() => {}} />)
    // The recent window is bounded even though two fell out of it, and the
    // folded title is one more cover on the wall rather than a second list.
    expect(container.querySelectorAll('.gallery__slide')).toHaveLength(RECENT_KEEP + 1)

    const slides = container.querySelectorAll<HTMLButtonElement>('.gallery__slide')
    fireEvent.click(slides[slides.length - 1])
    expect(container.textContent).toContain('×2 shipped')
  })

  it('reads empty rather than apologising for itself', () => {
    seed(emptyHistory())
    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('Nothing shipped yet')
    expect(container.querySelectorAll('.gallery__slide')).toHaveLength(0)
  })
})

describe('§10.11.1 — what a release is worth', () => {
  it('shows the build and the labour of the focused release', () => {
    seed(recordRelease(emptyHistory(), record(0)))
    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('#1')
    expect(container.textContent).toContain('2m') // 120 simulated seconds
    expect(container.textContent).toContain('man-hours')
  })

  /**
   * The correction this screen exists to make.
   *
   * §10.11.1 says "total handed over *so far*, and the live rate beside it".
   * The code had drifted to printing the ladder payout the instant a game
   * shipped — a launch announced as a completed sale.
   */
  it('shows what has arrived and never what is expected', () => {
    seed(recordRelease(emptyHistory(), record(0, { payout: 400 })))
    onSale(0, 400, 100)

    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('$100')
    expect(container.textContent).toContain('still earning')
    // The other $300 is a promise, and a promise is not a number this screen
    // is allowed to print.
    expect(container.textContent).not.toContain('$400')
    expect(container.textContent).not.toContain('to come')
  })

  it('reads RETIRED once the tail has been paid out', () => {
    // §4.10e retires a release after it has paid all but a rounding error, and
    // retirement pays the exact remainder — so a game the catalogue no longer
    // tracks has, by that invariant, been paid in full.
    seed(recordRelease(emptyHistory(), record(0, { payout: 400 })))
    __setState({ releases: [] })

    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('$400')
    expect(container.textContent).toContain('RETIRED')
    expect(container.textContent).not.toContain('still earning')
  })

  it('never joins a release that predates the ordinal to somebody else’s card', () => {
    /*
     * A save written before releases carried a career position restores them at
     * `UNKNOWN_ORDINAL`, and every one of them shares that value. Bucketing them
     * would subtract one game's outstanding tail from a different game's total —
     * so they are skipped, and the recorded payout stands.
     */
    seed(recordRelease(emptyHistory(), record(0, { payout: 400 })))
    __setState({
      releases: [
        {
          id: 9,
          ordinal: UNKNOWN_ORDINAL,
          name: 'Something Older',
          payout: 400,
          age: 3,
          paid: 100,
          shape: rollShape(1, 9),
          defectDensity: 0.02,
          rating: 50,
        },
      ],
    })

    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain('$400')
    expect(container.textContent).toContain('RETIRED')
  })
})

describe('§4.14 — the score, and what it did to the money', () => {
  it('prints the multiplier the rating put on the payout', () => {
    seed(recordRelease(emptyHistory(), record(0, { rating: 80 })))
    const { container } = render(<Gallery open onClose={() => {}} />)
    expect(container.textContent).toContain(`×${revenueMultiplier(80).toFixed(2)} ON REVENUE`)
  })

  it('marks a release above the baseline apart from one below it', () => {
    seed(recordRelease(emptyHistory(), record(0, { rating: BASELINE_RATING + 20 })))
    const { container, unmount } = render(<Gallery open onClose={() => {}} />)
    expect(container.querySelector('.gallery__score')?.getAttribute('data-band')).toBe('up')
    unmount()

    seed(recordRelease(emptyHistory(), record(1, { rating: BASELINE_RATING - 20 })))
    const poor = render(<Gallery open onClose={() => {}} />)
    expect(poor.container.querySelector('.gallery__score')?.getAttribute('data-band')).toBe('down')
  })

  it('breaks the score into the six things that made it', () => {
    seed(
      recordRelease(
        emptyHistory(),
        record(0, { rating: 70, heroCoverage: 0.5, sync: 0.8, traits: 0.4, luck: 0.7 }),
      ),
    )
    const { container } = render(<Gallery open onClose={() => {}} />)
    const parts = container.querySelectorAll('.gallery__part')
    expect(parts).toHaveLength(6)
    for (const label of ['DEFECTS', 'HEROES', 'TEAM SYNC', 'RECEPTION', 'CRAFT', 'TRAITS']) {
      expect(container.textContent).toContain(label)
    }
  })

  it('does not claim a breakdown for a folded title it never kept one for', () => {
    let h = emptyHistory()
    for (let i = 0; i < RECENT_KEEP + 2; i++) h = recordRelease(h, record(i, { name: 'Same' }))
    seed(h)

    const { container } = render(<Gallery open onClose={() => {}} />)
    const slides = container.querySelectorAll<HTMLButtonElement>('.gallery__slide')
    fireEvent.click(slides[slides.length - 1])
    expect(container.querySelectorAll('.gallery__part')).toHaveLength(0)
  })
})
