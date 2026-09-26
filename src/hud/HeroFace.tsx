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

import { useMemo } from 'react'
import type { Look } from '../sim/identity.ts'
import { LEADER_IDS, type LeaderId } from '../three/sim/floorPlan.ts'
import { personPortrait } from '../three/render/portrait.ts'

/**
 * [2026-09-26] **The face is the room's person, framed** — *"any scenes with
 * arvatar should be the 3d model not the old 2d"*. This was the room's
 * `frontAvatarParts` redrawn as SVG rects; the room is three.js now, so the
 * portrait is its `studioPerson()` rendered head-and-shoulders
 * (`three/render/portrait.ts`), and a hero the room sculpts (James, Billy,
 * Serena, Matt) gets their own head rather than the crowd's.
 */
export function HeroFace({ look, id, className }: { look: Look; id?: string; className?: string }) {
  const leader = LEADER_IDS.includes(id as LeaderId) ? (id as LeaderId) : undefined
  const src = useMemo(() => personPortrait(look, leader, 'head'), [look, leader])
  return src
    ? <img className={className} src={src} alt="" aria-hidden="true" />
    : <span className={className} aria-hidden="true" />
}
