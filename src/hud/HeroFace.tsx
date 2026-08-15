/**
 * §22.9.2's portrait — **§7.8.7's generated face, framed rather than redrawn.**
 *
 * That sentence is the whole specification and it is also the budget: §22.7 caps
 * portraits at twelve and this costs none of them, because it is not a portrait.
 * It is the same `frontAvatarParts` table `render/room.ts` feeds to Pixi when a
 * selected developer turns round (§7.8.8), rendered as SVG rects instead.
 *
 * `avatarParts.ts` already made that split for the geometry and says why: these
 * are "deliberately rectangles, not two drawings that merely resemble one
 * another", so an accessory cannot drift away from the eyes in one surface
 * without moving in the other. `art/personPalette.ts` is the colour half of the
 * same argument.
 */

import { AVATAR_FACE, AVATAR_HAIR, frontAvatarParts, type AvatarRect } from '../render/avatarParts.ts'
import { RAMPS } from '../art/palette.ts'
import { hairHex, shirtHex, skinHex } from '../art/personPalette.ts'
import type { Look } from '../sim/identity.ts'

/**
 * The room's world units, unscaled. The head sits at y −26..−12 and hair reaches
 * a little above it, so the box is the head plus a collar of shoulder — a
 * portrait crop rather than a whole person, which is what a pass carries.
 */
const VIEW = { x: -11, y: -32, w: 22, h: 25 } as const

export function HeroFace({ look, className }: { look: Look; className?: string }) {
  const hair = AVATAR_HAIR[look.hair % AVATAR_HAIR.length]
  const hairFill = hairHex(look.hairColour)
  const skinFill = skinHex(look.skin)
  const shirtFill = shirtHex(look.shirt)

  const partFill: Record<AvatarRect['colour'], string> = {
    ink: RAMPS.NEUTRAL[0],
    mouth: RAMPS.NEUTRAL[1],
    hair: hairFill,
    glasses: RAMPS.NEUTRAL[2],
    'phone-band': RAMPS.NEUTRAL[1],
    'phone-cup': RAMPS.NEUTRAL[2],
  }

  return (
    <svg
      className={className}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* Shoulders, so the head is attached to somebody. */}
      <rect x={-9} y={-12} width={18} height={6} fill={shirtFill} />
      {/* The face: a flat panel, because it is turned to the camera and its two
          vertical faces would be edge-on — drawing them would be a lie. */}
      <rect x={AVATAR_FACE.x} y={AVATAR_FACE.y} width={AVATAR_FACE.w} height={AVATAR_FACE.h} fill={skinFill} />
      {/* Hair over the crown and down the sides, leaving the face clear. */}
      <rect x={-hair.w / 2} y={-26 - hair.h + 8} width={hair.w} height={hair.h - 6} fill={hairFill} />
      <rect x={-hair.w / 2} y={-24} width={2} height={8} fill={hairFill} />
      <rect x={hair.w / 2 - 2} y={-24} width={2} height={8} fill={hairFill} />
      {frontAvatarParts(look).map((part, i) => (
        <rect key={i} x={part.x} y={part.y} width={part.w} height={part.h} fill={partFill[part.colour]} />
      ))}
    </svg>
  )
}
