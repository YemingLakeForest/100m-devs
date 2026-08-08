/**
 * The Desk Query Dialogue Library — GDD §19, as data.
 *
 * §19 exists in the document as six banded lists and has never been in the
 * build: the only per-developer text shipping today is `snippets.ts`, which is
 * code rather than speech. §7.8.8's card needs a **live** line — one that
 * changes while the panel is open — because that is the difference between a
 * window onto a person and a record of one.
 *
 * Lines are §19 verbatim where they fit. Appendix D says text does the comedy
 * work, so paraphrasing one is a content change and a test pins the counts.
 */

import type { DevState } from '../sim/poke.ts'

/** §19.1 — Slacking / Distracted. Pokeable boost opportunities. */
const SLACKING = [
  'If I compile this empty loop 50 times, it looks like my CPU is under heavy load.',
  'Just refactoring my terminal colour scheme to look more hacker-esque.',
  "I've been stuck on Level 4 of 'Flappy Pixel' for two hours. Don't look at my screen.",
  'Writing a script that sends a random Slack message every 12 minutes so I look active.',
  "I'm not slacking, I'm waiting for my coffee to cool to optimum code-writing temperature.",
  "If anyone asks, I'm doing deep architectural research on Reddit.",
] as const

/** §19.2 — High Communication Entropy / Overwhelmed. */
const OVERWHELMED = [
  'WHO TAGGED @everyone IN #random FOR FREE BAGELS?!',
  'I have 4,812 unread messages and 14 overlapping invites for right now.',
  'We are having a meeting to discuss why we have too many meetings.',
  'I just spent 45 minutes resolving a merge conflict that added one semicolon.',
  'Someone changed the API spec while I was typing the function call.',
  'My brain is 99% noise, 1% syntax error.',
] as const

/** §19.3 — Focused / Flow State. */
const FLOW = [
  'Do not speak to me. I have the entire database schema cached in active memory.',
  'I can see the whole call graph. Please do not blink.',
  'Three more minutes and this is done. Three. Not four.',
  'I have not looked at a notification in forty minutes and I feel incredible.',
] as const

/** §19.4 — Rogue Refactorer. */
const ROGUE = [
  'I am rewriting this in a language none of you know. It will be worth it.',
  'I deleted the tests. They were coupling us to the old design.',
  'Do not merge anything. I am restructuring the directory tree.',
  'This abstraction will make everything easier, starting in about six weeks.',
] as const

/** §19.6 — the 10x Engineer, in the moment before they cash out. */
const TENX = [
  'I shipped it. All of it. I am also leaving.',
  'I fixed the bug, the build, and the thing nobody had noticed yet.',
  'I have a competing offer and it is very good.',
] as const

/** The ordinary state, which §19 does not band and which needs lines anyway. */
const WORKING = [
  'It is nearly done. It has been nearly done since Tuesday.',
  'This function has one job and four responsibilities.',
  'I am going to name this variable properly. Later.',
  'Almost. Almost. No.',
  'Whoever wrote this comment was lying.',
  'It compiles. That is not the same as working.',
] as const

const BY_STATE: Record<DevState, readonly string[]> = {
  working: WORKING,
  slacking: SLACKING,
  overwhelmed: OVERWHELMED,
  flow: FLOW,
  rogue: ROGUE,
  tenx: TENX,
}

/**
 * A line for this developer, in this state.
 *
 * Keyed on the developer's *index* as well as the draw, so two people in the
 * same state at the same moment do not say the same thing — which is the one
 * way a shared line pool gives itself away.
 */
export function deskLine(state: DevState, index: number, r: number): string {
  const pool = BY_STATE[state] ?? WORKING
  const at = Math.floor(r * pool.length) + index
  return pool[((at % pool.length) + pool.length) % pool.length]
}

export const DESK_LINES = BY_STATE
