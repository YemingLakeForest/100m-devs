/**
 * The scenario loader — GDD §26.2's instrument.
 *
 * Two of these tests are the reason the module exists at all. Anybody can set
 * `devs`; `?devs` already did. What a scenario has to guarantee is that after
 * loading it you can actually *look* at the studio — that the tick is running
 * and nothing is hanging a scrim over the viewport, and that the money outlasts
 * §4.10d's payroll for longer than it takes to read the screen.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SCENARIOS, applyScenario, scenarioById, scenarioRung } from './scenarios.ts'
import { __resetStore, __setState, getState, tick } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { rungFor } from '../sim/headcount.ts'

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('the list is a ladder', () => {
  it('climbs by decades and never repeats an id', () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (let i = 1; i < SCENARIOS.length; i++) {
      expect(SCENARIOS[i].devs).toBe(SCENARIOS[i - 1].devs * 10)
    }
  })

  it('starts at one developer and stops at §13.5’s gate', () => {
    expect(SCENARIOS[0].devs).toBe(1)
    expect(SCENARIOS[SCENARIOS.length - 1].devs).toBe(100_000_000)
  })

  it('is findable by the name `?scenario=` takes', () => {
    expect(scenarioById('town')?.devs).toBe(1e6)
    expect(scenarioById('not-a-scenario')).toBeNull()
    expect(scenarioById('')).toBeNull()
  })

  it('says what the lens is allowed to see, and agrees with §7.7.1', () => {
    // The picker parks the camera here, so a disagreement with the ceiling
    // would show up as a lens that snaps back the instant it is let go.
    for (const s of SCENARIOS) expect(scenarioRung(s)).toBe(rungFor(s.devs).rung)
  })
})

describe('a scenario is a studio you can look at', () => {
  it('puts the headcount in the store, and a roster under it', () => {
    for (const s of SCENARIOS) {
      applyScenario(s)
      expect(getState().devs).toBe(s.devs)
      expect(getState().roster.reduce((n, r) => n + r.count, 0)).toBe(s.devs)
      // Not parked on its own ceiling: a studio at the cap reads as one that
      // has stalled, which is a different picture from the one being asked for.
      expect(getState().devCap).toBeGreaterThan(s.devs)
    }
  })

  it('does not hang a scene over the screen — the whole difference from ?devs', () => {
    // §10.7a.3's scrim owns every tap while a scene plays, so a headcount
    // loaded with the script still armed is a studio of a million people behind
    // a dialogue box about hiring your second developer. On 2026-08-18 that
    // silently ate a wheel event and cost a measurement; see the module header.
    for (const s of SCENARIOS) {
      applyScenario(s)
      for (let i = 0; i < 240; i++) tick(1 / 60)
      expect(getState().scene).toBeNull()
      expect(getState().event).toBeNull()
    }
  })

  it('is still solvent four seconds later', () => {
    // §4.10d's payroll is continuous and scales with the headcount, so "give it
    // some money" has to mean "give it money proportional to the burn". A
    // scenario that bankrupts while you are reading it is not a scenario.
    for (const s of SCENARIOS) {
      applyScenario(s)
      for (let i = 0; i < 240; i++) tick(1 / 60)
      expect(getState().cash).toBeGreaterThan(0)
      expect(getState().devs).toBe(s.devs)
    }
  })

  it('leaves nothing behind from the studio before it', () => {
    // Switching decades is the point of the picker, and a buff or a selected
    // seat from a studio of ten is a lie about a studio of ten million — the
    // seat may not even exist in the new one.
    applyScenario(scenarioById('ten')!)
    __setState({
      buffs: [{ rung: 0, index: 3, strength: 0.4 }],
      floaters: [{ id: 1, sp: 5, x: 0, y: 0, crit: false, bornAt: 0, snippet: null, unblocked: false }],
      selected: 3,
      pokeRate: 2,
    })
    applyScenario(scenarioById('metro')!)
    expect(getState().buffs).toEqual([])
    expect(getState().floaters).toEqual([])
    expect(getState().selected).toBeNull()
    expect(getState().pokeRate).toBe(0)
  })
})
