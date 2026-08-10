import { describe, expect, it } from 'vitest'
import {
  BUFF_TAU,
  MAX_BUFFS,
  MAX_STRENGTH,
  addBuff,
  buffLift,
  decayBuffs,
  strengthOnSeat,
  type Buff,
} from './buffs.ts'

/** A studio where every developer is worth exactly the average. */
const flat = (from: number, to: number) => to - from

describe('a poke’s value becomes a rate, and the total is preserved (GDD §4.5a)', () => {
  it('converts story points into the strength that delivers them back', () => {
    // The whole conversion, and the reason it is derived rather than tuned: a
    // buff of strength `s` on a unit producing `u` story points a second
    // delivers `s * u * tau` points over its life. Solving for `s` is what
    // keeps §4.10's calibrated economy exactly where it was — the poke is worth
    // what it was always worth, and only its *arrival* changed.
    const { buffs, overflow } = addBuff([], { rung: 1, index: 0 }, 12, 4)
    expect(overflow).toBe(0)
    expect(buffs[0].strength * 4 * BUFF_TAU).toBeCloseTo(12, 10)
  })

  it('pays out the part a saturated unit cannot take, rather than losing it', () => {
    // The clamp exists so a single developer at a hundred thousand headcount
    // cannot be handed a strength of forty. But a clamp that silently swallows
    // the remainder makes the poke worth less than §4.5 says it is, and that is
    // the kind of drift this codebase pins twice rather than once.
    const value = MAX_STRENGTH * 2 * BUFF_TAU * 3
    const { buffs, overflow } = addBuff([], { rung: 1, index: 0 }, value, 2)
    expect(buffs[0].strength).toBe(MAX_STRENGTH)
    expect(buffs[0].strength * 2 * BUFF_TAU + overflow).toBeCloseTo(value, 8)
  })

  it('pays the whole poke out when the unit produces nothing', () => {
    // §6.3 — a studio in Entropy Lock produces nothing, so there is no rate to
    // raise by a percentage. The points do not vanish; they land as §4.5's
    // one-off, which is exactly the behaviour before R14.
    const { buffs, overflow } = addBuff([], { rung: 1, index: 0 }, 9, 0)
    expect(buffs).toHaveLength(0)
    expect(overflow).toBe(9)
  })

  it('ignores a poke that was worth nothing', () => {
    // §4.7 — an Overwhelmed developer pays zero and the poke's value is
    // clearing their lockup. That must not leave a zero-strength entry
    // occupying one of the bounded slots.
    expect(addBuff([], { rung: 1, index: 0 }, 0, 5).buffs).toHaveLength(0)
  })
})

describe('the buff fades (GDD §4.5a)', () => {
  it('decays exponentially on its own time constant', () => {
    const [b] = addBuff([], { rung: 1, index: 0 }, 10, 5).buffs
    const [after] = decayBuffs([b], BUFF_TAU).buffs
    expect(after.strength).toBeCloseTo(b.strength * Math.exp(-1), 10)
  })

  it('drops a buff once it is too small to be worth an object', () => {
    const buffs = addBuff([], { rung: 1, index: 0 }, 1, 1).buffs
    expect(decayBuffs(buffs, BUFF_TAU * 40).buffs).toHaveLength(0)
  })

  it('hands back what a dropped buff had left to give', () => {
    // The cutoff is what stops an entry living for as long as floating point
    // can halve it, and it costs the buff its tail — a few per cent of the
    // poke, *varying with the studio's size*, because a smaller unit gets a
    // larger strength and therefore a smaller proportional tail. A loss that
    // moves with headcount is the exact shape of silent drift `output.ts` pins
    // the mean twice to avoid, so the remainder is reported rather than
    // dropped: the caller knows the rate it was a percentage of and can bank it.
    const { buffs } = addBuff([], { rung: 1, index: 0 }, 20, 4)
    const { buffs: after, dropped } = decayBuffs(buffs, BUFF_TAU * 40)

    expect(after).toHaveLength(0)
    expect(dropped).toEqual([expect.objectContaining({ rung: 1, index: 0 })])
    expect(dropped[0].strength).toBeGreaterThan(0)
  })

  it('reports nothing dropped while every buff is still alive', () => {
    const { buffs } = addBuff([], { rung: 1, index: 0 }, 20, 4)
    expect(decayBuffs(buffs, 0.1).dropped).toEqual([])
  })

  it('leaves an empty overlay alone', () => {
    expect(decayBuffs([], 1)).toEqual({ buffs: [], dropped: [] })
  })
})

describe('the overlay is sparse and bounded (GDD §4.5a)', () => {
  it('stacks a second poke onto the unit it already covers', () => {
    // "The loop is *maintain* the people who are worth maintaining." Topping a
    // buff up has to reach the same entry, or a rotation of six targets grows
    // six entries a second.
    const first = addBuff([], { rung: 1, index: 7 }, 10, 5).buffs
    const second = addBuff(first, { rung: 1, index: 7 }, 10, 5).buffs
    expect(second).toHaveLength(1)
    expect(second[0].strength).toBeCloseTo(first[0].strength * 2, 10)
  })

  it('keeps units at different rungs apart', () => {
    const one = addBuff([], { rung: 1, index: 0 }, 10, 5).buffs
    const two = addBuff(one, { rung: 4, index: 0 }, 10, 5).buffs
    expect(two).toHaveLength(2)
  })

  it('never grows past its cap, however long the player mashes', () => {
    let buffs: Buff[] = []
    for (let i = 0; i < MAX_BUFFS * 4; i++) {
      buffs = addBuff(buffs, { rung: 2, index: i }, 10, 5).buffs
    }
    expect(buffs).toHaveLength(MAX_BUFFS)
  })

  it('evicts the weakest, so what the player is maintaining survives', () => {
    let buffs: Buff[] = []
    for (let i = 0; i < MAX_BUFFS; i++) {
      buffs = addBuff(buffs, { rung: 2, index: i }, 10, 5).buffs
    }
    // Seat 0 is the one being maintained: three times the strength of the rest.
    buffs = addBuff(buffs, { rung: 2, index: 0 }, 20, 5).buffs
    buffs = addBuff(buffs, { rung: 2, index: 999 }, 10, 5).buffs

    expect(buffs).toHaveLength(MAX_BUFFS)
    expect(buffs.some((b) => b.index === 0)).toBe(true)
    expect(buffs.some((b) => b.index === 999)).toBe(true)
  })
})

describe('who a buff reaches (GDD §4.5b)', () => {
  it('reaches only the developer who was poked, in the room', () => {
    const buffs = addBuff([], { rung: 2, index: 12 }, 10, 5).buffs
    expect(strengthOnSeat(buffs, 12, 40)).toBeGreaterThan(0)
    expect(strengthOnSeat(buffs, 11, 40)).toBe(0)
  })

  it('reaches everybody inside a unit further up the ladder', () => {
    // §4.5b: "the buff applies to everything inside it".
    const buffs = addBuff([], { rung: 3, index: 1 }, 10, 5).buffs
    expect(strengthOnSeat(buffs, 1_000, 4_000)).toBeGreaterThan(0)
    expect(strengthOnSeat(buffs, 1_999, 4_000)).toBeGreaterThan(0)
    expect(strengthOnSeat(buffs, 2_000, 4_000)).toBe(0)
    expect(strengthOnSeat(buffs, 999, 4_000)).toBe(0)
  })

  it('adds up where a person and their floor are both buffed', () => {
    let buffs = addBuff([], { rung: 2, index: 5 }, 10, 5).buffs
    buffs = addBuff(buffs, { rung: 3, index: 0 }, 10, 5).buffs
    const person = strengthOnSeat(buffs, 5, 4_000)
    const neighbour = strengthOnSeat(buffs, 6, 4_000)
    expect(person).toBeGreaterThan(neighbour)
    expect(neighbour).toBeGreaterThan(0)
  })
})

describe('what the buffs do to the studio’s velocity', () => {
  it('lifts nothing when nobody is buffed', () => {
    expect(buffLift([], 40, flat)).toBe(0)
  })

  it('lifts the studio by the buffed unit’s share of it', () => {
    // One developer of forty, buffed by 50%, is worth 50%/40 of the studio.
    const buffs: Buff[] = [{ rung: 2, index: 3, strength: 0.5 }]
    expect(buffLift(buffs, 40, flat)).toBeCloseTo(0.5 / 40, 10)
  })

  it('weights a developer by what they are actually worth (§4.9a)', () => {
    // A 10x Engineer is ten times the target their neighbour is, and that is
    // §4.5a's "who you poke matters" arriving as arithmetic rather than as a
    // separate rule.
    const shares = (from: number, to: number) => (from === 3 && to === 4 ? 10 : to - from)
    const buffs: Buff[] = [{ rung: 2, index: 3, strength: 0.5 }]
    expect(buffLift(buffs, 40, shares)).toBeCloseTo((0.5 * 10) / 40, 10)
  })

  it('lifts the whole studio when the whole studio is the unit', () => {
    const buffs: Buff[] = [{ rung: 3, index: 0, strength: 0.2 }]
    expect(buffLift(buffs, 1_000, flat)).toBeCloseTo(0.2, 10)
  })

  it('cannot lift a studio with nobody in it', () => {
    expect(buffLift([{ rung: 2, index: 0, strength: 1 }], 0, flat)).toBe(0)
  })

  it('agrees with the per-seat strengths it is summarising', () => {
    // **The invariant everything downstream rests on.** The studio's lift and
    // the individual lifts are two views of one quantity, and if they disagree
    // the §8.2b numerals over forty heads stop adding up to the VELOCITY
    // readout above them — which is precisely the class of lie §25.1 is about.
    let buffs: Buff[] = []
    buffs = addBuff(buffs, { rung: 2, index: 3 }, 7, 2).buffs
    buffs = addBuff(buffs, { rung: 2, index: 19 }, 3, 2).buffs
    buffs = addBuff(buffs, { rung: 3, index: 0 }, 40, 60).buffs

    const devs = 40
    let perSeat = 0
    for (let i = 0; i < devs; i++) perSeat += strengthOnSeat(buffs, i, devs)

    expect(buffLift(buffs, devs, flat)).toBeCloseTo(perSeat / devs, 10)
  })
})
