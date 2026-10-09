/*
 * Copied from the rebuild (100m-devs-three/src/render/avatarParts.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * Camera-facing block-person parts shared by the creator and Pixi room.
 *
 * These are deliberately rectangles, not two drawings that merely resemble
 * one another. FounderAvatar renders this table as SVG rects; room.ts feeds the
 * same table to Pixi Graphics. A selected accessory therefore cannot drift
 * away from the eyes in one surface without moving in the other too.
 */

export interface AvatarRect {
  x: number
  y: number
  w: number
  h: number
  colour: 'ink' | 'mouth' | 'hair' | 'glasses'
}

export const AVATAR_HAIR: ReadonlyArray<{ w: number; h: number; y: number }> = [
  { w: 14, h: 12, y: -18 }, // full
  { w: 15, h: 9, y: -18 }, // cropped
  { w: 13, h: 15, y: -18 }, // tall
  { w: 16, h: 11, y: -17 }, // wide, low
]

const FACE: readonly AvatarRect[] = [
  { x: -4, y: -20, w: 2.5, h: 2, colour: 'ink' },
  { x: 1.5, y: -20, w: 2.5, h: 2, colour: 'ink' },
  { x: -1.5, y: -14.5, w: 3, h: 1, colour: 'mouth' },
]

function outline(x: number, y: number, w: number, h: number): AvatarRect[] {
  const t = 0.45
  return [
    { x, y, w, h: t, colour: 'glasses' },
    { x, y: y + h - t, w, h: t, colour: 'glasses' },
    { x, y: y + t, w: t, h: h - t * 2, colour: 'glasses' },
    { x: x + w - t, y: y + t, w: t, h: h - t * 2, colour: 'glasses' },
  ]
}

function facialHair(style: number): AvatarRect[] {
  if (style === 1) {
    // Moustache: two square blocks leave a hard centre notch under the nose.
    return [
      { x: -3.4, y: -16, w: 2.9, h: 1.4, colour: 'hair' },
      { x: 0.5, y: -16, w: 2.9, h: 1.4, colour: 'hair' },
    ]
  }
  if (style === 2) {
    // Goatee: a compact central chin block, separate from both cheeks.
    return [
      { x: -1.4, y: -14, w: 2.8, h: 1.5, colour: 'hair' },
      { x: -.85, y: -12.5, w: 1.7, h: .5, colour: 'hair' },
    ]
  }
  if (style === 3) {
    // Full beard: the same stepped-square construction as the hair crown.
    return [
      { x: -5.5, y: -17, w: 2.2, h: 4.5, colour: 'hair' },
      { x: 3.3, y: -17, w: 2.2, h: 4.5, colour: 'hair' },
      { x: -3.8, y: -13, w: 7.6, h: 1, colour: 'hair' },
    ]
  }
  return []
}

function glasses(enabled: boolean): AvatarRect[] {
  if (!enabled) return []
  return [
    ...outline(-5.3, -21.2, 4.8, 3.8),
    ...outline(0.5, -21.2, 4.8, 3.8),
    { x: -0.5, y: -19.75, w: 1, h: 0.45, colour: 'glasses' },
  ]
}

/*
 * **Headphones are not in this table, because they are not on the face.**
 *
 * They used to be: a band and two cups as flat rectangles on the same front
 * plane as the eyes, which drew them stuck to the front of the face beside the
 * nose instead of wrapped over the ears. Flat was the right call while this
 * table fed two renderers that had to agree pixel for pixel; it is not the
 * right call now that its only consumer builds a head out of boxes, and an
 * earcup's whole job is to be on the side. `studioPeople.ts` builds them in
 * three dimensions, off the same `AVATAR_HAIR` crown height this file already
 * publishes.
 *
 * What stays here is what genuinely is flat and frontal: eyes, mouth, facial
 * hair and spectacles.
 */
export function frontAvatarParts(look: {
  hair: number
  facialHair: number
  glasses: boolean
}): AvatarRect[] {
  return [
    ...FACE.map(p => look.glasses && p.colour === 'ink'
      ? { ...p, x: p.x + .6, y: p.y + .25, w: 1.3, h: 1.5 } : p),
    ...facialHair(look.facialHair % 4),
    ...glasses(look.glasses),
  ]
}
