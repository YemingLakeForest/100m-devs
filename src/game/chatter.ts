/**
 * What people say to each other — GDD §7.8.6, drawing on §19.
 *
 * §7.8.6 said "nothing new needs writing: §19's Desk Query Dialogue Library
 * already has state-banded lines". That is true of what a developer says when
 * *you* interrupt them and false of what they say to each other, because §19's
 * lines are all addressed to the player. An office overheard is a different
 * register: fragments, half-conversations, and things that are only funny
 * because you did not hear the start.
 *
 * The bubbles were abstract dashes first. That reads instantly as *speech* and
 * says nothing, and it turns out to be the wrong trade: this is the cheapest
 * comedy surface in the product — one string, no art — and leaving it wordless
 * spends the animation and keeps none of the joke.
 *
 * Lines are short on purpose. A bubble over a developer on a floor of forty has
 * room for about thirty characters before it stops being a bubble and starts
 * being a paragraph with a tail.
 */

/** Said by one person, to nobody in particular. */
export const CHATTER: readonly string[] = [
  'it works on my machine',
  'who owns this file',
  'I did not touch that',
  'is the build red again',
  'that was not me',
  'quick question, non-urgent',
  'has anyone seen the spec',
  'the spec changed',
  'I will document it later',
  'this is temporary',
  'we can refactor it after ship',
  'is standup still on',
  'sorry, I was on mute',
  'let me just rebase',
  'why is this file 4000 lines',
  'do not merge yet',
  'I merged it',
  'reverting',
  'that is a known issue',
  'add a ticket for it',
  'it is in the backlog',
  'the backlog is fine',
]

/**
 * A two-line exchange — §7.8.6: "the joke in an interruption is the reply".
 *
 * Kept as pairs rather than as two independent draws, because two unrelated
 * lines side by side read as two people ignoring each other, which is a
 * different and much later joke.
 */
export const EXCHANGES: ReadonlyArray<readonly [string, string]> = [
  ['quick question —', 'it is never a quick question'],
  ['do you have five minutes', 'I have four'],
  ['who wrote this', 'you did'],
  ['is this blocking you', 'everything is blocking me'],
  ['can you review my PR', 'how big is it'],
  ['it is small', 'it is 2000 lines'],
  ['should we sync on this', 'we are syncing now'],
  ['I will send a calendar invite', 'please do not'],
  ['did we decide this already', 'twice'],
  ['whose ticket is this', 'nobody has claimed it'],
  ['I think it is done', 'define done'],
  ['are we shipping today', 'we are always shipping today'],
  ['what does this function do', 'nobody knows'],
  ['let us take it offline', 'we are offline'],
  ['is there a doc for this', 'there is a doc for the doc'],
]

/** Said while walking to the cooler, or standing at it. */
export const LOITER: readonly string[] = [
  'just getting water',
  'stretching my legs',
  'thinking about the problem',
  'this counts as work',
  'back in a second',
  'I needed that',
  'anyway',
]

/**
 * Pick a line for a behaviour, deterministically.
 *
 * `r` is a uniform 0..1 from the caller's source, so the floor is reproducible
 * under test and — more importantly — the same conversation does not reshuffle
 * its own words on every frame it is redrawn.
 */
export function chatterLine(r: number): string {
  return CHATTER[Math.min(CHATTER.length - 1, Math.floor(r * CHATTER.length))]
}

export function loiterLine(r: number): string {
  return LOITER[Math.min(LOITER.length - 1, Math.floor(r * LOITER.length))]
}

export function exchange(r: number): readonly [string, string] {
  return EXCHANGES[Math.min(EXCHANGES.length - 1, Math.floor(r * EXCHANGES.length))]
}

/** The longest line anything above will ever produce. Bubbles are sized to it. */
export const LONGEST = Math.max(
  ...CHATTER.map((l) => l.length),
  ...LOITER.map((l) => l.length),
  ...EXCHANGES.flatMap(([a, b]) => [a.length, b.length]),
)
