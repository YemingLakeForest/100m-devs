/**
 * What the HQ looks like at each scale — GDD §7.8.12 [added 2026-10-04].
 *
 * *"I want the HQ look and feel scales with how we progress from garage to
 * galaxy."* The HQ is the one place on every rung that is recognisably the same
 * place, so what changes with scale is its **materiality**, and what never
 * changes is a short list: the roll-up door's silhouette, the founder's and
 * James's plates, and — this file's one decision — **the heroes' colours**. Each
 * person who has walked in is a colour (`heroBranches.ts`), and the colour goes
 * wherever the HQ goes: a bay in the garage, a wing on the campus, a pip on the
 * survey's map, a point on the ring round Sol.
 *
 * Pure — no store, no clock, no renderer. The renderers read this and none of
 * them decides, for itself, how big the HQ is.
 */

import { BRANCH_BY_ID } from './heroBranches.ts'
import { HERO_BY_ID, STORY_HEROES, type HeroId } from './storyHeroes.ts'

/** The ladder, in order. Each is what the HQ *is* at that size, not a view of it. */
export type HqStage = 'garage' | 'storey' | 'tower' | 'campus' | 'capital' | 'origin'

export const HQ_STAGES: readonly HqStage[] = ['garage', 'storey', 'tower', 'campus', 'capital', 'origin']

/**
 * Where each stage ends, in developers. The garage is §7.7.2's twenty; the rest
 * are `sim/eras.ts`'s own boundaries where they exist (HQ to a thousand, the
 * city to a million, Earth to a hundred million, then the stars) with the
 * storey across the lane between twenty and a hundred.
 */
export const HQ_STAGE_UPTO: Readonly<Record<HqStage, number>> = {
  garage: 20,
  storey: 100,
  tower: 1_000,
  campus: 1_000_000,
  capital: 100_000_000,
  origin: Infinity,
}

export function hqStage(heads: number): HqStage {
  const n = Number.isFinite(heads) ? Math.max(0, heads) : Infinity
  return HQ_STAGES.find((s) => n <= HQ_STAGE_UPTO[s]) ?? 'origin'
}

/** What the HQ is made of at each stage: the *material* of the rung, in a line. */
export const HQ_MATERIAL: Readonly<Record<HqStage, string>> = {
  garage: 'plywood, a lamp and an extension cord; every bay a different cheap material',
  storey: 'fitted out: the bays have proper walls and the sign says HQ',
  tower: 'glass and steel, with the garage kept at its foot under glass',
  campus: 'the garage at the heart of a campus; each bay grown into a wing in its hero’s colour',
  capital: 'a lit site on the planet, marked by the roll-up door’s glyph',
  origin: 'Sol: the origin every colony’s own HQ echoes, smaller',
}

/** One hero's wing, pip or point: who, and the colour that is theirs everywhere. */
export interface HqWing {
  hero: HeroId
  name: string
  colour: string
}

/**
 * The heroes who have walked in, as the colours the HQ wears — in the roster's
 * order, so the same people are in the same places at every scale, and nobody
 * who has not arrived is anywhere.
 */
export function hqWings(arrived: Iterable<HeroId>): HqWing[] {
  const here = new Set(arrived)
  return STORY_HEROES.filter((h) => h.id !== 'james' && here.has(h.id)).map((h) => ({
    hero: h.id,
    name: h.name,
    colour: BRANCH_BY_ID.get(h.branch)?.colour ?? '#d8d8c0',
  }))
}

/** How the survey's map marks the HQ. A shape the drawing code can follow without opinions. */
export interface HqMarker {
  stage: HqStage
  /** Borders round the label: one for a garage, more as it becomes a place. */
  borders: number
  /** A crown tick over it from the capital up: the one thing on the map that is home. */
  crown: boolean
  wings: HqWing[]
}

export function hqMarker(heads: number, arrived: Iterable<HeroId>): HqMarker {
  const stage = hqStage(heads)
  const rank = HQ_STAGES.indexOf(stage)
  return { stage, borders: 1 + Math.min(2, Math.max(0, rank - 2)), crown: rank >= HQ_STAGES.indexOf('capital'), wings: hqWings(arrived) }
}

/** Is `id` somebody the HQ has a colour for? James is the constant, and the founder is YOU. */
export const hasWing = (id: HeroId): boolean => id !== 'james' && HERO_BY_ID.has(id)
