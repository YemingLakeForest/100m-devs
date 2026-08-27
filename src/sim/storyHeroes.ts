/**
 * The story roster — GDD §22.8, R38.
 *
 * §13.6.3's nine cards were *job titles* standing in for people who did not
 * exist, and §22.5's twelve were mostly gated behind late-game milestones nobody
 * reached. **These six are the people.** They are named, each owns a branch of
 * §13.9's board, and each one walks through a door in §21.7.3 the first time the
 * player feels the problem they solve.
 *
 * The flavour line is the card's, §22.8.2's, verbatim — it is the voice in one
 * sentence, and §21.7.3's scenes are written out of it.
 */

import type { HeroBranch } from './heroTree.ts'

export type HeroId = 'james' | 'mo' | 'serena' | 'matt' | 'melany' | 'billy'

/**
 * §21.7.6 — the instrument this hero puts on the HUD when they sit down.
 *
 * The *mechanism* has been running since the first frame of the run; what waits
 * is the readout, the colour and the role on §10.10's dial. `null` is not an
 * omission — Melany and Billy bend systems the player has been fighting since
 * Run 1 (§4.2's cap, §4.3's speedometer), so there is nothing for them to
 * introduce. **A person only brings what was not already there.**
 */
export type Instrument = 'defects' | 'incidents' | 'tickets'

/**
 * §7.8.13 — the one thing this hero is always doing.
 *
 * Everybody else on the floor has ambient states; a hero has one behaviour and
 * it never changes. It is the whole of R51's "extremely distinct", it costs one
 * animation each, and it is how a player learns who Billy is — because Billy is
 * the one at the whiteboard.
 */
export type HeroIdle = 'typing' | 'reading' | 'watching' | 'headset' | 'pacing' | 'whiteboard'

export interface StoryHero {
  id: HeroId
  name: string
  branch: HeroBranch
  /** §22.8.2 — the card's flavour line, the voice in one sentence. */
  flavour: string
  /** §21.7.3 — the *feeling* that brings them in, not a number. */
  arrives: string
  /**
   * §22.9.2 — the signature trait, arrived with and never bought.
   *
   * §13.6.4's TRAIT kind is GP-priced (§13.6.5a) and GP is Layer 2, so a
   * purchasable trait would be a permanently unbuyable node on the board. Each
   * of the six carries theirs instead: it is who they are (§13.9.1), it is the
   * only thing on §22.9's card written in a sentence, and it cannot be ground.
   */
  trait: { name: string; text: string }
  /** §7.8.13 — what they are always doing, on the floor, forever. */
  idle: HeroIdle
  /** §21.7.6 — the HUD instrument they hand over, or null if nothing is new. */
  brings: Instrument | null
  /** §22.9.2 — the role line in the card's footer. Promotions extend it, never replace it. */
  role: string
}

export const STORY_HEROES: readonly StoryHero[] = [
  {
    id: 'james',
    name: 'James',
    branch: 'engineering',
    // §13.9.1 amended 2026-08-27 — the card no longer says he is bad at things,
    // because the arithmetic no longer says it either. It says the thing that is
    // still true: he has no speciality, and he does whatever he is pointed at
    // properly (§21.7.0 rule 1).
    flavour: 'No speciality. Point him at anything; he does it properly.',
    arrives: 'Act I, fifty pokes, free — the constant across every run',
    trait: {
      name: 'FEWER COMMITMENTS',
      text: 'Daily Standups never pause James’s own developer output.',
    },
    idle: 'typing',
    brings: null,
    role: 'ENGINEERING',
  },
  {
    id: 'mo',
    name: 'Mo',
    branch: 'quality',
    flavour: 'I’m not blocking it. I’m just asking what happens if someone taps it twice.',
    arrives: 'The first release rated below the §4.14 baseline on defects alone',
    trait: {
      name: 'READS IT TWICE',
      text: 'Work inside Mo’s coverage generates half as many defects before release.',
    },
    idle: 'reading',
    brings: 'defects',
    role: 'QUALITY ASSURANCE',
  },
  {
    id: 'serena',
    name: 'Serena',
    branch: 'reliability',
    flavour: 'It’s up. It was never really down. It was degraded. There’s a difference and it matters.',
    arrives: 'The first incident to suppress a release’s tail',
    trait: {
      name: 'WROTE THE RUNBOOK',
      text: 'A new incident opens up to half worked, scaled by Serena’s coverage.',
    },
    idle: 'watching',
    brings: 'incidents',
    role: 'SITE RELIABILITY',
  },
  {
    id: 'matt',
    name: 'Matt',
    branch: 'support',
    flavour: 'Four hundred people wrote in about the same button. I don’t know what it does either.',
    arrives: 'The first sustained unserved ticket queue',
    trait: {
      name: 'KNOWS THEIR NAMES',
      text: 'Catalogue tickets arrive up to 20% slower, scaled by Matt’s coverage.',
    },
    idle: 'headset',
    brings: 'tickets',
    role: 'CUSTOMER SUPPORT',
  },
  {
    id: 'melany',
    name: 'Melany',
    branch: 'cloud',
    flavour: 'We can absolutely scale to that. I’d want to talk about the bill afterwards. Afterwards is fine.',
    arrives: 'The first time the developer cap is hit with cash still in the bank',
    trait: {
      name: 'RESERVED INSTANCES',
      text: 'Adds up to 25% capacity immediately. Reserved coverage costs $1 per developer each second.',
    },
    idle: 'pacing',
    brings: null,
    role: 'CLOUD PLATFORM',
  },
  {
    id: 'billy',
    name: 'Billy',
    branch: 'cohesion',
    flavour: 'I’ve booked fifteen minutes. If we don’t need fifteen minutes, we’ll give them back.',
    arrives: 'The first time the speedometer reads past CHATTY outside Run 1',
    trait: {
      name: 'FIFTEEN MINUTES',
      text: 'Daily Standups do not pause developers inside Billy’s coverage.',
    },
    idle: 'whiteboard',
    brings: null,
    role: 'DELIVERY',
  },
]

export const HERO_BY_ID = new Map(STORY_HEROES.map((h) => [h.id, h]))

/** The five who arrive through §21.7.3, in the order the systems decide. */
export const ARRIVAL_HEROES: readonly StoryHero[] = STORY_HEROES.filter((h) => h.id !== 'james')
