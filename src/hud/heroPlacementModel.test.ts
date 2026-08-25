import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, heroById } from '../game/store.ts'
import { emptyPermanent, setPermanent } from '../game/save.ts'
import { SCENE_MELANY_ARRIVES, SCENE_MO_ARRIVES, SCENE_MATT_ARRIVES } from '../game/scenes.ts'
import { coverageLabel, coveragePercent, placementBenefit } from './heroPlacementModel.ts'

function arrived(...milestones: string[]) {
  const p = emptyPermanent()
  setPermanent({
    ...p,
    meta: { ...p.meta, paradigmShifts: 1, milestones },
  })
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('placement benefit copy follows the live hero fold', () => {
  it('shows Mo at full strength and at partial studio coverage', () => {
    arrived(SCENE_MO_ARRIVES.id)
    const mo = heroById('mo')!
    expect(placementBenefit(mo, 1)).toMatchObject({
      label: 'DEFECT RATE',
      value: '-39%',
      potential: '-39%',
    })
    expect(placementBenefit(mo, 8 / 40).value).toBe('-8%')
    expect(placementBenefit(mo, 0).value).toBe('OFF')
  })

  it('shows Melany capacity scaled by the studio share she covers', () => {
    arrived(SCENE_MELANY_ARRIVES.id)
    const melany = heroById('melany')!
    expect(placementBenefit(melany, 8 / 40).value).toBe('+9%')
    expect(placementBenefit(melany, 1).potential).toBe('+45%')
  })

  it('reports the Support exception instead of pretending it is share-scaled', () => {
    arrived(SCENE_MATT_ARRIVES.id)
    const matt = heroById('matt')!
    expect(placementBenefit(matt, 1 / 1000).value).toBe('+3')
    expect(placementBenefit(matt, 0).value).toBe('OFF')
  })
})

describe('coverage copy', () => {
  it('states the numerator, denominator and percentage explicitly', () => {
    expect(coverageLabel(8, 40)).toBe('8 / 40 DEVS')
    expect(coveragePercent(8, 40)).toBe(20)
  })
})
