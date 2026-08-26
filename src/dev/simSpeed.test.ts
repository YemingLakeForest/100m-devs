import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./debugAccess.ts', () => ({
  DEBUG_TOOLS_ENABLED: true,
  debugSearchParams: () => new URLSearchParams(''),
}))

import {
  SIM_SPEED_MAX,
  SIM_SPEED_MIN,
  SIM_SPEED_STOPS,
  clampSimSpeed,
  getSimSpeed,
  nudgeSimSpeed,
  resetSimSpeed,
  setSimSpeed,
  stopIndexFor,
  subscribeSimSpeed,
} from './simSpeed.ts'

beforeEach(() => {
  resetSimSpeed()
})

describe('the clamp', () => {
  it('never runs slower than real time and never faster than the ceiling', () => {
    expect(clampSimSpeed(-40)).toBe(SIM_SPEED_MIN)
    expect(clampSimSpeed(0)).toBe(SIM_SPEED_MIN)
    expect(clampSimSpeed(1e9)).toBe(SIM_SPEED_MAX)
  })

  it('floors, so the dial never says one number and runs another', () => {
    // A fractional multiplier is a fractional *tick count*, and there is no
    // such thing — see the module header on why this is steps and not `dt`.
    expect(clampSimSpeed(2.9)).toBe(2)
    expect(clampSimSpeed('7.99')).toBe(7)
  })

  it('reads anything that is not a number as real time', () => {
    for (const junk of ['banana', '', NaN, Infinity, null, undefined, {}]) {
      expect(clampSimSpeed(junk)).toBe(SIM_SPEED_MIN)
    }
  })
})

describe('the dial', () => {
  it('starts at real time when nothing asked for anything else', () => {
    expect(getSimSpeed()).toBe(SIM_SPEED_MIN)
  })

  it('lands on what it was asked for, and says what it landed on', () => {
    expect(setSimSpeed(20)).toBe(20)
    expect(getSimSpeed()).toBe(20)
    // Out of range, so the answer is not the question — which is exactly why
    // the setter returns rather than resolving silently.
    expect(setSimSpeed(500)).toBe(SIM_SPEED_MAX)
  })

  it('notifies subscribers, and only when the number actually moved', () => {
    const seen = vi.fn()
    const stop = subscribeSimSpeed(seen)
    setSimSpeed(12)
    expect(seen).toHaveBeenCalledTimes(1)
    setSimSpeed(12)
    expect(seen).toHaveBeenCalledTimes(1)
    stop()
    setSimSpeed(30)
    expect(seen).toHaveBeenCalledTimes(1)
  })
})

describe('the stops', () => {
  it('runs from real time to the ceiling, strictly increasing', () => {
    expect(SIM_SPEED_STOPS[0]).toBe(SIM_SPEED_MIN)
    expect(SIM_SPEED_STOPS[SIM_SPEED_STOPS.length - 1]).toBe(SIM_SPEED_MAX)
    for (let i = 1; i < SIM_SPEED_STOPS.length; i += 1) {
      expect(SIM_SPEED_STOPS[i]).toBeGreaterThan(SIM_SPEED_STOPS[i - 1])
    }
  })

  it('parks a typed value on the stop below it', () => {
    expect(SIM_SPEED_STOPS[stopIndexFor(7)]).toBeLessThanOrEqual(7)
    expect(SIM_SPEED_STOPS[stopIndexFor(1)]).toBe(1)
    expect(SIM_SPEED_STOPS[stopIndexFor(60)]).toBe(60)
  })

  it('steps up and down without ever getting stuck', () => {
    for (let i = 0; i < SIM_SPEED_STOPS.length + 3; i += 1) nudgeSimSpeed(1)
    expect(getSimSpeed()).toBe(SIM_SPEED_MAX)
    for (let i = 0; i < SIM_SPEED_STOPS.length + 3; i += 1) nudgeSimSpeed(-1)
    expect(getSimSpeed()).toBe(SIM_SPEED_MIN)
  })

  it('steps in the direction it was asked to, from between two stops', () => {
    // ×7 is not a stop. Up must be 8 and down must be 5; a naive
    // "index of the stop below, ±1" gives 8 for both.
    setSimSpeed(7)
    expect(nudgeSimSpeed(1)).toBe(8)
    setSimSpeed(7)
    expect(nudgeSimSpeed(-1)).toBe(5)
  })
})

describe('the gate', () => {
  it('is ×1 and unmovable outside an authorised local browser session', async () => {
    // Deployed HTML and a Capacitor-native build reach the setter — nothing
    // stops them importing the module — so the gate has to be inside it rather
    // than only on the control that calls it.
    vi.resetModules()
    vi.doMock('./debugAccess.ts', () => ({
      DEBUG_TOOLS_ENABLED: false,
      debugSearchParams: () => new URLSearchParams('?speed=40'),
    }))
    const gated = await import('./simSpeed.ts')
    expect(gated.getSimSpeed()).toBe(gated.SIM_SPEED_MIN)
    expect(gated.setSimSpeed(40)).toBe(gated.SIM_SPEED_MIN)
    expect(gated.getSimSpeed()).toBe(gated.SIM_SPEED_MIN)
    vi.doUnmock('./debugAccess.ts')
    vi.resetModules()
  })
})

describe('?speed seeds the dial', () => {
  it('opens the session at whatever the query string asked for', async () => {
    vi.resetModules()
    vi.doMock('./debugAccess.ts', () => ({
      DEBUG_TOOLS_ENABLED: true,
      debugSearchParams: () => new URLSearchParams('?speed=40'),
    }))
    const seeded = await import('./simSpeed.ts')
    expect(seeded.getSimSpeed()).toBe(40)
    vi.doUnmock('./debugAccess.ts')
    vi.resetModules()
  })
})
