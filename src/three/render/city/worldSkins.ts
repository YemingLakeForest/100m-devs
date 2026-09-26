/*
 * Copied from the rebuild (100m-devs-three/src/render/city/worldSkins.ts) on 2026-09-26, when the
 * work moved back here: the rebuild is read-only reference now, so this copy is
 * the one that changes. See docs/PLAN-2026-09-26-return.md.
 */
/**
 * **Every world its own city** — GDD §6 [amended 2026-09-24, Garage to Galaxy
 * decision 5], phase 7: *"Each world is its own endless, foggy city on the same
 * grid, with its own skin and ambience: Proxima is a red, tidally locked
 * twilight, TRAPPIST-1e is icy with sister planets, Kepler-452b is an older
 * Earth, and the galactic core is violet with no dark night."*
 *
 * A skin is the prototype's (v5, which the user played), expressed as what the
 * renderer needs: a sky for day, dusk and night, a colour grade laid over the
 * whole city, a fixed time of day for the worlds that do not turn, and whether
 * the land past the frontier is houses or rock.
 */
import { galaxy, type StarClass } from '../../sim/galaxy.ts'

export interface WorldSkin {
  key: string
  sky: { day: number[]; dusk: number[]; night: number[] }
  /** Multiplied over the city before the fog: the world's light. */
  grade: [number, number, number]
  /** 0..1 when the world does not turn (tidally locked, or no dark night). */
  tod: number | null
  /** What stands past the frontier. */
  wild: 'houses' | 'rocks'
  /** The note on the travel card. */
  note: string
  /** Sister planets in the sky (TRAPPIST). */
  moons?: boolean
}

export const SKINS: Record<string, WorldSkin> = {
  earth: { key: 'earth', sky: { day: [232, 234, 228], dusk: [236, 206, 178], night: [24, 29, 46] }, grade: [1, 1, 1], tod: null, wild: 'houses', note: 'home' },
  red: { key: 'red', sky: { day: [214, 146, 120], dusk: [200, 116, 98], night: [48, 22, 34] }, grade: [1.12, .78, .7], tod: .545, wild: 'rocks', note: 'eternal twilight: tidally locked' },
  ice: { key: 'ice', sky: { day: [206, 226, 236], dusk: [196, 184, 208], night: [22, 32, 58] }, grade: [.86, .96, 1.1], tod: null, wild: 'rocks', note: 'worlds in the sky', moons: true },
  gold: { key: 'gold', sky: { day: [236, 228, 196], dusk: [238, 196, 156], night: [32, 30, 46] }, grade: [1.08, 1.0, .8], tod: null, wild: 'houses', note: 'an older Earth' },
  verdant: { key: 'verdant', sky: { day: [214, 234, 226], dusk: [228, 208, 182], night: [22, 36, 52] }, grade: [.9, 1.06, .92], tod: null, wild: 'rocks', note: 'green, and almost home' },
  violet: { key: 'violet', sky: { day: [150, 92, 170], dusk: [160, 90, 140], night: [40, 16, 58] }, grade: [1.05, .82, 1.2], tod: .54, wild: 'rocks', note: 'no night is dark here' },
}

const BY_CLASS: Record<StarClass, string> = { M: 'red', K: 'gold', G: 'verdant', F: 'verdant', A: 'ice', B: 'violet', O: 'violet' }

/** The skin for the world at a galaxy node: the authored ones by name, the rest by their star. */
export function skinFor(node: number): WorldSkin {
  const s = galaxy().systems[node]
  if (!s) return SKINS.earth
  if (s.wid === 'earth') return SKINS.earth
  if (s.wid === 'proxima') return SKINS.red
  if (s.wid === 'trappist') return SKINS.ice
  if (s.wid === 'kepler') return SKINS.gold
  if (s.wid === 'core') return SKINS.violet
  return SKINS[BY_CLASS[s.cls]] ?? SKINS.verdant
}
