/**
 * §22.9 — what a hero card says about the studio, in the card's own words.
 *
 * Its own module so the card stays a component file (fast refresh) and the
 * wording can be tested without a render.
 */

import { heroFold, type HeroRuntime } from '../sim/heroRoster.ts'

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
