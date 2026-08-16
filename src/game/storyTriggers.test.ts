import { describe, expect, it } from 'vitest'
import { DEFECT_DENSITY_ANCHOR } from '../sim/rating.ts'
import {
  CHATTY_TOP,
  FOUNDER_BOARD_MIN_DEVS,
  HERO_BOARD_MIN_LEVEL,
  MATT_SUSTAINED_S,
  arrivalPredicate,
  billyArrives,
  founderBoardArrives,
  heroBoardArrives,
  jamesPromoted,
  mattArrives,
  melanyArrives,
  moArrives,
  serenaArrives,
  type BoardSnapshot,
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

const board: BoardSnapshot = {
  paradigmShifts: 1,
  founderRate: 0.5,
  swarmRate: 0,
  devs: 0,
  specialists: 0,
  heroPoints: 0,
  heroLevel: 1,
}

describe('§21.7.7 — the founder’s board, and its two doors', () => {
  it('opens on the first hire the founder cannot do the job of', () => {
    // The beat. §4.11's dial only offers a specialist after §21.7.6 has brought
    // the hero who makes the problem legible, so this door opens behind Mo,
    // Serena or Matt and never before one of them.
    expect(founderBoardArrives({ ...board, specialists: 1 })).toBe(true)
  })

  it('opens anyway once your share of the output is a rounding error', () => {
    // The guarantee. A player who only ever hires developers must still be able
    // to reach their own skill board.
    const big = { ...board, devs: FOUNDER_BOARD_MIN_DEVS, swarmRate: 20 }
    expect(founderBoardArrives(big)).toBe(true)
    // 0.5 of 5.5 is nine per cent — still a real share of a small company.
    expect(founderBoardArrives({ ...big, swarmRate: 5 })).toBe(false)
  })

  /**
   * The first cut of this trigger was §4.5d's other sentence — *your output
   * overtakes the average developer's* — and it is wrong in a way worth keeping
   * a test for: it only ever fires for a studio hired **past** §4.1's optimum,
   * so a player who reads the speedometer and stops at the right headcount
   * would never see the scene.
   */
  it('fires for a studio held at §4.1’s optimum, which the old rule did not', () => {
    // 0.758 of the cap is the optimum; the swarm is producing about 0.8 each,
    // comfortably more than the founder's 0.5.
    const optimal = { ...board, devs: 100, swarmRate: 80 }
    expect(optimal.founderRate).toBeLessThan(optimal.swarmRate / optimal.devs)
    expect(founderBoardArrives(optimal)).toBe(true)
  })

  it('never opens during Run 1', () => {
    expect(founderBoardArrives({ ...board, paradigmShifts: 0, specialists: 3 })).toBe(false)
  })

  it('never divides by an empty studio', () => {
    expect(founderBoardArrives({ ...board, devs: 1e6, founderRate: 0, swarmRate: 0 })).toBe(false)
  })
})

describe('§21.7.7 — the hero board, and the level somebody earned', () => {
  it('waits for a level past the one they walked in with', () => {
    // Every hero arrives at level 1 holding a point (§13.13), so a points-only
    // trigger would fire on the frame after James finished speaking at the top
    // of Run 2 — a pile, which is exactly what §13.12.2 spreads these out to
    // avoid. It also means XP has accrued, which means somebody is *placed*,
    // which is what the board's REACH and DEPTH nodes are about.
    expect(heroBoardArrives({ ...board, heroLevel: 1, heroPoints: 1 })).toBe(false)
    expect(heroBoardArrives({ ...board, heroLevel: HERO_BOARD_MIN_LEVEL, heroPoints: 1 })).toBe(true)
  })

  it('waits for a point, so the board is never a screen with no currency', () => {
    expect(heroBoardArrives({ ...board, heroLevel: 9, heroPoints: 0 })).toBe(false)
  })

  it('never opens during Run 1', () => {
    expect(heroBoardArrives({ ...board, paradigmShifts: 0, heroLevel: 9, heroPoints: 4 })).toBe(false)
  })
})

describe('§21.7.4 — the ladder is the org chart', () => {
  it('promotes James the first time somebody is standing below him', () => {
    expect(jamesPromoted([{ id: 'james', rung: 3 }, { id: 'mo', rung: 0 }])).toBe(true)
  })

  it('says nothing about two people side by side', () => {
    // Strictly below. Two heroes on the same rung are colleagues, which is the
    // whole joke of the title he is about to be given.
    expect(jamesPromoted([{ id: 'james', rung: 3 }, { id: 'mo', rung: 3 }])).toBe(false)
  })

  it('says nothing when James is the one being stood over', () => {
    expect(jamesPromoted([{ id: 'james', rung: 0 }, { id: 'mo', rung: 3 }])).toBe(false)
  })

  it('needs James to be at work', () => {
    expect(jamesPromoted([{ id: 'mo', rung: 0 }, { id: 'billy', rung: 3 }])).toBe(false)
    expect(jamesPromoted([])).toBe(false)
  })

  it('is not a promotion for standing on the floor alone', () => {
    expect(jamesPromoted([{ id: 'james', rung: 3 }])).toBe(false)
  })
})
