import { describe, expect, it } from 'vitest'
import {
  MAX_BURST,
  MIN_BURST,
  SPRITE_BUDGET,
  cohortSize,
  formatCount,
  isLiteral,
  rungCrossed,
  rungFor,
  scaleBar,
  spawnBurst,
  visibleSprites,
} from './headcount.ts'

describe('spawnBurst — §7.7.3, the requirement that hiring stays visible', () => {
  it('shows bodies for the very first hire', () => {
    expect(spawnBurst(1, 2)).toBeGreaterThan(5)
  })

  it('gives the same punch for the same ratio at any scale — the whole design', () => {
    // This is the property the §7.7 model exists to deliver: doubling the
    // studio feels identical whether it is 1 -> 2 or 10^12 -> 2x10^12. If this
    // ever fails, late-game hiring has gone flat and the ladder is broken.
    const early = spawnBurst(1, 2)
    const late = spawnBurst(1e12, 2e12)
    expect(late).toBe(early)
  })

  it('is flat across every decade, not just the two endpoints', () => {
    const doublings = [1, 10, 1e3, 1e6, 1e9, 1e12, 1e15].map((n) => spawnBurst(n, n * 2))
    expect(new Set(doublings).size).toBe(1)
  })

  it('lets a negligible hire look negligible', () => {
    // 10^12 + 10^9 is +0.1%. Showing a deluge for that would be the game lying
    // about the player's progress, which is worse than showing a trickle.
    const negligible = spawnBurst(1e12, 1e12 + 1e9)
    expect(negligible).toBeLessThan(spawnBurst(1e12, 2e12))
  })

  it('never shows nothing for a real hire', () => {
    // The player pressed a button. Something must arrive.
    for (const [before, after] of [
      [1e12, 1e12 + 1],
      [1e15, 1e15 + 1e3],
      [5, 6],
    ]) {
      expect(spawnBurst(before, after)).toBeGreaterThanOrEqual(MIN_BURST)
    }
  })

  it('caps the deluge', () => {
    // The §22.7 art budget and the GDD §23.3 criterion-4 sprite ceiling are both
    // real, and past ~100 arrivals the eye stops counting anyway.
    expect(spawnBurst(1, 1e30)).toBeLessThanOrEqual(MAX_BURST)
    expect(spawnBurst(0, 1e6)).toBeLessThanOrEqual(MAX_BURST)
  })

  it('shows the §6 Mass Hire as a deluge', () => {
    // 2 -> 1,002 is the game's most important single moment.
    expect(spawnBurst(2, 1002)).toBeGreaterThan(80)
  })

  it('shows nothing when nobody was hired', () => {
    expect(spawnBurst(10, 10)).toBe(0)
    expect(spawnBurst(10, 4)).toBe(0)
  })

  it('survives nonsense rather than spawning NaN sprites', () => {
    expect(spawnBurst(Number.NaN, 10)).toBe(MIN_BURST)
    expect(spawnBurst(1, Number.POSITIVE_INFINITY)).toBe(MIN_BURST)
  })
})

describe('cohortSize — §7.7.5, the scale bar', () => {
  it('is one developer per unit while the swarm fits on one floor', () => {
    expect(cohortSize(1)).toBe(1)
    expect(cohortSize(999)).toBe(1)
  })

  it('is the size of the thing the player is actually looking at', () => {
    // The bug this pins: deriving the cohort independently of the rung put the
    // two on different schedules, and at 1,002 developers the HUD read
    // "1 FLOOR = 1 DEVS". A floor holds a thousand people, so the cohort at the
    // floor rung is a thousand. The unit on screen and the number beside it
    // have to be the same claim.
    expect(cohortSize(1002)).toBe(1e3)
    expect(cohortSize(5e4)).toBe(1e4)
    expect(cohortSize(4.2e12)).toBe(1e10)
  })

  it('never claims a unit holds fewer people than a unit', () => {
    for (const devs of [1002, 5e3, 5e4, 5e5, 5e6, 5e9, 5e12, 5e15]) {
      expect(cohortSize(devs)).toBeLessThanOrEqual(devs)
    }
  })

  it('never lets the sprite count run past the budget', () => {
    for (const devs of [1, 500, 1e3, 1e4, 1e7, 1e12, 1e18]) {
      expect(visibleSprites(devs)).toBeLessThanOrEqual(SPRITE_BUDGET)
    }
  })

  it('never empties the screen, at any headcount', () => {
    // The swarm is the game's main image. Note this is deliberately ">= 1" and
    // not ">= 100": at the bottom of a rung there IS exactly one unit, because
    // crossing into the floor rung is the moment a thousand people fuse into
    // one storey (§7.7.2). Sparse-then-filling is the ladder, not a bug.
    for (const devs of [1, 1e3, 1e3 + 1, 1e4, 1e7, 1e12, 1e18]) {
      expect(visibleSprites(devs)).toBeGreaterThanOrEqual(1)
    }
  })

  it('fills each rung from one unit up to a screenful', () => {
    // Rung 3 runs 1 -> 10 storeys, which is a tower growing. If a rung ever
    // spanned so many decades that it ended past the sprite budget, the top of
    // it would be an unrenderable mush.
    expect(visibleSprites(1e3)).toBe(1)
    expect(visibleSprites(9.9e3)).toBe(9)
    expect(visibleSprites(9.9e12)).toBeLessThanOrEqual(SPRITE_BUDGET)
  })

  it('stays silent while a marker is still a person, and speaks once it is not', () => {
    expect(scaleBar(500)).toBeNull()
    expect(scaleBar(1002)).toBe('1 FLOOR = 1.0 K DEVS')
    expect(scaleBar(4.2e12)).toBe('1 PLANET = 10.0 B DEVS')
  })
})

describe('the Construction Ladder — §7.7.1', () => {
  it('names the unit that arrives at each scale', () => {
    // §7.7.2's gag animates this noun: a floor is slapped onto the tower, a
    // planet is set down and bounces once.
    expect(rungFor(1).unit).toBe('person')
    expect(rungFor(500).unit).toBe('person')
    expect(rungFor(5e3).unit).toBe('floor')
    expect(rungFor(5e4).unit).toBe('building')
    expect(rungFor(5e5).unit).toBe('campus')
    expect(rungFor(1e12).unit).toBe('planet')
    expect(rungFor(1e18).unit).toBe('galaxy')
  })

  it('keeps one sprite meaning one person for the whole of Run 1 — §7.7.1', () => {
    // Run 1 tops out at 1,002 developers (§21 Act IV). The literal rungs have
    // to cover it, or the game teaches its fiction in the abstract.
    expect(isLiteral(1)).toBe(true)
    expect(isLiteral(999)).toBe(true)
    expect(isLiteral(1e5)).toBe(false)
  })

  it('reports a promotion exactly once, on the hire that crosses it', () => {
    expect(rungCrossed(900, 5e3)?.unit).toBe('floor')
    expect(rungCrossed(5e3, 6e3)).toBeNull()
  })

  it('reports the destination, not each rung passed, when a hire skips several', () => {
    // The §6 Mass Hire jumps rungs. One arrival, on the rung landed on.
    expect(rungCrossed(2, 1e9)?.unit).toBe('nation')
  })

  it('never promotes on a shrinking studio', () => {
    // Act V liquidates 1,000 developers. That is not a promotion.
    expect(rungCrossed(1e6, 2)).toBeNull()
  })
})

describe('formatCount', () => {
  it('is short enough for a HUD and precise enough to read as growth', () => {
    expect(formatCount(8)).toBe('8')
    expect(formatCount(25_000)).toBe('25.0 K')
    expect(formatCount(4.2e12)).toBe('4.2 T')
  })

  it('drops the decimal once it stops meaning anything', () => {
    expect(formatCount(250_300)).toBe('250 K')
  })
})
