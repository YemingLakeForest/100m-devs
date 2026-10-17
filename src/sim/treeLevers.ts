/**
 * What the founder's and Matt's trees do — GDD §8 [wired 2026-10-04]; James's
 * from 2026-10-16 (plan phase 6, at the end of this file).
 *
 * Found by playing: after the board stopped selling nodes that change nothing
 * (`upgradeTrees.isBuilt`), the founder's tree and Matt's had *nothing* left to
 * buy, and a hero whose card opens onto an empty board is a hero with nothing to
 * give the player. Each of the nodes below is wired to a seam that already
 * existed and was waiting for it: the founder's to `FounderEffects`
 * (`founder.ts`, whose own note says it is *"the vocabulary a tree node can be
 * wired to"*), Matt's to the hero fold (`heroRoster.ts`) that his card already
 * reads.
 *
 * The numbers are first passes, and the claims the tests pin are about shape:
 * every wired node moves its lever the right way, an empty save moves nothing,
 * and no lever can be driven past a floor that would break the economy under it.
 *
 * Pure — no store, no clock, no renderer.
 */

import { FOUNDER_BASE_RATE, FOUNDER_TAP_SECONDS, NO_FOUNDER, type FounderEffects } from './founder.ts'
import { HIRE_COST_GROWTH } from './economy.ts'
import { treeKey, type TreeHero } from './upgradeTrees.ts'
import type { HeroFold } from './heroRoster.ts'

type Levels = Readonly<Record<string, number>> | undefined

const level = (levels: Levels, hero: TreeHero, id: string, max: number): number =>
  Math.min(max, Math.max(0, Math.floor(levels?.[treeKey(hero, id)] ?? 0)))

// --- the founder ------------------------------------------------------------

/** Second Monitor: your own desk writes a third more. The one output that never dilutes. */
export const SECOND_MONITOR_RATE = 1.3
/** Look Over Their Shoulder: a poke interrupts the person a little less. */
export const SHOULDER_CONTEXT_SCALE = 0.85
/** Hiring Dial: each level takes this much off the *step* of §4.10a's hire-cost growth. */
export const HIRING_DIAL_STEP = 0.88

/**
 * The founder, with the tree on them. `NO_FOUNDER` for an empty save — which is
 * the founder every player started as, so nothing moves until somebody buys.
 */
export function founderFromTree(levels: Levels): FounderEffects {
  const monitor = level(levels, 'you', 'y1', 1)
  const shoulder = level(levels, 'you', 'p1', 1)
  const dial = level(levels, 'you', 'h2', 5)
  if (monitor + shoulder + dial === 0) return NO_FOUNDER
  const rate = FOUNDER_BASE_RATE * (monitor ? SECOND_MONITOR_RATE : 1)
  return {
    ...NO_FOUNDER,
    rate,
    tapValue: rate * FOUNDER_TAP_SECONDS,
    contextSwitchScale: shoulder ? SHOULDER_CONTEXT_SCALE : 1,
    // The *base* of the growth, not a discount (see `FounderEffects.hireGrowth`):
    // the step above 1 shrinks by a constant factor per level and never reaches 1.
    hireGrowth: 1 + (HIRE_COST_GROWTH - 1) * HIRING_DIAL_STEP ** dial,
  }
}

// --- Matt -------------------------------------------------------------------

/** Inbox: the help desk answers this much faster, per level, compounding. */
export const INBOX_SUPPORT_STEP = 1.15
/** Second Headset: this share of the headcount joins the help desk, per level. */
export const HEADSET_SHARE = 0.01
/** Macros: the catalogue asks this fraction as many questions. */
export const MACROS_TICKET_RATE = 0.9
/** Matt resolving (Headset): heads clearing incidents, flat. */
export const HEADSET_ONCALL_HEADS = 1
/** Incident Inspector: a new incident opens this fraction as much work. */
export const INSPECTOR_START_WORK = 0.8
/** An FAQ People Read: the catalogue asks half as many questions. */
export const FAQ_TICKET_RATE = 0.5

/**
 * Matt's tree, applied to the fold his card already reads. Returns the fold
 * untouched for a save that has bought nothing of his.
 */
export function withMattTree(fold: HeroFold, levels: Levels, devs: number): HeroFold {
  const inbox = level(levels, 'matt', 't1', 5)
  const headsets = level(levels, 'matt', 't2', 5)
  const macros = level(levels, 'matt', 'h1', 1)
  const headset = level(levels, 'matt', 'm1', 1)
  const inspector = level(levels, 'matt', 'i1', 1)
  const faq = level(levels, 'matt', 'K', 1)
  if (inbox + headsets + macros + headset + inspector + faq === 0) return fold
  const heads = Number.isFinite(devs) ? Math.max(0, Math.floor(devs)) : 0
  return {
    ...fold,
    supportHeads: (fold.supportHeads + HEADSET_SHARE * heads * headsets) * INBOX_SUPPORT_STEP ** inbox,
    ticketRate: fold.ticketRate * (macros ? MACROS_TICKET_RATE : 1) * (faq ? FAQ_TICKET_RATE : 1),
    oncallHeads: fold.oncallHeads + (headset ? HEADSET_ONCALL_HEADS : 0),
    incidentStartWork: fold.incidentStartWork * (inspector ? INSPECTOR_START_WORK : 1),
  }
}

// --- James ------------------------------------------------------------------

/**
 * **James is a share of the studio, not a multiple of your thumb** — plan
 * 2026-10-16 phase 6.2 (the audit's finding 12).
 *
 * He was one head plus a tap worth twice yours. At forty developers that is a
 * rounding error and at four thousand it is nothing, so "the super dev who codes
 * super fast" never once showed up as speed — the one thing the player could
 * see him do was click. Now, from the first Paradigm Shift (his tree opens
 * then, and Run 1 is untouched), he adds a tenth of whatever the studio does
 * while he is at his desk: it lands in the velocity the terminal rung is sized
 * by, so it shows up the way everything else in this game shows up, as games
 * that ship sooner. A tenth, and not more, because he is one man: a lift that
 * outgrew Billy's whole column would make the rest of the cast decoration.
 */
export const JAMES_LIFT = 0.1
/** Diet Coke Stack: his share of the studio, per level. */
export const DIET_COKE_LIFT = 0.03
/** Rewrite It Over the Weekend (fork C, the hands-off side): more share, no poke needed. */
export const WEEKEND_REWRITE_LIFT = 0.1
/**
 * A poke on him banks this many seconds of the studio's velocity [2026-10-16].
 * Scale-free, so the tap is worth the same *fraction* of the studio at forty
 * heads and at forty million; the founder's tap times two is the floor under
 * it, which is the whole of the poke in Run 1.
 */
export const JAMES_POKE_SECONDS = 0.25
/**
 * And sustained poking adds at most this much of the studio's velocity again.
 * One times: poking him hard can double the studio and no more, so the thumb is
 * a real lever and not the game (§4.5d's "never better than hiring" is the same
 * rule, said about the founder).
 */
export const JAMES_POKE_CAP = 1
/** Shared Snippets Folder (fork C, the hands-on side): multiplies the poke's share and its cap. */
export const SNIPPETS_POKE_SCALE = 1.5
/** Pair With the Founder: your own taps, while he is at his desk. */
export const PAIRING_TAP_SCALE = 2
/** Torn Elbows: the work in a game, for the same game. */
export const TORN_ELBOWS_COMMITMENT = 0.95
/** Grep Everything: the work in a game, for the same game. */
export const GREP_COMMITMENT = 0.9

export interface JamesEffects {
  /** His share of the studio's structural velocity, while he is at his desk. */
  lift: number
  /** Multiplies a poke's share of the studio and the cap on sustained poking. */
  pokeScale: number
  /** Multiplies the founder's own tap while he is at his desk. */
  founderTapScale: number
  /** Multiplies the work in a terminal-rung game; the payout stays the full game's. */
  commitmentScale: number
  /** Knows a Chap: Billy may be called in before sync slips. */
  callsBilly: boolean
}

export const NO_JAMES_TREE: JamesEffects = {
  lift: JAMES_LIFT,
  pokeScale: 1,
  founderTapScale: 1,
  commitmentScale: 1,
  callsBilly: false,
}

/** James, with his tree on him. {@link NO_JAMES_TREE} for a save that has bought nothing of his. */
export function jamesFromTree(levels: Levels): JamesEffects {
  const coke = level(levels, 'james', 'j1', 5)
  const pair = level(levels, 'james', 'j2', 1)
  const chap = level(levels, 'james', 'j3', 1)
  const elbows = level(levels, 'james', 'j4', 1)
  const snippets = level(levels, 'james', 'j5a', 1)
  const weekend = level(levels, 'james', 'j5b', 1)
  const grep = level(levels, 'james', 'j6', 1)
  if (coke + pair + chap + elbows + snippets + weekend + grep === 0) return NO_JAMES_TREE
  return {
    lift: JAMES_LIFT + DIET_COKE_LIFT * coke + (weekend ? WEEKEND_REWRITE_LIFT : 0),
    pokeScale: snippets ? SNIPPETS_POKE_SCALE : 1,
    founderTapScale: pair ? PAIRING_TAP_SCALE : 1,
    commitmentScale: (elbows ? TORN_ELBOWS_COMMITMENT : 1) * (grep ? GREP_COMMITMENT : 1),
    callsBilly: chap > 0,
  }
}

/**
 * The scale-free half of a poke on James, in story points [2026-10-16].
 *
 * A quarter-second of the studio's velocity (times j5a), clamped so the rate he
 * is being poked at — `recentRate`, the same leaky average `pokeRate` keeps,
 * over the same `tau` — never adds more than {@link JAMES_POKE_CAP} times the
 * studio. The caller takes the larger of this and the old tap floor.
 */
export function jamesPokeShare(velocity: number, recentRate: number, tau: number, fx: JamesEffects): number {
  const v = Number.isFinite(velocity) ? Math.max(0, velocity) : 0
  const rate = Number.isFinite(recentRate) ? Math.max(0, recentRate) : 0
  const share = JAMES_POKE_SECONDS * v * fx.pokeScale
  const headroom = Math.max(0, (JAMES_POKE_CAP * fx.pokeScale * v - rate) * Math.max(0, tau))
  return Math.min(share, headroom)
}
