import { describe, expect, it } from 'vitest'
import { GARAGE_SYNC, SYNC_WEIGHTS, flowScore, serviceScore, teamSync } from './teamSync.ts'
import { headsNeeded } from './support.ts'
import { BASELINE_RATING, RATING_WEIGHTS, rateRelease } from './rating.ts'

/** Nothing shipped, nobody hired, nothing to answer. */
const GARAGE_LOAD = {
  supportHeads: 0.4,
  sreHeads: 0.4,
  catalogue: 0,
  defectBacklog: 0,
  openIncidents: 0,
}

describe('the flow term — §4.1, averaged rather than sampled', () => {
  it('is the mean efficiency over the build', () => {
    // Sixty seconds at exactly 0.4 is 24 flow-seconds.
    expect(flowScore(24, 60)).toBeCloseTo(0.4, 12)
  })

  it('cannot be rescued by a good final frame', () => {
    /*
     * The property the whole integral exists for. A studio that spent the build
     * at 40% and then got organised on the last tick has the same integral it
     * had a tick earlier, whatever `currentEfficiency` says at the moment of
     * shipping.
     */
    const drowning = flowScore(24, 60)
    const drowningThenTidy = flowScore(24 + 1, 60 + 1)
    expect(drowningThenTidy - drowning).toBeLessThan(0.02)
  })

  it('reads a project with no seconds behind it as a garage, not as a disaster', () => {
    // Same question `rateRelease` answers with the baseline for a release with
    // no Story Points: a project nobody built is unrated, not terrible.
    expect(flowScore(0, 0)).toBe(1)
    expect(flowScore(NaN, NaN)).toBe(1)
  })

  it('stays inside 0..1 for anything anyone could hand it', () => {
    expect(flowScore(1e9, 1)).toBe(1)
    expect(flowScore(-5, 10)).toBe(0)
    expect(flowScore(Infinity, 10)).toBe(1)
  })
})

describe('the service term — §4.13, §4.12a', () => {
  it('is perfect when nothing has shipped and nothing is on fire', () => {
    // The garage. Zero demand scores 1 rather than 0, or every studio would be
    // punished for the crime of not yet having a back catalogue.
    expect(serviceScore(GARAGE_LOAD)).toBe(1)
  })

  it('falls when the catalogue outgrows the people looking after it', () => {
    const catalogue = 200
    const short = serviceScore({ ...GARAGE_LOAD, catalogue })
    const staffed = serviceScore({
      ...GARAGE_LOAD,
      catalogue,
      supportHeads: headsNeeded(catalogue, 0),
    })
    expect(short).toBeLessThan(staffed)
    expect(staffed).toBe(1)
  })

  it('does not pay for over-staffing', () => {
    // §4.13's exception is that throwing people at support *works*; it is not
    // that throwing more people than the queue needs makes better games.
    const enough = serviceScore({ ...GARAGE_LOAD, catalogue: 50, supportHeads: headsNeeded(50, 0) })
    const far = serviceScore({ ...GARAGE_LOAD, catalogue: 50, supportHeads: 1e6 })
    expect(far).toBe(enough)
  })

  it('cannot be halved by one unlucky incident', () => {
    /*
     * §4.12's "nothing here may become a fail state" applies to a score that
     * collapses on a single event as much as to one that stops the clicker.
     * The two sides are averaged rather than minimised for exactly this.
     */
    const paged = serviceScore({ ...GARAGE_LOAD, openIncidents: 1, sreHeads: 0 })
    expect(paged).toBe(0.5)
  })

  it('stays inside 0..1 under nonsense', () => {
    const wild = serviceScore({
      supportHeads: -5,
      sreHeads: NaN,
      catalogue: Infinity,
      defectBacklog: -1,
      openIncidents: -3,
    })
    expect(wild).toBeGreaterThanOrEqual(0)
    expect(wild).toBeLessThanOrEqual(1)
  })
})

describe('§4.14.1 — the garage is the ceiling, and that is the calibration', () => {
  it('scores a garage exactly one', () => {
    expect(GARAGE_SYNC).toBe(1)
    expect(teamSync({ flowSeconds: 60, projectSeconds: 60, load: GARAGE_LOAD })).toBe(GARAGE_SYNC)
  })

  it('leaves the rating at the baseline for a garage, so the economy does not move', () => {
    // The load-bearing property of adding this term at all: a studio that does
    // none of it earns exactly what it earned before the term existed.
    const sync = teamSync({ flowSeconds: 60, projectSeconds: 60, load: GARAGE_LOAD })
    const garage = { defects: 0.02 * 1000, storyPoints: 1000, heroCoverage: 0, craft: 1 }
    expect(rateRelease({ ...garage, sync })).toBeCloseTo(BASELINE_RATING, 9)
  })

  it('prices §6 — a studio that outgrew itself ships worse games, not just later ones', () => {
    const together = teamSync({ flowSeconds: 60, projectSeconds: 60, load: GARAGE_LOAD })
    const diluted = teamSync({ flowSeconds: 18, projectSeconds: 60, load: GARAGE_LOAD })
    expect(diluted).toBeLessThan(together)
    // Flow dominates: the whole loss here is the flow term's share of it.
    expect(together - diluted).toBeCloseTo(SYNC_WEIGHTS.flow * (1 - 0.3), 6)
  })

  it('costs a real but survivable slice of the rating at its worst', () => {
    const dead = teamSync({
      flowSeconds: 0,
      projectSeconds: 60,
      load: { ...GARAGE_LOAD, catalogue: 5000, openIncidents: 20, sreHeads: 0 },
    })
    expect(dead).toBeCloseTo(0, 3)
    const garage = { defects: 0.02 * 1000, storyPoints: 1000, heroCoverage: 0, craft: 1 }
    const lost = rateRelease({ ...garage, sync: 1 }) - rateRelease({ ...garage, sync: dead })
    expect(lost).toBeCloseTo(RATING_WEIGHTS.sync * 100, 1)
  })

  it('stays inside 0..1 whatever it is handed', () => {
    const wild = teamSync({
      flowSeconds: -1,
      projectSeconds: -1,
      load: {
        supportHeads: NaN,
        sreHeads: NaN,
        catalogue: NaN,
        defectBacklog: NaN,
        openIncidents: NaN,
      },
    })
    expect(Number.isFinite(wild)).toBe(true)
    expect(wild).toBeGreaterThanOrEqual(0)
    expect(wild).toBeLessThanOrEqual(1)
  })
})
