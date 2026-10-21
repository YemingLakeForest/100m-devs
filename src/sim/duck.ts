/**
 * The CTO — GDD §11.7 [CANON - added 2026-10-21].
 *
 * *"Want to create a new game mechanic, CTO, the rubber duck. Upgradable, can
 * wear vanity items, this is yet another upgrade we can do. design a upgrade
 * tree fitting for him, give him a funny name, and a story arch to introduce
 * him. put him somewhere in our office, instead of on our desk right now."*
 *
 * This is the company-wide tree §11 noted for the future on 2026-09-27 (*"potentially
 * can be something visible to the scene (debug rubber duck for example)"*), and
 * it keeps the three promises that note made: every purchase is a thing you can
 * see in the room, it is drawn the way the people's trees are, and it is a door
 * of its own rather than a sixth tab on somebody's card.
 *
 * **He owns the bugs.** Defects (§4.12) have had no owner since Mo went on
 * 2026-10-04: they are written at β per Story Point, doubled by a poke, carried
 * onto the build, drawn as marks on §10.7's ring, and from there they become
 * tickets, incidents and refunds that other people's trees answer. Nobody's
 * tree touched the source. Rubber-duck debugging is the one joke in software
 * that is about exactly that — you explain the bug to the duck, out loud, and
 * halfway through you find it yourself — so the duck is the source: fewer bugs
 * written, more of them caught before the ring, and the press told it was fine.
 *
 * **Every lever has a floor**, for the same reason Matt's are flat: the bugs
 * are what Matt's and Serena's trees are *for*. A duck that could take the
 * bug rate to zero would switch two people off, so the written rate stops at
 * {@link DUCK_DEFECT_FLOOR} and the catch at {@link DUCK_CATCH_CAP}.
 *
 * **The wardrobe is earned and permanent.** The tree is run state, like every
 * tree (a shift clears it); what he has worn is not. Each node hands over one
 * item the first time it is bought, the item stays in his wardrobe in every
 * run after (a permanent milestone, `duck.wear.<id>`), and the outfit is the
 * player's to choose. Nothing in the wardrobe changes a number — the effect is
 * the node's, worn or not — because a hat that was also a stat would make the
 * outfit an optimisation, and the point of a hat on a duck is the hat.
 *
 * Pure — no store, no clock, no renderer.
 */

import { treeKey } from './upgradeTrees.ts'

/** His name, as STUDIO_OS prints it on the org change. */
export const DUCK_NAME = 'B. Quackington III'
/** What everybody calls him. */
export const DUCK_SHORT = 'Quackington'
export const DUCK_TITLE = 'Chief Technology Officer'

// --- the levers -------------------------------------------------------------

/**
 * The root: **he is CTO.** Every game is written with a tenth fewer bugs from
 * the day the org change commits, before anything is bought — the promotion has
 * to be worth something on its own, or the scene is a door to a shop.
 */
export const CTO_DEFECTS = 0.9
/** Explain It Out Loud (duck:q1): bugs written, per level, compounding. */
export const EXPLAIN_STEP = 0.92
/** Reading Glasses (duck:q2): the share of a build's bugs he finds before it joins the queue. */
export const READERS_CATCH = 0.15
/** Deal With It (duck:q3a, fork E): a poke's bugs, scaled. Half is β again: a poked line is no buggier than any other. */
export const SHADES_POKE = 0.5
/** Monocle (duck:q3b, fork E): he reads the queue a second time. */
export const MONOCLE_CATCH = 0.15
/** The Duck Knew All Along (duck:K): bugs written. The breakthrough. */
export const KNEW_DEFECTS = 0.6
/** Desk Duck for Everyone (duck:c1, repeatable): bugs written, per level. */
export const DESK_DUCK_STEP = 0.95
/** Press Junket (duck:p1): the floor under §4.14's luck roll. */
export const JUNKET_LUCK_FLOOR = 0.3
/** Satisfaction Quackarantee (duck:p2): what a bad review refunds, scaled. */
export const QUACKARANTEE_REFUND = 0.5
/** Bubble Bath (duck:b1): the work a new incident opens with. */
export const BUBBLE_INCIDENT = 0.85

/**
 * The written rate never falls below this share of β, whatever is bought.
 *
 * About a third, because the whole column — the root, three levels of q1, the
 * breakthrough — is 0.9 × 0.92³ × 0.6 ≈ 0.42 before a single desk duck, and the
 * repeatable sink has to have something left to buy into for a while without
 * ever reaching the bottom. Matt's tickets and Serena's incidents are fed by
 * what is left.
 */
export const DUCK_DEFECT_FLOOR = 0.35
/** And no more than this share of a build's bugs is caught before the ring: the ring always has something on it. */
export const DUCK_CATCH_CAP = 0.5

export interface DuckEffects {
  /** Multiplies the rate bugs are written at (§4.12's β·V). */
  defectScale: number
  /** Multiplies the bugs a poke writes (`defectsFromPoke`). */
  pokeDefectScale: number
  /** Share of a build's bugs caught as it joins the queue, combined with Serena's catch. */
  catches: number
  /** A floor under §4.14's luck roll, combined with the founder's. */
  luckFloor: number
  /** Multiplies the share a bad review refunds at launch. */
  refundScale: number
  /** Multiplies the work a new incident opens with. */
  incidentStartWork: number
}

/** A studio with no CTO: every lever at rest. */
export const NO_DUCK: DuckEffects = {
  defectScale: 1,
  pokeDefectScale: 1,
  catches: 0,
  luckFloor: 0,
  refundScale: 1,
  incidentStartWork: 1,
}

type Levels = Readonly<Record<string, number>> | undefined

const level = (levels: Levels, id: string, max: number): number =>
  Math.min(max, Math.max(0, Math.floor(levels?.[treeKey('duck', id)] ?? 0)))

/**
 * The duck, with his tree on him. {@link NO_DUCK} until he is promoted: before
 * the scene he is a duck in a bath, and a duck in a bath does not review code.
 */
export function duckFromTree(levels: Levels, promoted: boolean): DuckEffects {
  if (!promoted) return NO_DUCK
  const explain = level(levels, 'q1', 3)
  const readers = level(levels, 'q2', 1)
  const shades = level(levels, 'q3a', 1)
  const monocle = level(levels, 'q3b', 1)
  const knew = level(levels, 'K', 1)
  const deskDucks = level(levels, 'c1', Number.POSITIVE_INFINITY)
  const junket = level(levels, 'p1', 1)
  const quackarantee = level(levels, 'p2', 1)
  const bubbles = level(levels, 'b1', 1)
  const written = CTO_DEFECTS * EXPLAIN_STEP ** explain * (knew ? KNEW_DEFECTS : 1) * DESK_DUCK_STEP ** deskDucks
  const missed = (readers ? 1 - READERS_CATCH : 1) * (monocle ? 1 - MONOCLE_CATCH : 1)
  return {
    defectScale: Math.max(DUCK_DEFECT_FLOOR, written),
    pokeDefectScale: shades ? SHADES_POKE : 1,
    catches: Math.min(DUCK_CATCH_CAP, 1 - missed),
    luckFloor: junket ? JUNKET_LUCK_FLOOR : 0,
    refundScale: quackarantee ? QUACKARANTEE_REFUND : 1,
    incidentStartWork: bubbles ? BUBBLE_INCIDENT : 1,
  }
}

/** Two independent catches, as one: what gets past both. */
export function combinedCatch(a: number, b: number): number {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
  return 1 - (1 - clamp(a)) * (1 - clamp(b))
}

// --- the wardrobe -----------------------------------------------------------

/**
 * Where an item goes. Four, and each one reads at the room's zoom on a duck the
 * size of a person's head: the crown of his head, his eyes, under his beak, and
 * the bath he sits in.
 */
export const DUCK_SLOTS = ['head', 'face', 'neck', 'tub'] as const
export type DuckSlot = typeof DUCK_SLOTS[number]

export const SLOT_NAME: Record<DuckSlot, string> = { head: 'Head', face: 'Face', neck: 'Neck', tub: 'Bath' }

export interface DuckItem {
  id: string
  name: string
  slot: DuckSlot
  /** How it is earned: a node in his tree (`node`), or a moment (`milestone`). */
  from: { node: string } | { moment: 'promoted' | 'shipped' | 'proxima' }
  /** One line, for the wardrobe. */
  line: string
}

/**
 * Every item, in the wardrobe's order. Two are not from the tree: the party hat
 * comes with the twenty-fifth game the career ships, and the space helmet with
 * James's launch (§21.8) — he would want to go.
 */
export const DUCK_ITEMS: readonly DuckItem[] = [
  { id: 'crown', name: 'Tiny Crown', slot: 'head', from: { node: 'K' }, line: 'He knew all along. He did not say.' },
  { id: 'tophat', name: 'Top Hat', slot: 'head', from: { node: 'p1' }, line: 'For the press. The press loves a hat.' },
  { id: 'partyhat', name: 'Party Hat', slot: 'head', from: { moment: 'shipped' }, line: 'Twenty-five games. He was at every launch.' },
  { id: 'helmet', name: 'Space Helmet', slot: 'head', from: { moment: 'proxima' }, line: 'James said there was room in the filing cabinet.' },
  { id: 'readers', name: 'Reading Glasses', slot: 'face', from: { node: 'q2' }, line: 'He reads every build. Slowly. Out loud, in his head.' },
  { id: 'shades', name: 'Pixel Shades', slot: 'face', from: { node: 'q3a' }, line: 'Deal with it.' },
  { id: 'monocle', name: 'Monocle', slot: 'face', from: { node: 'q3b' }, line: 'For the second read. Nobody asked for a second read.' },
  { id: 'lanyard', name: 'CTO Lanyard', slot: 'neck', from: { moment: 'promoted' }, line: 'Access to every floor. He has never left the bath.' },
  { id: 'bowtie', name: 'Bow Tie', slot: 'neck', from: { node: 'q1' }, line: 'You explain things to him, so he dresses for it.' },
  { id: 'necktie', name: 'Necktie', slot: 'neck', from: { node: 'p2' }, line: 'The guarantee is in writing. He signed it with his foot.' },
  { id: 'bubbles', name: 'Bubble Bath', slot: 'tub', from: { node: 'b1' }, line: 'He is very calm in an incident.' },
  { id: 'ducklings', name: 'Ducklings', slot: 'tub', from: { node: 'c1' }, line: 'Every desk gets one. These are the ones still training.' },
]

export const DUCK_ITEM_BY_ID: ReadonlyMap<string, DuckItem> = new Map(DUCK_ITEMS.map((i) => [i.id, i]))

/** The permanent milestone that says an item is in his wardrobe. */
export const wardrobeKey = (id: string) => `duck.wear.${id}`

/** The item a node of his tree hands over, if any. */
export function itemForNode(nodeId: string): DuckItem | undefined {
  return DUCK_ITEMS.find((i) => 'node' in i.from && i.from.node === nodeId)
}

/** The item a moment hands over. */
export function itemForMoment(moment: 'promoted' | 'shipped' | 'proxima'): DuckItem {
  return DUCK_ITEMS.find((i) => 'moment' in i.from && i.from.moment === moment)!
}

/** The items a career owns, read off its milestones. */
export function ownedItems(milestones: readonly string[]): Set<string> {
  const have = new Set(milestones)
  return new Set(DUCK_ITEMS.filter((i) => have.has(wardrobeKey(i.id))).map((i) => i.id))
}

/** The twenty-fifth game the career ships hands over the party hat. */
export const PARTY_HAT_SHIPS = 25

export type DuckOutfit = Partial<Record<DuckSlot, string>>

/**
 * What he is actually wearing: the chosen outfit, less anything not owned or
 * in the wrong slot. A save from another device, or one hand-edited, can name an
 * item this career has not earned; it is dropped here rather than drawn.
 */
export function wornOutfit(chosen: Readonly<Record<string, string>> | undefined, owned: ReadonlySet<string>): DuckOutfit {
  const out: DuckOutfit = {}
  for (const slot of DUCK_SLOTS) {
    const id = chosen?.[slot]
    const item = id ? DUCK_ITEM_BY_ID.get(id) : undefined
    if (item && item.slot === slot && owned.has(id!)) out[slot] = id
  }
  return out
}

/** Put an item on (it takes its slot), or take it off if it is already on. */
export function toggleItem(chosen: Readonly<Record<string, string>>, id: string): Record<string, string> {
  const item = DUCK_ITEM_BY_ID.get(id)
  if (!item) return { ...chosen }
  const next = { ...chosen }
  if (next[item.slot] === id) delete next[item.slot]
  else next[item.slot] = id
  return next
}

/**
 * What the room draws: whether he has been promoted (the nameplate, and his
 * lanyard is only his once he is), what he is wearing, and how many desk ducks
 * and printouts sit around the bath — the levels that are not an item.
 */
export interface DuckLook {
  promoted: boolean
  outfit: DuckOutfit
  /** Explain It Out Loud's levels: stacks of printouts beside the bath, 0..3. */
  printouts: number
  /**
   * Ducklings in the bath, while the Ducklings item is worn: one per level of
   * Desk Duck for Everyone this run, at least one (the item is the career's,
   * the levels are the run's), and no more than five fit.
   */
  ducklings: number
}

export const NO_DUCK_LOOK: DuckLook = { promoted: false, outfit: {}, printouts: 0, ducklings: 0 }

export function duckLook(levels: Levels, promoted: boolean, outfit: DuckOutfit): DuckLook {
  if (!promoted) return NO_DUCK_LOOK
  return {
    promoted,
    outfit,
    printouts: level(levels, 'q1', 3),
    ducklings: outfit.tub === 'ducklings' ? Math.max(1, Math.min(5, level(levels, 'c1', Number.POSITIVE_INFINITY))) : 0,
  }
}

/** A stable key for a look, so the room rebuilds the duck only when it changes. */
export function lookKey(look: DuckLook): string {
  return [look.promoted ? 1 : 0, ...DUCK_SLOTS.map((s) => look.outfit[s] ?? '-'), look.printouts, look.ducklings].join('|')
}
