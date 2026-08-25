import type { HeroRuntime } from '../sim/heroRoster.ts'
import { unitLabel, unitSeats } from '../sim/units.ts'

export function assignmentLabel(hero: HeroRuntime): string {
  const placement = hero.placement!
  if (placement.rung <= 2) return `DESK ${placement.index + 1}`
  return `${unitLabel(placement.rung).toUpperCase()} ${String(placement.index + 1).padStart(2, '0')}`
}

export function assignmentCoversFocus(hero: HeroRuntime, focusSeat: number, devs: number): boolean {
  const placement = hero.placement
  if (!placement) return false
  if (placement.rung <= 2) {
    const from = placement.index
    return focusSeat >= from && focusSeat < Math.min(devs, from + hero.reachDevs)
  }
  const range = unitSeats(placement.rung, placement.index, devs)
  return focusSeat >= range.from && focusSeat < range.to
}
