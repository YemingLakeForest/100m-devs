/**
 * Who walks through the door, in what order — GDD §21.7.3 [amended 2026-10-04].
 *
 * The triggers are pinned one at a time in `storyTriggers.test.ts`; this is the
 * join, and it pins the claim the user made about the *story*, not about any
 * clock: **Billy (sync first slips as the studio grows), then Serena (the
 * build queue is the bottleneck), then Matt (incidents and tickets are piling
 * up).** §25.3.2 fixes an order and refuses to fix the numbers, so nothing here
 * asserts a time.
 *
 * The player is `pacing.test.ts`'s — always present, three pokes a second, hires
 * to §4.1's optimum — with two differences that matter for this question: they
 * press SHIP! by hand, a few seconds after a build lands, rather than the
 * instant it does (so SHIP! is a chore and not a test seam), and they never
 * buy Billy's tree, so the order cannot depend on the player having fixed the
 * thing the scene is about.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetStore, __setState, dismissScene, effectiveDevCap, getState, hireDeveloper,
  launchRelease, massHire, nextHireCost, openLaunch, poke, takeSeedRound, tick,
  triggerParadigmShift,
} from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { payrollPerSecond } from '../sim/economy.ts'
import { TRAIN_LAUNCH } from '../sim/release.ts'
import {
  SCENE_BILLY_ARRIVES,
  SCENE_JAMES_PROMOTED,
  SCENE_MATT_ARRIVES,
  SCENE_SERENA_ARRIVES,
} from './scenes.ts'

const STEP = 0.25
/** Seconds between a build landing and the player's thumb getting to SHIP!. */
const SHIP_LATENCY = 8

/** Scene ids in the order they first opened, with the simulated minute each did. */
function playTwoRuns(run2Seconds: number): Array<{ id: string; minute: number }> {
  const seen: Array<{ id: string; minute: number }> = []
  for (const run of [1, 2]) {
    __setState({ runSeed: 0x5eed })
    const limit = run === 1 ? 3 * 3600 : run2Seconds
    let t = 0
    let owed = 0
    let waited = 0
    while (t < limit) {
      const s = getState()
      if (s.scene !== null) {
        if (run === 2 && !seen.some((x) => x.id === s.scene)) seen.push({ id: s.scene, minute: t / 60 })
        dismissScene()
      }
      if (!s.seedTaken) takeSeedRound()
      if (s.phase === 'act3_bait' && s.scene === null) massHire()
      owed += 3 * STEP
      while (owed >= 1) {
        poke(0, 0, { rung: 0, index: 0 })
        owed -= 1
      }
      for (;;) {
        const h = getState()
        if (h.cash - nextHireCost() <= 30 * payrollPerSecond(h.devs + 1)) break
        if (h.devs >= effectiveDevCap() * 0.758) break
        if (!hireDeveloper()) break
      }
      tick(STEP)
      if (getState().shelf.length > 0) {
        waited += STEP
        if (waited >= SHIP_LATENCY && openLaunch()) {
          launchRelease(TRAIN_LAUNCH)
          waited = 0
        }
      } else waited = 0
      t += STEP
      if (run === 1 && getState().phase === 'bankrupt') break
    }
    if (run === 1) triggerParadigmShift()
  }
  return seen
}

beforeEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  __setState({ runSeed: 0x5eed })
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
})

describe('§21.7.3 — the order the cast arrives in', () => {
  it('brings Billy, then Serena, then Matt, and promotes James only once he has a team', { timeout: 120_000 }, () => {
    const seen = playTwoRuns(3600)
    const at = (id: string) => seen.find((x) => x.id === id)?.minute

    const billy = at(SCENE_BILLY_ARRIVES.id)
    const serena = at(SCENE_SERENA_ARRIVES.id)
    const matt = at(SCENE_MATT_ARRIVES.id)
    const promoted = at(SCENE_JAMES_PROMOTED.id)

    // A careful player who stops at §4.1's optimum meets all three. The old
    // Billy waited for a collapse such a player never has.
    expect(billy, 'Billy never arrived').toBeDefined()
    expect(serena, 'Serena never arrived').toBeDefined()
    expect(matt, 'Matt never arrived').toBeDefined()

    expect(billy!).toBeLessThan(serena!)
    expect(serena!).toBeLessThan(matt!)

    // The third person in the building is the promotion — so it cannot precede
    // Serena, who is the third.
    expect(promoted, 'James was never promoted').toBeDefined()
    expect(promoted!).toBeGreaterThanOrEqual(serena!)
  })
})
