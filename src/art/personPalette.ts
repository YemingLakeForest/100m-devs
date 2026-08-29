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
 * The last two entries are §7.8.7's exceptions, and they work the same way:
 * they sit past `HAIR_COLOURS`, so no generated developer ever rolls one. James's
 * orange-brown is his the way his name is, and Billy's fair is Billy's.
 *
 * **Billy's blonde is `WOOD[3]` rather than a new colour.** ART_DIRECTION §9
 * treats adding an entry to the master palette as an amendment to the system and
 * not a convenience, so the question was which of the 37 reads as fair hair at
 * bust scale. `WARN[2]` is the obvious candidate and is wrong twice: it is a
 * phosphor amber, and it is one step from James's `WARN[1]`, which would put the
 * two of them in the same ramp family and quietly imply a relationship the story
 * spends a scene establishing does not exist. `WOOD[3]` is the top of the ramp
 * the other three browns already come from — the same hair, two shades lighter,
 * which is what fair hair is next to brown hair.
 */
export const HAIR_RAMP: ReadonlyArray<readonly [readonly string[], number]> = [
  [RAMPS.WOOD, 1],
  [RAMPS.WOOD, 0],
  [RAMPS.NEUTRAL, 1],
  [RAMPS.WOOD, 2],
  [RAMPS.WARN, 1],
  [RAMPS.WOOD, 3],
]

/** Skin. Index is `Look.skin`, into `RAMPS.SKIN`. */
export const SKIN_BASE: readonly number[] = [0, 1, 3, 5]

/**
 * Shirts. Index is `Look.shirt`.
 *
 * The last two entries are unreachable by a roll, on the same rule as the hair
 * above: James's white tee, and then Billy's light blue.
 *
 * **`GLOW[2]` and not `CALM[2]`**, though the two are neighbours on the wheel.
 * `CALM` is the interface's own phosphor — it is the speedometer at low entropy
 * — and a person wearing the readout's colour reads as a lit control rather than
 * as a man in a shirt. `GLOW` is what monitors and server LEDs are made of, so it
 * is already a *material* colour in this world rather than a UI one.
 */
export const SHIRT_RAMP: ReadonlyArray<readonly [readonly string[], number]> = [
  [RAMPS.NEUTRAL, 6],
  [RAMPS.CALM, 1],
  [RAMPS.WARN, 1],
  [RAMPS.FOLIAGE, 1],
  [RAMPS.NEUTRAL, 3],
  [RAMPS.NEUTRAL, 8],
  [RAMPS.GLOW, 2],
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
