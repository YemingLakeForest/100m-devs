import * as T from 'three'
import { lossBreakdown, STATE_LIGHT, STATE_LABEL, STATE_CAUSE, type Breakdown, type WorkState } from './repo.ts'
import { STATES } from './palette.ts'

/**
 * What everybody is doing — the satire, as data the zoom can show.
 *
 * Output grows like the square root of headcount (locked decision 1, option C:
 * work ≈ D / (1 + √(D / k))), and `lossBreakdown` — the game's own — splits the
 * rest into the seven named slices. `k` is a demo's coordination value, not a
 * tuning: at 20 people most are working, at a hundred million almost nobody is,
 * which is the whole joke and the reason the loss view goes blue from orbit.
 */
const K = 60

export function breakdown(heads: number, worlds: number): Breakdown {
  const eta = 1 / (1 + Math.sqrt(Math.max(0, heads) / K))
  const awayShare = heads > 1 ? 0.08 : 0
  const onboardShare = heads > 20 ? 0.05 : 0
  const lagShare = worlds > 1 ? 0.3 : 0
  const effective = heads * eta * (1 - awayShare) * (1 - onboardShare) * (1 - lagShare)
  return lossBreakdown({ heads, effective, eta, awayShare, blocked: false, onboardShare, lagShare })
}

/** Cumulative shares in legend order, for the shaders' two vec4s. */
export function cdf(b: Breakdown): [T.Vector4, T.Vector4] {
  let acc = 0
  const c = STATES.map((s) => (acc += b[s]))
  return [new T.Vector4(c[0], c[1], c[2], c[3]), new T.Vector4(c[4], c[5], c[6], 1)]
}

/** The shaders' seat hash, bit for bit (towers.ts `seatHash`). */
export function seatHash(seed: number, local: number, ch: number): number {
  let h = (Math.imul(seed >>> 0, 747796405) + Math.imul(local >>> 0, 2891336453 | 0) + Math.imul(ch >>> 0, 1597334677)) >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

/** What seat `local` of the building seeded `seed` is doing at time `t` (seconds). */
export function stateOf(seed: number, local: number, t: number, b: Breakdown): WorkState {
  const bucket = Math.floor(t / 20 + seatHash(seed, local, 3))
  const r = seatHash(seed, local, 10 + (bucket % 1000))
  let acc = 0
  for (const s of STATES) {
    acc += b[s]
    if (r < acc) return s
  }
  return 'lag'
}

export function describe(s: WorkState): { label: string; colour: string; cause: string } {
  return { label: STATE_LABEL[s].toUpperCase(), colour: STATE_LIGHT[s], cause: STATE_CAUSE[s] }
}
