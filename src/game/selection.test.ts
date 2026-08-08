/**
 * Selecting a developer — GDD §7.8.8.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { HOLD_MS, TAP_MS, isHold, isTap } from '../render/navigation.ts'
import { turnScale } from '../render/room.ts'
import { DESK_LINES, deskLine } from './deskLines.ts'
import { __resetStore, getState, selectDeveloper, selectedIdentity } from './store.ts'

beforeEach(() => {
  __resetStore()
})

describe('the gesture', () => {
  it('cannot be both a tap and a hold', () => {
    // Selection needs a gesture of its own because §8.2's poke is the primary
    // verb and fires hundreds of times a session. The two are mutually
    // exclusive *by construction* — HOLD_MS is longer than TAP_MS — rather than
    // by a flag somewhere deciding which one won.
    expect(HOLD_MS).toBeGreaterThan(TAP_MS)
    for (const ms of [0, 100, TAP_MS, HOLD_MS, 900]) {
      expect(isTap(0, 0, ms) && isHold(0, 0, ms)).toBe(false)
    }
  })

  it('is not a hold if the finger moved', () => {
    // Otherwise a drag that happens to end slowly opens a panel over the room
    // the player was panning.
    expect(isHold(40, 0, 900)).toBe(false)
    expect(isHold(0, 0, 900)).toBe(true)
  })
})

describe('the turn — §7.8.8', () => {
  it('pinches to nothing in the middle and comes back', () => {
    // A 2D figure turns by being squashed to nothing and returning the other
    // way round. The pose swaps at the pinch, where there is nothing on screen
    // to see it happen.
    expect(turnScale(0)).toBe(1)
    expect(turnScale(1)).toBe(1)
    expect(turnScale(0.5)).toBeLessThan(0.1)
  })

  it('is symmetric, so turning away looks like turning towards', () => {
    for (const t of [0.1, 0.25, 0.4]) {
      expect(turnScale(t)).toBeCloseTo(turnScale(1 - t), 6)
    }
  })

  it('never inverts or overshoots', () => {
    for (let t = 0; t <= 1; t += 0.02) {
      expect(turnScale(t)).toBeGreaterThan(0)
      expect(turnScale(t)).toBeLessThanOrEqual(1)
    }
  })
})

describe('the store', () => {
  it('holds a seat, not a person', () => {
    // §7.8.7 generates identity from the seat, so selection costs one integer
    // and cannot go stale against a rebuilt roster.
    selectDeveloper(3)
    expect(getState().selected).toBe(3)
    expect(selectedIdentity()?.name).toBe(selectedIdentity()?.name)
  })

  it('deselects on null and on a miss', () => {
    selectDeveloper(3)
    selectDeveloper(null)
    expect(getState().selected).toBeNull()
    expect(selectedIdentity()).toBeNull()
    // A negative index is what `pickDeveloper` returns for empty floor.
    selectDeveloper(2)
    selectDeveloper(-1)
    expect(getState().selected).toBeNull()
  })

  it('always names somebody real', () => {
    for (const i of [0, 1, 7, 119]) {
      selectDeveloper(i)
      expect(selectedIdentity()?.name).toBeTruthy()
    }
  })

  it('selects James at seat one, in every run', () => {
    selectDeveloper(1)
    expect(selectedIdentity()?.name).toBe('James')
  })
})

describe('the live quote — §19', () => {
  it('has lines for every developer state', () => {
    // A missing band would show as an empty card for one state, which is the
    // state the player is most likely to be looking at when it happens.
    for (const state of ['working', 'slacking', 'overwhelmed', 'flow', 'rogue', 'tenx'] as const) {
      expect(DESK_LINES[state].length).toBeGreaterThan(2)
      expect(deskLine(state, 0, 0.5)).toBeTruthy()
    }
  })

  it('does not give two developers in the same state the same line', () => {
    // The one way a shared pool gives itself away: select two neighbours, both
    // working, both saying exactly the same thing.
    expect(deskLine('working', 0, 0.5)).not.toBe(deskLine('working', 1, 0.5))
  })

  it('stays inside the pool for any index or draw', () => {
    for (const i of [-5, 0, 1, 999]) {
      for (const r of [0, 0.5, 0.999, 1]) {
        expect(DESK_LINES.working).toContain(deskLine('working', i, r))
      }
    }
  })

  it('contains no emoji — ART_DIRECTION §3.1', () => {
    const all = Object.values(DESK_LINES).flat().join(' ')
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false)
  })
})
