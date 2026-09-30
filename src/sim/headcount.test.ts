import { describe, expect, it } from 'vitest'
import {
  MAX_BURST,
  MIN_BURST,
  SPRITE_BUDGET,
  cohortSize,
  formatCount,
  framingRungFor,
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
    // §7.8.0 — a floor is a hundred now, so this band is a hundred wide rather
    // than a thousand. The claim is unchanged: while the room is on screen,
    // one body is one person.
    expect(cohortSize(1)).toBe(1)
    expect(cohortSize(99)).toBe(1)
  })

  it('is the size of the thing the player is actually looking at', () => {
    // The bug this pins: deriving the cohort independently of the rung put the
    // two on different schedules, and at 1,002 developers the HUD read
    // "1 FLOOR = 1 DEVS". A floor holds a hundred people (§7.8.0), so the
    // cohort at the floor rung is a hundred. The unit on screen and the number
    // beside it have to be the same claim.
    expect(cohortSize(1002)).toBe(100)
    expect(cohortSize(5e4)).toBe(1e4)
    // §7.7.1a — and it saturates at the *drawn* rung, which is the network's
    // world. The table runs two rungs further for §13.6.1's hero reach, and
    // naming a unit the picture does not contain is the same lie one size up.
    expect(cohortSize(4.2e12)).toBe(1e8)
    expect(cohortSize(4.2e18)).toBe(1e8)
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
    // Rungs 2 and 3 run 1 -> 100 storeys, which is a tower growing to its
    // topping-out. If a rung ever spanned so many decades that it ended past
    // the sprite budget, the top of it would be an unrenderable mush.
    expect(visibleSprites(101)).toBe(1)
    expect(visibleSprites(1e3)).toBe(10)
    expect(visibleSprites(9.9e3)).toBe(99)
    expect(visibleSprites(9.9e12)).toBeLessThanOrEqual(SPRITE_BUDGET)
  })

  it('stays silent while a marker is still a person, and speaks once it is not', () => {
    expect(scaleBar(20)).toBeNull()
    expect(scaleBar(50)).toBe('1 HOUSE = 100 DEVS')
    // §7.8.0 — a marker stops being a person at a hundred and one, because
    // that is where the picture stops being a floor and starts being a tower.
    expect(scaleBar(100)).toBe('1 HOUSE = 100 DEVS')
    expect(scaleBar(101)).toBe('1 HOUSE = 100 DEVS')
    expect(scaleBar(1002)).toBe('1 HOUSE = 100 DEVS')
    expect(scaleBar(2e8)).toBe('1 WORLD = 100 M DEVS')
    // Still a world at four trillion, because a world is still what is drawn.
    expect(scaleBar(4.2e12)).toBe('1 WORLD = 100 M DEVS')
  })
})

describe('the Construction Ladder — §7.7.1', () => {
  it('names the unit that arrives at each scale', () => {
    // §7.7.2's gag animates this noun: a floor is slapped onto the tower, a
    // planet is set down and bounces once.
    expect(rungFor(1).unit).toBe('person')
    expect(rungFor(50).unit).toBe('person')
    expect(rungFor(500).unit).toBe('floor')
    expect(rungFor(5e3).unit).toBe('floor')
    expect(rungFor(5e4).unit).toBe('building')
    expect(rungFor(5e5).unit).toBe('campus')
    expect(rungFor(1e12).unit).toBe('planet')
    expect(rungFor(1e18).unit).toBe('galaxy')
  })

  it('keeps one sprite meaning one person for as long as there is a room — §7.8.0', () => {
    // **This used to claim the whole of Run 1, up to Act III's 1,002, and
    // §7.8.0 deliberately gave that up.** A thousand developers is now a
    // ten-storey tower, so one marker there is a floor.
    //
    // That is not a loss to the fiction, it *is* the fiction: §21 Act III is
    // the mousetrap, and the thing the player buys with the Mass Hire is a
    // studio they can no longer see the individuals in. A picture that keeps
    // drawing a thousand nameable people through the collapse is arguing
    // against its own scene. Acts I and II — every headcount where the game is
    // still about a person you can poke — are inside the literal band, and the
    // room the camera can always pinch back into (§7.7.4) is drawn literally at
    // any headcount.
    expect(isLiteral(1)).toBe(true)
    expect(isLiteral(20)).toBe(true)
    expect(isLiteral(100)).toBe(true)
    expect(isLiteral(101)).toBe(false)
    expect(isLiteral(1e5)).toBe(false)
  })

  it('reports a promotion exactly once, on the hire that crosses it', () => {
    expect(rungCrossed(900, 5e3)?.unit).toBe('floor')
    expect(rungCrossed(5e3, 6e3)).toBeNull()
  })

  it('reports the destination, not each rung passed, when a hire skips several', () => {
    // The §6 Mass Hire jumps rungs. One arrival, on the rung landed on.
    expect(rungCrossed(2, 1e9)?.unit).toBe('world')
  })

  it('never promotes on a shrinking studio', () => {
    // Act V liquidates 1,000 developers. That is not a promotion.
    expect(rungCrossed(1e6, 2)).toBeNull()
  })

  it('reports every rung boundary, which is what the lens reveal is keyed on now', () => {
    // [2026-09-27] The pull-back on a promotion was keyed on the zoom ceiling
    // lifting, and the ceiling is gone (GDD §7.4a, amended). §7.8.0's inclusive
    // boundaries still hold: the rung changes on the developer *after* the one
    // who completed the unit, the first hire with nowhere in it to sit.
    for (const [full, next] of [
      [20, 21],
      [100, 101],
      [1e3, 1e3 + 1],
      [1e4, 1e4 + 1],
    ]) {
      expect(rungCrossed(full - 1, full)).toBeNull()
      expect(rungCrossed(full, next)).not.toBeNull()
    }
  })

  it('frames a studio that exactly fills a unit as that unit, not as the corner of the next', () => {
    // [2026-09-28] Above the building the rung bounds are round and exclusive,
    // so a hundred thousand is already "a business park" — right for the
    // promotion, and a park with one block in its corner for a camera asked to
    // show the studio. The framing rung is the rung with every bound inclusive.
    for (const full of [1e5, 1e6, 1e8, 1e10]) {
      expect(framingRungFor(full).rung).toBe(rungFor(full - 1).rung)
      expect(framingRungFor(full + 1).rung).toBe(rungFor(full + 1).rung)
      expect(framingRungFor(full + 1).rung).toBeGreaterThan(framingRungFor(full).rung)
    }
    // Below the building the bounds were inclusive already, and stay put: the
    // ten-thousand-and-first developer is in a second tower.
    for (const devs of [1, 20, 21, 100, 101, 1e3, 1e4, 1e4 + 1, 5e4]) {
      expect(framingRungFor(devs)).toBe(rungFor(devs))
    }
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

/*
 * "maxZoomFor — §7.7.1, the studio you can see is the studio you have" stood
 * here until 2026-09-27: six tests that two developers could not see a galaxy,
 * that the ceiling was the studio's own rung and lifted one rung per rung
 * earned. The user amended §7.4a (*"no we don't keep the lock and we should be
 * able to zoom and down before 100m"*) and the function went. What replaced
 * the claim — every level reachable at any headcount, drawing only what the
 * studio has, and James one pinch away — is pinned in `render/lens.test.ts`.
 */
