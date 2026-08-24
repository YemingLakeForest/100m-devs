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
import {
  SCENARIOS,
  addHeadcount,
  applyHeadcount,
  applyScenario,
  parseHeadcount,
  rungForCount,
  scenarioById,
  scenarioRung,
} from './scenarios.ts'
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

describe('a headcount somebody typed', () => {
  it('takes what a person actually types when they mean a hundred million', () => {
    // The suffixes are the point. The whole tool exists for the sizes above a
    // million, and nobody wants to count zeroes to get to one.
    expect(parseHeadcount('100000000')).toBe(1e8)
    expect(parseHeadcount('100,000,000')).toBe(1e8)
    expect(parseHeadcount('100 000 000')).toBe(1e8)
    expect(parseHeadcount('100m')).toBe(1e8)
    expect(parseHeadcount('100M')).toBe(1e8)
    expect(parseHeadcount('0.1b')).toBe(1e8)
    expect(parseHeadcount('1e8')).toBe(1e8)
    expect(parseHeadcount(' 40m ')).toBe(4e7)
    expect(parseHeadcount('250k')).toBe(250_000)
    expect(parseHeadcount('1')).toBe(1)
  })

  it('rejects rather than clamps, so a typo never quietly becomes a studio of nobody', () => {
    expect(parseHeadcount('')).toBeNull()
    expect(parseHeadcount('   ')).toBeNull()
    expect(parseHeadcount('lots')).toBeNull()
    expect(parseHeadcount('-5')).toBeNull()
    expect(parseHeadcount('12x')).toBeNull()
    expect(parseHeadcount('1..2')).toBeNull()
    // Past 2^53 a headcount stops being an integer and starts being a rumour.
    // The boundary is `Number.isSafeInteger` and not a taste: §7.7.1's ladder
    // runs to 10^13 and a tool that refused a trillion would be refusing the
    // top of the game.
    expect(parseHeadcount('999t')).toBe(999e12)
    expect(parseHeadcount('99999t')).toBeNull()
  })

  it('lands the lens on the rung the number has earned', () => {
    expect(rungForCount(1)).toBeLessThan(rungForCount(1e6))
    expect(rungForCount(1e6)).toBeLessThan(rungForCount(1e8))
  })
})

describe('a batch somebody adds with the testing dial', () => {
  it('uses the real hire path, so the addition is visible and the roster stays true', () => {
    applyHeadcount(10)
    const before = getState()

    expect(addHeadcount(100)).toBe(110)

    const after = getState()
    expect(after.devs).toBe(110)
    expect(after.roster.reduce((n, r) => n + r.count, 0)).toBe(110)
    expect(after.spawn?.from).toBe(10)
    expect(after.spawn?.to).toBe(110)
    expect(after.spawn?.id).not.toBe(before.spawn?.id)
    expect(after.peakDevs).toBe(110)
  })

  it('keeps cap and payroll out of the way without erasing the current run', () => {
    applyHeadcount(10)
    __setState({
      cash: 1,
      devCap: 3,
      pokeCount: 42,
      scene: 'test-scene',
    })

    addHeadcount(1_000)

    const after = getState()
    expect(after.cash).toBeGreaterThanOrEqual(1_010 * 1e6)
    expect(after.devCap).toBeGreaterThan(after.devs)
    expect(after.pokeCount).toBe(42)
    expect(after.scene).toBeNull()
  })

  it('ignores invalid or empty batches rather than publishing a fake arrival', () => {
    applyHeadcount(10)
    const spawn = getState().spawn

    expect(addHeadcount(0)).toBe(10)
    expect(addHeadcount(Number.NaN)).toBe(10)
    expect(getState().spawn).toBe(spawn)
  })
})
