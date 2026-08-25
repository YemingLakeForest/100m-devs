/**
 * The six, as the store sees them — GDD §13.6.2, §13.9, §13.10, §13.13, §22.8.
 *
 * `storyHeroes.ts` says who they are, `heroTree.ts` says what the board looks
 * like and `heroXp.ts` says how a level is reached. **This is the file that
 * turns three tables and two save maps into six people with levels, points,
 * coverage and an effect on the studio**, and it is pure so all of that can be
 * pinned without standing up a store.
 *
 * ## Three rules from §13 that this file is the only place to enforce
 *
 * **A hero is a starting position, not a role** (§13.9.1). Every hero opens the
 * same board; what differs is where they already are and what a node is worth to
 * them ({@link nodeWeight}). Nothing here refuses a purchase on grounds of
 * branch.
 *
 * **Coverage is a share, not a switch** (§13.6.2). A hero reaches
 * {@link reachDevs} developers of whatever they were placed on, and their effect
 * on the studio is scaled by the share of the studio that is. A hero covering
 * eight of forty delivers a fifth of what they are worth — which is what makes
 * REACH the expensive node and §13.8's placement a decision.
 *
 * **Amplitude, never gate** (§13.6.7). Every multiplier this file produces is 1
 * when the roster is empty, and no caller may require otherwise.
 */

import { reachDevs } from './heroes.ts'
import {
  BRANCH_BY_ID,
  HERO_NODE_BY_ID,
  HERO_TREE,
  TRUNK_NODE,
  branchFold,
  heroBoardParent,
  nodePoints,
  nodeWeight,
  startingNodes,
  type HeroBranch,
  type HeroTreeNode,
} from './heroTree.ts'
import { levelAt, pointsAvailable, type LevelProgress } from './heroXp.ts'
import { HERO_BY_ID, type HeroId, type StoryHero } from './storyHeroes.ts'

/**
 * Where a hero is standing — a rung of §7.7's ladder and which unit at it.
 *
 * The same pair `PokeTarget` uses, deliberately: the thing you poke and the
 * thing you put somebody in charge of are the same thing, which is §13.6.1's
 * "the ladder is the progression board as well as the view".
 */
export interface HeroPlacement {
  rung: number
  index: number
  /**
   * Simulated seconds at which they were placed — §13.8's rule 4.
   *
   * A relocation has a settling period during which the hero covers nothing,
   * because free instant reassignment makes the optimal play a
   * micro-management treadmill. §7.8.12 renders the period as a *walk*.
   */
  placedAt: number
}

/** §13.8 rule 4 — how long a hero covers nothing after being moved. */
export const SETTLE_SECONDS = 8

/** One hero, fully resolved. */
export interface HeroRuntime {
  id: HeroId
  hero: StoryHero
  branch: HeroBranch
  colour: string
  /** Permanent, §13.10. Never spent — {@link progress} is what it is for. */
  xp: number
  progress: LevelProgress
  /** Every node owned, pre-bought and purchased alike. */
  nodes: readonly string[]
  /** Points spent. §13.9.1's starting position is free and is not counted. */
  spent: number
  /** Points left to spend — §13.13. */
  points: number
  /** How many REACH nodes are owned, which is the index into §13.6.2's ladder. */
  reach: number
  /** Developers this hero could cover if the unit under them were big enough. */
  reachDevs: number
  placement: HeroPlacement | null
}

function ownedList(nodes: readonly string[] | undefined, branch: HeroBranch): string[] {
  const start = startingNodes(branch)
  const out = new Set<string>(start)
  for (const id of nodes ?? []) if (HERO_NODE_BY_ID.has(id)) out.add(id)
  return [...out]
}

/** How many of a hero's owned nodes they actually paid points for. */
export function pointsSpent(nodes: readonly string[], branch: HeroBranch): number {
  const free = new Set(startingNodes(branch))
  let spent = 0
  for (const id of nodes) {
    if (free.has(id)) continue
    const node = HERO_NODE_BY_ID.get(id)
    if (node) spent += nodePoints(node.kind)
  }
  return spent
}

/**
 * Resolve one hero from what the save holds.
 *
 * Tolerant of every field being absent, because a save written before any of
 * this existed describes a hero who has just walked in — which is the correct
 * reading and needs no migration.
 */
export function heroRuntime(
  id: HeroId,
  xp: number | undefined,
  nodes: readonly string[] | undefined,
  placement: HeroPlacement | null | undefined,
): HeroRuntime | null {
  const hero = HERO_BY_ID.get(id)
  if (!hero) return null

  const owned = ownedList(nodes, hero.branch)
  const banked = Number.isFinite(xp) && (xp as number) > 0 ? (xp as number) : 0
  const progress = levelAt(banked)
  const spent = pointsSpent(owned, hero.branch)
  const reach = owned.filter((n) => HERO_NODE_BY_ID.get(n)?.kind === 'reach').length

  return {
    id,
    hero,
    branch: hero.branch,
    colour: BRANCH_BY_ID.get(hero.branch)?.colour ?? '#d8d8c0',
    xp: banked,
    progress,
    nodes: owned,
    spent,
    points: pointsAvailable(progress.level, spent),
    reach,
    reachDevs: reachDevs(reach),
    placement: placement ?? null,
  }
}

// ---------------------------------------------------------------------------
// Buying a node — §13.13, and §11.4.2's reveal grammar
// ---------------------------------------------------------------------------

/** §11.4.2's three states, shared with the tech board. One grammar, two boards. */
export type HeroNodeState = 'owned' | 'live' | 'silhouette' | 'dark'

/**
 * What the player sees of a node, for this hero.
 *
 * Owned; the next purchase, affordable, with everything shown; one step out and
 * unaffordable, in silhouette; further out, a connector and a stub. §11.4.2's
 * argument holds here for the same reason it holds there — planning needs to see
 * the *next* purchase, not six of them.
 */
export function heroNodeState(runtime: HeroRuntime, nodeId: string): HeroNodeState {
  const node = HERO_NODE_BY_ID.get(nodeId)
  if (!node) return 'dark'
  const owned = new Set(runtime.nodes)
  if (owned.has(nodeId)) return 'owned'

  const parent = heroBoardParent(nodeId)
  if (parent !== null && owned.has(parent)) {
    return runtime.points >= nodePoints(node.kind) ? 'live' : 'silhouette'
  }
  return 'dark'
}

/** Can this hero buy this node right now? */
export function canBuyHeroNode(runtime: HeroRuntime, nodeId: string): boolean {
  return heroNodeState(runtime, nodeId) === 'live'
}

/**
 * The node list after a purchase, or null if the purchase is refused.
 *
 * Returns the *list* rather than mutating, so the store can write it straight
 * into the save's `heroNodes` union and nothing has to know how a hero is
 * stored.
 */
export function buyHeroNode(runtime: HeroRuntime, nodeId: string): string[] | null {
  if (!canBuyHeroNode(runtime, nodeId)) return null
  return [...runtime.nodes, nodeId]
}

// ---------------------------------------------------------------------------
// Coverage — §13.6.2
// ---------------------------------------------------------------------------

export interface HeroCoverage {
  /** Developers actually reached. */
  covered: number
  /** Of the unit they were placed on, 0..1. */
  fraction: number
  /** True once they cover everything under them. */
  complete: boolean
  /** §13.8 rule 4 — still walking, and covering nothing yet. */
  settling: boolean
}

/**
 * §13.6.2 — a hero is only effective at the reach they have bought.
 *
 * Placed on a floor of a thousand with a row's reach, they cover eight of it,
 * and §13.11.1's footprint draws exactly that. `now` and the placement's
 * `placedAt` decide §13.8's settling period, during which the answer is zero —
 * coverage costs time, so time is on screen.
 */
export function heroCoverage(runtime: HeroRuntime, devsAtSlot: number, now: number): HeroCoverage {
  if (!runtime.placement) return { covered: 0, fraction: 0, complete: false, settling: false }
  const settling = now - runtime.placement.placedAt < SETTLE_SECONDS
  const slot = Math.max(1, Math.floor(devsAtSlot))
  const covered = settling ? 0 : Math.min(runtime.reachDevs, slot)
  return {
    covered,
    fraction: covered / slot,
    complete: !settling && covered >= slot,
    settling,
  }
}

// ---------------------------------------------------------------------------
// What the studio actually gets — §22.8's "bends" column, folded
// ---------------------------------------------------------------------------

export interface HeroFold {
  /** Multiplies story-point yield. Above 1 is an improvement. */
  yield: number
  /** Multiplies §4.1's entropy. Below 1 is an improvement. */
  entropy: number
  /** Multiplies §4.2's developer cap. Above 1 is an improvement. */
  cap: number
  /** Multiplies §4.12's defect arrival rate. Below 1 is an improvement. */
  defects: number
  /** Multiplies §4.12a's incident arrival rate. Below 1 is an improvement. */
  incidents: number
  /** §4.13 — extra ticket-answering heads, additive. */
  supportHeads: number
  /** Serena — work required by a newly opened incident, as a fraction of normal. */
  incidentStartWork: number
  /** Matt — multiplier on ticket arrivals from the catalogue. */
  ticketRate: number
  /** James and Billy — coding heads protected from the Daily Standups pause. */
  standupHeads: number
  /** Melany — reserved-capacity operating cost, dollars per second. */
  operatingCost: number
}

/** The studio with nobody placed. §13.6.7 — "heroes are amplitude, not gate". */
export const NO_HERO_FOLD: HeroFold = {
  yield: 1,
  entropy: 1,
  cap: 1,
  defects: 1,
  incidents: 1,
  supportHeads: 0,
  incidentStartWork: 1,
  ticketRate: 1,
  standupHeads: 0,
  operatingCost: 0,
}

/** One placed hero's contribution, as the fold needs it. */
export interface HeroContribution {
  runtime: HeroRuntime
  /** Developers covered, from {@link heroCoverage}. */
  covered: number
}

function depthNodes(runtime: HeroRuntime): HeroTreeNode[] {
  return runtime.nodes
    .map((id) => HERO_NODE_BY_ID.get(id))
    .filter((n): n is HeroTreeNode => !!n && n.kind === 'depth')
}

/**
 * §13.9.1 — effective depth in a branch, for this hero.
 *
 * A node in the hero's own branch counts fully; one outside it counts
 * {@link nodeWeight}. This is the single line that makes "she will be worse at
 * it than Melany" true, and it is deliberately not a refusal: Mo may buy every
 * Cloud node on the board, and each one is worth half of what it is worth to
 * Melany.
 */
export function effectiveDepth(runtime: HeroRuntime, branch: HeroBranch): number {
  let total = 0
  /*
   * **The trunk counts as one level of Engineering**, for everybody.
   *
   * §13.9 calls the centre "what everybody did, before they specialised" and
   * §22.8 has James bending "§4.1 velocity, weakly, everywhere" — and without
   * this line he bends nothing at all, because Engineering has no chain and his
   * card reads `VELOCITY +0%`. A hero whose own row in the roster table
   * describes an effect he does not have is a bug in the fiction as much as in
   * the arithmetic.
   *
   * Weighted like any other node, so it is worth {@link JACK_WEIGHT} to James
   * and the same off-branch rate to everybody else: small at every rung, never
   * scaling, and the same for all six. §13.6.3's joke needs it to be *small*,
   * not absent.
   */
  if (branch === 'engineering' && runtime.nodes.includes(TRUNK_NODE)) {
    total += nodeWeight(runtime.branch, 'engineering')
  }
  for (const node of depthNodes(runtime)) {
    if (node.branch !== branch) continue
    total += nodeWeight(runtime.branch, node.branch)
  }
  return total
}

/**
 * Fold every placed hero into one set of studio multipliers.
 *
 * **Scaled by the share of the studio each hero actually covers.** A hero
 * reaching eight of a forty-person studio delivers a fifth of what they are
 * worth, which is §13.6.2's reach rule expressed as arithmetic rather than as a
 * nag, and is what makes REACH worth its three points.
 *
 * Every branch, including Support, follows the same coverage grammar. Matt may
 * answer for an old catalogue, but the points invested in his Support branch
 * only become effective over the share of the organisation he is actually
 * leading. The catalogue-specific exception is now Matt's named signature
 * (`ticketRate`) rather than an invisible exception to REACH.
 *
 * The six signature traits are folded here as small rule bends. A signature is
 * active only while its owner is placed and settled — the card's sentence is a
 * simulation promise, not character flavour wearing a number-shaped costume.
 */
export function heroFold(contributions: readonly HeroContribution[], totalDevs: number): HeroFold {
  const devs = Math.max(1, Math.floor(totalDevs))
  const out: HeroFold = { ...NO_HERO_FOLD }

  for (const { runtime, covered } of contributions) {
    if (!(covered > 0)) continue
    const share = Math.min(1, covered / devs)

    switch (runtime.id) {
      case 'james':
        // FEWER COMMITMENTS — one person keeps typing through stand-up.
        out.standupHeads += 1
        break
      case 'mo':
        // READS IT TWICE — work under her review writes half as many defects.
        out.defects *= 1 + (0.5 - 1) * share
        break
      case 'serena':
        // WROTE THE RUNBOOK — the first response starts half complete.
        out.incidentStartWork *= 1 + (0.5 - 1) * share
        break
      case 'matt':
        // KNOWS THEIR NAMES — repeat catalogue questions arrive 20% slower.
        out.ticketRate *= 1 + (0.8 - 1) * share
        break
      case 'melany':
        // RESERVED INSTANCES — extra cap is immediate and carries a visible bill.
        out.cap *= 1 + 0.25 * share
        out.operatingCost += covered
        break
      case 'billy':
        // FIFTEEN MINUTES — everybody in reach keeps producing in stand-up.
        out.standupHeads += covered
        break
      default:
        break
    }

    for (const [branch, fold] of [...BRANCH_BY_ID.keys()].map((b) => [b, branchFold(b)] as const)) {
      const depth = effectiveDepth(runtime, branch)
      if (depth <= 0) continue

      switch (fold.field) {
        case 'defects':
        case 'incidents':
        case 'entropy': {
          // A multiplier below 1, applied to the covered share only.
          const full = fold.perNode ** depth
          const scaled = 1 + (full - 1) * share
          if (fold.field === 'defects') out.defects *= scaled
          else if (fold.field === 'incidents') out.incidents *= scaled
          else out.entropy *= scaled
          break
        }
        case 'cap':
          out.cap *= 1 + fold.perNode * depth * share
          break
        case 'yield':
          out.yield *= 1 + fold.perNode * depth * share
          break
        case 'support':
          out.supportHeads += fold.perNode * depth * share
          break
        default:
          break
      }
    }
  }

  return out
}

/**
 * The trunk is owned by everybody — a convenience for callers who only have an
 * id and want to know whether a board is worth opening.
 */
export function hasAnyNodes(nodes: readonly string[] | undefined): boolean {
  return (nodes ?? []).some((id) => id !== TRUNK_NODE && HERO_NODE_BY_ID.has(id))
}

/** Every node on the board, for a renderer that wants to walk it once. */
export function heroTreeNodes(): readonly HeroTreeNode[] {
  return HERO_TREE
}
