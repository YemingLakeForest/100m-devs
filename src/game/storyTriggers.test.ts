import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_GAP_S,
  SCENE_COOLDOWN_S,
  arrivalGapPassed,
  sceneCooledDown,
  BILLY_AT_CAP_S,
  BILLY_MIN_SHIFTS,
  BILLY_SUSTAINED_S,
  FOUNDER_BOARD_MIN_DEVS,
  JAMES_PROMOTED_AT,
  MATT_AFTER_SERENA_S,
  MATT_INCIDENTS,
  MATT_SUSTAINED_S,
  SERENA_HAND_SHIP_S,
  SERENA_STALL_S,
  SYNC_FELT,
  arrivalPredicate,
  billyArrives,
  founderBoardArrives,
  jamesPromoted,
  mattArrives,
  serenaArrives,
  type BoardSnapshot,
  type StorySnapshot,
} from './storyTriggers.ts'

const base: StorySnapshot = {
  paradigmShifts: 1,
  incidents: 0,
  incidentsHeld: 0,
  tickets: 0,
  ticketsUnservedFor: 0,
  entropy: 0,
  syncSlippedFor: 0,
  atCapFor: 0,
  shelfStalledFor: 0,
  handShipSeconds: 0,
  sinceSerena: 0,
}

describe('§21.7.3 — a hero arrives the first time you feel the problem', () => {
  // [amended 2026-10-04] Mo and Melany are gone. The three that remain are
  // pinned as claims about *what the feeling is*, and the order they come in is
  // pinned below rather than any time at which they come.
  it('brings Serena when the floor has stood still on a full shelf', () => {
    expect(serenaArrives(base)).toBe(false)
    expect(serenaArrives({ ...base, shelfStalledFor: SERENA_STALL_S - 1 })).toBe(false)
    expect(serenaArrives({ ...base, shelfStalledFor: SERENA_STALL_S })).toBe(true)
  })

  it('brings Serena for the player who never lets it stall, on the chore of SHIP!', () => {
    // An attentive thumb never fills the shelf, so the stall door alone would
    // leave exactly that player without the person who automates it.
    // [2026-10-16] Minutes of it, not presses: a faster cadence must not bring her sooner.
    expect(serenaArrives({ ...base, handShipSeconds: SERENA_HAND_SHIP_S - 1 })).toBe(false)
    expect(serenaArrives({ ...base, handShipSeconds: SERENA_HAND_SHIP_S })).toBe(true)
  })

  it('does not bring Serena on an incident — that is Matt’s, now', () => {
    expect(serenaArrives({ ...base, incidents: 5 })).toBe(false)
  })

  it('brings Matt when incidents pile up, and only once Serena is in the building', () => {
    const drowning = { ...base, incidents: MATT_INCIDENTS, incidentsHeld: MATT_INCIDENTS }
    expect(mattArrives(drowning)).toBe(false)
    expect(mattArrives({ ...drowning, sinceSerena: MATT_AFTER_SERENA_S })).toBe(true)
    expect(
      mattArrives({ ...base, sinceSerena: MATT_AFTER_SERENA_S, incidents: MATT_INCIDENTS - 1, incidentsHeld: MATT_INCIDENTS - 1 }),
    ).toBe(false)
  })

  it('needs the pile to have sat: two pages raised this second are a studio coping', () => {
    // [2026-10-16] Each incident's own age, so a pile cleared and re-raised does
    // not count as one that stayed.
    const fresh = { ...base, sinceSerena: MATT_AFTER_SERENA_S, incidents: MATT_INCIDENTS + 3 }
    expect(mattArrives({ ...fresh, incidentsHeld: MATT_INCIDENTS - 1 })).toBe(false)
    expect(mattArrives({ ...fresh, incidentsHeld: MATT_INCIDENTS })).toBe(true)
  })

  it('gives Serena her stretch: never on the frame she arrives, nor soon after', () => {
    const pile = {
      ...base, incidents: MATT_INCIDENTS + 5, incidentsHeld: MATT_INCIDENTS + 5, tickets: 500, ticketsUnservedFor: 1e4,
    }
    expect(mattArrives({ ...pile, sinceSerena: 0 })).toBe(false)
    expect(mattArrives({ ...pile, sinceSerena: MATT_AFTER_SERENA_S - 1 })).toBe(false)
    expect(mattArrives({ ...pile, sinceSerena: MATT_AFTER_SERENA_S })).toBe(true)
  })

  it('brings Matt for a smaller pile that nobody has answered for a sustained period', () => {
    const open = { ...base, sinceSerena: MATT_AFTER_SERENA_S, incidents: 1, tickets: 40 }
    expect(mattArrives({ ...open, ticketsUnservedFor: MATT_SUSTAINED_S - 1 })).toBe(false)
    expect(mattArrives({ ...open, ticketsUnservedFor: MATT_SUSTAINED_S })).toBe(true)
    // A queue with no incident in it is the founder's problem, not a drowning.
    expect(mattArrives({ ...open, incidents: 0, ticketsUnservedFor: MATT_SUSTAINED_S })).toBe(false)
  })

  it('brings Billy when growth first costs sync, and it stays costing it', () => {
    const slipped = { ...base, entropy: SYNC_FELT, syncSlippedFor: BILLY_SUSTAINED_S, atCapFor: BILLY_AT_CAP_S }
    expect(billyArrives(slipped)).toBe(true)
    expect(billyArrives({ ...slipped, paradigmShifts: BILLY_MIN_SHIFTS - 1 })).toBe(false)
  })

  it('does not bring Billy on a dip that recovers, or on a studio still in sync', () => {
    const wall = { ...base, atCapFor: BILLY_AT_CAP_S }
    expect(billyArrives({ ...wall, entropy: SYNC_FELT, syncSlippedFor: 0 })).toBe(false)
    expect(billyArrives({ ...wall, entropy: SYNC_FELT, syncSlippedFor: BILLY_SUSTAINED_S - 1 })).toBe(false)
    // The clock alone, with the reading back under the line, is not a slip.
    expect(billyArrives({ ...wall, entropy: SYNC_FELT / 2, syncSlippedFor: BILLY_SUSTAINED_S })).toBe(false)
  })

  it('does not bring Billy to a studio that can still hire its way forward (D6: dwell plus the wall)', () => {
    // [2026-10-16] A slip below the wall is a cost the next hire still pays for.
    const slipped = { ...base, entropy: SYNC_FELT, syncSlippedFor: BILLY_SUSTAINED_S }
    expect(billyArrives({ ...slipped, atCapFor: 0 })).toBe(false)
    expect(billyArrives({ ...slipped, atCapFor: BILLY_AT_CAP_S - 1 })).toBe(false)
    expect(billyArrives({ ...slipped, atCapFor: BILLY_AT_CAP_S })).toBe(true)
  })

  it('needs no collapse for Billy: a studio that stops at §4.1’s optimum still meets him', () => {
    // The old door was entropy ≥ ½, which is D = D_cap. The optimum is 0.758 of
    // the cap, where the reading is well under that and well over SYNC_FELT.
    const L = 0.758
    const entropyAtOptimum = 1 - 1 / (1 + L ** 5)
    expect(entropyAtOptimum).toBeLessThan(0.5)
    expect(entropyAtOptimum).toBeGreaterThan(SYNC_FELT)
    expect(
      billyArrives({ ...base, entropy: entropyAtOptimum, syncSlippedFor: BILLY_SUSTAINED_S, atCapFor: BILLY_AT_CAP_S }),
    ).toBe(true)
  })

  it('has a predicate for every hero except James, who needs none', () => {
    expect(arrivalPredicate('james')).toBeNull()
    for (const id of ['serena', 'matt', 'billy'] as const) {
      expect(arrivalPredicate(id)).not.toBeNull()
    }
  })
})

describe('§21.7.3 [2026-10-16] — a clock may hold a door shut; it may never open one', () => {
  it('holds every scene for the cooldown after the last one closed, and not after', () => {
    expect(sceneCooledDown(0, null)).toBe(true)
    expect(sceneCooledDown(100 + SCENE_COOLDOWN_S - 1, 100)).toBe(false)
    expect(sceneCooledDown(100 + SCENE_COOLDOWN_S, 100)).toBe(true)
  })

  it('holds the next person for the arrival gap, which is longer than the cooldown', () => {
    expect(ARRIVAL_GAP_S).toBeGreaterThan(SCENE_COOLDOWN_S)
    expect(arrivalGapPassed(0, null)).toBe(true)
    expect(arrivalGapPassed(100 + ARRIVAL_GAP_S - 1, 100)).toBe(false)
    expect(arrivalGapPassed(100 + ARRIVAL_GAP_S, 100)).toBe(true)
  })

  it('opens nothing on its own: a passed clock with no feeling brings nobody', () => {
    // The clocks are separate functions from the predicates and are only ever
    // ANDed with them; this pins that the predicates alone stay shut at rest.
    expect(arrivalGapPassed(1e6, null) && serenaArrives(base)).toBe(false)
    expect(arrivalGapPassed(1e6, null) && billyArrives(base)).toBe(false)
    expect(arrivalGapPassed(1e6, null) && mattArrives(base)).toBe(false)
  })
})

const board: BoardSnapshot = {
  paradigmShifts: 1,
  founderRate: 0.5,
  swarmRate: 0,
  devs: 0,
}

describe('§21.7.7 — the founder’s board', () => {
  it('opens once your share of the output is a rounding error', () => {
    // The only door since the professions were cut [2026-09-26]; the first
    // specialist hire used to be the other.
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
    const big = { ...board, devs: FOUNDER_BOARD_MIN_DEVS * 10, swarmRate: 200 }
    expect(founderBoardArrives({ ...big, paradigmShifts: 0 })).toBe(false)
  })

  it('never divides by an empty studio', () => {
    expect(founderBoardArrives({ ...board, devs: 1e6, founderRate: 0, swarmRate: 0 })).toBe(false)
  })
})

describe('§21.7.4 — the org chart is who is in the building', () => {
  // [2026-09-26] It was the ladder: James posted on a higher rung than another
  // posted hero. [2026-10-04] It was the second arrival; it is now the third,
  // because the second landed on the same frame as the first and a head of a
  // department of one is not yet the joke.
  it('promotes James once he has a team', () => {
    expect(jamesPromoted(new Set(['james', 'billy', 'serena']))).toBe(true)
    expect(JAMES_PROMOTED_AT).toBe(3)
  })

  it('is not a promotion for being in the building alone, or with one colleague', () => {
    expect(jamesPromoted(new Set(['james']))).toBe(false)
    expect(jamesPromoted(new Set(['james', 'billy']))).toBe(false)
  })

  it('needs James', () => {
    expect(jamesPromoted(new Set(['matt', 'billy', 'serena']))).toBe(false)
    expect(jamesPromoted(new Set())).toBe(false)
  })
})

/**
 * James's Knows a Chap [2026-10-16, plan phase 6.3]: the purchase that calls
 * Billy in before sync slips. A separate term of Billy's predicate, so it is
 * pinned on its own: it opens the door in Run 2 whatever the speedometer says,
 * and never in Run 1.
 */
describe('Knows a Chap', () => {
  it('brings Billy without a slip once it is owned', () => {
    expect(billyArrives({ ...base, knowsAChap: true })).toBe(true)
    expect(billyArrives({ ...base, knowsAChap: false })).toBe(false)
  })

  it('cannot open his door before the second reality', () => {
    expect(billyArrives({ ...base, knowsAChap: true, paradigmShifts: BILLY_MIN_SHIFTS - 1 })).toBe(false)
  })
})
