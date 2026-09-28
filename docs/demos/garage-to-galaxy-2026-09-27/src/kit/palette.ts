import * as T from 'three'
import { OS, RAMPS, STATE_LIGHT, LOSS_KINDS, type WorkState } from './repo.ts'

/**
 * The demos' colours, every one of them from the game's master palette
 * (ART_DIRECTION §2.2) or the STUDIO_OS skin the garage is drawn in. A demo
 * that invented its own greys would be judged against the garage and lose.
 */
export const HEX = {
  night: RAMPS.NEUTRAL[0],
  n1: RAMPS.NEUTRAL[1],
  n2: RAMPS.NEUTRAL[2],
  n3: RAMPS.NEUTRAL[3],
  n4: RAMPS.NEUTRAL[4],
  n5: RAMPS.NEUTRAL[5],
  n6: RAMPS.NEUTRAL[6],
  n7: RAMPS.NEUTRAL[7],
  n8: RAMPS.NEUTRAL[8],
  lamp: OS.lamp,
  screen: RAMPS.GLOW[2],
  glow0: RAMPS.GLOW[0],
  glow1: RAMPS.GLOW[1],
  calm: RAMPS.CALM,
  warn: RAMPS.WARN,
  alarm: RAMPS.ALARM,
  wood: RAMPS.WOOD,
  skin: RAMPS.SKIN,
} as const

/** A palette colour in the renderer's linear working space. */
export const lin = (hex: string): T.Color => new T.Color(hex)

/** GLSL vec3 literal of a palette colour, linearised, for shader source. */
export function glslColour(hex: string): string {
  const c = lin(hex)
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`
}

/** The eight work states in legend order, and their light colours. */
export const STATES: readonly WorkState[] = ['work', ...LOSS_KINDS]
export const STATE_COLOURS: readonly T.Color[] = STATES.map((s) => lin(STATE_LIGHT[s]))
