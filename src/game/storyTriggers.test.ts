import { describe, expect, it } from 'vitest'
import { DEFECT_DENSITY_ANCHOR } from '../sim/rating.ts'
import {
  CHATTY_TOP,
  MATT_SUSTAINED_S,
  arrivalPredicate,
  billyArrives,
  mattArrives,
  melanyArrives,
  moArrives,
  serenaArrives,
  type StorySnapshot,
} from './storyTriggers.ts'

const base: StorySnapshot = {
  paradigmShifts: 1,
  releases: [],
  hasIncident: false,
  tickets: 0,
  ticketsUnservedFor: 0,
  devs: 0,
  devCap: 100,
  cash: 0,
  entropy: 0,
}

describe('§21.7.3 — a hero arrives the first time you feel the problem', () => {
  it('brings Mo when a release ships below baseline on defects alone', () => {
    expect(moArrives(base)).toBe(false)
    expect(moArrives({ ...base, releases: [{ defectDensity: DEFECT_DENSITY_ANCHOR * 2 }] })).toBe(true)
  })

  it('brings Serena when an incident suppresses a tail', () => {
    expect(serenaArrives(base)).toBe(false)
    expect(serenaArrives({ ...base, hasIncident: true })).toBe(true)
  })

  it('brings Matt only after the queue has gone unanswered for a sustained period', () => {
    expect(mattArrives({ ...base, tickets: 40, ticketsUnservedFor: 10 })).toBe(false)
    expect(mattArrives({ ...base, tickets: 40, ticketsUnservedFor: MATT_SUSTAINED_S })).toBe(true)
  })

  it('brings Melany when the cap is hit with cash still in the bank', () => {
    expect(melanyArrives({ ...base, devs: 100, devCap: 100, cash: 1 })).toBe(true)
    expect(melanyArrives({ ...base, devs: 100, devCap: 100, cash: 0 })).toBe(false)
  })

  it('brings Billy past CHATTY, and only outside Run 1', () => {
    expect(billyArrives({ ...base, entropy: CHATTY_TOP + 0.01 })).toBe(true)
    expect(billyArrives({ ...base, paradigmShifts: 0, entropy: CHATTY_TOP + 0.01 })).toBe(false)
  })

  it('has a predicate for every hero except James, who needs none', () => {
    expect(arrivalPredicate('james')).toBeNull()
    for (const id of ['mo', 'serena', 'matt', 'melany', 'billy'] as const) {
      expect(arrivalPredicate(id)).not.toBeNull()
    }
  })
})
