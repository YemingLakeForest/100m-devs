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
  { id: 'wave', label: 'WAVE' },
  { id: 'coil', label: 'COIL' },
  { id: 'phones', label: 'PHONES' },
] as const

export const FOUNDER_BODIES = [
  { id: 'hoodie', label: 'HOODIE' },
  { id: 'tee', label: 'TEE' },
  { id: 'jacket', label: 'JACKET' },
  { id: 'knit', label: 'KNIT' },
] as const

export type FounderHead = (typeof FOUNDER_HEADS)[number]['id']
export type FounderBody = (typeof FOUNDER_BODIES)[number]['id']

export interface FounderProfile {
  name: string
  head: FounderHead
  body: FounderBody
}

export const DEFAULT_FOUNDER: FounderProfile = {
  name: 'You',
  head: 'crop',
  body: 'hoodie',
}

/**
 * Founder choices resolve to the exact same block-person parts used by the
 * generated developers. The creator and the room may present those parts at
 * different scales, but they are no longer two unrelated character systems.
 */
export function founderLook(profile: FounderProfile): Look {
  const head = {
    crop: { hair: 1, hairColour: 0, headphones: false },
    wave: { hair: 3, hairColour: 3, headphones: false },
    coil: { hair: 2, hairColour: 2, headphones: false },
    phones: { hair: 0, hairColour: 2, headphones: true },
  }[profile.head]

  const shirt = {
    hoodie: 1,
    tee: 2,
    jacket: 0,
    knit: 3,
  }[profile.body]

  return {
    ...head,
    shirt,
    skin: 2,
    glasses: false,
    slouch: 0,
  }
}

export const FOUNDER_PROFILE_KEY = 'm100devs_founder_profile'
export const FOUNDER_NAME_MAX = 24

export type FounderProfileStore = Pick<Storage, 'getItem' | 'setItem'>

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

function defaultStore(): FounderProfileStore | null {
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

/** Read defensively: identity is nice to remember and never worth a dead boot. */
export function readFounderProfile(
  store: FounderProfileStore | null = defaultStore(),
): FounderProfile | null {
  if (!store) return null
  try {
    const raw = store.getItem(FOUNDER_PROFILE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<FounderProfile>
    const name = typeof value.name === 'string' ? cleanFounderName(value.name) : ''
    if (!name || !isHead(value.head) || !isBody(value.body)) return null
    return { name, head: value.head, body: value.body }
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
    body: value.body,
  }
  if (!profile.name || !isHead(profile.head) || !isBody(profile.body)) return null
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
    body: pick(FOUNDER_BODIES, random).id,
  }
}
