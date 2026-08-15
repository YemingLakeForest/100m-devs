/**
 * What colour a person is — §7.8.7, shared by the room and by the interface.
 *
 * These three tables used to be private to `render/room.ts`, which was correct
 * while the only thing that drew a person was Pixi. §22.9's card draws one in
 * the DOM, and a second copy of "which ramp entry is James's orange" is exactly
 * the quiet divergence ART_DIRECTION §0 exists to prevent — the room would
 * change his hair and the card would not, and nothing would report it.
 *
 * They live here rather than in `room.ts` because a DOM component must not
 * import a module that pulls in Pixi. `avatarParts.ts` already made this split
 * for the *geometry*, on the same argument; this is the colour half of it.
 */

import { RAMPS } from './palette.ts'

/**
 * Hair. Index is `Look.hairColour`.
 *
 * The last entry is §7.8.7's exception: James's orange-brown sits one past
 * `HAIR_COLOURS`, so no generated developer ever rolls it. It is his, the same
 * way his name is.
 */
export const HAIR_RAMP: ReadonlyArray<readonly [readonly string[], number]> = [
  [RAMPS.WOOD, 1],
  [RAMPS.WOOD, 0],
  [RAMPS.NEUTRAL, 1],
  [RAMPS.WOOD, 2],
  [RAMPS.WARN, 1],
]

/** Skin. Index is `Look.skin`, into `RAMPS.SKIN`. */
export const SKIN_BASE: readonly number[] = [0, 1, 3, 5]

/**
 * Shirts. Index is `Look.shirt`.
 *
 * The last entry is James's white tee, on the same rule as his hair: one past
 * `SHIRT_COLOURS` and unreachable by a roll.
 */
export const SHIRT_RAMP: ReadonlyArray<readonly [readonly string[], number]> = [
  [RAMPS.NEUTRAL, 6],
  [RAMPS.CALM, 1],
  [RAMPS.WARN, 1],
  [RAMPS.FOLIAGE, 1],
  [RAMPS.NEUTRAL, 3],
  [RAMPS.NEUTRAL, 8],
]

/** The hex a `Look` resolves to, for a surface that wants CSS rather than Pixi. */
export function hairHex(hairColour: number): string {
  const [ramp, base] = HAIR_RAMP[hairColour % HAIR_RAMP.length]
  return ramp[base]
}

export function skinHex(skin: number): string {
  return RAMPS.SKIN[SKIN_BASE[skin % SKIN_BASE.length]]
}

export function shirtHex(shirt: number): string {
  const [ramp, base] = SHIRT_RAMP[shirt % SHIRT_RAMP.length]
  return ramp[base]
}
