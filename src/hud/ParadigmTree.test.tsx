/**
 * §13.12.4 — the prestige screen says what you are saving for.
 *
 * The tree itself is covered by `prestige.test.ts`; this file is about the two
 * readouts that turn a wallet and a price list into a reason to play one more
 * run. They are a **screen** feature rather than a maths one — the numbers were
 * always computable and the player was always the one computing them — so the
 * assertions here are about what is on the screen and in what words.
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore, __setState, getState } from '../game/store.ts'
import { emptyPermanent, getPermanent, setPermanent } from '../game/save.ts'
import { ParadigmTree } from './ParadigmTree.tsx'

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

/** A wallet, with the tree otherwise untouched. */
function withBp(bp: number): void {
  const p = getPermanent()
  setPermanent({ ...p, layer1: { ...p.layer1, bp } })
}

describe('what you are saving for', () => {
  it('names the cheapest thing out of reach and how far off it is', () => {
    // Async-First is 10 BP on a fresh tree, so four points in the wallet is six
    // short of the first thing the player could want.
    withBp(4)
    render(<ParadigmTree open state={getState()} onClose={() => {}} />)

    // The node's own card carries the name too, so the readout is identified by
    // its container rather than by a name query that would match both.
    const next = document.querySelector('.paradigm__next')!
    expect(next.textContent).toContain('Async-First Culture')
    expect(screen.getByText('6 BP SHORT')).toBeInTheDocument()
  })

  it('says nothing once something is affordable', () => {
    // A line reading "0 SHORT" is a screen shouting at somebody who has already
    // won, and the board draws affordable nodes lit without help.
    withBp(10)
    render(<ParadigmTree open state={getState()} onClose={() => {}} />)

    expect(screen.queryByText(/SHORT/)).not.toBeInTheDocument()
  })

  it('keeps the shortfall as one string, so it can be read as one', () => {
    // Trap 31, applied to a readout rather than a button: JSX whitespace between
    // two expressions is not part of the text node, so `{n} BP SHORT` written as
    // three children would be unfindable as the phrase a player sees.
    withBp(1)
    render(<ParadigmTree open state={getState()} onClose={() => {}} />)

    const el = screen.getByText('9 BP SHORT')
    expect(el.textContent).toBe('9 BP SHORT')
  })
})

describe('what taking the shift actually buys', () => {
  /**
   * The offer only renders once §13.1 says a shift is available, and the quote
   * is computed from the run. Both readouts below are about the wallet **after**
   * the shift, which is the wallet the decision is about.
   */
  function offerableRun(): void {
    // §13.1's offer is gated on having prestiged at least once — before that the
    // only way in is Act V's bankruptcy modal — and on not being *in* that
    // bankruptcy. Both are set here rather than assumed, because a test that
    // renders nothing passes every `queryBy` it makes.
    const p = getPermanent()
    setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1 } })
    __setState({ devs: 120, peakDevs: 1200, lifetimeRevenue: 5e9, projectsShipped: 8 })
    expect(getState().phase).not.toBe('bankrupt')
  }

  it('names what the run still will not reach', () => {
    offerableRun()
    render(<ParadigmTree open state={getState()} onClose={() => {}} />)

    const reach = screen.queryByText(/STILL \d+ SHORT OF|THAT BUYS/)
    expect(reach).toBeInTheDocument()
  })

  it('finishes the sentence when the shift crosses the line', () => {
    // A run worth enough to buy the cheapest node says so by name, rather than
    // leaving the player to subtract the quote from the price list themselves.
    offerableRun()
    render(<ParadigmTree open state={getState()} onClose={() => {}} />)

    expect(screen.getByText(/THAT BUYS ASYNC-FIRST CULTURE/)).toBeInTheDocument()
  })

  it('reads the wallet as it would be after the shift, not as it is now', () => {
    // The bug this pins: computing against the *current* wallet would make the
    // line describe the present, which the player can already see, instead of
    // the decision they are being asked to make. A zero wallet plus a run worth
    // more than the cheapest node has to read as reachable.
    setPermanent({ ...getPermanent(), layer1: { ...getPermanent().layer1, bp: 0 } })
    offerableRun()
    render(<ParadigmTree open state={getState()} onClose={() => {}} />)

    expect(screen.queryByText(/THAT BUYS/)).toBeInTheDocument()
  })
})
