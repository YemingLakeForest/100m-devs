import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  __resetStore,
  __setState,
  getState,
  heroById,
  heroRoster,
  placeHero,
} from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_MO_ARRIVES } from '../game/scenes.ts'
import type { StageHandle } from '../render/stage.ts'
import type { HeroRuntime } from '../sim/heroRoster.ts'
import { WorldHeroAssignments } from './WorldHeroAssignments.tsx'
import { assignmentCoversFocus, assignmentLabel } from './worldHeroAssignmentModel.ts'

function arrived() {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: { ...p.meta, paradigmShifts: 1, milestones: [SCENE_MO_ARRIVES.id] },
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

  it('pins a compact hero identity pass onto the assigned scene target', () => {
    arrived()
    __setState({ devs: 40, runSeconds: 100 })
    placeHero('mo', 0, 0)
    __setState({ runSeconds: 109 })
    const state = getState()

    render(
      <WorldHeroAssignments
        stage={stageAt(0)}
        state={state}
        roster={heroRoster(state)}
      />,
    )

    expect(screen.getByText('MO')).toBeInTheDocument()
    expect(screen.getByText('ASSIGNED')).toBeInTheDocument()
    expect(screen.getByLabelText('Mo assigned to DESK 1')).toBeInTheDocument()
    expect(screen.queryByText(/DEVS/)).not.toBeInTheDocument()
  })
})
