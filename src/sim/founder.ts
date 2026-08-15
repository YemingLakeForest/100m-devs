/**
 * You — GDD §4.5d, §7.8.10, §13.7.1. Requirements R16 and R20.
 *
 * **The player is a developer too, and until now they were nowhere.** Seat 0
 * was an ordinary generated person, §10.1's `swarm + you` split had a `you`
 * half that only ever counted pokes, and the two oldest rows in §25's ledger
 * were both this.
 *
 * ---
 *
 * ## The one number that does not dilute
 *
 * Every other source of output in this game is multiplied by the swarm and
 * divided by §4.1's Entropy. **Yours is not.** §4.5d:
 *
 * > It grows only because *you* got better. Which is the §6 thesis, inverted,
 * > and it is the best joke in the design. You are the only developer in the
 * > company whose output did not collapse when you hired everybody.
 *
 * The game never says this out loud. The two curves say it: at forty developers
 * your desk is a rounding error, at a thousand mid-collapse it is most of what
 * is still moving, and at a million it is a rounding error again. Nothing here
 * announces any of that.
 *
 * ## The two things it must never be
 *
 * §4.5d names both failure conditions, and `founder.test.ts` asserts both:
 *
 *  1. **Not an idle generator that plays itself.** The passive trickle is
 *     deliberately half a developer at base — the tree makes it meaningful and
 *     the *tap* is where the value is.
 *  2. **Never better than hiring.** "If the optimal play is to fire everyone and
 *     code alone, the satire has eaten the game." The whole tree maxed is worth
 *     a fraction of what a correctly-sized studio produces at the *base* cap,
 *     and the gap widens with every Telepathic Compression level, because the
 *     swarm scales with `D_cap` and this does not scale with anything.
 *
 * ## Why the tree is a diluted copy of four others
 *
 * §13.7.1 is the joke stated as a skill tree: Management contains a weaker
 * version of every other class's spine and nothing of its own. The manager is
 * the only person in the company who can do everything, which is precisely why
 * they are the worst person to do any of it — and the player finds this out by
 * buying the nodes and watching them underperform, not by being told.
 *
 * The four specialist trees (§13.7 Engineering, Quality, Support, Reliability)
 * are specced and unbuilt, so {@link MANAGEMENT_DILUTION} carries the promise:
 * when they land, the specialist node takes the full value and the Management
 * one keeps this share of it. Recording the ratio now is what stops "weaker"
 * being re-guessed later.
 */

import { HIRE_COST_GROWTH } from './economy.ts'

/**
 * What a Management node keeps of the specialist node it copies — §13.7.1.
 *
 * A first guess, and marked as one. Two-fifths is low enough that a player who
 * has both will always place the specialist, and high enough that the
 * Management node is worth buying while it is the only one available —
 * §13.7.1's "meaningfully weaker, costs more, available earlier".
 */
export const MANAGEMENT_DILUTION = 0.4

/** The four functions §4.11 gives the floor, plus the one that is only yours. */
export type BorrowedFrom = 'engineering' | 'quality' | 'support' | 'reliability' | 'cloud'

/**
 * What the founder is worth in **every** role they have not hired for — §13.7.1.
 *
 * "The manager is the only person in the company who can do everything, which
 * is precisely why they are the worst person to do any of it." Before this, that
 * was a statement about a *tree*; it also has to be true of the floor, because
 * two systems in §4 divide by a headcount that a garage does not have:
 *
 * - **§4.13's support tax.** `clearanceWait` is `Infinity` the moment a queue
 *   exists with nobody on it, so a studio would be docked the full catalogue
 *   penalty from the second its *first* game shipped, for a queue of one ticket
 *   a person could clear in a second. That is a tax on having shipped anything
 *   at all, which inverts the section: §4.13 is about a catalogue outgrowing the
 *   people looking after it, and a catalogue of one has not outgrown anybody.
 * - **§4.12a's incident clearance.** This one is worse and it is a *fail state*.
 *   `clearanceCapacity(0)` is zero, so a studio with no SRE can never close an
 *   incident, and an incident freezes its release's tail — **a single page in
 *   Act II would take a game off sale permanently.** §4.12 forbids exactly this:
 *   "nothing here may become a fail state that stops the clicker", and §6.3's
 *   Entropy Lock is the game's one seizure.
 *
 * So you answer the email and you carry the pager, at {@link
 * MANAGEMENT_DILUTION} of somebody who does it for a living. Two-fifths of a
 * head covers the first four games (§4.13 prices one head at ten) and is
 * hopeless after that — which is precisely when the player should be hiring, and
 * is the whole shape §13.7.1 asks for: available earlier, meaningfully weaker.
 *
 * **It is one constant rather than one per role** because §13.7.1's claim is
 * about breadth, not about any particular skill. A founder who was better at
 * support than at ops would be a founder with a specialism, which is the one
 * thing the Management class is defined by not having.
 */
export const FOUNDER_ROLE_HEADS = MANAGEMENT_DILUTION

/** §13.6.4's three node kinds — one grammar, five vocabularies. */
export type FounderNodeKind = 'DEPTH' | 'TRAIT' | 'REACH'

export interface FounderNode {
  id: string
  name: string
  kind: FounderNodeKind
  /** Whose spine this is a weaker copy of. */
  borrowedFrom: BorrowedFrom
  flavour: string
  effect: string
  baseCost: number
  mult: number
  maxLevel: number
}

/**
 * Story points a second from your own hands, before the tree — §4.5d.
 *
 * **Half a developer**, and that is the joke rather than a balance figure: one
 * developer at full efficiency produces 1 story point a second (§4.1's
 * `SP_PER_DEV_PER_SEC`), and the founder — who now spends most of the day
 * managing — produces half of one. You are worse at your job than the person
 * you hired to replace you, and you never stopped being on the payroll.
 */
export const FOUNDER_BASE_RATE = 0.5

/** What one level of Touch Typing adds, in story points a second. */
export const TYPING_STEP = 0.5

/**
 * §13.9.2's Cloud spine, diluted — **what one level of Recruiting halves.**
 *
 * §4.10a's hire curve charges `(1 + HIRE_GROWTH_STEP)^n`, and a cost that is
 * exponential in headcount against an income that is *linear* in it crosses at
 * a fixed headcount and stops there. Measured over eight runs before this node
 * existed (`pacing.test.ts`): the studio stalled at ~180 developers in every run
 * from the third onward while §4.2's cap climbed past a million. **The price of
 * a head, not §4.1, was the wall** — which is §6.1.3's thesis exactly inverted,
 * because the whole claim of the game is that *comm tech dictates workforce
 * capacity, not cash*.
 *
 * Each level halves the *step*, so the headcount a studio can afford roughly
 * doubles per level. That makes this the founder's answer to a wall the
 * Paradigm tree cannot reach — §13.2 raises what you are **allowed** to have,
 * this raises what you can **afford**, and neither alone moves the studio. The
 * two levers are two currencies and both are needed, which is the loop.
 *
 * Cloud is the right spine to borrow and the joke is exact: Melany's branch buys
 * "capacity you did not have to organise" and invoices for it. The manager's
 * diluted copy cannot conjure anybody — it just means you know someone who knows
 * someone, and it never stops costing wages.
 */
export const RECRUITING_HALVING = 2

/**
 * Seconds of your own work a tap on your own desk is worth — §4.5d.
 *
 * This is what makes the founder's desk a *clicker* affordance rather than an
 * idle one. At two seconds, a player tapping their own desk at §21's stated
 * 3–5 taps a second is producing several times their passive rate — and the
 * moment they stop, it falls back to the trickle. Attention is the multiplier,
 * which is the whole of §4.6's worry about the clicker going irrelevant.
 */
export const FOUNDER_TAP_SECONDS = 2

/**
 * The Management tree — §13.7.1, four borrowed spines and a reach.
 *
 * Every node acts on something that exists today. §13.7's Quality, Support and
 * Reliability trees act on defects, tickets and incidents, none of which are
 * built (§25.3 R21, R22) — so each node here borrows the *shape* of its class's
 * spine and applies it to the founder rather than to a role that has nothing to
 * do yet. When those systems land, these do not change; the specialist trees
 * arrive beside them at full strength.
 */
export const FOUNDER_TREE: readonly FounderNode[] = [
  {
    id: 'M-ENG',
    name: 'Touch Typing',
    kind: 'DEPTH',
    borrowedFrom: 'engineering',
    flavour: 'You looked at the keyboard for eleven years. You have stopped.',
    effect: `+${TYPING_STEP} story points a second, at your desk only`,
    baseCost: 400,
    mult: 1.9,
    maxLevel: 10,
  },
  {
    id: 'M-CLOUD',
    name: 'You Know A Guy',
    kind: 'DEPTH',
    borrowedFrom: 'cloud',
    flavour: 'You have not advertised a role in years. You just text people.',
    effect: 'Each hire costs less to add than the last — the price curve halves per level',
    /*
     * Priced to be the *second* thing a run buys, and to keep being bought.
     *
     * At `mult` 6 the levels run 6K, 36K, 216K, 1.3M, 7.8M, 47M, 280M, 1.7B —
     * so a run earning tens of millions takes four or five of them and the next
     * one is always visible and always out of reach. That is the shape §13.12.1
     * asks of the early loop: a purchase that visibly accelerates the thing you
     * were just doing, available again almost immediately.
     *
     * Twelve levels is 4,096x the affordable headcount, which is enough to reach
     * §4.2's cap at every rung Layer 1 can open. §13.5's hundred-million gate is
     * Layer 2's problem and is meant to be.
     */
    baseCost: 6_000,
    mult: 6,
    maxLevel: 12,
  },
  {
    id: 'M-QA',
    name: 'Reading It Back',
    kind: 'TRAIT',
    borrowedFrom: 'quality',
    flavour: 'You review your own pull requests. You approve them, obviously.',
    effect: 'Your pokes cost the studio less concentration',
    baseCost: 25_000,
    mult: 1,
    maxLevel: 1,
  },
  {
    id: 'M-SUP',
    name: 'Founder-Led Sales',
    kind: 'TRAIT',
    borrowedFrom: 'support',
    flavour: 'You answered the support email yourself and closed a deal in the thread.',
    effect: 'The work you do personally also earns cash',
    baseCost: 60_000,
    mult: 1,
    maxLevel: 1,
  },
  {
    id: 'M-REL',
    name: 'Always On Call',
    kind: 'TRAIT',
    borrowedFrom: 'reliability',
    flavour: 'The laptop comes on holiday. It has its own seat.',
    effect: 'Your desk keeps working while the game is closed',
    baseCost: 150_000,
    mult: 1,
    maxLevel: 1,
  },
  {
    id: 'M-REACH',
    name: 'Management By Walking Around',
    kind: 'REACH',
    borrowedFrom: 'engineering',
    flavour: 'You are not checking up on them. You are just passing through. Repeatedly.',
    effect: 'A tap at your desk also nudges 1 nearby row per level',
    baseCost: 500_000,
    mult: 2.4,
    maxLevel: 3,
  },
]

export const FOUNDER_BY_ID = new Map(FOUNDER_TREE.map((n) => [n.id, n]))

export type FounderLevels = Readonly<Record<string, number>> | undefined

export function founderLevel(levels: FounderLevels, id: string): number {
  return wholeLevel(levels?.[id])
}

/**
 * A stored level, coerced to a whole number of levels somebody could own.
 *
 * **`Math.max(0, Math.floor(NaN))` is `NaN`**, not zero — `Math.max` propagates
 * it rather than treating it as the smaller operand. A corrupt level therefore
 * used to travel all the way into the rate, and from there into the burn-down.
 * Levels are read from a save document, which is the one input in this game
 * that can contain anything at all.
 */
function wholeLevel(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : 0
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** §11.0's curve, reused. One cost rule in the product is enough. */
export function founderCost(node: FounderNode, currentLevel: number): number {
  return Math.round(node.baseCost * node.mult ** Math.max(0, currentLevel))
}

export function canBuyFounder(node: FounderNode, levels: FounderLevels, cash: number): boolean {
  const level = founderLevel(levels, node.id)
  return level < node.maxLevel && cash >= founderCost(node, level)
}

// --- what you are worth ----------------------------------------------------

export interface FounderEffects {
  /** Story points a second from your own desk. Never taxed by §4.1. */
  rate: number
  /** Story points banked by one tap on your own desk. */
  tapValue: number
  /** Multiplies the §4.9 context-switch entropy your pokes generate. */
  contextSwitchScale: number
  /** §4.5d — your own output also pays cash, at this many dollars per point. */
  cashPerPoint: number
  /** Does your desk accrue while the game is closed? */
  worksOffline: boolean
  /** Nearby rows a tap at your desk also nudges. */
  reachRows: number
  /**
   * §4.10a's hire-cost growth base, after Recruiting.
   *
   * The *base* rather than a discount, because a multiplier on the price moves
   * the wall by three developers and a change to the base moves it by a factor.
   */
  hireGrowth: number
}

export const NO_FOUNDER: FounderEffects = {
  rate: FOUNDER_BASE_RATE,
  tapValue: FOUNDER_BASE_RATE * FOUNDER_TAP_SECONDS,
  contextSwitchScale: 1,
  cashPerPoint: 0,
  worksOffline: false,
  reachRows: 0,
  hireGrowth: HIRE_COST_GROWTH,
}

/**
 * §13.7.1's Support spine, diluted — dollars per story point you produce.
 *
 * Anchored to §4.10's original opening rate rather than the resized ladder:
 * the studio's first game was once worth half a dollar a point, and {@link
 * MANAGEMENT_DILUTION} takes the manager's share of that. The ladder has since
 * been resized twice for Run 1's pacing, and this node keeps its historical
 * rate — it is priced as a mid-game purchase, and a founder doing sales on the
 * side earning a fraction of what shipping earns is the correct answer either
 * way.
 */
export const FOUNDER_CASH_PER_POINT = 0.5 * MANAGEMENT_DILUTION

export function founderEffects(levels: FounderLevels): FounderEffects {
  const typing = Math.min(10, founderLevel(levels, 'M-ENG'))
  const rate = FOUNDER_BASE_RATE + TYPING_STEP * typing

  return {
    rate,
    tapValue: rate * FOUNDER_TAP_SECONDS,
    // §13.7.1 — a weaker copy of Quality's "find it earlier". The specialist
    // version will suppress §4.12's defect rate; yours only makes you a tidier
    // interruption, and it keeps `MANAGEMENT_DILUTION` of the effect.
    contextSwitchScale: founderLevel(levels, 'M-QA') > 0 ? 1 - MANAGEMENT_DILUTION : 1,
    cashPerPoint: founderLevel(levels, 'M-SUP') > 0 ? FOUNDER_CASH_PER_POINT : 0,
    worksOffline: founderLevel(levels, 'M-REL') > 0,
    reachRows: Math.min(3, founderLevel(levels, 'M-REACH')),
    hireGrowth: hireGrowthFor(founderLevel(levels, 'M-CLOUD')),
  }
}

/**
 * §4.10a's growth base at this many levels of Recruiting.
 *
 * `1 + step / 2^L`. The base never reaches 1, so a hire never stops getting
 * dearer — §6's lesson is not for sale, it is only ever made survivable.
 */
export function hireGrowthFor(levels: number): number {
  const l = Math.max(0, Math.min(12, Math.floor(levels)))
  return 1 + (HIRE_COST_GROWTH - 1) / RECRUITING_HALVING ** l
}

/** Levels bought, for the tree screen's header. */
export function founderTotalLevels(levels: FounderLevels): number {
  let n = 0
  for (const node of FOUNDER_TREE) n += founderLevel(levels, node.id)
  return n
}

/** The whole tree, maxed. The ceiling `founder.test.ts` measures hiring against. */
export function maxedFounderLevels(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const node of FOUNDER_TREE) out[node.id] = node.maxLevel
  return out
}
