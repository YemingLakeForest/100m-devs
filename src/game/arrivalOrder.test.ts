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
 * The player is `test/pacingProbe.ts`'s — always present, three pokes a second, hires
 * to §4.1's optimum — with two differences that matter for this question: they
 * press SHIP! by hand, a few seconds after a build lands, rather than the
 * instant it does (so SHIP! is a chore and not a test seam), and they never
 * buy Billy's tree, so the order cannot depend on the player having fixed the
 * thing the scene is about.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetStore, __setState, getState, triggerParadigmShift } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import {
  SCENE_BILLY_ARRIVES,
  SCENE_JAMES_PROMOTED,
  SCENE_MATT_ARRIVES,
  SCENE_SERENA_ARRIVES,
} from './scenes.ts'
import { ARRIVAL_GAP_S, SCENE_COOLDOWN_S } from './storyTriggers.ts'
import { PROBE_STEP, createPlayer, playStep } from '../test/pacingProbe.ts'

/** Seconds between a build landing and the player's thumb getting to SHIP!. */
const SHIP_LATENCY = 8

/**
 * Scene ids in the order they first opened, with the simulated minute each did.
 *
 * The player is `test/pacingProbe.ts`'s, and `manualOnly` is the policy that
 * matches this file's claim: it never opens a tree.
 */
function playTwoRuns(run2Seconds: number): Array<{ id: string; minute: number }> {
  const seen: Array<{ id: string; minute: number }> = []
  let run = 1
  let start = 0
  const p = createPlayer({ policy: 'manualOnly', shipLatency: SHIP_LATENCY }, (id) => {
    if (run === 2 && !seen.some((x) => x.id === id)) seen.push({ id, minute: (p.t - start) / 60 })
  })
  for (; run <= 2; run++) {
    __setState({ runSeed: 0x5eed })
    start = p.t
    const limit = run === 1 ? 3 * 3600 : run2Seconds
    while (p.t - start < limit) {
      playStep(p)
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
    // Serena, who is the third. [2026-10-16] And it goes through the cooldown,
    // so it is strictly after her, and before Matt.
    expect(promoted, 'James was never promoted').toBeDefined()
    expect(promoted!).toBeGreaterThan(serena!)
    expect(promoted!).toBeLessThan(matt!)
  })

  /**
   * §21.7.3 [amended 2026-10-16] — a clock may hold a door shut; it may never
   * open one. The audit measured every Run 2 beat inside three minutes; these
   * pin the spacing as a floor, and leave where the beats land to the probe.
   * The player dismisses each scene on the step after it opens, so the minute a
   * scene opened is, to a step, the minute the one before it closed.
   */
  it('spaces the people by the arrival gap, and every scene by the cooldown', { timeout: 120_000 }, () => {
    const seen = playTwoRuns(3600)
    const step = PROBE_STEP / 60

    const people = [SCENE_BILLY_ARRIVES.id, SCENE_SERENA_ARRIVES.id, SCENE_MATT_ARRIVES.id]
    const arrivals = seen.filter((x) => people.includes(x.id))
    expect(arrivals.length).toBe(people.length)
    for (let i = 1; i < arrivals.length; i++) {
      expect(arrivals[i].minute - arrivals[i - 1].minute).toBeGreaterThanOrEqual(ARRIVAL_GAP_S / 60 - step)
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].minute - seen[i - 1].minute).toBeGreaterThanOrEqual(SCENE_COOLDOWN_S / 60 - step)
    }

    // Printed, not asserted (§25.3.2 fixes orders, not numbers): the longest
    // stretch of the hour with nothing said to the player.
    const marks = [0, ...seen.map((x) => x.minute), 60]
    let longest = 0
    let from = 0
    for (let i = 1; i < marks.length; i++) {
      if (marks[i] - marks[i - 1] > longest) [longest, from] = [marks[i] - marks[i - 1], marks[i - 1]]
    }
    console.log(
      `arrivals: ${seen.map((x) => `${x.id.replace('scene.run2.', '')} ${x.minute.toFixed(1)}`).join(', ')}\n` +
        `longest beatless stretch: ${longest.toFixed(1)} min, from minute ${from.toFixed(1)}`,
    )
  })
})
