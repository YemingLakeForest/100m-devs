/**
 * §21.6a — the first hire enters through a person [added 2026-10-18].
 *
 * The claims, not the numbers: in Run 2 the HIRE control is not offered until
 * James's conversation; the conversation waits until the player has shipped
 * more than one game alone and can afford somebody; it ends with the control
 * live; and once had, it is had for the career.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore, __setState, currentUnlocks, dismissScene, getState, hireDeveloper, nextHireCost, tick,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { SCENE_FIRST_HIRE } from './scenes.ts'
import { FIRST_HIRE_AFTER_SHIPS, firstHireArrives } from './storyTriggers.ts'

function run2(milestones: string[] = []) {
  const p = emptyPermanent()
  setPermanent({ ...p, meta: { ...p.meta, paradigmShifts: 1, milestones: [...p.meta.milestones, ...milestones] } })
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§21.6a — the predicate', () => {
  const base = { paradigmShifts: 1, shipped: FIRST_HIRE_AFTER_SHIPS, devs: 1, cash: 100, hireCost: 30 }

  it('fires once the player has waited out more than one game and can pay', () => {
    expect(firstHireArrives(base)).toBe(true)
  })

  it('never fires in Run 1, whose only hire is the trap', () => {
    expect(firstHireArrives({ ...base, paradigmShifts: 0 })).toBe(false)
  })

  it('waits for the second game, and for the money', () => {
    expect(firstHireArrives({ ...base, shipped: FIRST_HIRE_AFTER_SHIPS - 1 })).toBe(false)
    expect(firstHireArrives({ ...base, cash: base.hireCost - 1 })).toBe(false)
  })

  it('does not fire for a studio that already has a floor of people', () => {
    expect(firstHireArrives({ ...base, devs: 12 })).toBe(false)
  })
})

describe('§21.6a — the door, in the store', () => {
  it('holds HIRE shut in Run 2 until James has said it, then opens it', () => {
    run2()
    __setState({ devs: 1, cash: 10_000, projectsShipped: 0 })
    expect(currentUnlocks().manualHire).toBe(false)
    expect(hireDeveloper()).toBe(false)

    __setState({ projectsShipped: FIRST_HIRE_AFTER_SHIPS })
    expect(getState().cash).toBeGreaterThanOrEqual(nextHireCost())
    tick(0.1)
    expect(getState().scene).toBe(SCENE_FIRST_HIRE.id)

    dismissScene()
    expect(currentUnlocks().manualHire).toBe(true)
    expect(hireDeveloper()).toBe(true)
  })

  it('is had for the career: a later run hires from its first frame', () => {
    run2([SCENE_FIRST_HIRE.id])
    __setState({ devs: 1, cash: 10_000, projectsShipped: 0 })
    expect(currentUnlocks().manualHire).toBe(true)
    expect(hireDeveloper()).toBe(true)
  })

  it('treats a studio that already has people as having found the control', () => {
    run2()
    __setState({ devs: 12, cash: 1e6 })
    expect(currentUnlocks().manualHire).toBe(true)
  })
})
