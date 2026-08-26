import { describe, expect, it } from 'vitest'
import {
  ERRANDS,
  ERRAND_KINDS,
  MEAN_ERRAND_SECONDS,
  SLACK_MIN_DEVS,
  TRAVEL_SECONDS,
  advanceSlack,
  awayHeads,
  awayShare,
  awayTarget,
  dropSlacker,
  emptySlack,
  errandWeights,
  headsFor,
  isAway,
  liftSlacker,
  phaseLength,
  pickErrand,
  pokeHome,
  type Errand,
  type SlackContext,
  type SlackState,
} from './slackOff.ts'

/** A cheap deterministic source. The distribution claims below are statistical. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Run a floor for `seconds` and report the average number of people away. */
function settle(ctx: SlackContext, seconds: number, seed = 1): number {
  const rng = seeded(seed)
  let s: SlackState = emptySlack()
  const dt = 0.1
  let sum = 0
  let n = 0
  for (let t = 0; t < seconds; t += dt) {
    s = advanceSlack(s, dt, ctx, rng)
    // Discard the first quarter: the roster starts empty and the average would
    // otherwise be measuring the fill rather than the steady state.
    if (t > seconds * 0.25) {
      sum += awayHeads(s)
      n++
    }
  }
  return sum / Math.max(1, n)
}

describe('awayShare — §7.8.9, rising with entropy', () => {
  it('is small on a calm floor and large at gridlock', () => {
    expect(awayShare(0)).toBeLessThan(awayShare(1))
    expect(awayShare(0)).toBeGreaterThan(0)
  })

  it('is monotonic — no entropy is ever a better place to be than a lower one', () => {
    for (let e = 0; e < 1; e += 0.05) {
      expect(awayShare(e + 0.05)).toBeGreaterThan(awayShare(e))
    }
  })

  it('clamps rather than extrapolating off either end', () => {
    expect(awayShare(-5)).toBe(awayShare(0))
    expect(awayShare(5)).toBe(awayShare(1))
  })
})

describe('awayTarget', () => {
  it('is nobody at all below the minimum headcount', () => {
    for (let d = 0; d < SLACK_MIN_DEVS; d++) {
      expect(awayTarget({ devs: d, entropy: 1 })).toBe(0)
    }
    expect(awayTarget({ devs: SLACK_MIN_DEVS, entropy: 1 })).toBeGreaterThan(0)
  })

  it('is a fraction of headcount, so a big floor is proportionally as idle', () => {
    const small = awayTarget({ devs: 40, entropy: 0.5 })
    const big = awayTarget({ devs: 400, entropy: 0.5 })
    expect(big / small).toBeCloseTo(10, 5)
  })

  it('falls when §11 Branch D cuts the share', () => {
    const before = awayTarget({ devs: 100, entropy: 0.5 })
    const after = awayTarget({ devs: 100, entropy: 0.5, slackShare: 0.5 })
    expect(after).toBeLessThan(before)
  })
})

describe('errand choice', () => {
  it('never draws an errand §11 Branch D has deleted', () => {
    const ctx: SlackContext = { devs: 50, entropy: 0.5, blocked: ['water', 'window'] }
    const rng = seeded(7)
    for (let i = 0; i < 500; i++) {
      const k = pickErrand(ctx, rng())
      expect(k).not.toBe('water')
      expect(k).not.toBe('window')
    }
  })

  it('can never delete loitering — §7.8.9 rule 2', () => {
    // Every prop-backed errand blocked at once. Standing about needs no prop,
    // so the studio cannot buy its way to a floor where nobody stands up.
    const blocked = ERRAND_KINDS.filter((k) => ERRANDS[k].needsProp)
    const w = errandWeights({ devs: 50, entropy: 1, blocked })
    expect(w.loiter).toBeGreaterThan(0)
    expect(pickErrand({ devs: 50, entropy: 1, blocked }, 0.99)).toBe('loiter')
  })

  it('redistributes a deleted errand rather than re-rolling it', () => {
    // The mass a blocked errand held goes to the survivors: their weights are
    // untouched, so their *share* of the total rises.
    const open = errandWeights({ devs: 50, entropy: 0.5 })
    const shut = errandWeights({ devs: 50, entropy: 0.5, blocked: ['water'] })
    const shareOf = (w: Record<Errand, number>, k: Errand) =>
      w[k] / ERRAND_KINDS.reduce((sum, j) => sum + w[j], 0)
    expect(shareOf(shut, 'window')).toBeGreaterThan(shareOf(open, 'window'))
  })

  it('sends two or three people to a whiteboard and one to the cooler', () => {
    for (const r of [0, 0.34, 0.5, 0.99]) {
      expect(headsFor('water', r)).toBe(1)
      const board = headsFor('whiteboard', r)
      expect(board).toBeGreaterThanOrEqual(2)
      expect(board).toBeLessThanOrEqual(3)
    }
  })
})

describe('the roster over time', () => {
  it('converges on the target rather than filling to a cap', () => {
    const ctx: SlackContext = { devs: 200, entropy: 0.6 }
    const avg = settle(ctx, 600)
    const target = awayTarget(ctx)
    // Loose bounds: this is a stochastic equilibrium, not an equation. What is
    // being pinned is that it lands *near* the duty cycle rather than at zero
    // or at the whole floor.
    expect(avg).toBeGreaterThan(target * 0.5)
    expect(avg).toBeLessThan(target * 1.5)
  })

  it('leaves a busier floor emptier — §6, in bodies', () => {
    const calm = settle({ devs: 200, entropy: 0.05 }, 600, 3)
    const seized = settle({ devs: 200, entropy: 0.95 }, 600, 3)
    expect(seized).toBeGreaterThan(calm)
  })

  it('is bought back by §11 Branch D', () => {
    const unbought = settle({ devs: 200, entropy: 0.6 }, 600, 5)
    const bought = settle({ devs: 200, entropy: 0.6, slackShare: 0.3 }, 600, 5)
    expect(bought).toBeLessThan(unbought)
  })

  it('never sends more people away than the studio employs', () => {
    const rng = seeded(11)
    let s = emptySlack()
    for (let i = 0; i < 4000; i++) {
      s = advanceSlack(s, 0.1, { devs: 4, entropy: 1 }, rng)
      expect(awayHeads(s)).toBeLessThanOrEqual(4)
    }
  })

  it('never puts one developer on two errands', () => {
    const rng = seeded(13)
    let s = emptySlack()
    for (let i = 0; i < 3000; i++) {
      s = advanceSlack(s, 0.1, { devs: 30, entropy: 0.9 }, rng)
      const seats = s.away.map((a) => a.seat)
      expect(new Set(seats).size).toBe(seats.length)
    }
  })

  it('never moves James — §21.7.0', () => {
    const rng = seeded(17)
    let s = emptySlack()
    for (let i = 0; i < 4000; i++) {
      s = advanceSlack(s, 0.1, { devs: 12, entropy: 1, pinned: [1] }, rng)
      expect(isAway(s, 1)).toBe(false)
    }
  })

  it('culls seats a shrinking studio no longer has — §26.2', () => {
    const rng = seeded(19)
    let s = emptySlack()
    for (let i = 0; i < 600; i++) s = advanceSlack(s, 0.1, { devs: 80, entropy: 1 }, rng)
    expect(awayHeads(s)).toBeGreaterThan(0)
    s = advanceSlack(s, 0.1, { devs: 5, entropy: 1 }, rng)
    for (const a of s.away) expect(a.seat).toBeLessThan(5)
  })

  it('walks out, stands there, walks back, and stops costing anything', () => {
    // One person, forced onto the roster by hand so the phases can be watched
    // without waiting for a spawn.
    let s = liftSlacker(emptySlack(), 4)
    s = dropSlacker(s, 4, false)
    const ctx: SlackContext = { devs: 20, entropy: 0 }
    const never = () => 1 // no new errands start
    expect(s.away[0].phase).toBe('back')
    // Real steps, because the clamp means one big `dt` is one small one — see
    // MAX_STEP_SECONDS, which now protects Story Points as well as the frame.
    for (let t = 0; t < TRAVEL_SECONDS + 0.5; t += 0.1) s = advanceSlack(s, 0.1, ctx, never)
    expect(awayHeads(s)).toBe(0)
  })

  it('holds a carried developer out of the clock entirely', () => {
    let s = liftSlacker(emptySlack(), 2)
    const never = () => 1
    for (let i = 0; i < 200; i++) s = advanceSlack(s, 0.25, { devs: 20, entropy: 0 }, never)
    // Fifty seconds in the air and they are still in the air. §7.8.9's toy has
    // no timer, and a developer who expired in the player's hand would be one.
    expect(s.away[0]?.phase).toBe('carried')
    expect(phaseLength(s.away[0])).toBe(Infinity)
  })

  it('does not erupt when a backgrounded tab hands over a six-second frame', () => {
    const rng = seeded(23)
    let s = emptySlack()
    s = advanceSlack(s, 6, { devs: 500, entropy: 1 }, rng)
    // One clamped step can start at most one errand, and a whiteboard huddle is
    // the largest one.
    expect(awayHeads(s)).toBeLessThanOrEqual(ERRANDS.whiteboard.maxHeads)
  })
})

describe('the drag — §7.8.9', () => {
  it('lifts somebody who was working, and it costs from that moment', () => {
    const s = liftSlacker(emptySlack(), 9)
    expect(awayHeads(s)).toBe(1)
    expect(s.away[0].phase).toBe('carried')
  })

  it('refuses nobody — a walker can be caught mid-stride', () => {
    let s = emptySlack()
    s = liftSlacker(s, 3)
    s = dropSlacker(s, 3, false)
    expect(s.away[0].phase).toBe('back')
    s = liftSlacker(s, 3)
    expect(s.away[0].phase).toBe('carried')
  })

  it('seats them when dropped on a desk, and they produce again', () => {
    let s = liftSlacker(emptySlack(), 6)
    s = dropSlacker(s, 6, true)
    expect(awayHeads(s)).toBe(0)
  })

  it('sends them walking when dropped anywhere else — never a teleport', () => {
    let s = liftSlacker(emptySlack(), 6)
    s = dropSlacker(s, 6, false)
    expect(awayHeads(s)).toBe(1)
    expect(s.away[0].phase).toBe('back')
  })

  it('will not lift a pinned seat in the first place — §21.7.0 rule 6', () => {
    const s = liftSlacker(emptySlack(), 1, 0.5, [1])
    expect(awayHeads(s)).toBe(0)
  })

  it('still seats a pinned seat that somehow got carried, rather than walking him', () => {
    // Unreachable through the game since 2026-08-26, and kept because a save or
    // a scenario written before that rule could still present one mid-carry.
    let s = liftSlacker(emptySlack(), 1)
    s = dropSlacker(s, 1, false, [1])
    expect(awayHeads(s)).toBe(0)
  })

  it('sends a poked developer home — §7.8.6 rule 5 survives', () => {
    let s = liftSlacker(emptySlack(), 5)
    s = dropSlacker(s, 5, false)
    s = pokeHome(s, 5)
    expect(isAway(s, 5)).toBe(false)
  })
})

describe('the errand table', () => {
  it('gives the whiteboard huddle the shape of a meeting nobody called', () => {
    expect(ERRANDS.whiteboard.minHeads).toBeGreaterThan(1)
  })

  it('has exactly one errand that needs no prop', () => {
    expect(ERRAND_KINDS.filter((k) => !ERRANDS[k].needsProp)).toEqual(['loiter'])
  })

  it('derives the mean errand from the table rather than restating it', () => {
    const stands = ERRAND_KINDS.map((k) => ERRANDS[k].stand)
    expect(MEAN_ERRAND_SECONDS).toBeGreaterThan(Math.min(...stands))
    expect(MEAN_ERRAND_SECONDS).toBeGreaterThan(2 * TRAVEL_SECONDS)
  })
})
