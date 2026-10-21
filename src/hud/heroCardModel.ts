/**
 * §22.9 — what a hero card says about the studio, in the card's own words.
 *
 * Its own module so the card stays a component file (fast refresh) and the
 * wording can be tested without a render.
 */

import { heroFold, type HeroRuntime } from '../sim/heroRoster.ts'
import { ERAS } from '../sim/eras.ts'
import { TREES, treeNode, type TreeHero } from '../sim/upgradeTrees.ts'
import { treeLevelOf, treePriceOf, treeRefusalOf, treeView, type GameState } from '../game/store.ts'
import { formatMoney } from './hudModel.ts'

/** A head count the way the card prints it: a tenth below ten, whole above. */
function heads(n: number): string {
  const v = Math.max(0, n)
  return v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v).toLocaleString()
}

function percent(factor: number): string {
  const d = Math.round((factor - 1) * 100)
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}%`
}

/**
 * What this person is doing for the studio, this second, as the card's rows.
 *
 * Read off {@link heroFold} for this hero alone rather than restated, so the
 * card cannot promise a number the simulation is not charging (§10.6).
 */
export function heroDuty(hero: HeroRuntime, devs: number): Array<{ label: string; value: string }> {
  const f = heroFold([hero], devs)
  switch (hero.id) {
    case 'james':
      return [{ label: 'IN STAND-UP', value: 'KEEPS CODING' }]
    case 'serena':
      return [{ label: 'QUEUE', value: `+${f.shelfSlots} BUILDS` }]
    case 'matt':
      return [
        { label: 'HELP DESK', value: `${heads(f.supportHeads)} DEVS` },
        { label: 'ON CALL', value: `${heads(f.oncallHeads)} DEVS` },
        { label: 'NEW INCIDENTS', value: 'HALF WORKED' },
        { label: 'TICKETS', value: percent(f.ticketRate) },
      ]
    case 'billy':
      return [{ label: 'CODING IN STAND-UP', value: `${heads(f.standupHeads)} DEVS` }]
    default:
      return []
  }
}

/** A headcount threshold the way a gate prints it: `1K`, `1M`, `100M`. */
function threshold(n: number): string {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`
  return String(n)
}

export interface Breakthrough {
  id: string
  name: string
  /** `owned` is warm and filled; `ready` can be bought now; `locked` is everything else. */
  status: 'owned' | 'ready' | 'locked'
  /** What stands between the player and it, in four words or fewer. */
  gate: string
}

/**
 * §22.9.2 [CANON - added 2026-10-21] — a person's breakthroughs, as the slots on
 * their pass.
 *
 * Lonestar prints a pilot's future on the card as locked rows with the level
 * that opens each, and the empty slots are the strongest thing on it: they make
 * you want the next one and tell you how to get it. Our trees have that future
 * already — two or three key nodes each — and the pass only ever said what had
 * been bought. Earned, never rolled (§22.6): every gate here is one the player
 * can read and walk towards.
 *
 * The gate is the *first* thing in the way, in the order the tree refuses
 * (`treeRefusalOf`), so it never names a parent while the era is still shut.
 * The era is said as the headcount that opens it, because "1K DEVS" is a goal
 * and "CITY" is a word to look up.
 */
export function breakthroughsOf(tree: TreeHero, state: GameState, treesOpen: boolean): Breakthrough[] {
  return TREES[tree]
    .filter((n) => n.kind === 'key')
    .map((node) => {
      const base = { id: node.id, name: node.name }
      if (treeLevelOf(tree, node.id, state) > 0) return { ...base, status: 'owned' as const, gate: 'OWNED' }
      if (!treesOpen) return { ...base, status: 'locked' as const, gate: 'AFTER A SHIFT' }
      const why = treeRefusalOf(tree, node.id, state)
      switch (why) {
        case null:
          return { ...base, status: 'ready' as const, gate: 'BUYABLE NOW' }
        case 'cash': {
          const price = treePriceOf(tree, node.id, state)
          return { ...base, status: 'locked' as const, gate: price === null ? 'NOT ENOUGH CASH' : formatMoney(price) }
        }
        case 'era': {
          const opensAt = ERAS[Math.max(0, Math.min(node.era, ERAS.length) - 1)].upTo
          return { ...base, status: 'locked' as const, gate: `${threshold(opensAt)} DEVS` }
        }
        case 'future':
          return { ...base, status: 'locked' as const, gate: 'THE STARS' }
        case 'unbuilt': {
          // Not in this build yet. Its era is still a true gate while it is shut,
          // so say that; past it, say what the inspector says (UpgradeTrees.tsx).
          if (node.era > treeView(state).era) {
            const opensAt = ERAS[Math.max(0, Math.min(node.era, ERAS.length) - 1)].upTo
            return { ...base, status: 'locked' as const, gate: `${threshold(opensAt)} DEVS` }
          }
          return { ...base, status: 'locked' as const, gate: 'NOT BUILT YET' }
        }
        case 'requires': {
          // A link's level is always 0 on this side, so only this tree's own parents name a step.
          const step = node.parents
            .map((id) => treeNode(tree, id))
            .find((p) => p && p.kind !== 'link' && treeLevelOf(tree, p.id, state) === 0)
          return { ...base, status: 'locked' as const, gate: step ? `AFTER ${step.name.toUpperCase()}` : 'NEEDS A LINK' }
        }
        case 'fork':
          return { ...base, status: 'locked' as const, gate: 'CLOSED' }
        default:
          return { ...base, status: 'locked' as const, gate: 'NOT YET' }
      }
    })
}
