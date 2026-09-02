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

import { BUILDING_CAP, FLOOR_CAP, GARAGE_CAP } from './capacity.ts'
import { ceilingZForRung } from './ladder.ts'

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
  // **A tenfold hire fills the frame.** The ratio rule alone gave the Act III
  // Mass Hire — forty developers to one thousand and forty — fifty-seven bodies
  // across a hundred and twenty desks, so the single largest event in the run
  // landed as a sprinkle over a half-empty room. Any hire that multiplies the
  // studio by ten or more is not a hire, it is a transformation, and §7.7.2
  // asks for it to be *seen*: every visible seat gets somebody dropped into it.
  if (decades >= 1) return MAX_BURST
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
  // The *drawn* rung: one on-screen unit is a world at every headcount past
  // §13.5's gate, because that is what the network puts on screen.
  return drawnRungFor(devs).unitSize
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
 * campuses, sites, worlds, systems, galaxies. At every rung the player is still
 * watching something physically arrive — it is just a bigger thing.
 *
 * **The table runs two rungs past what the lens draws, and that is deliberate**
 * (§7.7.1a). Rungs 8 and 9 are not pictures — §7.4a's ladder stops at the
 * network — but they are still the top two tiers of §13.6.1's hero reach, whose
 * ladder is *derived* from this table rather than written down a second time.
 * {@link DRAWN_RUNG_LIMIT} is where the pictures stop; this is where the
 * vocabulary does.
 *
 * `unit` is what one arrival *is*, and it is the noun the §7.7.2 construction
 * gag animates: a floor is slapped onto the tower, a building slams down beside
 * it, a planet is set down and bounces once.
 *
 * Upper bound is exclusive; the last rung is open.
 */
export const RUNGS = [
  // §7.8.0 [amended 2026-09-01] — **the bottom four rungs were re-anchored and
  // the top six were not.** The old table gave rung 0 ten people, rung 1 a
  // hundred, rung 2 a thousand "rank and file" on one floor, and rung 3 a tower
  // of thousand-person floors. Three of those four numbers were describing a
  // floor nobody could read: at a thousand desks in frame a developer is four
  // pixels, so every hire between 100 and 1,000 was the same event.
  //
  // So the garage is twenty, the floor is a hundred, and the tower spends
  // **two** rungs climbing to a hundred storeys — which is where the old table
  // already had its 10^4, so rung 4 upward is byte-identical and §13.5's 10^8
  // gate has not moved. The rescale is entirely below the building.
  //
  // **The bottom four bounds are one past their round number and the rest are
  // not**, and the asymmetry is the scale model rather than a fencepost slip.
  // Below the building the unit is *completed by a developer the player is
  // watching*: the twentieth fills the garage, the hundredth fills the floor,
  // the ten-thousandth tops the building out. A player who has just seen
  // somebody sit down has to still be in the room they sat down in, so the
  // boundary is inclusive and the exclusive `upTo` is one higher. Above the
  // building nobody can see the boundary land — the hundred-thousandth
  // developer is not visibly anywhere — so those rungs keep the round exclusive
  // bounds they have always had, and §13.5's 10^8 gate is untouched.
  { rung: 0, upTo: GARAGE_CAP + 1, unit: 'person', unitSize: 1, place: 'a garage, five pods of four' },
  { rung: 1, upTo: FLOOR_CAP + 1, unit: 'person', unitSize: 1, place: 'one office floor, filling' },
  // Rungs 2 and 3 are both the tower, the way 0 and 1 are both the room: ten
  // storeys, then a hundred. The unit is a floor and a floor is a hundred
  // people, so the §7.7.2 gag at 101 is a whole storey landing.
  { rung: 2, upTo: FLOOR_CAP * 10 + 1, unit: 'floor', unitSize: FLOOR_CAP, place: 'a tower, storey by storey' },
  { rung: 3, upTo: BUILDING_CAP + 1, unit: 'floor', unitSize: FLOOR_CAP, place: 'the tower topping out at a hundred' },
  { rung: 4, upTo: 1e5, unit: 'building', unitSize: 1e4, place: 'a block' },
  { rung: 5, upTo: 1e6, unit: 'campus', unitSize: 1e5, place: 'a business park' },
  { rung: 6, upTo: 1e8, unit: 'site', unitSize: 1e6, place: 'a planet filling with campuses' },
  // **§7.7.1a — rung 7 is a world, not a nation.** The unit was 'nation' with a
  // continent lit at night behind it, on the assumption that 10^8 developers
  // still fit on Earth. `frames.globeRadius` then made that assumption false by
  // deriving it away: a hundred parks of a million *tile the sphere*, so at 10^8
  // the planet is full and the thing that arrives next is another planet. The
  // size never moved — 10^8 is what one world holds either way — only the noun,
  // and the noun is what the HUD says out loud.
  { rung: 7, upTo: 1e10, unit: 'world', unitSize: 1e8, place: 'a network of stars' },
  { rung: 8, upTo: 1e13, unit: 'planet', unitSize: 1e10, place: 'a system' },
  { rung: 9, upTo: Number.POSITIVE_INFINITY, unit: 'galaxy', unitSize: 1e13, place: 'a cluster' },
] as const

export type Rung = (typeof RUNGS)[number]

/**
 * §7.7.1 rungs 0-1 — one sprite is one person, and the whole of Run 1 (§21)
 * happens here. Nothing above is allowed to make this stop being true.
 *
 * **Was 2, and §7.8.0 moved it to 1.** Not a reduction in ambition: the rung it
 * gave up is the one the rescale took away from the room. Rung 2 used to be "a
 * thousand people on one floor" and is now "ten storeys", so a sprite there is
 * a *floor*, and claiming otherwise would put the scale bar and the picture on
 * different schedules — the exact defect {@link cohortSize} exists to close.
 * The literal band still covers every headcount the room is drawn at, which is
 * the promise that was ever being made: while you are looking at a floor, every
 * body on it is somebody.
 */
export const LITERAL_RUNG_LIMIT = 1

/**
 * The highest rung the lens actually draws — §7.4a's eighth stop, §7.7.1a.
 *
 * The table above runs to rung 9 because §13.6.1's hero reach is derived from
 * it, but the *camera* stops at the galactic network and the network's unit is
 * a **world**. Above 10¹⁰ developers that difference was a visible lie: §7.7.5's
 * scale bar read **"1 PLANET = 10.0 B DEVS"** over a picture of planets holding
 * a hundred million each, which is exactly the defect the town-to-site and
 * nation-to-world renames closed one rung down. A picture whose units silently
 * changed is a lie; a unit the picture does not contain is a louder one.
 *
 * So the bar and the cohort name **what is on screen**, and what is on screen
 * is a world however many of them there are. The network does not saturate, so
 * this is a ceiling on the *noun*, not on the studio.
 */
export const DRAWN_RUNG_LIMIT = 7

/** The rung the lens is drawing at this headcount — {@link DRAWN_RUNG_LIMIT}. */
export function drawnRungFor(devs: number): Rung {
  const rung = rungFor(devs)
  return rung.rung <= DRAWN_RUNG_LIMIT ? rung : RUNGS[DRAWN_RUNG_LIMIT]
}

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
 * Returned as a maximum Z on the §7.2 ladder, and the ceiling is now **the
 * player's own rung** rather than one of §7.4's four bands. That is §7.4a: the
 * bands were a rendering concept standing in for a navigation one, so a studio
 * of three thousand could pull back to "the global grid" — three rungs past
 * anything it had built — while never being shown the tower it *had*. Each lift
 * is one rung and is a §7.7.2 promotion, so each one should be scored.
 *
 * The floor of 0 is never clamped — pinching all the way *in* is always allowed,
 * because §7.7.4 makes returning to James an absolute guarantee.
 */
export function maxZoomFor(devs: number): number {
  if (!Number.isFinite(devs)) return 1
  return ceilingZForRung(rungFor(devs).rung)
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
  const rung = drawnRungFor(devs)
  // Silent while one unit is one person: "1 PERSON = 1 DEVS" is noise.
  if (rung.unitSize <= 1) return null
  return `1 ${rung.unit.toUpperCase()} = ${formatCount(rung.unitSize)} DEVS`
}
