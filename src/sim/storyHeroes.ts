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

export interface StoryHero {
  id: HeroId
  name: string
  branch: HeroBranch
  /** §22.8.2 — the card's flavour line, the voice in one sentence. */
  flavour: string
  /** §21.7.3 — the *feeling* that brings them in, not a number. */
  arrives: string
}

export const STORY_HEROES: readonly StoryHero[] = [
  {
    id: 'james',
    name: 'James',
    branch: 'engineering',
    flavour: 'Small at every rung, and never scales.',
    arrives: 'Act I, fifty pokes, free — the constant across every run',
  },
  {
    id: 'mo',
    name: 'Mo',
    branch: 'quality',
    flavour: 'I’m not blocking it. I’m just asking what happens if someone taps it twice.',
    arrives: 'The first release rated below the §4.14 baseline on defects alone',
  },
  {
    id: 'serena',
    name: 'Serena',
    branch: 'reliability',
    flavour: 'It’s up. It was never really down. It was degraded. There’s a difference and it matters.',
    arrives: 'The first incident to suppress a release’s tail',
  },
  {
    id: 'matt',
    name: 'Matt',
    branch: 'support',
    flavour: 'Four hundred people wrote in about the same button. I don’t know what it does either.',
    arrives: 'The first sustained unserved ticket queue',
  },
  {
    id: 'melany',
    name: 'Melany',
    branch: 'cloud',
    flavour: 'We can absolutely scale to that. I’d want to talk about the bill afterwards. Afterwards is fine.',
    arrives: 'The first time the developer cap is hit with cash still in the bank',
  },
  {
    id: 'billy',
    name: 'Billy',
    branch: 'cohesion',
    flavour: 'I’ve booked fifteen minutes. If we don’t need fifteen minutes, we’ll give them back.',
    arrives: 'The first time the speedometer reads past CHATTY outside Run 1',
  },
]

export const HERO_BY_ID = new Map(STORY_HEROES.map((h) => [h.id, h]))

/** The five who arrive through §21.7.3, in the order the systems decide. */
export const ARRIVAL_HEROES: readonly StoryHero[] = STORY_HEROES.filter((h) => h.id !== 'james')
