/**
 * The player-facing half of GDD §4.5d / §7.8.10: who sits at your desk.
 *
 * A founder survives every kind of prestige, so this is install identity rather
 * than run state. Keeping it beside the boot flag also means a fresh save does
 * not make the same player introduce themself again.
 */

import type { Look } from '../sim/identity.ts'

export const FOUNDER_HEADS = [
  { id: 'crop', label: 'CROP' },
  { id: 'wave', label: 'WIDE' },
  { id: 'coil', label: 'TALL' },
  { id: 'buzz', label: 'FULL' },
] as const

export const FOUNDER_HAIR_COLOURS = [
  { id: 0, label: 'BROWN' },
  { id: 1, label: 'DARK' },
  { id: 2, label: 'BLACK' },
  { id: 3, label: 'COPPER' },
] as const

export const FOUNDER_SKINS = [
  { id: 0, label: 'TONE 1' },
  { id: 1, label: 'TONE 2' },
  { id: 2, label: 'TONE 3' },
  { id: 3, label: 'TONE 4' },
] as const

export const FOUNDER_ACCESSORIES = [
  { id: 'none', label: 'NONE' },
  { id: 'glasses', label: 'GLASSES' },
  { id: 'headphones', label: 'PHONES' },
] as const

export const FOUNDER_FACIAL_HAIR = [
  { id: 'none', label: 'NONE' },
  { id: 'moustache', label: 'MOUSTACHE' },
  { id: 'goatee', label: 'GOATEE' },
  { id: 'fullBeard', label: 'FULL BEARD' },
] as const

export const FOUNDER_BODIES = [
  { id: 'hoodie', label: 'HOODIE' },
  { id: 'tee', label: 'TEE' },
  { id: 'jacket', label: 'JACKET' },
  { id: 'knit', label: 'KNIT' },
] as const

export const FOUNDER_BODY_COLOURS = [
  { id: 0, label: 'INK' },
  { id: 1, label: 'CYAN' },
  { id: 2, label: 'AMBER' },
  { id: 3, label: 'GREEN' },
  { id: 4, label: 'SLATE' },
] as const

export type FounderHead = (typeof FOUNDER_HEADS)[number]['id']
export type FounderHairColour = (typeof FOUNDER_HAIR_COLOURS)[number]['id']
export type FounderSkin = (typeof FOUNDER_SKINS)[number]['id']
export type FounderAccessory = (typeof FOUNDER_ACCESSORIES)[number]['id']
export type FounderFacialHair = (typeof FOUNDER_FACIAL_HAIR)[number]['id']
export type FounderBody = (typeof FOUNDER_BODIES)[number]['id']
export type FounderBodyColour = (typeof FOUNDER_BODY_COLOURS)[number]['id']

export interface FounderProfile {
  name: string
  head: FounderHead
  hairColour: FounderHairColour
  skin: FounderSkin
  accessory: FounderAccessory
  facialHair: FounderFacialHair
  body: FounderBody
  bodyColour: FounderBodyColour
}

export const DEFAULT_FOUNDER: FounderProfile = {
  name: 'You',
  head: 'crop',
  hairColour: 0,
  skin: 2,
  accessory: 'none',
  facialHair: 'none',
  body: 'hoodie',
  bodyColour: 1,
}

/**
 * Founder choices resolve to the exact same block-person parts used by the
 * generated developers. The creator and the room may present those parts at
 * different scales, but they are no longer two unrelated character systems.
 */
export function founderLook(profile: FounderProfile): Look {
  return {
    hair: { crop: 1, wave: 3, coil: 2, buzz: 0 }[profile.head],
    hairColour: profile.hairColour,
    shirt: profile.bodyColour,
    body: { hoodie: 0, tee: 1, jacket: 2, knit: 3 }[profile.body],
    skin: profile.skin,
    glasses: profile.accessory === 'glasses',
    headphones: profile.accessory === 'headphones',
    facialHair: { none: 0, moustache: 1, goatee: 2, fullBeard: 3 }[profile.facialHair],
    slouch: { hoodie: 0, tee: -0.12, jacket: 0.1, knit: 0.2 }[profile.body],
  }
}

export const FOUNDER_PROFILE_KEY = 'm100devs_founder_profile'
export const FOUNDER_NAME_MAX = 24

export type FounderProfileStore = Pick<Storage, 'getItem' | 'setItem'>
export type FounderProfileClearStore = Pick<Storage, 'removeItem'>

const FIRST_NAMES = [
  'Alex',
  'Amara',
  'Anika',
  'Ari',
  'Casey',
  'Devon',
  'Imani',
  'Jules',
  'Kai',
  'Mina',
  'Nico',
  'Noor',
  'Remy',
  'Sam',
  'Tavi',
  'Zuri',
] as const

const LAST_NAMES = [
  'Chen',
  'Duarte',
  'Haddad',
  'Khan',
  'Kim',
  'Mensah',
  'Moreau',
  'Novak',
  'Okafor',
  'Patel',
  'Reyes',
  'Singh',
  'Tanaka',
  'Williams',
] as const

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function cleanFounderName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, FOUNDER_NAME_MAX)
}

function isHead(value: unknown): value is FounderHead {
  return FOUNDER_HEADS.some((option) => option.id === value)
}

function isBody(value: unknown): value is FounderBody {
  return FOUNDER_BODIES.some((option) => option.id === value)
}

function isHairColour(value: unknown): value is FounderHairColour {
  return FOUNDER_HAIR_COLOURS.some((option) => option.id === value)
}

function isSkin(value: unknown): value is FounderSkin {
  return FOUNDER_SKINS.some((option) => option.id === value)
}

function isAccessory(value: unknown): value is FounderAccessory {
  return FOUNDER_ACCESSORIES.some((option) => option.id === value)
}

function isFacialHair(value: unknown): value is FounderFacialHair {
  return FOUNDER_FACIAL_HAIR.some((option) => option.id === value)
}

function migrateFacialHair(value: unknown): FounderFacialHair {
  if (isFacialHair(value)) return value
  // Preserve old founders after simplifying the facial-hair set. The two
  // removed soft-edged styles land on the closest new square silhouette.
  if (value === 'stubble') return 'moustache'
  if (value === 'beard') return 'goatee'
  return 'none'
}

function isBodyColour(value: unknown): value is FounderBodyColour {
  return FOUNDER_BODY_COLOURS.some((option) => option.id === value)
}

/** Read defensively: identity is nice to remember and never worth a dead boot. */
export function readFounderProfile(
  store: FounderProfileStore | null = defaultStore(),
): FounderProfile | null {
  if (!store) return null
  try {
    const raw = store.getItem(FOUNDER_PROFILE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<FounderProfile> & Record<string, unknown>
    const name = typeof value.name === 'string' ? cleanFounderName(value.name) : ''
    // Profiles from the first creator only stored head/body. Upgrade them in
    // place instead of making a returning player introduce themselves again.
    const rawHead = value.head as unknown
    const legacyHead = rawHead === 'phones' ? 'buzz' : rawHead
    if (!name || !isHead(legacyHead) || !isBody(value.body)) return null
    const legacyBodyColour = ({ hoodie: 1, tee: 2, jacket: 0, knit: 3 } as const)[value.body]
    return {
      name,
      head: legacyHead,
      hairColour: isHairColour(value.hairColour) ? value.hairColour : 0,
      skin: isSkin(value.skin) ? value.skin : 2,
      accessory: isAccessory(value.accessory)
        ? value.accessory
        : rawHead === 'phones'
          ? 'headphones'
          : 'none',
      facialHair: migrateFacialHair(value.facialHair),
      body: value.body,
      bodyColour: isBodyColour(value.bodyColour) ? value.bodyColour : legacyBodyColour,
    }
  } catch {
    return null
  }
}

export function writeFounderProfile(
  value: FounderProfile,
  store: FounderProfileStore | null = defaultStore(),
): FounderProfile | null {
  const profile = {
    name: cleanFounderName(value.name),
    head: value.head,
    hairColour: value.hairColour,
    skin: value.skin,
    accessory: value.accessory,
    facialHair: value.facialHair,
    body: value.body,
    bodyColour: value.bodyColour,
  }
  if (
    !profile.name ||
    !isHead(profile.head) ||
    !isHairColour(profile.hairColour) ||
    !isSkin(profile.skin) ||
    !isAccessory(profile.accessory) ||
    !isFacialHair(profile.facialHair) ||
    !isBody(profile.body) ||
    !isBodyColour(profile.bodyColour)
  ) return null
  if (!store) return profile
  try {
    store.setItem(FOUNDER_PROFILE_KEY, JSON.stringify(profile))
    return profile
  } catch {
    // Storage can be blocked in embedded browsers. The session can still start.
    return profile
  }
}

function pick<T>(values: readonly T[], random: () => number): T {
  const draw = Math.min(0.999999, Math.max(0, random()))
  return values[Math.floor(draw * values.length)]
}

export function randomFounderName(random: () => number = Math.random): string {
  return `${pick(FIRST_NAMES, random)} ${pick(LAST_NAMES, random)}`
}

export function randomFounderLook(random: () => number = Math.random) {
  return {
    head: pick(FOUNDER_HEADS, random).id,
    hairColour: pick(FOUNDER_HAIR_COLOURS, random).id,
    skin: pick(FOUNDER_SKINS, random).id,
    accessory: pick(FOUNDER_ACCESSORIES, random).id,
    facialHair: pick(FOUNDER_FACIAL_HAIR, random).id,
    body: pick(FOUNDER_BODIES, random).id,
    bodyColour: pick(FOUNDER_BODY_COLOURS, random).id,
  }
}

/** New Game owns identity too: the next run must return to the creator. */
export function clearFounderProfile(
  store: FounderProfileClearStore | null = defaultStore(),
): void {
  if (!store) return
  try {
    store.removeItem(FOUNDER_PROFILE_KEY)
  } catch {
    // Storage can be blocked; the App still clears its in-memory profile.
  }
}
