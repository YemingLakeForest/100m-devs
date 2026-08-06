/**
 * Publish the master palette to CSS as custom properties.
 *
 * An earlier draft restated the ~37 colours in tokens.css and tested that the
 * two copies agreed. Injecting them removes the second copy instead: there is
 * one palette, in one file, and no drift is possible rather than merely
 * detectable. tokens.css keeps only what is genuinely CSS-side — the type
 * scale, the font stack, the 1px rule.
 *
 * Variable names follow ART_DIRECTION §2.1's ramp names:
 *   --n0..--n8   NEUTRAL       --calm-0..3   phosphor, low entropy
 *   --wood-0..3  WOOD          --warn-0..3   phosphor, mid entropy
 *   --skin-0..5  SKIN          --alarm-0..3  phosphor, entropy lock
 *   --glow-0..2  GLOW          --foliage-0..1
 *   --p0..--p3   the live interface phosphor, rewritten every frame by
 *                applyEntropyTheme (ART_DIRECTION §1.1)
 */

import { RAMPS } from './palette.ts'

/** CSS variable prefix for each ramp. NEUTRAL is `--n` for how often it is typed. */
const PREFIX = {
  NEUTRAL: '--n',
  WOOD: '--wood-',
  SKIN: '--skin-',
  GLOW: '--glow-',
  FOLIAGE: '--foliage-',
  CALM: '--calm-',
  WARN: '--warn-',
  ALARM: '--alarm-',
  RARITY: '--rarity-',
} as const

export function installPaletteTokens(root: HTMLElement): void {
  for (const [ramp, colours] of Object.entries(RAMPS)) {
    const prefix = PREFIX[ramp as keyof typeof PREFIX]
    colours.forEach((hex, i) => root.style.setProperty(`${prefix}${i}`, hex))
  }

  // The live phosphor starts on the calm ramp so the first paint is correct
  // before the simulation has ticked once.
  RAMPS.CALM.forEach((hex, i) => root.style.setProperty(`--p${i}`, hex))
}
