/**
 * The fun-killers probe — plan 2026-10-16, phase 1.
 *
 * Prints, minute by minute, an hour of Run 2 for each of the audit's three
 * players (`docs/AUDIT-2026-10-16-fun-killers.html`): what opened, how big the
 * studio is, how fast it ships, who pressed SHIP!, how long the floor stood
 * still, and what Matt's side of the books looked like. Every phase of the plan
 * re-prints it and pastes it into the commit, so the table is the plan's
 * before-and-after.
 *
 * **Skipped unless asked for**: `PROBE=1 npx vitest run src/game/pacingProbe.test.ts`
 * or `npm run probe:pacing` (`--mode probe`, which is the cross-platform way to
 * set the same switch from an npm script on Windows). Three simulated hours is
 * slow for the gate, and nothing here asserts — §25.3.2 fixes orders, not
 * numbers, and the orders are pinned where they belong (`arrivalOrder.test.ts`,
 * `economy.test.ts`).
 */

import { afterEach, beforeEach, describe, it } from 'vitest'
import { __resetStore, __setState } from './store.ts'
import { emptyPermanent, setPermanent } from './save.ts'
import { pinClocks, probeRunTwo, probeTable, type ProbePolicy } from '../test/pacingProbe.ts'

const ENABLED = import.meta.env.PROBE === '1' || import.meta.env.MODE === 'probe'

const MINUTES = 60
/** The audit's thumb: SHIP! eight seconds after a build lands. */
const SHIP_LATENCY = 8
const POLICIES: ProbePolicy[] = ['careful', 'greedy', 'manualOnly']

let unpin: () => void = () => {}

beforeEach(() => {
  unpin = pinClocks()
  __resetStore()
  setPermanent(emptyPermanent())
  __setState({ runSeed: 0x5eed })
})

afterEach(() => {
  __resetStore()
  setPermanent(emptyPermanent())
  unpin()
})

describe.skipIf(!ENABLED)('pacing probe — an hour of Run 2, per minute', () => {
  for (const policy of POLICIES) {
    it(`${policy}, SHIP! at ${SHIP_LATENCY}s`, { timeout: 600_000 }, () => {
      const rows = probeRunTwo({ policy, shipLatency: SHIP_LATENCY }, MINUTES)
      console.log(`\n${probeTable(`— ${policy} —`, rows)}\n`)
    })
  }
})
