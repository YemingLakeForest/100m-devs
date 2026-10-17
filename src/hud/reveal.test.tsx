/**
 * §21.7.6b [amended 2026-10-16, plan phase 4.4] — three readouts that were on
 * screen from Run 2's first frame now arrive with the person whose problem they
 * name, or with the problem itself. The claim pinned is who opens each one.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../ui/uiSfx.ts', () => ({ playUi: vi.fn() }))

import { __resetStore, __setState, getState, type ShelvedBuild } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_BILLY_ARRIVES, SCENE_SERENA_ARRIVES } from '../game/scenes.ts'
import { PipelineStrip } from './PipelineStrip.tsx'
import { Speedometer } from './Readouts.tsx'

beforeEach(() => __resetStore())
afterEach(() => {
  cleanup()
  __resetStore()
})

function runTwo(milestones: string[]) {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones } })
}

const strip = () => render(<PipelineStrip state={getState()} onOpen={() => {}} />).container

describe('the queue ETA', () => {
  it('is on screen all of Run 1', () => {
    __setState({ devs: 1 })
    expect(strip().querySelector('.qgauge__eta')).not.toBeNull()
  })

  it('waits in Run 2 for Serena, or for the queue to tighten', () => {
    runTwo([])
    __setState({ devs: 1 })
    expect(strip().querySelector('.qgauge__eta')).toBeNull()
    cleanup()
    runTwo([SCENE_SERENA_ARRIVES.id])
    expect(strip().querySelector('.qgauge__eta')).not.toBeNull()
  })

  it('shows on a full queue before Serena — a wall is never unannounced', () => {
    runTwo([])
    const b = { id: 1, name: 'B', size: 1 } as unknown as ShelvedBuild
    __setState({ devs: 1, shelf: [b, { ...b, id: 2 }, { ...b, id: 3 }] })
    expect(strip().querySelector('.qgauge__eta')).not.toBeNull()
  })
})

describe('the speedometer’s name', () => {
  it('reads plain SYNC until Billy arrives, and escalates after', () => {
    runTwo([])
    const plain = render(<Speedometer entropy={0.9} labelled={false} />).container
    expect(plain.querySelector('.hud__label')!.textContent).toBe('SYNC')
    cleanup()
    runTwo([SCENE_BILLY_ARRIVES.id])
    const named = render(<Speedometer entropy={0.9} labelled />).container
    expect(named.querySelector('.hud__label')!.textContent).not.toBe('SYNC')
  })
})
