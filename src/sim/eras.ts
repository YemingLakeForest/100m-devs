/*
 * Copied from the rebuild (100m-devs-three/src/sim/audience.ts, its `ERAS`
 * table only) on 2026-09-26 with the pipeline, whose nodes open by era. The
 * audience law that shares that file lands with the satire law (phase 1 of
 * docs/PLAN-2026-09-26-return.md); the eras do not have to wait for it.
 */

/**
 * The five eras of §1's ladder [2026-09-24], by the headcount that opens them.
 * The garage is the garage; HQ is the first tower; the city is the city
 * filling outward from HQ; Earth ends full at 100,000,000; the stars are every
 * world after.
 *
 * The rebuild reads these from *premises*, which this build does not have yet:
 * here the reading is headcount, which is what premises are sized to.
 *
 * Pure — no store, no clock, no renderer.
 */
export const ERAS = [
  { key: 'garage', label: 'Garage', upTo: 20 },
  { key: 'hq', label: 'HQ', upTo: 1_000 },
  { key: 'city', label: 'City', upTo: 1_000_000 },
  { key: 'earth', label: 'Earth', upTo: 100_000_000 },
  { key: 'stars', label: 'The stars', upTo: Infinity },
] as const
export type EraKey = typeof ERAS[number]['key']

export function eraIndex(heads: number): number {
  const n = Number.isFinite(heads) ? Math.max(0, heads) : Infinity
  return ERAS.findIndex(e => n <= e.upTo)
}

export function eraOf(heads: number): EraKey {
  return ERAS[eraIndex(heads)].key
}
