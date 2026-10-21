/**
 * §22.9's card, as the player meets it [rewritten 2026-09-26].
 *
 * The load-bearing assertion in this file is still the *negative* one: the hero
 * card and §7.8.8's dev card must not share a visual element. The rest pins
 * what the card became when placement went: who somebody is, what they are
 * doing for the studio right now, their tree beside them, and arrows to the
 * next person instead of a tray.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HeroCard } from './HeroCard.tsx'
import { __resetStore, getState, heroById, selectHero } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_MATT_ARRIVES, SCENE_SERENA_ARRIVES } from '../game/scenes.ts'
import type { HeroId } from '../sim/storyHeroes.ts'
import { MATT_DESK_HEADS, MATT_ONCALL_HEADS } from '../sim/heroRoster.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

/** The callbacks a test is not about, in one spread. */
const noop = {
  onClose: () => {},
}

/** The store's state with a given headcount: the live rows read it. */
function at(devs: number) {
  return { ...getState(), devs }
}

function staffed(id: HeroId = 'serena') {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [SCENE_SERENA_ARRIVES.id, SCENE_MATT_ARRIVES.id],
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
      <HeroCard hero={staffed()} state={at(40)} tree={null} treesOpen={false} {...noop} />,
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
    render(<HeroCard hero={staffed()} state={at(40)} tree={null} treesOpen={false} {...noop} />)
    expect(screen.getByText('Serena')).toBeInTheDocument()
    expect(screen.getByText('RELIABILITY')).toBeInTheDocument()
    expect(screen.getByText('DEGRADED, NOT DOWN')).toBeInTheDocument()
    expect(screen.getByText('The build queue holds two more builds before it stops the floor.')).toBeInTheDocument()
  })

  it('is closed when nobody is selected', () => {
    const { container } = render(
      <HeroCard hero={null} state={at(40)} tree={null} treesOpen={false} {...noop} />,
    )
    expect(container.querySelector('.herocard__pass')).toBeNull()
  })
})

describe('what they are doing for the studio, right now', () => {
  it('reads the live numbers off the fold — and Matt’s rota is flat, whatever the headcount [2026-10-16]', () => {
    const { rerender } = render(
      <HeroCard hero={staffed('matt')} state={at(100)} tree={null} treesOpen={false} {...noop} />,
    )
    expect(screen.getByText('ON CALL')).toBeInTheDocument()
    expect(screen.getByText(`${MATT_ONCALL_HEADS} DEVS`)).toBeInTheDocument()
    rerender(
      <HeroCard hero={staffed('matt')} state={at(5_000)} tree={null} treesOpen={false} {...noop} />,
    )
    expect(screen.getByText(`${MATT_ONCALL_HEADS} DEVS`)).toBeInTheDocument()
  })

  it('says what Serena and Matt are doing in the fold’s own numbers', () => {
    render(<HeroCard hero={staffed('matt')} state={at(200)} tree={null} treesOpen={false} {...noop} />)
    expect(screen.getByText(`${MATT_DESK_HEADS} DEVS`)).toBeInTheDocument()
    expect(screen.getByText('−20%')).toBeInTheDocument()
    cleanup()
    render(<HeroCard hero={staffed('serena')} state={at(200)} tree={null} treesOpen={false} {...noop} />)
    expect(screen.getByText('+2 BUILDS')).toBeInTheDocument()
  })

  it('has nothing left of placement on it', () => {
    render(<HeroCard hero={staffed()} state={at(40)} tree="serena" treesOpen {...noop} />)
    for (const gone of [/BENCHED/, /PLACE HERO/, /RECALL/, /COVERAGE/, /REACH/, /SKILLS/, /SPEND/, /LV \d/]) {
      expect(screen.queryByText(gone)).toBeNull()
    }
  })
})

describe('the tree beside the pass, and the next person', () => {
  it('draws the tree on the screen once the trees are open, with no second window', () => {
    const { container, rerender } = render(
      <HeroCard hero={staffed()} state={at(40)} tree="serena" treesOpen={false} {...noop} />,
    )
    expect(container.querySelector('.trees-pane')).toBeNull()
    expect(screen.getByText('UPGRADES OPEN AFTER YOUR FIRST PARADIGM SHIFT')).toBeInTheDocument()
    rerender(<HeroCard hero={staffed()} state={at(40)} tree="serena" treesOpen {...noop} />)
    expect(container.querySelector('.trees-pane')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'UPGRADES' })).toBeNull()
  })

  it('says so for the people who have no tree', () => {
    const { container } = render(
      <HeroCard hero={staffed()} state={at(40)} tree={null} treesOpen {...noop} />,
    )
    expect(container.querySelector('.trees-pane')).toBeNull()
    expect(screen.getByText('SERENA HAS NO UPGRADE TREE YET')).toBeInTheDocument()
  })

  it('stands the person beside the pass', () => {
    const { container } = render(
      <HeroCard hero={staffed()} state={at(40)} tree={null} treesOpen={false} {...noop} />,
    )
    expect(container.querySelector('.herocard__portrait')).not.toBeNull()
  })

  it('names everybody in tabs, fills the open one, and opens the others', () => {
    // [2026-10-20] The tabs replaced the ← → pager: you can see who else is here.
    const matt = staffed('matt')
    const serena = staffed('serena')
    const onPick = vi.fn()
    render(<HeroCard hero={matt} state={at(40)} tree={null} treesOpen={false} people={[matt, serena]} counts={{ serena: 2 }} {...noop} onPick={onPick} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].className).toContain('is-chosen')
    expect(tabs[1].textContent).toContain('2')
    fireEvent.click(tabs[1])
    expect(onPick).toHaveBeenCalledWith('serena')
  })

  it('draws no tabs for one person alone', () => {
    render(<HeroCard hero={staffed()} state={at(40)} tree={null} treesOpen={false} {...noop} />)
    expect(screen.queryByRole('tab')).toBeNull()
  })
})

describe('§7.8.13 rule 3 — the turn lands on the card, not the record', () => {
  it('refuses to open a card for somebody who has not arrived', () => {
    setPermanent(emptyPermanent())
    expect(selectHero('serena')).toBe(false)
    staffed()
    expect(selectHero('serena')).toBe(true)
  })
})
