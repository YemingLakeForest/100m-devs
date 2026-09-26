/*
 * Copied from the rebuild (100m-devs-three/src/art/stateLights.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * The colour of a developer's light — GDD §12.3 [amended 2026-09-23].
 *
 * One family, used for one thing: what a developer is doing. A monitor on the
 * floor, a window on a tower, a roof tile in the city, a city on the planet and
 * the Output card's strip all read from here, so a meeting is the same blue at
 * every distance and in the HUD that explains it. That sameness is the whole
 * point of the zoom — a colour that shifted between scales would be a seam.
 *
 * It is the one exception to §12.3's "the saturated element per screen is
 * zero", and it is carved narrowly: world lights and the strip that is their
 * key. No control, panel or button takes these values.
 */
import type { WorkState } from '../sim/losses.ts'

export const STATE_LIGHT: Record<WorkState, string> = {
  work: '#f2b84b',
  slack: '#b3a996',
  meet: '#4f97d1',
  wait: '#d98341',
  onboard: '#3a9aa6',
  dup: '#cc6047',
  handoff: '#1f6b7a',
  lag: '#3d5f9e',
}

export const STATE_LABEL: Record<WorkState, string> = {
  work: 'Working',
  slack: 'Wandered off',
  meet: 'In a meeting',
  wait: 'Waiting',
  onboard: 'Onboarding',
  dup: 'Duplicate work',
  handoff: 'Waiting for a handoff',
  lag: 'Light-lag',
}

/** What each loss is, in the studio's words, for the Output card's list. */
export const STATE_CAUSE: Record<WorkState, string> = {
  work: 'At the desk, writing the game.',
  slack: 'Water cooler, sofa, window.',
  meet: 'Everybody talking to everybody.',
  wait: 'Blocked on another building, or on the build queue.',
  onboard: 'New hires, still borrowing their mentors.',
  dup: 'Two campuses writing the same system.',
  handoff: 'Half the planet is asleep.',
  lag: 'Other worlds are years away by radio.',
}
