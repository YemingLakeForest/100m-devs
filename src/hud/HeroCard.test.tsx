/**
 * §22.9's card, as the player meets it [rewritten 2026-09-26].
 *
 * The load-bearing assertion in this file is still the *negative* one: the hero
 * card and §7.8.8's dev card must not share a visual element. The rest pins
 * what the card became when placement went: who somebody is, what they are
 * doing for the studio right now, a door to their upgrades, and arrows to the
 * next person instead of a tray.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HeroCard } from './HeroCard.tsx'
import { __resetStore, heroById, selectHero } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_MATT_ARRIVES, SCENE_MO_ARRIVES, SCENE_SERENA_ARRIVES } from '../game/scenes.ts'
import type { HeroId } from '../sim/storyHeroes.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

/** The callbacks a test is not about, in one spread. */
const noop = {
  onClose: () => {},
  onUpgrades: () => {},
  onStep: () => {},
}

function staffed(id: HeroId = 'mo') {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [SCENE_MO_ARRIVES.id, SCENE_SERENA_ARRIVES.id, SCENE_MATT_ARRIVES.id],
    },
  })
  return heroById(id)!
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  cleanup()
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§22.9 — the card is a card, not a personnel record', () => {
  it('carries the pass furniture the dev card has none of', () => {
    const { container } = render(
      <HeroCard hero={staffed()} devs={40} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />,
    )
    // The lanyard punch is the only round thing on the card and is what makes
    // the object read as a pass rather than as a panel.
    expect(container.querySelector('.herocard__punch')).not.toBeNull()
    expect(container.querySelector('.herocard__gem')).not.toBeNull()
    expect(container.querySelector('.herocard__band')).not.toBeNull()
    // And none of §7.8.8's record: no stat bars, no live desk quote.
    expect(container.querySelector('.devcard__stat')).toBeNull()
    expect(container.querySelector('.devcard__quote')).toBeNull()
  })

  it('names the person and their speciality, and prints the trait as a sentence', () => {
    render(<HeroCard hero={staffed()} devs={40} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />)
    expect(screen.getByText('Mo')).toBeInTheDocument()
    expect(screen.getByText('QUALITY')).toBeInTheDocument()
    expect(screen.getByText('READS IT TWICE')).toBeInTheDocument()
    expect(screen.getByText('The studio writes half as many defects.')).toBeInTheDocument()
  })

  it('is closed when nobody is selected', () => {
    const { container } = render(
      <HeroCard hero={null} devs={40} canUpgrade={false} place={{ at: 0, of: 0 }} {...noop} />,
    )
    expect(container.querySelector('.herocard__pass')).toBeNull()
  })
})

describe('what they are doing for the studio, right now', () => {
  it('reads the live numbers off the headcount — the rota grows with the studio', () => {
    const { rerender } = render(
      <HeroCard hero={staffed('serena')} devs={100} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />,
    )
    // One in fifty of a hundred.
    expect(screen.getByText('ON CALL')).toBeInTheDocument()
    expect(screen.getByText('2 DEVS')).toBeInTheDocument()
    rerender(
      <HeroCard hero={staffed('serena')} devs={5_000} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />,
    )
    expect(screen.getByText('100 DEVS')).toBeInTheDocument()
  })

  it('says what Mo and Matt are doing in the fold’s own numbers', () => {
    render(<HeroCard hero={staffed('matt')} devs={200} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />)
    expect(screen.getByText('10 DEVS')).toBeInTheDocument()
    expect(screen.getByText('−20%')).toBeInTheDocument()
    cleanup()
    render(<HeroCard hero={staffed('mo')} devs={200} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />)
    expect(screen.getByText('−50%')).toBeInTheDocument()
  })

  it('has nothing left of placement on it', () => {
    render(<HeroCard hero={staffed()} devs={40} canUpgrade place={{ at: 1, of: 3 }} {...noop} />)
    for (const gone of [/BENCHED/, /PLACE HERO/, /RECALL/, /COVERAGE/, /REACH/, /SKILLS/, /SPEND/, /LV \d/]) {
      expect(screen.queryByText(gone)).toBeNull()
    }
  })
})

describe('the foot — the door to their upgrades, and the next person', () => {
  it('offers UPGRADES only when there is a tree to open, and opens it', () => {
    const onUpgrades = vi.fn()
    const { rerender } = render(
      <HeroCard hero={staffed()} devs={40} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />,
    )
    expect(screen.queryByRole('button', { name: 'UPGRADES' })).toBeNull()
    rerender(
      <HeroCard hero={staffed()} devs={40} canUpgrade place={{ at: 1, of: 1 }} {...noop} onUpgrades={onUpgrades} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'UPGRADES' }))
    expect(onUpgrades).toHaveBeenCalledTimes(1)
  })

  it('steps to the previous and next person instead of raising a tray', () => {
    const onStep = vi.fn()
    render(<HeroCard hero={staffed()} devs={40} canUpgrade={false} place={{ at: 2, of: 3 }} {...noop} onStep={onStep} />)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous person' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next person' }))
    expect(onStep.mock.calls).toEqual([[-1], [1]])
  })

  it('draws no arrows for one person alone', () => {
    render(<HeroCard hero={staffed()} devs={40} canUpgrade={false} place={{ at: 1, of: 1 }} {...noop} />)
    expect(screen.queryByRole('button', { name: 'Next person' })).toBeNull()
  })
})

describe('§7.8.13 rule 3 — the turn lands on the card, not the record', () => {
  it('refuses to open a card for somebody who has not arrived', () => {
    setPermanent(emptyPermanent())
    expect(selectHero('mo')).toBe(false)
    staffed()
    expect(selectHero('mo')).toBe(true)
  })
})
