import { describe, expect, it } from 'vitest'
import {
  RETIRE_AFTER_SECONDS,
  advanceTail,
  catalogueIncome,
  catalogueOutstanding,
  collectedFraction,
  earningRate,
  rollShape,
  type Release,
} from './revenue.ts'

const SEEDS = [1, 9, 77, 4242, 0x9e3779b9]

function release(seed: number, ordinal: number, payout: number): Release {
  return {
    id: ordinal,
    name: `Game ${ordinal}`,
    payout,
    age: 0,
    paid: 0,
    shape: rollShape(seed, ordinal),
    // Quality is carried on the release but no arithmetic in `revenue.ts`
    // reads it — these are here to satisfy the record, not the maths.
    defectDensity: 0,
    rating: 50,
  }
}

/** Run a catalogue forward at `dt` until everything has retired. */
function runOut(releases: Release[], dt: number) {
  let live = releases
  let earned = 0
  for (let t = 0; t < RETIRE_AFTER_SECONDS + 5; t += dt) {
    const step = advanceTail(live, dt)
    live = step.releases
    earned += step.earned
  }
  return { earned, live }
}

describe('randomise the SHAPE, never the TOTAL — GDD §4.10e', () => {
  it('pays exactly the ladder payout, for every seed', () => {
    // "A player who ships the same game must not be able to be unlucky with
    // it. That line is what keeps this from being gambling." So the total is
    // not a consequence of the randomised parameters at all — it is the same
    // number every time, to the cent.
    for (const seed of SEEDS) {
      for (const ordinal of [0, 1, 2, 3]) {
        const { earned } = runOut([release(seed, ordinal, 25_000)], 1 / 60)
        expect(earned).toBeCloseTo(25_000, 6)
      }
    }
  })

  it('pays the same total however coarsely the clock ticks', () => {
    // A subtractive tail drifts with the frame rate, and the drift lands in the
    // one number §4.10e says must not move. This is why the money is banked
    // from the difference of two closed-form cumulatives.
    for (const dt of [1 / 120, 1 / 60, 1 / 10, 0.5, 2]) {
      const { earned } = runOut([release(3, 0, 550_000)], dt)
      expect(earned).toBeCloseTo(550_000, 4)
    }
  })

  it('does randomise the shape — two runs of the same ladder differ', () => {
    // The other half. A "randomised" tail that produced the same curve every
    // time would satisfy the constraint above and none of the intent.
    const at30 = SEEDS.map((seed) => collectedFraction(rollShape(seed, 0), 30))
    expect(new Set(at30.map((v) => v.toFixed(4))).size).toBeGreaterThan(1)
  })

  it('is the same shape after a reload, not a fresh roll', () => {
    expect(rollShape(11, 2)).toEqual(rollShape(11, 2))
    expect(rollShape(11, 2)).not.toEqual(rollShape(12, 2))
  })
})

describe('front-loaded and long — §4.10e’s two requirements at once', () => {
  it('lands most of the money at launch, so §21’s loop stays playable', () => {
    // Act IIa is *ship, earn, hire, ship faster*, and the hire has to be
    // affordable while the player still remembers shipping.
    for (const seed of SEEDS) {
      expect(collectedFraction(rollShape(seed, 0), 10)).toBeGreaterThan(0.4)
    }
  })

  it('is still paying a minute later, which is what a back catalogue is', () => {
    // "Old projects keep paying while the new one is in development. That is
    // the whole point: the books stay afloat between ships."
    for (const seed of SEEDS) {
      const shape = rollShape(seed, 0)
      expect(collectedFraction(shape, 60)).toBeLessThan(0.99)
      expect(earningRate({ ...release(seed, 0, 25_000), age: 60 })).toBeGreaterThan(0)
    }
  })

  it('decays — it never earns more later than it did at launch', () => {
    const r = release(7, 0, 100_000)
    let previous = Infinity
    for (let age = 0; age < RETIRE_AFTER_SECONDS; age += 2) {
      const rate = earningRate({ ...r, age })
      expect(rate).toBeLessThanOrEqual(previous + 1e-9)
      previous = rate
    }
  })

  it('collects nothing before it ships and approaches everything after', () => {
    const shape = rollShape(2, 0)
    expect(collectedFraction(shape, 0)).toBe(0)
    expect(collectedFraction(shape, -5)).toBe(0)
    expect(collectedFraction(shape, 1e6)).toBeCloseTo(1, 9)
  })
})

describe('the catalogue — several games at once', () => {
  it('adds up across everything still on sale', () => {
    const catalogue = [release(1, 0, 50), release(1, 1, 25_000), release(1, 2, 120_000)]
    expect(catalogueIncome(catalogue)).toBeCloseTo(
      catalogue.reduce((a, r) => a + earningRate(r), 0),
      9,
    )
    expect(catalogueOutstanding(catalogue)).toBe(145_050)
  })

  it('pays the ladder total across a whole run of ships', () => {
    // Four projects, shipped one after another, run out. The sum is the ladder
    // and nothing has leaked between the tails.
    const payouts = [50, 25_000, 120_000, 550_000]
    let live: Release[] = []
    let earned = 0
    payouts.forEach((payout, i) => {
      live = [...live, release(88, i, payout)]
      for (let t = 0; t < 40; t += 1 / 30) {
        const step = advanceTail(live, 1 / 30)
        live = step.releases
        earned += step.earned
      }
    })
    earned += runOut(live, 1 / 30).earned
    expect(earned).toBeCloseTo(payouts.reduce((a, b) => a + b, 0), 3)
  })

  it('retires a release rather than tracking it for ever', () => {
    // An asymptote never finishes, and an unbounded catalogue is a slow memory
    // fault dressed as an economy.
    const { live } = runOut([release(4, 0, 1000)], 1)
    expect(live).toHaveLength(0)
  })

  it('never charges the player for owning a back catalogue', () => {
    // Every step must be income. A negative one would mean a release taking
    // money back, which is a bug the treasury would carry for the rest of the
    // run before anybody noticed the sign.
    let live = [release(5, 0, 25_000), release(5, 1, 120_000)]
    for (let t = 0; t < RETIRE_AFTER_SECONDS + 5; t += 0.25) {
      const step = advanceTail(live, 0.25)
      expect(step.earned).toBeGreaterThanOrEqual(0)
      live = step.releases
    }
  })

  it('does nothing for a zero or negative step rather than paying twice', () => {
    const live = [release(6, 0, 500)]
    expect(advanceTail(live, 0).earned).toBe(0)
    expect(advanceTail(live, -1).earned).toBe(0)
    expect(advanceTail([], 1).earned).toBe(0)
  })
})
