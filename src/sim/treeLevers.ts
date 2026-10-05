/**
 * What the founder's and Matt's trees do — GDD §8 [wired 2026-10-04].
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
import { treeKey } from './upgradeTrees.ts'
import type { HeroFold } from './heroRoster.ts'

type Levels = Readonly<Record<string, number>> | undefined

const level = (levels: Levels, hero: 'you' | 'matt', id: string, max: number): number =>
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
