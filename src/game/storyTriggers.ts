/**
 * The one rule that drives the story — GDD §21.7, R42.
 *
 * > **A hero arrives the first time the player feels the problem that hero
 * > solves, and never before.** Not at a headcount, not at a shift, not on a
 * > timer.
 *
 * Every predicate here is a *feeling* expressed as a pure function of state:
 * a release that scored badly on defects, an incident that stopped a tail
 * earning, a queue nobody answered. Each is a system the player already has on
 * screen (§21.7.3: "nothing here needs a new counter"), so the scene is the
 * first time the game says out loud what a readout has been saying quietly.
 *
 * Fire-once is not this module's job — the store's `milestones` union already
 * remembers a scene has played. These only answer *would it fire now?*.
 */

import { DEFECT_DENSITY_ANCHOR } from '../sim/rating.ts'
import type { HeroId } from '../sim/storyHeroes.ts'

/** What a release carries that a trigger cares about. */
export interface StoryRelease {
  defectDensity: number
}

/** The state a trigger reads. A snapshot, not `GameState`, so it stays testable. */
export interface StorySnapshot {
  paradigmShifts: number
  releases: readonly StoryRelease[]
  /** §4.12a — is any release's tail being suppressed right now? */
  hasIncident: boolean
  /** §4.13 — the queue depth. */
  tickets: number
  /** Seconds the queue has gone unanswered. "Sustained" needs a clock. */
  ticketsUnservedFor: number
  devs: number
  devCap: number
  cash: number
  /** §4.1 — the entropy reading, 0..1. */
  entropy: number
}

/** §21.7.3 — "a sustained period". A first pass, marked as one. */
export const MATT_SUSTAINED_S = 30

/** §21.7.3 — "past CHATTY". CHATTY ends at 10% (§4.3a); past it is BOGGED DOWN. */
export const CHATTY_TOP = 0.1

/**
 * Mo — Quality. A release is rated below baseline *on defects alone*: it shipped
 * with a density worse than the garage anchor, which is the half of the rating
 * the player watched themselves cause.
 */
export function moArrives(s: StorySnapshot): boolean {
  return s.releases.some((r) => r.defectDensity > DEFECT_DENSITY_ANCHOR)
}

/** Serena — Reliability. A game that *was* earning has stopped, overnight. */
export function serenaArrives(s: StorySnapshot): boolean {
  return s.hasIncident
}

/** Matt — Support. The drab grey bar filled up and nobody is answering it. */
export function mattArrives(s: StorySnapshot): boolean {
  return s.tickets > 0 && s.ticketsUnservedFor >= MATT_SUSTAINED_S
}

/** Melany — Cloud. Tried to solve a problem by hiring and hit the cap with cash spare. */
export function melanyArrives(s: StorySnapshot): boolean {
  return s.devs >= s.devCap && s.cash > 0
}

/** Billy — Cohesion. Met §4.1 as an ongoing condition, not as Run 1's punchline. */
export function billyArrives(s: StorySnapshot): boolean {
  return s.paradigmShifts > 0 && s.entropy >= CHATTY_TOP
}

/** The predicate for a hero, or null for James (who needs no trigger). */
export function arrivalPredicate(id: HeroId): ((s: StorySnapshot) => boolean) | null {
  switch (id) {
    case 'james': return null
    case 'mo': return moArrives
    case 'serena': return serenaArrives
    case 'matt': return mattArrives
    case 'melany': return melanyArrives
    case 'billy': return billyArrives
  }
}
