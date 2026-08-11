import { describe, expect, it } from 'vitest'
import {
  DEFECTS_PER_SUPPORT_HEAD,
  GAMES_PER_SUPPORT_HEAD,
  MIN_CATALOGUE_MULTIPLIER,
  SIGMA,
  TAU,
  TICKET_PATIENCE_SECONDS,
  advanceTickets,
  catalogueMultiplier,
  clearanceWait,
  headsNeeded,
  serviceRatio,
  ticketRate,
} from './support.ts'
import { supportCapacity, TICKETS_PER_SUPPORT_PER_SEC } from './roles.ts'

describe('§4.13 — the coefficients are headcounts, and the rates follow', () => {
  it('needs exactly one head per ten shipped games, forever', () => {
    expect(headsNeeded(GAMES_PER_SUPPORT_HEAD, 0)).toBeCloseTo(1, 12)
    expect(TAU).toBeCloseTo(TICKETS_PER_SUPPORT_PER_SEC / GAMES_PER_SUPPORT_HEAD, 12)
  })

  it('needs one more per hundred outstanding defects', () => {
    expect(headsNeeded(0, DEFECTS_PER_SUPPORT_HEAD)).toBeCloseTo(1, 12)
    expect(SIGMA).toBeCloseTo(TICKETS_PER_SUPPORT_PER_SEC / DEFECTS_PER_SUPPORT_HEAD, 12)
  })

  /**
   * §4.13's thesis: tickets scale with the back catalogue, **not** with what you
   * are currently building. Defects on the bench contribute, but a studio that
   * has shipped nothing has no floor at all.
   */
  it('charges nothing to a studio that has never shipped and has no bugs', () => {
    expect(ticketRate(0, 0)).toBe(0)
  })

  it('is a floor no upgrade removes — the catalogue term never decays', () => {
    // §4.10e retires a release from the economy after four minutes; the people
    // who bought it do not retire with it. The argument here is `catalogue`,
    // which is games *ever shipped*, and nothing in this module ages it.
    expect(ticketRate(80, 0)).toBeCloseTo(8 * ticketRate(10, 0), 12)
  })
})

describe('§4.13 — the one place where throwing people at a problem simply works', () => {
  /**
   * The exception that makes §6's rule visible. There is no §4.1 term anywhere
   * in this module and there must never be one: two support heads answer twice
   * as many tickets whether the studio is four people or four billion.
   */
  it('serves linearly at every scale', () => {
    for (const scale of [1, 1_000, 1e9]) {
      const a = advanceTickets(1e12, 0, 0, scale, 1).served
      const b = advanceTickets(1e12, 0, 0, scale * 2, 1).served
      expect(b).toBeCloseTo(2 * a, 6)
    }
  })

  it('holds a flat queue when capacity exactly matches arrivals', () => {
    const heads = 1
    const catalogue = GAMES_PER_SUPPORT_HEAD
    let queue = 0
    for (let i = 0; i < 100; i++) queue = advanceTickets(queue, catalogue, 0, heads, 0.1).queue
    expect(queue).toBeCloseTo(0, 9)
  })

  it('falls behind when it cannot keep up, and says so', () => {
    expect(serviceRatio(100, 0, 1)).toBeLessThan(1)
    expect(serviceRatio(5, 0, 1)).toBeGreaterThan(1)
    // Nothing arriving is not "falling behind" with nobody on it.
    expect(serviceRatio(0, 0, 0)).toBe(Infinity)
  })

  it('never serves more than are waiting', () => {
    const step = advanceTickets(2, 0, 0, 1_000, 1)
    expect(step.served).toBeCloseTo(2, 12)
    expect(step.queue).toBe(0)
  })
})

describe('clearanceWait', () => {
  it('is zero for an empty queue whatever the capacity', () => {
    expect(clearanceWait(0, 0)).toBe(0)
    expect(clearanceWait(0, 50)).toBe(0)
  })

  it('is unbounded with a queue and nobody on it', () => {
    expect(clearanceWait(10, 0)).toBe(Infinity)
  })

  it('is depth over capacity', () => {
    expect(clearanceWait(100, 2)).toBeCloseTo(100 / supportCapacity(2), 12)
  })
})

describe('§4.13 — unanswered tickets tax the catalogue, and never more than that', () => {
  it('leaves a served studio alone', () => {
    expect(catalogueMultiplier(0, 4)).toBe(1)
  })

  it('bites once the wait grows past the patience window', () => {
    const m = catalogueMultiplier(TICKET_PATIENCE_SECONDS * supportCapacity(1), 1)
    expect(m).toBeCloseTo(0.5 > MIN_CATALOGUE_MULTIPLIER ? 0.5 : MIN_CATALOGUE_MULTIPLIER, 6)
  })

  /**
   * §4.12's standing warning covers all three backlogs. This must never become
   * a second seizure, so the tax has a floor and the floor is mild — a harsh one
   * would make "stop shipping" the correct play, which inverts the whole game.
   */
  it('never falls below the floor, even with nobody on support at all', () => {
    expect(catalogueMultiplier(1e12, 0)).toBe(MIN_CATALOGUE_MULTIPLIER)
    expect(MIN_CATALOGUE_MULTIPLIER).toBeGreaterThan(0)
  })
})
