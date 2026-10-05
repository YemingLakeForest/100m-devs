/**
 * The story roster — GDD §22.8, R38.
 *
 * §13.6.3's nine cards were *job titles* standing in for people who did not
 * exist, and §22.5's twelve were mostly gated behind late-game milestones nobody
 * reached. **These four are the people** [amended 2026-10-04: six became four —
 * *"remove them entirely"*, of Mo and Melany]. They are named, each owns a
 * branch of §13.9's board, and each one walks through a door in §21.7.3 the
 * first time the player feels the problem they solve.
 *
 * Mo (Quality) and Melany (Cloud) are gone, with their scenes, their branches
 * and their two traits. Their jobs were not left standing: the defect counter
 * that was Mo's instrument is Serena's (her pipeline already carries the
 * quality gate that catches a build's defects as it joins the queue), and the
 * developer cap that was Melany's trait is now bought only through the
 * Paradigm Tree and the protocols — which is where §4.2 always said it came from.
 *
 * The flavour line is the card's, §22.8.2's, verbatim — it is the voice in one
 * sentence, and §21.7.3's scenes are written out of it.
 */

import type { HeroBranch } from './heroBranches.ts'

export type HeroId = 'james' | 'serena' | 'matt' | 'billy'

/**
 * §21.7.6 — an instrument this hero puts on the HUD when they sit down.
 *
 * The *mechanism* has been running since the first frame of the run; what waits
 * is the readout, the colour and the role on §10.10's dial. **A person only
 * brings what was not already there**, and a person may bring more than one:
 * Matt brings both halves of what lands on the player after a ship.
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
export type HeroIdle = 'typing' | 'watching' | 'headset' | 'whiteboard'

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
   * of the four carries theirs instead: it is who they are (§13.9.1), it is the
   * only thing on §22.9's card written in a sentence, and it cannot be ground.
   */
  trait: { name: string; text: string }
  /** §7.8.13 — what they are always doing, on the floor, forever. */
  idle: HeroIdle
  /** §21.7.6 — the HUD instruments they hand over; empty if nothing is new. */
  brings: readonly Instrument[]
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
    brings: [],
    role: 'ENGINEERING',
  },
  /**
   * Serena — and her door moved [amended 2026-10-04]. She used to arrive on the
   * first incident, forty-odd minutes into Run 2; her scene has been about the
   * build queue since 2026-10-03, so the trigger now is the queue. She arrives
   * when the shelf has become what is stopping the studio earning: the floor
   * held still on a full shelf, or the player's thumb on SHIP! for the umpteenth
   * time. See `game/storyTriggers.ts`.
   *
   * Her trait is the pipeline's. *WROTE THE RUNBOOK* (a page starts half worked,
   * one developer in fifty on call) went to Matt with the incident list.
   */
  {
    id: 'serena',
    name: 'Serena',
    branch: 'reliability',
    flavour: 'It’s up. It was never really down. It was degraded. There’s a difference and it matters.',
    arrives: 'The build queue is the bottleneck: the floor stopped on a full shelf, or SHIP! pressed by hand once too often',
    trait: {
      name: 'DEGRADED, NOT DOWN',
      text: 'The build queue holds two more builds before it stops the floor.',
    },
    idle: 'watching',
    brings: ['defects'],
    role: 'SITE RELIABILITY',
  },
  /**
   * Matt — and he now owns *everything that lands on the player after a ship*
   * [amended 2026-10-04]: the incident list and the ticket bar, and the runbook
   * trait that used to be Serena's. He arrives when those are drowning the
   * studio, which is after the pipeline has been dealt with, on purpose.
   */
  {
    id: 'matt',
    name: 'Matt',
    branch: 'support',
    flavour: 'Four hundred people wrote in about the same button. I don’t know what it does either.',
    arrives: 'Incidents and tickets are piling up faster than the studio clears them',
    trait: {
      name: 'KNOWS THEIR NAMES',
      text: 'Catalogue tickets arrive 20% slower, new incidents open half worked, and one developer in twenty answers the queue.',
    },
    idle: 'headset',
    brings: ['incidents', 'tickets'],
    role: 'CUSTOMER SUPPORT',
  },
  /**
   * §21.7.3 amended 2026-08-29 — **Billy is the one hero somebody introduces.**
   *
   * The others walk through a door because the player felt a problem. Billy is
   * walked *in*, by James, because the studio is losing sync to its own
   * headcount and James knows a chap. [Amended 2026-10-04: the door is the
   * *first felt cost of growth*, not the collapse — sync falling as the studio
   * grows is the core of the game, and his meeting tree is how it is pushed
   * back.] See `game/storyTriggers.ts` for the trigger and `game/scenes.ts` for
   * the scene.
   *
   * **His voice is refined and he is never doing a bit.** He is not sending
   * anybody up and he is not aware there is anything to send up — he says
   * *shan't* and *one* and *terribly* because that is how he was taught to
   * speak, which is exactly the register §21.7.0 rule 2 asks of James in a
   * different key. The comedy is the founder's total failure to place any of
   * it, never Billy being mocked for it.
   *
   * `role` is `SCRUM MASTER` and not `DELIVERY` [amended 2026-08-29]. §22.8.1
   * has said *“'Scrum Master' is what Billy* is” since the old rosters were
   * folded into this one; the roster entry was the last place still calling him
   * a department, and a department is not a person.
   */
  {
    id: 'billy',
    name: 'Billy',
    branch: 'cohesion',
    flavour: 'I’ve taken the liberty of booking a quarter of an hour. If we shan’t need it, we shall give it back.',
    arrives: 'Sync first slips as the studio grows — and James knows a chap',
    trait: {
      name: 'FIFTEEN MINUTES',
      text: 'Daily Standups run to fifteen minutes, and half the floor keeps working through them.',
    },
    idle: 'whiteboard',
    brings: [],
    role: 'SCRUM MASTER',
  },
]

export const HERO_BY_ID = new Map(STORY_HEROES.map((h) => [h.id, h]))

/** The three who arrive through §21.7.3, in the order the systems decide. */
export const ARRIVAL_HEROES: readonly StoryHero[] = STORY_HEROES.filter((h) => h.id !== 'james')
