/**
 * The master palette — ART_DIRECTION §2.2.
 *
 * This file is the single source of truth. `assets/palette/master.png` and
 * `master.gpl` are GENERATED from it by `npm run art:build-palette`; the
 * quantiser and the `npm run art:check` build gate read the PNG.
 *
 * Status: v0. §11.1 requires validation on a cheap LCD in daylight before this
 * is committed to — the phosphor ramps are the risk, cyan-on-dark washes out.
 *
 * Adding a colour here is a deliberate amendment to the system, not a
 * convenience. See ART_DIRECTION §9, last row.
 */

export type RampName =
  | 'NEUTRAL'
  | 'WOOD'
  | 'SKIN'
  | 'GLOW'
  | 'FOLIAGE'
  | 'CALM'
  | 'WARN'
  | 'ALARM'
  | 'RARITY'

export const RAMPS: Record<RampName, readonly string[]> = {
  /** Walls, floors, desks, monitors, shadow — everything structural. */
  NEUTRAL: [
    '#14121a',
    '#241f2e',
    '#3a3244',
    '#55495e',
    '#736579',
    '#968a96',
    '#b8aeb3',
    '#d8d2cf',
    '#f2eee8',
  ],
  /** Desks, doors, cardboard, crates. */
  WOOD: ['#4a2f22', '#6b452c', '#96683f', '#c19366'],
  /** Three tones x 2 values. Deliberately limited — these are 64px busts. */
  SKIN: ['#f0c8a0', '#c99a72', '#c68a5e', '#94603c', '#7a4b32', '#54321f'],
  /** Monitor content, data pipes, server LEDs. */
  GLOW: ['#2a4a5c', '#4a8fa8', '#7fd4e8'],
  /** Plants — the one green thing in the office. */
  FOLIAGE: ['#2e4a2c', '#4c7a45'],
  /** Interface phosphor, low entropy. */
  CALM: ['#0a2a30', '#1a6b78', '#35c9d9', '#b8f4ff'],
  /** Interface phosphor, mid entropy. */
  WARN: ['#2e1f08', '#8a5c12', '#e0a52e', '#ffe9b0'],
  /** Interface phosphor, entropy lock. */
  ALARM: ['#2e0c0c', '#8a1f1f', '#e03c3c', '#ffb8b8'],
  /**
   * §2.3 rarity frames are palette entries, not new art. Six of the seven
   * tiers reuse colours already present above; Distinguished's violet is the
   * one entry the ramps did not already carry.
   */
  RARITY: ['#6b3a8a'],
} as const

/** Every colour in the system, in ramp order. 37 entries. */
export const MASTER_PALETTE: readonly string[] = Object.values(RAMPS).flat()

/** Hero Card rarity frame colours — ART_DIRECTION §2.3, GDD §22.4. */
export const RARITY_FRAME = {
  junior: '#55495e',
  mid: '#968a96',
  senior: '#96683f',
  staff: '#d8d2cf',
  principal: '#e0a52e',
  distinguished: '#6b3a8a',
  legendary: '#35c9d9',
} as const

export type RarityTier = keyof typeof RARITY_FRAME

/** `#rrggbb` -> `[r, g, b]`. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** `[r, g, b]` -> `#rrggbb`, lowercase. */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
