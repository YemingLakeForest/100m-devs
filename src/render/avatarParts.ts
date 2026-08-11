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
  colour: 'ink' | 'mouth' | 'hair' | 'glasses' | 'phone-band' | 'phone-cup'
}

export const AVATAR_FACE = { x: -6, y: -26, w: 12, h: 14 } as const

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
  const t = 0.75
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
      { x: -4.5, y: -16, w: 4, h: 2.5, colour: 'hair' },
      { x: 0.5, y: -16, w: 4, h: 2.5, colour: 'hair' },
    ]
  }
  if (style === 2) {
    // Goatee: a compact central chin block, separate from both cheeks.
    return [{ x: -2, y: -14, w: 4, h: 5, colour: 'hair' }]
  }
  if (style === 3) {
    // Full beard: the same stepped-square construction as the hair crown.
    return [
      { x: -6, y: -17, w: 12, h: 5, colour: 'hair' },
      { x: -5, y: -12, w: 10, h: 3, colour: 'hair' },
    ]
  }
  return []
}

function glasses(enabled: boolean): AvatarRect[] {
  if (!enabled) return []
  return [
    ...outline(-5, -21.5, 4.5, 4.5),
    ...outline(0.5, -21.5, 4.5, 4.5),
    { x: -0.5, y: -19.75, w: 1, h: 0.75, colour: 'glasses' },
  ]
}

function headphones(enabled: boolean, hairShape: number): AvatarRect[] {
  if (!enabled) return []
  const hair = AVATAR_HAIR[((hairShape % AVATAR_HAIR.length) + AVATAR_HAIR.length) % AVATAR_HAIR.length]
  const bandY = -26 - hair.h + 7
  const parts: AvatarRect[] = [
    { x: -7, y: bandY, w: 14, h: 2, colour: 'phone-band' },
    { x: -7, y: bandY + 2, w: 2, h: -23 - (bandY + 2), colour: 'phone-band' },
    { x: 5, y: bandY + 2, w: 2, h: -23 - (bandY + 2), colour: 'phone-band' },
    { x: -8, y: -23, w: 3, h: 6, colour: 'phone-cup' },
    { x: 5, y: -23, w: 3, h: 6, colour: 'phone-cup' },
  ]
  return parts.filter((part) => part.h > 0)
}

export function frontAvatarParts(look: {
  hair: number
  facialHair: number
  glasses: boolean
  headphones: boolean
}): AvatarRect[] {
  return [
    ...FACE,
    ...facialHair(look.facialHair % 4),
    ...glasses(look.glasses),
    ...headphones(look.headphones, look.hair),
  ]
}
