import { beltView, currentEntropy, currentVelocity, effectiveDevCap, type GameState } from '../game/store.ts'
import type { HqReadouts } from '../three/render/hqSets.ts'

/**
 * What the heroes' sets draw, read off the same state the HUD reads
 * [2026-10-04, GDD §7.8.12]. A function of the state and nothing else, so the
 * wall behind Serena cannot say the queue is full while the rail says it is not.
 */
export function hqReadouts(s: GameState): HqReadouts {
  const belt = beltView(s)
  return {
    queueUsed: belt.buffer,
    queueCapacity: belt.capacity,
    autoShipIn: belt.autoShipIn,
    incidents: s.incidents.map((i) => i.releaseName),
    tickets: s.tickets,
    defects: s.defects,
    syncPct: Math.max(0, Math.min(100, (1 - currentEntropy(s)) * 100)),
    devs: s.devs,
    devCap: effectiveDevCap(s),
    velocity: currentVelocity(s),
    shipped: s.projectsShipped,
  }
}
