import { describe, expect, it } from 'vitest'
import {
  BILLY_MIN_SHIFTS,
  BILLY_SUSTAINED_S,
  FOUNDER_BOARD_MIN_DEVS,
  JAMES_PROMOTED_AT,
  MATT_AFTER_SERENA_S,
  MATT_INCIDENTS,
  MATT_SUSTAINED_S,
  SERENA_HAND_RELEASES,
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
  tickets: 0,
  ticketsUnservedFor: 0,
  entropy: 0,
  syncSlippedFor: 0,
  shelfStalledFor: 0,
  handReleases: 0,
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
    expect(serenaArrives({ ...base, handReleases: SERENA_HAND_RELEASES - 1 })).toBe(false)
    expect(serenaArrives({ ...base, handReleases: SERENA_HAND_RELEASES })).toBe(true)
  })

  it('does not bring Serena on an incident — that is Matt’s, now', () => {
    expect(serenaArrives({ ...base, incidents: 5 })).toBe(false)
  })

  it('brings Matt when incidents pile up, and only once Serena is in the building', () => {
    const drowning = { ...base, incidents: MATT_INCIDENTS }
    expect(mattArrives(drowning)).toBe(false)
    expect(mattArrives({ ...drowning, sinceSerena: MATT_AFTER_SERENA_S })).toBe(true)
    expect(mattArrives({ ...base, sinceSerena: MATT_AFTER_SERENA_S, incidents: MATT_INCIDENTS - 1 })).toBe(false)
  })

  it('gives Serena a minute to herself: never on the frame she arrives', () => {
    const pile = { ...base, incidents: MATT_INCIDENTS + 5, tickets: 500, ticketsUnservedFor: 1e4 }
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
    const slipped = { ...base, entropy: SYNC_FELT, syncSlippedFor: BILLY_SUSTAINED_S }
    expect(billyArrives(slipped)).toBe(true)
    expect(billyArrives({ ...slipped, paradigmShifts: BILLY_MIN_SHIFTS - 1 })).toBe(false)
  })

  it('does not bring Billy on a dip that recovers, or on a studio still in sync', () => {
    expect(billyArrives({ ...base, entropy: SYNC_FELT, syncSlippedFor: 0 })).toBe(false)
    expect(billyArrives({ ...base, entropy: SYNC_FELT, syncSlippedFor: BILLY_SUSTAINED_S - 1 })).toBe(false)
    // The clock alone, with the reading back under the line, is not a slip.
    expect(billyArrives({ ...base, entropy: SYNC_FELT / 2, syncSlippedFor: BILLY_SUSTAINED_S })).toBe(false)
  })

  it('needs no collapse for Billy: a studio that stops at §4.1’s optimum still meets him', () => {
    // The old door was entropy ≥ ½, which is D = D_cap. The optimum is 0.758 of
    // the cap, where the reading is well under that and well over SYNC_FELT.
    const L = 0.758
    const entropyAtOptimum = 1 - 1 / (1 + L ** 5)
    expect(entropyAtOptimum).toBeLessThan(0.5)
    expect(entropyAtOptimum).toBeGreaterThan(SYNC_FELT)
    expect(billyArrives({ ...base, entropy: entropyAtOptimum, syncSlippedFor: BILLY_SUSTAINED_S })).toBe(true)
  })

  it('has a predicate for every hero except James, who needs none', () => {
    expect(arrivalPredicate('james')).toBeNull()
    for (const id of ['serena', 'matt', 'billy'] as const) {
      expect(arrivalPredicate(id)).not.toBeNull()
    }
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
