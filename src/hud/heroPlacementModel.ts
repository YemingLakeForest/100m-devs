import { effectiveDepth, type HeroRuntime } from '../sim/heroRoster.ts'

export interface PlacementBenefit {
  /** The simulation field this hero's home branch bends. */
  label: string
  /** Compact noun used on the roster strip. */
  shortLabel: string
  /** The contribution at the supplied studio coverage share. */
  value: string
  /** The contribution if the hero covered the whole studio. */
  potential: string
}

function percent(value: number, sign: '+' | '-'): string {
  const rounded = Math.round(Math.max(0, value) * 100)
  return `${sign}${rounded}%`
}

/**
 * The placement-facing version of §22.8's hero fold.
 *
 * This deliberately repeats no balance constants outside the fold's public
 * grammar: the same per-depth values are used here so the card reports the
 * contribution the simulation will receive after coverage scaling. Support is
 * the one explicit exception — once Matt covers anybody, his catalogue work is
 * not diluted by studio share.
 */
export function placementBenefit(hero: HeroRuntime, studioShare: number): PlacementBenefit {
  const share = Math.min(1, Math.max(0, studioShare))
  const depth = effectiveDepth(hero, hero.branch)

  switch (hero.branch) {
    case 'quality': {
      const full = 1 - 0.85 ** depth
      return {
        label: 'DEFECT RATE',
        shortLabel: 'DEFECTS',
        value: share > 0 ? percent(full * share, '-') : 'OFF',
        potential: percent(full, '-'),
      }
    }
    case 'reliability': {
      const full = 1 - 0.85 ** depth
      return {
        label: 'INCIDENT RATE',
        shortLabel: 'INCIDENTS',
        value: share > 0 ? percent(full * share, '-') : 'OFF',
        potential: percent(full, '-'),
      }
    }
    case 'cohesion': {
      const full = 1 - 0.9 ** depth
      return {
        label: 'ENTROPY',
        shortLabel: 'ENTROPY',
        value: share > 0 ? percent(full * share, '-') : 'OFF',
        potential: percent(full, '-'),
      }
    }
    case 'cloud': {
      const full = 0.15 * depth
      return {
        label: 'DEVELOPER CAP',
        shortLabel: 'CAP',
        value: share > 0 ? percent(full * share, '+') : 'OFF',
        potential: percent(full, '+'),
      }
    }
    case 'support': {
      const full = depth
      const formatted = `+${full.toFixed(full % 1 === 0 ? 0 : 1)}`
      return {
        label: 'TICKET HEADS',
        shortLabel: 'SUPPORT',
        value: share > 0 ? formatted : 'OFF',
        potential: formatted,
      }
    }
    default: {
      const full = 0.03 * depth
      return {
        label: 'VELOCITY',
        shortLabel: 'VELOCITY',
        value: share > 0 ? percent(full * share, '+') : 'OFF',
        potential: percent(full, '+'),
      }
    }
  }
}

export function studioCoverageShare(covered: number, totalDevs: number): number {
  if (!(covered > 0) || !(totalDevs > 0)) return 0
  return Math.min(1, covered / totalDevs)
}

export function coveragePercent(covered: number, totalDevs: number): number {
  return Math.round(studioCoverageShare(covered, totalDevs) * 100)
}

export function coverageLabel(covered: number, totalDevs: number): string {
  const active = Math.max(0, Math.floor(covered))
  const total = Math.max(0, Math.floor(totalDevs))
  return `${active.toLocaleString()} / ${total.toLocaleString()} DEVS`
}
