import { describe, expect, it } from 'vitest'
import {
  DWELL_SECONDS,
  advanceDevState,
  initialDevState,
  pickState,
  pokeDevState,
  stateWeights,
} from './devStates.ts'
import type { DevState } from './poke.ts'

/** Sample the distribution with a deterministic sweep rather than random draws. */
function distribution(entropy: number, samples = 2000): Record<DevState, number> {
  const counts = {
    working: 0,
    slacking: 0,
    flow: 0,
    overwhelmed: 0,
    rogue: 0,
    tenx: 0,
  } as Record<DevState, number>

  for (let i = 0; i < samples; i++) {
    counts[pickState({ entropy }, i / samples)]++
  }
  for (const k of Object.keys(counts) as DevState[]) counts[k] /= samples
  return counts
}

describe('entropy shapes what developers are doing', () => {
  it('makes working the common case in a healthy studio', () => {
    const d = distribution(0)
    expect(d.working).toBeGreaterThan(0.5)
  })

  it('crowds out Flow State as the studio strains', () => {
    // Nobody reaches flow in a studio that is 90% meetings.
    expect(distribution(0.9).flow).toBeLessThan(distribution(0).flow)
    expect(distribution(0.99).flow).toBeLessThan(0.01)
  })

  it('produces no Overwhelmed developers at zero entropy', () => {
    expect(distribution(0).overwhelmed).toBe(0)
  })

  it('makes Overwhelmed dominant at Entropy Lock', () => {
    expect(distribution(1).overwhelmed).toBeGreaterThan(0.4)
  })

  it('keeps the 10x Engineer rare, per Appendix C #6', () => {
    const d = distribution(0)
    expect(d.tenx).toBeGreaterThan(0)
    expect(d.tenx).toBeLessThan(0.03)
  })

  it('never emits a negative weight', () => {
    for (const e of [0, 0.5, 1, -1, 2]) {
      for (const w of Object.values(stateWeights({ entropy: e }))) {
        expect(w).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('scales 10x likelihood with the prestige bonus', () => {
    const base = stateWeights({ entropy: 0 }).tenx
    expect(stateWeights({ entropy: 0, tenxBonus: 1 }).tenx).toBeGreaterThan(base)
  })
})

describe('states arrive and expire on their own', () => {
  it('holds a state for its dwell time before re-rolling', () => {
    let m = initialDevState()
    m = advanceDevState(m, DWELL_SECONDS.working - 0.1, { entropy: 0 }, () => 0)
    expect(m.state).toBe('working')
    expect(m.elapsed).toBeCloseTo(DWELL_SECONDS.working - 0.1, 6)
  })

  it('re-rolls once the dwell elapses', () => {
    let m = initialDevState()
    // roll = 0.999 lands in the last bucket of the distribution.
    m = advanceDevState(m, DWELL_SECONDS.working + 0.1, { entropy: 0 }, () => 0.999)
    expect(m.elapsed).toBe(0)
    expect(m.state).toBe('tenx')
  })

  it('keeps a 10x Engineer indefinitely — they only leave if cashed', () => {
    let m = { state: 'tenx' as DevState, elapsed: 0 }
    for (let i = 0; i < 500; i++) m = advanceDevState(m, 1, { entropy: 0 }, () => 0.999)
    expect(m.state).toBe('tenx')
    expect(DWELL_SECONDS.tenx).toBe(Infinity)
  })
})

describe('poking is what ends a state early (GDD §4.7, §8.2)', () => {
  it('makes the 10x Engineer quit on the spot', () => {
    const { machine, devLeaves } = pokeDevState({ state: 'tenx', elapsed: 3 }, false)
    expect(devLeaves).toBe(true)
    expect(machine.state).toBe('working')
  })

  it('spends Flow State when the Culture upgrade is not owned', () => {
    const { machine, devLeaves } = pokeDevState({ state: 'flow', elapsed: 3 }, false)
    expect(machine.state).toBe('working')
    expect(devLeaves).toBe(false)
  })

  it('prolongs Flow State by 5s once Culture is owned', () => {
    const { machine } = pokeDevState({ state: 'flow', elapsed: 8 }, true)
    expect(machine.state).toBe('flow')
    expect(machine.elapsed).toBe(3)
  })

  it('does not let a prolonged Flow rewind past its start', () => {
    const { machine } = pokeDevState({ state: 'flow', elapsed: 2 }, true)
    expect(machine.elapsed).toBe(0)
  })

  it('clears an Overwhelmed developer’s lockup', () => {
    expect(pokeDevState({ state: 'overwhelmed', elapsed: 4 }, false).machine.state).toBe('working')
  })

  it('cancels a rogue refactor', () => {
    expect(pokeDevState({ state: 'rogue', elapsed: 4 }, false).machine.state).toBe('working')
  })

  it('leaves a working developer’s dwell running — a jolt, not a reset', () => {
    const before = { state: 'working' as DevState, elapsed: 5 }
    expect(pokeDevState(before, false).machine).toBe(before)
  })

  it('never removes anyone but the 10x', () => {
    const states: DevState[] = ['working', 'slacking', 'flow', 'overwhelmed', 'rogue']
    for (const state of states) {
      expect(pokeDevState({ state, elapsed: 1 }, false).devLeaves, state).toBe(false)
    }
  })
})
