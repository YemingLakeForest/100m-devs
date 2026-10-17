/**
 * The hour between people — GDD §21.7.8 [added 2026-10-16].
 *
 * Plan 2026-10-16 phase 7.3. §21.7.3's two clocks spread Run 2's three
 * arrivals across twenty-odd minutes, and the audit's other half of finding 04
 * is what fills the gaps: a studio growing from fifty to a thousand people with
 * nobody remarking on it. The plan's ruling is **milestone bubbles, not an event
 * system** — THE THREAD and the event machinery were retired the same week for
 * being a second story engine nobody could reason about, and this must not be
 * a third.
 *
 * So a beat is one line from James in the speech bubble: non-modal, nothing to
 * press, nothing it changes. It fires once a run, on a state the player can
 * already see (the HQ outgrowing its building, a game's payout, the project
 * ladder's last rung, the PARADIGM door lighting), and never waits on §21.7.3's
 * clocks — those hold *scenes* shut, and a line that takes nothing from the
 * player has nothing to wait for. James's lines are about the tool or the
 * process, never the people (§21.7.3 rule 3).
 *
 * Pure — no store, no clock, no renderer. The store asks which beat is due and
 * remembers which were said.
 */

import { HQ_STAGE_UPTO } from './hqLook.ts'

export type MilestoneBeat =
  | 'hq-storey'
  | 'hq-tower'
  | 'hq-campus'
  | 'first-million'
  | 'terminal-rung'
  | 'shift-pays'

/** What the beats read. A snapshot, not `GameState`, so it stays testable. */
export interface MilestoneSnapshot {
  /** Developers on the payroll — the number `hqStage` reads. */
  devs: number
  /** The biggest payout of any release this run. */
  bestPayout: number
  /** The project ladder has reached its last authored rung (§4.4). */
  terminalRung: boolean
  /** §13.2's shift prompt: the PARADIGM door is lit (`shiftPays`). */
  shiftPays: boolean
}

/** §21.7.8 — "a million-dollar game". The first round number a player says aloud. */
export const MILLION_GAME = 1_000_000

/**
 * The HQ crossings, in order: past the garage's twenty, the storey's hundred,
 * the tower's thousand (`hqLook.ts`). Each is the moment the building on screen
 * changes material, so the line lands while the player is looking at why.
 */
const HQ_BEATS: ReadonlyArray<{ beat: MilestoneBeat; past: number }> = [
  { beat: 'hq-storey', past: HQ_STAGE_UPTO.garage },
  { beat: 'hq-tower', past: HQ_STAGE_UPTO.storey },
  { beat: 'hq-campus', past: HQ_STAGE_UPTO.tower },
]

export const MILESTONE_LINES: Readonly<Record<MilestoneBeat, string>> = {
  'hq-storey': 'We’ve taken the flat across the lane. The printer is staying in the garage.',
  'hq-tower': 'A hundred of us. Somebody has started a second fridge.',
  'hq-campus': 'A thousand. The Wi-Fi password is a policy now.',
  'first-million': 'That one made a million. I’m putting it on the fridge.',
  'terminal-rung': 'That’s as big as a game gets. From here we just make more of them.',
  'shift-pays': 'If we started again now, we’d start bigger.',
}

/**
 * The beat to say now, or null — and the beats it makes stale.
 *
 * One at a time, so two lines never fight for one bubble; the store asks again
 * once the bubble has gone. A studio that jumps two HQ stages between asks hears
 * the higher one only: *"a hundred of us"* after the building already holds a
 * thousand is a line about a studio that no longer exists, so the lower beat is
 * returned in `spent` to be marked said without being spoken.
 */
export function nextMilestoneBeat(
  s: MilestoneSnapshot,
  said: ReadonlySet<string>,
): { beat: MilestoneBeat; spent: MilestoneBeat[] } | null {
  const hq = HQ_BEATS.filter((h) => s.devs > h.past && !said.has(h.beat))
  if (hq.length > 0) {
    const top = hq[hq.length - 1].beat
    return { beat: top, spent: hq.slice(0, -1).map((h) => h.beat) }
  }
  if (!said.has('first-million') && s.bestPayout >= MILLION_GAME) return { beat: 'first-million', spent: [] }
  if (!said.has('terminal-rung') && s.terminalRung) return { beat: 'terminal-rung', spent: [] }
  if (!said.has('shift-pays') && s.shiftPays) return { beat: 'shift-pays', spent: [] }
  return null
}
