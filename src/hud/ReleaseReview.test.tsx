import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
// The Capacitor native-audio plugin cannot initialise under jsdom — see the
// same mock in Hud.test.tsx.
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn(), BLIP_SFX: ['blip-0', 'blip-1', 'blip-2', 'blip-3', 'blip-4'] }))
import { playSfx } from '../audio/sfx.ts'
import { GLIDING_SFX } from '../audio/glides.ts'
import { ReleaseReview } from './ReleaseReview.tsx'
import { __resetStore, __setState, getState } from '../game/store.ts'
import { recordRelease } from '../sim/history.ts'
import { reviewsFor, verdictFor } from '../sim/reviews.ts'

afterEach(cleanup)

beforeEach(() => {
  __resetStore()
})

function shipEvent(id: number, name: string, rating: number, timingLabel: string | null = null) {
  __setState({
    ship: { id, name, revenue: 4_200, at: 0, rating, ordinal: 0, timing: 1, timingLabel, stage: null },
  })
}

/** §10.11 — the catalogue is run state, so this seeds the run. */
function seedHistory(name: string, rating = 50) {
  __setState({
    history: recordRelease(getState().history, {
      ordinal: 0,
      run: 0,
      name,
      rating,
      payout: 50,
      buildSeconds: 60,
      labourSeconds: 120,
      seed: 1,
    }),
  })
}

describe('§10.8b — the review reel', () => {
  it('plays the launch flash and stamps the cover of the thing that shipped', () => {
    seedHistory('Flappy Square 1.0')
    shipEvent(1, 'Flappy Square 1.0', 50)
    const { container } = render(<ReleaseReview state={getState()} />)

    expect(container.querySelector('.ship-flash')).not.toBeNull()
    expect(container.querySelector('.review')).not.toBeNull()
    // The cover is read back from the history record written at ship, so the
    // tile here is the same one the gallery will render.
    expect(container.querySelector('.cover')).not.toBeNull()
    expect(container.textContent).toContain('Flappy Square 1.0')
  })

  /**
   * The whole point of the amendment. §10.8a's fourth beat was a large green
   * revenue figure and the user's instruction was that a release must not show
   * one; a test that only checked what *is* there would let it come back.
   */
  it('never prints what the release was worth', () => {
    seedHistory('Flappy Square 1.0')
    shipEvent(1, 'Flappy Square 1.0', 50)
    const { container } = render(<ReleaseReview state={getState()} />)

    expect(container.textContent).not.toContain('$')
    expect(container.textContent).not.toContain('4,200')
    expect(container.querySelector('.ship-toast__cash')).toBeNull()
  })

  it('reads out three critics and the aggregate §4.14 already decided', () => {
    seedHistory('Flappy Square 1.0', 88)
    shipEvent(1, 'Flappy Square 1.0', 88)
    const { container } = render(<ReleaseReview state={getState()} />)

    expect(container.querySelectorAll('.review__quote')).toHaveLength(3)
    for (const r of reviewsFor(1, 0, 88)) {
      expect(container.textContent).toContain(r.outlet)
    }
    // The word is the rating's, so the reel cannot disagree with the gallery.
    expect(container.textContent).toContain(verdictFor(88))
  })

  it('throws sparks for a good release and none for a bad one', () => {
    seedHistory('Flappy Square 1.0', 90)
    shipEvent(1, 'Flappy Square 1.0', 90)
    const good = render(<ReleaseReview state={getState()} />)
    expect(good.container.querySelectorAll('.review__spark').length).toBeGreaterThan(0)
    cleanup()

    __resetStore()
    seedHistory('Flappy Square 1.0', 8)
    shipEvent(2, 'Flappy Square 1.0', 8)
    const bad = render(<ReleaseReview state={getState()} />)
    expect(bad.container.querySelectorAll('.review__spark')).toHaveLength(0)
  })

  it('reports the launch date back only when the player picked one', () => {
    seedHistory('Flappy Square 1.0')
    shipEvent(1, 'Flappy Square 1.0', 50, 'PERFECT WINDOW')
    const picked = render(<ReleaseReview state={getState()} />)
    expect(picked.container.textContent).toContain('PERFECT WINDOW')
    cleanup()

    // A release that went out on §10.8b's train had no bar to miss, so the reel
    // says nothing about a decision the player was never offered.
    __resetStore()
    seedHistory('Flappy Square 1.0')
    shipEvent(2, 'Flappy Square 1.0', 50, null)
    const train = render(<ReleaseReview state={getState()} />)
    expect(train.container.querySelector('.review__timing')).toBeNull()
  })

  it('plays the whole reel on sounds that hold their pitch: nothing rises or falls, at the open or at the verdict (2026-10-15)', () => {
    // The user, three times: *"the siuuuu"*. The verdict was `entropy-lock`, a descending power-down whine, and it played
    // here as well as at the ring: one siuuu per screen of the release. Run the reel to its end and hear what it played.
    vi.useFakeTimers()
    try {
      seedHistory('Flappy Square 1.0', 90)
      shipEvent(1, 'Flappy Square 1.0', 90, 'PERFECT WINDOW')
      vi.mocked(playSfx).mockClear()
      render(<ReleaseReview state={getState()} />)
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      const heard = vi.mocked(playSfx).mock.calls.map(([id]) => id as string)
      // A stamp as it opens, three critics, a stamp on the total: five sounds, and none of them a glide.
      expect(heard.length).toBeGreaterThanOrEqual(5)
      for (const id of heard) expect(GLIDING_SFX as readonly string[]).not.toContain(id)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still celebrates a ship that has no history record', () => {
    shipEvent(1, 'Flappy Square 1.0', 50)
    const { container } = render(<ReleaseReview state={getState()} />)

    expect(container.querySelector('.cover')).toBeNull()
    expect(container.querySelector('.review')).not.toBeNull()
    expect(container.textContent).toContain('Flappy Square 1.0')
  })
})
