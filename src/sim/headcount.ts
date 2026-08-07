/**
 * The Construction Ladder — GDD §7.7.
 *
 * Hiring is the game's primary verb and it has to be *seen*, from the first
 * developer to the ten-trillionth. The naive implementation — one sprite per
 * head, spawned where they sit — is right up to about 10³ and then fails twice:
 * technically, because 10¹² sprites is not a rendering problem but an
 * impossibility; and perceptually, well before that, because a player at 10¹²
 * who hires 10⁹ more has added 0.1% and no honest linear picture of 0.1% is a
 * feeling.
 *
 * The fix, applied throughout this module: **progress in this genre is
 * multiplicative, so the feedback is multiplicative too.** Nobody experiences
 * "plus a billion". They experience "×2, something" or "×1.001, nothing".
 *
 * Pure and dependency-free, so the rule that decides whether hiring feels good
 * is testable without a renderer.
 */

/**
 * Sprites the renderer will hold. The same 1,000 GDD §23.3 criterion 4
 * measures — above this, one sprite stops being one developer (see
 * {@link cohortSize}).
 */
export const SPRITE_BUDGET = 1000

/** §7.7.3 — arrival weight per decade of growth, and the bounds on a single burst. */
const BODIES_PER_DECADE = 40
export const MIN_BURST = 1
export const MAX_BURST = 120

/**
 * §7.7.3 — how many bodies visibly arrive for a hire, from `before` to `after`.
 *
 * The whole design is in the log: the burst is a function of the *ratio*, so a
 * hire that doubles the studio looks the same at 1 → 2 and at 10¹² → 2×10¹².
 * A hire that barely moves the needle is allowed to look like it barely moved
 * the needle — that is information, not a failure.
 *
 * Never returns 0 for a real hire. The player pressed a button; something has
 * to arrive.
 */
export function spawnBurst(before: number, after: number): number {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return MIN_BURST
  if (after <= before) return 0
  // A studio growing from nothing has no ratio to speak of, so it gets the
  // full burst — this is the first hire in the game and it is the one that
  // teaches the player what a hire looks like.
  if (before <= 0) return MAX_BURST

  const decades = Math.log10(after / before)
  return Math.min(MAX_BURST, Math.max(MIN_BURST, Math.round(BODIES_PER_DECADE * decades)))
}

/**
 * §7.7.5 — how many developers one on-screen unit stands for.
 *
 * This is the rung's own `unitSize`, and it has to be: the unit the player sees
 * is a *floor*, a *building*, a *town*, so the number attached to it must be
 * the number of people in one of those. Deriving it independently — from
 * `devs / SPRITE_BUDGET`, as this first did — puts the cohort and the rung on
 * different schedules, and they disagree. At 1,002 developers that produced a
 * scale bar reading **"1 FLOOR = 1 DEVS"**, which is not a rounding error but
 * a sentence that means nothing.
 *
 * Every rung's span also keeps the unit count inside {@link SPRITE_BUDGET} by
 * construction rather than by clamping.
 */
export function cohortSize(devs: number): number {
  if (!Number.isFinite(devs)) return 1
  return rungFor(devs).unitSize
}

/** How many units actually stand on the floor at this headcount. */
export function visibleSprites(devs: number): number {
  if (devs <= 0) return 0
  return Math.min(SPRITE_BUDGET, Math.max(1, Math.floor(devs / cohortSize(devs))))
}

/**
 * §7.7.1 — the Construction Ladder.
 *
 * The studio grows the way a city grows. First you fill a floor with people;
 * then you stop adding people and start adding *floors*, then buildings,
 * campuses, towns, nations, planets, galaxies. At every rung the player is
 * still watching something physically arrive — it is just a bigger thing.
 *
 * `unit` is what one arrival *is*, and it is the noun the §7.7.2 construction
 * gag animates: a floor is slapped onto the tower, a building slams down beside
 * it, a planet is set down and bounces once.
 *
 * Upper bound is exclusive; the last rung is open.
 */
export const RUNGS = [
  { rung: 0, upTo: 1e1, unit: 'person', unitSize: 1, place: 'one desk, then a huddle' },
  { rung: 1, upTo: 1e2, unit: 'person', unitSize: 1, place: 'a room of desks' },
  { rung: 2, upTo: 1e3, unit: 'person', unitSize: 1, place: 'one full floor, rank and file' },
  { rung: 3, upTo: 1e4, unit: 'floor', unitSize: 1e3, place: 'a tower growing storey by storey' },
  { rung: 4, upTo: 1e5, unit: 'building', unitSize: 1e4, place: 'a block' },
  { rung: 5, upTo: 1e6, unit: 'campus', unitSize: 1e5, place: 'a business park' },
  { rung: 6, upTo: 1e8, unit: 'town', unitSize: 1e6, place: 'a sprawl to the horizon' },
  { rung: 7, upTo: 1e10, unit: 'nation', unitSize: 1e8, place: 'a continent, lit at night' },
  { rung: 8, upTo: 1e13, unit: 'planet', unitSize: 1e10, place: 'a system' },
  { rung: 9, upTo: Number.POSITIVE_INFINITY, unit: 'galaxy', unitSize: 1e13, place: 'a cluster' },
] as const

export type Rung = (typeof RUNGS)[number]

/**
 * §7.7.1 rungs 0-2 — one sprite is one person, and the whole of Run 1 (§21)
 * happens here. Nothing above is allowed to make this stop being true.
 */
export const LITERAL_RUNG_LIMIT = 2

/** Which rung of §7.7.1 a headcount sits on. */
export function rungFor(devs: number): Rung {
  return RUNGS.find((r) => devs < r.upTo) ?? RUNGS[RUNGS.length - 1]
}

/**
 * True while one on-screen developer is one actual developer — §7.7.1 rungs
 * 0-2, where the fiction is established.
 */
export function isLiteral(devs: number): boolean {
  return rungFor(devs).rung <= LITERAL_RUNG_LIMIT
}

/**
 * Did this hire cross a rung? §7.7.2 promotions are scored construction gags —
 * camera, audio, a whole storey dropping out of the sky — so the renderer needs
 * to know, and it must not have to diff the table itself.
 *
 * Returns the rung *landed on*, not each rung passed: the §6 Mass Hire jumps
 * several at once and that is one arrival, not five.
 */
export function rungCrossed(before: number, after: number): Rung | null {
  const from = rungFor(before)
  const to = rungFor(after)
  return to.rung > from.rung ? to : null
}

/**
 * How far the camera may pull back at this headcount — GDD §7.7.1.
 *
 * **The studio you can see is the studio you have.** With two developers there
 * is no campus to look at, no globe, no galaxy — there is a desk and the person
 * next to you, and the lens must not be able to leave them. A camera that can
 * reach galactic zoom over an empty world tells the player the game is a
 * backdrop they are pointing at rather than a place they are filling.
 *
 * Returned as a maximum Z on the §7.2 ladder, mapped to the §7.4 canonical
 * levels: you may see one level beyond nothing, and the ceiling lifts as the
 * headcount earns it. Each lift is a §7.7.2 promotion and should be scored.
 *
 * The floor of 0 is never clamped — pinching all the way *in* is always allowed,
 * because §7.7.4 makes returning to James an absolute guarantee.
 */
export function maxZoomFor(devs: number): number {
  if (!Number.isFinite(devs)) return 1
  // Desk and huddle. One room, and you cannot leave it.
  if (devs < 1e2) return 0.2
  // The open floor.
  if (devs < 1e4) return 0.5
  // Towers, blocks, campuses — the global grid opens up.
  if (devs < 1e7) return 0.8
  // Towns, nations, planets, galaxies. The whole ladder.
  return 1
}

/**
 * Did this hire lift the zoom ceiling? A reveal beat, not a state change —
 * the camera gains a whole register and the player should be shown it.
 */
export function zoomCeilingLifted(before: number, after: number): boolean {
  return maxZoomFor(after) > maxZoomFor(before)
}

const MAGNITUDES = [
  { at: 1e12, suffix: 'T' },
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'K' },
] as const

/**
 * Short-form a count for the HUD — `4.2 T`, `25 K`, `8`.
 *
 * Deliberately not `Intl.NumberFormat`: it localises, and a localised thousands
 * separator changes the string width, which ART_DIRECTION §3 rule 3 forbids for
 * anything that counts up beside a monospace face.
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  const abs = Math.abs(n)
  for (const { at, suffix } of MAGNITUDES) {
    if (abs >= at) {
      const scaled = n / at
      // One decimal below 100 so 4.2 T reads as growth; none above, because
      // 250.3 K is four significant figures of nothing.
      return `${scaled < 100 ? scaled.toFixed(1) : Math.round(scaled)} ${suffix}`
    }
  }
  return String(Math.round(n))
}

/**
 * §7.7.5 — the scale bar, or null while one sprite is still one developer.
 *
 * A picture whose units silently changed is a lie, so this is not optional
 * decoration: at rung 7 a player who thinks one dot is one developer has
 * been misled by their own game.
 */
export function scaleBar(devs: number): string | null {
  const rung = rungFor(devs)
  // Silent while one unit is one person: "1 PERSON = 1 DEVS" is noise.
  if (rung.unitSize <= 1) return null
  return `1 ${rung.unit.toUpperCase()} = ${formatCount(rung.unitSize)} DEVS`
}
