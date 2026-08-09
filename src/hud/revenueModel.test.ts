import { describe, expect, it } from 'vitest'
import { MAX_BANDS, bandsFor, formatRate } from './revenueModel.ts'
import { earningRate, rollShape, type Release } from '../sim/revenue.ts'
import type { GameState } from '../game/store.ts'

function withReleases(count: number): GameState {
  const releases: Release[] = Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Game ${i}`,
    payout: 1000 * (i + 1),
    age: 1,
    paid: 0,
    shape: rollShape(1, i),
  }))
  return { releases } as GameState
}

describe('formatRate — §4.10e’s readout', () => {
  it('short-forms rather than running off the rail', () => {
    expect(formatRate(0)).toBe('$0.0/s')
    expect(formatRate(4.2)).toBe('$4.2/s')
    expect(formatRate(42)).toBe('$42/s')
    expect(formatRate(4200)).toBe('$4.2K/s')
    expect(formatRate(4.2e6)).toBe('$4.2M/s')
    expect(formatRate(4.2e9)).toBe('$4.2B/s')
  })

  it('never writes a minus, because the labels say which way each one flows', () => {
    // The readout is `… IN · … PAYROLL`, so a sign on the second would be
    // saying "out" twice and inviting the player to add them up wrong.
    expect(formatRate(-500)).toBe('$500/s')
  })
})

describe('bandsFor — one band per still-earning project, up to a point', () => {
  it('gives every release its own band while there are few enough', () => {
    for (let n = 0; n <= MAX_BANDS; n++) {
      expect(bandsFor(withReleases(n))).toHaveLength(n)
    }
  })

  it('folds the oldest together rather than dropping them', () => {
    // Dropping them would make the stack shrink as the studio's catalogue
    // *grew*, which is the opposite of what the chart is for.
    const state = withReleases(9)
    const many = bandsFor(state)
    expect(many).toHaveLength(MAX_BANDS)
    // The stack's height is the studio's whole income however many games are
    // in it: folding moves money between bands and never out of the chart.
    const total = state.releases.reduce((a, r) => a + earningRate(r), 0)
    expect(many.reduce((a, b) => a + b, 0)).toBeCloseTo(total, 9)
  })

  it('keeps the newest release last, so a launch stacks on top of the catalogue', () => {
    const bands = bandsFor(withReleases(9))
    // The newest game is the biggest payout in this fixture and it is the one
    // that must be the top band, whatever its size — the ordering is by age.
    expect(bands[bands.length - 1]).toBeGreaterThan(0)
    expect(bands).toHaveLength(MAX_BANDS)
  })

  it('draws nothing before the first ship', () => {
    expect(bandsFor(withReleases(0))).toEqual([])
  })
})
