import { describe, expect, it } from 'vitest'
import { branchColour } from './heroBranches.ts'
import { HQ_MATERIAL, HQ_STAGES, HQ_STAGE_UPTO, hqMarker, hqStage, hqWings } from './hqLook.ts'
import { eraOf } from './eras.ts'

/**
 * The HQ scales from garage to galaxy [2026-10-04, GDD §7.8.12]. Claims about
 * order and identity, not about how it is drawn.
 */
describe('the HQ’s stages', () => {
  it('only ever climb as the studio grows', () => {
    let last = 0
    for (const heads of [0, 1, 20, 21, 100, 101, 1_000, 1_001, 1e6, 1e6 + 1, 1e8, 1e8 + 1, 1e12]) {
      const rank = HQ_STAGES.indexOf(hqStage(heads))
      expect(rank, `${heads}`).toBeGreaterThanOrEqual(last)
      last = rank
    }
    expect(hqStage(0)).toBe('garage')
    expect(hqStage(1e12)).toBe('origin')
  })

  it('has a material for every stage, and a boundary that agrees with the eras', () => {
    for (const s of HQ_STAGES) expect(HQ_MATERIAL[s].length).toBeGreaterThan(10)
    // The era boundaries the HQ stages reuse: it is the same game.
    expect(eraOf(HQ_STAGE_UPTO.garage)).toBe('garage')
    expect(eraOf(HQ_STAGE_UPTO.tower)).toBe('hq')
    expect(eraOf(HQ_STAGE_UPTO.campus)).toBe('city')
    expect(eraOf(HQ_STAGE_UPTO.capital)).toBe('earth')
  })

  it('survives nonsense', () => {
    expect(hqStage(Number.NaN)).toBe('origin')
    expect(hqStage(-5)).toBe('garage')
  })
})

describe('the HQ wears its heroes’ colours', () => {
  it('has a wing for each arrived hero, in roster order, and none for anybody else', () => {
    expect(hqWings([])).toEqual([])
    expect(hqWings(['james']).length).toBe(0)
    const wings = hqWings(['matt', 'billy', 'james'])
    expect(wings.map((w) => w.hero)).toEqual(['matt', 'billy'])
  })

  it('uses the branch colour — the same one the card, the plate and the room use', () => {
    for (const w of hqWings(['billy', 'serena', 'matt'])) {
      const expected = { billy: 'cohesion', serena: 'reliability', matt: 'support' }[w.hero as 'billy']
      expect(w.colour).toBe(branchColour(expected as never))
    }
    expect(new Set(hqWings(['billy', 'serena', 'matt']).map((w) => w.colour)).size).toBe(3)
  })
})

describe('the survey’s marker', () => {
  it('gains borders and then a crown as the HQ becomes a place, never losing either', () => {
    const at = (n: number) => hqMarker(n, [])
    expect(at(5).borders).toBe(1)
    expect(at(5).crown).toBe(false)
    expect(at(50_000).borders).toBeGreaterThanOrEqual(at(5).borders)
    expect(at(50_000_000).crown).toBe(true)
    expect(at(1e12).crown).toBe(true)
    expect(at(1e12).borders).toBeGreaterThanOrEqual(at(50_000).borders)
  })
})
