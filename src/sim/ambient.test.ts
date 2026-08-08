import { describe, expect, it } from 'vitest'
import {
  BUDGET_MAX,
  DRIVEBY_FROM,
  MAX_STEP_SECONDS,
  RATE_CALM,
  SMALLTALK_FROM,
  ambientBudget,
  ambientRuns,
  eventsPerSecond,
  pickBehaviour,
  shouldStart,
  weightsFor,
  type Behaviour,
} from './ambient.ts'

/** Sample the distribution at a given entropy, deterministically. */
function census(entropy: number, samples = 4000): Record<Behaviour, number> {
  const out: Record<Behaviour, number> = { chatter: 0, smalltalk: 0, water: 0, driveby: 0 }
  for (let i = 0; i < samples; i++) out[pickBehaviour(entropy, (i + 0.5) / samples)]++
  return out
}

describe('the concurrency budget — GDD §7.8.6 rule 3', () => {
  it('is a fraction of headcount, so a small room is not frantic', () => {
    expect(ambientBudget(10)).toBeLessThan(ambientBudget(80))
  })

  it('flattens above ~150, so the cost stops growing', () => {
    // The point of a cap. Without it a floor of 100 runs eight walk cycles and
    // a floor of 10,000 tries to run eight hundred.
    expect(ambientBudget(150)).toBe(BUDGET_MAX)
    expect(ambientBudget(1e6)).toBe(BUDGET_MAX)
  })

  it('gives a lone developer nothing to do', () => {
    // Not "one behaviour". §7.8.6's four behaviours are all about other people
    // — a solo founder chatting to nobody is a different game.
    expect(ambientBudget(1)).toBe(0)
    expect(ambientBudget(2)).toBeGreaterThan(0)
  })
})

describe('rate — GDD §7.8.6 rule 1', () => {
  it('scales with entropy and not with headcount', () => {
    // The load-bearing distinction, and the one an implementation naturally
    // gets backwards. §4.1 says more people means more *interruption*, not more
    // chatter per person — headcount is already handled by the budget, and if
    // it appeared here too it would be counted twice.
    expect(eventsPerSecond(0.9)).toBeGreaterThan(eventsPerSecond(0.1) * 5)
    // `eventsPerSecond` takes no headcount at all, which is the strongest form
    // this assertion can take.
    expect(eventsPerSecond.length).toBe(1)
  })

  it('leaves a calm floor nearly silent, so a bubble is an event', () => {
    expect(eventsPerSecond(0)).toBe(RATE_CALM)
    expect(RATE_CALM).toBeLessThan(0.15)
  })

  it('clamps entropy rather than extrapolating', () => {
    expect(eventsPerSecond(-1)).toBe(eventsPerSecond(0))
    expect(eventsPerSecond(9)).toBe(eventsPerSecond(1))
  })
})

describe('what people do — GDD §7.8.6', () => {
  it('keeps a calm floor quiet but never still', () => {
    // Water is the one behaviour with a floor under it at every entropy: it is
    // the only one that is not about communication, and it is what stops a
    // low-entropy office reading as an empty one.
    const c = census(0.02)
    expect(c.smalltalk).toBe(0)
    expect(c.driveby).toBe(0)
    expect(c.water).toBeGreaterThan(0)
  })

  it('starts drive-bys only when the floor is genuinely bogged down', () => {
    // Walking to somebody else's desk to ask them something is the most
    // expensive interruption in real life, so it is the last one to appear.
    expect(weightsFor(DRIVEBY_FROM - 0.01).driveby).toBe(0)
    expect(weightsFor(DRIVEBY_FROM + 0.2).driveby).toBeGreaterThan(0)
    expect(census(0.9).driveby).toBeGreaterThan(0)
  })

  it('makes conversation displace solitude as entropy climbs', () => {
    // The shape of the escalation: not simply "more of everything", but a
    // floor where a growing share of what happens involves a second person.
    const share = (e: number) => {
      const c = census(e)
      const total = c.chatter + c.smalltalk + c.water + c.driveby
      return (c.smalltalk + c.driveby) / total
    }
    expect(share(0.1)).toBe(0)
    expect(share(0.5)).toBeGreaterThan(0)
    expect(share(0.95)).toBeGreaterThan(share(0.5))
  })

  it('never returns a behaviour with zero weight', () => {
    // A sampler that walks off the end of its own table is the classic way a
    // drive-by turns up on a silent floor exactly once, at random, and nobody
    // can reproduce it.
    for (const e of [0, SMALLTALK_FROM - 0.001, 0.3, DRIVEBY_FROM - 0.001, 1]) {
      const w = weightsFor(e)
      for (const r of [0, 0.001, 0.5, 0.999, 1]) {
        expect(w[pickBehaviour(e, r)]).toBeGreaterThan(0)
      }
    }
  })
})

describe('scheduling', () => {
  it('fires more often at high entropy', () => {
    const fires = (e: number) => {
      let n = 0
      for (let i = 0; i < 1000; i++) if (shouldStart(e, 1 / 60, (i + 0.5) / 1000)) n++
      return n
    }
    expect(fires(0.9)).toBeGreaterThan(fires(0.05))
  })

  it('does not erupt when a backgrounded tab hands over a huge frame', () => {
    // `document.hidden` suspends rAF, so the first frame back can be seconds
    // long. Without the clamp, the floor would explode into simultaneous
    // conversations at the exact moment the player looks at it again — which
    // is both wrong and the most conspicuous possible moment to be wrong.
    expect(shouldStart(1, 30, 0.99)).toBe(shouldStart(1, MAX_STEP_SECONDS, 0.99))
    expect(shouldStart(0, 30, 0.9)).toBe(false)
  })

  it('never fires on a zero or negative frame', () => {
    expect(shouldStart(1, 0, 0)).toBe(false)
    expect(shouldStart(1, -5, 0)).toBe(false)
  })
})

describe('rung gating — GDD §7.8.6 rule 4', () => {
  it('switches off entirely above rung 2 rather than running invisibly', () => {
    // The failure being avoided is not cost, it is nonsense: a system running
    // where nobody can see it is one that can go wrong where nobody can see it.
    expect(ambientRuns(80, true)).toBe(true)
    expect(ambientRuns(80, false)).toBe(false)
    expect(ambientRuns(1, true)).toBe(false)
  })
})
