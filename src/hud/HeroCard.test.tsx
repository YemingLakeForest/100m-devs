/**
 * §22.9's card and §13.9's board, as the player meets them.
 *
 * The load-bearing assertion in this file is the *negative* one: the hero card
 * and §7.8.8's dev card must not share a visual element, because if a hero is a
 * personnel record with better numbers then §13's whole command layer is a stat.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HeroCard } from './HeroCard.tsx'
import { HeroTree } from './HeroTree.tsx'
import { __resetStore, heroById, placeHero, selectHero } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_HERO_BOARD, SCENE_MO_ARRIVES } from '../game/scenes.ts'
import { xpToReach } from '../sim/heroXp.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn(), playPurchase: vi.fn() }))
vi.mock('../audio/sfx.ts', () => ({ playSfx: vi.fn() }))

/**
 * The three callbacks a test is not about, in one spread.
 *
 * `onClose` stays written out at every call site because a few of these tests
 * *are* about it; these three are §13.8's placement verbs and §13.9's board
 * door, and a file about what the card looks like has nothing to say about
 * where any of them go.
 */
const noop = {
  onOpenTree: () => {},
  onPost: () => {},
  onRecall: () => {},
}

function staffed(level = 1, nodes?: string[]) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      // §21.7.7 — the board has been introduced. This file is about what the
      // card and the board *look like* and how a purchase lands, not about the
      // gate, which `unlocks.test.ts` owns; a fixture that had never met the
      // board would be testing the gate in nine places by accident.
      milestones: [SCENE_MO_ARRIVES.id, SCENE_HERO_BOARD.id],
      heroXp: { mo: xpToReach(level) },
      heroNodes: nodes ? { mo: nodes } : {},
    },
  })
  return heroById('mo')!
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
    const mo = staffed()
    const { container } = render(
      <HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
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

  it('names the person, the level and the branch', () => {
    const mo = staffed(14)
    render(<HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />)
    expect(screen.getByText('Mo')).toBeInTheDocument()
    expect(screen.getByText(/LV 14/)).toBeInTheDocument()
    expect(screen.getByText('QUALITY')).toBeInTheDocument()
  })

  it('prints the trait as a sentence — the only thing on the card that is one', () => {
    const mo = staffed()
    render(<HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />)
    expect(screen.getByText('READS IT TWICE')).toBeInTheDocument()
    expect(screen.getByText(/generates half as many defects before release/)).toBeInTheDocument()
  })

  it('marks BENCHED so §13.10’s cost is visible — §13.11.2', () => {
    const mo = staffed()
    const { container } = render(
      <HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(container.querySelector('dd[data-benched="true"]')).not.toBeNull()

    cleanup()
    const placed = render(
      <HeroCard hero={mo} placedLabel="FLOOR 3" {...noop} onClose={() => {}} />,
    )
    expect(placed.container.querySelector('dd[data-benched="true"]')).toBeNull()
  })

  it('says how many points are waiting, on the button that spends them', () => {
    render(
      <HeroCard hero={staffed(4)} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /SPEND 4/ })).toBeInTheDocument()
  })

  it('is closed when nobody is selected', () => {
    const { container } = render(
      <HeroCard hero={null} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(container.querySelector('.herocard__pass')).toBeNull()
  })
})

describe('§13.9 — every hero opens the same board, from where they already are', () => {
  function board(hero: HeroRuntime) {
    return render(<HeroTree hero={hero} open onClose={() => {}} />)
  }

  it('draws the whole board, including the branches this hero has never touched', () => {
    const { container } = board(staffed())
    // 1 trunk + 5 branches x 6 nodes.
    expect(container.querySelectorAll('.herotree__node')).toHaveLength(31)
  })

  it('shows §11.4.2’s three states rather than two', () => {
    const { container } = board(staffed(9))
    const states = new Set(
      [...container.querySelectorAll('.herotree__node')].map((n) => n.getAttribute('data-state')),
    )
    expect(states.has('owned')).toBe(true)
    expect(states.has('live')).toBe(true)
    expect(states.has('dark')).toBe(true)
  })

  it('draws a connector for every node, dark ones included', () => {
    const { container } = board(staffed())
    expect(container.querySelectorAll('.herotree__links polyline')).toHaveLength(30)
  })

  /**
   * §11.4.3 — **tapping a node opens it; it does not buy it.** A purchase that
   * fires on the same tap that first shows the price is how a player buys the
   * wrong thing on a phone, once, and stops trusting the screen.
   */
  it('opens a guide layer on tap and spends nothing', () => {
    const mo = staffed(4)
    const { container } = board(mo)
    fireEvent.click(screen.getByLabelText('Cloud depth 1'))
    expect(container.querySelector('.herotree__guide')).not.toBeNull()
    expect(heroById('mo')!.points).toBe(4)
    expect(screen.getByRole('button', { name: /1 POINT/ })).toBeInTheDocument()
  })

  it('buys on the guide’s one button, and the board grows', () => {
    const mo = staffed(4)
    board(mo)
    fireEvent.click(screen.getByLabelText('Cloud depth 1'))
    fireEvent.click(screen.getByRole('button', { name: /1 POINT/ }))
    expect(heroById('mo')!.nodes).toContain('cloud:1')
    expect(heroById('mo')!.points).toBe(3)
  })

  /**
   * §13.9.1 — "nothing stops Mo going down Cloud. She will be worse at it than
   * Melany." Said at the moment the decision is made rather than in a rule
   * nobody reads, and it never refuses the purchase.
   */
  it('warns that an off-branch node is worth less, and sells it anyway', () => {
    board(staffed(4))
    fireEvent.click(screen.getByLabelText('Cloud depth 1'))
    expect(screen.getByText(/Not Mo’s branch — worth 50% here/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1 POINT/ })).not.toBeDisabled()
  })

  it('says nothing of the sort about her own branch', () => {
    board(staffed(9))
    fireEvent.click(screen.getByLabelText('Quality reach 4'))
    expect(screen.queryByText(/worth 50% here/)).toBeNull()
  })

  it('prices REACH above DEPTH, so §13.6.4’s invariant is on the button', () => {
    board(staffed(9))
    fireEvent.click(screen.getByLabelText('Quality reach 4'))
    expect(screen.getByRole('button', { name: /3 POINTS/ })).toBeInTheDocument()
  })
})

/**
 * §21.7.7 — **the card is not gated and the board is.**
 *
 * A card is who somebody is; the board is an instrument, and until §13.13's
 * first earned level it is a screen of purchases attached to a person the
 * player has never placed. The point pips go with it, because a point is an
 * affordance for a board rather than a fact about a person.
 */
describe('§21.7.7 — the board arrives with a scene, and the card does not wait for it', () => {
  /** The same fixture, minus the board introduction. */
  function unintroduced(level = 4) {
    const p = emptyPermanent()
    setPermanent({
      ...p,
      meta: {
        ...p.meta,
        paradigmShifts: 1,
        milestones: [SCENE_MO_ARRIVES.id],
        heroXp: { mo: xpToReach(level) },
      },
    })
    return heroById('mo')!
  }

  it('still draws the whole card', () => {
    const mo = unintroduced()
    const { container } = render(
      <HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(screen.getByText('Mo')).toBeInTheDocument()
    expect(screen.getByText(/LV 4/)).toBeInTheDocument()
    expect(container.querySelector('.herocard__punch')).not.toBeNull()
  })

  it('draws no door to the board, and no points to spend on it', () => {
    const mo = unintroduced()
    const { container } = render(
      <HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: /SPEND|SKILLS/ })).toBeNull()
    expect(container.querySelector('.herocard__points')).toBeNull()
    // CLOSE is still there — the card is reachable and leavable as always.
    expect(screen.getByRole('button', { name: 'CLOSE' })).toBeInTheDocument()
  })

  it('draws both once the scene has played', () => {
    const mo = staffed(4)
    const { container } = render(
      <HeroCard hero={mo} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /SPEND 4/ })).toBeInTheDocument()
    expect(container.querySelector('.herocard__points')).not.toBeNull()
  })
})

describe('§13.8 — the card is where a hero is put somewhere', () => {
  it('offers an explicit placement action, then direct MOVE and RECALL actions', () => {
    const mo = staffed()
    const posted = vi.fn()
    render(
      <HeroCard
        hero={mo}
        placedLabel="BENCHED"
        onOpenTree={() => {}}
        onPost={posted}
        onRecall={() => {}}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'PLACE HERO' }))
    expect(posted).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'RECALL' })).toBeNull()

    cleanup()
    placeHero('mo', 0, 0)
    const recalled = vi.fn()
    const moved = vi.fn()
    render(
      <HeroCard
        hero={heroById('mo')!}
        placedLabel="DEVELOPER 1"
        onOpenTree={() => {}}
        onPost={moved}
        onRecall={recalled}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'MOVE HERO' }))
    expect(moved).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'RECALL' }))
    expect(recalled).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'PLACE HERO' })).toBeNull()
  })

  it('states the live coverage, effect and XP share instead of only maximum reach', () => {
    staffed()
    placeHero('mo', 0, 0)
    render(
      <HeroCard
        hero={heroById('mo')!}
        placedLabel="DEVELOPER 1"
        coverage={{ covered: 8, fraction: 1, complete: true, settling: false }}
        targetCovered={8}
        totalDevs={40}
        now={100}
        {...noop}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText(/8 \/ 40 DEVS/)).toBeInTheDocument()
    expect(screen.getByText('-8% DEFECT RATE')).toBeInTheDocument()
    expect(screen.getByText(/HERO XP SHARE 20%/)).toBeInTheDocument()
  })

  /*
   * §21.7.7 gates the *board*, not the card. A hero who has arrived can be put
   * on the floor from the moment they arrive — the floor is the board — so this
   * is the one action on the card that never waits for a scene.
   */
  it('offers it before the skills board has been handed over', () => {
    const p = emptyPermanent()
    setPermanent({
      ...p,
      meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_MO_ARRIVES.id] },
    })
    render(
      <HeroCard hero={heroById('mo')!} placedLabel="BENCHED" {...noop} onClose={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'PLACE HERO' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /SPEND|SKILLS/ })).toBeNull()
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
