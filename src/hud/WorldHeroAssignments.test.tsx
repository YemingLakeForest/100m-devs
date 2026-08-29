import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  __resetStore,
  __setState,
  beginPosting,
  getState,
  heroById,
  heroRoster,
  placeHero,
  previewHeroAt,
} from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_BILLY_ARRIVES, SCENE_MO_ARRIVES } from '../game/scenes.ts'
import type { StageHandle } from '../render/stage.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { WorldHeroAssignments } from './WorldHeroAssignments.tsx'
import { assignmentCoversFocus, assignmentLabel } from './worldHeroAssignmentModel.ts'

function arrived() {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    // Billy is in the fixture because §21.7.6 makes him the placement verb —
    // `beginPosting` is refused without him (`game/unlocks.ts`).
    meta: {
      ...p.meta,
      paradigmShifts: 1,
      milestones: [SCENE_MO_ARRIVES.id, SCENE_BILLY_ARRIVES.id],
    },
  })
}

function stageAt(seat: number): StageHandle {
  return {
    nav: () => ({ seat }),
    heroAnchor: () => ({ x: 320, y: 120, context: false }),
  } as unknown as StageHandle
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

describe('scene hero assignments', () => {
  it('names desk, floor and building placements in the world vocabulary', () => {
    arrived()
    const mo = heroById('mo')!
    expect(assignmentLabel({ ...mo, placement: { rung: 0, index: 6, placedAt: 0 } })).toBe('DESK 7')
    expect(assignmentLabel({ ...mo, placement: { rung: 3, index: 1, placedAt: 0 } })).toBe('FLOOR 02')
    expect(assignmentLabel({ ...mo, placement: { rung: 4, index: 2, placedAt: 0 } })).toBe('BUILDING 03')
  })

  it('treats room Reach as a footprint rather than only the anchor desk', () => {
    arrived()
    const mo = {
      ...heroById('mo')!,
      placement: { rung: 0, index: 4, placedAt: 0 },
    } satisfies HeroRuntime
    expect(assignmentCoversFocus(mo, 4, 40)).toBe(true)
    expect(assignmentCoversFocus(mo, 11, 40)).toBe(true)
    expect(assignmentCoversFocus(mo, 12, 40)).toBe(false)
  })

  /**
   * §21.7.4 — **a desk plate, not a card** [amended 2026-08-29].
   *
   * The old assertions were `MO` / `ASSIGNED` / two `.world-hero-pin__face`
   * thumbnails, and every one of them was a fact about the thing that was
   * reported as clunky and immersion-breaking. What replaces them is the same
   * two questions asked of the object that replaced it: does it say who, and
   * does it say it in the world's vocabulary rather than the database's.
   */
  it('plates a placed hero with their name and the job on their card', () => {
    arrived()
    __setState({ devs: 40, runSeconds: 100 })
    placeHero('mo', 0, 0)
    __setState({ runSeconds: 109 })
    const state = getState()

    const { container } = render(
      <WorldHeroAssignments
        stage={stageAt(0)}
        state={state}
        roster={heroRoster(state)}
      />,
    )

    expect(screen.getByText('MO')).toBeInTheDocument()
    // §22.9.2's role line, which is a thing an office prints on a desk.
    expect(screen.getByText('QUALITY ASSURANCE')).toBeInTheDocument()
    // And not the machine's word for a row in a table.
    expect(screen.queryByText('ASSIGNED')).not.toBeInTheDocument()
    // The portrait is gone: the person it depicted is drawn on the floor a few
    // pixels below it, which is what made it interface standing on the set.
    expect(container.querySelectorAll('.world-hero-pin__face')).toHaveLength(0)
    // A placed plate stays a name plate. Numbers belong to the preview.
    expect(screen.queryByText(/DEVS/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Mo assigned to DESK 1')).toBeInTheDocument()
  })

  /**
   * The candidate plate is where `PostingBanner`'s three retired lines went.
   *
   * This is the assertion that makes the strip's collapse safe: the coverage and
   * the effect have to be readable *somewhere* while aiming, and the whole
   * argument for taking them off the HUD is that this is a better somewhere.
   */
  it('keeps the committed plate and answers the aimed one with the numbers', () => {
    arrived()
    __setState({ devs: 40, runSeconds: 100 })
    placeHero('mo', 0, 0)
    beginPosting('mo')
    previewHeroAt({ rung: 0, index: 20 })
    const state = getState()

    render(
      <WorldHeroAssignments stage={stageAt(0)} state={state} roster={heroRoster(state)} />,
    )

    expect(screen.getByLabelText('Mo assigned to DESK 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Mo preview at DESK 21')).toBeInTheDocument()
    expect(screen.getAllByText('MO')).toHaveLength(2)
    // The reading the strip gave up, at the anchor the finger is on.
    expect(screen.getByText(/DEVS/)).toBeInTheDocument()
    expect(screen.getByText(/DEFECT RATE/)).toBeInTheDocument()
  })
})
