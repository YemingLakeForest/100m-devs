/**
 * §22.8, §13.8 [amended 2026-09-26] — what the heroes do for the studio.
 *
 * Placement is gone, so these pin the three claims that replaced it: nobody
 * through the door is no effect at all, a hero works for the whole studio the
 * moment they arrive, and the sentence on each card is the number the
 * simulation charges.
 */

import { describe, expect, it } from 'vitest'
import {
  HELPDESK_SHARE,
  NO_HERO_FOLD,
  ONCALL_SHARE,
  STANDUP_KEPT_SHARE,
  benchShare,
  heroFold,
  heroRuntime,
  type HeroRuntime,
} from './heroRoster.ts'
import { HERO_BY_ID, STORY_HEROES, type HeroId } from './storyHeroes.ts'

function hero(id: HeroId): HeroRuntime {
  return heroRuntime(id)!
}

describe('§13.6.7 — amplitude, never gate', () => {
  it('is no effect at all with nobody through the door, at any headcount', () => {
    for (const devs of [0, 20, 1e6]) expect(heroFold([], devs)).toEqual(NO_HERO_FOLD)
  })

  it('resolves every one of the cast, and nobody else', () => {
    for (const h of STORY_HEROES) expect(hero(h.id).hero).toBe(h)
    expect(heroRuntime('nobody' as HeroId)).toBeNull()
  })
})

describe('a hero works for the whole studio from the day they arrive', () => {
  it('needs nothing but arriving — there is no placement to make', () => {
    // The same multipliers at every headcount: nothing about a hero's worth
    // depends on where anybody is standing.
    for (const devs of [12, 4_000]) {
      expect(heroFold([hero('mo')], devs).defects).toBe(0.5)
      expect(heroFold([hero('matt')], devs).ticketRate).toBeCloseTo(0.8, 12)
      expect(heroFold([hero('melany')], devs).cap).toBe(1.25)
      expect(heroFold([hero('serena')], devs).incidentStartWork).toBe(0.5)
    }
  })

  it('puts a share of the headcount on the pager and the inbox, so both grow with the studio', () => {
    // §4.12a's and §4.13's loads grow with the studio; a flat rota would be
    // enough at twenty and nothing at a million.
    const small = heroFold([hero('serena'), hero('matt')], 20)
    const large = heroFold([hero('serena'), hero('matt')], 20_000)
    expect(small.oncallHeads).toBeCloseTo(20 * ONCALL_SHARE, 12)
    expect(small.supportHeads).toBeCloseTo(20 * HELPDESK_SHARE, 12)
    expect(large.oncallHeads / small.oncallHeads).toBeCloseTo(1000, 9)
    expect(large.supportHeads / small.supportHeads).toBeCloseTo(1000, 9)
    // And an empty studio has nobody to put on either.
    expect(heroFold([hero('serena'), hero('matt')], 0).oncallHeads).toBe(0)
  })

  it('bills Melany’s reserved capacity per developer, and keeps half the floor coding through stand-up for Billy', () => {
    expect(heroFold([hero('melany')], 300).operatingCost).toBe(300)
    expect(heroFold([hero('billy')], 300).standupHeads).toBe(300 * STANDUP_KEPT_SHARE)
    // James is one person who keeps typing, however large the studio gets.
    expect(heroFold([hero('james')], 300).standupHeads).toBe(1)
  })

  it('never lets Billy cancel the stand-up outright — that is §13.2 L1-2A’s purchase', () => {
    expect(STANDUP_KEPT_SHARE).toBeLessThan(1)
  })

  it('composes: two heroes are both their effects', () => {
    const both = heroFold([hero('james'), hero('billy')], 100)
    expect(both.standupHeads).toBe(1 + 100 * STANDUP_KEPT_SHARE)
  })
})

describe('§22.9.2 — the card says what the fold does', () => {
  // The sentence is the claim; the constant is its number. If one moves
  // without the other the card is lying.
  it('names Serena’s and Matt’s rota by the same ratio the fold uses', () => {
    expect(HERO_BY_ID.get('serena')!.trait.text).toMatch(/one developer in fifty/)
    expect(ONCALL_SHARE).toBe(1 / 50)
    expect(HERO_BY_ID.get('matt')!.trait.text).toMatch(/one developer in twenty/)
    expect(HELPDESK_SHARE).toBe(1 / 20)
    expect(HERO_BY_ID.get('matt')!.trait.text).toMatch(/20% slower/)
  })

  it('says “half” for Mo and for Billy, and 25% for Melany', () => {
    expect(HERO_BY_ID.get('mo')!.trait.text).toMatch(/half as many defects/)
    expect(HERO_BY_ID.get('billy')!.trait.text).toMatch(/half the floor/)
    expect(HERO_BY_ID.get('melany')!.trait.text).toMatch(/25%/)
  })

  it('never mentions coverage or placement any more', () => {
    for (const h of STORY_HEROES) expect(h.trait.text).not.toMatch(/coverage|placed|posted/i)
  })
})

describe('§4.14 — the bench', () => {
  it('is divided by the cast, not by the arrivals, so it climbs with the story', () => {
    const cast = STORY_HEROES.length
    expect(benchShare([hero('james')], cast)).toBeCloseTo(1 / cast, 12)
    expect(benchShare([hero('james'), hero('mo')], cast)).toBeCloseTo(2 / cast, 12)
    expect(benchShare(STORY_HEROES.map((h) => hero(h.id)), cast)).toBe(1)
    expect(benchShare([], cast)).toBe(0)
  })
})
